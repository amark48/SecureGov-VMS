/*
  # Add Visitor Nationality and Pre-registration Fields

  1. New Columns
    - Add `nationality` and `ssn` columns to the `visitors` table
    - Add `metadata` column to the `invitations` table to store temporary visitor data
    - Add `pre_registration_required`, `pre_registration_link`, and `pre_registration_status` columns to both `invitations` and `visits` tables

  2. Changes
    - Update existing queries to include these new fields
    - Set default values for new columns to ensure data integrity
*/

-- Add nationality and ssn columns to visitors table
ALTER TABLE visitors ADD COLUMN IF NOT EXISTS nationality text;
ALTER TABLE visitors ADD COLUMN IF NOT EXISTS ssn text;

-- Add metadata column to invitations table for temporary visitor data
ALTER TABLE invitations ADD COLUMN IF NOT EXISTS metadata jsonb;

-- Add pre-registration fields to invitations table
ALTER TABLE invitations ADD COLUMN IF NOT EXISTS pre_registration_required boolean DEFAULT false;
ALTER TABLE invitations ADD COLUMN IF NOT EXISTS pre_registration_link text;
ALTER TABLE invitations ADD COLUMN IF NOT EXISTS pre_registration_status text;

-- Add pre-registration fields to visits table
ALTER TABLE visits ADD COLUMN IF NOT EXISTS pre_registration_required boolean DEFAULT false;
ALTER TABLE visits ADD COLUMN IF NOT EXISTS pre_registration_link text;
ALTER TABLE visits ADD COLUMN IF NOT EXISTS pre_registration_status text;

-- Add comments to document the purpose of these fields
COMMENT ON COLUMN visitors.nationality IS 'Visitor nationality for security screening';
COMMENT ON COLUMN visitors.ssn IS 'Last 4 digits of SSN for government facility access';
COMMENT ON COLUMN invitations.metadata IS 'Temporary storage for visitor data before registration';
COMMENT ON COLUMN invitations.pre_registration_required IS 'Whether visitor needs to pre-register';
COMMENT ON COLUMN invitations.pre_registration_link IS 'Unique link for visitor pre-registration';
COMMENT ON COLUMN invitations.pre_registration_status IS 'Status of pre-registration process';
COMMENT ON COLUMN visits.pre_registration_required IS 'Whether visitor needs to pre-register';
COMMENT ON COLUMN visits.pre_registration_link IS 'Unique link for visitor pre-registration';
COMMENT ON COLUMN visits.pre_registration_status IS 'Status of pre-registration process';