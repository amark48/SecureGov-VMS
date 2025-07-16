/*
  # Add Multi-Tenancy to SecureGov VMS

  1. New Tables
    - `tenants` - Tenant information for multi-tenant support

  2. Changes
    - Add `tenant_id` column to all existing tables
    - Update RLS policies to enforce tenant isolation
    - Add helper function to get current tenant_id from JWT

  3. Security
    - Enable RLS on tenants table
    - Add tenant-specific policies to all tables
*/

-- Create tenants table
CREATE TABLE IF NOT EXISTS tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add tenant_id column to all tables
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id);
ALTER TABLE facilities ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id);
ALTER TABLE visitors ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id);
ALTER TABLE hosts ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id);
ALTER TABLE visits ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id);
ALTER TABLE watchlist ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id);
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id);
ALTER TABLE emergency_contacts ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id);
ALTER TABLE badges ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id);

-- Create helper function to get current tenant_id from JWT
CREATE OR REPLACE FUNCTION get_current_tenant_id()
RETURNS uuid AS $$
  SELECT (auth.jwt() ->> 'tenant_id')::uuid;
$$ LANGUAGE sql STABLE;

-- Insert default tenant
INSERT INTO tenants (name) 
VALUES ('Default Tenant')
ON CONFLICT (name) DO NOTHING;

-- Update existing data to use default tenant
UPDATE profiles SET tenant_id = (SELECT id FROM tenants WHERE name = 'Default Tenant')
WHERE tenant_id IS NULL;

UPDATE facilities SET tenant_id = (SELECT id FROM tenants WHERE name = 'Default Tenant')
WHERE tenant_id IS NULL;

UPDATE visitors SET tenant_id = (SELECT id FROM tenants WHERE name = 'Default Tenant')
WHERE tenant_id IS NULL;

UPDATE hosts SET tenant_id = (SELECT id FROM tenants WHERE name = 'Default Tenant')
WHERE tenant_id IS NULL;

UPDATE visits SET tenant_id = (SELECT id FROM tenants WHERE name = 'Default Tenant')
WHERE tenant_id IS NULL;

UPDATE watchlist SET tenant_id = (SELECT id FROM tenants WHERE name = 'Default Tenant')
WHERE tenant_id IS NULL;

UPDATE audit_logs SET tenant_id = (SELECT id FROM tenants WHERE name = 'Default Tenant')
WHERE tenant_id IS NULL;

UPDATE emergency_contacts SET tenant_id = (SELECT id FROM tenants WHERE name = 'Default Tenant')
WHERE tenant_id IS NULL;

UPDATE badges SET tenant_id = (SELECT id FROM tenants WHERE name = 'Default Tenant')
WHERE tenant_id IS NULL;

-- Make tenant_id NOT NULL after updating existing data
ALTER TABLE profiles ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE facilities ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE visitors ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE hosts ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE visits ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE watchlist ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE audit_logs ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE emergency_contacts ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE badges ALTER COLUMN tenant_id SET NOT NULL;

-- Enable Row Level Security on tenants table
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

-- Create indexes for tenant_id columns
CREATE INDEX IF NOT EXISTS idx_profiles_tenant_id ON profiles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_facilities_tenant_id ON facilities(tenant_id);
CREATE INDEX IF NOT EXISTS idx_visitors_tenant_id ON visitors(tenant_id);
CREATE INDEX IF NOT EXISTS idx_hosts_tenant_id ON hosts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_visits_tenant_id ON visits(tenant_id);
CREATE INDEX IF NOT EXISTS idx_watchlist_tenant_id ON watchlist(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_id ON audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_emergency_contacts_tenant_id ON emergency_contacts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_badges_tenant_id ON badges(tenant_id);

-- Update hosts unique constraint to include tenant_id
ALTER TABLE hosts DROP CONSTRAINT IF EXISTS hosts_profile_id_facility_id_key;
ALTER TABLE hosts ADD CONSTRAINT hosts_profile_id_facility_id_tenant_id_key UNIQUE (profile_id, facility_id, tenant_id);

-- Create updated_at trigger for tenants table
CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON tenants 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Tenants policies
CREATE POLICY "Enable read access for authenticated users to their tenant" ON tenants
  FOR SELECT USING (id = get_current_tenant_id());

CREATE POLICY "Enable insert for authenticated users (super-admin only)" ON tenants
  FOR INSERT WITH CHECK (auth.role() = 'authenticated' AND (auth.jwt() ->> 'role') = 'super_admin');

CREATE POLICY "Enable update for authenticated users (super-admin only)" ON tenants
  FOR UPDATE USING (auth.role() = 'authenticated' AND (auth.jwt() ->> 'role') = 'super_admin');

CREATE POLICY "Enable delete for authenticated users (super-admin only)" ON tenants
  FOR DELETE USING (auth.role() = 'authenticated' AND (auth.jwt() ->> 'role') = 'super_admin');

-- Drop existing policies and create new tenant-aware policies
-- Profiles policies
DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can manage all profiles" ON profiles;

CREATE POLICY "Users can read own profile within their tenant" ON profiles
  FOR SELECT USING (auth.uid() = id AND tenant_id = get_current_tenant_id());

CREATE POLICY "Users can update own profile within their tenant" ON profiles
  FOR UPDATE USING (auth.uid() = id AND tenant_id = get_current_tenant_id());

CREATE POLICY "Admins can manage profiles within their tenant" ON profiles
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin' AND tenant_id = get_current_tenant_id()
    ) AND tenant_id = get_current_tenant_id()
  );

