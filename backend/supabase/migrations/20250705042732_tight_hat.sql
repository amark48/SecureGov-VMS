/*
  # Fix Notification Logs and Add Recipient Name

  1. New Columns
    - Add `recipient_name` column to notification_logs table
    - This will help with displaying the recipient's name in the UI

  2. Changes
    - Update existing notification logs to include recipient name where possible
    - Add index on recipient_name for faster searching
*/

-- Add recipient_name column to notification_logs table
ALTER TABLE notification_logs
ADD COLUMN IF NOT EXISTS recipient_name TEXT;

-- Add comment to document the purpose of this field
COMMENT ON COLUMN notification_logs.recipient_name IS 'Name of the recipient for display purposes';

-- Create index on recipient_name for faster searching
CREATE INDEX IF NOT EXISTS idx_notification_logs_recipient_name ON notification_logs(recipient_name);

-- Update existing notification logs to include recipient name where possible
UPDATE notification_logs nl
SET recipient_name = p.full_name
FROM profiles p
WHERE nl.recipient_user_id = p.id AND nl.recipient_name IS NULL;