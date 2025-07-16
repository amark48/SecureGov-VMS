/*
  # Dynamic Role Management System

  1. New Tables
    - `permissions` - Defines granular permissions for system actions
    - `roles` - Defines custom roles that can be assigned to users
    - `role_permissions` - Junction table linking roles to permissions

  2. Changes
    - Add `role_id` column to profiles table (while maintaining backward compatibility with role enum)
    - Add helper functions for permission checking
    - Create default roles and permissions based on existing roles

  3. Security
    - Enable RLS on new tables
    - Add tenant-specific policies
*/

-- Create permissions table
CREATE TABLE IF NOT EXISTS permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  resource text NOT NULL,
  action text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(resource, action)
);

-- Create roles table
CREATE TABLE IF NOT EXISTS roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  name text NOT NULL,
  description text,
  is_system boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(tenant_id, name)
);

-- Create role_permissions junction table
CREATE TABLE IF NOT EXISTS role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(role_id, permission_id)
);

-- Add role_id to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role_id uuid REFERENCES roles(id);

-- Create updated_at triggers
CREATE TRIGGER update_permissions_updated_at BEFORE UPDATE ON permissions 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_roles_updated_at BEFORE UPDATE ON roles 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;

-- Create indexes
CREATE INDEX idx_roles_tenant_id ON roles(tenant_id);
CREATE INDEX idx_role_permissions_role_id ON role_permissions(role_id);
CREATE INDEX idx_role_permissions_permission_id ON role_permissions(permission_id);
CREATE INDEX idx_profiles_role_id ON profiles(role_id);

-- Create helper function to check if a user has a specific permission
CREATE OR REPLACE FUNCTION user_has_permission(user_id uuid, permission_resource text, permission_action text)
RETURNS boolean AS $$
DECLARE
  has_permission boolean;
BEGIN
  -- Super admins have all permissions
  IF EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = user_id AND role = 'super_admin'
  ) THEN
    RETURN true;
  END IF;

  -- Check if the user's role has the specific permission
  SELECT EXISTS (
    SELECT 1 
    FROM profiles p
    JOIN roles r ON p.role_id = r.id
    JOIN role_permissions rp ON r.id = rp.role_id
    JOIN permissions perm ON rp.permission_id = perm.id
    WHERE p.id = user_id
    AND perm.resource = permission_resource
    AND perm.action = permission_action
  ) INTO has_permission;

  -- If role_id is not set, fall back to the enum role
  IF has_permission IS NULL OR has_permission = false THEN
    -- Check based on the legacy role enum
    RETURN EXISTS (
      SELECT 1 
      FROM profiles p
      WHERE p.id = user_id
      AND (
        -- Admin can do everything
        (p.role = 'admin') OR
        -- Security can manage security-related resources
        (p.role = 'security' AND permission_resource IN ('security', 'watchlist', 'emergency', 'visitors', 'visits')) OR
        -- Reception can manage visitors and visits
        (p.role = 'reception' AND permission_resource IN ('visitors', 'visits')) OR
        -- Host can manage their own visits and invitations
        (p.role = 'host' AND permission_resource IN ('visits', 'invitations') AND permission_action IN ('read', 'create')) OR
        -- Approver can manage invitations
        (p.role = 'approver' AND permission_resource = 'invitations')
      )
    );
  END IF;

  RETURN has_permission;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create helper function to get all permissions for a user
