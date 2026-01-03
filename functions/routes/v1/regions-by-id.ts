import { createRoute } from '@hono/zod-openapi'
import { z } from '@hono/zod-openapi'
import type { OpenAPIHono } from '@hono/zod-openapi'
import type { Env } from '../../types/env'
import { getRegionById } from '../../utils/data'

// VDC Vault configuration schema
const VdcVaultSchema = z.object({
  edition: z.enum(['Foundation', 'Advanced']).openapi({ example: 'Advanced' }),
  tier: z.enum(['Core', 'Non-Core']).openapi({ example: 'Core' }),
})

// Services schema
const ServicesSchema = z.object({
  vdc_vault: z.array(VdcVaultSchema).optional(),
  vdc_m365: z.boolean().optional(),
  vdc_entra_id: z.boolean().optional(),
  vdc_salesforce: z.boolean().optional(),
  vdc_azure_backup: z.boolean().optional(),
})

// Region schema
const RegionSchema = z.object({
  id: z.string().openapi({ example: 'aws-us-east-1' }),
  name: z.string().openapi({ example: 'US East 1 (N. Virginia)' }),
  provider: z.enum(['AWS', 'Azure']).openapi({ example: 'AWS' }),
  coords: z.tuple([z.number(), z.number()]).openapi({ example: [38.9, -77.4] }),
  aliases: z.array(z.string()).optional().openapi({
    example: ['Virginia', 'N. Virginia', 'US East', 'IAD']
  }),
  services: ServicesSchema,
})

// Error response schema
const ErrorResponseSchema = z.object({
  error: z.string().openapi({ example: 'Region not found' }),
  code: z.string().openapi({ example: 'REGION_NOT_FOUND' }),
  message: z.string().openapi({ example: 'No region found with ID: invalid-id' }),
  requestedId: z.string().optional().openapi({ example: 'invalid-id' }),
})

// Route definition
const regionByIdRoute = createRoute({
  method: 'get',
  path: '/api/v1/regions/{id}',
  summary: 'Get detailed information about a specific cloud region',
  description: 'Retrieves complete details about a single cloud region, including all available VDC services.',
  tags: ['Regions'],
  request: {
    params: z.object({
      id: z.string().openapi({
        param: { name: 'id', in: 'path' },
        example: 'aws-us-east-1',
      }),
    }),
  },
  responses: {
    200: {
      description: 'Region details',
      content: {
        'application/json': {
          schema: RegionSchema,
        },
      },
    },
    404: {
      description: 'Region not found',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
})

export function registerRegionByIdRoute(app: OpenAPIHono<{ Bindings: Env }>) {
  app.openapi(regionByIdRoute, (c) => {
    const { id } = c.req.valid('param')
    const region = getRegionById(id)

    if (!region) {
      return c.json(
        {
          error: 'Region not found',
          code: 'REGION_NOT_FOUND',
          message: `No region found with ID: ${id}`,
          requestedId: id,
        },
        404
      ) as any
    }

    return c.json(region, 200) as any
  })
}
