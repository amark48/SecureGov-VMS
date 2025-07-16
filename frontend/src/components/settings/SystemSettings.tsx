// src/components/settings/SystemSettings.tsx
import React, { useState, useEffect } from 'react';
import {
  Shield, Building, Users, Bell, Settings, Plug, // Common icons
  CreditCard, // For Badge Issuance
  CheckCircle, XCircle, AlertTriangle, // Status icons
  Info, // Utility icons
} from 'lucide-react'; // Specific icons for tabs

import { LoadingButton, Loading } from '../common/Loading'; // Common UI components

import { useAuth } from '../../hooks/useAuth'; // Auth context
import { useTenant } from '../../hooks/useTenant'; // Tenant management hook
import { useIdentityProvider } from '../../hooks/useIdentityProvider'; // Identity provider hook

// Import all specific settings components
import { AcsIntegration } from './AcsIntegration';
import { UserManagement } from './UserManagement';
import { TenantManagement } from './TenantManagement'; // Import TenantManagement
import { NotificationProviderSettings } from './NotificationProviderSettings';
import { NotificationTemplates } from './NotificationTemplates'; // Import NotificationTemplates
import { NotificationLogs } from './NotificationLogs'; // Import NotificationLogs
import { RoleManagement } from './RoleManagement';
import { HostManagement } from './HostManagement';
import TenantAuthSettings from './TenantAuthSettings'; // Assuming this is the component for auth settings

// Define interfaces for tenant settings (only what SystemSettings directly manages)
interface TenantSettingsFormData {
  corporate_email_domain: string;
  tenant_prefix: string;
  next_employee_sequence: number;
  early_checkin_minutes: number;
  auto_checkout_time: string;
  auto_checkout_enabled: boolean;
  grace_period_hours: number;
  badge_issuance_options: string[];
  default_badge_type: 'printed' | 'civ_piv_i';
}

interface SystemSettingsProps {
  viewParams?: any;
  onSectionChange?: (section: string, params?: any) => void;
}

