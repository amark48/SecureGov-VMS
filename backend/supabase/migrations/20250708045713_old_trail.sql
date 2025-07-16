-- Create a new migration to fix permission fetching issues

-- Drop the existing function
DROP FUNCTION IF EXISTS get_user_permissions(uuid);

-- Create an improved version of the function that properly handles all cases
CREATE OR REPLACE FUNCTION get_user_permissions(user_id uuid)
RETURNS TABLE (resource text, action text) AS $$
DECLARE
  user_role text;
  user_role_id uuid;
BEGIN
  -- Get user's role and role_id
  SELECT role, role_id INTO user_role, user_role_id 
  FROM profiles 
  WHERE id = user_id;
  
  -- Log the function call
  RAISE NOTICE 'Getting permissions for user: id=%, role=%, role_id=%', 
    user_id, user_role, user_role_id;
  
  -- Super admins have all permissions
  IF user_role = 'super_admin' THEN
    RETURN QUERY SELECT p.resource, p.action FROM permissions p;
    RETURN;
  END IF;

  -- If user has a role_id, get permissions from that role
  IF user_role_id IS NOT NULL THEN
    RETURN QUERY
    SELECT p.resource, p.action
    FROM permissions p
    JOIN role_permissions rp ON p.id = rp.permission_id
    WHERE rp.role_id = user_role_id;
    
    -- If we found permissions, return them
    IF FOUND THEN
      RETURN;
    END IF;
  END IF;

  -- If no role_id or no permissions found, fall back to the enum role
  -- This ensures backward compatibility
  CASE user_role
    WHEN 'admin' THEN
      RETURN QUERY SELECT p.resource, p.action FROM permissions p;
    WHEN 'security' THEN
      RETURN QUERY SELECT p.resource, p.action 
        FROM permissions p 
        WHERE p.resource IN ('security', 'watchlist', 'emergency', 'visitors', 'visits', 'badges', 'calendar');
    WHEN 'reception' THEN
      RETURN QUERY SELECT p.resource, p.action 
        FROM permissions p 
        WHERE p.resource IN ('visitors', 'visits', 'badges', 'calendar');
    WHEN 'host' THEN
      RETURN QUERY SELECT p.resource, p.action 
        FROM permissions p 
        WHERE p.resource IN ('visits', 'invitations', 'calendar') AND p.action IN ('read', 'create');
    WHEN 'approver' THEN
      RETURN QUERY SELECT p.resource, p.action 
        FROM permissions p 
        WHERE p.resource = 'invitations' OR (p.resource = 'calendar' AND p.action = 'read');
    ELSE
      -- Return empty set for unknown roles
      RETURN;
  END CASE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comment to document the function
COMMENT ON FUNCTION get_user_permissions IS 'Get all permissions for a user by ID, handling both role_id and enum role with improved error handling';