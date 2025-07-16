/*
  # Add Default Email Template for Testing

  1. Changes
    - Add a default email template for testing to all tenants
    - This ensures that the test email functionality works out of the box

  2. Security
    - No security changes
*/

-- Insert test email template for all tenants
DO $$
DECLARE
  tenant_record RECORD;
BEGIN
  -- Loop through all tenants
  FOR tenant_record IN SELECT id FROM tenants LOOP
    -- Insert email template for testing
    INSERT INTO notification_templates (
      tenant_id, name, subject, body, type, event, is_default, is_active
    ) VALUES (
      tenant_record.id,
      'Test Email Template',
      'Test Email from {{organization_name}}',
      'This is a test email from {{organization_name}}.\n\nThis email was sent to test the notification system configuration.\n\nIf you received this email, the email notification system is working correctly.\n\nThank you,\n{{organization_name}}',
      'email',
      'test',
      true,
      true
    )
    ON CONFLICT (tenant_id, type, event, is_default) DO NOTHING;
  END LOOP;
END $$;
