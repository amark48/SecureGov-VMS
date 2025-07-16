/*
  # Change Grace Period from Days to Hours

  1. Changes
    - Add `grace_period_hours` column to tenants table
    - Convert existing `grace_period_days` values to hours (multiply by 24)
    - Update comments to reflect the change

  2. Security
    - Maintain existing RLS policies
*/

-- Add grace_period_hours column to tenants table
ALTER TABLE tenants
ADD COLUMN IF NOT EXISTS grace_period_hours INTEGER DEFAULT 0;

-- Convert existing grace_period_days values to hours (multiply by 24)
UPDATE tenants
SET grace_period_hours = grace_period_days * 24
WHERE grace_period_days IS NOT NULL;

-- Add comment to document the purpose of this field
COMMENT ON COLUMN tenants.grace_period_hours IS 'Number of hours after scheduled date that visitors can still check in';

-- Update any existing records with default value
UPDATE tenants
SET grace_period_hours = 0
WHERE grace_period_hours IS NULL;