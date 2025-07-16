-- Add validation settings to tenants table
ALTER TABLE tenants
ADD COLUMN IF NOT EXISTS checkin_grace_period_hours INTEGER DEFAULT 24;

-- Add comment to document the purpose of this field
COMMENT ON COLUMN tenants.checkin_grace_period_hours IS 'Number of hours after scheduled visit time that check-in is still allowed.';