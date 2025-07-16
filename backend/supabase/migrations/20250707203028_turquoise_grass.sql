/*
  # Fix Role Management Issues

  1. Changes
    - Create a function to delete roles safely
    - Improve error handling in permission assignment functions
    - Fix ambiguous column references in role_permissions operations

  2. Security
    - Maintain existing RLS policies
    - Ensure proper validation before role deletion
*/

-- Create a function to safely delete a role
CREATE OR REPLACE FUNCTION delete_role(p_role_id uuid)
RETURNS boolean AS $$
DECLARE
  v_role_name text;
  v_is_system boolean;
  v_user_count integer;
BEGIN
  -- Log the function call
  RAISE NOTICE 'Attempting to delete role: role_id=%', p_role_id;
  
  -- Validate input
  IF p_role_id IS NULL THEN
    RAISE EXCEPTION 'Role ID is required';
  END IF;
  
  -- Check if role exists and get its details
  SELECT name, is_system INTO v_role_name, v_is_system
  FROM roles
  WHERE id = p_role_id;
  
  IF v_role_name IS NULL THEN
    RAISE EXCEPTION 'Role with ID % does not exist', p_role_id;
  END IF;
  
  -- Prevent deletion of system roles
  IF v_is_system THEN
    RAISE EXCEPTION 'System roles cannot be deleted';
  END IF;
  
  -- Check if any users are assigned to this role
  SELECT COUNT(*) INTO v_user_count
  FROM profiles
  WHERE role_id = p_role_id;
  
  IF v_user_count > 0 THEN
    RAISE EXCEPTION 'Cannot delete role that is assigned to % users', v_user_count;
  END IF;
  
  -- Delete role permissions first (using table qualification to avoid ambiguity)
  DELETE FROM role_permissions AS rp
  WHERE rp.role_id = p_role_id;
  
  -- Delete the role
  DELETE FROM roles
  WHERE id = p_role_id;
  
  RAISE NOTICE 'Role % (%) deleted successfully', v_role_name, p_role_id;
  
  RETURN true;
END;
$$ LANGUAGE plpgsql;

-- Add comment to document the function
COMMENT ON FUNCTION delete_role IS 'Safely delete a role after validating it can be deleted';

-- Fix the assign_permissions_to_role_by_id function to avoid ambiguous column references
CREATE OR REPLACE FUNCTION assign_permissions_to_role_by_id(p_role_id uuid, p_permission_ids uuid[])
RETURNS TABLE (role_id uuid, role_name text, permissions text[]) AS $$
DECLARE
  v_role_name text;
BEGIN
  -- Log the function call
  RAISE NOTICE 'Assigning permissions to role by ID: role_id=%, permission_count=%', 
    p_role_id, array_length(p_permission_ids, 1);
  
  -- Validate inputs
  IF p_role_id IS NULL THEN
    RAISE EXCEPTION 'Role ID is required';
  END IF;
  
  -- Check if role exists
  SELECT name INTO v_role_name FROM roles WHERE id = p_role_id;
  IF v_role_name IS NULL THEN
    RAISE EXCEPTION 'Role with ID % does not exist', p_role_id;
  END IF;
  
  -- Delete existing permissions for this role (using table qualification to avoid ambiguity)
  DELETE FROM role_permissions AS rp WHERE rp.role_id = p_role_id;
  RAISE NOTICE 'Deleted existing permissions for role % (%)', p_role_id, v_role_name;
  
  -- Insert new permissions if provided
  IF p_permission_ids IS NOT NULL AND array_length(p_permission_ids, 1) > 0 THEN
    -- Insert permissions directly using the provided IDs
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT p_role_id, p_id FROM unnest(p_permission_ids) AS p_id
    WHERE EXISTS (SELECT 1 FROM permissions WHERE id = p_id);
    
    RAISE NOTICE 'Assigned permissions to role % (%)', p_role_id, v_role_name;
  END IF;
  
  -- Return the updated role with its permissions
  RETURN QUERY
  SELECT 
    r.id AS role_id, 
    r.name AS role_name, 
    array_agg(p.name) AS permissions
  FROM roles r
  LEFT JOIN role_permissions rp ON r.id = rp.role_id
  LEFT JOIN permissions p ON rp.permission_id = p.id
  WHERE r.id = p_role_id
  GROUP BY r.id, r.name;
END;
$$ LANGUAGE plpgsql;

-- Add comment to document the function
COMMENT ON FUNCTION assign_permissions_to_role_by_id IS 'Assign permissions to a role by ID using permission IDs directly, with fixed column references';