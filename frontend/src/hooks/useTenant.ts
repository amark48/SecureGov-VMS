// src/hooks/useTenant.ts
import { useState, useCallback } from 'react';
import { tenantService } from '../services/tenant';
import type { Tenant, IdentityProvider } from '../types/tenant';

export const useTenant = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [tenantLoaded, setTenantLoaded] = useState<{[key: string]: boolean}>({});
  const [tenantInfo, setTenantInfo] = useState<{
    tenant_prefix?: string;
    next_employee_sequence?: number;
  } | null>(null);

  const clearError = () => setError(null);

  const getTenants = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const tenantsData = await tenantService.getTenants();
      setTenants(tenantsData);
      return tenantsData;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const getTenant = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    console.log('Getting tenant data for ID:', id);
    try {
      const response = await tenantService.getTenant(id);
      setTenantLoaded(prev => ({...prev, [id]: true}));
      return response;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const createTenant = useCallback(async (tenantData: Omit<Tenant, 'id' | 'created_at' | 'updated_at'>) => {
    setLoading(true);
    setError(null);
    
    try {
      const tenant = await tenantService.createTenant(tenantData);
      setTenants(prev => [tenant, ...prev]);
      return tenant;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Modified updateTenant to no longer handle identity_providers directly
  const updateTenant = useCallback(async (id: string, updates: Partial<Tenant>) => {
    setLoading(true);
    setError(null);
    
    try {
      // Separate custom_departments from other tenant updates
      const { custom_departments, ...otherUpdates } = updates;

      // Perform main tenant update
      const response = await tenantService.updateTenant(id, otherUpdates);
      
      // If custom_departments is provided, update it separately
      if (custom_departments !== undefined) {
        const departmentsArray = Array.isArray(custom_departments) ? custom_departments : [];
        await tenantService.updateCustomDepartments(id, departmentsArray);
      }

      // Fetch the updated tenant to ensure all changes are reflected
      const updatedTenant = await tenantService.getTenant(id);
      setTenants(prev => prev.map(t => t.id === id ? updatedTenant : t));
      return updatedTenant;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateNotificationProviders = useCallback(async (id: string, updates: {
    email_provider?: string;
    email_config?: any;
    sms_provider?: string;
    sms_config?: any;
    push_provider?: string;
    push_config?: any;
  }) => {
    setLoading(true);
    setError(null);
    
    try {
      const tenant = await tenantService.updateNotificationProviders(id, updates);
      setTenants(prev => prev.map(t => t.id === id ? tenant : t));
      return tenant;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateCustomDepartments = useCallback(async (id: string, departments: string[]) => {
    setLoading(true);
    setError(null);
    
    try {
      const tenant = await tenantService.updateCustomDepartments(id, departments);
      setTenants(prev => prev.map(t => t.id === id ? tenant : t));
      return tenant;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const deactivateTenant = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    
    try {
      await tenantService.deactivateTenant(id);
      setTenants(prev => prev.map(t => t.id === id ? { ...t, is_active: false } : t));
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const getTenantStats = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    
    try {
      const stats = await tenantService.getTenantStats(id);
      return stats;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const getAllTenantsStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const stats = await tenantService.getAllTenantsStats();
      return stats;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const getSystemStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const stats = await tenantService.getSystemStats();
      return stats;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const getSystemActivity = useCallback(async (limit: number = 10) => {
    setLoading(true);
    setError(null);
    
    try {
      const activities = await tenantService.getSystemActivity(limit);
      return activities;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const getSystemAlerts = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const alerts = await tenantService.getSystemAlerts();
      return alerts;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);


  const setTenantInfoData = useCallback((info: {
    tenant_prefix?: string;
    next_employee_sequence?: number;
  } | null) => {
    setTenantInfo(info);
  }, []);

  return {
    loading,
    error,
    tenants,
    tenantLoaded,
    tenantInfo,
    setTenantInfo: setTenantInfoData,
    clearError,
    getTenants,
    getTenant,
    createTenant,
    updateTenant,
    updateNotificationProviders,
    updateCustomDepartments,
    deactivateTenant,
    getTenantStats,
    getAllTenantsStats,
    getSystemStats,
    getSystemActivity,
    getSystemAlerts
  };
};
