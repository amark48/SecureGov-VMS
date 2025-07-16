-- Add custom_departments column to tenants table if it doesn't exist
ALTER TABLE tenants
ADD COLUMN IF NOT EXISTS custom_departments TEXT[] DEFAULT '{}';

-- Add comment to document the purpose of this field
COMMENT ON COLUMN tenants.custom_departments IS 'List of custom departments for this tenant';