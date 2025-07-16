// src/types/acs.ts

export interface AcsConfig {
  // Generic config fields, specific fields will be 'any' for now
  [key: string]: any;
}

export interface AcsProvider {
  id: string;
  tenant_id: string;
  name: string;
  provider_type: 'lenel' | 's2security' | 'ccure9000' | 'custom';
  config: AcsConfig;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}