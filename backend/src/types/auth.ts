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
  role: string;
  role_id?: string;
  permissions?: Array<{resource: string, action: string}>;
  department?: string;
  phone?: string;
  employee_number?: string;
  is_active: boolean;
  last_login?: string;
  mfa_enabled?: boolean;
  mfa_secret?: string;
  security_clearance?: string;
  created_at: string;
  updated_at: string;
  // Azure AD specific fields
  auth_provider?: 'local' | 'azure_ad';
  azure_ad_object_id?: string;
  azure_ad_roles?: string[];
  aws_credentials?: {
    accessKeyId: string;
    secretAccessKey: string;
    sessionToken: string;
    expiration: Date;
  };
}

export type UserRole = 'admin' | 'security' | 'reception' | 'host' | 'approver' | 'super_admin';

export interface AzureAdTokenPayload {
  aud: string;
  iss: string;
  iat: number;
  nbf: number;
  exp: number;
  email?: string;
  name?: string;
  oid: string; // Object ID
  preferred_username?: string;
  roles?: string[];
  groups?: string[];
  tid: string; // Tenant ID
  upn?: string; // User Principal Name
}

export interface AwsCredentials {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken: string;
  expiration: Date;
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
  first_name?: string;
  last_name?: string;
  role: string;
  tenant_id?: string;
  tenant_name?: string;
  department?: string;
  phone?: string;
  employee_number?: string;
  security_clearance?: string;
}