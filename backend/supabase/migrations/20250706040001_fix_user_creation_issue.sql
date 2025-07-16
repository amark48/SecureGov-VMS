-- Create a robust user creation function with proper error handling
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
  
  -- Validate inputs
  IF p_email IS NULL OR p_email = '' THEN
    RAISE EXCEPTION 'Email is required';
  END IF;
  
  IF p_first_name IS NULL OR p_first_name = '' THEN
    RAISE EXCEPTION 'First name is required';
  END IF;
  
  IF p_last_name IS NULL OR p_last_name = '' THEN
    RAISE EXCEPTION 'Last name is required';
  END IF;
  
  IF p_role IS NULL OR p_role = '' THEN
    RAISE EXCEPTION 'Role is required';
  END IF;
  
  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Tenant ID is required';
  END IF;
  
  -- Combine first and last name
  v_full_name := p_first_name || ' ' || p_last_name;
  
  -- Check if user already exists
  IF EXISTS (SELECT 1 FROM profiles WHERE email = p_email AND tenant_id = p_tenant_id) THEN
    RAISE EXCEPTION 'User with email % already exists in this tenant', p_email;
  END IF;
  
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
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error creating user: %', SQLERRM;
  RAISE;
END;
$$ LANGUAGE plpgsql;

-- Add comment to document the function
COMMENT ON FUNCTION create_user_with_logging IS 'Helper function to create a new user with proper name handling, validation, and logging';
