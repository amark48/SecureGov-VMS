/*
  # Fix Recurring Visits

  1. Changes
    - Add `recurring_invitation_id` column to visits table
    - This column is needed to link recurring visits to their parent invitation

  2. Security
    - Maintain existing RLS policies
*/

-- Add recurring_invitation_id column to visits table
ALTER TABLE visits
ADD COLUMN IF NOT EXISTS recurring_invitation_id UUID REFERENCES invitations(id);

-- Add comment to document the purpose of this field
COMMENT ON COLUMN visits.recurring_invitation_id IS 'Reference to the recurring invitation that generated this visit';

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_visits_recurring_invitation_id ON visits(recurring_invitation_id);