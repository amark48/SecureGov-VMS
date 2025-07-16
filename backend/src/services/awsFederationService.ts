import { STSClient, AssumeRoleWithWebIdentityCommand, Credentials } from '@aws-sdk/client-sts';
import { AwsCredentials } from '../types/auth';
import { createError } from '../middleware/errorHandler';
import { IdentityProviderService } from './identityProviderService';

// Logger setup
const awsFederationLogger = (message: string, data?: any) => {
  console.log(`[AwsFederation] ${message}`, data ? data : '');
};

export class AwsFederationService {
  private stsClient: STSClient;

  constructor(region?: string) {
    this.stsClient = new STSClient({
      region: region || process.env.AWS_REGION || 'us-east-1'
    });
  }

  /**
   * Get tenant-specific AWS configuration
   */
  private async getTenantAwsConfig(tenantId: string): Promise<{
    enabled: boolean;
    region: string;
    federatedRoleArnPrefix: string;
  }> {
    const awsConfig = await IdentityProviderService.getAwsFederationConfig(tenantId);
    
    if (!awsConfig) {
      throw createError('AWS federation is disabled for this tenant', 400, 'AWS_FEDERATION_DISABLED');
    }

    if (!awsConfig.region || !awsConfig.federated_role_arn_prefix) {
      throw createError('AWS federation not properly configured for this tenant', 500, 'AWS_FEDERATION_NOT_CONFIGURED');
    }

    return {
      enabled: true,
      region: awsConfig.region,
      federatedRoleArnPrefix: awsConfig.federated_role_arn_prefix
    };
  }

  /**
   * Map Azure AD roles to AWS IAM role names
   */
  private mapAzureAdRoleToAwsRole(azureAdRoles: string[]): string {
    awsFederationLogger('Mapping Azure AD roles to AWS roles', { azureAdRoles });
    
    // Define role mapping - customize based on your AWS IAM setup
    const roleMapping: Record<string, string> = {
      'VMS.SuperAdmin': 'VMS-SuperAdmin-Role',
      'VMS.Admin': 'VMS-Admin-Role',
      'VMS.Security': 'VMS-Security-Role',
      'VMS.Reception': 'VMS-Reception-Role',
      'VMS.Host': 'VMS-Host-Role',
      'VMS.Approver': 'VMS-Approver-Role'
    };

    // Find the first matching role
    for (const azureRole of azureAdRoles) {
      const awsRole = roleMapping[azureRole];
      if (awsRole) {
        awsFederationLogger('Mapped Azure AD role to AWS role', { azureRole, awsRole });
        return awsRole;
      }
    }

    // Default to a basic role if no specific mapping found
    awsFederationLogger('No specific role mapping found, using default AWS role');
    return 'VMS-Default-Role';
  }

  /**
   * Assume AWS IAM role using Azure AD token
   */
  async assumeRoleWithAzureAdToken(
    azureAdToken: string,
    azureAdRoles: string[],
    sessionName?: string,
    tenantId?: string
  ): Promise<AwsCredentials> {
    try {
      // Get tenant-specific configuration if tenantId is provided
      let config;
      if (tenantId) {
        config = await this.getTenantAwsConfig(tenantId);
        
        // Update STS client region if different from current
        if (config.region !== (this.stsClient.config.region as string)) {
          this.stsClient = new STSClient({ region: config.region });
        }
      } else {
        // Fall back to environment variables for backward compatibility
        if (!process.env.AWS_FEDERATION_ENABLED || process.env.AWS_FEDERATION_ENABLED !== 'true') {
          awsFederationLogger('AWS federation is disabled');
          throw createError('AWS federation is not enabled', 400, 'AWS_FEDERATION_DISABLED');
        }

        if (!process.env.AWS_FEDERATED_ROLE_ARN_PREFIX) {
          awsFederationLogger('AWS federated role ARN prefix not configured');
          throw createError('AWS federation not properly configured', 500, 'AWS_FEDERATION_NOT_CONFIGURED');
        }
        
        config = {
          enabled: true,
          region: process.env.AWS_REGION || 'us-east-1',
          federatedRoleArnPrefix: process.env.AWS_FEDERATED_ROLE_ARN_PREFIX
        };
      }

      const awsRoleName = this.mapAzureAdRoleToAwsRole(azureAdRoles);
      const roleArn = `${config.federatedRoleArnPrefix}${awsRoleName}`;
      const roleSessionName = sessionName || `azure-ad-session-${Date.now()}`;

      awsFederationLogger('Assuming AWS role with Azure AD token', { 
        roleArn, 
        roleSessionName,
        region: config.region
      });

      const command = new AssumeRoleWithWebIdentityCommand({
        RoleArn: roleArn,
        RoleSessionName: roleSessionName,
        WebIdentityToken: azureAdToken,
        DurationSeconds: 3600 // 1 hour
      });

      const response = await this.stsClient.send(command);

      if (!response.Credentials) {
        awsFederationLogger('No credentials returned from STS');
        throw createError('Failed to assume AWS role', 500, 'AWS_ROLE_ASSUMPTION_FAILED');
      }

      const credentials: AwsCredentials = {
        accessKeyId: response.Credentials.AccessKeyId!,
        secretAccessKey: response.Credentials.SecretAccessKey!,
        sessionToken: response.Credentials.SessionToken!,
        expiration: response.Credentials.Expiration!
      };

      awsFederationLogger('Successfully assumed AWS role', { 
        roleArn,
        expiration: credentials.expiration 
      });

      return credentials;
    } catch (error: any) {
      awsFederationLogger('Error assuming AWS role', { error: error.message });
      
      if (error.name === 'InvalidIdentityToken') {
        throw createError('Invalid Azure AD token for AWS federation', 401, 'INVALID_IDENTITY_TOKEN');
      }
      
      if (error.name === 'AccessDenied') {
        throw createError('Access denied for AWS role assumption', 403, 'AWS_ACCESS_DENIED');
      }

      throw createError(
        `AWS role assumption failed: ${error.message}`, 
        500, 
        'AWS_ROLE_ASSUMPTION_ERROR'
      );
    }
  }

