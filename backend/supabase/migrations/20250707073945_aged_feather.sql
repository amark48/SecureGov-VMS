/*
  # Fix Role Permissions API Endpoint

  1. Changes
    - Update the get_role_permissions function to handle role IDs
    - Add a new endpoint to get permissions by role ID
    - Fix the role_permissions table structure

  2. Security
    - Maintain existing RLS policies
*/

-- Update the get_role_permissions function to handle role IDs
CREATE OR REPLACE FUNCTION get_role_permissions(role_id uuid)
RETURNS SETOF text AS $$
BEGIN
  -- Return permissions for the specified role ID
  RETURN QUERY 
    SELECT p.name 
    FROM permissions p
    JOIN role_permissions rp ON p.id = rp.permission_id
    WHERE rp.role_id = role_id;
END;
$$ LANGUAGE plpgsql;

-- Add comment to document the function
COMMENT ON FUNCTION get_role_permissions(uuid) IS 'Get all permissions for a role by ID';

-- Ensure role_permissions table has the correct structure
DO $$
BEGIN
  -- Make sure role_id is NOT NULL
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'role_permissions' AND column_name = 'role_id'
  ) THEN
    -- Try to make role_id NOT NULL
    BEGIN
      ALTER TABLE role_permissions 
      ALTER COLUMN role_id SET NOT NULL;
    EXCEPTION WHEN OTHERS THEN
      -- If that fails, it's probably because there are NULL values
      RAISE NOTICE 'Could not set role_id to NOT NULL, there may be NULL values';
    END;
  END IF;

  -- Ensure the primary key constraint exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'role_permissions_pkey'
  ) THEN
    -- Try to add the primary key constraint
    BEGIN
      ALTER TABLE role_permissions 
      ADD PRIMARY KEY (role_id, permission_id);
    EXCEPTION WHEN OTHERS THEN
      -- If that fails, try adding a unique constraint instead
      BEGIN
        ALTER TABLE role_permissions 
        ADD CONSTRAINT role_permissions_role_id_permission_id_key 
        UNIQUE (role_id, permission_id);
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Could not add primary key or unique constraint to role_permissions';
      END;
    END;
  END IF;
END $$;

-- Update the API endpoint function to handle role IDs
CREATE OR REPLACE FUNCTION get_permissions_by_role_id(p_role_id uuid)
RETURNS TABLE (name text, description text, resource text, action text) AS $$
BEGIN
  RETURN QUERY
    SELECT p.name, p.description, p.resource, p.action
    FROM permissions p
    JOIN role_permissions rp ON p.id = rp.permission_id
    WHERE rp.role_id = p_role_id;
END;
$$ LANGUAGE plpgsql;

-- Add comment to document the function
COMMENT ON FUNCTION get_permissions_by_role_id IS 'Get all permissions for a role by ID';