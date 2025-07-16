import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { body, query, validationResult } from 'express-validator';
import { query as dbQuery, transaction } from '../config/database';
import { asyncHandler, createError } from '../middleware/errorHandler';
import { AuthenticatedRequest, authenticateToken, requireAdmin, requireRole } from '../middleware/auth';
import speakeasy from 'speakeasy';
import qrcode from 'qrcode';
import { v4 as uuidv4 } from 'uuid';
import { AuthService } from '../services/auth';
import { awsFederationService } from '../services/awsFederationService';
import { IdentityProviderService } from '../services/identityProviderService';

const router = express.Router();
const authenticatedRouter = express.Router();

// Apply authentication middleware to all authenticated routes
authenticatedRouter.use(authenticateToken);

// Azure AD login endpoint
router.post('/azure-ad/login', [
  body('access_token').isString().withMessage('Azure AD access token is required')
], asyncHandler(async (req: express.Request, res: express.Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw createError('Validation failed', 400, 'VALIDATION_ERROR', errors.array());
  }

  const { access_token } = req.body;

  // Create a mock request object for Azure AD authentication
  const mockReq = {
    headers: { authorization: `Bearer ${access_token}` },
    method: 'POST',
    ip: req.ip,
    get: req.get.bind(req)
  } as any;

  let user: any = null;
  let authError: any = null;

  // Use Azure AD authentication middleware
  const { authenticateAzureAdToken } = await import('../middleware/azureAdAuth');
  
  await new Promise<void>((resolve) => {
    authenticateAzureAdToken(mockReq, res, (error?: any) => {
      if (error) {
        authError = error;
      } else {
        user = mockReq.user;
      }
      resolve();
    });
  });

  if (authError || !user) {
    throw createError('Azure AD authentication failed', 401, 'AZURE_AD_AUTH_FAILED');
  }

  // Generate local JWT token for the session
  const token = AuthService.generateToken(user.id, user.email, user.role, user.tenant_id);

  // Optionally get AWS credentials if federation is enabled
  let awsCredentials = null;
  if (user.azure_ad_roles) {
    try {
      awsCredentials = await awsFederationService.assumeRoleWithAzureAdToken(
        access_token,
        user.azure_ad_roles,
        `session-${user.id}-${Date.now()}`,
        user.tenant_id
      );
      
      // Store AWS credentials in user object (in a real app, you might want to store this in a cache)
      user.aws_credentials = awsCredentials;
    } catch (awsError) {
      console.error('Failed to get AWS credentials:', awsError);
      // Continue without AWS credentials - this is optional
    }
  }

  res.json({
    message: 'Azure AD login successful',
    user,
    token,
    aws_credentials: awsCredentials
  });
}));

// External provider login endpoint (Okta/Auth0)
router.post('/external/login', [
  body('id_token').isString().withMessage('ID token is required'),
  body('auth_provider_type').isIn(['okta', 'auth0']).withMessage('Valid auth provider type is required'),
  body('tenant_id').optional().isUUID().withMessage('Valid tenant ID is required if provided')
], asyncHandler(async (req: express.Request, res: express.Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw createError('Validation failed', 400, 'VALIDATION_ERROR', errors.array());
  }

  const { id_token, auth_provider_type, tenant_id } = req.body;

  try {
    // If tenant_id is not provided, we need to extract it from the token or use tenant discovery
    let targetTenantId = tenant_id;
    
    if (!targetTenantId) {
      // Decode token without verification to get issuer information
      const unverifiedDecoded = jwt.decode(id_token) as any;
      if (!unverifiedDecoded || !unverifiedDecoded.iss) {
        throw createError('Invalid token format or missing issuer', 400, 'INVALID_TOKEN');
      }

      // Extract domain from issuer
      let domain = '';
      if (auth_provider_type === 'okta') {
        const oktaDomainMatch = unverifiedDecoded.iss.match(/https:\/\/([^\/]+)/);
        domain = oktaDomainMatch ? oktaDomainMatch[1] : '';
      } else if (auth_provider_type === 'auth0') {
        const auth0DomainMatch = unverifiedDecoded.iss.match(/https:\/\/([^\/]+)/);
        domain = auth0DomainMatch ? auth0DomainMatch[1] : '';
      }

      if (!domain) {
        throw createError('Could not extract domain from token issuer', 400, 'INVALID_TOKEN');
      }

      // Find tenant by domain
      let tenantConfig = null;
      if (auth_provider_type === 'okta') {
        tenantConfig = await IdentityProviderService.findTenantByOktaDomain(domain);
      } else if (auth_provider_type === 'auth0') {
        tenantConfig = await IdentityProviderService.findTenantByAuth0Domain(domain);
      }

      if (!tenantConfig) {
        throw createError(`No tenant configuration found for ${auth_provider_type} domain: ${domain}`, 404, 'TENANT_NOT_FOUND');
      }

      targetTenantId = tenantConfig.tenant_id;
    }

    // Authenticate with external provider
    const user = await AuthService.authenticateExternalProvider(
      auth_provider_type,
      id_token,
      targetTenantId
    );

    if (!user.is_active) {
      throw createError('Account is deactivated', 401, 'ACCOUNT_DEACTIVATED');
    }

    // Generate local JWT token for the session
    const token = AuthService.generateToken(user.id, user.email, user.role, user.tenant_id);

    // Log the login event
    await AuthService.logExternalAuthEvent(
      user.id,
      user.tenant_id,
      'login',
      auth_provider_type,
      req.ip,
      req.get('User-Agent')
    );

    res.json({
      message: `${auth_provider_type} login successful`,
      user,
      token
    });
  } catch (error: any) {
    console.error(`${auth_provider_type} authentication error:`, error);
    throw createError(
      `${auth_provider_type} authentication failed: ${error.message}`,
      401,
      `${auth_provider_type.toUpperCase()}_AUTH_FAILED`
    );
  }
}));

