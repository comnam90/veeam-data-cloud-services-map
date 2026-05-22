# ADR-006: Cluster Marker Visual Treatment

**Status**: Accepted

## Context

PR #103 ([ADR-004](ADR-004-mission-control-aesthetic-and-design-tokens.md)) redesigned the individual region markers from `L.circleMarker` SVG paths to `L.divIcon` glyphs, and a follow-up upgraded them again to "Hybrid POI dots" — 28px white circles with a subtle border, soft drop shadow, and a brand SVG inside. The cluster bubbles, however, were still on the pre-redesign look: green/teal gradient backgrounds with a frosted ring, plus a 4px-tall blue/orange `.cluster-providers` strip beneath each cluster that visualised the AWS/Azure ratio inside. ADR-004 §Consequences explicitly flagged this as a known follow-up.

That left two problems: clusters and POI dots read as two different design languages on the same map; and the provider mix bars added decorative noise at world/continent zoom where buyers don't make per-provider decisions yet — they zoom in for that.

A first iteration aligned clusters with the POI dot surface entirely — same white background, subtle border, soft shadow. It shipped (commit `5450ddf`) and was rejected on first eyeball on two grounds: (a) on the Workstation (light) theme the white cluster washed out against the lightened tile palette; (b) cluster and individual marker became visually indistinguishable, destroying the at-a-glance signal that "this is a group, not one region." That iteration produced the principle this ADR records: matching the POI surface is wrong; the cluster must differentiate, in both themes, by design.

This ADR pins the visual-hierarchy principle and the resulting treatment so future contributors don't collapse the two primitives back together.

## Decision Drivers

- A cluster must read as "many" and a POI dot must read as "one" at a glance. They share map space; they cannot share surface.
- Both themes are first-class (per ADR-004). A cluster colour that works on dark tiles but vanishes on light tiles is a bug, not a styling preference.
- The token system (ADR-004) already binds `--accent` to "live / available / current selection". Clusters carry the same semantic — they are the aggregated population of available regions. Re-using `--accent` is consistent, not decorative.
- Provider mix at world/continent zoom is decorative; the per-region provider identity is already encoded in the POI dot's brand SVG and reached by zooming in.
- Cluster count is a real buyer signal — a 30-region cluster should physically read heavier than a 4-region one. Size tiers carry that signal in peripheral vision; the count number alone doesn't.

## Decision

### Inverted brand badge

`.cluster-marker` paints `var(--accent)` background, white count text, and a 2px white ring. The token auto-themes (`#00ff88` dark, `#00805a` light per ADR-004); white text + white ring read against both. Drop shadow is `0 2px 6px rgba(0, 0, 0, 0.35)` at rest, deepening to `0 4px 12px rgba(0, 0, 0, 0.45)` on hover — both stronger than the POI dot's `0 2px 6px rgba(0, 0, 0, 0.25)` so the cluster sits visually above an individual marker on the same tile.

Token contract follows ADR-004: the colour is read through the token, not declared as a hex. White (`#ffffff`) is the only literal — it is semantic (the "separator against the map" affordance, plus max-contrast count text), not branded.

A defensive `html.light .cluster-marker` override declares the same accent + white text + white ring explicitly. The override is not strictly required since `var(--accent)` already auto-themes; it exists as a cascade-anchor so a future light-mode adjustment cannot accidentally desaturate the cluster.

### Size tiers preserved

Three tiers stay — `.cluster-small` (36×36, 12px), `.cluster-medium` (44×44, 14px), `.cluster-large` (52×52, 16px) — keyed off `CLUSTER_SIZE_THRESHOLDS` (MEDIUM=5, LARGE=20). Three discrete sizes snap to recognisable "small / medium / large" categories in peripheral vision; a continuous size interpolation would be harder to compare across the map at a glance.

The Leaflet `iconSize` / `iconAnchor` stays at `L.point(52, 52)` / `L.point(26, 26)` uniformly across all tiers. The over-sized click target on small clusters is a deliberate touch-friendliness affordance and keeps the disbanding animation smooth at the breakpoint.

### Provider mix bars removed

The `.cluster-providers` / `.azure-bar` / `.aws-bar` CSS rules, the `PROVIDER_BAR` constant, and the per-cluster `markers.forEach(provider counting)` block are deleted together. The cluster icon is now a single accent badge with a count and a tier class — nothing else.

This is recorded as a deliberate non-feature: the AWS/Azure mix is intentionally NOT surfaced at cluster level. The per-region provider identity is reached by zooming past `CLUSTER_CONFIG.DISABLE_AT_ZOOM` (currently 6), where the POI dots' brand SVGs carry the signal.

## Options Considered

### Option A: Keep clusters on the pre-redesign green-gradient look

