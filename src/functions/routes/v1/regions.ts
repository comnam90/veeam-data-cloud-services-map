import { createRoute } from '@hono/zod-openapi'
import { z } from '@hono/zod-openapi'
import type { OpenAPIHono } from '@hono/zod-openapi'
import type { Env } from '../../types/env'
import { getRegions } from '../../utils/data'
import type { Region } from '../../types/data'
import { RegionSchema, VdcVaultConfigSchema, RegionServicesSchema, ErrorResponseSchema } from '../../schemas/common'

// Response schema
const RegionsResponseSchema = z.object({
  data: z.array(RegionSchema),
  count: z.number().openapi({
    description: 'Total number of regions returned after applying filters',
    example: 25
  }),
  filters: z.object({
    provider: z.string().nullable().openapi({
      description: 'Applied cloud provider filter (AWS, Azure, or null if not filtered)',
      example: 'AWS'
    }),
    service: z.string().nullable().openapi({
      description: 'Applied service filter (vdc_vault, vdc_m365, etc., or null)',
      example: null
    }),
    tier: z.string().nullable().openapi({
      description: 'Applied pricing tier filter for VDC Vault (Core, Non-Core, or null)',
      example: null
    }),
    edition: z.string().nullable().openapi({
      description: 'Applied edition filter for VDC Vault (Foundation, Advanced, or null)',
      example: null
    }),
    country: z.string().nullable().openapi({
      description: 'Applied country name filter (searches region name and aliases)',
      example: null
    }),
  }),
}).openapi({
  description: 'Response containing filtered list of cloud regions with their VDC service availability'
})

// Route definition
const regionsRoute = createRoute({
  method: 'get',
  path: '/api/v1/regions',
  summary: 'List all cloud regions with VDC service availability',
  description: 'Retrieves a comprehensive list of all AWS and Azure regions where Veeam Data Cloud services are available.',
  tags: ['Regions'],
  request: {
    query: z.object({
      provider: z.enum(['AWS', 'Azure']).optional().openapi({
        param: {
          name: 'provider',
          in: 'query',
        },
        example: 'AWS',
      }),
      country: z.string().optional().openapi({
        param: {
          name: 'country',
          in: 'query',
        },
        example: 'Japan',
      }),
      service: z
        .enum(['vdc_vault', 'vdc_m365', 'vdc_entra_id', 'vdc_salesforce', 'vdc_azure_backup'])
        .optional()
        .openapi({
          param: {
            name: 'service',
            in: 'query',
          },
          example: 'vdc_vault',
        }),
      tier: z.enum(['Core', 'Non-Core']).optional().openapi({
        param: {
          name: 'tier',
          in: 'query',
        },
        example: 'Core',
      }),
      edition: z.enum(['Foundation', 'Advanced']).optional().openapi({
        param: {
          name: 'edition',
          in: 'query',
        },
        example: 'Advanced',
      }),
    }),
  },
  responses: {
    200: {
      description: 'List of regions matching the filter criteria',
      content: {
        'application/json': {
          schema: RegionsResponseSchema,
        },
      },
    },
    400: {
      description: 'Invalid query parameter',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
})

export function registerRegionsRoute(app: OpenAPIHono<{ Bindings: Env }>) {
  app.openapi(regionsRoute, (c) => {
    // Get validated query parameters from Hono's validator
    const query = c.req.valid('query')
    const provider = query.provider
    const service = query.service
    const tier = query.tier
    const edition = query.edition
    const country = query.country

    // Get all regions
    let regions: Region[] = getRegions()

    // Apply filters
    if (provider) {
      regions = regions.filter(r => r.provider === provider)
    }

    if (country) {
      const countryLower = country.toLowerCase()
      regions = regions.filter(r => {
        if (r.name.toLowerCase().includes(countryLower)) return true
        if (r.aliases && Array.isArray(r.aliases)) {
          return r.aliases.some(alias => alias.toLowerCase().includes(countryLower))
        }
        return false
      })
    }

    if (service) {
      regions = regions.filter(r => {
        const hasService = r.services && r.services[service]
        if (!hasService) return false

        // For boolean services, just check existence
        if (typeof r.services[service] === 'boolean') {
          return r.services[service]
        }

        // For tiered services (vdc_vault), check array
        return Array.isArray(r.services[service]) && r.services[service].length > 0
      })
    }

    // Filter by tier (only applicable to vdc_vault)
    if (tier && service === 'vdc_vault') {
      regions = regions.filter(r => {
        return r.services.vdc_vault?.some(v => v.tier === tier)
      })
    }

    // Filter by edition (only applicable to vdc_vault)
    if (edition && service === 'vdc_vault') {
      regions = regions.filter(r => {
        return r.services.vdc_vault?.some(v => v.edition === edition)
      })
    }

    // Return filtered results
    return c.json({
      data: regions,
      count: regions.length,
      filters: {
        provider: provider || null,
        service: service || null,
        tier: tier || null,
        edition: edition || null,
        country: country || null,
      },
    }) as any
  })
}
