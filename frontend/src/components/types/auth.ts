export interface User {
  id: string;
  email: string;
  tenant_id: string;
  full_name: string;
  role: UserRole;
  department?: string;
  phone?: string;
  badge_number?: string;
  is_active: boolean;
  last_login?: string;
  mfa_enabled: boolean;
  mfa_secret?: string;
  piv_card_id?: string;
  security_clearance?: string;
  created_at: string;
  updated_at: string;
}

export type UserRole = 'admin' | 'security' | 'reception' | 'host' | 'approver' | 'super_admin';

export interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
  sessionExpired?: boolean;
}

export interface LoginCredentials {
  email: string;
  password: string;
  mfaCode?: string;
}

export interface RegisterData {
  email: string;
  password: string;
  full_name: string;
  role: UserRole;
  tenant_id?: string;
  tenant_name?: string;
  department?: string;
  phone?: string;
  badge_number?: string;
  security_clearance?: string;
}