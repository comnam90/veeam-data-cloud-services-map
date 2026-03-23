# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Interactive map + REST API for visualizing Veeam Data Cloud (VDC) service availability across AWS and Azure regions. Deployed on Cloudflare Pages (static Hugo frontend + Hono API on Workers).

## Common Commands

```bash
# Development
npm run dev              # Full stack dev server at http://localhost:8788 (Hugo + API via wrangler)
hugo server              # Frontend only at http://localhost:1313

# Build
npm run build            # Full production build: build:data → build:worker → typecheck → hugo
npm run build:data       # Convert YAML → functions/regions.json
npm run build:worker     # Compile TypeScript → functions/_worker.js (esbuild)
npm run typecheck        # tsc --noEmit (strict validation)

# Testing
npm run test             # All tests: validate + scraper + API
npm run test:api         # API integration tests
npm run test:validate    # YAML validation tests
npm run test:ui          # Playwright UI tests (headless)
npm run test:ui:headed   # Playwright with browser UI
npm run test:ui:debug    # Playwright debug mode
npm run test:ui:report   # View Playwright HTML report

# Data
npm run validate         # Validate region YAML files
npm run scrape:regions   # Scrape Veeam docs for service availability data
npm run clean            # Remove build artifacts
```

## Architecture

### Data Flow

```
data/regions/{aws,azure}/*.yaml   ← Source of truth (63 regions)
          ↓
   build:data script
          ↓
  functions/regions.json           ← Loaded by Hono API at runtime
          ↓
  Hugo template injection          ← Also embedded as JS in frontend HTML
          ↓
  Cloudflare Pages deployment
```

### Frontend
- **Single-file SPA:** `layouts/index.html` (~1600 lines) — Leaflet map, search, filters
- **Hugo** injects YAML data as a `regions[]` JavaScript array at build time — no runtime data fetching
- Leaflet.js with CartoDB Dark Matter tiles; uses marker clustering for dense regions

### API (Cloudflare Workers)
- Entry point: `src/functions/_worker.ts` — Hono app with middleware + route registration
- Routes: `src/functions/routes/v1/` — 8 endpoints (ping, health, services, regions, nearest, compare, etc.)
- Schemas: `src/functions/schemas/common.ts` — Zod + `@hono/zod-openapi` for automatic OpenAPI 3.1 spec
- OpenAPI UI available at `/api/docs` (Scalar); spec at `/api/openapi.json`

### Middleware Stack
Applied globally: `secureHeaders()` → `cors()` → custom `X-API-Version` header → `Cache-Control: public, max-age=3600`

### Error Response Format
```json
{
  "error": "Short message",
  "code": "ERROR_CODE_ENUM",
  "message": "Detailed explanation",
  "parameter": "fieldName",
  "value": "invalidValue",
  "allowedValues": ["valid", "values"]
}
```
Errors are standardized via Hono's `defaultHook` intercepting Zod validation failures.

## Data Conventions

These are strict — validation will fail otherwise:

- **Provider**: `"AWS"` or `"Azure"` exactly (case-sensitive)
- **Coordinates**: Array `[lat, lng]` — not a string
- **Boolean services**: `true` — not `"true"`
- **Service IDs**: `vdc_vault`, `vdc_m365`, `vdc_entra_id`, `vdc_salesforce`, `vdc_azure_backup`
- **Region IDs**: lowercase hyphenated (e.g., `aws-us-east-1`)
- **Vault editions**: `"Foundation"`, `"Advanced"`
- **Vault tiers**: `"Core"`, `"Non-Core"`
- **`vdc_vault`** is tiered (array of `{edition, tier}` objects); all other services are boolean

## Testing Notes

- Playwright tests cover 5 targets: Chromium, Firefox, WebKit, Mobile Chrome (Pixel 7), Mobile Safari (iPhone 15 Pro)
- Some tests are skipped for WebKit due to Leaflet instability on Linux CI
- API tests are Node.js integration tests in `scripts/test-api.js` — require a running server
- Data validation runs automatically on push/PR to `data/regions/`

## Adding Things

**New region:** Copy `.github/region-template.yaml` → `data/regions/{aws|azure}/{provider}_{region_code}.yaml` → run `npm run validate` → `npm run build`

**New API endpoint:**
1. Create `src/functions/routes/v1/{name}.ts` with Zod schema, `createRoute()`, and handler
2. Export `register{Name}Route()`
3. Register in `src/functions/_worker.ts`
4. Run `npm run typecheck`

**New service type:** Update YAML files, `layouts/index.html` (icon, display name, filter dropdown), Zod schemas in `src/functions/schemas/common.ts`, route enums in `regions.ts`, and `static/llms*.txt`

## LLM Documentation

`static/llms.txt` and `static/llms-full.txt` are API docs optimized for AI consumption. Keep these synchronized with endpoint changes.

## CI/CD

Four GitHub Actions workflows:
- `validate-data.yml` — Validates YAML on push/PR to `data/regions/`
- `pr-validation.yml` — Full validation suite on PRs
- `hugo.yml` — Legacy GitHub Pages backup
- `region-maintenance.yml` — Weekly scraper (Mondays 9 AM UTC) that creates GitHub issues for data discrepancies
