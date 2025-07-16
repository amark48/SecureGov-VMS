/*
  # Fix Custom Departments Column Type

  1. Changes
    - Convert any JSONB custom_departments values to text[]
    - Leave text[] values unchanged

  2. Security
    - Maintain existing RLS policies
*/

-- Create a helper function to convert JSONB array to text[]
CREATE OR REPLACE FUNCTION convert_departments_to_array(departments jsonb)
RETURNS text[] AS $$
DECLARE
  result text[];
BEGIN
  IF departments IS NULL THEN
    RETURN '{}';
  END IF;

  IF jsonb_typeof(departments) = 'array' THEN
    SELECT array_agg(value::text) INTO result
    FROM jsonb_array_elements_text(departments);
    RETURN result;
  END IF;

  RETURN '{}';
END;
$$ LANGUAGE plpgsql;

-- Loop over tenants, only converting rows that are jsonb
DO $$
DECLARE
  tenant_record RECORD;
BEGIN
  FOR tenant_record IN 
    SELECT 
      id, 
      custom_departments, 
      pg_typeof(custom_departments) AS col_type 
    FROM tenants
    WHERE custom_departments IS NOT NULL
  LOOP
    IF tenant_record.col_type = 'jsonb'::regtype THEN
      UPDATE tenants
      SET custom_departments = convert_departments_to_array(custom_departments::jsonb)
      WHERE id = tenant_record.id;
    END IF;
  END LOOP;
END $$;

-- Add comment to document the column
COMMENT ON COLUMN tenants.custom_departments IS 'List of custom departments for this tenant (text array)';
