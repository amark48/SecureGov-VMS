-- Add check-in/check-out settings to tenants table
ALTER TABLE tenants
ADD COLUMN IF NOT EXISTS early_checkin_minutes INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS auto_checkout_time TIME,
ADD COLUMN IF NOT EXISTS auto_checkout_enabled BOOLEAN DEFAULT FALSE;

-- Add comments to document the purpose of these fields
COMMENT ON COLUMN tenants.early_checkin_minutes IS 'Number of minutes before scheduled visit start time that check-in is allowed.';
COMMENT ON COLUMN tenants.auto_checkout_time IS 'Time of day for automatic check-out of visitors.';
COMMENT ON COLUMN tenants.auto_checkout_enabled IS 'Flag to enable/disable automatic check-out for the tenant.';```
