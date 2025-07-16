import express from 'express';
import { body, query as expressQuery, param, validationResult } from 'express-validator';
import { query, transaction } from '../config/database';
import { asyncHandler, createError } from '../middleware/errorHandler';
import { AuthenticatedRequest, requireAdmin, requireAnyRole } from '../middleware/auth';

const router = express.Router();

// Get all hosts with filtering and pagination
router.get('/', [
  expressQuery('page').optional().isInt({ min: 1 }),
  expressQuery('limit').optional().isInt({ min: 1, max: 100 }),
  expressQuery('facility_id').optional().isUUID(),
  expressQuery('profile_id').optional().isUUID(),
  expressQuery('is_available').optional().isBoolean()
], asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw createError('Validation failed', 400, 'VALIDATION_ERROR');
  }

  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const offset = (page - 1) * limit;

  let queryText = `
    SELECT h.*, 
           p.full_name, p.email, p.department, p.phone, p.role,
           f.name as facility_name, f.security_level,
           COUNT(*) OVER() as total_count
    FROM hosts h
    JOIN profiles p ON h.profile_id = p.id
    JOIN facilities f ON h.facility_id = f.id
    WHERE h.tenant_id = $1
  `;

  const queryParams: any[] = [req.user!.tenant_id];
  let paramCount = 2;

  // Apply filters
  if (req.query.facility_id) {
    queryText += ` AND h.facility_id = $${paramCount++}`;
    queryParams.push(req.query.facility_id);
  }

  if (req.query.profile_id) {
    queryText += ` AND h.profile_id = $${paramCount++}`;
    queryParams.push(req.query.profile_id);
  }

  if (req.query.is_available !== undefined) {
    queryText += ` AND h.is_available = $${paramCount++}`;
    queryParams.push(req.query.is_available === 'true');
  }

  queryText += ` ORDER BY p.full_name ASC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
  queryParams.push(limit, offset);

  const result = await query(queryText, queryParams);
  const totalCount = result.rows.length > 0 ? parseInt(result.rows[0].total_count) : 0;

  res.json({
    hosts: result.rows.map(row => {
      const { total_count, ...host } = row;
      return host;
    }),
    pagination: {
      page,
      limit,
      total: totalCount,
      pages: Math.ceil(totalCount / limit)
    }
  });
}));

// Get host by ID
router.get('/:id', [
  param('id').isUUID()
], asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw createError('Validation failed', 400, 'VALIDATION_ERROR');
  }

  const { id } = req.params;

  const result = await query(`
    SELECT h.*, 
           p.full_name, p.email, p.department, p.phone, p.role,
           f.name as facility_name, f.security_level
    FROM hosts h
    JOIN profiles p ON h.profile_id = p.id
    JOIN facilities f ON h.facility_id = f.id
    WHERE h.id = $1 AND h.tenant_id = $2
  `, [id, req.user!.tenant_id]);

  if (result.rows.length === 0) {
    throw createError('Host not found', 404, 'HOST_NOT_FOUND');
  }

  res.json({
    host: result.rows[0]
  });
}));

// Create new host association
router.post('/', requireAdmin(), [
  body('profile_id').isUUID(),
  body('facility_id').isUUID(),
  body('notification_preferences').optional().isObject(),
  body('max_concurrent_visitors').optional().isInt({ min: 1, max: 100 }),
  body('is_available').optional().isBoolean()
], asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw createError('Validation failed', 400, 'VALIDATION_ERROR');
  }

  const {
    profile_id,
    facility_id,
    notification_preferences,
    max_concurrent_visitors,
    is_available
  } = req.body;

  await transaction(async (client) => {
    // Verify profile exists and belongs to the same tenant
    const profileCheck = await client.query(
      'SELECT id FROM profiles WHERE id = $1 AND tenant_id = $2',
      [profile_id, req.user!.tenant_id]
    );
    if (profileCheck.rows.length === 0) {
      throw createError('Profile not found', 404, 'PROFILE_NOT_FOUND');
    }

    // Verify facility exists and belongs to the same tenant
    const facilityCheck = await client.query(
      'SELECT id FROM facilities WHERE id = $1 AND tenant_id = $2 AND is_active = true',
      [facility_id, req.user!.tenant_id]
    );
    if (facilityCheck.rows.length === 0) {
      throw createError('Facility not found or inactive', 404, 'FACILITY_NOT_FOUND');
    }

    // Check if host association already exists
    const existingHost = await client.query(
      'SELECT id FROM hosts WHERE profile_id = $1 AND facility_id = $2 AND tenant_id = $3',
      [profile_id, facility_id, req.user!.tenant_id]
    );
    if (existingHost.rows.length > 0) {
      throw createError('Host association already exists', 409, 'HOST_EXISTS');
    }

    // Create host association
    const result = await client.query(`
      INSERT INTO hosts (
        tenant_id, profile_id, facility_id, notification_preferences, 
        max_concurrent_visitors, is_available
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [
      req.user!.tenant_id,
      profile_id,
      facility_id,
      notification_preferences || { email: true, sms: false, push: true },
      max_concurrent_visitors || 5,
      is_available !== undefined ? is_available : true
    ]);

    // Get the complete host details
    const hostDetails = await client.query(`
      SELECT h.*, 
             p.full_name, p.email, p.department, p.phone, p.role,
             f.name as facility_name, f.security_level
      FROM hosts h
      JOIN profiles p ON h.profile_id = p.id
      JOIN facilities f ON h.facility_id = f.id
      WHERE h.id = $1
    `, [result.rows[0].id]);

    res.status(201).json({
      message: 'Host association created successfully',
      host: hostDetails.rows[0]
    });
  });
}));

