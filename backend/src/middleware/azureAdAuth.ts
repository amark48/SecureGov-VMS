import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';
import { query } from '../config/database';
import { User, AzureAdTokenPayload } from '../types/auth';
import { createError } from './errorHandler';
import { IdentityProviderService } from '../services/identityProviderService';

// Logger setup
const azureAdAuthLogger = (message: string, data?: any) => {
  console.log(`[AzureAdAuth] ${message}`, data ? data : '');
};

export interface AzureAdAuthenticatedRequest extends Request {
  user?: User;
}

// Function to get signing key for a specific tenant
const getKeyForTenant = (jwksUri: string) => {
  const client = jwksClient({
    jwksUri,
    requestHeaders: {},
    timeout: 30000,
  });

  return (header: any, callback: any) => {
    client.getSigningKey(header.kid, (err, key) => {
      if (err) {
        azureAdAuthLogger('Error getting signing key', { error: err.message });
        return callback(err);
      }
      const signingKey = key?.getPublicKey();
      callback(null, signingKey);
    });
  };
};

// Azure AD role to internal role mapping
const mapAzureAdRoleToInternal = (azureAdRoles: string[]): string => {
  azureAdAuthLogger('Mapping Azure AD roles to internal roles', { azureAdRoles });
  
  // Define role mapping - customize based on your Azure AD setup
  const roleMapping: Record<string, string> = {
    'VMS.SuperAdmin': 'super_admin',
    'VMS.Admin': 'admin',
    'VMS.Security': 'security',
    'VMS.Reception': 'reception',
    'VMS.Host': 'host',
    'VMS.Approver': 'approver'
  };

  // Find the highest priority role
  const rolePriority = ['super_admin', 'admin', 'security', 'reception', 'approver', 'host'];
  
  for (const azureRole of azureAdRoles) {
    const internalRole = roleMapping[azureRole];
    if (internalRole) {
      azureAdAuthLogger('Mapped Azure AD role to internal role', { azureRole, internalRole });
      return internalRole;
    }
  }

  // Default to host if no specific role mapping found
  azureAdAuthLogger('No specific role mapping found, defaulting to host');
  return 'host';
};

// Get or create user from Azure AD token
const getOrCreateUserFromAzureAd = async (tokenPayload: AzureAdTokenPayload, tenantId: string): Promise<User> => {
  azureAdAuthLogger('Getting or creating user from Azure AD token', { 
    email: tokenPayload.email,
    oid: tokenPayload.oid,
    tenantId
  });

  const email = tokenPayload.email || tokenPayload.preferred_username || tokenPayload.upn;
  if (!email) {
    throw createError('Email not found in Azure AD token', 400, 'INVALID_TOKEN');
  }

  // Check if user exists by Azure AD Object ID or email
  let userResult = await query(
    'SELECT * FROM profiles WHERE (azure_ad_object_id = $1 OR email = $2) AND tenant_id = $3',
    [tokenPayload.oid, email, tenantId]
  );

  let user: any;

  if (userResult.rows.length === 0) {
    azureAdAuthLogger('User not found, creating new user from Azure AD token');
    
    const fullName = tokenPayload.name || email;
    const nameParts = fullName.split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';
    const internalRole = mapAzureAdRoleToInternal(tokenPayload.roles || []);

    // Create new user
    const createUserResult = await query(`
      INSERT INTO profiles (
        email, full_name, first_name, last_name, role, tenant_id, 
        is_active, auth_provider, azure_ad_object_id, azure_ad_roles
      ) VALUES ($1, $2, $3, $4, $5, $6, true, 'azure_ad', $7, $8)
      RETURNING *
    `, [
      email, fullName, firstName, lastName, internalRole, tenantId,
      tokenPayload.oid, JSON.stringify(tokenPayload.roles || [])
    ]);

    user = createUserResult.rows[0];
    azureAdAuthLogger('Created new user from Azure AD', { userId: user.id });
  } else {
    user = userResult.rows[0];
    azureAdAuthLogger('Found existing user', { userId: user.id });

    // Update Azure AD specific fields if they've changed
    const currentAzureRoles = JSON.stringify(tokenPayload.roles || []);
    if (user.azure_ad_object_id !== tokenPayload.oid || 
        JSON.stringify(user.azure_ad_roles) !== currentAzureRoles) {
      
      azureAdAuthLogger('Updating user Azure AD information');
      const internalRole = mapAzureAdRoleToInternal(tokenPayload.roles || []);
      
      await query(`
        UPDATE profiles 
        SET azure_ad_object_id = $1, azure_ad_roles = $2, role = $3, 
            auth_provider = 'azure_ad', last_login = NOW(), updated_at = NOW()
        WHERE id = $4
      `, [tokenPayload.oid, currentAzureRoles, internalRole, user.id]);

      // Refresh user data
      userResult = await query('SELECT * FROM profiles WHERE id = $1', [user.id]);
      user = userResult.rows[0];
    } else {
      // Just update last login
      await query(
        'UPDATE profiles SET last_login = NOW() WHERE id = $1',
        [user.id]
      );
    }
  }

  // Get tenant information
  const tenantResult = await query(
    'SELECT name, corporate_email_domain, tenant_prefix, next_employee_sequence FROM tenants WHERE id = $1',
    [user.tenant_id]
  );
  
  const tenant = tenantResult.rows[0] || {};

  // Get user permissions
  const permissionsResult = await query(
    'SELECT * FROM get_user_permissions($1)',
    [user.id]
  );

  // Construct User object
  const userObj: User = {
    id: user.id,
    email: user.email,
    tenant_id: user.tenant_id,
    tenant_name: tenant.name,
    corporate_email_domain: tenant.corporate_email_domain,
    tenant_prefix: tenant.tenant_prefix,
    next_employee_sequence: tenant.next_employee_sequence,
    role: user.role,
    role_id: user.role_id,
    full_name: user.full_name,
    first_name: user.first_name,
    last_name: user.last_name,
    department: user.department,
    phone: user.phone,
    employee_number: user.employee_number,
    security_clearance: user.security_clearance,
    is_active: user.is_active,
    mfa_enabled: user.mfa_enabled,
    created_at: user.created_at,
    updated_at: user.updated_at,
    auth_provider: 'azure_ad',
    azure_ad_object_id: user.azure_ad_object_id,
    azure_ad_roles: user.azure_ad_roles,
    permissions: permissionsResult.rows.map(row => ({
      resource: row.resource,
      action: row.action
    }))
  };

  azureAdAuthLogger('Successfully processed Azure AD user', { userId: userObj.id });
  return userObj;
};

