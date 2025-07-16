/*
  # Fix Password Column Issue in Profiles Table

  1. Changes
    - Rename `password_hash` column to `password_hash` if it exists
    - Add `password_hash` column if it doesn't exist
    - Update any references to `password` column to use `password_hash` instead

  2. Security
    - Maintain existing RLS policies
*/

-- Check if password column exists and rename it to password_hash
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'password'
  ) THEN
    ALTER TABLE profiles RENAME COLUMN password TO password_hash;
  END IF;
END $$;

-- Add password_hash column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'password_hash'
  ) THEN
    ALTER TABLE profiles ADD COLUMN password_hash TEXT;
  END IF;
END $$;

-- Add comment to document the purpose of this field
COMMENT ON COLUMN profiles.password_hash IS 'Hashed password for user authentication';