// Public routes (no authentication required)
router.post('/login', [
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('mfaCode').optional().isLength({ min: 6, max: 6 }).isNumeric().withMessage('MFA code must be 6 digits')
], asyncHandler(async (req: express.Request, res: express.Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw createError('Validation failed', 400, 'VALIDATION_ERROR', errors.array());
  }

  const { email, password, mfaCode } = req.body;

  // Find user by email
  const userResult = await dbQuery(
    'SELECT id, email, password_hash, tenant_id, role, role_id, full_name, first_name, last_name, department, phone, is_active, mfa_enabled, mfa_secret, employee_number, security_clearance FROM profiles WHERE email = $1',
    [email]
  );

  if (userResult.rows.length === 0) {
    throw createError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
  }

  const user = userResult.rows[0];

  // Check if user is active
  if (!user.is_active) {
    throw createError('Account is deactivated', 401, 'ACCOUNT_DEACTIVATED');
  }

  // Verify password
  const isPasswordValid = await bcrypt.compare(password, user.password_hash);
  if (!isPasswordValid) {
    throw createError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
  }

  // Check if MFA is enabled
  if (user.mfa_enabled) {
    // If MFA is enabled but no code provided, return MFA required response
    if (!mfaCode) {
      // Get tenant name
      const tenantResult = await dbQuery(
        'SELECT name FROM tenants WHERE id = $1',
        [user.tenant_id]
      );
      
      const tenantName = tenantResult.rows.length > 0 ? tenantResult.rows[0].name : null;
      
      return res.json({
        message: 'MFA code required',
        mfa_required: true,
        user: {
          id: user.id,
          email: user.email,
          full_name: user.full_name,
          tenant_id: user.tenant_id,
          tenant_name: tenantName,
          role: user.role
        }
      });
    }

    // Verify MFA code
    const verified = speakeasy.totp.verify({
      secret: user.mfa_secret,
      encoding: 'base32',
      token: mfaCode,
      window: 2 // Allow for 2 time steps before and after the current time
    });

    if (!verified) {
      throw createError('Invalid MFA code', 401, 'INVALID_MFA_CODE');
    }
  }

  // Get tenant information
  const tenantResult = await dbQuery(
    'SELECT name, corporate_email_domain, tenant_prefix, next_employee_sequence, custom_departments FROM tenants WHERE id = $1',
    [user.tenant_id]
  );

  const tenant = tenantResult.rows[0] || {};

  // Generate JWT token
  const token = jwt.sign(
    { 
      userId: user.id, 
      email: user.email, 
      role: user.role,
      tenant_id: user.tenant_id
    },
    process.env.JWT_SECRET! as jwt.Secret, // Cast to jwt.Secret
    { expiresIn: process.env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'] || '8h' } // Cast expiresIn
  );

  // Update last login timestamp
  await dbQuery(
    'UPDATE profiles SET last_login = NOW() WHERE id = $1',
    [user.id]
  );

  // Log the login event
  await dbQuery(`
    INSERT INTO audit_logs (
      user_id, tenant_id, action, table_name, new_values, compliance_flags
    ) VALUES ($1, $2, 'login', 'auth', $3, $4)
  `, [
    user.id,
    user.tenant_id,
    JSON.stringify({ ip: req.ip, user_agent: req.get('User-Agent') }),
    ['SECURITY', 'FIPS_140', 'FICAM']
  ]);

  // Return user data and token
  return res.json({ // Added return here
    message: 'Login successful',
    user: {
      id: user.id,
      email: user.email,
      tenant_id: user.tenant_id,
      tenant_name: tenant.name,
      corporate_email_domain: tenant.corporate_email_domain,
      tenant_prefix: tenant.tenant_prefix,
      next_employee_sequence: tenant.next_employee_sequence,
      custom_departments: tenant.custom_departments,
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
      last_login: new Date().toISOString(),
      created_at: user.created_at,
      updated_at: user.updated_at
    },
    token
  });
}));

