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
import {
  ErrorResponseSchema,
  ProviderBreakdownDetailSchema,
  ConfigurationBreakdownDetailSchema,
} from '../../schemas/common'

const ServiceIdParamSchema = z.object({
  serviceId: z.string().openapi({
    param: {
      name: 'serviceId',
      in: 'path',
    },
    description: 'Unique identifier for the VDC service. Valid values: vdc_vault, vdc_m365, vdc_entra_id, vdc_salesforce, vdc_azure_backup',
    example: 'vdc_m365',
  }),
})

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
    const service = getServiceById(serviceId)

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

    const regions = getServiceRegions(serviceId)
    const providerBreakdown = getServiceProviderBreakdown(serviceId)

    const response: any = {
      service: {
        ...service,
        regionCount: regions.length,
      },
      regions: regions.map(r => r.id),
      providerBreakdown,
    }

    if (service.type === 'tiered') {
      const configBreakdown = getServiceConfigurationBreakdown(serviceId)
      if (configBreakdown) {
        response.configurationBreakdown = configBreakdown
      }
    }

    return c.json(response)
  })
}
