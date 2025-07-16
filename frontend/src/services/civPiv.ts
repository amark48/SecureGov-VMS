import { apiClient } from './api';

interface CardValidationResult {
  isValid: boolean;
  edipi?: string;
  upn?: string;
  firstName?: string;
  lastName?: string;
  organization?: string;
  expirationDate?: string;
  certificateStatus?: 'valid' | 'expired' | 'revoked' | 'invalid';
  errorMessage?: string;
}

interface CardProcessingResult {
  success: boolean;
  cardData?: {
    edipi: string;
    upn?: string;
    firstName: string;
    lastName: string;
    organization?: string;
    expirationDate?: string;
    certificateStatus: 'valid' | 'expired' | 'revoked' | 'invalid';
  };
  errorMessage?: string;
}

class CivPivService {
  async validateCard(cardData: {
    edipi?: string;
    upn?: string;
    certificateData?: string;
  }): Promise<CardValidationResult> {
    try {
      const response = await apiClient.post<CardValidationResult>(
        '/api/civ-piv/validate',
        cardData
      );
      return response;
    } catch (error: any) {
      return {
        isValid: false,
        errorMessage: error.message || 'Failed to validate CIV/PIV card'
      };
    }
  }

  async processCardData(rawCardData: string): Promise<CardProcessingResult> {
    try {
      const response = await apiClient.post<CardProcessingResult>(
        '/api/civ-piv/process',
        { rawData: rawCardData }
      );
      return response;
    } catch (error: any) {
      return {
        success: false,
        errorMessage: error.message || 'Failed to process card data'
      };
    }
  }

  async simulateCardRead(): Promise<CardProcessingResult> {
    try {
      const response = await apiClient.get<CardProcessingResult>(
        '/api/civ-piv/simulate-read'
      );
      return response;
    } catch (error: any) {
      return {
        success: false,
        errorMessage: error.message || 'Failed to simulate card read'
      };
    }
  }

  async associateCardWithVisitor(
    visitorId: string,
    cardData: {
      edipi: string;
      upn?: string;
      firstName: string;
      lastName: string;
    }
  ): Promise<{ success: boolean; message: string }> {
    try {
      const response = await apiClient.post<{ success: boolean; message: string }>(
        `/api/visitors/${visitorId}/associate-card`,
        cardData
      );
      return response;
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Failed to associate card with visitor'
      };
    }
  }
}

export const civPivService = new CivPivService();