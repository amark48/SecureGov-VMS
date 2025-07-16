import express from 'express';
import bcrypt from 'bcryptjs';
import { body, query as expressQuery, validationResult } from 'express-validator';
import { query, transaction } from '../config/database';
import { asyncHandler, createError } from '../middleware/errorHandler';
import { AuthenticatedRequest, requireAdmin } from '../middleware/auth';
import { notificationService } from '../services/notification';
import { AuthService } from '../services/auth';
import { IdentityProviderService } from '../services/identityProviderService';

const router = express.Router();

// All tenant routes require admin role
router.use(requireAdmin());

// Helper function to extract domain from email
const extractDomainFromEmail = (email: string): string => {
  const parts = email.split('@');
  return parts.length === 2 ? parts[1].toLowerCase() : '';
};

// Get all tenants
router.get('/', asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  // Super admins can see all tenants, regular admins only see their own
  let queryText = `
    SELECT t.*,
           COUNT(DISTINCT p.id) as user_count,
           COUNT(DISTINCT f.id) as facility_count,
           t.auth_strategy
    FROM tenants t
    LEFT JOIN profiles p ON t.id = p.tenant_id
    LEFT JOIN facilities f ON t.id = f.tenant_id
  `;
  
  const params: any[] = [];
  
  // If not super_admin, filter by tenant_id
  if (req.user!.role !== 'super_admin') {
    queryText += ` WHERE t.id = $1`;
    params.push(req.user!.tenant_id);
  }
  
  queryText += ` GROUP BY t.id ORDER BY t.name`;
  
  const result = await query(queryText, params);

  res.json({
    tenants: result.rows
  });
}));

// Get tenant by ID
router.get('/:id', asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  try {
    const { id } = req.params;

    // Super admins can see any tenant, regular admins only their own
    let queryText = `
      SELECT t.*,
             COUNT(DISTINCT p.id) as user_count,
             COUNT(DISTINCT f.id) as facility_count,
             t.auth_strategy
      FROM tenants t
      LEFT JOIN profiles p ON t.id = p.tenant_id
      LEFT JOIN facilities f ON t.id = f.tenant_id
      WHERE t.id = $1
    `;
    
    const params: any[] = [id];
    
    // If not super_admin, ensure tenant_id matches
    if (req.user!.role !== 'super_admin') {
      queryText += ` AND t.id = $2`;
      params.push(req.user!.tenant_id);
    }
    
    queryText += ` GROUP BY t.id`;

    const result = await query(queryText, params);

    if (result.rows.length === 0) {
      throw createError('Tenant not found', 404, 'TENANT_NOT_FOUND');
    }
    
    // Get identity providers for this tenant
    const identityProviders = await IdentityProviderService.getByTenantId(id);
    
    // Get tenant administrators
    const adminsResult = await query(`
      SELECT id, email, full_name, first_name, last_name, role, department, phone, employee_number, 
             security_clearance, is_active, mfa_enabled, last_login, created_at
      FROM profiles 
      WHERE tenant_id = $1 AND role = 'admin'
      ORDER BY created_at DESC
    `, [id]);

    res.json({
      tenant: {
        ...result.rows[0],
        identity_providers: identityProviders,
        admins: adminsResult.rows
      }
    });
  } catch (error) {
    console.error('Error fetching tenant:', error);
    throw error;
  }
}));

