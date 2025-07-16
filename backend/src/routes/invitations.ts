import express from 'express';
import { body, query as expressQuery, param, validationResult } from 'express-validator';
import { query, transaction } from '../config/database';
import { asyncHandler, createError } from '../middleware/errorHandler';
import { AuthenticatedRequest, requireAnyRole, requireAdmin } from '../middleware/auth';
import { v4 as uuidv4 } from 'uuid';
import { notificationService } from '../services/notification';
import { QrCodeService } from '../services/qrCodeService';

const router = express.Router();

// Get invitations with filtering and pagination
router.get('/', [
  expressQuery('page').optional().isInt({ min: 1 }),
  expressQuery('limit').optional().isInt({ min: 1, max: 100 }),
  expressQuery('status').optional().isIn(['pending', 'approved', 'rejected', 'cancelled']),
  expressQuery('host_id').optional().isUUID(),
  expressQuery('facility_id').optional().isUUID(),
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
    SELECT i.*, 
           v.first_name as visitor_first_name,
           v.last_name as visitor_last_name,
           v.email as visitor_email,
           v.company as visitor_company,
           v.nationality as visitor_nationality,
           v.ssn as visitor_ssn,
           h.profile_id as host_profile_id,
           p.full_name as host_name,
           p.email as host_email,
           f.name as facility_name,
           ap.full_name as approver_name,
           COUNT(*) OVER() as total_count
    FROM invitations i
    LEFT JOIN visitors v ON i.visitor_id = v.id
    JOIN hosts h ON i.host_id = h.id
    JOIN profiles p ON h.profile_id = p.id
    JOIN facilities f ON i.facility_id = f.id
    LEFT JOIN profiles ap ON i.approver_id = ap.id
    WHERE i.tenant_id = $1
  `;

  const queryParams: any[] = [req.user!.tenant_id];
  let paramCount = 2;

  // Apply filters
  if (req.query.status) {
    queryText += ` AND i.status = $${paramCount++}`;
    queryParams.push(req.query.status);
  }

  if (req.query.host_id) {
    queryText += ` AND i.host_id = $${paramCount++}`;
    queryParams.push(req.query.host_id);
  }

  if (req.query.facility_id) {
    queryText += ` AND i.facility_id = $${paramCount++}`;
    queryParams.push(req.query.facility_id);
  }

  // Add search functionality
  if (req.query.search) {
    const searchTerm = `%${req.query.search}%`;
    queryText += ` AND (
      v.first_name ILIKE $${paramCount} OR
      v.last_name ILIKE $${paramCount} OR
      v.company ILIKE $${paramCount} OR
      p.full_name ILIKE $${paramCount} OR
      f.name ILIKE $${paramCount} OR
      i.purpose ILIKE $${paramCount}
    )`;
    queryParams.push(searchTerm);
    paramCount++;
  }

  // Role-based filtering
  if (req.user!.role === 'host') {
    // Hosts can only see their own invitations
    queryText += ` AND h.profile_id = $${paramCount++}`;
    queryParams.push(req.user!.id);
  } else if (req.user!.role === 'approver') {
    // Approvers see pending invitations or ones they've approved/rejected
    queryText += ` AND (i.status = 'pending' OR i.approver_id = $${paramCount++})`;
    queryParams.push(req.user!.id);
  }

  queryText += ` ORDER BY 
    CASE i.status 
      WHEN 'pending' THEN 1 
      WHEN 'approved' THEN 2 
      WHEN 'rejected' THEN 3 
      WHEN 'cancelled' THEN 4 
    END, i.scheduled_date ASC, i.created_at DESC 
    LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
  queryParams.push(limit, offset);

  const result = await query(queryText, queryParams);
  const totalCount = result.rows.length > 0 ? parseInt(result.rows[0].total_count) : 0;

  res.json({
    invitations: result.rows.map(row => {
      const { total_count, ...invitation } = row;
      return invitation;
    }),
    pagination: {
      page,
      limit,
      total: totalCount,
      pages: Math.ceil(totalCount / limit)
    }
  });
}));

