// src/components/settings/tenant-details/TenantCustomDepartments.tsx
import React from 'react';
import { Building, Edit } from 'lucide-react';

interface TenantCustomDepartmentsProps {
  tenant: any;
  onEditTenant: () => void;
}

export const TenantCustomDepartments: React.FC<TenantCustomDepartmentsProps> = ({ 
  tenant, 
  onEditTenant 
}) => {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-gray-900 flex items-center">
          <Building className="w-5 h-5 mr-2 text-indigo-600" />
          Custom Departments
        </h3>
        <button
          onClick={onEditTenant}
          className="text-sm text-blue-600 hover:text-blue-700 font-medium"
        >
          Edit Departments
        </button>
      </div>
      
      {tenant.custom_departments && tenant.custom_departments.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {tenant.custom_departments.map((department: string, index: number) => (
            <span key={index} className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-indigo-100 text-indigo-800">
              {department}
            </span>
          ))}
        </div>
      ) : (
        <div className="text-center py-6">
          <Building className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">No custom departments configured</p>
          <p className="text-sm text-gray-400">
            Custom departments help organize users within this tenant
          </p>
        </div>
      )}
    </div>
  );
};
