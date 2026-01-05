import { createRoute } from '@hono/zod-openapi'
import { z } from '@hono/zod-openapi'
import type { OpenAPIHono } from '@hono/zod-openapi'
import type { Env } from '../../types/env'
import { getRegions, filterRegions } from '../../utils/data'
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

    // Validate tier/edition parameters
    if ((tier || edition) && service !== 'vdc_vault') {
      return c.json({
        error: 'Invalid parameter combination',
        code: 'INVALID_PARAMETER',
        message: 'tier and edition parameters are only valid with service=vdc_vault',
        parameter: tier ? 'tier' : 'edition',
        value: tier || edition,
      }, 400) as any
    }

    // Get all regions
    const allRegions: Region[] = getRegions()

    // Apply filters using common utility
    const regions = filterRegions(allRegions, {
      provider,
      service,
      tier,
      edition,
      country
    })

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
