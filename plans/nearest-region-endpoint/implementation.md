# Nearest Region Discovery API Endpoint Implementation

## Goal
Add `GET /api/v1/regions/nearest` endpoint that returns the N closest cloud regions to any geographic location, with filters for provider, service, tier, and edition.

## Prerequisites
Ensure you are on the `feature/nearest-region-endpoint` branch before beginning implementation.

- [x] Check current branch: `git branch --show-current`
- [x] If not on the correct branch, switch to it: `git checkout feature/nearest-region-endpoint`
- [x] If the branch doesn't exist, create it from main: `git checkout -b feature/nearest-region-endpoint main`

---

## Step-by-Step Implementation

### Step 1: Create Haversine Distance Utility

This utility calculates the great-circle distance between two geographic coordinates using the Haversine formula.

#### Step 1.1: Create geo.ts utility file

- [x] Create the file `src/functions/utils/geo.ts`
- [x] Copy and paste the complete code below:

```typescript
/**
 * Calculate the great-circle distance between two points on Earth
 * using the Haversine formula. Returns distance in both kilometers and miles.
 *
 * @param lat1 Latitude of first point in decimal degrees
 * @param lng1 Longitude of first point in decimal degrees
 * @param lat2 Latitude of second point in decimal degrees
 * @param lng2 Longitude of second point in decimal degrees
 * @returns Object with distance in kilometers and miles
 * @throws Error if coordinates are out of valid range
 */
export function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): { km: number; miles: number } {
  validateCoordinate(lat1, lng1, 'source')
  validateCoordinate(lat2, lng2, 'target')

  const EARTH_RADIUS_KM = 6371
  const KM_TO_MILES = 0.621371

  const dLat = toRadians(lat2 - lat1)
  const dLng = toRadians(lng2 - lng1)

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2)

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  const distanceKm = EARTH_RADIUS_KM * c
  const distanceMiles = distanceKm * KM_TO_MILES

  return {
    km: Math.round(distanceKm * 100) / 100,
    miles: Math.round(distanceMiles * 100) / 100,
  }
}

/**
 * Validate that coordinates are within valid ranges
 * @throws Error if coordinates are invalid
 */
function validateCoordinate(lat: number, lng: number, label: string): void {
  if (lat < -90 || lat > 90) {
    throw new Error(
      `Invalid ${label} latitude: ${lat}. Must be between -90 and 90.`
    )
  }
  if (lng < -180 || lng > 180) {
    throw new Error(
      `Invalid ${label} longitude: ${lng}. Must be between -180 and 180.`
    )
  }
}

/**
 * Convert degrees to radians
 */
function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180
}
```

#### Step 1 Verification Checklist

- [x] Run type checking: `npm run typecheck`
- [x] Verify no TypeScript errors in terminal output
- [x] File should be created at `src/functions/utils/geo.ts`

#### Step 1 STOP & COMMIT
**STOP & COMMIT:** Pause here. Test the changes, stage files, and commit:
```bash
git add src/functions/utils/geo.ts
git commit -m "feat: add Haversine distance calculation utility"
```

---

### Step 2: Create Nearest Region Route Handler

This creates the complete API endpoint with validation, filtering, distance calculation, and response formatting.

#### Step 2.1: Create regions-nearest.ts route file

- [x] Create the file `src/functions/routes/v1/regions-nearest.ts`
- [x] Copy and paste the complete code below:

