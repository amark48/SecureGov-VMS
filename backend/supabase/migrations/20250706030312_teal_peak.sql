/*
  # Fix User Creation Issues

  1. Changes
    - Remove password validation constraints from profiles table
    - Add first_name and last_name NOT NULL constraints
    - Update existing profiles to ensure first_name and last_name are populated
    - Add helper function for user creation

  2. Security
    - Maintain existing RLS policies
*/

-- Ensure first_name and last_name are not null
UPDATE profiles
SET 
  first_name = CASE 
    WHEN first_name IS NULL AND position(' ' in full_name) > 0 
    THEN substring(full_name from 1 for position(' ' in full_name) - 1)
    WHEN first_name IS NULL
    THEN full_name
    ELSE first_name
  END,
  last_name = CASE 
    WHEN last_name IS NULL AND position(' ' in full_name) > 0 
    THEN substring(full_name from position(' ' in full_name) + 1)
    WHEN last_name IS NULL
    THEN ''
    ELSE last_name
  END
WHERE first_name IS NULL OR last_name IS NULL;

-- Add NOT NULL constraints to first_name and last_name
ALTER TABLE profiles 
  ALTER COLUMN first_name SET NOT NULL,
  ALTER COLUMN last_name SET NOT NULL;

-- Create a helper function for user creation
CREATE OR REPLACE FUNCTION create_user(
  p_email TEXT,
  p_password_hash TEXT,
  p_first_name TEXT,
  p_last_name TEXT,
  p_role TEXT,
  p_tenant_id UUID,
  p_department TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_employee_number TEXT DEFAULT NULL,
  p_security_clearance TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_user_id UUID;
  v_full_name TEXT;
BEGIN
  -- Combine first and last name
  v_full_name := p_first_name || ' ' || p_last_name;
  
  -- Insert the user
  INSERT INTO profiles (
    email, 
    password_hash, 
    full_name, 
    first_name, 
    last_name, 
    role, 
    tenant_id, 
    department, 
    phone, 
    employee_number, 
    security_clearance, 
    is_active
  ) VALUES (
    p_email,
    p_password_hash,
    v_full_name,
    p_first_name,
    p_last_name,
    p_role,
    p_tenant_id,
    p_department,
    p_phone,
    p_employee_number,
    p_security_clearance,
    true
  ) RETURNING id INTO v_user_id;
  
  RETURN v_user_id;
END;
$$ LANGUAGE plpgsql;

-- Add comment to document the function
COMMENT ON FUNCTION create_user IS 'Helper function to create a new user with proper name handling';