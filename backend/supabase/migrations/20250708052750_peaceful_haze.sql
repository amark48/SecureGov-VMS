/*
  # Fix Auth System Issues

  1. Changes
    - Add static method to AuthService class for generating random passwords
    - Fix issues with user permissions fetching
    - Ensure proper error handling in auth routes

  2. Security
    - Maintain existing RLS policies
*/

-- Create a function to generate a random password
CREATE OR REPLACE FUNCTION generate_random_password(length integer DEFAULT 12)
RETURNS text AS $$
DECLARE
  chars text := 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+';
  result text := '';
  i integer := 0;
  chars_length integer := length(chars);
BEGIN
  -- Ensure we have at least one of each character type
  result := result || chars[1 + floor(random() * 26)::integer]; -- uppercase
  result := result || chars[27 + floor(random() * 26)::integer]; -- lowercase
  result := result || chars[53 + floor(random() * 10)::integer]; -- digit
  result := result || chars[63 + floor(random() * 12)::integer]; -- special

  -- Fill the rest with random characters
  FOR i IN 1..(length - 4) LOOP
    result := result || chars[1 + floor(random() * chars_length)::integer];
  END LOOP;

  -- Shuffle the result
  result := array_to_string(array(
    SELECT result[i:i]
    FROM generate_series(1, length(result)) AS i
    ORDER BY random()
  ), '');

  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Add comment to document the function
COMMENT ON FUNCTION generate_random_password IS 'Generate a random password with specified length, including uppercase, lowercase, digits, and special characters';

-- Create a function to get user permissions with better error handling
CREATE OR REPLACE FUNCTION get_user_permissions_safe(user_id uuid)
RETURNS TABLE (resource text, action text) AS $$
DECLARE
  user_role text;
  user_role_id uuid;
BEGIN
  -- Check if user exists
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = user_id) THEN
    RAISE NOTICE 'User with ID % not found', user_id;
    RETURN;
  END IF;

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
      RAISE NOTICE 'Unknown role: %', user_role;
      RETURN;
  END CASE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comment to document the function
COMMENT ON FUNCTION get_user_permissions_safe IS 'Get all permissions for a user by ID with improved error handling and safety checks';