import { createRoute } from '@hono/zod-openapi'
import { z } from '@hono/zod-openapi'
import type { OpenAPIHono } from '@hono/zod-openapi'
import type { Env } from '../../types/env'
import type { Region, RegionServices, VdcVaultConfig } from '../../types/data'
import { getRegionById, getServices } from '../../utils/data'
import { 
  RegionsComparisonResponseSchema, 
  ErrorResponseSchema 
} from '../../schemas/common'

// Query schema for the comparison endpoint
const CompareQuerySchema = z.object({
  ids: z.string().openapi({
    description: 'Comma-separated list of region IDs to compare (2-5 regions)',
    example: 'aws-us-east-1,azure-us-east,aws-eu-west-2',
    param: {
      name: 'ids',
      in: 'query',
      required: true,
    },
  }),
})

// Route definition
const compareRoute = createRoute({
  method: 'get',
  path: '/api/v1/regions/compare',
  summary: 'Compare service availability across multiple regions',
  description: 'Returns a detailed comparison of which VDC services are available in each of the specified regions, highlighting commonalities and differences. This endpoint helps users make informed decisions when planning multi-region or hybrid cloud deployments.',
  tags: ['Regions'],
  request: {
    query: CompareQuerySchema,
  },
  responses: {
    200: {
      description: 'Successful comparison of regions',
      content: {
        'application/json': {
          schema: RegionsComparisonResponseSchema,
        },
      },
    },
    400: {
      description: 'Invalid request (e.g., less than 2 regions, more than 5, or duplicate IDs)',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    404: {
      description: 'One or more region IDs not found',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
})

/**
 * Helper function to check if a service is available in a region
 */
function hasService(services: RegionServices, serviceId: string): boolean {
  const service = (services as any)[serviceId]
  if (!service) return false
  
  if (typeof service === 'boolean') {
    return service === true
  }
  
  return Array.isArray(service) && service.length > 0
}

/**
 * Helper function to get service value for comparison details
 */
function getServiceValue(services: RegionServices, serviceId: string): boolean | VdcVaultConfig[] | undefined {
  const service = (services as any)[serviceId]
  if (!service) return undefined
  
  if (typeof service === 'boolean') {
    return service
  }
  
  if (Array.isArray(service) && service.length > 0) {
    return service
  }
  
  return undefined
}

export function registerRegionsCompareRoute(app: OpenAPIHono<{ Bindings: Env }>) {
  app.openapi(compareRoute, (c) => {
    const query = c.req.valid('query')
    const idsParam = query.ids
    
    // Parse and deduplicate region IDs
    const regionIds = [...new Set(idsParam.split(',').map(id => id.trim()).filter(id => id.length > 0))]
    
    // Validate number of regions
    if (regionIds.length < 2) {
      return c.json({
        error: 'Invalid parameter',
        code: 'INVALID_PARAMETER',
        message: 'At least 2 region IDs are required for comparison',
        parameter: 'ids',
        value: idsParam,
      }, 400) as any
    }
    
    if (regionIds.length > 5) {
      return c.json({
        error: 'Invalid parameter',
        code: 'INVALID_PARAMETER',
        message: 'Maximum 5 region IDs allowed for comparison',
        parameter: 'ids',
        value: idsParam,
      }, 400) as any
    }
    
    // Fetch all regions and validate they exist
    const regions: Region[] = []
    const notFoundIds: string[] = []
    
    for (const id of regionIds) {
      const region = getRegionById(id)
      if (!region) {
        notFoundIds.push(id)
      } else {
        regions.push(region)
      }
    }
    
    if (notFoundIds.length > 0) {
      return c.json({
        error: 'Region not found',
        code: 'REGION_NOT_FOUND',
        message: `The following region IDs were not found: ${notFoundIds.join(', ')}`,
        parameter: 'ids',
        value: idsParam,
        allowedValues: notFoundIds,
      }, 404) as any
    }
    
    // Build comparison for each service
    const allServices = getServices()
    const comparison: Record<string, any> = {}
    
    for (const service of allServices) {
      const serviceId = service.id
      const availableIn: string[] = []
      const missingFrom: string[] = []
      const details: Record<string, any> = {}
      
      for (const region of regions) {
        if (hasService(region.services, serviceId)) {
          availableIn.push(region.id)
          const value = getServiceValue(region.services, serviceId)
          if (value !== undefined) {
            details[region.id] = value
          }
        } else {
          missingFrom.push(region.id)
        }
      }
      
      comparison[serviceId] = {
        availableIn,
        missingFrom,
        isCommon: availableIn.length === regions.length,
        details,
      }
    }
    
    // Calculate summary
    const commonServices: string[] = []
    const partialServices: string[] = []
    const unavailableServices: string[] = []
    
    for (const [serviceId, data] of Object.entries(comparison)) {
      if (data.isCommon) {
        commonServices.push(serviceId)
      } else if (data.availableIn.length === 0) {
        unavailableServices.push(serviceId)
      } else {
        partialServices.push(serviceId)
      }
    }
    
    const summary = {
      totalServices: allServices.length,
      commonServices: commonServices.length,
      partialServices: partialServices.length,
      unavailableServices: unavailableServices.length,
      commonServiceIds: commonServices,
      partialServiceIds: partialServices,
      unavailableServiceIds: unavailableServices,
    }
    
    return c.json({
      regions,
      comparison,
      summary,
    }, 200) as any
  })
}
