/*
  # Add Recurring Invitations Support

  1. New Columns
    - Add `recurrence_type` column to invitations table
    - Add `recurrence_interval` column to invitations table
    - Add `recurrence_days_of_week` column to invitations table
    - Add `recurrence_end_date` column to invitations table
    - Add `parent_invitation_id` column to invitations table for linking recurring instances

  2. Changes
    - Update existing invitations to have 'none' as the default recurrence type
    - Add comments to document the purpose of these fields

  3. Security
    - Maintain existing RLS policies
*/

-- Add recurrence columns to invitations table
ALTER TABLE invitations
ADD COLUMN IF NOT EXISTS recurrence_type TEXT DEFAULT 'none',
ADD COLUMN IF NOT EXISTS recurrence_interval INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS recurrence_days_of_week INTEGER[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS recurrence_end_date DATE,
ADD COLUMN IF NOT EXISTS parent_invitation_id UUID REFERENCES invitations(id);

-- Add recurrence columns to visits table to maintain consistency
ALTER TABLE visits
ADD COLUMN IF NOT EXISTS recurrence_type TEXT DEFAULT 'none',
ADD COLUMN IF NOT EXISTS recurrence_interval INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS recurrence_days_of_week INTEGER[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS recurrence_end_date DATE,
ADD COLUMN IF NOT EXISTS parent_visit_id UUID REFERENCES visits(id);

-- Add comments to document the purpose of these fields
COMMENT ON COLUMN invitations.recurrence_type IS 'Type of recurrence (none, daily, weekly, monthly)';
COMMENT ON COLUMN invitations.recurrence_interval IS 'Interval for recurrence (e.g., every 1 day, every 2 weeks)';
COMMENT ON COLUMN invitations.recurrence_days_of_week IS 'Days of the week for weekly recurrence (0-6, where 0 is Sunday)';
COMMENT ON COLUMN invitations.recurrence_end_date IS 'End date for recurring invitations';
COMMENT ON COLUMN invitations.parent_invitation_id IS 'Reference to the parent invitation for recurring instances';

COMMENT ON COLUMN visits.recurrence_type IS 'Type of recurrence (none, daily, weekly, monthly)';
COMMENT ON COLUMN visits.recurrence_interval IS 'Interval for recurrence (e.g., every 1 day, every 2 weeks)';
COMMENT ON COLUMN visits.recurrence_days_of_week IS 'Days of the week for weekly recurrence (0-6, where 0 is Sunday)';
COMMENT ON COLUMN visits.recurrence_end_date IS 'End date for recurring visits';
COMMENT ON COLUMN visits.parent_visit_id IS 'Reference to the parent visit for recurring instances';

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_invitations_recurrence_type ON invitations(recurrence_type);
CREATE INDEX IF NOT EXISTS idx_invitations_parent_invitation_id ON invitations(parent_invitation_id);
CREATE INDEX IF NOT EXISTS idx_visits_recurrence_type ON visits(recurrence_type);
CREATE INDEX IF NOT EXISTS idx_visits_parent_visit_id ON visits(parent_visit_id);