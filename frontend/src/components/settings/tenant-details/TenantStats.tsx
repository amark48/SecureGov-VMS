// src/components/settings/tenant-details/TenantStats.tsx
import React from 'react';
import { Users, Building, Calendar, Clock, AlertTriangle, CheckCircle, BarChart3 } from 'lucide-react';

interface TenantStatsProps {
  stats: any;
}

export const TenantStats: React.FC<TenantStatsProps> = ({ stats }) => {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
        <BarChart3 className="w-5 h-5 mr-2 text-purple-600" />
        Key Metrics
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-blue-50 rounded-lg p-4">
          <p className="text-sm font-medium text-blue-600">Total Users</p>
          <p className="text-2xl font-bold text-blue-900">{stats?.user_stats?.total_users || 0}</p>
        </div>
        <div className="bg-green-50 rounded-lg p-4">
          <p className="text-sm font-medium text-green-600">Total Facilities</p>
          <p className="text-2xl font-bold text-green-900">{stats?.facility_stats?.total_facilities || 0}</p>
        </div>
        <div className="bg-indigo-50 rounded-lg p-4">
          <p className="text-sm font-medium text-indigo-600">Total Visitors</p>
          <p className="text-2xl font-bold text-indigo-900">{stats?.visitor_stats?.total_visitors || 0}</p>
        </div>
        <div className="bg-purple-50 rounded-lg p-4">
          <p className="text-sm font-medium text-purple-600">Total Visits</p>
          <p className="text-2xl font-bold text-purple-900">{stats?.visit_stats?.total_visits || 0}</p>
        </div>
        <div className="bg-yellow-50 rounded-lg p-4">
          <p className="text-sm font-medium text-yellow-600">Pending Checks</p>
          <p className="text-2xl font-bold text-yellow-900">{stats?.visitor_stats?.pending_visitors || 0}</p>
        </div>
        <div className="bg-red-50 rounded-lg p-4">
          <p className="text-sm font-medium text-red-600">Blacklisted Visitors</p>
          <p className="text-2xl font-bold text-red-900">{stats?.visitor_stats?.blacklisted_visitors || 0}</p>
        </div>
      </div>
    </div>
  );
};
