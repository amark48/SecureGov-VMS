import express from 'express';
import { body, param, query as expressQuery, validationResult } from 'express-validator';
import { query, transaction } from '../config/database';
import { asyncHandler, createError } from '../middleware/errorHandler';
import { AuthenticatedRequest, requireReception, requireAdmin } from '../middleware/auth';

const router = express.Router();

// Get badge configuration for tenant
router.get('/config', asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const result = await query(`
    SELECT badge_issuance_options, default_badge_type
    FROM tenants
    WHERE id = $1
  `, [req.user!.tenant_id]);

  if (result.rows.length === 0) {
    throw createError('Tenant not found', 404, 'TENANT_NOT_FOUND');
  }

  res.json({
    config: result.rows[0]
  });
}));

// Update badge configuration (admin only)
router.put('/config', requireAdmin(), [
  body('badge_issuance_options').isArray().withMessage('Badge issuance options must be an array'),
  body('default_badge_type').isString().withMessage('Default badge type is required')
], asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw createError('Validation failed', 400, 'VALIDATION_ERROR', errors.array());
  }

  const { badge_issuance_options, default_badge_type } = req.body;

  // Validate that default_badge_type is in the options array
  if (!badge_issuance_options.includes(default_badge_type)) {
    throw createError('Default badge type must be one of the available options', 400, 'INVALID_DEFAULT_BADGE_TYPE');
  }

  const result = await query(`
    UPDATE tenants
    SET badge_issuance_options = $1, default_badge_type = $2, updated_at = NOW()
    WHERE id = $3
    RETURNING badge_issuance_options, default_badge_type
  `, [JSON.stringify(badge_issuance_options), default_badge_type, req.user!.tenant_id]);

  res.json({
    message: 'Badge configuration updated successfully',
    config: result.rows[0]
  });
}));

