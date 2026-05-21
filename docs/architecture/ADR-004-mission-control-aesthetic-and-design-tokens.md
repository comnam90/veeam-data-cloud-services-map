# ADR-004: Paired Mission Control / Workstation Aesthetic with CSS Design Tokens

**Status**: Accepted

## Context

The SPA shipped initially with a generic Tailwind-driven SaaS dashboard look: system fonts, slate-grey palette with a green accent sprinkled evenly across the chrome, circle markers, and a popup that duplicated the Vault row when a region offered multiple editions. A UX review flagged the design as "competent but indistinguishable from every other cloud-service map" and identified specific issues: an Australia-centric default map view, hidden-on-mobile region count, no provider identity in markers, and amber styling collisions between AWS branding and warning callouts.

A redesign was proposed, brainstormed across two directions ("Mission Control HUD" vs "Cartographic Atlas"), and the Mission Control direction was chosen. To make light mode a first-class peer of dark mode — not a flashlight-inversion of the cockpit aesthetic — a second variant (`Workstation`) was added: same DNA, calmer language. The two themes share the same component anatomy and only swap underlying tokens.

The redesign is a single-file SPA change (`layouts/index.html`) because the project's architecture deliberately keeps the entire frontend in one Hugo template. Every visible component therefore has to pick its colours, fonts, and spacing values from somewhere — a Tailwind utility class, an inline style, or a custom CSS rule. Without a shared vocabulary the redesign would have continued the original pattern of scattering hex values across hundreds of lines and would have made future theme work hard.

## Decision Drivers

- One toggle, one product. Users flipping dark↔light should see the same product wearing different surfaces, not two different apps.
- A small palette that has *meaning*. The accent green was previously decorative everywhere; in the new system it signals "live / available / current selection" specifically.
- Mono-first typography (with a display serif/sans companion) to differentiate from the SaaS-dashboard pack and lean into the data-density of the map.
- Provider identity at the marker level — users shouldn't need to read the legend to know whether a marker is AWS or Azure.
- Theming must work without `.dark` / `.light` selectors on every component. The CSS variable system replaces dozens of paired overrides.

## Decision

### Tokenized theme system

A single `:root` block defines the dark-mode (default) tokens. An `html.light` block re-declares the same token names with light-mode values. Every redesigned component reads colours through `var(--bg)`, `var(--text)`, `var(--accent)`, `var(--azure)`, `var(--aws)`, etc. No component declares hex values directly except where the value is provider-identity (e.g. AWS Squid Ink) and required to render in a context that doesn't inherit CSS variables (e.g. SVG attribute fills are wrapped in `var(--azure)` / `var(--aws)` for the same reason).

Token domains:
- Surface: `--bg`, `--bg-elev`, `--bg-elev-2`
- Hairlines: `--border`, `--border-strong`
- Ink: `--text`, `--text-mute`, `--text-dim`
- Accent: `--accent`, `--accent-soft`, `--accent-glow`
- Brand: `--azure`, `--aws`

Dark accent is the fluorescent `#00ff88`; light accent is the muted `#00805a`. The two are intentionally non-identical — bright green on white reads as highlighter, muted green on black has no presence. Both still read as "Veeam green" emotionally.

### Typography

- `Space Grotesk` (weights 500, 700) for headlines and product nouns.
- `JetBrains Mono` (weights 400, 500, 700) for body text, UI labels, status strip, popup metadata, and coordinate readouts.

Loaded once via Google Fonts CDN with `display=swap` and a system-monospace fallback chain. The mono-first body type is the single biggest visual differentiator from the previous Tailwind-default look.

### Component anatomy

- Header: brand mark (pulsing dot) + live "status strip" telemetry (`Online · Regions X/Y · Providers 02 · Services 05`) + unified `.ctl` control primitive (search, selects, multi-select, icon buttons share one base class with `.ctl-*` modifiers).
- Map: edge-to-edge with a tokenized `.panel-legend` and tokenized Leaflet zoom/attribution chrome. No rounded corners, no green glow.
- Popup: one row per service (no edition-row duplication); each row carries a distinct monochrome service icon in `--accent` — the icon's presence signals "available", its shape signals which service; edition pills aligned right; vault edition pills hover-disclose commercial limits per [ADR-005](ADR-005-custom-css-tooltip-pattern.md); official Veeam service names per [ADR-003](ADR-003-official-veeam-service-naming.md).
- Markers: `L.divIcon` glyphs in provider brand colour (Azure triangle / AWS cube) replacing the prior `L.circleMarker` SVG paths. Keyboard-navigable; the parent marker carries an accessible `alt`.
- Info panel: same tokens, semantic class names (`.info-section`, `.info-link`, `.info-stat`) — no `bg-slate-*` / `bg-amber-500/10` mix.

