import React from 'react';
import { 
  Activity, 
  User, 
  Clock, 
  FileText, 
  Download,
  TrendingUp,
  Shield,
  Eye
} from 'lucide-react';

interface AuditSummaryProps {
  auditStats: any;
}

export const AuditSummary: React.FC<AuditSummaryProps> = ({ auditStats }) => {
  const getActionColor = (action: string) => {
    switch (action) {
      case 'login':
        return 'bg-green-100 text-green-800';
      case 'logout':
        return 'bg-gray-100 text-gray-800';
      case 'create':
        return 'bg-blue-100 text-blue-800';
      case 'update':
        return 'bg-yellow-100 text-yellow-800';
      case 'delete':
        return 'bg-red-100 text-red-800';
      case 'check_in':
        return 'bg-purple-100 text-purple-800';
      case 'check_out':
        return 'bg-indigo-100 text-indigo-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      {/* Audit Overview */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center">
            <Activity className="w-5 h-5 mr-2 text-purple-600" />
            Audit Trail Summary
          </h2>
          <button className="flex items-center text-sm text-blue-600 hover:text-blue-700 font-medium">
            <Download className="w-4 h-4 mr-1" />
            Export Logs
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-gradient-to-r from-purple-50 to-purple-100 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-purple-600">Total Entries</p>
                <p className="text-2xl font-bold text-purple-900">
                  {auditStats?.total_entries?.toLocaleString() || 0}
                </p>
              </div>
              <FileText className="w-8 h-8 text-purple-600" />
            </div>
          </div>

          <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-600">Today</p>
                <p className="text-2xl font-bold text-blue-900">
                  {auditStats?.entries_today || 0}
                </p>
              </div>
              <Clock className="w-8 h-8 text-blue-600" />
            </div>
          </div>

          <div className="bg-gradient-to-r from-green-50 to-green-100 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-600">Active Users</p>
                <p className="text-2xl font-bold text-green-900">
                  {auditStats?.unique_users || 0}
                </p>
              </div>
              <User className="w-8 h-8 text-green-600" />
            </div>
          </div>

          <div className="bg-gradient-to-r from-orange-50 to-orange-100 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-orange-600">This Week</p>
                <p className="text-2xl font-bold text-orange-900">
                  {auditStats?.entries_week || 0}
                </p>
              </div>
              <TrendingUp className="w-8 h-8 text-orange-600" />
            </div>
          </div>
        </div>

        {/* Activity Breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Actions */}
          <div>
            <h3 className="text-md font-medium text-gray-900 mb-3 flex items-center">
              <Eye className="w-4 h-4 mr-2" />
              Recent Actions
            </h3>
            <div className="space-y-2">
              {auditStats?.actions?.slice(0, 5).map((action: any, index: number) => (
                <div key={index} className="flex items-center justify-between p-2 rounded-lg bg-gray-50">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getActionColor(action.action)}`}>
                    {action.action.replace('_', ' ')}
                  </span>
                  <span className="text-sm text-gray-600">{action.count} times</span>
                </div>
              )) || (
                <p className="text-sm text-gray-500">No recent actions</p>
              )}
            </div>
          </div>

          {/* Compliance */}
          <div>
            <h3 className="text-md font-medium text-gray-900 mb-3 flex items-center">
              <Shield className="w-4 h-4 mr-2" />
              Compliance Events
            </h3>
            <div className="space-y-2">
              {auditStats?.compliance?.slice(0, 5).map((item: any, index: number) => (
                <div key={index} className="flex items-center justify-between p-2 rounded-lg bg-gray-50">
                  <span className="text-sm font-medium text-gray-900">{item.flag}</span>
                  <span className="text-sm text-gray-600">{item.count} events</span>
                </div>
              )) || (
                <p className="text-sm text-gray-500">No compliance events</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* User Activity */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Top User Activity</h3>
        
        {auditStats?.user_activity?.length > 0 ? (
          <div className="space-y-3">
            {auditStats.user_activity.slice(0, 5).map((user: any, index: number) => (
              <div key={index} className="flex items-center justify-between p-3 rounded-lg border border-gray-100">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <User className="w-4 h-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{user.full_name}</p>
                    <p className="text-xs text-gray-500 capitalize">{user.role}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900">{user.activity_count} actions</p>
                  <p className="text-xs text-gray-500">
                    Last: {new Date(user.last_activity).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center text-gray-500 py-4">No user activity data available</p>
        )}
      </div>
    </div>
  );
};