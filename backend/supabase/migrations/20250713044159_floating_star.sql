/*
  # VMS Enhancements Migration

  1. QR Code Integration
    - Add qr_code_token and qr_code_url to invitations table
    - Add index for quick QR code lookups

  2. Enhanced Badge Issuance
    - Add badge_type, civ_piv_i_serial, and status to badges table
    - Add badge configuration options to tenants table
    - Create badge_status enum

  3. Access Control System Integration
    - Add civ_piv_card_info to visitors table
    - Add acs_provisioning_status to visits table
    - Create acs_configurations table for external ACS systems
    - Create necessary enums for ACS integration

  4. Security
    - Enable RLS on new tables
    - Add appropriate indexes for performance
*/

-- 1. QR Code Integration for Pre-Registration & Check-in
-- Add qr_code_token and qr_code_url to invitations table
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invitations' AND column_name = 'qr_code_token') THEN
    ALTER TABLE invitations ADD COLUMN qr_code_token UUID;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invitations' AND column_name = 'qr_code_url') THEN
    ALTER TABLE invitations ADD COLUMN qr_code_url TEXT;
  END IF;
END $$;

-- Add index for qr_code_token for quick lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_invitations_qr_code_token 
ON invitations(qr_code_token) WHERE qr_code_token IS NOT NULL;

-- Add unique constraint for qr_code_token to prevent duplicates
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'invitations_qr_code_token_unique'
  ) THEN
    ALTER TABLE invitations ADD CONSTRAINT invitations_qr_code_token_unique 
    UNIQUE (qr_code_token);
  END IF;
EXCEPTION
  WHEN duplicate_table THEN null;
END $$;

-- 2. Enhanced Badge Issuance: CIV/PIV-I Visitor Badges
-- Define badge_status enum
DO $$ BEGIN
  CREATE TYPE badge_status AS ENUM ('issued', 'returned', 'lost', 'deactivated');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add badge_type, civ_piv_i_serial, and status to badges table
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'badges' AND column_name = 'badge_type') THEN
    ALTER TABLE badges ADD COLUMN badge_type VARCHAR(50) DEFAULT 'printed';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'badges' AND column_name = 'civ_piv_i_serial') THEN
    ALTER TABLE badges ADD COLUMN civ_piv_i_serial TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'badges' AND column_name = 'status') THEN
    ALTER TABLE badges ADD COLUMN status badge_status DEFAULT 'issued';
  END IF;
END $$;

-- Update existing badges to have proper status based on is_active
UPDATE badges 
SET status = CASE 
  WHEN is_active = TRUE THEN 'issued'::badge_status 
  ELSE 'deactivated'::badge_status 
END 
WHERE status IS NULL;

-- Add badge_issuance_options and default_badge_type to tenants table
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenants' AND column_name = 'badge_issuance_options') THEN
    ALTER TABLE tenants ADD COLUMN badge_issuance_options JSONB DEFAULT '["printed"]'::jsonb;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenants' AND column_name = 'default_badge_type') THEN
    ALTER TABLE tenants ADD COLUMN default_badge_type VARCHAR(50) DEFAULT 'printed';
  END IF;
END $$;

-- Add index for civ_piv_i_serial for quick lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_badges_civ_piv_i_serial 
ON badges(civ_piv_i_serial) WHERE civ_piv_i_serial IS NOT NULL;

-- 3. Integration with External Access Control Systems (ACS) for FICAM Compliance
-- Add civ_piv_card_info to visitors table
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'visitors' AND column_name = 'civ_piv_card_info') THEN
    ALTER TABLE visitors ADD COLUMN civ_piv_card_info JSONB;
  END IF;
END $$;

-- Define acs_provisioning_status enum
DO $$ BEGIN
  CREATE TYPE acs_provisioning_status AS ENUM ('pending', 'provisioned', 'failed', 'not_required');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add acs_provisioning_status to visits table
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'visits' AND column_name = 'acs_provisioning_status') THEN
    ALTER TABLE visits ADD COLUMN acs_provisioning_status acs_provisioning_status DEFAULT 'not_required';
  END IF;
END $$;

