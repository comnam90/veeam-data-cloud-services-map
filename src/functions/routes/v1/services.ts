import { createRoute } from '@hono/zod-openapi'
import { z } from '@hono/zod-openapi'
import type { OpenAPIHono } from '@hono/zod-openapi'
import type { Env } from '../../types/env'
import { getServicesWithStats } from '../../utils/data'

// Service schema with detailed descriptions and statistics
const ServiceSchema = z.object({
  id: z.string().openapi({
    description: `Unique identifier for this VDC service. Use this ID when filtering regions by service via the service parameter in /api/v1/regions, or to get detailed service information from /api/v1/services/{serviceId}. Common IDs include vdc_vault, vdc_m365, vdc_entra_id, vdc_salesforce, and vdc_azure_backup.`,
    example: 'vdc_vault'
  }),
  name: z.string().openapi({
    description: 'Human-readable display name for the service, suitable for showing in user interfaces',
    example: 'Veeam Data Cloud Vault'
  }),
  type: z.enum(['tiered', 'boolean']).openapi({
    description: `Service pricing/availability model. "tiered" services like VDC Vault have multiple edition and tier combinations. "boolean" services are either available or not, with no configuration options.`,
    example: 'tiered'
  }),
  description: z.string().openapi({
    description: 'Brief description of what this service does and its main capabilities',
    example: 'Immutable backup storage with configurable pricing tiers',
  }),
  editions: z.array(z.string()).optional().openapi({
    description: `Available service editions (only for tiered services). Foundation is entry-level, Advanced includes full feature set. Use these values when filtering regions by edition.`,
    example: ['Foundation', 'Advanced'],
  }),
  tiers: z.array(z.string()).optional().openapi({
    description: `Available pricing tiers (only for tiered services). Core offers premium performance at higher cost, Non-Core is optimized for cost-effective long-term retention. Use these values when filtering regions by tier.`,
    example: ['Core', 'Non-Core'],
  }),
  regionCount: z.number().openapi({
    description: 'Total number of regions where this service is available. Use this to compare service coverage (e.g., vdc_m365 available in 23 regions vs vdc_salesforce in 12 regions).',
    example: 80,
  }),
  providerBreakdown: z.object({
    AWS: z.number().openapi({
      description: 'Number of AWS regions where this service is available',
      example: 29,
    }),
    Azure: z.number().openapi({
      description: 'Number of Azure regions where this service is available',
      example: 51,
    }),
  }).openapi({
    description: 'Breakdown of region availability by cloud provider. Useful for understanding service distribution across AWS and Azure.',
  }),
  configurationBreakdown: z.record(z.string(), z.number()).optional().openapi({
    description: `Breakdown of region availability by edition-tier combination (only for tiered services). Keys are in format "Edition-Tier" (e.g., "Foundation-Core", "Advanced-Non-Core"). Values are the count of regions supporting that configuration. Use this to understand which service configurations are most widely available.`,
    example: {
      'Foundation-Core': 12,
      'Foundation-Non-Core': 18,
      'Advanced-Core': 45,
      'Advanced-Non-Core': 8,
    },
  }),
}).openapi('Service')

// Response schema
const ServicesResponseSchema = z.object({
  services: z.array(ServiceSchema),
  count: z.number().openapi({ example: 5 }),
})

// Route definition
const servicesRoute = createRoute({
  method: 'get',
  path: '/api/v1/services',
  summary: 'List all available VDC services with regional availability statistics',
  description: 'Retrieves a complete catalog of all Veeam Data Cloud services tracked by this API, including how many regions support each service and the breakdown by cloud provider. Use this endpoint to compare service coverage across different VDC offerings.',
  tags: ['Services'],
  responses: {
    200: {
      description: 'List of available VDC services with regional statistics',
      content: {
        'application/json': {
          schema: ServicesResponseSchema,
        },
      },
    },
  },
})

export function registerServicesRoute(app: OpenAPIHono<{ Bindings: Env }>) {
  app.openapi(servicesRoute, (c) => {
    const services = getServicesWithStats()
    return c.json({
      services,
      count: services.length,
    })
  })
}
