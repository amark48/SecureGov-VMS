import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { query, transaction } from '../config/database';
import speakeasy from 'speakeasy';
import qrcode from 'qrcode';
import { notificationService } from './notification';
import jwksClient from 'jwks-rsa';
import { IdentityProviderService } from './identityProviderService';
import { OktaProviderConfig, Auth0ProviderConfig } from '../types/identityProvider';

// Logger setup
const authServiceLogger = (message: string, data?: any) => {
  console.log(`[AuthService] ${message}`, data ? data : '');
};

// External provider token payload interface
interface ExternalTokenPayload {
  sub: string;
  email?: string;
  name?: string;
  given_name?: string;
  family_name?: string;
  preferred_username?: string;
  groups?: string[];
  roles?: string[];
  aud: string;
  iss: string;
  exp: number;
  iat: number;
}

export class AuthService {
  // Generate JWT token
  static generateToken(userId: string, email: string, role: string, tenantId: string): string {
    authServiceLogger('Generating JWT token', { userId, email, role, tenantId });
    const secret = process.env.JWT_SECRET as jwt.Secret;
    if (!secret) throw new Error('JWT_SECRET environment variable is required');
    
    const payload = { userId, email, role, tenant_id: tenantId }; 
    const options: jwt.SignOptions = { 
      expiresIn: (process.env.JWT_EXPIRES_IN || '8h') as jwt.SignOptions['expiresIn']
    };
    
    return jwt.sign(payload, secret, options);
  }
  
  // Verify JWT token
  static verifyToken(token: string): any {
    authServiceLogger('Verifying JWT token');
    const secret = process.env.JWT_SECRET as jwt.Secret;
    if (!secret) {
      throw new Error('JWT_SECRET environment variable is required');
    }
    
    try {
      const decoded = jwt.verify(token, secret);
      authServiceLogger('JWT token verified successfully');
      return decoded;
    } catch (error) {
      authServiceLogger('JWT token verification failed', { error });
      throw error;
    }
  }
  
  // Generate MFA secret
  static generateMFASecret(email: string): { secret: speakeasy.GeneratedSecret, qrCodeUrl: Promise<string> } {
    authServiceLogger('Generating MFA secret', { email });
    const secret = speakeasy.generateSecret({
      name: `SecureGov VMS:${email}`,
      issuer: 'SecureGov VMS'
    });
    
    const qrCodeUrl = qrcode.toDataURL(secret.otpauth_url || '');
    authServiceLogger('MFA secret and QR code generated');
    
    return { secret, qrCodeUrl };
  }
  
