import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { query, setSessionVariables } from '../config/database';
import { User } from '../types/auth';
import { createError } from './errorHandler';
import { authenticateAzureAdToken } from './azureAdAuth';

// Logger setup
const authMiddlewareLogger = (message: string, data?: any) => {
  console.log(`[AuthMiddleware] ${message}`, data ? data : '');
};

export interface AuthenticatedRequest extends Request {
  user?: User;
}

// Unified authentication middleware that tries Azure AD first, then local JWT
export const authenticateToken = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Skip authentication for OPTIONS requests
    if (req.method === 'OPTIONS') {
      authMiddlewareLogger('Skipping authentication for OPTIONS request');
      next();
      return;
    }

    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      authMiddlewareLogger('No token provided');
      res.status(401).json({
        error: 'Access token required',
        code: 'TOKEN_MISSING'
      });
      return;
    }

    // Try Azure AD authentication first if configured
    if (process.env.AZURE_AD_TENANT_ID && process.env.AZURE_AD_CLIENT_ID) {
      authMiddlewareLogger('Attempting Azure AD authentication');
      
      // Create a wrapper to capture if Azure AD auth succeeds
      let azureAdAuthSucceeded = false;
      
      await new Promise<void>((resolve) => {
        authenticateAzureAdToken(req, res, (error?: any) => {
          if (!error && req.user) {
            azureAdAuthSucceeded = true;
            authMiddlewareLogger('Azure AD authentication successful');
          } else {
            authMiddlewareLogger('Azure AD authentication failed or not applicable');
          }
          resolve();
        });
      });

      if (azureAdAuthSucceeded) {
        // Set session variables for RLS policies
        if (req.user) {
          authMiddlewareLogger('Setting session variables for Azure AD user', { 
            userId: req.user.id, 
            tenantId: req.user.tenant_id, 
            role: req.user.role 
          });
          await setSessionVariables(req.user.id, req.user.tenant_id, req.user.role);

          // ─────── NEW: Load user permissions for Azure AD user ───────
          try {
            const permissionsResult = await query(
              'SELECT * FROM get_user_permissions($1)',
              [req.user.id]
            );
            req.user.permissions = permissionsResult.rows.map(row => ({
              resource: row.resource,
              action: row.action
            }));
          } catch (permErr) {
            console.error('Failed to load user permissions for Azure AD user:', permErr);
            req.user.permissions = [];
          }
          // ────────────────────────────────────────────────────────────
        }
        next();
        return;
      }
    }

    // Fall back to local JWT authentication
    authMiddlewareLogger('Attempting local JWT authentication');
    await authenticateLocalToken(req, res, next);
  } catch (error) {
    authMiddlewareLogger('Authentication error', { error });
    res.status(500).json({
      error: 'Authentication failed',
      code: 'AUTH_ERROR'
    });
    return;
  }
};

// Local JWT authentication (renamed from original authenticateToken)
export const authenticateLocalToken = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    authMiddlewareLogger('Authenticating local JWT token', { hasToken: !!token });

    if (!token) {
      authMiddlewareLogger('No token provided');
      res.status(401).json({
        error: 'Access token required',
        code: 'TOKEN_MISSING'
      });
      return;
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    authMiddlewareLogger('Local JWT token decoded', { userId: decoded.userId });
    
    // Verify user still exists and is active
    authMiddlewareLogger('Verifying user exists and is active', { userId: decoded.userId });
    const userResult = await query(
      `SELECT p.id, p.email, p.tenant_id, p.role, p.role_id, p.full_name, p.first_name, p.last_name, 
             p.department, p.phone, p.is_active, p.mfa_enabled, p.employee_number, 
             p.security_clearance, t.name as tenant_name, t.corporate_email_domain,
             t.tenant_prefix, p.created_at, p.updated_at
      FROM profiles p
      JOIN tenants t ON p.tenant_id = t.id
      WHERE p.id = $1`,
      [decoded.userId]
    );

    if (userResult.rows.length === 0) {
      authMiddlewareLogger('User not found', { userId: decoded.userId });
      res.status(401).json({
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
      return;
    }

    const user = userResult.rows[0];
    
    if (!user.is_active) {
      authMiddlewareLogger('Account deactivated', { userId: user.id });
      res.status(401).json({
        error: 'Account deactivated',
        code: 'ACCOUNT_DEACTIVATED'
      });
      return;
    }

    // Create a complete User object
    const userInfo: User = {
      id: user.id,
      email: user.email,
      tenant_id: user.tenant_id,
      tenant_name: user.tenant_name,
      corporate_email_domain: user.corporate_email_domain,
      tenant_prefix: user.tenant_prefix,
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
      auth_provider: 'local'
    };

    // Set session variables for RLS policies
    authMiddlewareLogger('Setting session variables for RLS', { 
      userId: user.id, 
      tenantId: user.tenant_id, 
      role: user.role 
    });
    await setSessionVariables(user.id, user.tenant_id, user.role);
    
    authMiddlewareLogger('Local JWT authentication successful', { userId: user.id });
    
    req.user = userInfo;

    // Load user permissions
    try {
      const permissionsResult = await query(
        'SELECT * FROM get_user_permissions($1)',
        [user.id]
      );
      
      req.user.permissions = permissionsResult.rows.map(row => ({
        resource: row.resource,
        action: row.action
      }));
      
    } catch (error) {
      console.error('Failed to load user permissions:', error);
      req.user.permissions = [];
    }

    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      authMiddlewareLogger('Invalid local JWT token', { error });
      res.status(401).json({
        error: 'Invalid token',
        code: 'TOKEN_INVALID'
      });
      return;
    }

    console.error('Local JWT authentication error:', error);
    authMiddlewareLogger('Local JWT authentication failed', { error });
    res.status(500).json({
      error: 'Authentication failed',
      code: 'AUTH_ERROR'
    });
    return;
  }
};

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
      authMiddlewareLogger('Super admin access granted');
      next();
      return;
    }

    if (!roles.includes(req.user.role)) {
      authMiddlewareLogger('Insufficient permissions', { 
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

    authMiddlewareLogger('Role check passed', { user_role: req.user.role });
    next();
  };
};

export const requireAnyRole = (roles: string[]) => requireRole(roles);
export const requireAdmin = () => requireRole(['admin', 'super_admin']);
export const requireSecurity = () => requireRole(['admin', 'security', 'super_admin']);
export const requireReception = () => requireRole(['admin', 'security', 'reception', 'super_admin']);