CREATE POLICY "Allow profiles to be created by admin/reception within their tenant" ON profiles
  FOR INSERT WITH CHECK (
    tenant_id = get_current_tenant_id() AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'reception') AND tenant_id = get_current_tenant_id()
    )
  );

-- Facilities policies
DROP POLICY IF EXISTS "Authenticated users can read facilities" ON facilities;
DROP POLICY IF EXISTS "Admins can manage facilities" ON facilities;

CREATE POLICY "Authenticated users can read facilities within their tenant" ON facilities
  FOR SELECT TO authenticated USING (tenant_id = get_current_tenant_id());

CREATE POLICY "Admins can manage facilities within their tenant" ON facilities
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin' AND tenant_id = get_current_tenant_id()
    ) AND tenant_id = get_current_tenant_id()
  );

-- Visitors policies
DROP POLICY IF EXISTS "Authenticated users can read visitors" ON visitors;
DROP POLICY IF EXISTS "Reception and security can manage visitors" ON visitors;

CREATE POLICY "Authenticated users can read visitors within their tenant" ON visitors
  FOR SELECT TO authenticated USING (tenant_id = get_current_tenant_id());

CREATE POLICY "Reception and security can manage visitors within their tenant" ON visitors
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'security', 'reception') AND tenant_id = get_current_tenant_id()
    ) AND tenant_id = get_current_tenant_id()
  );

-- Hosts policies
DROP POLICY IF EXISTS "Users can read own host records" ON hosts;
DROP POLICY IF EXISTS "Admins can manage hosts" ON hosts;

CREATE POLICY "Users can read own host records within their tenant" ON hosts
  FOR SELECT USING (profile_id = auth.uid() AND tenant_id = get_current_tenant_id());

CREATE POLICY "Admins can manage hosts within their tenant" ON hosts
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin' AND tenant_id = get_current_tenant_id()
    ) AND tenant_id = get_current_tenant_id()
  );

-- Visits policies
DROP POLICY IF EXISTS "Users can read visits they are involved in" ON visits;
DROP POLICY IF EXISTS "Authorized users can manage visits" ON visits;

CREATE POLICY "Users can read visits they are involved in within their tenant" ON visits
  FOR SELECT USING (
    tenant_id = get_current_tenant_id() AND
    (
      EXISTS (
        SELECT 1 FROM hosts h
        WHERE h.id = visits.host_id AND h.profile_id = auth.uid() AND h.tenant_id = get_current_tenant_id()
      ) OR
      EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid() AND role IN ('admin', 'security', 'reception') AND tenant_id = get_current_tenant_id()
      )
    )
  );

CREATE POLICY "Authorized users can manage visits within their tenant" ON visits
  FOR ALL USING (
    tenant_id = get_current_tenant_id() AND
    (
      EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid() AND role IN ('admin', 'security', 'reception') AND tenant_id = get_current_tenant_id()
      ) OR
      EXISTS (
        SELECT 1 FROM hosts h
        WHERE h.id = visits.host_id AND h.profile_id = auth.uid() AND h.tenant_id = get_current_tenant_id()
      )
    )
  );

-- Watchlist policies
DROP POLICY IF EXISTS "Security personnel can access watchlist" ON watchlist;

CREATE POLICY "Security personnel can access watchlist within their tenant" ON watchlist
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'security') AND tenant_id = get_current_tenant_id()
    ) AND tenant_id = get_current_tenant_id()
  );

-- Audit logs policies
DROP POLICY IF EXISTS "Users can read relevant audit logs" ON audit_logs;

CREATE POLICY "Users can read relevant audit logs within their tenant" ON audit_logs
  FOR SELECT USING (
    tenant_id = get_current_tenant_id() AND
    (
      user_id = auth.uid() OR
      EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid() AND role IN ('admin', 'security') AND tenant_id = get_current_tenant_id()
      )
    )
  );

CREATE POLICY "Allow audit log inserts within their tenant" ON audit_logs
  FOR INSERT WITH CHECK (tenant_id = get_current_tenant_id());

-- Emergency contacts policies
DROP POLICY IF EXISTS "Authenticated users can read emergency contacts" ON emergency_contacts;
DROP POLICY IF EXISTS "Admins can manage emergency contacts" ON emergency_contacts;

CREATE POLICY "Authenticated users can read emergency contacts within their tenant" ON emergency_contacts
  FOR SELECT TO authenticated USING (tenant_id = get_current_tenant_id());

CREATE POLICY "Admins can manage emergency contacts within their tenant" ON emergency_contacts
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'security') AND tenant_id = get_current_tenant_id()
    ) AND tenant_id = get_current_tenant_id()
  );

-- Badges policies
DROP POLICY IF EXISTS "Users can read relevant badges" ON badges;
DROP POLICY IF EXISTS "Authorized users can manage badges" ON badges;

CREATE POLICY "Users can read relevant badges within their tenant" ON badges
  FOR SELECT USING (
    tenant_id = get_current_tenant_id() AND
    (
      EXISTS (
        SELECT 1 FROM visits v
        JOIN hosts h ON v.host_id = h.id
        WHERE v.id = badges.visit_id AND h.profile_id = auth.uid() AND h.tenant_id = get_current_tenant_id()
      ) OR
      EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid() AND role IN ('admin', 'security', 'reception') AND tenant_id = get_current_tenant_id()
      )
    )
  );

CREATE POLICY "Authorized users can manage badges within their tenant" ON badges
  FOR ALL USING (
    tenant_id = get_current_tenant_id() AND
    (
      EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid() AND role IN ('admin', 'security', 'reception') AND tenant_id = get_current_tenant_id()
      )
    )
  );