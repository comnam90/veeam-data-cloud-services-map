import { createRoute } from '@hono/zod-openapi'
import { z } from '@hono/zod-openapi'
import type { OpenAPIHono } from '@hono/zod-openapi'
import type { Env } from '../../types/env'
import {
  getServiceById,
  getServiceRegions,
  getServiceProviderBreakdown,
  getServiceConfigurationBreakdown,
} from '../../utils/data'
import { ErrorResponseSchema } from '../../schemas/common'

// Path parameter schema
const ServiceIdParamSchema = z.object({
  serviceId: z.enum(['vdc_vault', 'vdc_m365', 'vdc_entra_id', 'vdc_salesforce', 'vdc_azure_backup']).openapi({
    param: {
      name: 'serviceId',
      in: 'path',
    },
    description: 'Unique identifier for the VDC service',
    example: 'vdc_m365',
  }),
})

// Provider breakdown detail schema
const ProviderBreakdownDetailSchema = z.object({
  count: z.number().openapi({
    description: 'Number of regions from this provider that support the service',
    example: 23,
  }),
  regions: z.array(z.string()).openapi({
    description: 'List of region IDs from this provider that support the service',
    example: ['azure-au-east', 'azure-brazil-south', 'azure-canada-central'],
  }),
})

// Configuration breakdown detail schema
const ConfigurationBreakdownDetailSchema = z.object({
  count: z.number().openapi({
    description: 'Number of regions that support this edition-tier combination',
    example: 12,
  }),
  regions: z.array(z.string()).openapi({
    description: 'List of region IDs that support this edition-tier combination',
    example: ['aws-eu-north-1', 'aws-eu-south-2', 'aws-us-east-1'],
  }),
})

// Base service info schema
const ServiceInfoSchema = z.object({
  id: z.string().openapi({
    description: 'Unique identifier for this VDC service',
    example: 'vdc_m365',
  }),
  name: z.string().openapi({
    description: 'Human-readable display name for the service',
    example: 'VDC for Microsoft 365',
  }),
  type: z.enum(['tiered', 'boolean']).openapi({
    description: 'Service type: boolean (simple on/off) or tiered (multiple configurations)',
    example: 'boolean',
  }),
  description: z.string().openapi({
    description: 'Brief description of what this service does',
    example: 'Backup and recovery for Microsoft 365 data',
  }),
  regionCount: z.number().openapi({
    description: 'Total number of regions where this service is available',
    example: 23,
  }),
  editions: z.array(z.string()).optional().openapi({
    description: 'Available service editions (only for tiered services)',
    example: ['Foundation', 'Advanced'],
  }),
  tiers: z.array(z.string()).optional().openapi({
    description: 'Available pricing tiers (only for tiered services)',
    example: ['Core', 'Non-Core'],
  }),
})

// Response schema for service detail (handles both boolean and tiered services)
const ServiceDetailResponseSchema = z.object({
  service: ServiceInfoSchema,
  regions: z.array(z.string()).openapi({
    description: 'List of all region IDs where this service is available',
    example: ['azure-au-east', 'azure-brazil-south', 'azure-canada-central'],
  }),
  providerBreakdown: z.object({
    AWS: ProviderBreakdownDetailSchema,
    Azure: ProviderBreakdownDetailSchema,
  }).openapi({
    description: 'Breakdown of region availability by cloud provider with region lists',
  }),
  configurationBreakdown: z.record(z.string(), ConfigurationBreakdownDetailSchema).optional().openapi({
    description: `Breakdown of region availability by edition-tier combination (only for tiered services like vdc_vault). Keys are in format "Edition-Tier" (e.g., "Foundation-Core", "Advanced-Non-Core"). Use this to find which regions support specific service configurations.`,
    example: {
      'Foundation-Core': {
        count: 12,
        regions: ['aws-eu-north-1', 'aws-eu-south-2'],
      },
      'Advanced-Core': {
        count: 45,
        regions: ['aws-af-south-1', 'aws-ap-east-1'],
      },
    },
  }),
}).openapi('ServiceDetail')

// Route definition
const serviceByIdRoute = createRoute({
  method: 'get',
  path: '/api/v1/services/{serviceId}',
  summary: 'Get detailed information about a specific VDC service',
  description: `Retrieves comprehensive information about a single VDC service, including a complete list of all regions where the service is available and breakdowns by cloud provider. For tiered services like VDC Vault, also includes breakdown by edition-tier combinations showing which regions support specific configurations.`,
  tags: ['Services'],
  request: {
    params: ServiceIdParamSchema,
  },
  responses: {
    200: {
      description: 'Detailed service information with region availability',
      content: {
        'application/json': {
          schema: ServiceDetailResponseSchema,
        },
      },
    },
    404: {
      description: 'Service not found',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
})

export function registerServiceByIdRoute(app: OpenAPIHono<{ Bindings: Env }>) {
  app.openapi(serviceByIdRoute, (c) => {
    const { serviceId } = c.req.valid('param')

    // Get service metadata
    const service = getServiceById(serviceId)

    // This should never happen due to Zod validation, but TypeScript needs the check
    if (!service) {
      return c.json(
        {
          error: 'Service not found',
          code: 'SERVICE_NOT_FOUND',
          message: `Service with ID '${serviceId}' does not exist`,
          parameter: 'serviceId',
          value: serviceId,
          allowedValues: ['vdc_vault', 'vdc_m365', 'vdc_entra_id', 'vdc_salesforce', 'vdc_azure_backup'],
        },
        404
      )
    }

    // Get regions and breakdowns
    const regions = getServiceRegions(serviceId)
    const providerBreakdown = getServiceProviderBreakdown(serviceId)

    // Build response
    const response: any = {
      service: {
        ...service,
        regionCount: regions.length,
      },
      regions: regions.map(r => r.id),
      providerBreakdown,
    }

    // Add configuration breakdown for tiered services
    if (service.type === 'tiered') {
      const configBreakdown = getServiceConfigurationBreakdown(serviceId)
      if (configBreakdown) {
        response.configurationBreakdown = configBreakdown
      }
    }

    return c.json(response)
  })
}
