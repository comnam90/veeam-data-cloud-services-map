# Cloudflare Pages Migration & API Implementation Plan

## Overview

Migrate from GitHub Pages to Cloudflare Pages and implement a REST API with Swagger UI for querying Veeam Data Cloud service availability across regions.

## Goals

1. Migrate Hugo site from GitHub Pages to Cloudflare Pages (zero downtime)
2. Implement REST API at `/api/v1/` with query parameters using Pages Functions
3. Add interactive Swagger UI documentation at `/api/docs/`
4. Maintain all existing map functionality
5. Enable external services to query region/service availability programmatically
6. Keep it simple with file-based routing

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│ Cloudflare Pages (Single Domain)                        │
│                                                          │
│  Static Site (Hugo - public/):                          │
│  ├─ /                    → Interactive Map              │
│  ├─ /api/docs/           → Swagger UI                   │
│  └─ /api/openapi.yaml    → OpenAPI Specification        │
│                                                          │
│  Functions (file-based routing):                        │
│  ├─ /api/v1/regions.js      → List/filter regions       │
│  ├─ /api/v1/regions/[id].js → Get specific region       │
│  ├─ /api/v1/services.js     → List available services   │
│  └─ /api/v1/health.js       → Health check              │
└─────────────────────────────────────────────────────────┘
```

## URL Structure

| Endpoint | Method | Description | Example |
|----------|--------|-------------|---------|
| `/` | GET | Interactive map | Main site |
| `/api/docs/` | GET | Swagger UI | API documentation |
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

#### 1.3 Create Wrangler Configuration (Optional but Recommended)
- [ ] Create `wrangler.toml` in project root:
  ```toml
  name = "veeam-data-cloud-services-map"
  compatibility_date = "2025-01-01"
  pages_build_output_dir = "public"

  [build]
  command = "npm run build:data && hugo --gc --minify"

  [env.production.vars]
  ENVIRONMENT = "production"

  [env.preview.vars]
  ENVIRONMENT = "preview"
  ```
- **Key configuration:**
  - `pages_build_output_dir`: Hugo build output directory
  - `build.command`: Runs data conversion + Hugo build automatically
  - Can also configure build settings in Pages dashboard
  - Environment variables for production and preview environments

#### 1.4 Create OpenAPI Specification
- [ ] Create `static/api/openapi.yaml`
  - Define all endpoints (`/regions`, `/regions/{id}`, `/services`)
  - Include query parameters (provider, service, tier, edition)
  - Document request/response schemas
  - Add examples from actual data
  - Version as `1.0.0`

#### 1.5 Set Up Swagger UI
- [ ] Create `static/api/docs/index.html`
  - Use Swagger UI standalone bundle from CDN
  - Point to `/api/openapi.yaml`
  - Customize branding (Veeam colors)
  - Add header with disclaimer matching README

### Phase 2: Implement Pages Functions

**Estimated Time: 2-3 hours**

#### 2.1 Create Shared Data Module
- [ ] Create `functions/_shared/data.js`:
  ```javascript
  import regionsData from './regions.json';

  export function getRegions() {
    return regionsData;
  }

  export function getRegionById(id) {
    return regionsData.find(r => r.id === id);
  }
  ```

#### 2.2 Create Shared Response Utilities
- [ ] Create `functions/_shared/response.js`:
  - **jsonResponse(data, status = 200)** - Format JSON with CORS headers
  - **errorResponse(message, code, status = 400)** - Standard error format
  - **corsHeaders()** - Return CORS headers object

#### 2.3 Implement `/api/v1/regions` Endpoint
- [ ] Create `functions/api/v1/regions.js`:
  ```javascript
  import { getRegions } from '../../../_shared/data.js';
  import { jsonResponse, errorResponse } from '../../../_shared/response.js';

  export async function onRequestGet(context) {
    const { searchParams } = new URL(context.request.url);
    const provider = searchParams.get('provider');
    const service = searchParams.get('service');
    const tier = searchParams.get('tier');
    const edition = searchParams.get('edition');

    let regions = getRegions();

    // Filter by provider
    if (provider) {
      regions = regions.filter(r => r.provider === provider);
    }

    // Filter by service
    if (service) {
      regions = regions.filter(r => r.services[service]);
    }

    // Filter by tier (vdc_vault only)
    if (tier && service === 'vdc_vault') {
      regions = regions.filter(r =>
        r.services.vdc_vault?.some(v => v.tier === tier)
      );
    }

    // Filter by edition (vdc_vault only)
    if (edition && service === 'vdc_vault') {
      regions = regions.filter(r =>
        r.services.vdc_vault?.some(v => v.edition === edition)
      );
    }

    return jsonResponse({
      data: regions,
      count: regions.length,
      filters: { provider, service, tier, edition }
    });
  }
  ```

#### 2.4 Implement `/api/v1/regions/[id]` Endpoint
- [ ] Create `functions/api/v1/regions/[id].js`:
  ```javascript
  import { getRegionById } from '../../../../_shared/data.js';
  import { jsonResponse, errorResponse } from '../../../../_shared/response.js';

  export async function onRequestGet(context) {
    const { id } = context.params;
    const region = getRegionById(id);

    if (!region) {
      return errorResponse('Region not found', 'REGION_NOT_FOUND', 404);
    }

    return jsonResponse(region);
  }
  ```

#### 2.5 Implement `/api/v1/services` Endpoint
- [ ] Create `functions/api/v1/services.js`:
  ```javascript
  import { jsonResponse } from '../../../_shared/response.js';

  export async function onRequestGet() {
    return jsonResponse({
      services: [
        {
          id: "vdc_vault",
          name: "Veeam Data Cloud Vault",
          type: "tiered",
          editions: ["Foundation", "Advanced"],
          tiers: ["Core", "Non-Core"]
        },
        {
          id: "vdc_m365",
          name: "VDC for Microsoft 365",
          type: "boolean",
          editions: ["Flex", "Express", "Premium"]
        },
        {
          id: "vdc_entra_id",
          name: "VDC for Entra ID",
          type: "boolean"
        },
        {
          id: "vdc_salesforce",
          name: "VDC for Salesforce",
          type: "boolean"
        },
        {
          id: "vdc_azure_backup",
          name: "VDC for Azure",
          type: "boolean"
        }
      ]
    });
  }
  ```

#### 2.6 Implement `/api/v1/health` Endpoint
- [ ] Create `functions/api/v1/health.js`:
  ```javascript
  import { getRegions } from '../../../_shared/data.js';
  import { jsonResponse } from '../../../_shared/response.js';

  export async function onRequestGet() {
    const regions = getRegions();
    return jsonResponse({
      status: "healthy",
      version: "1.0.0",
      timestamp: new Date().toISOString(),
      stats: {
        totalRegions: regions.length,
        awsRegions: regions.filter(r => r.provider === 'AWS').length,
        azureRegions: regions.filter(r => r.provider === 'Azure').length
      }
    });
  }
  ```

### Phase 3: Testing Locally

**Estimated Time: 1 hour**

#### 3.1 Build and Run Local Development Server
- [ ] Build the site: `npm run build` (runs data conversion + Hugo)
- [ ] Run Pages dev server: `wrangler pages dev public`
  - Serves static files from `public/`
  - Runs Functions from `functions/`
  - Local server at http://localhost:8788
  - Hot reload for Functions (rebuild needed for Hugo changes)

#### 3.2 Test Each Endpoint
- [ ] Test static site:
  - `GET /` (map loads)
  - `GET /api/docs/` (Swagger UI loads)
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

### Phase 4: Cloudflare Pages Deployment

**Estimated Time: 30 minutes**

#### 4.1 Connect GitHub Repository
- [ ] Go to Cloudflare dashboard → Pages
- [ ] Click "Create a project"
- [ ] Click "Connect to Git"
- [ ] Select your GitHub repository
- [ ] Authorize Cloudflare to access the repo

#### 4.2 Configure Build Settings
- [ ] **Project name:** veeam-data-cloud-services-map
- [ ] **Production branch:** main (or your default branch)
- [ ] **Framework preset:** Hugo
- [ ] **Build command:** `npm run build:data && hugo --gc --minify`
- [ ] **Build output directory:** `public`
- [ ] **Root directory:** `/` (leave blank)
- [ ] **Environment variables:**
  - `HUGO_VERSION` = `0.139.3` (check your version with `hugo version`)
  - `NODE_VERSION` = `18` (or your preferred version)

#### 4.3 Deploy
- [ ] Click "Save and Deploy"
- [ ] Wait for build to complete (~2-3 minutes)
- [ ] Pages will provide a URL: `https://veeam-data-cloud-services-map.pages.dev`

