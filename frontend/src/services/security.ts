import { apiClient } from './api';
import type { WatchlistEntry, AuditLog, SecurityAlert, EmergencyContact } from '../types/security';
import type { Visitor } from '../types/visitor';

export class SecurityService {
  // Watchlist management
  async createWatchlistEntry(entryData: Omit<WatchlistEntry, 'id' | 'created_at' | 'updated_at'>): Promise<WatchlistEntry> {
    try {
      const response = await apiClient.post<{
        message: string;
        entry: WatchlistEntry;
      }>('/api/security/watchlist', entryData);

      return response.entry;
    } catch (error: any) {
      throw new Error(error.message || 'Failed to create watchlist entry');
    }
  }

  async updateWatchlistEntry(id: string, updates: Partial<WatchlistEntry>): Promise<WatchlistEntry> {
    try {
      const response = await apiClient.put<{
        message: string;
        entry: WatchlistEntry;
      }>(`/api/security/watchlist/${id}`, updates);

      return response.entry;
    } catch (error: any) {
      throw new Error(error.message || 'Failed to update watchlist entry');
    }
  }

  async getWatchlist(): Promise<WatchlistEntry[]> {
    try {
      const response = await apiClient.get<{
        watchlist: WatchlistEntry[];
        pagination: any;
      }>('/api/security/watchlist');

      return response.watchlist;
    } catch (error: any) {
      throw new Error(error.message || 'Failed to fetch watchlist');
    }
  }

  async screenVisitor(visitor: Visitor): Promise<WatchlistEntry[]> {
    try {
      const response = await apiClient.post<{
        matches: WatchlistEntry[];
        screening_summary: any;
      }>('/api/security/screen', {
        first_name: visitor.first_name,
        last_name: visitor.last_name,
        id_number: visitor.id_number
      });

      return response.matches;
    } catch (error: any) {
      throw new Error(error.message || 'Failed to screen visitor');
    }
  }

  // Audit log management
  async getAuditLogs(limit = 100, offset = 0, filters?: {
    user_id?: string;
    action?: string;
    table_name?: string;
    start_date?: string;
    end_date?: string;
    compliance_flag?: string;
    tenant_id?: string; // Added tenant_id filter
  }): Promise<AuditLog[]> {
    try {
      const params = new URLSearchParams();
      params.append('limit', limit.toString());
      params.append('page', (Math.floor(offset / limit) + 1).toString());
      
      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          if (value) params.append(key, value as string);
        });
      }

      const response = await apiClient.get<{
        logs: AuditLog[];
        pagination: any;
      }>(`/api/audit/logs?${params.toString()}`);

      return response.logs;
    } catch (error: any) {
      throw new Error(error.message || 'Failed to fetch audit logs');
    }
  }

  async getAuditStats(): Promise<any> {
    try {
      const response = await apiClient.get<any>('/api/audit/stats');
      return response;
    } catch (error: any) {
      throw new Error(error.message || 'Failed to fetch audit statistics');
    }
  }

  async exportAuditLogs(filters?: any): Promise<Blob> {
    try {
      const params = new URLSearchParams();
      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          if (value) params.append(key, value as string);
        });
      }

      const response = await fetch(`${apiClient.getBaseURL()}/api/audit/export?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${apiClient.getToken()}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to export audit logs');
      }

      return await response.blob();
    } catch (error: any) {
      throw new Error(error.message || 'Failed to export audit logs');
    }
  }

  async generateComplianceReport(facilityId: string, startDate: string, endDate: string): Promise<any> {
    try {
      const response = await apiClient.post<{
        message: string;
        report: any;
      }>('/api/audit/compliance-report', {
        facility_id: facilityId,
        start_date: startDate,
        end_date: endDate
      });

      return response.report;
    } catch (error: any) {
      throw new Error(error.message || 'Failed to generate compliance report');
    }
  }

  // Emergency contacts
  async getEmergencyContacts(facilityId: string): Promise<EmergencyContact[]> {
    try {
      const response = await apiClient.get<{
        contacts: EmergencyContact[];
      }>(`/api/emergency/contacts?facility_id=${facilityId}`);

      return response.contacts;
    } catch (error: any) {
      throw new Error(error.message || 'Failed to fetch emergency contacts');
    }
  }

  async createEmergencyContact(contactData: Omit<EmergencyContact, 'id' | 'created_at' | 'updated_at'>): Promise<EmergencyContact> {
    try {
      const response = await apiClient.post<{
        message: string;
        contact: EmergencyContact;
      }>('/api/emergency/contacts', contactData);

      return response.contact;
    } catch (error: any) {
      throw new Error(error.message || 'Failed to create emergency contact');
    }
  }

  // Security alerts
  async createSecurityAlert(alertData: Omit<SecurityAlert, 'id' | 'created_at'>): Promise<SecurityAlert> {
    try {
      const response = await apiClient.post<{
        message: string;
        alert: SecurityAlert;
      }>('/api/security/alerts', alertData);

      return response.alert;
    } catch (error: any) {
      throw new Error(error.message || 'Failed to create security alert');
    }
  }

  async getActiveSecurityAlerts(facilityId?: string): Promise<SecurityAlert[]> {
    try {
      const params = new URLSearchParams();
      if (facilityId) params.append('facility_id', facilityId);
      
      const response = await apiClient.get<{
        alerts: SecurityAlert[];
        pagination: any;
      }>(`/api/security/alerts?${params.toString()}`);

      return response.alerts;
    } catch (error: any) {
      throw new Error(error.message || 'Failed to fetch security alerts');
    }
  }

  async resolveSecurityAlert(alertId: string, resolutionNotes?: string): Promise<SecurityAlert> {
    try {
      const response = await apiClient.put<{
        message: string;
        alert: SecurityAlert;
      }>(`/api/security/alerts/${alertId}/resolve`, {
        resolution_notes: resolutionNotes
      });

      return response.alert;
    } catch (error: any) {
      throw new Error(error.message || 'Failed to resolve security alert');
    }
  }

  // Statistics
  async getSecurityStats(): Promise<any> {
    try {
      const response = await apiClient.get<any>('/api/security/stats');
      return response;
    } catch (error: any) {
      throw new Error(error.message || 'Failed to fetch security statistics');
    }
  }
}

export const securityService = new SecurityService();
