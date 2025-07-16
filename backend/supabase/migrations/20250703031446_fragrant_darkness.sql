-- # SecureGov VMS Database Schema for Pure PostgreSQL

-- Overview
-- This migration creates the complete database schema for the Enterprise Visitor Management System,
-- adapted for a standalone PostgreSQL database without Supabase's 'auth' schema.

-- New Tables
-- 1. profiles - User profiles with role-based access control
-- 2. tenants - Tenant information for multi-tenant support
-- 3. facilities - Physical locations and facilities
-- 4. visitors - Visitor registration and information
-- 5. visits - Individual visit records with check-in/out
-- 6. hosts - Host users who can receive visitors
-- 7. watchlist - Security watchlist entries
-- 8. audit_logs - Comprehensive audit trail
-- 9. emergency_contacts - Emergency contact information
-- 10. badges - Digital badge information
-- 11. invitations - Stores visitor invitations that require approval
-- 12. notification_templates - Stores templates for emails, SMS, and other notifications
-- 13. notification_logs - Records of sent notifications

-- Security Features
-- - Row Level Security (RLS) enabled on all tables, relying on session variables for user context
-- - Audit logging for all operations
-- - Role-based access policies
-- - Email domain enforcement for tenants

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create enum types
CREATE TYPE user_role AS ENUM ('admin', 'security', 'reception', 'host', 'approver', 'super_admin');
CREATE TYPE visit_status AS ENUM ('pre_registered', 'checked_in', 'checked_out', 'cancelled', 'denied');
CREATE TYPE watchlist_level AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE audit_action AS ENUM ('create', 'update', 'delete', 'login', 'logout', 'check_in', 'check_out', 'mfa_enabled', 'mfa_disabled');

-- Create updated_at trigger function (if not already defined)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Tenants table
CREATE TABLE IF NOT EXISTS tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  corporate_email_domain text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), -- Changed from auth.uid()
  email text UNIQUE NOT NULL,
  password_hash text NOT NULL, -- Added for backend-managed passwords
  full_name text NOT NULL,
  role user_role NOT NULL DEFAULT 'host',
  department text,
  phone text,
  badge_number text UNIQUE,
  is_active boolean DEFAULT true,
  last_login timestamptz,
  mfa_enabled boolean DEFAULT false,
  mfa_secret text, -- Added for MFA
  piv_card_id text UNIQUE,
  security_clearance text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) -- Added tenant_id
);

-- Facilities table
CREATE TABLE IF NOT EXISTS facilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id), -- Added tenant_id
  name text NOT NULL,
  address text NOT NULL,
  security_level text DEFAULT 'standard',
  max_visitors integer DEFAULT 100,
  operating_hours jsonb DEFAULT '{"monday": {"open": "08:00", "close": "17:00"}, "tuesday": {"open": "08:00", "close": "17:00"}, "wednesday": {"open": "08:00", "close": "17:00"}, "thursday": {"open": "08:00", "close": "17:00"}, "friday": {"open": "08:00", "close": "17:00"}}',
  emergency_procedures text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Visitors table
CREATE TABLE IF NOT EXISTS visitors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id), -- Added tenant_id
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text,
  phone text,
  company text,
  id_number text,
  id_type text DEFAULT 'drivers_license',
  photo_url text,
  date_of_birth date,
  citizenship text,
  nationality text, -- Added nationality
  ssn text, -- Added ssn
  security_clearance text,
  is_frequent_visitor boolean DEFAULT false,
  emergency_contact_name text,
  emergency_contact_phone text,
  background_check_status text DEFAULT 'pending',
  background_check_date timestamptz,
  is_blacklisted boolean DEFAULT false,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Hosts table
CREATE TABLE IF NOT EXISTS hosts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id), -- Added tenant_id
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  facility_id uuid NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  notification_preferences jsonb DEFAULT '{"email": true, "sms": false, "push": true}',
  max_concurrent_visitors integer DEFAULT 5,
  is_available boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(profile_id, facility_id, tenant_id) -- Updated unique constraint
);

