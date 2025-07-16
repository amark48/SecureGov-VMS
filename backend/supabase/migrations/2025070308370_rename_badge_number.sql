-- Add columns to tenants table for employee number generation
ALTER TABLE tenants
ADD COLUMN IF NOT EXISTS tenant_prefix TEXT,
ADD COLUMN IF NOT EXISTS next_employee_sequence INTEGER DEFAULT 1;

-- Populate tenant_prefix for existing tenants
-- This will take the first 3 characters of the tenant name, uppercase them,
-- and replace any non-alphanumeric characters with an empty string.
UPDATE tenants
SET tenant_prefix = UPPER(SUBSTRING(REGEXP_REPLACE(name, '[^a-zA-Z0-9]', ''), 1, 3))
WHERE tenant_prefix IS NULL;

-- Ensure tenant_prefix is not null after population
ALTER TABLE tenants ALTER COLUMN tenant_prefix SET NOT NULL;

-- Rename badge_number to employee_number in the profiles table
ALTER TABLE profiles
RENAME COLUMN badge_number TO employee_number;

-- Drop the old unique constraint on badge_number if it exists
ALTER TABLE profiles
DROP CONSTRAINT IF EXISTS profiles_badge_number_key;

-- Add a new unique constraint on (tenant_id, employee_number) in the profiles table
-- This ensures that employee numbers are unique within each tenant.
-- Note: This constraint allows NULL values for employee_number.
-- If you want employee_number to be mandatory and always generated,
-- you would need to ensure all existing NULL values are populated
-- before making the column NOT NULL.
ALTER TABLE profiles
ADD CONSTRAINT unique_employee_number_per_tenant UNIQUE (tenant_id, employee_number);

-- Update any existing indexes that might reference badge_number
-- You might need to manually check and drop/recreate indexes if they were not automatically updated.
-- Example: DROP INDEX IF EXISTS idx_profiles_badge_number;
-- Example: CREATE INDEX IF NOT EXISTS idx_profiles_employee_number ON profiles(employee_number);