router.post('/register', [
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('full_name').isLength({ min: 2 }).withMessage('Full name is required'),
  body('role').isIn(['admin', 'security', 'reception', 'host', 'approver']).withMessage('Invalid role'),
  body('tenant_id').optional().isUUID().withMessage('Invalid tenant ID'),
  body('tenant_name').optional().isLength({ min: 2 }).withMessage('Tenant name must be at least 2 characters')
], asyncHandler(async (req: express.Request, res: express.Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw createError('Validation failed', 400, 'VALIDATION_ERROR', errors.array());
  }

  const { email, password, full_name, role, tenant_id, tenant_name, department, phone, security_clearance } = req.body;

  // Check if user already exists
  const existingUser = await dbQuery('SELECT id FROM profiles WHERE email = $1', [email]);
  if (existingUser.rows.length > 0) {
    throw createError('User with this email already exists', 409, 'USER_EXISTS');
  }

  // Handle tenant creation or validation
  let userTenantId = tenant_id;
  
  if (!userTenantId && tenant_name) {
    // Create a new tenant
    const newTenantResult = await dbQuery(
      'INSERT INTO tenants (name) VALUES ($1) RETURNING id',
      [tenant_name]
    );
    userTenantId = newTenantResult.rows[0].id;
  } else if (!userTenantId) {
    // If no tenant_id or tenant_name provided, use default tenant
    const defaultTenantResult = await dbQuery(
      'SELECT id FROM tenants WHERE name = $1',
      ['Default Tenant']
    );
    
    if (defaultTenantResult.rows.length === 0) {
      throw createError('Default tenant not found', 500, 'TENANT_NOT_FOUND');
    }
    
    userTenantId = defaultTenantResult.rows[0].id;
  }

  // Split full name into first and last name
  const nameParts = full_name.split(' ');
  const firstName = nameParts[0];
  const lastName = nameParts.slice(1).join(' ');

  // Hash password
  const hashedPassword = await bcrypt.hash(password, parseInt(process.env.BCRYPT_ROUNDS || '12'));

  // Create user
  const result = await transaction(async (client) => {
    // Get tenant prefix and next sequence for employee number
    const tenantInfoResult = await client.query(
      'SELECT tenant_prefix, next_employee_sequence FROM tenants WHERE id = $1',
      [userTenantId]
    );
    
    const { tenant_prefix, next_employee_sequence } = tenantInfoResult.rows[0];
    const employeeNumber = `${tenant_prefix}${next_employee_sequence.toString().padStart(6, '0')}`;
    
    // Increment sequence
    await client.query(
      'UPDATE tenants SET next_employee_sequence = next_employee_sequence + 1 WHERE id = $1',
      [userTenantId]
    );
    
    // Get role_id for the specified role
    const roleResult = await client.query(
      'SELECT id FROM roles WHERE name = $1 AND tenant_id = $2',
      [role, userTenantId]
    );
    
    let roleId = null;
    if (roleResult.rows.length > 0) {
      roleId = roleResult.rows[0].id;
    }
    
    // Insert user
    const userResult = await client.query(`
      INSERT INTO profiles (
        email, password_hash, full_name, first_name, last_name, role, role_id, tenant_id, 
        department, phone, employee_number, security_clearance, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, true)
      RETURNING id, email, tenant_id, role, full_name, first_name, last_name, 
                department, phone, employee_number, security_clearance, is_active, 
                created_at, updated_at
    `, [
      email, hashedPassword, full_name, firstName, lastName, role, roleId, userTenantId,
      department, phone, employeeNumber, security_clearance
    ]);
    
    return userResult.rows[0];
  });

  // Generate JWT token
  const token = jwt.sign(
    { 
      userId: result.id, 
      email: result.email, 
      role: result.role,
      tenant_id: result.tenant_id
    },
    process.env.JWT_SECRET! as jwt.Secret, // Cast to jwt.Secret
    { expiresIn: process.env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'] || '8h' } // Cast expiresIn
  );

  // Get tenant name
  const tenantResult = await dbQuery(
    'SELECT name FROM tenants WHERE id = $1',
    [result.tenant_id]
  );
  
  const tenantName = tenantResult.rows.length > 0 ? tenantResult.rows[0].name : null;

  // Return user data and token
  return res.status(201).json({ // Added return here
    message: 'User registered successfully',
    user: {
      ...result,
      tenant_name: tenantName
    },
    token
  });
}));

// Mount authenticated routes after public routes are defined
router.use(authenticatedRouter);

// AWS credentials endpoint for Azure AD users
authenticatedRouter.post('/aws/credentials', asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  if (!req.user) {
    throw createError('Authentication required', 401, 'AUTH_REQUIRED');
  }

  if (req.user.auth_provider !== 'azure_ad') {
    throw createError('AWS federation only available for Azure AD users', 400, 'AZURE_AD_REQUIRED');
  }

  if (!req.user.azure_ad_roles || req.user.azure_ad_roles.length === 0) {
    throw createError('No Azure AD roles found for AWS federation', 400, 'NO_AZURE_AD_ROLES');
  }

  // Check if AWS federation is configured for this tenant
  const awsConfig = await IdentityProviderService.getAwsFederationConfig(req.user.tenant_id);
  if (!awsConfig) {
    throw createError('AWS federation is not configured for this tenant', 400, 'AWS_FEDERATION_NOT_CONFIGURED');
  }

  // Get the original Azure AD token from the request
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    throw createError('Azure AD token required for AWS federation', 400, 'AZURE_AD_TOKEN_REQUIRED');
  }

  try {
    const awsCredentials = await awsFederationService.getValidAwsCredentials(
      token,
      req.user.azure_ad_roles,
      req.user.aws_credentials,
      req.user.tenant_id
    );

    res.json({
      message: 'AWS credentials retrieved successfully',
      credentials: awsCredentials
    });
  } catch (error: any) {
    throw createError(`Failed to get AWS credentials: ${error.message}`, 500, 'AWS_CREDENTIALS_ERROR');
  }
}));

// Assume specific AWS role endpoint
authenticatedRouter.post('/aws/assume-role', [
  body('role_name').isString().withMessage('AWS role name is required')
], asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw createError('Validation failed', 400, 'VALIDATION_ERROR', errors.array());
  }

  if (!req.user) {
    throw createError('Authentication required', 401, 'AUTH_REQUIRED');
  }

  if (req.user.auth_provider !== 'azure_ad') {
    throw createError('AWS federation only available for Azure AD users', 400, 'AZURE_AD_REQUIRED');
  }

  // Check if AWS federation is configured for this tenant
  const awsConfig = await IdentityProviderService.getAwsFederationConfig(req.user.tenant_id);
  if (!awsConfig) {
    throw createError('AWS federation is not configured for this tenant', 400, 'AWS_FEDERATION_NOT_CONFIGURED');
  }

  const { role_name } = req.body;

  // Get the original Azure AD token from the request
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    throw createError('Azure AD token required for AWS federation', 400, 'AZURE_AD_TOKEN_REQUIRED');
  }

  try {
    const awsCredentials = await awsFederationService.assumeSpecificRole(
      token,
      role_name,
      `session-${req.user.id}-${Date.now()}`,
      req.user.tenant_id
    );

    res.json({
      message: 'AWS role assumed successfully',
      role_name,
      credentials: awsCredentials
    });
  } catch (error: any) {
    throw createError(`Failed to assume AWS role: ${error.message}`, 500, 'AWS_ROLE_ASSUMPTION_ERROR');
  }
}));

