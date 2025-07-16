export interface IdentityProvider {
  id: string;
  tenant_id: string;
  provider_type: 'azure_ad' | 'aws_federation' | 'okta' | 'auth0' | 'traditional';
  config: Record<string, any>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AzureAdProviderConfig {
  tenant_id: string;
  client_id: string;
  jwks_uri: string;
  issuer: string;
  audience: string;
}

export interface AwsFederationProviderConfig {
  region: string;
  federated_role_arn_prefix: string;
}

export interface OktaProviderConfig {
  domain: string;
  client_id: string;
  client_secret?: string;
  issuer: string;
  jwks_uri?: string;
}

export interface Auth0ProviderConfig {
  domain: string;
  client_id: string;
  client_secret?: string;
  audience?: string;
  jwks_uri?: string;
  issuer?: string;
}

export type ProviderConfig = 
  | AzureAdProviderConfig 
  | AwsFederationProviderConfig 
  | OktaProviderConfig 
  | Auth0ProviderConfig 
  | Record<string, any>;

export interface CreateIdentityProviderRequest {
  provider_type: IdentityProvider['provider_type'];
  config: ProviderConfig;
  is_active?: boolean;
}

export interface UpdateIdentityProviderRequest {
  id: string;
  provider_type?: IdentityProvider['provider_type'];
  config?: ProviderConfig;
  is_active?: boolean;
}