# Nearest Region Discovery (API) — JTBD

## Assumed Users

- **Primary**: SRE / DevOps / Platform Engineer writing automation (CLI/scripts/pipelines) to select a VDC region.
- **Secondary**: Application developer integrating region selection into an app backend.

## Job Statement

When I’m automating deployments or data-placement decisions for a user or site with known coordinates, I want a single API call that returns the nearest supported cloud regions (optionally filtered by provider and service constraints), so I can choose a compliant/available region without downloading the full dataset or reimplementing distance logic.

## Context & Triggers

- Choosing a region during **pipeline execution** (CI/CD), **bootstrap scripts**, or **runtime provisioning**.
- Evaluating “closest region that supports service X” for latency-sensitive or compliance-sensitive workflows.
- Maintaining a downstream tool that should be resilient to region list changes over time.

## Current Solution (Incumbent)

- Call `GET /api/v1/regions`, download all regions, compute distances client-side, then filter by provider/service.

## Pain Points

- Duplicate client implementations of great-circle distance and filtering logic.
- More bandwidth and client parsing work than needed.
- Higher integration friction: every consumer has to learn dataset shape and edge cases.
- Easy to create inconsistent behaviors across clients (rounding, sorting, validation).

## Desired Outcomes / Success

- **Reduce integration to one call** (`/regions/nearest`) with stable, deterministic results.
- **Predictable validation**: clear 400s for invalid inputs and unknown enums.
- **Deterministic ordering**: stable tie-break behavior suitable for tests and automation.
- **Usable output**: include distance in both km and miles, consistently rounded.

## Constraints & Assumptions (confirm if needed)

- Callers can supply coordinates; **IP geolocation is out of scope**.
- Dataset size remains small enough for compute-all + sort.
- **Provider query input is case-sensitive** and must be `AWS` or `Azure` (consistent with `/api/v1/regions`).
- `service` query is constrained to known service IDs; unknown values return `400`.
- `limit=0` is treated as unlimited (returns all matching regions).

## Key “Moments That Matter” (Developer Experience)

- First-time discovery: API docs clearly show how to call and filter.
- First successful request: caller sees stable output shape and useful distances.
- First failure: error message explains what to fix (e.g., unknown `service`, invalid `lat/lng`).
- Maintenance: behavior stays consistent as new regions/services are added.
