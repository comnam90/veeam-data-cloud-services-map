# ADR-002: Strict Tier/Edition Validation for Regions Filters

**Status**: Proposed

## Context

The tier/edition parameters are only meaningful for the tiered service `vdc_vault`. Allowing `tier`/`edition` alongside other services (or with no `service`) creates ambiguous requests and can silently produce unfiltered results.

We are defining strict semantics for `tier` and `edition` across region endpoints to support automation-first usage.

## Decision Drivers

- Prevent silent misconfiguration in CI/CD and scripts.
- Keep validation rules consistent between `/api/v1/regions` and `/api/v1/regions/nearest`.
- Ensure error handling is structured and machine-actionable.

## Decision

For endpoints that accept region filters (currently `/api/v1/regions`, and the planned `/api/v1/regions/nearest`):

- If `tier` or `edition` are provided and `service` is missing or not `vdc_vault`, return `400`.
- If `service=vdc_vault`, `tier` and/or `edition` may be provided to further filter results.
- Error responses should use the API’s standard structured format (e.g., `ErrorResponseSchema` / `INVALID_PARAMETER`).

## Options Considered

### Option A: Ignore `tier`/`edition` unless `service=vdc_vault`

- Pros: Backward-compatible.
- Cons: Silent no-op behavior; harder debugging in automation.

### Option B: Return `400` for invalid combinations (chosen)

- Pros: Fails fast; avoids ambiguous behavior.
- Cons: May break permissive clients that currently pass these params unintentionally.

## Consequences

- Existing clients that send `tier`/`edition` without `service=vdc_vault` will receive a `400` and must be updated.
- Documentation and OpenAPI must explicitly describe this rule to avoid surprises.

## Links

- [Issue #16](https://github.com/comnam90/veeam-data-cloud-services-map/issues/16)
- [Issue #13](https://github.com/comnam90/veeam-data-cloud-services-map/issues/13)
