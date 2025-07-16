import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Plus, 
  Search, 
  Filter, 
  Edit, 
  Trash2,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RefreshCw,
  User,
  Mail,
  Phone,
  Building,
  Shield,
  Key,
  UserPlus,
  Eye,
  ChevronRight,
  ChevronLeft,
  UserCog,
  Calendar,
  Clock,
  UserCheck
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useTenant } from '../../hooks/useTenant';
import { LoadingButton, Loading } from '../common/Loading';
import { ConfirmationModal } from '../common/ConfirmationModal';
import { format } from 'date-fns';
import type { User as UserType } from '../../types/auth';

interface UserManagementProps {
  tenantId?: string; // Optional tenantId prop for filtering
}

export const UserManagement: React.FC<UserManagementProps> = ({ tenantId }) => {
  const { 
    user, 
    getAllUsers, 
    createUserByAdmin, 
    updateUserByAdmin, 
    resetUserPassword,
    loading, 
    error, 
    clearError 
  } = useAuth();
  const { setTenantInfo } = useTenant();

  const [users, setUsers] = useState<UserType[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserType[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<UserType | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [actionType, setActionType] = useState<'resetPassword' | 'deactivate' | null>(null);
  const [selectedUserForAction, setSelectedUserForAction] = useState<UserType | null>(null);
  const [newlyGeneratedPassword, setNewlyGeneratedPassword] = useState<string | null>(null);
  
  // Form data
  const [formData, setFormData] = useState({
    email_local: '',
    email_domain: '',
    password: '',
    first_name: '',
    last_name: '',
    role: 'reception',
    department: '',
    phone: '',
    employee_number: '', // This will be pre-populated and non-editable
    security_clearance: 'unclassified',
    is_active: true
  });
  
  // Filters
  const [filters, setFilters] = useState({
    search: '',
    role: '',
    is_active: ''
  });

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalUsers, setTotalUsers] = useState(0);
  const itemsPerPage = 20;

  // Clear success message after 5 seconds
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 5000);
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

  useEffect(() => {
    loadUsers();
  }, [currentPage, tenantId]); // Reload users when tenantId changes

  useEffect(() => {
    filterUsers();
  }, [users, filters]);

  const loadUsers = async () => {
    try {
      setErrorMessage(null);
      const response = await getAllUsers(currentPage, itemsPerPage, {
        ...filters,
        tenant_id: tenantId // Pass tenantId to the API call
      });
      
      setUsers(response.users);
      setTotalUsers(response.pagination.total);
      setTotalPages(response.pagination.pages);
      
      if (response.tenant_info) {
        setTenantInfo(response.tenant_info);
        // Pre-populate domain for new user creation
        if (!editingUser && !showForm) {
          setFormData(prev => ({
            ...prev,
            email_domain: response.tenant_info.corporate_email_domain || ''
          }));
        }
      }
    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to load users');
      console.error('Failed to load users:', error);
    }
  };

  const filterUsers = () => {
    let filtered = [...users];

    // Search filter
    if (filters.search) {
      filtered = filtered.filter(user => 
        user.full_name?.toLowerCase().includes(filters.search.toLowerCase()) ||
        user.email?.toLowerCase().includes(filters.search.toLowerCase()) ||
        user.department?.toLowerCase().includes(filters.search.toLowerCase())
      );
    }

    // Role filter
    if (filters.role) {
      filtered = filtered.filter(user => user.role === filters.role);
    }

    // Active status filter
    if (filters.is_active !== '') {
      const isActive = filters.is_active === 'true';
      filtered = filtered.filter(user => user.is_active === isActive);
    }

    setFilteredUsers(filtered);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    
    try {
      const email = `${formData.email_local}@${formData.email_domain}`;
      
      if (editingUser) {
        // Update existing user
        const updatedUser = await updateUserByAdmin(editingUser.id, {
          email,
          first_name: formData.first_name,
          last_name: formData.last_name,
          role: formData.role,
          department: formData.department,
          phone: formData.phone,
          // employee_number is not sent as it's read-only
          security_clearance: formData.security_clearance,
          is_active: formData.is_active
        });
        setUsers(prev => prev.map(u => u.id === updatedUser.id ? updatedUser : u));
        setSuccessMessage(`User "${updatedUser.full_name}" updated successfully`);
      } else {
        // Create new user
        const newUser = await createUserByAdmin({
          email,
          password: formData.password,
          first_name: formData.first_name,
          last_name: formData.last_name,
          role: formData.role,
          department: formData.department,
          phone: formData.phone,
          employee_number: formData.employee_number, // Send generated employee number
          security_clearance: formData.security_clearance,
          tenant_id: user!.tenant_id // Assign current user's tenant_id
        });
        setUsers(prev => [newUser, ...prev]);
        setSuccessMessage(`User "${newUser.full_name}" created successfully`);
      }
      
      resetForm();
    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to save user');
      console.error('Failed to save user:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      email_local: '',
      email_domain: user?.corporate_email_domain || '', // Reset to current tenant's domain
      password: '',
      first_name: '',
      last_name: '',
      role: 'reception',
      department: '',
      phone: '',
      employee_number: '',
      security_clearance: 'unclassified',
      is_active: true
    });
    setEditingUser(null);
    setShowForm(false);
    setNewlyGeneratedPassword(null);
  };

  const handleEdit = (user: UserType) => {
    const [emailLocal, emailDomain] = user.email.split('@');
    setFormData({
      email_local: emailLocal,
      email_domain: emailDomain,
      password: '', // Password is not editable directly
      first_name: user.first_name || '',
      last_name: user.last_name || '',
      role: user.role,
      department: user.department || '',
      phone: user.phone || '',
      employee_number: user.employee_number || '',
      security_clearance: user.security_clearance || 'unclassified',
      is_active: user.is_active
    });
    setEditingUser(user);
    setShowForm(true);
  };

  const handleResetPassword = async (user: UserType) => {
    setSelectedUserForAction(user);
    setActionType('resetPassword');
    setShowConfirmModal(true);
  };

  const handleDeactivateUser = async (user: UserType) => {
    setSelectedUserForAction(user);
    setActionType('deactivate');
    setShowConfirmModal(true);
  };

  const confirmAction = async () => {
    if (!selectedUserForAction || !actionType) return;

    setErrorMessage(null);
    setSuccessMessage(null);
    setShowConfirmModal(false); // Close modal immediately

    try {
      if (actionType === 'resetPassword') {
        const newPassword = await resetUserPassword(selectedUserForAction.id);
        setNewlyGeneratedPassword(newPassword);
        setSuccessMessage(`Password for ${selectedUserForAction.full_name} reset successfully.`);
      } else if (actionType === 'deactivate') {
        const updatedUser = await updateUserByAdmin(selectedUserForAction.id, { is_active: false });
        setUsers(prev => prev.map(u => u.id === updatedUser.id ? updatedUser : u));
        setSuccessMessage(`User ${selectedUserForAction.full_name} deactivated successfully.`);
      }
      await loadUsers(); // Reload users to reflect changes
    } catch (error: any) {
      setErrorMessage(error.message || `Failed to ${actionType === 'resetPassword' ? 'reset password' : 'deactivate user'}`);
      console.error(`Failed to ${actionType === 'resetPassword' ? 'reset password' : 'deactivate user'}:`, error);
    } finally {
      setSelectedUserForAction(null);
      setActionType(null);
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'security':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'reception':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'host':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'approver':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'super_admin':
        return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin':
        return <Shield className="w-4 h-4 text-red-600" />;
      case 'security':
        return <Eye className="w-4 h-4 text-orange-600" />;
      case 'reception':
        return <UserCheck className="w-4 h-4 text-blue-600" />;
      case 'host':
        return <Building className="w-4 h-4 text-green-600" />;
      case 'approver':
        return <CheckCircle className="w-4 h-4 text-purple-600" />;
      case 'super_admin':
        return <UserCog className="w-4 h-4 text-indigo-600" />;
      default:
        return <User className="w-4 h-4 text-gray-600" />;
    }
  };

  const canManageUsers = user?.role && ['admin', 'super_admin'].includes(user.role);

  if (showForm) {
    return (
      <div className="space-y-6">
        {/* Form Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">
            {editingUser ? 'Edit User' : 'Add New User'}
          </h2>
          <button
            onClick={resetForm}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
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

        {(errorMessage || error) && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center justify-between">
            <div className="flex items-center">
              <AlertTriangle className="w-5 h-5 mr-2" />
              <p className="font-medium">{errorMessage || error}</p>
            </div>
            <button 
              onClick={() => {
                setErrorMessage(null);
                clearError();
              }}
              className="text-red-700 hover:text-red-900"
            >
              <XCircle className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Newly Generated Password Display */}
        {newlyGeneratedPassword && (
          <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-lg flex items-center justify-between">
            <div className="flex items-center">
              <Key className="w-5 h-5 mr-2" />
              <p className="font-medium">New Password: <span className="font-mono">{newlyGeneratedPassword}</span></p>
            </div>
            <button 
              onClick={() => setNewlyGeneratedPassword(null)}
              className="text-blue-700 hover:text-blue-900"
            >
              <XCircle className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Form */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="text-md font-medium text-gray-900 flex items-center">
                <User className="w-4 h-4 mr-2" />
                Basic Information
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    First Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.first_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, first_name: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Last Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.last_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, last_name: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email Local Part *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.email_local}
                    onChange={(e) => setFormData(prev => ({ ...prev, email_local: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    disabled={!!editingUser} // Email local part cannot be changed for existing users
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email Domain Part *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.email_domain}
                    onChange={(e) => setFormData(prev => ({ ...prev, email_domain: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    readOnly // Domain part is pre-populated and not editable
                  />
                </div>

                {!editingUser && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Password *
                    </label>
                    <input
                      type="password"
                      required
                      value={formData.password}
                      onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Minimum 8 characters, including uppercase, lowercase, number, and special character.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Role and Contact Information */}
            <div className="space-y-4">
              <h3 className="text-md font-medium text-gray-900 flex items-center">
                <UserCog className="w-4 h-4 mr-2" />
                Role & Contact
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Role *
                  </label>
                  <select
                    required
                    value={formData.role}
                    onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value as any }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="reception">Reception</option>
                    <option value="host">Host</option>
                    <option value="security">Security</option>
                    <option value="approver">Approver</option>
                    <option value="admin">Admin</option>
                    {user?.role === 'super_admin' && <option value="super_admin">Super Admin</option>}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Department
                  </label>
                  <input
                    type="text"
                    value={formData.department}
                    onChange={(e) => setFormData(prev => ({ ...prev, department: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Phone
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Employee Number
                  </label>
                  <input
                    type="text"
                    value={formData.employee_number}
                    onChange={(e) => setFormData(prev => ({ ...prev, employee_number: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    readOnly // Employee number is read-only
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Security Clearance
                  </label>
                  <select
                    value={formData.security_clearance}
                    onChange={(e) => setFormData(prev => ({ ...prev, security_clearance: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="unclassified">Unclassified</option>
                    <option value="confidential">Confidential</option>
                    <option value="secret">Secret</option>
                    <option value="top_secret">Top Secret</option>
                  </select>
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="is_active"
                    checked={formData.is_active}
                    onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="is_active" className="ml-2 block text-sm text-gray-900">
                    Is Active
                  </label>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Cancel
              </button>
              
              <LoadingButton
                loading={loading}
                variant="primary"
                size="md"
                type="submit"
              >
                {editingUser ? 'Update User' : 'Create User'}
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
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold mb-2">User Management</h1>
            <p className="text-blue-100">
              Manage user accounts and access roles for {tenantId ? `tenant ID: ${tenantId}` : 'all tenants'}
            </p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold">{totalUsers}</div>
            <div className="text-blue-200 text-sm">Total Users</div>
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

      {(errorMessage || error) && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center justify-between">
          <div className="flex items-center">
            <AlertTriangle className="w-5 h-5 mr-2" />
            <p className="font-medium">{errorMessage || error}</p>
          </div>
          <button 
            onClick={() => {
              setErrorMessage(null);
              clearError();
            }}
            className="text-red-700 hover:text-red-900"
          >
            <XCircle className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Newly Generated Password Display */}
      {newlyGeneratedPassword && (
        <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-lg flex items-center justify-between">
          <div className="flex items-center">
            <Key className="w-5 h-5 mr-2" />
            <p className="font-medium">New Password: <span className="font-mono">{newlyGeneratedPassword}</span></p>
          </div>
          <button 
            onClick={() => setNewlyGeneratedPassword(null)}
            className="text-blue-700 hover:text-blue-900"
          >
            <XCircle className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Controls */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
          <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4 flex-1">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search users..."
                value={filters.search}
                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Role Filter */}
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <select
                value={filters.role}
                onChange={(e) => setFilters(prev => ({ ...prev, role: e.target.value }))}
                className="pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none bg-white"
              >
                <option value="">All Roles</option>
                <option value="reception">Reception</option>
                <option value="host">Host</option>
                <option value="security">Security</option>
                <option value="approver">Approver</option>
                <option value="admin">Admin</option>
                {user?.role === 'super_admin' && <option value="super_admin">Super Admin</option>}
              </select>
            </div>

            {/* Active Status Filter */}
            <div className="relative">
              <select
                value={filters.is_active}
                onChange={(e) => setFilters(prev => ({ ...prev, is_active: e.target.value }))}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none bg-white"
              >
                <option value="">All Status</option>
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={loadUsers}
              disabled={loading}
              className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            
            {canManageUsers && (
              <button
                onClick={() => setShowForm(true)}
                className="flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <UserPlus className="w-4 h-4 mr-2" />
                Add User
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Users List */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            Users ({filteredUsers.length})
          </h2>
        </div>

        {loading && users.length === 0 ? (
          <Loading message="Loading users..." />
        ) : (
          <div className="divide-y divide-gray-200">
            {filteredUsers.length === 0 ? (
              <div className="p-12 text-center">
                <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500 text-lg">No users found</p>
                <p className="text-gray-400 text-sm">
                  {filters.search || filters.role || filters.is_active
                    ? 'Try adjusting your search or filter criteria'
                    : 'Start by adding your first user'
                  }
                </p>
                {canManageUsers && !filters.search && !filters.role && !filters.is_active && (
                  <button
                    onClick={() => setShowForm(true)}
                    className="mt-4 inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
                  >
                    <UserPlus className="w-4 h-4 mr-2" />
                    Add First User
                  </button>
                )}
              </div>
            ) : (
              filteredUsers.map((userItem) => (
                <div key={userItem.id} className="p-6 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4 flex-1">
                      <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white font-bold">
                        {userItem.full_name?.[0]}
                      </div>
                      
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h3 className="text-lg font-medium text-gray-900">
                            {userItem.full_name}
                          </h3>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getRoleColor(userItem.role)}`}>
                            {getRoleIcon(userItem.role)}
                            <span className="ml-1 capitalize">{userItem.role}</span>
                          </span>
                          {!userItem.is_active && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 border border-red-200">
                              <XCircle className="w-3 h-3 mr-1" />
                              Inactive
                            </span>
                          )}
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
                          <div className="flex items-center">
                            <Mail className="w-4 h-4 mr-2 text-gray-400" />
                            <span>{userItem.email}</span>
                          </div>
                          {userItem.phone && (
                            <div className="flex items-center">
                              <Phone className="w-4 h-4 mr-2 text-gray-400" />
                              <span>{userItem.phone}</span>
                            </div>
                          )}
                          {userItem.department && (
                            <div className="flex items-center">
                              <Building className="w-4 h-4 mr-2 text-gray-400" />
                              <span>{userItem.department}</span>
                            </div>
                          )}
                        </div>
                        
                        <div className="mt-2 flex items-center space-x-4 text-xs text-gray-500">
                          <div className="flex items-center">
                            <Calendar className="w-3 h-3 mr-1" />
                            <span>Created: {format(new Date(userItem.created_at), 'MMM d, yyyy')}</span>
                          </div>
                          {userItem.last_login && (
                            <div className="flex items-center">
                              <Clock className="w-3 h-3 mr-1" />
                              <span>Last Login: {format(new Date(userItem.last_login), 'MMM d, yyyy')}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 ml-4">
                      {canManageUsers && (
                        <>
                          <button
                            onClick={() => handleEdit(userItem)}
                            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Edit User"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleResetPassword(userItem)}
                            className="p-2 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                            title="Reset Password"
                          >
                            <Key className="w-4 h-4" />
                          </button>
                          {userItem.is_active && (
                            <button
                              onClick={() => handleDeactivateUser(userItem)}
                              className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Deactivate User"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-6 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-500">
                Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, totalUsers)} of {totalUsers} users
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1 || loading}
                  className="flex items-center px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Previous
                </button>
                <span className="px-3 py-2 text-sm font-medium text-gray-900">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages || loading}
                  className="flex items-center px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                  <ChevronRight className="w-4 h-4 ml-1" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={showConfirmModal}
        title={actionType === 'resetPassword' ? 'Confirm Password Reset' : 'Confirm User Deactivation'}
        message={
          actionType === 'resetPassword'
            ? `Are you sure you want to reset the password for ${selectedUserForAction?.full_name}? A new temporary password will be generated.`
            : `Are you sure you want to deactivate ${selectedUserForAction?.full_name}? This user will no longer be able to log in.`
        }
        confirmText={actionType === 'resetPassword' ? 'Reset Password' : 'Deactivate User'}
        onConfirm={confirmAction}
        onCancel={() => setShowConfirmModal(false)}
        type={actionType === 'resetPassword' ? 'warning' : 'danger'}
      />
    </div>
  );
};
