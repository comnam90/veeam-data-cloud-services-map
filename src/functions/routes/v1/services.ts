import { createRoute } from '@hono/zod-openapi'
import { z } from '@hono/zod-openapi'
import type { OpenAPIHono } from '@hono/zod-openapi'
import type { Env } from '../../types/env'
import { getServices } from '../../utils/data'

// Service schema
const ServiceSchema = z.object({
  id: z.string().openapi({ example: 'vdc_vault' }),
  name: z.string().openapi({ example: 'Veeam Data Cloud Vault' }),
  type: z.enum(['tiered', 'boolean']).openapi({ example: 'tiered' }),
  description: z.string().openapi({
    example: 'Immutable backup storage with configurable pricing tiers',
  }),
  editions: z.array(z.string()).optional().openapi({
    example: ['Foundation', 'Advanced'],
  }),
  tiers: z.array(z.string()).optional().openapi({
    example: ['Core', 'Non-Core'],
  }),
})

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
