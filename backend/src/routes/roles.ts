import express from 'express';
import { body, query as expressQuery, param, validationResult } from 'express-validator';
import { query, transaction } from '../config/database';
import { asyncHandler, createError } from '../middleware/errorHandler';
import { AuthenticatedRequest, requireAdmin, requireAnyRole } from '../middleware/auth';
import { Permission, Role, RolePermission } from '../types/role';

const router = express.Router();

// All role routes require admin role
router.use(requireAdmin());

// Get all permissions
router.get('/permissions/all', asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  try {
    const result = await query(`
      SELECT id, name, description, resource, action, created_at, updated_at
      FROM permissions
      ORDER BY resource, action
    `);

    res.json({
      permissions: result.rows
    });
  } catch (error) {
    console.error('Error fetching permissions:', error);
    throw createError('Failed to fetch permissions', 500);
  }
}));

// Get permissions for a specific role
router.get('/permissions/role/:roleName', asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const { roleName } = req.params;

  try {
    // Get permissions for the role
    const permissionsResult = await query(`
      SELECT p.name
      FROM permissions p
      JOIN role_permissions rp ON p.id = rp.permission_id
      JOIN roles r ON rp.role_id = r.id
      WHERE r.name = $1
    `, [roleName]);

    res.json({
      permissions: permissionsResult.rows.map(row => row.name)
    });
  } catch (error) {
    console.error('Error fetching role permissions:', error);
    throw createError('Failed to fetch role permissions', 500);
  }
}));

// Get permissions for a specific role by ID
router.get('/:id/permissions', [
  param('id').isUUID().withMessage('Valid role ID is required')
], asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw createError('Validation failed', 400, 'VALIDATION_ERROR');
  }

  const { id } = req.params;

  try {
    // Get permissions for the role
    const permissionsResult = await query(`
      SELECT p.name
      FROM permissions p
      JOIN role_permissions rp ON p.id = rp.permission_id
      WHERE rp.role_id = $1
    `, [id]);

    res.json({
      permissions: permissionsResult.rows.map(row => row.name)
    });
  } catch (error) {
    console.error('Error fetching role permissions:', error);
    throw createError('Failed to fetch role permissions', 500);
  }
}));

// Get all roles for the tenant
router.get('/', asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const roles = await query(`
    SELECT r.*, 
           COUNT(rp.permission_id) as permission_count
    FROM roles r
    LEFT JOIN role_permissions rp ON r.id = rp.role_id
    WHERE r.tenant_id = $1
    GROUP BY r.id
    ORDER BY r.name
  `, [req.user!.tenant_id]);

  res.json({
    roles: roles.rows
  });
}));

// Get role by ID with permissions
router.get('/:id', [
  param('id').isUUID().withMessage('Valid role ID is required')
], asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw createError('Validation failed', 400, 'VALIDATION_ERROR');
  }

  const { id } = req.params;

  // Get role details
  const roleResult = await query(`
    SELECT r.*
    FROM roles r
    WHERE r.id = $1 AND r.tenant_id = $2
  `, [id, req.user!.tenant_id]);

  if (roleResult.rows.length === 0) {
    throw createError('Role not found', 404, 'ROLE_NOT_FOUND');
  }

  const role = roleResult.rows[0];

  // Get permissions for this role
  const permissionsResult = await query(`
    SELECT p.*
    FROM permissions p
    JOIN role_permissions rp ON p.id = rp.permission_id
    WHERE rp.role_id = $1
    ORDER BY p.resource, p.action
  `, [id]);

  res.json({
    role: {
      ...role,
      permissions: permissionsResult.rows
    }
  });
}));

