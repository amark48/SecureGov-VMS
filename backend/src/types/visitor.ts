export interface Visitor {
  id: string;
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  company?: string;
  id_number?: string;
  id_type: string;
  photo_url?: string;
  date_of_birth?: string;
  citizenship?: string;
  nationality?: string;
  ssn?: string;
  security_clearance?: string;
  is_frequent_visitor: boolean;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  background_check_status: string;
  background_check_date?: string;
  is_blacklisted: boolean;
  notes?: string;
  created_at: string;
  updated_at: string;
  tenant_id: string;
}

export interface Visit {
  id: string;
  visitor_id: string;
  host_id: string;
  facility_id: string;
  purpose: string;
  scheduled_date: string;
  scheduled_start_time?: string;
  scheduled_end_time?: string;
  actual_check_in?: string;
  actual_check_out?: string;
  status: VisitStatus;
  badge_id?: string;
  visitor_count: number;
  escort_required: boolean;
  security_approval_required: boolean;
  security_approved_by?: string;
  security_approval_date?: string;
  areas_authorized?: string[];
  special_instructions?: string;
  check_in_location?: string;
  check_out_location?: string;
  vehicle_info?: any;
  equipment_brought?: string[];
  created_by?: string;
  approved_by?: string;
  pre_registration_required?: boolean;
  pre_registration_link?: string;
  pre_registration_status?: 'pending' | 'completed';
  created_at: string;
  updated_at: string;
  tenant_id: string;
  visitor?: Visitor;
  host?: Host;
  facility?: Facility;
}

export type VisitStatus = 'pre_registered' | 'checked_in' | 'checked_out' | 'cancelled' | 'denied';

export interface Host {
  id: string;
  profile_id: string;
  facility_id: string;
  notification_preferences: {
    email: boolean;
    sms: boolean;
    push: boolean;
  };
  max_concurrent_visitors: number;
  is_available: boolean;
  created_at: string;
  updated_at: string;
  tenant_id: string;
  profile?: {
    full_name: string;
    email: string;
    department?: string;
  };
}

export interface Facility {
  id: string;
  name: string;
  address: string;
  security_level: string;
  max_visitors: number;
  operating_hours: any;
  emergency_procedures?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  tenant_id: string;
}

export interface Badge {
  id: string;
  visit_id: string;
  badge_number: string;
  issued_at: string;
  expires_at?: string;
  access_zones?: string[];
  qr_code_data?: string;
  is_temporary: boolean;
  is_active: boolean;
  returned_at?: string;
  created_at: string;
  tenant_id: string;
}

export interface QueryResult<T> {
  rows: T[];
  rowCount: number;
  command?: string;
  oid?: number;
  fields?: any[];
}

export interface DatabaseClient {
  query: (text: string, params?: any[]) => Promise<QueryResult<any>>;
}

export interface PaginationParams {
  page: number;
  limit: number;
  offset: number;
}

export interface PaginationResult {
  page: number;
  limit: number;
  total: number;
  pages: number;
}