#### 4.4 Verify Deployment
- [ ] Check map loads at root URL
- [ ] Check API endpoints respond:
  - `curl https://veeam-data-cloud-services-map.pages.dev/api/v1/regions`
  - `curl https://veeam-data-cloud-services-map.pages.dev/api/v1/health`
- [ ] Check Swagger UI loads at `/api/docs/`
- [ ] Test API queries from Swagger UI
- [ ] Verify data accuracy (spot check against GitHub Pages version)

#### 4.5 Monitor Deployment
- [ ] Check Functions logs in Cloudflare dashboard
- [ ] Verify no errors in build or runtime logs
- [ ] Note the deployment URL for documentation

### Phase 5: Custom Domain Setup (Optional)

**Estimated Time: 15 minutes + DNS propagation**

#### 5.1 Add Custom Domain in Pages
- [ ] In Cloudflare Pages project, go to "Custom domains"
- [ ] Click "Set up a custom domain"
- [ ] Enter your domain (e.g., `veeam-cloud-map.dev`)
- [ ] Follow DNS instructions provided

#### 5.2 Configure DNS
- [ ] Add CNAME record pointing to `<project>.pages.dev`
- [ ] Or add A/AAAA records if provided
- [ ] Wait for DNS propagation (~5-15 minutes)
- [ ] SSL certificate provisioned automatically

#### 5.3 Verify and Update
- [ ] Test custom domain loads correctly
- [ ] Verify HTTPS works (automatic SSL)
- [ ] Update README with production URL
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

