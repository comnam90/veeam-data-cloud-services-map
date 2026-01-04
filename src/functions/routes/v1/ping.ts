import { createRoute } from '@hono/zod-openapi'
import { z } from '@hono/zod-openapi'
import type { OpenAPIHono } from '@hono/zod-openapi'
import type { Env } from '../../types/env'

// Response schema
const PingResponseSchema = z.object({
  status: z.string().openapi({ example: 'ok' }),
  message: z.string().openapi({ example: 'API is working!' }),
  timestamp: z.string().openapi({ example: '2025-01-03T10:30:00Z' }),
  environment: z.string().openapi({ example: 'production' }),
})

// Route definition
const pingRoute = createRoute({
  method: 'get',
  path: '/api/v1/ping',
  summary: 'Test API connectivity and responsiveness',
  description: 'A lightweight connectivity test endpoint that confirms the API is online and responding.',
  tags: ['Health'],
  responses: {
    200: {
      description: 'Ping response',
      content: {
        'application/json': {
          schema: PingResponseSchema,
        },
      },
    },
  },
})

export function registerPingRoute(app: OpenAPIHono<{ Bindings: Env }>) {
  app.openapi(pingRoute, (c) => {
    return c.json({
      status: 'ok',
      message: 'API is working!',
      timestamp: new Date().toISOString(),
      environment: c.env.ENVIRONMENT || 'unknown',
    })
  })
}
