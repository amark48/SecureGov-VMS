/*
  # Enhanced User Management System

  1. New Columns
    - Add `first_name` and `last_name` columns to the `profiles` table
    - Add `custom_departments` column to the `tenants` table to store department list
    - Add `device_tokens` column to the `profiles` table for push notifications

  2. Changes
    - Update existing profiles to split full_name into first_name and last_name
    - Add account_created notification template

  3. Security
    - Maintain existing RLS policies
*/

-- Add first_name and last_name columns to profiles table
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS first_name TEXT,
ADD COLUMN IF NOT EXISTS last_name TEXT,
ADD COLUMN IF NOT EXISTS device_tokens TEXT[] DEFAULT '{}';

-- Add custom_departments column to tenants table
ALTER TABLE tenants
ADD COLUMN IF NOT EXISTS custom_departments TEXT[] DEFAULT '{}';

-- Add comments to document the purpose of these fields
COMMENT ON COLUMN profiles.first_name IS 'User first name';
COMMENT ON COLUMN profiles.last_name IS 'User last name';
COMMENT ON COLUMN profiles.device_tokens IS 'Device tokens for push notifications';
COMMENT ON COLUMN tenants.custom_departments IS 'List of custom departments for this tenant';

-- Split existing full_name values into first_name and last_name
-- This is a best-effort approach that assumes the first word is the first name and the rest is the last name
DO $$
BEGIN
  UPDATE profiles
  SET 
    first_name = CASE 
      WHEN position(' ' in full_name) > 0 
      THEN substring(full_name from 1 for position(' ' in full_name) - 1)
      ELSE full_name
    END,
    last_name = CASE 
      WHEN position(' ' in full_name) > 0 
      THEN substring(full_name from position(' ' in full_name) + 1)
      ELSE ''
    END
  WHERE first_name IS NULL OR last_name IS NULL;
END $$;

-- Add account_created notification template for the default tenant
DO $$
DECLARE
  default_tenant_id uuid;
BEGIN
  -- Get the default tenant ID
  SELECT id INTO default_tenant_id FROM tenants WHERE name = 'Default Tenant';
  
  IF default_tenant_id IS NOT NULL THEN
    -- Insert account created email template
    INSERT INTO notification_templates (
      tenant_id, name, subject, body, type, event, is_default, is_active
    ) VALUES (
      default_tenant_id,
      'Account Created Notification',
      'Your account has been created on {{organization_name}}',
      'Dear {{user_name}},\n\nYour account has been created on {{organization_name}}.\n\nEmail: {{user_email}}\nRole: {{user_role}}\nTemporary Password: {{temp_password}}\n\nPlease log in and change your password as soon as possible.\n\nThank you,\n{{organization_name}}',
      'email',
      'account_created',
      true,
      true
    )
    ON CONFLICT (tenant_id, type, event, is_default) DO NOTHING;
    
    -- Insert account created SMS template
    INSERT INTO notification_templates (
      tenant_id, name, subject, body, type, event, is_default, is_active
    ) VALUES (
      default_tenant_id,
      'Account Created SMS',
      NULL,
      'Your {{organization_name}} account has been created. Email: {{user_email}}, Temp password: {{temp_password}}. Please log in and change your password.',
      'sms',
      'account_created',
      true,
      true
    )
    ON CONFLICT (tenant_id, type, event, is_default) DO NOTHING;
  END IF;
END $$;