// Create new tenant
router.post('/', [
  body('name').isLength({ min: 1, max: 200 }).trim(),
  body('corporate_email_domain').optional().isLength({ min: 3, max: 100 }).trim(),
  body('is_active').optional().isBoolean(),
  body('tenant_prefix').optional().isLength({ min: 1, max: 10 }).trim(),
  body('admin_email').isEmail().normalizeEmail(),
  body('admin_first_name').isLength({ min: 1, max: 50 }).trim(),
  body('admin_last_name').isLength({ min: 1, max: 50 }).trim(),
  body('email_provider').optional().isIn(['smtp', 'sendgrid', 'mailgun']),
  body('email_config').optional().isObject(),
  body('sms_provider').optional().isIn(['none', 'twilio', 'vonage']),
  body('sms_config').optional().isObject(),
  body('push_provider').optional().isIn(['none', 'fcm', 'onesignal']),
  body('push_config').optional().isObject(),
  body('custom_departments').optional().isArray(),
  body('checkin_grace_period_hours').optional().isInt({ min: 0 }),
  body('early_checkin_minutes').optional().isInt({ min: 0 }),
  body('auto_checkout_time').optional().matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/),
  body('auto_checkout_enabled').optional().isBoolean(),
  body('auth_strategy').optional().isIn(['traditional', 'hybrid', 'external_only']),
  body('identity_providers').optional().isArray()
], asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw createError('Validation failed', 400, 'VALIDATION_ERROR', errors.array());
  }

  const { 
    name, 
    corporate_email_domain, 
    is_active = true,
    azure_ad_enabled = false,
    azure_ad_tenant_id,
    azure_ad_client_id,
    azure_ad_jwks_uri,
    azure_ad_issuer,
    azure_ad_audience,
    aws_federation_enabled = false,
    aws_region,
    aws_federated_role_arn_prefix,
    admin_email,
    admin_first_name,
    admin_last_name,
    tenant_prefix,
    custom_departments = [],
    auth_strategy = 'traditional',
    email_provider = 'smtp',
    email_config = {},
    sms_provider = 'none',
    sms_config = {},
    push_provider = 'none', 
    push_config = {},
    checkin_grace_period_hours = 24,
    early_checkin_minutes = 0,
    identity_providers = []
  } = req.body;

  // Check if tenant with same name already exists
  const existingTenant = await query('SELECT id FROM tenants WHERE name = $1', [name]);
  if (existingTenant.rows.length > 0) {
    throw createError('Tenant with this name already exists', 409, 'TENANT_EXISTS');
  }

  // If corporate_email_domain not provided, try to derive it from admin's email
  let domainToUse = corporate_email_domain;
  if (!domainToUse) {
    const adminResult = await query('SELECT email FROM profiles WHERE id = $1', [req.user!.id]);
    if (adminResult.rows.length > 0) {
      domainToUse = extractDomainFromEmail(adminResult.rows[0].email);
    }
  }

  // Generate tenant prefix if not provided
  const prefixToUse = tenant_prefix || name.replace(/[^a-zA-Z0-9]/g, '').substring(0, 3).toUpperCase();

  // Generate a random password for the admin
  const adminPassword = AuthService.generateRandomPassword();
  console.log('Generated admin password:', adminPassword);
  
  // Hash the password
  const hashedPassword = await bcrypt.hash(adminPassword, parseInt(process.env.BCRYPT_ROUNDS || '12'));
  
  // Create new tenant
  const result = await query(`
    INSERT INTO tenants (
      name, 
      corporate_email_domain, 
      is_active, 
      tenant_prefix, 
      next_employee_sequence,
      custom_departments,
      auth_strategy,
      email_provider,
      email_config,
      sms_provider,
      sms_config,
      push_provider, 
      push_config,
      checkin_grace_period_hours,
      early_checkin_minutes
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
    RETURNING *
  `, [
    name, 
    domainToUse, 
    is_active, 
    prefixToUse, 
    1,
    custom_departments,
    auth_strategy,
    email_provider,
    JSON.stringify(email_config),
    sms_provider,
    JSON.stringify(sms_config),
    push_provider,
    JSON.stringify(push_config),
    checkin_grace_period_hours,
    early_checkin_minutes
  ]);

  const tenant = result.rows[0];
  
  // Create identity providers if provided
  const createdProviders = [];
  for (const providerData of identity_providers) {
    try {
      const provider = await IdentityProviderService.create(tenant.id, providerData);
      createdProviders.push(provider);
    } catch (error) {
      console.error('Failed to create identity provider during tenant creation:', error);
      // Continue with tenant creation even if provider creation fails
    }
  }
  
  // Create tenant admin
  try {
    // Create the admin user
    // Use a direct SQL query with proper type casting
    const userResult = await query(`
      INSERT INTO profiles (
        email, 
        password_hash, 
        full_name, 
        first_name, 
        last_name, 
        role, 
        tenant_id, 
        is_active
      ) VALUES ($1, $2, $3, $4, $5, $6::user_role, $7, true)
      RETURNING id as user_id
    `, [
      admin_email, 
      hashedPassword, 
      `${admin_first_name} ${admin_last_name}`, 
      admin_first_name, 
      admin_last_name, 
      'admin', 
      tenant.id
    ]);
    
    const userId = userResult.rows[0].user_id;
    
    // Get the created user
    const createdUserResult = await query(`
      SELECT id, tenant_id, email, full_name, first_name, last_name, role, department, phone, employee_number, security_clearance, created_at
      FROM profiles WHERE id = $1
    `, [userId]);

    const adminUser = createdUserResult.rows[0];
    
    // Send notification to admin
    try {
      await notificationService.sendNotification({
        tenantId: tenant.id,
        event: 'account_created',
        type: 'email',
        recipientEmail: admin_email,
        variables: {
          user_name: `${admin_first_name} ${admin_last_name}`,
          user_email: admin_email,
          user_role: 'admin',
          temp_password: adminPassword,
          organization_name: name
        }
      });
    } catch (notificationError) {
      console.error('Failed to send admin account creation notification:', notificationError);
      // Continue even if notification fails
    }
    
  } catch (adminError) {
    console.error('Failed to create tenant admin:', adminError);
    // Continue even if admin creation fails, but log the error
    // In a production environment, you might want to roll back the transaction
    // if the admin creation fails, but for now we'll just log the error
  }
  
  res.status(201).json({
    message: 'Tenant created successfully',
    tenant: {
      ...tenant,
      identity_providers: createdProviders
    }
  });
}));

