// src/services/auth.ts

import { apiClient } from './api';
import type {
  User,
  LoginCredentials,
  RegisterData,
  TenantAuthSettings,
  Permission
} from '../types/auth';

export class AuthError extends Error {
  code?: string;
  constructor(message: string, code?: string) {
    super(message);
    this.name = 'AuthError';
    this.code = code;
  }
}

export const authService = {
  // ————— Session / profile —————

  /**
   * Fetch the current authenticated user, including permissions.
   * Unwraps the `{ user }` envelope returned by the backend.
   */
  async getCurrentUser(): Promise<User> {
    const response = await apiClient.get<{ user: User }>('/api/auth/profile', false);
    return response.user;
  },

  async signIn(
    credentials: LoginCredentials
  ): Promise<User & { mfa_required?: boolean; token?: string } | void> {
    // Handle external identity provider token
    if (credentials.id_token && credentials.auth_provider_type) {
      return apiClient.post<User & { token?: string }>(
        '/api/auth/external/login',
        {
          id_token: credentials.id_token,
          auth_provider_type: credentials.auth_provider_type
        },
        true
      );
    }
    
    // Continue with traditional login flow
    return apiClient.post<User & { mfa_required?: boolean; token?: string }>(
      '/api/auth/login',
      credentials,
      true
    );
  },

  // New method for handling external authentication after getting the token
  async externalSignIn(id_token: string, auth_provider_type: 'auth0' | 'azure_ad' | 'okta'): Promise<User & { token?: string }> {
    return apiClient.post<User & { token?: string }>(
      '/api/auth/external/login',
      { id_token, auth_provider_type },
      true
    );
  },

  async signUp(userData: RegisterData): Promise<User & { token?: string }> {
    return apiClient.post<User & { token?: string }>(
      '/api/auth/register',
      userData,
      true
    );
  },

  async signOut(): Promise<void> {
    await apiClient.post<void>('/api/auth/logout', undefined);
  },

  async updateProfile(userId: string, updates: Partial<User>): Promise<User> {
    return apiClient.put<User>(`/api/auth/profile`, updates);
  },

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    // Changed payload keys to snake_case as per backend expectation
    return apiClient.put<void>(
      '/api/auth/change-password',
      { current_password: currentPassword, new_password: newPassword }
    );
  },

  // ————— MFA —————

  async initiateMFA(userId: string): Promise<{ qrCodeUrl: string; secret: string }> {
    return apiClient.post<{ qrCodeUrl: string; secret: string }>(
      `/api/auth/mfa/initiate`,
      undefined
    );
  },

  async verifyMFA(secret: string, code: string): Promise<User> {
    return apiClient.post<User>('/api/auth/mfa/verify', { secret, code });
  },

  async enableMFA(userId: string): Promise<void> {
    return apiClient.post<void>('/api/auth/mfa/enable', undefined);
  },

  async disableMFA(userId: string): Promise<void> {
    return apiClient.post<void>('/api/auth/mfa/disable', undefined);
  },

  // ————— Tenant discovery / settings —————

  async discoverTenantAuthSettings(identifier: string): Promise<TenantAuthSettings> {
    return apiClient.get<TenantAuthSettings>(
      `/api/tenant-discovery/config?identifier=${encodeURIComponent(identifier)}`,
      true
    );
  },

  async getTenantAuthSettings(tenantIdentifier: string): Promise<TenantAuthSettings> {
    // legacy alias
    return this.discoverTenantAuthSettings(tenantIdentifier);
  },

  // ————— Admin helpers —————

  async createUserByAdmin(userData: RegisterData & { password?: string }): Promise<User> {
    return apiClient.post<User>('/api/auth/admin/users', userData);
  },

  async updateUserByAdmin(userId: string, updates: Partial<User>): Promise<User> {
    return apiClient.put<User>(`/api/auth/admin/users/${userId}`, updates);
  },

  async getAllUsers(
    page = 1,
    limit = 20,
    filters?: Record<string, any>
  ): Promise<{ users: User[]; pagination: any }> {
    return apiClient.get<{ users: User[]; pagination: any }>(
      `/api/auth/users?page=${page}&limit=${limit}`,
      false
    );
  },

  async resetUserPassword(userId: string): Promise<{ password: string }> {
    return apiClient.post<{ password: string }>(`/api/auth/admin/users/${userId}/reset-password`, {});
  },

  // ————— Permissions —————

  async getAllPermissions(): Promise<Permission[]> {
    return apiClient.get<Permission[]>('/api/auth/permissions');
  }
};

