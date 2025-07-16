// src/components/settings/tenant-details/TenantSystemInfo.tsx
import React from 'react';
import { Server, Clock, Activity, BarChart3 } from 'lucide-react';
import { format } from 'date-fns';

interface TenantSystemInfoProps {
  tenant: any;
  stats: any;
}

export const TenantSystemInfo: React.FC<TenantSystemInfoProps> = ({ tenant, stats }) => {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
        <Server className="w-5 h-5 mr-2 text-gray-600" />
        System Information
      </h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h4 className="text-md font-medium text-gray-900 mb-3">Tenant Details</h4>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">Tenant ID</span>
              <span className="text-sm font-medium text-gray-900 font-mono">{tenant.id}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">Tenant Prefix</span>
              <span className="text-sm font-medium text-gray-900">{tenant.tenant_prefix || 'Not set'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">Next Employee Sequence</span>
              <span className="text-sm font-medium text-gray-900">{tenant.next_employee_sequence || 'Not set'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">Created At</span>
              <span className="text-sm font-medium text-gray-900">{format(new Date(tenant.created_at), 'PPpp')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">Last Updated</span>
              <span className="text-sm font-medium text-gray-900">{format(new Date(tenant.updated_at), 'PPpp')}</span>
            </div>
          </div>
        </div>

        <div>
          <h4 className="text-md font-medium text-gray-900 mb-3">Activity Summary</h4>
          <div className="space-y-2">
            {stats?.audit_stats ? (
              <>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Total Audit Logs</span>
                  <span className="text-sm font-medium text-gray-900">{stats.audit_stats.total_logs || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Today's Activity</span>
                  <span className="text-sm font-medium text-gray-900">{stats.audit_stats.today_logs || 0} events</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Last Activity</span>
                  <span className="text-sm font-medium text-gray-900">
                    {stats.audit_stats.last_activity ? format(new Date(stats.audit_stats.last_activity), 'MMM d, HH:mm') : 'None'}
                  </span>
                </div>
              </>
            ) : (
              <p className="text-sm text-gray-500">No activity data available</p>
            )}
            
            {stats?.daily_activity && stats.daily_activity.length > 0 && (
              <div className="mt-4">
                <h5 className="text-sm font-medium text-gray-700 mb-2">Recent Activity</h5>
                <div className="h-20 flex items-end space-x-1">
                  {stats.daily_activity.slice(0, 7).map((day: any, index: number) => (
                    <div key={index} className="flex flex-col items-center">
                      <div 
                        className="bg-blue-500 w-8 rounded-t-sm" 
                        style={{ 
                          height: `${Math.max(4, (day.count / Math.max(...stats.daily_activity.map((d: any) => d.count))) * 60)}px` 
                        }}
                      ></div>
                      <span className="text-xs text-gray-500 mt-1">
                        {new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' }).substring(0, 2)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
