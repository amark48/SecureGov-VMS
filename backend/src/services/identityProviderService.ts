import { query, transaction } from '../config/database';
import { IdentityProvider, CreateIdentityProviderRequest, UpdateIdentityProviderRequest, AzureAdProviderConfig, AwsFederationProviderConfig, OktaProviderConfig, Auth0ProviderConfig } from '../types/identityProvider';
import { createError } from '../middleware/errorHandler';

export class IdentityProviderService {
  /**
   * Get all identity providers for a tenant
   */
  static async getByTenantId(tenantId: string): Promise<IdentityProvider[]> {
    const result = await query(`
      SELECT * FROM identity_providers
      WHERE tenant_id = $1
      ORDER BY provider_type, created_at DESC
    `, [tenantId]);

    return result.rows;
  }

  /**
   * Get a specific identity provider by ID
   */
  static async getById(providerId: string): Promise<IdentityProvider | null> {
    const result = await query(`
      SELECT * FROM identity_providers WHERE id = $1
    `, [providerId]);
    return result.rows.length > 0 ? result.rows[0] : null;
  }

  /**
   * Get active identity providers for a tenant
   */
  static async getActiveByTenantId(tenantId: string): Promise<IdentityProvider[]> {
    const result = await query(`
      SELECT * FROM identity_providers
      WHERE tenant_id = $1 AND is_active = true
      ORDER BY provider_type, created_at DESC
    `, [tenantId]);

    return result.rows;
  }

  /**
   * Get a specific identity provider by type for a tenant
   */
  static async getByTenantAndType(tenantId: string, providerType: string): Promise<IdentityProvider | null> {
    const result = await query(`
      SELECT * FROM identity_providers
      WHERE tenant_id = $1 AND provider_type = $2 AND is_active = true
      ORDER BY created_at DESC
      LIMIT 1
    `, [tenantId, providerType]);

    return result.rows.length > 0 ? result.rows[0] : null;
  }

  /**
   * Get Azure AD configuration for a tenant
   */
  static async getAzureAdConfig(tenantId: string): Promise<AzureAdProviderConfig | null> {
    const provider = await this.getByTenantAndType(tenantId, 'azure_ad');
    return provider ? provider.config as AzureAdProviderConfig : null;
  }

  /**
   * Get AWS Federation configuration for a tenant
   */
  static async getAwsFederationConfig(tenantId: string): Promise<AwsFederationProviderConfig | null> {
    const provider = await this.getByTenantAndType(tenantId, 'aws_federation');
    return provider ? provider.config as AwsFederationProviderConfig : null;
  }

  /**
   * Get Okta configuration for a tenant
   */
  static async getOktaConfig(tenantId: string): Promise<OktaProviderConfig | null> {
    const provider = await this.getByTenantAndType(tenantId, 'okta');
    return provider ? provider.config as OktaProviderConfig : null;
  }

  /**
   * Get Auth0 configuration for a tenant
   */
  static async getAuth0Config(tenantId: string): Promise<Auth0ProviderConfig | null> {
    const provider = await this.getByTenantAndType(tenantId, 'auth0');
    return provider ? provider.config as Auth0ProviderConfig : null;
  }

  /**
   * Find tenant by Azure AD tenant ID
   */
  static async findTenantByAzureAdTenantId(azureTenantId: string): Promise<{ tenant_id: string; config: AzureAdProviderConfig } | null> {
    const result = await query(`
      SELECT tenant_id, config FROM identity_providers
      WHERE provider_type = 'azure_ad' 
      AND is_active = true
      AND config->>'tenant_id' = $1
    `, [azureTenantId]);

    return result.rows.length > 0 ? {
      tenant_id: result.rows[0].tenant_id,
      config: result.rows[0].config as AzureAdProviderConfig
    } : null;
  }

