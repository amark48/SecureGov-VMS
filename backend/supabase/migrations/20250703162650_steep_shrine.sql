/*
  # Add Notification Provider Settings to Tenants

  1. New Columns
    - Add `email_provider` column to tenants table
    - Add `email_config` column to tenants table
    - Add `sms_provider` column to tenants table
    - Add `sms_config` column to tenants table
    - Add `push_provider` column to tenants table
    - Add `push_config` column to tenants table

  2. Changes
    - Set default values for new columns
    - Add comments to document the purpose of these fields
*/

-- Add notification provider columns to tenants table
ALTER TABLE tenants
ADD COLUMN IF NOT EXISTS email_provider TEXT DEFAULT 'smtp',
ADD COLUMN IF NOT EXISTS email_config JSONB DEFAULT '{"host": "", "port": 587, "secure": false, "user": "", "pass": "", "from": "noreply@example.com"}',
ADD COLUMN IF NOT EXISTS sms_provider TEXT DEFAULT 'none',
ADD COLUMN IF NOT EXISTS sms_config JSONB DEFAULT '{"account_sid": "", "auth_token": "", "from_number": ""}',
ADD COLUMN IF NOT EXISTS push_provider TEXT DEFAULT 'none',
ADD COLUMN IF NOT EXISTS push_config JSONB DEFAULT '{"api_key": "", "app_id": ""}';

-- Add comments to document the purpose of these fields
COMMENT ON COLUMN tenants.email_provider IS 'Email provider (smtp, sendgrid, mailgun)';
COMMENT ON COLUMN tenants.email_config IS 'Email provider configuration (JSON)';
COMMENT ON COLUMN tenants.sms_provider IS 'SMS provider (none, twilio, vonage)';
COMMENT ON COLUMN tenants.sms_config IS 'SMS provider configuration (JSON)';
COMMENT ON COLUMN tenants.push_provider IS 'Push notification provider (none, fcm, onesignal)';
COMMENT ON COLUMN tenants.push_config IS 'Push notification provider configuration (JSON)';