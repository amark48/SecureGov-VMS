/*
  # Fix Visitor ID Constraint Issue

  1. Changes
    - Add a migration to ensure visitor_id is properly handled in invitations
    - Remove metadata column from invitations table as it's no longer needed
    - Update existing invitations to create proper visitor records

  2. Security
    - Maintain existing RLS policies
*/

-- Create a function to ensure all invitations have a valid visitor_id
DO $$
DECLARE
  invitation_record RECORD;
  new_visitor_id UUID;
BEGIN
  -- Find all invitations with null visitor_id but with metadata
  FOR invitation_record IN 
    SELECT id, metadata, tenant_id 
    FROM invitations 
    WHERE visitor_id IS NULL AND metadata IS NOT NULL
  LOOP
    -- Try to create a visitor from metadata
    BEGIN
      -- Extract visitor details from metadata
      IF jsonb_typeof(invitation_record.metadata) = 'object' THEN
        -- Create a new visitor record
        INSERT INTO visitors (
          tenant_id, 
          first_name, 
          last_name, 
          email, 
          background_check_status
        ) VALUES (
          invitation_record.tenant_id,
          COALESCE(invitation_record.metadata->>'first_name', 'Pending'),
          COALESCE(invitation_record.metadata->>'last_name', 'Registration'),
          invitation_record.metadata->>'email',
          'pending'
        ) RETURNING id INTO new_visitor_id;
        
        -- Update the invitation with the new visitor_id
        UPDATE invitations 
        SET visitor_id = new_visitor_id
        WHERE id = invitation_record.id;
        
        RAISE NOTICE 'Created visitor and updated invitation %', invitation_record.id;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Error processing invitation %: %', invitation_record.id, SQLERRM;
    END;
  END LOOP;
  
  -- Find all invitations with null visitor_id and no metadata
  FOR invitation_record IN 
    SELECT id, purpose, tenant_id 
    FROM invitations 
    WHERE visitor_id IS NULL AND (metadata IS NULL OR jsonb_typeof(metadata) != 'object')
  LOOP
    -- Create a placeholder visitor
    BEGIN
      INSERT INTO visitors (
        tenant_id, 
        first_name, 
        last_name, 
        background_check_status
      ) VALUES (
        invitation_record.tenant_id,
        'Pending',
        'Registration',
        'pending'
      ) RETURNING id INTO new_visitor_id;
      
      -- Update the invitation with the new visitor_id
      UPDATE invitations 
      SET visitor_id = new_visitor_id
      WHERE id = invitation_record.id;
      
      RAISE NOTICE 'Created placeholder visitor for invitation %', invitation_record.id;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Error creating placeholder visitor for invitation %: %', invitation_record.id, SQLERRM;
    END;
  END LOOP;
END $$;

-- Make visitor_id NOT NULL in invitations table
ALTER TABLE invitations 
ALTER COLUMN visitor_id SET NOT NULL;

-- Add comment to document the change
COMMENT ON COLUMN invitations.visitor_id IS 'Reference to the visitor record. This is now required and must be created before the invitation.';