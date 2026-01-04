# Cloudflare Pages Deployment Guide

## Build Settings

Configure these in your Cloudflare Pages dashboard (Settings > Builds & deployments):

### Framework preset
- **Framework preset:** None

### Build settings
- **Build command:** `npm run build`
- **Build output directory:** `public`
- **Root directory:** `/` (or leave blank)

### Environment variables
Add under Settings > Environment variables > Production:

| Variable | Value |
|----------|-------|
| `HUGO_VERSION` | `0.139.3` |
| `NODE_VERSION` | `18` |

## How the Build Works

1. `npm install` - Installs dependencies (Hono, Zod, TypeScript, etc.)
2. `npm run build` executes:
   - `npm run build:data` → Runs `scripts/build-api-data.js` → Generates `functions/regions.json`
   - `npm run build:worker` → Compiles TypeScript to `functions/_worker.js` (Hono app)
   - `hugo --gc --minify` → Generates static site in `public/`
3. Cloudflare Pages deploys:
   - Static files from `public/` (the Hugo site)
   - Functions from `functions/` (the Hono API worker)

## Expected File Structure After Build

```
public/               # Hugo static site
├── index.html
├── llms.txt
├── llms-full.txt
└── ...

functions/            # Cloudflare Pages Functions
├── regions.json      # Generated region data (loaded by worker)
├── _worker.js        # Compiled Hono application (all API routes)
└── [[path]].js       # Catch-all route handler

src/functions/        # TypeScript source (not deployed)
├── _worker.ts        # Main Hono app
├── routes/           # API route handlers
├── schemas/          # Zod schemas with OpenAPI metadata
├── types/            # TypeScript type definitions
└── utils/            # Helper functions
```

## API Endpoints

Once deployed, these endpoints should work:

- `GET /api/v1/health` - Health check
- `GET /api/v1/ping` - Connectivity test
- `GET /api/v1/regions` - List all regions
- `GET /api/v1/regions/{id}` - Get specific region
- `GET /api/v1/services` - List services
- `GET /api/docs` - Scalar API Reference (interactive docs)
- `GET /api/openapi.json` - OpenAPI specification

## Troubleshooting

### API returns HTML instead of JSON

**Symptom:** Accessing `/api/v1/regions` returns the Hugo site HTML

**Causes:**
1. Build command not set to `npm run build`
2. Functions directory not included in deployment
3. `functions/regions.json` not generated during build

**Solution:**
1. Check build logs in Cloudflare Pages dashboard
2. Verify `npm run build:data` executes successfully
3. Confirm both `public/` and `functions/` exist after build
4. Re-deploy the site

### Build fails

**Check:**
- Node.js version is 18 or higher
- Hugo version is set correctly
- All dependencies install successfully
- `data/regions/*.yaml` files exist

### Functions not deploying

**Verify:**
- `functions/` directory exists at root level (not inside `public/`)
- Function files have correct exports (`export async function onRequestGet`)
- `regions.json` exists in `functions/` after build

## Testing Locally

Before deploying, test locally:

```bash
# Build the data and site
npm run build

# Verify functions directory
ls -la functions/

# Test with Wrangler (optional)
npm run dev
```

## Next Steps

After configuring the build settings:

1. Trigger a new deployment (Settings > Builds & deployments > Retry deployment)
2. Check build logs for any errors
3. Verify `/api/v1/health` returns JSON (not HTML)
4. Test other API endpoints
5. Check `/api/docs` for Scalar API Reference UI
6. Verify `/api/openapi.json` generates valid OpenAPI spec
