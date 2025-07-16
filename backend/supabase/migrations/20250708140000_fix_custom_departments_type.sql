/*
  # Fix Custom Departments Column Type

  1. Changes
    - Ensure custom_departments column is properly handled as text[]
    - Add helper function to convert between JSON and text[] if needed

  2. Security
    - Maintain existing RLS policies
*/

-- Create a helper function to convert between JSON and text[] for custom_departments
CREATE OR REPLACE FUNCTION convert_departments_to_array(departments jsonb)
RETURNS text[] AS $$
DECLARE
  result text[];
BEGIN
  -- If input is null, return empty array
  IF departments IS NULL THEN
    RETURN '{}';
  END IF;
  
  -- If input is a JSON array, convert to text array
  IF jsonb_typeof(departments) = 'array' THEN
    SELECT array_agg(value::text) INTO result
    FROM jsonb_array_elements_text(departments);
    RETURN result;
  END IF;
  
  -- If input is something else, return empty array
  RETURN '{}';
END;
$$ LANGUAGE plpgsql;

-- Update any existing tenants with JSON custom_departments to use text[]
DO $$
DECLARE
  tenant_record RECORD;
BEGIN
  FOR tenant_record IN SELECT id, custom_departments FROM tenants WHERE custom_departments IS NOT NULL LOOP
    IF jsonb_typeof(tenant_record.custom_departments::jsonb) = 'array' THEN
      UPDATE tenants
      SET custom_departments = convert_departments_to_array(tenant_record.custom_departments::jsonb)
      WHERE id = tenant_record.id;
    END IF;
  END LOOP;
END $$;

-- Add comment to document the purpose of this field
COMMENT ON COLUMN tenants.custom_departments IS 'List of custom departments for this tenant (text array)';