// Update tenant
router.put('/:id', [
  body('name').optional().isLength({ min: 1, max: 200 }).trim(),
  body('corporate_email_domain').optional().isLength({ min: 3, max: 100 }).trim(),
  body('is_active').optional().isBoolean(),
  body('tenant_prefix').optional().isLength({ min: 1, max: 10 }).trim(),
  body('custom_departments').optional().isArray(),
  body('email_provider').optional().isIn(['smtp', 'sendgrid', 'mailgun']),
  body('email_config').optional().isObject(),
  body('sms_provider').optional().isIn(['none', 'twilio', 'vonage']),
  body('sms_config').optional().isObject(),
  body('push_provider').optional().isIn(['none', 'fcm', 'onesignal']),
  body('push_config').optional().isObject(),
  body('early_checkin_minutes').optional().isInt({ min: 0 }),
  body('checkin_grace_period_hours').optional().isInt({ min: 0 }),
  body('auto_checkout_time').optional().matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/),
  body('auto_checkout_enabled').optional().isBoolean(),
  body('auth_strategy').optional().isIn(['traditional', 'hybrid', 'external_only']),
  body('identity_providers').optional().isArray()
], asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw createError('Validation failed', 400, 'VALIDATION_ERROR');
  }

  const { id } = req.params;
  const updates = req.body;

  // Extract identity_providers from updates if present
  const { identity_providers, ...tenantUpdates } = updates;

  // Build dynamic update query
  const updateFields = Object.keys(tenantUpdates).filter(key => tenantUpdates[key] !== undefined);
  if (updateFields.length === 0) {
    throw createError('No updates provided', 400, 'NO_UPDATES');
  }

  // Check if tenant exists
  const tenantCheck = await query('SELECT id FROM tenants WHERE id = $1', [id]);
  if (tenantCheck.rows.length === 0) {
    throw createError('Tenant not found', 404, 'TENANT_NOT_FOUND');
  }

  // Check if updating to an existing name
  if (updates.name) {
    const nameCheck = await query('SELECT id FROM tenants WHERE name = $1 AND id != $2', [updates.name, id]);
    if (nameCheck.rows.length > 0) {
      throw createError('Tenant with this name already exists', 409, 'TENANT_EXISTS');
    }
  }

  const setClause = updateFields.map((field, index) => {
    if (field === 'email_config' || field === 'sms_config' || field === 'push_config' || field === 'custom_departments' || field === 'badge_issuance_options') {
      return `${field} = $${index + 2}::jsonb`;
    }
    if (field === 'auto_checkout_time') {
      return `${field} = $${index + 2}::time`;
    }
    return `${field} = $${index + 2}`;
  }).join(', ');
  
  const values = [id, ...updateFields.map(field => {
    if (field === 'email_config' || field === 'sms_config' || field === 'push_config' || field === 'badge_issuance_options') {
      return JSON.stringify(tenantUpdates[field]);
    }
    return tenantUpdates[field];
  })];

  const result = await query(`
    UPDATE tenants 
    SET ${setClause}, updated_at = NOW()
    WHERE id = $1
    RETURNING *
  `, values);

  // Handle identity providers updates if provided
  let updatedProviders = [];
  if (identity_providers && Array.isArray(identity_providers)) {
    // Get current providers
    const currentProviders = await IdentityProviderService.getByTenantId(id);
    
    // Process each provider in the update
    for (const providerData of identity_providers) {
      try {
        if (providerData.id) {
          // Update existing provider
          const updatedProvider = await IdentityProviderService.update(id, providerData.id, providerData);
          updatedProviders.push(updatedProvider);
        } else {
          // Create new provider
          const newProvider = await IdentityProviderService.create(id, providerData);
          updatedProviders.push(newProvider);
        }
      } catch (error) {
        console.error('Failed to update identity provider:', error);
        // Continue with other providers
      }
    }
    
    // Deactivate providers not in the update list
    const updatedProviderIds = updatedProviders.map(p => p.id);
    for (const currentProvider of currentProviders) {
      if (!updatedProviderIds.includes(currentProvider.id)) {
        try {
          await IdentityProviderService.deactivate(id, currentProvider.id);
        } catch (error) {
          console.error('Failed to deactivate identity provider:', error);
        }
      }
    }
  } else {
    // If no identity_providers in update, get current ones
    updatedProviders = await IdentityProviderService.getByTenantId(id);
  }

  res.json({
    message: 'Tenant updated successfully',
    tenant: {
      ...result.rows[0],
      identity_providers: updatedProviders
    }
  });
}));

