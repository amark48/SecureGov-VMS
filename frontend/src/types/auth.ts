export interface User {
  id: string;
  email: string;
  tenant_id: string;
  tenant_name?: string;
  corporate_email_domain?: string;
  tenant_prefix?: string;
  next_employee_sequence?: number;
  custom_departments?: string[];
  full_name: string;
  first_name?: string;
  last_name?: string;
  role: UserRole;
  permissions?: Array<{resource: string, action: string}>;
  department?: string;
  phone?: string;
  employee_number?: string;
  is_active: boolean;
  last_login?: string;
  mfa_enabled: boolean;
  mfa_secret?: string;
  piv_card_id?: string;
  security_clearance?: string;
  created_at: string;
  updated_at: string;
}

type UserRole = 'admin' | 'security' | 'reception' | 'host' | 'approver' | 'super_admin';

export interface Permission {
  id: string;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
}

interface RolePermission {
  role_id: string;
  permission_id: string;
  created_at: string;
}

// NEW INTERFACE: Define AuthError for structured error messages
export interface AuthError {
  message: string;
  code?: string;
  details?: any; // Optional: for more detailed validation errors
}

export interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null; 
  sessionExpired?: boolean;
  authStrategy?: 'traditional' | 'azure_ad' | 'hybrid';
}

export interface LoginCredentials {
  email?: string;
  password?: string;
  mfaCode?: string;
  id_token?: string;
  auth_provider_type?: 'auth0' | 'azure_ad' | 'okta';
  authStrategy?: 'traditional' | 'azure_ad' | 'okta' | 'auth0' | 'hybrid';
  useOkta?: boolean;
  useAuth0?: boolean;
  useAzureAd?: boolean;
}

export interface RegisterData {
  email: string;
  password?: string;
  full_name: string;
  role: UserRole;
  tenant_id?: string;
  tenant_name?: string;
  department?: string;
  phone?: string;
  employee_number?: string;
  security_clearance?: string;
  authStrategy?: 'traditional' | 'azure_ad' | 'hybrid';
  
}