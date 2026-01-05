# Flow Spec: Nearest Region Discovery API

## Entry Point

Caller has coordinates (`lat`, `lng`) for a user/site and needs the closest eligible cloud region.

## Primary User Flow (Happy Path)

1. Caller gathers inputs
   - `lat`, `lng` (required)
   - optional constraints: `provider`, `service`
   - optional `limit` (`0` means unlimited)
   - optional `tier`/`edition` (only when `service=vdc_vault`)

2. Caller makes request
   - `GET /api/v1/regions/nearest?lat={lat}&lng={lng}&limit={n}&provider={provider}&service={service}`

3. API validates
   - Validates numeric ranges for `lat` and `lng`
   - Validates `provider` against allowed values (`AWS`, `Azure`, case-sensitive; consistent with `/api/v1/regions`)
   - Validates `service` against the known service ID set; unknown values return `400`
   - Enforces `limit` default + max (except `limit=0`, which returns all matching regions)
   - Enforces `tier`/`edition` only when `service=vdc_vault` (otherwise `400`)

4. API computes nearest results
   - Computes great-circle distance from query point to each region
   - Sorts ascending distance; tie-break by `region.id`
   - Returns first `limit` results

5. Caller selects a region
   - Typical automation chooses `results[0]` (nearest eligible)
   - Some tools may present the list to a human for final selection

## Response Shape (DX Expectations)

- Response includes an echo of the request (`query`) for easier debugging.
- Each result contains:
  - `region` object in the same shape used by other endpoints
  - `distance.km` and `distance.miles`
- Distances are consistently rounded (recommendation: 2 decimal places).

## Exit Points

- **Success**: HTTP 200 with `results[]` and `count`
- **Empty results**: HTTP 200 with `results: []` and `count: 0` (valid when filters eliminate all regions)
- **Invalid request**: HTTP 400 with clear error detail

## Error Handling Requirements (Developer Experience)

Errors should be specific and actionable, because they occur inside automation:

- Missing or non-numeric `lat`/`lng` → 400 (explain required params and valid ranges)
- Out-of-range `lat`/`lng` → 400 (include the range that failed)
- `provider` not recognized → 400 (state allowed values)
- Unknown `service` → 400 (state allowed service IDs)
- `tier` or `edition` provided while `service` is not `vdc_vault` → 400 (explain valid combination)
- `limit` invalid → 400 (explain default, max, and that `0` means unlimited)

## Design Principles

- **Predictability over cleverness**: deterministic ordering and consistent rounding.
- **Consistency with existing endpoints**: enums, naming, and schemas align with `/api/v1/regions`.
- **Automation-friendly**: stable output shape, clear error messages, and safe defaults.
- **Minimal client logic**: clients shouldn’t reimplement filtering/validation rules.

## Accessibility-equivalent Requirements (API DX)

This endpoint is primarily used by scripts and tooling; the “accessibility” analogue is reliable machine-consumable behavior:

- Errors are structured and consistent (don’t require string parsing to branch on failure mode).
- All optional filters have documented defaults and constraints.
- Tie-break and rounding rules are documented to avoid flaky tests.
