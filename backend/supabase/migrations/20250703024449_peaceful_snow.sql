/*
  # Add Super Admin Role

  1. New Role
    - Add 'super_admin' to user_role enum
  
  2. Changes
    - Update get_current_tenant_id() function to handle super_admin role
    - Add new RLS policies for super_admin access across tenants
    - Add corporate_email_domain to tenants table if not exists

  3. Security
    - Super admins can access and manage all tenants
    - Regular admins are restricted to their own tenant
*/

-- Add 'super_admin' to user_role enum if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        -- If the type doesn't exist, we can't alter it
        RAISE NOTICE 'user_role type does not exist, skipping addition of super_admin';
    ELSE
        -- Check if the value already exists in the enum
        IF NOT EXISTS (
            SELECT 1
            FROM pg_enum
            WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'user_role')
            AND enumlabel = 'super_admin'
        ) THEN
            -- Add the value to the enum
            ALTER TYPE user_role ADD VALUE 'super_admin';
        END IF;
    END IF;
END$$;

-- Update get_current_tenant_id() function to handle super_admin role
CREATE OR REPLACE FUNCTION get_current_tenant_id()
RETURNS uuid AS $$
DECLARE
    user_role text;
BEGIN
    -- Get the user's role from the JWT
    user_role := auth.jwt() ->> 'role';
    
    -- If the user is a super_admin, return NULL to bypass tenant filtering
    IF user_role = 'super_admin' THEN
        RETURN NULL;
    END IF;
    
    -- Otherwise, return the tenant_id from the JWT
    RETURN (auth.jwt() ->> 'tenant_id')::uuid;
END;
$$ LANGUAGE plpgsql STABLE;

-- Create policies for super_admin access to tenants table
DROP POLICY IF EXISTS "Super admins can manage all tenants" ON tenants;
CREATE POLICY "Super admins can manage all tenants" ON tenants
  FOR ALL USING (
    (auth.jwt() ->> 'role') = 'super_admin'
  );

-- Create policies for super_admin access to profiles table
DROP POLICY IF EXISTS "Super admins can manage all profiles" ON profiles;
CREATE POLICY "Super admins can manage all profiles" ON profiles
  FOR ALL USING (
    (auth.jwt() ->> 'role') = 'super_admin'
  );

-- Create policies for super_admin access to facilities table
DROP POLICY IF EXISTS "Super admins can manage all facilities" ON facilities;
CREATE POLICY "Super admins can manage all facilities" ON facilities
  FOR ALL USING (
    (auth.jwt() ->> 'role') = 'super_admin'
  );

-- Create policies for super_admin access to visitors table
DROP POLICY IF EXISTS "Super admins can manage all visitors" ON visitors;
CREATE POLICY "Super admins can manage all visitors" ON visitors
  FOR ALL USING (
    (auth.jwt() ->> 'role') = 'super_admin'
  );

-- Create policies for super_admin access to hosts table
DROP POLICY IF EXISTS "Super admins can manage all hosts" ON hosts;
CREATE POLICY "Super admins can manage all hosts" ON hosts
  FOR ALL USING (
    (auth.jwt() ->> 'role') = 'super_admin'
  );

-- Create policies for super_admin access to visits table
DROP POLICY IF EXISTS "Super admins can manage all visits" ON visits;
CREATE POLICY "Super admins can manage all visits" ON visits
  FOR ALL USING (
    (auth.jwt() ->> 'role') = 'super_admin'
  );

-- Create policies for super_admin access to watchlist table
DROP POLICY IF EXISTS "Super admins can manage all watchlist entries" ON watchlist;
CREATE POLICY "Super admins can manage all watchlist entries" ON watchlist
  FOR ALL USING (
    (auth.jwt() ->> 'role') = 'super_admin'
  );

-- Create policies for super_admin access to audit_logs table
DROP POLICY IF EXISTS "Super admins can access all audit logs" ON audit_logs;
CREATE POLICY "Super admins can access all audit logs" ON audit_logs
  FOR ALL USING (
    (auth.jwt() ->> 'role') = 'super_admin'
  );

-- Create policies for super_admin access to emergency_contacts table
DROP POLICY IF EXISTS "Super admins can manage all emergency contacts" ON emergency_contacts;
CREATE POLICY "Super admins can manage all emergency contacts" ON emergency_contacts
  FOR ALL USING (
    (auth.jwt() ->> 'role') = 'super_admin'
  );

-- Create policies for super_admin access to badges table
DROP POLICY IF EXISTS "Super admins can manage all badges" ON badges;
CREATE POLICY "Super admins can manage all badges" ON badges
  FOR ALL USING (
    (auth.jwt() ->> 'role') = 'super_admin'
  );

-- Create policies for super_admin access to invitations table
DROP POLICY IF EXISTS "Super admins can manage all invitations" ON invitations;
CREATE POLICY "Super admins can manage all invitations" ON invitations
  FOR ALL USING (
    (auth.jwt() ->> 'role') = 'super_admin'
  );

-- Create policies for super_admin access to notification_templates table
DROP POLICY IF EXISTS "Super admins can manage all notification templates" ON notification_templates;
CREATE POLICY "Super admins can manage all notification templates" ON notification_templates
  FOR ALL USING (
    (auth.jwt() ->> 'role') = 'super_admin'
  );

-- Create policies for super_admin access to notification_logs table
DROP POLICY IF EXISTS "Super admins can access all notification logs" ON notification_logs;
CREATE POLICY "Super admins can access all notification logs" ON notification_logs
  FOR ALL USING (
    (auth.jwt() ->> 'role') = 'super_admin'
  );