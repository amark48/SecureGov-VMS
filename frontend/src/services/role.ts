import { apiClient } from './api';
import type { Role, Permission, RoleWithPermissions } from '../types/role';

export class RoleService {
  async getRoles(): Promise<Role[]> {
    try {
      const response = await apiClient.get<{
        roles: Role[];
      }>('/api/roles');

      return response.roles;
    } catch (error: any) {
      throw new Error(error.message || 'Failed to fetch roles');
    }
  }

  async getRole(id: string): Promise<RoleWithPermissions> {
    try {
      const response = await apiClient.get<{
        role: RoleWithPermissions;
      }>(`/api/roles/${id}`);

      return response.role;
    } catch (error: any) {
      throw new Error(error.message || 'Failed to fetch role');
    }
  }

  async createRole(roleData: {
    name: string;
    description?: string;
    permissions?: string[];
  }): Promise<RoleWithPermissions> {
    try {
      const response = await apiClient.post<{
        message: string;
        role: RoleWithPermissions;
      }>('/api/roles', roleData);

      return response.role;
    } catch (error: any) {
      throw new Error(error.message || 'Failed to create role');
    }
  }

  async updateRole(id: string, updates: {
    name?: string;
    description?: string;
  }): Promise<RoleWithPermissions> {
    try {
      const response = await apiClient.put<{
        message: string;
        role: RoleWithPermissions;
      }>(`/api/roles/${id}`, updates);

      return response.role;
    } catch (error: any) {
      throw new Error(error.message || 'Failed to update role');
    }
  }

  async deleteRole(id: string): Promise<void> {
    try {
      // Validate that id is a UUID
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(id)) {
        throw new Error(`Invalid role ID format: ${id}`);
      }
      
      await apiClient.delete(`/api/roles/${id}`);
    } catch (error: any) {
      throw new Error(error.message || 'Failed to delete role');
    }
  }

  async getAllPermissions(): Promise<Permission[]> {
    try {
      const response = await apiClient.get<{
        permissions: Permission[];
      }>('/api/roles/permissions/all');

      return response.permissions;
    } catch (error: any) {
      throw new Error(error.message || 'Failed to fetch permissions');
    }
  }

  async getRolePermissions(roleId: string): Promise<string[]> {
    try {
      // Check if roleId is a UUID (role ID) or a string (role name)
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      let response;
      
      if (uuidRegex.test(roleId)) {
        // If it's a UUID, use the role ID endpoint
        response = await apiClient.get<{
          permissions: string[];
        }>(`/api/roles/${roleId}/permissions`);
      } else {
        // Otherwise use the role name endpoint
        response = await apiClient.get<{
          permissions: string[];
        }>(`/api/roles/permissions/role/${roleId}`);
      }

      return response.permissions;
    } catch (error: any) {
      throw new Error(error.message || 'Failed to fetch role permissions');
    }
  }

  async assignPermissions(roleId: string, permissionIds: string[]): Promise<RoleWithPermissions> {
    try {
      // Validate that roleId is a UUID
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(roleId)) {
        throw new Error(`Invalid role ID format: ${roleId}`);
      }
      
      const response = await apiClient.post<{
        message: string;
        role: RoleWithPermissions;
      }>(`/api/roles/${roleId}/permissions`, {
        permissions: permissionIds
      });

      if (!response.role) {
        throw new Error('Failed to assign permissions: No role data returned from server');
      }

      return response.role;
    } catch (error: any) {
      throw new Error(error.message || 'Failed to assign permissions');
    }
  }
}

export const roleService = new RoleService();