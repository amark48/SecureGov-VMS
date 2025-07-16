// src/components/settings/tenant-details/TenantQuickActions.tsx
import React from 'react';
import { Users, Shield, Bell, BarChart3 } from 'lucide-react';

interface TenantQuickActionsProps {
  onManageUsers: () => void;
  onManageRoles: () => void;
  onManageNotifications: () => void;
  onViewReports: () => void;
}

export const TenantQuickActions: React.FC<TenantQuickActionsProps> = ({
  onManageUsers,
  onManageRoles,
  onManageNotifications,
  onViewReports,
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <button
        onClick={onManageUsers}
        className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:bg-gray-50 transition-colors text-left"
      >
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-medium text-gray-900">Manage Users</h3>
          <Users className="w-5 h-5 text-blue-600" />
        </div>
        <p className="text-sm text-gray-600">
          View and manage user accounts for this tenant
        </p>
      </button>

      <button
        onClick={onManageRoles}
        className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:bg-gray-50 transition-colors text-left"
      >
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-medium text-gray-900">Manage Roles</h3>
          <Shield className="w-5 h-5 text-purple-600" />
        </div>
        <p className="text-sm text-gray-600">
          Configure roles and permissions
        </p>
      </button>

      <button
        onClick={onManageNotifications}
        className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:bg-gray-50 transition-colors text-left"
      >
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-medium text-gray-900">Notifications</h3>
          <Bell className="w-5 h-5 text-orange-600" />
        </div>
        <p className="text-sm text-gray-600">
          Manage notification templates and settings
        </p>
      </button>

      <button
        onClick={onViewReports}
        className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:bg-gray-50 transition-colors text-left"
      >
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-medium text-gray-900">View Reports</h3>
          <BarChart3 className="w-5 h-5 text-green-600" />
        </div>
        <p className="text-sm text-gray-600">
          Access analytics and reports for this tenant
        </p>
      </button>
    </div>
  );
};
