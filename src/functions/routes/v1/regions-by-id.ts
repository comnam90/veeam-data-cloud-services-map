import { createRoute } from '@hono/zod-openapi'
import { z } from '@hono/zod-openapi'
import type { OpenAPIHono } from '@hono/zod-openapi'
import type { Env } from '../../types/env'
import { getRegionById } from '../../utils/data'
import { RegionSchema, ErrorResponseSchema } from '../../schemas/common'

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