// Get invitation by ID
router.get('/:id', [
  param('id').isUUID()
], asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw createError('Validation failed', 400, 'VALIDATION_ERROR');
  }

  const { id } = req.params;

  const result = await query(`
    SELECT i.*, 
           v.first_name as visitor_first_name,
           v.last_name as visitor_last_name,
           v.email as visitor_email,
           v.company as visitor_company,
           v.nationality as visitor_nationality,
           v.ssn as visitor_ssn,
           h.profile_id as host_profile_id,
           p.full_name as host_name,
           p.email as host_email,
           f.name as facility_name,
           ap.full_name as approver_name
    FROM invitations i
    LEFT JOIN visitors v ON i.visitor_id = v.id
    JOIN hosts h ON i.host_id = h.id
    JOIN profiles p ON h.profile_id = p.id
    JOIN facilities f ON i.facility_id = f.id
    LEFT JOIN profiles ap ON i.approver_id = ap.id
    WHERE i.id = $1 AND i.tenant_id = $2
  `, [id, req.user!.tenant_id]);

  if (result.rows.length === 0) {
    throw createError('Invitation not found', 404, 'INVITATION_NOT_FOUND');
  }

  // Check if user has access to this invitation
  const invitation = result.rows[0];
  if (req.user!.role === 'host' && invitation.host_profile_id !== req.user!.id) {
    throw createError('Access denied', 403, 'ACCESS_DENIED');
  }

  res.json({
    invitation: invitation
  });
}));