```typescript
import { createRoute, z } from '@hono/zod-openapi'
import type { OpenAPIHono } from '@hono/zod-openapi'
import type { Env } from '../../types/env'
import type { Region } from '../../types/data'
import { RegionSchema, ErrorResponseSchema } from '../../schemas/common'
import { getRegions } from '../../utils/data'
import { calculateDistance } from '../../utils/geo'

const NearestRegionsQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90).openapi({
    param: { name: 'lat', in: 'query', required: true },
    description: 'Latitude of the source location in decimal degrees. Must be between -90 and 90.',
    example: 35.6762,
  }),
  lng: z.coerce.number().min(-180).max(180).openapi({
    param: { name: 'lng', in: 'query', required: true },
    description: 'Longitude of the source location in decimal degrees. Must be between -180 and 180.',
    example: 139.6503,
  }),
  limit: z.coerce.number().int().min(0).max(20).default(5).openapi({
    param: { name: 'limit', in: 'query' },
    description: 'Maximum number of regions to return. Default: 5. Max: 20. Use 0 for unlimited.',
    example: 5,
  }),
  provider: z.enum(['AWS', 'Azure']).optional().openapi({
    param: { name: 'provider', in: 'query' },
    description: 'Filter results by cloud provider',
    example: 'AWS',
  }),
  service: z.enum([
    'vdc_vault',
    'vdc_m365',
    'vdc_entra_id',
    'vdc_salesforce',
    'vdc_azure_backup',
  ]).optional().openapi({
    param: { name: 'service', in: 'query' },
    description: 'Filter results to regions offering the specified service',
    example: 'vdc_vault',
  }),
  tier: z.enum(['Core', 'Non-Core']).optional().openapi({
    param: { name: 'tier', in: 'query' },
    description: 'Filter vdc_vault regions by pricing tier. Only valid with service=vdc_vault.',
    example: 'Core',
  }),
  edition: z.enum(['Foundation', 'Advanced']).optional().openapi({
    param: { name: 'edition', in: 'query' },
    description: 'Filter vdc_vault regions by edition level. Only valid with service=vdc_vault.',
    example: 'Advanced',
  }),
})

const NearestRegionResultSchema = z.object({
  region: RegionSchema,
  distance: z.object({
    km: z.number().openapi({
      description: 'Distance in kilometers',
      example: 42.15,
    }),
    miles: z.number().openapi({
      description: 'Distance in miles',
      example: 26.19,
    }),
  }),
})

const NearestRegionsResponseSchema = z.object({
  query: z.object({
    lat: z.number(),
    lng: z.number(),
    limit: z.number(),
    service: z.string().nullable(),
    provider: z.string().nullable(),
    tier: z.string().nullable(),
    edition: z.string().nullable(),
  }).openapi({
    description: 'Echo of the query parameters used for this request',
  }),
  results: z.array(NearestRegionResultSchema).openapi({
    description: 'Array of regions with distances, sorted by proximity',
  }),
  count: z.number().openapi({
    description: 'Number of regions returned',
    example: 5,
  }),
}).openapi('NearestRegionsResponse')

const nearestRegionsRoute = createRoute({
  method: 'get',
  path: '/api/v1/regions/nearest',
  summary: 'Find nearest regions to coordinates',
  description: `Returns the N closest Veeam Data Cloud regions to a given geographic location.
  
Results can be filtered by provider, service availability, and for vdc_vault, by tier and edition.
Distances are calculated using the Haversine formula for great-circle distance.