// Update host
router.put('/:id', requireAdmin(), [
  param('id').isUUID(),
  body('notification_preferences').optional().isObject(),
  body('max_concurrent_visitors').optional().isInt({ min: 1, max: 100 }),
  body('is_available').optional().isBoolean()
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
    if (field === 'notification_preferences') {
      return `${field} = $${index + 2}::jsonb`;
    }
    return `${field} = $${index + 2}`;
  }).join(', ');

  const values = [
    id,
    ...updateFields.map(field => 
      field === 'notification_preferences' ? JSON.stringify(updates[field]) : updates[field]
    )
  ];

  // Add tenant_id check to ensure users can only update hosts in their tenant
  const result = await query(`
    UPDATE hosts 
    SET ${setClause}, updated_at = NOW()
    WHERE id = $1 AND tenant_id = $${values.length + 1}
    RETURNING *
  `, [...values, req.user!.tenant_id]);

  if (result.rows.length === 0) {
    throw createError('Host not found', 404, 'HOST_NOT_FOUND');
  }

  // Get the complete host details
  const hostDetails = await query(`
    SELECT h.*, 
           p.full_name, p.email, p.department, p.phone, p.role,
           f.name as facility_name, f.security_level
    FROM hosts h
    JOIN profiles p ON h.profile_id = p.id
    JOIN facilities f ON h.facility_id = f.id
    WHERE h.id = $1
  `, [id]);

  res.json({
    message: 'Host updated successfully',
    host: hostDetails.rows[0]
  });
}));

// Delete host (soft delete by marking as unavailable)
router.delete('/:id', requireAdmin(), [
  param('id').isUUID()
], asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw createError('Validation failed', 400, 'VALIDATION_ERROR');
  }

  const { id } = req.params;

  // Check if host has active visits
  const activeVisits = await query(
    'SELECT COUNT(*) as count FROM visits WHERE host_id = $1 AND status IN ($2, $3) AND tenant_id = $4',
    [id, 'pre_registered', 'checked_in', req.user!.tenant_id]
  );

  if (parseInt(activeVisits.rows[0].count) > 0) {
    throw createError('Cannot delete host with active visits', 400, 'ACTIVE_VISITS_EXIST');
  }

  // Soft delete by marking as unavailable
  const result = await query(
    'UPDATE hosts SET is_available = false, updated_at = NOW() WHERE id = $1 AND tenant_id = $2 RETURNING id',
    [id, req.user!.tenant_id]
  );

  if (result.rows.length === 0) {
    throw createError('Host not found', 404, 'HOST_NOT_FOUND');
  }

  res.json({
    message: 'Host deactivated successfully'
  });
}));

// Get hosts by facility
router.get('/facility/:facilityId', [
  param('facilityId').isUUID()
], asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw createError('Validation failed', 400, 'VALIDATION_ERROR');
  }

  const { facilityId } = req.params;

  // Verify facility belongs to the user's tenant
  const facilityCheck = await query(
    'SELECT id FROM facilities WHERE id = $1 AND tenant_id = $2',
    [facilityId, req.user!.tenant_id]
  );

  if (facilityCheck.rows.length === 0) {
    throw createError('Facility not found', 404, 'FACILITY_NOT_FOUND');
  }

  const result = await query(`
    SELECT h.*, 
           p.full_name, p.email, p.department, p.phone, p.role
    FROM hosts h
    JOIN profiles p ON h.profile_id = p.id
    WHERE h.facility_id = $1 AND h.tenant_id = $2 AND h.is_available = true
    ORDER BY p.full_name
  `, [facilityId, req.user!.tenant_id]);

  res.json({
    hosts: result.rows
  });
}));

// Get hosts by profile
router.get('/profile/:profileId', [
  param('profileId').isUUID()
], asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw createError('Validation failed', 400, 'VALIDATION_ERROR');
  }

  const { profileId } = req.params;

  // Verify the profile belongs to the same tenant or the user is an admin
  if (profileId !== req.user!.id && req.user!.role !== 'admin') {
    const profileCheck = await query(
      'SELECT id FROM profiles WHERE id = $1 AND tenant_id = $2',
      [profileId, req.user!.tenant_id]
    );
    if (profileCheck.rows.length === 0) {
      throw createError('Profile not found', 404, 'PROFILE_NOT_FOUND');
    }
  }

  const result = await query(`
    SELECT h.*, 
           f.name as facility_name, f.security_level
    FROM hosts h
    JOIN facilities f ON h.facility_id = f.id
    WHERE h.profile_id = $1 AND h.tenant_id = $2
    ORDER BY f.name
  `, [profileId, req.user!.tenant_id]);

  res.json({
    hosts: result.rows
  });
}));

export default router;