// Create new role
router.post('/', [
  body('name').isLength({ min: 1, max: 100 }).trim().withMessage('Name is required'),
  body('description').optional().isLength({ max: 500 }).trim(),
  body('permissions').optional().isArray().withMessage('Permissions must be an array of permission IDs')
], asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw createError('Validation failed', 400, 'VALIDATION_ERROR');
  }

  const { name, description, permissions } = req.body;

  await transaction(async (client) => {
    // Check if role with same name already exists
    const existingRole = await client.query(
      'SELECT id FROM roles WHERE name = $1 AND tenant_id = $2',
      [name, req.user!.tenant_id]
    );

    if (existingRole.rows.length > 0) {
      throw createError('Role with this name already exists', 409, 'ROLE_EXISTS');
    }

    // Create role
    const result = await client.query(`
      INSERT INTO roles (tenant_id, name, description, is_system)
      VALUES ($1, $2, $3, false)
      RETURNING *
    `, [req.user!.tenant_id, name, description]);

    const role = result.rows[0];

    // Assign permissions if provided
if (Array.isArray(permissions) && permissions.length > 0) {
  try {
    // Validate that each permission ID is a valid UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    
    const validPermissions: string[] = permissions.filter((id: unknown): id is string => {
      return typeof id === 'string' && uuidRegex.test(id);
    });

    if (validPermissions.length > 0) {
      // Use the database function to assign permissions
      await client.query(
        `SELECT * FROM assign_permissions_to_role_by_id($1, $2::uuid[])`,
        [role.id, validPermissions]
      );
    } else {
      console.warn('No valid permission IDs provided for role creation');
    }
  } catch (error) {
    console.error('Error assigning permissions during role creation:', error);
    // Continue with role creation even if permission assignment fails
  }
}


    // Get permissions for this role
    const permissionsResult = await client.query(`
      SELECT p.*
      FROM permissions p
      JOIN role_permissions rp ON p.id = rp.permission_id
      WHERE rp.role_id = $1
      ORDER BY p.resource, p.action
    `, [role.id]);

    // Log the role creation
    await client.query(`
      INSERT INTO audit_logs (
        user_id, tenant_id, action, table_name, record_id, new_values, compliance_flags
      ) VALUES ($1, $2, 'create', 'roles', $3, $4, $5)
    `, [
      req.user!.id,
      req.user!.tenant_id,
      role.id,
      JSON.stringify({
        name,
        description,
        permissions: permissionsResult.rows.map(p => p.name)
      }),
      ['ADMIN_ACTION', 'ROLE_MANAGEMENT']
    ]);

    res.status(201).json({
      message: 'Role created successfully',
      role: {
        ...role,
        permissions: permissionsResult.rows
      }
    });
  });
}));

// Update role
router.put('/:id', [
  param('id').isUUID().withMessage('Valid role ID is required'),
  body('name').optional().isLength({ min: 1, max: 100 }).trim(),
  body('description').optional().isLength({ max: 500 }).trim()
], asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw createError('Validation failed', 400, 'VALIDATION_ERROR');
  }

  const { id } = req.params;
  const { name, description } = req.body;

  // Check if role exists and belongs to tenant
  const roleCheck = await query(
    'SELECT id, is_system FROM roles WHERE id = $1 AND tenant_id = $2',
    [id, req.user!.tenant_id]
  );

  if (roleCheck.rows.length === 0) {
    throw createError('Role not found', 404, 'ROLE_NOT_FOUND');
  }

  // Prevent modification of system roles
  if (roleCheck.rows[0].is_system) {
    throw createError('System roles cannot be modified', 403, 'SYSTEM_ROLE_IMMUTABLE');
  }

  // Build update query
  const updates: string[] = [];
  const values: any[] = [id];
  let paramCount = 2;

  if (name !== undefined) {
    updates.push(`name = $${paramCount++}`);
    values.push(name);
  }

  if (description !== undefined) {
    updates.push(`description = $${paramCount++}`);
    values.push(description);
  }

  if (updates.length === 0) {
    throw createError('No updates provided', 400, 'NO_UPDATES');
  }

  updates.push(`updated_at = NOW()`);

  // Update role
  const result = await query(`
    UPDATE roles
    SET ${updates.join(', ')}
    WHERE id = $1
    RETURNING *
  `, values);

  // Get permissions for this role
  const permissionsResult = await query(`
    SELECT p.*
    FROM permissions p
    JOIN role_permissions rp ON p.id = rp.permission_id
    WHERE rp.role_id = $1
    ORDER BY p.resource, p.action
  `, [id]);

  // Log the role update
  await query(`
    INSERT INTO audit_logs (
      user_id, tenant_id, action, table_name, record_id, new_values, compliance_flags
    ) VALUES ($1, $2, 'update', 'roles', $3, $4, $5)
  `, [
    req.user!.id,
    req.user!.tenant_id,
    id,
    JSON.stringify({
      name,
      description,
      updated_by: req.user!.full_name
    }),
    ['ADMIN_ACTION', 'ROLE_MANAGEMENT']
  ]);

  res.json({
    message: 'Role updated successfully',
    role: {
      ...result.rows[0],
      permissions: permissionsResult.rows
    }
  });
}));

