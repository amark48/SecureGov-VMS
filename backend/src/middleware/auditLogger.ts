import { Request, Response, NextFunction } from 'express';
import { query } from '../config/database';
import { AuthenticatedRequest } from './auth';

// Cache for default tenant ID to avoid repeated queries
let defaultTenantId: string | null = null;

export const auditLogger = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  // Skip audit logging for health checks and static files
  if (req.path === '/health' || req.path.startsWith('/uploads')) {
    next();
    return;
  }

  const originalSend = res.send;
  const startTime = Date.now();

  res.send = function(data) {
    const duration = Date.now() - startTime;
    
    // Log the request asynchronously
    setImmediate(async () => {
      try {
        await logAuditEntry(req, res, duration, data);
      } catch (error) {
        console.error('Audit logging failed:', error);
      }
    });

    return originalSend.call(this, data);
  };

  next();
};

const logAuditEntry = async (
  req: AuthenticatedRequest,
  res: Response,
  duration: number,
  responseData: any
): Promise<void> => {
  try {
    const action = getActionFromRequest(req);
    
    // Skip logging if action is null (e.g., for GET requests or unsupported methods)
    if (action === null) {
      return;
    }

    // Get tenant_id from user or fetch default tenant if not available
    // Explicitly type auditTenantId as string | null to resolve TS2322 error
    let auditTenantId: string | null = req.user?.tenant_id || null; 
    
    // If tenant_id is not available (e.g., during login), use default tenant
    if (!auditTenantId) {
      // Fetch default tenant ID if not already cached
      if (!defaultTenantId) {
        try {
          const result = await query('SELECT id FROM tenants WHERE name = $1', ['Default Tenant']);
          if (result.rows.length > 0) {
            defaultTenantId = result.rows[0].id;
          } else {
            console.error('Default tenant not found. Audit log cannot be created without a tenant_id.');
            return; // Cannot log without tenant_id
          }
        } catch (error) {
          console.error('Failed to fetch default tenant for audit logging:', error);
          return; // Cannot log without tenant_id
        }
      }
      
      auditTenantId = defaultTenantId;
    }

    // Ensure we have a tenant_id before proceeding to insert
    if (!auditTenantId) {
      console.error('Critical: auditTenantId is null after fallback logic. Audit log will not be created.');
      return;
    }

    const auditData = {
      user_id: req.user?.id || null,
      tenant_id: auditTenantId,
      action,
      table_name: getTableFromPath(req.path),
      record_id: getRecordIdFromPath(req.path),
      ip_address: req.ip || req.connection.remoteAddress,
      user_agent: req.get('User-Agent'),
      method: req.method,
      path: req.path,
      status_code: res.statusCode,
      duration,
      request_body: shouldLogBody(req) ? req.body : null,
      response_size: JSON.stringify(responseData).length,
      compliance_flags: getComplianceFlags(req.path, req.method)
    };

    await query(`
      INSERT INTO audit_logs (
        user_id, tenant_id, action, table_name, record_id, ip_address, 
        user_agent, new_values, compliance_flags, timestamp
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
    `, [
      auditData.user_id,
      auditData.tenant_id,
      auditData.action,
      auditData.table_name,
      auditData.record_id,
      auditData.ip_address,
      auditData.user_agent,
      JSON.stringify({
        method: auditData.method,
        path: auditData.path,
        status_code: auditData.status_code,
        duration: auditData.duration,
        request_body: auditData.request_body,
        response_size: auditData.response_size
      }),
      auditData.compliance_flags
    ]);
  } catch (error) {
    console.error('Failed to log audit entry:', error);
  }
};

const getActionFromRequest = (req: Request): string | null => {
  const method = req.method.toLowerCase();
  
  // Handle specific path-based actions first
  if (req.path.includes('/login')) return 'login';
  if (req.path.includes('/logout')) return 'logout';
  if (req.path.includes('/check-in')) return 'check_in';
  if (req.path.includes('/check-out')) return 'check_out';
  
  // Handle HTTP methods - only return valid enum values
  switch (method) {
    case 'post': return 'create';
    case 'put':
    case 'patch': return 'update';
    case 'delete': return 'delete';
    case 'get': 
      // Don't log GET requests as they are read operations
      // and 'read' is not in the audit_action enum
      return null;
    default: 
      // Don't log unknown methods
      return null;
  }
};

const getTableFromPath = (path: string): string => {
  if (path.includes('/visitors')) return 'visitors';
  if (path.includes('/visits')) return 'visits';
  if (path.includes('/facilities')) return 'facilities';
  if (path.includes('/security')) return 'security';
  if (path.includes('/auth')) return 'profiles';
  if (path.includes('/emergency')) return 'emergency_contacts';
  if (path.includes('/audit')) return 'audit_logs';
  return 'unknown';
};

const getRecordIdFromPath = (path: string): string | null => {
  const uuidRegex = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
  const match = path.match(uuidRegex);
  return match ? match[0] : null;
};

const shouldLogBody = (req: Request): boolean => {
  // Don't log sensitive data
  if (req.path.includes('/login') || req.path.includes('/register')) {
    return false;
  }
  
  // Only log body for POST, PUT, PATCH requests
  return ['POST', 'PUT', 'PATCH'].includes(req.method);
};

const getComplianceFlags = (path: string, method: string): string[] => {
  const flags: string[] = [];
  
  // FICAM compliance for authentication
  if (path.includes('/auth')) {
    flags.push('FICAM');
  }
  
  // HIPAA compliance for visitor data
  if (path.includes('/visitors') || path.includes('/visits')) {
    flags.push('HIPAA');
  }
  
  // FERPA compliance for educational visits
  if (path.includes('/visits') && method === 'POST') {
    flags.push('FERPA');
  }
  
  // FIPS 140 compliance for all authentication
  if (path.includes('/login') || path.includes('/logout')) {
    flags.push('FIPS_140');
  }
  
  return flags;
};