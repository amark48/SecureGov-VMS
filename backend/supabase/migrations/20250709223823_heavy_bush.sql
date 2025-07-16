/*
  # Add Check-in/Checkout Settings to Tenants

  1. New Columns
    - Add `early_checkin_minutes` column to tenants table
    - Add `auto_checkout_time` column to tenants table
    - Add `auto_checkout_enabled` column to tenants table

  2. Changes
    - Update existing tenants with default values
    - Add comments to document the purpose of these fields

  3. Security
    - Maintain existing RLS policies
*/

-- Add check-in/checkout settings columns to tenants table
ALTER TABLE tenants
ADD COLUMN IF NOT EXISTS early_checkin_minutes INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS auto_checkout_time TIME DEFAULT '17:00',
ADD COLUMN IF NOT EXISTS auto_checkout_enabled BOOLEAN DEFAULT false;

-- Add comments to document the purpose of these fields
COMMENT ON COLUMN tenants.early_checkin_minutes IS 'Number of minutes before scheduled time that visitors can check in';
COMMENT ON COLUMN tenants.auto_checkout_time IS 'Time of day when visitors are automatically checked out';
COMMENT ON COLUMN tenants.auto_checkout_enabled IS 'Whether automatic checkout is enabled';