// Update notification providers
router.put('/:id/notification-providers', [
  body('email_provider').optional().isIn(['smtp', 'sendgrid', 'mailgun']),
  body('email_config').optional().isObject(),
  body('sms_provider').optional().isIn(['none', 'twilio', 'vonage']),
  body('sms_config').optional().isObject(),
  body('push_provider').optional().isIn(['none', 'fcm', 'onesignal']),
  body('push_config').optional().isObject()
], asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw createError('Validation failed', 400, 'VALIDATION_ERROR');
  }

  const { id } = req.params;
  const updates = req.body;

  // Build dynamic update query
  const updateFields = Object.keys(updates).filter(key => updates[key] !== undefined);
  if (updateFields.length === 0) {
    throw createError('No updates provided', 400, 'NO_UPDATES');
  }

  // Check if tenant exists and user has permission
  let queryText = 'SELECT id FROM tenants WHERE id = $1';
  const queryParams = [id];
  
  // If not super_admin, ensure tenant_id matches
  if (req.user!.role !== 'super_admin') {
    queryText += ' AND id = $2';
    queryParams.push(req.user!.tenant_id);
  }
  
  const tenantCheck = await query(queryText, queryParams);
  if (tenantCheck.rows.length === 0) {
    throw createError('Tenant not found or access denied', 404, 'TENANT_NOT_FOUND');
  }

  const setClause = updateFields.map((field, index) => {
    if (field === 'email_config' || field === 'sms_config' || field === 'push_config') {
      return `${field} = $${index + 2}::jsonb`;
    }
    return `${field} = $${index + 2}`;
  }).join(', ');
  
  const values = [id, ...updateFields.map(field => {
    if (field === 'email_config' || field === 'sms_config' || field === 'push_config') {
      return JSON.stringify(updates[field]);
    }
    return updates[field];
  })];

  const result = await query(`
    UPDATE tenants 
    SET ${setClause}, updated_at = NOW()
    WHERE id = $1
    RETURNING *
  `, values);

  res.json({
    message: 'Notification providers updated successfully',
    tenant: result.rows[0]
  });
}));

