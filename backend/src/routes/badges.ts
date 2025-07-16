import express from 'express';
import { body, param, validationResult } from 'express-validator';
import { query, transaction } from '../config/database';
import { asyncHandler, createError } from '../middleware/errorHandler';
import { AuthenticatedRequest, requireReception } from '../middleware/auth';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

// Create a new badge
router.post('/', requireReception(), [
  body('visit_id').isUUID().withMessage('Valid visit ID is required'),
  body('access_zones').optional().isArray().withMessage('Access zones must be an array')
], asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw createError('Validation failed', 400, 'VALIDATION_ERROR', errors.array());
  }

  const { visit_id, access_zones = [] } = req.body;

  await transaction(async (client) => {
    // Verify visit exists and belongs to the user's tenant
    const visitCheck = await client.query(
      'SELECT id, visitor_id, facility_id, tenant_id FROM visits WHERE id = $1 AND tenant_id = $2',
      [visit_id, req.user!.tenant_id]
    );

    if (visitCheck.rows.length === 0) {
      throw createError('Visit not found', 404, 'VISIT_NOT_FOUND');
    }

    // Check if there's already an active badge for this visit
    const existingBadge = await client.query(
      'SELECT id FROM badges WHERE visit_id = $1 AND is_active = true',
      [visit_id]
    );

    if (existingBadge.rows.length > 0) {
      // Deactivate existing badge
      await client.query(
        'UPDATE badges SET is_active = false, returned_at = NOW() WHERE id = $1',
        [existingBadge.rows[0].id]
      );
    }

    // Generate badge number
    const badgeNumber = `VB-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;

    // Set expiry time (default to end of day)
    const now = new Date();
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);

    // Create QR code data
    const qrCodeData = JSON.stringify({
      visit_id,
      badge_number: badgeNumber,
      issued_at: now.toISOString(),
      security_hash: uuidv4()
    });

    // Create badge
    const result = await client.query(`
      INSERT INTO badges (
        tenant_id, visit_id, badge_number, issued_at, expires_at, 
        access_zones, qr_code_data, is_temporary, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [
      req.user!.tenant_id,
      visit_id,
      badgeNumber,
      now,
      endOfDay,
      access_zones,
      qrCodeData,
      true, // is_temporary
      true  // is_active
    ]);

    // Update visit with badge_id
    await client.query(
      'UPDATE visits SET badge_id = $1, updated_at = NOW() WHERE id = $2',
      [result.rows[0].id, visit_id]
    );

    // Log badge creation in audit trail
    await client.query(`
      INSERT INTO audit_logs (
        user_id, tenant_id, action, table_name, record_id, new_values, compliance_flags
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [
      req.user!.id,
      req.user!.tenant_id,
      'create',
      'badges',
      result.rows[0].id,
      JSON.stringify({
        visit_id,
        badge_number: badgeNumber,
        access_zones,
        issued_by: req.user!.full_name
      }),
      ['SECURITY', 'ACCESS_CONTROL']
    ]);

    res.status(201).json({
      message: 'Badge created successfully',
      badge: result.rows[0]
    });
  });
}));

// Get badge by ID
router.get('/:id', [
  param('id').isUUID().withMessage('Valid badge ID is required')
], asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw createError('Validation failed', 400, 'VALIDATION_ERROR', errors.array());
  }

  const { id } = req.params;

  const result = await query(`
    SELECT b.*, 
           v.visitor_id, v.host_id, v.facility_id, v.purpose, v.status,
           vis.first_name, vis.last_name, vis.company, vis.photo_url,
           h.profile_id as host_profile_id,
           p.full_name as host_name,
           f.name as facility_name
    FROM badges b
    JOIN visits v ON b.visit_id = v.id
    JOIN visitors vis ON v.visitor_id = vis.id
    JOIN hosts h ON v.host_id = h.id
    JOIN profiles p ON h.profile_id = p.id
    JOIN facilities f ON v.facility_id = f.id
    WHERE b.id = $1 AND b.tenant_id = $2
  `, [id, req.user!.tenant_id]);

  if (result.rows.length === 0) {
    throw createError('Badge not found', 404, 'BADGE_NOT_FOUND');
  }

  res.json({
    badge: result.rows[0]
  });
}));

// Get badges for a visit
router.get('/visit/:visitId', [
  param('visitId').isUUID().withMessage('Valid visit ID is required')
], asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw createError('Validation failed', 400, 'VALIDATION_ERROR', errors.array());
  }

  const { visitId } = req.params;

  const result = await query(`
    SELECT * FROM badges
    WHERE visit_id = $1 AND tenant_id = $2
    ORDER BY issued_at DESC
  `, [visitId, req.user!.tenant_id]);

  res.json({
    badges: result.rows
  });
}));

// Deactivate badge
router.put('/:id/deactivate', [
  param('id').isUUID().withMessage('Valid badge ID is required')
], asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw createError('Validation failed', 400, 'VALIDATION_ERROR', errors.array());
  }

  const { id } = req.params;

  const result = await query(`
    UPDATE badges
    SET is_active = false, returned_at = NOW(), updated_at = NOW()
    WHERE id = $1 AND tenant_id = $2
    RETURNING *
  `, [id, req.user!.tenant_id]);

  if (result.rows.length === 0) {
    throw createError('Badge not found', 404, 'BADGE_NOT_FOUND');
  }

  res.json({
    message: 'Badge deactivated successfully',
    badge: result.rows[0]
  });
}));

export default router;