// Delete role
router.delete('/:id', [
  param('id').isUUID().withMessage('Valid role ID is required')
], asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw createError('Validation failed', 400, 'VALIDATION_ERROR');
  }

  const { id } = req.params;

  // Check if role exists and belongs to tenant
  const roleCheck = await query(
    'SELECT id, name, is_system FROM roles WHERE id = $1 AND tenant_id = $2',
    [id, req.user!.tenant_id]
  );

  if (roleCheck.rows.length === 0) {
    throw createError('Role not found', 404, 'ROLE_NOT_FOUND');
  }

  // Prevent deletion of system roles
  if (roleCheck.rows[0].is_system) {
    throw createError('System roles cannot be deleted', 403, 'SYSTEM_ROLE_IMMUTABLE');
  }

  // Check if any users are assigned to this role
  const userCheck = await query(
    'SELECT COUNT(*) as count FROM profiles WHERE role_id = $1',
    [id]
  );

  if (parseInt(userCheck.rows[0].count) > 0) {
    throw createError('Cannot delete role that is assigned to users', 400, 'ROLE_IN_USE');
  }

  // Delete role (will cascade to role_permissions)
  await query('DELETE FROM roles WHERE id = $1', [id]);

  // Log the role deletion
  await query(`
    INSERT INTO audit_logs (
      user_id, tenant_id, action, table_name, record_id, new_values, compliance_flags
    ) VALUES ($1, $2, 'delete', 'roles', $3, $4, $5)
  `, [
    req.user!.id,
    req.user!.tenant_id,
    id,
    JSON.stringify({
      name: roleCheck.rows[0].name,
      deleted_by: req.user!.full_name
    }),
    ['ADMIN_ACTION', 'ROLE_MANAGEMENT']
  ]);

  res.json({
    message: 'Role deleted successfully'
  });
}));

// Get all permissions
router.get('/permissions/all', asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const permissions = await query(`
    SELECT *
    FROM permissions
    ORDER BY resource, action
  `);

  res.json({
    permissions: permissions.rows
  });
}));

// Assign permissions to role
router.post('/:id/permissions', [
  param('id').isUUID().withMessage('Valid role ID is required')
], asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  console.log('Assigning permissions to role:', req.params.id, 'Permissions:', req.body.permissions);
  const { id } = req.params;
  const { permissions } = req.body;
  try {
    // Validate that each permission is a valid UUID
    const validPermissions = Array.isArray(permissions) ? 
      permissions.filter(id => {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        return uuidRegex.test(id);
      }) : [];
    
    if (validPermissions.length === 0) {
      // If no valid UUIDs, try to treat them as permission names
      const result = await query(`
        SELECT * FROM assign_permissions_to_role_by_name($1, $2)
      `, [id, permissions]);
    } else {
      // Use the database function to assign permissions by ID
      const result = await query(`
        SELECT * FROM assign_permissions_to_role_by_id($1, $2::uuid[])
      `, [id, validPermissions]);
    }
    
    // Get the updated role with permissions
    const roleResult = await query(`
      SELECT r.*
      FROM roles r
      WHERE r.id = $1
    `, [id]);
    
    if (roleResult.rows.length === 0) {
      throw createError('Role not found', 404, 'ROLE_NOT_FOUND');
    }
    
    // Get permissions for this role
    const permissionsResult = await query(`
      SELECT p.*
      FROM permissions p
      JOIN role_permissions rp ON p.id = rp.permission_id
      WHERE rp.role_id = $1
      ORDER BY p.resource, p.action
    `, [id]);
    
    // Log the permission update
    await query(`
      INSERT INTO audit_logs (
        user_id, tenant_id, action, table_name, record_id, new_values, compliance_flags
      ) VALUES ($1, $2, 'update', 'role_permissions', $3, $4, $5)
    `, [
      req.user!.id,
      req.user!.tenant_id,
      id,
      JSON.stringify({
        role_name: roleResult.rows[0].name,
        permissions: permissionsResult.rows.map(p => p.name),
        updated_by: req.user!.full_name
      }),
      ['ADMIN_ACTION', 'ROLE_MANAGEMENT']
    ]);

    res.json({
      message: 'Permissions updated successfully',
      role: {
        ...roleResult.rows[0],
        permissions: permissionsResult.rows
      }
    });
} catch (error) {
  console.error('Error assigning permissions:', error);

  if (error instanceof Error) {
    if (error.message.includes('Role with ID') && error.message.includes('does not exist')) {
      throw createError('Role not found', 404, 'ROLE_NOT_FOUND');
    }
  }

  throw error;
}

}));

export default router;