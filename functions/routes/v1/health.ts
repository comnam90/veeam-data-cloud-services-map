import { createRoute } from '@hono/zod-openapi'
import { z } from '@hono/zod-openapi'
import type { OpenAPIHono } from '@hono/zod-openapi'
import type { Env } from '../../types/env'
import { getRegionStats } from '../../utils/data'

// Response schema
const HealthResponseSchema = z.object({
  status: z.enum(['healthy', 'degraded', 'unhealthy']).openapi({ example: 'healthy' }),
  version: z.string().openapi({ example: '1.0.0' }),
  timestamp: z.string().openapi({ example: '2025-01-03T10:30:00Z' }),
  environment: z.string().openapi({ example: 'production' }),
  stats: z.object({
    totalRegions: z.number().openapi({ example: 64 }),
    awsRegions: z.number().openapi({ example: 27 }),
    azureRegions: z.number().openapi({ example: 37 }),
  }),
})

// Error response schema
const HealthErrorResponseSchema = z.object({
  status: z.string().openapi({ example: 'unhealthy' }),
  version: z.string().openapi({ example: '1.0.0' }),
  timestamp: z.string().openapi({ example: '2025-01-03T10:30:00Z' }),
  error: z.string().openapi({ example: 'Failed to retrieve health status' }),
  message: z.string().openapi({ example: 'Internal server error' }),
})

// Route definition
const healthRoute = createRoute({
  method: 'get',
  path: '/api/v1/health',
  summary: 'Get comprehensive API health status and statistics',
  description: 'Performs a comprehensive health check that validates data availability and returns statistics about the region database.',
  tags: ['Health'],
  responses: {
    200: {
      description: 'API health information',
      content: {
        'application/json': {
          schema: HealthResponseSchema,
        },
      },
    },
    500: {
      description: 'Server error',
      content: {
        'application/json': {
          schema: HealthErrorResponseSchema,
        },
      },
    },
  },
})

export function registerHealthRoute(app: OpenAPIHono<{ Bindings: Env }>) {
  app.openapi(healthRoute, (c) => {
    try {
      const stats = getRegionStats()

      return c.json({
        status: 'healthy' as const,
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        environment: c.env.ENVIRONMENT || 'unknown',
        stats: {
          totalRegions: stats.totalRegions,
          awsRegions: stats.awsRegions,
          azureRegions: stats.azureRegions,
        },
      }) as any
    } catch (error) {
      return c.json(
        {
          status: 'unhealthy',
          version: '1.0.0',
          timestamp: new Date().toISOString(),
          error: 'Failed to retrieve health status',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
        500
      ) as any
    }
  })
}
