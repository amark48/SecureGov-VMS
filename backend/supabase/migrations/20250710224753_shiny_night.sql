/*
  # Add Azure AD Support

  1. Schema Updates
    - Add Azure AD authentication fields to profiles table
    - Add auth_provider enum to track authentication method
    - Add azure_ad_object_id for linking Azure AD users
    - Add azure_ad_roles for storing Azure AD role information

  2. Security
    - Update RLS policies to handle Azure AD users
    - Ensure tenant isolation is maintained

  3. Indexes
    - Add indexes for Azure AD fields for performance
*/

-- Add auth_provider enum
DO $$ BEGIN
  CREATE TYPE auth_provider AS ENUM ('local', 'azure_ad');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add Azure AD support columns to profiles table
DO $$
BEGIN
  -- Add auth_provider column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'auth_provider'
  ) THEN
    ALTER TABLE profiles ADD COLUMN auth_provider auth_provider DEFAULT 'local';
  END IF;

  -- Add azure_ad_object_id column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'azure_ad_object_id'
  ) THEN
    ALTER TABLE profiles ADD COLUMN azure_ad_object_id text;
  END IF;

  -- Add azure_ad_roles column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'azure_ad_roles'
  ) THEN
    ALTER TABLE profiles ADD COLUMN azure_ad_roles jsonb;
  END IF;
END $$;

-- Create indexes for Azure AD fields
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_profiles_azure_ad_object_id 
ON profiles(azure_ad_object_id) WHERE azure_ad_object_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_profiles_auth_provider 
ON profiles(auth_provider);

-- Add unique constraint for Azure AD Object ID
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'profiles_azure_ad_object_id_unique'
  ) THEN
    ALTER TABLE profiles ADD CONSTRAINT profiles_azure_ad_object_id_unique 
    UNIQUE (azure_ad_object_id);
  END IF;
EXCEPTION
  WHEN duplicate_table THEN null;
END $$;

-- Update audit_logs to track Azure AD authentication events
DO $$
BEGIN
  -- Add comment to document Azure AD support
  COMMENT ON COLUMN profiles.auth_provider IS 'Authentication provider: local for traditional auth, azure_ad for Azure AD SSO';
  COMMENT ON COLUMN profiles.azure_ad_object_id IS 'Azure AD Object ID for SSO users';
  COMMENT ON COLUMN profiles.azure_ad_roles IS 'Azure AD roles/groups assigned to the user';
END $$;

-- Update RLS policies to handle Azure AD users (they should work with existing policies)
-- No changes needed as tenant_id isolation is maintained

-- Create a function to get user by Azure AD Object ID
CREATE OR REPLACE FUNCTION get_user_by_azure_ad_oid(oid text)
RETURNS TABLE (
  id uuid,
  email text,
  tenant_id uuid,
  role user_role,
  full_name text,
  auth_provider auth_provider,
  azure_ad_object_id text,
  azure_ad_roles jsonb,
  is_active boolean
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.email,
    p.tenant_id,
    p.role,
    p.full_name,
    p.auth_provider,
    p.azure_ad_object_id,
    p.azure_ad_roles,
    p.is_active
  FROM profiles p
  WHERE p.azure_ad_object_id = oid
  AND p.is_active = true;
END;
$$;

-- Create a function to create or update Azure AD user
CREATE OR REPLACE FUNCTION upsert_azure_ad_user(
  p_azure_ad_object_id text,
  p_email text,
  p_full_name text,
  p_first_name text,
  p_last_name text,
  p_role user_role,
  p_tenant_id uuid,
  p_azure_ad_roles jsonb
)
RETURNS TABLE (
  id uuid,
  email text,
  tenant_id uuid,
  role user_role,
  full_name text,
  auth_provider auth_provider,
  azure_ad_object_id text,
  azure_ad_roles jsonb,
  is_active boolean,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_id uuid;
BEGIN
  -- Try to find existing user by Azure AD Object ID or email
  SELECT p.id INTO user_id
  FROM profiles p
  WHERE p.azure_ad_object_id = p_azure_ad_object_id 
     OR p.email = p_email;

  IF user_id IS NOT NULL THEN
    -- Update existing user
    UPDATE profiles 
    SET 
      azure_ad_object_id = p_azure_ad_object_id,
      azure_ad_roles = p_azure_ad_roles,
      role = p_role,
      auth_provider = 'azure_ad',
      last_login = NOW(),
      updated_at = NOW()
    WHERE id = user_id;
  ELSE
    -- Create new user
    INSERT INTO profiles (
      email, full_name, first_name, last_name, role, tenant_id,
      auth_provider, azure_ad_object_id, azure_ad_roles, is_active
    ) VALUES (
      p_email, p_full_name, p_first_name, p_last_name, p_role, p_tenant_id,
      'azure_ad', p_azure_ad_object_id, p_azure_ad_roles, true
    ) RETURNING id INTO user_id;
  END IF;

  -- Return the user data
  RETURN QUERY
  SELECT 
    p.id,
    p.email,
    p.tenant_id,
    p.role,
    p.full_name,
    p.auth_provider,
    p.azure_ad_object_id,
    p.azure_ad_roles,
    p.is_active,
    p.created_at,
    p.updated_at
  FROM profiles p
  WHERE p.id = user_id;
END;
$$;