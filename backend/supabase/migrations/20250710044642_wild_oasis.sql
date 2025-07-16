-- Add check-in grace period hours column to tenants table
ALTER TABLE tenants
ADD COLUMN IF NOT EXISTS checkin_grace_period_hours INTEGER DEFAULT 24;

-- Add comment to document the purpose of this field
COMMENT ON COLUMN tenants.checkin_grace_period_hours IS 'Number of hours after scheduled visit time that check-in is still allowed.';

-- Update any existing tenants to use 24 hours as the default grace period
UPDATE tenants
SET checkin_grace_period_hours = 24
WHERE checkin_grace_period_hours IS NULL;