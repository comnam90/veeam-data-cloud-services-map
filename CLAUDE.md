# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Interactive map + REST API for visualizing Veeam Data Cloud (VDC) service availability across AWS and Azure regions. Deployed on Cloudflare Pages (static Hugo frontend + Hono API on Workers).

## Common Commands

```bash
# Development
npm run dev              # API + already-built public/ at http://localhost:8788 via wrangler.
                         # Does NOT rebuild Hugo — run `npm run build` first if public/ is stale.
hugo server              # Frontend hot reload at http://localhost:1313 (no API)

# Build
npm run build            # Full production build: build:data → build:worker → typecheck → hugo
npm run build:data       # Convert YAML → functions/regions.json
npm run build:worker     # Compile TypeScript → functions/_worker.js (esbuild)
npm run typecheck        # tsc --noEmit (strict validation)

# Testing
npm run test             # All tests: validate + scraper + API
                         # `pretest` hook auto-runs build:data + build:worker first
npm run test:api         # API integration tests (require server already running)
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
data/regions/{aws,azure}/*.yaml   ← Source of truth for region data
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
- **Single-file SPA:** `layouts/index.html` (~1665 lines) — Leaflet map, search, filters
- **Hugo** injects YAML data as a `regions[]` JavaScript array at build time — no runtime data fetching
- Leaflet.js with CartoDB Dark Matter tiles; uses marker clustering for dense regions
- **UI edit hotspots:** `getServiceIcon()` (inline SVGs per service), `getProviderBadgeColor()` (Tailwind classes per provider), and the `serviceDisplayNames` object — search for these when changing service rendering

### API (Cloudflare Workers)
- Entry point: `src/functions/_worker.ts` — Hono app with middleware + route registration
- Routes: `src/functions/routes/v1/` — 8 endpoints:
  - `ping.ts`, `health.ts`
  - `services.ts`, `services-by-id.ts`
  - `regions.ts`, `regions-by-id.ts`, `regions-nearest.ts`, `regions-compare.ts`
- Schemas: `src/functions/schemas/common.ts` — Zod + `@hono/zod-openapi` for automatic OpenAPI 3.1 spec
- Utils: `src/functions/utils/` — `data.ts` (loads `regions.json` and provides stats helpers), `geo.ts` (haversine distance for `regions-nearest`), `response.ts`, `validation.ts`
- Types: `src/functions/types/` — `env.ts` (`Env` interface) and `data.ts` (`Region`, `Service`, `VdcVaultConfig`, etc.)
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

## Branching & Commits

This project uses **Gitflow**. See `GITFLOW_RELEASE_GUIDE.md` for the full release process.

| Branch | Purpose |
|--------|---------|
| `main` | Production only — never commit directly |
| `develop` | Integration branch — PRs target here by default |
| `feature/*` | New features, branched from `develop` |
| `release/X.Y.Z` | Release prep, branched from `develop`, merged to `main` then back to `develop` |
| `chore/*`, `fix/*`, etc. | Other work types, branched from `develop` |

All commits must follow **Conventional Commits**:

```
<type>(<scope>): <description>

Types: feat, fix, docs, test, chore, refactor, perf, ci, style
Examples:
  feat(api): add region clustering endpoint
  fix(ui): correct marker position on mobile Safari
  chore(release): bump version to 1.3.0
```

## Development Principles

New code in this project should follow these principles, even where existing code does not:

- **TDD**: Write tests before implementation. For API endpoints, write integration tests in `scripts/test-api.js` first. For UI behaviour, write Playwright tests in `tests/ui.spec.ts` first.
- **DRY**: Extract shared logic to `src/functions/utils/`. Shared Zod schemas belong in `src/functions/schemas/common.ts`.
- **SOLID**: Each route file owns one endpoint. Keep handlers thin — push business logic to utils. Don't modify existing route files to add new behaviour; add new files.
- **KISS**: Prefer explicit, readable code over clever abstractions. The API is stateless and data is static — don't over-engineer.

## LLM Documentation

`static/llms.txt` and `static/llms-full.txt` are API docs optimized for AI consumption. Keep these synchronized with endpoint changes.

## CI/CD

Four GitHub Actions workflows:
- `validate-data.yml` — Validates YAML on push/PR to `data/regions/`
- `pr-validation.yml` — Full validation suite on PRs
- `hugo.yml` — Legacy GitHub Pages backup
- `region-maintenance.yml` — Weekly scraper (Mondays 9 AM UTC) that creates GitHub issues for data discrepancies

Cloudflare Pages build expects `HUGO_VERSION=0.139.3` and `NODE_VERSION=18` (see `DEPLOYMENT.md`).

## Further Reading

Repo-internal docs to check before re-deriving things:

- `ARCHITECTURE.md` — request flow, middleware stack, OpenAPI generation details, error code enum
- `DEPLOYMENT.md` — Cloudflare Pages build config, troubleshooting (API returning HTML, build failures)
- `TESTING.md` — manual test cases for `/api/v1/services*` endpoints
- `GITFLOW_RELEASE_GUIDE.md` — release branch process and version bumping
- `.github/copilot-instructions.md` — overlapping guidance with concrete UI/route code examples
- `.github/instructions/self-explanatory-code-commenting.instructions.md` — project comment-style rules (comment WHY, not WHAT)