-- Visits table
CREATE TABLE IF NOT EXISTS visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id), -- Added tenant_id
  visitor_id uuid NOT NULL REFERENCES visitors(id) ON DELETE CASCADE,
  host_id uuid NOT NULL REFERENCES hosts(id) ON DELETE CASCADE,
  facility_id uuid NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  purpose text NOT NULL,
  scheduled_date date NOT NULL,
  scheduled_start_time time,
  scheduled_end_time time,
  actual_check_in timestamptz,
  actual_check_out timestamptz,
  status visit_status DEFAULT 'pre_registered',
  badge_id uuid, -- Changed to UUID for consistency
  visitor_count integer DEFAULT 1,
  escort_required boolean DEFAULT false,
  security_approval_required boolean DEFAULT false,
  security_approved_by uuid REFERENCES profiles(id),
  security_approval_date timestamptz,
  areas_authorized text[],
  special_instructions text,
  check_in_location text,
  check_out_location text,
  vehicle_info jsonb,
  equipment_brought text[],
  created_by uuid REFERENCES profiles(id),
  approved_by uuid REFERENCES profiles(id),
  pre_registration_required boolean DEFAULT false, -- Added pre-registration fields
  pre_registration_link text,
  pre_registration_status text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Watchlist table
CREATE TABLE IF NOT EXISTS watchlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id), -- Added tenant_id
  first_name text NOT NULL,
  last_name text NOT NULL,
  aliases text[],
  id_numbers text[],
  reason text NOT NULL,
  threat_level watchlist_level DEFAULT 'medium',
  source_agency text,
  date_added date DEFAULT CURRENT_DATE,
  expiry_date date,
  is_active boolean DEFAULT true,
  notes text,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Audit logs table
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id), -- Added tenant_id
  user_id uuid REFERENCES profiles(id),
  action audit_action NOT NULL,
  table_name text NOT NULL,
  record_id uuid,
  old_values jsonb,
  new_values jsonb,
  ip_address inet,
  user_agent text,
  session_id text,
  facility_id uuid REFERENCES facilities(id),
  timestamp timestamptz DEFAULT now(),
  compliance_flags text[]
);

-- Emergency contacts table
CREATE TABLE IF NOT EXISTS emergency_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id), -- Added tenant_id
  facility_id uuid NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  name text NOT NULL,
  title text,
  phone_primary text NOT NULL,
  phone_secondary text,
  email text,
  contact_type text DEFAULT 'general',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Badges table
CREATE TABLE IF NOT EXISTS badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id), -- Added tenant_id
  visit_id uuid NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
  badge_number text UNIQUE NOT NULL,
  issued_at timestamptz DEFAULT now(),
  expires_at timestamptz,
  access_zones text[],
  qr_code_data text,
  is_temporary boolean DEFAULT true,
  is_active boolean DEFAULT true,
  returned_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Invitations table
CREATE TABLE IF NOT EXISTS invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  visitor_id uuid REFERENCES visitors(id),
  host_id uuid NOT NULL REFERENCES hosts(id),
  facility_id uuid NOT NULL REFERENCES facilities(id),
  purpose text NOT NULL,
  scheduled_date date NOT NULL,
  scheduled_start_time time,
  scheduled_end_time time,
  status text NOT NULL DEFAULT 'pending',
  approver_id uuid REFERENCES profiles(id),
  approved_at timestamptz,
  rejection_reason text,
  visitor_count integer DEFAULT 1,
  escort_required boolean DEFAULT false,
  security_approval_required boolean DEFAULT false,
  areas_authorized text[],
  special_instructions text,
  vehicle_info jsonb,
  equipment_brought text[],
  pre_registration_required boolean DEFAULT false,
  pre_registration_link text,
  pre_registration_status text,
  metadata jsonb, -- Added metadata
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Notification templates table
CREATE TABLE IF NOT EXISTS notification_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  name text NOT NULL,
  subject text,
  body text NOT NULL,
  type text NOT NULL, -- 'email', 'sms', 'push'
  event text NOT NULL, -- 'invitation', 'check_in', 'check_out', 'approval', etc.
  is_active boolean DEFAULT true,
  is_default boolean DEFAULT false,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(tenant_id, type, event, is_default)
);

-- Notification logs table
CREATE TABLE IF NOT EXISTS notification_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  template_id uuid REFERENCES notification_templates(id),
  recipient_email text,
  recipient_phone text,
  recipient_user_id uuid REFERENCES profiles(id),
  subject text,
  body text,
  type text NOT NULL, -- 'email', 'sms', 'push'
  event text NOT NULL,
  status text NOT NULL, -- 'sent', 'failed', 'pending'
  error_message text,
  sent_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Initial Data Inserts (if tables are empty)
