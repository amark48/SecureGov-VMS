// src/services/api.ts

class AuthError extends Error {
  constructor(message: string = 'Unauthorized') {
    super(message);
    this.name = 'AuthError';
  }
}

class ApiClient {
  private baseURL: string;
  private token: string | null = null;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
  }

  setToken(token: string | null) {
    this.token = token;
    console.log('ApiClient: Token set to:', token ? token.substring(0, 10) + '...' : 'null');
  }

  getToken(): string | null {
    console.log('ApiClient: Token retrieved:', this.token ? this.token.substring(0, 10) + '...' : 'null');
    return this.token;
  }

  getBaseURL(): string {
    return this.baseURL;
  }

  private normalizeEndpoint(endpoint: string): string {
    const identityProvRegex = /^\/api\/tenants\/([^\/]+)\/identity-providers$/;
    const m = endpoint.match(identityProvRegex);
    if (m) {
      const tenantId = m[1];
      return `/api/identity-providers?tenantId=${tenantId}`;
    }
    
    // Normalize ACS configuration test endpoint
    const acsTestRegex = /^\/api\/acs\/configurations\/([^\/]+)\/test$/;
    const acsMatch = endpoint.match(acsTestRegex);
    if (acsMatch) {
      const configId = acsMatch[1];
      return `/api/acs/test-connection?configId=${configId}`;
    }
    
    return endpoint;
  }

  private async request<T>(
    endpoint: string,
    method: string,
    data?: any,
    skipAuth = false,
    extraHeaders?: HeadersInit
  ): Promise<T> {
    const ep = this.normalizeEndpoint(endpoint);
    const url = this.baseURL + ep;

    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (this.token && !skipAuth) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    if (extraHeaders) {
      Object.assign(headers, extraHeaders);
    }

    const config: RequestInit = { method, headers };
    if (data) config.body = JSON.stringify(data);

    console.log(`${method} ${ep}`);
    console.log('Request headers being sent:', {
      ...headers,
      Authorization: headers['Authorization'] ? headers['Authorization'].substring(0, 20) + '...' : 'N/A'
    });

    const response = await fetch(url, config);
    if (!response.ok) {
      let errorData: any;
      try {
        errorData = await response.json();
      } catch {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const errorMessage = errorData.message || errorData.error || 'Something went wrong';
      const errorCode    = errorData.code    || response.status;
      const errorPath    = errorData.path    || ep;

      if (errorCode === 'TOKEN_MISSING' || response.status === 401) {
        throw new AuthError(`${errorMessage} (Path: ${errorPath})`);
      }

      throw new Error(`API Error: ${errorCode} (${response.statusText}) - ${errorMessage} (Path: ${errorPath})`);
    }

    if (response.status === 204) {
      return {} as T;
    }

    return response.json();
  }

  get<T>(endpoint: string, skipAuth = false, extraHeaders?: HeadersInit): Promise<T> {
    return this.request<T>(endpoint, 'GET', undefined, skipAuth, extraHeaders);
  }

  post<T>(endpoint: string, data: any, skipAuth = false, extraHeaders?: HeadersInit): Promise<T> {
    return this.request<T>(endpoint, 'POST', data, skipAuth, extraHeaders);
  }

  put<T>(endpoint: string, data: any, skipAuth = false, extraHeaders?: HeadersInit): Promise<T> {
    return this.request<T>(endpoint, 'PUT', data, skipAuth, extraHeaders);
  }

  delete<T>(endpoint: string, skipAuth = false, extraHeaders?: HeadersInit): Promise<T> {
    return this.request<T>(endpoint, 'DELETE', undefined, skipAuth, extraHeaders);
  }
}

export const apiClient = new ApiClient(
  import.meta.env.VITE_BACKEND_API_URL || 'http://localhost:3001'
);
export { AuthError };
