/*
  # Fix Password Reset Functionality

  1. Changes
    - Add a function to properly reset user passwords
    - Ensure consistent password hashing across the application
    - Fix issues with password reset and login verification

  2. Security
    - Maintain existing RLS policies
    - Ensure proper password hashing with bcrypt
*/

-- Create a function to reset a user's password with proper hashing
CREATE OR REPLACE FUNCTION reset_user_password_with_hash(
  p_user_id UUID,
  p_new_password TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  v_hashed_password TEXT;
  v_bcrypt_rounds INTEGER := 12; -- Default to 12 rounds if not specified
BEGIN
  -- Log the function call (without the password)
  RAISE NOTICE 'Resetting password for user ID: %', p_user_id;
  
  -- Hash the password using pgcrypto's crypt function with bcrypt
  v_hashed_password := crypt(p_new_password, gen_salt('bf', v_bcrypt_rounds));
  
  -- Update the user's password
  UPDATE profiles
  SET password_hash = v_hashed_password,
      updated_at = NOW()
  WHERE id = p_user_id;
  
  -- Check if the update was successful
  IF FOUND THEN
    RAISE NOTICE 'Password reset successful for user ID: %', p_user_id;
    RETURN TRUE;
  ELSE
    RAISE NOTICE 'Password reset failed: user ID % not found', p_user_id;
    RETURN FALSE;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Create a function to verify a password against a hash
CREATE OR REPLACE FUNCTION verify_password(
  p_password TEXT,
  p_hash TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  v_result BOOLEAN;
BEGIN
  -- Use pgcrypto's crypt function to verify the password
  SELECT (p_hash = crypt(p_password, p_hash)) INTO v_result;
  RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- Add comments to document the functions
COMMENT ON FUNCTION reset_user_password_with_hash IS 'Resets a user''s password with proper bcrypt hashing';
COMMENT ON FUNCTION verify_password IS 'Verifies a password against a bcrypt hash';