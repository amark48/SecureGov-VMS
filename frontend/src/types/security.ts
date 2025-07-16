export interface WatchlistEntry {
  id: string;
  first_name: string;
  last_name: string;
  aliases?: string[];
  id_numbers?: string[];
  reason: string;
  threat_level: WatchlistLevel;
  source_agency?: string;
  date_added: string;
  expiry_date?: string;
  is_active: boolean;
  notes?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export type WatchlistLevel = 'low' | 'medium' | 'high' | 'critical';

export interface AuditLog {
  id: string;
  user_id?: string;
  action: AuditAction;
  table_name: string;
  record_id?: string;
  old_values?: any;
  new_values?: any;
  ip_address?: string;
  user_agent?: string;
  session_id?: string;
  facility_id?: string;
  timestamp: string;
  compliance_flags?: string[];
  user?: {
    full_name: string;
    email: string;
  };
}

export type AuditAction = 'create' | 'update' | 'delete' | 'login' | 'logout' | 'check_in' | 'check_out';

export interface SecurityAlert {
  id: string;
  type: 'watchlist_match' | 'security_breach' | 'access_denied' | 'emergency';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  visitor_id?: string;
  visit_id?: string;
  facility_id: string;
  resolved: boolean;
  resolved_by?: string;
  resolved_at?: string;
  created_at: string;
}

export interface EmergencyContact {
  id: string;
  facility_id: string;
  name: string;
  title?: string;
  phone_primary: string;
  phone_secondary?: string;
  email?: string;
  contact_type: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}