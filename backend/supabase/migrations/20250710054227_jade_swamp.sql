/*
  # Enhance Invitation Flow

  1. Changes
    - Add a trigger to generate pre-registration link only when an invitation is approved
    - Update existing invitations to ensure pre-registration links are only present for approved invitations
    - Add a function to generate secure pre-registration tokens

  2. Security
    - Maintain existing RLS policies
    - Ensure pre-registration links are secure and unique
*/

-- Create a function to generate a secure random token
CREATE OR REPLACE FUNCTION generate_secure_token(length integer DEFAULT 32)
RETURNS text AS $$
DECLARE
  chars text := 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  result text := '';
  i integer := 0;
  chars_length integer := length(chars);
  random_bytes bytea;
BEGIN
  -- Generate random bytes
  random_bytes := gen_random_bytes(length);
  
  -- Convert random bytes to characters from the chars string
  FOR i IN 0..(length-1) LOOP
    result := result || substr(chars, 1 + (get_byte(random_bytes, i) % chars_length), 1);
  END LOOP;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Create a function to generate a pre-registration link
CREATE OR REPLACE FUNCTION generate_pre_registration_link()
RETURNS text AS $$
DECLARE
  token text;
BEGIN
  -- Generate a secure token
  token := generate_secure_token(32);
  
  -- Return the token (in a real implementation, this would be a full URL)
  RETURN token;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger function to handle invitation status changes
CREATE OR REPLACE FUNCTION handle_invitation_status_change()
RETURNS TRIGGER AS $$
BEGIN
  -- If the invitation is being approved and requires pre-registration
  IF NEW.status = 'approved' AND NEW.status <> OLD.status AND NEW.pre_registration_required = true THEN
    -- Generate a pre-registration link if one doesn't exist
    IF NEW.pre_registration_link IS NULL THEN
      NEW.pre_registration_link := generate_pre_registration_link();
    END IF;
  END IF;
  
  -- If the invitation is being rejected or cancelled, remove the pre-registration link
  IF (NEW.status = 'rejected' OR NEW.status = 'cancelled') AND NEW.status <> OLD.status THEN
    NEW.pre_registration_link := NULL;
    NEW.pre_registration_status := NULL;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger on the invitations table
DROP TRIGGER IF EXISTS invitation_status_change_trigger ON invitations;
CREATE TRIGGER invitation_status_change_trigger
BEFORE UPDATE ON invitations
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION handle_invitation_status_change();

-- Update existing invitations to ensure pre-registration links are only present for approved invitations
UPDATE invitations
SET pre_registration_link = NULL, pre_registration_status = NULL
WHERE status <> 'approved' AND pre_registration_link IS NOT NULL;

-- Generate pre-registration links for approved invitations that require pre-registration but don't have a link
UPDATE invitations
SET pre_registration_link = generate_pre_registration_link()
WHERE status = 'approved' AND pre_registration_required = true AND pre_registration_link IS NULL;

-- Add comment to document the trigger
COMMENT ON FUNCTION handle_invitation_status_change IS 'Trigger function to generate pre-registration links when invitations are approved and remove them when rejected or cancelled';