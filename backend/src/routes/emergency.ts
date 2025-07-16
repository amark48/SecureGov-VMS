import express from 'express';
import { body, query as expressQuery, validationResult } from 'express-validator';
import { query, transaction } from '../config/database';
import { asyncHandler, createError } from '../middleware/errorHandler';
import { AuthenticatedRequest, requireSecurity } from '../middleware/auth';

const router = express.Router();

// Get emergency contacts for a facility
router.get('/contacts', [
  expressQuery('facility_id').isUUID()
], asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw createError('Validation failed', 400, 'VALIDATION_ERROR');
  }

  const { facility_id } = req.query;

  const result = await query(`
    SELECT *
    FROM emergency_contacts
    WHERE facility_id = $1 AND is_active = true
    ORDER BY 
      CASE contact_type 
        WHEN 'emergency' THEN 1
        WHEN 'security' THEN 2
        WHEN 'medical' THEN 3
        WHEN 'fire_safety' THEN 4
        WHEN 'administration' THEN 5
        ELSE 6
      END,
      name
  `, [facility_id]);

  res.json({
    contacts: result.rows
  });
}));

// Create emergency contact (security role required)
router.post('/contacts', requireSecurity(), [
  body('facility_id').isUUID(),
  body('name').isLength({ min: 1, max: 100 }).trim(),
  body('title').optional().isLength({ max: 100 }).trim(),
  body('phone_primary').isMobilePhone('any'),
  body('phone_secondary').optional().isMobilePhone('any'),
  body('email').optional().isEmail().normalizeEmail(),
  body('contact_type').isIn(['emergency', 'security', 'medical', 'fire_safety', 'administration', 'general'])
], asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw createError('Validation failed', 400, 'VALIDATION_ERROR');
  }

  const {
    facility_id,
    name,
    title,
    phone_primary,
    phone_secondary,
    email,
    contact_type
  } = req.body;

  // Verify facility exists
  const facilityCheck = await query('SELECT id FROM facilities WHERE id = $1', [facility_id]);
  if (facilityCheck.rows.length === 0) {
    throw createError('Facility not found', 404, 'FACILITY_NOT_FOUND');
  }

  const result = await query(`
    INSERT INTO emergency_contacts (
      facility_id, name, title, phone_primary, phone_secondary, email, contact_type
    ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *
  `, [facility_id, name, title, phone_primary, phone_secondary, email, contact_type]);

  res.status(201).json({
    message: 'Emergency contact created successfully',
    contact: result.rows[0]
  });
}));

