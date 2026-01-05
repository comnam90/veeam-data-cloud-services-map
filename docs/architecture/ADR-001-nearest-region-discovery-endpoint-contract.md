# ADR-001: Nearest Region Discovery Endpoint Contract

**Status**: Accepted

## Context

We are adding `GET /api/v1/regions/nearest` to return the closest cloud regions to a provided latitude/longitude, optionally filtered by provider and service availability.

This API is primarily consumed by automation (CI/CD, scripts, platform tooling). That makes deterministic output, strict validation, and stable response shapes more important than “helpful” heuristics.

## Decision Drivers

- Keep endpoint behavior consistent with existing `/api/v1/regions` enum validation.
- Prefer strict, machine-actionable validation errors over permissive behavior that can hide mistakes.
- Provide predictable output for tests and automation.
- Keep the contract simple enough to implement and operate on the edge runtime.

## Decisions

### 1) `provider` query is case-sensitive

- `provider` must be exactly `AWS` or `Azure`.
- Invalid values return `400` with a structured error and allowed values.

Rationale: This matches the existing schema enum usage in `/api/v1/regions` and avoids inconsistent casing rules across endpoints.

### 2) `limit=0` means “unlimited”

- Default `limit` is `5`.
- For `limit > 0`, cap at `20`.
- For `limit=0`, return **all matching regions** (after applying optional filters), sorted by distance.

Rationale: Callers sometimes need the full ordered list without implementing pagination; `limit=0` is an explicit opt-in.

### 3) Deterministic ordering is required

- Sort by ascending great-circle distance.
- Tie-break by `region.id`.

Rationale: Prevents flaky automation/tests when distances are equal or extremely close.

### 4) Tiered service filtering rules

- `tier` and `edition` are only valid when `service=vdc_vault`.
- If `tier` or `edition` are provided with any other `service` (or without `service`), return `400`.
- If `service=vdc_vault` and `tier`/`edition` are omitted, treat as “any vault availability”.

Rationale: Prevents silent no-op filters and keeps the API contract unambiguous.

## Options Considered

### Option A: Case-insensitive provider normalization

- Pros: More forgiving for humans.
- Cons: Inconsistent with `/api/v1/regions`; adds hidden normalization rules that clients may copy incorrectly.

### Option B: Always cap results (no unlimited)

- Pros: Hard ceiling on response size.
- Cons: Forces clients to refetch or implement pagination even when they need the full ordering.

### Option C: Ignore invalid tier/edition combos

- Pros: Backward-compatible and permissive.
- Cons: Hides errors in automation; increases time-to-debug.

## Consequences

- Clients must send exact provider casing (`AWS`/`Azure`).
- Some existing “loose” client behavior (e.g., `provider=aws`) will fail fast with actionable `400` errors.
- `limit=0` can return larger responses; this should be acceptable given the dataset size and the explicit opt-in.

## Links

- [Issue #13](https://github.com/comnam90/veeam-data-cloud-services-map/issues/13)
