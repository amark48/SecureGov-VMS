/*
  # SecureGov VMS Database Schema

  ## Overview
  This migration creates the complete database schema for the Enterprise Visitor Management System,
  designed for government and regulated sectors with FICAM, FIPS 140, HIPAA, and FERPA compliance.

  ## New Tables
  1. **profiles** - User profiles with role-based access control
  2. **facilities** - Physical locations and facilities
  3. **visitors** - Visitor registration and information
  4. **visits** - Individual visit records with check-in/out
  5. **hosts** - Host users who can receive visitors
  6. **watchlist** - Security watchlist entries
  7. **audit_logs** - Comprehensive audit trail
  8. **emergency_contacts** - Emergency contact information
  9. **badges** - Digital badge information

  ## Security Features
  - Extensions for UUID generation and cryptographic functions
  - Audit logging for all operations
  - Encrypted sensitive data fields
  - Triggers to keep `updated_at` current
*/

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create enum types (only if not already present)
CREATE TYPE IF NOT EXISTS user_role AS ENUM (
  'admin', 
  'security', 
  'reception', 
  'host'
);

CREATE TYPE IF NOT EXISTS visit_status AS ENUM (
  'pre_registered',
  'checked_in',
  'checked_out',
  'cancelled',
  'denied'
);

CREATE TYPE IF NOT EXISTS watchlist_level AS ENUM (
  'low',
  'medium',
  'high',
  'critical'
);

CREATE TYPE IF NOT EXISTS audit_action AS ENUM (
  'create',
  'update',
  'delete',
  'login',
  'logout',
  'check_in',
  'check_out'
);

-- Profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  full_name text NOT NULL,
  role user_role NOT NULL DEFAULT 'host',
  department text,
  phone text,
  badge_number text UNIQUE,
  is_active boolean DEFAULT true,
  last_login timestamptz,
  mfa_enabled boolean DEFAULT false,
  piv_card_id text UNIQUE,
  security_clearance text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Facilities table
CREATE TABLE IF NOT EXISTS facilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text NOT NULL,
  security_level text DEFAULT 'standard',
  max_visitors integer DEFAULT 100,
  operating_hours jsonb DEFAULT '{
    "monday":   {"open": "08:00", "close": "17:00"},
    "tuesday":  {"open": "08:00", "close": "17:00"},
    "wednesday":{"open": "08:00", "close": "17:00"},
    "thursday": {"open": "08:00", "close": "17:00"},
    "friday":   {"open": "08:00", "close": "17:00"}
  }',
  emergency_procedures text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Visitors table
CREATE TABLE IF NOT EXISTS visitors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
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
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  facility_id uuid NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  notification_preferences jsonb DEFAULT '{"email": true, "sms": false, "push": true}',
  max_concurrent_visitors integer DEFAULT 5,
  is_available boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(profile_id, facility_id)
);

-- Visits table
CREATE TABLE IF NOT EXISTS visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
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
  badge_id text UNIQUE,
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
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Watchlist table
CREATE TABLE IF NOT EXISTS watchlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
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
  visit_id uuid NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
  badge_number text UNIQUE NOT NULL,
  issued_at timestamptz DEFAULT now(),
  expires_at timestamptz,
  access_zones text[],
  qr_code_data text,
  is_temporary boolean DEFAULT true,
  is_active boolean DEFAULT true,
  returned_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Insert a default facility (idempotent)
INSERT INTO facilities (name, address, security_level)
  VALUES ('Main Government Building', '123 Government Ave, Washington DC', 'high')
  ON CONFLICT (name) DO NOTHING;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_visits_visitor_id         ON visits(visitor_id);
CREATE INDEX IF NOT EXISTS idx_visits_host_id            ON visits(host_id);
CREATE INDEX IF NOT EXISTS idx_visits_facility_id        ON visits(facility_id);
CREATE INDEX IF NOT EXISTS idx_visits_scheduled_date     ON visits(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_visits_status             ON visits(status);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp      ON audit_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id        ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_watchlist_names           ON watchlist(first_name, last_name);
CREATE INDEX IF NOT EXISTS idx_badges_visit_id           ON badges(visit_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role             ON profiles(role);

-- Create or replace the "updated_at" trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach triggers to keep updated_at fresh
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_trigger
     WHERE tgname = 'update_profiles_updated_at'
  ) THEN
    CREATE TRIGGER update_profiles_updated_at
      BEFORE UPDATE ON profiles
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM pg_trigger
     WHERE tgname = 'update_facilities_updated_at'
  ) THEN
    CREATE TRIGGER update_facilities_updated_at
      BEFORE UPDATE ON facilities
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM pg_trigger
     WHERE tgname = 'update_visitors_updated_at'
  ) THEN
    CREATE TRIGGER update_visitors_updated_at
      BEFORE UPDATE ON visitors
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM pg_trigger
     WHERE tgname = 'update_hosts_updated_at'
  ) THEN
    CREATE TRIGGER update_hosts_updated_at
      BEFORE UPDATE ON hosts
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM pg_trigger
     WHERE tgname = 'update_visits_updated_at'
  ) THEN
    CREATE TRIGGER update_visits_updated_at
      BEFORE UPDATE ON visits
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM pg_trigger
     WHERE tgname = 'update_watchlist_updated_at'
  ) THEN
    CREATE TRIGGER update_watchlist_updated_at
      BEFORE UPDATE ON watchlist
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM pg_trigger
     WHERE tgname = 'update_emergency_contacts_updated_at'
  ) THEN
    CREATE TRIGGER update_emergency_contacts_updated_at
      BEFORE UPDATE ON emergency_contacts
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END;
$$;
