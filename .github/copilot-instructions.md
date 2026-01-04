# Copilot Instructions for Veeam Cloud Service Map

## Project Overview
Interactive map + REST API for Veeam Data Cloud (VDC) service availability across AWS/Azure regions. Both hosted on **Cloudflare Pages** at `vdcmap.bcthomas.com`.

## Architecture (Single Deployment, Two Build Outputs)

```
data/regions/*.yaml  ─┬─▶  Hugo template   ─▶  public/index.html  ─┬─▶  Cloudflare Pages
                      │                                            │    (vdcmap.bcthomas.com)
                      └─▶  build:data      ─▶  functions/regions.json
                           build:worker    ─▶  functions/_worker.js ─┘
```

- **Hugo frontend**: `layouts/index.html` is a single-file SPA (HTML + Tailwind + Leaflet.js). Hugo injects YAML data as a JavaScript `regions[]` array at build time.
- **Hono API**: TypeScript in `src/functions/` → compiled to `functions/_worker.js` → runs on Cloudflare Workers. Auto-generates OpenAPI spec at `/api/openapi.json`.

## Development Commands

```bash
# Frontend only (Hugo dev server)
hugo server                    # http://localhost:1313 with hot reload

# Full stack (API + frontend)
npm run dev                    # Runs wrangler pages dev (includes API)

# Build everything
npm run build                  # build:data → build:worker → typecheck → hugo

# Individual build steps
npm run build:data             # YAML → functions/regions.json
npm run build:worker           # TypeScript → functions/_worker.js
npm run typecheck              # tsc --noEmit (validates types)
npm run test                   # Runs API integration tests
```

## Adding New Regions (Most Common Task)

Create file: `data/regions/{aws|azure}/{provider}_{region_code}.yaml`

```yaml
id: "aws-us-east-1"              # Unique, lowercase, hyphenated
name: "US East 1 (N. Virginia)"  # Display name
provider: "AWS"                  # Case-sensitive: "AWS" or "Azure" ONLY
coords: [38.9, -77.4]            # [lat, lng] as array, NOT string
aliases:                         # Optional: searchable alternative names
  - "Virginia"
  - "US East"
services:
  vdc_vault:                     # Tiered service: array of {edition, tier}
    - edition: "Foundation"      # "Foundation" or "Advanced"
      tier: "Core"               # "Core" or "Non-Core"
    - edition: "Advanced"
      tier: "Core"
  vdc_m365: true                 # Boolean services: just true if available
```

### Service Keys Reference
| Key | Type | Notes |
|-----|------|-------|
| `vdc_vault` | Array of `{edition, tier}` | Tiered pricing per region |
| `vdc_m365` | Boolean | Microsoft 365 backup |
| `vdc_entra_id` | Boolean | Entra ID protection |
| `vdc_salesforce` | Boolean | Salesforce backup |
| `vdc_azure_backup` | Boolean | Azure backup |

### Critical Data Conventions
- Provider is **case-sensitive**: `"AWS"` or `"Azure"` exactly
- Coords must be array `[lat, lng]`, not string `"[lat, lng]"`
- Boolean services: use `true`, not `"true"`

## API Development

### Route Pattern (Hono + Zod OpenAPI)
Routes in `src/functions/routes/v1/*.ts` follow this structure:

```typescript
// 1. Define Zod schema with OpenAPI metadata
const MyResponseSchema = z.object({
  data: z.string().openapi({ description: '...', example: '...' })
}).openapi('MyResponse')

// 2. Create route with full OpenAPI spec
const myRoute = createRoute({
  method: 'get',
  path: '/api/v1/my-endpoint',
  summary: 'Short description',
  tags: ['TagName'],
  responses: { 200: { content: { 'application/json': { schema: MyResponseSchema } } } }
})

// 3. Register with handler
export function registerMyRoute(app: OpenAPIHono<{ Bindings: Env }>) {
  app.openapi(myRoute, (c) => c.json({ data: 'value' }))
}
```

Then register in `src/functions/_worker.ts`:
```typescript
import { registerMyRoute } from './routes/v1/my-endpoint'
registerMyRoute(app)
```

### Key API Files
- `src/functions/_worker.ts` - Main Hono app, middleware, route registration
- `src/functions/schemas/common.ts` - Shared Zod schemas with OpenAPI docs
- `src/functions/utils/data.ts` - Data access helpers (loads `regions.json`)
- `src/functions/types/` - TypeScript interfaces (`Env`, `Region`, etc.)

## Modifying the Map UI

All UI code in `layouts/index.html` (1500+ lines):
- **Service icons**: `getServiceIcon()` (~line 884) - inline SVGs keyed by service name
- **Provider colors**: `getProviderBadgeColor()` (~line 895) - returns Tailwind classes
- **Service display names**: `serviceDisplayNames` object (~line 901)
- **Map tiles**: CartoDB Dark Matter; change `L.tileLayer` URL for different theme

### Adding a New Service Type
1. Add YAML entries under new key in region files
2. Add icon SVG to `getServiceIcon()` in `layouts/index.html`
3. Add entry to `serviceDisplayNames` object
4. Add to filter dropdown (`#serviceFilter`)
5. Update Zod schemas in `src/functions/schemas/common.ts`
6. Update route query param enums in `src/functions/routes/v1/regions.ts`

## Testing

```bash
npm run test                   # Preferred way to run API integration tests
```

Tests live in `scripts/test-api.js`. When adding new endpoints or modifying API behavior, extend this file to maintain test coverage.

## Deployment

Both map and API deploy to **Cloudflare Pages** at `vdcmap.bcthomas.com`:
- **Preview**: Automatic on pull requests
- **Production**: Automatic on commits to `main`
- **Config**: `wrangler.toml` + Cloudflare Pages dashboard

GitHub Pages workflow (`.github/workflows/hugo.yml`) exists for legacy URL support only.

## File Structure

```
data/regions/{aws,azure}/*.yaml  # Source of truth for all region data
src/functions/                   # TypeScript API source
  _worker.ts                     # Hono app entry point
  routes/v1/*.ts                 # API endpoints
  schemas/common.ts              # Zod schemas with OpenAPI metadata
  types/, utils/                 # Supporting code
functions/                       # Build output (git-ignored except regions.json)
layouts/index.html               # Single-file Hugo template (map UI)
scripts/                         # Build scripts and tests
static/                          # Static files copied to public/
  llms.txt                       # Concise API summary for LLM consumption
  llms-full.txt                  # Full API documentation for LLMs
  api/openapi.yaml               # Static OpenAPI spec (backup)
```

### LLM Documentation Files
`static/llms.txt` and `static/llms-full.txt` provide API documentation optimized for LLM agents. **Keep these updated** when adding endpoints or changing API behavior—they're consumed by AI tools discovering the API.

## Keeping Instructions Current
When adding new service keys, update: this file, `README.md`, `schemas/common.ts`, route enums, and `static/llms*.txt` files.