// Update emergency contact
router.put('/contacts/:id', requireSecurity(), [
  body('name').optional().isLength({ min: 1, max: 100 }).trim(),
  body('title').optional().isLength({ max: 100 }).trim(),
  body('phone_primary').optional().isMobilePhone('any'),
  body('phone_secondary').optional().isMobilePhone('any'),
  body('email').optional().isEmail().normalizeEmail(),
  body('contact_type').optional().isIn(['emergency', 'security', 'medical', 'fire_safety', 'administration', 'general']),
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
    UPDATE emergency_contacts 
    SET ${setClause}, updated_at = NOW()
    WHERE id = $1
    RETURNING *
  `, values);

  if (result.rows.length === 0) {
    throw createError('Emergency contact not found', 404, 'CONTACT_NOT_FOUND');
  }

  res.json({
    message: 'Emergency contact updated successfully',
    contact: result.rows[0]
  });
}));

// Delete emergency contact
router.delete('/contacts/:id', requireSecurity(), asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const { id } = req.params;

  const result = await query(
    'UPDATE emergency_contacts SET is_active = false, updated_at = NOW() WHERE id = $1 RETURNING id',
    [id]
  );

  if (result.rows.length === 0) {
    throw createError('Emergency contact not found', 404, 'CONTACT_NOT_FOUND');
  }

  res.json({
    message: 'Emergency contact deactivated successfully'
  });
}));

// Get current visitors for evacuation (emergency personnel access)
router.get('/evacuation-list', requireSecurity(), [
  expressQuery('facility_id').isUUID()
], asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw createError('Validation failed', 400, 'VALIDATION_ERROR');
  }

  const { facility_id } = req.query;

  const result = await query(`
    SELECT 
      v.id as visit_id,
      vis.first_name,
      vis.last_name,
      vis.company,
      vis.phone,
      vis.emergency_contact_name,
      vis.emergency_contact_phone,
      v.actual_check_in,
      v.check_in_location,
      v.areas_authorized,
      v.escort_required,
      p.full_name as host_name,
      p.phone as host_phone,
      b.badge_number,
      b.access_zones
    FROM visits v
    JOIN visitors vis ON v.visitor_id = vis.id
    JOIN hosts h ON v.host_id = h.id
    JOIN profiles p ON h.profile_id = p.id
    LEFT JOIN badges b ON v.id = b.visit_id AND b.is_active = true
    WHERE v.facility_id = $1 
    AND v.status = 'checked_in'
    ORDER BY v.actual_check_in DESC
  `, [facility_id]);

  // Log emergency access
  await query(`
    INSERT INTO audit_logs (
      user_id, action, table_name, new_values, compliance_flags
    ) VALUES ($1, 'create', 'emergency_evacuation_list', $2, $3)
  `, [
    req.user!.id,
    JSON.stringify({
      facility_id,
      visitors_count: result.rows.length,
      access_reason: 'evacuation_list_request'
    }),
    ['EMERGENCY_ACCESS', 'SECURITY']
  ]);

  res.json({
    facility_id,
    current_visitors: result.rows,
    total_count: result.rows.length,
    generated_at: new Date().toISOString()
  });
}));

// Initiate emergency lockdown
router.post('/lockdown', requireSecurity(), [
  body('facility_id').isUUID(),
  body('reason').isLength({ min: 1, max: 500 }).trim(),
  body('lockdown_type').isIn(['full', 'partial', 'shelter_in_place'])
], asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw createError('Validation failed', 400, 'VALIDATION_ERROR');
  }

  const { facility_id, reason, lockdown_type } = req.body;

  await transaction(async (client) => {
    // Create security alert for lockdown
    const alertResult = await client.query(`
      INSERT INTO security_alerts (
        type, severity, message, facility_id
      ) VALUES ('emergency', 'critical', $1, $2)
      RETURNING *
    `, [`LOCKDOWN INITIATED: ${reason}`, facility_id]);

    // Get all current visitors
    const visitorsResult = await client.query(`
      SELECT v.id, vis.first_name, vis.last_name, p.full_name as host_name
      FROM visits v
      JOIN visitors vis ON v.visitor_id = vis.id
      JOIN hosts h ON v.host_id = h.id
      JOIN profiles p ON h.profile_id = p.id
      WHERE v.facility_id = $1 AND v.status = 'checked_in'
    `, [facility_id]);

    // Log lockdown initiation
    await client.query(`
      INSERT INTO audit_logs (
        user_id, action, table_name, new_values, compliance_flags
      ) VALUES ($1, 'create', 'emergency_lockdown', $2, $3)
    `, [
      req.user!.id,
      JSON.stringify({
        facility_id,
        lockdown_type,
        reason,
        affected_visitors: visitorsResult.rows.length,
        initiated_by: req.user!.full_name
      }),
      ['EMERGENCY_LOCKDOWN', 'SECURITY', 'CRITICAL']
    ]);

    res.json({
      message: 'Emergency lockdown initiated successfully',
      alert_id: alertResult.rows[0].id,
      affected_visitors: visitorsResult.rows.length,
      lockdown_details: {
        type: lockdown_type,
        reason,
        initiated_at: new Date().toISOString(),
        initiated_by: req.user!.full_name
      }
    });
  });
}));

// Get emergency procedures for a facility
router.get('/procedures', [
  expressQuery('facility_id').isUUID()
], asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw createError('Validation failed', 400, 'VALIDATION_ERROR');
  }

  const { facility_id } = req.query;

  const result = await query(`
    SELECT emergency_procedures, name, address
    FROM facilities
    WHERE id = $1 AND is_active = true
  `, [facility_id]);

  if (result.rows.length === 0) {
    throw createError('Facility not found', 404, 'FACILITY_NOT_FOUND');
  }

  res.json({
    facility: {
      id: facility_id,
      name: result.rows[0].name,
      address: result.rows[0].address
    },
    emergency_procedures: result.rows[0].emergency_procedures
  });
}));

// Emergency notification test
router.post('/test-notification', requireSecurity(), [
  body('facility_id').isUUID(),
  body('contact_types').isArray(),
  body('message').isLength({ min: 1, max: 500 }).trim()
], asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw createError('Validation failed', 400, 'VALIDATION_ERROR');
  }

  const { facility_id, contact_types, message } = req.body;

  // Get emergency contacts for specified types
  const contacts = await query(`
    SELECT *
    FROM emergency_contacts
    WHERE facility_id = $1 
    AND contact_type = ANY($2)
    AND is_active = true
    ORDER BY contact_type, name
  `, [facility_id, contact_types]);

  // Log test notification
  await query(`
    INSERT INTO audit_logs (
      user_id, action, table_name, new_values, compliance_flags
    ) VALUES ($1, 'create', 'emergency_notification_test', $2, $3)
  `, [
    req.user!.id,
    JSON.stringify({
      facility_id,
      contact_types,
      message,
      contacts_notified: contacts.rows.length,
      test_initiated_by: req.user!.full_name
    }),
    ['EMERGENCY_TEST', 'NOTIFICATION']
  ]);

  res.json({
    message: 'Emergency notification test completed',
    contacts_tested: contacts.rows.length,
    contacts: contacts.rows.map(contact => ({
      name: contact.name,
      type: contact.contact_type,
      phone: contact.phone_primary
    }))
  });
}));

export default router;