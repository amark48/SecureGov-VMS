// src/components/settings/tenant-details/TenantAdmins.tsx
import React from 'react';
import { UserCog, User, Mail, Phone, Calendar, CheckCircle, XCircle } from 'lucide-react';
import { format } from 'date-fns';

interface TenantAdminsProps {
  admins: any[];
  onManageUsers: () => void;
}

export const TenantAdmins: React.FC<TenantAdminsProps> = ({ admins, onManageUsers }) => {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-gray-900 flex items-center">
          <UserCog className="w-5 h-5 mr-2 text-purple-600" />
          Tenant Administrators
        </h3>
        <button
          onClick={onManageUsers}
          className="text-sm text-blue-600 hover:text-blue-700 font-medium"
        >
          View All Users
        </button>
      </div>
      
      {admins && admins.length > 0 ? (
        <div className="space-y-3">
          {admins.map((admin: any, index: number) => (
            <div key={admin.id || index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                  <User className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">{admin.full_name}</p>
                  <p className="text-sm text-gray-500">{admin.email}</p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-xs text-gray-500">
                  {admin.last_login ? `Last login: ${format(new Date(admin.last_login), 'MMM d, yyyy')}` : 'Never logged in'}
                </span>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                  admin.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}>
                  {admin.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8">
          <UserCog className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">No administrators found</p>
        </div>
      )}
    </div>
  );
};
