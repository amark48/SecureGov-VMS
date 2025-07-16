import { query, transaction } from '../config/database';
import { createError } from '../middleware/errorHandler';
import { Ccure9000Client, Ccure9000Config } from './ccure9000Client';

// Logger setup
const acsLogger = (message: string, data?: any) => {
  console.log(`[AcsIntegrationService] ${message}`, data ? data : '');
};

// Re-export the config interface for backward compatibility
export type { Ccure9000Config } from './ccure9000Client';

export interface AcsConfiguration {
  id: string;
  tenant_id: string;
  name: string;
  acs_type: 'lenel' | 's2_security' | 'custom' | 'ccure9000';
  api_endpoint: string;
  credentials: any;
  is_active: boolean;
}

export interface CivPivCardData {
  card_number?: string;
  masked_card_number?: string;
  edipi?: string;
  upn?: string;
  certificate_data?: any;
  card_type?: string;
}

export interface VisitorData {
  id: string;
  first_name: string;
  last_name: string;
  email?: string;
  company?: string;
  civ_piv_card_info?: CivPivCardData;
}

export interface AccessProvisioningResult {
  success: boolean;
  message: string;
  acs_reference_id?: string;
  error_code?: string;
}

export class AcsIntegrationService {
  /**
   * Get ACS configurations for a tenant
   */
  static async getAcsConfigurations(tenantId: string): Promise<AcsConfiguration[]> {
    acsLogger('Getting ACS configurations for tenant', { tenantId });
    
    const result = await query(`
      SELECT * FROM acs_configurations
      WHERE tenant_id = $1 AND is_active = true
      ORDER BY name
    `, [tenantId]);

    return result.rows;
  }

  /**
   * Get a specific ACS configuration
   */
  static async getAcsConfiguration(tenantId: string, acsId: string): Promise<AcsConfiguration | null> {
    acsLogger('Getting specific ACS configuration', { tenantId, acsId });
    
    const result = await query(`
      SELECT * FROM acs_configurations
      WHERE id = $1 AND tenant_id = $2 AND is_active = true
    `, [acsId, tenantId]);

    return result.rows.length > 0 ? result.rows[0] : null;
  }

  /**
   * Provision access for a visitor in the external ACS
   */
  static async provisionAccess(
    visitorData: VisitorData,
    acsConfig: AcsConfiguration,
    facilityId: string,
    accessLevel: string = 'visitor'
  ): Promise<AccessProvisioningResult> {
    acsLogger('Provisioning access for visitor', { 
      visitorId: visitorData.id, 
      acsType: acsConfig.acs_type,
      facilityId 
    });

    try {
      switch (acsConfig.acs_type) {
        case 'lenel':
          return await this.provisionLenelAccess(visitorData, acsConfig, facilityId, accessLevel);
        case 's2_security':
          return await this.provisionS2Access(visitorData, acsConfig, facilityId, accessLevel);
        case 'custom':
          return await this.provisionCustomAccess(visitorData, acsConfig, facilityId, accessLevel);
        case 'ccure9000':
          return await this.provisionCcure9000Access(visitorData, acsConfig, facilityId, accessLevel);
        default:
          throw new Error(`Unsupported ACS type: ${acsConfig.acs_type}`);
      }
    } catch (error: any) {
      acsLogger('Error provisioning access', { error: error.message });
      return {
        success: false,
        message: `Failed to provision access: ${error.message}`,
        error_code: 'PROVISIONING_ERROR'
      };
    }
  }

  /**
   * Revoke access for a visitor in the external ACS
   */
  static async revokeAccess(
    visitorData: VisitorData,
    acsConfig: AcsConfiguration,
    acsReferenceId?: string
  ): Promise<AccessProvisioningResult> {
    acsLogger('Revoking access for visitor', { 
      visitorId: visitorData.id, 
      acsType: acsConfig.acs_type,
      acsReferenceId 
    });

    try {
      switch (acsConfig.acs_type) {
        case 'lenel':
          return await this.revokeLenelAccess(visitorData, acsConfig, acsReferenceId);
        case 's2_security':
          return await this.revokeS2Access(visitorData, acsConfig, acsReferenceId);
        case 'custom':
          return await this.revokeCustomAccess(visitorData, acsConfig, acsReferenceId);
        case 'ccure9000':
          return await this.revokeCcure9000Access(visitorData, acsConfig, acsReferenceId);
        default:
          throw new Error(`Unsupported ACS type: ${acsConfig.acs_type}`);
      }
    } catch (error: any) {
      acsLogger('Error revoking access', { error: error.message });
      return {
        success: false,
        message: `Failed to revoke access: ${error.message}`,
        error_code: 'REVOCATION_ERROR'
      };
    }
  }