INSERT INTO tenants (name)
VALUES ('Default Tenant')
ON CONFLICT (name) DO NOTHING;

-- Update existing data to use default tenant (if any records exist without tenant_id)
-- This part is crucial if you're running this on an existing database that was not multi-tenant
DO $$
DECLARE
    default_tenant_id_val uuid;
BEGIN
    SELECT id INTO default_tenant_id_val FROM tenants WHERE name = 'Default Tenant';

    IF default_tenant_id_val IS NOT NULL THEN
        UPDATE profiles SET tenant_id = default_tenant_id_val WHERE tenant_id IS NULL;
        UPDATE facilities SET tenant_id = default_tenant_id_val WHERE tenant_id IS NULL;
        UPDATE visitors SET tenant_id = default_tenant_id_val WHERE tenant_id IS NULL;
        UPDATE hosts SET tenant_id = default_tenant_id_val WHERE tenant_id IS NULL;
        UPDATE visits SET tenant_id = default_tenant_id_val WHERE tenant_id IS NULL;
        UPDATE watchlist SET tenant_id = default_tenant_id_val WHERE tenant_id IS NULL;
        UPDATE audit_logs SET tenant_id = default_tenant_id_val WHERE tenant_id IS NULL;
        UPDATE emergency_contacts SET tenant_id = default_tenant_id_val WHERE tenant_id IS NULL;
        UPDATE badges SET tenant_id = default_tenant_id_val WHERE tenant_id IS NULL;
        UPDATE invitations SET tenant_id = default_tenant_id_val WHERE tenant_id IS NULL;
        UPDATE notification_templates SET tenant_id = default_tenant_id_val WHERE tenant_id IS NULL;
        UPDATE notification_logs SET tenant_id = default_tenant_id_val WHERE tenant_id IS NULL;
    END IF;
END $$;

-- Insert default facility (if facilities table is empty)
INSERT INTO facilities (tenant_id, name, address, security_level)
SELECT id, 'Main Government Building', '123 Government Ave, Washington DC', 'high'
FROM tenants WHERE name = 'Default Tenant'
ON CONFLICT DO NOTHING;

-- Insert default notification templates for the default tenant
DO $$
DECLARE
  default_tenant_id uuid;
