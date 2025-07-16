import { useState, useCallback } from 'react';
import { roleService } from '../services/role';
import type { Role, Permission, RoleWithPermissions, PermissionGroup } from '../types/role';

export const useRole = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [permissionGroups, setPermissionGroups] = useState<PermissionGroup[]>([]);

  const clearError = () => setError(null);

  const getRoles = useCallback(async (): Promise<Role[]> => {
    setLoading(true);
    setError(null);
    
    try {
      const rolesData = await roleService.getRoles();
      setRoles(rolesData);
      return rolesData;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const getRole = useCallback(async (id: string): Promise<RoleWithPermissions> => {
    setLoading(true);
    setError(null);
    
    try {
      const role = await roleService.getRole(id);
      return role;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const createRole = useCallback(async (roleData: {
    name: string;
    description?: string;
    permissions?: string[];
  }): Promise<RoleWithPermissions> => {
    setLoading(true);
    setError(null);
    
    try {
      const role = await roleService.createRole(roleData);
      setRoles(prev => [role, ...prev]);
      return role;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateRole = useCallback(async (id: string, updates: {
    name?: string;
    description?: string;
  }): Promise<RoleWithPermissions> => {
    setLoading(true);
    setError(null);
    
    try {
      const role = await roleService.updateRole(id, updates);
      setRoles(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));
      return role;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteRole = useCallback(async (id: string): Promise<void> => {
    setLoading(true);
    setError(null);
    
    try {
      await roleService.deleteRole(id);
      setRoles(prev => prev.filter(r => r.id !== id));
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const getAllPermissions = useCallback(async (): Promise<Permission[]> => {
    setLoading(true);
    setError(null);
    
    try {
      const permissionsData = await roleService.getAllPermissions();
      setPermissions(permissionsData);
      
      // Group permissions by resource
      const groups: Record<string, Permission[]> = {};
      permissionsData.forEach(permission => {
        if (!groups[permission.resource]) {
          groups[permission.resource] = [];
        }
        groups[permission.resource].push(permission);
      });
      
      const groupsArray: PermissionGroup[] = Object.entries(groups).map(([resource, permissions]) => ({
        resource,
        permissions
      }));
      
      setPermissionGroups(groupsArray);
      
      return permissionsData;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const getRolePermissions = useCallback(async (role: string): Promise<string[]> => {
    setLoading(true);
    setError(null);
    
    try {
      const permissions = await roleService.getRolePermissions(role);
      return permissions;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const assignPermissions = useCallback(async (roleId: string, permissionIds: string[]): Promise<RoleWithPermissions> => {
    setLoading(true);
    setError(null);
    
    try {
      const role = await roleService.assignPermissions(roleId, permissionIds);
      return role;
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
    roles,
    permissions,
    permissionGroups,
    clearError,
    getRoles,
    getRole,
    getRolePermissions,
    createRole,
    updateRole,
    deleteRole,
    getAllPermissions,
    assignPermissions
  };
};