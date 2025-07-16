/*
  # Remove Vonage from Notification Service

  1. Changes
    - Update the notification service to remove Vonage
    - Keep Twilio as the only SMS provider option
    - Update existing tenants with Vonage to use 'none' as SMS provider

  2. Security
    - Maintain existing RLS policies
*/

-- Update any tenants using Vonage to use 'none' as SMS provider
UPDATE tenants
SET sms_provider = 'none'
WHERE sms_provider = 'vonage';

-- Update any notification templates for Vonage to be inactive
UPDATE notification_templates
SET is_active = false
WHERE type = 'sms' AND body LIKE '%vonage%';