// Create new invitation (host role required)
router.post('/', requireAnyRole(['host', 'admin', 'reception']), [
  body('visitor_id').optional().isUUID(),
  body('first_name').optional().isLength({ min: 1, max: 100 }).trim(),
  body('last_name').optional().isLength({ min: 1, max: 100 }).trim(),
  body('email').optional().isEmail().normalizeEmail(),
  body('host_id').isUUID(),
  body('facility_id').isUUID(),
  body('purpose').isLength({ min: 1, max: 500 }).trim(),
  body('scheduled_date').isISO8601(),
  body('scheduled_start_time').optional().matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
  body('scheduled_end_time').optional().matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
  body('visitor_count').optional().isInt({ min: 1, max: 50 }),
  body('escort_required').optional().isBoolean(),
  body('security_approval_required').optional().isBoolean(),
  body('areas_authorized').optional().isArray(),
  body('special_instructions').optional().isLength({ max: 1000 }).trim(),
  body('vehicle_info').optional().isObject(),
  body('equipment_brought').optional().isArray(),
  body('pre_registration_required').optional().isBoolean(),
  body('nationality').optional().isString().isLength({ max: 50 }),
  body('ssn').optional().isString().isLength({ min: 4, max: 4 }).isNumeric(),
  // New recurrence fields
  body('recurrence_type').optional().isIn(['none', 'daily', 'weekly', 'monthly']),
  body('recurrence_interval').optional().isInt({ min: 1 }),
  body('recurrence_days_of_week').optional().isArray(), // e.g., [0, 1, 2] for Sun, Mon, Tue
  body('recurrence_end_date').optional().isISO8601()
], asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw createError('Validation failed', 400, 'VALIDATION_ERROR', errors.array());
  }

  const {
    visitor_id,
    first_name,
    last_name,
    email,
    company,
    phone,
    nationality,
    ssn,
    host_id,
    facility_id,
    purpose,
    scheduled_date,
    scheduled_start_time,
    scheduled_end_time,
    visitor_count,
    escort_required,
    security_approval_required,
    areas_authorized,
    special_instructions,
    vehicle_info,
    equipment_brought,
    pre_registration_required,
    // Recurrence fields
    recurrence_type = 'none',
    recurrence_interval,
    recurrence_days_of_week,
    recurrence_end_date
  } = req.body;
  

  // Validate that scheduled_date and scheduled_start_time are not in the past
  const now = new Date(); // Current local date/time on the server

  const [year, month, day] = scheduled_date.split('-').map(Number);
  const [hours, minutes] = scheduled_start_time ? scheduled_start_time.split(':').map(Number) : [0, 0];

  // Create a Date object for the scheduled time in the server's local timezone
  const scheduledDateTimeLocal = new Date(year, month - 1, day, hours, minutes, 0);

  // Get the current date part (without time) on the server
  const serverToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // Get the scheduled date part (without time)
  const scheduledDateOnly = new Date(year, month - 1, day);

  // Check if scheduled date is strictly in the past (e.g., 7/13 when server is 7/15)
  if (scheduledDateOnly < serverToday) {
    // Calculate difference in days
    const oneDayInMs = 24 * 60 * 60 * 1000;
    const diffMs = serverToday.getTime() - scheduledDateOnly.getTime();
    const diffDays = Math.round(diffMs / oneDayInMs); // Difference in days

    if (diffDays === 1) { // Scheduled date is exactly one day before server's current date
      // This is the timezone rollover scenario.
      // We need to check if the scheduled time (e.g., 10:29 PM) is still in the future
      // relative to the current time on the server (e.g., 9:39 AM next day).
      // To do this, we can compare the scheduled time with the current time,
      // but effectively "shift" the scheduled time to the current day for comparison.
      const scheduledTimeToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0);

      if (scheduledTimeToday < now) {
        // If the scheduled time (on today's date) is still in the past, then it's truly a past time.
        console.log(
          'Validation failed: Scheduled time on previous day is in the past relative to current time.',
          'Scheduled Time (shifted to today):', scheduledTimeToday.toISOString(),
          'Server Now:', now.toISOString()
        );
        throw createError(
          'Cannot create an invitation for a past date or time',
          400,
          'INVALID_DATE_TIME'
        );
      }
      // If scheduledTimeToday >= now, it means the user's "today" (server's "yesterday")
      // is still valid because the time is in the future. Allow it.
    } else {
      // More than one day in the past, definitely an error
      console.log(
        'Validation failed: Scheduled date is more than one day in the past.',
        'Scheduled Date:', scheduledDateOnly.toISOString(),
        'Server Today:', serverToday.toISOString()
      );
      throw createError(
        'Cannot create an invitation for a past date or time',
        400,
        'INVALID_DATE_TIME'
      );
    }
  } else if (scheduledDateOnly.getTime() === serverToday.getTime()) {
    // Scheduled date is today (on the server)
    // Check if the full scheduled date-time is in the past
    if (scheduledDateTimeLocal < now) {
      console.log(
        'Validation failed: Scheduled time on current date is in the past.',
        'Scheduled DateTime (Local):', scheduledDateTimeLocal.toISOString(),
        'Server Now (Local):', now.toISOString()
      );
      throw createError(
        'Cannot create an invitation for a past date or time',
        400,
        'INVALID_DATE_TIME'
      );
    }
  }
  // If scheduledDateOnly is in the future, no time check is needed.


  const validationErrors = validationResult(req);
  if (!validationErrors.isEmpty()) {
    throw createError('Validation failed', 400, 'VALIDATION_ERROR', validationErrors.array());
  }

  await transaction(async (client) => {
    // Verify host exists and is available
    const hostCheck = await client.query(
      'SELECT id, profile_id FROM hosts WHERE id = $1 AND is_available = true AND tenant_id = $2',
      [host_id, req.user!.tenant_id]
    );
    if (hostCheck.rows.length === 0) {
      throw createError('Host not found or unavailable', 404, 'HOST_NOT_AVAILABLE');
    }

    // Verify user is the host or has admin/reception role
    if (req.user!.role === 'host' && hostCheck.rows[0].profile_id !== req.user!.id) {
      throw createError('You can only create invitations for yourself as host', 403, 'ACCESS_DENIED');
    }

    // Verify facility exists and is active
    const facilityCheck = await client.query(
      'SELECT id FROM facilities WHERE id = $1 AND is_active = true AND tenant_id = $2',
      [facility_id, req.user!.tenant_id]
    );
    if (facilityCheck.rows.length === 0) {
      throw createError('Facility not found or inactive', 404, 'FACILITY_NOT_AVAILABLE');
    }

    // Handle visitor creation or verification
    let finalVisitorId = visitor_id;
    
    // If visitor_id is provided, verify the visitor exists
    if (finalVisitorId) {
      const visitorCheck = await client.query(
        'SELECT id FROM visitors WHERE id = $1 AND tenant_id = $2',
        [finalVisitorId, req.user!.tenant_id]
      );
      if (visitorCheck.rows.length === 0) {
        throw createError('Visitor not found', 404, 'VISITOR_NOT_FOUND');
      }
    } 
    // If visitor_id is not provided but we have first_name and last_name, create a new visitor
    else if (first_name && last_name) {
      console.log('Creating new visitor for invitation:', { first_name, last_name, email });
      
      // Create a new visitor record
      const newVisitorResult = await client.query(`
        INSERT INTO visitors (
          tenant_id, first_name, last_name, email, company, phone, 
          nationality, ssn, background_check_status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending')
        RETURNING id
      `, [
        req.user!.tenant_id,
        first_name,
        last_name,
        email || null,
        company || null,
        phone || null,
        nationality || null,
        ssn || null
      ]);
      
      finalVisitorId = newVisitorResult.rows[0].id;
      console.log('Created new visitor with ID:', finalVisitorId);
    } else {
      // If no visitor_id and no visitor details, throw an error
      throw createError(
        'Either an existing visitor ID or new visitor details (first_name, last_name) must be provided',
        400,
        'VISITOR_REQUIRED'
      );
    }

    // Pre-registration link will be generated only after approval
    // We'll just store the pre_registration_required flag for now

    // Store visitor details in metadata if creating a new visitor
    // No longer needed as we create the visitor record upfront

    // Create the invitation
    const invitationResult = await client.query(`
      INSERT INTO invitations (
        tenant_id, visitor_id, host_id, facility_id, purpose, scheduled_date,
        scheduled_start_time, scheduled_end_time, visitor_count,
        escort_required, security_approval_required, areas_authorized,
        special_instructions, vehicle_info, equipment_brought, created_by, status, 
        pre_registration_required, pre_registration_link, pre_registration_status,
        recurrence_type, recurrence_interval, recurrence_days_of_week, recurrence_end_date
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, 'pending', $17, NULL, NULL, $18, $19, $20, $21)
      RETURNING *
    `, [
      req.user!.tenant_id, 
      finalVisitorId, 
      host_id, 
      facility_id, 
      purpose, 
      scheduled_date,
      scheduled_start_time, scheduled_end_time, visitor_count || 1,
      escort_required || false, security_approval_required || false,
      areas_authorized, special_instructions, JSON.stringify(vehicle_info || {}),
      equipment_brought, 
      req.user!.id, 
      pre_registration_required || false,
      recurrence_type, 
      recurrence_interval, 
      recurrence_days_of_week, 
      recurrence_end_date
    ]);

    const newInvitation = invitationResult.rows[0];

    // If it's a recurring invitation, generate multiple visit records
    if (newInvitation.recurrence_type !== 'none') {
      let currentDate = new Date(newInvitation.scheduled_date);
      const endDate = newInvitation.recurrence_end_date ? new Date(newInvitation.recurrence_end_date) : null;
      const interval = newInvitation.recurrence_interval || 1;

      while (true) {
        if (endDate && currentDate > endDate) break;

        let shouldCreateVisit = false;
        if (newInvitation.recurrence_type === 'daily') {
          shouldCreateVisit = true;
        } else if (newInvitation.recurrence_type === 'weekly') {
          const dayOfWeek = currentDate.getDay(); // 0 for Sunday, 6 for Saturday
          if (newInvitation.recurrence_days_of_week && newInvitation.recurrence_days_of_week.includes(dayOfWeek)) {
            shouldCreateVisit = true;
          }
        } else if (newInvitation.recurrence_type === 'monthly') {
          // For monthly, assume it repeats on the same day of the month as scheduled_date
          if (currentDate.getDate() === new Date(newInvitation.scheduled_date).getDate()) {
            shouldCreateVisit = true;
          }
        }

        if (shouldCreateVisit) {
          // Create a visit record for this occurrence
          await client.query(`
            INSERT INTO visits (
              tenant_id, visitor_id, host_id, facility_id, purpose, scheduled_date,
              scheduled_start_time, scheduled_end_time, visitor_count,
              escort_required, security_approval_required, areas_authorized,
              special_instructions, vehicle_info, equipment_brought, created_by, status,
              pre_registration_required, pre_registration_link, pre_registration_status,
              recurring_invitation_id -- Link to the parent invitation
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, 'pre_registered', $17, $18, $19, $20)
          `, [
            req.user!.tenant_id, newInvitation.visitor_id, newInvitation.host_id, newInvitation.facility_id, newInvitation.purpose, currentDate.toISOString().split('T')[0],
            newInvitation.scheduled_start_time, newInvitation.scheduled_end_time, newInvitation.visitor_count,
            newInvitation.escort_required, newInvitation.security_approval_required, newInvitation.areas_authorized,
            newInvitation.special_instructions, newInvitation.vehicle_info, newInvitation.equipment_brought, req.user!.id,
            newInvitation.pre_registration_required, newInvitation.pre_registration_link, newInvitation.pre_registration_status,
            newInvitation.id // recurring_invitation_id
          ]);
        }

        // Advance date based on recurrence type and interval
        if (newInvitation.recurrence_type === 'daily') {
          currentDate.setDate(currentDate.getDate() + interval);
        } else if (newInvitation.recurrence_type === 'weekly') {
          currentDate.setDate(currentDate.getDate() + (7 * interval));
        } else if (newInvitation.recurrence_type === 'monthly') {
          currentDate.setMonth(currentDate.getMonth() + interval);
        } else {
          // Should not happen for recurring types
          break;
        }
      }
    }

    // Get the complete invitation details
    const invitationDetails = await client.query(`
      SELECT i.*, 
             v.first_name as visitor_first_name,
             v.last_name as visitor_last_name,
             v.email as visitor_email,
             v.company as visitor_company,
             v.nationality as visitor_nationality,
             v.ssn as visitor_ssn,
             h.profile_id as host_profile_id,
             p.full_name as host_name,
             p.email as host_email,
             f.name as facility_name
      FROM invitations i
      LEFT JOIN visitors v ON i.visitor_id = v.id
      JOIN hosts h ON i.host_id = h.id
      JOIN profiles p ON h.profile_id = p.id
      JOIN facilities f ON i.facility_id = f.id
      WHERE i.id = $1
    `, [newInvitation.id]);

    res.status(201).json({
      message: 'Invitation created successfully',
      invitation: invitationDetails.rows[0]
    });
  });
}));

