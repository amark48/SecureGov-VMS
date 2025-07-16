/*
  # Add Tenant Admin Creation Functions

  1. New Functions
    - Add function to create a tenant admin user
    - Add function to reset a user's password

  2. Changes
    - Ensure proper error handling and validation
    - Add logging for debugging purposes

  3. Security
    - Maintain existing RLS policies
*/

-- Create a function to create a tenant admin user
CREATE OR REPLACE FUNCTION create_tenant_admin(
  p_email TEXT,
  p_password_hash TEXT,
  p_first_name TEXT,
  p_last_name TEXT,
  p_tenant_id UUID
) RETURNS UUID AS $$
DECLARE
  v_user_id UUID;
  v_full_name TEXT;
  v_tenant_prefix TEXT;
  v_next_employee_sequence INTEGER;
  v_employee_number TEXT;
BEGIN
  -- Log the function call
  RAISE NOTICE 'Creating tenant admin: email=%, first_name=%, last_name=%, tenant_id=%', 
    p_email, p_first_name, p_last_name, p_tenant_id;
  
  -- Validate inputs
  IF p_email IS NULL OR p_email = '' THEN
    RAISE EXCEPTION 'Email is required';
  END IF;
  
  IF p_password_hash IS NULL OR p_password_hash = '' THEN
    RAISE EXCEPTION 'Password hash is required';
  END IF;
  
  IF p_first_name IS NULL OR p_first_name = '' THEN
    RAISE EXCEPTION 'First name is required';
  END IF;
  
  IF p_last_name IS NULL OR p_last_name = '' THEN
    RAISE EXCEPTION 'Last name is required';
  END IF;
  
  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Tenant ID is required';
  END IF;
  
  -- Combine first and last name
  v_full_name := p_first_name || ' ' || p_last_name;
  
  -- Check if user already exists
  IF EXISTS (SELECT 1 FROM profiles WHERE email = p_email) THEN
    RAISE EXCEPTION 'User with email % already exists', p_email;
  END IF;
  
  -- Get tenant prefix and next sequence
  SELECT tenant_prefix, next_employee_sequence 
  INTO v_tenant_prefix, v_next_employee_sequence
  FROM tenants 
  WHERE id = p_tenant_id;
  
  -- Generate employee number
  v_employee_number := v_tenant_prefix || LPAD(v_next_employee_sequence::TEXT, 6, '0');
  
  -- Update tenant sequence
  UPDATE tenants 
  SET next_employee_sequence = next_employee_sequence + 1
  WHERE id = p_tenant_id;
  
  -- Insert the admin user
  INSERT INTO profiles (
    email, 
    password_hash, 
    full_name, 
    first_name, 
    last_name, 
    role, 
    tenant_id, 
    employee_number, 
    is_active
  ) VALUES (
    p_email,
    p_password_hash,
    v_full_name,
    p_first_name,
    p_last_name,
    'admin',
    p_tenant_id,
    v_employee_number,
    true
  ) RETURNING id INTO v_user_id;
  
  RAISE NOTICE 'Tenant admin created successfully: id=%, employee_number=%', v_user_id, v_employee_number;
  
  RETURN v_user_id;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error creating tenant admin: %', SQLERRM;
  RAISE;
END;
$$ LANGUAGE plpgsql;

-- Create a function to reset a user's password
CREATE OR REPLACE FUNCTION reset_user_password(
  p_user_id UUID,
  p_new_password_hash TEXT
) RETURNS BOOLEAN AS $$
BEGIN
  -- Update the user's password
  UPDATE profiles
  SET password_hash = p_new_password_hash,
      updated_at = NOW()
  WHERE id = p_user_id;
  
  -- Check if the update was successful
  IF FOUND THEN
    RETURN TRUE;
  ELSE
    RETURN FALSE;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Add comments to document the functions
COMMENT ON FUNCTION create_tenant_admin IS 'Creates a new tenant admin user with the specified details';
COMMENT ON FUNCTION reset_user_password IS 'Resets a user''s password to the specified hash';