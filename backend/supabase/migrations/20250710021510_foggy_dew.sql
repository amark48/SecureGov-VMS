/*
  # Fix Auto Checkout Time Format

  1. Changes
    - Update auto_checkout_time column to use TIME WITH TIME ZONE type
    - Ensure proper time format validation in the backend
    - Add default value of '17:00:00'

  2. Security
    - Maintain existing RLS policies
*/

-- Modify auto_checkout_time column to ensure proper time format
ALTER TABLE tenants
ALTER COLUMN auto_checkout_time TYPE TIME WITH TIME ZONE USING auto_checkout_time::TIME WITH TIME ZONE,
ALTER COLUMN auto_checkout_time SET DEFAULT '17:00:00'::TIME WITH TIME ZONE;

-- Update any existing records with invalid time format
UPDATE tenants
SET auto_checkout_time = '17:00:00'::TIME WITH TIME ZONE
WHERE auto_checkout_time IS NULL OR auto_checkout_time::TEXT NOT LIKE '%:%:%';

-- Add comment to document the purpose of this field
COMMENT ON COLUMN tenants.auto_checkout_time IS 'Time of day when visitors are automatically checked out (HH:MM:SS format)';