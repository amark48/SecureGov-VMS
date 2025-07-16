
-- Migration: 20250711162447_refactor_auth_settings.sql
-- Description: Refactor authentication settings to use a dedicated identity_providers table

-- Part 1: Schema Changes

-- Create the identity_providers table
CREATE TABLE IF NOT EXISTS identity_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  provider_type VARCHAR(50) NOT NULL CHECK (provider_type IN ('azure_ad', 'aws_federation', 'okta', 'auth0', 'traditional')),
  config JSONB NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, provider_type)
);

-- Add auth_strategy column to tenants table
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenants' AND column_name = 'auth_strategy') THEN
    ALTER TABLE tenants ADD COLUMN auth_strategy VARCHAR(20) DEFAULT 'traditional';
  END IF;
END $$;

-- Add check constraint for auth_strategy if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tenants_auth_strategy_check' AND conrelid = 'tenants'::regclass) THEN
    ALTER TABLE tenants ADD CONSTRAINT tenants_auth_strategy_check CHECK (auth_strategy IN ('traditional', 'hybrid', 'external_only'));
  END IF;
END $$;

-- Create indexes for the new table
CREATE INDEX IF NOT EXISTS idx_identity_providers_tenant_id ON identity_providers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_identity_providers_provider_type ON identity_providers(provider_type);

-- Part 2: Data Migration

-- Migrate existing Azure AD settings to identity_providers table
INSERT INTO identity_providers (tenant_id, provider_type, config, is_active)
SELECT
  id,
  'azure_ad',
  jsonb_build_object(
    'tenant_id', azure_ad_tenant_id,
    'client_id', azure_ad_client_id,
    'jwks_uri', azure_ad_jwks_uri,
    'issuer', azure_ad_issuer,
    'audience', azure_ad_audience
  ),
  azure_ad_enabled
FROM tenants
WHERE azure_ad_enabled IS TRUE;

-- Migrate existing AWS Federation settings to identity_providers table
INSERT INTO identity_providers (tenant_id, provider_type, config, is_active)
SELECT
  id,
  'aws_federation',
  jsonb_build_object(
    'region', aws_region,
    'federated_role_arn_prefix', aws_federated_role_arn_prefix
  ),
  aws_federation_enabled
FROM tenants
WHERE aws_federation_enabled IS TRUE;

-- Update auth_strategy in tenants table based on migrated data
UPDATE tenants t
SET auth_strategy = CASE
  WHEN EXISTS (SELECT 1 FROM identity_providers ip WHERE ip.tenant_id = t.id AND ip.is_active = TRUE AND ip.provider_type IN ('azure_ad', 'aws_federation')) THEN 'hybrid'
  ELSE 'traditional'
END;

-- Part 3: Cleanup (Optional - uncomment and run after successful migration verification)
-- These ALTER TABLE statements should be run only after you have confirmed
-- that the data migration was successful and your application is working
-- correctly with the new schema.


ALTER TABLE tenants DROP COLUMN IF EXISTS azure_ad_enabled;
ALTER TABLE tenants DROP COLUMN IF EXISTS azure_ad_tenant_id;
ALTER TABLE tenants DROP COLUMN IF EXISTS azure_ad_client_id;
ALTER TABLE tenants DROP COLUMN IF EXISTS azure_ad_jwks_uri;
ALTER TABLE tenants DROP COLUMN IF EXISTS azure_ad_issuer;
ALTER TABLE tenants DROP COLUMN IF EXISTS azure_ad_audience;
ALTER TABLE tenants DROP COLUMN IF EXISTS aws_federation_enabled;
ALTER TABLE tenants DROP COLUMN IF EXISTS aws_region;
ALTER TABLE tenants DROP COLUMN IF EXISTS aws_federated_role_arn_prefix;
