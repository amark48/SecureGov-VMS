import QRCode from 'qrcode';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../config/database';
import { DatabaseClient } from '../types/common';
import { createError } from '../middleware/errorHandler';

// Logger setup
const qrLogger = (message: string, data?: any) => {
  console.log(`[QrCodeService] ${message}`, data ? data : '');
};

export interface QrCodeData {
  token: string;
  url: string;
  dataUrl: string; // Base64 encoded QR code image
}

export class QrCodeService {
  /**
   * Generate QR code for an invitation
   */
  static async generateQrCode(invitationId: string, tenantId: string, client?: DatabaseClient): Promise<QrCodeData> {
    qrLogger('Generating QR code for invitation', { invitationId, tenantId });

    const dbQuery = client ? client.query.bind(client) : query;

    try {
      // Generate unique token
      const token = uuidv4();
      
      // Construct QR code URL
      const baseUrl = process.env.FRONTEND_URL || 'https://localhost:5173';
      const qrUrl = `${baseUrl}/check-in?token=${token}`;
      
      // Generate QR code image as data URL with simplified options
      const qrCodeDataUrl: string = await QRCode.toDataURL(qrUrl, {
        errorCorrectionLevel: 'M',
        type: 'image/png',
        margin: 1,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        },
        width: 256
      });

      // Update invitation with QR code data
      await dbQuery(`
        UPDATE invitations 
        SET qr_code_token = $1, qr_code_url = $2, updated_at = NOW()
        WHERE id = $3 AND tenant_id = $4
      `, [token, qrUrl, invitationId, tenantId]);

      qrLogger('QR code generated successfully', { invitationId, token });

      return {
        token,
        url: qrUrl,
        dataUrl: qrCodeDataUrl
      };
    } catch (error: any) {
      qrLogger('Error generating QR code', { error: error.message });
      throw createError(`Failed to generate QR code: ${error.message}`, 500, 'QR_CODE_GENERATION_ERROR');
    }
  }

  /**
   * Validate QR code token and get invitation details
   */
  static async validateQrToken(token: string, client?: DatabaseClient): Promise<any> {
    qrLogger('Validating QR code token', { token });

    const dbQuery = client ? client.query.bind(client) : query;

    try {
      const result = await dbQuery(`
        SELECT * FROM get_invitation_by_qr_token($1)
      `, [token]);

      if (result.rows.length === 0) {
        qrLogger('Invalid QR code token', { token });
        throw createError('Invalid or expired QR code', 404, 'INVALID_QR_CODE');
      }

      const invitationData = result.rows[0];
      qrLogger('QR code validated successfully', { 
        invitationId: invitationData.invitation_id,
        visitorName: `${invitationData.visitor_first_name} ${invitationData.visitor_last_name}`
      });

      return invitationData;
    } catch (error: any) {
      if (error.code === 'INVALID_QR_CODE') {
        throw error;
      }
      qrLogger('Error validating QR code', { error: error.message });
      throw createError(`Failed to validate QR code: ${error.message}`, 500, 'QR_CODE_VALIDATION_ERROR');
    }
  }

  /**
   * Get QR code image for an invitation
   */
  static async getQrCodeImage(invitationId: string, tenantId: string, client?: DatabaseClient): Promise<string> {
    qrLogger('Getting QR code image for invitation', { invitationId, tenantId });

    const dbQuery = client ? client.query.bind(client) : query;

    try {
      const result = await dbQuery(`
        SELECT qr_code_url FROM invitations
        WHERE id = $1 AND tenant_id = $2 AND qr_code_url IS NOT NULL
      `, [invitationId, tenantId]);

      if (result.rows.length === 0) {
        // Check if invitation exists but doesn't have QR code
        const invitationExists = await dbQuery(`
          SELECT status, pre_registration_required, pre_registration_status
          FROM invitations
          WHERE id = $1 AND tenant_id = $2
        `, [invitationId, tenantId]);

        if (invitationExists.rows.length === 0) {
          throw createError('Invitation not found', 404, 'INVITATION_NOT_FOUND');
        }

        const invitation = invitationExists.rows[0];
        
        if (invitation.status !== 'approved') {
          throw createError('QR code is only available for approved invitations', 400, 'INVITATION_NOT_APPROVED');
        }
        
        if (invitation.pre_registration_required && invitation.pre_registration_status !== 'completed') {
          throw createError('QR code will be available after pre-registration is completed', 400, 'PRE_REGISTRATION_REQUIRED');
        }
        
        throw createError('QR code not found for this invitation', 404, 'QR_CODE_NOT_FOUND');
      }

      const qrUrl = result.rows[0].qr_code_url;
      
      // Generate QR code image with simplified options
      const qrCodeDataUrl: string = await QRCode.toDataURL(qrUrl, {
        errorCorrectionLevel: 'M',
        type: 'image/png',
        margin: 1,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        },
        width: 256
      });

      return qrCodeDataUrl;
    } catch (error: any) {
      if (error.code === 'QR_CODE_NOT_FOUND' || error.code === 'INVITATION_NOT_FOUND' || 
          error.code === 'INVITATION_NOT_APPROVED' || error.code === 'PRE_REGISTRATION_REQUIRED') {
        throw error;
      }
      qrLogger('Error getting QR code image', { error: error.message });
      throw createError(`Failed to get QR code image: ${error.message}`, 500, 'QR_CODE_IMAGE_ERROR');
    }
  }

  /**
   * Regenerate QR code for an invitation
   */
  static async regenerateQrCode(invitationId: string, tenantId: string, client?: DatabaseClient): Promise<QrCodeData> {
    qrLogger('Regenerating QR code for invitation', { invitationId, tenantId });

    const dbQuery = client ? client.query.bind(client) : query;

    // Verify invitation exists and belongs to tenant
    const invitationCheck = await dbQuery(`
      SELECT id FROM invitations
      WHERE id = $1 AND tenant_id = $2
    `, [invitationId, tenantId]);

    if (invitationCheck.rows.length === 0) {
      throw createError('Invitation not found', 404, 'INVITATION_NOT_FOUND');
    }

    return await this.generateQrCode(invitationId, tenantId, client);
  }
}