import express from 'express';
import { body, query as expressQuery, validationResult } from 'express-validator';
import { query, transaction } from '../config/database';
import { asyncHandler, createError } from '../middleware/errorHandler';
import { AuthenticatedRequest, requireSecurity } from '../middleware/auth';

const router = express.Router();

// All security routes require security role or higher
router.use(requireSecurity());

// Get watchlist entries
router.get('/watchlist', [
  expressQuery('page').optional().isInt({ min: 1 }),
  expressQuery('limit').optional().isInt({ min: 1, max: 100 }),
  expressQuery('threat_level').optional().isIn(['low', 'medium', 'high', 'critical']),
  expressQuery('search').optional().isLength({ max: 100 })
], asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw createError('Validation failed', 400, 'VALIDATION_ERROR');
  }

  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const offset = (page - 1) * limit;

  let queryText = `
    SELECT w.*, 
           p.full_name as created_by_name,
           COUNT(*) OVER() as total_count
    FROM watchlist w
    LEFT JOIN profiles p ON w.created_by = p.id
    WHERE w.is_active = true
  `;

  const queryParams: any[] = [];
  let paramCount = 1;

  if (req.query.threat_level) {
    queryText += ` AND w.threat_level = $${paramCount++}`;
    queryParams.push(req.query.threat_level);
  }

  if (req.query.search) {
    queryText += ` AND (w.first_name ILIKE $${paramCount} OR w.last_name ILIKE $${paramCount} OR w.reason ILIKE $${paramCount})`;
    queryParams.push(`%${req.query.search}%`);
    paramCount++;
  }

  queryText += ` ORDER BY 
    CASE w.threat_level 
      WHEN 'critical' THEN 1 
      WHEN 'high' THEN 2 
      WHEN 'medium' THEN 3 
      WHEN 'low' THEN 4 
    END, w.created_at DESC 
    LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
  queryParams.push(limit, offset);

  const result = await query(queryText, queryParams);
  const totalCount = result.rows.length > 0 ? parseInt(result.rows[0].total_count) : 0;

  res.json({
    watchlist: result.rows.map(row => {
      const { total_count, ...entry } = row;
      return entry;
    }),
    pagination: {
      page,
      limit,
      total: totalCount,
      pages: Math.ceil(totalCount / limit)
    }
  });
}));

// Add watchlist entry
router.post('/watchlist', [
  body('first_name').isLength({ min: 1, max: 100 }).trim(),
  body('last_name').isLength({ min: 1, max: 100 }).trim(),
  body('aliases').optional().isArray(),
  body('id_numbers').optional().isArray(),
  body('reason').isLength({ min: 1, max: 1000 }).trim(),
  body('threat_level').isIn(['low', 'medium', 'high', 'critical']),
  body('source_agency').optional().isLength({ max: 200 }).trim(),
  body('expiry_date').optional().isISO8601(),
  body('notes').optional().isLength({ max: 2000 }).trim()
], asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw createError('Validation failed', 400, 'VALIDATION_ERROR');
  }

  const {
    first_name,
    last_name,
    aliases,
    id_numbers,
    reason,
    threat_level,
    source_agency,
    expiry_date,
    notes
  } = req.body;

  const result = await query(`
    INSERT INTO watchlist (
      first_name, last_name, aliases, id_numbers, reason, threat_level,
      source_agency, expiry_date, notes, created_by
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    RETURNING *
  `, [
    first_name, last_name, aliases, id_numbers, reason, threat_level,
    source_agency, expiry_date, notes, req.user!.id
  ]);

  res.status(201).json({
    message: 'Watchlist entry created successfully',
    entry: result.rows[0]
  });
}));

// Update watchlist entry
router.put('/watchlist/:id', [
  body('first_name').optional().isLength({ min: 1, max: 100 }).trim(),
  body('last_name').optional().isLength({ min: 1, max: 100 }).trim(),
  body('aliases').optional().isArray(),
  body('id_numbers').optional().isArray(),
  body('reason').optional().isLength({ min: 1, max: 1000 }).trim(),
  body('threat_level').optional().isIn(['low', 'medium', 'high', 'critical']),
  body('source_agency').optional().isLength({ max: 200 }).trim(),
  body('expiry_date').optional().isISO8601(),
  body('notes').optional().isLength({ max: 2000 }).trim(),
  body('is_active').optional().isBoolean()
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

  const setClause = updateFields.map((field, index) => `${field} = $${index + 2}`).join(', ');
  const values = [id, ...updateFields.map(field => updates[field])];

  const result = await query(`
    UPDATE watchlist 
    SET ${setClause}, updated_at = NOW()
    WHERE id = $1
    RETURNING *
  `, values);

  if (result.rows.length === 0) {
    throw createError('Watchlist entry not found', 404, 'ENTRY_NOT_FOUND');
  }

  res.json({
    message: 'Watchlist entry updated successfully',
    entry: result.rows[0]
  });
}));

// Screen visitor against watchlist
router.post('/screen', [
  body('first_name').isLength({ min: 1, max: 100 }).trim(),
  body('last_name').isLength({ min: 1, max: 100 }).trim(),
  body('id_number').optional().isLength({ max: 50 }).trim()
], asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw createError('Validation failed', 400, 'VALIDATION_ERROR');
  }

  const { first_name, last_name, id_number } = req.body;

  let queryText = `
    SELECT *, 
           CASE 
             WHEN first_name ILIKE $1 AND last_name ILIKE $2 THEN 'exact_name'
             WHEN $3 = ANY(id_numbers) THEN 'id_match'
             WHEN first_name ILIKE $4 OR last_name ILIKE $5 THEN 'partial_name'
             ELSE 'alias_match'
           END as match_type
    FROM watchlist
    WHERE is_active = true
    AND (
      (first_name ILIKE $1 AND last_name ILIKE $2) OR
      ($3 IS NOT NULL AND $3 = ANY(id_numbers)) OR
      (first_name ILIKE $4 OR last_name ILIKE $5) OR
      ($1 = ANY(aliases) OR $2 = ANY(aliases))
    )
    ORDER BY 
      CASE threat_level 
        WHEN 'critical' THEN 1 
        WHEN 'high' THEN 2 
        WHEN 'medium' THEN 3 
        WHEN 'low' THEN 4 
      END,
      CASE match_type
        WHEN 'exact_name' THEN 1
        WHEN 'id_match' THEN 2
        WHEN 'partial_name' THEN 3
        WHEN 'alias_match' THEN 4
      END
  `;

  const result = await query(queryText, [
    first_name, last_name, id_number,
    `%${first_name}%`, `%${last_name}%`
  ]);

  // Log screening activity
  await query(`
    INSERT INTO audit_logs (
      user_id, action, table_name, new_values, compliance_flags
    ) VALUES ($1, 'create', 'security_screening', $2, $3)
  `, [
    req.user!.id,
    JSON.stringify({
      screened_name: `${first_name} ${last_name}`,
      id_number,
      matches_found: result.rows.length,
      match_details: result.rows.map(r => ({
        id: r.id,
        threat_level: r.threat_level,
        match_type: r.match_type
      }))
    }),
    ['FICAM', 'SECURITY_SCREENING']
  ]);

  res.json({
    matches: result.rows,
    screening_summary: {
      total_matches: result.rows.length,
      highest_threat_level: result.rows.length > 0 ? result.rows[0].threat_level : null,
      requires_approval: result.rows.some(r => ['high', 'critical'].includes(r.threat_level))
    }
  });
}));

// Get security alerts
router.get('/alerts', [
  expressQuery('page').optional().isInt({ min: 1 }),
  expressQuery('limit').optional().isInt({ min: 1, max: 100 }),
  expressQuery('severity').optional().isIn(['low', 'medium', 'high', 'critical']),
  expressQuery('resolved').optional().isBoolean()
], asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw createError('Validation failed', 400, 'VALIDATION_ERROR');
  }

  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const offset = (page - 1) * limit;

  let queryText = `
    SELECT sa.*, 
           f.name as facility_name,
           vis.first_name as visitor_first_name,
           vis.last_name as visitor_last_name,
           p.full_name as resolved_by_name,
           COUNT(*) OVER() as total_count
    FROM security_alerts sa
    LEFT JOIN facilities f ON sa.facility_id = f.id
    LEFT JOIN visitors vis ON sa.visitor_id = vis.id
    LEFT JOIN profiles p ON sa.resolved_by = p.id
    WHERE 1=1
  `;

  const queryParams: any[] = [];
  let paramCount = 1;

  if (req.query.severity) {
    queryText += ` AND sa.severity = $${paramCount++}`;
    queryParams.push(req.query.severity);
  }

  if (req.query.resolved !== undefined) {
    queryText += ` AND sa.resolved = $${paramCount++}`;
    queryParams.push(req.query.resolved === 'true');
  }

  queryText += ` ORDER BY 
    CASE sa.severity 
      WHEN 'critical' THEN 1 
      WHEN 'high' THEN 2 
      WHEN 'medium' THEN 3 
      WHEN 'low' THEN 4 
    END, sa.created_at DESC 
    LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
  queryParams.push(limit, offset);

  const result = await query(queryText, queryParams);
  const totalCount = result.rows.length > 0 ? parseInt(result.rows[0].total_count) : 0;

  res.json({
    alerts: result.rows.map(row => {
      const { total_count, ...alert } = row;
      return alert;
    }),
    pagination: {
      page,
      limit,
      total: totalCount,
      pages: Math.ceil(totalCount / limit)
    }
  });
}));

