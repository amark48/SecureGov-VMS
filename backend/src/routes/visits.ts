import express from 'express';
import { body, query as expressQuery, validationResult } from 'express-validator';
import { query, transaction } from '../config/database';
import { asyncHandler, createError } from '../middleware/errorHandler';
import { AuthenticatedRequest, requireReception } from '../middleware/auth';
import { QueryResult, DatabaseClient } from '../types/common';
import { VisitStatus } from '../types/visitor';
import ical, { ICalEventStatus } from 'ical-generator';
import { format as formatDate } from 'date-fns';
import { QrCodeService } from '../services/qrCodeService';

const router = express.Router();

// Define interface for visit database row
interface VisitRow {
  id: string;
  visitor_id: string;
  host_id: string;
  facility_id: string;
  purpose: string;
  scheduled_date: string;
  scheduled_start_time?: string;
  scheduled_end_time?: string;
  actual_check_in?: string;
  actual_check_out?: string;
  status: VisitStatus;
  badge_id?: string;
  visitor_count: number;
  escort_required: boolean;
  security_approval_required: boolean;
  security_approved_by?: string;
  security_approval_date?: string;
  areas_authorized?: string[];
  special_instructions?: string;
  check_in_location?: string;
  check_out_location?: string;
  vehicle_info?: any;
  equipment_brought?: string[];
  pre_registration_required?: boolean;
  pre_registration_link?: string;
  pre_registration_status?: string;
  created_by?: string;
  approved_by?: string;
  created_at: string;
  updated_at: string;
  recurrence_type?: string;
  recurrence_interval?: number;
  recurrence_days_of_week?: number[];
  recurrence_end_date?: string;
  parent_visit_id?: string;
  recurring_invitation_id?: string;
  // Joined fields
  first_name: string;
  last_name: string;
  email?: string;
  company?: string;
  host_profile_id: string;
  host_name: string;
  host_department?: string;
  facility_name: string;
  total_count: string;
  early_checkin_minutes?: number; // From tenants table
  checkin_grace_period_hours?: number; // From tenants table
}

interface TodaysVisitRow {
  id: string;
  visitor_id: string;
  host_id: string;
  facility_id: string;
  purpose: string;
  scheduled_date: string;
  scheduled_start_time?: string;
  scheduled_end_time?: string;
  actual_check_in?: string;
  actual_check_out?: string;
  status: VisitStatus;
  badge_id?: string;
  visitor_count: number;
  escort_required: boolean;
  security_approval_required: boolean;
  areas_authorized?: string[];
  special_instructions?: string;
  pre_registration_required?: boolean;
  pre_registration_link?: string;
  pre_registration_status?: string;
  recurrence_type?: string;
  recurrence_interval?: number;
  recurrence_days_of_week?: number[];
  recurrence_end_date?: string;
  parent_visit_id?: string;
  recurring_invitation_id?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
  // Joined fields
  first_name: string;
  last_name: string;
  email?: string;
  company?: string;
  host_profile_id: string;
  host_name: string;
  host_department?: string;
  facility_name: string;
  photo_url?: string;
}

interface VisitDetailRow {
  id: string;
  visitor_id: string;
  host_id: string;
  facility_id: string;
  purpose: string;
  scheduled_date: string;
  scheduled_start_time?: string;
  scheduled_end_time?: string;
  actual_check_in?: string;
  actual_check_out?: string;
  status: VisitStatus;
  badge_id?: string;
  visitor_count: number;
  escort_required: boolean;
  security_approval_required: boolean;
  areas_authorized?: string[];
  special_instructions?: string;
  check_in_location?: string;
  check_out_location?: string;
  vehicle_info?: any;
  equipment_brought?: string[];
  pre_registration_required?: boolean;
  pre_registration_link?: string;
  pre_registration_status?: string;
  recurrence_type?: string;
  recurrence_interval?: number;
  recurrence_days_of_week?: number[];
  recurrence_end_date?: string;
  parent_visit_id?: string;
  recurring_invitation_id?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
  // Visitor fields
  first_name: string;
  last_name: string;
  email?: string;
  company?: string;
  phone?: string;
  id_number?: string;
  id_type?: string;
  nationality?: string;
  ssn?: string;
  photo_url?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  // Host fields
  host_profile_id: string;
  host_name: string;
  host_department?: string;
  host_email?: string;
  // Facility fields
  facility_name: string;
  facility_address?: string;
  // Badge fields
  badge_number?: string;
  access_zones?: string[];
  badge_issued_at?: string;
  early_checkin_minutes?: number; // From tenants table
  checkin_grace_period_hours?: number; // From tenants table
}

