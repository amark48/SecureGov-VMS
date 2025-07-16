// src/components/settings/AcsIntegration.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  Edit,
  Trash2,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Settings,
  Plug,
  Info,
  ChevronLeft,
} from 'lucide-react';
import { LoadingButton, Loading } from '../common/Loading';
import { useAcs } from '../../hooks/useAcs'; // Assuming this hook exists
import { useAuth } from '../../hooks/useAuth'; // To get tenant_id
import type { AcsProvider, AcsConfig } from '../../types/acs';

interface AcsIntegrationProps {}

export const AcsIntegration: React.FC<AcsIntegrationProps> = () => {
  const { user } = useAuth();
  const {
    loading,
    error,
    acsProviders,
    clearError,
    getAcsProviders,
    createAcsProvider,
    updateAcsProvider,
    deleteAcsProvider,
    testAcsConnection,
  } = useAcs();

  const [showForm, setShowForm] = useState(false);
  const [editingProvider, setEditingProvider] = useState<AcsProvider | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ id: string; success: boolean; message: string } | null>(null);

  // Form data state
  const [formData, setFormData] = useState<{
    name: string;
    provider_type: 'lenel' | 's2security' | 'ccure9000' | 'custom';
    config: AcsConfig;
    is_active: boolean;
  }>({
    name: '',
    provider_type: 'lenel',
    config: {},
    is_active: true,
  });

  // Clear messages after a few seconds
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  useEffect(() => {
    if (errorMessage) {
      const timer = setTimeout(() => setErrorMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [errorMessage]);

  useEffect(() => {
    if (testResult) {
      const timer = setTimeout(() => setTestResult(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [testResult]);

  // Load providers on component mount
  useEffect(() => {
    loadProviders();
  }, []);

  const loadProviders = async () => {
    setErrorMessage(null);
    try {
      await getAcsProviders();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to load ACS providers');
    }
  };

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type, checked } = e.target;

    if (name.startsWith('config.')) {
      const configField = name.split('.')[1];
      setFormData((prev) => ({
        ...prev,
        config: {
          ...prev.config,
          [configField]: type === 'checkbox' ? checked : value,
        },
      }));
    } else if (type === 'checkbox') {
      setFormData((prev) => ({ ...prev, [name]: checked }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!user?.tenant_id) {
      setErrorMessage('Tenant ID is missing. Cannot save provider.');
      return;
    }

    try {
      if (editingProvider) {
        await updateAcsProvider(editingProvider.id, formData);
        setSuccessMessage(`ACS provider "${formData.name}" updated successfully.`);
      } else {
        await createAcsProvider({ ...formData, tenant_id: user.tenant_id });
        setSuccessMessage(`ACS provider "${formData.name}" added successfully.`);
      }
      resetForm();
      loadProviders(); // Refresh list
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to save ACS provider.');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      provider_type: 'lenel',
      config: {},
      is_active: true,
    });
    setEditingProvider(null);
    setShowForm(false);
  };

  const handleEdit = (provider: AcsProvider) => {
    setFormData({
      name: provider.name,
      provider_type: provider.provider_type,
      config: provider.config || {},
      is_active: provider.is_active,
    });
    setEditingProvider(provider);
    setShowForm(true);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete the ACS provider "${name}"?`)) {
      return;
    }
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      await deleteAcsProvider(id);
      setSuccessMessage(`ACS provider "${name}" deleted successfully.`);
      loadProviders(); // Refresh list
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to delete ACS provider.');
    }
  };

  const handleTestConnection = async (id: string) => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setTestResult(null);
    try {
      const result = await testAcsConnection(id);
      setTestResult({ id, success: result.success, message: result.message });
      if (result.success) {
        setSuccessMessage(result.message);
      } else {
        setErrorMessage(result.message);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to test connection.');
    }
  };

  const renderProviderSpecificFields = () => {
    switch (formData.provider_type) {
      case 'lenel':
        return (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">API URL</label>
              <input
                type="text"
                name="config.url"
                value={formData.config.url || ''}
                onChange={handleFormChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="https://lenel.example.com/api"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">API Key</label>
              <input
                type="password"
                name="config.apiKey"
                value={formData.config.apiKey || ''}
                onChange={handleFormChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="••••••••••••••••"
              />
            </div>
          </>
        );
      case 's2security':
        return (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">IP Address</label>
              <input
                type="text"
                name="config.ipAddress"
                value={formData.config.ipAddress || ''}
                onChange={handleFormChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="192.168.1.100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
              <input
                type="text"
                name="config.username"
                value={formData.config.username || ''}
                onChange={handleFormChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="admin"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                name="config.password"
                value={formData.config.password || ''}
                onChange={handleFormChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="••••••••••••••••"
              />
            </div>
          </>
        );
      case 'ccure9000':
        return (
          <>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Base URL</label>
              <input
                type="text"
                name="config.base_url"
                value={formData.config.base_url || ''}
                onChange={handleFormChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="http://192.168.10.251/victorWebService/"
              />
              <p className="text-xs text-gray-500 mt-1">
                The base URL of the Ccure 9000 web service, including the trailing slash
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">User Name</label>
              <input
                type="text"
                name="config.user_name"
                value={formData.config.user_name || ''}
                onChange={handleFormChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="DEV"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                name="config.password" 
                value={formData.config.password || ''} 
                onChange={handleFormChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="P@ssword123!"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Client Name</label>
              <input
                type="text"
                name="config.client_name"
                value={formData.config.client_name || ''}
                onChange={handleFormChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="DEV"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Client ID</label>
              <input
                type="text"
                name="config.client_id"
                value={formData.config.client_id || ''}
                onChange={handleFormChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="AEA60862-A0BC-48CB-9F73-656BA8F5F73D"
              />
              <p className="text-xs text-gray-500 mt-1">
                The client ID is a GUID that identifies your client application
              </p>
            </div>
          </>
        );
      case 'custom':
        return (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Endpoint URL</label>
              <input
                type="text"
                name="config.endpointUrl"
                value={formData.config.endpointUrl || ''}
                onChange={handleFormChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="https://custom-acs.example.com/api"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Auth Token (if any)</label>
              <input
                type="password"
                name="config.authToken"
                value={formData.config.authToken || ''}
                onChange={handleFormChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="••••••••••••••••"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Custom Fields (JSON)</label>
              <textarea
                name="config.customJson"
                value={JSON.stringify(formData.config.customJson || {}, null, 2)}
                onChange={(e) => {
                  try {
                    setFormData((prev) => ({
                      ...prev,
                      config: {
                        ...prev.config,
                        customJson: JSON.parse(e.target.value),
                      },
                    }));
                  } catch (err) {
                    // Handle invalid JSON input
                    console.error('Invalid JSON input:', err);
                  }
                }}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                placeholder="{}"
              />
            </div>
          </>
        );
      default:
        return null;
    }
  };

  if (showForm) {
    return (
      <div className="space-y-6">
        {/* Form Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={resetForm}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h2 className="text-xl font-semibold text-gray-900">
              {editingProvider ? 'Edit ACS Provider' : 'Add New ACS Provider'}
            </h2>
          </div>
        </div>

        {/* Success/Error Messages */}
        {successMessage && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg flex items-center justify-between">
            <div className="flex items-center">
              <CheckCircle className="w-5 h-5 mr-2" />
              <p className="font-medium">{successMessage}</p>
            </div>
            <button onClick={() => setSuccessMessage(null)} className="text-green-700 hover:text-green-900">
              <XCircle className="w-5 h-5" />
            </button>
          </div>
        )}

        {(errorMessage || error) && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center justify-between">
            <div className="flex items-center">
              <AlertTriangle className="w-5 h-5 mr-2" />
              <p className="font-medium">{errorMessage || error}</p>
            </div>
            <button onClick={() => { setErrorMessage(null); clearError(); }} className="text-red-700 hover:text-red-900">
              <XCircle className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Form */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="text-md font-medium text-gray-900 flex items-center">
                <Settings className="w-4 h-4 mr-2" />
                Provider Details
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Provider Name *</label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleFormChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="e.g., Main Building Lenel"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Provider Type *</label>
                  <select
                    name="provider_type"
                    value={formData.provider_type}
                    onChange={handleFormChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  >
                    <option value="lenel">Lenel</option>
                    <option value="s2security">S2 Security</option>
                    <option value="ccure9000">Ccure 9000</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="is_active"
                    name="is_active"
                    checked={formData.is_active}
                    onChange={handleFormChange}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="is_active" className="ml-2 block text-sm text-gray-900">
                    Active
                  </label>
                </div>
              </div>
            </div>

            {/* Provider-Specific Configuration */}
            <div className="space-y-4">
              <h3 className="text-md font-medium text-gray-900 flex items-center">
                <Plug className="w-4 h-4 mr-2" />
                Configuration
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {renderProviderSpecificFields()}
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Cancel
              </button>

              <LoadingButton loading={loading} variant="primary" size="md" type="submit">
                {editingProvider ? 'Update Provider' : 'Add Provider'}
              </LoadingButton>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold mb-2">Access Control Systems</h1>
            <p className="text-blue-100">
              Manage integrations with external physical access control systems
            </p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold">{acsProviders.length}</div>
            <div className="text-blue-200 text-sm">Total Providers</div>
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
          <button onClick={() => setSuccessMessage(null)} className="text-green-700 hover:text-green-900">
            <XCircle className="w-5 h-5" />
          </button>
        </div>
      )}

      {(errorMessage || error) && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center justify-between">
          <div className="flex items-center">
            <AlertTriangle className="w-5 h-5 mr-2" />
            <p className="font-medium">{errorMessage || error}</p>
          </div>
          <button onClick={() => { setErrorMessage(null); clearError(); }} className="text-red-700 hover:text-red-900">
            <XCircle className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Test Result Message */}
      {testResult && (
        <div className={`px-4 py-3 rounded-lg flex items-center justify-between ${testResult.success ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-700'}`}>
          <div className="flex items-center">
            {testResult.success ? <CheckCircle className="w-5 h-5 mr-2" /> : <AlertTriangle className="w-5 h-5 mr-2" />}
            <p className="font-medium">{testResult.message}</p>
          </div>
          <button onClick={() => setTestResult(null)} className={`${testResult.success ? 'text-green-700' : 'text-red-700'} hover:text-gray-900`}>
            <XCircle className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Controls */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex justify-end space-x-3">
          <button
            onClick={loadProviders}
            disabled={loading}
            className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>

          <button
            onClick={() => setShowForm(true)}
            className="flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Provider
          </button>
        </div>
      </div>

      {/* ACS Providers List */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            Configured Providers ({acsProviders.length})
          </h2>
        </div>

        {loading && acsProviders.length === 0 ? (
          <Loading message="Loading ACS providers..." />
        ) : (
          <div className="divide-y divide-gray-200">
            {acsProviders.length === 0 ? (
              <div className="p-12 text-center">
                <Plug className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500 text-lg">No ACS providers configured</p>
                <p className="text-gray-400 text-sm">
                  Start by adding your first access control system integration.
                </p>
                <button
                  onClick={() => setShowForm(true)}
                  className="mt-4 inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add First Provider
                </button>
              </div>
            ) : (
              acsProviders.map((provider) => (
                <div key={provider.id} className="p-6 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4 flex-1">
                      <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white font-bold">
                        <Plug className="w-6 h-6" />
                      </div>

                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h3 className="text-lg font-medium text-gray-900">{provider.name}</h3>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${provider.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                            {provider.is_active ? 'Active' : 'Inactive'}
                          </span>
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                            {provider.provider_type.toUpperCase()}
                          </span>
                        </div>

                        <div className="text-sm text-gray-600">
                          <p>Type: {provider.provider_type.charAt(0).toUpperCase() + provider.provider_type.slice(1)}</p>
                          {provider.config.url && <p>URL: {provider.config.url}</p>}
                          {provider.config.ipAddress && <p>IP: {provider.config.ipAddress}</p>}
                          {provider.config.endpointUrl && <p>Endpoint: {provider.config.endpointUrl}</p>}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 ml-4">
                      <LoadingButton
                        loading={loading && testResult?.id === provider.id}
                        variant="secondary"
                        size="sm"
                        onClick={() => handleTestConnection(provider.id)}
                      >
                        <Plug className="w-4 h-4 mr-1" />
                        Test
                      </LoadingButton>
                      <button
                        onClick={() => handleEdit(provider)}
                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Edit Provider"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(provider.id, provider.name)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete Provider"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Information Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-medium text-blue-800">About Access Control Systems</h3>
            <p className="text-sm text-blue-700 mt-1">
              Integrate with your physical access control systems (PACS) to automatically provision and de-provision visitor access based on their check-in and check-out status.
            </p>
            <p className="text-sm text-blue-700 mt-1">
              Ensure that only authorized visitors have access to designated areas within your facilities.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};