// Create security alert
router.post('/alerts', [
  body('type').isIn(['watchlist_match', 'security_breach', 'access_denied', 'emergency']),
  body('severity').isIn(['low', 'medium', 'high', 'critical']),
  body('message').isLength({ min: 1, max: 1000 }).trim(),
  body('visitor_id').optional().isUUID(),
  body('visit_id').optional().isUUID(),
  body('facility_id').isUUID()
], asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw createError('Validation failed', 400, 'VALIDATION_ERROR');
  }

  const { type, severity, message, visitor_id, visit_id, facility_id } = req.body;

  const result = await query(`
    INSERT INTO security_alerts (
      type, severity, message, visitor_id, visit_id, facility_id
    ) VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *
  `, [type, severity, message, visitor_id, visit_id, facility_id]);

  res.status(201).json({
    message: 'Security alert created successfully',
    alert: result.rows[0]
  });
}));

// Resolve security alert
router.put('/alerts/:id/resolve', [
  body('resolution_notes').optional().isLength({ max: 1000 }).trim()
], asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const { id } = req.params;
  const { resolution_notes } = req.body;

  const result = await query(`
    UPDATE security_alerts 
    SET resolved = true, 
        resolved_by = $2, 
        resolved_at = NOW(),
        resolution_notes = $3,
        updated_at = NOW()
    WHERE id = $1
    RETURNING *
  `, [id, req.user!.id, resolution_notes]);

  if (result.rows.length === 0) {
    throw createError('Security alert not found', 404, 'ALERT_NOT_FOUND');
  }

  res.json({
    message: 'Security alert resolved successfully',
    alert: result.rows[0]
  });
}));

