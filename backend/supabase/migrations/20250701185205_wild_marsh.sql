/*
  # Add MFA Secret Column to Profiles Table

  1. Changes
    - Add `mfa_secret` column to profiles table to store MFA secrets
    - This column will be used to store the secret key for TOTP-based MFA

  2. Security
    - The column is nullable since MFA is optional
    - When MFA is disabled, the secret will be set to NULL
*/

-- Add mfa_secret column to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS mfa_secret text;

-- Comment on the column to document its purpose
COMMENT ON COLUMN profiles.mfa_secret IS 'Secret key for TOTP-based multi-factor authentication';