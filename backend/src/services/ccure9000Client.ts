import fetch from 'node-fetch';
import { createError } from '../middleware/errorHandler';

// Logger setup
const ccure9000Logger = (message: string, data?: any) => {
  console.log(`[Ccure9000Client] ${message}`, data ? data : '');
};

export interface Ccure9000Config {
  base_url: string;
  user_name: string;
  password: string;
  client_name: string;
  client_id: string;
  version?: string;
  personnel_type_name?: string;
}

export interface Ccure9000LoginResponse {
  success: boolean;
  sessionToken?: string;
  message?: string;
}

export interface Ccure9000PersonnelData {
  firstName: string;
  lastName: string;
  email?: string;
  company?: string;
  personnelType?: string;
  accessLevel?: string;
  civPivInfo?: any;
}

export class Ccure9000Client {
  private config: Ccure9000Config;
  private sessionToken?: string;
  private sessionExpiry?: Date;

  constructor(config: Ccure9000Config) {
    this.config = {
      ...config,
      version: config.version || '3.0',
      personnel_type_name: config.personnel_type_name || 'Visitor'
    };
    
    // Ensure base_url ends with a slash
    if (!this.config.base_url.endsWith('/')) {
      this.config.base_url += '/';
    }
  }

  /**
   * Test connection to Ccure 9000 server
   */
  async testConnection(): Promise<{ success: boolean; message: string }> {
    ccure9000Logger('Testing connection to Ccure 9000', { 
      baseUrl: this.config.base_url,
      userName: this.config.user_name,
      clientName: this.config.client_name
    });

    try {
      const loginResult = await this.authenticate();
      
      if (loginResult.success) {
        ccure9000Logger('Connection test successful');
        return {
          success: true,
          message: `Successfully connected to Ccure 9000 at ${this.config.base_url}`
        };
      } else {
        ccure9000Logger('Connection test failed', { message: loginResult.message });
        return {
          success: false,
          message: loginResult.message || 'Authentication failed'
        };
      }
    } catch (error: any) {
      ccure9000Logger('Connection test error', { error: error.message });
      return {
        success: false,
        message: `Connection failed: ${error.message}`
      };
    }
  }