// Admin routes for user management
authenticatedRouter.post('/admin/register-user', requireAdmin(), [
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('first_name').isLength({ min: 1 }).withMessage('First name is required'),
  body('last_name').isLength({ min: 1 }).withMessage('Last name is required'),
  body('role').isIn(['admin', 'security', 'reception', 'host', 'approver']).withMessage('Invalid role'),
  body('tenant_id').optional().isUUID().withMessage('Invalid tenant ID'),
  body('department').optional().isString(),
  body('phone').optional().isString(),
  body('employee_number').optional().isString(),
  body('security_clearance').optional().isString()
], asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw createError('Validation failed', 400, 'VALIDATION_ERROR', errors.array());
  }

  const { 
    email, password, first_name, last_name, role, 
    tenant_id, department, phone, employee_number, security_clearance 
  } = req.body;

  // Use the current user's tenant_id if not specified
  const userTenantId = tenant_id || req.user!.tenant_id;

  // Check if user already exists
  const existingUser = await dbQuery('SELECT id FROM profiles WHERE email = $1', [email]);
  if (existingUser.rows.length > 0) {
    throw createError('User with this email already exists', 409, 'USER_EXISTS');
  }

  // Combine first and last name
  const full_name = `${first_name} ${last_name}`;

  // Hash password
  const hashedPassword = await bcrypt.hash(password, parseInt(process.env.BCRYPT_ROUNDS || '12'));

  try {
    // Create user
    const result = await transaction(async (client) => {
      // Get role_id for the specified role
      const roleResult = await client.query(
        'SELECT id FROM roles WHERE name = $1 AND tenant_id = $2',
        [role, userTenantId]
      );
      
      let roleId = null;
      if (roleResult.rows.length > 0) {
        roleId = roleResult.rows[0].id;
      }
      
      // Generate employee number if not provided
      let userEmployeeNumber = employee_number;
      if (!userEmployeeNumber) {
        // Get tenant prefix and next sequence
        const tenantInfoResult = await client.query(
          'SELECT tenant_prefix, next_employee_sequence FROM tenants WHERE id = $1',
          [userTenantId]
        );
        
        const { tenant_prefix, next_employee_sequence } = tenantInfoResult.rows[0];
        userEmployeeNumber = `${tenant_prefix}${next_employee_sequence.toString().padStart(6, '0')}`;
        
        // Increment sequence
        await client.query(
          'UPDATE tenants SET next_employee_sequence = next_employee_sequence + 1 WHERE id = $1',
          [userTenantId]
        );
      }
      
      // Insert user
      const userResult = await client.query(`
        INSERT INTO profiles (
          email, password_hash, full_name, first_name, last_name, role, role_id, tenant_id, 
          department, phone, employee_number, security_clearance, is_active
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, true)
        RETURNING id, email, tenant_id, role, full_name, first_name, last_name, 
                  department, phone, employee_number, security_clearance, is_active, 
                  created_at, updated_at
      `, [
        email, hashedPassword, full_name, first_name, last_name, role, roleId, userTenantId,
        department, phone, userEmployeeNumber, security_clearance
      ]);
      
      return userResult.rows[0];
    });

    // Get tenant name
    const tenantResult = await dbQuery(
      'SELECT name FROM tenants WHERE id = $1',
      [result.tenant_id]
    );
    
    const tenantName = tenantResult.rows.length > 0 ? tenantResult.rows[0].name : null;

    // Return user data
    return res.status(201).json({ // Added return here
      message: 'User created successfully',
      user: {
        ...result,
        tenant_name: tenantName
      }
    });
  } catch (error: any) {
    throw createError((error as Error).message || 'Failed to create user', 500, 'USER_CREATION_ERROR');
  }
}));

// Get permissions for the current user
router.get('/permissions/me', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  try {
    // Get permissions for the current user
    const permissionsResult = await dbQuery(
      'SELECT * FROM get_user_permissions($1)',
      [req.user!.id]
    );
    
    res.json({
      permissions: permissionsResult.rows
    });
  } catch (error: any) {
    throw createError(error.message || 'Failed to get permissions', 500, 'PERMISSION_ERROR');
  }
}));

// Get permissions for a specific role
router.get('/permissions', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const { role } = req.query;
  
  if (!role) {
    throw createError('Role is required', 400, 'VALIDATION_ERROR');
  }
  
  try {
    // Get permissions for the specified role
    const permissionsResult = await dbQuery(
      'SELECT * FROM get_role_permissions_by_name($1)',
      [role]
    );
    
    res.json({
      permissions: permissionsResult.rows
    });
  } catch (error: any) {
    throw createError(error.message || 'Failed to get permissions', 500, 'PERMISSION_ERROR');
  }
}));

// Get all permissions
authenticatedRouter.get('/permissions/all', requireAdmin(), asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  try {
    const result = await dbQuery('SELECT * FROM permissions ORDER BY resource, action');
    
    res.json({
      permissions: result.rows
    });
  } catch (error: any) {
    throw createError(error.message || 'Failed to get permissions', 500, 'PERMISSION_ERROR');
  }
}));

