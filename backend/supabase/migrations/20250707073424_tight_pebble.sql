/*
  # Fix Role Permissions Table Structure

  1. Changes
    - Add updated_at column to role_permissions table if it doesn't exist
    - Fix the structure of the role_permissions table to ensure it has the correct columns
    - Update the trigger for updated_at to work correctly
    - Fix the migration errors related to role_name and role_id columns

  2. Security
    - Maintain existing RLS policies
*/

-- Add updated_at column to role_permissions table if it doesn't exist
ALTER TABLE role_permissions 
ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Add comment to document the purpose of this field
COMMENT ON COLUMN role_permissions.updated_at IS 'Timestamp when the permission assignment was last updated';

-- Ensure the trigger for updated_at works correctly
DROP TRIGGER IF EXISTS update_role_permissions_updated_at ON role_permissions;
CREATE TRIGGER update_role_permissions_updated_at 
BEFORE UPDATE ON role_permissions 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Check if role_permissions table has role_name column
DO $$
BEGIN
  -- Check if role_name column exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'role_permissions' AND column_name = 'role_name'
  ) THEN
    -- Add role_id column if it doesn't exist
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'role_permissions' AND column_name = 'role_id'
    ) THEN
      ALTER TABLE role_permissions ADD COLUMN role_id uuid REFERENCES roles(id) ON DELETE CASCADE;
    END IF;
    
    -- Update role_id from roles table where possible
    UPDATE role_permissions rp
    SET role_id = r.id
    FROM roles r
    WHERE rp.role_name = r.name AND rp.role_id IS NULL;
    
    -- Now drop the role_name column
    ALTER TABLE role_permissions DROP COLUMN IF EXISTS role_name;
  END IF;
END $$;

-- Ensure primary key constraint exists
DO $$
BEGIN
  -- Check if primary key constraint exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'role_permissions_pkey'
  ) THEN
    -- Add primary key constraint
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'role_permissions' AND column_name = 'role_id'
    ) THEN
      -- Try to add primary key on (role_id, permission_id)
      BEGIN
        ALTER TABLE role_permissions 
        ADD PRIMARY KEY (role_id, permission_id);
      EXCEPTION WHEN OTHERS THEN
        -- If that fails, try adding a unique constraint instead
        ALTER TABLE role_permissions 
        ADD CONSTRAINT role_permissions_role_id_permission_id_key 
        UNIQUE (role_id, permission_id);
      END;
    END IF;
  END IF;
END $$;

-- Update the get_role_permissions function to handle role names correctly
CREATE OR REPLACE FUNCTION get_role_permissions(role_name text)
RETURNS SETOF text AS $$
DECLARE
  role_id uuid;
BEGIN
  -- Super admins have all permissions
  IF role_name = 'super_admin' THEN
    RETURN QUERY SELECT name FROM permissions;
    RETURN;
  END IF;

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
    -- If no permissions found, return empty set
    RETURN;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Add comment to document the function
COMMENT ON FUNCTION get_role_permissions IS 'Get all permissions for a role by name';