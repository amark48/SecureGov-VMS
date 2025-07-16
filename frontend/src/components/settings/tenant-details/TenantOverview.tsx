// src/components/settings/tenant-details/TenantOverview.tsx
import React from 'react';
import { Building, Globe, Calendar, CheckCircle, XCircle } from 'lucide-react';
import { format } from 'date-fns';

interface TenantOverviewProps {
  tenant: any;
}

export const TenantOverview: React.FC<TenantOverviewProps> = ({ tenant }) => {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
        <Building className="w-5 h-5 mr-2 text-blue-600" />
        Tenant Overview
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Tenant Name</label>
          <p className="text-gray-900">{tenant.name}</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Status</label>
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
            tenant.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}>
            {tenant.is_active ? <CheckCircle className="w-3 h-3 mr-1" /> : <XCircle className="w-3 h-3 mr-1" />}
            {tenant.is_active ? 'Active' : 'Inactive'}
          </span>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Corporate Email Domain</label>
          <p className="text-gray-900">{tenant.corporate_email_domain || 'N/A'}</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Created At</label>
          <p className="text-gray-900">{format(new Date(tenant.created_at), 'PPP')}</p>
        </div>
      </div>
    </div>
  );
};
