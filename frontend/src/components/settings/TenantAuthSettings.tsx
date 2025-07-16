import React, { useState, useEffect } from 'react';
import {
  Shield,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Save,
  Microscope as Microsoft,
  Cloud,
  Globe,
  Lock as LockIcon,
  Lock,
  Key,
  Plus,
  Trash2,
  Info
} from 'lucide-react';
import { LoadingButton } from '../common/Loading';
import { useTenant } from '../../hooks/useTenant';
import { useAuth } from '../../hooks/useAuth';
import { useIdentityProvider } from '../../hooks/useIdentityProvider'; // New hook import
import type { Tenant, IdentityProvider } from '../../types/tenant';

import { ConfirmationModal } from '../common/ConfirmationModal';
// Define interfaces for authentication settings
export interface TenantSettings {
  id: string;
  name: string;
  authStrategy: 'traditional' | 'azure_ad' | 'aws_cognito' | 'okta' | 'auth0' | 'hybrid';
  // identityProviders is now managed by useIdentityProvider hook
}

interface TenantAuthSettingsProps {
  settings: TenantSettings; // This 'settings' object will now primarily contain authStrategy
  onSettingsChange: (newSettings: Partial<TenantSettings>) => void;
  onSave: () => void; // This will now only save the authStrategy
  loading: boolean; // This loading is for the parent component's general loading
  error: string | null;
  successMessage: string | null;
  setSuccessMessage: (message: string | null) => void;
  setErrorMessage: (message: string | null) => void;
}