- Pros: Zero change; familiar to anyone who'd already seen the prior UI.
- Cons: Two design languages on the same map; provider strips still add noise at world zoom; leaves ADR-004:77's flagged follow-up unresolved.

### Option B: Match clusters to the POI-dot surface (white + subtle border + soft shadow)

- Pros: Single visual language; cleanest at first glance on dark tiles.
- Cons: Washes out on the Workstation light theme; collapses the cluster/marker visual hierarchy — a user can no longer tell at a glance whether they're looking at one region or many. Shipped briefly as commit `5450ddf` and rejected on empirical review.

### Option C: Per-provider cluster colouring using `--azure` + `--aws`

- Pros: Carries provider identity all the way to cluster level; would have aligned with ADR-004:77's original wording ("should reuse `--accent`, `--azure`, `--aws`").
- Cons: A two-tone cluster (split / striped / sectored) re-introduces exactly the noise the provider-mix bars added; a single-provider-cluster pure-azure or pure-aws colouring would mislead when the cluster is mixed; clusters are aggregations and the cleanest semantic is "available regions, count of N", not "this many of brand X."

### Option D: Inverted brand badge — `var(--accent)` background, white text + white ring (chosen)

- Pros: Re-uses ADR-004's accent semantic ("live / available / aggregated"); the auto-themed token works on both surfaces without per-theme hex variants; colour-inverted vs the white POI dot differentiates the two primitives while staying inside the same palette; removing provider bars simplifies the cluster pipeline (three CSS rules, one constant, one loop deleted).
- Cons: Heavier eye-weight at world zoom with many small clusters — mitigated by the smaller `.cluster-small` size (36px) and the still-soft shadow. If this becomes a problem the response is to tune token values, not to reintroduce per-tier hex variants.

## Consequences

- Cluster surfaces MUST be painted from `var(--accent)`. A new contributor reaching for a fresh hex value or for `--azure` / `--aws` at cluster level is a smell — clusters own the accent semantic; per-provider colouring at the aggregated level was considered and rejected (Option C).
- Provider mix at cluster level is a deliberate non-feature. Don't re-add `.cluster-providers` strips, sector arcs, halftone fills, or other "AWS:Azure ratio" treatments to the cluster icon. The provider signal lives on individual POI dots (ADR-004 marker primitive) and is reached by zooming in past `CLUSTER_CONFIG.DISABLE_AT_ZOOM`.
- Size tiers MUST stay discrete, not interpolated. Three sizes keyed off `CLUSTER_SIZE_THRESHOLDS` is the contract.
- The `html.light .cluster-marker` override is a cascade-anchor and should not be removed even though it appears redundant against the auto-themed `var(--accent)`. Removing it makes a future light-mode experiment one bad rule away from desaturating the cluster.
- White (`#ffffff`) on the ring and the count text is the only literal allowed inside `.cluster-marker`. It is semantic (separation from the map; max-contrast count), not a brand colour. Other components needing a "ring against the map" affordance should reach for the same literal rather than introducing a `--ring` token unless multiple components share the need.
- Cluster click-target stays at `L.point(52, 52)` / `L.point(26, 26)` uniformly across tiers. The generous touch target on small clusters is a deliberate touch-friendliness affordance, not an oversight.
- `MarkerCluster.Default.css` (loaded at `index.html:21`) ships green pastel backgrounds for `.marker-cluster` and its inner `div`. The three `background: transparent !important` neutralisers above the cluster styles MUST stay; removing them re-introduces the plugin default behind the accent badge.
- Existing Playwright selectors target `.leaflet-marker-icon .map-marker-dot` only; cluster styling changes don't touch them and shouldn't. Cluster-specific visual assertions are intentionally absent — they'd be more fragile than valuable for a CSS-only contract. If a cluster regression needs a regression test in the future, prefer asserting the DOM contract (`.cluster-marker` exists; `.cluster-small|medium|large` is applied per `CLUSTER_SIZE_THRESHOLDS`) over the rendered pixels.

## Links

- [ADR-004](ADR-004-mission-control-aesthetic-and-design-tokens.md) §Consequences — cluster-icons follow-up flagged at the line referenced from ADR-004 itself; this ADR is the resolution.
- [ADR-005](ADR-005-custom-css-tooltip-pattern.md) — companion ADR for another component-level extension of ADR-004's token system.
- Commits on `feature/mission-control-redesign`:
  - `5450ddf` — Option B (white badges) shipped and rejected; the iteration this ADR explicitly supersedes on visual-hierarchy grounds.
  - `7ed291c` — provider-mix strips removed from HTML, JS, and CSS together.
  - `4fd6dcc` — inverted brand badge (the treatment this ADR records).