-- Define acs_provider_type enum
DO $$ BEGIN
  CREATE TYPE acs_provider_type AS ENUM ('lenel', 's2_security', 'custom', 'hid_global', 'honeywell');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create acs_configurations table
CREATE TABLE IF NOT EXISTS acs_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  acs_type acs_provider_type NOT NULL,
  api_endpoint TEXT,
  credentials JSONB, -- Note: Credentials should be encrypted at rest in application layer
  configuration JSONB, -- Additional configuration options specific to each ACS type
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, name)
);

-- Enable RLS on acs_configurations table
ALTER TABLE acs_configurations ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for acs_configurations
CREATE POLICY "Users can access ACS configurations for their tenant"
  ON acs_configurations
  FOR ALL
  TO authenticated
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

-- Add indexes for acs_configurations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_acs_configurations_tenant_id 
ON acs_configurations(tenant_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_acs_configurations_acs_type 
ON acs_configurations(acs_type);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_acs_configurations_active 
ON acs_configurations(tenant_id, is_active) WHERE is_active = TRUE;

-- Add indexes for new visitor and visit columns
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_visitors_civ_piv_card_info 
ON visitors USING GIN(civ_piv_card_info) WHERE civ_piv_card_info IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_visits_acs_provisioning_status 
ON visits(acs_provisioning_status);

-- Add comments to document the new columns and tables
COMMENT ON COLUMN invitations.qr_code_token IS 'Unique token embedded in QR code for secure check-in';
COMMENT ON COLUMN invitations.qr_code_url IS 'Full URL that the QR code points to for check-in';

COMMENT ON COLUMN badges.badge_type IS 'Type of badge issued: printed, civ_piv_i, etc.';
COMMENT ON COLUMN badges.civ_piv_i_serial IS 'Serial number of CIV/PIV-I badge if applicable';
COMMENT ON COLUMN badges.status IS 'Current status of the badge: issued, returned, lost, deactivated';

COMMENT ON COLUMN tenants.badge_issuance_options IS 'Array of available badge types for this tenant';
COMMENT ON COLUMN tenants.default_badge_type IS 'Default badge type to issue for this tenant';

COMMENT ON COLUMN visitors.civ_piv_card_info IS 'Extracted CIV/PIV card information (masked card number, EDIPI, UPN, etc.)';
COMMENT ON COLUMN visits.acs_provisioning_status IS 'Status of access provisioning in external Access Control System';

COMMENT ON TABLE acs_configurations IS 'Configuration for external Access Control Systems integration';
COMMENT ON COLUMN acs_configurations.acs_type IS 'Type of ACS system (lenel, s2_security, custom, etc.)';
COMMENT ON COLUMN acs_configurations.credentials IS 'Encrypted credentials for ACS system access';
COMMENT ON COLUMN acs_configurations.configuration IS 'Additional configuration options specific to each ACS type';

-- Create function to generate QR code token
CREATE OR REPLACE FUNCTION generate_qr_code_token()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN gen_random_uuid();
END;
$$;

-- Create function to validate QR code token and get invitation details
CREATE OR REPLACE FUNCTION get_invitation_by_qr_token(token UUID)
RETURNS TABLE (
  invitation_id UUID,
  visitor_id UUID,
  host_id UUID,
  facility_id UUID,
  purpose TEXT,
  scheduled_date DATE,
  scheduled_start_time TIME,
  scheduled_end_time TIME,
  visitor_first_name TEXT,
  visitor_last_name TEXT,
  visitor_email TEXT,
  visitor_company TEXT,
  visitor_photo_url TEXT,
  host_name TEXT,
  facility_name TEXT,
  pre_registration_status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    i.id as invitation_id,
    i.visitor_id,
    i.host_id,
    i.facility_id,
    i.purpose,
    i.scheduled_date,
    i.scheduled_start_time,
    i.scheduled_end_time,
    v.first_name as visitor_first_name,
    v.last_name as visitor_last_name,
    v.email as visitor_email,
    v.company as visitor_company,
    v.photo_url as visitor_photo_url,
    p.full_name as host_name,
    f.name as facility_name,
    i.pre_registration_status
  FROM invitations i
  LEFT JOIN visitors v ON i.visitor_id = v.id
  JOIN hosts h ON i.host_id = h.id
  JOIN profiles p ON h.profile_id = p.id
  JOIN facilities f ON i.facility_id = f.id
  WHERE i.qr_code_token = token
  AND i.status = 'approved'
  AND i.qr_code_token IS NOT NULL;
END;
$$;

-- Create function to update badge status
CREATE OR REPLACE FUNCTION update_badge_status(
  badge_id UUID,
  new_status badge_status
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE badges 
  SET 
    status = new_status,
    returned_at = CASE WHEN new_status = 'returned' THEN NOW() ELSE returned_at END,
    updated_at = NOW()
  WHERE id = badge_id;
  
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_invitation_dates()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  current_date_time timestamptz := NOW();
  scheduled_date_time timestamptz;
  current_date_only date := (NOW() AT TIME ZONE 'UTC')::date;
  scheduled_date_only date := NEW.scheduled_date;
BEGIN
  -- Log the validation attempt for debugging
  RAISE NOTICE 'Validating invitation dates: scheduled_date=%, scheduled_start_time=%, current_date=%',
    NEW.scheduled_date, NEW.scheduled_start_time, current_date_only;

  -- For inserts, validate that the scheduled date is not in the past
  IF TG_OP = 'INSERT' THEN
    -- Combine scheduled date and time for a full timestamp comparison
    IF NEW.scheduled_start_time IS NOT NULL THEN
      scheduled_date_time := (NEW.scheduled_date || ' ' || NEW.scheduled_start_time)::timestamptz;
    ELSE
      -- If no specific time, consider the start of the scheduled date in UTC
      scheduled_date_time := (NEW.scheduled_date || ' 00:00:00')::timestamptz;
    END IF;

    -- Compare the full timestamp
    IF scheduled_date_time < current_date_time THEN
      -- Check for the specific timezone rollover scenario:
      -- If scheduled date is exactly one day before current UTC date,
      -- AND if the scheduled time (when considered on the current UTC date) is NOT in the past,
      -- then allow it. This handles cases where local "today" is server's "yesterday".
      IF scheduled_date_only < current_date_only THEN
        DECLARE
          hypothetical_scheduled_time_on_current_date timestamptz;
        BEGIN
          IF NEW.scheduled_start_time IS NOT NULL THEN
            hypothetical_scheduled_time_on_current_date := (current_date_only || ' ' || NEW.scheduled_start_time)::timestamptz;
          ELSE
            hypothetical_scheduled_time_on_current_date := (current_date_only || ' 00:00:00')::timestamptz;
          END IF;

          IF hypothetical_scheduled_time_on_current_date >= current_date_time THEN
            RAISE NOTICE 'Allowed past date due to timezone rollover: scheduled_date_time=%, current_date_time=%',
              scheduled_date_time, current_date_time;
            RETURN NEW; -- Allow the operation
          END IF;
        END;
      END IF;

      -- If not the timezone rollover scenario, or if the hypothetical time is also in the past,
      -- then raise the exception.
      RAISE EXCEPTION 'Cannot create an invitation for a past date or time (scheduled: %, current UTC: %)',
        scheduled_date_time, current_date_time;
    END IF;
  END IF;

  -- Validate recurrence end date if provided
  IF NEW.recurrence_type <> 'none' AND NEW.recurrence_type IS NOT NULL AND NEW.recurrence_end_date IS NOT NULL THEN
    -- Check if recurrence end date is before scheduled date
    IF NEW.recurrence_end_date < NEW.scheduled_date THEN
      RAISE EXCEPTION 'Recurrence end date must be after the scheduled date';
    END IF;
  END IF;

  -- For weekly recurrence, ensure at least one day of the week is selected
  IF NEW.recurrence_type = 'weekly' AND
     (NEW.recurrence_days_of_week IS NULL OR array_length(NEW.recurrence_days_of_week, 1) IS NULL OR array_length(NEW.recurrence_days_of_week, 1) = 0) THEN
    RAISE EXCEPTION 'Weekly recurrence requires at least one day of the week to be selected';
  END IF;

  RETURN NEW;
END;
$function$
;
