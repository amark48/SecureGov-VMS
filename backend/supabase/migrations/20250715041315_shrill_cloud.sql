/*
  # Badge and CIV/PIV Features

  1. New Tables
    - `acs_configurations` - Stores access control system configurations
  
  2. Changes
    - Add badge_type, civ_piv_i_serial, and status to badges table
    - Add badge_issuance_options and default_badge_type to tenants table
    - Add civ_piv_card_info to visitors table
    - Add acs_provisioning_status to visits table
    - Add qr_code_token and qr_code_url to invitations table
  
  3. Security
    - Enable RLS on new tables
    - Add appropriate policies
*/

-- Add new columns to badges table
ALTER TABLE IF EXISTS badges ADD COLUMN IF NOT EXISTS badge_type VARCHAR DEFAULT 'printed';
ALTER TABLE IF EXISTS badges ADD COLUMN IF NOT EXISTS civ_piv_i_serial TEXT;
ALTER TABLE IF EXISTS badges ADD COLUMN IF NOT EXISTS status VARCHAR DEFAULT 'issued';
ALTER TABLE IF EXISTS badges ADD COLUMN IF NOT EXISTS returned_at TIMESTAMPTZ;
ALTER TABLE IF EXISTS badges ADD COLUMN IF NOT EXISTS reported_lost_at TIMESTAMPTZ;

-- Add badge configuration to tenants table
ALTER TABLE IF EXISTS tenants ADD COLUMN IF NOT EXISTS badge_issuance_options JSONB DEFAULT '["printed"]'::jsonb;
ALTER TABLE IF EXISTS tenants ADD COLUMN IF NOT EXISTS default_badge_type VARCHAR DEFAULT 'printed';
ALTER TABLE IF EXISTS tenants ADD COLUMN IF NOT EXISTS civ_piv_i_issuance_enabled BOOLEAN DEFAULT false;

-- Add CIV/PIV card info to visitors table
ALTER TABLE IF EXISTS visitors ADD COLUMN IF NOT EXISTS civ_piv_card_info JSONB;

-- Add ACS provisioning status to visits table
ALTER TABLE IF EXISTS visits ADD COLUMN IF NOT EXISTS acs_provisioning_status VARCHAR DEFAULT 'not_required';

-- Add QR code fields to invitations table
ALTER TABLE IF EXISTS invitations ADD COLUMN IF NOT EXISTS qr_code_token UUID;
ALTER TABLE IF EXISTS invitations ADD COLUMN IF NOT EXISTS qr_code_url TEXT;

-- Create ACS configurations table
CREATE TABLE IF NOT EXISTS acs_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR NOT NULL,
  acs_type VARCHAR NOT NULL,
  api_endpoint TEXT,
  credentials JSONB,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE acs_configurations ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for acs_configurations
CREATE POLICY "Tenants can view their own ACS configurations"
  ON acs_configurations
  FOR SELECT
  USING (tenant_id = auth.jwt() ->> 'tenant_id');

CREATE POLICY "Admins can insert ACS configurations"
  ON acs_configurations
  FOR INSERT
  WITH CHECK (
    tenant_id = auth.jwt() ->> 'tenant_id' AND
    auth.jwt() ->> 'role' IN ('admin', 'super_admin')
  );

CREATE POLICY "Admins can update their own ACS configurations"
  ON acs_configurations
  FOR UPDATE
  USING (
    tenant_id = auth.jwt() ->> 'tenant_id' AND
    auth.jwt() ->> 'role' IN ('admin', 'super_admin')
  );

CREATE POLICY "Admins can delete their own ACS configurations"
  ON acs_configurations
  FOR DELETE
  USING (
    tenant_id = auth.jwt() ->> 'tenant_id' AND
    auth.jwt() ->> 'role' IN ('admin', 'super_admin')
  );

-- Create updated_at trigger for acs_configurations
CREATE OR REPLACE FUNCTION update_acs_configurations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_acs_configurations_updated_at
BEFORE UPDATE ON acs_configurations
FOR EACH ROW
EXECUTE FUNCTION update_acs_configurations_updated_at();