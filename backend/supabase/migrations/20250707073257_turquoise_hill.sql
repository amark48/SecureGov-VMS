/*
  # Fix Role Permissions Table Structure

  1. Changes
    - Add `updated_at` column to role_permissions table
    - This fixes the error with the update_updated_at_column() trigger function
    - Ensures compatibility with existing triggers

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

-- Fix any NULL role_name values by updating from roles table
UPDATE role_permissions rp
SET role_name = r.name
FROM roles r
WHERE rp.role_id = r.id AND rp.role_name IS NULL;

-- Fix any NULL role_id values by updating from roles table
UPDATE role_permissions rp
SET role_id = r.id
FROM roles r
WHERE rp.role_name = r.name AND rp.role_id IS NULL;