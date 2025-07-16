/*
  # Enhance Invitation Flow

  1. Changes
    - Update the invitation flow to only generate pre-registration links after approval
    - Add a new function to generate pre-registration links
    - Update existing invitations to ensure consistency

  2. Security
    - Maintain existing RLS policies
*/

-- Add a function to generate a pre-registration link for an invitation
CREATE OR REPLACE FUNCTION generate_pre_registration_link()
RETURNS text AS $$
BEGIN
  RETURN 'pre-register/' || gen_random_uuid()::text;
END;
$$ LANGUAGE plpgsql;

-- Add comment to document the function
COMMENT ON FUNCTION generate_pre_registration_link IS 'Generate a unique pre-registration link for an invitation';

-- Update existing approved invitations to ensure they have pre-registration links if required
UPDATE invitations
SET pre_registration_link = generate_pre_registration_link()
WHERE status = 'approved' 
AND pre_registration_required = true 
AND pre_registration_link IS NULL;

-- Update existing visits to ensure they have pre-registration links if required
UPDATE visits
SET pre_registration_link = generate_pre_registration_link()
WHERE pre_registration_required = true 
AND pre_registration_link IS NULL;