import React, { useState, useEffect } from 'react';
import { 
  User, 
  Mail, 
  Phone, 
  Building, 
  Shield, 
  Key, 
  Save, 
  Eye, 
  EyeOff, 
  AlertTriangle, 
  CheckCircle, 
  XCircle,
  Lock,
  Unlock,
  QrCode,
  Calendar
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { LoadingButton } from '../common/Loading';
import { format } from 'date-fns';

export const UserProfile: React.FC = () => {
  const { 
    user, 
    updateProfile, 
    changePassword, 
    enableMFA, 
    disableMFA, 
    initiateMFA,
    verifyMFA,
    loading, 
    error, 
    clearError 
  } = useAuth();
  
  // Profile form state
  const [profileData, setProfileData] = useState({
    full_name: '',
    department: '',
    phone: ''
  });
  
  // Password change form state
  const [passwordData, setPasswordData] = useState({
    current_password: '',
    new_password: '',
    confirm_password: ''
  });
  
  // MFA setup state
  const [showMFASetup, setShowMFASetup] = useState(false);
  const [mfaSecret, setMfaSecret] = useState('');
  const [mfaQrCode, setMfaQrCode] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [mfaLoading, setMfaLoading] = useState(false);
  const [mfaError, setMfaError] = useState<string | null>(null);
  
  // UI state
  const [activeTab, setActiveTab] = useState('profile');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isEditingProfile, setIsEditingProfile] = useState(false);

  // Initialize form with user data
  useEffect(() => {
    if (user) {
      setProfileData({
        full_name: user.full_name || '',
        department: user.department || '',
        phone: user.phone || ''
      });
    }
  }, [user]);

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

  // Listen for navigation events from header
  useEffect(() => {
    const handleNavigateToProfile = () => {
      // This is triggered when the profile button is clicked in the header
      // No need to do anything special here as the component is already mounted
    };

    window.addEventListener('navigate-to-profile', handleNavigateToProfile);
    return () => {
      window.removeEventListener('navigate-to-profile', handleNavigateToProfile);
    };
  }, []);

  const handleProfileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setProfileData(prev => ({ ...prev, [name]: value }));
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setPasswordData(prev => ({ ...prev, [name]: value }));
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    
    try {
      await updateProfile(profileData);
      setSuccessMessage('Profile updated successfully');
      setIsEditingProfile(false);
    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to update profile');
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    
    // Validate passwords match
    if (passwordData.new_password !== passwordData.confirm_password) {
      setErrorMessage('New passwords do not match');
      return;
    }
    
    // Validate password complexity
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!passwordRegex.test(passwordData.new_password)) {
      setErrorMessage('Password must be at least 8 characters and include uppercase, lowercase, number, and special character');
      return;
    }
    
    try {
      await changePassword(passwordData.current_password, passwordData.new_password);
      setSuccessMessage('Password changed successfully');
      setPasswordData({
        current_password: '',
        new_password: '',
        confirm_password: ''
      });
    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to change password');
    }
  };

  const handleInitiateMFA = async () => {
    setMfaLoading(true);
    setMfaError(null);
    
    try {
      const { qrCodeUrl, secret } = await initiateMFA();
      setMfaQrCode(qrCodeUrl);
      setMfaSecret(secret);
      setShowMFASetup(true);
    } catch (error: any) {
      setMfaError(error.message || 'Failed to initiate MFA setup');
    } finally {
      setMfaLoading(false);
    }
  };

  const handleVerifyMFA = async () => {
    if (!verificationCode) {
      setMfaError('Please enter the verification code');
      return;
    }
    
    setMfaLoading(true);
    setMfaError(null);
    
    try {
      await verifyMFA(mfaSecret, verificationCode);
      setSuccessMessage('Multi-Factor Authentication enabled successfully');
      setShowMFASetup(false);
      setVerificationCode('');
      setMfaSecret('');
      setMfaQrCode('');
    } catch (error: any) {
      setMfaError(error.message || 'Failed to verify MFA code');
    } finally {
      setMfaLoading(false);
    }
  };

  const handleToggleMFA = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);
    
    try {
      if (user?.mfa_enabled) {
        await disableMFA();
        setSuccessMessage('Multi-Factor Authentication disabled');
      } else {
        await handleInitiateMFA();
      }
    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to update MFA settings');
    }
  };

  const handleCancelMFASetup = () => {
    setShowMFASetup(false);
    setVerificationCode('');
    setMfaSecret('');
    setMfaQrCode('');
    setMfaError(null);
  };

  if (!user) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
        <div className="text-center">
          <User className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">User Not Found</h2>
          <p className="text-gray-600">
            Please sign in to view your profile.
          </p>
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
            <h1 className="text-2xl font-bold mb-2">My Profile</h1>
            <p className="text-blue-100">
              Manage your account settings and security preferences
            </p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold">{user.full_name}</div>
            <div className="text-blue-200 text-sm capitalize">{user.role}</div>
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
          <button 
            onClick={() => setSuccessMessage(null)}
            className="text-green-700 hover:text-green-900"
          >
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
          <button 
            onClick={() => {
              setErrorMessage(null);
              clearError();
            }}
            className="text-red-700 hover:text-red-900"
          >
            <XCircle className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="border-b border-gray-200 bg-gray-50">
          <nav className="flex space-x-8 px-6">
            <button
              onClick={() => setActiveTab('profile')}
              className={`py-4 px-2 border-b-2 font-medium text-sm flex items-center transition-all duration-200 ${
                activeTab === 'profile'
                  ? 'border-blue-500 text-blue-600 bg-blue-50/50'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <User className="w-4 h-4 mr-2" />
              Profile Information
            </button>
            <button
              onClick={() => setActiveTab('security')}
              className={`py-4 px-2 border-b-2 font-medium text-sm flex items-center transition-all duration-200 ${
                activeTab === 'security'
                  ? 'border-blue-500 text-blue-600 bg-blue-50/50'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Shield className="w-4 h-4 mr-2" />
              Security Settings
            </button>
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'profile' && (
            <div className="space-y-6">
              <form onSubmit={handleUpdateProfile}>
                <div className="space-y-6">
                  {/* Basic Information */}
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Basic Information</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                        {isEditingProfile ? (
                          <input
                            type="text"
                            name="full_name"
                            value={profileData.full_name}
                            onChange={handleProfileChange}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            required
                          />
                        ) : (
                          <p className="text-gray-900">{user.full_name}</p>
                        )}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                        <p className="text-gray-900">{user.email}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                        {isEditingProfile ? (
                          <input
                            type="text"
                            name="department"
                            value={profileData.department}
                            onChange={handleProfileChange}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                        ) : (
                          <p className="text-gray-900">{user.department || 'Not specified'}</p>
                        )}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                        {isEditingProfile ? (
                          <input
                            type="tel"
                            name="phone"
                            value={profileData.phone}
                            onChange={handleProfileChange}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                        ) : (
                          <p className="text-gray-900">{user.phone || 'Not specified'}</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Role and Tenant Information */}
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Role and Organization</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                        <div className="flex items-center">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200 capitalize">
                            {user.role}
                          </span>
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Organization</label>
                        <p className="text-gray-900">{user.tenant_name || 'Default Organization'}</p>
                      </div>
                      {user.employee_number && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Employee Number</label>
                          <p className="text-gray-900">{user.employee_number}</p>
                        </div>
                      )}
                      {user.security_clearance && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Security Clearance</label>
                          <p className="text-gray-900 uppercase">{user.security_clearance.replace('_', ' ')}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
                    {isEditingProfile ? (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setIsEditingProfile(false);
                            // Reset form to original values
                            setProfileData({
                              full_name: user.full_name || '',
                              department: user.department || '',
                              phone: user.phone || ''
                            });
                          }}
                          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                        >
                          Cancel
                        </button>
                        <LoadingButton
                          loading={loading}
                          variant="primary"
                          size="md"
                          type="submit"
                        >
                          <Save className="w-4 h-4 mr-2" />
                          Save Changes
                        </LoadingButton>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setIsEditingProfile(true)}
                        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        Edit Profile
                      </button>
                    )}
                  </div>
                </div>
              </form>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="space-y-6">
              {/* Password Change */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Change Password</h3>
                <form onSubmit={handleChangePassword} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
                    <div className="relative">
                      <input
                        type={showCurrentPassword ? 'text' : 'password'}
                        name="current_password"
                        value={passwordData.current_password}
                        onChange={handlePasswordChange}
                        className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                        className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
                      >
                        {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                    <div className="relative">
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        name="new_password"
                        value={passwordData.new_password}
                        onChange={handlePasswordChange}
                        className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
                      >
                        {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Must be at least 8 characters with uppercase, lowercase, number, and special character
                    </p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
                    <div className="relative">
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        name="confirm_password"
                        value={passwordData.confirm_password}
                        onChange={handlePasswordChange}
                        className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
                      >
                        {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  
                  <div className="flex justify-end">
                    <LoadingButton
                      loading={loading}
                      variant="primary"
                      size="md"
                      type="submit"
                    >
                      <Key className="w-4 h-4 mr-2" />
                      Change Password
                    </LoadingButton>
                  </div>
                </form>
              </div>

              {/* Multi-Factor Authentication */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Multi-Factor Authentication</h3>
                
                {showMFASetup ? (
                  <div className="bg-blue-50 p-6 rounded-lg border border-blue-200">
                    <h4 className="text-md font-medium text-blue-900 mb-4">
                      Set Up Multi-Factor Authentication
                    </h4>
                    
                    <div className="space-y-4">
                      <div className="flex flex-col md:flex-row md:space-x-6">
                        <div className="flex-shrink-0 flex justify-center mb-4 md:mb-0">
                          {mfaQrCode && (
                            <div className="bg-white p-4 rounded-lg border border-gray-200">
                              <img 
                                src={mfaQrCode} 
                                alt="QR Code for MFA setup" 
                                className="w-48 h-48"
                              />
                            </div>
                          )}
                        </div>
                        
                        <div className="flex-1">
                          <div className="space-y-4">
                            <div>
                              <p className="text-sm text-blue-800 mb-2">
                                1. Scan the QR code with your authenticator app (Google Authenticator, Authy, etc.)
                              </p>
                              <p className="text-sm text-blue-800 mb-4">
                                2. Enter the 6-digit code from your authenticator app below
                              </p>
                              
                              {mfaSecret && (
                                <div className="bg-white p-3 rounded-lg border border-gray-200 mb-4">
                                  <p className="text-xs text-gray-500 mb-1">
                                    If you can't scan the QR code, enter this code manually:
                                  </p>
                                  <p className="font-mono text-sm select-all break-all">{mfaSecret}</p>
                                </div>
                              )}
                            </div>
                            
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Verification Code
                              </label>
                              <input
                                type="text"
                                value={verificationCode}
                                onChange={(e) => setVerificationCode(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                placeholder="Enter 6-digit code"
                                maxLength={6}
                              />
                            </div>
                            
                            {mfaError && (
                              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                                <div className="flex items-center">
                                  <AlertTriangle className="w-5 h-5 mr-2" />
                                  <p className="font-medium">{mfaError}</p>
                                </div>
                              </div>
                            )}
                            
                            <div className="flex justify-end space-x-3 pt-4">
                              <button
                                type="button"
                                onClick={handleCancelMFASetup}
                                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                              >
                                Cancel
                              </button>
                              <LoadingButton
                                loading={mfaLoading}
                                variant="primary"
                                size="md"
                                onClick={handleVerifyMFA}
                              >
                                <Shield className="w-4 h-4 mr-2" />
                                Verify and Enable
                              </LoadingButton>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-md font-medium text-gray-900">
                          {user.mfa_enabled ? 'MFA is Enabled' : 'MFA is Disabled'}
                        </h4>
                        <p className="text-sm text-gray-600 mt-1">
                          {user.mfa_enabled 
                            ? 'Your account is protected with multi-factor authentication.' 
                            : 'Enable multi-factor authentication for additional security.'}
                        </p>
                      </div>
                      <div className="flex items-center">
                        <div className="relative inline-block w-12 h-6 mr-2">
                          <input
                            type="checkbox"
                            className="opacity-0 w-0 h-0"
                            checked={user.mfa_enabled}
                            onChange={handleToggleMFA}
                            id="mfa-toggle"
                          />
                          <label
                            htmlFor="mfa-toggle"
                            className={`absolute cursor-pointer top-0 left-0 right-0 bottom-0 rounded-full transition-all duration-300 ${
                              user.mfa_enabled ? 'bg-blue-600' : 'bg-gray-300'
                            }`}
                          >
                            <span
                              className={`absolute left-1 bottom-1 bg-white w-4 h-4 rounded-full transition-all duration-300 ${
                                user.mfa_enabled ? 'transform translate-x-6' : ''
                              }`}
                            ></span>
                          </label>
                        </div>
                        {user.mfa_enabled ? (
                          <Unlock className="w-5 h-5 text-blue-600" />
                        ) : (
                          <Lock className="w-5 h-5 text-gray-400" />
                        )}
                      </div>
                    </div>
                    
                    <div className="mt-4 text-sm text-gray-600">
                      <p>
                        Multi-factor authentication adds an extra layer of security to your account by requiring more than just a password to sign in.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Account Activity */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Account Activity</h3>
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Last Login</span>
                      <span className="text-sm font-medium text-gray-900">
                        {user.last_login ? format(new Date(user.last_login), 'MMM d, yyyy HH:mm') : 'Never'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Account Created</span>
                      <span className="text-sm font-medium text-gray-900">
                        {user.created_at ? format(new Date(user.created_at), 'MMM d, yyyy') : 'Unknown'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};