// Update custom departments
router.put('/:id/departments', [
  body('custom_departments').isArray()
], asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw createError('Validation failed', 400, 'VALIDATION_ERROR');
  }

  const { id } = req.params;
  const { custom_departments } = req.body;

  // Check if tenant exists and user has permission
  let queryText = 'SELECT id FROM tenants WHERE id = $1';
  const queryParams = [id];
  
  // If not super_admin, ensure tenant_id matches
  if (req.user!.role !== 'super_admin') {
    queryText += ' AND id = $2';
    queryParams.push(req.user!.tenant_id);
  }
  
  const tenantCheck = await query(queryText, queryParams);
  if (tenantCheck.rows.length === 0) {
    throw createError('Tenant not found or access denied', 404, 'TENANT_NOT_FOUND');
  }

  const result = await query(`
    UPDATE tenants 
    SET custom_departments = $2, updated_at = NOW()
    WHERE id = $1
    RETURNING *
  `, [id, custom_departments]);

  res.json({
    message: 'Custom departments updated successfully',
    tenant: result.rows[0]
  });
}));

// Deactivate tenant (soft delete)
router.put('/:id/deactivate', asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const { id } = req.params;

  // Prevent deactivation of default tenant
  const defaultTenantCheck = await query('SELECT id FROM tenants WHERE id = $1 AND name = $2', [id, 'Default Tenant']);
  if (defaultTenantCheck.rows.length > 0) {
    throw createError('Cannot deactivate the default tenant', 400, 'CANNOT_DEACTIVATE_DEFAULT');
  }

  const result = await query(`
    UPDATE tenants 
    SET is_active = false, updated_at = NOW()
    WHERE id = $1
    RETURNING id
  `, [id]);

  if (result.rows.length === 0) {
    throw createError('Tenant not found', 404, 'TENANT_NOT_FOUND');
  }

  res.json({
    message: 'Tenant deactivated successfully'
  });
}));

// Get tenant statistics
router.get('/:id/stats', asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const { id } = req.params;

  // Check if tenant exists
  const tenantCheck = await query('SELECT id FROM tenants WHERE id = $1', [id]);
  if (tenantCheck.rows.length === 0) {
    throw createError('Tenant not found', 404, 'TENANT_NOT_FOUND');
  }

  // Get user statistics
  const userStats = await query(`
    SELECT 
      COUNT(*) as total_users,
      COUNT(*) FILTER (WHERE is_active = true) as active_users,
      COUNT(*) FILTER (WHERE role = 'admin') as admin_users,
      COUNT(*) FILTER (WHERE role = 'security') as security_users,
      COUNT(*) FILTER (WHERE role = 'reception') as reception_users,
      COUNT(*) FILTER (WHERE role = 'host') as host_users
    FROM profiles
    WHERE tenant_id = $1
  `, [id]);

  // Get facility statistics
  const facilityStats = await query(`
    SELECT 
      COUNT(*) as total_facilities,
      COUNT(*) FILTER (WHERE is_active = true) as active_facilities,
      COUNT(*) FILTER (WHERE security_level = 'high' OR security_level = 'maximum') as high_security_facilities
    FROM facilities
    WHERE tenant_id = $1
  `, [id]);

  // Get visitor statistics
  const visitorStats = await query(`
    SELECT 
      COUNT(*) as total_visitors,
      COUNT(*) FILTER (WHERE is_blacklisted = true) as blacklisted_visitors,
      COUNT(*) FILTER (WHERE is_frequent_visitor = true) as frequent_visitors
    FROM visitors
    WHERE tenant_id = $1
  `, [id]);

  // Get visit statistics
  const visitStats = await query(`
    SELECT 
      COUNT(*) as total_visits,
      COUNT(*) FILTER (WHERE status = 'pre_registered') as pre_registered_visits,
      COUNT(*) FILTER (WHERE status = 'checked_in') as checked_in_visits,
      COUNT(*) FILTER (WHERE status = 'checked_out') as checked_out_visits,
      COUNT(*) FILTER (WHERE scheduled_date = CURRENT_DATE) as today_visits
    FROM visits
    WHERE tenant_id = $1
  `, [id]);

  // Get audit statistics
  const auditStats = await query(`
    SELECT 
      COUNT(*) as total_logs,
      COUNT(*) FILTER (WHERE timestamp >= CURRENT_DATE) as today_logs
    FROM audit_logs
    WHERE tenant_id = $1
  `, [id]);

  // Get daily activity for the past 30 days
  const dailyActivity = await query(`
    SELECT 
      DATE(timestamp) as date,
      COUNT(*) as count
    FROM audit_logs
    WHERE timestamp >= CURRENT_DATE - INTERVAL '30 days'
    AND tenant_id = $1
    GROUP BY DATE(timestamp)
    ORDER BY date DESC
  `, [id]);

  // Get tenant administrators
  const adminsResult = await query(`
    SELECT id, email, full_name, first_name, last_name, role, department, phone, employee_number, 
           security_clearance, is_active, mfa_enabled, last_login, created_at
    FROM profiles 
    WHERE tenant_id = $1 AND role = 'admin'
    ORDER BY created_at DESC
  `, [id]);
  
  const admins = adminsResult.rows;

  res.json({
    tenant_id: id,
    user_stats: userStats.rows[0],
    facility_stats: facilityStats.rows[0],
    visitor_stats: visitorStats.rows[0],
    visit_stats: visitStats.rows[0],
    audit_stats: auditStats.rows[0],
    daily_activity: dailyActivity.rows,
    admins: admins
  });
}));

