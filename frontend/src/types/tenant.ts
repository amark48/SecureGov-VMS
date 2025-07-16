export interface EmailConfig {
  host?: string;
  port?: number;
  secure?: boolean;
  user?: string;
  pass?: string;
  from?: string;
  api_key?: string;
  domain?: string;
}

export interface SmsConfig {
  account_sid?: string;
  auth_token?: string;
  from_number?: string;
  api_key?: string;
  api_secret?: string;
}

export interface PushConfig {
  api_key?: string;
  app_id?: string;
  server_key?: string;
}

// New interface for generic identity providers
export interface IdentityProvider {
  id?: string;
  tenant_id: string;
  provider_type: 'traditional' | 'azure_ad' | 'aws_cognito' | 'okta' | 'auth0';
  config: { [key: string]: any }; // Flexible JSON object for provider-specific settings
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface Tenant {
  id: string;
  name: string;
  corporate_email_domain?: string;
  tenant_prefix?: string;
  next_employee_sequence?: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  user_count?: number;
  facility_count?: number;
  email_provider?: string;
  admins?: any[];
  email_config?: EmailConfig;
  sms_provider?: string;
  sms_config?: SmsConfig;
  push_provider?: string;
  push_config?: PushConfig;
  custom_departments?: string[];
  early_checkin_minutes?: number;
  auto_checkout_time?: string | null;
  auto_checkout_enabled?: boolean;
  grace_period_hours?: number;
  // New field for identity providers
  identity_providers?: IdentityProvider[];
  // Badge configuration
  civ_piv_i_issuance_enabled?: boolean;
  default_badge_type?: 'printed' | 'civ_piv_i';
  // Admin fields used only during creation
  admin_email?: string;
  admin_first_name?: string;
  admin_last_name?: string;
}

interface TenantStats {
  tenant_id: string;
  user_stats: {
    total_users: number;
    active_users: number;
    admin_users: number;
    security_users: number;
    reception_users: number;
    host_users: number;
  };
  facility_stats: {
    total_facilities: number;
    active_facilities: number;
    high_security_facilities: number;
  };
  visitor_stats: {
    total_visitors: number;
    blacklisted_visitors: number;
    frequent_visitors: number;
  };
  visit_stats: {
    total_visits: number;
    pre_registered_visits: number;
    checked_in_visits: number;
    checked_out_visits: number;
    today_visits: number;
  };
  audit_stats?: {
    total_logs: number;
    today_logs: number;
  };
  daily_activity?: Array<{
    date: string;
    count: number;
  }>;
}
