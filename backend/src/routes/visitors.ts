import express from 'express';
import { body, query as expressQuery, validationResult } from 'express-validator';
import { query, transaction } from '../config/database';
import { asyncHandler, createError } from '../middleware/errorHandler';
import { AuthenticatedRequest, requireReception } from '../middleware/auth';

const router = express.Router();

// Get all visitors with pagination and search
router.get('/', [
  expressQuery('page').optional().isInt({ min: 1 }),
  expressQuery('limit').optional().isInt({ min: 1, max: 100 }),
  expressQuery('search').optional().isLength({ max: 100 })
], asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw createError('Validation failed', 400, 'VALIDATION_ERROR');
  }

  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const search = req.query.search as string;
  const offset = (page - 1) * limit;

  let queryText = `
    SELECT v.*, 
           COUNT(*) OVER() as total_count
    FROM visitors v
    WHERE v.tenant_id = $1
  `;
  
  const queryParams: any[] = [req.user!.tenant_id];
  let paramCount = 2;

  if (search) {
    queryText += ` AND (
      v.first_name ILIKE $${paramCount} OR 
      v.last_name ILIKE $${paramCount} OR 
      v.email ILIKE $${paramCount} OR 
      v.company ILIKE $${paramCount}
    )`;
    queryParams.push(`%${search}%`);
    paramCount++;
  }

  queryText += ` ORDER BY v.created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
  queryParams.push(limit, offset);

  const result = await query(queryText, queryParams);
  const totalCount = result.rows.length > 0 ? parseInt(result.rows[0].total_count) : 0;

  res.json({
    visitors: result.rows.map(row => {
      const { total_count, ...visitor } = row;
      return visitor;
    }),
    pagination: {
      page,
      limit,
      total: totalCount,
      pages: Math.ceil(totalCount / limit)
    }
  });
}));

// Get visitor by ID
router.get('/:id', asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const { id } = req.params;

  const result = await query(`
    SELECT v.*,
           json_agg(
             json_build_object(
               'id', vis.id,
               'purpose', vis.purpose,
               'scheduled_date', vis.scheduled_date,
               'status', vis.status,
               'facility_name', f.name
             )
           ) FILTER (WHERE vis.id IS NOT NULL) as visits
    FROM visitors v
    LEFT JOIN visits vis ON v.id = vis.visitor_id AND vis.tenant_id = $2
    LEFT JOIN facilities f ON vis.facility_id = f.id AND f.tenant_id = $2
    WHERE v.id = $1 AND v.tenant_id = $2
    GROUP BY v.id
  `, [id, req.user!.tenant_id]);

  if (result.rows.length === 0) {
    throw createError('Visitor not found', 404, 'VISITOR_NOT_FOUND');
  }

  res.json({
    visitor: result.rows[0]
  });
}));

// Create new visitor
router.post('/', requireReception(), [
  body('first_name').isLength({ min: 1, max: 100 }).trim(),
  body('last_name').isLength({ min: 1, max: 100 }).trim(),
  body('email').optional().isEmail().normalizeEmail(),
  body('phone').optional().isMobilePhone('any'),
  body('company').optional().isLength({ max: 200 }).trim(),
  body('id_number').optional().isLength({ max: 50 }).trim(),
  body('id_type').optional().isIn(['drivers_license', 'passport', 'state_id', 'military_id', 'government_id', 'other']),
  body('date_of_birth').optional().isISO8601(),
  body('citizenship').optional().isLength({ max: 50 }).trim(),
  body('nationality').optional().isLength({ max: 50 }).trim(),
  body('ssn').optional().isLength({ min: 4, max: 4 }).isNumeric(),
  body('security_clearance').optional().isIn(['unclassified', 'confidential', 'secret', 'top_secret']),
  body('emergency_contact_name').optional().isLength({ max: 100 }).trim(),
  body('emergency_contact_phone').optional().isMobilePhone('any'),
  body('notes').optional().isLength({ max: 1000 }).trim()
], asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw createError('Validation failed', 400, 'VALIDATION_ERROR');
  }

  const {
    first_name,
    last_name,
    email,
    phone,
    company,
    id_number,
    id_type,
    date_of_birth,
    citizenship,
    nationality,
    ssn,
    security_clearance,
    emergency_contact_name,
    emergency_contact_phone,
    notes
  } = req.body;

  const result = await query(`
    INSERT INTO visitors (
      first_name, last_name, email, phone, company, id_number, id_type,
      date_of_birth, citizenship, nationality, ssn, security_clearance, emergency_contact_name,
      emergency_contact_phone, notes, background_check_status, tenant_id
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
    RETURNING *
  `, [
    first_name, last_name, email, phone, company, id_number, id_type || 'drivers_license',
    date_of_birth, citizenship, nationality, ssn, security_clearance, emergency_contact_name,
    emergency_contact_phone, notes, 'pending', req.user?.tenant_id
  ]);

  res.status(201).json({
    message: 'Visitor created successfully',
    visitor: result.rows[0]
  });
}));

// Update visitor
router.put('/:id', requireReception(), [
  body('first_name').optional().isLength({ min: 1, max: 100 }).trim(),
  body('last_name').optional().isLength({ min: 1, max: 100 }).trim(),
  body('email').optional().isEmail().normalizeEmail(),
  body('phone').optional().isMobilePhone('any'),
  body('company').optional().isLength({ max: 200 }).trim(),
  body('id_number').optional().isLength({ max: 50 }).trim(),
  body('id_type').optional().isIn(['drivers_license', 'passport', 'state_id', 'military_id', 'government_id', 'other']),
  body('date_of_birth').optional().isISO8601(),
  body('citizenship').optional().isLength({ max: 50 }).trim(),
  body('nationality').optional().isLength({ max: 50 }).trim(),
  body('ssn').optional().isLength({ min: 4, max: 4 }).isNumeric(),
  body('security_clearance').optional().isIn(['unclassified', 'confidential', 'secret', 'top_secret']),
  body('emergency_contact_name').optional().isLength({ max: 100 }).trim(),
  body('emergency_contact_phone').optional().isMobilePhone('any'),
  body('notes').optional().isLength({ max: 1000 }).trim(),
  body('is_frequent_visitor').optional().isBoolean(),
  body('is_blacklisted').optional().isBoolean(),
  body('background_check_status').optional().isIn(['pending', 'approved', 'failed']),
  body('background_check_date').optional().isISO8601()
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

  // Add tenant_id check to ensure tenant isolation
  values.push(req.user!.tenant_id);

  const result = await query(`
    UPDATE visitors 
    SET ${setClause}, updated_at = NOW()
    WHERE id = $1 AND tenant_id = $${values.length}
    RETURNING *
  `, values);

  if (result.rows.length === 0) {
    throw createError('Visitor not found', 404, 'VISITOR_NOT_FOUND');
  }

  res.json({
    message: 'Visitor updated successfully',
    visitor: result.rows[0]
  });
}));

// Delete visitor (soft delete by marking as blacklisted)
router.delete('/:id', requireReception(), asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const { id } = req.params;

  // Check if visitor has active visits
  const activeVisits = await query(
    'SELECT COUNT(*) as count FROM visits WHERE visitor_id = $1 AND status IN ($2, $3) AND tenant_id = $4',
    [id, 'pre_registered', 'checked_in', req.user!.tenant_id]
  );

  if (parseInt(activeVisits.rows[0].count) > 0) {
    throw createError('Cannot delete visitor with active visits', 400, 'ACTIVE_VISITS_EXIST');
  }

  // Soft delete by marking as blacklisted
  const result = await query(
    'UPDATE visitors SET is_blacklisted = true, updated_at = NOW() WHERE id = $1 AND tenant_id = $2 RETURNING id',
    [id, req.user!.tenant_id]
  );

  if (result.rows.length === 0) {
    throw createError('Visitor not found', 404, 'VISITOR_NOT_FOUND');
  }

  res.json({
    message: 'Visitor deactivated successfully'
  });
}));

// Search visitors for quick lookup
router.get('/search/quick', [
  expressQuery('q').isLength({ min: 2, max: 100 })
], asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw createError('Validation failed', 400, 'VALIDATION_ERROR');
  }

  const searchTerm = req.query.q as string;

  const result = await query(`
    SELECT id, first_name, last_name, email, company, phone
    FROM visitors
    WHERE (
      first_name ILIKE $1 OR 
      last_name ILIKE $1 OR 
      email ILIKE $1 OR 
      company ILIKE $1 OR
      phone ILIKE $1
    )
    AND tenant_id = $2
    ORDER BY 
      CASE 
        WHEN first_name ILIKE $3 OR last_name ILIKE $3 THEN 1
        WHEN email ILIKE $3 THEN 2
        ELSE 3
      END,
      first_name, last_name
    LIMIT 10
  `, [`%${searchTerm}%`, req.user?.tenant_id, `${searchTerm}%`]);

  res.json({
    visitors: result.rows
  });
}));

// Get visitor statistics
router.get('/stats/overview', asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const stats = await query(`
    SELECT 
      COUNT(*) as total_visitors,
      COUNT(*) FILTER (WHERE is_frequent_visitor = true) as frequent_visitors,
      COUNT(*) FILTER (WHERE is_blacklisted = true) as blacklisted_visitors,
      COUNT(*) FILTER (WHERE background_check_status = 'approved') as approved_visitors,
      COUNT(*) FILTER (WHERE background_check_status = 'pending') as pending_visitors,
      COUNT(*) FILTER (WHERE background_check_status = 'failed') as failed_visitors,
      COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '30 days') as new_visitors_30_days
    FROM visitors
    WHERE tenant_id = $1
  `, [req.user?.tenant_id]);

  res.json({
    stats: stats.rows[0]
  });
}));

export default router;