/**
 * VDC Vault service tier and edition
 */
export interface VdcVaultConfig {
  edition: 'Foundation' | 'Advanced'
  tier: 'Core' | 'Non-Core'
}

/**
 * Services available in a region
 */
export interface RegionServices {
  vdc_vault?: VdcVaultConfig[]
  vdc_m365?: boolean
  vdc_entra_id?: boolean
  vdc_salesforce?: boolean
  vdc_azure_backup?: boolean
}

/**
 * Cloud region with VDC service availability
 */
export interface Region {
  id: string
  name: string
  provider: 'AWS' | 'Azure'
  coords: [number, number]
  aliases?: string[]
  services: RegionServices
}

/**
 * Service metadata
 */
export interface Service {
  id: string
  name: string
  type: 'tiered' | 'boolean'
  description: string
  editions?: string[]
  tiers?: string[]
}
