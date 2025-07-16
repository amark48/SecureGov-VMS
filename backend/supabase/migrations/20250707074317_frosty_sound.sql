/*
  # Fix Role Management System

  1. Changes
    - Create a new function to get permissions by role ID
    - Update the get_role_permissions function to handle both role names and IDs
    - Fix issues with role_permissions table structure

  2. Security
    - Maintain existing RLS policies
*/

-- Create a function to get permissions by role ID
CREATE OR REPLACE FUNCTION get_permissions_by_role_id(p_role_id uuid)
RETURNS TABLE (name text, description text, resource text, action text) AS $$
BEGIN
  -- Return permissions for the specified role ID
  RETURN QUERY
    SELECT p.name, p.description, p.resource, p.action
    FROM permissions p
    JOIN role_permissions rp ON p.id = rp.permission_id
    WHERE rp.role_id = p_role_id;
END;
$$ LANGUAGE plpgsql;

-- Add comment to document the function
COMMENT ON FUNCTION get_permissions_by_role_id IS 'Get all permissions for a role by ID';

-- Update the get_role_permissions function to handle both role names and IDs
CREATE OR REPLACE FUNCTION get_role_permissions_by_name(role_name text)
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
COMMENT ON FUNCTION get_role_permissions_by_name IS 'Get all permissions for a role by name';

-- Create a function to assign permissions to a role by ID
CREATE OR REPLACE FUNCTION assign_permissions_to_role(p_role_id uuid, p_permission_names text[])
RETURNS void AS $$
DECLARE
  permission_record record;
BEGIN
  -- Delete existing permissions for this role
  DELETE FROM role_permissions WHERE role_id = p_role_id;
  
  -- Insert new permissions
  FOR permission_record IN 
    SELECT id FROM permissions WHERE name = ANY(p_permission_names)
  LOOP
    INSERT INTO role_permissions (role_id, permission_id)
    VALUES (p_role_id, permission_record.id);
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Add comment to document the function
COMMENT ON FUNCTION assign_permissions_to_role IS 'Assign permissions to a role by ID';