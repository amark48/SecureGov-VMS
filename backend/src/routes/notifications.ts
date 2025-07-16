import express from 'express';
import { body, query as expressQuery, param, validationResult } from 'express-validator';
import { query, transaction } from '../config/database';
import { asyncHandler, createError } from '../middleware/errorHandler';
import { AuthenticatedRequest, requireAdmin, requireAnyRole } from '../middleware/auth';

const router = express.Router();

// Get all notification templates
router.get('/templates', asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const result = await query(`
    SELECT *
    FROM notification_templates
    WHERE tenant_id = $1
    ORDER BY type, event, name
  `, [req.user!.tenant_id]);

  res.json({
    templates: result.rows
  });
}));

// Get notification template by ID
router.get('/templates/:id', [
  param('id').isUUID()
], asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw createError('Validation failed', 400, 'VALIDATION_ERROR');
  }

  const { id } = req.params;

  const result = await query(`
    SELECT *
    FROM notification_templates
    WHERE id = $1 AND tenant_id = $2
  `, [id, req.user!.tenant_id]);

  if (result.rows.length === 0) {
    throw createError('Template not found', 404, 'TEMPLATE_NOT_FOUND');
  }

  res.json({
    template: result.rows[0]
  });
}));

// Create notification template
router.post('/templates', requireAdmin(), [
  body('name').isLength({ min: 1, max: 100 }).trim(),
  body('subject').optional().isLength({ max: 200 }).trim(),
  body('body').isLength({ min: 1 }).trim(),
  body('type').isIn(['email', 'sms', 'push']),
  body('event').isLength({ min: 1, max: 50 }).trim(),
  body('is_active').optional().isBoolean(),
  body('is_default').optional().isBoolean()
], asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw createError('Validation failed', 400, 'VALIDATION_ERROR');
  }

  const {
    name,
    subject,
    body,
    type,
    event,
    is_active = true,
    is_default = false
  } = req.body;

  await transaction(async (client) => {
    // If this is set as default, unset any existing default for this type and event
    if (is_default) {
      await client.query(`
        UPDATE notification_templates
        SET is_default = false
        WHERE tenant_id = $1 AND type = $2 AND event = $3 AND is_default = true
      `, [req.user!.tenant_id, type, event]);
    }

    const result = await client.query(`
      INSERT INTO notification_templates (
        tenant_id, name, subject, body, type, event, is_active, is_default, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [
      req.user!.tenant_id,
      name,
      subject,
      body,
      type,
      event,
      is_active,
      is_default,
      req.user!.id
    ]);

    res.status(201).json({
      message: 'Notification template created successfully',
      template: result.rows[0]
    });
  });
}));

// Update notification template
router.put('/templates/:id', requireAdmin(), [
  param('id').isUUID(),
  body('name').optional().isLength({ min: 1, max: 100 }).trim(),
  body('subject').optional().isLength({ max: 200 }).trim(),
  body('body').optional().isLength({ min: 1 }).trim(),
  body('type').optional().isIn(['email', 'sms', 'push']),
  body('event').optional().isLength({ min: 1, max: 50 }).trim(),
  body('is_active').optional().isBoolean(),
  body('is_default').optional().isBoolean()
], asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw createError('Validation failed', 400, 'VALIDATION_ERROR');
  }

  const { id } = req.params;
  const updates = req.body;

  await transaction(async (client) => {
    // Check if template exists and belongs to the tenant
    const templateCheck = await client.query(`
      SELECT type, event FROM notification_templates
      WHERE id = $1 AND tenant_id = $2
    `, [id, req.user!.tenant_id]);

    if (templateCheck.rows.length === 0) {
      throw createError('Template not found', 404, 'TEMPLATE_NOT_FOUND');
    }

    const currentType = updates.type || templateCheck.rows[0].type;
    const currentEvent = updates.event || templateCheck.rows[0].event;

    // If this is set as default, unset any existing default for this type and event
    if (updates.is_default) {
      await client.query(`
        UPDATE notification_templates
        SET is_default = false
        WHERE tenant_id = $1 AND type = $2 AND event = $3 AND is_default = true AND id != $4
      `, [req.user!.tenant_id, currentType, currentEvent, id]);
    }

    // Build dynamic update query
    const updateFields = Object.keys(updates).filter(key => updates[key] !== undefined);
    if (updateFields.length === 0) {
      throw createError('No updates provided', 400, 'NO_UPDATES');
    }

    const setClause = updateFields.map((field, index) => `${field} = $${index + 3}`).join(', ');
    const values = [id, req.user!.tenant_id, ...updateFields.map(field => updates[field])];

    const result = await client.query(`
      UPDATE notification_templates
      SET ${setClause}, updated_at = NOW()
      WHERE id = $1 AND tenant_id = $2
      RETURNING *
    `, values);

    if (result.rows.length === 0) {
      throw createError('Template not found', 404, 'TEMPLATE_NOT_FOUND');
    }

    res.json({
      message: 'Notification template updated successfully',
      template: result.rows[0]
    });
  });
}));

// Delete notification template
router.delete('/templates/:id', requireAdmin(), [
  param('id').isUUID()
], asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw createError('Validation failed', 400, 'VALIDATION_ERROR');
  }

  const { id } = req.params;

  // Check if it's a default template
  const templateCheck = await query(`
    SELECT is_default FROM notification_templates
    WHERE id = $1 AND tenant_id = $2
  `, [id, req.user!.tenant_id]);

  if (templateCheck.rows.length === 0) {
    throw createError('Template not found', 404, 'TEMPLATE_NOT_FOUND');
  }

  if (templateCheck.rows[0].is_default) {
    throw createError('Cannot delete default template', 400, 'CANNOT_DELETE_DEFAULT');
  }

  const result = await query(`
    DELETE FROM notification_templates
    WHERE id = $1 AND tenant_id = $2
    RETURNING id
  `, [id, req.user!.tenant_id]);

  if (result.rows.length === 0) {
    throw createError('Template not found', 404, 'TEMPLATE_NOT_FOUND');
  }

  res.json({
    message: 'Notification template deleted successfully'
  });
}));

// Get notification logs with filtering and pagination
router.get('/logs', [
  expressQuery('page').optional().isInt({ min: 1 }),
  expressQuery('limit').optional().isInt({ min: 1, max: 100 }),
  expressQuery('type').optional().isIn(['email', 'sms', 'push']),
  expressQuery('event').optional().isLength({ max: 50 }),
  expressQuery('status').optional().isIn(['sent', 'failed', 'pending']),
  expressQuery('recipient_id').optional().isUUID(),
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
    SELECT nl.*, 
           nt.name as template_name,
           p.full_name as recipient_name,
           COUNT(*) OVER() as total_count
    FROM notification_logs nl
    LEFT JOIN notification_templates nt ON nl.template_id = nt.id
    LEFT JOIN profiles p ON nl.recipient_user_id = p.id
    WHERE nl.tenant_id = $1
  `;

  const queryParams: any[] = [req.user!.tenant_id];
  let paramCount = 2;

  // Apply filters
  if (req.query.type) {
    queryText += ` AND nl.type = $${paramCount++}`;
    queryParams.push(req.query.type);
  }

  if (req.query.event) {
    queryText += ` AND nl.event = $${paramCount++}`;
    queryParams.push(req.query.event);
  }

  if (req.query.status) {
    queryText += ` AND nl.status = $${paramCount++}`;
    queryParams.push(req.query.status);
  }

  if (req.query.recipient_id) {
    queryText += ` AND nl.recipient_user_id = $${paramCount++}`;
    queryParams.push(req.query.recipient_id);
  }

  if (req.query.start_date) {
    queryText += ` AND nl.created_at >= $${paramCount++}`;
    queryParams.push(req.query.start_date);
  }

  if (req.query.end_date) {
    queryText += ` AND nl.created_at <= $${paramCount++}`;
    queryParams.push(req.query.end_date);
  }

  // Add role-based restrictions
  if (req.user!.role !== 'admin' && req.user!.role !== 'security') {
    queryText += ` AND nl.recipient_user_id = $${paramCount++}`;
    queryParams.push(req.user!.id);
  }

  queryText += ` ORDER BY nl.created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
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

// Send notification (for testing templates)
router.post('/send-test', requireAdmin(), [
  body('template_id').isUUID(),
  body('tenant_id').optional().isUUID(),
  body('recipient_email').optional().isEmail(),
  body('recipient_phone').optional().isMobilePhone('any'),
  body('recipient_user_id').optional().isUUID(),
  body('variables').optional().isObject()
], asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw createError('Validation failed', 400, 'VALIDATION_ERROR');
  }

  let {
    template_id,
    tenant_id,
    recipient_email,
    recipient_phone,
    recipient_user_id,
    variables = {}
  } = req.body;

  // If tenant_id is not provided, use the user's tenant_id
  if (!tenant_id) {
    tenant_id = req.user!.tenant_id;
  }

  // Ensure at least one recipient is provided
  if (!recipient_email && !recipient_phone && !recipient_user_id) {
    throw createError('At least one recipient must be provided', 400, 'RECIPIENT_REQUIRED');
  }

  console.log(`[NotificationController] Sending test notification with template_id: ${template_id}`);
  console.log(`[NotificationController] Recipient: email=${recipient_email}, phone=${recipient_phone}, userId=${recipient_user_id}`);

  await transaction(async (client) => {
    // Get template
    const templateResult = await client.query(`
      SELECT * FROM notification_templates
      WHERE id = $1 AND tenant_id = $2 
    `, [template_id, tenant_id]);

    if (templateResult.rows.length === 0) {
      console.error(`[NotificationController] Template not found: ${template_id}`);
      throw createError('Template not found', 404, 'TEMPLATE_NOT_FOUND');
    }

    const template = templateResult.rows[0];
    console.log(`[NotificationController] Template found: ${template.name}, type: ${template.type}, event: ${template.event}`);

    // If recipient_user_id is provided, get their contact info
    let userEmail = recipient_email;
    let userPhone = recipient_phone;

    if (recipient_user_id) {
      console.log(`[NotificationController] Getting contact info for user: ${recipient_user_id}`);
      const userResult = await client.query(`
        SELECT email, phone FROM profiles
        WHERE id = $1 AND tenant_id = $2
      `, [recipient_user_id, tenant_id]);

      if (userResult.rows.length === 0) {
        console.error(`[NotificationController] User not found: ${recipient_user_id}`);
        throw createError('User not found', 404, 'USER_NOT_FOUND');
      }

      userEmail = userEmail || userResult.rows[0].email;
      userPhone = userPhone || userResult.rows[0].phone;
      console.log(`[NotificationController] User contact info: email=${userEmail}, phone=${userPhone}`);
    }

    // Validate that we have the right contact info for the notification type
    if (template.type === 'email' && !userEmail) {
      console.error(`[NotificationController] Email address required for email notifications`);
      throw createError('Email address required for email notifications', 400, 'EMAIL_REQUIRED');
    }

    if (template.type === 'sms' && !userPhone) {
      console.error(`[NotificationController] Phone number required for SMS notifications`);
      throw createError('Phone number required for SMS notifications', 400, 'PHONE_REQUIRED');
    }

    // Render template with variables
    const renderedSubject = template.subject 
      ? await client.query('SELECT render_template($1, $2) as result', [template.subject, JSON.stringify(variables)])
      : { rows: [{ result: null }] };
    
    const renderedBody = await client.query('SELECT render_template($1, $2) as result', [template.body, JSON.stringify(variables)]);
    console.log(`[NotificationController] Template rendered - Subject: ${renderedSubject.rows[0].result?.substring(0, 30)}..., Body length: ${renderedBody.rows[0].result.length}`);

    // In a real implementation, this would send the actual notification
    // For now, we'll just log it
    console.log(`[NotificationController] Sending notification via notificationService...`);
    const logResult = await client.query(`
      INSERT INTO notification_logs (
        tenant_id, template_id, recipient_email, recipient_phone, recipient_user_id,
        subject, body, type, event, status, sent_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
      RETURNING *
    `, [
      req.user!.tenant_id,
      template_id,
      userEmail,
      userPhone,
      recipient_user_id,
      renderedSubject.rows[0].result,
      renderedBody.rows[0].result,
      template.type,
      template.event,
      'sent' // In a real implementation, this would be 'pending' until confirmed sent
    ]);
    console.log(`[NotificationController] Notification logged with ID: ${logResult.rows[0].id}`);

    res.json({
      message: 'Test notification sent successfully',
      notification: {
        id: logResult.rows[0].id,
        type: template.type,
        recipient: template.type === 'email' ? userEmail : userPhone,
        subject: renderedSubject.rows[0].result,
        body: renderedBody.rows[0].result,
        sent_at: logResult.rows[0].sent_at
      }
    });
  });
}));

// Get available template variables for each event type
router.get('/template-variables', asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  // This would typically come from a database or configuration
  // For now, we'll hardcode the available variables for each event type
  const templateVariables = {
    invitation: [
      { name: 'visitor_name', description: 'Full name of the visitor' },
      { name: 'facility_name', description: 'Name of the facility' },
      { name: 'visit_date', description: 'Scheduled date of the visit' },
      { name: 'visit_time', description: 'Scheduled time of the visit' },
      { name: 'purpose', description: 'Purpose of the visit' },
      { name: 'host_name', description: 'Name of the host' },
      { name: 'pre_registration_link', description: 'Link for visitor pre-registration' },
      { name: 'organization_name', description: 'Name of your organization' }
    ],
    approval: [
      { name: 'visitor_name', description: 'Full name of the visitor' },
      { name: 'facility_name', description: 'Name of the facility' },
      { name: 'visit_date', description: 'Scheduled date of the visit' },
      { name: 'visit_time', description: 'Scheduled time of the visit' },
      { name: 'purpose', description: 'Purpose of the visit' },
      { name: 'host_name', description: 'Name of the host' },
      { name: 'organization_name', description: 'Name of your organization' }
    ],
    rejection: [
      { name: 'visitor_name', description: 'Full name of the visitor' },
      { name: 'facility_name', description: 'Name of the facility' },
      { name: 'visit_date', description: 'Scheduled date of the visit' },
      { name: 'visit_time', description: 'Scheduled time of the visit' },
      { name: 'rejection_reason', description: 'Reason for rejection' },
      { name: 'host_name', description: 'Name of the host' },
      { name: 'organization_name', description: 'Name of your organization' }
    ],
    check_in: [
      { name: 'visitor_name', description: 'Full name of the visitor' },
      { name: 'facility_name', description: 'Name of the facility' },
      { name: 'check_in_date', description: 'Date of check-in' },
      { name: 'check_in_time', description: 'Time of check-in' },
      { name: 'badge_number', description: 'Assigned badge number' },
      { name: 'host_name', description: 'Name of the host' },
      { name: 'organization_name', description: 'Name of your organization' }
    ],
    check_out: [
      { name: 'visitor_name', description: 'Full name of the visitor' },
      { name: 'facility_name', description: 'Name of the facility' },
      { name: 'check_out_date', description: 'Date of check-out' },
      { name: 'check_out_time', description: 'Time of check-out' },
      { name: 'host_name', description: 'Name of the host' },
      { name: 'organization_name', description: 'Name of your organization' }
    ],
    host_notification: [
      { name: 'host_name', description: 'Name of the host' },
      { name: 'visitor_name', description: 'Full name of the visitor' },
      { name: 'visitor_company', description: 'Company of the visitor' },
      { name: 'visit_date', description: 'Scheduled date of the visit' },
      { name: 'visit_time', description: 'Scheduled time of the visit' },
      { name: 'purpose', description: 'Purpose of the visit' },
      { name: 'organization_name', description: 'Name of your organization' }
    ],
    visitor_arrived: [
      { name: 'host_name', description: 'Name of the host' },
      { name: 'visitor_name', description: 'Full name of the visitor' },
      { name: 'visitor_company', description: 'Company of the visitor' },
      { name: 'facility_name', description: 'Name of the facility' },
      { name: 'check_in_time', description: 'Time of check-in' },
      { name: 'purpose', description: 'Purpose of the visit' },
      { name: 'organization_name', description: 'Name of your organization' }
    ],
    security_alert: [
      { name: 'alert_type', description: 'Type of security alert' },
      { name: 'severity', description: 'Severity level of the alert' },
      { name: 'facility_name', description: 'Name of the facility' },
      { name: 'alert_time', description: 'Time the alert was triggered' },
      { name: 'alert_message', description: 'Alert message details' },
      { name: 'organization_name', description: 'Name of your organization' }
    ]
  };

  res.json({
    variables: templateVariables
  });
}));

export default router;