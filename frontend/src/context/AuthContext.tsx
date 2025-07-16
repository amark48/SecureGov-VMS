// src/context/AuthContext.tsx
import { createContext, useContext } from 'react';
import { AuthState, User, LoginCredentials, RegisterData, Permission } from '../types/auth';

// Define the shape of the AuthContext value
export interface AuthContextType extends AuthState {
  signIn: (credentials: LoginCredentials) => Promise<User | { mfa_required: boolean; user: User }>;
  externalSignIn: (id_token: string, auth_provider_type: 'auth0' | 'azure_ad' | 'okta') => Promise<User>;
  signUp: (userData: RegisterData) => Promise<User>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<User>) => Promise<User>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  initiateMFA: (userId: string) => Promise<{ qrCodeUrl: string; secret: string }>;
  verifyMFA: (secret: string, code: string) => Promise<User>;
  enableMFA: (userId: string) => Promise<void>;
  disableMFA: (userId: string) => Promise<void>;
  clearError: () => void;
  clearSessionExpired: () => void;
  setAuthError: (errorMessage: string) => void;
  isAuthenticated: boolean;
  hasRole: (role: string) => boolean;
  hasAnyRole: (roles: string[]) => boolean;
  isSuperAdmin: () => boolean;
  hasPermission: (permission: string) => boolean;
  hasAnyPermission: (permissions: string[]) => boolean;
  // Admin-specific functions (moved from useAuth)
  createUserByAdmin: (userData: RegisterData & { password?: string }) => Promise<User>;
  updateUserByAdmin: (userId: string, updates: Partial<User>) => Promise<User>;
  getAllUsers: (page?: number, limit?: number, filters?: any) => Promise<{ users: User[]; pagination: any }>;
  generateNewEmployeeNumber: (userId: string) => Promise<User>;
  resetUserPassword: (userId: string) => Promise<string>;
  loadTenantAuthSettings: (tenantId: string) => Promise<void>;
  discoveredAuthSettings?: {
    auth_strategy: string;
    azure_ad_enabled: boolean;
    okta_enabled: boolean;
    auth0_enabled: boolean;
    tenant_id: string;
    tenant_name: string;
  };
  initiateTenantDiscovery: (identifier: string) => Promise<{
    auth_strategy: string;
    azure_ad_enabled: boolean;
    tenant_id: string;
    tenant_name: string;
  }>;
}

// Create the context with a default undefined value
export const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Custom hook to use the AuthContext
export const useAuthContext = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
};
