/*
  # Fix Notification Templates for Account Created Event

  1. Changes
    - Add account_created notification template for all tenants
    - This ensures that all tenants have the necessary templates for user management

  2. Security
    - Maintain existing RLS policies
*/

-- Insert account_created notification template for all tenants
DO $$
DECLARE
  tenant_record RECORD;
BEGIN
  -- Loop through all tenants
  FOR tenant_record IN SELECT id FROM tenants LOOP
    -- Insert email template for account_created event
    INSERT INTO notification_templates (
      tenant_id, name, subject, body, type, event, is_default, is_active
    ) VALUES (
      tenant_record.id,
      'Account Created Notification',
      'Your account has been created on {{organization_name}}',
      'Dear {{user_name}},\n\nYour account has been created on {{organization_name}}.\n\nEmail: {{user_email}}\nRole: {{user_role}}\nTemporary Password: {{temp_password}}\n\nPlease log in and change your password as soon as possible.\n\nThank you,\n{{organization_name}}',
      'email',
      'account_created',
      true,
      true
    )
    ON CONFLICT (tenant_id, type, event, is_default) DO NOTHING;
    
    -- Insert SMS template for account_created event
    INSERT INTO notification_templates (
      tenant_id, name, subject, body, type, event, is_default, is_active
    ) VALUES (
      tenant_record.id,
      'Account Created SMS',
      NULL,
      'Your {{organization_name}} account has been created. Email: {{user_email}}, Temp password: {{temp_password}}. Please log in and change your password.',
      'sms',
      'account_created',
      true,
      true
    )
    ON CONFLICT (tenant_id, type, event, is_default) DO NOTHING;
  END LOOP;
END $$;