  /**
   * Lenel OnGuard integration
   */
  private static async provisionLenelAccess(
    visitorData: VisitorData,
    acsConfig: AcsConfiguration,
    facilityId: string,
    accessLevel: string
  ): Promise<AccessProvisioningResult> {
    acsLogger('Provisioning Lenel OnGuard access');

    // This is a placeholder implementation
    // In a real implementation, you would:
    // 1. Use Lenel's SDK or API
    // 2. Create a cardholder record
    // 3. Assign appropriate access levels
    // 4. Return the Lenel person ID as reference

    if (process.env.NODE_ENV !== 'production') {
      // Simulate successful provisioning in development
      return {
        success: true,
        message: 'Access provisioned successfully in Lenel OnGuard',
        acs_reference_id: `LENEL_${Date.now()}`
      };
    }

    // TODO: Implement actual Lenel integration
    throw new Error('Lenel integration not yet implemented');
  }

  private static async revokeLenelAccess(
    visitorData: VisitorData,
    acsConfig: AcsConfiguration,
    acsReferenceId?: string
  ): Promise<AccessProvisioningResult> {
    acsLogger('Revoking Lenel OnGuard access');

    if (process.env.NODE_ENV !== 'production') {
      return {
        success: true,
        message: 'Access revoked successfully in Lenel OnGuard'
      };
    }

    // TODO: Implement actual Lenel revocation
    throw new Error('Lenel integration not yet implemented');
  }

  /**
   * S2 Security integration
   */
  private static async provisionS2Access(
    visitorData: VisitorData,
    acsConfig: AcsConfiguration,
    facilityId: string,
    accessLevel: string
  ): Promise<AccessProvisioningResult> {
    acsLogger('Provisioning S2 Security access');

    if (process.env.NODE_ENV !== 'production') {
      return {
        success: true,
        message: 'Access provisioned successfully in S2 Security',
        acs_reference_id: `S2_${Date.now()}`
      };
    }

    // TODO: Implement actual S2 Security integration
    throw new Error('S2 Security integration not yet implemented');
  }

  private static async revokeS2Access(
    visitorData: VisitorData,
    acsConfig: AcsConfiguration,
    acsReferenceId?: string
  ): Promise<AccessProvisioningResult> {
    acsLogger('Revoking S2 Security access');

    if (process.env.NODE_ENV !== 'production') {
      return {
        success: true,
        message: 'Access revoked successfully in S2 Security'
      };
    }

    // TODO: Implement actual S2 Security revocation
    throw new Error('S2 Security integration not yet implemented');
  }

