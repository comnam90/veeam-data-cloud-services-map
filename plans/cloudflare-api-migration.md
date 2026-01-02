# Cloudflare Pages Migration & API Implementation Plan

## Overview

Migrate from GitHub Pages to Cloudflare Pages and implement a REST API with Swagger UI for querying Veeam Data Cloud service availability across regions.

## Goals

1. Migrate Hugo site from GitHub Pages to Cloudflare Pages (zero downtime)
2. Implement REST API at `/api/v1/` with query parameters
3. Add interactive Swagger UI documentation at `/api-docs/`
4. Maintain all existing map functionality
5. Enable external services to query region/service availability programmatically

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│ Cloudflare Pages (Single Domain)                        │
│                                                          │
│  Static Site (Hugo):                                    │
│  ├─ /                    → Interactive Map              │
│  ├─ /api-docs/           → Swagger UI (static)          │
│  └─ /api/openapi.yaml    → OpenAPI Specification        │
│                                                          │
│  Functions (Workers):                                   │
│  ├─ /api/v1/regions      → List/filter regions          │
│  ├─ /api/v1/regions/[id] → Get specific region          │
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

#### 1.1 Create Cloudflare Pages Account
- [ ] Sign up at https://pages.cloudflare.com
- [ ] Connect GitHub account
- [ ] Note: Don't create project yet

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

#### 1.3 Create OpenAPI Specification
- [ ] Create `static/api/openapi.yaml`
  - Define all endpoints (`/regions`, `/regions/{id}`, `/services`)
  - Include query parameters (provider, service, tier, edition)
  - Document request/response schemas
  - Add examples from actual data
  - Version as `1.0.0`

#### 1.4 Set Up Swagger UI
- [ ] Create `static/api-docs/index.html`
  - Use Swagger UI standalone bundle from CDN
  - Point to `/api/openapi.yaml`
  - Customize branding (Veeam colors)
  - Add header with disclaimer matching README

### Phase 2: Implement API Functions

**Estimated Time: 2-3 hours**

#### 2.1 Create Shared Data Module
- [ ] Create `functions/_shared/data.js`
  - Exports `getRegions()` function
  - Reads from embedded `regions.json`
  - Caches data in memory
  - Handles data validation

#### 2.2 Implement `/api/v1/regions` Endpoint
- [ ] Create `functions/api/v1/regions.js`
  - Export `onRequestGet(context)` function
  - Parse query parameters:
    - `provider` (AWS | Azure)
    - `service` (vdc_vault | vdc_m365 | vdc_entra_id | vdc_salesforce | vdc_azure_backup)
    - `tier` (Core | Non-Core) - only for vdc_vault
    - `edition` (Foundation | Advanced) - only for vdc_vault
  - Filter regions based on parameters
  - Return JSON array
  - Add CORS headers
  - Handle errors gracefully

#### 2.3 Implement `/api/v1/regions/[id]` Endpoint
- [ ] Create `functions/api/v1/regions/[id].js`
  - Export `onRequestGet(context)` function
  - Get `id` from `context.params.id`
  - Find region by ID
  - Return 404 if not found
  - Return single region object
  - Add CORS headers

