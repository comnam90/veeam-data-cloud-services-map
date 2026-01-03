import type { Region, Service } from '../types/data'
// @ts-ignore - JSON import
import regionsData from '../regions.json'

/**
 * Get all regions with type safety
 */
export function getRegions(): Region[] {
  return regionsData as Region[]
}

/**
 * Get region by ID
 */
export function getRegionById(id: string): Region | undefined {
  const regions = getRegions()
  return regions.find(r => r.id === id)
}

/**
 * Get region statistics
 */
export function getRegionStats() {
  const regions = getRegions()
  const awsRegions = regions.filter(r => r.provider === 'AWS')
  const azureRegions = regions.filter(r => r.provider === 'Azure')

  return {
    totalRegions: regions.length,
    awsRegions: awsRegions.length,
    azureRegions: azureRegions.length,
  }
}

/**
 * Get all available services metadata
 */
export function getServices(): Service[] {
  return [
    {
      id: 'vdc_vault',
      name: 'Veeam Data Cloud Vault',
      type: 'tiered',
      description: 'Immutable backup storage with configurable pricing tiers',
      editions: ['Foundation', 'Advanced'],
      tiers: ['Core', 'Non-Core'],
    },
    {
      id: 'vdc_m365',
      name: 'VDC for Microsoft 365',
      type: 'boolean',
      description: 'Backup and recovery for Microsoft 365 data',
    },
    {
      id: 'vdc_entra_id',
      name: 'VDC for Entra ID',
      type: 'boolean',
      description: 'Backup and recovery for Microsoft Entra ID (Azure AD)',
    },
    {
      id: 'vdc_salesforce',
      name: 'VDC for Salesforce',
      type: 'boolean',
      description: 'Backup and recovery for Salesforce data',
    },
    {
      id: 'vdc_azure_backup',
      name: 'VDC for Azure',
      type: 'boolean',
      description: 'Native Azure backup capabilities',
    },
  ]
}
