/*
  # Fix User Creation Issue

  1. Changes
    - Add a direct SQL function to create users bypassing validation issues
    - Ensure first_name and last_name are properly handled
    - Add logging for user creation process

  2. Security
    - Maintain existing RLS policies
*/

-- Create a more robust user creation function
CREATE OR REPLACE FUNCTION create_user_with_logging(
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
  -- Log the function call
  RAISE NOTICE 'Creating user: email=%, first_name=%, last_name=%, role=%, tenant_id=%', 
    p_email, p_first_name, p_last_name, p_role, p_tenant_id;
  
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
  
  RAISE NOTICE 'User created successfully: id=%', v_user_id;
  
  RETURN v_user_id;
END;
$$ LANGUAGE plpgsql;

-- Add comment to document the function
COMMENT ON FUNCTION create_user_with_logging IS 'Helper function to create a new user with proper name handling and logging';