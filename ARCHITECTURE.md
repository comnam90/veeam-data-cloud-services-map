# API Architecture

## Overview

The API is built with **Hono** framework, **TypeScript**, and **Zod OpenAPI** for type-safe, self-documenting endpoints running on **Cloudflare Pages Functions**.

## Technology Stack

- **Runtime**: Cloudflare Workers (via Pages Functions)
- **Framework**: Hono 4.x (edge-optimized web framework)
- **Language**: TypeScript 5.x with strict mode
- **Validation**: Zod 4.x with OpenAPI integration
- **OpenAPI**: @hono/zod-openapi for automatic spec generation
- **Build**: TypeScript compiler (tsc) for type checking

## Project Structure

```
functions/
├── _worker.ts              # Main Hono app entry point
├── types/
│   ├── env.ts             # Environment & context types
│   └── data.ts            # Data model types (Region, Service, etc.)
├── schemas/
│   └── common.ts          # Shared Zod schemas with OpenAPI metadata
├── routes/
│   └── v1/
│       ├── ping.ts        # GET /api/v1/ping
│       ├── health.ts      # GET /api/v1/health
│       ├── services.ts    # GET /api/v1/services (with statistics)
│       ├── services-by-id.ts  # GET /api/v1/services/{serviceId}
│       ├── regions.ts     # GET /api/v1/regions
│       └── regions-by-id.ts  # GET /api/v1/regions/{id}
├── middleware/            # Custom middleware (future)
├── utils/
│   ├── data.ts           # Data access & statistics helpers
│   ├── response.ts       # Response formatting helpers
│   └── validation.ts     # Validation utilities
└── regions.json          # Generated region data (build artifact)
```

## Request Flow

1. **Request** → Cloudflare Pages Functions
2. **_worker.ts** → Hono router
3. **Global Middleware**:
   - Security headers (X-Content-Type-Options, X-Frame-Options, etc.)
   - CORS headers (allow all origins)
   - X-API-Version header
   - Cache-Control header (for API endpoints)
4. **Route Handler**:
   - Zod validates request parameters
   - Business logic executes
   - Response formatted with type safety
5. **Response** → Client

## Middleware Stack

Applied in order:

1. `secureHeaders()` - Hono's built-in security headers
2. `cors()` - CORS configuration for cross-origin requests
3. Custom API version header middleware
4. Custom cache control middleware (API routes only)

## Route Registration

Routes are registered in `_worker.ts`:

```typescript
import { OpenAPIHono } from '@hono/zod-openapi'
import { registerPingRoute } from './routes/v1/ping'
// ... other imports

const app = new OpenAPIHono<{ Bindings: Env }>()

// Global middleware
app.use('*', secureHeaders())
app.use('*', cors({ origin: '*' }))

// Register routes
registerPingRoute(app)
registerHealthRoute(app)
// ... other routes

export default app
```

## Type Safety

### Environment Types

```typescript
export interface Env {
  ENVIRONMENT?: string  // 'production' | 'preview' | 'unknown'
}
```

### Data Models

All data models are defined in `types/data.ts`:
- `Region` - Cloud region with services
- `Service` - VDC service metadata
- `VdcVaultConfig` - Vault tier/edition configuration
- `RegionServices` - Available services per region

### Zod Schemas

Schemas in `schemas/common.ts` provide:
- Runtime validation
- TypeScript type inference
- OpenAPI documentation generation
- Automatic request/response validation

Example:
```typescript
export const RegionSchema = z.object({
  id: z.string().openapi({
    description: 'Unique region identifier',
    example: 'aws-us-east-1'
  }),
  // ... more fields
}).openapi('Region')
```

## OpenAPI Generation

The API automatically generates OpenAPI 3.1 specification at `/api/openapi.json`.

### Features

- ✅ Automatic schema generation from Zod types
- ✅ Request parameter validation
- ✅ Response schema validation
- ✅ Rich descriptions for LLM consumption
- ✅ Examples for all fields
- ✅ Error response documentation

### Access OpenAPI Spec

```bash
GET /api/openapi.json
```

## API Endpoints

### Services Endpoints

#### `GET /api/v1/services`
Returns all VDC services with regional availability statistics.

**Response includes:**
- Service metadata (id, name, type, description)
- `regionCount`: Total regions supporting the service
- `providerBreakdown`: Count of AWS vs Azure regions
- `configurationBreakdown`: For tiered services, count per edition-tier combination

**Use cases:**
- Compare service coverage across VDC offerings
- Understand which services have the widest availability
- See distribution of services across cloud providers

#### `GET /api/v1/services/{serviceId}`
Returns detailed information about a specific service.

**Path parameters:**
- `serviceId`: Service identifier (vdc_vault, vdc_m365, vdc_entra_id, vdc_salesforce, vdc_azure_backup)

**Response includes:**
- Complete service metadata
- List of all region IDs supporting the service
- Provider breakdown with region lists
- Configuration breakdown with region lists (for tiered services)

