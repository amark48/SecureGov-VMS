import React, { useState, useEffect } from 'react';
import { 
  Bell, 
  Mail, 
  MessageSquare, 
  Save, 
  RefreshCw, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Info,
  Send,
  Lock,
  Key
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useTenant } from '../../hooks/useTenant';
import { LoadingButton, Loading } from '../common/Loading';
import { useNotification } from '../../hooks/useNotification';
import { apiClient } from '../../services/api';
import type { EmailConfig, SmsConfig, PushConfig } from '../../types/tenant';

export const NotificationProviderSettings: React.FC = () => {
  const { user, isSuperAdmin } = useAuth();
  const { getTenant, updateNotificationProviders, loading: tenantLoading, error: tenantError } = useTenant();
  const { sendTestNotification, loading: notificationLoading, error: notificationError } = useNotification();
  
  const [loading, setLoading] = useState(false);
  const [tenant, setTenant] = useState<any>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [testEmail, setTestEmail] = useState('');
  const [testPhone, setTestPhone] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  
  // Form data
  const [formData, setFormData] = useState({
    email_provider: 'smtp',
    email_config: {
      host: '',
      port: 587,
      secure: false,
      user: '',
      pass: '',
      from: '',
      api_key: '',
      domain: ''
    } as EmailConfig,
    sms_provider: 'none',
    sms_config: {
      account_sid: '',
      auth_token: '',
      from_number: '',
      api_key: '',
      api_secret: ''
    } as SmsConfig,
    push_provider: 'none',
    push_config: {
      api_key: '',
      app_id: '',
      server_key: ''
    } as PushConfig
  });

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

  // Load tenant data on component mount
  useEffect(() => {
    const token = apiClient.getToken();
    setAccessToken(token);
  }, []);

  useEffect(() => {
    // Only load tenant data when user and tenant_id are available
    if (user && user.tenant_id) {
      loadTenantData();
    }
  }, [user]);

  const loadTenantData = async () => {
    setLoading(true);
    setErrorMessage(null);
    
    try {
      // At this point, we know user and tenant_id exist because of the condition in useEffect
      const tenantId = user!.tenant_id;
      
      const tenantData = await getTenant(tenantId);
      setTenant(tenantData);
      
      // Initialize form data with tenant settings
      setFormData({
        email_provider: tenantData.email_provider || 'smtp',
        email_config: {
          host: tenantData.email_config?.host || '',
          port: tenantData.email_config?.port || 587,
          secure: tenantData.email_config?.secure || false,
          user: tenantData.email_config?.user || '',
          pass: tenantData.email_config?.pass || '',
          from: tenantData.email_config?.from || '',
          api_key: tenantData.email_config?.api_key || '',
          domain: tenantData.email_config?.domain || ''
        },
        sms_provider: tenantData.sms_provider || 'none',
        sms_config: {
          account_sid: tenantData.sms_config?.account_sid || '',
          auth_token: tenantData.sms_config?.auth_token || '',
          from_number: tenantData.sms_config?.from_number || '',
          api_key: tenantData.sms_config?.api_key || '',
          api_secret: tenantData.sms_config?.api_secret || ''
        },
        push_provider: tenantData.push_provider || 'none',
        push_config: {
          api_key: tenantData.push_config?.api_key || '',
          app_id: tenantData.push_config?.app_id || '',
          server_key: tenantData.push_config?.server_key || ''
        }
      });
    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to load tenant data');
      console.error('Failed to load tenant data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    
    try {
      if (!tenant) {
        throw new Error('No tenant data available');
      }
      
      // Update tenant notification settings
      await updateNotificationProviders(tenant.id, {
        email_provider: formData.email_provider,
        email_config: formData.email_config,
        sms_provider: formData.sms_provider,
        sms_config: formData.sms_config,
        push_provider: formData.push_provider,
        push_config: formData.push_config
      });
      
      setSuccessMessage('Notification provider settings updated successfully');
      
      // Reload tenant data to get the latest settings
      await loadTenantData();
    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to update notification provider settings');
      console.error('Failed to update notification provider settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTestEmail = async () => {
    if (!testEmail) {
      setErrorMessage('Please enter a test email address');
      return;
    }

    if (!tenant) {
      setErrorMessage('Tenant information not available');
      return;
    }
    
    setIsTesting(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    
    try {
      console.log("Preparing to send test email to:", testEmail);
      // Get a template for testing
      const templateData = await apiClient.get('/api/notifications/templates?type=email&event=invitation');
      
      if (!templateData.templates || templateData.templates.length === 0) {
        console.error("No email templates found for testing");
        throw new Error('No email templates found for testing');
      }
      
      const template = templateData.templates[0];
      console.log("Using template:", template.name, "ID:", template.id);
      
      // Send test notification
      console.log("Sending test notification with variables:", {
        visitor_name: 'Test Visitor',
        facility_name: 'Test Facility',
        visit_date: new Date().toLocaleDateString(),
        visit_time: new Date().toLocaleTimeString(),
        purpose: 'Testing email notifications',
        host_name: 'Test Host',
        pre_registration_link: 'https://example.com/pre-register/test',
        organization_name: 'SecureGov VMS'
      });
      
      await sendTestNotification({
        tenant_id: tenant.id,
        template_id: template.id,
        recipient_email: testEmail,
        variables: {
          visitor_name: 'Test Visitor',
          facility_name: 'Test Facility',
          visit_date: new Date().toLocaleDateString(),
          visit_time: new Date().toLocaleTimeString(),
          purpose: 'Testing email notifications',
          host_name: 'Test Host',
          pre_registration_link: 'https://example.com/pre-register/test',
          organization_name: 'SecureGov VMS'
        }
      });
      
      console.log("Test email sent successfully");
      setSuccessMessage(`Test email sent to ${testEmail}`);
    } catch (error: any) {
      console.error("Failed to send test email:", error);
      setErrorMessage(error.message || 'Failed to send test email');
      console.error('Failed to send test email:', error);
    } finally {
      setIsTesting(false);
    }
  };

  const handleTestSMS = async () => {
    if (!testPhone) {
      setErrorMessage('Please enter a test phone number');
      return;
    }

    if (!tenant) {
      setErrorMessage('Tenant information not available');
      return;
    }
    
    setIsTesting(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    
    try {
      // Get a template for testing
      const templateData = await apiClient.get('/api/notifications/templates?type=sms&event=invitation');
      
      if (!templateData.templates || templateData.templates.length === 0) {
        throw new Error('No SMS templates found for testing');
      }
      
      const template = templateData.templates[0];
      
      // Send test notification
      await sendTestNotification({
        tenant_id: tenant.id,
        template_id: template.id,
        recipient_phone: testPhone,
        variables: {
          visitor_name: 'Test Visitor',
          facility_name: 'Test Facility',
          visit_date: new Date().toLocaleDateString(),
          pre_registration_link: 'https://example.com/pre-register/test'
        }
      });
      
      setSuccessMessage(`Test SMS sent to ${testPhone}`);
    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to send test SMS');
      console.error('Failed to send test SMS:', error);
    } finally {
      setIsTesting(false);
    }
  };

  if (loading && !tenant) {
    return <Loading message="Loading notification provider settings..." />;
  }

  return (
    <div className="space-y-6">
      {/* Show loading state if user or tenant data is not yet available */}
      {(!user || !user.tenant_id) && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
          <Loading message="Loading tenant information..." />
        </div>
      )}

      {/* Header */}
      {user && user.tenant_id && <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900">Notification Providers</h2>
        <button
          onClick={loadTenantData}
          disabled={loading}
          className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>}

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

      {(errorMessage || tenantError || notificationError) && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center justify-between">
          <div className="flex items-center">
            <AlertTriangle className="w-5 h-5 mr-2" />
            <p className="font-medium">{errorMessage || tenantError || notificationError}</p>
          </div>
          <button 
            onClick={() => setErrorMessage(null)}
            className="text-red-700 hover:text-red-900"
          >
            <XCircle className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Form */}
      {user && user.tenant_id && tenant && <form onSubmit={handleSubmit} className="space-y-8">
        {/* Email Provider */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-50 rounded-lg">
                <Mail className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Email Provider</h3>
                <p className="text-sm text-gray-500">Configure email delivery service</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="relative">
                <input
                  type="email"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  placeholder="Enter test email"
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <LoadingButton
                loading={isTesting}
                variant="secondary"
                size="sm"
                onClick={handleTestEmail}
                disabled={formData.email_provider === 'none'}
              >
                <Send className="w-4 h-4 mr-2" />
                Test Email
              </LoadingButton>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email Provider
              </label>
              <select
                value={formData.email_provider}
                onChange={(e) => setFormData(prev => ({ ...prev, email_provider: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="smtp">SMTP Server</option>
                <option value="sendgrid">SendGrid</option>
                <option value="mailgun">Mailgun</option>
              </select>
            </div>

            {formData.email_provider === 'smtp' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    SMTP Host
                  </label>
                  <input
                    type="text"
                    value={formData.email_config.host}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      email_config: {
                        ...prev.email_config,
                        host: e.target.value
                      }
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="smtp.example.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    SMTP Port
                  </label>
                  <input
                    type="number"
                    value={formData.email_config.port}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      email_config: {
                        ...prev.email_config,
                        port: parseInt(e.target.value)
                      }
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="587"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    SMTP Username
                  </label>
                  <input
                    type="text"
                    value={formData.email_config.user}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      email_config: {
                        ...prev.email_config,
                        user: e.target.value
                      }
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="username@example.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    SMTP Password
                  </label>
                  <div className="relative">
                    <input
                      type="password"
                      value={formData.email_config.pass}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        email_config: {
                          ...prev.email_config,
                          pass: e.target.value
                        }
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="••••••••"
                    />
                    <Lock className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    From Email
                  </label>
                  <input
                    type="email"
                    value={formData.email_config.from}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      email_config: {
                        ...prev.email_config,
                        from: e.target.value
                      }
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="noreply@example.com"
                  />
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="secure"
                    checked={formData.email_config.secure}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      email_config: {
                        ...prev.email_config,
                        secure: e.target.checked
                      }
                    }))}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="secure" className="ml-2 block text-sm text-gray-900">
                    Use Secure Connection (TLS/SSL)
                  </label>
                </div>
              </div>
            )}

            {formData.email_provider === 'sendgrid' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  SendGrid API Key
                </label>
                <div className="relative">
                  <input
                    type="password"
                    value={formData.email_config.api_key}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      email_config: {
                        ...prev.email_config,
                        api_key: e.target.value
                      }
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="SG.••••••••••••••••••••••••••••••••••••••••••••••••••••••••"
                  />
                  <Key className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                </div>
                <div className="mt-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    From Email
                  </label>
                  <input
                    type="email"
                    value={formData.email_config.from}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      email_config: {
                        ...prev.email_config,
                        from: e.target.value
                      }
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="noreply@example.com"
                  />
                </div>
              </div>
            )}

            {formData.email_provider === 'mailgun' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Mailgun API Key
                  </label>
                  <div className="relative">
                    <input
                      type="password"
                      value={formData.email_config.api_key}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        email_config: {
                          ...prev.email_config,
                          api_key: e.target.value
                        }
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="key-••••••••••••••••••••••••••••••"
                    />
                    <Key className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Mailgun Domain
                  </label>
                  <input
                    type="text"
                    value={formData.email_config.domain}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      email_config: {
                        ...prev.email_config,
                        domain: e.target.value
                      }
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="mg.example.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    From Email
                  </label>
                  <input
                    type="email"
                    value={formData.email_config.from}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      email_config: {
                        ...prev.email_config,
                        from: e.target.value
                      }
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="noreply@example.com"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* SMS Provider */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-green-50 rounded-lg">
                <MessageSquare className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">SMS Provider</h3>
                <p className="text-sm text-gray-500">Configure SMS delivery service</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="relative">
                <input
                  type="tel"
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                  placeholder="Enter test phone"
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                />
              </div>
              <LoadingButton
                loading={isTesting}
                variant="secondary"
                size="sm"
                onClick={handleTestSMS}
                disabled={formData.sms_provider === 'none'}
              >
                <Send className="w-4 h-4 mr-2" />
                Test SMS
              </LoadingButton>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                SMS Provider
              </label>
              <select
                value={formData.sms_provider}
                onChange={(e) => setFormData(prev => ({ ...prev, sms_provider: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
              >
                <option value="none">None</option>
                <option value="twilio">Twilio</option>
                <option value="vonage">Vonage</option>
              </select>
            </div>

            {formData.sms_provider === 'twilio' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Twilio Account SID
                  </label>
                  <div className="relative">
                    <input
                      type="password"
                      value={formData.sms_config.account_sid}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        sms_config: {
                          ...prev.sms_config,
                          account_sid: e.target.value
                        }
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                      placeholder="AC••••••••••••••••••••••••••••••"
                    />
                    <Key className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Twilio Auth Token
                  </label>
                  <div className="relative">
                    <input
                      type="password"
                      value={formData.sms_config.auth_token}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        sms_config: {
                          ...prev.sms_config,
                          auth_token: e.target.value
                        }
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                      placeholder="••••••••••••••••••••••••••••••"
                    />
                    <Key className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    From Phone Number
                  </label>
                  <input
                    type="text"
                    value={formData.sms_config.from_number}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      sms_config: {
                        ...prev.sms_config,
                        from_number: e.target.value
                      }
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    placeholder="+1234567890"
                  />
                </div>
              </div>
            )}

            {formData.sms_provider === 'vonage' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Vonage API Key
                  </label>
                  <div className="relative">
                    <input
                      type="password"
                      value={formData.sms_config.api_key}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        sms_config: {
                          ...prev.sms_config,
                          api_key: e.target.value
                        }
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                      placeholder="••••••••••••••••"
                    />
                    <Key className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Vonage API Secret
                  </label>
                  <div className="relative">
                    <input
                      type="password"
                      value={formData.sms_config.api_secret}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        sms_config: {
                          ...prev.sms_config,
                          api_secret: e.target.value
                        }
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                      placeholder="••••••••••••••••"
                    />
                    <Key className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    From Phone Number or Sender ID
                  </label>
                  <input
                    type="text"
                    value={formData.sms_config.from_number}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      sms_config: {
                        ...prev.sms_config,
                        from_number: e.target.value
                      }
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    placeholder="+1234567890 or SecureGov"
                  />
                </div>
              </div>
            )}

            {formData.sms_provider === 'none' && (
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex items-center space-x-2">
                  <Info className="w-5 h-5 text-gray-500" />
                  <p className="text-gray-600">No SMS provider configured. SMS notifications will not be sent.</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Push Notification Provider */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center space-x-3 mb-6">
            <div className="p-2 bg-purple-50 rounded-lg">
              <Bell className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Push Notification Provider</h3>
              <p className="text-sm text-gray-500">Configure push notification service</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Push Notification Provider
              </label>
              <select
                value={formData.push_provider}
                onChange={(e) => setFormData(prev => ({ ...prev, push_provider: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              >
                <option value="none">None</option>
                <option value="fcm">Firebase Cloud Messaging (FCM)</option>
                <option value="onesignal">OneSignal</option>
              </select>
            </div>

            {formData.push_provider === 'fcm' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Firebase Server Key
                </label>
                <div className="relative">
                  <input
                    type="password"
                    value={formData.push_config.server_key}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      push_config: {
                        ...prev.push_config,
                        server_key: e.target.value
                      }
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                    placeholder="••••••••••••••••••••••••••••••••••••••••••••••••••••••••"
                  />
                  <Key className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Note: For full FCM setup, you'll need to upload your Firebase Admin SDK service account JSON file to the server.
                </p>
              </div>
            )}

            {formData.push_provider === 'onesignal' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    OneSignal App ID
                  </label>
                  <input
                    type="text"
                    value={formData.push_config.app_id}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      push_config: {
                        ...prev.push_config,
                        app_id: e.target.value
                      }
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                    placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    OneSignal REST API Key
                  </label>
                  <div className="relative">
                    <input
                      type="password"
                      value={formData.push_config.api_key}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        push_config: {
                          ...prev.push_config,
                          api_key: e.target.value
                        }
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                      placeholder="••••••••••••••••••••••••••••••••••••••••••••••••••••••••"
                    />
                    <Key className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  </div>
                </div>
              </div>
            )}

            {formData.push_provider === 'none' && (
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex items-center space-x-2">
                  <Info className="w-5 h-5 text-gray-500" />
                  <p className="text-gray-600">No push notification provider configured. Push notifications will not be sent.</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end space-x-3 pt-4">
          <LoadingButton
            loading={loading}
            variant="primary"
            size="md"
            type="submit"
          >
            <Save className="w-4 h-4 mr-2" />
            Save Settings
          </LoadingButton>
        </div>
      </form>}
      
      {/* Token Debugging Display */}
      <div className="fixed bottom-2 right-2 max-w-xs bg-gray-800 text-white text-xs p-2 rounded-lg opacity-50 hover:opacity-100 transition-opacity overflow-hidden">
        <div className="font-mono overflow-x-auto whitespace-nowrap">
          <strong>Token:</strong> {accessToken ? accessToken.substring(0, 15) + '...' : 'No token'}
        </div>
      </div>
    </div>
  );
};