CREATE OR REPLACE FUNCTION get_user_permissions(user_id uuid)
RETURNS TABLE (resource text, action text) AS $$
BEGIN
  -- Super admins have all permissions
  IF EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = user_id AND role = 'super_admin'
  ) THEN
    RETURN QUERY SELECT p.resource, p.action FROM permissions p;
    RETURN;
  END IF;

  -- Get permissions from role_id if set
  RETURN QUERY
  SELECT perm.resource, perm.action
  FROM profiles p
  JOIN roles r ON p.role_id = r.id
  JOIN role_permissions rp ON r.id = rp.role_id
  JOIN permissions perm ON rp.permission_id = perm.id
  WHERE p.id = user_id;

  -- If no results and role_id is not set, fall back to the enum role
  IF NOT FOUND THEN
    -- Get user's role
    DECLARE
      user_role text;
    BEGIN
      SELECT role INTO user_role FROM profiles WHERE id = user_id;
      
      -- Return permissions based on legacy role
      IF user_role = 'admin' THEN
        RETURN QUERY SELECT p.resource, p.action FROM permissions p;
      ELSIF user_role = 'security' THEN
        RETURN QUERY SELECT p.resource, p.action 
          FROM permissions p 
          WHERE p.resource IN ('security', 'watchlist', 'emergency', 'visitors', 'visits');
      ELSIF user_role = 'reception' THEN
        RETURN QUERY SELECT p.resource, p.action 
          FROM permissions p 
          WHERE p.resource IN ('visitors', 'visits');
      ELSIF user_role = 'host' THEN
        RETURN QUERY SELECT p.resource, p.action 
          FROM permissions p 
          WHERE p.resource IN ('visits', 'invitations') AND p.action IN ('read', 'create');
      ELSIF user_role = 'approver' THEN
        RETURN QUERY SELECT p.resource, p.action 
          FROM permissions p 
          WHERE p.resource = 'invitations';
      END IF;
    END;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS Policies
CREATE POLICY "Permissions are visible to all authenticated users" ON permissions
  FOR SELECT USING (true);

CREATE POLICY "Roles are visible within their tenant" ON roles
  FOR SELECT USING (
    tenant_id = get_current_tenant_id_from_session() OR
    is_super_admin()
  );

CREATE POLICY "Admins can manage roles within their tenant" ON roles
  FOR ALL USING (
    (tenant_id = get_current_tenant_id_from_session() AND
    get_current_user_role() = 'admin') OR
    is_super_admin()
  ) WITH CHECK (
    (tenant_id = get_current_tenant_id_from_session() AND
    get_current_user_role() = 'admin') OR
    is_super_admin()
  );

CREATE POLICY "Role permissions are visible to all authenticated users" ON role_permissions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM roles r
      WHERE r.id = role_permissions.role_id AND
      (r.tenant_id = get_current_tenant_id_from_session() OR is_super_admin())
    )
  );

CREATE POLICY "Admins can manage role permissions" ON role_permissions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM roles r
      WHERE r.id = role_permissions.role_id AND
      ((r.tenant_id = get_current_tenant_id_from_session() AND
      get_current_user_role() = 'admin') OR
      is_super_admin())
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM roles r
      WHERE r.id = role_permissions.role_id AND
      ((r.tenant_id = get_current_tenant_id_from_session() AND
      get_current_user_role() = 'admin') OR
      is_super_admin())
    )
  );

-- Insert default permissions
INSERT INTO permissions (name, description, resource, action) VALUES
-- Visitor permissions
('View Visitors', 'Can view visitor information', 'visitors', 'read'),
('Create Visitors', 'Can create new visitors', 'visitors', 'create'),
('Edit Visitors', 'Can edit visitor information', 'visitors', 'update'),
('Delete Visitors', 'Can delete visitors', 'visitors', 'delete'),
('Screen Visitors', 'Can screen visitors against watchlist', 'visitors', 'screen'),

-- Visit permissions
('View Visits', 'Can view visit information', 'visits', 'read'),
('Create Visits', 'Can create new visits', 'visits', 'create'),
('Edit Visits', 'Can edit visit information', 'visits', 'update'),
('Delete Visits', 'Can delete visits', 'visits', 'delete'),
('Check In Visitors', 'Can check in visitors', 'visits', 'check_in'),
('Check Out Visitors', 'Can check out visitors', 'visits', 'check_out'),
('Print Badges', 'Can print visitor badges', 'visits', 'print_badge'),