// Get all tenants statistics (super admin only)
router.get('/stats/all', asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  // Only super_admin can access this endpoint
  if (req.user!.role !== 'super_admin') {
    throw createError('Access denied', 403, 'ACCESS_DENIED');
  }

  // Get all tenants
  const tenantsResult = await query(`
    SELECT id, name, is_active
    FROM tenants
    ORDER BY name
  `);

  const tenants = tenantsResult.rows;
  const stats = [];

  // Get stats for each tenant
  for (const tenant of tenants) {
    // Get user statistics
    const userStats = await query(`
      SELECT 
        COUNT(*) as total_users,
        COUNT(*) FILTER (WHERE is_active = true) as active_users
      FROM profiles
      WHERE tenant_id = $1
    `, [tenant.id]);

    // Get facility statistics
    const facilityStats = await query(`
      SELECT 
        COUNT(*) as total_facilities,
        COUNT(*) FILTER (WHERE is_active = true) as active_facilities
      FROM facilities
      WHERE tenant_id = $1
    `, [tenant.id]);

    // Get visitor statistics
    const visitorStats = await query(`
      SELECT 
        COUNT(*) as total_visitors
      FROM visitors
      WHERE tenant_id = $1
    `, [tenant.id]);

    // Get visit statistics
    const visitStats = await query(`
      SELECT 
        COUNT(*) as total_visits,
        COUNT(*) FILTER (WHERE status = 'checked_in') as active_visits
      FROM visits
      WHERE tenant_id = $1
    `, [tenant.id]);

    stats.push({
      tenant_id: tenant.id,
      tenant_name: tenant.name,
      is_active: tenant.is_active,
      users: parseInt(userStats.rows[0].total_users) || 0,
      active_users: parseInt(userStats.rows[0].active_users) || 0,
      facilities: parseInt(facilityStats.rows[0].total_facilities) || 0,
      active_facilities: parseInt(facilityStats.rows[0].active_facilities) || 0,
      visitors: parseInt(visitorStats.rows[0].total_visitors) || 0,
      visits: parseInt(visitStats.rows[0].total_visits) || 0,
      active_visits: parseInt(visitStats.rows[0].active_visits) || 0
    });
  }

  res.json({
    stats
  });
}));