// Issue enhanced badge
router.post('/issue', requireReception(), [
  body('visit_id').isUUID().withMessage('Valid visit ID is required'),
  body('badge_type').isString().withMessage('Badge type is required'),
  body('civ_piv_i_serial').optional().isString().withMessage('CIV/PIV-I serial must be a string'),
  body('access_zones').optional().isArray().withMessage('Access zones must be an array')
], asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw createError('Validation failed', 400, 'VALIDATION_ERROR', errors.array());
  }

  const { visit_id, badge_type, civ_piv_i_serial, access_zones = [] } = req.body;

  await transaction(async (client) => {
    // Verify visit exists and belongs to tenant
    const visitCheck = await client.query(`
      SELECT v.id, v.visitor_id, v.facility_id, v.status,
             vis.first_name, vis.last_name
      FROM visits v
      JOIN visitors vis ON v.visitor_id = vis.id
      WHERE v.id = $1 AND v.tenant_id = $2
    `, [visit_id, req.user!.tenant_id]);

    if (visitCheck.rows.length === 0) {
      throw createError('Visit not found', 404, 'VISIT_NOT_FOUND');
    }

    const visit = visitCheck.rows[0];

    // Check if visit is in a state that allows badge issuance
    if (!['pre_registered', 'checked_in'].includes(visit.status)) {
      throw createError('Badge can only be issued for pre-registered or checked-in visits', 400, 'INVALID_VISIT_STATUS');
    }

    // Get tenant badge configuration
    const tenantConfig = await client.query(`
      SELECT badge_issuance_options, default_badge_type
      FROM tenants
      WHERE id = $1
    `, [req.user!.tenant_id]);

    const config = tenantConfig.rows[0];
    
    // Validate badge type is allowed
    if (!config.badge_issuance_options.includes(badge_type)) {
      throw createError('Badge type not allowed for this tenant', 400, 'BADGE_TYPE_NOT_ALLOWED');
    }

    // For CIV/PIV-I badges, validate serial number
    if (badge_type === 'civ_piv_i') {
      if (!civ_piv_i_serial) {
        throw createError('CIV/PIV-I serial number is required for this badge type', 400, 'SERIAL_REQUIRED');
      }

      // Check if serial number is already in use
      const serialCheck = await client.query(`
        SELECT id FROM badges
        WHERE civ_piv_i_serial = $1 AND status IN ('issued', 'lost') AND tenant_id = $2
      `, [civ_piv_i_serial, req.user!.tenant_id]);

      if (serialCheck.rows.length > 0) {
        throw createError('CIV/PIV-I serial number is already in use', 409, 'SERIAL_IN_USE');
      }
    }

    // Check if there's already an active badge for this visit
    const existingBadge = await client.query(`
      SELECT id FROM badges
      WHERE visit_id = $1 AND status = 'issued'
    `, [visit_id]);

    if (existingBadge.rows.length > 0) {
      // Return existing badge instead of creating new one
      await client.query(`
        UPDATE badges SET status = 'returned', returned_at = NOW()
        WHERE id = $1
      `, [existingBadge.rows[0].id]);
    }

    // Generate badge number
    const badgeNumber = badge_type === 'civ_piv_i' ? 
      `CIV-${civ_piv_i_serial}` : 
      `VB-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;

    // Set expiry time (default to end of day)
    const now = new Date();
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);

    // Create QR code data for the badge
    const qrCodeData = JSON.stringify({
      visit_id,
      badge_number: badgeNumber,
      badge_type,
      issued_at: now.toISOString(),
      security_hash: require('uuid').v4()
    });

    // Create badge
    const result = await client.query(`
      INSERT INTO badges (
        tenant_id, visit_id, badge_number, badge_type, civ_piv_i_serial,
        issued_at, expires_at, access_zones, qr_code_data, 
        is_temporary, is_active, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'issued')
      RETURNING *
    `, [
      req.user!.tenant_id,
      visit_id,
      badgeNumber,
      badge_type,
      civ_piv_i_serial,
      now,
      endOfDay,
      access_zones,
      qrCodeData,
      badge_type === 'printed', // printed badges are temporary
      true
    ]);

    // Update visit with badge_id
    await client.query(`
      UPDATE visits SET badge_id = $1, updated_at = NOW()
      WHERE id = $2
    `, [result.rows[0].id, visit_id]);

    // Log badge issuance
    await client.query(`
      INSERT INTO audit_logs (
        user_id, tenant_id, action, table_name, record_id, new_values, compliance_flags
      ) VALUES ($1, $2, 'create', 'badges', $3, $4, $5)
    `, [
      req.user!.id,
      req.user!.tenant_id,
      result.rows[0].id,
      JSON.stringify({
        visit_id,
        badge_number: badgeNumber,
        badge_type,
        civ_piv_i_serial,
        access_zones,
        visitor_name: `${visit.first_name} ${visit.last_name}`,
        issued_by: req.user!.full_name
      }),
      ['SECURITY', 'BADGE_ISSUANCE', badge_type === 'civ_piv_i' ? 'CIV_PIV_I' : 'PRINTED_BADGE']
    ]);

    res.status(201).json({
      message: 'Badge issued successfully',
      badge: result.rows[0]
    });
  });
}));

// Return badge
router.put('/:badgeId/return', requireReception(), [
  param('badgeId').isUUID().withMessage('Valid badge ID is required')
], asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw createError('Validation failed', 400, 'VALIDATION_ERROR', errors.array());
  }

  const { badgeId } = req.params;

  await transaction(async (client) => {
    // Get badge details
    const badgeResult = await client.query(`
      SELECT b.*, v.visitor_id,
             vis.first_name, vis.last_name
      FROM badges b
      JOIN visits v ON b.visit_id = v.id
      JOIN visitors vis ON v.visitor_id = vis.id
      WHERE b.id = $1 AND b.tenant_id = $2
    `, [badgeId, req.user!.tenant_id]);

    if (badgeResult.rows.length === 0) {
      throw createError('Badge not found', 404, 'BADGE_NOT_FOUND');
    }

    const badge = badgeResult.rows[0];

    if (badge.status !== 'issued') {
      throw createError('Badge is not currently issued', 400, 'BADGE_NOT_ISSUED');
    }

    // Update badge status
    const result = await client.query(`
      UPDATE badges
      SET status = 'returned', returned_at = NOW(), is_active = false, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `, [badgeId]);

    // Log badge return
    await client.query(`
      INSERT INTO audit_logs (
        user_id, tenant_id, action, table_name, record_id, new_values, compliance_flags
      ) VALUES ($1, $2, 'update', 'badges', $3, $4, $5)
    `, [
      req.user!.id,
      req.user!.tenant_id,
      badgeId,
      JSON.stringify({
        action: 'badge_returned',
        badge_number: badge.badge_number,
        badge_type: badge.badge_type,
        visitor_name: `${badge.first_name} ${badge.last_name}`,
        returned_by: req.user!.full_name
      }),
      ['SECURITY', 'BADGE_RETURN']
    ]);

    res.json({
      message: 'Badge returned successfully',
      badge: result.rows[0]
    });
  });
}));

// Mark badge as lost
router.put('/:badgeId/mark-lost', requireReception(), [
  param('badgeId').isUUID().withMessage('Valid badge ID is required')
], asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw createError('Validation failed', 400, 'VALIDATION_ERROR', errors.array());
  }

  const { badgeId } = req.params;

  await transaction(async (client) => {
    // Get badge details
    const badgeResult = await client.query(`
      SELECT b.*, v.visitor_id,
             vis.first_name, vis.last_name
      FROM badges b
      JOIN visits v ON b.visit_id = v.id
      JOIN visitors vis ON v.visitor_id = vis.id
      WHERE b.id = $1 AND b.tenant_id = $2
    `, [badgeId, req.user!.tenant_id]);

    if (badgeResult.rows.length === 0) {
      throw createError('Badge not found', 404, 'BADGE_NOT_FOUND');
    }

    const badge = badgeResult.rows[0];

    if (badge.status === 'lost') {
      throw createError('Badge is already marked as lost', 400, 'BADGE_ALREADY_LOST');
    }

    // Update badge status
    const result = await client.query(`
      UPDATE badges
      SET status = 'lost', is_active = false, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `, [badgeId]);

    // Log badge lost
    await client.query(`
      INSERT INTO audit_logs (
        user_id, tenant_id, action, table_name, record_id, new_values, compliance_flags
      ) VALUES ($1, $2, 'update', 'badges', $3, $4, $5)
    `, [
      req.user!.id,
      req.user!.tenant_id,
      badgeId,
      JSON.stringify({
        action: 'badge_marked_lost',
        badge_number: badge.badge_number,
        badge_type: badge.badge_type,
        visitor_name: `${badge.first_name} ${badge.last_name}`,
        marked_by: req.user!.full_name
      }),
      ['SECURITY', 'BADGE_LOST', 'SECURITY_INCIDENT']
    ]);

    res.json({
      message: 'Badge marked as lost successfully',
      badge: result.rows[0]
    });
  });
}));

// Get badge statistics
router.get('/stats', asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const stats = await query(`
    SELECT 
      COUNT(*) as total_badges,
      COUNT(*) FILTER (WHERE status = 'issued') as issued_badges,
      COUNT(*) FILTER (WHERE status = 'returned') as returned_badges,
      COUNT(*) FILTER (WHERE status = 'lost') as lost_badges,
      COUNT(*) FILTER (WHERE badge_type = 'printed') as printed_badges,
      COUNT(*) FILTER (WHERE badge_type = 'civ_piv_i') as civ_piv_i_badges,
      COUNT(*) FILTER (WHERE issued_at >= CURRENT_DATE) as badges_today
    FROM badges
    WHERE tenant_id = $1
  `, [req.user!.tenant_id]);

  const badgesByType = await query(`
    SELECT badge_type, COUNT(*) as count
    FROM badges
    WHERE tenant_id = $1 AND issued_at >= CURRENT_DATE - INTERVAL '30 days'
    GROUP BY badge_type
    ORDER BY count DESC
  `, [req.user!.tenant_id]);

  res.json({
    stats: stats.rows[0],
    badges_by_type: badgesByType.rows
  });
}));

export default router;