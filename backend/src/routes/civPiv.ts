import express from 'express';
import { body, param, validationResult } from 'express-validator';
import { query, transaction } from '../config/database';
import { asyncHandler, createError } from '../middleware/errorHandler';
import { AuthenticatedRequest, requireSecurity } from '../middleware/auth';

const router = express.Router();

// Process CIV/PIV card reading data
router.post('/read-card', requireSecurity(), [
  body('visitor_id').isUUID().withMessage('Valid visitor ID is required'),
  body('card_data').isObject().withMessage('Card data object is required'),
  body('card_data.card_number').optional().isString(),
  body('card_data.masked_card_number').optional().isString(),
  body('card_data.edipi').optional().isString(),
  body('card_data.upn').optional().isString(),
  body('card_data.certificate_data').optional().isObject(),
  body('card_data.card_type').optional().isString()
], asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw createError('Validation failed', 400, 'VALIDATION_ERROR', errors.array());
  }

  const { visitor_id, card_data } = req.body;

  await transaction(async (client) => {
    // Check for EDIPI uniqueness if provided
    if (card_data.edipi) {
      const existingEdipi = await client.query(`
        SELECT v.id, v.first_name, v.last_name 
        FROM visitors v
        WHERE v.civ_piv_card_info->>'edipi' = $1 
        AND v.id != $2 
        AND v.tenant_id = $3
        AND v.civ_piv_card_info IS NOT NULL
      `, [card_data.edipi, visitor_id, req.user!.tenant_id]);

      if (existingEdipi.rows.length > 0) {
        const existingVisitor = existingEdipi.rows[0];
        throw createError(
          `EDIPI ${card_data.edipi} is already associated with visitor: ${existingVisitor.first_name} ${existingVisitor.last_name} (ID: ${existingVisitor.id})`,
          409,
          'DUPLICATE_EDIPI'
        );
      }
    }

    // Verify visitor exists and belongs to tenant
    const visitorCheck = await client.query(`
      SELECT id, first_name, last_name FROM visitors
      WHERE id = $1 AND tenant_id = $2
    `, [visitor_id, req.user!.tenant_id]);

    if (visitorCheck.rows.length === 0) {
      throw createError('Visitor not found', 404, 'VISITOR_NOT_FOUND');
    }

    const visitor = visitorCheck.rows[0];

    // Validate card data
    if (!card_data.card_number && !card_data.edipi && !card_data.upn) {
      throw createError('Card data must contain at least card number, EDIPI, or UPN', 400, 'INSUFFICIENT_CARD_DATA');
    }

    // Mask the card number for storage (keep only last 4 digits)
    let maskedCardNumber = card_data.masked_card_number;
    if (card_data.card_number && !maskedCardNumber) {
      const cardNumber = card_data.card_number.replace(/\s/g, '');
      maskedCardNumber = '**** **** **** ' + cardNumber.slice(-4);
    }

    // Prepare card info for storage (exclude sensitive data)
    const cardInfo = {
      masked_card_number: maskedCardNumber,
      edipi: card_data.edipi,
      upn: card_data.upn,
      card_type: card_data.card_type || 'civ_piv',
      read_timestamp: new Date().toISOString(),
      certificate_thumbprint: card_data.certificate_data?.thumbprint,
      issuer: card_data.certificate_data?.issuer
    };

    // Update visitor with CIV/PIV card information
    const result = await client.query(`
      UPDATE visitors
      SET civ_piv_card_info = $1, updated_at = NOW()
      WHERE id = $2 AND tenant_id = $3
      RETURNING id, first_name, last_name, civ_piv_card_info
    `, [JSON.stringify(cardInfo), visitor_id, req.user!.tenant_id]);

    // Log the card reading event
    await client.query(`
      INSERT INTO audit_logs (
        user_id, tenant_id, action, table_name, record_id, new_values, compliance_flags
      ) VALUES ($1, $2, 'update', 'visitors', $3, $4, $5)
    `, [
      req.user!.id,
      req.user!.tenant_id,
      visitor_id,
      JSON.stringify({
        action: 'civ_piv_card_read',
        visitor_name: `${visitor.first_name} ${visitor.last_name}`,
        card_info: cardInfo,
        read_by: req.user!.full_name
      }),
      ['SECURITY', 'CIV_PIV_CARD', 'FICAM']
    ]);

    res.json({
      message: 'CIV/PIV card data processed successfully',
      visitor: result.rows[0],
      card_info: cardInfo
    });
  });
}));

