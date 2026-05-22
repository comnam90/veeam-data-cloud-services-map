# ADR-007: Responsive Initial Map View via `fitBounds` with Tile Wrap

**Status**: Accepted

## Context

Since the project began the Leaflet map opened with a hard-coded `zoom: 2`, `center: [25, 10]`. On common laptop sizes this looked correct, so the bug hid for months. On a 2K (≈2560 px wide) desktop reviewed during the mission control redesign ([ADR-004](ADR-004-mission-control-aesthetic-and-design-tokens.md)) two problems surfaced together: the world wrapped horizontally 2–3 times (the world at zoom 2 is only 1024 px wide, leaving the wider viewport to be re-filled by adjacent copies), and a large blank vertical band sat above the populated latitudes (markers cluster between roughly −40° and +55° lat but the static view was centred at lat 25 with no padding negotiation).

The audience is buyer / pre-sales (per [ADR-004](ADR-004-mission-control-aesthetic-and-design-tokens.md) drivers): the map is presented on whatever screen the demo happens to land on — laptops, 2K external monitors, 4K conference TVs, and incidentally the mobile portraits the Playwright suite (Pixel 7, iPhone 15 Pro) covers as part of the responsive contract. A single solution had to work across all of them without an arbitrary breakpoint forest.

A first iteration (commits `63415cd`, `0234bde`) replaced the static view with `fitBounds` and added `noWrap: true` to the tile layers to stop the multi-world repeat. It shipped and was rejected on second eyeball: the populated band now framed correctly, but the world clipped to grey edges on wide displays (at zoom 3 the world is 2048 px and a 2K viewport leaves ~256 px of grey on each side). The user feedback — "I'm ok with a little edge wrap to fill this" — produced the principle this ADR records: tile wrap is a free pixel filler at the right zoom and `fitBounds` is the mechanism that keeps the wrap small.

## Decision Drivers

- Initial view must adapt across laptop, 2K, 4K, and mobile portrait without per-breakpoint hard-coded zoom values; new screen sizes appear and the design must not need a new conditional each time.
- The thing we want to fit on screen is the *region data*, not the world. Deriving the view from `regions[].coords` is the only honest way to keep this true as regions get added.
- The cluster signal ([ADR-006](ADR-006-cluster-marker-visual-treatment.md)) — at-a-glance "many vs one" via cluster vs POI dot — is part of the map's primary affordance. The initial zoom must not collapse it. On mobile portrait specifically, isolated Azure regions (Australia, NZ, South Africa, Korea) must still read as individual markers; this is empirically asserted by `tests/ui.spec.ts:113` and `:128`.
- The off-canvas space on wide viewports has two valid renderings: grey (tile clip) or adjacent world copy (tile wrap). At a `fitBounds`-chosen zoom the wrap is small enough to feel like "edge fill", not "the map is broken." Grey edges read as broken.
- Initial zoom and interactive zoom are different contracts. The user can drive the map to any zoom in the `[minZoom, maxZoom]` range; the *initial* zoom should never overshoot continent scale on first load.

## Decision

### `fitBounds` on `regions[].coords`

Replaces the static `center`/`zoom` pair. Built once after tile-layer attachment:

```js
const regionLatLngs = regions
    .filter(r => Array.isArray(r.coords) && r.coords.length === 2)
    .map(r => r.coords);
map.fitBounds(L.latLngBounds(regionLatLngs), {
    padding: [48, 48],
    maxZoom: 3,
    animate: false
});
```

- `padding: [48, 48]` keeps edge markers off the header and bottom legend chrome without a CSS gap.
- `maxZoom: 3` caps the *initial* zoom so 4K and 5K displays don't overshoot to a continent-fragment view on first load. This ceiling is deliberately lower than the map's `maxZoom: 6` — interactive zoom past 3 is a user choice, not an automatic one.
- `animate: false` — the very first view is not a motion; no users have interacted yet.
- No resize listener. Once `fitBounds` has run on load, the view stays where the user puts it via interaction.

### `minZoom: 2`, not 1

`fitBounds` clamps to `map.minZoom`. On Pixel 7 (412×915) and iPhone 15 Pro (393×852) portraits the natural fit is zoom 1, and at zoom 1 every Azure marker collapses into clusters — including the geographically isolated ones (Australia, NZ, South Africa) that read as "single region per continent" cues on the wider screens. Lowering `minZoom` to 1 also broke `tests/ui.spec.ts:113` (`should filter regions by Azure provider`) on both Mobile Chrome and Mobile Safari, because the assertion `.leaflet-marker-icon .map-marker-dot` count > 0 requires un-clustered individual markers. The test is downstream of the UX regression, not the cause of it.

Keeping `minZoom: 2` means mobile portrait clamps to the previous default (so the touch UX on phones did not change). Only wide desktops benefit from the new `fitBounds`-chosen zoom of 3.

### Tile wrap is on (no `noWrap`), `worldCopyJump: true`

Both tile layers omit the `noWrap` option, so default Leaflet wrap behaviour applies. `worldCopyJump: true` is restored at map level as the partner of wrapped tiles — without it, marker positions can drift relative to the visible world copy when the user pans across the antimeridian.

