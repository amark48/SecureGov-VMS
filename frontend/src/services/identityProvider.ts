// src/services/identityProvider.ts
import { apiClient } from './api';
import type { IdentityProvider } from '../types/tenant'; // Assuming IdentityProvider is defined here

class IdentityProviderService {
  async getIdentityProviders(tenantId?: string): Promise<IdentityProvider[]> {
    try {
      const params = new URLSearchParams();
      if (tenantId) {
        params.append('tenant_id', tenantId);
      }
      const response = await apiClient.get<{
        identity_providers: IdentityProvider[];
      }>(`/api/identity-providers?${params.toString()}`);
      return response.identity_providers;
    } catch (error: any) {
      throw new Error(error.message || 'Failed to fetch identity providers');
    }
  }

  async createIdentityProvider(data: Omit<IdentityProvider, 'id' | 'created_at' | 'updated_at'>): Promise<IdentityProvider> {
    try {
      const response = await apiClient.post<{
        message: string;
        identity_provider: IdentityProvider;
      }>('/api/identity-providers', data);
      return response.identity_provider;
    } catch (error: any) {
      throw new Error(error.message || 'Failed to create identity provider');
    }
  }

  async updateIdentityProvider(id: string, updates: Partial<IdentityProvider>): Promise<IdentityProvider> {
    try {
      const response = await apiClient.put<{
        message: string;
        identity_provider: IdentityProvider;
      }>(`/api/identity-providers/${id}`, updates);
      return response.identity_provider;
    } catch (error: any) {
      throw new Error(error.message || 'Failed to update identity provider');
    }
  }

  async deleteIdentityProvider(id: string): Promise<void> {
    try {
      await apiClient.delete(`/api/identity-providers/${id}`);
    } catch (error: any) {
      throw new Error(error.message || 'Failed to delete identity provider');
    }
  }

  async deactivateIdentityProvider(id: string): Promise<IdentityProvider> {
    try {
      const response = await apiClient.post<{
        message: string;
        identity_provider: IdentityProvider;
      }>(`/api/identity-providers/${id}/deactivate`, {});
      return response.identity_provider;
    } catch (error: any) {
      throw new Error(error.message || 'Failed to deactivate identity provider');
    }
  }
}

export const identityProviderService = new IdentityProviderService();