const TenantAuthSettings: React.FC<TenantAuthSettingsProps> = ({
  settings,
  onSettingsChange,
  onSave, // This is for saving the authStrategy
  loading: parentLoading, // Renamed to avoid conflict with local loading
  error: parentError,
  successMessage: parentSuccessMessage,
  setSuccessMessage: setParentSuccessMessage,
  setErrorMessage: setParentErrorMessage
}) => {
  const { user } = useAuth();
  const { getTenant, updateTenant } = useTenant(); // Still used for main tenant updates
  const {
    identityProviders,
    loading: ipLoading, // Loading state for identity providers
    error: ipError, // Error state for identity providers
    fetchIdentityProviders,
    createIdentityProvider,
    updateIdentityProvider,
    deleteIdentityProvider,
    deactivateIdentityProvider,
  } = useIdentityProvider();

  const [localAuthStrategy, setLocalAuthStrategy] = useState(settings.authStrategy);
  const [showConfirmRemoveModal, setShowConfirmRemoveModal] = useState(false);
  const [providerToRemove, setProviderToRemove] = useState<IdentityProvider | null>(null);
  const [isSavingProviders, setIsSavingProviders] = useState(false);

  // Sync parent settings with local state
  useEffect(() => {
    setLocalAuthStrategy(settings.authStrategy);
  }, [settings.authStrategy]);

  // Fetch identity providers when component mounts or tenant changes
  useEffect(() => {
    if (user?.tenant_id) {
      fetchIdentityProviders(user.tenant_id);
    }
  }, [user?.tenant_id, fetchIdentityProviders]);

  const handleAuthStrategyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newStrategy = e.target.value as 'traditional' | 'azure_ad' | 'aws_cognito' | 'okta' | 'auth0' | 'hybrid';
    setLocalAuthStrategy(newStrategy);
    onSettingsChange({ authStrategy: newStrategy }); // Update parent state immediately
  };

  const handleProviderConfigChange = (
    providerId: string | undefined,
    field: string,
    value: any,
    providerType: IdentityProvider['provider_type']
  ) => {
    const providerToUpdate = identityProviders.find(p => p.id === providerId || (p.id === undefined && p.provider_type === providerType));
    if (providerToUpdate) {
      updateIdentityProvider(providerToUpdate.id!, {
        config: {
          ...providerToUpdate.config,
          [field]: value
        }
      });
    }
  };

  const handleProviderActiveToggle = (
    providerId: string | undefined,
    isActive: boolean,
    providerType: IdentityProvider['provider_type']
  ) => {
    const providerToUpdate = identityProviders.find(p => p.id === providerId || (p.id === undefined && p.provider_type === providerType));
    if (providerToUpdate) {
      updateIdentityProvider(providerToUpdate.id!, { is_active: isActive });
    }
  };

  const handleRemoveProviderClick = (provider: IdentityProvider) => {
    setProviderToRemove(provider);
    setShowConfirmRemoveModal(true);
  };

  const confirmRemoveProvider = async () => {
    if (!providerToRemove || !user?.tenant_id) {
      setParentErrorMessage('Provider to remove or tenant ID is missing.');
      return;
    }

    setIsSavingProviders(true);
    try {
      await deleteIdentityProvider(providerToRemove.id!);
      setParentSuccessMessage('Identity provider removed successfully.');
      // Re-fetch providers to update the list
      await fetchIdentityProviders(user.tenant_id);
    } catch (err: any) {
      setParentErrorMessage(err.message || 'Failed to remove identity provider.');
    } finally {
      setIsSavingProviders(false);
      setShowConfirmRemoveModal(false);
      setProviderToRemove(null);
    }
  };

  const handleAddProvider = async (type: IdentityProvider['provider_type']) => {
    if (!user?.tenant_id) {
      setParentErrorMessage('Tenant ID is missing. Cannot add provider.');
      return;
    }

    // Initialize with default config based on type to prevent "missing field" errors
    let defaultConfig = {};
    if (type === 'azure_ad') {
      defaultConfig = { 
        tenantId: 'YOUR_AZURE_TENANT_ID', 
        clientId: 'YOUR_AZURE_CLIENT_ID', 
        jwksUri: 'https://login.microsoftonline.com/common/discovery/v2.0/keys', 
        issuer: 'https://sts.windows.net/{tenantId}/', 
        audience: 'api://your-app-id' 
      };
    } else if (type === 'aws_cognito') {
      defaultConfig = { 
        region: 'us-east-1', 
        userPoolId: 'YOUR_USER_POOL_ID', 
        clientId: 'YOUR_CLIENT_ID' 
      };
    } else if (type === 'okta') {
      defaultConfig = { 
        clientId: 'YOUR_OKTA_CLIENT_ID', 
        issuer: 'https://your-domain.okta.com/oauth2/default', 
        jwksUri: 'https://your-domain.okta.com/oauth2/default/v1/keys', 
        audience: 'api://default',
        domain: 'your-domain.okta.com'
      };
    } else if (type === 'auth0') {
      defaultConfig = { 
        clientId: 'YOUR_AUTH0_CLIENT_ID', 
        domain: 'your-tenant.auth0.com', 
        audience: 'https://api.example.com', 
        jwksUri: 'https://your-tenant.auth0.com/.well-known/jwks.json' 
      };
    } else {
      defaultConfig = {}; // Fallback for 'traditional' or other types
    }
    setIsSavingProviders(true);
    try {
      await createIdentityProvider({
        tenant_id: user.tenant_id,
        provider_type: type,
        config: defaultConfig,
        is_active: false // Default to inactive
      });
      setParentSuccessMessage('Identity provider added successfully. Remember to configure and enable it.');
    } catch (err: any) {
      setParentErrorMessage(err.message || 'Failed to add identity provider.');
    } finally {
      setIsSavingProviders(false);
    }
  };

  const handleSaveAllSettings = async () => {
    setParentErrorMessage(null);
    setParentSuccessMessage(null);
    setIsSavingProviders(true);

    try {
      if (!user?.tenant_id) {
        throw new Error('User tenant ID not available');
      }

      // Only save the authentication strategy via the main tenant update
      await updateTenant(user.tenant_id, { auth_strategy: localAuthStrategy });

      // Identity providers are updated individually via useIdentityProvider hook
      // No need to send the whole array here, as changes are already pushed by updateIdentityProvider calls

      setParentSuccessMessage('Authentication settings updated successfully');
    } catch (err: any) {
      setParentErrorMessage(err.message || 'Failed to update authentication settings');
    } finally {
      setIsSavingProviders(false);
    }
  };

  const azureAdProvider = identityProviders.find(p => p.provider_type === 'azure_ad');
  const awsCognitoProvider = identityProviders.find(p => p.provider_type === 'aws_cognito');

  return (
    <div className="space-y-6">
      {parentSuccessMessage && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg flex items-center justify-between">
          <div className="flex items-center">
            <CheckCircle className="w-5 h-5 mr-2" />
            <p className="font-medium">{parentSuccessMessage}</p>
          </div>
          <button
            onClick={() => setParentSuccessMessage(null)}
            className="text-green-700 hover:text-green-900"
          >
            <XCircle className="w-5 h-5" />
          </button>
        </div>
      )}

      {(parentError || ipError) && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center justify-between">
          <div className="flex items-center">
            <AlertTriangle className="w-5 h-5 mr-2" />
            <p className="font-medium">{parentError || ipError}</p>
          </div>
          <button
            onClick={() => setParentErrorMessage(null)}
            className="text-red-700 hover:text-red-900"
          >
            <XCircle className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Authentication Strategy */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium text-gray-900 flex items-center">
          <Shield className="w-5 h-5 mr-2 text-purple-600" />
          Authentication Strategy
        </h3>

        <div className="space-y-4">
          <div className="flex items-center space-x-4">
            <input
              type="radio"
              id="auth-traditional"
              name="authStrategy"
              value="traditional"
              checked={localAuthStrategy === 'traditional'}
              onChange={handleAuthStrategyChange}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
            />
            <label htmlFor="auth-traditional" className="text-sm font-medium text-gray-900">
              Traditional (Username/Password)
            </label>
          </div>

          <div className="flex items-center space-x-4">
            <input
              type="radio"
              id="auth-azure-ad"
              name="authStrategy"
              value="azure_ad"
              checked={localAuthStrategy === 'azure_ad'}
              onChange={handleAuthStrategyChange}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
            />
            <label htmlFor="auth-azure-ad" className="text-sm font-medium text-gray-900">
              Azure AD
            </label>
          </div>

          <div className="flex items-center space-x-4">
            <input
              type="radio"
              id="auth-okta"
              name="authStrategy"
              value="okta"
              checked={localAuthStrategy === 'okta'}
              onChange={handleAuthStrategyChange}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
            />
            <label htmlFor="auth-okta" className="text-sm font-medium text-gray-900">
              Okta
            </label>
          </div>

          <div className="flex items-center space-x-4">
            <input
              type="radio"
              id="auth-auth0"
              name="authStrategy"
              value="auth0"
              checked={localAuthStrategy === 'auth0'}
              onChange={handleAuthStrategyChange}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
            />
            <label htmlFor="auth-auth0" className="text-sm font-medium text-gray-900">
              Auth0
            </label>
          </div>

          <div className="flex items-center space-x-4">
            <input
              type="radio"
              id="auth-hybrid"
              name="authStrategy"
              value="hybrid"
              checked={localAuthStrategy === 'hybrid'}
              onChange={handleAuthStrategyChange}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
            />
            <label htmlFor="auth-hybrid" className="text-sm font-medium text-gray-900">
              Hybrid (Both Methods)
            </label>
          </div>
        </div>
      </div>

      {/* Azure AD Configuration */}
      {(localAuthStrategy === 'azure_ad' || localAuthStrategy === 'hybrid') && (
        <div className="space-y-4 bg-blue-50 p-6 rounded-lg">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-900 flex items-center">
              <Microsoft className="w-5 h-5 mr-2 text-blue-600" />
              Azure AD Configuration
            </h3> 
            {azureAdProvider ? (
              <button
                type="button"
                onClick={() => handleRemoveProvider(azureAdProvider.id!)}
                className="text-red-600 hover:text-red-800 flex items-center text-sm"
              >
                <Trash2 className="w-4 h-4 mr-1" /> Remove
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleAddProvider('azure_ad')}
                className="text-blue-600 hover:text-blue-800 flex items-center text-sm"
              > 
                <Plus className="w-4 h-4 mr-1" /> Add
              </button>
            )}
          </div>

          {azureAdProvider && (
            <>
              <div className="flex items-center mb-4">
                <input
                  type="checkbox"
                  id="azureAdEnabled"
                  name="is_active"
                  checked={azureAdProvider.is_active}
                  onChange={(e) => handleProviderActiveToggle(azureAdProvider.id, e.target.checked, 'azure_ad')}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="azureAdEnabled" className="ml-2 block text-sm text-gray-900">
                  Enable Azure AD Integration
                </label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Azure Tenant ID
                  </label>
                  <input
                    type="text"
                    value={azureAdProvider.config.tenantId || ''}
                    onChange={(e) => handleProviderConfigChange(azureAdProvider.id, 'tenantId', e.target.value, 'azure_ad')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Azure Client ID
                  </label>
                  <input
                    type="text"
                    value={azureAdProvider.config.clientId || ''}
                    onChange={(e) => handleProviderConfigChange(azureAdProvider.id, 'clientId', e.target.value, 'azure_ad')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    JWKS URI
                  </label>
                  <input
                    type="text"
                    value={azureAdProvider.config.jwksUri || ''}
                    onChange={(e) => handleProviderConfigChange(azureAdProvider.id, 'jwksUri', e.target.value, 'azure_ad')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="https://login.microsoftonline.com/common/discovery/v2.0/keys"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Issuer
                  </label>
                  <input
                    type="text"
                    value={azureAdProvider.config.issuer || ''}
                    onChange={(e) => handleProviderConfigChange(azureAdProvider.id, 'issuer', e.target.value, 'azure_ad')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="https://sts.windows.net/{tenantId}/"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Audience
                  </label>
                  <input
                    type="text"
                    value={azureAdProvider.config.audience || ''}
                    onChange={(e) => handleProviderConfigChange(azureAdProvider.id, 'audience', e.target.value, 'azure_ad')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="api://your-app-id"
                  />
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* AWS Cognito Configuration (Example, assuming it's also an identity provider) */}
      {(localAuthStrategy === 'aws_cognito' || localAuthStrategy === 'hybrid') && (
        <div className="space-y-4 bg-yellow-50 p-6 rounded-lg">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-900 flex items-center">
              <Cloud className="w-5 h-5 mr-2 text-orange-600" />
              AWS Cognito Configuration
            </h3> 
            {awsCognitoProvider ? (
              <button
                type="button"
                onClick={() => handleRemoveProvider(awsCognitoProvider.id!)}
                className="text-red-600 hover:text-red-800 flex items-center text-sm"
              >
                <Trash2 className="w-4 h-4 mr-1" /> Remove
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleAddProvider('aws_cognito')}
                className="text-orange-600 hover:text-orange-800 flex items-center text-sm"
              > 
                <Plus className="w-4 h-4 mr-1" /> Add
              </button>
            )}
          </div>

          {awsCognitoProvider && (
            <>
              <div className="flex items-center mb-4">
                <input
                  type="checkbox"
                  id="awsCognitoEnabled"
                  name="is_active"
                  checked={awsCognitoProvider.is_active}
                  onChange={(e) => handleProviderActiveToggle(awsCognitoProvider.id, e.target.checked, 'aws_cognito')}
                  className="h-4 w-4 text-orange-600 focus:ring-orange-500 border-gray-300 rounded"
                />
                <label htmlFor="awsCognitoEnabled" className="ml-2 block text-sm text-gray-900">
                  Enable AWS Cognito Integration
                </label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    AWS Region
                  </label>
                  <input
                    type="text"
                    value={awsCognitoProvider.config.region || ''}
                    onChange={(e) => handleProviderConfigChange(awsCognitoProvider.id, 'region', e.target.value, 'aws_cognito')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    placeholder="us-east-1"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    User Pool ID
                  </label>
                  <input
                    type="text"
                    value={awsCognitoProvider.config.userPoolId || ''}
                    onChange={(e) => handleProviderConfigChange(awsCognitoProvider.id, 'userPoolId', e.target.value, 'aws_cognito')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    placeholder="us-east-1_xxxxxxxxx"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Client ID
                  </label>
                  <input
                    type="text"
                    value={awsCognitoProvider.config.clientId || ''}
                    onChange={(e) => handleProviderConfigChange(awsCognitoProvider.id, 'clientId', e.target.value, 'aws_cognito')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    placeholder="xxxxxxxxxxxxxxxxx"
                  />
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Okta Configuration */}
      {(localAuthStrategy === 'okta' || localAuthStrategy === 'hybrid') && (
        <div className="space-y-4 bg-orange-50 p-6 rounded-lg">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-900 flex items-center">
              <Globe className="w-5 h-5 mr-2 text-orange-600" />
              Okta Configuration
            </h3> 
            {identityProviders.find(p => p.provider_type === 'okta') ? (
              <button
                type="button" 
                onClick={() => handleRemoveProviderClick(identityProviders.find(p => p.provider_type === 'okta')!)}
                className="text-red-600 hover:text-red-800 flex items-center text-sm"
              >
                <Trash2 className="w-4 h-4 mr-1" /> Remove
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleAddProvider('okta')}
                className="text-orange-600 hover:text-orange-800 flex items-center text-sm"
              > 
                <Plus className="w-4 h-4 mr-1" /> Add
              </button>
            )}
          </div>

          {identityProviders.find(p => p.provider_type === 'okta') && (
            <>
              <div className="flex items-center mb-4">
                <input
                  type="checkbox"
                  id="oktaEnabled"
                  name="is_active"
                  checked={identityProviders.find(p => p.provider_type === 'okta')?.is_active || false}
                  onChange={(e) => handleProviderActiveToggle(
                    identityProviders.find(p => p.provider_type === 'okta')?.id,
                    e.target.checked,
                    'okta'
                  )}
                  className="h-4 w-4 text-orange-600 focus:ring-orange-500 border-gray-300 rounded"
                />
                <label htmlFor="oktaEnabled" className="ml-2 block text-sm text-gray-900">
                  Enable Okta Integration
                </label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Okta Client ID
                  </label>
                  <input
                    type="text"
                    value={identityProviders.find(p => p.provider_type === 'okta')?.config?.clientId || ''}
                    onChange={(e) => handleProviderConfigChange(
                      identityProviders.find(p => p.provider_type === 'okta')?.id,
                      'clientId',
                      e.target.value,
                      'okta'
                    )}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    placeholder="0oa1c5ppl9hnb2gf4696"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Okta Issuer URL
                  </label>
                  <input
                    type="text"
                    value={identityProviders.find(p => p.provider_type === 'okta')?.config?.issuer || ''}
                    onChange={(e) => handleProviderConfigChange(
                      identityProviders.find(p => p.provider_type === 'okta')?.id,
                      'issuer',
                      e.target.value,
                      'okta'
                    )}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    placeholder="https://your-domain.okta.com/oauth2/default"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    JWKS URI
                  </label>
                  <input
                    type="text"
                    value={identityProviders.find(p => p.provider_type === 'okta')?.config?.jwksUri || ''}
                    onChange={(e) => handleProviderConfigChange(
                      identityProviders.find(p => p.provider_type === 'okta')?.id,
                      'jwksUri',
                      e.target.value,
                      'okta'
                    )}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    placeholder="https://your-domain.okta.com/oauth2/default/v1/keys"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Audience
                  </label>
                  <input
                    type="text"
                    value={identityProviders.find(p => p.provider_type === 'okta')?.config?.audience || ''}
                    onChange={(e) => handleProviderConfigChange(
                      identityProviders.find(p => p.provider_type === 'okta')?.id,
                      'audience',
                      e.target.value,
                      'okta'
                    )}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    placeholder="api://default"
                  />
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Auth0 Configuration */}
      {(localAuthStrategy === 'auth0' || localAuthStrategy === 'hybrid') && (
        <div className="space-y-4 bg-gray-50 p-6 rounded-lg">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-900 flex items-center">
              <LockIcon className="w-5 h-5 mr-2 text-gray-600" />
              Auth0 Configuration
            </h3> 
            {identityProviders.find(p => p.provider_type === 'auth0') ? (
              <button
                type="button" 
                onClick={() => handleRemoveProviderClick(identityProviders.find(p => p.provider_type === 'auth0')!)}
                className="text-red-600 hover:text-red-800 flex items-center text-sm"
              >
                <Trash2 className="w-4 h-4 mr-1" /> Remove
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleAddProvider('auth0')}
                className="text-gray-600 hover:text-gray-800 flex items-center text-sm"
              > 
                <Plus className="w-4 h-4 mr-1" /> Add
              </button>
            )}
          </div>

          {identityProviders.find(p => p.provider_type === 'auth0') && (
            <>
              <div className="flex items-center mb-4">
                <input
                  type="checkbox"
                  id="auth0Enabled"
                  name="is_active"
                  checked={identityProviders.find(p => p.provider_type === 'auth0')?.is_active || false}
                  onChange={(e) => handleProviderActiveToggle(
                    identityProviders.find(p => p.provider_type === 'auth0')?.id,
                    e.target.checked,
                    'auth0'
                  )}
                  className="h-4 w-4 text-gray-600 focus:ring-gray-500 border-gray-300 rounded"
                />
                <label htmlFor="auth0Enabled" className="ml-2 block text-sm text-gray-900">
                  Enable Auth0 Integration
                </label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Auth0 Client ID
                  </label>
                  <input
                    type="text"
                    value={identityProviders.find(p => p.provider_type === 'auth0')?.config?.clientId || ''}
                    onChange={(e) => handleProviderConfigChange(
                      identityProviders.find(p => p.provider_type === 'auth0')?.id,
                      'clientId',
                      e.target.value,
                      'auth0'
                    )}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-gray-500"
                    placeholder="YOUR_AUTH0_CLIENT_ID"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Auth0 Domain
                  </label>
                  <input
                    type="text"
                    value={identityProviders.find(p => p.provider_type === 'auth0')?.config?.domain || ''}
                    onChange={(e) => handleProviderConfigChange(
                      identityProviders.find(p => p.provider_type === 'auth0')?.id,
                      'domain',
                      e.target.value,
                      'auth0'
                    )}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-gray-500"
                    placeholder="your-tenant.auth0.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    JWKS URI
                  </label>
                  <input
                    type="text"
                    value={identityProviders.find(p => p.provider_type === 'auth0')?.config?.jwksUri || ''}
                    onChange={(e) => handleProviderConfigChange(
                      identityProviders.find(p => p.provider_type === 'auth0')?.id,
                      'jwksUri',
                      e.target.value,
                      'auth0'
                    )}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-gray-500"
                    placeholder="https://your-tenant.auth0.com/.well-known/jwks.json"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Audience
                  </label>
                  <input
                    type="text"
                    value={identityProviders.find(p => p.provider_type === 'auth0')?.config?.audience || ''}
                    onChange={(e) => handleProviderConfigChange(
                      identityProviders.find(p => p.provider_type === 'auth0')?.id,
                      'audience',
                      e.target.value,
                      'auth0'
                    )}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-gray-500"
                    placeholder="https://api.example.com"
                  />
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Security Notes */}
      <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
        <div className="flex items-center space-x-2 mb-2">
          <Lock className="w-5 h-5 text-gray-600" />
          <h3 className="text-md font-medium text-gray-900">Security Notes</h3>
        </div>
        <ul className="space-y-2 text-sm text-gray-600">
          <li className="flex items-start">
            <span className="text-blue-500 mr-2">•</span>
            <span>
              <strong>Traditional Authentication:</strong> Uses username/password stored in the application database.
            </span>
          </li>
          <li className="flex items-start">
            <span className="text-blue-500 mr-2">•</span>
            <span>
              <strong>Azure AD Authentication:</strong> Delegates authentication to Microsoft Azure Active Directory.
            </span>
          </li>
          <li className="flex items-start">
            <span className="text-blue-500 mr-2">•</span>
            <span>
              <strong>Okta Authentication:</strong> Delegates authentication to Okta Identity Cloud.
            </span>
          </li>
          <li className="flex items-start">
            <span className="text-blue-500 mr-2">•</span>
            <span>
              <strong>Auth0 Authentication:</strong> Delegates authentication to Auth0 Identity Platform.
            </span>
          </li>
          <li className="flex items-start">
            <span className="text-blue-500 mr-2">•</span>
            <span>
              <strong>Hybrid Mode:</strong> Allows both authentication methods, giving users a choice at login.
            </span>
          </li>
          <li className="flex items-start">
            <span className="text-blue-500 mr-2">•</span>
            <span>
              <strong>AWS Integration:</strong> Enables federated access to AWS resources using Azure AD identities.
            </span>
          </li>
          <li className="flex items-start">
            <span className="text-blue-500 mr-2">•</span>
            <span>
              <strong>JWKS URI:</strong> The JSON Web Key Set URI used to validate tokens.
            </span>
          </li>
          <li className="flex items-start">
            <span className="text-blue-500 mr-2">•</span>
            <span>
              <strong>Issuer:</strong> The entity that issued the token, typically your Azure AD tenant.
            </span>
          </li>
        </ul>
      </div>

      {/* Actions */}
      <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
        <LoadingButton
          loading={parentLoading || ipLoading || isSavingProviders}
          variant="primary"
          size="md"
          onClick={handleSaveAllSettings}
        >
          <Save className="w-4 h-4 mr-2" />
          Save Settings
        </LoadingButton>
      </div>

      <ConfirmationModal
        isOpen={showConfirmRemoveModal}
        title="Confirm Removal"
        message={`Are you sure you want to remove the identity provider "${providerToRemove?.provider_type}"? This action cannot be undone.`}
        confirmText="Remove"
        onConfirm={confirmRemoveProvider}
        onCancel={() => setShowConfirmRemoveModal(false)}
        type="danger"
      />
    </div>
  );
};

export default TenantAuthSettings;