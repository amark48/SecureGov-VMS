/*
  # Fix Role Permissions API Endpoint

  1. Changes
    - Update the get_role_permissions function to handle role names
    - Add a new endpoint to get permissions by role name
    - Fix the role_permissions table structure

  2. Security
    - Maintain existing RLS policies
*/

-- Update the get_role_permissions function to handle role names
CREATE OR REPLACE FUNCTION get_role_permissions(role_name text)
RETURNS SETOF text AS $$
DECLARE
  role_id uuid;
BEGIN
  -- Get the role ID from the name
  SELECT id INTO role_id FROM roles WHERE name = role_name;
  
  -- If role ID is found, return permissions for that role
  IF role_id IS NOT NULL THEN
    RETURN QUERY 
      SELECT p.name 
      FROM permissions p
      JOIN role_permissions rp ON p.id = rp.permission_id
      WHERE rp.role_id = role_id;
  ELSE
    -- If role ID is not found, check if it's a system role
    RETURN QUERY 
      SELECT p.name 
      FROM permissions p
      JOIN role_permissions rp ON p.id = rp.permission_id
      WHERE rp.role_name = role_name;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Add comment to document the function
COMMENT ON FUNCTION get_role_permissions IS 'Get all permissions for a role by name';

-- Ensure role_permissions table has both role_id and role_name columns for backward compatibility
DO $$
BEGIN
  -- Add role_name column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'role_permissions' AND column_name = 'role_name'
  ) THEN
    ALTER TABLE role_permissions ADD COLUMN role_name text;
  END IF;
  
  -- Update role_name from role_id where possible
  UPDATE role_permissions rp
  SET role_name = r.name
  FROM roles r
  WHERE rp.role_id = r.id AND rp.role_name IS NULL;
  
  -- Ensure primary key constraint exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'role_permissions_pkey'
  ) THEN
    -- If role_id is the primary key column
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'role_permissions' AND column_name = 'role_id'
    ) THEN
      -- Add primary key on (role_id, permission_id)
      ALTER TABLE role_permissions 
      ADD PRIMARY KEY (role_id, permission_id);
    ELSE
      -- Add primary key on (role_name, permission_id)
      ALTER TABLE role_permissions 
      ADD PRIMARY KEY (role_name, permission_id);
    END IF;
  END IF;
END $$;