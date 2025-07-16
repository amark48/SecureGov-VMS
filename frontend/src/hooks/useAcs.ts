// src/hooks/useAcs.ts
import { useState, useCallback } from 'react';
import type { AcsProvider } from '../types/acs';

export const useAcs = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [acsProviders, setAcsProviders] = useState<AcsProvider[]>([]);

  const clearError = () => setError(null);

  const getAcsProviders = useCallback(async (): Promise<AcsProvider[]> => {
    setLoading(true);
    setError(null);
    try {
      // Simulate API call
      const mockProviders: AcsProvider[] = [
        {
          id: 'acs-1',
          tenant_id: 'tenant-1',
          name: 'Main Lenel System',
          provider_type: 'lenel',
          config: { url: 'https://lenel.example.com/api', apiKey: 'mock-lenel-key' },
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: 'acs-2',
          tenant_id: 'tenant-1',
          name: 'S2 Security - Building B',
          provider_type: 's2security',
          config: { ipAddress: '192.168.1.100', username: 'admin' },
          is_active: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: 'acs-3',
          tenant_id: 'tenant-1',
          name: 'Ccure 9000 - Main Campus',
          provider_type: 'ccure9000',
          config: { 
            serverAddress: '10.0.1.50', 
            port: '9000',
            username: 'admin',
            domain: 'CCURE',
            applicationName: 'CCure 9000',
            stationName: 'Reception'
          },
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];
      await new Promise(resolve => setTimeout(resolve, 500)); // Simulate network delay
      setAcsProviders(mockProviders);
      return mockProviders;
    } catch (err: any) {
      setError(err.message || 'Failed to fetch ACS providers');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const createAcsProvider = useCallback(async (data: Omit<AcsProvider, 'id' | 'created_at' | 'updated_at'>): Promise<AcsProvider> => {
    setLoading(true);
    setError(null);
    try {
      // Simulate API call
      const newProvider: AcsProvider = {
        ...data,
        id: `acs-${Date.now()}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      await new Promise(resolve => setTimeout(resolve, 500));
      setAcsProviders(prev => [...prev, newProvider]);
      return newProvider;
    } catch (err: any) {
      setError(err.message || 'Failed to create ACS provider');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateAcsProvider = useCallback(async (id: string, updates: Partial<AcsProvider>): Promise<AcsProvider> => {
    setLoading(true);
    setError(null);
    try {
      // Simulate API call
      const updatedProvider = {
        ...(acsProviders.find(p => p.id === id) || {}),
        ...updates,
        updated_at: new Date().toISOString(),
      } as AcsProvider;
      await new Promise(resolve => setTimeout(resolve, 500));
      setAcsProviders(prev => prev.map(p => p.id === id ? updatedProvider : p));
      return updatedProvider;
    } catch (err: any) {
      setError(err.message || 'Failed to update ACS provider');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [acsProviders]);

  const deleteAcsProvider = useCallback(async (id: string): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 500));
      setAcsProviders(prev => prev.filter(p => p.id !== id));
    } catch (err: any) {
      setError(err.message || 'Failed to delete ACS provider');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const testAcsConnection = useCallback(async (id: string): Promise<{ success: boolean; message: string }> => {
    setLoading(true);
    setError(null);
    try {
      // Make a real API call to test the connection
      const response = await apiClient.post<{ success: boolean; message: string }>(
        `/api/acs/configurations/${id}/test`,
        {}
      );
      return response;
    } catch (err: any) {
      setError(err.message || 'Failed to test connection');
      return { success: false, message: err.message || 'Connection test failed.' };
    } finally {
      setLoading(false);
    }
  }, [acsProviders]);

  return {
    loading,
    error,
    acsProviders,
    clearError,
    getAcsProviders,
    createAcsProvider,
    updateAcsProvider,
    deleteAcsProvider,
    testAcsConnection,
  };
};