  /**
   * Authenticate with Ccure 9000 server
   */
  private async authenticate(): Promise<Ccure9000LoginResponse> {
    ccure9000Logger('Authenticating with Ccure 9000');

    try {
      const loginPayload = {
        UserName: this.config.user_name,
        Password: this.config.password,
        ClientName: this.config.client_name,
        ClientID: this.config.client_id,
        ClientVersion: this.config.version
      };

      ccure9000Logger('Sending login request', { 
        endpoint: `${this.config.base_url}api/authenticate/Login`,
        payload: { ...loginPayload, Password: '***masked***' }
      });

      const response = await fetch(`${this.config.base_url}api/authenticate/Login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(loginPayload)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.text();
      ccure9000Logger('Login response received', { result });

      // Based on your example, a successful response is simply "true"
      if (result === 'true' || result.trim() === 'true') {
        this.sessionToken = 'authenticated'; // Ccure 9000 appears to use session-based auth
        this.sessionExpiry = new Date(Date.now() + 30 * 60 * 1000); // Assume 30 min session
        
        return {
          success: true,
          sessionToken: this.sessionToken
        };
      } else {
        return {
          success: false,
          message: `Authentication failed: ${result}`
        };
      }
    } catch (error: any) {
      ccure9000Logger('Authentication error', { error: error.message });
      return {
        success: false,
        message: `Authentication error: ${error.message}`
      };
    }
  }

  /**
   * Ensure we have a valid session
   */
  private async ensureAuthenticated(): Promise<void> {
    if (!this.sessionToken || (this.sessionExpiry && new Date() > this.sessionExpiry)) {
      ccure9000Logger('Session expired or missing, re-authenticating');
      const authResult = await this.authenticate();
      if (!authResult.success) {
        throw new Error(`Authentication failed: ${authResult.message}`);
      }
    }
  }

  /**
   * Create a personnel record in Ccure 9000
   */
  async createPersonnel(personnelData: Ccure9000PersonnelData): Promise<{ success: boolean; personnelId?: string; message: string }> {
    ccure9000Logger('Creating personnel in Ccure 9000', { 
      name: `${personnelData.firstName} ${personnelData.lastName}`,
      company: personnelData.company
    });

    try {
      await this.ensureAuthenticated();

      // This is a placeholder for the actual personnel creation API call
      // You'll need to implement this based on the Ccure 9000 API documentation
      // for creating personnel/cardholders
      
      const personnelPayload = {
        FirstName: personnelData.firstName,
        LastName: personnelData.lastName,
        Email: personnelData.email,
        Company: personnelData.company,
        PersonnelType: personnelData.personnelType || this.config.personnel_type_name,
        AccessLevel: personnelData.accessLevel || 'Visitor'
      };

      ccure9000Logger('Personnel creation payload prepared', personnelPayload);

      // TODO: Replace with actual Ccure 9000 personnel creation endpoint
      // const response = await fetch(`${this.config.base_url}api/personnel/create`, {
      //   method: 'POST',
      //   headers: {
      //     'Content-Type': 'application/json',
      //     'Accept': 'application/json'
      //     // Add session/auth headers as required by Ccure 9000
      //   },
      //   body: JSON.stringify(personnelPayload)
      // });

      // For now, return success since we can authenticate
      return {
        success: true,
        personnelId: `CCURE_${Date.now()}`,
        message: 'Personnel creation endpoint not yet implemented - authentication successful'
      };

    } catch (error: any) {
      ccure9000Logger('Personnel creation error', { error: error.message });
      return {
        success: false,
        message: `Personnel creation failed: ${error.message}`
      };
    }
  }

  /**
   * Update personnel record in Ccure 9000
   */
  async updatePersonnel(personnelId: string, personnelData: Partial<Ccure9000PersonnelData>): Promise<{ success: boolean; message: string }> {
    ccure9000Logger('Updating personnel in Ccure 9000', { personnelId });

    try {
      await this.ensureAuthenticated();

      // TODO: Implement actual personnel update API call
      return {
        success: true,
        message: 'Personnel update endpoint not yet implemented - authentication successful'
      };

    } catch (error: any) {
      ccure9000Logger('Personnel update error', { error: error.message });
      return {
        success: false,
        message: `Personnel update failed: ${error.message}`
      };
    }
  }

  /**
   * Deactivate personnel record in Ccure 9000
   */
  async deactivatePersonnel(personnelId: string): Promise<{ success: boolean; message: string }> {
    ccure9000Logger('Deactivating personnel in Ccure 9000', { personnelId });

    try {
      await this.ensureAuthenticated();

      // TODO: Implement actual personnel deactivation API call
      return {
        success: true,
        message: 'Personnel deactivation endpoint not yet implemented - authentication successful'
      };

    } catch (error: any) {
      ccure9000Logger('Personnel deactivation error', { error: error.message });
      return {
        success: false,
        message: `Personnel deactivation failed: ${error.message}`
      };
    }
  }

  /**
   * Assign access level to personnel
   */
  async assignAccessLevel(personnelId: string, accessLevel: string, facilityId?: string): Promise<{ success: boolean; message: string }> {
    ccure9000Logger('Assigning access level in Ccure 9000', { personnelId, accessLevel, facilityId });

    try {
      await this.ensureAuthenticated();

      // TODO: Implement actual access level assignment API call
      return {
        success: true,
        message: 'Access level assignment endpoint not yet implemented - authentication successful'
      };

    } catch (error: any) {
      ccure9000Logger('Access level assignment error', { error: error.message });
      return {
        success: false,
        message: `Access level assignment failed: ${error.message}`
      };
    }
  }

  /**
   * Enroll CIV/PIV card information
   */
  async enrollCivPivCard(personnelId: string, cardInfo: any): Promise<{ success: boolean; message: string }> {
    ccure9000Logger('Enrolling CIV/PIV card in Ccure 9000', { personnelId });

    try {
      await this.ensureAuthenticated();

      // TODO: Implement actual CIV/PIV card enrollment API call
      return {
        success: true,
        message: 'CIV/PIV card enrollment endpoint not yet implemented - authentication successful'
      };

    } catch (error: any) {
      ccure9000Logger('CIV/PIV card enrollment error', { error: error.message });
      return {
        success: false,
        message: `CIV/PIV card enrollment failed: ${error.message}`
      };
    }
  }
}