// Get CIV/PIV card information for a visitor
router.get('/visitor/:visitorId/card-info', requireSecurity(), [
  param('visitorId').isUUID().withMessage('Valid visitor ID is required')
], asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw createError('Validation failed', 400, 'VALIDATION_ERROR', errors.array());
  }

  const { visitorId } = req.params;

  const result = await query(`
    SELECT id, first_name, last_name, civ_piv_card_info
    FROM visitors
    WHERE id = $1 AND tenant_id = $2
  `, [visitorId, req.user!.tenant_id]);

  if (result.rows.length === 0) {
    throw createError('Visitor not found', 404, 'VISITOR_NOT_FOUND');
  }

  const visitor = result.rows[0];

  res.json({
    visitor: {
      id: visitor.id,
      first_name: visitor.first_name,
      last_name: visitor.last_name,
      has_civ_piv_card: !!visitor.civ_piv_card_info,
      card_info: visitor.civ_piv_card_info
    }
  });
}));

// Validate CIV/PIV card data format
router.post('/validate-card-data', requireSecurity(), [
  body('card_data').isObject().withMessage('Card data object is required')
], asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw createError('Validation failed', 400, 'VALIDATION_ERROR', errors.array());
  }

  const { card_data } = req.body;

  const validation = {
    valid: true,
    errors: [] as string[],
    warnings: [] as string[]
  };

  // Check for required fields
  if (!card_data.card_number && !card_data.edipi && !card_data.upn) {
    validation.valid = false;
    validation.errors.push('Card data must contain at least card number, EDIPI, or UPN');
  }

  // Validate EDIPI format (10 digits)
  if (card_data.edipi && !/^\d{10}$/.test(card_data.edipi)) {
    validation.valid = false;
    validation.errors.push('EDIPI must be exactly 10 digits');
  }

  // Validate UPN format (email-like)
  if (card_data.upn && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(card_data.upn)) {
    validation.warnings.push('UPN format appears invalid (should be email-like)');
  }

  // Validate card number format (if present)
  if (card_data.card_number) {
    const cardNumber = card_data.card_number.replace(/\s/g, '');
    if (!/^\d{16}$/.test(cardNumber)) {
      validation.warnings.push('Card number should be 16 digits');
    }
  }

  // Check certificate data
  if (card_data.certificate_data) {
    if (!card_data.certificate_data.thumbprint) {
      validation.warnings.push('Certificate thumbprint is missing');
    }
    if (!card_data.certificate_data.issuer) {
      validation.warnings.push('Certificate issuer is missing');
    }
  } else {
    validation.warnings.push('Certificate data is missing');
  }

  res.json({
    validation,
    processed_data: {
      masked_card_number: card_data.card_number ? 
        '**** **** **** ' + card_data.card_number.replace(/\s/g, '').slice(-4) : 
        card_data.masked_card_number,
      edipi: card_data.edipi,
      upn: card_data.upn,
      card_type: card_data.card_type || 'civ_piv',
      has_certificate: !!card_data.certificate_data
    }
  });
}));

// Clear CIV/PIV card information for a visitor
router.delete('/visitor/:visitorId/card-info', requireSecurity(), [
  param('visitorId').isUUID().withMessage('Valid visitor ID is required')
], asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw createError('Validation failed', 400, 'VALIDATION_ERROR', errors.array());
  }

  const { visitorId } = req.params;

  await transaction(async (client) => {
    // Verify visitor exists
    const visitorCheck = await client.query(`
      SELECT id, first_name, last_name FROM visitors
      WHERE id = $1 AND tenant_id = $2
    `, [visitorId, req.user!.tenant_id]);

    if (visitorCheck.rows.length === 0) {
      throw createError('Visitor not found', 404, 'VISITOR_NOT_FOUND');
    }

    const visitor = visitorCheck.rows[0];

    // Clear CIV/PIV card information
    await client.query(`
      UPDATE visitors
      SET civ_piv_card_info = NULL, updated_at = NOW()
      WHERE id = $1 AND tenant_id = $2
    `, [visitorId, req.user!.tenant_id]);

    // Log the card info clearing event
    await client.query(`
      INSERT INTO audit_logs (
        user_id, tenant_id, action, table_name, record_id, new_values, compliance_flags
      ) VALUES ($1, $2, 'update', 'visitors', $3, $4, $5)
    `, [
      req.user!.id,
      req.user!.tenant_id,
      visitorId,
      JSON.stringify({
        action: 'civ_piv_card_cleared',
        visitor_name: `${visitor.first_name} ${visitor.last_name}`,
        cleared_by: req.user!.full_name
      }),
      ['SECURITY', 'CIV_PIV_CARD', 'FICAM']
    ]);

    res.json({
      message: 'CIV/PIV card information cleared successfully'
    });
  });
}));

export default router;