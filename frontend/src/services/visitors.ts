import { apiClient } from './api';
import type { Visitor, Visit, Host, Facility, Badge } from '../types/visitor';
import type { Invitation } from '../types/invitation'; // Import Invitation type

class VisitorService {
  // Visitor management
  async createVisitor(visitorData: Omit<Visitor, 'id' | 'created_at' | 'updated_at'>): Promise<Visitor> {
    try {
      const response = await apiClient.post<{
        message: string;
        visitor: Visitor;
      }>('/api/visitors', visitorData);

      return response.visitor;
    } catch (error: any) {
      throw new Error(error.message || 'Failed to create visitor');
    }
  }

  async updateVisitor(id: string, updates: Partial<Visitor>): Promise<Visitor> {
    try {
      const response = await apiClient.put<{
        message: string;
        visitor: Visitor;
      }>(`/api/visitors/${id}`, updates);

      return response.visitor;
    } catch (error: any) {
      throw new Error(error.message || 'Failed to update visitor');
    }
  }

  async getVisitors(limit = 20, offset = 0): Promise<{
    visitors: Visitor[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
  }> {
    try {
      const response = await apiClient.get<{
        visitors: Visitor[];
        pagination: {
          page: number;
          limit: number;
          total: number;
          pages: number;
        };
      }>(`/api/visitors?limit=${limit}&page=${Math.floor(offset / limit) + 1}`);

      return response;
    } catch (error: any) {
      throw new Error(error.message || 'Failed to fetch visitors');
    }
  }

  async searchVisitors(query: string): Promise<Visitor[]> {
    try {
      const response = await apiClient.get<{
        visitors: Visitor[];
      }>(`/api/visitors/search/quick?q=${encodeURIComponent(query)}`);

      return response.visitors;
    } catch (error: any) {
      throw new Error(error.message || 'Failed to search visitors');
    }
  }

  // Visit management
  async createVisit(visitData: Omit<Visit, 'id' | 'created_at' | 'updated_at'>): Promise<Visit> {
    try {
      const response = await apiClient.post<{
        message: string;
        visit: Visit;
      }>('/api/visits', visitData);

      return response.visit;
    } catch (error: any) {
      throw new Error(error.message || 'Failed to create visit');
    }
  }

  async updateVisit(id: string, updates: Partial<Visit>): Promise<Visit> {
    try {
      const response = await apiClient.put<{
        message: string;
        visit: Visit;
      }>(`/api/visits/${id}`, updates);

      return response.visit;
    } catch (error: any) {
      throw new Error(error.message || 'Failed to update visit');
    }
  }

  async getVisits(facilityId?: string, date?: string, page = 1, limit = 20, startDate?: string, endDate?: string): Promise<{
    visits: Visit[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
  }> {
    try {
      const params = new URLSearchParams();
      if (facilityId) params.append('facility_id', facilityId);
      if (date) params.append('date', date);
      if (startDate) params.append('start_date', startDate);
      if (endDate) params.append('end_date', endDate);
      params.append('page', page.toString());
      params.append('limit', limit.toString());

      // Debug: Log the visits API request parameters
      console.log('Visits API request params:', {
        facilityId,
        date,
        startDate,
        endDate,
        page,
        limit,
        url: `/api/visits?${params.toString()}`
      });

      const response = await apiClient.get<{
        visits: Visit[];
        pagination: {
          page: number;
          limit: number;
          total: number;
          pages: number;
        };
      }>(`/api/visits?${params.toString()}`);

      // Debug: Log the visits API response
      console.log('Visits API response:', {
        visitCount: response.visits.length,
        hasRecurringVisits: response.visits.some(v => v.recurrence_type && v.recurrence_type !== 'none'),
        pagination: response.pagination
      });

      return response;
    } catch (error: any) {
      throw new Error(error.message || 'Failed to fetch visits');
    }
  }

  async getTodaysVisits(facilityId?: string): Promise<{
    visits: Visit[];
  }> {
    try {
      const params = new URLSearchParams();
      if (facilityId) params.append('facility_id', facilityId);

      const response = await apiClient.get<{
        visits: Visit[];
      }>(`/api/visits/today?${params.toString()}`);

      // Ensure visits is always an array, even if the API returns unexpected data
      return {
        visits: Array.isArray(response.visits) ? response.visits : []
      };
    } catch (error: any) {
      // Return empty array on error
      return { visits: [] };
    }
  }

  async checkInVisitor(visitId: string, location?: string): Promise<Visit> {
    try {
      const response = await apiClient.post<{
        message: string;
        visit: Visit;
      }>(`/api/visits/${visitId}/check-in`, { location });

      return response.visit;
    } catch (error: any) {
      throw new Error(error.message || 'Failed to check in visitor');
    }
  }

  // Corrected: getVisitDetailsByQrToken now expects and returns an Invitation
  async getVisitDetailsByQrToken(qrToken: string): Promise<Invitation> { // Changed return type to Invitation
    try {
      const response = await apiClient.get<{
        message: string;
        invitation: Invitation; // Expect 'invitation' property
      }>(`/api/qr-check-in?token=${encodeURIComponent(qrToken)}`); // Pass token as query parameter

      return response.invitation; // Return the invitation object
    } catch (error: any) {
      throw new Error(error.message || 'Failed to validate QR code token');
    }
  }

  async qrCheckInVisitor(qrToken: string, location?: string, badgeType: 'printed' | 'civ_piv_i' = 'printed'): Promise<{
    visit: Visit;
    badge: Badge;
  }> {
    try {
      const response = await apiClient.post<{
        message: string;
        visit: Visit;
        badge: Badge;
      }>('/api/visits/qr-check-in', {
        qr_token: qrToken,
        location,
        badge_type: badgeType
      });

      return {
        visit: response.visit,
        badge: response.badge
      };
    } catch (error: any) {
      throw new Error(error.message || 'Failed to check in visitor using QR code');
    }
  }

  async checkOutVisitor(visitId: string, location?: string): Promise<Visit> {
    try {
      const response = await apiClient.post<{
        message: string;
        visit: Visit;
      }>(`/api/visits/${visitId}/check-out`, { location });

      return response.visit;
    } catch (error: any) {
      throw new Error(error.message || 'Failed to check out visitor');
    }
  }

  // Host operations
  async getHosts(facilityId?: string): Promise<Host[]> {
    try {
      // If facilityId is provided, use the facility-specific endpoint
      if (facilityId) {
        const response = await apiClient.get<{
          hosts: Host[];
        }>(`/api/hosts/facility/${facilityId}`);
        return response.hosts;
      } else {
        // Otherwise, get all hosts
        const response = await apiClient.get<{
          hosts: Host[];
          pagination: any;
        }>('/api/hosts');
        return response.hosts;
      }
    } catch (error: any) {
      throw new Error(error.message || 'Failed to fetch hosts');
    }
  }

  async getHostsByProfile(profileId: string): Promise<Host[]> {
    try {
      const response = await apiClient.get<{
        hosts: Host[];
      }>(`/api/hosts/profile/${profileId}`);
      return response.hosts;
    } catch (error: any) {
      throw new Error(error.message || 'Failed to fetch hosts for profile');
    }
  }

  async createHost(hostData: {
    profile_id: string;
    facility_id: string;
    notification_preferences?: any;
    max_concurrent_visitors?: number;
    is_available?: boolean;
  }): Promise<Host> {
    try {
      const response = await apiClient.post<{
        message: string;
        host: Host;
      }>('/api/hosts', hostData);
      return response.host;
    } catch (error: any) {
      throw new Error(error.message || 'Failed to create host');
    }
  }

  async updateHost(id: string, updates: {
    notification_preferences?: any;
    max_concurrent_visitors?: number;
    is_available?: boolean;
  }): Promise<Host> {
    try {
      const response = await apiClient.put<{
        message: string;
        host: Host;
      }>(`/api/hosts/${id}`, updates);
      return response.host;
    } catch (error: any) {
      throw new Error(error.message || 'Failed to update host');
    }
  }

  async deactivateHost(id: string): Promise<void> {
    try {
      await apiClient.delete(`/api/hosts/${id}`);
    } catch (error: any) {
      throw new Error(error.message || 'Failed to deactivate host');
    }
  }

  // Facility operations
  async getFacilities(): Promise<Facility[]> {
    try {
      const response = await apiClient.get<{
        facilities: Facility[];
      }>('/api/facilities');

      return response.facilities;
    } catch (error: any) {
      throw new Error(error.message || 'Failed to fetch facilities');
    }
  }

  async createFacility(facilityData: Omit<Facility, 'id' | 'created_at' | 'updated_at'>): Promise<Facility> {
    try {
      const response = await apiClient.post<{
        message: string;
        facility: Facility;
      }>('/api/facilities', facilityData);

      return response.facility;
    } catch (error: any) {
      throw new Error(error.message || 'Failed to create facility');
    }
  }

  async updateFacility(id: string, updates: Partial<Facility>): Promise<Facility> {
    try {
      const response = await apiClient.put<{
        message: string;
        facility: Facility;
      }>(`/api/facilities/${id}`, updates);

      return response.facility;
    } catch (error: any) {
      throw new Error(error.message || 'Failed to update facility');
    }
  }

  // Badge management
  async createBadge(visitId: string, accessZones: string[] = [], badgeType: 'printed' | 'civ_piv_i' = 'printed'): Promise<Badge> {
    try {
      const response = await apiClient.post<{
        message: string;
        badge: Badge;
      }>('/api/enhanced-badges', {
        visit_id: visitId,
        access_zones: accessZones,
        badge_type: badgeType
      });

      return response.badge;
    } catch (error: any) {
      throw new Error(error.message || 'Failed to create badge');
    }
  }

  async deactivateBadge(badgeId: string): Promise<void> {
    try {
      await apiClient.put(`/api/enhanced-badges/${badgeId}`, {
        is_active: false,
        returned_at: new Date().toISOString()
      });
    } catch (error: any) {
      throw new Error(error.message || 'Failed to deactivate badge');
    }
  }

  async reportBadgeLost(badgeId: string): Promise<void> {
    try {
      await apiClient.put(`/api/enhanced-badges/${badgeId}/lost`, {
        reported_lost_at: new Date().toISOString()
      });
    } catch (error: any) {
      throw new Error(error.message || 'Failed to report badge as lost');
    }
  }

  // Analytics
  async getVisitStats(facilityId?: string, days = 30): Promise<any> {
    try {
      const params = new URLSearchParams();
      if (facilityId) params.append('facility_id', facilityId);
      params.append('days', days.toString());

      const response = await apiClient.get<{
        stats: any;
      }>(`/api/visits/stats/overview?${params.toString()}`);

      return response.stats;
    } catch (error: any) {
      throw new Error(error.message || 'Failed to fetch visit statistics');
    }
  }

  // Calendar export
  async exportCalendar(format: string = 'ics', filters?: any): Promise<Blob> {
    try {
      const params = new URLSearchParams();
      params.append('format', format);
      
      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          if (value) params.append(key, value as string);
        });
      }

      const response = await fetch(`${apiClient.getBaseURL()}/api/visits/export-calendar?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${apiClient.getToken()}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to export calendar');
      }

      return await response.blob();
    } catch (error: any) {
      throw new Error(error.message || 'Failed to export calendar');
    }
  }
}

export const visitorService = new VisitorService();
