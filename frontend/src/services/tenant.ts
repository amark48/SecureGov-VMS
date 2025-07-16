// src/services/tenant.ts
import { apiClient } from './api';
import type { Tenant, IdentityProvider } from '../types/tenant';

class TenantService {
  async getTenants(): Promise<Tenant[]> {
    try {
      const response = await apiClient.get<{
        tenants: Tenant[];
      }>('/api/tenants');

      return response.tenants;
    } catch (error: any) {
      throw new Error(error.message || 'Failed to fetch tenants');
    }
  }

  async getTenant(id: string): Promise<Tenant> {
    try {
      const response = await apiClient.get<{
        tenant: Tenant;
      }>(`/api/tenants/${id}`);

      return response.tenant;
    } catch (error: any) {
      throw new Error(error.message || 'Failed to fetch tenant');
    }
  }

  async createTenant(tenantData: Omit<Tenant, 'id' | 'created_at' | 'updated_at'>): Promise<Tenant> {
    try {
      const response = await apiClient.post<{
        message: string;
        tenant: Tenant;
      }>('/api/tenants', tenantData);

      return response.tenant;
    } catch (error: any) {
      throw new Error(error.message || 'Failed to create tenant');
    }
  }

  // Modified updateTenant to no longer handle identity_providers directly
  async updateTenant(id: string, updates: Partial<Tenant>): Promise<Tenant> {
    try {
      console.log('Updating tenant with ID:', id);
      console.log('Original update payload:', updates);
      
      // Format auto_checkout_time to ensure it has seconds
      if (updates.auto_checkout_enabled && updates.auto_checkout_time) {
        // Strip any timezone information by taking only the HH:MM:SS part
        const timeParts = updates.auto_checkout_time.split(/[-+]/)[0].trim();
        
        // Ensure it has seconds
        if (!timeParts.includes(':')) {
          updates.auto_checkout_time = `${timeParts}:00:00`;
        } else if (timeParts.split(':').length === 2) {
          updates.auto_checkout_time = `${timeParts}:00`;
        } else {
          updates.auto_checkout_time = timeParts;
        }
        
        console.log('Formatted auto_checkout_time:', updates.auto_checkout_time);
      }
      
      // If auto_checkout_enabled is false, remove auto_checkout_time from the payload
      if (updates.auto_checkout_enabled === false) {
        delete updates.auto_checkout_time;
      }
      
      // Ensure early_checkin_minutes is a number
      if (updates.early_checkin_minutes !== undefined) {
        updates.early_checkin_minutes = Number(updates.early_checkin_minutes);
      }
      
      // Ensure civ_piv_i_issuance_enabled is a boolean
      if (updates.civ_piv_i_issuance_enabled !== undefined) {
        updates.civ_piv_i_issuance_enabled = Boolean(updates.civ_piv_i_issuance_enabled);
      }
      
      // Validate default_badge_type is one of the allowed values
      if (updates.default_badge_type && !['printed', 'civ_piv_i'].includes(updates.default_badge_type)) {
        console.warn(`Invalid default_badge_type: ${updates.default_badge_type}, defaulting to 'printed'`);
        updates.default_badge_type = 'printed';
      }
      
      const response = await apiClient.put<{ 
        message: string;
        tenant: Tenant;
      }>(`/api/tenants/${id}`, {...updates});
      
      console.log('Tenant update successful:', response.tenant);

      return response.tenant;
    } catch (error: any) {
      console.error('Failed to update tenant:', error);
      throw new Error(error.message || 'Failed to update tenant');
    }
  }

  // Removed updateIdentityProviders method from here

  async updateNotificationProviders(id: string, updates: {
    email_provider?: string;
    email_config?: any;
    sms_provider?: string;
    sms_config?: any;
    push_provider?: string;
    push_config?: any;
  }): Promise<Tenant> {
    try {
      const response = await apiClient.put<{
        message: string;
        tenant: Tenant;
      }>(`/api/tenants/${id}/notification-providers`, updates);

      return response.tenant;
    } catch (error: any) {
      throw new Error(error.message || 'Failed to update notification providers');
    }
  }

  async updateCustomDepartments(id: string, departments: string[]): Promise<Tenant> {
    try {
      const response = await apiClient.put<{
        message: string;
        tenant: Tenant;
      }>(`/api/tenants/${id}/departments`, { 
        custom_departments: departments 
      });

      return response.tenant;
    } catch (error: any) {
      throw new Error(error.message || 'Failed to update custom departments');
    }
  }

  async deactivateTenant(id: string): Promise<void> {
    try {
      await apiClient.put<{
        message: string;
      }>(`/api/tenants/${id}/deactivate`, {});
    } catch (error: any) {
      throw new Error(error.message || 'Failed to deactivate tenant');
    }
  }

  async getTenantStats(id: string): Promise<any> {
    try {
      const response = await apiClient.get<{
        tenant_id: string;
        user_stats: any;
        facility_stats: any;
        visitor_stats: any;
        visit_stats: any;
        audit_stats: any;
        daily_activity: any[];
      }>(`/api/tenants/${id}/stats`);

      return response;
    } catch (error: any) {
      throw new Error(error.message || 'Failed to fetch tenant statistics');
    }
  }

  async getAllTenantsStats(): Promise<any[]> {
    try {
      const response = await apiClient.get<{
        stats: any[];
      }>('/api/tenants/stats/all');

      return response.stats;
    } catch (error: any) {
      throw new Error(error.message || 'Failed to fetch all tenant statistics');
    }
  }

  async getSystemStats(): Promise<any> {
    try {
      const response = await apiClient.get<{
        stats: any;
      }>('/api/system/stats');

      return response.stats;
    } catch (error: any) {
      throw new Error(error.message || 'Failed to fetch system statistics');
    }
  }

  async getSystemActivity(limit: number = 10): Promise<any[]> {
    try {
      const response = await apiClient.get<{
        activities: any[];
      }>(`/api/system/activity?limit=${limit}`);

      return response.activities;
    } catch (error: any) {
      throw new Error(error.message || 'Failed to fetch system activity');
    }
  }

  async getSystemAlerts(): Promise<any[]> {
    try {
      const response = await apiClient.get<{
        alerts: any[];
      }>('/api/system/alerts');

      return response.alerts;
    } catch (error: any) {
      throw new Error(error.message || 'Failed to fetch system alerts');
    }
  }
}

export const tenantService = new TenantService();
