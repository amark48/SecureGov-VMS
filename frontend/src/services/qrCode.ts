// src/services/qrCode.ts
import { apiClient } from './api';

class QrCodeService {
  async getQrCodeImage(invitationId: string): Promise<string> {
    try {
      const response = await apiClient.get<{
        qr_code_image: string; // Expect qr_code_image field with base64 data
      }>(`/api/qr-code/image/${invitationId}`, true); // Set skipAuth to true

      // Return the base64 data directly, it's already a valid data URL
      return response.qr_code_image;
    } catch (error: any) {
      throw new Error(error.message || 'Failed to load QR code image');
    }
  }

  async generateQrCode(invitationId: string): Promise<{ success: boolean; message: string }> {
    try {
      const response = await apiClient.post<{
        success: boolean;
        message: string;
      }>(`/api/qr-code/generate/${invitationId}`, {});

      return response;
    } catch (error: any) {
      throw new Error(error.message || 'Failed to generate QR code');
    }
  }
}

export const qrCodeService = new QrCodeService();
