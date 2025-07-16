import React, { useState, useEffect } from 'react';
import { 
  Building, 
  Plus, 
  Search, 
  Filter, 
  Edit, 
  Trash2, 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  RefreshCw, 
  Eye, 
  Settings,
  Users,
  Mail,
  Globe,
  Calendar,
  Database,
  Server,
  Shield,
  UserCheck,
  ChevronRight,
  ChevronLeft,
  Save,
  Info,
  Activity,
  User,
  Clock,
  ArrowRight
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useTenant } from '../../hooks/useTenant';
import { LoadingButton, Loading } from '../common/Loading';
import { format, parseISO } from 'date-fns';
import { TenantDetailsView } from './TenantDetailsView';
import TenantAuthSettings, { TenantSettings } from './TenantAuthSettings';


interface TenantManagementProps {
  viewParams?: {
    view?: string;
    tenantId?: string;
    tab?: string;
  };
  onSectionChange?: (section: string, params?: any) => void;
}

export const TenantManagement: React.FC<TenantManagementProps> = ({ 
  viewParams, 
  onSectionChange 
}) => {
  const { user, isSuperAdmin, createUserByAdmin } = useAuth();
  const { 
    getTenants, 
    getTenant, 
    createTenant, 
    updateTenant, 
    deactivateTenant, 
    getTenantStats,
    getAllTenantsStats,
    loading, 
    error, 
    clearError 
  } = useTenant();
  
  const [tenants, setTenants] = useState<any[]>([]);
  const [filteredTenants, setFilteredTenants] = useState<any[]>([]);
  const [selectedTenant, setSelectedTenant] = useState<any>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);
  const [showAuthSettings, setShowAuthSettings] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('summary');
  const [tenantStats, setTenantStats] = useState<any>(null);
  const [systemStats, setSystemStats] = useState<any>(null);
  
  // Filters
  const [filters, setFilters] = useState({
    search: '',
    is_active: ''
  });
  
  // Form data
  const [formData, setFormData] = useState({
    name: '',
    corporate_email_domain: '',
    is_active: true,
    tenant_prefix: '',
    custom_departments: [] as string[],
    admin_email: '',
    admin_first_name: '',
    admin_last_name: '',
    email_provider: 'smtp',
    email_config: {
      host: '',
      port: 587,
      secure: false,
      user: '',
      pass: '',
      from: ''
    },
    sms_provider: 'none',
    sms_config: {
      account_sid: '',
      auth_token: '',
      from_number: ''
    },
    push_provider: 'none',
    push_config: {
      api_key: '',
      app_id: ''
    }
  });

  // New department field
  const [newDepartment, setNewDepartment] = useState('');

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

  // Initialize view based on viewParams
  useEffect(() => {
    if (viewParams) {
      if (viewParams.view === 'create') {
        setShowCreateForm(true);
        setShowDetails(false);
        setSelectedTenant(null);
      } else if (viewParams.view === 'details' && viewParams.tenantId) {
        loadTenantDetails(viewParams.tenantId);
      }
      
      if (viewParams.tab) {
        setActiveTab(viewParams.tab);
      }
    }
  }, [viewParams]);

  useEffect(() => {
    loadTenants();
    
    // Load system stats if super admin
    if (isSuperAdmin()) {
      loadSystemStats();
    }
  }, []);

  useEffect(() => {
    filterTenants();
  }, [tenants, filters]);

  const loadTenants = async () => {
    try {
      setErrorMessage(null);
      const tenantsData = await getTenants();
      setTenants(tenantsData);
    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to load tenants');
      console.error('Failed to load tenants:', error);
    }
  };

  const loadTenantDetails = async (tenantId: string) => {
    try {
      setErrorMessage(null);
      const tenantData = await getTenant(tenantId);
      setSelectedTenant(tenantData);
      setShowDetails(true);
      
      // Load tenant stats
      loadTenantStats(tenantId);
    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to load tenant details');
      console.error('Failed to load tenant details:', error);
    }
  };

  const loadTenantStats = async (tenantId: string) => {
    try {
      const stats = await getTenantStats(tenantId);
      setTenantStats(stats);
    } catch (error: any) {
      console.error('Failed to load tenant stats:', error);
    }
  };

  const loadSystemStats = async () => {
    try {
      const stats = await getAllTenantsStats();
      setSystemStats(stats);
    } catch (error: any) {
      console.error('Failed to load system stats:', error);
    }
  };

  const filterTenants = () => {
    let filtered = [...tenants];

    // Search filter
    if (filters.search) {
      filtered = filtered.filter(tenant => 
        tenant.name.toLowerCase().includes(filters.search.toLowerCase()) ||
        tenant.corporate_email_domain?.toLowerCase().includes(filters.search.toLowerCase())
      );
    }

    // Status filter
    if (filters.is_active !== '') {
      const isActive = filters.is_active === 'true';
      filtered = filtered.filter(tenant => tenant.is_active === isActive);
    }

    setFilteredTenants(filtered);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    
    try {
      if (selectedTenant) {
        // Update existing tenant
        const updatedTenant = await updateTenant(selectedTenant.id, formData);
        setTenants(prev => prev.map(t => t.id === updatedTenant.id ? updatedTenant : t));
        setSelectedTenant(updatedTenant);
        setSuccessMessage(`Tenant "${updatedTenant.name}" updated successfully`);
      } else {
        // Create new tenant
        const newTenant = await createTenant(formData);
        setTenants(prev => [newTenant, ...prev]);
        setSuccessMessage(`Tenant "${newTenant.name}" created successfully with admin user ${formData.admin_email}`);
        resetForm();
        setShowCreateForm(false);
        
        // Refresh tenants list
        loadTenants();
      }
    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to save tenant');
      console.error('Failed to save tenant:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      corporate_email_domain: '',
      is_active: true,
      tenant_prefix: '',
      custom_departments: [],
      admin_email: '',
      admin_first_name: '',
      admin_last_name: '',
      email_provider: 'smtp',
      email_config: {
        host: '',
        port: 587,
        secure: false,
        user: '',
        pass: '',
        from: ''
      },
      sms_provider: 'none',
      sms_config: {
        account_sid: '',
        auth_token: '',
        from_number: ''
      },
      push_provider: 'none',
      push_config: {
        api_key: '',
        app_id: ''
      }
    });
  };

  const handleEdit = (tenant: any) => {
    setFormData({
      name: tenant.name,
      corporate_email_domain: tenant.corporate_email_domain || '',
      is_active: tenant.is_active,
      tenant_prefix: tenant.tenant_prefix || '',
      custom_departments: tenant.custom_departments || [],
      admin_email: '',
      admin_first_name: '',
      admin_last_name: '',
      email_provider: tenant.email_provider || 'smtp',
      email_config: tenant.email_config || {
        host: '',
        port: 587,
        secure: false,
        user: '',
        pass: '',
        from: ''
      },
      sms_provider: tenant.sms_provider || 'none',
      sms_config: tenant.sms_config || {
        account_sid: '',
        auth_token: '',
        from_number: ''
      },
      push_provider: tenant.push_provider || 'none',
      push_config: tenant.push_config || {
        api_key: '',
        app_id: ''
      }
    });
    setSelectedTenant(tenant);
    setShowCreateForm(true);
    setShowDetails(false);
  };

  const handleDeactivate = async (tenantId: string, tenantName: string) => {
    if (!confirm(`Are you sure you want to deactivate tenant "${tenantName}"?`)) {
      return;
    }
    
    try {
      await deactivateTenant(tenantId);
      setTenants(prev => prev.map(t => t.id === tenantId ? { ...t, is_active: false } : t));
      setSuccessMessage(`Tenant "${tenantName}" deactivated successfully`);
      
      // If the deactivated tenant is currently selected, update its status
      if (selectedTenant && selectedTenant.id === tenantId) {
        setSelectedTenant(prev => ({ ...prev, is_active: false }));
      }
    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to deactivate tenant');
      console.error('Failed to deactivate tenant:', error);
    }
  };

  const handleTenantClick = (tenant: any) => {
    loadTenantDetails(tenant.id);
  };

  const handleViewTenantDetails = (tenant: any) => {
    setSelectedTenantId(tenant.id);
  };

  const handleAddDepartment = () => {
    if (newDepartment.trim()) {
      setFormData(prev => ({
        ...prev,
        custom_departments: [...prev.custom_departments, newDepartment.trim()]
      }));
      setNewDepartment('');
    }
  };

  const handleRemoveDepartment = (index: number) => {
    setFormData(prev => ({
      ...prev,
      custom_departments: prev.custom_departments.filter((_, i) => i !== index)
    }));
  };

  const handleCreateTenant = () => {
    resetForm();
    setShowCreateForm(true);
    setShowDetails(false);
    setSelectedTenant(null);
    
    // Update URL if onSectionChange is provided
    if (onSectionChange) {
      onSectionChange('tenants', { view: 'create' });
    }
  };

  const handleBackToList = () => {
    setShowCreateForm(false);
    setShowDetails(false);
    setSelectedTenant(null);
    setShowAuthSettings(false);
    
    // Update URL if onSectionChange is provided
    if (onSectionChange) {
      onSectionChange('tenants', { view: 'list' });
    }
  };

  const handleViewTenantSettings = (tenant: any) => {
    // Navigate to settings section with tenant ID
    if (onSectionChange) {
      onSectionChange('settings', { tab: 'notification-providers', tenantId: tenant.id });
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'MMM d, yyyy');
    } catch (error) {
      return 'Invalid date';
    }
  };

  // Only super admins can access tenant management
  if (!isSuperAdmin()) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
        <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
        <h2 className="text-2xl font-semibold text-gray-900 mb-2">Access Denied</h2>
        <p className="text-gray-600 mb-4">
          You don't have permission to access tenant management.
        </p>
        <p className="text-gray-500">
          This feature is only available to super administrators.
        </p>
      </div>
    );
  }

  if (selectedTenantId) {
    return (
      <TenantDetailsView 
        tenantId={selectedTenantId} 
        onBack={() => setSelectedTenantId(null)}
        onSectionChange={onSectionChange}
      />
    );
  }

  if (showCreateForm) {
    return (
      <div className="space-y-6">
        {/* Form Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={handleBackToList}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h2 className="text-xl font-semibold text-gray-900">
              {selectedTenant ? 'Edit Tenant' : 'Create New Tenant'}
            </h2>
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

        {/* Form */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="text-md font-medium text-gray-900 flex items-center">
                <Building className="w-4 h-4 mr-2" />
                Basic Information
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tenant Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="e.g., Department of Defense"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Corporate Email Domain
                  </label>
                  <div className="flex items-center">
                    <Mail className="w-4 h-4 text-gray-400 absolute ml-3" />
                    <input
                      type="text"
                      value={formData.corporate_email_domain}
                      onChange={(e) => setFormData(prev => ({ ...prev, corporate_email_domain: e.target.value }))}
                      className="w-full pl-10 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="e.g., defense.gov"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Users with this email domain will be automatically associated with this tenant
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tenant Prefix
                  </label>
                  <input
                    type="text"
                    value={formData.tenant_prefix}
                    onChange={(e) => setFormData(prev => ({ ...prev, tenant_prefix: e.target.value.toUpperCase().substring(0, 3) }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="e.g., DOD"
                    maxLength={3}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    3-letter prefix for employee numbers (automatically converted to uppercase)
                  </p>
                </div>

                <div className="flex items-center pt-8">
                  <input
                    type="checkbox"
                    id="is_active"
                    checked={formData.is_active}
                    onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="is_active" className="ml-2 block text-sm text-gray-900">
                    Active
                  </label>
                </div>
              </div>
            </div>

            {/* Custom Departments */}
            <div className="space-y-4">
              <h3 className="text-md font-medium text-gray-900 flex items-center">
                <Users className="w-4 h-4 mr-2" />
                Custom Departments
              </h3>
              
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={newDepartment}
                  onChange={(e) => setNewDepartment(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., Human Resources"
                />
                <button
                  type="button"
                  onClick={handleAddDepartment}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  Add
                </button>
              </div>
              
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Departments</h4>
                {formData.custom_departments.length === 0 ? (
                  <p className="text-sm text-gray-500">No custom departments added yet</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {formData.custom_departments.map((dept, index) => (
                      <div key={index} className="flex items-center bg-white px-3 py-1 rounded-md border border-gray-300">
                        <span className="text-sm text-gray-700">{dept}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveDepartment(index)}
                          className="ml-2 text-gray-400 hover:text-red-500"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Admin User (only for new tenants) */}
            {!selectedTenant && (
              <div className="space-y-4">
                <h3 className="text-md font-medium text-gray-900 flex items-center">
                  <Shield className="w-4 h-4 mr-2" />
                  Tenant Administrator
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Admin Email *
                    </label>
                    <input
                      type="email"
                      required
                      value={formData.admin_email}
                      onChange={(e) => setFormData(prev => ({ ...prev, admin_email: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="admin@example.com"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Admin First Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.admin_first_name}
                      onChange={(e) => setFormData(prev => ({ ...prev, admin_first_name: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="John"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Admin Last Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.admin_last_name}
                      onChange={(e) => setFormData(prev => ({ ...prev, admin_last_name: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Doe"
                    />
                  </div>
                </div>
                
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <div className="flex items-center space-x-2">
                    <Info className="w-5 h-5 text-blue-500" />
                    <p className="text-sm text-blue-700">
                      A temporary password will be generated for the admin user. They will be prompted to change it on first login.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={handleBackToList}
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
                {selectedTenant ? 'Update Tenant' : 'Create Tenant'}
              </LoadingButton>
            </div>
          </form>
        </div>
      </div>
    );
  }

  if (showDetails && selectedTenant) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={handleBackToList}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{selectedTenant.name}</h1>
                <div className="flex items-center mt-1">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    selectedTenant.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {selectedTenant.is_active ? 'Active' : 'Inactive'}
                  </span>
                  {selectedTenant.corporate_email_domain && (
                    <span className="ml-2 text-sm text-gray-500">
                      <Mail className="w-3 h-3 inline mr-1" />
                      {selectedTenant.corporate_email_domain}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => handleEdit(selectedTenant)}
                className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                <Edit className="w-4 h-4 mr-2" />
                Edit
              </button>
              <button
                onClick={() => handleViewTenantSettings(selectedTenant)}
                className="flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
              >
                <Settings className="w-4 h-4 mr-2" />
                Settings
              </button>
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

        {/* Tab Navigation */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="border-b border-gray-200 bg-gray-50">
            <nav className="flex space-x-8 px-6">
              <button
                onClick={() => setActiveTab('summary')}
                className={`py-4 px-2 border-b-2 font-medium text-sm flex items-center transition-all duration-200 ${
                  activeTab === 'summary'
                    ? 'border-blue-500 text-blue-600 bg-blue-50/50'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Database className="w-4 h-4 mr-2" />
                Summary
              </button>
              <button
                onClick={() => setActiveTab('users')}
                className={`py-4 px-2 border-b-2 font-medium text-sm flex items-center transition-all duration-200 ${
                  activeTab === 'users'
                    ? 'border-blue-500 text-blue-600 bg-blue-50/50'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Users className="w-4 h-4 mr-2" />
                Users
              </button>
              <button
                onClick={() => setActiveTab('facilities')}
                className={`py-4 px-2 border-b-2 font-medium text-sm flex items-center transition-all duration-200 ${
                  activeTab === 'facilities'
                    ? 'border-blue-500 text-blue-600 bg-blue-50/50'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Building className="w-4 h-4 mr-2" />
                Facilities
              </button>
              <button
                onClick={() => setActiveTab('activity')}
                className={`py-4 px-2 border-b-2 font-medium text-sm flex items-center transition-all duration-200 ${
                  activeTab === 'activity'
                    ? 'border-blue-500 text-blue-600 bg-blue-50/50'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Activity className="w-4 h-4 mr-2" />
                Activity
              </button>
            </nav>
          </div>

          <div className="p-6">
            {activeTab === 'summary' && (
              <div className="space-y-6">
                {/* Tenant Information */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Tenant Information</h3>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-500">Name</span>
                        <span className="text-sm font-medium text-gray-900">{selectedTenant.name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-500">Email Domain</span>
                        <span className="text-sm font-medium text-gray-900">{selectedTenant.corporate_email_domain || 'Not set'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-500">Tenant Prefix</span>
                        <span className="text-sm font-medium text-gray-900">{selectedTenant.tenant_prefix || 'Not set'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-500">Status</span>
                        <span className={`text-sm font-medium ${selectedTenant.is_active ? 'text-green-600' : 'text-red-600'}`}>
                          {selectedTenant.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-500">Created</span>
                        <span className="text-sm font-medium text-gray-900">{formatDate(selectedTenant.created_at)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Usage Statistics</h3>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-500">Total Users</span>
                        <span className="text-sm font-medium text-gray-900">{tenantStats?.user_stats?.total_users || 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-500">Active Users</span>
                        <span className="text-sm font-medium text-gray-900">{tenantStats?.user_stats?.active_users || 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-500">Total Facilities</span>
                        <span className="text-sm font-medium text-gray-900">{tenantStats?.facility_stats?.total_facilities || 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-500">Total Visitors</span>
                        <span className="text-sm font-medium text-gray-900">{tenantStats?.visitor_stats?.total_visitors || 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-500">Total Visits</span>
                        <span className="text-sm font-medium text-gray-900">{tenantStats?.visit_stats?.total_visits || 0}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Custom Departments */}
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Custom Departments</h3>
                  {selectedTenant.custom_departments && selectedTenant.custom_departments.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {selectedTenant.custom_departments.map((dept: string, index: number) => (
                        <div key={index} className="bg-gray-100 px-3 py-1 rounded-md">
                          <span className="text-sm text-gray-700">{dept}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">No custom departments configured</p>
                  )}
                </div>

                {/* Notification Providers */}
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-medium text-gray-900">Notification Providers</h3>
                    <button
                      onClick={() => handleViewTenantSettings(selectedTenant)}
                      className="flex items-center text-sm text-blue-600 hover:text-blue-700"
                    >
                      <Settings className="w-4 h-4 mr-1" />
                      Configure
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-medium text-gray-700">Email Provider</h4>
                        <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                          selectedTenant.email_provider === 'none' ? 'bg-gray-100 text-gray-800' : 'bg-green-100 text-green-800'
                        }`}>
                          {selectedTenant.email_provider || 'None'}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500">
                        {selectedTenant.email_provider === 'smtp' ? 'SMTP Server' : 
                         selectedTenant.email_provider === 'sendgrid' ? 'SendGrid API' :
                         selectedTenant.email_provider === 'mailgun' ? 'Mailgun API' : 'Not configured'}
                      </p>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-medium text-gray-700">SMS Provider</h4>
                        <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                          selectedTenant.sms_provider === 'none' ? 'bg-gray-100 text-gray-800' : 'bg-green-100 text-green-800'
                        }`}>
                          {selectedTenant.sms_provider || 'None'}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500">
                        {selectedTenant.sms_provider === 'twilio' ? 'Twilio API' : 'Not configured'}
                      </p>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-medium text-gray-700">Push Provider</h4>
                        <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                          selectedTenant.push_provider === 'none' ? 'bg-gray-100 text-gray-800' : 'bg-green-100 text-green-800'
                        }`}>
                          {selectedTenant.push_provider || 'None'}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500">
                        {selectedTenant.push_provider === 'fcm' ? 'Firebase Cloud Messaging' :
                         selectedTenant.push_provider === 'onesignal' ? 'OneSignal' : 'Not configured'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Admin Users */}
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Tenant Administrators</h3>
                  {selectedTenant.admins && selectedTenant.admins.length > 0 ? (
                    <div className="space-y-3">
                      {selectedTenant.admins.map((admin: any) => (
                        <div key={admin.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                              <User className="w-5 h-5 text-blue-600" />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-900">{admin.full_name}</p>
                              <p className="text-xs text-gray-500">{admin.email}</p>
                            </div>
                          </div>
                          <div className="flex items-center">
                            <span className="text-xs text-gray-500">
                              Last login: {admin.last_login ? formatDate(admin.last_login) : 'Never'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">No administrators found</p>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'users' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900">Users</h3>
                  <button
                    onClick={() => {
                      if (onSectionChange) {
                        onSectionChange('settings', { tab: 'users', tenantId: selectedTenant.id });
                      }
                    }}
                    className="flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
                  >
                    <Users className="w-4 h-4 mr-2" />
                    Manage Users
                  </button>
                </div>

                {tenantStats?.user_stats ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-white rounded-lg border border-gray-200 p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-600">Total Users</p>
                          <p className="text-2xl font-bold text-blue-600">
                            {tenantStats.user_stats.total_users}
                          </p>
                        </div>
                        <Users className="w-8 h-8 text-blue-600" />
                      </div>
                    </div>
                    <div className="bg-white rounded-lg border border-gray-200 p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-600">Active Users</p>
                          <p className="text-2xl font-bold text-green-600">
                            {tenantStats.user_stats.active_users}
                          </p>
                        </div>
                        <UserCheck className="w-8 h-8 text-green-600" />
                      </div>
                    </div>
                    <div className="bg-white rounded-lg border border-gray-200 p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-600">Admin Users</p>
                          <p className="text-2xl font-bold text-purple-600">
                            {tenantStats.user_stats.admin_users}
                          </p>
                        </div>
                        <Shield className="w-8 h-8 text-purple-600" />
                      </div>
                    </div>
                    <div className="bg-white rounded-lg border border-gray-200 p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-600">Host Users</p>
                          <p className="text-2xl font-bold text-orange-600">
                            {tenantStats.user_stats.host_users}
                          </p>
                        </div>
                        <User className="w-8 h-8 text-orange-600" />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">No user statistics available</p>
                  </div>
                )}

                {/* User List Preview */}
                {selectedTenant.admins && selectedTenant.admins.length > 0 ? (
                  <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                    <div className="p-4 border-b border-gray-200">
                      <h4 className="font-medium text-gray-900">Administrator Users</h4>
                    </div>
                    <div className="divide-y divide-gray-200">
                      {selectedTenant.admins.map((admin: any) => (
                        <div key={admin.id} className="p-4 hover:bg-gray-50">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                                <User className="w-5 h-5 text-blue-600" />
                              </div>
                              <div>
                                <p className="text-sm font-medium text-gray-900">{admin.full_name}</p>
                                <p className="text-xs text-gray-500">{admin.email}</p>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                Admin
                              </span>
                              <span className="text-xs text-gray-500">
                                {admin.last_login ? `Last login: ${formatDate(admin.last_login)}` : 'Never logged in'}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="p-4 border-t border-gray-200 bg-gray-50">
                      <button
                        onClick={() => {
                          if (onSectionChange) {
                            onSectionChange('settings', { tab: 'users', tenantId: selectedTenant.id });
                          }
                        }}
                        className="flex items-center text-sm text-blue-600 hover:text-blue-700"
                      >
                        View All Users
                        <ArrowRight className="w-4 h-4 ml-1" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">No users found for this tenant</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'facilities' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900">Facilities</h3>
                  <button
                    onClick={() => {
                      if (onSectionChange) {
                        onSectionChange('facilities');
                      }
                    }}
                    className="flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
                  >
                    <Building className="w-4 h-4 mr-2" />
                    Manage Facilities
                  </button>
                </div>

                {tenantStats?.facility_stats ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-white rounded-lg border border-gray-200 p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-600">Total Facilities</p>
                          <p className="text-2xl font-bold text-blue-600">
                            {tenantStats.facility_stats.total_facilities}
                          </p>
                        </div>
                        <Building className="w-8 h-8 text-blue-600" />
                      </div>
                    </div>
                    <div className="bg-white rounded-lg border border-gray-200 p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-600">Active Facilities</p>
                          <p className="text-2xl font-bold text-green-600">
                            {tenantStats.facility_stats.active_facilities}
                          </p>
                        </div>
                        <CheckCircle className="w-8 h-8 text-green-600" />
                      </div>
                    </div>
                    <div className="bg-white rounded-lg border border-gray-200 p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-600">High Security</p>
                          <p className="text-2xl font-bold text-red-600">
                            {tenantStats.facility_stats.high_security_facilities}
                          </p>
                        </div>
                        <Shield className="w-8 h-8 text-red-600" />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Building className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">No facility statistics available</p>
                  </div>
                )}

                {/* Placeholder for facility list */}
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                  <div className="text-center py-8">
                    <Building className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">Facility management is available in the Facilities section</p>
                    <button
                      onClick={() => {
                        if (onSectionChange) {
                          onSectionChange('facilities');
                        }
                      }}
                      className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      <Building className="w-4 h-4 mr-2" />
                      Go to Facilities
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'activity' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900">Activity</h3>
                  <button
                    onClick={() => {
                      if (onSectionChange) {
                        onSectionChange('audit');
                      }
                    }}
                    className="flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
                  >
                    <Activity className="w-4 h-4 mr-2" />
                    View Audit Logs
                  </button>
                </div>

                {tenantStats?.daily_activity ? (
                  <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <h4 className="font-medium text-gray-900 mb-4">Recent Activity</h4>
                    <div className="space-y-4">
                      {tenantStats.daily_activity.slice(0, 7).map((day: any, index: number) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <span className="text-sm font-medium text-gray-900">{formatDate(day.date)}</span>
                          <span className="text-sm text-gray-600">{day.count} events</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Activity className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">No activity data available</p>
                  </div>
                )}

                {/* Visit Statistics */}
                {tenantStats?.visit_stats && (
                  <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <h4 className="font-medium text-gray-900 mb-4">Visit Statistics</h4>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs text-gray-500">Total Visits</p>
                            <p className="text-lg font-bold text-gray-900">{tenantStats.visit_stats.total_visits}</p>
                          </div>
                          <Calendar className="w-6 h-6 text-blue-600" />
                        </div>
                      </div>
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs text-gray-500">Today's Visits</p>
                            <p className="text-lg font-bold text-gray-900">{tenantStats.visit_stats.today_visits}</p>
                          </div>
                          <Clock className="w-6 h-6 text-green-600" />
                        </div>
                      </div>
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs text-gray-500">Checked In</p>
                            <p className="text-lg font-bold text-gray-900">{tenantStats.visit_stats.checked_in_visits}</p>
                          </div>
                          <UserCheck className="w-6 h-6 text-orange-600" />
                        </div>
                      </div>
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs text-gray-500">Checked Out</p>
                            <p className="text-lg font-bold text-gray-900">{tenantStats.visit_stats.checked_out_visits}</p>
                          </div>
                          <CheckCircle className="w-6 h-6 text-purple-600" />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg max-w-md w-full p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Deactivate Tenant</h3>
              <p className="text-gray-600 mb-6">
                Are you sure you want to deactivate the tenant "{selectedTenant.name}"? This will prevent users from accessing the system.
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
                  onClick={() => {
                    handleDeactivate(selectedTenant.id, selectedTenant.name);
                    setShowDeleteConfirm(false);
                  }}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Deactivate
                </LoadingButton>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (showAuthSettings && editingTenant) {
    return (
      <TenantAuthSettings
        tenant={editingTenant}
        onBack={resetView}
        onSave={handleSaveAuthSettings}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold mb-2">Tenant Management</h1>
            <p className="text-blue-100">
              Manage organizations, users, and settings across the platform
            </p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold">{tenants.length}</div>
            <div className="text-blue-200 text-sm">Total Tenants</div>
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

      {/* Controls */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
          <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4 flex-1">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search tenants..."
                value={filters.search}
                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Status Filter */}
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <select
                value={filters.is_active}
                onChange={(e) => setFilters(prev => ({ ...prev, is_active: e.target.value }))}
                className="pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none bg-white"
              >
                <option value="">All Status</option>
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={loadTenants}
              disabled={loading}
              className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            
            <button
              onClick={handleCreateTenant}
              className="flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Tenant
            </button>
          </div>
        </div>
      </div>

      {/* System Overview */}
      {systemStats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Tenants</p>
                <p className="text-2xl font-bold text-blue-600">
                  {systemStats.length}
                </p>
              </div>
              <Building className="w-8 h-8 text-blue-600" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Users</p>
                <p className="text-2xl font-bold text-green-600">
                  {systemStats.reduce((sum: number, tenant: any) => sum + tenant.users, 0)}
                </p>
              </div>
              <Users className="w-8 h-8 text-green-600" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Facilities</p>
                <p className="text-2xl font-bold text-purple-600">
                  {systemStats.reduce((sum: number, tenant: any) => sum + tenant.facilities, 0)}
                </p>
              </div>
              <Building className="w-8 h-8 text-purple-600" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Visits</p>
                <p className="text-2xl font-bold text-orange-600">
                  {systemStats.reduce((sum: number, tenant: any) => sum + tenant.active_visits, 0)}
                </p>
              </div>
              <UserCheck className="w-8 h-8 text-orange-600" />
            </div>
          </div>
        </div>
      )}

      {/* Tenants List */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            Tenants ({filteredTenants.length})
          </h2>
        </div>

        {loading && tenants.length === 0 ? (
          <Loading message="Loading tenants..." />
        ) : (
          <div className="divide-y divide-gray-200">
            {filteredTenants.length === 0 ? (
              <div className="p-12 text-center">
                <Building className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500 text-lg">No tenants found</p>
                <p className="text-gray-400 text-sm">
                  {filters.search || filters.is_active
                    ? 'Try adjusting your search or filter criteria'
                    : 'Start by adding your first tenant'
                  }
                </p>
                {!filters.search && !filters.is_active && (
                  <button
                    onClick={handleCreateTenant}
                    className="mt-4 inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add First Tenant
                  </button>
                )}
              </div>
            ) : (
              filteredTenants.map((tenant) => (
                <div 
                  key={tenant.id} 
                  className="p-6 hover:bg-gray-50 transition-colors cursor-pointer"
                  onClick={() => handleTenantClick(tenant)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4 flex-1">
                      <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white font-bold">
                        {tenant.name.substring(0, 2).toUpperCase()}
                      </div>
                      
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h3 className="text-lg font-medium text-gray-900">
                            {tenant.name}
                          </h3>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            tenant.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {tenant.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
                          {tenant.corporate_email_domain && (
                            <div className="flex items-center">
                              <Mail className="w-4 h-4 mr-2 text-gray-400" />
                              <span>{tenant.corporate_email_domain}</span>
                            </div>
                          )}
                          <div className="flex items-center">
                            <Users className="w-4 h-4 mr-2 text-gray-400" />
                            <span>{tenant.user_count || 0} Users</span>
                          </div>
                          <div className="flex items-center">
                            <Building className="w-4 h-4 mr-2 text-gray-400" />
                            <span>{tenant.facility_count || 0} Facilities</span>
                          </div>
                        </div>
                        
                        <div className="mt-2 flex items-center space-x-4 text-xs text-gray-500">
                          <div className="flex items-center">
                            <Calendar className="w-3 h-3 mr-1" />
                            <span>Created: {formatDate(tenant.created_at)}</span>
                          </div>
                          {tenant.tenant_prefix && (
                            <div className="flex items-center">
                              <span>Prefix: {tenant.tenant_prefix}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 ml-4">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleViewTenantSettings(tenant);
                        }}
                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Tenant Settings"
                      >
                        <Settings className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation(); 
                          handleViewTenantDetails(tenant);
                        }}
                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="View Details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEdit(tenant);
                        }}
                        className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        title="Edit Tenant"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      {tenant.is_active && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeactivate(tenant.id, tenant.name);
                          }}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Deactivate Tenant"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};