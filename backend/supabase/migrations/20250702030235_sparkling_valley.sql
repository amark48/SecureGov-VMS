/*
  # Add Notification Templates System

  1. New Tables
    - `notification_templates` - Stores templates for emails, SMS, and other notifications
    - `notification_logs` - Records of sent notifications

  2. Changes
    - Add helper functions for notification rendering
    - Add default templates

  3. Security
    - Enable RLS on new tables
    - Add tenant-specific policies
*/

-- Create notification_templates table
CREATE TABLE IF NOT EXISTS notification_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  name text NOT NULL,
  subject text,
  body text NOT NULL,
  type text NOT NULL, -- 'email', 'sms', 'push'
  event text NOT NULL, -- 'invitation', 'check_in', 'check_out', 'approval', etc.
  is_active boolean DEFAULT true,
  is_default boolean DEFAULT false,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(tenant_id, type, event, is_default)
);

-- Create notification_logs table
CREATE TABLE IF NOT EXISTS notification_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  template_id uuid REFERENCES notification_templates(id),
  recipient_email text,
  recipient_phone text,
  recipient_user_id uuid REFERENCES profiles(id),
  subject text,
  body text,
  type text NOT NULL, -- 'email', 'sms', 'push'
  event text NOT NULL,
  status text NOT NULL, -- 'sent', 'failed', 'pending'
  error_message text,
  sent_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX idx_notification_templates_tenant_id ON notification_templates(tenant_id);
CREATE INDEX idx_notification_templates_type_event ON notification_templates(type, event);
CREATE INDEX idx_notification_logs_tenant_id ON notification_logs(tenant_id);
CREATE INDEX idx_notification_logs_recipient_user_id ON notification_logs(recipient_user_id);
CREATE INDEX idx_notification_logs_status ON notification_logs(status);
CREATE INDEX idx_notification_logs_sent_at ON notification_logs(sent_at);

-- Create updated_at trigger for notification_templates table
CREATE TRIGGER update_notification_templates_updated_at BEFORE UPDATE ON notification_templates 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE notification_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_logs ENABLE ROW LEVEL SECURITY;

-- Notification templates policies
CREATE POLICY "Users can read notification templates within their tenant" ON notification_templates
  FOR SELECT USING (tenant_id = get_current_tenant_id());

CREATE POLICY "Admins can manage notification templates within their tenant" ON notification_templates
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin' AND tenant_id = get_current_tenant_id()
    ) AND tenant_id = get_current_tenant_id()
  );

-- Notification logs policies
CREATE POLICY "Users can read their own notification logs" ON notification_logs
  FOR SELECT USING (
    recipient_user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'security') AND tenant_id = get_current_tenant_id()
    )
  );

CREATE POLICY "Admins can create notification logs" ON notification_logs
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'security', 'reception') AND tenant_id = get_current_tenant_id()
    ) AND tenant_id = get_current_tenant_id()
  );

-- Helper function to render template with variables
CREATE OR REPLACE FUNCTION render_template(template_text text, variables jsonb)
RETURNS text AS $$
DECLARE
  result text := template_text;
  key text;
  value text;
BEGIN
  FOR key, value IN SELECT * FROM jsonb_each_text(variables) LOOP
    result := replace(result, '{{' || key || '}}', value);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Insert default templates for the default tenant
DO $$
DECLARE
  default_tenant_id uuid;
