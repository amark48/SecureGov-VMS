/*
  # Add Approver Role and Invitation System

  1. New Role
    - Add 'approver' to user_role enum
  
  2. New Tables
    - `invitations` - Stores visitor invitations that require approval

  3. Security
    - Enable RLS on invitations table
    - Add tenant-specific policies
*/

-- Add 'approver' to user_role enum
ALTER TYPE user_role ADD VALUE 'approver';

-- Create invitations table
CREATE TABLE IF NOT EXISTS invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  visitor_id uuid REFERENCES visitors(id),
  host_id uuid NOT NULL REFERENCES hosts(id),
  facility_id uuid NOT NULL REFERENCES facilities(id),
  purpose text NOT NULL,
  scheduled_date date NOT NULL,
  scheduled_start_time time,
  scheduled_end_time time,
  status text NOT NULL DEFAULT 'pending',
  approver_id uuid REFERENCES profiles(id),
  approved_at timestamptz,
  rejection_reason text,
  visitor_count integer DEFAULT 1,
  escort_required boolean DEFAULT false,
  security_approval_required boolean DEFAULT false,
  areas_authorized text[],
  special_instructions text,
  vehicle_info jsonb,
  equipment_brought text[],
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX idx_invitations_tenant_id ON invitations(tenant_id);
CREATE INDEX idx_invitations_host_id ON invitations(host_id);
CREATE INDEX idx_invitations_visitor_id ON invitations(visitor_id);
CREATE INDEX idx_invitations_facility_id ON invitations(facility_id);
CREATE INDEX idx_invitations_status ON invitations(status);
CREATE INDEX idx_invitations_scheduled_date ON invitations(scheduled_date);

-- Create updated_at trigger for invitations table
CREATE TRIGGER update_invitations_updated_at BEFORE UPDATE ON invitations 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;

-- Invitations policies
CREATE POLICY "Users can read invitations within their tenant" ON invitations
  FOR SELECT USING (
    tenant_id = get_current_tenant_id() AND
    (
      EXISTS (
        SELECT 1 FROM hosts h
        WHERE h.id = invitations.host_id AND h.profile_id = auth.uid() AND h.tenant_id = get_current_tenant_id()
      ) OR
      EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid() AND role IN ('admin', 'security', 'reception', 'approver') AND tenant_id = get_current_tenant_id()
      )
    )
  );

CREATE POLICY "Hosts can create invitations within their tenant" ON invitations
  FOR INSERT WITH CHECK (
    tenant_id = get_current_tenant_id() AND
    EXISTS (
      SELECT 1 FROM hosts h
      WHERE h.id = invitations.host_id AND h.profile_id = auth.uid() AND h.tenant_id = get_current_tenant_id()
    )
  );

CREATE POLICY "Approvers can update invitations within their tenant" ON invitations
  FOR UPDATE USING (
    tenant_id = get_current_tenant_id() AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'approver') AND tenant_id = get_current_tenant_id()
    )
  );

CREATE POLICY "Admins can delete invitations within their tenant" ON invitations
  FOR DELETE USING (
    tenant_id = get_current_tenant_id() AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin' AND tenant_id = get_current_tenant_id()
    )
  );