  /**
   * Find tenant by Okta domain
   */
  static async findTenantByOktaDomain(oktaDomain: string): Promise<{ tenant_id: string; config: OktaProviderConfig } | null> {
    const result = await query(`
      SELECT tenant_id, config FROM identity_providers
      WHERE provider_type = 'okta' 
      AND is_active = true
      AND config->>'domain' = $1
    `, [oktaDomain]);

    return result.rows.length > 0 ? {
      tenant_id: result.rows[0].tenant_id,
      config: result.rows[0].config as OktaProviderConfig
    } : null;
  }

  /**
   * Find tenant by Auth0 domain
   */
  static async findTenantByAuth0Domain(auth0Domain: string): Promise<{ tenant_id: string; config: Auth0ProviderConfig } | null> {
    const result = await query(`
      SELECT tenant_id, config FROM identity_providers
      WHERE provider_type = 'auth0' 
      AND is_active = true
      AND config->>'domain' = $1
    `, [auth0Domain]);

    return result.rows.length > 0 ? {
      tenant_id: result.rows[0].tenant_id,
      config: result.rows[0].config as Auth0ProviderConfig
    } : null;
  }

  /**
   * Create a new identity provider
   */
  static async create(tenantId: string, providerData: CreateIdentityProviderRequest): Promise<IdentityProvider> {
    return await transaction(async (client) => {
      // Check if provider type already exists for this tenant
      const existingProvider = await client.query(`
        SELECT id FROM identity_providers
        WHERE tenant_id = $1 AND provider_type = $2
      `, [tenantId, providerData.provider_type]);

      if (existingProvider.rows.length > 0) {
        throw createError(`Identity provider of type '${providerData.provider_type}' already exists for this tenant`, 409, 'PROVIDER_EXISTS');
      }

      // Validate configuration based on provider type
      this.validateProviderConfig(providerData.provider_type, providerData.config);

      const result = await client.query(`
        INSERT INTO identity_providers (tenant_id, provider_type, config, is_active)
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `, [
        tenantId,
        providerData.provider_type,
        JSON.stringify(providerData.config),
        providerData.is_active !== undefined ? providerData.is_active : true
      ]);

      return result.rows[0];
    });
  }

  /**
   * Update an identity provider
   */
  static async update(tenantId: string, providerId: string, updates: Partial<UpdateIdentityProviderRequest>): Promise<IdentityProvider> {
    return await transaction(async (client) => {
      // Check if provider exists and belongs to tenant
      const existingProvider = await client.query(`
        SELECT * FROM identity_providers
        WHERE id = $1 AND tenant_id = $2
      `, [providerId, tenantId]);

      if (existingProvider.rows.length === 0) {
        throw createError('Identity provider not found', 404, 'PROVIDER_NOT_FOUND');
      }

      const provider = existingProvider.rows[0];

      // Build update query
      const updateFields = Object.keys(updates).filter(key => updates[key as keyof UpdateIdentityProviderRequest] !== undefined);
      if (updateFields.length === 0) {
        throw createError('No updates provided', 400, 'NO_UPDATES');
      }

      // Validate configuration if being updated
      if (updates.config) {
        const providerType = updates.provider_type || provider.provider_type;
        this.validateProviderConfig(providerType, updates.config);
      }

      const setClause = updateFields.map((field, index) => {
        if (field === 'config') {
          return `${field} = $${index + 3}::jsonb`;
        }
        return `${field} = $${index + 3}`;
      }).join(', ');

      const values = [
        providerId,
        tenantId,
        ...updateFields.map(field => {
          const value = updates[field as keyof UpdateIdentityProviderRequest];
          return field === 'config' ? JSON.stringify(value) : value;
        })
      ];

      const result = await client.query(`
        UPDATE identity_providers
        SET ${setClause}, updated_at = NOW()
        WHERE id = $1 AND tenant_id = $2
        RETURNING *
      `, values);

      return result.rows[0];
    });
  }

