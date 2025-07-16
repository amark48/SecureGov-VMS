/*
  # Fix Role Permissions Schema

  1. Changes
    - Update the role_permissions table to use role_id instead of role_name
    - Add a migration to convert existing role_name entries to use role_id

  2. Security
    - Maintain existing RLS policies
*/

-- Check if role_permissions table has role_name column
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'role_permissions' AND column_name = 'role_name'
  ) THEN
    -- Create a temporary table to store the mappings
    CREATE TEMP TABLE role_name_to_id AS
    SELECT name, id FROM roles;
    
    -- Create a new column for role_id if it doesn't exist
    ALTER TABLE role_permissions 
    ADD COLUMN IF NOT EXISTS role_id uuid REFERENCES roles(id) ON DELETE CASCADE;
    
    -- Update role_id based on role_name
    UPDATE role_permissions rp
    SET role_id = r.id
    FROM role_name_to_id r
    WHERE rp.role_name = r.name;
    
    -- Drop the role_name column
    ALTER TABLE role_permissions DROP COLUMN role_name;
    
    -- Add primary key constraint if it doesn't exist
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint 
      WHERE conname = 'role_permissions_pkey'
    ) THEN
      ALTER TABLE role_permissions 
      ADD PRIMARY KEY (role_id, permission_id);
    END IF;
    
    -- Drop the temporary table
    DROP TABLE role_name_to_id;
  END IF;
END $$;

-- Ensure the role_permissions table has the correct structure
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'role_permissions' AND column_name = 'role_id'
  ) THEN
    -- Create the role_id column
    ALTER TABLE role_permissions 
    ADD COLUMN role_id uuid REFERENCES roles(id) ON DELETE CASCADE;
    
    -- Add primary key constraint if it doesn't exist
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint 
      WHERE conname = 'role_permissions_pkey'
    ) THEN
      ALTER TABLE role_permissions 
      ADD PRIMARY KEY (role_id, permission_id);
    END IF;
  END IF;
END $$;