// Get current user profile
authenticatedRouter.get('/profile', asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  try {
    // Get user profile with tenant information
    const userResult = await dbQuery(`
      SELECT p.*, t.name as tenant_name, t.corporate_email_domain, t.tenant_prefix, t.next_employee_sequence
      FROM profiles p
      JOIN tenants t ON p.tenant_id = t.id
      WHERE p.id = $1
    `, [req.user!.id]);
    
    if (userResult.rows.length === 0) {
      throw createError('User not found', 404, 'USER_NOT_FOUND');
    }
    
    const user = userResult.rows[0];
    
    // Get user permissions
    const permissionsResult = await dbQuery(
      'SELECT * FROM get_user_permissions($1)',
      [req.user!.id]
    );
    
    // Add permissions to user object
    user.permissions = permissionsResult.rows;
    
    res.json({
      user
    });
  } catch (error: any) {
    throw createError(error.message || 'Failed to get profile', 500, 'PROFILE_ERROR');
  }
}));

// Update current user profile
authenticatedRouter.put(
  '/profile',
  [
    body('full_name').optional().isLength({ min: 2 }).withMessage('Full name must be at least 2 characters'),
    body('first_name').optional().isLength({ min: 1 }).withMessage('First name is required'),
    body('last_name').optional().isLength({ min: 1 }).withMessage('Last name is required'),
    body('department').optional().isString(),
    body('phone').optional().isString()
  ],
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw createError('Validation failed', 400, 'VALIDATION_ERROR', errors.array());
    }

    const { full_name, first_name, last_name, department, phone } = req.body;

    // Build update query
    const updates: string[] = [];
    const values: any[] = [req.user!.id];
    let paramCount = 2;

    if (full_name) {
      updates.push(`full_name = $${paramCount++}`);
      values.push(full_name);
    }

    if (first_name) {
      updates.push(`first_name = $${paramCount++}`);
      values.push(first_name);
    }

    if (last_name) {
      updates.push(`last_name = $${paramCount++}`);
      values.push(last_name);
    }

    if (department !== undefined) {
      updates.push(`department = $${paramCount++}`);
      values.push(department);
    }

    if (phone !== undefined) {
      updates.push(`phone = $${paramCount++}`);
      values.push(phone);
    }

    // If no updates, return current profile
    if (updates.length === 0) {
      const userResult = await dbQuery('SELECT * FROM profiles WHERE id = $1', [req.user!.id]);
      return res.json({
        message: 'No updates provided',
        user: userResult.rows[0]
      });
    }

    // Update profile
    const result = await dbQuery(`
      UPDATE profiles 
      SET ${updates.join(', ')}, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `, values);

    // Get tenant information
    const tenantResult = await dbQuery(
      'SELECT name, corporate_email_domain, tenant_prefix, next_employee_sequence FROM tenants WHERE id = $1',
      [result.rows[0].tenant_id]
    );
    const tenant = tenantResult.rows[0] || {};

    // Get user permissions
    const permissionsResult = await dbQuery(
      'SELECT * FROM get_user_permissions($1)',
      [req.user!.id]
    );

    // Return updated user
    return res.json({
      message: 'Profile updated successfully',
      user: {
        ...result.rows[0],
        tenant_name: tenant.name,
        corporate_email_domain: tenant.corporate_email_domain,
        tenant_prefix: tenant.tenant_prefix,
        next_employee_sequence: tenant.next_employee_sequence,
        permissions: permissionsResult.rows
      }
    });
  })
);


// Change password
authenticatedRouter.put('/change-password', [
  body('current_password').isLength({ min: 8 }).withMessage('Current password is required'),
  body('new_password').isLength({ min: 8 }).withMessage('New password must be at least 8 characters')
], asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw createError('Validation failed', 400, 'VALIDATION_ERROR', errors.array());
  }

  const { current_password, new_password } = req.body;

  // Get current password hash
  const userResult = await dbQuery(
    'SELECT password_hash FROM profiles WHERE id = $1',
    [req.user!.id]
  );

  if (userResult.rows.length === 0) {
    throw createError('User not found', 404, 'USER_NOT_FOUND');
  }

  const user = userResult.rows[0];

  // Verify current password
  const isPasswordValid = await bcrypt.compare(current_password, user.password_hash);
  if (!isPasswordValid) {
    throw createError('Current password is incorrect', 401, 'INVALID_PASSWORD');
  }

  // Hash new password
  const hashedPassword = await bcrypt.hash(new_password, parseInt(process.env.BCRYPT_ROUNDS || '12'));

  // Update password
  await dbQuery(
    'UPDATE profiles SET password_hash = $1, updated_at = NOW() WHERE id = $2',
    [hashedPassword, req.user!.id]
  );

  res.json({
    message: 'Password changed successfully'
  });
}));

// Logout
authenticatedRouter.post('/logout', asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  // Log the logout event
  await dbQuery(`
    INSERT INTO audit_logs (
      user_id, tenant_id, action, table_name, new_values, compliance_flags
    ) VALUES ($1, $2, 'logout', 'auth', $3, $4)
  `, [
    req.user!.id,
    req.user!.tenant_id,
    JSON.stringify({ ip: req.ip, user_agent: req.get('User-Agent') }),
    ['SECURITY', 'FIPS_140', 'FICAM']
  ]);

  res.json({
    message: 'Logout successful'
  });
}));

