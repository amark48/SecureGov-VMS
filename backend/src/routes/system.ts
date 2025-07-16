import express from 'express';
import { query as dbQuery } from '../config/database';
import { asyncHandler, createError } from '../middleware/errorHandler';
import { AuthenticatedRequest, requireAdmin } from '../middleware/auth';
import os from 'os';

const router = express.Router();

// All system routes require super_admin role
router.use((req: AuthenticatedRequest, res: express.Response, next: express.NextFunction) => {
  if (req.user?.role !== 'super_admin') {
    res.status(403).json({
      error: 'Access denied',
      code: 'ACCESS_DENIED',
      message: 'Only super administrators can access system endpoints'
    });
    return; // Explicitly return to satisfy TypeScript
  }
  next();
});

// Get system health
router.get('/health', asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  // Check database connection
  const dbResult = await dbQuery('SELECT NOW() as time');
  
  // Get system information
  const systemInfo = {
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    cpu: os.cpus(),
    loadavg: os.loadavg(),
    platform: process.platform,
    arch: process.arch,
    nodejs: process.version,
    timestamp: new Date().toISOString()
  };
  
  // Get database statistics
  const dbStats = await dbQuery(`
    SELECT 
      (SELECT COUNT(*) FROM tenants) as tenant_count,
      (SELECT COUNT(*) FROM profiles) as user_count,
      (SELECT COUNT(*) FROM visits) as visit_count,
      (SELECT COUNT(*) FROM visitors) as visitor_count,
      (SELECT COUNT(*) FROM audit_logs) as audit_log_count
  `);
  
  res.json({
    status: 'healthy',
    database: {
      connected: true,
      time: dbResult.rows[0].time
    },
    system: systemInfo,
    stats: dbStats.rows[0]
  });
}));

// Get system statistics
router.get('/stats', asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  // Get tenant statistics
  const tenantStats = await dbQuery(`
    SELECT 
      COUNT(*) as total_tenants,
      COUNT(*) FILTER (WHERE is_active = true) as active_tenants
    FROM tenants
  `);

  // Get user statistics
  const userStats = await dbQuery(`
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
  const facilityStats = await dbQuery(`
    SELECT 
      COUNT(*) as total_facilities,
      COUNT(*) FILTER (WHERE is_active = true) as active_facilities
    FROM facilities
  `);

  // Get visitor statistics
  const visitorStats = await dbQuery(`
    SELECT 
      COUNT(*) as total_visitors,
      COUNT(*) FILTER (WHERE is_blacklisted = true) as blacklisted_visitors
    FROM visitors
  `);

  // Get visit statistics
  const visitStats = await dbQuery(`
    SELECT 
      COUNT(*) as total_visits,
      COUNT(*) FILTER (WHERE status = 'pre_registered') as pre_registered_visits,
      COUNT(*) FILTER (WHERE status = 'checked_in') as checked_in_visits,
      COUNT(*) FILTER (WHERE status = 'checked_out') as checked_out_visits,
      COUNT(*) FILTER (WHERE scheduled_date = CURRENT_DATE) as today_visits
    FROM visits
  `);

  // Get audit statistics
  const auditStats = await dbQuery(`
    SELECT 
      COUNT(*) as total_logs,
      COUNT(*) FILTER (WHERE timestamp >= CURRENT_DATE) as today_logs
    FROM audit_logs
  `);

  // Get daily activity for the past 30 days
  const dailyActivity = await dbQuery(`
    SELECT 
      DATE(timestamp) as date,
      COUNT(*) as count
    FROM audit_logs
    WHERE timestamp >= CURRENT_DATE - INTERVAL '30 days'
    GROUP BY DATE(timestamp)
    ORDER BY date DESC
  `);

  res.json({
    tenant_stats: tenantStats.rows[0],
    user_stats: userStats.rows[0],
    facility_stats: facilityStats.rows[0],
    visitor_stats: visitorStats.rows[0],
    visit_stats: visitStats.rows[0],
    audit_stats: auditStats.rows[0],
    daily_activity: dailyActivity.rows
  });
}));

// Get system activity
router.get('/activity', asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const limit = parseInt(req.query.limit as string) || 10;

  // Get recent audit logs
  const auditLogs = await dbQuery(`
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
router.get('/alerts', asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  // Get recent security alerts
  const securityAlerts = await dbQuery(`
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
router.get('/users', asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  // Get super admin users
  const users = await dbQuery(`
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