#### 6.4 Verify Automated Deployment
- [ ] Cloudflare Pages automatically deploys on git push to main
- [ ] Test by making a small change and pushing
- [ ] Verify build triggers in Pages dashboard
- [ ] Check deployment completes successfully
- [ ] Remove `.github/workflows/hugo.yml` (old GitHub Pages workflow)
- [ ] Keep `pr-validation.yml` if it exists
- [ ] Note: Pages also creates preview deployments for PRs automatically

### Phase 7: Monitoring & Polish

**Estimated Time: 30 minutes**

#### 7.1 Set Up Monitoring
- [ ] Review Pages Analytics in Cloudflare dashboard
- [ ] Monitor Functions logs: Pages → your-project → Functions
- [ ] Use `wrangler pages deployment tail` for real-time logs (optional)
- [ ] Enable Web Analytics for visitor tracking (optional)
- [ ] Set up Cloudflare Notifications for build failures (optional)

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
├── functions/
│   ├── _shared/
│   │   ├── data.js (region data loader)
│   │   ├── regions.json (generated from YAML)
│   │   └── response.js (CORS, error handling, JSON helpers)
│   └── api/
│       └── v1/
│           ├── regions.js (GET /api/v1/regions)
│           ├── regions/
│           │   └── [id].js (GET /api/v1/regions/:id)
│           ├── services.js (GET /api/v1/services)
│           └── health.js (GET /api/v1/health)
├── public/
│   └── (Hugo build output - generated by build command)
│       ├── index.html (interactive map)
│       ├── api/
│       │   └── openapi.yaml
│       │   └── docs/
│       │       └── index.html (Swagger UI)
├── static/
│   ├── api/
│   │   └── openapi.yaml (OpenAPI specification)
│   │   └── docs/
│   │       └── index.html (Swagger UI)
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
│       └── pr-validation.yml (unchanged)
├── plans/
│   └── cloudflare-api-migration.md (this document)
├── API_CHANGELOG.md
├── wrangler.toml (Cloudflare Pages config - optional)
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

1. **Pages deployment issues:**
   - GitHub Pages remains active during migration
   - Simply don't update DNS/links until Pages is verified
   - No downtime risk

2. **Function errors:**
   - Static site continues to work (Hugo site)
   - Functions can be debugged/fixed in `functions/`
   - Push fixes to trigger automatic redeployment
   - Use Pages deployment history to rollback if needed

3. **Complete rollback:**
   - Revert DNS changes (if custom domain used)
   - Delete Cloudflare Pages project
   - Continue using GitHub Pages
   - Keep Functions code for future retry

## Success Criteria

- [ ] Map loads and functions identically to GitHub Pages version
- [ ] All API endpoints return correct data
- [ ] Swagger UI loads and allows testing
- [ ] CORS headers allow cross-origin requests
- [ ] API response time < 200ms (global average)
- [ ] Zero errors in Functions logs
- [ ] Pages Analytics shows successful requests
- [ ] README documents API usage
- [ ] At least 3 example use cases provided

## Cost Analysis

**Cloudflare Pages Free Tier:**
- 500 builds/month
- Unlimited requests
- Unlimited bandwidth
- 100,000 Functions requests/day
- Built-in DDoS protection
- Global CDN (300+ locations)
- Automatic preview deployments

**Expected usage (conservative):**
- ~30 builds/month (assuming daily updates)
- ~1000 API requests/day (Functions)
- ~500 map page views/day (static)
- Well within free tier

**Paid tier (Pages Pro - $20/month, if needed):**
- Concurrent builds
- Advanced collaborator seats
- Analytics
- Priority support

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
| Phase 2: Functions Implementation | 2-3 hours | Phase 1 complete |
| Phase 3: Local Testing | 1 hour | Phase 2 complete |
| Phase 4: Pages Deployment | 30 min | Phase 3 passing |
| Phase 5: Custom Domain (optional) | 15 min + propagation | Phase 4 verified |
| Phase 6: Documentation | 1 hour | Phase 4 complete |
| Phase 7: Polish | 30 min | Phase 6 complete |

**Total Estimated Time: 6-8 hours** (can be done over a weekend)

## Questions to Answer Before Starting

1. Do you want to use a custom domain, or use `.pages.dev` subdomain?
2. Should API responses be cached by CDN, or always fresh?
3. Do you need rate limiting on the API?
4. Should there be usage analytics/tracking for API calls? (Pages Analytics available)
5. Do you want API versioning in URLs (`/v1/`, `/v2/`) or headers? (Plan uses URL versioning)
6. Pages auto-deploys from GitHub - is this acceptable, or do you need manual control?

## References

- [Cloudflare Pages Documentation](https://developers.cloudflare.com/pages/)
- [Pages Functions](https://developers.cloudflare.com/pages/functions/)
- [Wrangler CLI Documentation](https://developers.cloudflare.com/workers/wrangler/)
- [OpenAPI 3.0 Specification](https://swagger.io/specification/)
- [Swagger UI Documentation](https://swagger.io/tools/swagger-ui/)
- [Hugo Documentation](https://gohugo.io/documentation/)