  /**
   * Custom ACS integration
   */
  private static async provisionCustomAccess(
    visitorData: VisitorData,
    acsConfig: AcsConfiguration,
    facilityId: string,
    accessLevel: string
  ): Promise<AccessProvisioningResult> {
    acsLogger('Provisioning custom ACS access');

    try {
      // Generic REST API integration for custom ACS systems
      const response = await fetch(`${acsConfig.api_endpoint}/provision`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${acsConfig.credentials.api_key || acsConfig.credentials.token}`,
          ...acsConfig.credentials.headers || {}
        },
        body: JSON.stringify({
          visitor: {
            id: visitorData.id,
            first_name: visitorData.first_name,
            last_name: visitorData.last_name,
            email: visitorData.email,
            company: visitorData.company,
            civ_piv_card: visitorData.civ_piv_card_info
          },
          facility_id: facilityId,
          access_level: accessLevel,
          valid_from: new Date().toISOString(),
          valid_until: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours
        })
      });

      if (!response.ok) {
        throw new Error(`ACS API returned ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      
      return {
        success: true,
        message: 'Access provisioned successfully in custom ACS',
        acs_reference_id: (result as any).reference_id || (result as any).id
      };
    } catch (error: any) {
      acsLogger('Custom ACS provisioning failed', { error: error.message });
      throw error;
    }
  }

  private static async revokeCustomAccess(
    visitorData: VisitorData,
    acsConfig: AcsConfiguration,
    acsReferenceId?: string
  ): Promise<AccessProvisioningResult> {
    acsLogger('Revoking custom ACS access');

    try {
      const response = await fetch(`${acsConfig.api_endpoint}/revoke`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${acsConfig.credentials.api_key || acsConfig.credentials.token}`,
          ...acsConfig.credentials.headers || {}
        },
        body: JSON.stringify({
          visitor_id: visitorData.id,
          reference_id: acsReferenceId
        })
      });

      if (!response.ok) {
        throw new Error(`ACS API returned ${response.status}: ${response.statusText}`);
      }

      return {
        success: true,
        message: 'Access revoked successfully in custom ACS'
      };
    } catch (error: any) {
      acsLogger('Custom ACS revocation failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Ccure 9000 integration
   */
  private static async provisionCcure9000Access(
    visitorData: VisitorData,
    acsConfig: AcsConfiguration,
    facilityId: string,
    accessLevel: string
  ): Promise<AccessProvisioningResult> {
    acsLogger('Provisioning Ccure 9000 access');

    try {
      const client = new Ccure9000Client(acsConfig.credentials as Ccure9000Config);
      
      // Prepare personnel data for Ccure 9000
      const personnelData = {
        firstName: visitorData.first_name,
        lastName: visitorData.last_name,
        email: visitorData.email,
        company: visitorData.company,
        accessLevel: accessLevel,
        civPivInfo: visitorData.civ_piv_card_info
      };

      acsLogger('Ccure 9000 personnel data prepared', { 
        visitorId: visitorData.id,
        hasCardInfo: !!visitorData.civ_piv_card_info
      });

      // Create personnel in Ccure 9000
      const createResult = await client.createPersonnel(personnelData);
      
      if (!createResult.success) {
        throw new Error(createResult.message);
      }

      // Assign access level
      const accessResult = await client.assignAccessLevel(
        createResult.personnelId!,
        accessLevel,
        facilityId
      );

      if (!accessResult.success) {
        acsLogger('Access level assignment failed, but personnel created', {
          personnelId: createResult.personnelId,
          error: accessResult.message
        });
      }

      // Enroll CIV/PIV card if available
      if (visitorData.civ_piv_card_info) {
        const cardResult = await client.enrollCivPivCard(
          createResult.personnelId!,
          visitorData.civ_piv_card_info
        );

        if (!cardResult.success) {
          acsLogger('CIV/PIV card enrollment failed', {
            personnelId: createResult.personnelId,
            error: cardResult.message
          });
        }
      }

      return {
        success: true,
        message: 'Access provisioned successfully in Ccure 9000',
        acs_reference_id: createResult.personnelId
      };
    } catch (error: any) {
      acsLogger('Ccure 9000 provisioning failed', { error: error.message });
      throw error;
    }
  }

  private static async revokeCcure9000Access(
    visitorData: VisitorData,
    acsConfig: AcsConfiguration,
    acsReferenceId?: string
  ): Promise<AccessProvisioningResult> {
    acsLogger('Revoking Ccure 9000 access');

    try {
      const client = new Ccure9000Client(acsConfig.credentials as Ccure9000Config);
      
      if (!acsReferenceId) {
        throw new Error('ACS reference ID is required for revocation');
      }

      const result = await client.deactivatePersonnel(acsReferenceId);
      
      return {
        success: result.success,
        message: result.message
      };
    } catch (error: any) {
      acsLogger('Ccure 9000 revocation failed', { error: error.message });
      throw error;
    }
  }

  private static async testCcure9000Connection(acsConfig: AcsConfiguration): Promise<{ success: boolean; message: string }> {
    acsLogger('Testing Ccure 9000 connection');

    try {
      const client = new Ccure9000Client(acsConfig.credentials as Ccure9000Config);
      return await client.testConnection();
    } catch (error: any) {
      acsLogger('Ccure 9000 connection test failed', { error: error.message });
      return { 
        success: false, 
        message: `Connection failed: ${error.message}` 
      };
    }
  }

  /**
   * Test ACS connection
   */
  public static async testConnection(acsConfig: AcsConfiguration): Promise<{ success: boolean; message: string }> {
    // Force re-compilation - TypeScript cache fix
    acsLogger('Testing ACS connection', { acsType: acsConfig.acs_type });

    try {
      switch (acsConfig.acs_type) {
        case 'custom':
          const response = await fetch(`${acsConfig.api_endpoint}/health`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${acsConfig.credentials.api_key || acsConfig.credentials.token}`,
              ...acsConfig.credentials.headers || {}
            }
          });
          
          if (response.ok) {
            return { success: true, message: 'Connection successful' };
          } else {
            return { success: false, message: `Connection failed: ${response.statusText}` };
          }
        
        case 'lenel':
        case 's2_security':
          // For development, simulate successful connection
          if (process.env.NODE_ENV !== 'production') {
            return { success: true, message: 'Connection successful (simulated)' };
          }
          return { success: false, message: 'Integration not yet implemented' };
        
        case 'ccure9000':
          return await this.testCcure9000Connection(acsConfig);
        
        default:
          return { success: false, message: 'Unsupported ACS type' };
      }
    } catch (error: any) {
      acsLogger('Connection test failed', { error: error.message });
      return { success: false, message: `Connection failed: ${error.message}` };
    }
  }
}

// Dummy export to force TypeScript recompilation
export {};