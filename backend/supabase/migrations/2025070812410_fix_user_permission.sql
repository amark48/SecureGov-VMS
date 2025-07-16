CREATE OR REPLACE FUNCTION get_user_permissions(user_id uuid)
RETURNS TABLE (resource text, action text) AS $$
DECLARE
  v_user_role text;
  v_user_role_id uuid;
BEGIN
  -- Fetch user's role and role_id
  SELECT p.role, p.role_id INTO v_user_role, v_user_role_id FROM profiles p WHERE p.id = user_id;

  -- Super admins have all permissions
  IF v_user_role = 'super_admin' THEN
    RETURN QUERY SELECT perm.resource, perm.action FROM permissions perm;
    RETURN;
  END IF;

  -- Attempt to get permissions from role_id first
  -- This part will return permissions if the role_id is valid and has permissions.
  RETURN QUERY
  SELECT perm.resource, perm.action
  FROM role_permissions rp
  JOIN permissions perm ON rp.permission_id = perm.id
  WHERE rp.role_id = v_user_role_id;

  -- If no permissions were found via role_id (or role_id was NULL),
  -- then fall back to permissions based on the legacy role enum.
  -- The NOT FOUND condition checks if the *last* SQL statement returned any rows.
  -- If the previous RETURN QUERY returned 0 rows, NOT FOUND will be true.
  IF NOT FOUND OR v_user_role_id IS NULL THEN
    -- Return permissions based on legacy role
    IF v_user_role = 'admin' THEN
      RETURN QUERY SELECT perm.resource, perm.action FROM permissions perm;
    ELSIF v_user_role = 'security' THEN
      RETURN QUERY SELECT perm.resource, perm.action
        FROM permissions perm
        WHERE perm.resource IN ('security', 'watchlist', 'emergency', 'visitors', 'visits');
    ELSIF v_user_role = 'reception' THEN
      RETURN QUERY SELECT perm.resource, perm.action
        FROM permissions perm
        WHERE perm.resource IN ('visitors', 'visits');
    ELSIF v_user_role = 'host' THEN
      RETURN QUERY SELECT perm.resource, perm.action
        FROM permissions perm
        WHERE perm.resource IN ('visits', 'invitations') AND perm.action IN ('read', 'create');
    ELSIF v_user_role = 'approver' THEN
      RETURN QUERY SELECT perm.resource, perm.action
        FROM permissions perm
        WHERE perm.resource = 'invitations';
    END IF;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
