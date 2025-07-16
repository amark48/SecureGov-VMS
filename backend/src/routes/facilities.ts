import express from 'express';
import { body, validationResult } from 'express-validator';
import { query } from '../config/database';
import { asyncHandler, createError } from '../middleware/errorHandler';
import { AuthenticatedRequest, requireAdmin } from '../middleware/auth';

const router = express.Router();

// Get all facilities
router.get('/', asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const result = await query(`
    SELECT f.*,
           COUNT(v.id) as total_visits,
           COUNT(v.id) FILTER (WHERE v.scheduled_date = CURRENT_DATE) as today_visits,
           COUNT(v.id) FILTER (WHERE v.status = 'checked_in') as current_visitors
    FROM facilities f
    LEFT JOIN visits v ON f.id = v.facility_id
    WHERE f.is_active = true
    AND f.tenant_id = $1
    GROUP BY f.id
    ORDER BY f.name
  `, [req.user!.tenant_id]);

  res.json({
    facilities: result.rows
  });
}));

// Get facility by ID
router.get('/:id', asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const { id } = req.params;

  const result = await query(`
    SELECT f.*,
           COUNT(v.id) as total_visits,
           COUNT(v.id) FILTER (WHERE v.scheduled_date = CURRENT_DATE) as today_visits,
           COUNT(v.id) FILTER (WHERE v.status = 'checked_in') as current_visitors,
           json_agg(
             json_build_object(
               'id', ec.id,
               'name', ec.name,
               'title', ec.title,
               'phone_primary', ec.phone_primary,
               'contact_type', ec.contact_type
             )
           ) FILTER (WHERE ec.id IS NOT NULL) as emergency_contacts
    FROM facilities f
    LEFT JOIN visits v ON f.id = v.facility_id
    LEFT JOIN emergency_contacts ec ON f.id = ec.facility_id AND ec.is_active = true
    WHERE f.id = $1 AND f.is_active = true
    AND f.tenant_id = $2
    GROUP BY f.id
  `, [id, req.user!.tenant_id]);

  if (result.rows.length === 0) {
    throw createError('Facility not found', 404, 'FACILITY_NOT_FOUND');
  }

  res.json({
    facility: result.rows[0]
  });
}));

// Create new facility (admin only)
router.post('/', requireAdmin(), [
  body('name').isLength({ min: 1, max: 200 }).trim(),
  body('address').isLength({ min: 1, max: 500 }).trim(),
  body('security_level').optional().isIn(['low', 'standard', 'high', 'maximum']),
  body('max_visitors').optional().isInt({ min: 1, max: 10000 }),
  body('operating_hours').optional().isObject(),
  body('emergency_procedures').optional().isLength({ max: 5000 }).trim()
], asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw createError('Validation failed', 400, 'VALIDATION_ERROR');
  }

  const {
    name,
    address,
    security_level,
    max_visitors,
    operating_hours,
    emergency_procedures
  } = req.body;

  // Include tenant_id from the authenticated user
  const result = await query(`
    INSERT INTO facilities (
      name, address, security_level, max_visitors, 
      operating_hours, emergency_procedures, tenant_id
    ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *
  `, [
    name,
    address,
    security_level || 'standard',
    max_visitors || 100,
    JSON.stringify(operating_hours),
    emergency_procedures,
    req.user!.tenant_id // Add tenant_id from the authenticated user
  ]);

  res.status(201).json({
    message: 'Facility created successfully',
    facility: result.rows[0]
  });
}));

// Update facility (admin only)
router.put('/:id', requireAdmin(), [
  body('name').optional().isLength({ min: 1, max: 200 }).trim(),
  body('address').optional().isLength({ min: 1, max: 500 }).trim(),
  body('security_level').optional().isIn(['low', 'standard', 'high', 'maximum']),
  body('max_visitors').optional().isInt({ min: 1, max: 10000 }),
  body('operating_hours').optional().isObject(),
  body('emergency_procedures').optional().isLength({ max: 5000 }).trim(),
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

  const setClause = updateFields.map((field, index) => {
    if (field === 'operating_hours') {
      return `${field} = $${index + 2}::jsonb`;
    }
    return `${field} = $${index + 2}`;
  }).join(', ');

  const values = [
    id,
    ...updateFields.map(field => 
      field === 'operating_hours' ? JSON.stringify(updates[field]) : updates[field]
    )
  ];

  // Add tenant_id check to ensure users can only update facilities in their tenant
  const result = await query(`
    UPDATE facilities 
    SET ${setClause}, updated_at = NOW()
    WHERE id = $1 AND tenant_id = $${values.length + 1}
    RETURNING *
  `, [...values, req.user!.tenant_id]);

  if (result.rows.length === 0) {
    throw createError('Facility not found', 404, 'FACILITY_NOT_FOUND');
  }

  res.json({
    message: 'Facility updated successfully',
    facility: result.rows[0]
  });
}));

// Get facility hosts
router.get('/:id/hosts', asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const { id } = req.params;

  const result = await query(`
    SELECT h.*, p.full_name, p.email, p.department, p.phone
    FROM hosts h
    JOIN profiles p ON h.profile_id = p.id
    WHERE h.facility_id = $1 AND h.is_available = true AND p.is_active = true
    AND h.tenant_id = $2
    ORDER BY p.full_name
  `, [id, req.user!.tenant_id]);

  res.json({
    hosts: result.rows
  });
}));

// Get facility visit statistics
router.get('/:id/stats', asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const { id } = req.params;

  const stats = await query(`
    SELECT 
      COUNT(*) as total_visits,
      COUNT(*) FILTER (WHERE status = 'pre_registered') as pre_registered,
      COUNT(*) FILTER (WHERE status = 'checked_in') as checked_in,
      COUNT(*) FILTER (WHERE status = 'checked_out') as checked_out,
      COUNT(*) FILTER (WHERE scheduled_date = CURRENT_DATE) as today_visits,
      COUNT(*) FILTER (WHERE scheduled_date = CURRENT_DATE AND status = 'checked_in') as currently_on_site,
      COUNT(DISTINCT visitor_id) as unique_visitors,
      AVG(EXTRACT(EPOCH FROM (actual_check_out - actual_check_in))/3600) FILTER (WHERE actual_check_out IS NOT NULL) as avg_visit_duration_hours
    FROM visits
    WHERE facility_id = $1 AND tenant_id = $2 AND created_at >= CURRENT_DATE - INTERVAL '30 days'
  `, [id, req.user!.tenant_id]);

  const dailyStats = await query(`
    SELECT 
      scheduled_date,
      COUNT(*) as visit_count,
      COUNT(*) FILTER (WHERE status = 'checked_in') as checked_in_count
    FROM visits
    WHERE facility_id = $1 AND tenant_id = $2 AND scheduled_date >= CURRENT_DATE - INTERVAL '7 days'
    GROUP BY scheduled_date
    ORDER BY scheduled_date DESC
  `, [id, req.user!.tenant_id]);

  res.json({
    stats: stats.rows[0],
    daily_stats: dailyStats.rows
  });
}));

export default router;