interface VisitStatsRow {
  total_visits: string;
  pre_registered: string;
  checked_in: string;
  checked_out: string;
  cancelled: string;
  denied: string;
  today_visits: string;
  currently_on_site: string;
}

// Get all visits with filtering and pagination
router.get('/', [
  expressQuery('page').optional().isInt({ min: 1 }),
  expressQuery('limit').optional().isInt({ min: 1, max: 1000 }),
  expressQuery('facility_id').optional().isUUID(),
  expressQuery('status').optional().isIn(['pre_registered', 'checked_in', 'checked_out', 'cancelled', 'denied']),
  expressQuery('date').optional().isISO8601(),
  expressQuery('host_id').optional().isUUID(),
  expressQuery('start_date').optional().isISO8601(),
  expressQuery('end_date').optional().isISO8601()
], asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw createError('Validation failed', 400, 'VALIDATION_ERROR');
  }

  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const offset = (page - 1) * limit;

  let queryText = `
    SELECT v.*, 
           vis.first_name, vis.last_name, vis.email, vis.company,
           h.profile_id as host_profile_id,
           p.full_name as host_name, p.department as host_department,
           f.name as facility_name,
           t.early_checkin_minutes, t.checkin_grace_period_hours,
           v.recurrence_type, v.recurrence_interval, v.recurrence_days_of_week, 
           v.recurrence_end_date, v.parent_visit_id, v.recurring_invitation_id,
           COUNT(*) OVER() as total_count
    FROM visits v
    JOIN visitors vis ON v.visitor_id = vis.id
    JOIN hosts h ON v.host_id = h.id
    JOIN profiles p ON h.profile_id = p.id
    JOIN facilities f ON v.facility_id = f.id
    JOIN tenants t ON v.tenant_id = t.id
  `;
  
  const conditions: string[] = [];
  const queryParams: any[] = [];
  let paramCount = 1;

  // Apply filters
  if (req.query.facility_id) {
    conditions.push(`v.facility_id = $${paramCount++}`);
    queryParams.push(req.query.facility_id);
  }

  if (req.query.status) {
    conditions.push(`v.status = $${paramCount++}`);
    queryParams.push(req.query.status);
  }

  if (req.query.date) {
    conditions.push(`v.scheduled_date = $${paramCount++}`);
    queryParams.push(req.query.date);
  }

  if (req.query.host_id) {
    conditions.push(`v.host_id = $${paramCount++}`);
    queryParams.push(req.query.host_id);
  }

  // Date range filters
  if (req.query.start_date) {
    conditions.push(`v.scheduled_date >= $${paramCount++}`);
    queryParams.push(req.query.start_date);
  }

  if (req.query.end_date) {
    conditions.push(`v.scheduled_date <= $${paramCount++}`);
    queryParams.push(req.query.end_date);
  }

  // Role-based filtering
  if (req.user!.role === 'host') {
    conditions.push(`h.profile_id = $${paramCount++}`);
    queryParams.push(req.user!.id);
  }

  // Add tenant_id filter
  conditions.push(`v.tenant_id = $${paramCount++}`);
  queryParams.push(req.user!.tenant_id);
  
  // Add tenant_id filter for all joined tables to ensure tenant isolation
  conditions.push(`vis.tenant_id = $${paramCount++}`);
  queryParams.push(req.user!.tenant_id);
  
  conditions.push(`h.tenant_id = $${paramCount++}`);
  queryParams.push(req.user!.tenant_id);
  
  conditions.push(`f.tenant_id = $${paramCount++}`);
  queryParams.push(req.user!.tenant_id);

  if (conditions.length > 0) {
    queryText += ` WHERE ${conditions.join(' AND ')}`;
  }

  queryText += ` ORDER BY v.scheduled_date DESC, v.created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
  queryParams.push(limit, offset);

  const result = await query<VisitRow>(queryText, queryParams);
  
  // Debug: Log the visits query result
  console.log('Backend visits query result:', {
    count: result.rows.length,
    hasRecurringVisits: result.rows.some(row => row.recurrence_type && row.recurrence_type !== 'none'),
    firstVisit: result.rows.length > 0 ? {
      id: result.rows[0].id,
      recurrence_type: result.rows[0].recurrence_type,
      recurrence_interval: result.rows[0].recurrence_interval,
      recurrence_days_of_week: result.rows[0].recurrence_days_of_week,
      recurrence_end_date: result.rows[0].recurrence_end_date
    } : null
  });
  
  const totalCount = result.rows.length > 0 ? parseInt(result.rows[0].total_count) : 0;

  res.json({
    visits: result.rows.map((row: VisitRow) => {
      const { total_count, ...visit } = row;
      return visit;
    }),
    pagination: {
      page,
      limit,
      total: totalCount,
      pages: Math.ceil(totalCount / limit)
    }
  });
}));

// Get today's visits
router.get('/today', asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  let queryText = `
    SELECT v.*, 
           vis.first_name, vis.last_name, vis.email, vis.company, vis.photo_url,
           h.profile_id as host_profile_id,
           p.full_name as host_name, p.department as host_department,
           f.name as facility_name,
           t.early_checkin_minutes, t.checkin_grace_period_hours,
           v.recurrence_type, v.recurrence_interval, v.recurrence_days_of_week, 
           v.recurrence_end_date, v.parent_visit_id, v.recurring_invitation_id
    FROM visits v
    JOIN visitors vis ON v.visitor_id = vis.id
    JOIN hosts h ON v.host_id = h.id
    JOIN profiles p ON h.profile_id = p.id
    JOIN facilities f ON v.facility_id = f.id
    JOIN tenants t ON v.tenant_id = t.id
    WHERE v.scheduled_date = CURRENT_DATE
    AND v.tenant_id = $1
    AND vis.tenant_id = $1
    AND h.tenant_id = $1
    AND f.tenant_id = $1
  `;

  const queryParams: any[] = [req.user!.tenant_id];
  let paramCount = 2;

  // Role-based filtering
  if (req.user!.role === 'host') {
    queryText += ` AND h.profile_id = $${paramCount++}`;
    queryParams.push(req.user!.id);
  }

  queryText += ` ORDER BY v.scheduled_start_time ASC NULLS LAST, v.created_at DESC`;

  const result = await query<TodaysVisitRow>(queryText, queryParams);

  res.json({
    visits: result.rows
  });
}));

// Get visit by ID
router.get('/:id', asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const { id } = req.params;

  let queryText = `
    SELECT v.*, 
           vis.first_name, vis.last_name, vis.email, vis.company, vis.phone,
           vis.id_number, vis.id_type, vis.nationality, vis.ssn, vis.photo_url, vis.emergency_contact_name, vis.emergency_contact_phone,
           h.profile_id as host_profile_id,
           p.full_name as host_name, p.department as host_department, p.email as host_email,
           f.name as facility_name, f.address as facility_address,
           b.badge_number, b.access_zones, b.issued_at as badge_issued_at,
           t.early_checkin_minutes, t.checkin_grace_period_hours
    FROM visits v
    JOIN visitors vis ON v.visitor_id = vis.id
    JOIN hosts h ON v.host_id = h.id
    JOIN profiles p ON h.profile_id = p.id
    JOIN facilities f ON v.facility_id = f.id
    JOIN tenants t ON v.tenant_id = t.id
    LEFT JOIN badges b ON v.id = b.visit_id AND b.is_active = true
    WHERE v.id = $1
    AND v.tenant_id = $2
    AND vis.tenant_id = $2
    AND h.tenant_id = $2
    AND f.tenant_id = $2
  `;

  const queryParams = [id, req.user!.tenant_id];
  let paramCount = 3;

  // Role-based access control
  if (req.user!.role === 'host') {
    queryText += ` AND h.profile_id = $${paramCount}`;
    queryParams.push(req.user!.id);
  }

  const result = await query<VisitDetailRow>(queryText, queryParams);

  if (result.rows.length === 0) {
    throw createError('Visit not found', 404, 'VISIT_NOT_FOUND');
  }
  
  // Debug: Log the visit details
  console.log('Backend visit details:', result.rows[0]);

  res.json({
    visit: result.rows[0]
  });
}));

// Create new visit
router.post('/', requireReception(), [
  body('visitor_id').isUUID().withMessage('Valid visitor ID is required'),
  body('host_id').isUUID().withMessage('Valid host ID is required'),
  body('facility_id').isUUID().withMessage('Valid facility ID is required'),
  body('purpose').isLength({ min: 1, max: 500 }).trim().withMessage('Purpose is required'),
  body('scheduled_date').isISO8601().withMessage('Valid scheduled date is required'),
  body('scheduled_start_time').optional().matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Invalid start time format'),
  body('scheduled_end_time').optional().matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Invalid end time format'),
  body('visitor_count').optional().isInt({ min: 1, max: 50 }).withMessage('Visitor count must be between 1 and 50'),
  body('escort_required').optional().isBoolean().withMessage('Escort required must be a boolean'),
  body('security_approval_required').optional().isBoolean().withMessage('Security approval required must be a boolean'),
  body('areas_authorized').optional().isArray().withMessage('Areas authorized must be an array'),
  body('special_instructions').optional().isLength({ max: 1000 }).trim().withMessage('Special instructions too long'),
  body('vehicle_info').optional().isObject().withMessage('Vehicle info must be an object'),
  body('equipment_brought').optional().isArray().withMessage('Equipment brought must be an array'),
  body('pre_registration_required').optional().isBoolean().withMessage('Pre-registration required must be a boolean')
], asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw createError('Validation failed', 400, 'VALIDATION_ERROR', errors.array());
  }

  const {
    visitor_id,
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
    pre_registration_required
  } = req.body;

  await transaction(async (client: DatabaseClient) => {
    // Verify visitor exists and belongs to the user's tenant
    const visitorCheck = await client.query('SELECT id FROM visitors WHERE id = $1 AND tenant_id = $2', [visitor_id, req.user!.tenant_id]);
    if (visitorCheck.rows.length === 0) {
      throw createError('Visitor not found', 404, 'VISITOR_NOT_FOUND');
    }

    // Verify host exists, is available, and belongs to the user's tenant
    const hostCheck = await client.query(
      'SELECT id FROM hosts WHERE id = $1 AND is_available = true AND tenant_id = $2',
      [host_id, req.user!.tenant_id]
    );
    if (hostCheck.rows.length === 0) {
      throw createError('Host not found or unavailable', 404, 'HOST_NOT_AVAILABLE');
    }

    // Verify facility exists, is active, and belongs to the user's tenant
    const facilityCheck = await client.query(
      'SELECT id FROM facilities WHERE id = $1 AND is_active = true AND tenant_id = $2',
      [facility_id, req.user!.tenant_id]
    );
    if (facilityCheck.rows.length === 0) {
      throw createError('Facility not found or inactive', 404, 'FACILITY_NOT_AVAILABLE');
    }

    // Pre-registration link will be generated only after approval if required
    // For direct visit creation, pre_registration_link and status are null initially
    const preRegistrationLink = null;
    const preRegistrationStatus = null;
    
    // Create the visit
    const result = await client.query(`
      INSERT INTO visits (
        tenant_id, visitor_id, host_id, facility_id, purpose, scheduled_date,
        scheduled_start_time, scheduled_end_time, visitor_count,
        escort_required, security_approval_required, areas_authorized,
        special_instructions, vehicle_info, equipment_brought, created_by, status,
        pre_registration_required, pre_registration_link, pre_registration_status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, 'pre_registered', $17, $18, $19)
      RETURNING *
    `, [
      req.user!.tenant_id, visitor_id, host_id, facility_id, purpose, scheduled_date,
      scheduled_start_time, scheduled_end_time, visitor_count || 1,
      escort_required || false, security_approval_required || false,
      areas_authorized, JSON.stringify(special_instructions || null), JSON.stringify(vehicle_info || {}),
      equipment_brought, req.user!.id,
      pre_registration_required || false,
      preRegistrationLink, preRegistrationStatus
    ]);

    // Get the complete visit details for response
    const visitDetailsResult = await client.query(`
      SELECT v.*, 
             vis.first_name, vis.last_name, vis.email, vis.company,
             h.profile_id as host_profile_id,
             p.full_name as host_name, p.email as host_email,
             f.name as facility_name,
             b.badge_number, b.access_zones, b.issued_at as badge_issued_at,
             t.early_checkin_minutes, t.checkin_grace_period_hours,
             v.recurrence_type, v.recurrence_interval, v.recurrence_days_of_week, 
             v.recurrence_end_date, v.parent_visit_id, v.recurring_invitation_id
      FROM visits v
      JOIN visitors vis ON v.visitor_id = vis.id
      JOIN hosts h ON v.host_id = h.id
      JOIN profiles p ON h.profile_id = p.id
      JOIN facilities f ON v.facility_id = f.id
      JOIN tenants t ON v.tenant_id = t.id
      LEFT JOIN badges b ON v.id = b.visit_id AND b.is_active = true
      WHERE v.id = $1
    `, [result.rows[0].id]);

    res.status(201).json({
      message: 'Visit created successfully',
      visit: visitDetailsResult.rows[0]
    });
  });
}));

// Update visit
router.put('/:id', requireReception(), [
  body('purpose').optional().isLength({ min: 1, max: 500 }).trim(),
  body('scheduled_date').optional().isISO8601(),
  body('scheduled_start_time').optional().matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
  body('scheduled_end_time').optional().matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
  body('visitor_count').optional().isInt({ min: 1, max: 50 }),
  body('escort_required').optional().isBoolean(),
  body('areas_authorized').optional().isArray(),
  body('special_instructions').optional().isLength({ max: 1000 }).trim(),
  body('vehicle_info').optional().isObject(),
  body('equipment_brought').optional().isArray(),
  body('status').optional().isIn(['pre_registered', 'checked_in', 'checked_out', 'cancelled', 'denied']),
  body('pre_registration_required').optional().isBoolean()
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

  const setClause = updateFields.map((field: string, index: number) => {
    if (field === 'vehicle_info') {
      return `${field} = $${index + 2}::jsonb`;
    }
    return `${field} = $${index + 2}`;
  }).join(', ');

  const values = [
    id,
    ...updateFields.map((field: string) => 
      field === 'vehicle_info' ? JSON.stringify(updates[field]) : updates[field]
    )
  ];

  // Add tenant_id check to ensure tenant isolation
  values.push(req.user!.tenant_id);

  const result = await query<any>(`
    UPDATE visits 
    SET ${setClause}, updated_at = NOW()
    WHERE id = $1 AND tenant_id = $${values.length}
    RETURNING *
  `, values);

  if (result.rows.length === 0) {
    throw createError('Visit not found', 404, 'VISIT_NOT_FOUND');
  }

  res.json({
    message: 'Visit updated successfully',
    visit: result.rows[0]
  });
}));

// Check in visitor
router.post('/:id/check-in', requireReception(), [
  body('location').optional().isLength({ max: 200 }).trim()
], asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw createError('Validation failed', 400, 'VALIDATION_ERROR', errors.array());
  }

  const { id } = req.params;
  const { location } = req.body;

  await transaction(async (client: DatabaseClient) => {
    // Get visit details with tenant's check-in settings
    const visitResult = await client.query(`
      SELECT v.*, t.early_checkin_minutes, t.checkin_grace_period_hours 
      FROM visits v 
      JOIN tenants t ON v.tenant_id = t.id 
      WHERE v.id = $1 AND v.tenant_id = $2`,
      [id, req.user!.tenant_id]
    );

    if (visitResult.rows.length === 0) {
      throw createError('Visit not found', 404, 'VISIT_NOT_FOUND');
    }

    const visit = visitResult.rows[0];

    if (visit.status !== 'pre_registered') {
      throw createError('Visit cannot be checked in. Current status: ' + visit.status, 400, 'INVALID_STATUS');
    }

    // Check if the visit can be checked in based on time constraints
    const now = new Date();
    const scheduledDateObj = new Date(visit.scheduled_date);
    
    // If the visit has a scheduled time, use it for validation
    if (visit.scheduled_start_time) {
      const [hours, minutes] = visit.scheduled_start_time.split(':').map(Number);
      
      // Set the scheduled time on the scheduled date
      scheduledDateObj.setHours(hours, minutes, 0, 0);
      
      // Check for early check-in
      const earlyCheckinMinutes = visit.early_checkin_minutes || 0;
      const earliestCheckinTime = new Date(scheduledDateObj.getTime() - earlyCheckinMinutes * 60 * 1000);
      
      if (now < earliestCheckinTime) {
        throw createError(
          `Check-in is too early. Earliest check-in time is ${earliestCheckinTime.toLocaleTimeString()}`,
          400,
          'EARLY_CHECKIN_NOT_ALLOWED'
        );
      }
      
      // Check for late check-in based on grace period in hours
      const graceHours = visit.checkin_grace_period_hours || 24; // Default to 24 hours if not set
      const latestCheckinTime = new Date(scheduledDateObj.getTime() + graceHours * 60 * 60 * 1000);
      
      if (now > latestCheckinTime) {
        throw createError(
          `Check-in grace period has expired. This visit can no longer be checked in.`,
          400,
          'CHECKIN_GRACE_PERIOD_EXPIRED'
        );
      }
    } else {
      // If no specific time, check if the scheduled date is in the past
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // If scheduled date is before today, check grace period
      if (scheduledDateObj < today) {
        const graceHours = visit.checkin_grace_period_hours || 24;
        const hoursDifference = Math.floor((now.getTime() - scheduledDateObj.getTime()) / (1000 * 60 * 60));
        
        if (hoursDifference > graceHours) {
          throw createError(
            `Check-in grace period of ${graceHours} hours has expired. This visit can no longer be checked in.`,
            400,
            'CHECKIN_GRACE_PERIOD_EXPIRED'
          );
        }
      }
    }

    // Update visit status
    const result = await client.query(`
      UPDATE visits 
      SET status = 'checked_in', 
          actual_check_in = NOW(),
          check_in_location = $2,
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `, [id, location]);

    res.json({
      message: 'Visitor checked in successfully',
      visit: result.rows[0]
    });
  });
}));

// Check in visitor using QR code token
router.post('/qr-check-in', requireReception(), [
  body('qr_token').isUUID().withMessage('Valid QR code token is required'),
  body('location').optional().isLength({ max: 200 }).trim()
], asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw createError('Validation failed', 400, 'VALIDATION_ERROR', errors.array());
  }

  const { qr_token, location } = req.body;

  await transaction(async (client: DatabaseClient) => {
    // Validate QR code and get invitation data
    const invitationData = await QrCodeService.validateQrToken(qr_token);
    
    // Find the corresponding visit
    const visitResult = await client.query(`
      SELECT v.*, t.early_checkin_minutes, t.checkin_grace_period_hours 
      FROM visits v 
      JOIN tenants t ON v.tenant_id = t.id 
      WHERE v.visitor_id = $1 
      AND v.host_id = $2 
      AND v.facility_id = $3 
      AND v.scheduled_date = $4
      AND v.tenant_id = $5
      AND v.status = 'pre_registered'
      ORDER BY v.created_at DESC
      LIMIT 1`,
      [
        invitationData.visitor_id,
        invitationData.host_id,
        invitationData.facility_id,
        invitationData.scheduled_date,
        req.user!.tenant_id
      ]
    );

    if (visitResult.rows.length === 0) {
      throw createError('No matching visit found for QR code', 404, 'VISIT_NOT_FOUND');
    }

    const visit = visitResult.rows[0];
    const visitId = visit.id;

    // Check if the visit can be checked in based on time constraints
    const now = new Date();
    const scheduledDateObj = new Date(visit.scheduled_date);
    
    // If the visit has a scheduled time, use it for validation
    if (visit.scheduled_start_time) {
      const [hours, minutes] = visit.scheduled_start_time.split(':').map(Number);
      
      // Set the scheduled time on the scheduled date
      scheduledDateObj.setHours(hours, minutes, 0, 0);
      
      // Check for early check-in
      const earlyCheckinMinutes = visit.early_checkin_minutes || 0;
      const earliestCheckinTime = new Date(scheduledDateObj.getTime() - earlyCheckinMinutes * 60 * 1000);
      
      if (now < earliestCheckinTime) {
        throw createError(
          `Check-in is too early. Earliest check-in time is ${earliestCheckinTime.toLocaleTimeString()}`,
          400,
          'EARLY_CHECKIN_NOT_ALLOWED'
        );
      }
      
      // Check for late check-in based on grace period in hours
      const graceHours = visit.checkin_grace_period_hours || 24; // Default to 24 hours if not set
      const latestCheckinTime = new Date(scheduledDateObj.getTime() + graceHours * 60 * 60 * 1000);
      
      if (now > latestCheckinTime) {
        throw createError(
          `Check-in grace period has expired. This visit can no longer be checked in.`,
          400,
          'CHECKIN_GRACE_PERIOD_EXPIRED'
        );
      }
    } else {
      // If no specific time, check if the scheduled date is in the past
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // If scheduled date is before today, check grace period
      if (scheduledDateObj < today) {
        const graceHours = visit.checkin_grace_period_hours || 24;
        const hoursDifference = Math.floor((now.getTime() - scheduledDateObj.getTime()) / (1000 * 60 * 60));
        
        if (hoursDifference > graceHours) {
          throw createError(
            `Check-in grace period of ${graceHours} hours has expired. This visit can no longer be checked in.`,
            400,
            'CHECKIN_GRACE_PERIOD_EXPIRED'
          );
        }
      }
    }

    // Update visit status
    const result = await client.query(`
      UPDATE visits 
      SET status = 'checked_in', 
          actual_check_in = NOW(),
          check_in_location = $2,
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `, [visitId, location]);

    res.json({
      message: 'Visitor checked in successfully via QR code',
      visit: result.rows[0]
    });
  });
}));

// Check out visitor
router.post('/:id/check-out', requireReception(), [
  body('location').optional().isLength({ max: 200 }).trim()
], asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw createError('Validation failed', 400, 'VALIDATION_ERROR', errors.array());
  }

  const { id } = req.params;
  const { location } = req.body;

  await transaction(async (client: DatabaseClient) => {
    // Get visit details
    const visitResult = await client.query(
      'SELECT status FROM visits WHERE id = $1 AND tenant_id = $2',
      [id, req.user!.tenant_id]
    );

    if (visitResult.rows.length === 0) {
      throw createError('Visit not found', 404, 'VISIT_NOT_FOUND');
    }

    const visit = visitResult.rows[0];

    if (visit.status !== 'checked_in') {
      throw createError('Visit cannot be checked out. Current status: ' + visit.status, 400, 'INVALID_STATUS');
    }

    // Update visit status
    const result = await client.query(`
      UPDATE visits 
      SET status = 'checked_out', 
          actual_check_out = NOW(),
          check_out_location = $2,
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `, [id, location]);

    // Deactivate any active badges
    await client.query(
      'UPDATE badges SET is_active = false, returned_at = NOW() WHERE visit_id = $1 AND is_active = true',
      [id]
    );

    res.json({
      message: 'Visitor checked out successfully',
      visit: result.rows[0]
    });
  });
}));

// Get visit statistics
router.get('/stats/overview', asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const stats = await query<VisitStatsRow>(`
    SELECT 
      COUNT(*) as total_visits,
      COUNT(*) FILTER (WHERE status = 'pre_registered') as pre_registered,
      COUNT(*) FILTER (WHERE status = 'checked_in') as checked_in,
      COUNT(*) FILTER (WHERE status = 'checked_out') as checked_out,
      COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled,
      COUNT(*) FILTER (WHERE status = 'denied') as denied,
      COUNT(*) FILTER (WHERE scheduled_date = CURRENT_DATE) as today_visits,
      COUNT(*) FILTER (WHERE scheduled_date = CURRENT_DATE AND status = 'checked_in') as currently_on_site
    FROM visits
    WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
    AND tenant_id = $1
  `, [req.user!.tenant_id]);

  res.json({
    stats: stats.rows[0]
  });
}));

// Export calendar
router.get('/export-calendar', [
  expressQuery('format').optional().isIn(['ics', 'json']),
  expressQuery('start_date').optional().isISO8601(),
  expressQuery('end_date').optional().isISO8601(),
  expressQuery('facility_id').optional().isUUID(),
  expressQuery('host_id').optional().isUUID(),
  expressQuery('status').optional().isIn(['pre_registered', 'checked_in', 'checked_out', 'cancelled', 'denied'])
], asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw createError('Validation failed', 400, 'VALIDATION_ERROR');
  }

  const format = req.query.format as string || 'ics';
  const startDate = req.query.start_date as string || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const endDate = req.query.end_date as string || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const facilityId = req.query.facility_id as string;
  const hostId = req.query.host_id as string;
  const status = req.query.status as string;

  // Build query
  let queryText = `
    SELECT v.*, 
           vis.first_name, vis.last_name, vis.email, vis.company,
           h.profile_id as host_profile_id,
           p.full_name as host_name, p.email as host_email,
           f.name as facility_name, f.address as facility_address
    FROM visits v
    JOIN visitors vis ON v.visitor_id = vis.id
    JOIN hosts h ON v.host_id = h.id
    JOIN profiles p ON h.profile_id = p.id
    JOIN facilities f ON v.facility_id = f.id
    WHERE v.scheduled_date BETWEEN $1 AND $2
    AND v.tenant_id = $3
    AND vis.tenant_id = $3
    AND h.tenant_id = $3
    AND f.tenant_id = $3
  `;

  const queryParams: any[] = [startDate, endDate, req.user!.tenant_id];
  let paramCount = 4;

  // Add facility filter
  if (facilityId) {
    queryText += ` AND v.facility_id = $${paramCount++}`;
    queryParams.push(facilityId);
  }

  // Add host filter
  if (hostId) {
    queryText += ` AND v.host_id = $${paramCount++}`;
    queryParams.push(hostId);
  }

  // Add status filter
  if (status) {
    queryText += ` AND v.status = $${paramCount++}`;
    queryParams.push(status);
  }

  // Role-based filtering
  if (req.user!.role === 'host') {
    queryText += ` AND h.profile_id = $${paramCount++}`;
    queryParams.push(req.user!.id);
  }

  queryText += ` ORDER BY v.scheduled_date, v.scheduled_start_time NULLS FIRST`;

  const result = await query(queryText, queryParams);

  if (format === 'json') {
    // Debug: Log the calendar export data
    console.log('Calendar export data:', {
      count: result.rows.length,
      hasRecurringVisits: result.rows.some(row => row.recurrence_type && row.recurrence_type !== 'none')
    });
    
    res.json({
      visits: result.rows
    });
  } else {
    // Generate iCalendar file
    const calendar = ical({
      name: 'SecureGov VMS - Visits',
      timezone: 'America/New_York',
      prodId: { company: 'SecureGov', product: 'VMS' }
    });

    result.rows.forEach(visit => {
      const eventStartDate = new Date(`${visit.scheduled_date}T${visit.scheduled_start_time || '09:00:00'}`);
      const eventEndDate = new Date(`${visit.scheduled_date}T${visit.scheduled_end_time || '17:00:00'}`);
      
      const event = calendar.createEvent({
        start: eventStartDate,
        end: eventEndDate,
        summary: `Visit: ${visit.first_name} ${visit.last_name}`,
        description: `Purpose: ${visit.purpose}\nHost: ${visit.host_name}\nFacility: ${visit.facility_name}\nStatus: ${visit.status}`,
        location: visit.facility_address || visit.facility_name,
        url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/visits/${visit.id}`,
        organizer: {
          name: visit.host_name,
          email: visit.host_email || 'no-reply@securegov-vms.com'
        }
      });
      
      // Set the status based on visit status
      if (visit.status === 'cancelled') {
        event.status(ICalEventStatus.CANCELLED);
      } else {
        event.status(ICalEventStatus.CONFIRMED);
      }
    });

    res.set('Content-Type', 'text/calendar');
    res.set('Content-Disposition', `attachment; filename="visits-${formatDate(new Date(), 'yyyy-MM-dd')}.ics"`);
    res.send(calendar.toString());
  }
}));

export default router;