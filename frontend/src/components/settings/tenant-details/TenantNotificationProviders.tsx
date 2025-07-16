// src/components/settings/tenant-details/TenantNotificationProviders.tsx
import React from 'react';
import { Bell, Mail, MessageSquare, CheckCircle, XCircle } from 'lucide-react';

interface TenantNotificationProvidersProps {
  tenant: any;
  onManageNotifications: () => void;
}

export const TenantNotificationProviders: React.FC<TenantNotificationProvidersProps> = ({ 
  tenant, 
  onManageNotifications 
}) => {
  const getProviderStatus = (provider: string): { status: string, color: string } => {
    if (provider === 'none') {
      return { status: 'Not Configured', color: 'text-gray-500' };
    }
    return { status: 'Configured', color: 'text-green-600' };
  };

  const getEmailProviderName = (provider: string): string => {
    const providers: Record<string, string> = {
      'smtp': 'SMTP Server',
      'sendgrid': 'SendGrid',
      'mailgun': 'Mailgun',
      'none': 'Not Configured'
    };
    return providers[provider] || provider;
  };

  const getSmsProviderName = (provider: string): string => {
    const providers: Record<string, string> = {
      'twilio': 'Twilio',
      'none': 'Not Configured'
    };
    return providers[provider] || provider;
  };

  const getPushProviderName = (provider: string): string => {
    const providers: Record<string, string> = {
      'fcm': 'Firebase Cloud Messaging',
      'onesignal': 'OneSignal',
      'none': 'Not Configured'
    };
    return providers[provider] || provider;
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-gray-900 flex items-center">
          <Bell className="w-5 h-5 mr-2 text-orange-600" />
          Notification Providers
        </h3>
        <button
          onClick={onManageNotifications}
          className="text-sm text-blue-600 hover:text-blue-700 font-medium"
        >
          Configure Providers
        </button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Email Provider */}
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-medium text-gray-900 flex items-center">
              <Mail className="w-4 h-4 mr-2 text-blue-600" />
              Email Provider
            </h4>
            <span className={`text-sm ${getProviderStatus(tenant.email_provider || 'none').color}`}>
              {getProviderStatus(tenant.email_provider || 'none').status}
            </span>
          </div>
          <p className="text-sm text-gray-600">
            {getEmailProviderName(tenant.email_provider || 'none')}
          </p>
          {tenant.email_provider !== 'none' && tenant.email_config?.from && (
            <p className="text-xs text-gray-500 mt-1">
              From: {tenant.email_config.from}
            </p>
          )}
        </div>
        
        {/* SMS Provider */}
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-medium text-gray-900 flex items-center">
              <MessageSquare className="w-4 h-4 mr-2 text-green-600" />
              SMS Provider
            </h4>
            <span className={`text-sm ${getProviderStatus(tenant.sms_provider || 'none').color}`}>
              {getProviderStatus(tenant.sms_provider || 'none').status}
            </span>
          </div>
          <p className="text-sm text-gray-600">
            {getSmsProviderName(tenant.sms_provider || 'none')}
          </p>
          {tenant.sms_provider !== 'none' && tenant.sms_config?.from_number && (
            <p className="text-xs text-gray-500 mt-1">
              From: {tenant.sms_config.from_number}
            </p>
          )}
        </div>
        
        {/* Push Provider */}
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-medium text-gray-900 flex items-center">
              <Bell className="w-4 h-4 mr-2 text-purple-600" />
              Push Provider
            </h4>
            <span className={`text-sm ${getProviderStatus(tenant.push_provider || 'none').color}`}>
              {getProviderStatus(tenant.push_provider || 'none').status}
            </span>
          </div>
          <p className="text-sm text-gray-600">
            {getPushProviderName(tenant.push_provider || 'none')}
          </p>
          {tenant.push_provider !== 'none' && tenant.push_config?.app_id && (
            <p className="text-xs text-gray-500 mt-1">
              App ID: {tenant.push_config.app_id.substring(0, 8)}...
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