  /**
   * Assume a specific AWS role by name
   */
  async assumeSpecificRole(
    azureAdToken: string,
    roleName: string,
    sessionName?: string,
    tenantId?: string
  ): Promise<AwsCredentials> {
    try {
      // Get tenant-specific configuration if tenantId is provided
      let config;
      if (tenantId) {
        config = await this.getTenantAwsConfig(tenantId);
        
        // Update STS client region if different from current
        if (config.region !== (this.stsClient.config.region as string)) {
          this.stsClient = new STSClient({ region: config.region });
        }
      } else {
        // Fall back to environment variables for backward compatibility
        if (!process.env.AWS_FEDERATION_ENABLED || process.env.AWS_FEDERATION_ENABLED !== 'true') {
          throw createError('AWS federation is not enabled', 400, 'AWS_FEDERATION_DISABLED');
        }

        if (!process.env.AWS_FEDERATED_ROLE_ARN_PREFIX) {
          throw createError('AWS federation not properly configured', 500, 'AWS_FEDERATION_NOT_CONFIGURED');
        }
        
        config = {
          enabled: true,
          region: process.env.AWS_REGION || 'us-east-1',
          federatedRoleArnPrefix: process.env.AWS_FEDERATED_ROLE_ARN_PREFIX
        };
      }

      const roleArn = `${config.federatedRoleArnPrefix}${roleName}`;
      const roleSessionName = sessionName || `azure-ad-session-${Date.now()}`;

      awsFederationLogger('Assuming specific AWS role', { 
        roleArn, 
        roleSessionName,
        region: config.region
      });

      const command = new AssumeRoleWithWebIdentityCommand({
        RoleArn: roleArn,
        RoleSessionName: roleSessionName,
        WebIdentityToken: azureAdToken,
        DurationSeconds: 3600 // 1 hour
      });

      const response = await this.stsClient.send(command);

      if (!response.Credentials) {
        throw createError('Failed to assume AWS role', 500, 'AWS_ROLE_ASSUMPTION_FAILED');
      }

      const credentials: AwsCredentials = {
        accessKeyId: response.Credentials.AccessKeyId!,
        secretAccessKey: response.Credentials.SecretAccessKey!,
        sessionToken: response.Credentials.SessionToken!,
        expiration: response.Credentials.Expiration!
      };

      awsFederationLogger('Successfully assumed specific AWS role', { 
        roleArn,
        expiration: credentials.expiration 
      });

      return credentials;
    } catch (error: any) {
      awsFederationLogger('Error assuming specific AWS role', { error: error.message });
      throw error;
    }
  }

  /**
   * Check if AWS credentials are still valid
   */
  areCredentialsValid(credentials: AwsCredentials): boolean {
    const now = new Date();
    const isValid = credentials.expiration > now;
    
    awsFederationLogger('Checking credentials validity', { 
      expiration: credentials.expiration,
      isValid 
    });
    
    return isValid;
  }

  /**
   * Get AWS credentials for a user, refreshing if necessary
   */
  async getValidAwsCredentials(
    azureAdToken: string,
    azureAdRoles: string[],
    currentCredentials?: AwsCredentials,
    tenantId?: string
  ): Promise<AwsCredentials> {
    // Check if current credentials are still valid
    if (currentCredentials && this.areCredentialsValid(currentCredentials)) {
      awsFederationLogger('Using existing valid AWS credentials');
      return currentCredentials;
    }

    awsFederationLogger('Refreshing AWS credentials');
    return await this.assumeRoleWithAzureAdToken(azureAdToken, azureAdRoles, undefined, tenantId);
  }
}

export const awsFederationService = new AwsFederationService();