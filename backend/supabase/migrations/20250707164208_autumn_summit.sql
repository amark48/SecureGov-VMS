/*
  # Fix Role Permissions Assignment

  1. Changes
    - Create a more robust function to assign permissions to roles
    - Fix issues with permission assignment in the API
    - Ensure proper error handling and validation

  2. Security
    - Maintain existing RLS policies
*/

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS assign_permissions_to_role(uuid, text[]);

-- Create a more robust function to assign permissions to a role
CREATE OR REPLACE FUNCTION assign_permissions_to_role(p_role_id uuid, p_permission_names text[])
RETURNS void AS $$
DECLARE
  permission_record record;
  permission_ids uuid[] := '{}';
BEGIN
  -- Log the function call
  RAISE NOTICE 'Assigning permissions to role: role_id=%, permission_count=%', 
    p_role_id, array_length(p_permission_names, 1);
  
  -- Validate inputs
  IF p_role_id IS NULL THEN
    RAISE EXCEPTION 'Role ID is required';
  END IF;
  
  -- Check if role exists
  IF NOT EXISTS (SELECT 1 FROM roles WHERE id = p_role_id) THEN
    RAISE EXCEPTION 'Role with ID % does not exist', p_role_id;
  END IF;
  
  -- Delete existing permissions for this role
  DELETE FROM role_permissions WHERE role_id = p_role_id;
  RAISE NOTICE 'Deleted existing permissions for role %', p_role_id;
  
  -- Insert new permissions if provided
  IF p_permission_names IS NOT NULL AND array_length(p_permission_names, 1) > 0 THEN
    -- Get permission IDs from names
    SELECT array_agg(id) INTO permission_ids
    FROM permissions
    WHERE name = ANY(p_permission_names);
    
    RAISE NOTICE 'Found % permission IDs for % permission names', 
      array_length(permission_ids, 1), array_length(p_permission_names, 1);
    
    -- Insert permissions one by one to avoid errors
    IF permission_ids IS NOT NULL AND array_length(permission_ids, 1) > 0 THEN
      FOREACH permission_record IN ARRAY (
        SELECT id, name FROM permissions WHERE id = ANY(permission_ids)
      )
      LOOP
        BEGIN
          INSERT INTO role_permissions (role_id, permission_id)
          VALUES (p_role_id, permission_record.id);
          
          RAISE NOTICE 'Assigned permission % (%) to role %', 
            permission_record.name, permission_record.id, p_role_id;
        EXCEPTION WHEN unique_violation THEN
          RAISE NOTICE 'Permission % already assigned to role %', 
            permission_record.id, p_role_id;
        END;
      END LOOP;
    END IF;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Add comment to document the function
COMMENT ON FUNCTION assign_permissions_to_role IS 'Assign permissions to a role by ID using permission names';

-- Create a function to get permissions by role ID with better error handling
CREATE OR REPLACE FUNCTION get_permissions_by_role_id(p_role_id uuid)
RETURNS TABLE (id uuid, name text, description text, resource text, action text) AS $$
BEGIN
  -- Validate input
  IF p_role_id IS NULL THEN
    RAISE EXCEPTION 'Role ID is required';
  END IF;
  
  -- Check if role exists
  IF NOT EXISTS (SELECT 1 FROM roles WHERE id = p_role_id) THEN
    RAISE EXCEPTION 'Role with ID % does not exist', p_role_id;
  END IF;
  
  -- Return permissions for the specified role ID
  RETURN QUERY
    SELECT p.id, p.name, p.description, p.resource, p.action
    FROM permissions p
    JOIN role_permissions rp ON p.id = rp.permission_id
    WHERE rp.role_id = p_role_id
    ORDER BY p.resource, p.action;
END;
$$ LANGUAGE plpgsql;

-- Add comment to document the function
COMMENT ON FUNCTION get_permissions_by_role_id IS 'Get all permissions for a role by ID with better error handling';