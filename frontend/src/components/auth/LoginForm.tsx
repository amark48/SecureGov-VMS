import React, { useState, useEffect } from 'react';
import { Shield, Eye, EyeOff, AlertCircle, UserPlus, LogIn, Building, Info, Microscope as Microsoft, Globe, Lock as LockIcon } from 'lucide-react';
import { useAuth0 } from '@auth0/auth0-react';
import { useAuth } from '../../hooks/useAuth';
import { LoadingButton } from '../common/Loading';
import { APP_NAME, USER_ROLES, SECURITY_CLEARANCES } from '../../utils/constants';

export const LoginForm: React.FC = () => {
  const { loginWithRedirect, isAuthenticated, getIdTokenClaims } = useAuth0();
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [isNewTenant, setIsNewTenant] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    full_name: '',
    role: 'reception',
    department: '',
    phone: '',
    employee_number: '',
    security_clearance: 'unclassified',
    mfaCode: '',
    tenant_id: '', // For existing tenant
    tenant_name: '' // For new tenant
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showMFA, setShowMFA] = useState(false);
  const [validationErrors, setValidationErrors] = useState<{[key: string]: string}>({});
  const [tempUserData, setTempUserData] = useState<any>(null); // Stores partial user data if MFA is required
  const [loginStep, setLoginStep] = useState<'identifier_input' | 'auth_options'>('identifier_input'); // State for multi-step login

  const {
    signIn,
    externalSignIn,
    signUp,
    loading,
    error,
    clearError,
    setAuthError,
    sessionExpired,
    clearSessionExpired,
    initiateTenantDiscovery,
    discoveredAuthSettings
  } = useAuth();

  // Clear session expired flag when component mounts or unmounts
  useEffect(() => {
    if (sessionExpired) {
      clearSessionExpired();
    }

    return () => {
      if (sessionExpired) {
        clearSessionExpired();
      }
    };
  }, [sessionExpired, clearSessionExpired]);

  // Check if error contains MFA-related messages to show MFA input
  useEffect(() => {
    if (error && (error.includes('MFA') || error.includes('2FA'))) {
      setShowMFA(true);
    }
  }, [error]);

  // Check if user is authenticated with Auth0 and get the token
  useEffect(() => {
    const checkAuth0Authentication = async () => {
      if (isAuthenticated) {
        try {
          const claims = await getIdTokenClaims();
          if (claims && claims.__raw) {
            // We have a valid ID token from Auth0, send it to our backend
            await externalSignIn(claims.__raw, 'auth0');
          }
        } catch (err) {
          console.error('Error getting Auth0 ID token:', err);
          setAuthError('Failed to authenticate with Auth0. Please try again.');
        }
      }
    };

    checkAuth0Authentication();
  }, [isAuthenticated, getIdTokenClaims, externalSignIn, setAuthError]);

  // Reset login step if discoveredAuthSettings changes (e.g., after logout)
  useEffect(() => {
    // If discoveredAuthSettings becomes null (e.g., after logout), go back to identifier input
    if (!discoveredAuthSettings && loginStep === 'auth_options') {
      setLoginStep('identifier_input');
    }
  }, [discoveredAuthSettings, loginStep]);

  // Password validation function
  const validatePassword = (password: string): boolean => {
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^a-zA-Z0-9])[a-zA-Z0-9\W_]{8,}$/;
    return passwordRegex.test(password);
  };

  // Validate form before submission (for registration mode)
  const validateForm = (): boolean => {
    const errors: {[key: string]: string} = {};

    // Email validation
    if (!formData.email.trim()) {
      errors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      errors.email = 'Email is invalid';
    }

    // Password validation
    if (!formData.password) {
      errors.password = 'Password is required';
    } else if (!validatePassword(formData.password)) {
      errors.password = 'Password must be at least 8 characters with uppercase, lowercase, number, and special character';
    }

    if (isRegisterMode) {
      // Confirm password validation
      if (formData.password !== formData.confirmPassword) {
        errors.confirmPassword = 'Passwords do not match';
      }

      // Full name validation
      if (!formData.full_name.trim()) {
        errors.full_name = 'Full name is required';
      }

      // Tenant validation
      if (isNewTenant && !formData.tenant_name.trim()) {
        errors.tenant_name = 'Company name is required';
      } else if (!isNewTenant && !formData.tenant_id.trim()) {
        errors.tenant_id = 'Company ID is required';
      }
    }

    // MFA code validation if MFA is shown
    if (showMFA && !formData.mfaCode.trim()) {
      errors.mfaCode = 'MFA code is required';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleIdentifierSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    setValidationErrors({});

    if (!formData.email.trim()) {
      setValidationErrors({ email: 'Email or Tenant ID is required' });
      return;
    }

    try {
      // initiateTenantDiscovery now handles its own errors and returns a fallback
      // So, we just proceed to the next step after calling it.
      await initiateTenantDiscovery(formData.email);
      setLoginStep('auth_options');
    } catch (err: any) {
      // This catch block might only be hit for unexpected errors not handled by initiateTenantDiscovery's fallback
      console.error("Unexpected discovery error:", err);
      setAuthError(err.message || 'An unexpected error occurred during discovery.');
      // Even if there's an error, we can still proceed with traditional auth
      setLoginStep('auth_options');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    setValidationErrors({});

    // Validate common fields for login/registration
    if (!formData.email.trim()) {
      setValidationErrors(prev => ({ ...prev, email: 'Email is required' }));
      return;
    }
    if (!formData.password) {
      setValidationErrors(prev => ({ ...prev, password: 'Password is required' }));
      return;
    }
    if (!validatePassword(formData.password)) {
      setValidationErrors(prev => ({ ...prev, password: 'Password must be at least 8 characters with uppercase, lowercase, number, and special character' }));
      return;
    }

    if (isRegisterMode && !validateForm()) { // Full validation for registration
      return;
    }

    try {
      if (isRegisterMode) {
        // Registration flow
        const registerData = {
          email: formData.email,
          password: formData.password,
          full_name: formData.full_name,
          role: isNewTenant ? 'admin' : (formData.role as any),
          department: formData.department || undefined,
          phone: formData.phone || undefined,
          employee_number: formData.employee_number || undefined,
          security_clearance: formData.security_clearance || undefined,
          tenant_id: isNewTenant ? undefined : (formData.tenant_id || undefined),
          tenant_name: isNewTenant ? formData.tenant_name : undefined,
        };
        await signUp(registerData);
      } else {
        // Login flow
        if (showMFA) {
          // MFA verification step
          if (!formData.mfaCode.trim()) {
            setValidationErrors(prev => ({ ...prev, mfaCode: 'MFA code is required' }));
            return;
          }
          await signIn({
            email: formData.email,
            password: formData.password,
            mfaCode: formData.mfaCode,
          });
        } else {
          // Initial login attempt
          const response = await signIn({
            email: formData.email,
            password: formData.password
          });

          // Check if MFA is required from the response
          if (response && 'mfa_required' in response && response.mfa_required) {
            setShowMFA(true);
            setTempUserData(response.user); // Store user data temporarily for MFA step
          }
        }
      }
    } catch (err: any) {
      // This catch block handles errors thrown by signIn/signUp
      if (err.message?.includes('MFA') || err.message?.includes('2FA')) {
        setShowMFA(true);
        // Do not clear error here, let the error state from useAuth propagate
      } else if (err.details && Array.isArray(err.details)) {
        // Handle validation errors from backend
        const fieldErrors: {[key: string]: string} = {};
        err.details.forEach((detail: any) => {
          fieldErrors[detail.field] = detail.message;
        });
        setValidationErrors(fieldErrors);
      }
      // The error state from useAuth will already be set by signIn/signUp
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));

    // Clear validation error when field is changed
    if (validationErrors[name]) {
      setValidationErrors(prev => {
        const updated = { ...prev };
        delete updated[name];
        return updated;
      });
    }
  };

  const toggleMode = () => {
    setIsRegisterMode(!isRegisterMode);
    setShowMFA(false);
    setIsNewTenant(false);
    clearError();
    setValidationErrors({});
    setTempUserData(null);
    setLoginStep('identifier_input'); // Always go back to identifier input when toggling mode
    setFormData(prev => ({
      ...prev,
      password: '',
      confirmPassword: '',
      full_name: '',
      role: 'reception',
      department: '',
      phone: '',
      employee_number: '',
      security_clearance: 'unclassified',
      mfaCode: '',
      tenant_id: '',
      tenant_name: ''
    }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="flex justify-center">
            <div className="flex items-center justify-center w-16 h-16 bg-blue-600 rounded-xl shadow-lg">
              <Shield className="w-8 h-8 text-white" />
            </div>
          </div>
          <h2 className="mt-6 text-3xl font-bold text-gray-900">{APP_NAME}</h2>
          <p className="mt-2 text-sm text-gray-600">
            Enterprise Visitor Management System
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {isRegisterMode ? 'Create New Account' : 'Secure Authentication Portal'}
          </p>
        </div>

        <div className="bg-white py-8 px-6 shadow-xl rounded-xl border border-gray-100">
          {/* Session Expired Message */}
          {sessionExpired && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4 flex items-start space-x-3 mb-4">
              <AlertCircle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-medium text-yellow-800">
                  Session Expired
                </h3>
                <p className="text-sm text-yellow-700 mt-1">
                  Your session has expired. Please sign in again to continue.
                </p>
              </div>
            </div>
          )}

          {error && !sessionExpired && (
            <div className="bg-red-50 border border-red-200 rounded-md p-4 flex items-start space-x-3 mb-4">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-medium text-red-800">
                  {isRegisterMode ? 'Registration Error' : 'Authentication Error'}
                </h3>
                <p className="text-sm text-red-700 mt-1">{error}</p>
              </div>
            </div>
          )}

          {/* Step 1: Identifier Input */}
          {loginStep === 'identifier_input' && (
            <form className="space-y-6" onSubmit={handleIdentifierSubmit}>
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address or Company ID
                </label>
                <input
                  id="email"
                  name="email"
                  type="text"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  className={`w-full px-3 py-2 border ${validationErrors.email ? 'border-red-300 ring-1 ring-red-500' : 'border-gray-300'} rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors`}
                  placeholder="Enter your email address or company ID"
                  autoComplete="email"
                  disabled={loading}
                />
                {validationErrors.email && (
                  <p className="mt-1 text-sm text-red-600">{validationErrors.email}</p>
                )}
              </div>
              <div>
                <LoadingButton
                  loading={loading}
                  variant="primary"
                  size="lg"
                  type="submit"
                >
                  <div className="w-full flex items-center justify-center">
                    Continue
                  </div>
                </LoadingButton>
              </div>
            </form>
          )}

          {/* Step 2: Authentication Options */}
          {loginStep === 'auth_options' && (
            <form className="space-y-6" onSubmit={handleSubmit}>
              <p className="text-center text-sm text-gray-600">
                Signing in as <span className="font-medium">{formData.email}</span>
              </p>

              {discoveredAuthSettings && (
                <div className="bg-blue-50 p-3 rounded-md mb-4 text-xs text-blue-800">
                  <p>Authentication Strategy: <span className="font-semibold capitalize">{discoveredAuthSettings.auth_strategy.replace('_', ' ')}</span></p>
                  {discoveredAuthSettings.azure_ad_enabled && <p>Azure AD Enabled: Yes</p>}
                </div>
              )}

              {isRegisterMode ? (
                <>
                  <div>
                    <label htmlFor="full_name" className="block text-sm font-medium text-gray-700 mb-2">
                      Full Name *
                    </label>
                    <input
                      id="full_name"
                      name="full_name"
                      type="text"
                      required
                      value={formData.full_name}
                      onChange={handleChange}
                      className={`w-full px-3 py-2 border ${validationErrors.full_name ? 'border-red-300 ring-1 ring-red-500' : 'border-gray-300'} rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors`}
                      placeholder="Enter your full name"
                      autoComplete="name"
                    />
                    {validationErrors.full_name && (
                      <p className="mt-1 text-sm text-red-600">{validationErrors.full_name}</p>
                    )}
                  </div>

                  {/* Tenant Selection */}
                  <div className="space-y-4">
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center">
                        <input
                          id="existing-tenant"
                          name="tenant-type"
                          type="radio"
                          checked={!isNewTenant}
                          onChange={() => setIsNewTenant(false)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <label htmlFor="existing-tenant" className="ml-2 block text-sm text-gray-900">
                          Join Existing Company
                        </label>
                      </div>
                      <div className="flex items-center">
                        <input
                          id="new-tenant"
                          name="tenant-type"
                          type="radio"
                          checked={isNewTenant}
                          onChange={() => setIsNewTenant(true)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <label htmlFor="new-tenant" className="ml-2 block text-sm text-gray-900">
                          Create New Company
                        </label>
                      </div>
                    </div>

                    {isNewTenant ? (
                      <div>
                        <label htmlFor="tenant_name" className="block text-sm font-medium text-gray-700 mb-2">
                          Company Name *
                        </label>
                        <div className="relative">
                          <Building className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                          <input
                            id="tenant_name"
                            name="tenant_name"
                            type="text"
                            required
                            value={formData.tenant_name}
                            onChange={handleChange}
                            className={`w-full pl-10 pr-4 py-2 border ${validationErrors.tenant_name ? 'border-red-300 ring-1 ring-red-500' : 'border-gray-300'} rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors`}
                            placeholder="Enter your company name"
                            autoComplete="organization"
                          />
                        </div>
                        {validationErrors.tenant_name ? (
                          <p className="mt-1 text-sm text-red-600">{validationErrors.tenant_name}</p>
                        ) : (
                          <div className="flex items-center mt-2 text-xs text-gray-500">
                            <Info className="w-3 h-3 mr-1 text-blue-500" />
                            <p>
                              Your email domain <strong>({formData.email.split('@')[1] || 'example.com'})</strong> will be used as the corporate domain for all users in this company.
                            </p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div>
                        <label htmlFor="tenant_id" className="block text-sm font-medium text-gray-700 mb-2">
                          Company ID *
                        </label>
                        <input
                          id="tenant_id"
                          name="tenant_id"
                          type="text"
                          required
                          value={formData.tenant_id}
                          onChange={handleChange}
                          className={`w-full px-3 py-2 border ${validationErrors.tenant_id ? 'border-red-300 ring-1 ring-red-500' : 'border-gray-300'} rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors`}
                          autoComplete="off"
                        />
                        {validationErrors.tenant_id && (
                          <p className="mt-1 text-sm text-red-600">{validationErrors.tenant_id}</p>
                        )}
                      </div>
                    )}
                  </div>

                  {!isNewTenant && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-2">
                          Role *
                        </label>
                        <select
                          id="role"
                          name="role"
                          required
                          value={formData.role}
                          onChange={handleChange}
                          className={`w-full px-3 py-2 border ${validationErrors.role ? 'border-red-300 ring-1 ring-red-500' : 'border-gray-300'} rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors`}
                          autoComplete="off"
                        >
                          <option value="reception">Reception</option>
                          <option value="host">Host</option>
                          <option value="security">Security</option>
                          <option value="approver">Approver</option>
                        </select>
                        {validationErrors.role && (
                          <p className="mt-1 text-sm text-red-600">{validationErrors.role}</p>
                        )}
                      </div>

                      <div>
                        <label htmlFor="department" className="block text-sm font-medium text-gray-700 mb-2">
                          Department
                        </label>
                        <input
                          id="department"
                          name="department"
                          type="text"
                          value={formData.department}
                          onChange={handleChange}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                          autoComplete="organization-title"
                        />
                      </div>
                    </div>
                  )}

                  {isNewTenant && (
                    <div className="bg-blue-50 border border-blue-200 rounded-md p-4 flex items-start space-x-3">
                      <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm text-blue-700">
                          As the company creator, your role will be set to <strong>Administrator</strong>.
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
                        Phone Number
                      </label>
                      <input
                        id="phone"
                        name="phone"
                        type="tel"
                        value={formData.phone}
                        onChange={handleChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                        placeholder="+1 (555) 123-4567"
                        autoComplete="tel"
                      />
                    </div>

                    <div>
                      <label htmlFor="security_clearance" className="block text-sm font-medium text-gray-700 mb-2">
                        Security Clearance
                      </label>
                      <select
                        id="security_clearance"
                        name="security_clearance"
                        value={formData.security_clearance}
                        onChange={handleChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                        autoComplete="off"
                      >
                        {SECURITY_CLEARANCES.map(clearance => (
                          <option key={clearance} value={clearance}>
                            {clearance.split('_')
                                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                                .join(' ')}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </>
              ) : null /* End of isRegisterMode block */ }

              {/* Password Field */}
              {discoveredAuthSettings && (discoveredAuthSettings.auth_strategy === 'traditional' || discoveredAuthSettings.auth_strategy === 'hybrid') ? (
                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={formData.password}
                      onChange={handleChange}
                      className={`w-full px-3 py-2 pr-10 border ${validationErrors.password ? 'border-red-300 ring-1 ring-red-500' : 'border-gray-300'} rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors`}
                      placeholder="Enter your password"
                      autoComplete={isRegisterMode ? 'new-password' : 'current-password'}
                      disabled={loading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {validationErrors.password ? (
                    <p className="mt-1 text-sm text-red-600">{validationErrors.password}</p>
                  ) : (
                    isRegisterMode && (
                      <p className="text-xs text-gray-500 mt-1">
                        Must be at least 8 characters with uppercase, lowercase, number, and special character
                      </p>
                    )
                  )}
                </div>
              ) : null}

              {/* Confirm Password Field (Registration only) */}
              {isRegisterMode && (
                <div>
                  <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <input
                      id="confirmPassword"
                      name="confirmPassword"
                      type={showConfirmPassword ? 'text' : 'password'}
                      required
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      className={`w-full px-3 py-2 pr-10 border ${validationErrors.confirmPassword ? 'border-red-300 ring-1 ring-red-500' : 'border-gray-300'} rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors`}
                      placeholder="Confirm your password"
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {validationErrors.confirmPassword && (
                    <p className="mt-1 text-sm text-red-600">{validationErrors.confirmPassword}</p>
                  )}
                </div>
              )}

              {/* MFA Code Field (Login only, when required for traditional auth) */}
              {!isRegisterMode && showMFA && (
                <div>
                  <label htmlFor="mfaCode" className="block text-sm font-medium text-gray-700 mb-2">
                    Multi-Factor Authentication Code
                  </label>
                  <input
                    id="mfaCode"
                    name="mfaCode"
                    type="text"
                    value={formData.mfaCode}
                    onChange={handleChange}
                    className={`w-full px-3 py-2 border ${validationErrors.mfaCode ? 'border-red-300 ring-1 ring-red-500' : 'border-gray-300'} rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors`}
                    placeholder="Enter 6-digit code"
                    maxLength={6}
                    autoComplete="one-time-code"
                    autoFocus
                  />
                  {validationErrors.mfaCode && (
                    <p className="mt-1 text-sm text-red-600">{validationErrors.mfaCode}</p>
                  )}
                  <p className="text-xs text-gray-500 mt-1">
                    Enter the 6-digit code from your authenticator app
                  </p>
                </div>
              )}

              {/* Authentication Buttons */}
              {!isRegisterMode && (
                <div className="space-y-4">
                  {/* Traditional login button */}
                  {discoveredAuthSettings && (discoveredAuthSettings.auth_strategy === 'traditional' || discoveredAuthSettings.auth_strategy === 'hybrid') && (
                    <div>
                      <LoadingButton
                        loading={loading}
                        variant="primary"
                        size="lg"
                        type="submit"
                      >
                        <div className="w-full flex items-center justify-center">
                          <LogIn className="w-4 h-4 mr-2" />
                          {showMFA ? 'Verify Code' : 'Sign In Securely'}
                        </div>
                      </LoadingButton>
                    </div>
                  )}

                  {/* Azure AD login button */}
                  {discoveredAuthSettings && (discoveredAuthSettings.auth_strategy === 'azure_ad' || discoveredAuthSettings.auth_strategy === 'hybrid') && discoveredAuthSettings.azure_ad_enabled && (
                    <div>
                      <LoadingButton
                        loading={loading}
                        variant="secondary"
                        size="lg"
                        onClick={() => signIn({ useAzureAd: true })} // Trigger Azure AD flow
                        type="button" // Important: prevent form submission
                      >
                        <div className="w-full flex items-center justify-center">
                          <Microsoft className="w-4 h-4 mr-2" />
                          Sign in with Microsoft
                        </div>
                      </LoadingButton>
                    </div>
                  )}
                  
                  {/* Okta login button */}
                  {discoveredAuthSettings && (discoveredAuthSettings.auth_strategy === 'okta' || discoveredAuthSettings.auth_strategy === 'hybrid') && discoveredAuthSettings.okta_enabled && (
                    <div>
                      <LoadingButton
                        loading={loading}
                        variant="secondary"
                        size="lg"
                        onClick={() => signIn({ useOkta: true })} // Trigger Okta flow
                        type="button" // Important: prevent form submission
                      >
                        <div className="w-full flex items-center justify-center">
                          <Globe className="w-4 h-4 mr-2" />
                          Sign in with Okta
                        </div>
                      </LoadingButton>
                    </div>
                  )}
                  
                  {/* Auth0 login button */}
                  {discoveredAuthSettings && (discoveredAuthSettings.auth_strategy === 'auth0' || discoveredAuthSettings.auth_strategy === 'hybrid') && discoveredAuthSettings.auth0_enabled && (
                    <div>
                      <LoadingButton
                        loading={loading}
                        variant="secondary"
                        size="lg"
                        onClick={() => loginWithRedirect()} // Use Auth0 SDK to handle the redirect
                        type="button" // Important: prevent form submission
                      >
                        <div className="w-full flex items-center justify-center">
                          <LockIcon className="w-4 h-4 mr-2" />
                          Sign in with Auth0
                        </div>
                      </LoadingButton>
                    </div>
                  )}
                </div>
              )}

              {isRegisterMode && (
                <LoadingButton
                  loading={loading}
                  variant="primary"
                  size="lg"
                  type="submit"
                >
                  <div className="w-full flex items-center justify-center">
                    <UserPlus className="w-4 h-4 mr-2" />
                    {isNewTenant ? 'Create Company Account' : 'Create Account'}
                  </div>
                </LoadingButton>
              )}

              {/* Mode Toggle */}
              <div className="text-center">
                <button
                  type="button"
                  onClick={toggleMode}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors"
                >
                  {isRegisterMode
                    ? 'Already have an account? Sign in here'
                    : 'Need to create an account? Register here'
                  }
                </button>
                {loginStep === 'auth_options' && (
                  <>
                    <span className="mx-2 text-gray-400">|</span>
                    <button
                      type="button"
                      onClick={() => setLoginStep('identifier_input')}
                      className="text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors"
                    >Change Identifier</button>
                  </>
                )}
              </div>

              {/* Security Notice */}
              <div className="text-center">
                <p className="text-xs text-gray-500">
                  This system is for authorized personnel only.
                  <br />
                  All access attempts are logged and monitored.
                </p>
              </div>
            </form>
          )}
        </div>

        {/* Compliance Badges */}
        <div className="text-center">
          <div className="flex items-center justify-center space-x-4 text-xs text-gray-500">
            <span className="flex items-center">
              <Shield className="w-3 h-3 mr-1" />
              FICAM Compliant
            </span>
            <span>•</span>
            <span className="flex items-center">
              <Shield className="w-3 h-3 mr-1" />
              FIPS 140 Certified
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