-- Invitation permissions
('View Invitations', 'Can view invitations', 'invitations', 'read'),
('Create Invitations', 'Can create new invitations', 'invitations', 'create'),
('Edit Invitations', 'Can edit invitations', 'invitations', 'update'),
('Delete Invitations', 'Can delete invitations', 'invitations', 'delete'),
('Approve Invitations', 'Can approve invitations', 'invitations', 'approve'),
('Reject Invitations', 'Can reject invitations', 'invitations', 'reject'),

-- Facility permissions
('View Facilities', 'Can view facilities', 'facilities', 'read'),
('Create Facilities', 'Can create new facilities', 'facilities', 'create'),
('Edit Facilities', 'Can edit facilities', 'facilities', 'update'),
('Delete Facilities', 'Can delete facilities', 'facilities', 'delete'),

-- Host permissions
('View Hosts', 'Can view host assignments', 'hosts', 'read'),
('Create Hosts', 'Can create new host assignments', 'hosts', 'create'),
('Edit Hosts', 'Can edit host assignments', 'hosts', 'update'),
('Delete Hosts', 'Can delete host assignments', 'hosts', 'delete'),

-- Security permissions
('View Watchlist', 'Can view security watchlist', 'watchlist', 'read'),
('Manage Watchlist', 'Can manage security watchlist', 'watchlist', 'manage'),
('View Security Alerts', 'Can view security alerts', 'security_alerts', 'read'),
('Manage Security Alerts', 'Can manage security alerts', 'security_alerts', 'manage'),

-- Emergency permissions
('View Emergency Contacts', 'Can view emergency contacts', 'emergency', 'read'),
('Manage Emergency Contacts', 'Can manage emergency contacts', 'emergency', 'manage'),
('Initiate Emergency Procedures', 'Can initiate emergency procedures', 'emergency', 'initiate'),

-- Audit permissions
('View Audit Logs', 'Can view audit logs', 'audit', 'read'),
('Export Audit Logs', 'Can export audit logs', 'audit', 'export'),

-- Report permissions
('View Reports', 'Can view reports', 'reports', 'read'),
('Generate Reports', 'Can generate reports', 'reports', 'generate'),

-- User management permissions
('View Users', 'Can view user accounts', 'users', 'read'),
('Create Users', 'Can create new user accounts', 'users', 'create'),
('Edit Users', 'Can edit user accounts', 'users', 'update'),
('Delete Users', 'Can delete user accounts', 'users', 'delete'),
('Reset User Passwords', 'Can reset user passwords', 'users', 'reset_password'),

-- Role management permissions
('View Roles', 'Can view roles', 'roles', 'read'),
('Create Roles', 'Can create new roles', 'roles', 'create'),
('Edit Roles', 'Can edit roles', 'roles', 'update'),
('Delete Roles', 'Can delete roles', 'roles', 'delete'),
('Assign Permissions', 'Can assign permissions to roles', 'roles', 'assign_permissions'),

-- Tenant permissions
('View Tenants', 'Can view tenants', 'tenants', 'read'),
('Create Tenants', 'Can create new tenants', 'tenants', 'create'),
('Edit Tenants', 'Can edit tenants', 'tenants', 'update'),
('Delete Tenants', 'Can delete tenants', 'tenants', 'delete'),

-- Notification permissions
('View Notification Templates', 'Can view notification templates', 'notifications', 'read'),
('Manage Notification Templates', 'Can manage notification templates', 'notifications', 'manage'),
('View Notification Logs', 'Can view notification logs', 'notification_logs', 'read'),

-- System settings permissions
('View System Settings', 'Can view system settings', 'settings', 'read'),
('Manage System Settings', 'Can manage system settings', 'settings', 'manage'),

-- Calendar permissions
('View Calendar', 'Can view visit calendar', 'calendar', 'read'),
('Export Calendar', 'Can export calendar data', 'calendar', 'export')

