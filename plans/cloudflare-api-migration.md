# Cloudflare Workers Migration & API Implementation Plan

## Overview

Migrate from GitHub Pages to Cloudflare Workers with Static Assets and implement a REST API with Swagger UI for querying Veeam Data Cloud service availability across regions.

## Goals

1. Migrate Hugo site from GitHub Pages to Cloudflare Workers (zero downtime)
2. Implement REST API at `/api/v1/` with query parameters
3. Add interactive Swagger UI documentation at `/api-docs/`
4. Maintain all existing map functionality
5. Enable external services to query region/service availability programmatically
6. Leverage Workers' advanced features (observability, Durable Objects access, Cron Triggers)

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│ Cloudflare Worker (Single Domain)                       │
│                                                          │
│  Worker Script (src/index.js):                          │
│  ├─ Request Router                                      │
│  │   ├─ /api/v1/*       → API Handler                   │
│  │   └─ /*              → Static Assets (Hugo)          │
│                                                          │
│  Static Assets (public/):                               │
│  ├─ /                    → Interactive Map              │
│  ├─ /api-docs/           → Swagger UI                   │
│  └─ /api/openapi.yaml    → OpenAPI Specification        │
│                                                          │
│  API Routes:                                            │
│  ├─ /api/v1/regions      → List/filter regions          │
│  ├─ /api/v1/regions/{id} → Get specific region          │
│  └─ /api/v1/services     → List available services      │
└─────────────────────────────────────────────────────────┘
```

## URL Structure

| Endpoint | Method | Description | Example |
|----------|--------|-------------|---------|
| `/` | GET | Interactive map | Main site |
| `/api-docs/` | GET | Swagger UI | API documentation |
| `/api/openapi.yaml` | GET | OpenAPI spec | Schema definition |
| `/api/v1/regions` | GET | List regions with filters | `?provider=AWS&service=vdc_vault` |
| `/api/v1/regions/{id}` | GET | Get specific region | `/api/v1/regions/aws-us-east-1` |
| `/api/v1/services` | GET | List all services | Service metadata |

## Implementation Phases

### Phase 1: Pre-Migration Setup (No deployment changes)

**Estimated Time: 1-2 hours**

#### 1.1 Create Cloudflare Account & Install Wrangler
- [ ] Sign up at https://dash.cloudflare.com
- [ ] Install Wrangler CLI globally: `npm install -g wrangler`
- [ ] Authenticate: `wrangler login`
- [ ] Verify: `wrangler whoami`

#### 1.2 Prepare Data Build Script
- [ ] Create `scripts/build-api-data.js`
  - Reads all YAML files from `data/regions/`
  - Converts to single JSON array
  - Validates data structure
  - Outputs to `functions/data/regions.json`
- [ ] Add to `package.json` scripts:
  ```json
  {
    "scripts": {
      "build:data": "node scripts/build-api-data.js",
      "build": "npm run build:data && hugo"
    }
  }
  ```

#### 1.3 Create Wrangler Configuration (Required)
- [ ] Create `wrangler.toml` in project root:
  ```toml
  name = "veeam-data-cloud-services-map"
  main = "src/index.js"
  compatibility_date = "2025-01-01"

  [assets]
  directory = "./public"
  html_handling = "auto-trailing-slash"
  not_found_handling = "404-page"

  [build]
  command = "npm run build:data && hugo --gc --minify"

  [observability]
  enabled = true

  [[env.production.vars]]
  ENVIRONMENT = "production"

  [[env.staging.vars]]
  ENVIRONMENT = "staging"
  ```
- **Key configuration:**
  - `main`: Worker entry point that handles API routes
  - `assets.directory`: Hugo build output (static files)
  - `build.command`: Runs data conversion + Hugo build automatically
  - `observability`: Enables logs and monitoring
  - Static assets served automatically, API routes handled by worker

#### 1.4 Create OpenAPI Specification
- [ ] Create `static/api/openapi.yaml`
  - Define all endpoints (`/regions`, `/regions/{id}`, `/services`)
  - Include query parameters (provider, service, tier, edition)
  - Document request/response schemas
  - Add examples from actual data
  - Version as `1.0.0`

#### 1.5 Set Up Swagger UI
- [ ] Create `static/api-docs/index.html`
  - Use Swagger UI standalone bundle from CDN
  - Point to `/api/openapi.yaml`
  - Customize branding (Veeam colors)
  - Add header with disclaimer matching README

### Phase 2: Implement Worker API Handler

**Estimated Time: 2-3 hours**

#### 2.1 Create Worker Entry Point
- [ ] Create `src/index.js` with main request router:
  ```javascript
  import regionsData from './data/regions.json';

  export default {
    async fetch(request, env, ctx) {
      const url = new URL(request.url);

      // API routes
      if (url.pathname.startsWith('/api/v1/')) {
        return handleAPI(request, url, env);
      }

      // Serve static assets (Hugo site, Swagger UI, etc.)
      return env.ASSETS.fetch(request);
    }
  };
  ```

#### 2.2 Implement API Router
- [ ] Create `src/api/router.js`:
  - Route `/api/v1/regions` → listRegions()
  - Route `/api/v1/regions/{id}` → getRegion()
  - Route `/api/v1/services` → listServices()
  - Route `/api/v1/health` → healthCheck()
  - Return 404 for unknown API routes
  - Add CORS headers to all responses

#### 2.3 Implement Region Endpoints
- [ ] Create `src/api/regions.js`:
  - **listRegions(request, regionsData)**
    - Parse query parameters:
      - `provider` (AWS | Azure)
      - `service` (vdc_vault | vdc_m365 | vdc_entra_id | vdc_salesforce | vdc_azure_backup)
      - `tier` (Core | Non-Core) - only for vdc_vault
      - `edition` (Foundation | Advanced) - only for vdc_vault
    - Filter regions based on parameters
    - Return JSON response with data array and metadata
  - **getRegion(regionId, regionsData)**
    - Find region by ID
    - Return 404 if not found
    - Return single region object

#### 2.4 Implement Services Endpoint
- [ ] Create `src/api/services.js`:
  - **listServices()**
    - Return metadata about available services:
      ```json
      {
        "services": [
          {
            "id": "vdc_vault",
            "name": "Veeam Data Cloud Vault",
            "type": "tiered",
            "editions": ["Foundation", "Advanced"],
            "tiers": ["Core", "Non-Core"]
          },
          {
            "id": "vdc_m365",
            "name": "VDC for Microsoft 365",
            "type": "boolean",
            "editions": ["Flex", "Express", "Premium"]
          }
        ]
      }
      ```

#### 2.5 Implement Health Check
- [ ] Create `src/api/health.js`:
  - Return API version, compatibility date
  - Include region count, service count
  - Return data last updated timestamp (from build)
  - Use for monitoring and uptime checks

#### 2.6 Add CORS and Error Handling
- [ ] Create `src/utils/response.js`:
  - **jsonResponse(data, status = 200)** - Format JSON with CORS
  - **errorResponse(message, code, status = 400)** - Standard error format
  - **addCorsHeaders(headers)** - Add CORS headers
  - **addSecurityHeaders(headers)** - Add security headers

### Phase 3: Testing Locally

**Estimated Time: 1 hour**

#### 3.1 Run Local Development Server
- [ ] Run `wrangler dev`
  - Wrangler will automatically run the build command
  - Starts local server (default: http://localhost:8787)
  - Hot reload on file changes

#### 3.2 Test Each Endpoint
- [ ] Test static site:
  - `GET /` (map loads)
  - `GET /api-docs/` (Swagger UI loads)
- [ ] Test API endpoints:
  - `GET /api/v1/regions` (no params - all regions)
  - `GET /api/v1/regions?provider=AWS` (filter by provider)
  - `GET /api/v1/regions?service=vdc_vault&tier=Core` (filter by service + tier)
  - `GET /api/v1/regions/aws-us-east-1` (specific region)
  - `GET /api/v1/regions/invalid-id` (should return 404)
  - `GET /api/v1/services` (service metadata)
  - `GET /api/v1/health` (health check)
- [ ] Test Swagger UI functionality:
  - Verify all endpoints appear
  - Test "Try it out" functionality
  - Check response schemas match actual responses

#### 3.3 Test CORS
- [ ] Create test HTML file
- [ ] Make fetch requests from different origin
- [ ] Verify CORS headers present

### Phase 4: Cloudflare Workers Deployment

**Estimated Time: 15 minutes**

#### 4.1 Deploy to Production
- [ ] Run `wrangler deploy`
  - Wrangler runs build command automatically
  - Uploads worker script and static assets
  - Deploys to Cloudflare's global network
  - Returns worker URL (e.g., `veeam-data-cloud-services-map.workers.dev`)

#### 4.2 Verify Deployment
- [ ] Check map loads at root URL
- [ ] Check API endpoints respond:
  - `curl https://veeam-data-cloud-services-map.workers.dev/api/v1/regions`
  - `curl https://veeam-data-cloud-services-map.workers.dev/api/v1/health`
- [ ] Check Swagger UI loads and functions
- [ ] Test API queries from Swagger UI
- [ ] Verify data accuracy (compare to GitHub Pages version)

#### 4.3 Monitor Deployment
- [ ] Check Cloudflare dashboard for worker status
- [ ] Review worker logs: `wrangler tail`
- [ ] Verify no errors in deployment

### Phase 5: Custom Domain Setup (Optional)

**Estimated Time: 15 minutes + propagation time**

#### 5.1 Add Custom Route (Optional)
- [ ] In Cloudflare dashboard, go to Workers & Pages
- [ ] Select your worker
- [ ] Go to "Settings" → "Triggers"
- [ ] Add custom domain or route:
  - Option A: Custom domain (e.g., `api.veeam-cloud-map.dev`)
  - Option B: Route on existing zone (e.g., `veeam-cloud-map.dev/*)

#### 5.2 Update DNS (if using custom domain)
- [ ] Add DNS record pointing to worker
- [ ] Wait for SSL provisioning (~5 min)
- [ ] Verify HTTPS works

#### 5.3 Update Documentation
- [ ] Update README with new worker URL
- [ ] Update any hardcoded links
- [ ] Update GitHub repo description and URL

### Phase 6: Documentation & Finalization

**Estimated Time: 1 hour**

#### 6.1 Update README
- [ ] Add "API Documentation" section
- [ ] Link to Swagger UI
- [ ] Add example API calls:
  ```bash
  # Get all AWS regions
  curl "https://veeam-map.pages.dev/api/v1/regions?provider=AWS"

  # Get regions with VDC Vault Core tier
  curl "https://veeam-map.pages.dev/api/v1/regions?service=vdc_vault&tier=Core"

  # Get specific region
  curl "https://veeam-map.pages.dev/api/v1/regions/aws-us-east-1"
  ```
- [ ] Document response format
- [ ] Add rate limits (if implementing)
- [ ] Note API is free and public

#### 6.2 Create API Usage Examples
- [ ] Create `examples/` directory
- [ ] Add examples in multiple languages:
  - `curl.sh` - Bash/cURL examples
  - `fetch.js` - JavaScript/fetch example
  - `python-requests.py` - Python example
  - `terraform.tf` - Terraform data source example

#### 6.3 Add API Changelog
- [ ] Create `API_CHANGELOG.md`
- [ ] Document v1.0.0 initial release
- [ ] Define versioning strategy

#### 6.4 Set Up Automated Deployment (Optional)
- [ ] Option A: Manual deployment with `wrangler deploy`
- [ ] Option B: GitHub Action for auto-deploy on push:
  - Create `.github/workflows/deploy-worker.yml`
  - Use Cloudflare's official wrangler action
  - Add `CLOUDFLARE_API_TOKEN` secret to repo
  - Deploy on push to main branch
- [ ] Remove `.github/workflows/hugo.yml` (old GitHub Pages deployment)
- [ ] Keep `pr-validation.yml` if exists

### Phase 7: Monitoring & Polish

**Estimated Time: 30 minutes**

#### 7.1 Set Up Monitoring
- [ ] Enable Workers Analytics in Cloudflare dashboard
- [ ] Monitor with `wrangler tail` for real-time logs
- [ ] Set up alerts for errors (optional)
- [ ] Enable Logpush for long-term storage (optional)

#### 7.2 Add API Response Headers
- [ ] `X-API-Version: 1.0.0`
- [ ] `Cache-Control: public, max-age=3600` (cache for 1 hour)
- [ ] `X-Data-Last-Updated: <timestamp>` (from Git info)

#### 7.3 Add Security Headers
- [ ] `X-Content-Type-Options: nosniff`
- [ ] `X-Frame-Options: DENY`
- [ ] `Referrer-Policy: strict-origin-when-cross-origin`

#### 7.4 Create Issue Templates
- [ ] Add "API Issue" template to `.github/ISSUE_TEMPLATE/`
- [ ] Document how to report API bugs

## File Structure After Migration

```
veeam-data-cloud-services-map/
├── data/
│   └── regions/
│       ├── aws/
│       │   └── *.yaml (unchanged - source of truth)
│       └── azure/
│           └── *.yaml (unchanged - source of truth)
├── src/
│   ├── index.js (Worker entry point - main router)
│   ├── api/
│   │   ├── router.js (API route handler)
│   │   ├── regions.js (Region endpoints logic)
│   │   ├── services.js (Services endpoint)
│   │   └── health.js (Health check endpoint)
│   ├── utils/
│   │   └── response.js (CORS, error handling, JSON helpers)
│   └── data/
│       └── regions.json (generated from YAML, imported by worker)
├── public/
│   └── (Hugo build output - generated)
│       ├── index.html
│       ├── api/
│       │   └── openapi.yaml
│       └── api-docs/
│           └── index.html (Swagger UI)
├── static/
│   ├── api/
│   │   └── openapi.yaml (OpenAPI specification)
│   └── api-docs/
│       └── index.html (Swagger UI)
├── layouts/
│   └── index.html (Hugo template - unchanged)
├── content/
│   └── _index.md (Hugo content - unchanged)
├── scripts/
│   └── build-api-data.js (YAML → JSON converter)
├── examples/
│   ├── curl.sh
│   ├── fetch.js
│   ├── python-requests.py
│   └── terraform.tf
├── .github/
│   └── workflows/
│       ├── deploy-worker.yml (optional - auto-deploy)
│       └── pr-validation.yml (unchanged)
├── plans/
│   └── cloudflare-api-migration.md (this document)
├── API_CHANGELOG.md
├── wrangler.toml (Cloudflare Workers config - REQUIRED)
├── package.json (build scripts)
├── config.yaml (Hugo config - unchanged)
└── README.md (updated with API docs)
```

## Query Parameter Examples

### Filter by Provider
```
GET /api/v1/regions?provider=AWS
GET /api/v1/regions?provider=Azure
```

### Filter by Service
```
GET /api/v1/regions?service=vdc_m365
GET /api/v1/regions?service=vdc_vault
```

### Filter by Service + Tier (vdc_vault only)
```
GET /api/v1/regions?service=vdc_vault&tier=Core
GET /api/v1/regions?service=vdc_vault&tier=Non-Core
```

### Filter by Service + Edition (vdc_vault only)
```
GET /api/v1/regions?service=vdc_vault&edition=Advanced
GET /api/v1/regions?service=vdc_vault&edition=Foundation
```

### Combine Multiple Filters
```
GET /api/v1/regions?provider=AWS&service=vdc_vault&tier=Core
GET /api/v1/regions?provider=Azure&service=vdc_m365
```

## Response Format Examples

### GET /api/v1/regions (success)
```json
{
  "data": [
    {
      "id": "aws-us-east-1",
      "name": "US East 1 (N. Virginia)",
      "provider": "AWS",
      "coords": [38.9, -77.4],
      "aliases": ["Virginia", "N. Virginia", "US East", "IAD"],
      "services": {
        "vdc_vault": [
          {
            "edition": "Foundation",
            "tier": "Core"
          },
          {
            "edition": "Advanced",
            "tier": "Core"
          }
        ]
      }
    }
  ],
  "count": 1,
  "filters": {
    "provider": "AWS",
    "service": null,
    "tier": null,
    "edition": null
  }
}
```

### GET /api/v1/regions/aws-us-east-1 (success)
```json
{
  "id": "aws-us-east-1",
  "name": "US East 1 (N. Virginia)",
  "provider": "AWS",
  "coords": [38.9, -77.4],
  "aliases": ["Virginia", "N. Virginia", "US East", "IAD"],
  "services": {
    "vdc_vault": [
      {
        "edition": "Foundation",
        "tier": "Core"
      },
      {
        "edition": "Advanced",
        "tier": "Core"
      }
    ]
  }
}
```

### Error Response (404)
```json
{
  "error": "Region not found",
  "code": "REGION_NOT_FOUND",
  "message": "No region found with ID: invalid-region-id"
}
```

### Error Response (400)
```json
{
  "error": "Invalid parameter",
  "code": "INVALID_PARAMETER",
  "message": "Invalid provider. Must be 'AWS' or 'Azure'",
  "parameter": "provider",
  "value": "GCP"
}
```

## Rollback Plan

If issues arise during migration:

1. **Worker deployment issues:**
   - GitHub Pages remains active during migration
   - Simply don't update DNS/links until Worker is verified
   - No downtime risk

2. **API errors:**
   - Static assets continue to work (Hugo site served by worker)
   - API can be debugged/fixed in src/
   - Deploy fixes with `wrangler deploy`
   - Use `wrangler rollback` to revert to previous version

3. **Complete rollback:**
   - Revert DNS changes (if custom domain/route used)
   - Disable worker in Cloudflare dashboard
   - Continue using GitHub Pages
   - Keep worker code for future retry

## Success Criteria

- [ ] Map loads and functions identically to GitHub Pages version
- [ ] All API endpoints return correct data
- [ ] Swagger UI loads and allows testing
- [ ] CORS headers allow cross-origin requests
- [ ] API response time < 200ms (global average)
- [ ] Zero errors in Worker logs (`wrangler tail`)
- [ ] Worker analytics show successful requests
- [ ] README documents API usage
- [ ] At least 3 example use cases provided

## Cost Analysis

**Cloudflare Workers Free Tier:**
- 100,000 requests/day
- Unlimited bandwidth
- 10ms CPU time per request
- Built-in DDoS protection
- Global edge network (300+ locations)

**Expected usage (conservative):**
- ~1000 API requests/day initially
- ~500 map page views/day
- Average 1-2ms CPU time per request
- Well within free tier

**Paid tier (if needed - $5/month):**
- 10 million requests/month included
- Then $0.50 per additional million requests
- 30s CPU time limit (vs 10ms free tier)
- Additional features unlocked

**Cost: $0/month** (free tier sufficient for foreseeable usage)

## Future Enhancements (Post-Migration)

1. **Rate Limiting:** Add per-IP rate limits (100 req/min)
2. **API Keys:** Optional authentication for higher rate limits
3. **Webhooks:** Notify subscribers when regions/services update
4. **GraphQL:** Alternative to REST for complex queries
5. **Data Versioning:** Historical availability data
6. **SLA Metrics:** Add uptime/latency data per region
7. **Export Formats:** CSV, Excel endpoints
8. **Terraform Provider:** Native Terraform integration

## Timeline

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| Phase 1: Pre-Migration Setup | 1-2 hours | None |
| Phase 2: Worker Implementation | 2-3 hours | Phase 1 complete |
| Phase 3: Local Testing | 1 hour | Phase 2 complete |
| Phase 4: Deployment | 15 min | Phase 3 passing |
| Phase 5: Custom Domain (optional) | 15 min + propagation | Phase 4 verified |
| Phase 6: Documentation | 1 hour | Phase 4 complete |
| Phase 7: Polish | 30 min | Phase 6 complete |

**Total Estimated Time: 5-7 hours** (can be done over a weekend)

## Questions to Answer Before Starting

1. Do you want to use a custom domain/route, or use `.workers.dev` subdomain?
2. Should API responses be cached by CDN, or always fresh?
3. Do you need rate limiting on the API?
4. Should there be usage analytics/tracking for API calls? (Workers Analytics enabled by default)
5. Do you want API versioning in URLs (`/v1/`, `/v2/`) or headers? (Plan uses URL versioning)
6. Do you want automated deployment via GitHub Actions, or manual `wrangler deploy`?

## References

- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [Workers Static Assets](https://developers.cloudflare.com/workers/static-assets/)
- [Wrangler CLI Documentation](https://developers.cloudflare.com/workers/wrangler/)
- [OpenAPI 3.0 Specification](https://swagger.io/specification/)
- [Swagger UI Documentation](https://swagger.io/tools/swagger-ui/)
- [Migration from Pages to Workers](https://developers.cloudflare.com/workers/static-assets/migration-guides/migrate-from-pages/)