**Important:** tier and edition filters only work with service=vdc_vault. Passing tier or edition without service=vdc_vault will return a 400 error.`,
  tags: ['Regions'],
  request: {
    query: NearestRegionsQuerySchema,
  },
  responses: {
    200: {
      description: 'Successfully found nearest regions',
      content: {
        'application/json': {
          schema: NearestRegionsResponseSchema,
        },
      },
    },
    400: {
      description: 'Invalid parameters or parameter combination',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
})

export function registerNearestRegionsRoute(app: OpenAPIHono<{ Bindings: Env }>) {
  app.openapi(nearestRegionsRoute, (c) => {
    const query = c.req.valid('query')
    const { lat, lng, limit, provider, service, tier, edition } = query

    if ((tier || edition) && service !== 'vdc_vault') {
      return c.json({
        error: 'Invalid parameter combination',
        code: 'INVALID_PARAMETER',
        message: 'tier and edition parameters are only valid with service=vdc_vault',
        parameter: tier ? 'tier' : 'edition',
        value: tier || edition,
      }, 400) as any
    }

    let filteredRegions = getRegions()

    if (provider) {
      filteredRegions = filteredRegions.filter(r => r.provider === provider)
    }

    if (service) {
      filteredRegions = filteredRegions.filter(r => {
        const serviceData = r.services[service]
        if (serviceData === undefined) return false
        if (typeof serviceData === 'boolean') return serviceData

        if (service === 'vdc_vault' && Array.isArray(serviceData)) {
          if (!tier && !edition) return true

          return serviceData.some(config => {
            const tierMatch = !tier || config.tier === tier
            const editionMatch = !edition || config.edition === edition
            return tierMatch && editionMatch
          })
        }

        return false
      })
    }

    const regionsWithDistance = filteredRegions.map(region => {
      const [regionLat, regionLng] = region.coords
      const distance = calculateDistance(lat, lng, regionLat, regionLng)
      return { region, distance }
    })

    regionsWithDistance.sort((a, b) => {
      if (a.distance.km !== b.distance.km) {
        return a.distance.km - b.distance.km
      }
      return a.region.id.localeCompare(b.region.id)
    })

    const results = limit === 0 
      ? regionsWithDistance 
      : regionsWithDistance.slice(0, limit)

    return c.json({
      query: {
        lat,
        lng,
        limit,
        service: service || null,
        provider: provider || null,
        tier: tier || null,
        edition: edition || null,
      },
      results,
      count: results.length,
    }, 200) as any
  })
}
```

#### Step 2.2: Register route in _worker.ts

- [x] Open the file `src/functions/_worker.ts`
- [x] Add the import at the top with other route imports (around line 10-20):

```typescript
import { registerNearestRegionsRoute } from './routes/v1/regions-nearest'
```

- [x] Find the section where routes are registered (around line 70-80)
- [x] Add the registration BEFORE `registerRegionByIdRoute(app)`:

```typescript
registerNearestRegionsRoute(app)  // MUST be before regions-by-id
registerRegionByIdRoute(app)      // Catches :id last
```

The registration order should look like this:

```typescript
registerPingRoute(app)
registerServicesRoute(app)
registerServiceByIdRoute(app)
registerHealthRoute(app)
registerNearestRegionsRoute(app)  // NEW - before regions-by-id
registerRegionByIdRoute(app)
registerRegionsRoute(app)
```

#### Step 2 Verification Checklist

- [x] Run type checking: `npm run typecheck`
- [x] Verify no TypeScript errors
- [x] Build the worker: `npm run build:worker`
- [x] Verify build succeeds with no errors
- [x] Start the dev server: `npm run dev`
- [x] Wait for "Ready on http://localhost:8788" message
- [x] Test the endpoint manually:
  ```bash
  curl "http://localhost:8788/api/v1/regions/nearest?lat=35.6762&lng=139.6503&limit=3"
  ```
- [x] Verify response includes `query`, `results`, and `count` fields
- [x] Verify first result is `aws-ap-northeast-1` (Tokyo region)
- [x] Stop the dev server (Ctrl+C)

#### Step 2 STOP & COMMIT
**STOP & COMMIT:** Pause here. Test the changes thoroughly, then stage and commit:
```bash
git add src/functions/routes/v1/regions-nearest.ts src/functions/_worker.ts
git commit -m "feat: add nearest regions API endpoint with filtering"
```

---

### Step 3: Add API Integration Tests

Add comprehensive test coverage for the new endpoint.

#### Step 3.1: Add tests to test-api.js

- [x] Open the file `scripts/test-api.js`
- [x] Find the section where tests are defined (after the `makeRequest` function)
- [x] Add all test cases below BEFORE the final summary section at the end:

