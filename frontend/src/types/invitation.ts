export interface Invitation {
  id: string;
  tenant_id: string;
  visitor_id?: string;
  host_id: string;
  facility_id: string;
  purpose: string;
  scheduled_date: string;
  scheduled_start_time?: string;
  scheduled_end_time?: string;
  status: InvitationStatus;
  approver_id?: string;
  approved_at?: string;
  rejection_reason?: string;
  visitor_count: number;
  escort_required: boolean;
  security_approval_required: boolean;
  areas_authorized?: string[];
  special_instructions?: string;
  vehicle_info?: any;
  equipment_brought?: string[];
  pre_registration_required?: boolean;
  pre_registration_link?: string;
  pre_registration_status?: 'pending' | 'completed';
  recurrence_type?: 'none' | 'daily' | 'weekly' | 'monthly';
  recurrence_interval?: number;
  recurrence_days_of_week?: number[];
  recurrence_end_date?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
  
  // Joined fields from other tables
  visitor_first_name?: string;
  visitor_last_name?: string;
  visitor_email?: string;
  visitor_company?: string;
  visitor_nationality?: string;
  visitor_ssn?: string;
  host_profile_id?: string;
  host_name?: string;
  host_email?: string;
  facility_name?: string;
  approver_name?: string;
}

type InvitationStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';