// Approve invitation (approver role required)
router.post('/:id/approve', requireAnyRole(['approver', 'admin']), [
  param('id').isUUID()
], asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw createError('Validation failed', 400, 'VALIDATION_ERROR');
  }

  const { id } = req.params;

  await transaction(async (client) => {
    // Get invitation details
    const invitationResult = await client.query(`
      SELECT i.*, 
             h.profile_id as host_profile_id,
             p.full_name as host_name,
             p.email as host_email,
             f.name as facility_name,
             v.first_name as visitor_first_name,
             v.last_name as visitor_last_name,
             v.email as visitor_email
      FROM invitations i
      LEFT JOIN visitors v ON i.visitor_id = v.id
      JOIN hosts h ON i.host_id = h.id
      JOIN profiles p ON h.profile_id = p.id
      JOIN facilities f ON i.facility_id = f.id
      WHERE i.id = $1 AND i.tenant_id = $2
    `, [id, req.user!.tenant_id]);

    if (invitationResult.rows.length === 0) {
      throw createError('Invitation not found', 404, 'INVITATION_NOT_FOUND');
    }

    const invitation = invitationResult.rows[0];

    if (invitation.status !== 'pending') {
      throw createError('Invitation cannot be approved', 400, 'INVALID_STATUS');
    }

    // Update invitation status
    let result = await client.query(`
      UPDATE invitations 
      SET status = 'approved', 
          approver_id = $2,
          approved_at = NOW(),
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `, [id, req.user!.id]);

    // Generate pre-registration link if required
    if (invitation.pre_registration_required) {
      const token = uuidv4();
      const preRegistrationLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/pre-register/${token}`;
      
      // Update the invitation with the pre-registration link
      result = await client.query(`
        UPDATE invitations 
        SET pre_registration_link = $2,
            pre_registration_status = 'pending',
            updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `, [id, preRegistrationLink]);
    } else {
      // Generate QR code for approved invitations that don't require pre-registration
      try {
        const qrCodeData = await QrCodeService.generateQrCode(id, req.user!.tenant_id, client);
        console.log('QR code generated for invitation:', { invitationId: id, qrCodeData });
      } catch (error) {
        console.error('Failed to generate QR code for invitation:', error);
        // Continue with approval even if QR code generation fails
      }
    }

    // Create a visit from the approved invitation using the existing visitor_id
    const visitResult = await client.query(`
      INSERT INTO visits (
        tenant_id, visitor_id, host_id, facility_id, purpose, scheduled_date,
        scheduled_start_time, scheduled_end_time, visitor_count,
        escort_required, security_approval_required, areas_authorized,
        special_instructions, vehicle_info, equipment_brought, created_by, status,
        pre_registration_required, pre_registration_link, pre_registration_status,
        recurring_invitation_id -- Link to the parent invitation
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, 'pre_registered', $17, $18, $19, $20)
      RETURNING id
    `, [
      invitation.tenant_id, invitation.visitor_id, invitation.host_id, invitation.facility_id, 
      invitation.purpose, invitation.scheduled_date, invitation.scheduled_start_time, 
      invitation.scheduled_end_time, invitation.visitor_count, invitation.escort_required, 
      invitation.security_approval_required, invitation.areas_authorized,
      invitation.special_instructions, invitation.vehicle_info,
      invitation.equipment_brought, req.user!.id,
      invitation.pre_registration_required, 
      result.rows[0].pre_registration_link, // Use the updated pre-registration link
      result.rows[0].pre_registration_status, // Use the updated pre-registration status
      invitation.id // recurring_invitation_id
    ]);

    // Get the complete invitation details
    const invitationDetails = await client.query(`
      SELECT i.*, 
             v.first_name as visitor_first_name,
             v.last_name as visitor_last_name,
             v.email as visitor_email,
             v.company as visitor_company,
             v.nationality as visitor_nationality,
             v.ssn as visitor_ssn,
             h.profile_id as host_profile_id,
             p.full_name as host_name,
             p.email as host_email,
             f.name as facility_name,
             ap.full_name as approver_name
      FROM invitations i
      LEFT JOIN visitors v ON i.visitor_id = v.id
      JOIN hosts h ON i.host_id = h.id
      JOIN profiles p ON h.profile_id = p.id
      JOIN facilities f ON i.facility_id = f.id
      LEFT JOIN profiles ap ON i.approver_id = ap.id
      WHERE i.id = $1
    `, [id]);

    // Send notifications
    try {
      // Format the date for notifications
      const visitDate = new Date(invitation.scheduled_date).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

      // Get the pre-registration link from the updated invitation
      const preRegistrationLink = result.rows[0].pre_registration_link;

      // Send notifications to host and visitor
      await notificationService.sendInvitationApprovalNotifications({
        tenantId: req.user!.tenant_id,
        invitationId: id,
        hostName: invitation.host_name,
        hostEmail: invitation.host_email,
        visitorName: invitation.visitor_first_name && invitation.visitor_last_name 
          ? `${invitation.visitor_first_name} ${invitation.visitor_last_name}`
          : undefined,
        visitorEmail: invitation.visitor_email,
        facilityName: invitation.facility_name,
        visitDate,
        visitTime: invitation.scheduled_start_time,
        purpose: invitation.purpose,
        preRegistrationLink: preRegistrationLink,
        qrCodeData: !invitation.pre_registration_required ? await QrCodeService.getQrCodeImage(id, req.user!.tenant_id).catch(() => null) : null,
        organizationName: 'SecureGov VMS' // This could come from tenant settings
      });
    } catch (notificationError) {
      console.error('Failed to send notifications:', notificationError);
      // Don't fail the approval process if notifications fail
    }

    res.json({
      message: 'Invitation approved successfully',
      invitation: invitationDetails.rows[0],
      visit_id: visitResult.rows[0].id
    });
  });
}));

// Reject invitation (approver role required)
router.post('/:id/reject', requireAnyRole(['approver', 'admin']), [
  param('id').isUUID(),
  body('reason').isLength({ min: 1, max: 500 }).trim()
], asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const validationErrors = validationResult(req);
  if (!validationErrors.isEmpty()) {
    throw createError('Validation failed', 400, 'VALIDATION_ERROR');
  }

  const id = req.params.id;
  const reason = req.body.reason;

  await transaction(async (client) => {
    // Get invitation details
    const invitationResult = await client.query(
      'SELECT * FROM invitations WHERE id = $1 AND tenant_id = $2',
      [id, req.user!.tenant_id]
    );

    if (invitationResult.rows.length === 0) {
      throw createError('Invitation not found', 404, 'INVITATION_NOT_FOUND');
    }

    const invitation = invitationResult.rows[0];

    if (invitation.status !== 'pending') {
      throw createError('Invitation cannot be rejected', 400, 'INVALID_STATUS');
    }

    // Update invitation status
    const result = await client.query(`
      UPDATE invitations 
      SET status = 'rejected', 
          approver_id = $2,
          rejection_reason = $3,
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `, [id, req.user!.id, reason]);

    // Get the complete invitation details
    const invitationDetails = await client.query(`
      SELECT i.*, 
             v.first_name as visitor_first_name,
             v.last_name as visitor_last_name,
             v.email as visitor_email,
             v.company as visitor_company,
             v.nationality as visitor_nationality,
             v.ssn as visitor_ssn,
             h.profile_id as host_profile_id,
             p.full_name as host_name,
             p.email as host_email,
             f.name as facility_name,
             ap.full_name as approver_name
      FROM invitations i
      LEFT JOIN visitors v ON i.visitor_id = v.id
      JOIN hosts h ON i.host_id = h.id
      JOIN profiles p ON h.profile_id = p.id
      JOIN facilities f ON i.facility_id = f.id
      LEFT JOIN profiles ap ON i.approver_id = ap.id
      WHERE i.id = $1
    `, [id]);

    res.json({
      message: 'Invitation rejected successfully',
      invitation: invitationDetails.rows[0]
    });
  });
}));

// Cancel invitation (host or admin role required)
router.post('/:id/cancel', requireAnyRole(['host', 'admin']), [
  param('id').isUUID()
], asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const validationErrors = validationResult(req);
  if (!validationErrors.isEmpty()) {
    throw createError('Validation failed', 400, 'VALIDATION_ERROR');
  }

  const { id } = req.params;

  await transaction(async (client) => {
    // Get invitation details
    const invitationResult = await client.query(`
      SELECT i.*, h.profile_id as host_profile_id
      FROM invitations i
      JOIN hosts h ON i.host_id = h.id
      WHERE i.id = $1 AND i.tenant_id = $2
    `, [id, req.user!.tenant_id]);

    if (invitationResult.rows.length === 0) {
      throw createError('Invitation not found', 404, 'INVITATION_NOT_FOUND');
    }

    const invitation = invitationResult.rows[0];

    // Verify user is the host or has admin role
    if (req.user!.role === 'host' && invitation.host_profile_id !== req.user!.id) {
      throw createError('You can only cancel your own invitations', 403, 'ACCESS_DENIED');
    }

    if (invitation.status !== 'pending' && invitation.status !== 'approved') {
      throw createError('Invitation cannot be cancelled', 400, 'INVALID_STATUS');
    }

    // Update invitation status
    const result = await client.query(`
      UPDATE invitations 
      SET status = 'cancelled', 
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `, [id]);

    // Get the complete invitation details
    const invitationDetails = await client.query(`
      SELECT i.*, 
             v.first_name as visitor_first_name,
             v.last_name as visitor_last_name,
             v.email as visitor_email,
             v.company as visitor_company,
             v.nationality as visitor_nationality,
             v.ssn as visitor_ssn,
             h.profile_id as host_profile_id,
             p.full_name as host_name,
             p.email as host_email,
             f.name as facility_name,
             ap.full_name as approver_name
      FROM invitations i
      LEFT JOIN visitors v ON i.visitor_id = v.id
      JOIN hosts h ON i.host_id = h.id
      JOIN profiles p ON h.profile_id = p.id
      JOIN facilities f ON i.facility_id = f.id
      LEFT JOIN profiles ap ON i.approver_id = ap.id
      WHERE i.id = $1
    `, [id]);

    res.json({
      message: 'Invitation cancelled successfully',
      invitation: invitationDetails.rows[0]
    });
  });
}));

export default router;