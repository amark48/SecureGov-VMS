import express from 'express';
import { query as expressQuery, validationResult } from 'express-validator';
import { query } from '../config/database';
import { asyncHandler, createError } from '../middleware/errorHandler';
import { AuthenticatedRequest, requireSecurity } from '../middleware/auth';

const router = express.Router();

// All audit routes require security role or higher
router.use(requireSecurity());

// Get audit logs with filtering and pagination
router.get('/logs', [
  expressQuery('page').optional().isInt({ min: 1 }),
  expressQuery('limit').optional().isInt({ min: 1, max: 100 }),
  expressQuery('user_id').optional().isUUID(),
  expressQuery('action').optional().isIn(['create', 'update', 'delete', 'login', 'logout', 'check_in', 'check_out']),
  expressQuery('table_name').optional().isLength({ max: 100 }),
  expressQuery('start_date').optional().isISO8601(),
  expressQuery('end_date').optional().isISO8601(),
  expressQuery('compliance_flag').optional().isIn(['FICAM', 'FIPS_140', 'HIPAA', 'FERPA'])
], asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw createError('Validation failed', 400, 'VALIDATION_ERROR');
  }

  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 50;
  const offset = (page - 1) * limit;

  let queryText = `
    SELECT al.*, 
           p.full_name as user_name,
           p.email as user_email,
           COUNT(*) OVER() as total_count
    FROM audit_logs al
    LEFT JOIN profiles p ON al.user_id = p.id
    WHERE 1=1
  `;

  const queryParams: any[] = [];
  let paramCount = 1;

  // Apply filters
  if (req.query.user_id) {
    queryText += ` AND al.user_id = $${paramCount++}`;
    queryParams.push(req.query.user_id);
  }

  if (req.query.action) {
    queryText += ` AND al.action = $${paramCount++}`;
    queryParams.push(req.query.action);
  }

  if (req.query.table_name) {
    queryText += ` AND al.table_name = $${paramCount++}`;
    queryParams.push(req.query.table_name);
  }

  if (req.query.start_date) {
    queryText += ` AND al.timestamp >= $${paramCount++}`;
    queryParams.push(req.query.start_date);
  }

  if (req.query.end_date) {
    queryText += ` AND al.timestamp <= $${paramCount++}`;
    queryParams.push(req.query.end_date);
  }

  if (req.query.compliance_flag) {
    queryText += ` AND $${paramCount++} = ANY(al.compliance_flags)`;
    queryParams.push(req.query.compliance_flag);
  }

  // Add tenant_id filter if not super_admin
  if (req.user!.role !== 'super_admin') {
    queryText += ` AND al.tenant_id = $${paramCount++}`;
    queryParams.push(req.user!.tenant_id);
  }

  queryText += ` ORDER BY al.timestamp DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
  queryParams.push(limit, offset);

  const result = await query(queryText, queryParams);
  const totalCount = result.rows.length > 0 ? parseInt(result.rows[0].total_count) : 0;

  res.json({
    logs: result.rows.map(row => {
      const { total_count, ...log } = row;
      return log;
    }),
    pagination: {
      page,
      limit,
      total: totalCount,
      pages: Math.ceil(totalCount / limit)
    }
  });
}));

// Get audit log by ID
router.get('/logs/:id', asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const { id } = req.params;

  let queryText = `
    SELECT al.*, 
           p.full_name as user_name,
           p.email as user_email,
           p.role as user_role
    FROM audit_logs al
    LEFT JOIN profiles p ON al.user_id = p.id
    WHERE al.id = $1
  `;

  const queryParams = [id];

  // Add tenant_id filter if not super_admin
  if (req.user!.role !== 'super_admin') {
    queryText += ` AND al.tenant_id = $2`;
    queryParams.push(req.user!.tenant_id);
  }

  const result = await query(queryText, queryParams);

  if (result.rows.length === 0) {
    throw createError('Audit log not found', 404, 'LOG_NOT_FOUND');
  }

  res.json({
    log: result.rows[0]
  });
}));

// Get audit statistics
router.get('/stats', asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  let queryText = `
    SELECT 
      COUNT(*) as total_entries,
      COUNT(*) FILTER (WHERE timestamp >= CURRENT_DATE) as entries_today,
      COUNT(*) FILTER (WHERE timestamp >= CURRENT_DATE - INTERVAL '7 days') as entries_week,
      COUNT(*) FILTER (WHERE timestamp >= CURRENT_DATE - INTERVAL '30 days') as entries_month,
      COUNT(DISTINCT user_id) as unique_users,
      COUNT(*) FILTER (WHERE action = 'login') as login_events,
      COUNT(*) FILTER (WHERE action = 'logout') as logout_events,
      COUNT(*) FILTER (WHERE action = 'check_in') as checkin_events,
      COUNT(*) FILTER (WHERE action = 'check_out') as checkout_events
    FROM audit_logs
    WHERE timestamp >= CURRENT_DATE - INTERVAL '30 days'
  `;

  const queryParams: any[] = [];

  // Add tenant_id filter if not super_admin
  if (req.user!.role !== 'super_admin') {
    queryText += ` AND tenant_id = $1`;
    queryParams.push(req.user!.tenant_id);
  }

  const stats = await query(queryText, queryParams);

  let actionStatsQuery = `
    SELECT action, COUNT(*) as count
    FROM audit_logs
    WHERE timestamp >= CURRENT_DATE - INTERVAL '30 days'
  `;

  // Add tenant_id filter if not super_admin
  if (req.user!.role !== 'super_admin') {
    actionStatsQuery += ` AND tenant_id = $1`;
  }

  actionStatsQuery += ` GROUP BY action ORDER BY count DESC`;

  const actionStats = await query(actionStatsQuery, queryParams);

  let tableStatsQuery = `
    SELECT table_name, COUNT(*) as count
    FROM audit_logs
    WHERE timestamp >= CURRENT_DATE - INTERVAL '30 days'
  `;

  // Add tenant_id filter if not super_admin
  if (req.user!.role !== 'super_admin') {
    tableStatsQuery += ` AND tenant_id = $1`;
  }

  tableStatsQuery += ` GROUP BY table_name ORDER BY count DESC`;

  const tableStats = await query(tableStatsQuery, queryParams);

  let complianceStatsQuery = `
    SELECT 
      unnest(compliance_flags) as flag,
      COUNT(*) as count
    FROM audit_logs
    WHERE compliance_flags IS NOT NULL 
    AND timestamp >= CURRENT_DATE - INTERVAL '30 days'
  `;

  // Add tenant_id filter if not super_admin
  if (req.user!.role !== 'super_admin') {
    complianceStatsQuery += ` AND tenant_id = $1`;
  }

  complianceStatsQuery += ` GROUP BY flag ORDER BY count DESC`;

  const complianceStats = await query(complianceStatsQuery, queryParams);

  let userActivityStatsQuery = `
    SELECT 
      p.full_name,
      p.role,
      COUNT(*) as activity_count,
      MAX(al.timestamp) as last_activity
    FROM audit_logs al
    JOIN profiles p ON al.user_id = p.id
    WHERE al.timestamp >= CURRENT_DATE - INTERVAL '30 days'
  `;

  // Add tenant_id filter if not super_admin
  if (req.user!.role !== 'super_admin') {
    userActivityStatsQuery += ` AND al.tenant_id = $1`;
  }

  userActivityStatsQuery += ` GROUP BY p.id, p.full_name, p.role
    ORDER BY activity_count DESC
    LIMIT 10`;

  const userActivityStats = await query(userActivityStatsQuery, queryParams);

  let dailyActivityQuery = `
    SELECT 
      DATE(timestamp) as date,
      COUNT(*) as total_events,
      COUNT(DISTINCT user_id) as unique_users,
      COUNT(*) FILTER (WHERE action = 'login') as logins,
      COUNT(*) FILTER (WHERE action IN ('check_in', 'check_out')) as visitor_events
    FROM audit_logs
    WHERE timestamp >= CURRENT_DATE - INTERVAL '7 days'
  `;

  // Add tenant_id filter if not super_admin
  if (req.user!.role !== 'super_admin') {
    dailyActivityQuery += ` AND tenant_id = $1`;
  }

  dailyActivityQuery += ` GROUP BY DATE(timestamp) ORDER BY date DESC`;

  const dailyActivity = await query(dailyActivityQuery, queryParams);

  res.json({
    overview: stats.rows[0],
    actions: actionStats.rows,
    tables: tableStats.rows,
    compliance: complianceStats.rows,
    user_activity: userActivityStats.rows,
    daily_activity: dailyActivity.rows
  });
}));

// Export audit logs (CSV format)
router.get('/export', [
  expressQuery('start_date').optional().isISO8601(),
  expressQuery('end_date').optional().isISO8601(),
  expressQuery('format').optional().isIn(['csv', 'json']),
  expressQuery('compliance_flag').optional().isIn(['FICAM', 'FIPS_140', 'HIPAA', 'FERPA'])
], asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw createError('Validation failed', 400, 'VALIDATION_ERROR');
  }

  const format = req.query.format as string || 'csv';
  const startDate = req.query.start_date as string || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const endDate = req.query.end_date as string || new Date().toISOString();
  const complianceFlag = req.query.compliance_flag as string;

  let queryText = `
    SELECT al.*, 
           p.full_name as user_name,
           p.email as user_email,
           p.role as user_role
    FROM audit_logs al
    LEFT JOIN profiles p ON al.user_id = p.id
    WHERE al.timestamp >= $1 AND al.timestamp <= $2
  `;

  const queryParams: any[] = [startDate, endDate];
  let paramCount = 3;

  // Add compliance flag filter if provided
  if (complianceFlag) {
    queryText += ` AND $${paramCount++} = ANY(al.compliance_flags)`;
    queryParams.push(complianceFlag);
  }

  // Add tenant_id filter if not super_admin
  if (req.user!.role !== 'super_admin') {
    queryText += ` AND al.tenant_id = $${paramCount++}`;
    queryParams.push(req.user!.tenant_id);
  }

  queryText += ` ORDER BY al.timestamp DESC`;

  const result = await query(queryText, queryParams);

  if (format === 'json') {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="audit_logs_${startDate.split('T')[0]}_to_${endDate.split('T')[0]}.json"`);
    res.json(result.rows);
  } else {
    // CSV format
    const headers = [
      'Timestamp', 'User Name', 'User Email', 'User Role', 'Action', 
      'Table Name', 'Record ID', 'IP Address', 'User Agent', 'Compliance Flags'
    ];

    const csvRows = result.rows.map(row => [
      row.timestamp,
      row.user_name || 'System',
      row.user_email || '',
      row.user_role || '',
      row.action,
      row.table_name,
      row.record_id || '',
      row.ip_address || '',
      row.user_agent || '',
      (row.compliance_flags || []).join(';')
    ]);

    const csvContent = [headers, ...csvRows]
      .map(row => row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="audit_logs_${startDate.split('T')[0]}_to_${endDate.split('T')[0]}.csv"`);
    res.send(csvContent);
  }

  // Log the export activity
  await query(`
    INSERT INTO audit_logs (
      user_id, action, table_name, new_values, compliance_flags, tenant_id
    ) VALUES ($1, 'create', 'audit_export', $2, $3, $4)
  `, [
    req.user!.id,
    JSON.stringify({
      export_format: format,
      start_date: startDate,
      end_date: endDate,
      compliance_flag: complianceFlag,
      records_exported: result.rows.length
    }),
    ['AUDIT_EXPORT', 'COMPLIANCE'],
    req.user!.tenant_id
  ]);
}));

// Generate compliance report
router.post('/compliance-report', [
  expressQuery('start_date').isISO8601(),
  expressQuery('end_date').isISO8601(),
  expressQuery('facility_id').optional().isUUID()
], asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw createError('Validation failed', 400, 'VALIDATION_ERROR');
  }

  const { start_date, end_date, facility_id } = req.query;

  // Get audit logs for the period
  let auditQuery = `
    SELECT al.*, p.full_name as user_name
    FROM audit_logs al
    LEFT JOIN profiles p ON al.user_id = p.id
    WHERE al.timestamp BETWEEN $1 AND $2
  `;
  
  const auditParams = [start_date, end_date];
  let paramCount = 3;

  // Add facility filter if provided
  if (facility_id) {
    auditQuery += ` AND al.facility_id = $${paramCount++}`;
    auditParams.push(facility_id as string);
  }

  // Add tenant_id filter if not super_admin
  if (req.user!.role !== 'super_admin') {
    auditQuery += ` AND al.tenant_id = $${paramCount++}`;
    auditParams.push(req.user!.tenant_id);
  }

  const auditLogs = await query(auditQuery, auditParams);

  // Get visit statistics for the period
  let visitQuery = `
    SELECT 
      COUNT(*) as total_visits,
      COUNT(*) FILTER (WHERE status = 'checked_in') as checked_in,
      COUNT(*) FILTER (WHERE status = 'checked_out') as checked_out,
      COUNT(*) FILTER (WHERE status = 'denied') as denied_visits
    FROM visits
    WHERE scheduled_date BETWEEN $1 AND $2
  `;
  
  const visitParams = [start_date, end_date];
  paramCount = 3;

  // Add facility filter if provided
  if (facility_id) {
    visitQuery += ` AND facility_id = $${paramCount++}`;
    visitParams.push(facility_id as string);
  }

  // Add tenant_id filter if not super_admin
  if (req.user!.role !== 'super_admin') {
    visitQuery += ` AND tenant_id = $${paramCount++}`;
    visitParams.push(req.user!.tenant_id);
  }

  const visitStats = await query(visitQuery, visitParams);

  // Get security incidents for the period
  let securityQuery = `
    SELECT type, severity, COUNT(*) as count
    FROM security_alerts
    WHERE created_at BETWEEN $1 AND $2
  `;
  
  const securityParams = [start_date, end_date];
  paramCount = 3;

  // Add facility filter if provided
  if (facility_id) {
    securityQuery += ` AND facility_id = $${paramCount++}`;
    securityParams.push(facility_id as string);
  }

  // Add tenant_id filter if not super_admin (assuming security_alerts has tenant_id)
  if (req.user!.role !== 'super_admin') {
    securityQuery += ` AND EXISTS (
      SELECT 1 FROM facilities f 
      WHERE f.id = security_alerts.facility_id 
      AND f.tenant_id = $${paramCount++}
    )`;
    securityParams.push(req.user!.tenant_id);
  }

  securityQuery += ` GROUP BY type, severity ORDER BY count DESC`;

  let securityIncidents = [];
  try {
    const securityResult = await query(securityQuery, securityParams);
    securityIncidents = securityResult.rows;
  } catch (error) {
    console.error('Error fetching security incidents:', error);
    // Continue with the report even if security incidents query fails
    securityIncidents = [];
  }

  // Compile compliance report
  const report = {
    report_metadata: {
      generated_at: new Date().toISOString(),
      generated_by: req.user!.full_name,
      period: {
        start: start_date,
        end: end_date
      },
      facility_id: facility_id || 'all'
    },
    summary: {
      total_audit_entries: auditLogs.rows.length,
      total_visits: visitStats.rows[0]?.total_visits || 0,
      security_incidents: securityIncidents.reduce((sum, row) => sum + parseInt(row.count), 0)
    },
    compliance_metrics: {
      ficam_events: auditLogs.rows.filter(log => log.compliance_flags?.includes('FICAM')).length,
      fips_140_events: auditLogs.rows.filter(log => log.compliance_flags?.includes('FIPS_140')).length,
      hipaa_events: auditLogs.rows.filter(log => log.compliance_flags?.includes('HIPAA')).length,
      ferpa_events: auditLogs.rows.filter(log => log.compliance_flags?.includes('FERPA')).length
    },
    visit_statistics: visitStats.rows[0],
    security_summary: securityIncidents,
    audit_summary: {
      by_action: auditLogs.rows.reduce((acc, log) => {
        acc[log.action] = (acc[log.action] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      by_user: auditLogs.rows.reduce((acc, log) => {
        const userName = log.user_name || 'System';
        acc[userName] = (acc[userName] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    }
  };

  // Log report generation
  await query(`
    INSERT INTO audit_logs (
      user_id, action, table_name, new_values, compliance_flags, tenant_id
    ) VALUES ($1, 'create', 'compliance_report', $2, $3, $4)
  `, [
    req.user!.id,
    JSON.stringify({
      report_type: 'compliance',
      period: report.report_metadata.period,
      facility_id: facility_id || 'all'
    }),
    ['COMPLIANCE_REPORT'],
    req.user!.tenant_id
  ]);

  res.json({
    message: 'Compliance report generated successfully',
    report
  });
}));

export default router;