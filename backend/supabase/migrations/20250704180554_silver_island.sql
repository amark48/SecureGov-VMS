/*
  # Add Account Updated Notification Template

  This migration adds a new notification template for account updates.
  
  1. New Templates
    - Email template for account_updated event
    - SMS template for account_updated event
*/

-- Insert account_updated notification template for all tenants
DO $$
DECLARE
  tenant_record RECORD;
BEGIN
  -- Loop through all tenants
  FOR tenant_record IN SELECT id FROM tenants LOOP
    -- Insert email template for account_updated event
    INSERT INTO notification_templates (
      tenant_id, name, subject, body, type, event, is_default, is_active
    ) VALUES (
      tenant_record.id,
      'Account Updated Notification',
      'Your account has been updated on {{organization_name}}',
      'Dear {{user_name}},\n\nYour account has been updated on {{organization_name}}.\n\nThe following information was updated: {{updated_fields}}\n\nIf you did not request these changes, please contact your administrator immediately.\n\nThank you,\n{{organization_name}}',
      'email',
      'account_updated',
      true,
      true
    )
    ON CONFLICT (tenant_id, type, event, is_default) DO NOTHING;
    
    -- Insert SMS template for account_updated event
    INSERT INTO notification_templates (
      tenant_id, name, subject, body, type, event, is_default, is_active
    ) VALUES (
      tenant_record.id,
      'Account Updated SMS',
      NULL,
      'Your {{organization_name}} account has been updated. Changes: {{updated_fields}}. If you did not request these changes, please contact your administrator.',
      'sms',
      'account_updated',
      true,
      true
    )
    ON CONFLICT (tenant_id, type, event, is_default) DO NOTHING;
  END LOOP;
END $$;