-- Add recurring_invitation_id to visits table
ALTER TABLE visits
ADD COLUMN IF NOT EXISTS recurring_invitation_id UUID REFERENCES invitations(id);

COMMENT ON COLUMN visits.recurring_invitation_id IS 'References the parent recurring invitation that generated this visit instance.';

CREATE INDEX IF NOT EXISTS idx_visits_recurring_invitation_id ON visits(recurring_invitation_id);
