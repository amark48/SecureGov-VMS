-- Add corporate_email_domain to tenants table
ALTER TABLE tenants ADD COLUMN corporate_email_domain text;

-- Optional: Populate existing tenants with a default domain or null
UPDATE tenants SET corporate_email_domain = 'default.com' WHERE corporate_email_domain IS NULL;

-- Optional: Make the column NOT NULL after populating
ALTER TABLE tenants ALTER COLUMN corporate_email_domain SET NOT NULL;