// MFA routes
authenticatedRouter.post('/mfa/initiate', asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  // Generate MFA secret
  const secret = speakeasy.generateSecret({
    name: `SecureGov VMS:${req.user!.email}`,
    issuer: 'SecureGov VMS'
  });

  // Generate QR code
  const qrCodeUrl = await qrcode.toDataURL(secret.otpauth_url!);

  res.json({
    message: 'MFA setup initiated',
    secret: secret.base32,
    qrCodeUrl
  });
}));

authenticatedRouter.post('/mfa/verify', [
  body('secret').isString().withMessage('Secret is required'),
  body('code').isLength({ min: 6, max: 6 }).isNumeric().withMessage('Valid 6-digit code is required')
], asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw createError('Validation failed', 400, 'VALIDATION_ERROR', errors.array());
  }

  const { secret, code } = req.body;

  // Verify MFA code
  const verified = speakeasy.totp.verify({
    secret,
    encoding: 'base32',
    token: code,
    window: 2 // Allow for 2 time steps before and after the current time
  });

  if (!verified) {
    throw createError('Invalid MFA code', 401, 'INVALID_MFA_CODE');
  }

  // Store MFA secret and enable MFA
  await dbQuery(
    'UPDATE profiles SET mfa_secret = $1, mfa_enabled = true, updated_at = NOW() WHERE id = $2',
    [secret, req.user!.id]
  );

  // Log MFA enabled event
  await dbQuery(`
    INSERT INTO audit_logs (
      user_id, tenant_id, action, table_name, new_values, compliance_flags
    ) VALUES ($1, $2, 'mfa_enabled', 'auth', $3, $4)
  `, [
    req.user!.id,
    req.user!.tenant_id,
    JSON.stringify({ ip: req.ip, user_agent: req.get('User-Agent') }),
    ['SECURITY', 'FIPS_140', 'FICAM']
  ]);

  // Get updated user profile
  const userResult = await dbQuery(`
    SELECT p.*, t.name as tenant_name, t.corporate_email_domain, t.tenant_prefix, t.next_employee_sequence
    FROM profiles p
    JOIN tenants t ON p.tenant_id = t.id
    WHERE p.id = $1
  `, [req.user!.id]);
  
  const user = userResult.rows[0];
  
  // Get user permissions
  const permissionsResult = await dbQuery(
    'SELECT * FROM get_user_permissions($1)',
    [req.user!.id]
  );
  
  // Add permissions to user object
  user.permissions = permissionsResult.rows;

  res.json({
    message: 'MFA enabled successfully',
    user
  });
}));

authenticatedRouter.post('/mfa/disable', asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  // Disable MFA
  await dbQuery(
    'UPDATE profiles SET mfa_secret = NULL, mfa_enabled = false, updated_at = NOW() WHERE id = $1',
    [req.user!.id]
  );

  // Log MFA disabled event
  await dbQuery(`
    INSERT INTO audit_logs (
      user_id, tenant_id, action, table_name, new_values, compliance_flags
    ) VALUES ($1, $2, 'mfa_disabled', 'auth', $3, $4)
  `, [
    req.user!.id,
    req.user!.tenant_id,
    JSON.stringify({ ip: req.ip, user_agent: req.get('User-Agent') }),
    ['SECURITY', 'FIPS_140', 'FICAM']
  ]);

  // Get updated user profile
  const userResult = await dbQuery(`
    SELECT p.*, t.name as tenant_name, t.corporate_email_domain, t.tenant_prefix, t.next_employee_sequence
    FROM profiles p
    JOIN tenants t ON p.tenant_id = t.id
    WHERE p.id = $1
  `, [req.user!.id]);
  
  const user = userResult.rows[0];
  
  // Get user permissions
  const permissionsResult = await dbQuery(
    'SELECT * FROM get_user_permissions($1)',
    [req.user!.id]
  );
  
  // Add permissions to user object
  user.permissions = permissionsResult.rows;

  res.json({
    message: 'MFA disabled successfully',
    user
  });
}));

