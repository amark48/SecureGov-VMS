// src/services/invitation.ts
import { apiClient } from './api';
import type { Invitation } from '../types/invitation';

interface ApiError extends Error {
  response?: {
    data?: any;
    status?: number;
  };
}

class InvitationService {
  async createInvitation(invitationData: Omit<Invitation, 'id' | 'created_at' | 'updated_at'>): Promise<Invitation> {
    try {
      // Log the invitation data for debugging
      console.log('Creating invitation with data:', JSON.stringify(invitationData, null, 2));
      
      // Ensure required fields are present
      if (!invitationData.host_id) {
        throw new Error('Host ID is required');
      }
      
      if (!invitationData.facility_id) {
        throw new Error('Facility ID is required');
      }
      
      if (!invitationData.purpose) {
        throw new Error('Purpose is required');
      }
      
      if (!invitationData.scheduled_date) {
        throw new Error('Scheduled date is required');
      }
      
      const response = await apiClient.post<{
        message: string;
        invitation: Invitation;
      }>('/api/invitations', invitationData);

      return response.invitation;
    } catch (error: any) {
      // Enhance error with response data if available
      const enhancedError = new Error(error.message || 'Failed to create invitation') as ApiError;
      
      if (error.response) {
        enhancedError.response = error.response;
      }
      
      console.error('Invitation creation error details:', error);
      throw enhancedError;
    }
  }

  async updateInvitation(id: string, updates: Partial<Invitation>): Promise<Invitation> {
    try {
      const response = await apiClient.put<{
        message: string;
        invitation: Invitation;
      }>(`/api/invitations/${id}`, updates);

      return response.invitation;
    } catch (error: any) {
      throw new Error(error.message || 'Failed to update invitation');
    }
  }

  async getInvitations(status?: string, search?: string, page = 1, limit = 20): Promise<Invitation[]> {
    try {
      const params = new URLSearchParams();
      if (status) params.append('status', status);
      if (search) params.append('search', search);
      params.append('page', page.toString());
      params.append('limit', limit.toString());

      const response = await apiClient.get<{
        invitations: Invitation[];
        pagination: {
          page: number;
          limit: number;
          total: number;
          pages: number;
        };
      }>(`/api/invitations?${params.toString()}`);

      return response.invitations;
    } catch (error: any) {
      throw new Error(error.message || 'Failed to fetch invitations');
    }
  }

  async getInvitation(id: string): Promise<Invitation> {
    try {
      const response = await apiClient.get<{
        invitation: Invitation;
      }>(`/api/invitations/${id}`);

      return response.invitation;
    } catch (error: any) {
      throw new Error(error.message || 'Failed to fetch invitation');
    }
  }

  async approveInvitation(id: string): Promise<Invitation> {
    try {
      const response = await apiClient.post<{
        message: string;
        invitation: Invitation;
      }>(`/api/invitations/${id}/approve`, {});

      return response.invitation;
    } catch (error: any) {
      throw new Error(error.message || 'Failed to approve invitation');
    }
  }

  async rejectInvitation(id: string, reason: string): Promise<Invitation> {
    try {
      const response = await apiClient.post<{
        message: string;
        invitation: Invitation;
      }>(`/api/invitations/${id}/reject`, { reason });

      return response.invitation;
    } catch (error: any) {
      throw new Error(error.message || 'Failed to reject invitation');
    }
  }

  async cancelInvitation(id: string): Promise<Invitation> {
    try {
      const response = await apiClient.post<{
        message: string;
        invitation: Invitation;
      }>(`/api/invitations/${id}/cancel`, {});

      return response.invitation;
    } catch (error: any) {
      throw new Error(error.message || 'Failed to cancel invitation');
    }
  }

  // New methods for pre-registration
  async getPreRegistrationDetails(token: string): Promise<{
    invitation: {
      id: string;
      purpose: string;
      scheduled_date: string;
      scheduled_start_time?: string;
      scheduled_end_time?: string;
      host_name: string;
      facility_name: string;
      visitor?: {
        first_name: string;
        last_name: string;
        email: string;
        company?: string;
        phone?: string;
        id_type?: string;
        id_number?: string;
        nationality?: string;
        citizenship?: string;
        date_of_birth?: string;
        ssn?: string;
        emergency_contact_name?: string;
        emergency_contact_phone?: string;
      };
    }
  }> {
    try {
      const response = await apiClient.get<{
        invitation: {
          id: string;
          purpose: string;
          scheduled_date: string;
          scheduled_start_time?: string;
          scheduled_end_time?: string;
          host_name: string;
          facility_name: string;
          visitor?: {
            first_name: string;
            last_name: string;
            email: string;
            company?: string;
            phone?: string;
            id_type?: string;
            id_number?: string;
            nationality?: string;
            citizenship?: string;
            date_of_birth?: string;
            ssn?: string;
            emergency_contact_name?: string;
            emergency_contact_phone?: string;
          };
        }
      }>(`/api/invitations/pre-register/${token}`, true); // Set skipAuth to true

      return response;
    } catch (error: any) {
      throw new Error(error.message || 'Failed to fetch pre-registration details');
    }
  }

  async submitPreRegistration(token: string, visitorData: FormData | {
    first_name: string;
    last_name: string;
    email?: string;
    phone?: string;
    company?: string;
    id_number?: string;
    id_type?: string;
    date_of_birth?: string;
    citizenship?: string;
    nationality?: string;
    ssn?: string;
    emergency_contact_name?: string;
    emergency_contact_phone?: string;
  }): Promise<{
    message: string;
    visitor_id: string;
  }> {
    try {
      let response;
      
      if (visitorData instanceof FormData) {
        // If FormData is provided (with file upload)
        response = await fetch(`${apiClient['baseURL']}/api/invitations/pre-register/${token}`, {
          method: 'POST',
          body: visitorData,
          headers: {
            // Do not set Content-Type header for FormData, browser handles it
            // Do not send Authorization header for public pre-registration
          }
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
        }
        
        return await response.json();
      } else {
        // If regular JSON data is provided
        response = await apiClient.post<{
          message: string;
          visitor_id: string;
        }>(`/api/invitations/pre-register/${token}`, visitorData, true); // Set skipAuth to true
        
        return response;
      }
    } catch (error: any) {
      throw new Error(error.message || 'Failed to submit pre-registration');
    }
  }
}

export const invitationService = new InvitationService();
