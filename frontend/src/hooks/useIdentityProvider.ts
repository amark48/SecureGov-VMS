// src/hooks/useIdentityProvider.ts
import { useState, useCallback } from 'react';
import { identityProviderService } from '../services/identityProvider';
import type { IdentityProvider } from '../types/tenant';

export const useIdentityProvider = () => {
  const [identityProviders, setIdentityProviders] = useState<IdentityProvider[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = () => setError(null);

  const fetchIdentityProviders = useCallback(async (tenantId?: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await identityProviderService.getIdentityProviders(tenantId);
      setIdentityProviders(data);
      return data;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const createIdentityProvider = useCallback(async (data: Omit<IdentityProvider, 'id' | 'created_at' | 'updated_at'>) => {
    setLoading(true);
    setError(null);
    try {
      const newProvider = await identityProviderService.createIdentityProvider(data);
      setIdentityProviders(prev => [...prev, newProvider]);
      return newProvider;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateIdentityProvider = useCallback(async (id: string, updates: Partial<IdentityProvider>) => {
    setLoading(true);
    setError(null);
    try {
      const updatedProvider = await identityProviderService.updateIdentityProvider(id, updates);
      setIdentityProviders(prev => prev.map(p => p.id === id ? updatedProvider : p));
      return updatedProvider;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteIdentityProvider = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      await identityProviderService.deleteIdentityProvider(id);
      setIdentityProviders(prev => prev.filter(p => p.id !== id));
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const deactivateIdentityProvider = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const deactivatedProvider = await identityProviderService.deactivateIdentityProvider(id);
      setIdentityProviders(prev => prev.map(p => p.id === id ? deactivatedProvider : p));
      return deactivatedProvider;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    identityProviders,
    loading,
    error,
    clearError,
    fetchIdentityProviders,
    createIdentityProvider,
    updateIdentityProvider,
    deleteIdentityProvider,
    deactivateIdentityProvider,
  };
};
