import { createRoute } from '@hono/zod-openapi'
import { z } from '@hono/zod-openapi'
import type { OpenAPIHono } from '@hono/zod-openapi'
import type { Env } from '../../types/env'
import { getServices } from '../../utils/data'

// Service schema with detailed descriptions
const ServiceSchema = z.object({
  id: z.string().openapi({
    description: `Unique identifier for this VDC service. Use this ID when filtering regions by service via the service parameter in /api/v1/regions. Common IDs include vdc_vault, vdc_m365, vdc_entra_id, vdc_salesforce, and vdc_azure_backup.`,
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
  summary: 'List all available VDC services with metadata',
  description: 'Retrieves a complete catalog of all Veeam Data Cloud services tracked by this API.',
  tags: ['Services'],
  responses: {
    200: {
      description: 'List of available VDC services',
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
    const services = getServices()
    return c.json({
      services,
      count: services.length,
    })
  })
}