```javascript
  // ===================================================================
  // Nearest Regions Endpoint Tests
  // ===================================================================

  await test('GET /api/v1/regions/nearest?lat=35.6762&lng=139.6503 returns 200', async () => {
    const res = await makeRequest('/api/v1/regions/nearest?lat=35.6762&lng=139.6503')
    assert(res.status === 200, `Expected 200, got ${res.status}`)
    assert(res.data.results, 'Expected results array')
    assert(res.data.count >= 1, 'Expected at least 1 result')
  })

  await test('Nearest regions returns Tokyo first for Tokyo coordinates', async () => {
    const res = await makeRequest('/api/v1/regions/nearest?lat=35.6762&lng=139.6503&limit=5')
    assert(res.status === 200, `Expected 200, got ${res.status}`)
    assert(res.data.results[0].region.id === 'aws-ap-northeast-1', 
      `Expected Tokyo region first, got ${res.data.results[0].region.id}`)
  })

  await test('Nearest regions response includes distance in km and miles', async () => {
    const res = await makeRequest('/api/v1/regions/nearest?lat=35.6762&lng=139.6503&limit=1')
    assert(res.status === 200, `Expected 200, got ${res.status}`)
    assert(res.data.results[0].distance, 'Expected distance object')
    assert(typeof res.data.results[0].distance.km === 'number', 'Expected km as number')
    assert(typeof res.data.results[0].distance.miles === 'number', 'Expected miles as number')
  })

  await test('Nearest regions echoes query parameters in response', async () => {
    const res = await makeRequest('/api/v1/regions/nearest?lat=40.7128&lng=-74.0060&limit=3')
    assert(res.status === 200, `Expected 200, got ${res.status}`)
    assert(res.data.query.lat === 40.7128, 'Expected lat in query')
    assert(res.data.query.lng === -74.0060, 'Expected lng in query')
    assert(res.data.query.limit === 3, 'Expected limit in query')
  })

  await test('Nearest regions defaults to limit=5', async () => {
    const res = await makeRequest('/api/v1/regions/nearest?lat=0&lng=0')
    assert(res.status === 200, `Expected 200, got ${res.status}`)
    assert(res.data.count === 5, `Expected 5 results with default limit, got ${res.data.count}`)
    assert(res.data.query.limit === 5, 'Expected limit=5 in query echo')
  })

  await test('Nearest regions limit=0 returns all regions', async () => {
    const res = await makeRequest('/api/v1/regions/nearest?lat=0&lng=0&limit=0')
    assert(res.status === 200, `Expected 200, got ${res.status}`)
    assert(res.data.count > 50, `Expected all regions (>50), got ${res.data.count}`)
  })

  await test('Nearest regions limit=20 is maximum', async () => {
    const res = await makeRequest('/api/v1/regions/nearest?lat=0&lng=0&limit=20')
    assert(res.status === 200, `Expected 200, got ${res.status}`)
    assert(res.data.count === 20, `Expected exactly 20 results, got ${res.data.count}`)
  })

  await test('Nearest regions filters by provider=AWS', async () => {
    const res = await makeRequest('/api/v1/regions/nearest?lat=35.6762&lng=139.6503&provider=AWS&limit=10')
    assert(res.status === 200, `Expected 200, got ${res.status}`)
    assert(res.data.results.every(r => r.region.provider === 'AWS'), 'Expected all AWS regions')
    assert(res.data.query.provider === 'AWS', 'Expected provider in query')
  })

  await test('Nearest regions filters by provider=Azure', async () => {
    const res = await makeRequest('/api/v1/regions/nearest?lat=35.6762&lng=139.6503&provider=Azure&limit=10')
    assert(res.status === 200, `Expected 200, got ${res.status}`)
    assert(res.data.results.every(r => r.region.provider === 'Azure'), 'Expected all Azure regions')
  })

  await test('Nearest regions filters by service=vdc_vault', async () => {
    const res = await makeRequest('/api/v1/regions/nearest?lat=0&lng=0&service=vdc_vault&limit=10')
    assert(res.status === 200, `Expected 200, got ${res.status}`)
    assert(res.data.results.every(r => r.region.services.vdc_vault), 'Expected all regions with vdc_vault')
    assert(res.data.query.service === 'vdc_vault', 'Expected service in query')
  })

  await test('Nearest regions filters by service=vdc_m365', async () => {
    const res = await makeRequest('/api/v1/regions/nearest?lat=0&lng=0&service=vdc_m365&limit=10')
    assert(res.status === 200, `Expected 200, got ${res.status}`)
    assert(res.data.results.every(r => r.region.services.vdc_m365 === true), 'Expected all regions with vdc_m365')
  })

  await test('Nearest regions combines provider and service filters', async () => {
    const res = await makeRequest('/api/v1/regions/nearest?lat=0&lng=0&provider=AWS&service=vdc_vault&limit=10')
    assert(res.status === 200, `Expected 200, got ${res.status}`)
    assert(res.data.results.every(r => r.region.provider === 'AWS'), 'Expected all AWS')
    assert(res.data.results.every(r => r.region.services.vdc_vault), 'Expected all with vdc_vault')
  })

  await test('Nearest regions filters by tier=Core (with service=vdc_vault)', async () => {
    const res = await makeRequest('/api/v1/regions/nearest?lat=0&lng=0&service=vdc_vault&tier=Core&limit=10')
    assert(res.status === 200, `Expected 200, got ${res.status}`)
    const allHaveCoreTier = res.data.results.every(r => 
      r.region.services.vdc_vault?.some(config => config.tier === 'Core')
    )
    assert(allHaveCoreTier, 'Expected all regions with Core tier')
    assert(res.data.query.tier === 'Core', 'Expected tier in query')
  })

  await test('Nearest regions filters by edition=Advanced (with service=vdc_vault)', async () => {
    const res = await makeRequest('/api/v1/regions/nearest?lat=0&lng=0&service=vdc_vault&edition=Advanced&limit=10')
    assert(res.status === 200, `Expected 200, got ${res.status}`)
    const allHaveAdvanced = res.data.results.every(r => 
      r.region.services.vdc_vault?.some(config => config.edition === 'Advanced')
    )
    assert(allHaveAdvanced, 'Expected all regions with Advanced edition')
    assert(res.data.query.edition === 'Advanced', 'Expected edition in query')
  })

  await test('Nearest regions combines tier and edition filters', async () => {
    const res = await makeRequest('/api/v1/regions/nearest?lat=0&lng=0&service=vdc_vault&tier=Core&edition=Advanced&limit=10')
    assert(res.status === 200, `Expected 200, got ${res.status}`)
    const allMatch = res.data.results.every(r => 
      r.region.services.vdc_vault?.some(config => 
        config.tier === 'Core' && config.edition === 'Advanced'
      )
    )
    assert(allMatch, 'Expected all regions with Core+Advanced config')
  })

  await test('Nearest regions returns 400 for missing lat', async () => {
    const res = await makeRequest('/api/v1/regions/nearest?lng=139.6503')
    assert(res.status === 400, `Expected 400 for missing lat, got ${res.status}`)
    assert(res.data.code === 'INVALID_PARAMETER', 'Expected INVALID_PARAMETER code')
  })

  await test('Nearest regions returns 400 for missing lng', async () => {
    const res = await makeRequest('/api/v1/regions/nearest?lat=35.6762')
    assert(res.status === 400, `Expected 400 for missing lng, got ${res.status}`)
    assert(res.data.code === 'INVALID_PARAMETER', 'Expected INVALID_PARAMETER code')
  })

  await test('Nearest regions returns 400 for lat > 90', async () => {
    const res = await makeRequest('/api/v1/regions/nearest?lat=91&lng=0')
    assert(res.status === 400, `Expected 400 for lat > 90, got ${res.status}`)
  })

  await test('Nearest regions returns 400 for lat < -90', async () => {
    const res = await makeRequest('/api/v1/regions/nearest?lat=-91&lng=0')
    assert(res.status === 400, `Expected 400 for lat < -90, got ${res.status}`)
  })

  await test('Nearest regions returns 400 for lng > 180', async () => {
    const res = await makeRequest('/api/v1/regions/nearest?lat=0&lng=181')
    assert(res.status === 400, `Expected 400 for lng > 180, got ${res.status}`)
  })

  await test('Nearest regions returns 400 for lng < -180', async () => {
    const res = await makeRequest('/api/v1/regions/nearest?lat=0&lng=-181')
    assert(res.status === 400, `Expected 400 for lng < -180, got ${res.status}`)
  })

  await test('Nearest regions returns 400 for limit > 20', async () => {
    const res = await makeRequest('/api/v1/regions/nearest?lat=0&lng=0&limit=21')
    assert(res.status === 400, `Expected 400 for limit > 20, got ${res.status}`)
  })

  await test('Nearest regions returns 400 for invalid provider', async () => {
    const res = await makeRequest('/api/v1/regions/nearest?lat=0&lng=0&provider=GCP')
    assert(res.status === 400, `Expected 400 for invalid provider, got ${res.status}`)
  })

  await test('Nearest regions returns 400 for tier without service=vdc_vault', async () => {
    const res = await makeRequest('/api/v1/regions/nearest?lat=0&lng=0&tier=Core')
    assert(res.status === 400, `Expected 400 for tier without vdc_vault, got ${res.status}`)
    assert(res.data.code === 'INVALID_PARAMETER', 'Expected INVALID_PARAMETER code')
    assert(res.data.message.includes('vdc_vault'), 'Expected message about vdc_vault requirement')
  })

  await test('Nearest regions returns 400 for edition without service=vdc_vault', async () => {
    const res = await makeRequest('/api/v1/regions/nearest?lat=0&lng=0&edition=Advanced')
    assert(res.status === 400, `Expected 400 for edition without vdc_vault, got ${res.status}`)
    assert(res.data.code === 'INVALID_PARAMETER', 'Expected INVALID_PARAMETER code')
  })

  await test('Nearest regions returns 400 for tier with service=vdc_m365', async () => {
    const res = await makeRequest('/api/v1/regions/nearest?lat=0&lng=0&service=vdc_m365&tier=Core')
    assert(res.status === 400, `Expected 400 for tier with non-vault service, got ${res.status}`)
  })

  await test('Nearest regions has deterministic ordering for equal distances', async () => {
    const res = await makeRequest('/api/v1/regions/nearest?lat=0&lng=0&limit=20')
    assert(res.status === 200, `Expected 200, got ${res.status}`)
    
    for (let i = 1; i < res.data.results.length; i++) {
      const prev = res.data.results[i - 1]
      const curr = res.data.results[i]
      
      if (prev.distance.km === curr.distance.km) {
        assert(prev.region.id < curr.region.id, 
          `Expected ${prev.region.id} < ${curr.region.id} for equal distances`)
      }
    }
  })

  await test('Nearest regions results are sorted by distance ascending', async () => {
    const res = await makeRequest('/api/v1/regions/nearest?lat=0&lng=0&limit=20')
    assert(res.status === 200, `Expected 200, got ${res.status}`)
    
    for (let i = 1; i < res.data.results.length; i++) {
      const prev = res.data.results[i - 1]
      const curr = res.data.results[i]
      assert(prev.distance.km <= curr.distance.km, 
        `Expected distances to be ascending: ${prev.distance.km} <= ${curr.distance.km}`)
    }
  })
```