ON CONFLICT (resource, action) DO NOTHING;

-- Create default roles for each tenant
DO $$
DECLARE
  tenant_record RECORD;
  admin_role_id uuid;
  security_role_id uuid;
  reception_role_id uuid;
  host_role_id uuid;
  approver_role_id uuid;
  super_admin_role_id uuid;
BEGIN
  -- Loop through all tenants
  FOR tenant_record IN SELECT id FROM tenants LOOP
    -- Create Admin role
    INSERT INTO roles (tenant_id, name, description, is_system)
    VALUES (tenant_record.id, 'Admin', 'Full administrative access', true)
    RETURNING id INTO admin_role_id;
    
    -- Create Security role
    INSERT INTO roles (tenant_id, name, description, is_system)
    VALUES (tenant_record.id, 'Security', 'Security personnel with access to security features', true)
    RETURNING id INTO security_role_id;
    
    -- Create Reception role
    INSERT INTO roles (tenant_id, name, description, is_system)
    VALUES (tenant_record.id, 'Reception', 'Front desk staff for visitor check-in/out', true)
    RETURNING id INTO reception_role_id;
    
    -- Create Host role
    INSERT INTO roles (tenant_id, name, description, is_system)
    VALUES (tenant_record.id, 'Host', 'Staff who can receive visitors', true)
    RETURNING id INTO host_role_id;
    
    -- Create Approver role
    INSERT INTO roles (tenant_id, name, description, is_system)
    VALUES (tenant_record.id, 'Approver', 'Can approve or reject visitor invitations', true)
    RETURNING id INTO approver_role_id;
    
    -- Create Super Admin role (only for the first tenant)
    IF tenant_record.id = (SELECT id FROM tenants ORDER BY created_at ASC LIMIT 1) THEN
      INSERT INTO roles (tenant_id, name, description, is_system)
      VALUES (tenant_record.id, 'Super Admin', 'System-wide administrative access', true)
      RETURNING id INTO super_admin_role_id;
    END IF;
    
    -- Assign permissions to Admin role (all permissions)
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT admin_role_id, id FROM permissions;
    
    -- Assign permissions to Security role
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT security_role_id, id FROM permissions
    WHERE resource IN ('visitors', 'visits', 'watchlist', 'security_alerts', 'emergency', 'calendar')
    OR (resource = 'reports' AND action = 'read');
    
    -- Assign permissions to Reception role
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT reception_role_id, id FROM permissions
    WHERE resource IN ('visitors', 'visits')
    OR (resource = 'calendar' AND action = 'read');
    
    -- Assign permissions to Host role
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT host_role_id, id FROM permissions
    WHERE (resource = 'visits' AND action IN ('read', 'create'))
    OR (resource = 'invitations' AND action IN ('read', 'create'))
    OR (resource = 'calendar' AND action = 'read');
    
    -- Assign permissions to Approver role
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT approver_role_id, id FROM permissions
    WHERE resource = 'invitations'
    OR (resource = 'calendar' AND action = 'read');
    
    -- Assign all permissions to Super Admin role
    IF super_admin_role_id IS NOT NULL THEN
      INSERT INTO role_permissions (role_id, permission_id)
      SELECT super_admin_role_id, id FROM permissions;
    END IF;
    
    -- Update existing profiles to use the new role_id based on their current role enum
    UPDATE profiles
    SET role_id = CASE
      WHEN role = 'admin' THEN admin_role_id
      WHEN role = 'security' THEN security_role_id
      WHEN role = 'reception' THEN reception_role_id
      WHEN role = 'host' THEN host_role_id
      WHEN role = 'approver' THEN approver_role_id
      WHEN role = 'super_admin' THEN super_admin_role_id
    END
    WHERE tenant_id = tenant_record.id AND role_id IS NULL;
    
  END LOOP;
END $$;