#### 2.4 Implement `/api/v1/services` Endpoint
- [ ] Create `functions/api/v1/services.js`
  - Export `onRequestGet(context)` function
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
        // ... etc
      ]
    }
    ```

#### 2.5 Add Health Check Endpoint
- [ ] Create `functions/api/v1/health.js`
  - Return API version, data last updated timestamp
  - Include region count, service count
  - Use for monitoring

### Phase 3: Testing Locally

**Estimated Time: 1 hour**

#### 3.1 Install Wrangler CLI
```bash
npm install -g wrangler
```

#### 3.2 Test Functions Locally
- [ ] Run `wrangler pages dev public`
- [ ] Test each endpoint:
  - `GET /api/v1/regions` (no params)
  - `GET /api/v1/regions?provider=AWS`
  - `GET /api/v1/regions?service=vdc_vault&tier=Core`
  - `GET /api/v1/regions/aws-us-east-1`
  - `GET /api/v1/regions/invalid-id` (should 404)
  - `GET /api/v1/services`
  - `GET /api/v1/health`
- [ ] Test Swagger UI at `/api-docs/`
  - Verify all endpoints appear
  - Test "Try it out" functionality
  - Check response schemas match actual responses

#### 3.3 Test CORS
- [ ] Create test HTML file
- [ ] Make fetch requests from different origin
- [ ] Verify CORS headers present

### Phase 4: Cloudflare Pages Deployment

**Estimated Time: 30 minutes**

#### 4.1 Create Cloudflare Pages Project
- [ ] Go to Pages dashboard
- [ ] Click "Create a project"
- [ ] Select GitHub repo
- [ ] Configure build:
  - **Framework preset:** Hugo
  - **Build command:** `npm run build` (or just `hugo` if no npm)
  - **Build output directory:** `public`
  - **Root directory:** `/`
  - **Environment variables:** `HUGO_VERSION=0.139.3` (check current version)

#### 4.2 Initial Deployment
- [ ] Click "Save and Deploy"
- [ ] Wait for build to complete (~2 min)
- [ ] Get preview URL (e.g., `veeam-data-cloud-services-map.pages.dev`)

#### 4.3 Verify Deployment
- [ ] Check map loads at root URL
- [ ] Check API endpoints respond
- [ ] Check Swagger UI loads
- [ ] Test API queries from Swagger UI
- [ ] Verify data accuracy (compare to GitHub Pages version)

### Phase 5: DNS Migration

**Estimated Time: 15 minutes + propagation time**

#### 5.1 Update GitHub Pages (if using custom domain)
- [ ] Note current DNS settings
- [ ] Keep GitHub Pages active during migration

#### 5.2 Configure Custom Domain (Optional)
- [ ] In Cloudflare Pages, go to "Custom domains"
- [ ] Add domain
- [ ] Update DNS records (Cloudflare provides instructions)
- [ ] Wait for SSL provisioning (~5 min)

#### 5.3 Switch Traffic
- [ ] Test custom domain loads Cloudflare version
- [ ] Update any hardcoded links in README
- [ ] Update GitHub repo description

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

#### 6.4 Update GitHub Workflows
- [ ] Remove `.github/workflows/hugo.yml` (GitHub Pages deployment)
- [ ] Cloudflare Pages auto-deploys on push (no workflow needed)
- [ ] Keep `pr-validation.yml` if exists

### Phase 7: Monitoring & Polish

**Estimated Time: 30 minutes**

#### 7.1 Set Up Analytics
- [ ] Enable Cloudflare Web Analytics (free)
- [ ] Add analytics script to map page
- [ ] Monitor API usage in Cloudflare dashboard

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
│       │   └── *.yaml (unchanged)
│       └── azure/
│           └── *.yaml (unchanged)
├── functions/
│   ├── _shared/
│   │   └── data.js (shared data loader)
│   ├── data/
│   │   └── regions.json (generated from YAML)
│   └── api/
│       └── v1/
│           ├── regions.js (GET /api/v1/regions)
│           ├── regions/
│           │   └── [id].js (GET /api/v1/regions/:id)
│           ├── services.js (GET /api/v1/services)
│           └── health.js (GET /api/v1/health)
├── static/
│   ├── api/
│   │   └── openapi.yaml (API specification)
│   └── api-docs/
│       └── index.html (Swagger UI)
├── scripts/
│   └── build-api-data.js (YAML → JSON converter)
├── examples/
│   ├── curl.sh
│   ├── fetch.js
│   ├── python-requests.py
│   └── terraform.tf
├── plans/
│   └── cloudflare-api-migration.md (this document)
├── API_CHANGELOG.md
├── package.json (add build scripts)
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

1. **Cloudflare Pages issues:**
   - GitHub Pages remains active during migration
   - Simply don't update DNS/links until Cloudflare is verified
   - No downtime risk

2. **API function errors:**
   - Map continues to work (static Hugo site)
   - API can be debugged/fixed without affecting map
   - Deploy fixes via git push

3. **Complete rollback:**
   - Revert DNS changes (if custom domain used)
   - Delete Cloudflare Pages project
   - Continue using GitHub Pages

## Success Criteria

- [ ] Map loads and functions identically to GitHub Pages version
- [ ] All API endpoints return correct data
- [ ] Swagger UI loads and allows testing
- [ ] CORS headers allow cross-origin requests
- [ ] API response time < 200ms (global average)
- [ ] Zero errors in Cloudflare Functions logs
- [ ] README documents API usage
- [ ] At least 3 example use cases provided

## Cost Analysis

**Cloudflare Pages Free Tier:**
- 500 builds per month
- Unlimited requests
- Unlimited bandwidth
- 100k Functions requests/day
- 10ms CPU time per request

**Expected usage (conservative):**
- ~30 builds/month (assuming daily updates)
- ~1000 API requests/day initially
- Well within free tier

**Cost: $0/month**

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
| Phase 2: API Implementation | 2-3 hours | Phase 1 complete |
| Phase 3: Local Testing | 1 hour | Phase 2 complete |
| Phase 4: Deployment | 30 min | Phase 3 passing |
| Phase 5: DNS Migration | 15 min + propagation | Phase 4 verified |
| Phase 6: Documentation | 1 hour | Phase 5 complete |
| Phase 7: Polish | 30 min | Phase 6 complete |

**Total Estimated Time: 6-8 hours** (can be done over a weekend)

## Questions to Answer Before Starting

1. Do you want to use a custom domain, or use `.pages.dev` subdomain?
2. Should API responses be cached (CDN), or always fresh?
3. Do you need rate limiting on the API?
4. Should there be usage analytics/tracking for API calls?
5. Do you want API versioning in URLs (`/v1/`, `/v2/`) or headers?

## References

- [Cloudflare Pages Documentation](https://developers.cloudflare.com/pages/)
- [Cloudflare Functions](https://developers.cloudflare.com/pages/platform/functions/)
- [OpenAPI 3.0 Specification](https://swagger.io/specification/)
- [Swagger UI Documentation](https://swagger.io/tools/swagger-ui/)