#### Step 3 Verification Checklist

- [x] Run all API tests: `npm run test:api`
- [x] Verify all new nearest region tests pass (31 new tests)
- [x] Check that test summary shows 0 failures
- [x] Review test output for any unexpected warnings

#### Step 3 STOP & COMMIT
**STOP & COMMIT:** Pause here. Verify all tests pass, then stage and commit:
```bash
git add scripts/test-api.js
git commit -m "test: add comprehensive tests for nearest regions endpoint"
```

---

### Step 4: Update LLM Documentation

Add documentation for the new endpoint to help LLMs and users discover and use it.

#### Step 4.1: Update llms.txt (concise reference)

- [x] Open the file `static/llms.txt`
- [x] Find the "KEY ENDPOINTS" section (around line 15-30)
- [x] Add the new endpoint after the regions list endpoint and before the services section:

```markdown
### Get Nearest Regions
`GET /api/v1/regions/nearest?lat={latitude}&lng={longitude}`
Returns the N closest regions to a geographic location.
Query Parameters:
- lat (required): Latitude (-90 to 90)
- lng (required): Longitude (-180 to 180)
- limit: Max results (default: 5, max: 20, 0=unlimited)
- provider: Filter by AWS or Azure
- service: Filter by service availability (vdc_vault, vdc_m365, etc.)
- tier: Filter vdc_vault by Core/Non-Core (requires service=vdc_vault)
- edition: Filter vdc_vault by Foundation/Advanced (requires service=vdc_vault)

Response includes distance in km and miles for each region.
```

