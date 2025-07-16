/*
  # Fix Auto Checkout Time Format

  1. Changes
    - Modify auto_checkout_time column to use TIME type without timezone
    - Update existing records to ensure proper time format
    - Add validation function to ensure proper time format

  2. Security
    - Maintain existing RLS policies
*/

-- Modify auto_checkout_time column to ensure proper time format
ALTER TABLE tenants
ALTER COLUMN auto_checkout_time TYPE TIME USING auto_checkout_time::TIME,
ALTER COLUMN auto_checkout_time SET DEFAULT '17:00:00'::TIME;

-- Update any existing records with invalid time format
UPDATE tenants
SET auto_checkout_time = '17:00:00'::TIME
WHERE auto_checkout_time IS NULL OR auto_checkout_time::TEXT NOT LIKE '%:%:%';

-- Create a function to validate time format
CREATE OR REPLACE FUNCTION validate_time_format(time_str TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  -- Check if the string is a valid time format (HH:MM:SS)
  RETURN time_str ~ '^([0-1]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$';
EXCEPTION WHEN OTHERS THEN
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- Add comment to document the purpose of this field
COMMENT ON COLUMN tenants.auto_checkout_time IS 'Time of day when visitors are automatically checked out (HH:MM:SS format without timezone)';