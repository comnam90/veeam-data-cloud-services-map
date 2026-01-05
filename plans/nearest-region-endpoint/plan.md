# Nearest Region Discovery API Endpoint

**Branch:** `feature/nearest-region-endpoint`  
**Description:** Add `GET /api/v1/regions/nearest` endpoint that returns the N closest cloud regions to a given lat/lng with optional filters

## Goal

Enable users and LLM agents to programmatically discover the closest Veeam Data Cloud regions to any geographic location, supporting service/provider filtering for infrastructure planning and disaster recovery scenarios.

## Implementation Steps

### Step 1: Create Haversine Distance Utility

**Files:** `src/functions/utils/geo.ts`

**What:** Implement a Haversine formula utility function that calculates great-circle distance between two lat/lng coordinates. Returns distance in kilometers (convert to miles in the response layer). Include input validation for coordinate ranges.

**Testing:** Unit test with known distances (e.g., Tokyo to Sydney ≈ 7,820 km)

### Step 2: Create Nearest Region Route Handler

**Files:** `src/functions/routes/v1/regions-nearest.ts`, `src/functions/_worker.ts`

**What:**

- Define Zod schemas for query params (`lat`, `lng`, `limit`, `provider`, `service`, `tier`, `edition`) with OpenAPI metadata
- Define response schema matching the contract from ADR-001
- Implement route handler that:
  1. Validates tier/edition requires `service=vdc_vault` (400 if not)
  2. Filters regions by provider/service/tier/edition
  3. Calculates distances using Haversine
  4. Sorts by distance ascending, tie-breaks by region.id
  5. Applies limit (default 5, max 20, 0=unlimited)
- Register route in `_worker.ts` **before** `/api/v1/regions/:id` to avoid `nearest` being captured as ID

**Testing:**

- `GET /api/v1/regions/nearest?lat=35.6762&lng=139.6503` returns Tokyo first
- `GET /api/v1/regions/nearest?lat=0&lng=0&limit=0` returns all regions
- `GET /api/v1/regions/nearest?lat=51.5&lng=-0.1&provider=Azure` filters correctly

### Step 3: Add Error Handling and Validation Tests

**Files:** `scripts/test-api.js`

**What:** Add comprehensive API integration tests covering:

- Missing required params (`lat`, `lng`) → 400
- Invalid coordinate ranges (lat > 90, lng > 180) → 400
- Invalid filter combos (tier without service=vdc_vault) → 400
- Valid requests with various filter combinations
- Deterministic ordering verification
- Limit edge cases (0, 1, 20, >20)

**Testing:** Run `npm run test` to verify all new test cases pass

### Step 4: Update Documentation

**Files:** `static/llms.txt`, `static/llms-full.txt`, `static/api/openapi.yaml`

**What:**

- Add endpoint documentation to LLM reference files
- Export updated OpenAPI spec (auto-generated at `/api/openapi.json`, copy to static for backup)
- Include example requests and response shapes

**Testing:** Verify `/api/openapi.json` includes new endpoint with correct schema

## Acceptance Criteria

From Issue #13:

- [ ] `GET /api/v1/regions/nearest?lat=35.6762&lng=139.6503` returns Tokyo first
- [ ] `limit` defaults to 5, caps at 20; `limit=0` returns all
- [ ] `provider` filter works correctly
- [ ] `service` filter works correctly
- [ ] Combined filters work (`provider` + `service`, `tier` + `edition`)
- [ ] Deterministic ordering for equal distances (tie-break by `region.id`)
- [ ] Invalid `lat`/`lng` returns `400`
- [ ] Invalid filter combo (`tier`/`edition` without `service=vdc_vault`) returns `400`
- [ ] OpenAPI spec updated
- [ ] API integration tests added
- [ ] LLM docs updated (`llms.txt`, `llms-full.txt`)

## Technical Notes

### Route Registration Order (Critical)

In `_worker.ts`, register `registerNearestRegionsRoute(app)` **before** `registerRegionByIdRoute(app)` to prevent `nearest` being matched as a region ID parameter.

### Response Shape (from ADR-001)

```json
{
  "query": {
    "lat": 35.6762,
    "lng": 139.6503,
    "limit": 3,
    "service": null,
    "provider": null,
    "tier": null,
    "edition": null
  },
  "results": [
    {
      "region": { "/* full Region object */" },
      "distance": { "km": 0.00, "miles": 0.00 }
    }
  ],
  "count": 1
}
```

### Validation Rules (from ADR-002)

- `tier` and `edition` are only valid when `service=vdc_vault`
- Provider is case-sensitive: `AWS` or `Azure` exactly
- Coordinate validation: lat ∈ [-90, 90], lng ∈ [-180, 180]
- All validation errors return HTTP `400`

### Haversine Formula

```text
a = sin²(Δlat/2) + cos(lat1) × cos(lat2) × sin²(Δlng/2)
c = 2 × atan2(√a, √(1−a))
d = R × c  // R = 6371 km
```

### Data Verification

Tokyo region (`aws-ap-northeast-1`) coordinates: `[35.6762, 139.2]` — confirmed as nearest to test coordinates `35.6762, 139.6503` (~40km difference in longitude).