**Use cases:**
- Get all regions supporting a specific service
- Find which regions support specific edition-tier combinations
- Understand geographic distribution of a service

### Regions Endpoints

#### `GET /api/v1/regions`
Returns all regions with optional filtering.

**Query parameters:**
- `provider`: Filter by AWS or Azure
- `service`: Filter by service ID
- `tier`: Filter by tier (vdc_vault only)
- `edition`: Filter by edition (vdc_vault only)
- `country`: Search by country/location name

#### `GET /api/v1/regions/{id}`
Returns detailed information about a specific region.

**Path parameters:**
- `id`: Region identifier (e.g., aws-us-east-1)

### Health Endpoints

#### `GET /api/v1/ping`
Simple health check endpoint.

#### `GET /api/v1/health`
Detailed health status with environment information.

## Error Handling

All errors follow a consistent format:

```json
{
  "error": "Short error message",
  "code": "ERROR_CODE_ENUM",
  "message": "Detailed explanation",
  "parameter": "fieldName",
  "value": "invalidValue",
  "allowedValues": ["valid", "values"]
}
```

Error codes:
- `REGION_NOT_FOUND` - Region ID doesn't exist
- `SERVICE_NOT_FOUND` - Service ID doesn't exist
- `INVALID_PARAMETER` - Query parameter invalid
- `INTERNAL_ERROR` - Server error

## Data Management

### Build Process

```bash
npm run build:data    # Generate regions.json from YAML
npm run typecheck     # Validate TypeScript
npm run build         # Full build (data + typecheck + hugo)
```

### Data Flow

1. **Source**: `data/regions/*.yaml` files
2. **Build**: `scripts/build-api-data.js` processes YAML
3. **Output**: `functions/regions.json`
4. **Import**: Routes import via `utils/data.ts`
5. **Type Safety**: Validated against `Region` type

## Deployment

### Cloudflare Pages

The API deploys automatically via Cloudflare Pages:

1. **Build Command**: `npm run build`
2. **Output Directory**: `public`
3. **Functions**: Auto-compiled from `functions/_worker.ts`
4. **TypeScript**: Cloudflare Pages compiles TS automatically

### Environment Variables

Set in Cloudflare Pages dashboard or `wrangler.toml`:

```toml
[env.production.vars]
ENVIRONMENT = "production"

[env.preview.vars]
ENVIRONMENT = "preview"
```

## Performance

### Optimizations

- ✅ Hono is optimized for Cloudflare Workers (minimal overhead)
- ✅ Static data loaded once at Worker initialization
- ✅ Response caching via Cache-Control headers (1 hour)
- ✅ CORS preflight handled by middleware
- ✅ No database queries (static JSON data)

### Bundle Size

- Hono core: ~12KB
- Zod + OpenAPI: ~30KB
- Application code: ~20KB
- **Total**: ~62KB (well within Workers limits)

## Security

### Headers Applied

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Access-Control-Allow-Origin: *` (public API)

### Validation

- All request parameters validated by Zod
- Type safety prevents injection attacks
- Read-only data source (no mutations)

## Future Enhancements

### Planned Features

- [ ] Rate limiting middleware
- [ ] API key authentication (optional)
- [ ] Request logging/analytics
- [ ] GraphQL endpoint
- [ ] Webhooks for data updates

### OpenAPI Enhancement

- [ ] Complete rich documentation porting (4-6 hours)
- [ ] Add response examples for all endpoints
- [ ] Generate OpenAPI YAML output
- [ ] OpenAPI UI (Swagger/Redoc)

## Development

### Local Development

```bash
# Build data
npm run build:data

# Type check
npm run typecheck

# Deploy to preview for testing
git push origin <branch>
```

### Adding New Endpoints

1. Create route file in `routes/v1/`
2. Define Zod schemas with OpenAPI metadata
3. Create route using `createRoute()`
4. Implement handler function
5. Register in `_worker.ts`
6. Export registration function

Example:
```typescript
// routes/v1/example.ts
import { createRoute } from '@hono/zod-openapi'
import { z } from '@hono/zod-openapi'

const exampleRoute = createRoute({
  method: 'get',
  path: '/api/v1/example',
  summary: 'Example endpoint',
  responses: {
    200: {
      description: 'Success',
      content: {
        'application/json': {
          schema: z.object({ message: z.string() })
        }
      }
    }
  }
})

export function registerExampleRoute(app) {
  app.openapi(exampleRoute, (c) => {
    return c.json({ message: 'Hello!' })
  })
}
```

## References

- [Hono Documentation](https://hono.dev/)
- [@hono/zod-openapi Documentation](https://github.com/honojs/middleware/tree/main/packages/zod-openapi)
- [Cloudflare Pages Functions](https://developers.cloudflare.com/pages/platform/functions/)
- [Zod Documentation](https://zod.dev/)