// Get security statistics
router.get('/stats', asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const stats = await query(`
    SELECT 
      (SELECT COUNT(*) FROM watchlist WHERE is_active = true) as active_watchlist_entries,
      (SELECT COUNT(*) FROM watchlist WHERE is_active = true AND threat_level = 'critical') as critical_threats,
      (SELECT COUNT(*) FROM security_alerts WHERE resolved = false) as unresolved_alerts,
      (SELECT COUNT(*) FROM security_alerts WHERE created_at >= CURRENT_DATE) as alerts_today,
      (SELECT COUNT(*) FROM audit_logs WHERE action = 'create' AND table_name = 'security_screening' AND timestamp >= CURRENT_DATE) as screenings_today
  `);

  const alertsByType = await query(`
    SELECT type, COUNT(*) as count
    FROM security_alerts
    WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
    GROUP BY type
    ORDER BY count DESC
  `);

  const threatLevelDistribution = await query(`
    SELECT threat_level, COUNT(*) as count
    FROM watchlist
    WHERE is_active = true
    GROUP BY threat_level
    ORDER BY 
      CASE threat_level 
        WHEN 'critical' THEN 1 
        WHEN 'high' THEN 2 
        WHEN 'medium' THEN 3 
        WHEN 'low' THEN 4 
      END
  `);

  res.json({
    stats: stats.rows[0],
    alerts_by_type: alertsByType.rows,
    threat_level_distribution: threatLevelDistribution.rows
  });
}));

export default router;