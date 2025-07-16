// src/routes/tenantDiscovery.ts
import express from 'express';
import { query as expressQuery, validationResult } from 'express-validator';
import { query } from '../config/database';
import { asyncHandler, createError } from '../middleware/errorHandler';
import { IdentityProviderService } from '../services/identityProviderService';

const router = express.Router();

// Helper to extract domain from an email address
const extractDomainFromEmail = (email: string): string => {
  const parts = email.split('@');
  return parts.length === 2 ? parts[1].toLowerCase() : '';
};

router.get(
  '/config',
  [
    expressQuery('identifier')
      .isString().withMessage('Identifier must be a string')
      .bail()
      .notEmpty().withMessage('Identifier is required')
      .bail()
      .custom((val: string) => {
        const emailRx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const uuidRx = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (emailRx.test(val) || uuidRx.test(val)) {
          return true;
        }
        throw new Error('Identifier must be a valid email or UUID');
      })
  ],
  asyncHandler(async (req: express.Request, res: express.Response) => {
    // 1. Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw createError('Validation failed', 400, 'VALIDATION_ERROR', errors.array());
    }

    const identifier = String(req.query.identifier).trim();
    const emailDomain = extractDomainFromEmail(identifier);

    let tenant: any = null;

    // 2. Try lookup by corporate_email_domain
    if (emailDomain) {
      const result = await query(
        `SELECT *
           FROM tenants
          WHERE corporate_email_domain = $1
            AND is_active = true`,
        [emailDomain]
      );
      if (result.rows.length > 0) {
        tenant = result.rows[0];
      }
    }

    // 3. Fallback: if identifier is a UUID, try lookup by id
    if (
      !tenant &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier)
    ) {
      const result = await query(
        `SELECT *
           FROM tenants
          WHERE id = $1
            AND is_active = true`,
        [identifier]
      );
      if (result.rows.length > 0) {
        tenant = result.rows[0];
      }
    }

    // 4. If still not found, default to traditional
    if (!tenant) {
      return res.json({
        auth_strategy: 'traditional',
        azure_ad_enabled: false,
        message:
          'Tenant not found for provided identifier, defaulting to traditional login.',
        identity_providers: []
      });
    }

    // 5. Fetch identity providers and determine strategy
    const identityProviders = await IdentityProviderService.getActiveByTenantId(
      tenant.id
    );
    const authStrategy = IdentityProviderService.determineAuthStrategy(
      identityProviders
    );

    // 6. Check for different provider types
    const azureAdProvider = identityProviders.find(
      (p) => p.provider_type === 'azure_ad'
    );
    const oktaProvider = identityProviders.find(
      (p) => p.provider_type === 'okta'
    );
    const auth0Provider = identityProviders.find(
      (p) => p.provider_type === 'auth0'
    );

    // 7. Build response with all available providers
    const response: any = {
      auth_strategy: authStrategy,
      azure_ad_enabled: !!azureAdProvider,
      okta_enabled: !!oktaProvider,
      auth0_enabled: !!auth0Provider,
      identity_providers: identityProviders
    };

    // Add Azure AD specific config if available
    if (azureAdProvider) {
      const cfg = azureAdProvider.config;
      response.azure_ad_tenant_id = cfg.tenant_id;
      response.azure_ad_client_id = cfg.client_id;
      response.azure_ad_jwks_uri = cfg.jwks_uri;
      response.azure_ad_issuer = cfg.issuer;
      response.azure_ad_audience = cfg.audience;
    }

    // Add Okta specific config if available
    if (oktaProvider) {
      const cfg = oktaProvider.config;
      response.okta_domain = cfg.domain;
      response.okta_client_id = cfg.client_id;
      response.okta_issuer = cfg.issuer;
      response.okta_jwks_uri = cfg.jwks_uri;
    }

    // Add Auth0 specific config if available
    if (auth0Provider) {
      const cfg = auth0Provider.config;
      response.auth0_domain = cfg.domain;
      response.auth0_client_id = cfg.client_id;
      response.auth0_audience = cfg.audience;
      response.auth0_jwks_uri = cfg.jwks_uri;
    }

    return res.json(response);
  })
);

export default router;
