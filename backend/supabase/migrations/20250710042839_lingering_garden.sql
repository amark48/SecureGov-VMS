/*
  # Restore Recurrence Fields in Invitations Table

  1. Changes
    - Ensure recurrence_type, recurrence_interval, recurrence_days_of_week, and recurrence_end_date columns exist in invitations table
    - Add default values for these columns
    - Add comments to document the purpose of these fields

  2. Security
    - Maintain existing RLS policies
*/

-- Add recurrence columns to invitations table if they don't exist
DO $$
BEGIN
  -- Check if recurrence_type column exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'invitations' AND column_name = 'recurrence_type'
  ) THEN
    ALTER TABLE invitations ADD COLUMN recurrence_type TEXT DEFAULT 'none';
  END IF;

  -- Check if recurrence_interval column exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'invitations' AND column_name = 'recurrence_interval'
  ) THEN
    ALTER TABLE invitations ADD COLUMN recurrence_interval INTEGER DEFAULT 1;
  END IF;

  -- Check if recurrence_days_of_week column exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'invitations' AND column_name = 'recurrence_days_of_week'
  ) THEN
    ALTER TABLE invitations ADD COLUMN recurrence_days_of_week INTEGER[] DEFAULT '{}';
  END IF;

  -- Check if recurrence_end_date column exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'invitations' AND column_name = 'recurrence_end_date'
  ) THEN
    ALTER TABLE invitations ADD COLUMN recurrence_end_date DATE;
  END IF;
END $$;

-- Add comments to document the purpose of these fields
COMMENT ON COLUMN invitations.recurrence_type IS 'Type of recurrence (none, daily, weekly, monthly)';
COMMENT ON COLUMN invitations.recurrence_interval IS 'Interval for recurrence (e.g., every 1 day, every 2 weeks)';
COMMENT ON COLUMN invitations.recurrence_days_of_week IS 'Days of the week for weekly recurrence (0-6, where 0 is Sunday)';
COMMENT ON COLUMN invitations.recurrence_end_date IS 'End date for recurring invitations';

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_invitations_recurrence_type ON invitations(recurrence_type);
CREATE INDEX IF NOT EXISTS idx_invitations_recurrence_end_date ON invitations(recurrence_end_date);