// Admin routes for user management
authenticatedRouter.get('/users', requireAdmin(), [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('search').optional().isString(),
  query('role').optional().isString(),
  query('is_active').optional().isBoolean()
], asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw createError('Validation failed', 400, 'VALIDATION_ERROR', errors.array());
  }

  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;
    const search = req.query.search as string;
    const role = req.query.role as string;
    const isActive = req.query.is_active !== undefined ? req.query.is_active === 'true' : undefined;

    // Build query
    const queryParams: any[] = [];
    let paramCount = 1;
    
    let queryText1 = `
      SELECT p.id, p.email, p.tenant_id, p.role, p.role_id, p.full_name, p.first_name, p.last_name, 
             p.department, p.phone, p.employee_number, p.security_clearance, p.is_active, 
             p.mfa_enabled, p.last_login, p.created_at, p.updated_at,
             t.name as tenant_name, t.corporate_email_domain, t.tenant_prefix,
             COUNT(*) OVER() as total_count
      FROM profiles p
      JOIN tenants t ON p.tenant_id = t.id
      WHERE 1=1
    `;

    // Add search filter
    if (search) {
      queryText1 += ` AND (
        p.full_name ILIKE $${paramCount} OR 
        p.email ILIKE $${paramCount} OR 
        p.department ILIKE $${paramCount}
      )`;
      queryParams.push(`%${search}%`);
      paramCount++;
    }

    // Add role filter
    if (role) {
      queryText1 += ` AND p.role = $${paramCount}`;
      queryParams.push(role);
      paramCount++;
    }

    // Add is_active filter
    if (isActive !== undefined) {
      queryText1 += ` AND p.is_active = $${paramCount}`;
      queryParams.push(isActive);
      paramCount++;
    }

    // Add tenant_id filter for non-super_admin users
    if (req.user!.role !== 'super_admin') {
      queryText1 += ` AND p.tenant_id = $${paramCount}`;
      queryParams.push(req.user!.tenant_id);
      paramCount++;
    }

    // Add pagination
    queryText1 += ` ORDER BY p.created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    queryParams.push(limit, offset);

    // Execute query
    const result = await dbQuery(queryText1, queryParams);
    
    // Get tenant info for employee number generation
    let tenantInfo = null;
    if (req.user!.role === 'admin' || req.user!.role === 'super_admin') {
      const tenantInfoResult = await dbQuery(
        'SELECT tenant_prefix, next_employee_sequence FROM tenants WHERE id = $1',
        [req.user!.tenant_id]
      );
      
      if (tenantInfoResult.rows.length > 0) {
        tenantInfo = {
          tenant_prefix: tenantInfoResult.rows[0].tenant_prefix,
          next_employee_sequence: tenantInfoResult.rows[0].next_employee_sequence
        };
      }
    }

    // Calculate pagination info
    const totalCount = result.rows.length > 0 ? parseInt(result.rows[0].total_count) : 0;
    const totalPages = Math.ceil(totalCount / limit);

    return res.json({
      users: result.rows.map(row => {
        const { total_count, ...user } = row;
        return user;
      }),
      tenant_info: tenantInfo,
      pagination: {
        page,
        limit,
        total: totalCount,
        pages: totalPages
      }
    });
  } catch (error: any) {
    throw createError(error.message || 'Failed to get users', 500, 'USER_LIST_ERROR');
  }
}));

// Get user by ID
authenticatedRouter.get('/users/:id', requireAdmin(), asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const { id } = req.params;

  // Build query
  const queryParams: any[] = [id];
  let paramCount = 2;
  
  let queryText2 = `
    SELECT p.id, p.email, p.tenant_id, p.role, p.role_id, p.full_name, p.first_name, p.last_name, 
           p.department, p.phone, p.employee_number, p.security_clearance, p.is_active, 
           p.mfa_enabled, p.last_login, p.created_at, p.updated_at,
           t.name as tenant_name, t.corporate_email_domain, t.tenant_prefix
    FROM profiles p
    JOIN tenants t ON p.tenant_id = t.id
    WHERE p.id = $1
  `;

  // Add tenant_id filter for non-super_admin users
  if (req.user!.role !== 'super_admin') {
    queryText2 += ` AND p.tenant_id = $${paramCount}`;
    queryParams.push(req.user!.tenant_id);
    paramCount++;
  }

  // Execute query
  const result = await dbQuery(queryText2, queryParams);

  if (result.rows.length === 0) {
    throw createError('User not found', 404, 'USER_NOT_FOUND');
  }

  // Get user permissions
  const permissionsResult = await dbQuery(
    'SELECT * FROM get_user_permissions($1)',
    [id]
  );

  // Add permissions to user object
  const user = {
    ...result.rows[0],
    permissions: permissionsResult.rows
  };

  res.json({
    user
  });
}));

// Update user by ID
authenticatedRouter.put('/admin/users/:id', requireAdmin(), [
  body('full_name').optional().isLength({ min: 2 }).withMessage('Full name must be at least 2 characters'),
  body('first_name').optional().isLength({ min: 1 }).withMessage('First name is required'),
  body('last_name').optional().isLength({ min: 1 }).withMessage('Last name is required'),
  body('role').optional().isIn(['admin', 'security', 'reception', 'host', 'approver', 'super_admin']).withMessage('Invalid role'),
  body('role_id').optional().isUUID().withMessage('Invalid role ID'),
  body('department').optional().isString(),
  body('phone').optional().isString(),
  body('employee_number').optional().isString(),
  body('security_clearance').optional().isString(),
  body('is_active').optional().isBoolean()
], asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw createError('Validation failed', 400, 'VALIDATION_ERROR', errors.array());
  }

  const { id } = req.params;
  const updates = req.body;

  // Check if user exists and belongs to the same tenant (for non-super_admin)
  const userCheckQuery = req.user!.role === 'super_admin'
    ? 'SELECT id, tenant_id FROM profiles WHERE id = $1'
    : 'SELECT id, tenant_id FROM profiles WHERE id = $1 AND tenant_id = $2';
  
  const userCheckParams = req.user!.role === 'super_admin'
    ? [id]
    : [id, req.user!.tenant_id];
  
  const userCheck = await dbQuery(userCheckQuery, userCheckParams);
  
  if (userCheck.rows.length === 0) {
    throw createError('User not found', 404, 'USER_NOT_FOUND');
  }

  // Build update query
  const updateFields = Object.keys(updates).filter(key => 
    updates[key] !== undefined && 
    key !== 'password' && 
    key !== 'password_hash' && 
    key !== 'tenant_id'
  );
  
  if (updateFields.length === 0) {
    throw createError('No updates provided', 400, 'NO_UPDATES');
  }

  // Special handling for full_name, first_name, and last_name
  if (updates.full_name && (!updates.first_name || !updates.last_name)) {
    const nameParts = updates.full_name.split(' ');
    if (!updates.first_name) {
      updates.first_name = nameParts[0];
      updateFields.push('first_name');
    }
    if (!updates.last_name) {
      updates.last_name = nameParts.slice(1).join(' ');
      updateFields.push('last_name');
    }
  }

  // If role is updated, also update role_id
  if (updates.role && !updates.role_id) {
    // Get role_id for the specified role
    const roleResult = await dbQuery(
      'SELECT id FROM roles WHERE name = $1 AND tenant_id = $2',
      [updates.role, userCheck.rows[0].tenant_id]
    );
    
    if (roleResult.rows.length > 0) {
      updates.role_id = roleResult.rows[0].id;
      updateFields.push('role_id');
    }
  }

  const setClause = updateFields.map((field, index) => `${field} = $${index + 2}`).join(', ');
  const values = [id, ...updateFields.map(field => updates[field])];

  // Update user
  const result = await dbQuery(`
    UPDATE profiles 
    SET ${setClause}, updated_at = NOW()
    WHERE id = $1
    RETURNING id, email, tenant_id, role, role_id, full_name, first_name, last_name, 
              department, phone, employee_number, security_clearance, is_active, 
              mfa_enabled, last_login, created_at, updated_at
  `, values);

  // Get tenant information
  const tenantResult = await dbQuery(
    'SELECT name, corporate_email_domain, tenant_prefix, next_employee_sequence FROM tenants WHERE id = $1',
    [result.rows[0].tenant_id]
  );
  
  const tenant = tenantResult.rows[0] || {};
  
  // Get user permissions
  const permissionsResult = await dbQuery(
    'SELECT * FROM get_user_permissions($1)',
    [id]
  );

  // Return updated user
  res.json({
    message: 'User updated successfully',
    user: {
      ...result.rows[0],
      tenant_name: tenant.name,
      corporate_email_domain: tenant.corporate_email_domain,
      tenant_prefix: tenant.tenant_prefix,
      next_employee_sequence: tenant.next_employee_sequence,
      permissions: permissionsResult.rows
    }
  });
}));

// Generate new employee number
authenticatedRouter.post('/admin/users/:id/generate-employee-number', requireAdmin(), asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const { id } = req.params;

  // Check if user exists and belongs to the same tenant (for non-super_admin)
  const userCheckQuery = req.user!.role === 'super_admin'
    ? 'SELECT id, tenant_id FROM profiles WHERE id = $1'
    : 'SELECT id, tenant_id FROM profiles WHERE id = $1 AND tenant_id = $2';
  
  const userCheckParams = req.user!.role === 'super_admin'
    ? [id]
    : [id, req.user!.tenant_id];
  
  const userCheck = await dbQuery(userCheckQuery, userCheckParams);
  
  if (userCheck.rows.length === 0) {
    throw createError('User not found', 404, 'USER_NOT_FOUND');
  }

  // Generate new employee number
  const result = await transaction(async (client) => {
    // Get tenant prefix and next sequence
    const tenantInfoResult = await client.query(
      'SELECT tenant_prefix, next_employee_sequence FROM tenants WHERE id = $1 FOR UPDATE',
      [userCheck.rows[0].tenant_id]
    );
    
    const { tenant_prefix, next_employee_sequence } = tenantInfoResult.rows[0];
    const employeeNumber = `${tenant_prefix}${next_employee_sequence.toString().padStart(6, '0')}`;
    
    // Increment sequence
    await client.query(
      'UPDATE tenants SET next_employee_sequence = next_employee_sequence + 1 WHERE id = $1',
      [userCheck.rows[0].tenant_id]
    );
    
    // Update user
    const userResult = await client.query(`
      UPDATE profiles 
      SET employee_number = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING id, email, tenant_id, role, role_id, full_name, first_name, last_name, 
                department, phone, employee_number, security_clearance, is_active, 
                mfa_enabled, last_login, created_at, updated_at
    `, [employeeNumber, id]);
    
    return userResult.rows[0];
  });

  // Get tenant information
  const tenantResult = await dbQuery(
    'SELECT name, corporate_email_domain, tenant_prefix, next_employee_sequence FROM tenants WHERE id = $1',
    [result.tenant_id]
  );
  
  const tenant = tenantResult.rows[0] || {};

  // Return updated user
  res.json({
    message: 'Employee number generated successfully',
    user: {
      ...result,
      tenant_name: tenant.name,
      corporate_email_domain: tenant.corporate_email_domain,
      tenant_prefix: tenant.tenant_prefix,
      next_employee_sequence: tenant.next_employee_sequence
    }
  });
}));

// Reset user password
authenticatedRouter.post('/admin/users/:id/reset-password', requireAdmin(), asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const { id } = req.params;

  // Check if user exists and belongs to the same tenant (for non-super_admin)
  const userCheckQuery = req.user!.role === 'super_admin'
    ? 'SELECT id, tenant_id, email, full_name FROM profiles WHERE id = $1'
    : 'SELECT id, tenant_id, email, full_name FROM profiles WHERE id = $1 AND tenant_id = $2';
  
  const userCheckParams = req.user!.role === 'super_admin'
    ? [id]
    : [id, req.user!.tenant_id];
  
  const userCheck = await dbQuery(userCheckQuery, userCheckParams);
  
  if (userCheck.rows.length === 0) {
    throw createError('User not found', 404, 'USER_NOT_FOUND');
  }

  // Generate random password
  const newPassword = AuthService.generateRandomPassword(); // Corrected: Call static method on class

  // Hash password
  const hashedPassword = await bcrypt.hash(newPassword, parseInt(process.env.BCRYPT_ROUNDS || '12'));

  // Update user password
  await dbQuery(
    'UPDATE profiles SET password_hash = $1, updated_at = NOW() WHERE id = $2',
    [hashedPassword, id]
  );

  res.json({
    message: 'Password reset successfully',
    password: newPassword
  }); return;
}));

export default router;