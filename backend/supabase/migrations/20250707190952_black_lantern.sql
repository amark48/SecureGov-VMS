/*
  # Fix Ambiguous role_id in assign_permissions_to_role_by_name Function

  1. Changes
    - Update the assign_permissions_to_role_by_name function to fix the ambiguous role_id reference
    - Explicitly qualify the role_id column with the table name in the DELETE statement
    - Improve error handling and logging

  2. Security
    - Maintain existing RLS policies
*/

-- Drop the existing function if it exists
DROP FUNCTION IF EXISTS assign_permissions_to_role_by_name(uuid, text[]);

-- Create an improved version of the function with fixed role_id reference
CREATE OR REPLACE FUNCTION assign_permissions_to_role_by_name(p_role_id uuid, p_permission_names text[])
RETURNS TABLE (role_id uuid, role_name text, permissions text[]) AS $$
DECLARE
  v_role_name text;
  v_permission_ids uuid[] := '{}';
  v_permission_names text[] := '{}';
BEGIN
  -- Log the function call
  RAISE NOTICE 'Assigning permissions to role: role_id=%, permission_count=%', 
    p_role_id, array_length(p_permission_names, 1);
  
  -- Validate inputs
  IF p_role_id IS NULL THEN
    RAISE EXCEPTION 'Role ID is required';
  END IF;
  
  -- Check if role exists
  SELECT name INTO v_role_name FROM roles WHERE id = p_role_id;
  IF v_role_name IS NULL THEN
    RAISE EXCEPTION 'Role with ID % does not exist', p_role_id;
  END IF;
  
  -- Delete existing permissions for this role - FIX: Explicitly qualify role_id with table name
  DELETE FROM role_permissions WHERE role_permissions.role_id = p_role_id;
  RAISE NOTICE 'Deleted existing permissions for role % (%)', p_role_id, v_role_name;
  
  -- Insert new permissions if provided
  IF p_permission_names IS NOT NULL AND array_length(p_permission_names, 1) > 0 THEN
    -- Get permission IDs from names
    SELECT array_agg(id), array_agg(name) 
    INTO v_permission_ids, v_permission_names
    FROM permissions
    WHERE name = ANY(p_permission_names);
    
    RAISE NOTICE 'Found % permission IDs for % permission names', 
      array_length(v_permission_ids, 1), array_length(p_permission_names, 1);
    
    -- Insert permissions
    IF v_permission_ids IS NOT NULL AND array_length(v_permission_ids, 1) > 0 THEN
      INSERT INTO role_permissions (role_id, permission_id)
      SELECT p_role_id, p_id FROM unnest(v_permission_ids) AS p_id;
      
      RAISE NOTICE 'Assigned % permissions to role % (%)', 
        array_length(v_permission_ids, 1), p_role_id, v_role_name;
    END IF;
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
COMMENT ON FUNCTION assign_permissions_to_role_by_name IS 'Assign permissions to a role by ID using permission names, returning the updated role. Fixed to avoid ambiguous role_id reference.';