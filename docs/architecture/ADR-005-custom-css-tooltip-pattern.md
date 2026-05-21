# ADR-005: Custom CSS Tooltip Pattern for In-App Hover Affordances

**Status**: Accepted

## Context

The Mission Control popup ([ADR-004](ADR-004-mission-control-aesthetic-and-design-tokens.md)) introduced vault tier pills (`Foundation · Core`, `Advanced · Core`, etc.) that buyers visually scan to confirm regional support. A code-review pass on PR #103 surfaced that the pills give no inline disclosure of the commercial limits each edition carries (e.g. Foundation's 20% fair-usage restore cap, Advanced's unlimited restores). Buyers had to leave the page for that context.

The obvious default — the native HTML `title=` attribute — was explicitly rejected for two reasons: a ~700–1000ms hover delay before the bubble appears, and OS-native styling that clashes with the curated dark/light dashboard aesthetic ADR-004 establishes. The audience and viewing context make both flaws acute: this UI is buyer-facing and is regularly screen-shared over compressed video calls or shown on projectors, where delayed reveals are confusing and OS chrome is jarring.

The vault tier disclosure is the first in-app tooltip in this UI. Without a documented pattern, future hover affordances (filter chips, provider chips, region-status indicators, future capability badges) will fragment between contributors' instincts. The decision and its trade-offs need to be pinned down once.

## Decision Drivers

- Visual consistency with the Mission Control aesthetic — tooltips MUST read as part of the same product, not an OS overlay.
- Zero perceptible latency on hover. The information should appear instantly.
- Accessibility parity with native `title=`. Native ships free keyboard + screen-reader support; a custom replacement MUST replicate both, not silently regress.
- No new runtime dependency. The project ships a single-file SPA; adding a tooltip library (Tippy.js, Floating UI, etc.) for one use case is over-investment.
- The pattern must work inside a Leaflet popup, which adds overflow/z-index constraints absent from a generic page.

## Decision

Use a CSS-only tooltip driven by a `data-tooltip` attribute and a `::after` pseudo-element. Every interactive element that needs an in-app tooltip MUST carry all four pieces:

1. **`data-tooltip="<copy>"`** — the visible bubble reads this via `content: attr(data-tooltip)`.
2. **`aria-label="<element text>. <copy>"`** — replicates the screen-reader announcement that `title=` would have provided.
3. **`tabindex="0"`** — exposes the element to keyboard focus so the same bubble triggers on `:focus-visible`.
4. **CSS triggers on both `:hover` and `:focus-visible`** — mouse AND keyboard users see the disclosure.

The bubble styles MUST use existing design tokens from [ADR-004](ADR-004-mission-control-aesthetic-and-design-tokens.md) (`--bg-elev-2` background, `--border-strong` border, `--text` ink, `--bg-elev-2` shadow tint) so the tooltip themes with the rest of the dashboard.

Reduced-motion users get an instant show/hide:

```css
@media (prefers-reduced-motion: reduce) {
    .popup-svc .pill[data-tooltip]::after { transition: none; }
}
```

### Leaflet overflow + stacking

The `.leaflet-popup-content-wrapper` ships with `overflow: hidden` to clip rounded corners against the inner provider-strip background. A tooltip rendered as a child pseudo-element will be clipped by that wrapper. The fix is a scoped override:

```css
.leaflet-popup-content-wrapper:has(.popup-card) { overflow: visible; }
```

`:has()` keeps the override targeted to our redesigned popup so any other Leaflet popup the project might later add keeps its default clipping. The bubble's `z-index` is set to `1000` to sit cleanly above Leaflet's popup pane (default ≤700).

## Options Considered

### Option A: Native HTML `title=` attribute

- Pros: Zero new CSS/JS; ships full a11y (screen-reader + keyboard) by default.
- Cons: ~700–1000ms hover delay; OS-default styling cannot be themed; clashes with the Mission Control aesthetic; the latency is confusing in the screen-share contexts this UI is used in.

### Option B: JS-driven tooltip library (Tippy.js, Floating UI, etc.)

- Pros: Polished out-of-the-box; handles edge positioning, collision avoidance, and multi-line copy.
- Cons: New runtime dependency in a single-file SPA; adds bundle size and build steps for one initial use case; the tooltip needs are simple enough that CSS-only solves them without a library.

### Option C: CSS-only `data-tooltip` + `::after` (chosen)

- Pros: Zero dependency; instant on hover; themed via existing CSS tokens; pseudo-element keeps the markup clean; pattern generalises naturally to other hover affordances.
- Cons: Single-line copy is best (multi-line works but needs `white-space: normal` + explicit `max-width`); collision avoidance is manual (positioning above the element is fine for in-popup pills but may need re-evaluation if the trigger is near the top of the viewport); the overflow + z-index gotchas require attention any time the pattern is adopted inside a clipped parent.

## Consequences

- New hover affordances in `layouts/index.html` MUST use this pattern. Don't reach for `title=` even for "simple" in-app cases — the latency and styling drift compound across components.
  - Exception: `title=` on `<a>` tags pointing to external resources is fine. Those aren't competing with the dashboard aesthetic.
- All four pieces (`data-tooltip`, `aria-label`, `tabindex=0`, hover + focus-visible CSS) are required together. Skipping any one breaks either a11y or keyboard parity.
- When extending the pattern to a new context, audit the parent chain for `overflow: hidden` or `overflow: clip`. Add a scoped `:has()` override (preferred) or restructure the parent.
- Tooltip CSS currently lives scoped under `.popup-svc .pill[data-tooltip]`. The second use of the pattern in another component should trigger a refactor: promote the rules to a generic `[data-tooltip]` selector and keep only component-specific positioning overrides locally. This ADR is the place to record that promotion when it happens.
- Tooltip strings that carry product, commercial, or compliance claims (e.g. fair-usage restore limits) MUST be treated as commercial copy — coordinate edits with product. A code comment marking such strings as commercial disclosures is appropriate where the WHY isn't obvious from the variable name.
- Tests asserting tooltip behaviour SHOULD assert on the attributes (`data-tooltip`, `aria-label`, `tabindex`) rather than the rendered `::after` content, since `::after` is not in the DOM and is awkward to query reliably in Playwright. The `aria-label` is the most stable signal for screen-reader equivalence.

## Links

- [PR #103](https://github.com/comnam90/veeam-data-cloud-services-map/pull/103) — the redesign and the popup that introduced this pattern.
- [ADR-004](ADR-004-mission-control-aesthetic-and-design-tokens.md) — design tokens consumed by the tooltip bubble styling.
- Initial use: `vaultEditionDescriptions` in `layouts/index.html`, rendered by the vault tier pill generator.