#### Step 4.2: Update llms-full.txt (comprehensive guide)

- [x] Open the file `static/llms-full.txt`
- [x] Find the "REGIONS ENDPOINTS" section (around line 200-250)
- [x] Add the complete endpoint documentation after the existing regions endpoints:

```markdown
### GET /api/v1/regions/nearest - Find Nearest Regions

**Purpose:** Find the N closest Veeam Data Cloud regions to any geographic location

**When to use:**
- Infrastructure planning: Find closest regions for disaster recovery
- Latency optimization: Identify nearest backup endpoints
- Multi-region strategy: Discover geographically distributed options
- Service discovery: Find closest regions with specific services

**URL:** `GET /api/v1/regions/nearest`

**Query Parameters:**

| Parameter | Type | Required | Values | Description |
|-----------|------|----------|--------|-------------|
| `lat` | float | Yes | -90 to 90 | Latitude of source location in decimal degrees |
| `lng` | float | Yes | -180 to 180 | Longitude of source location in decimal degrees |
| `limit` | integer | No | 0-20 | Max results to return. Default: 5, Max: 20, 0=unlimited |
| `provider` | string | No | `AWS`, `Azure` | Filter to specific cloud provider |
| `service` | string | No | `vdc_vault`, `vdc_m365`, `vdc_entra_id`, `vdc_salesforce`, `vdc_azure_backup` | Filter to regions offering this service |
| `tier` | string | No | `Core`, `Non-Core` | Filter vdc_vault by tier (requires `service=vdc_vault`) |
| `edition` | string | No | `Foundation`, `Advanced` | Filter vdc_vault by edition (requires `service=vdc_vault`) |

**Important Validation Rules:**
- `tier` and `edition` are ONLY valid when `service=vdc_vault`
- Passing `tier` or `edition` without `service=vdc_vault` returns 400 error
- Provider is case-sensitive: must be exactly `AWS` or `Azure`

**Response Schema:**

```json
{
  "query": {
    "lat": 35.6762,
    "lng": 139.6503,
    "limit": 5,
    "service": "vdc_vault",
    "provider": "AWS",
    "tier": "Core",
    "edition": null
  },
  "results": [
    {
      "region": {
        "id": "aws-ap-northeast-1",
        "name": "Asia Pacific (Tokyo)",
        "provider": "AWS",
        "coords": [35.6762, 139.2],
        "aliases": ["Tokyo", "Japan"],
        "services": {
          "vdc_vault": [
            { "edition": "Foundation", "tier": "Core" },
            { "edition": "Advanced", "tier": "Core" }
          ],
          "vdc_m365": true
        }
      },
      "distance": {
        "km": 42.15,
        "miles": 26.19
      }
    }
  ],
  "count": 1
}
```

**Distance Calculation:**
- Uses Haversine formula for great-circle distance
- Accurate for Earth's spherical approximation
- Returns distances rounded to 2 decimal places

**Sorting & Tie-Breaking:**
- Results sorted by distance ascending (closest first)
- Equal distances tie-break by region.id alphabetically
- Guarantees deterministic ordering

**Example Queries:**

1. Find 3 closest regions to Tokyo:
   `GET /api/v1/regions/nearest?lat=35.6762&lng=139.6503&limit=3`

2. Find closest AWS regions with vdc_vault:
   `GET /api/v1/regions/nearest?lat=40.7128&lng=-74.0060&provider=AWS&service=vdc_vault`

3. Find all Azure regions sorted by distance (unlimited):
   `GET /api/v1/regions/nearest?lat=51.5074&lng=-0.1278&provider=Azure&limit=0`

4. Find closest Core tier vdc_vault regions:
   `GET /api/v1/regions/nearest?lat=37.7749&lng=-122.4194&service=vdc_vault&tier=Core&limit=10`

5. Find closest Advanced edition Core tier regions:
   `GET /api/v1/regions/nearest?lat=0&lng=0&service=vdc_vault&tier=Core&edition=Advanced`

**Response Codes:**

- `200 OK` - Successfully found nearest regions (may return 0 results if filters exclude all)
- `400 Bad Request` - Invalid coordinates, limit out of range, or invalid filter combination

**Common Error Scenarios:**

```json
{
  "error": "Invalid parameter combination",
  "code": "INVALID_PARAMETER",
  "message": "tier and edition parameters are only valid with service=vdc_vault",
  "parameter": "tier",
  "value": "Core"
}
```

**Use Cases:**

1. **Disaster Recovery Planning:** Find 3-5 geographically distributed regions
2. **Latency Optimization:** Identify single closest region for primary backup
3. **Multi-Cloud Strategy:** Compare AWS vs Azure closest regions
4. **Service Availability:** Check which nearby regions offer specific services
5. **Cost Optimization:** Filter by Core tier to find most cost-effective nearby regions
```

