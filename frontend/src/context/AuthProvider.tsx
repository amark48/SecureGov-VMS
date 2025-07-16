// src/context/AuthProvider.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { AuthContext, AuthContextType } from './AuthContext';
import { authService } from '../services/auth';
import { AuthError, apiClient } from '../services/api';
import type {
  User,
  AuthState,
  LoginCredentials,
  RegisterData,
  Permission
} from '../types/auth';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Core auth state
  const [state, setState] = useState<AuthState>({
    user: null,
    loading: true,
    error: null,
    sessionExpired: false
  });

  // For tenant-based discovery/settings
  const [discoveredAuthSettings, setDiscoveredAuthSettings] =
    useState<AuthContextType['discoveredAuthSettings']>(undefined);

  // On mount: restore token from localStorage, fetch current user
  useEffect(() => {
    let mounted = true;

    (async () => {
      const token = localStorage.getItem('token');
      if (token) {
        apiClient.setToken(token);
        try {
          const user = await authService.getCurrentUser();
          if (!mounted) return;
          setState({ user, loading: false, error: null, sessionExpired: false });
        } catch (err: any) {
          if (!mounted) return;
          const isAuthErr = err instanceof AuthError;
          setState({
            user: null,
            loading: false,
            error: isAuthErr ? err.message : null,
            sessionExpired: isAuthErr
          });
          apiClient.setToken(null);
          localStorage.removeItem('token');
        }
      } else {
        if (mounted) {
          setState({ user: null, loading: false, error: null, sessionExpired: false });
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  // Shared error handler
  const handleAuthError = useCallback((err: any) => {
    const isAuthErr = err instanceof AuthError;
    setState(prev => ({
      ...prev,
      loading: false,
      error: err.message,
      sessionExpired: isAuthErr,
      user: isAuthErr ? null : prev.user
    }));
    if (isAuthErr) {
      apiClient.setToken(null);
      localStorage.removeItem('token');
    }
    throw err;
  }, []);

  // Sign in
  const signIn = useCallback(
    async (credentials: LoginCredentials) => {
      // If using Auth0, Okta, or Azure AD, we don't need to do anything here
      // as the Auth0Provider, OktaProvider, or AzureADProvider will handle the redirect
      if (credentials.useAuth0 || credentials.useOkta || credentials.useAzureAd) {
        return;
      }

      setState(prev => ({ ...prev, loading: true, error: null, sessionExpired: false }));
      try {
        const response = await authService.signIn(credentials);
        
        // 2) if MFA is required, bail out so the UI can prompt for it
        if ('mfa_required' in response && response.mfa_required) {
          setState(prev => ({ ...prev, loading: false }));
          return response;
        }

        // 3) stash token
        const token = 'token' in response ? response.token! : undefined;
        if (token) {
          localStorage.setItem('token', token);
          apiClient.setToken(token);
        }

        // 4) immediately fetch the full profile (with permissions)
        const fullUser = await authService.getCurrentUser();

        // 5) update state
        setState({ user: fullUser, loading: false, error: null, sessionExpired: false });
        return fullUser;
      } catch (err: any) {
        handleAuthError(err);
      }
    },
    [handleAuthError]
  );

  // External sign in (after getting the token from Auth0, Okta, etc.)
  const externalSignIn = useCallback(
    async (id_token: string, auth_provider_type: 'auth0' | 'azure_ad' | 'okta') => {
      setState(prev => ({ ...prev, loading: true, error: null, sessionExpired: false }));
      try {
        const response = await authService.externalSignIn(id_token, auth_provider_type);
        
        // Store token
        const token = 'token' in response ? response.token! : undefined;
        if (token) {
          localStorage.setItem('token', token);
          apiClient.setToken(token);
        }

        // Fetch full user profile
        const fullUser = await authService.getCurrentUser();
        
        // Update state
        setState({ user: fullUser, loading: false, error: null, sessionExpired: false });
        return fullUser;
      } catch (err: any) {
        handleAuthError(err);
      }
    },
    [handleAuthError]
  );

  // Sign up
  const signUp = useCallback(
    async (userData: RegisterData) => {
      setState(prev => ({ ...prev, loading: true, error: null, sessionExpired: false }));
      try {
        const response = await authService.signUp(userData);
        const token = 'token' in response ? response.token : undefined;
        const user = 'user' in response ? response.user : (response as unknown as User);
        if (token) {
          localStorage.setItem('token', token);
          apiClient.setToken(token);
        }
        setState({ user, loading: false, error: null, sessionExpired: false });
        return user;
      } catch (err: any) {
        handleAuthError(err);
      }
    },
    [handleAuthError]
  );

  // Sign out
  const signOut = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    try {
      await authService.signOut();
      apiClient.setToken(null);
      localStorage.removeItem('token');
      setState({ user: null, loading: false, error: null, sessionExpired: false });
    } catch (err: any) {
      setState(prev => ({ ...prev, loading: false, error: err.message }));
      throw err;
    }
  }, []);

  // Update profile
  const updateProfile = useCallback(
    async (updates: Partial<User>) => {
      if (!state.user) throw new Error('No user logged in');
      setState(prev => ({ ...prev, loading: true, error: null }));
      try {
        const user = await authService.updateProfile(state.user.id, updates);
        setState({ user, loading: false, error: null, sessionExpired: false });
        return user;
      } catch (err: any) {
        handleAuthError(err);
      }
    },
    [state.user, handleAuthError]
  );

  // Change password
  const changePassword = useCallback(
    async (currentPassword: string, newPassword: string) => {
      setState(prev => ({ ...prev, loading: true, error: null }));
      try {
        await authService.changePassword(currentPassword, newPassword);
        setState(prev => ({ ...prev, loading: false, error: null }));
      } catch (err: any) {
        handleAuthError(err);
      }
    },
    [handleAuthError]
  );

  // MFA flows
  const initiateMFA = useCallback(
    async (userId: string) => {
      setState(prev => ({ ...prev, loading: true, error: null }));
      try {
        const result = await authService.initiateMFA(userId);
        setState(prev => ({ ...prev, loading: false, error: null }));
        return result;
      } catch (err: any) {
        handleAuthError(err);
      }
    },
    [handleAuthError]
  );
  const verifyMFA = useCallback(
    async (secret: string, code: string) => {
      setState(prev => ({ ...prev, loading: true, error: null }));
      try {
        const user = await authService.verifyMFA(secret, code);
        setState({ user, loading: false, error: null, sessionExpired: false });
        return user;
      } catch (err: any) {
        handleAuthError(err);
      }
    },
    [handleAuthError]
  );
  const enableMFA = useCallback(
    async (userId: string) => {
      setState(prev => ({ ...prev, loading: true, error: null }));
      try {
        await authService.enableMFA(userId);
        setState(prev => ({
          ...prev,
          loading: false,
          user: prev.user ? { ...prev.user, mfa_enabled: true } : null
        }));
      } catch (err: any) {
        handleAuthError(err);
      }
    },
    [handleAuthError]
  );
  const disableMFA = useCallback(
    async (userId: string) => {
      setState(prev => ({ ...prev, loading: true, error: null }));
      try {
        await authService.disableMFA(userId);
        setState(prev => ({
          ...prev,
          loading: false,
          user: prev.user ? { ...prev.user, mfa_enabled: false } : null
        }));
      } catch (err: any) {
        handleAuthError(err);
      }
    },
    [handleAuthError]
  );

  // Helpers
  const clearError = useCallback(() => setState(prev => ({ ...prev, error: null })), []);
  const clearSessionExpired = useCallback(() => setState(prev => ({ ...prev, sessionExpired: false })), []);
  const setAuthError = useCallback((msg: string) => setState(prev => ({ ...prev, error: msg })), []);
  const isAuthenticated = !!state.user;
  const hasRole = useCallback((r: string) => state.user?.role === r || state.user?.role === 'super_admin', [state.user]);
  const hasAnyRole = useCallback((rs: string[]) => state.user?.role === 'super_admin' || (state.user && rs.includes(state.user.role)), [state.user]);
  const isSuperAdmin = useCallback(() => state.user?.role === 'super_admin', [state.user]);
  const hasPermission = useCallback((perm: string) => {
    if (!state.user) return false;
    if (state.user.role === 'super_admin') return true;
    if (!Array.isArray(state.user.permissions)) return false;
    const [res, act] = perm.split(':');
    return state.user.permissions.some(p => p.resource === res && p.action === act);
  }, [state.user]);
  const hasAnyPermission = useCallback((perms: string[]) => {
    if (!state.user) return false;
    if (state.user.role === 'super_admin') return true;
    if (!Array.isArray(state.user.permissions)) return false;
    return perms.some(perm => {
      const [res, act] = perm.split(':');
      return state.user!.permissions.some(p => p.resource === res && p.action === act);
    });
  }, [state.user]);

  // Admin helpers
  const createUserByAdmin = useCallback(
    async (data: RegisterData & { password?: string }) => {
      setState(prev => ({ ...prev, loading: true, error: null }));
      try {
        const user = await authService.createUserByAdmin(data);
        setState(prev => ({ ...prev, loading: false, error: null }));
        return user;
      } catch (err: any) {
        handleAuthError(err);
      }
    },
    [handleAuthError]
  );
  const updateUserByAdmin = useCallback(
    async (id: string, upd: Partial<User>) => {
      setState(prev => ({ ...prev, loading: true, error: null }));
      try {
        const user = await authService.updateUserByAdmin(id, upd);
        setState(prev => ({ ...prev, loading: false, error: null }));
        return user;
      } catch (err: any) {
        handleAuthError(err);
      }
    },
    [handleAuthError]
  );
  const getAllUsers = useCallback(
    async (page = 1, limit = 20, filters?: any) => {
      setState(prev => ({ ...prev, loading: true, error: null }));
      try {
        const res = await authService.getAllUsers(page, limit, filters);
        setState(prev => ({ ...prev, loading: false, error: null }));
        return res;
      } catch (err: any) {
        handleAuthError(err);
      }
    },
    [handleAuthError]
  );
  const generateNewEmployeeNumber = useCallback(
    async (id: string) => {
      setState(prev => ({ ...prev, loading: true, error: null }));
      try {
        const u = await authService.generateNewEmployeeNumber(id);
        setState(prev => ({ ...prev, loading: false, error: null }));
        return u;
      } catch (err: any) {
        handleAuthError(err);
      }
    },
    [handleAuthError]
  );
  const resetUserPassword = useCallback(
    async (id: string) => {
      setState(prev => ({ ...prev, loading: true, error: null }));
      try {
        const r = await authService.resetUserPassword(id);
        setState(prev => ({ ...prev, loading: false, error: null }));
        return r.password;
      } catch (err: any) {
        handleAuthError(err);
      }
    },
    [handleAuthError]
  );

  // Tenant discovery/settings
  const loadTenantAuthSettings = useCallback(
    async (tid: string) => {
      setState(prev => ({ ...prev, loading: true, error: null }));
      try {
        const settings = await authService.getTenantAuthSettings(tid);
        setDiscoveredAuthSettings(settings);
        setState(prev => ({ ...prev, loading: false, error: null }));
      } catch (err: any) {
        handleAuthError(err);
      }
    },
    [handleAuthError]
  );
  const initiateTenantDiscovery = useCallback(
    async (identifier: string) => {
      setState(prev => ({ ...prev, loading: true, error: null }));
      try {
        const settings = await authService.discoverTenantAuthSettings(identifier);
        setDiscoveredAuthSettings(settings);
        setState(prev => ({ ...prev, loading: false, error: null }));
        return settings;
      } catch (err: any) {
        handleAuthError(err);
      }
    },
    [handleAuthError]
  );

  // Assemble context value
  const contextValue: AuthContextType = {
    ...state,
    signIn,
    externalSignIn,
    signUp,
    signOut,
    updateProfile,
    changePassword,
    initiateMFA,
    verifyMFA,
    enableMFA,
    disableMFA,
    clearError,
    clearSessionExpired,
    setAuthError,
    isAuthenticated,
    hasRole,
    hasAnyRole,
    isSuperAdmin,
    hasPermission,
    hasAnyPermission,
    createUserByAdmin,
    updateUserByAdmin,
    getAllUsers,
    generateNewEmployeeNumber,
    resetUserPassword,
    loadTenantAuthSettings,
    initiateTenantDiscovery,
    discoveredAuthSettings
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};
