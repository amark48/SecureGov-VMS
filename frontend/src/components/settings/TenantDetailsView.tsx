// src/components/settings/TenantDetailsView.tsx
import React, { useState, useEffect } from 'react';
import { 
  Building, 
  Users, 
  CheckCircle, 
  XCircle, 
  Mail, 
  MessageSquare, 
  Bell, 
  Calendar,
  Globe,
  Settings,
  UserCog,
  Shield,
  AlertTriangle,
  RefreshCw,
  Download,
  Zap,
  Activity,
  FileText,
  Database,
  Server,
  ChevronLeft,
  Edit,
  Trash2,
  Eye,
  BarChart3,
  Clock
} from 'lucide-react';
import { useTenant } from '../../hooks/useTenant';
import { useAuth } from '../../hooks/useAuth';
import { LoadingButton, Loading } from '../common/Loading';
import { format } from 'date-fns';
import { TenantOverview } from './tenant-details/TenantOverview';
import { TenantStats } from './tenant-details/TenantStats';
import { TenantAdmins } from './tenant-details/TenantAdmins';
import { TenantNotificationProviders } from './tenant-details/TenantNotificationProviders';
import { TenantCustomDepartments } from './tenant-details/TenantCustomDepartments';
import { TenantSystemInfo } from './tenant-details/TenantSystemInfo';
import { TenantQuickActions } from './tenant-details/TenantQuickActions';
import { ConfirmationModal } from '../common/ConfirmationModal';


interface TenantDetailsViewProps {
  tenantId: string;
  onBack: () => void;
  onSectionChange?: (section: string, params?: any) => void;
}

export const TenantDetailsView: React.FC<TenantDetailsViewProps> = ({ 
  tenantId, 
  onBack,
  onSectionChange
}) => {
  const { user, isSuperAdmin } = useAuth();
  const { 
    getTenant, 
    getTenantStats, 
    deactivateTenant,
    loading, 
    error 
  } = useTenant();
  
  const [tenant, setTenant] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [isDeactivating, setIsDeactivating] = useState(false);
  const [showConfirmDeactivate, setShowConfirmDeactivate] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
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
    loadTenantData();
  }, [tenantId]);

  const loadTenantData = async () => {
    try {
      const [tenantData, statsData] = await Promise.all([
        getTenant(tenantId),
        getTenantStats(tenantId)
      ]);
      
      setTenant(tenantData);
      setStats(statsData);
    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to load tenant data');
      console.error('Failed to load tenant data:', error);
    }
  };

  const handleDeactivateTenant = async () => {
    setIsDeactivating(true);
    try {
      await deactivateTenant(tenantId);
      setSuccessMessage('Tenant deactivated successfully');
      
      // Reload tenant data to reflect the change
      await loadTenantData();
      
      setShowConfirmDeactivate(false);
    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to deactivate tenant');
      console.error('Failed to deactivate tenant:', error);
    } finally {
      setIsDeactivating(false);
    }
  };

  const handleEditTenant = () => {
    if (onSectionChange) {
      onSectionChange('tenants', { view: 'edit', tenantId });
    }
  };

  const handleManageUsers = () => {
    if (onSectionChange) {
      onSectionChange('users', { tenantId });
    }
  };

  const handleManageRoles = () => {
    if (onSectionChange) {
      onSectionChange('roles', { tenantId });
    }
  };

  const handleManageNotifications = () => {
    if (onSectionChange) {
      onSectionChange('notifications', { tab: 'templates', tenantId });
    }
  };

  const handleViewReports = () => {
    if (onSectionChange) {
      onSectionChange('reports', { tenantId });
    }
  };

  if (loading && !tenant) {
    return <Loading message="Loading tenant details..." />;
  }

  if (!tenant) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
        <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
        <h2 className="text-2xl font-semibold text-gray-900 mb-2">Tenant Not Found</h2>
        <p className="text-gray-600 mb-4">
          The tenant you're looking for could not be found or you don't have permission to view it.
        </p>
        <button
          onClick={onBack}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
        >
          Back to Tenant List
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={onBack}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white font-bold">
                <Building className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{tenant.name}</h1>
                <div className="flex items-center space-x-3 mt-1">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    tenant.is_active ? 'bg-green-100 text-green-800 border border-green-200' : 'bg-red-100 text-red-800 border border-red-200'
                  }`}>
                    {tenant.is_active ? 'Active' : 'Inactive'}
                  </span>
                  {tenant.corporate_email_domain && (
                    <span className="text-sm text-gray-500">
                      <Globe className="w-3 h-3 inline mr-1" />
                      {tenant.corporate_email_domain}
                    </span>
                  )}
                  <span className="text-sm text-gray-500">
                    <Calendar className="w-3 h-3 inline mr-1" />
                    Created {format(new Date(tenant.created_at), 'MMM d, yyyy')}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={handleEditTenant}
              className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <Edit className="w-4 h-4 mr-2" />
              Edit Tenant
            </button>
            {tenant.is_active && tenant.name !== 'Default Tenant' && (
              <button
                onClick={() => setShowConfirmDeactivate(true)}
                className="flex items-center px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Deactivate
              </button>
            )}
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

      {/* Quick Actions */}
      <TenantQuickActions
        onManageUsers={handleManageUsers}
        onManageRoles={handleManageRoles}
        onManageNotifications={handleManageNotifications}
        onViewReports={handleViewReports}
      />

      {/* Tenant Overview */}
      <TenantOverview tenant={tenant} />

      {/* Tenant Statistics */}
      <TenantStats stats={stats} />

      {/* Tenant Administrators */}
      <TenantAdmins admins={tenant.admins} onManageUsers={handleManageUsers} />

      {/* Notification Providers */}
      <TenantNotificationProviders tenant={tenant} onManageNotifications={handleManageNotifications} />

      {/* Custom Departments */}
      <TenantCustomDepartments tenant={tenant} onEditTenant={handleEditTenant} />

      {/* System Information */}
      <TenantSystemInfo tenant={tenant} stats={stats} />

      {/* Deactivate Confirmation Modal */}
      <ConfirmationModal
        isOpen={showConfirmDeactivate}
        title="Confirm Deactivation"
        message={`Are you sure you want to deactivate the tenant "${tenant.name}"? This will prevent users from accessing the system but will not delete any data.`}
        confirmText="Deactivate"
        onConfirm={handleDeactivateTenant}
        onCancel={() => setShowConfirmDeactivate(false)}
        type="danger"
      />
    </div>
  );
};