const SystemSettings: React.FC<SystemSettingsProps> = ({
  viewParams,
  onSectionChange
}) => {
  const { user, error: authError, clearError: clearAuthError } = useAuth();
  const { getTenant, updateTenant, error: tenantError, clearError: clearTenantError } = useTenant();
  const {
    loading: ipLoading, // Loading state for identity providers
    error: ipError, // Error state for identity providers
    clearError: clearIpError,
  } = useIdentityProvider(); // Only need loading/error from here, actual IP data is managed by TenantAuthSettings

  const [loading, setLoading] = useState(true);
  const [tenant, setTenant] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('general'); // State for active tab

  // Form data for general tenant settings
  const [formData, setFormData] = useState<TenantSettingsFormData>({
    corporate_email_domain: '',
    tenant_prefix: '',
    next_employee_sequence: 0,
    early_checkin_minutes: 0,
    auto_checkout_time: '',
    auto_checkout_enabled: false,
    grace_period_hours: 0,
    badge_issuance_options: [],
    default_badge_type: 'printed',
  });

  // Clear all error messages
  const clearAllErrors = () => {
    setError(null);
    clearAuthError();
    clearTenantError();
    clearIpError();
  };

  // Clear success message after 5 seconds
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  // Load tenant data on component mount or user change
  useEffect(() => {
    if (user && user.tenant_id) {
      loadTenantData();
    }
  }, [user?.tenant_id]);

  // Set active tab based on viewParams if provided
  useEffect(() => {
    if (viewParams?.tab) {
      setActiveTab(viewParams.tab);
    }
  }, [viewParams]);

  const loadTenantData = async () => {
    setLoading(true);
    try {
      const tenantData = await getTenant(user!.tenant_id);
      setTenant(tenantData);
      setFormData({
        corporate_email_domain: tenantData.corporate_email_domain || '',
        tenant_prefix: tenantData.tenant_prefix || '',
        next_employee_sequence: tenantData.next_employee_sequence || 0,
        early_checkin_minutes: tenantData.early_checkin_minutes || 0,
        auto_checkout_time: tenantData.auto_checkout_time || '',
        auto_checkout_enabled: tenantData.auto_checkout_enabled || false,
        grace_period_hours: tenantData.grace_period_hours || 0,
        badge_issuance_options: tenantData.badge_issuance_options || ['printed'],
        default_badge_type: tenantData.default_badge_type || 'printed',
      });
    } catch (err: any) {
      setError(err.message || 'Failed to load tenant settings');
    } finally {
      setLoading(false);
    }
  };

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type, checked } = e.target;

    if (type === 'checkbox') {
      setFormData((prev) => ({ ...prev, [name]: checked }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleBadgeOptionChange = (option: string, isChecked: boolean) => {
    setFormData(prev => {
      const updatedOptions = isChecked
        ? [...prev.badge_issuance_options, option]
        : prev.badge_issuance_options.filter(opt => opt !== option);
      return { ...prev, badge_issuance_options: updatedOptions };
    });
  };

  const handleSaveGeneralSettings = async () => {
    setLoading(true);
    clearAllErrors();
    try {
      await updateTenant(user!.tenant_id, {
        corporate_email_domain: formData.corporate_email_domain,
        tenant_prefix: formData.tenant_prefix,
        next_employee_sequence: formData.next_employee_sequence,
        early_checkin_minutes: formData.early_checkin_minutes,
        auto_checkout_time: formData.auto_checkout_time,
        auto_checkout_enabled: formData.auto_checkout_enabled,
        grace_period_hours: formData.grace_period_hours,
        badge_issuance_options: formData.badge_issuance_options,
        default_badge_type: formData.default_badge_type,
      });
      setSuccessMessage('General settings updated successfully');
    } catch (err: any) {
      setError(err.message || 'Failed to save general settings');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <Loading message="Loading tenant settings..." />;

  const tabs = [
    { id: 'general', label: 'General', icon: Settings },
    { id: 'auth', label: 'Authentication', icon: Shield },
    { id: 'notifications', label: 'Providers', icon: Bell }, // Renamed for clarity
    { id: 'notification-templates', label: 'Templates', icon: Bell }, // New tab for templates
    { id: 'notification-logs', label: 'Logs', icon: Bell }, // New tab for logs
    { id: 'roles', label: 'Roles', icon: Users },
    { id: 'hosts', label: 'Hosts', icon: Building },
    { id: 'users', label: 'Users', icon: Users },
    { id: 'tenants', label: 'Tenants', icon: Building },
    { id: 'acs', label: 'Access Control', icon: Plug },
  ];

  return (
    <div className="space-y-6">
      {/* Error Message */}
      {(error || authError || tenantError || ipError) && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center justify-between">
          <div className="flex items-center">
            <AlertTriangle className="w-5 h-5 mr-2" />
            <p className="font-medium">{error || authError || tenantError || ipError}</p>
          </div>
          <button
            onClick={clearAllErrors}
            className="text-red-700 hover:text-red-900"
          >
            <XCircle className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Success Message */}
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

      {/* Tab Navigation */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="border-b border-gray-200 bg-gray-50">
          <nav className="flex space-x-8 px-6">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-4 px-2 border-b-2 font-medium text-sm flex items-center transition-all duration-200 ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600 bg-blue-50/50'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="w-4 h-4 mr-2" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === 'general' && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                <Settings className="w-5 h-5 mr-2 text-gray-600" />
                General Tenant Settings
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Corporate Email Domain
                  </label>
                  <input
                    type="text"
                    name="corporate_email_domain"
                    value={formData.corporate_email_domain}
                    onChange={handleFormChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="example.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tenant Prefix
                  </label>
                  <input
                    type="text"
                    name="tenant_prefix"
                    value={formData.tenant_prefix}
                    onChange={handleFormChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="e.g., SGVMS"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Next Employee Sequence
                  </label>
                  <input
                    type="number"
                    name="next_employee_sequence"
                    value={formData.next_employee_sequence}
                    onChange={(e) => setFormData(prev => ({ ...prev, next_employee_sequence: parseInt(e.target.value) }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Early Check-in Minutes
                  </label>
                  <input
                    type="number"
                    name="early_checkin_minutes"
                    value={formData.early_checkin_minutes}
                    onChange={(e) => setFormData(prev => ({ ...prev, early_checkin_minutes: parseInt(e.target.value) }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Auto Checkout Time
                  </label>
                  <input
                    type="time"
                    name="auto_checkout_time"
                    value={formData.auto_checkout_time || ''}
                    onChange={handleFormChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="auto_checkout_enabled"
                    name="auto_checkout_enabled"
                    checked={formData.auto_checkout_enabled}
                    onChange={handleFormChange}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="auto_checkout_enabled" className="ml-2 block text-sm text-gray-900">
                    Enable Auto Checkout
                  </label>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Grace Period Hours
                  </label>
                  <input
                    type="number"
                    name="grace_period_hours"
                    value={formData.grace_period_hours}
                    onChange={handleFormChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Badge Issuance Settings */}
              <div className="mt-6 pt-6 border-t border-gray-200">
                <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                  <CreditCard className="w-5 h-5 mr-2 text-blue-600" />
                  Badge Issuance Settings
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Available Badge Types
                    </label>
                    <div className="space-y-2">
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          id="badge-printed"
                          checked={formData.badge_issuance_options.includes('printed')}
                          onChange={(e) => handleBadgeOptionChange('printed', e.target.checked)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <label htmlFor="badge-printed" className="ml-2 block text-sm text-gray-900">
                          Printed Badges
                        </label>
                      </div>
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          id="badge-civ-piv-i"
                          checked={formData.badge_issuance_options.includes('civ_piv_i')}
                          onChange={(e) => handleBadgeOptionChange('civ_piv_i', e.target.checked)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <label htmlFor="badge-civ-piv-i" className="ml-2 block text-sm text-gray-900">
                          CIV/PIV-I Badges
                        </label>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Default Badge Type
                    </label>
                    <select
                      value={formData.default_badge_type}
                      onChange={(e) => setFormData(prev => ({ ...prev, default_badge_type: e.target.value as 'printed' | 'civ_piv_i' }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      disabled={!formData.badge_issuance_options.length}
                    >
                      {formData.badge_issuance_options.includes('printed') && (
                        <option value="printed">Printed Badge</option>
                      )}
                      {formData.badge_issuance_options.includes('civ_piv_i') && (
                        <option value="civ_piv_i">CIV/PIV-I Badge</option>
                      )}
                    </select>
                    {!formData.badge_issuance_options.length && (
                      <p className="text-sm text-red-600 mt-1">
                        Please select at least one badge type.
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Actions for General Tab */}
              <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 mt-6">
                <LoadingButton
                  loading={loading}
                  variant="primary"
                  size="md"
                  onClick={handleSaveGeneralSettings}
                >
                  Save General Settings
                </LoadingButton>
              </div>
            </div>
          )}

          {activeTab === 'auth' && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              {/* TenantAuthSettings component will manage its own state and saving */}
              {/* It needs access to user, tenant, and identityProviders data */}
              {/* It will also handle its own success/error messages */}
              {/* Passing setSuccessMessage and setError to allow it to update parent messages */}
              <TenantAuthSettings
                settings={{
                  id: tenant.id,
                  name: tenant.name,
                  authStrategy: tenant.auth_strategy,
                  corporate_email_domain: tenant.corporate_email_domain,
                  tenant_prefix: tenant.tenant_prefix,
                  next_employee_sequence: tenant.next_employee_sequence,
                  early_checkin_minutes: tenant.early_checkin_minutes,
                  auto_checkout_time: tenant.auto_checkout_time,
                  auto_checkout_enabled: tenant.auto_checkout_enabled,
                  grace_period_hours: tenant.grace_period_hours,
                  badge_issuance_options: tenant.badge_issuance_options,
                  default_badge_type: tenant.default_badge_type,
                }}
                onSettingsChange={() => { /* This prop is now less critical as TenantAuthSettings manages its own state */ }}
                onSave={loadTenantData} // Trigger a reload of tenant data after saving in child
                loading={loading || ipLoading}
                error={error || ipError}
                successMessage={successMessage}
                setSuccessMessage={setSuccessMessage}
                setErrorMessage={setError}
              />
            </div>
          )}

          {activeTab === 'notifications' && (
            <NotificationProviderSettings />
          )}

          {activeTab === 'notification-templates' && (
            <NotificationTemplates />
          )}

          {activeTab === 'notification-logs' && (
            <NotificationLogs />
          )}

          {activeTab === 'roles' && (
            <RoleManagement />
          )}

          {activeTab === 'hosts' && (
            <HostManagement />
          )}

          {activeTab === 'users' && (
            <UserManagement tenantId={user?.tenant_id} />
          )}

          {activeTab === 'tenants' && (
            <TenantManagement viewParams={viewParams} onSectionChange={onSectionChange} />
          )}

          {activeTab === 'acs' && (
            <AcsIntegration />
          )}
        </div>
      </div>
    </div>
  );
};

export { SystemSettings };