BEGIN
  SELECT id INTO default_tenant_id FROM tenants WHERE name = 'Default Tenant';
  
  IF default_tenant_id IS NOT NULL THEN
    INSERT INTO notification_templates (tenant_id, name, subject, body, type, event, is_default, is_active)
    VALUES
    (default_tenant_id, 'Visitor Invitation', 'You have been invited to visit {{facility_name}}', 
     'Dear {{visitor_name}},\n\nYou have been invited to visit {{facility_name}} on {{visit_date}} at {{visit_time}}.\n\nPurpose: {{purpose}}\nHost: {{host_name}}\n\nPlease complete your pre-registration by clicking the link below:\n\n{{pre_registration_link}}\n\nThank you,\n{{organization_name}}', 
     'email', 'invitation', true, true),
     
    (default_tenant_id, 'Visit Approved', 'Your visit to {{facility_name}} has been approved', 
     'Dear {{visitor_name}},\n\nYour visit to {{facility_name}} on {{visit_date}} at {{visit_time}} has been approved.\n\nPurpose: {{purpose}}\nHost: {{host_name}}\n\nPlease arrive 15 minutes before your scheduled time and bring a valid ID.\n\nThank you,\n{{organization_name}}', 
     'email', 'approval', true, true),
     
    (default_tenant_id, 'Visit Rejected', 'Your visit to {{facility_name}} has been rejected', 
     'Dear {{visitor_name}},\n\nWe regret to inform you that your visit to {{facility_name}} on {{visit_date}} at {{visit_time}} has been rejected.\n\nReason: {{rejection_reason}}\n\nIf you have any questions, please contact your host, {{host_name}}.\n\nThank you,\n{{organization_name}}', 
     'email', 'rejection', true, true),
     
    (default_tenant_id, 'Check-in Confirmation', 'Check-in confirmation for {{facility_name}}', 
     'Dear {{visitor_name}},\n\nThis is to confirm that you have successfully checked in at {{facility_name}} on {{check_in_date}} at {{check_in_time}}.\n\nYour badge number is: {{badge_number}}\n\nHost: {{host_name}}\n\nThank you,\n{{organization_name}}', 
     'email', 'check_in', true, true),
     
    (default_tenant_id, 'Check-out Confirmation', 'Check-out confirmation for {{facility_name}}', 
     'Dear {{visitor_name}},\n\nThis is to confirm that you have successfully checked out from {{facility_name}} on {{check_out_date}} at {{check_out_time}}.\n\nThank you for your visit.\n\n{{organization_name}}', 
     'email', 'check_out', true, true),
     
    (default_tenant_id, 'Host Notification - New Visit', 'New visitor scheduled: {{visitor_name}}', 
     'Dear {{host_name}},\n\nA new visit has been scheduled for you:\n\nVisitor: {{visitor_name}}\nCompany: {{visitor_company}}\nDate: {{visit_date}}\nTime: {{visit_time}}\nPurpose: {{purpose}}\n\nPlease ensure you are available to receive your visitor.\n\nThank you,\n{{organization_name}}', 
     'email', 'host_notification', true, true),
     
    (default_tenant_id, 'Host Notification - Visitor Arrived', 'Your visitor has arrived: {{visitor_name}}', 
     'Dear {{host_name}},\n\nYour visitor has arrived and checked in at {{facility_name}}:\n\nVisitor: {{visitor_name}}\nCompany: {{visitor_company}}\nChecked in at: {{check_in_time}}\nPurpose: {{purpose}}\n\nPlease proceed to the reception area to meet your visitor.\n\nThank you,\n{{organization_name}}', 
     'email', 'visitor_arrived', true, true),
     
    (default_tenant_id, 'Security Alert', 'Security Alert: {{alert_type}}', 
     'SECURITY ALERT\n\nType: {{alert_type}}\nSeverity: {{severity}}\nLocation: {{facility_name}}\nTime: {{alert_time}}\n\nDetails: {{alert_message}}\n\nPlease follow security protocols and respond accordingly.\n\n{{organization_name}} Security Team', 
     'email', 'security_alert', true, true);
     
    INSERT INTO notification_templates (tenant_id, name, subject, body, type, event, is_default, is_active)
    VALUES
    (default_tenant_id, 'SMS Visitor Invitation', NULL, 
     'You have been invited to visit {{facility_name}} on {{visit_date}}. Complete pre-registration: {{pre_registration_link}}', 
     'sms', 'invitation', true, true),
     
    (default_tenant_id, 'SMS Host Notification', NULL, 
     'Your visitor {{visitor_name}} has arrived at {{facility_name}}. Please proceed to reception.', 
     'sms', 'visitor_arrived', true, true),
     
    (default_tenant_id, 'SMS Security Alert', NULL, 
     'SECURITY ALERT: {{alert_type}} at {{facility_name}}. Severity: {{severity}}. {{alert_message}}', 
     'sms', 'security_alert', true, true);
     
    INSERT INTO notification_templates (tenant_id, name, subject, body, type, event, is_default, is_active)
    VALUES
    (default_tenant_id, 'Push Visitor Arrived', 'Visitor Arrived', 
     'Your visitor {{visitor_name}} has arrived at {{facility_name}}.', 
     'push', 'visitor_arrived', true, true),
     
    (default_tenant_id, 'Push Security Alert', 'Security Alert', 
     '{{alert_type}} at {{facility_name}}. Severity: {{severity}}.', 
     'push', 'security_alert', true, true);
  END IF;
END $$;

