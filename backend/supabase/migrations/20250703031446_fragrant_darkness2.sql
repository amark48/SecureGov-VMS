-- Create security_alerts table
CREATE TABLE IF NOT EXISTS security_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id), -- Added tenant_id for multi-tenancy
  type text NOT NULL, -- 'watchlist_match', 'security_breach', 'access_denied', 'emergency'
  severity text NOT NULL, -- 'low', 'medium', 'high', 'critical'
  message text NOT NULL,
  visitor_id uuid REFERENCES visitors(id),
  visit_id uuid REFERENCES visits(id),
  facility_id uuid REFERENCES facilities(id),
  resolved boolean DEFAULT false,
  resolved_by uuid REFERENCES profiles(id),
  resolved_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Add index for tenant_id for performance
CREATE INDEX IF NOT EXISTS idx_security_alerts_tenant_id ON security_alerts(tenant_id);

-- Create updated_at trigger for security_alerts table
CREATE TRIGGER update_security_alerts_updated_at BEFORE UPDATE ON security_alerts
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security for security_alerts
ALTER TABLE security_alerts ENABLE ROW LEVEL SECURITY;

-- Define RLS policies for security_alerts
-- Policy for users to read relevant security alerts within their tenant
CREATE POLICY "Security Alerts: Users can read relevant security alerts within their tenant" ON security_alerts
  FOR SELECT USING (
    can_access_tenant_data(tenant_id, NULL) AND
    (
      visitor_id IN (SELECT id FROM visitors WHERE tenant_id = get_current_tenant_id_from_session()) OR
      get_current_user_role() = ANY(ARRAY['admin', 'security', 'reception'])
    )
  );

-- Policy for authorized users (admins, security) to manage security alerts within their tenant
CREATE POLICY "Security Alerts: Authorized users can manage security alerts within their tenant" ON security_alerts
  FOR ALL USING (can_access_tenant_data(tenant_id, ARRAY['admin', 'security'])) WITH CHECK (can_access_tenant_data(tenant_id, ARRAY['admin', 'security']));
