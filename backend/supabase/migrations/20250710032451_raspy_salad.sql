/*
  # Add Early Check-in Settings to Tenants

  1. New Columns
    - Add `early_checkin_minutes` column to tenants table
    - This column defines how many minutes before the scheduled time a visitor can check in

  2. Changes
    - Set default value to 0 (no early check-in allowed)
    - Add comment to document the purpose of this field

  3. Security
    - Maintain existing RLS policies
*/

-- Add early_checkin_minutes column to tenants table if it doesn't exist
ALTER TABLE tenants
ADD COLUMN IF NOT EXISTS early_checkin_minutes INTEGER DEFAULT 0;

-- Add comment to document the purpose of this field
COMMENT ON COLUMN tenants.early_checkin_minutes IS 'Number of minutes before scheduled visit start time that check-in is allowed.';