At zoom 3 the rendered world is 2048 px wide. On a 2K viewport this leaves ~256 px of edge on each side, which is filled by the adjacent world copy — "a little edge wrap." On a 4K viewport the wrap is closer to half a world per side; still acceptable because the populated continents stay anchored to the canonical copy and the duplicated regions are unpopulated ocean.

`maxBounds: [[-60, -185], [90, 185]]` is unchanged from the prior code. It governs *interactive* pan limits, not the initial framing, and the ±185° lng range deliberately permits a small pan into the wrap zone.

## Options Considered

### Option A: Hard-coded per-breakpoint zoom

`if (window.innerWidth >= 2200) zoom = 3 else zoom = 2`, optionally with more steps.

- Pros: Simplest possible code; deterministic.
- Cons: Arbitrary thresholds (every breakpoint is someone's guess); doesn't adapt to ultrawide / 4K / 5K without more conditionals; doesn't adapt as the region distribution changes over time; the breakpoint is not derived from the thing it claims to optimise for.

### Option B: `fitBounds` + `noWrap: true`

The first iteration. Shipped briefly in `63415cd` and `0234bde`.

- Pros: Single world copy, deterministic rendering, no risk of wrap-related marker drift.
- Cons: Clips the world to grey edges on wide displays — at zoom 3 on 2K the rendered world is 2048 px in a 2560 px viewport, so ~256 px of grey on each side; rejected on visual review. Same pattern as ADR-006 Option B: an option that looks cleaner on paper and worse on the screen.

### Option C: `fitBounds` + lower `minZoom: 1`

Let mobile portrait pick the natural fit instead of clamping.

- Pros: All regions visible on initial mobile load without panning.
- Cons: Empirical UX regression — at zoom 1 the cluster signal collapses for isolated regions, and `tests/ui.spec.ts:113`/`:128` fail on both mobile projects (the test is the early warning of a real visual problem, not the problem itself).

### Option D: `fitBounds` + tile wrap (chosen)

`noWrap` omitted, `worldCopyJump: true` restored, `maxZoom: 3` ceiling on the fit, `minZoom: 2` clamp.

- Pros: Responsive across viewport sizes from mobile portrait to 4K with no breakpoint conditional; preserves the cluster signal on mobile; fills wide-display edges with the cheapest available rendering (wrap) instead of grey; all existing Playwright tests pass.
- Cons: `worldCopyJump` and tile wrap are a coupled pair — turning off one requires turning off the other; on very wide displays (4K+) the wrap can occupy close to half the off-canvas width, which a future contributor may misread as the original "world repeats three times" bug. This ADR exists primarily to prevent that misreading.

## Consequences

- Initial view MUST be derived from `regions[].coords` via `fitBounds`. A new contributor adding `center: [...]` or `zoom: N` to the `L.map()` options block is a smell; that responsibility moved to Leaflet, computed from the data.
- `noWrap: true` on the tile layer is a defect, not an improvement. The grey-edge clip on wide displays is the failure mode it produces. If wrap-related side effects appear (marker drift, unbounded pan), fix them in `worldCopyJump` and `maxBounds` rather than disabling wrap.
- `worldCopyJump: true` MUST stay enabled while tile wrap is enabled. The pair is a contract: one without the other is a UX regression (either grey edges or marker drift). Removing `worldCopyJump` is acceptable only as part of a deliberate move back to `noWrap: true`, which this ADR rejects.
- `minZoom: 2` is a load-bearing constraint, not an arbitrary floor. Lowering it to 1 collapses isolated regions into clusters on mobile portrait and breaks the cluster affordance ADR-006 records.
- `maxZoom: 3` inside the `fitBounds` call is the *initial-view ceiling*, intentionally lower than the map's `maxZoom: 6`. Bumping it to match the map's max makes 4K displays open at continent-fragment scale on first load.
- No resize listener for the initial view. A debounced resize re-fit would silently undo the user's zoom and pan when the browser is resized — hostile UX. If a viewport-aware re-fit becomes a need, gate it behind a user action (e.g., a "fit to data" control), not on resize.
- The existing Playwright contract — `tests/ui.spec.ts:113`/`:128` (provider filter → un-clustered marker count > 0) and `:479` (un-cluster + click marker) — is part of the contract this ADR records. A change here that breaks either is most likely a regression in this decision, not the test.

## Links

- [ADR-004](ADR-004-mission-control-aesthetic-and-design-tokens.md) — mission control aesthetic; the redesign that surfaced the wide-display review and the audience driver this ADR inherits.
- [ADR-006](ADR-006-cluster-marker-visual-treatment.md) — cluster marker treatment; this ADR depends on the cluster/POI visual hierarchy holding at mobile portrait zoom.
- Commits on `feature/mission-control-redesign`:
  - `63415cd` — first attempt: `fitBounds` + `noWrap: true`; clipped edges on wide displays.
  - `0234bde` — `minZoom` restored to 2 after the mobile cluster-signal regression broke Mobile Chrome / Mobile Safari filter tests.
  - `c6a3180` — tile wrap re-enabled, `worldCopyJump` restored (the treatment this ADR records).
