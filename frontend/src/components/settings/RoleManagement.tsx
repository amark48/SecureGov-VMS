import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Shield, 
  Check, 
  X, 
  Save, 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle, 
  XCircle,
  Info,
  Eye,
  EyeOff,
  Filter,
  Search,
  Plus,
  Edit,
  Trash2,
  ChevronRight
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useRole } from '../../hooks/useRole'; 
import { LoadingButton, Loading } from '../common/Loading';
import type { Role, Permission, RoleWithPermissions } from '../../types/role';

export const RoleManagement: React.FC = () => {
  const { user, isSuperAdmin, hasRole } = useAuth();
  
  // Debug: Log user object to check role and permissions
  console.log('RoleManagement - User object:', user);
  
  const { 
    getAllPermissions,
    getRolePermissions,
    assignPermissions,
    createRole,
    updateRole,
    deleteRole,
    getRoles,
    loading: roleLoading,
    error: roleError,
    clearError
  } = useRole();
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [filteredPermissions, setFilteredPermissions] = useState<Permission[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [rolePermissions, setRolePermissions] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showDescriptions, setShowDescriptions] = useState(true);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [newRoleData, setNewRoleData] = useState({
    name: '',
    description: '',
    permissions: [] as string[] // This will store permission IDs, not names
  });
  
  // Permission categories
  const categories = [
    { value: 'all', label: 'All Permissions' },
    { value: 'dashboard', label: 'Dashboard' },
    { value: 'visitors', label: 'Visitors' },
    { value: 'visits', label: 'Visits' },
    { value: 'hosts', label: 'Hosts' },
    { value: 'facilities', label: 'Facilities' },
    { value: 'security', label: 'Security' },
    { value: 'emergency', label: 'Emergency' },
    { value: 'audit', label: 'Audit' },
    { value: 'settings', label: 'Settings' },
    { value: 'tenants', label: 'Tenants' },
    { value: 'invitations', label: 'Invitations' },
    { value: 'badges', label: 'Badges' },
    { value: 'calendar', label: 'Calendar' }
  ];

  // Clear success message after 5 seconds
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => {
        setSuccessMessage(null);
        // Refresh roles list after creating a new role
        loadRoles();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  // Clear error message after 5 seconds
  useEffect(() => {
    if (errorMessage) {
      const timer = setTimeout(() => setErrorMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [errorMessage]);

  // Load permissions and roles on component mount
  useEffect(() => {
    loadPermissions();
    loadRoles();
  }, []);

  // Load role permissions when selected role changes
  useEffect(() => {
    if (selectedRole) {
      loadRolePermissions(selectedRole.id);
    }
  }, [selectedRole]);

  // Filter permissions when search query or category changes
  useEffect(() => {
    filterPermissions();
  }, [permissions, searchQuery, filterCategory]);

  // Function to validate if a string is a valid UUID
  const isValidUUID = (uuid: string): boolean => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  };

  const loadPermissions = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAllPermissions();
      setPermissions(data);
      setFilteredPermissions(data);
    } catch (error: any) {
      setError(error.message || 'Failed to load permissions');
      console.error('Failed to load permissions:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadRoles = async () => {
    setLoading(true);
    try {
      const rolesData = await getRoles();
      setRoles(rolesData);
      
      // If no role is selected and we have roles, select the first one
      if (!selectedRole && rolesData.length > 0) {
        setSelectedRole(rolesData[0]);
      }
      
      return rolesData;
    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to load roles');
      console.error('Failed to load roles:', error);
      return [];
    } finally {
      setLoading(false);
    }
  };

  const loadRolePermissions = async (roleId: string) => {
    setLoading(true);
    setError(null);
    
    try {
      // Get permissions directly using the role ID
      const permissionsData = await getRolePermissions(roleId);
      setRolePermissions(permissionsData);
    } catch (error: any) {
      setError(error.message || 'Failed to load role permissions');
      setErrorMessage(error.message || 'Failed to load role permissions');
      console.error('Failed to load role permissions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage(null);
    
    try {
      await createRole({
        name: newRoleData.name,
        description: newRoleData.description,
        permissions: newRoleData.permissions
      });
      
      setSuccessMessage(`Role "${newRoleData.name}" created successfully`);
      setShowCreateForm(false);
      setNewRoleData({
        name: '',
        description: '',
        permissions: []
      });
      
      // Refresh roles list
      await loadRoles();
    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to create role');
      console.error('Failed to create role:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRole = async () => {
    if (!selectedRole) return;
    
    setLoading(true);
    setErrorMessage(null);
    
    try {
      await deleteRole(selectedRole.id);
      setSuccessMessage(`Role "${selectedRole.name}" deleted successfully`);
      setShowDeleteConfirm(false);
      
      // Refresh roles list and select the first role
      const updatedRoles = await loadRoles();
      if (updatedRoles.length > 0) {
        setSelectedRole(updatedRoles[0]);
      } else {
        setSelectedRole(null);
      }
    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to delete role');
      console.error('Failed to delete role:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterPermissions = () => {
    let filtered = [...permissions];

    // Filter by search query
    if (searchQuery) {
      filtered = filtered.filter(permission => 
        permission.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        permission.description.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Filter by category
    if (filterCategory !== 'all') {
      filtered = filtered.filter(permission => 
        permission.name.startsWith(`${filterCategory}:`)
        || permission.resource === filterCategory
      );
    }

    setFilteredPermissions(filtered);
  };

  const handleTogglePermission = (permissionName: string) => {
    if (rolePermissions.includes(permissionName)) {
      setRolePermissions(prev => prev.filter(p => p !== permissionName));
    } else {
      setRolePermissions(prev => [...prev, permissionName]);
    }
  };

  const handleTogglePermissionForNewRole = (permissionName: string) => {
    // Find the permission object by name
    const permission = permissions.find(p => p.name === permissionName);
    
    if (!permission) {
      console.error(`Permission not found: ${permissionName}`);
      return;
    }
    
    // Use the permission ID instead of name
    const permissionId = permission.id;
    
    if (newRoleData.permissions.includes(permissionId)) {
      setNewRoleData(prev => ({ ...prev, permissions: prev.permissions.filter(p => p !== permissionId) }));
    } else {
      setNewRoleData(prev => ({ ...prev, permissions: [...prev.permissions, permissionId] }));
    }
  };

  const handleSavePermissions = async () => {
    if (!selectedRole) {
      setErrorMessage('No role selected');
      return;
    }
    
    // Validate that selectedRole.id is a valid UUID before proceeding
    if (!isValidUUID(selectedRole.id)) {
      setErrorMessage(`Invalid role ID: ${selectedRole.id}. Please select a valid role.`);
      return;
    }
    
    setLoading(true);
    try {
      // Use the selected role ID directly
      await assignPermissions(selectedRole.id, rolePermissions);
      setSuccessMessage(`Permissions updated for ${selectedRole.name} role`);
    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to update permissions');
      console.error('Failed to update permissions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAll = () => {
    setRolePermissions(filteredPermissions.map(p => p.name));
  };

  const handleSelectNone = () => {
    setRolePermissions([]);
  };

  const getPermissionCategory = (permissionName: string): string => {
    const parts = permissionName.split(':');
    return parts[0] || '';
  };

  const formatPermissionName = (permissionName: string): string => {
    const parts = permissionName.split(':');
    if (parts.length < 2) return permissionName;
    
    return parts[1]
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const getCategoryColor = (category: string): string => {
    const colors: Record<string, string> = {
      dashboard: 'bg-blue-100 text-blue-800 border-blue-200',
      visitors: 'bg-green-100 text-green-800 border-green-200',
      visits: 'bg-indigo-100 text-indigo-800 border-indigo-200',
      hosts: 'bg-purple-100 text-purple-800 border-purple-200',
      facilities: 'bg-teal-100 text-teal-800 border-teal-200',
      security: 'bg-red-100 text-red-800 border-red-200',
      emergency: 'bg-orange-100 text-orange-800 border-orange-200',
      audit: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      settings: 'bg-gray-100 text-gray-800 border-gray-200',
      tenants: 'bg-pink-100 text-pink-800 border-pink-200',
      invitations: 'bg-cyan-100 text-cyan-800 border-cyan-200',
      badges: 'bg-lime-100 text-lime-800 border-lime-200',
      calendar: 'bg-amber-100 text-amber-800 border-amber-200'
    };
    
    return colors[category] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  // Check if the current user can edit the selected role
  const canEditRole = (): boolean => {
    // Super admins can edit any role
    if (isSuperAdmin()) return true;
    
    // If no role is selected, return false
    if (!selectedRole) return false;
    
    // Regular admins can edit any role within their tenant except the Admin role
    if (hasRole('admin')) {
      // Cannot edit Admin role
      if (selectedRole.name === 'Admin') return false;
      
      // Can edit any other role in their tenant
      return true;
    }
    
    // All other roles cannot edit roles
    return false;
  };

  // Check if the current user can delete the selected role
  const canDeleteRole = (): boolean => {
    if (!selectedRole) return false;
    
    // System roles cannot be deleted
    if (selectedRole.is_system) return false;
    
    // Only admins and super admins can delete roles
    return (typeof isSuperAdmin === 'function' && isSuperAdmin()) || user?.role === 'admin';
  };

  if (showCreateForm) {
    return (
      <div className="space-y-6">
        {/* Form Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">Create New Role</h2>
          <button
            onClick={() => setShowCreateForm(false)}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>

        {/* Error Message */}
        {errorMessage && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            <div className="flex items-center">
              <AlertTriangle className="w-5 h-5 mr-2" />
              <p className="font-medium">{errorMessage}</p>
            </div>
          </div>
        )}

        {/* Form */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <form onSubmit={handleCreateRole} className="space-y-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Role Name *
                </label>
                <input
                  type="text"
                  required
                  value={newRoleData.name}
                  onChange={(e) => setNewRoleData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="e.g., Security Manager"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={newRoleData.description}
                  onChange={(e) => setNewRoleData(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="Describe the role's responsibilities and access level"
                  rows={3}
                />
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-md font-medium text-gray-900">Assign Permissions</h3>
              <div className="max-h-96 overflow-y-auto p-4 border border-gray-200 rounded-lg">
                {permissions.map(permission => (
                  <div key={permission.id} className="flex items-center mb-2">
                    <input
                      type="checkbox"
                      id={`new-permission-${permission.id}`}
                      checked={newRoleData.permissions.includes(permission.id)}
                      onChange={() => handleTogglePermissionForNewRole(permission.name)}
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                    />
                    <label htmlFor={`new-permission-${permission.id}`} className="ml-2 block text-sm text-gray-900">
                      {permission.name}
                      {showDescriptions && <p className="text-xs text-gray-500">{permission.description}</p>}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Cancel
              </button>
              
              <LoadingButton
                loading={loading}
                variant="primary"
                size="md"
                type="submit"
              >
                Create Role
              </LoadingButton>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold mb-2">Role Management</h1>
            <p className="text-indigo-100">
              Configure permissions for each role in the system
            </p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold">{roles.length}</div>
            <div className="text-indigo-200 text-sm">Total Roles</div>
          </div>
        </div>
      </div>

      {/* Success/Error Messages */}
      {successMessage && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg flex items-center justify-between">
          <div className="flex items-center">
            <CheckCircle className="w-5 h-5 mr-2" />
            <p className="font-medium">{successMessage}</p>
          </div>
          <button 
            onClick={() => setSuccessMessage(null)}
            className="text-green-700 hover:text-green-900"
          >
            <XCircle className="w-5 h-5" />
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center justify-between">
          <div className="flex items-center">
            <AlertTriangle className="w-5 h-5 mr-2" />
            <p className="font-medium">{errorMessage}</p>
          </div>
          <button 
            onClick={() => setErrorMessage(null)}
            className="text-red-700 hover:text-red-900"
          >
            <XCircle className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Two-column layout */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left column - Role list */}
        <div className="lg:w-1/3">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900">Roles</h2>
              {hasRole('admin') && (
                <button
                  onClick={() => setShowCreateForm(true)}
                  className="flex items-center px-3 py-1.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add Role
                </button>
              )}
            </div>
            
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {roles.length === 0 ? (
                <div className="text-center py-8">
                  <Shield className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">No roles found</p>
                </div>
              ) : (
                roles.map(role => (
                  <div 
                    key={role.id}
                    onClick={() => setSelectedRole(role)}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedRole?.id === role.id 
                        ? 'border-indigo-300 bg-indigo-50' 
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-medium text-gray-900">{role.name}</h3>
                        {role.description && (
                          <p className="text-sm text-gray-500 mt-1">{role.description}</p>
                        )}
                        <div className="flex items-center mt-2 text-xs text-gray-500">
                          <Shield className="w-3 h-3 mr-1" />
                          <span>{role.permission_count || 0} permissions</span>
                          {role.is_system && (
                            <span className="ml-2 px-1.5 py-0.5 bg-gray-100 rounded text-gray-600">System</span>
                          )}
                        </div>
                      </div>
                      <ChevronRight className={`w-5 h-5 text-gray-400 ${selectedRole?.id === role.id ? 'text-indigo-500' : ''}`} />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right column - Permissions */}
        <div className="lg:w-2/3">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            {selectedRole ? (
              <>
                <div className="p-6 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900">
                        {selectedRole.name} Permissions
                      </h2>
                      {selectedRole.description && (
                        <p className="text-sm text-gray-500 mt-1">{selectedRole.description}</p>
                      )}
                    </div>
                    <div className="flex items-center space-x-3">
                      {canDeleteRole() && (
                        <button
                          onClick={() => setShowDeleteConfirm(true)}
                          className="flex items-center px-3 py-1.5 text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-500"
                        >
                          <Trash2 className="w-4 h-4 mr-1" />
                          Delete
                        </button>
                      )}
                      <button
                        onClick={() => setShowDescriptions(!showDescriptions)}
                        className="flex items-center px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        {showDescriptions ? (
                          <>
                            <EyeOff className="w-4 h-4 mr-1" />
                            Hide Details
                          </>
                        ) : (
                          <>
                            <Eye className="w-4 h-4 mr-1" />
                            Show Details
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="p-6 border-b border-gray-200">
                  <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <input
                        type="text"
                        placeholder="Search permissions..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      />
                    </div>

                    <div className="relative">
                      <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <select
                        value={filterCategory}
                        onChange={(e) => setFilterCategory(e.target.value)}
                        className="pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 appearance-none bg-white"
                      >
                        {categories.map(category => (
                          <option key={category.value} value={category.value}>
                            {category.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="p-6 border-b border-gray-200">
                  <div className="flex items-center justify-between mb-4">
                    <div className="text-sm text-gray-500">
                      {filteredPermissions.length} permissions available
                    </div>
                    <div className="flex items-center space-x-3">
                      <button
                        onClick={handleSelectAll}
                        disabled={!canEditRole()}
                        className="flex items-center px-3 py-1 text-sm font-medium text-indigo-700 bg-indigo-100 rounded-md hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                      >
                        <Check className="w-4 h-4 mr-1" />
                        Select All
                      </button>
                      <button
                        onClick={handleSelectNone}
                        disabled={!canEditRole()}
                        className="flex items-center px-3 py-1 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 disabled:opacity-50"
                      >
                        <X className="w-4 h-4 mr-1" />
                        Select None
                      </button>
                    </div>
                  </div>

                  {loading && permissions.length === 0 ? (
                    <Loading message="Loading permissions..." />
                  ) : (
                    <div className="space-y-6 max-h-[400px] overflow-y-auto">
                      {filteredPermissions.length === 0 ? (
                        <div className="text-center py-8">
                          <Shield className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                          <p className="text-gray-500 text-lg">No permissions found</p>
                          <p className="text-gray-400 text-sm">
                            {searchQuery || filterCategory !== 'all'
                              ? 'Try adjusting your search or filter criteria'
                              : 'No permissions have been defined yet'
                            }
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-6">
                          {/* Group permissions by category */}
                          {categories
                            .filter(category => 
                              category.value !== 'all' && 
                              filteredPermissions.some(p => getPermissionCategory(p.name) === category.value || p.resource === category.value)
                            )
                            .map(category => (
                              <div key={category.value} className="space-y-2">
                                <h3 className="text-md font-medium text-gray-900 flex items-center">
                                  <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium ${getCategoryColor(category.value)}`}>
                                    {category.label}
                                  </span>
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                  {filteredPermissions
                                    .filter(permission => getPermissionCategory(permission.name) === category.value || permission.resource === category.value)
                                    .map(permission => (
                                      <div 
                                        key={permission.id} 
                                        className={`p-3 rounded-lg border ${
                                          rolePermissions.includes(permission.name) 
                                            ? 'border-indigo-300 bg-indigo-50' 
                                            : 'border-gray-200 bg-white'
                                        } hover:bg-gray-50 transition-colors`}
                                      >
                                        <div className="flex items-start">
                                          <div className="flex-shrink-0 pt-0.5">
                                            <input
                                              type="checkbox"
                                              id={`permission-${permission.id}`}
                                              checked={rolePermissions.includes(permission.name)}
                                              onChange={() => handleTogglePermission(permission.name)}
                                              disabled={!canEditRole()}
                                            className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                                            />
                                          </div>
                                          <div className="ml-3">
                                            <label 
                                              htmlFor={`permission-${permission.id}`}
                                              className="block text-sm font-medium text-gray-900"
                                            >
                                              {formatPermissionName(permission.name)}
                                            </label>
                                            {showDescriptions && (
                                              <p className="text-xs text-gray-500 mt-1">
                                                {permission.description}
                                              </p>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    ))
                                  }
                                </div>
                              </div>
                            ))
                          }
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Save Button */}
                <div className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-gray-500">
                      {rolePermissions.length} permissions selected
                    </div>
                    <LoadingButton
                      loading={loading}
                      variant="primary"
                      size="md"
                      onClick={handleSavePermissions}
                      disabled={!canEditRole()}
                    >
                      <Save className="w-4 h-4 mr-2" />
                      Save Permissions
                    </LoadingButton>
                  </div>
                </div>
              </>
            ) : (
              <div className="p-12 text-center">
                <Shield className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500 text-lg">No role selected</p>
                <p className="text-gray-400 text-sm">
                  Select a role from the list to manage its permissions
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Information Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-medium text-blue-800">About Role Management</h3>
            <p className="text-sm text-blue-700 mt-1">
              Roles define what users can do in the system. Each role has a set of permissions that determine which actions users with that role can perform.
            </p>
            {!isSuperAdmin() && (
              <p className="text-sm text-blue-700 mt-1">
                Note: Only super administrators can modify the permissions for the Administrator role.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && selectedRole && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Delete Role</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete the role "{selectedRole.name}"? This action cannot be undone.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <LoadingButton
                loading={loading}
                variant="danger"
                size="md"
                onClick={handleDeleteRole}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Role
              </LoadingButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};