  // Verify MFA token
  static verifyMFAToken(secret: string, token: string): boolean {
    authServiceLogger('Verifying MFA token');
    return speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token,
      window: 2 // Allow for 2 time steps before and after the current time
    });
  }
  
  // Store MFA secret for user
  async storeMFASecret(userId: string, secret: string): Promise<void> {
    authServiceLogger('Storing MFA secret', { userId });
    await query(
      'UPDATE profiles SET mfa_secret = $1, mfa_enabled = true, updated_at = NOW() WHERE id = $2',
      [secret, userId]
    );
  }
  
  // Disable MFA for user
  async disableMFA(userId: string): Promise<void> {
    authServiceLogger('Disabling MFA', { userId });
    await query(
      'UPDATE profiles SET mfa_secret = NULL, mfa_enabled = false, updated_at = NOW() WHERE id = $1',
      [userId]
    );
  }
  
  // Log authentication event
  static async logAuthEvent(userId: string, tenantId: string, action: 'login' | 'logout' | 'mfa_enabled' | 'mfa_disabled', ipAddress?: string, userAgent?: string): Promise<void> {
    authServiceLogger('Logging auth event', { userId, action, ipAddress });
    await query(`
      INSERT INTO audit_logs (
        user_id, tenant_id, action, table_name, new_values, ip_address, user_agent, compliance_flags
      ) VALUES ($1, $2, $3, 'auth', $4, $5, $6, $7)
    `, [
      userId,
      tenantId,
      action === 'login' ? 'login' : action === 'logout' ? 'logout' : 'update',
      JSON.stringify({ action }),
      ipAddress,
      userAgent,
      ['SECURITY', 'FIPS_140', 'FICAM']
    ]);
  }

  // Create a new user
  async createUser(userData: {
    email: string;
    password: string;
    full_name: string;
    role: string;
    tenant_id: string;
    department?: string;
    phone?: string;
    employee_number?: string;
    security_clearance?: string;
  }): Promise<any> {
    authServiceLogger('Creating new user', { 
      email: userData.email, 
      role: userData.role, 
      tenant_id: userData.tenant_id 
    });
    return await transaction(async (client) => {
      // Generate employee number if not provided
      let userEmployeeNumber = userData.employee_number;
      if (!userEmployeeNumber) {
        authServiceLogger('Generating employee number');
        // Get tenant prefix and next sequence
        const tenantInfoResult = await client.query(
          'SELECT tenant_prefix, next_employee_sequence FROM tenants WHERE id = $1 FOR UPDATE',
          [userData.tenant_id]
        );
        
        if (tenantInfoResult.rows.length === 0) {
          authServiceLogger('Tenant not found for employee number generation');
          throw new Error('Tenant not found');
        }
        
        const { tenant_prefix, next_employee_sequence } = tenantInfoResult.rows[0];
        
        // Generate employee number
        userEmployeeNumber = `${tenant_prefix}${next_employee_sequence.toString().padStart(6, '0')}`;
        authServiceLogger('Generated employee number', { userEmployeeNumber });
        
        // Increment sequence
        await client.query(
          'UPDATE tenants SET next_employee_sequence = next_employee_sequence + 1 WHERE id = $1',
          [userData.tenant_id]
        );
      }
      
      authServiceLogger('Hashing password');
      const hashedPassword = await bcrypt.hash(userData.password, parseInt(process.env.BCRYPT_ROUNDS || '12'));
      
      // Split full name into first and last name
      const nameParts = userData.full_name.split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';
      
      authServiceLogger('Inserting user into database');
      const result = await client.query(`
        INSERT INTO profiles (
          email, password_hash, full_name, first_name, last_name, role, tenant_id, department, phone, employee_number, security_clearance, is_active
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, true)
        RETURNING id, email, full_name, first_name, last_name, role, tenant_id, department, phone, employee_number, security_clearance, created_at
      `, [
        userData.email,
        hashedPassword,
        userData.full_name,
        firstName,
        lastName,
        userData.role,
        userData.tenant_id,
        userData.department || null,
        userData.phone || null,
        userEmployeeNumber,
        userData.security_clearance || null
      ]);
      
      // Get tenant name for notification
      authServiceLogger('Getting tenant name for notification');
      const tenantResult = await client.query(
        'SELECT name FROM tenants WHERE id = $1',
        [userData.tenant_id]
      );
      
      const tenantName = tenantResult.rows.length > 0 ? tenantResult.rows[0].name : 'SecureGov VMS';
      
      // Send account creation notification
      authServiceLogger('Sending account creation notification', { recipient: userData.email });
      try {
        await notificationService.sendNotification({
          tenantId: userData.tenant_id,
          event: 'account_created',
          type: 'email',
          recipientEmail: userData.email,
          variables: {
            user_name: userData.full_name,
            user_email: userData.email,
            user_role: userData.role,
            temp_password: userData.password,
            organization_name: tenantName
          }
        });
      } catch (error) {
        console.error('Failed to send account creation notification:', error);
        authServiceLogger('Failed to send account creation notification', { error });
        // Continue even if notification fails
      }
      
      authServiceLogger('User created successfully', { user_id: result.rows[0].id });
      return result.rows[0];
    });
  }

  // Generate a random password
  static generateRandomPassword(length = 12, forTesting = false): string {
    console.log('[AuthService] Generating random password', { length, forTesting });
    
    // For testing purposes, return a simple, predictable password
    if (forTesting) {
      return "TestPass123!";
    }
    
    // Define character sets
    const uppercaseCharset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowercaseCharset = 'abcdefghijklmnopqrstuvwxyz';
    const numberCharset = '0123456789';
    const specialCharset = '!@#$%^&*()_+~`|}{[]:;?><,./-=';
    const charset = uppercaseCharset + lowercaseCharset + numberCharset + specialCharset;
    
    // Ensure at least one of each character type
    let password = '';
    password += uppercaseCharset.charAt(Math.floor(Math.random() * uppercaseCharset.length));
    password += lowercaseCharset.charAt(Math.floor(Math.random() * lowercaseCharset.length));
    password += numberCharset.charAt(Math.floor(Math.random() * numberCharset.length));
    password += specialCharset.charAt(Math.floor(Math.random() * specialCharset.length));
    
    // Fill the rest with random characters
    for (let i = 4; i < length; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    
    // Shuffle the password
    password = password.split('').sort(() => 0.5 - Math.random()).join('');
    
    console.log('[AuthService] Random password generated', { 
      passwordLength: password.length,
      password: password // Log the actual password for debugging
    });
    return password;
  }

  /**
   * Authenticate user with external provider (Okta or Auth0)
   */
  static async authenticateExternalProvider(
    providerType: 'okta' | 'auth0',
    idToken: string,
    tenantId: string
  ): Promise<any> {
    authServiceLogger('Authenticating with external provider', { providerType, tenantId });

    try {
      // Get provider configuration
      let providerConfig: OktaProviderConfig | Auth0ProviderConfig | null = null;
      
      if (providerType === 'okta') {
        providerConfig = await IdentityProviderService.getOktaConfig(tenantId);
      } else if (providerType === 'auth0') {
        providerConfig = await IdentityProviderService.getAuth0Config(tenantId);
      }

      if (!providerConfig) {
        throw new Error(`${providerType} provider not configured for this tenant`);
      }

      // Validate the ID token
      const tokenPayload = await this.validateExternalToken(idToken, providerConfig, providerType);
      authServiceLogger('External token validated successfully', { 
        sub: tokenPayload.sub,
        email: tokenPayload.email 
      });

      // Get or create user
      const user = await this.getOrCreateExternalUser(
        tokenPayload.email || tokenPayload.preferred_username || '',
        tokenPayload.name || `${tokenPayload.given_name || ''} ${tokenPayload.family_name || ''}`.trim(),
        tokenPayload.sub,
        tenantId,
        tokenPayload.groups || tokenPayload.roles || [],
        providerType
      );

      authServiceLogger('External authentication successful', { userId: user.id });
      return user;
    } catch (error: any) {
      authServiceLogger('External authentication failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Validate external provider token
   */
  private static async validateExternalToken(
    idToken: string,
    providerConfig: OktaProviderConfig | Auth0ProviderConfig,
    providerType: 'okta' | 'auth0'
  ): Promise<ExternalTokenPayload> {
    return new Promise((resolve, reject) => {
      // Create JWKS client
      const client = jwksClient({
        jwksUri: providerConfig.jwks_uri || (providerType === 'okta' 
          ? `https://${providerConfig.domain}/oauth2/default/v1/keys`
          : `https://${providerConfig.domain}/.well-known/jwks.json`),
        requestHeaders: {},
        timeout: 30000,
      });

      const getKey = (header: any, callback: any) => {
        client.getSigningKey(header.kid, (err, key) => {
          if (err) {
            authServiceLogger('Error getting signing key', { error: err.message });
            return callback(err);
          }
          const signingKey = key?.getPublicKey();
          callback(null, signingKey);
        });
      };

      // Verify token
      jwt.verify(idToken, getKey, {
        audience: providerConfig.client_id,
        issuer: providerConfig.issuer || (providerType === 'okta' 
          ? `https://${providerConfig.domain}/oauth2/default`
          : `https://${providerConfig.domain}/`),
        algorithms: ['RS256']
      }, (err, decoded) => {
        if (err) {
          authServiceLogger('Token verification failed', { error: err.message });
          reject(new Error(`Token verification failed: ${err.message}`));
        } else {
          resolve(decoded as ExternalTokenPayload);
        }
      });
    });
  }

  /**
   * Get or create user from external provider
   */
  static async getOrCreateExternalUser(
    email: string,
    fullName: string,
    externalId: string,
    tenantId: string,
    roles: string[],
    providerType: 'okta' | 'auth0'
  ): Promise<any> {
    authServiceLogger('Getting or creating external user', { 
      email, 
      externalId, 
      tenantId, 
      providerType 
    });

    if (!email) {
      throw new Error('Email not found in external provider token');
    }

    // Check if user exists by external ID or email
    let userResult = await query(
      `SELECT * FROM profiles 
       WHERE (
         (auth_provider = $1 AND azure_ad_object_id = $2) OR 
         email = $3
       ) AND tenant_id = $4`,
      [providerType, externalId, email, tenantId]
    );

    let user: any;

    if (userResult.rows.length === 0) {
      authServiceLogger('User not found, creating new user from external provider');
      
      const nameParts = fullName.split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';
      const internalRole = this.mapExternalRoleToInternal(roles);

      // Create new user
      const createUserResult = await query(`
        INSERT INTO profiles (
          email, full_name, first_name, last_name, role, tenant_id, 
          is_active, auth_provider, azure_ad_object_id, azure_ad_roles
        ) VALUES ($1, $2, $3, $4, $5, $6, true, $7, $8, $9)
        RETURNING *
      `, [
        email, fullName, firstName, lastName, internalRole, tenantId,
        providerType, externalId, JSON.stringify(roles)
      ]);

      user = createUserResult.rows[0];
      authServiceLogger('Created new user from external provider', { userId: user.id });
    } else {
      user = userResult.rows[0];
      authServiceLogger('Found existing user', { userId: user.id });

      // Update external provider specific fields if they've changed
      const currentRoles = JSON.stringify(roles);
      if (user.azure_ad_object_id !== externalId || 
          JSON.stringify(user.azure_ad_roles) !== currentRoles) {
        
        authServiceLogger('Updating user external provider information');
        const internalRole = this.mapExternalRoleToInternal(roles);
        
        await query(`
          UPDATE profiles 
          SET azure_ad_object_id = $1, azure_ad_roles = $2, role = $3, 
              auth_provider = $4, last_login = NOW(), updated_at = NOW()
          WHERE id = $5
        `, [externalId, currentRoles, internalRole, providerType, user.id]);

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
    const userObj = {
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
      auth_provider: providerType,
      azure_ad_object_id: user.azure_ad_object_id,
      azure_ad_roles: user.azure_ad_roles,
      permissions: permissionsResult.rows.map((row: any) => ({
        resource: row.resource,
        action: row.action
      }))
    };

    authServiceLogger('Successfully processed external user', { userId: userObj.id });
    return userObj;
  }

  /**
   * Map external provider roles to internal roles
   */
  private static mapExternalRoleToInternal(externalRoles: string[]): string {
    authServiceLogger('Mapping external roles to internal roles', { externalRoles });
    
    // Define role mapping - customize based on your external provider setup
    const roleMapping: Record<string, string> = {
      // Okta roles
      'VMS.SuperAdmin': 'super_admin',
      'VMS.Admin': 'admin',
      'VMS.Security': 'security',
      'VMS.Reception': 'reception',
      'VMS.Host': 'host',
      'VMS.Approver': 'approver',
      // Auth0 roles
      'SuperAdmin': 'super_admin',
      'Admin': 'admin',
      'Security': 'security',
      'Reception': 'reception',
      'Host': 'host',
      'Approver': 'approver',
      // Generic roles
      'admin': 'admin',
      'security': 'security',
      'reception': 'reception',
      'host': 'host',
      'approver': 'approver'
    };

    // Find the highest priority role
    const rolePriority = ['super_admin', 'admin', 'security', 'reception', 'approver', 'host'];
    
    for (const externalRole of externalRoles) {
      const internalRole = roleMapping[externalRole];
      if (internalRole) {
        authServiceLogger('Mapped external role to internal role', { externalRole, internalRole });
        return internalRole;
      }
    }

    // Default to host if no specific role mapping found
    authServiceLogger('No specific role mapping found, defaulting to host');
    return 'host';
  }

  /**
   * Log authentication event for external providers
   */
  static async logExternalAuthEvent(
    userId: string, 
    tenantId: string, 
    action: 'login' | 'logout', 
    providerType: 'okta' | 'auth0',
    ipAddress?: string, 
    userAgent?: string
  ): Promise<void> {
    authServiceLogger('Logging external auth event', { userId, action, providerType, ipAddress });
    await query(`
      INSERT INTO audit_logs (
        user_id, tenant_id, action, table_name, new_values, ip_address, user_agent, compliance_flags
      ) VALUES ($1, $2, $3, 'auth', $4, $5, $6, $7)
    `, [
      userId,
      tenantId,
      action,
      JSON.stringify({ 
        action, 
        auth_provider: providerType,
        external_provider: providerType.toUpperCase()
      }),
      ipAddress,
      userAgent,
      ['SECURITY', 'FIPS_140', 'FICAM', providerType.toUpperCase()]
    ]);
  }
}

export const authService = new AuthService();