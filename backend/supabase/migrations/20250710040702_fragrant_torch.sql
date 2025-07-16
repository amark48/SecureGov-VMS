/*
  # Add Grace Period for Past Invitations

  1. New Columns
    - Add `grace_period_days` column to tenants table
    - This will control how many days after the scheduled date a visitor can still check in

  2. Changes
    - Set default value to 0 (no grace period)
    - Add comment to document the purpose of this field

  3. Security
    - Maintain existing RLS policies
*/

-- Add grace period column to tenants table
ALTER TABLE tenants
ADD COLUMN IF NOT EXISTS grace_period_days INTEGER DEFAULT 0;

-- Add comment to document the purpose of this field
COMMENT ON COLUMN tenants.grace_period_days IS 'Number of days after scheduled date that visitors can still check in';

-- Update any existing records with default value
UPDATE tenants
SET grace_period_days = 0
WHERE grace_period_days IS NULL;