BEGIN
  -- Get the default tenant ID
  SELECT id INTO default_tenant_id FROM tenants WHERE name = 'Default Tenant';
  
  -- Insert default email templates
  INSERT INTO notification_templates (tenant_id, name, subject, body, type, event, is_default, is_active)
  VALUES
  (default_tenant_id, 'Visitor Invitation', 'You have been invited to visit {{facility_name}}', 
   'Dear {{visitor_name}},\n\nYou have been invited to visit {{facility_name}} on {{visit_date}} at {{visit_time}}.\n\nPurpose: {{purpose}}\nHost: {{host_name}}\n\nPlease complete your pre-registration by clicking the link below:\n\n{{pre_registration_link}}\n\nThank you,\n{{organization_name}}', 
   'email', 'invitation', true, true),
   
  (default_tenant_id, 'Visit Approved', 'Your visit to {{facility_name}} has been approved', 
   'Dear {{visitor_name}},\n\nYour visit to {{facility_name}} on {{visit_date}} at {{visit_time}} has been approved.\n\nPurpose: {{purpose}}\nHost: {{host_name}}\n\nPlease arrive 15 minutes before your scheduled time and bring a valid ID.\n\nThank you,\n{{organization_name}}', 
   'email', 'approval', true, true),
   
  (default_tenant_id, 'Visit Rejected', 'Your visit to {{facility_name}} has been rejected', 
   'Dear {{visitor_name}},\n\nWe regret to inform you that your visit to {{facility_name}} on {{visit_date}} at {{visit_time}} has been rejected.\n\nReason: {{rejection_reason}}\n\nIf you have any questions, please contact your host, {{host_name}}.\n\nThank you,\n{{organization_name}}', 
   'email', 'rejection', true, true),
   
  (default_tenant_id, 'Check-in Confirmation', 'Check-in confirmation for {{facility_name}}', 
   'Dear {{visitor_name}},\n\nThis is to confirm that you have successfully checked in at {{facility_name}} on {{check_in_date}} at {{check_in_time}}.\n\nYour badge number is: {{badge_number}}\n\nHost: {{host_name}}\n\nThank you,\n{{organization_name}}', 
   'email', 'check_in', true, true),
   
  (default_tenant_id, 'Check-out Confirmation', 'Check-out confirmation for {{facility_name}}', 
   'Dear {{visitor_name}},\n\nThis is to confirm that you have successfully checked out from {{facility_name}} on {{check_out_date}} at {{check_out_time}}.\n\nThank you for your visit.\n\n{{organization_name}}', 
   'email', 'check_out', true, true),
   
  (default_tenant_id, 'Host Notification - New Visit', 'New visitor scheduled: {{visitor_name}}', 
   'Dear {{host_name}},\n\nA new visit has been scheduled for you:\n\nVisitor: {{visitor_name}}\nCompany: {{visitor_company}}\nDate: {{visit_date}}\nTime: {{visit_time}}\nPurpose: {{purpose}}\n\nPlease ensure you are available to receive your visitor.\n\nThank you,\n{{organization_name}}', 
   'email', 'host_notification', true, true),
   
  (default_tenant_id, 'Host Notification - Visitor Arrived', 'Your visitor has arrived: {{visitor_name}}', 
   'Dear {{host_name}},\n\nYour visitor has arrived and checked in at {{facility_name}}:\n\nVisitor: {{visitor_name}}\nCompany: {{visitor_company}}\nChecked in at: {{check_in_time}}\nPurpose: {{purpose}}\n\nPlease proceed to the reception area to meet your visitor.\n\nThank you,\n{{organization_name}}', 
   'email', 'visitor_arrived', true, true),
   
  (default_tenant_id, 'Security Alert', 'Security Alert: {{alert_type}}', 
   'SECURITY ALERT\n\nType: {{alert_type}}\nSeverity: {{severity}}\nLocation: {{facility_name}}\nTime: {{alert_time}}\n\nDetails: {{alert_message}}\n\nPlease follow security protocols and respond accordingly.\n\n{{organization_name}} Security Team', 
   'email', 'security_alert', true, true);
   
  -- Insert default SMS templates
  INSERT INTO notification_templates (tenant_id, name, subject, body, type, event, is_default, is_active)
  VALUES
  (default_tenant_id, 'SMS Visitor Invitation', NULL, 
   'You have been invited to visit {{facility_name}} on {{visit_date}}. Complete pre-registration: {{pre_registration_link}}', 
   'sms', 'invitation', true, true),
   
  (default_tenant_id, 'SMS Host Notification', NULL, 
   'Your visitor {{visitor_name}} has arrived at {{facility_name}}. Please proceed to reception.', 
   'sms', 'visitor_arrived', true, true),
   
  (default_tenant_id, 'SMS Security Alert', NULL, 
   'SECURITY ALERT: {{alert_type}} at {{facility_name}}. Severity: {{severity}}. {{alert_message}}', 
   'sms', 'security_alert', true, true);
   
  -- Insert default push notification templates
  INSERT INTO notification_templates (tenant_id, name, subject, body, type, event, is_default, is_active)
  VALUES
  (default_tenant_id, 'Push Visitor Arrived', 'Visitor Arrived', 
   'Your visitor {{visitor_name}} has arrived at {{facility_name}}.', 
   'push', 'visitor_arrived', true, true),
   
  (default_tenant_id, 'Push Security Alert', 'Security Alert', 
   '{{alert_type}} at {{facility_name}}. Severity: {{severity}}.', 
   'push', 'security_alert', true, true);
   
END $$;