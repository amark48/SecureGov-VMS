import { useState, useCallback } from 'react';
import { civPivService } from '../services/civPiv';

export const useCivPiv = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = () => setError(null);

  const validateCard = useCallback(async (cardData: {
    edipi?: string;
    upn?: string;
    certificateData?: string;
  }) => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await civPivService.validateCard(cardData);
      return result;
    } catch (err: any) {
      setError(err.message || 'Failed to validate card');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const processCardData = useCallback(async (rawCardData: string) => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await civPivService.processCardData(rawCardData);
      return result;
    } catch (err: any) {
      setError(err.message || 'Failed to process card data');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const simulateCardRead = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await civPivService.simulateCardRead();
      return result;
    } catch (err: any) {
      setError(err.message || 'Failed to simulate card read');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const associateCardWithVisitor = useCallback(async (
    visitorId: string,
    cardData: {
      edipi: string;
      upn?: string;
      firstName: string;
      lastName: string;
    }
  ) => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await civPivService.associateCardWithVisitor(visitorId, cardData);
      return result;
    } catch (err: any) {
      setError(err.message || 'Failed to associate card with visitor');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    error,
    clearError,
    validateCard,
    processCardData,
    simulateCardRead,
    associateCardWithVisitor
  };
};