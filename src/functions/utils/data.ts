import type { Region, Service } from '../types/data'
// @ts-ignore - JSON import
import regionsData from '../../../functions/regions.json'

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

/**
 * Get service by ID
 */
export function getServiceById(serviceId: string): Service | undefined {
  const services = getServices()
  return services.find(s => s.id === serviceId)
}

/**
 * Check if a region has a specific service
 */
function hasService(region: Region, serviceId: string): boolean {
  const services = region.services as any
  const service = services[serviceId]
  if (!service) return false

  // For boolean services, check if true
  if (typeof service === 'boolean') {
    return service === true
  }

  // For tiered services (vdc_vault), check if array has entries
  return Array.isArray(service) && service.length > 0
}

/**
 * Get all regions that support a specific service
 */
export function getServiceRegions(serviceId: string): Region[] {
  const regions = getRegions()
  return regions.filter(r => hasService(r, serviceId))
}

/**
 * Get provider breakdown for a service
 */
export function getServiceProviderBreakdown(serviceId: string): {
  AWS: { count: number; regions: string[] }
  Azure: { count: number; regions: string[] }
} {
  const regions = getServiceRegions(serviceId)

  const breakdown = {
    AWS: { count: 0, regions: [] as string[] },
    Azure: { count: 0, regions: [] as string[] },
  }

  regions.forEach(region => {
    breakdown[region.provider].count++
    breakdown[region.provider].regions.push(region.id)
  })

  return breakdown
}

/**
 * Get configuration breakdown for tiered services (vdc_vault)
 */
export function getServiceConfigurationBreakdown(serviceId: string): Record<string, { count: number; regions: string[] }> | null {
  // Only applicable for vdc_vault
  if (serviceId !== 'vdc_vault') return null

  const regions = getRegions()
  const breakdown: Record<string, { count: number; regions: string[] }> = {}

  regions.forEach(region => {
    const vaultConfigs = region.services.vdc_vault
    if (!vaultConfigs || !Array.isArray(vaultConfigs)) return

    vaultConfigs.forEach(config => {
      const key = `${config.edition}-${config.tier}`
      if (!breakdown[key]) {
        breakdown[key] = { count: 0, regions: [] }
      }
      breakdown[key].count++
      breakdown[key].regions.push(region.id)
    })
  })

  return breakdown
}

/**
 * Get services with statistics
 */
export function getServicesWithStats(): Array<Service & {
  regionCount: number
  providerBreakdown: { AWS: number; Azure: number }
  configurationBreakdown?: Record<string, number>
}> {
  const services = getServices()

  return services.map(service => {
    const regions = getServiceRegions(service.id)
    const providerBreakdown = getServiceProviderBreakdown(service.id)

    const result: any = {
      ...service,
      regionCount: regions.length,
      providerBreakdown: {
        AWS: providerBreakdown.AWS.count,
        Azure: providerBreakdown.Azure.count,
      },
    }

    // Add configuration breakdown for tiered services
    if (service.type === 'tiered') {
      const configBreakdown = getServiceConfigurationBreakdown(service.id)
      if (configBreakdown) {
        result.configurationBreakdown = Object.entries(configBreakdown).reduce((acc, [key, value]) => {
          acc[key] = value.count
          return acc
        }, {} as Record<string, number>)
      }
    }

    return result
  })
}