export const authenticateAzureAdToken = async (
  req: AzureAdAuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Skip authentication for OPTIONS requests
    if (req.method === 'OPTIONS') {
      azureAdAuthLogger('Skipping authentication for OPTIONS request');
      next();
      return;
    }

    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      azureAdAuthLogger('No token provided');
      next(); // Let other auth middleware handle this
      return;
    }

    azureAdAuthLogger('Attempting to validate Azure AD token');

    // First decode the token without verification to get the tenant ID
    const unverifiedDecoded = jwt.decode(token) as AzureAdTokenPayload;
    if (!unverifiedDecoded || !unverifiedDecoded.tid) {
      azureAdAuthLogger('Invalid token format or missing tenant ID');
      next(); // Let other auth middleware handle this
      return;
    }

    const azureTenantId = unverifiedDecoded.tid;
    azureAdAuthLogger('Extracted Azure tenant ID from token', { azureTenantId });

    // Get tenant configuration for this Azure AD tenant using identity providers
    const tenantConfig = await IdentityProviderService.findTenantByAzureAdTenantId(azureTenantId);

    if (!tenantConfig) {
      azureAdAuthLogger('No tenant configuration found for Azure AD tenant', { azureTenantId });
      next(); // Let other auth middleware handle this
      return;
    }

    azureAdAuthLogger('Found tenant configuration for Azure AD', { 
      tenantId: tenantConfig.tenant_id,
      azureTenantId 
    });

    // Now verify and decode the token with tenant-specific configuration
    const getKey = getKeyForTenant(tenantConfig.config.jwks_uri);
    const decoded = await new Promise<AzureAdTokenPayload>((resolve, reject) => {
      jwt.verify(token, getKey, {
        audience: tenantConfig.config.audience,
        issuer: tenantConfig.config.issuer,
        algorithms: ['RS256']
      }, (err, decoded) => {
        if (err) {
          azureAdAuthLogger('Token verification failed', { error: err.message });
          reject(err);
        } else {
          resolve(decoded as AzureAdTokenPayload);
        }
      });
    });

    azureAdAuthLogger('Azure AD token verified successfully', { 
      oid: decoded.oid,
      email: decoded.email 
    });

    // Get or create user from token
    const user = await getOrCreateUserFromAzureAd(decoded, tenantConfig.tenant_id);

    if (!user.is_active) {
      azureAdAuthLogger('User account is deactivated', { userId: user.id });
      res.status(401).json({
        error: 'Account deactivated',
        code: 'ACCOUNT_DEACTIVATED'
      });
      return;
    }

    req.user = user;
    azureAdAuthLogger('Azure AD authentication successful', { userId: user.id });

    // Log the login event
    await query(`
      INSERT INTO audit_logs (
        user_id, tenant_id, action, table_name, new_values, compliance_flags
      ) VALUES ($1, $2, 'login', 'auth', $3, $4)
    `, [
      user.id,
      user.tenant_id,
      JSON.stringify({ 
        auth_provider: 'azure_ad',
        azure_tenant_id: azureTenantId,
        ip: req.ip, 
        user_agent: req.get('User-Agent') 
      }),
      ['SECURITY', 'FIPS_140', 'FICAM', 'AZURE_AD']
    ]);

    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      azureAdAuthLogger('Invalid Azure AD token', { error });
      next(); // Let other auth middleware handle this
      return;
    }

    azureAdAuthLogger('Azure AD authentication error', { error });
    next(); // Let other auth middleware handle this
    return;
  }
};