## Options Considered

### Option A: Polish the existing design

- Pros: Lowest risk; existing tests stay green; small diffs.
- Cons: Doesn't address the "indistinguishable from every SaaS dashboard" feedback; the AWS amber/warning collision remains; mobile header still consumes ~15% of vertical space.

### Option B: Cartographic Atlas direction

- Pros: Genuinely distinctive (serif headlines, parchment palette, atlas vibe); zero competitors in this product space.
- Cons: Stronger departure from Veeam brand voice; the light-mode-first treatment doesn't translate as cleanly to a dark dashboard mode; risk of feeling like a marketing site rather than an operational tool.

### Option C: Mission Control HUD + Workstation light (chosen)

- Pros: Reads as a polished operational tool; live status strip + mono numerals lean into the data-density users care about; the dark/light pair shares one design system rather than being two separate aesthetics; CSS tokens scale to future theme work (e.g. a hypothetical high-contrast mode) without requiring `.theme-x` selectors on every component.
- Cons: Bigger up-front diff; Google Fonts adds a render-blocking stylesheet (mitigated by `display=swap` and a system fallback chain); some popup rows can wrap due to the longer official service names.

## Consequences

- New UI components MUST read colours/spacing through the existing tokens. Adding a new hardcoded hex value is a smell — either a new token is needed (justify in the PR), or the component should pick the closest existing token.
- Theme variants are added by extending `:root` / `html.light` (and potentially a future `html.high-contrast`, `html.print`, etc.). Components should NOT branch on `html.light` directly except where light mode genuinely needs a different *structure* (e.g. drop-shadow vs glow), and even then prefer adjusting tokens.
- Typography is a brand-level choice. If a future redesign wants different fonts, this ADR is the document to supersede; doing it piecemeal will fragment the system.
- The accent green is reserved for "live / active / available / focus". Don't use it as decoration. The provider blue/orange tokens are reserved for provider identity. Don't repurpose them.
- Each service registered in `serviceDisplayNames` MUST also register a corresponding inline SVG in `serviceIcons` (in `layouts/index.html`). Icons are simple monochrome geometric shapes that render crisply at 14px, using `stroke="currentColor"` so they inherit `--accent`. The shape carries service identity; the colour carries the "available" semantic. A service without an icon falls back to a generic checkmark — acceptable as a defensive default, not as a long-lived state.
- Metadata text tokens (`--text-dim`, `--text-mute`) carry a hard floor: both MUST clear WCAG AA against the popup background (`--bg-elev`) at the 9–10px sizes used in the popup header and coordinate readouts. This UI is regularly shown on projectors and screen-shared over compressed video; a token value that looks crisp on the design machine but fades on lossy displays violates the brief. Tune the values, not the font sizes, if a future contrast regression appears.
- Marker primitive: `L.divIcon` is the contract. Reverting to `L.circleMarker` would re-introduce the accessibility regression (no `keyboard: true`, no `alt`) and break the test selectors that target `.leaflet-marker-icon .marker-glyph`.
- Cluster icons (`.cluster-small`, `.cluster-medium`, `.cluster-large`) were deliberately left on the old colour system in this redesign — a known follow-up. Re-tokenizing them is the next logical extension of this ADR and should reuse `--accent`, `--azure`, `--aws`.
- Hugo's HTML minifier strips quotes around single-token attribute values. Smoke tests using `curl | grep` should account for this (`class=hud`, not `class="hud"`).

## Links

- [PR #103](https://github.com/comnam90/veeam-data-cloud-services-map/pull/103) — the redesign that introduced this aesthetic.
- Implementation plan: `plans/mission-control-redesign/plan.md`
- [ADR-003](ADR-003-official-veeam-service-naming.md) — service-naming convention used inside the popup component defined by this ADR.
- UX review and mockups (session output): the brainstorming explored Mission Control and Cartographic Atlas directions at desktop + mobile, both themes, before this aesthetic was chosen.