// Get system statistics (super admin only)
router.get('/system/stats', asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  // Only super_admin can access this endpoint
  if (req.user!.role !== 'super_admin') {
    throw createError('Access denied', 403, 'ACCESS_DENIED');
  }

  // Get tenant statistics
  const tenantStats = await query(`
    SELECT 
      COUNT(*) as total_tenants,
      COUNT(*) FILTER (WHERE is_active = true) as active_tenants
    FROM tenants
  `);

  // Get user statistics
  const userStats = await query(`
    SELECT 
      COUNT(*) as total_users,
      COUNT(*) FILTER (WHERE is_active = true) as active_users,
      COUNT(*) FILTER (WHERE role = 'admin') as admin_users,
      COUNT(*) FILTER (WHERE role = 'security') as security_users,
      COUNT(*) FILTER (WHERE role = 'reception') as reception_users,
      COUNT(*) FILTER (WHERE role = 'host') as host_users,
      COUNT(*) FILTER (WHERE role = 'super_admin') as super_admin_users
    FROM profiles
  `);

  // Get facility statistics
  const facilityStats = await query(`
    SELECT 
      COUNT(*) as total_facilities,
      COUNT(*) FILTER (WHERE is_active = true) as active_facilities
    FROM facilities
  `);

  // Get visitor statistics
  const visitorStats = await query(`
    SELECT 
      COUNT(*) as total_visitors,
      COUNT(*) FILTER (WHERE is_blacklisted = true) as blacklisted_visitors
    FROM visitors
  `);

  // Get visit statistics
  const visitStats = await query(`
    SELECT 
      COUNT(*) as total_visits,
      COUNT(*) FILTER (WHERE status = 'pre_registered') as pre_registered_visits,
      COUNT(*) FILTER (WHERE status = 'checked_in') as checked_in_visits,
      COUNT(*) FILTER (WHERE status = 'checked_out') as checked_out_visits,
      COUNT(*) FILTER (WHERE scheduled_date = CURRENT_DATE) as today_visits
    FROM visits
  `);

  // Get audit statistics
  const auditStats = await query(`
    SELECT 
      COUNT(*) as total_logs,
      COUNT(*) FILTER (WHERE timestamp >= CURRENT_DATE) as today_logs
    FROM audit_logs
  `);

  res.json({
    tenant_stats: tenantStats.rows[0],
    user_stats: userStats.rows[0],
    facility_stats: facilityStats.rows[0],
    visitor_stats: visitorStats.rows[0],
    visit_stats: visitStats.rows[0],
    audit_stats: auditStats.rows[0]
  });
}));

// Get system activity
router.get('/system/activity', asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const limit = parseInt(req.query.limit as string) || 10;

  // Get recent audit logs
  const auditLogs = await query(`
    SELECT al.*, 
           p.full_name as user_name,
           p.email as user_email,
           t.name as tenant_name
    FROM audit_logs al
    LEFT JOIN profiles p ON al.user_id = p.id
    LEFT JOIN tenants t ON al.tenant_id = t.id
    ORDER BY al.timestamp DESC
    LIMIT $1
  `, [limit]);

  res.json({
    activities: auditLogs.rows
  });
}));

// Get system alerts
router.get('/system/alerts', asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  // Get recent security alerts
  const securityAlerts = await query(`
    SELECT sa.*, 
           f.name as facility_name,
           t.name as tenant_name
    FROM security_alerts sa
    LEFT JOIN facilities f ON sa.facility_id = f.id
    LEFT JOIN tenants t ON f.tenant_id = t.id
    WHERE sa.resolved = false
    ORDER BY sa.severity DESC, sa.created_at DESC
    LIMIT 10
  `);

  res.json({
    alerts: securityAlerts.rows
  });
}));

// Get system users (super admins)
router.get('/system/users', asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  // Get super admin users
  const users = await query(`
    SELECT id, email, full_name, role, is_active, last_login, created_at
    FROM profiles
    WHERE role = 'super_admin'
    ORDER BY created_at DESC
  `);

  res.json({
    users: users.rows
  });
}));

export default router;