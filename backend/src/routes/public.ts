import express from 'express';
import { body, query as expressQuery, validationResult } from 'express-validator';
import { query, transaction } from '../config/database';
import { asyncHandler, createError } from '../middleware/errorHandler';
import { v4 as uuidv4 } from 'uuid';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { QrCodeService } from '../services/qrCodeService';

const router = express.Router();

// QR code check-in validation (public endpoint)
router.get('/qr-check-in', [
  expressQuery('token').isUUID().withMessage('Valid QR code token is required')
], asyncHandler(async (req: express.Request, res: express.Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw createError('Validation failed', 400, 'VALIDATION_ERROR', errors.array());
  }

  const { token } = req.query;

  try {
    const invitationData = await QrCodeService.validateQrToken(token as string);
    
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

export default router;