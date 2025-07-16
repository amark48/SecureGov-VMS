-- # Fix Invitation Date Validation for Timezone Issues
--
-- This migration updates the validate_invitation_dates function to properly handle
-- timezone differences between client and server by using UTC date comparison.
--
-- 1. Changes
--   - Update the validate_invitation_dates function to use UTC date comparison
--   - Fix the issue where a date that is "today" on the client might be considered
--     "yesterday" by the server due to timezone differences
--
-- 2. Security
--   - Maintain existing behavior for data validation
--   - Ensure proper error messages for invalid dates

-- Drop the existing trigger first
DROP TRIGGER IF EXISTS validate_invitation_dates_trigger ON invitations;

-- Create an improved version of the function with UTC date comparison
CREATE OR REPLACE FUNCTION validate_invitation_dates()
RETURNS TRIGGER AS $$
DECLARE
  current_date_time timestamptz := NOW();
  scheduled_date_time timestamptz;
  current_date_only date := (NOW() AT TIME ZONE 'UTC')::date;
  scheduled_date_only date := NEW.scheduled_date;
BEGIN
  -- Log the validation attempt for debugging
  RAISE NOTICE 'Validating invitation dates: scheduled_date=%, scheduled_start_time=%, current_date=%', 
    NEW.scheduled_date, NEW.scheduled_start_time, current_date_only;
  
  -- For inserts, validate that the scheduled date is not in the past
  IF TG_OP = 'INSERT' THEN
    -- Check if scheduled date is in the past using UTC date comparison
    IF scheduled_date_only < current_date_only THEN
      RAISE EXCEPTION 'Cannot create an invitation for a past date (scheduled: %, current UTC: %)', 
        scheduled_date_only, current_date_only;
    END IF;
    
    -- If scheduled time is provided, check if the combined date and time is in the past
    IF NEW.scheduled_start_time IS NOT NULL THEN
      -- Create a timestamp from the date and time
      scheduled_date_time := (NEW.scheduled_date || ' ' || NEW.scheduled_start_time)::timestamptz;
      
      -- Compare the full timestamp
      IF scheduled_date_time < current_date_time THEN
        RAISE EXCEPTION 'Cannot create an invitation for a past date or time (scheduled: %, current: %)', 
          scheduled_date_time, current_date_time;
      END IF;
    END IF;
  END IF;
  
  -- Validate recurrence end date if provided
  IF NEW.recurrence_type <> 'none' AND NEW.recurrence_type IS NOT NULL AND NEW.recurrence_end_date IS NOT NULL THEN
    -- Check if recurrence end date is before scheduled date
    IF NEW.recurrence_end_date < NEW.scheduled_date THEN
      RAISE EXCEPTION 'Recurrence end date must be after the scheduled date';
    END IF;
  END IF;
  
  -- For weekly recurrence, ensure at least one day of the week is selected
  IF NEW.recurrence_type = 'weekly' AND 
     (NEW.recurrence_days_of_week IS NULL OR array_length(NEW.recurrence_days_of_week, 1) IS NULL OR array_length(NEW.recurrence_days_of_week, 1) = 0) THEN
    RAISE EXCEPTION 'Weekly recurrence requires at least one day of the week to be selected';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger on the invitations table
CREATE TRIGGER validate_invitation_dates_trigger
BEFORE INSERT OR UPDATE ON invitations
FOR EACH ROW
EXECUTE FUNCTION validate_invitation_dates();

-- Add comment to document the function
COMMENT ON FUNCTION validate_invitation_dates IS 'Validates that invitation dates and times are not in the past using UTC date comparison to avoid timezone issues';