  /**
   * Delete an identity provider
   */
  static async delete(tenantId: string, providerId: string): Promise<void> {
    const result = await query(`
      DELETE FROM identity_providers
      WHERE id = $1 AND tenant_id = $2
      RETURNING id
    `, [providerId, tenantId]);

    if (result.rows.length === 0) {
      throw createError('Identity provider not found', 404, 'PROVIDER_NOT_FOUND');
    }
  }

  /**
   * Deactivate an identity provider (soft delete)
   */
  static async deactivate(tenantId: string, providerId: string): Promise<IdentityProvider> {
    const result = await query(`
      UPDATE identity_providers
      SET is_active = false, updated_at = NOW()
      WHERE id = $1 AND tenant_id = $2
      RETURNING *
    `, [providerId, tenantId]);

    if (result.rows.length === 0) {
      throw createError('Identity provider not found', 404, 'PROVIDER_NOT_FOUND');
    }

    return result.rows[0];
  }

  /**
   * Validate provider configuration based on type
   */
  private static validateProviderConfig(providerType: string, config: any): void {
    switch (providerType) {
      case 'azure_ad':
        const requiredAzureFields = ['tenant_id', 'client_id', 'jwks_uri', 'issuer', 'audience'];
        for (const field of requiredAzureFields) {
          if (!config[field]) {
            throw createError(`Missing required Azure AD configuration field: ${field}`, 400, 'INVALID_CONFIG');
          }
        }
        break;

      case 'aws_federation':
        const requiredAwsFields = ['region', 'federated_role_arn_prefix'];
        for (const field of requiredAwsFields) {
          if (!config[field]) {
            throw createError(`Missing required AWS Federation configuration field: ${field}`, 400, 'INVALID_CONFIG');
          }
        }
        break;

      case 'okta':
        const requiredOktaFields = ['domain', 'clientId', 'issuer'];
        for (const field of requiredOktaFields) {
          if (!config[field]) {
            throw createError(`Missing required Okta configuration field: ${field}`, 400, 'INVALID_CONFIG');
          }
        }
        // Validate Okta domain format
        if (!config.domain.includes('.okta.com') && !config.domain.includes('.oktapreview.com')) {
          throw createError('Invalid Okta domain format', 400, 'INVALID_CONFIG');
        }
        // Auto-generate jwks_uri if not provided
        if (!config.jwks_uri) {
          config.jwks_uri = `https://${config.domain}/oauth2/default/v1/keys`;
        }
        break;

      case 'auth0':
        const requiredAuth0Fields = ['domain', 'clientId'];
        for (const field of requiredAuth0Fields) {
          if (!config[field]) {
            throw createError(`Missing required Auth0 configuration field: ${field}`, 400, 'INVALID_CONFIG');
          }
        }
        // Validate Auth0 domain format
        if (!config.domain.includes('.auth0.com') && !config.domain.includes('.us.auth0.com') && !config.domain.includes('.eu.auth0.com')) {
          throw createError('Invalid Auth0 domain format', 400, 'INVALID_CONFIG');
        }
        // Auto-generate jwks_uri if not provided
        if (!config.jwks_uri) {
          config.jwks_uri = `https://${config.domain}/.well-known/jwks.json`;
        }
        // Auto-generate audience if not provided
        if (!config.audience) {
          config.audience = `https://${config.domain}/api/v2/`;
        }
        break;

      case 'traditional':
        // Traditional auth doesn't require specific config
        break;

      default:
        throw createError(`Unsupported provider type: ${providerType}`, 400, 'UNSUPPORTED_PROVIDER');
    }
  }

  /**
   * Determine auth strategy based on active providers
   */
  static determineAuthStrategy(providers: IdentityProvider[]): 'traditional' | 'hybrid' | 'external_only' {
    const activeProviders = providers.filter(p => p.is_active);
    const hasTraditional = activeProviders.some(p => p.provider_type === 'traditional');
    const hasExternal = activeProviders.some(p => p.provider_type !== 'traditional');

    if (hasTraditional && hasExternal) {
      return 'hybrid';
    } else if (hasExternal) {
      return 'external_only';
    } else {
      return 'traditional';
    }
  }
}