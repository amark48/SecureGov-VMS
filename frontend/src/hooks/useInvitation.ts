import { useState, useCallback } from 'react';
import { invitationService } from '../services/invitation';
import type { Invitation } from '../types/invitation';

interface PaginationData {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export const useInvitation = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paginationData, setPaginationData] = useState<PaginationData>({
    page: 1,
    limit: 20,
    total: 0,
    pages: 0
  });

  const clearError = () => setError(null);

  const createInvitation = useCallback(async (invitationData: Omit<Invitation, 'id' | 'created_at' | 'updated_at'>) => {
    setLoading(true);
    setError(null);

    try {
      // Ensure tenant_id is set if user has one
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const enhancedData = {
        ...invitationData,
        tenant_id: invitationData.tenant_id || user.tenant_id || ''
      };
      
      // Log the data being sent
      console.log('Creating invitation with data:', enhancedData);
      
      const invitation = await invitationService.createInvitation(invitationData);
      return invitation;
    } catch (err: any) {
      // Extract validation errors if available
      if (err.response?.data?.errors) {
        const errorMessage = err.response.data.errors
          .map((e: any) => `${e.field}: ${e.message}`)
          .join(', ');
        setError(errorMessage || err.message);
      } else {
        setError(err.message);
      }
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateInvitation = useCallback(async (id: string, updates: Partial<Invitation>) => {
    setLoading(true);
    setError(null);
    
    try {
      const invitation = await invitationService.updateInvitation(id, updates);
      return invitation;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const getInvitations = useCallback(async (status?: string, search?: string, page = 1, limit = 20) => {
    setLoading(true);
    setError(null);
    
    try {
      const invitations = await invitationService.getInvitations(status, search, page, limit);
      
      // Update pagination data (assuming the API returns pagination info)
      // In a real implementation, this would come from the API response
      setPaginationData({
        page,
        limit,
        total: invitations.length > 0 ? 100 : 0, // Mock total
        pages: Math.ceil(100 / limit)
      });
      
      return invitations;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const getInvitation = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    
    try {
      const invitation = await invitationService.getInvitation(id);
      return invitation;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const approveInvitation = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    
    try {
      const invitation = await invitationService.approveInvitation(id);
      return invitation;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const rejectInvitation = useCallback(async (id: string, reason: string) => {
    setLoading(true);
    setError(null);
    
    try {
      const invitation = await invitationService.rejectInvitation(id, reason);
      return invitation;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const cancelInvitation = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    
    try {
      const invitation = await invitationService.cancelInvitation(id);
      return invitation;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // New methods for pre-registration
  const getPreRegistrationDetails = useCallback(async (token: string) => {
    setLoading(true);
    setError(null);
    
    try {
      const details = await invitationService.getPreRegistrationDetails(token);
      return details;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const submitPreRegistration = useCallback(async (token: string, visitorData: any) => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await invitationService.submitPreRegistration(token, visitorData);
      return result;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    error,
    paginationData,
    clearError,
    createInvitation,
    updateInvitation,
    getInvitations,
    getInvitation,
    approveInvitation,
    rejectInvitation,
    cancelInvitation,
    getPreRegistrationDetails,
    submitPreRegistration
  };
};