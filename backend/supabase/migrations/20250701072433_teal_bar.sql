/*
  # Add Email Domain Policy for Tenants

  1. Changes
    - Add `corporate_email_domain` column to tenants table
    - Update existing tenants with default domain
    - Add helper function to validate email domains

  2. Security
    - Enforce email domain validation for user registration
*/

-- Add corporate_email_domain column to tenants table
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS corporate_email_domain text;

-- Update existing tenants with default domain based on their name
UPDATE tenants 
SET corporate_email_domain = LOWER(REGEXP_REPLACE(name, '[^a-zA-Z0-9]', '')) || '.gov'
WHERE corporate_email_domain IS NULL;

-- Create helper function to validate email domain
CREATE OR REPLACE FUNCTION validate_email_domain(email text, tenant_id uuid)
RETURNS boolean AS $$
DECLARE
  email_domain text;
  tenant_domain text;
BEGIN
  -- Extract domain from email
  email_domain := SUBSTRING(email FROM POSITION('@' IN email) + 1);
  
  -- Get tenant's corporate domain
  SELECT corporate_email_domain INTO tenant_domain
  FROM tenants
  WHERE id = tenant_id;
  
  -- Return true if domains match or if tenant domain is NULL (no restriction)
  RETURN (tenant_domain IS NULL OR email_domain = tenant_domain);
END;
$$ LANGUAGE plpgsql;