#### Step 4 Verification Checklist

- [x] Verify both documentation files are updated
- [x] Check that examples use realistic coordinates
- [x] Confirm parameter descriptions match code validation
- [x] Ensure formatting is consistent with existing docs

#### Step 4 STOP & COMMIT
**STOP & COMMIT:** Pause here. Review documentation changes, then stage and commit:
```bash
git add static/llms.txt static/llms-full.txt
git commit -m "docs: add nearest regions endpoint to LLM documentation"
```

---

## Final Verification

After completing all steps, perform these final checks:

- [x] Run full test suite: `npm run test`
- [x] Verify all tests pass (should have 31 new passing tests)
- [x] Run type checking: `npm run typecheck`
- [x] Build entire project: `npm run build`
- [x] Start dev server: `npm run dev`
- [x] Access OpenAPI docs at `http://localhost:8788/api/docs`
- [x] Verify "Nearest Regions" endpoint appears in documentation
- [x] Test endpoint manually with various filter combinations
- [x] Check that OpenAPI schema is auto-generated correctly at `http://localhost:8788/api/openapi.json`

## Acceptance Criteria Verification

Confirm all criteria from Issue #13 are met:

- [x] `GET /api/v1/regions/nearest?lat=35.6762&lng=139.6503` returns Tokyo first
- [x] `limit` defaults to 5, caps at 20; `limit=0` returns all
- [x] `provider` filter works correctly
- [x] `service` filter works correctly
- [x] Combined filters work (`provider` + `service`, `tier` + `edition`)
- [x] Deterministic ordering for equal distances (tie-break by `region.id`)
- [x] Invalid `lat`/`lng` returns `400`
- [x] Invalid filter combo (`tier`/`edition` without `service=vdc_vault`) returns `400`
- [x] OpenAPI spec auto-generated and accessible at `/api/openapi.json`
- [x] API integration tests added (31 new tests)
- [x] LLM docs updated (`llms.txt`, `llms-full.txt`)

## Push to Remote

Once all verification passes:

```bash
git push origin feature/nearest-region-endpoint
```

Then create a pull request to merge into `main`.
