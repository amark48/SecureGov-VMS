-- Create a new migration to fix the role permissions assignment issue

-- Create a function to assign permissions to a role by ID using permission IDs
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
  
  -- Delete existing permissions for this role
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
COMMENT ON FUNCTION assign_permissions_to_role_by_id IS 'Assign permissions to a role by ID using permission IDs directly';