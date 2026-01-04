import { OpenAPIHono } from '@hono/zod-openapi'
import { cors } from 'hono/cors'
import { secureHeaders } from 'hono/secure-headers'
import { apiReference } from '@scalar/hono-api-reference'
import type { Env } from './types/env'

// Create Hono app with OpenAPI support and custom validation error handling
const app = new OpenAPIHono<{ Bindings: Env }>({
  defaultHook: (result, c) => {
    if (!result.success) {
      // Extract error details from Zod validation error
      const firstError = result.error.issues?.[0]
      if (firstError) {
        const param = String(firstError.path?.[0] || 'unknown')
        const value = c.req.query(param)
        const allowedValues = (firstError as any).values || []

        // Return custom error format that matches test expectations
        return c.json(
          {
            error: 'Invalid parameter',
            code: 'INVALID_PARAMETER',
            message: firstError.message || 'Invalid parameter value',
            parameter: param,
            value: value,
            allowedValues: allowedValues,
          },
          400
        )
      }
    }
    // If validation succeeds, continue to the route handler
    return undefined
  }
})

// Global middleware
app.use('*', secureHeaders())
app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'OPTIONS'],
  allowHeaders: ['Content-Type'],
  maxAge: 86400,
}))

// Add X-API-Version header to all responses
app.use('*', async (c, next) => {
  await next()
  c.header('X-API-Version', '1.0.0')
})

// Add Cache-Control header to API responses
app.use('/api/*', async (c, next) => {
  await next()
  if (!c.res.headers.has('Cache-Control')) {
    c.header('Cache-Control', 'public, max-age=3600')
  }
})

// OpenAPI documentation endpoint
app.doc('/api/openapi.json', {
  openapi: '3.1.0',
  info: {
    title: 'Veeam Data Cloud Service Availability API',
    version: '1.0.0',
    description: `
Retrieves comprehensive information about Veeam Data Cloud (VDC) service availability
across AWS and Azure cloud regions worldwide. Use this API to programmatically discover
which VDC services are available in specific geographic locations, filter regions by
cloud provider, search by country name, and understand service tier and edition
availability for planning your data protection strategy.

**Common use cases:**
- Find all regions where a specific VDC service (like Vault or Microsoft 365 backup) is available
- Identify which AWS or Azure regions support your required service tier and edition
- Search for regions by country or geographic location to meet data residency requirements
- Get complete service availability data for capacity planning and multi-region deployments

**Disclaimer:** This is an unofficial, community-maintained API and is not affiliated
with, endorsed by, or supported by Veeam Software. Always refer to official Veeam
documentation for authoritative information.
    `.trim(),
    contact: {
      name: 'GitHub Repository',
      url: 'https://github.com/comnam90/veeam-data-cloud-services-map',
    },
    license: {
      name: 'MIT',
      url: 'https://opensource.org/licenses/MIT',
    },
  },
  servers: [
    {
      url: '/',
      description: 'Current environment (auto-detects production/preview/local)',
    },
  ],
  tags: [
    {
      name: 'Regions',
      description: 'Query cloud regions and their VDC service availability',
    },
    {
      name: 'Services',
      description: 'Information about available VDC services',
    },
    {
      name: 'Health',
      description: 'API health and status',
    },
  ],
})

// Serve interactive API documentation UI at /api/docs
app.get('/api/docs', apiReference({
  pageTitle: 'Veeam Data Cloud API Documentation',
  spec: {
    url: '/api/openapi.json',
  },
} as any))

// Register routes
import { registerPingRoute } from './routes/v1/ping'
import { registerServicesRoute } from './routes/v1/services'
import { registerHealthRoute } from './routes/v1/health'
import { registerRegionByIdRoute } from './routes/v1/regions-by-id'
import { registerRegionsRoute } from './routes/v1/regions'

registerPingRoute(app)
registerServicesRoute(app)
registerHealthRoute(app)
registerRegionByIdRoute(app)
registerRegionsRoute(app)

export default app
