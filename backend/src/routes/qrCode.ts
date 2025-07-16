import express from 'express';
import { param, query as expressQuery, validationResult } from 'express-validator';
import { query } from '../config/database';
import { asyncHandler, createError } from '../middleware/errorHandler';
import { AuthenticatedRequest, requireReception } from '../middleware/auth';
import { QrCodeService } from '../services/qrCodeService';

const router = express.Router();

// Get QR code validation (public endpoint for scanning)
router.get('/validate/:token', [
  param('token').isUUID().withMessage('Valid QR code token is required')
], asyncHandler(async (req: express.Request, res: express.Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw createError('Validation failed', 400, 'VALIDATION_ERROR', errors.array());
  }

  const { token } = req.params;

  try {
    const invitationData = await QrCodeService.validateQrToken(token);
    
    res.json({
      success: true,
      invitation: invitationData
    });
  } catch (error: any) {
    if (error.code === 'INVALID_QR_CODE') {
      res.status(404).json({
        success: false,
        error: error.message,
        code: error.code
      });
      return;
    }
    throw error;
  }
}));

// Generate QR code for invitation (authenticated)
router.post('/generate/:invitationId', requireReception(), [
  param('invitationId').isUUID().withMessage('Valid invitation ID is required')
], asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw createError('Validation failed', 400, 'VALIDATION_ERROR', errors.array());
  }

  const { invitationId } = req.params;

  const qrCodeData = await QrCodeService.generateQrCode(invitationId, req.user!.tenant_id);

  res.json({
    message: 'QR code generated successfully',
    qr_code: qrCodeData
  });
}));

// Regenerate QR code for invitation (authenticated)
router.post('/regenerate/:invitationId', requireReception(), [
  param('invitationId').isUUID().withMessage('Valid invitation ID is required')
], asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw createError('Validation failed', 400, 'VALIDATION_ERROR', errors.array());
  }

  const { invitationId } = req.params;

  const qrCodeData = await QrCodeService.regenerateQrCode(invitationId, req.user!.tenant_id);

  res.json({
    message: 'QR code regenerated successfully',
    qr_code: qrCodeData
  });
}));

export default router;