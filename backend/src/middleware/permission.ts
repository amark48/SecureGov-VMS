import { Request, Response, NextFunction } from 'express';
import { query } from '../config/database';
import { AuthenticatedRequest } from './auth';
import { createError } from './errorHandler';

// Logger setup
const permissionMiddlewareLogger = (message: string, data?: any) => {
  console.log(`[PermissionMiddleware] ${message}`, data ? data : '');
};

/**
 * Middleware to check if the user has the required permission
 * @param resource The resource being accessed (e.g., 'visitors', 'visits')
 * @param action The action being performed (e.g., 'read', 'create', 'update', 'delete')
 */
export const requirePermission = (resource: string, action: string) => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
      return;
    }
    
    // Super admins can access everything
    if (req.user.role === 'super_admin') {
      next();
      return;
    }

    try {
      // Check if user has the required permission
      const result = await query(
        'SELECT user_has_permission($1, $2, $3) as has_permission',
        [req.user.id, resource, action]
      );

      if (result.rows[0].has_permission) {
        next();
        return;
      }

      // If not, check if they have the permission through their role_id
      if (req.user.role_id) {
        const rolePermission = await query(`
          SELECT EXISTS (
            SELECT 1 
            FROM role_permissions rp
            JOIN permissions p ON rp.permission_id = p.id
            WHERE rp.role_id = $1
            AND p.resource = $2
            AND p.action = $3
          ) as has_permission
        `, [req.user.role_id, resource, action]);

        if (rolePermission.rows[0].has_permission) {
          next();
          return;
        }
      }

      // If we get here, the user doesn't have the required permission
      permissionMiddlewareLogger(`Insufficient permissions for ${req.user.email}: ${resource}:${action}`);
      
      res.status(403).json({
        error: 'Insufficient permissions',
        code: 'INSUFFICIENT_PERMISSIONS',
        required_permission: `${resource}:${action}`,
        user_role: req.user.role
      });
    } catch (error) {
      console.error('Permission check error:', error);
      throw createError('Permission check failed', 500, 'PERMISSION_CHECK_ERROR', {
        error: 'Permission check failed',
        code: 'PERMISSION_CHECK_ERROR'
      });
    }
  };
};

/**
 * Middleware to check if the user has any of the required permissions
 * @param permissions Array of permission objects with resource and action
 */
export const requireAnyPermission = (permissions: Array<{resource: string, action: string}>) => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
      return;
    }

    // Super admins can access everything
    if (req.user.role === 'super_admin') {
      next();
      return;
    }

    try {
      // Check each permission
      for (const { resource, action } of permissions) {
        const result = await query(
          'SELECT user_has_permission($1, $2, $3) as has_permission',
          [req.user.id, resource, action]
        );

        if (result.rows[0].has_permission) {
          next();
          return;
        }
      }

      // If we get here, the user doesn't have any of the required permissions
      permissionMiddlewareLogger(`Insufficient permissions for ${req.user.email}`);
      
      res.status(403).json({
        error: 'Insufficient permissions',
        code: 'INSUFFICIENT_PERMISSIONS',
        required_permissions: permissions.map(p => `${p.resource}:${p.action}`),
        user_role: req.user.role
      });
    } catch (error) {
      console.error('Permission check error:', error);
      throw createError('Permission check failed', 500, 'PERMISSION_CHECK_ERROR', {
        error: 'Permission check failed',
        code: 'PERMISSION_CHECK_ERROR'
      });
    }
  };
};

/**
 * Middleware to load user permissions into the request object
 */
export const loadUserPermissions = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  if (!req.user) {
    next();
    return;
  }

  try {
    // Get all permissions for the user
    const result = await query(
      'SELECT * FROM get_user_permissions($1)',
      [req.user.id]
    );

    // Add permissions to the user object
    req.user.permissions = result.rows.map(row => ({
      resource: row.resource,
      action: row.action
    }));

    next();
  } catch (error) {
    console.error('Failed to load user permissions:', error);
    // Continue without permissions
    req.user.permissions = [];
    next();
  }
};

/**
 * Middleware to check if the user has the required role
 * @param roles Array of allowed roles
 */
export const requireRole = (roles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
      return;
    }

    // Super admins can access everything
    if (req.user.role === 'super_admin') {
      permissionMiddlewareLogger('Super admin access granted');
      next();
      return;
    }

    if (!roles.includes(req.user.role)) {
      permissionMiddlewareLogger('Insufficient permissions', { 
        required_roles: roles, 
        user_role: req.user.role 
      });
      res.status(403).json({
        error: 'Insufficient permissions',
        code: 'INSUFFICIENT_PERMISSIONS',
        required_roles: roles,
        user_role: req.user.role
      });
      return;
    }

    permissionMiddlewareLogger('Role check passed', { user_role: req.user.role });
    next();
  };
};