-- Create indexes for tenant_id columns
CREATE INDEX IF NOT EXISTS idx_profiles_tenant_id ON profiles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_facilities_tenant_id ON facilities(tenant_id);
CREATE INDEX IF NOT EXISTS idx_visitors_tenant_id ON visitors(tenant_id);
CREATE INDEX IF NOT EXISTS idx_hosts_tenant_id ON hosts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_visits_tenant_id ON visits(tenant_id);
CREATE INDEX IF NOT EXISTS idx_watchlist_tenant_id ON watchlist(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_id ON audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_emergency_contacts_tenant_id ON emergency_contacts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_badges_tenant_id ON badges(tenant_id);
CREATE INDEX IF NOT EXISTS idx_invitations_tenant_id ON invitations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_notification_templates_tenant_id ON notification_templates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_tenant_id ON notification_logs(tenant_id);

-- Create other indexes
CREATE INDEX IF NOT EXISTS idx_visits_visitor_id ON visits(visitor_id);
CREATE INDEX IF NOT EXISTS idx_visits_host_id ON visits(host_id);
CREATE INDEX IF NOT EXISTS idx_visits_facility_id ON visits(facility_id);
CREATE INDEX IF NOT EXISTS idx_visits_scheduled_date ON visits(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_visits_status ON visits(status);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_watchlist_names ON watchlist(first_name, last_name);
CREATE INDEX IF NOT EXISTS idx_badges_visit_id ON badges(visit_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_invitations_host_id ON invitations(host_id);
CREATE INDEX IF NOT EXISTS idx_invitations_visitor_id ON invitations(visitor_id);
CREATE INDEX IF NOT EXISTS idx_invitations_facility_id ON invitations(facility_id);
CREATE INDEX IF NOT EXISTS idx_invitations_status ON invitations(status);
CREATE INDEX IF NOT EXISTS idx_invitations_scheduled_date ON invitations(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_notification_templates_type_event ON notification_templates(type, event);
CREATE INDEX IF NOT EXISTS idx_notification_logs_recipient_user_id ON notification_logs(recipient_user_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_status ON notification_logs(status);
CREATE INDEX IF NOT EXISTS idx_notification_logs_sent_at ON notification_logs(sent_at);

-- Create triggers for updated_at (if not already defined for all tables)
CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON tenants FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_facilities_updated_at BEFORE UPDATE ON facilities FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_visitors_updated_at BEFORE UPDATE ON visitors FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_hosts_updated_at BEFORE UPDATE ON hosts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_visits_updated_at BEFORE UPDATE ON visits FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_watchlist_updated_at BEFORE UPDATE ON watchlist FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_emergency_contacts_updated_at BEFORE UPDATE ON emergency_contacts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_invitations_updated_at BEFORE UPDATE ON invitations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_notification_templates_updated_at BEFORE UPDATE ON notification_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Helper function to render template with variables
CREATE OR REPLACE FUNCTION render_template(template_text text, variables jsonb)
RETURNS text AS $$
DECLARE
  result text := template_text;
  key text;
  value text;
BEGIN
  FOR key, value IN SELECT * FROM jsonb_each_text(variables) LOOP
    result := replace(result, '{{' || key || '}}', value);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Helper function to get current user ID from session (if needed for specific policies)
-- This is a placeholder. In a non-Supabase setup, you'd typically pass user_id directly
-- or rely on the backend to filter. For RLS, we'll primarily use tenant_id and role.
CREATE OR REPLACE FUNCTION get_current_user_id()
RETURNS uuid AS $$
  SELECT current_setting('app.user_id', true)::uuid;
$$ LANGUAGE sql STABLE;

-- Helper function to get current user role from session
CREATE OR REPLACE FUNCTION get_current_user_role()
RETURNS text AS $$
  SELECT current_setting('app.user_role', true)::text;
$$ LANGUAGE sql STABLE;

-- Helper function to get current tenant ID from session
CREATE OR REPLACE FUNCTION get_current_tenant_id_from_session()
RETURNS uuid AS $$
  SELECT current_setting('app.tenant_id', true)::uuid;
$$ LANGUAGE sql STABLE;

-- Policy for super_admin role
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS boolean AS $$
  SELECT get_current_user_role() = 'super_admin';
$$ LANGUAGE sql STABLE;

-- Generic policy for tenant isolation and role-based access
-- This function simplifies policy definitions by checking tenant_id and role
CREATE OR REPLACE FUNCTION can_access_tenant_data(table_tenant_id uuid, required_roles text[])
RETURNS boolean AS $$
BEGIN
  IF is_super_admin() THEN
    RETURN TRUE; -- Super admins bypass all tenant and role checks
  END IF;

  RETURN table_tenant_id = get_current_tenant_id_from_session() AND
         (get_current_user_role() = ANY(required_roles) OR array_length(required_roles, 1) IS NULL);
END;
$$ LANGUAGE plpgsql STABLE;

-- Enable Row Level Security
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE facilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE visitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE hosts ENABLE ROW LEVEL SECURITY;
ALTER TABLE visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE watchlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE emergency_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies (adapted for session variables)
-- We assume the backend sets `app.tenant_id` and `app.user_role` in the session.
-- Super admins (role 'super_admin') bypass tenant_id checks.

-- Tenants policies
CREATE POLICY "Tenants: Admins can manage their tenant" ON tenants
  FOR ALL USING (can_access_tenant_data(id, ARRAY['admin'])) WITH CHECK (can_access_tenant_data(id, ARRAY['admin']));

CREATE POLICY "Tenants: Super admins can manage all tenants" ON tenants
  FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());

-- Profiles policies
CREATE POLICY "Profiles: Users can read own profile within their tenant" ON profiles
  FOR SELECT USING (id = get_current_user_id() AND can_access_tenant_data(tenant_id, NULL));

CREATE POLICY "Profiles: Users can update own profile within their tenant" ON profiles
  FOR UPDATE USING (id = get_current_user_id() AND can_access_tenant_data(tenant_id, NULL));

CREATE POLICY "Profiles: Admins can manage profiles within their tenant" ON profiles
  FOR ALL USING (can_access_tenant_data(tenant_id, ARRAY['admin'])) WITH CHECK (can_access_tenant_data(tenant_id, ARRAY['admin']));

CREATE POLICY "Profiles: Allow profiles to be created by admin/reception within their tenant" ON profiles
  FOR INSERT WITH CHECK (can_access_tenant_data(tenant_id, ARRAY['admin', 'reception']));

-- Facilities policies
CREATE POLICY "Facilities: Authenticated users can read facilities within their tenant" ON facilities
  FOR SELECT USING (can_access_tenant_data(tenant_id, NULL));

CREATE POLICY "Facilities: Admins can manage facilities within their tenant" ON facilities
  FOR ALL USING (can_access_tenant_data(tenant_id, ARRAY['admin'])) WITH CHECK (can_access_tenant_data(tenant_id, ARRAY['admin']));

-- Visitors policies
CREATE POLICY "Visitors: Authenticated users can read visitors within their tenant" ON visitors
  FOR SELECT USING (can_access_tenant_data(tenant_id, NULL));

CREATE POLICY "Visitors: Reception and security can manage visitors within their tenant" ON visitors
  FOR ALL USING (can_access_tenant_data(tenant_id, ARRAY['admin', 'security', 'reception'])) WITH CHECK (can_access_tenant_data(tenant_id, ARRAY['admin', 'security', 'reception']));

-- Hosts policies
CREATE POLICY "Hosts: Users can read own host records within their tenant" ON hosts
  FOR SELECT USING (profile_id = get_current_user_id() AND can_access_tenant_data(tenant_id, NULL));

CREATE POLICY "Hosts: Admins can manage hosts within their tenant" ON hosts
  FOR ALL USING (can_access_tenant_data(tenant_id, ARRAY['admin'])) WITH CHECK (can_access_tenant_data(tenant_id, ARRAY['admin']));

-- Visits policies
CREATE POLICY "Visits: Users can read visits they are involved in within their tenant" ON visits
  FOR SELECT USING (
    can_access_tenant_data(tenant_id, NULL) AND
    (
      EXISTS (SELECT 1 FROM hosts h WHERE h.id = visits.host_id AND h.profile_id = get_current_user_id() AND h.tenant_id = get_current_tenant_id_from_session()) OR
      get_current_user_role() = ANY(ARRAY['admin', 'security', 'reception'])
    )
  );

CREATE POLICY "Visits: Authorized users can manage visits within their tenant" ON visits
  FOR ALL USING (
    can_access_tenant_data(tenant_id, NULL) AND
    (
      EXISTS (SELECT 1 FROM hosts h WHERE h.id = visits.host_id AND h.profile_id = get_current_user_id() AND h.tenant_id = get_current_tenant_id_from_session()) OR
      get_current_user_role() = ANY(ARRAY['admin', 'security', 'reception'])
    )
  ) WITH CHECK (
    can_access_tenant_data(tenant_id, NULL) AND
    (
      EXISTS (SELECT 1 FROM hosts h WHERE h.id = visits.host_id AND h.profile_id = get_current_user_id() AND h.tenant_id = get_current_tenant_id_from_session()) OR
      get_current_user_role() = ANY(ARRAY['admin', 'security', 'reception'])
    )
  );

-- Watchlist policies
CREATE POLICY "Watchlist: Security personnel can access watchlist within their tenant" ON watchlist
  FOR ALL USING (can_access_tenant_data(tenant_id, ARRAY['admin', 'security'])) WITH CHECK (can_access_tenant_data(tenant_id, ARRAY['admin', 'security']));

-- Audit logs policies
CREATE POLICY "Audit Logs: Users can read relevant audit logs within their tenant" ON audit_logs
  FOR SELECT USING (
    can_access_tenant_data(tenant_id, NULL) AND
    (
      user_id = get_current_user_id() OR
      get_current_user_role() = ANY(ARRAY['admin', 'security'])
    )
  );

CREATE POLICY "Audit Logs: Allow audit log inserts within their tenant" ON audit_logs
  FOR INSERT WITH CHECK (can_access_tenant_data(tenant_id, NULL));

-- Emergency contacts policies
CREATE POLICY "Emergency Contacts: Authenticated users can read emergency contacts within their tenant" ON emergency_contacts
  FOR SELECT USING (can_access_tenant_data(tenant_id, NULL));

CREATE POLICY "Emergency Contacts: Admins can manage emergency contacts within their tenant" ON emergency_contacts
  FOR ALL USING (can_access_tenant_data(tenant_id, ARRAY['admin', 'security'])) WITH CHECK (can_access_tenant_data(tenant_id, ARRAY['admin', 'security']));

-- Badges policies
CREATE POLICY "Badges: Users can read relevant badges within their tenant" ON badges
  FOR SELECT USING (
    can_access_tenant_data(tenant_id, NULL) AND
    (
      EXISTS (SELECT 1 FROM visits v JOIN hosts h ON v.host_id = h.id WHERE v.id = badges.visit_id AND h.profile_id = get_current_user_id() AND h.tenant_id = get_current_tenant_id_from_session()) OR
      get_current_user_role() = ANY(ARRAY['admin', 'security', 'reception'])
    )
  );

CREATE POLICY "Badges: Authorized users can manage badges within their tenant" ON badges
  FOR ALL USING (can_access_tenant_data(tenant_id, ARRAY['admin', 'security', 'reception'])) WITH CHECK (can_access_tenant_data(tenant_id, ARRAY['admin', 'security', 'reception']));

-- Invitations policies
CREATE POLICY "Invitations: Users can read invitations within their tenant" ON invitations
  FOR SELECT USING (
    can_access_tenant_data(tenant_id, NULL) AND
    (
      EXISTS (SELECT 1 FROM hosts h WHERE h.id = invitations.host_id AND h.profile_id = get_current_user_id() AND h.tenant_id = get_current_tenant_id_from_session()) OR
      get_current_user_role() = ANY(ARRAY['admin', 'security', 'reception', 'approver'])
    )
  );

CREATE POLICY "Invitations: Hosts can create invitations within their tenant" ON invitations
  FOR INSERT WITH CHECK (
    can_access_tenant_data(tenant_id, NULL) AND
    EXISTS (SELECT 1 FROM hosts h WHERE h.id = invitations.host_id AND h.profile_id = get_current_user_id() AND h.tenant_id = get_current_tenant_id_from_session())
  );

CREATE POLICY "Invitations: Approvers can update invitations within their tenant" ON invitations
  FOR UPDATE USING (can_access_tenant_data(tenant_id, ARRAY['admin', 'approver'])) WITH CHECK (can_access_tenant_data(tenant_id, ARRAY['admin', 'approver']));

CREATE POLICY "Invitations: Admins can delete invitations within their tenant" ON invitations
  FOR DELETE USING (can_access_tenant_data(tenant_id, ARRAY['admin']));

-- Notification templates policies
CREATE POLICY "Notification Templates: Users can read notification templates within their tenant" ON notification_templates
  FOR SELECT USING (can_access_tenant_data(tenant_id, NULL));

CREATE POLICY "Notification Templates: Admins can manage notification templates within their tenant" ON notification_templates
  FOR ALL USING (can_access_tenant_data(tenant_id, ARRAY['admin'])) WITH CHECK (can_access_tenant_data(tenant_id, ARRAY['admin']));

-- Notification logs policies
CREATE POLICY "Notification Logs: Users can read their own notification logs" ON notification_logs
  FOR SELECT USING (
    can_access_tenant_data(tenant_id, NULL) AND
    (
      recipient_user_id = get_current_user_id() OR
      get_current_user_role() = ANY(ARRAY['admin', 'security'])
    )
  );

CREATE POLICY "Notification Logs: Allow inserts within their tenant" ON notification_logs
  FOR INSERT WITH CHECK (can_access_tenant_data(tenant_id, NULL));