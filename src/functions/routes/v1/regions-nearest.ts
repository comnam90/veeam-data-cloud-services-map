import { createRoute, z } from '@hono/zod-openapi'
import type { OpenAPIHono } from '@hono/zod-openapi'
import type { Env } from '../../types/env'
import type { Region } from '../../types/data'
import { RegionSchema, ErrorResponseSchema } from '../../schemas/common'
import { getRegions } from '../../utils/data'
import { calculateDistance } from '../../utils/geo'

const NearestRegionsQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90).openapi({
    param: { name: 'lat', in: 'query', required: true },
    description: 'Latitude of the source location in decimal degrees. Must be between -90 and 90.',
    example: 35.6762,
  }),
  lng: z.coerce.number().min(-180).max(180).openapi({
    param: { name: 'lng', in: 'query', required: true },
    description: 'Longitude of the source location in decimal degrees. Must be between -180 and 180.',
    example: 139.6503,
  }),
  limit: z.coerce.number().int().min(0).max(20).default(5).openapi({
    param: { name: 'limit', in: 'query' },
    description: 'Maximum number of regions to return. Default: 5. Max: 20. Use 0 for unlimited.',
    example: 5,
  }),
  provider: z.enum(['AWS', 'Azure']).optional().openapi({
    param: { name: 'provider', in: 'query' },
    description: 'Filter results by cloud provider',
    example: 'AWS',
  }),
  service: z.enum([
    'vdc_vault',
    'vdc_m365',
    'vdc_entra_id',
    'vdc_salesforce',
    'vdc_azure_backup',
  ]).optional().openapi({
    param: { name: 'service', in: 'query' },
    description: 'Filter results to regions offering the specified service',
    example: 'vdc_vault',
  }),
  tier: z.enum(['Core', 'Non-Core']).optional().openapi({
    param: { name: 'tier', in: 'query' },
    description: 'Filter vdc_vault regions by pricing tier. Only valid with service=vdc_vault.',
    example: 'Core',
  }),
  edition: z.enum(['Foundation', 'Advanced']).optional().openapi({
    param: { name: 'edition', in: 'query' },
    description: 'Filter vdc_vault regions by edition level. Only valid with service=vdc_vault.',
    example: 'Advanced',
  }),
})

const NearestRegionResultSchema = z.object({
  region: RegionSchema,
  distance: z.object({
    km: z.number().openapi({
      description: 'Distance in kilometers',
      example: 42.15,
    }),
    miles: z.number().openapi({
      description: 'Distance in miles',
      example: 26.19,
    }),
  }),
})

const NearestRegionsResponseSchema = z.object({
  query: z.object({
    lat: z.number(),
    lng: z.number(),
    limit: z.number(),
    service: z.string().nullable(),
    provider: z.string().nullable(),
    tier: z.string().nullable(),
    edition: z.string().nullable(),
  }).openapi({
    description: 'Echo of the query parameters used for this request',
  }),
  results: z.array(NearestRegionResultSchema).openapi({
    description: 'Array of regions with distances, sorted by proximity',
  }),
  count: z.number().openapi({
    description: 'Number of regions returned',
    example: 5,
  }),
}).openapi('NearestRegionsResponse')

const nearestRegionsRoute = createRoute({
  method: 'get',
  path: '/api/v1/regions/nearest',
  summary: 'Find nearest regions to coordinates',
  description: `Returns the N closest Veeam Data Cloud regions to a given geographic location.
  
Results can be filtered by provider, service availability, and for vdc_vault, by tier and edition.
Distances are calculated using the Haversine formula for great-circle distance.

**Important:** tier and edition filters only work with service=vdc_vault. Passing tier or edition without service=vdc_vault will return a 400 error.`,
  tags: ['Regions'],
  request: {
    query: NearestRegionsQuerySchema,
  },
  responses: {
    200: {
      description: 'Successfully found nearest regions',
      content: {
        'application/json': {
          schema: NearestRegionsResponseSchema,
        },
      },
    },
    400: {
      description: 'Invalid parameters or parameter combination',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
})

export function registerNearestRegionsRoute(app: OpenAPIHono<{ Bindings: Env }>) {
  app.openapi(nearestRegionsRoute, (c) => {
    const query = c.req.valid('query')
    const { lat, lng, limit, provider, service, tier, edition } = query

    if ((tier || edition) && service !== 'vdc_vault') {
      return c.json({
        error: 'Invalid parameter combination',
        code: 'INVALID_PARAMETER',
        message: 'tier and edition parameters are only valid with service=vdc_vault',
        parameter: tier ? 'tier' : 'edition',
        value: tier || edition,
      }, 400) as any
    }

    let filteredRegions = getRegions()

    if (provider) {
      filteredRegions = filteredRegions.filter(r => r.provider === provider)
    }

    if (service) {
      filteredRegions = filteredRegions.filter(r => {
        const serviceData = r.services[service]
        if (serviceData === undefined) return false
        if (typeof serviceData === 'boolean') {
          // If strict filtering is active, boolean "true" (unknown configuration) is insufficient
          if (service === 'vdc_vault' && (tier || edition)) return false
          return serviceData
        }

        if (service === 'vdc_vault' && Array.isArray(serviceData)) {
          if (!tier && !edition) return true

          return serviceData.some(config => {
            const tierMatch = !tier || config.tier === tier
            const editionMatch = !edition || config.edition === edition
            return tierMatch && editionMatch
          })
        }

        return false
      })
    }

    const regionsWithDistance = filteredRegions.map(region => {
      const [regionLat, regionLng] = region.coords
      const distance = calculateDistance(lat, lng, regionLat, regionLng)
      return { region, distance }
    })

    regionsWithDistance.sort((a, b) => {
      if (a.distance.km !== b.distance.km) {
        return a.distance.km - b.distance.km
      }
      return a.region.id.localeCompare(b.region.id)
    })

    const results = limit === 0 
      ? regionsWithDistance 
      : regionsWithDistance.slice(0, limit)

    return c.json({
      query: {
        lat,
        lng,
        limit,
        service: service || null,
        provider: provider || null,
        tier: tier || null,
        edition: edition || null,
      },
      results,
      count: results.length,
    }, 200) as any
  })
}
