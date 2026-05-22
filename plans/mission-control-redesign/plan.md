# Mission Control Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current generic-SaaS look with a paired dark/light "Mission Control / Workstation" aesthetic across `layouts/index.html`, so the toggle reads as one product wearing two coats: dark-on-near-black with a fluorescent accent, or light-on-cool-off-white with a muted accent. Same fonts, same layout, same posture — only the surface changes.

**Architecture:** All changes land in a single file (`layouts/index.html` — the SPA). Three concurrent strands of change:

1. **Visual layer** — Google Fonts (Space Grotesk + JetBrains Mono), new CSS design tokens for both themes, restyled header / controls / map panels / popup.
2. **HTML restructure** — header becomes brand + live-data status strip + controls; popup uses one row per service with edition pills aligned right (eliminates the existing Vault row duplication).
3. **JS updates** — circle markers become provider-shaped SVG glyphs via `L.divIcon`; service display names rename; initial map center moves from Australia to globally-balanced.

The existing theme toggle stays — it still swaps `html.dark` ↔ `html.light`. Only the CSS underneath each class changes.

**Tech Stack:** Existing — Hugo + Tailwind CDN + Leaflet + custom CSS in a `<style type="text/tailwindcss">` block. Adding: Google Fonts (Space Grotesk, JetBrains Mono) via `<link>`.

---

## File Structure

| File | Action | Why |
|---|---|---|
| `layouts/index.html` | Modify | The whole SPA lives here; redesign touches `<head>`, the `<style>` block, the `<header>` HTML, the popup template JS, marker creation JS, and config constants. |
| `tests/ui.spec.ts` | Modify | The marker selector `path.leaflet-interactive` breaks when circle markers become divIcon glyphs. The "Azure" service-filter checkbox is renamed to "Azure Protection". |
| `plans/ui-styling-improvements/` | Delete | Superseded by this plan (the redesign replaces its scope wholesale). |
| `static/llms.txt`, `static/llms-full.txt` | Untouched | API surface and endpoint behaviour are unchanged. |
| `data/regions/**/*.yaml` | Untouched | Data shape is unchanged. |

The redesign is intentionally CSS-and-template-only — no API, schema, or data-format changes.

---

## Tasks

### Task 1: Archive the superseded plan

**Files:**
- Delete: `plans/ui-styling-improvements/plan.md`
- Delete: `plans/ui-styling-improvements/implementation.md`
- Delete: `plans/ui-styling-improvements/` (the now-empty directory)

Note: the old plan was never committed to git (it's an untracked working-tree directory). Removal is a filesystem `rm`, not a `git rm`.

- [ ] **Step 1: Verify the directory contents and confirm it is untracked**

Run:
```bash
ls -la plans/ui-styling-improvements/
git ls-files plans/ui-styling-improvements/
```

Expected: `ls` shows `plan.md` and `implementation.md`. `git ls-files` returns nothing (confirming the directory is untracked). If `git ls-files` returns any files, stop — fall back to `git rm -r plans/ui-styling-improvements/ && git commit -m "chore: supersede ui-styling-improvements plan"`.

- [ ] **Step 2: Remove the directory**

```bash
rm -rf plans/ui-styling-improvements/
```

Expected: no output. The directory is gone.

- [ ] **Step 3: Verify the removal**

```bash
ls plans/
```

Expected: only `mission-control-redesign/` remains under `plans/`.

No commit is required for this task — removing untracked files leaves no diff to record. Proceed directly to Task 2.

---

### Task 2: Add typography and theme design tokens

**Files:**
- Modify: `layouts/index.html` — add Google Fonts to `<head>` (after the existing `<link rel="preconnect">` lines, around line 14); replace the `:root` / `body` block at the top of `<style type="text/tailwindcss">` (around lines 22–34).

- [ ] **Step 1: Add Google Fonts preconnect + stylesheet link**

In `layouts/index.html`, find the existing preconnect block (after the Tailwind script, before the Leaflet stylesheet). Add three new `<link>` elements directly after the existing `<link rel="preconnect" href="https://static.cloudflareinsights.com" crossorigin>` line:

```html
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=JetBrains+Mono:wght@400;500;700&display=swap">
```

- [ ] **Step 2: Add design tokens at the top of the `<style>` block**

Find the line `@custom-variant dark (&:where(.dark, .dark *));` (around line 23) and immediately after the two `@custom-variant` lines, insert this block (before the existing `body { … }` rule):

```css
        :root {
            /* Dark tokens (default) */
            --bg: #0a0d12;
            --bg-elev: #11151c;
            --bg-elev-2: #161b24;
            --border: #232a35;
            --border-strong: #2f3744;
            --text: #e6edf3;
            --text-mute: #8892a0;
            --text-dim: #5a6473;
            --accent: #00ff88;
            --accent-soft: rgba(0, 255, 136, 0.10);
            --accent-glow: rgba(0, 255, 136, 0.35);
            --azure: #4ea3ff;
            --aws: #ff9d3d;
        }
        html.light {
            --bg: #fafbfc;
            --bg-elev: #ffffff;
            --bg-elev-2: #f4f6f8;
            --border: #e5e8ec;
            --border-strong: #d0d5da;
            --text: #1a202c;
            --text-mute: #5a6473;
            --text-dim: #98a0ad;
            --accent: #00805a;
            --accent-soft: rgba(0, 128, 90, 0.10);
            --accent-glow: rgba(0, 128, 90, 0.20);
            --azure: #2c5fa8;
            --aws: #d97506;
        }
```

- [ ] **Step 3: Replace the existing `body` rule and theme-class rules**

Find the existing `body { background-color: #0f172a; … }` rule and the `.dark body`, `.light body` rules immediately following (lines ~26–33). Replace those three rules with:

```css
        body {
            background-color: var(--bg);
            color: var(--text);
            font-family: 'JetBrains Mono', ui-monospace, monospace;
            font-size: 13px;
            letter-spacing: 0.005em;
            transition: background-color 0.3s ease, color 0.3s ease;
            touch-action: manipulation;
        }
```

- [ ] **Step 4: Update `<meta name="theme-color">` so the address bar follows the theme**

Find `<meta name="theme-color" content="#0f172a" id="themeColorMeta">` (around line 7). Change `content` to `#0a0d12` so it matches the new dark background:

```html
    <meta name="theme-color" content="#0a0d12" id="themeColorMeta">
```

Also find the JS that updates this meta tag on theme toggle (search the file for `themeColorMeta`). Update the two hex values inside it from `#0f172a` and `#f1f5f9` to `#0a0d12` (dark) and `#fafbfc` (light):

```js
// Find the existing code that does:
//   themeColorMeta.setAttribute('content', isDark ? '#0f172a' : '#f1f5f9');
// Change to:
themeColorMeta.setAttribute('content', isDark ? '#0a0d12' : '#fafbfc');
```

- [ ] **Step 5: Run typecheck + start dev server to verify nothing broke**

```bash
npm run typecheck
npm run build
npm run dev &
sleep 4
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8788/
```

Expected: typecheck passes, build succeeds, server returns `200`.

- [ ] **Step 6: Visual sanity check**

Open `http://localhost:8788/` in a browser. Body font should now be JetBrains Mono (monospace). The page may look mid-redesign — that's fine. Confirm: no console errors, no missing-font flashes that don't resolve.

- [ ] **Step 7: Commit**

```bash
git add layouts/index.html
git commit -m "feat(ui): add typography and theme design tokens"
```

---

### Task 3: Rebuild the header (brand mark + status strip + controls)

**Files:**
- Modify: `layouts/index.html`
  - HTML: replace the entire `<header>` element (around lines 583–684).
  - CSS: append new header rules near the existing `.header-gradient` rules (around line 77) — keep the existing rules for now, the new ones override them by class specificity.

- [ ] **Step 1: Append the new header CSS**

In the `<style>` block, after the existing `.header-gradient { … }` rules (around line 82), insert:

```css
        /* === NEW HEADER === */
        .hud {
            display: flex;
            align-items: center;
            padding: 14px 24px;
            background: var(--bg-elev);
            border-bottom: 1px solid var(--border);
            padding-top: calc(14px + env(safe-area-inset-top));
        }
        .brand { display: flex; align-items: center; gap: 14px; }
        .brand-mark {
            width: 26px; height: 26px;
            position: relative;
            display: flex; align-items: center; justify-content: center;
            flex-shrink: 0;
        }
        .brand-mark::after {
            content: ''; width: 10px; height: 10px;
            background: var(--accent); border-radius: 50%;
            box-shadow: 0 0 14px var(--accent-glow);
        }
        .brand-mark::before {
            content: ''; position: absolute; inset: 4px;
            border: 1.5px solid var(--accent);
            border-radius: 50%;
            opacity: 0.35;
            animation: brand-pulse 2.4s ease-out infinite;
        }
        @keyframes brand-pulse {
            0% { transform: scale(0.7); opacity: 0.6; }
            100% { transform: scale(1.6); opacity: 0; }
        }
        .brand-text { display: flex; flex-direction: column; gap: 1px; }
        .brand-text .tag {
            font-family: 'JetBrains Mono', monospace;
            font-size: 9px; letter-spacing: 0.18em;
            color: var(--text-dim);
            text-transform: uppercase;
        }
        .brand-text .title {
            font-family: 'Space Grotesk', sans-serif;
            font-weight: 700; font-size: 15px;
            letter-spacing: -0.005em;
            color: var(--text);
        }
        .brand-text .title em { color: var(--accent); font-style: normal; }

        .status {
            margin-left: 36px;
            display: flex; align-items: center; gap: 24px;
            flex: 1;
            font-size: 11px; color: var(--text-mute);
            text-transform: uppercase; letter-spacing: 0.12em;
        }
        .status .row { display: flex; align-items: baseline; gap: 8px; }
        .status .row b {
            font-weight: 500; color: var(--text);
            font-size: 13px; letter-spacing: 0;
        }
        .status .sep { width: 1px; height: 14px; background: var(--border); }
        .status .dot {
            width: 6px; height: 6px;
            background: var(--accent); border-radius: 50%;
            box-shadow: 0 0 6px var(--accent-glow);
        }

        .hud .controls { display: flex; align-items: center; gap: 6px; }

        @media (max-width: 900px) {
            .status { display: none; }
        }
        @media (max-width: 640px) {
            .hud { padding: 10px 14px; gap: 8px; flex-wrap: wrap; }
            .brand-text .tag { display: none; }
            .hud .controls { margin-left: auto; }
        }
```

- [ ] **Step 2: Replace the header markup**

Find the existing `<header class="header-gradient …">` element (starts around line 583) and ends with its closing `</header>` (around line 684). Replace the entire block with:

```html
    <header class="hud">
        <div class="brand">
            <div class="brand-mark" aria-hidden="true"></div>
            <div class="brand-text">
                <span class="tag">VDC // Global Telemetry</span>
                <h1 class="title"><em>Veeam</em> Data Cloud Service Map</h1>
            </div>
        </div>

        <div class="status" aria-hidden="true">
            <div class="row"><span class="dot"></span> Online</div>
            <div class="sep"></div>
            <div class="row">Regions <b><span id="visibleCount">0</span>/<span id="totalCount">0</span></b></div>
            <div class="row">Providers <b>02</b></div>
            <div class="row">Services <b>05</b></div>
        </div>

        <div class="controls">
            <!-- Search input -->
            <div class="search-container">
                <div class="relative">
                    <svg aria-hidden="true" class="search-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                    </svg>
                    <input type="text" id="regionSearch" placeholder="Search regions…" autocomplete="off" aria-label="Search regions"
                            role="combobox" aria-expanded="false" aria-controls="searchResults" aria-autocomplete="list" aria-activedescendant=""
                            class="ctl ctl-search">
                </div>
                <div id="searchResults" role="listbox" aria-label="Search results" aria-hidden="true"></div>
            </div>

            <select id="providerFilter" aria-label="Filter by provider" class="ctl">
                <option value="all">All Providers</option>
                <option value="Azure">Azure</option>
                <option value="AWS">AWS</option>
            </select>

            <div class="multiselect" id="serviceMultiselect">
                <button type="button" id="serviceFilterBtn" aria-expanded="false" class="ctl multiselect-btn">
                    <span id="serviceFilterLabel">All Services</span>
                    <svg aria-hidden="true" class="multiselect-chevron" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
                    </svg>
                </button>
                <div class="multiselect-dropdown" id="serviceDropdown" aria-hidden="true">
                    <label class="multiselect-option"><input type="checkbox" value="vdc_vault"> Vault</label>
                    <label class="multiselect-option"><input type="checkbox" value="vdc_m365"> M365</label>
                    <label class="multiselect-option"><input type="checkbox" value="vdc_entra_id"> Entra ID</label>
                    <label class="multiselect-option"><input type="checkbox" value="vdc_salesforce"> Salesforce</label>
                    <label class="multiselect-option"><input type="checkbox" value="vdc_azure_backup"> Azure Protection</label>
                </div>
            </div>

            <button id="resetFilters" aria-label="Reset all filters" class="ctl ctl-reset hidden" title="Reset all filters">
                <svg aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                </svg>
                <span class="ctl-label">Reset</span>
            </button>

            <button id="themeToggle" aria-label="Toggle theme" class="ctl ctl-icon" title="Toggle theme">
                <svg id="iconSystem" aria-hidden="true" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M3 5a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2h-2.22l.123.489.804.804A1 1 0 0113 18H7a1 1 0 01-.707-1.707l.804-.804L7.22 15H5a2 2 0 01-2-2V5zm5.771 7H5V5h10v7H8.771z" clip-rule="evenodd"/>
                </svg>
                <svg id="iconLight" aria-hidden="true" fill="currentColor" viewBox="0 0 20 20" class="hidden">
                    <path fill-rule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clip-rule="evenodd"/>
                </svg>
                <svg id="iconDark" aria-hidden="true" fill="currentColor" viewBox="0 0 20 20" class="hidden">
                    <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z"/>
                </svg>
            </button>

            <button id="infoBtn" class="ctl ctl-icon" title="About this map" aria-label="Open about panel" aria-expanded="false" aria-controls="infoPanel">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
            </button>
        </div>
    </header>
```

Note: aria-roles and IDs (`#regionSearch`, `#providerFilter`, `#serviceDropdown`, `#themeToggle`, `#infoBtn`, `#serviceFilterLabel`, `#visibleCount`, `#totalCount`, etc.) are preserved — this keeps the existing JS event handlers and Playwright accessible-role selectors working without changes.

- [ ] **Step 3: Update the `updateRegionCount` JS to use the new status strip**

The new header puts `#visibleCount` and `#totalCount` inside `.status`, which is hidden on `< 900px`. That's correct — the count was already hidden on mobile in the old design. Find the existing `updateRegionCount(visible, total)` function (around line 1359). Confirm it still does `document.getElementById('visibleCount').textContent = visible;` and similar — no changes needed. If for some reason it referenced the wrapping element by a class that no longer exists, update it to just set `.textContent` on the spans by id.

- [ ] **Step 4: Run the build and start dev server**

```bash
npm run build && npm run dev &
sleep 4
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8788/
```

Expected: `200`.

- [ ] **Step 5: Visual check at desktop and mobile**

Open `http://localhost:8788/` in a browser. Verify:
- Brand mark (green dot) appears at top-left with a faint pulsing ring
- "VDC // GLOBAL TELEMETRY" tag is small uppercase above the title
- Title reads "**Veeam** Data Cloud Service Map" with "Veeam" in accent green
- Live "Online / Regions 72/72 / Providers 02 / Services 05" status strip is visible at ≥900px viewport
- Controls (search, provider filter, services multiselect, theme toggle, info) sit to the right
- At 640px viewport the status strip disappears, the brand tag hides, controls wrap to the right

- [ ] **Step 6: Commit**

```bash
git add layouts/index.html
git commit -m "feat(ui): rebuild header with brand mark, status strip, and controls"
```

---

### Task 4: Restyle controls (search, dropdowns, multi-select, buttons)

**Files:**
- Modify: `layouts/index.html` — append control styles in the `<style>` block (after the new header CSS); refine existing `.multiselect-*` and search styles.

- [ ] **Step 1: Append unified control styles**

After the new header CSS block from Task 3, insert:

```css
        /* === CONTROLS === */
        .ctl {
            font-family: 'JetBrains Mono', monospace;
            font-size: 11px;
            background: var(--bg-elev);
            border: 1px solid var(--border-strong);
            color: var(--text);
            padding: 7px 12px;
            border-radius: 6px;
            cursor: pointer;
            letter-spacing: 0.03em;
            text-transform: uppercase;
            display: inline-flex; align-items: center; gap: 7px;
            transition: border-color 0.15s, background 0.15s, color 0.15s;
            line-height: 1.2;
        }
        .ctl:hover { border-color: var(--accent); background: var(--accent-soft); }
        .ctl:focus-visible {
            outline: 2px solid var(--accent);
            outline-offset: 1px;
            border-color: var(--accent);
        }
        .ctl svg { width: 12px; height: 12px; flex-shrink: 0; }
        .ctl-icon { padding: 7px 9px; }
        .ctl-icon svg { width: 14px; height: 14px; }
        .ctl-search {
            min-width: 200px;
            text-transform: none;
            letter-spacing: 0;
            font-family: 'JetBrains Mono', monospace;
            padding-left: 30px;
        }
        .ctl-search:focus { min-width: 240px; }
        .ctl-search::placeholder { color: var(--text-dim); }
        .ctl-reset {
            color: var(--aws);
            border-color: var(--aws);
            background: transparent;
        }
        .ctl-reset:hover { background: var(--aws); color: var(--bg); }

        .search-container { position: relative; }
        .search-container .relative { position: relative; display: inline-block; }
        .search-icon {
            position: absolute; left: 10px; top: 50%; transform: translateY(-50%);
            width: 12px; height: 12px;
            color: var(--text-dim);
            pointer-events: none;
        }

        /* Searched results dropdown */
        #searchResults {
            position: absolute; top: calc(100% + 4px); left: 0;
            min-width: 260px; max-height: 320px;
            overflow-y: auto;
            background: var(--bg-elev);
            border: 1px solid var(--border);
            border-radius: 6px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.35);
            z-index: 1000;
            opacity: 0; visibility: hidden; transform: translateY(-4px);
            transition: opacity 0.15s, visibility 0.15s, transform 0.15s;
        }
        #searchResults.open { opacity: 1; visibility: visible; transform: translateY(0); }
        .search-result-item {
            display: flex; align-items: center; gap: 10px;
            padding: 8px 12px;
            font-family: 'JetBrains Mono', monospace;
            font-size: 12px;
            color: var(--text);
            background: transparent; border: none;
            border-bottom: 1px solid var(--border);
            width: 100%; text-align: left; cursor: pointer;
        }
        .search-result-item:last-child { border-bottom: none; }
        .search-result-item:hover, .search-result-item.highlighted { background: var(--accent-soft); }
        .search-result-item .provider-dot {
            width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0;
        }
        .search-result-item .region-name { font-weight: 500; color: var(--text); }
        .search-result-item .match-text { font-size: 10px; color: var(--text-mute); }
        .search-no-results {
            padding: 12px; text-align: center; color: var(--text-mute);
            font-family: 'JetBrains Mono', monospace; font-size: 11px;
        }

        /* Select element styling */
        select.ctl {
            appearance: none;
            -webkit-appearance: none;
            background-image: linear-gradient(45deg, transparent 50%, var(--text-mute) 50%),
                              linear-gradient(135deg, var(--text-mute) 50%, transparent 50%);
            background-position: calc(100% - 14px) calc(50% - 2px),
                                 calc(100% - 9px) calc(50% - 2px);
            background-size: 5px 5px;
            background-repeat: no-repeat;
            padding-right: 24px;
        }

        /* Multi-select */
        .multiselect { position: relative; display: inline-block; }
        .multiselect-btn { /* uses .ctl base, additional layout */ }
        .multiselect-chevron { transition: transform 0.2s ease; }
        .multiselect-btn[aria-expanded="true"] .multiselect-chevron { transform: rotate(180deg); }
        .multiselect-dropdown {
            position: absolute; top: calc(100% + 4px); right: 0;
            min-width: 180px; max-width: calc(100vw - 16px);
            background: var(--bg-elev);
            border: 1px solid var(--border);
            border-radius: 6px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.35);
            z-index: 1000;
            opacity: 0; visibility: hidden; transform: translateY(-4px);
            transition: opacity 0.15s, visibility 0.15s, transform 0.15s;
            overflow: hidden;
        }
        .multiselect-dropdown.open { opacity: 1; visibility: visible; transform: translateY(0); }
        .multiselect-option {
            display: flex; align-items: center; gap: 10px;
            padding: 9px 12px;
            font-family: 'JetBrains Mono', monospace;
            font-size: 11px;
            color: var(--text);
            cursor: pointer;
            transition: background 0.12s;
            text-transform: uppercase;
            letter-spacing: 0.04em;
        }
        .multiselect-option:hover { background: var(--accent-soft); }
        .multiselect-option input[type="checkbox"] {
            accent-color: var(--accent);
            width: 13px; height: 13px;
            cursor: pointer;
        }

        @media (max-width: 640px) {
            .ctl-search { min-width: 0; flex: 1; }
            .ctl-search:focus { min-width: 0; }
            .ctl .ctl-label { display: none; }
        }
```

- [ ] **Step 2: Remove the old conflicting CSS for the existing controls**

Search the `<style>` block for the following old rule sets and **delete** them (they're overridden but their colors clash):
- `select { background-color: #1e293b; … }` and `.light select { … }` (around line 85)
- `select:hover { border-color: #00d15f … }` and `.light select:hover { … }`
- `.multiselect-btn { … }` and `.multiselect-btn:hover { … }` (around line 107)
- `.multiselect-dropdown { … }`, `.multiselect-dropdown.open { … }`, `.light .multiselect-dropdown { … }`
- `.multiselect-option { … }`, `.multiselect-option:hover { … }`, `.light .multiselect-option:hover { … }`
- `.multiselect-option input[type="checkbox"] { … }`
- `.multiselect-chevron { … }`, `.multiselect-btn[aria-expanded="true"] .multiselect-chevron { … }`
- `#themeToggle { … }`, `#themeToggle:hover { … }`, `#themeToggle:active { … }`
- The whole `.search-container` / `#regionSearch` / `#searchResults` block (around lines 477–569) — replaced by the new versions in Step 1.

- [ ] **Step 3: Build and visually verify**

```bash
npm run build && npm run dev &
sleep 4
```

Open the browser. Verify:
- Search input has the magnifier icon on the left and `Search regions…` placeholder
- Provider filter is a clean monospace select with a chevron
- Services filter button reads `ALL SERVICES ▾` and opens a dropdown with checkboxes (Vault / M365 / Entra ID / Salesforce / **Azure Protection**)
- Theme toggle and info button are square icon buttons matching the others
- Reset button (orange-bordered) appears when filters are active

- [ ] **Step 4: Commit**

```bash
git add layouts/index.html
git commit -m "feat(ui): unify control styles into single .ctl primitive"
```

---

### Task 5: Restyle map chrome (legend, loading, error) and remove old map-frame styling

**Files:**
- Modify: `layouts/index.html`
  - CSS: replace the `#map` rule (around line 49), remove the `.dark/.light #map` glow rules, remove the `@media (max-width: 640px) #map` mobile override, add new panel rules.
  - JS: rewrite the `legend.onAdd` function (around line 982).

- [ ] **Step 1: Replace the `#map` and map-container CSS**

Find the existing `#map { … }`, `@media (max-width: 640px) #map { … }`, and `.light #map { … }` rules. Replace all three with:

```css
        #map {
            width: 100%; height: 100%;
            background: var(--bg);
        }
        .map-container {
            background: var(--bg);
        }
        .leaflet-container {
            background: var(--bg);
            font-family: 'JetBrains Mono', monospace;
        }
        .leaflet-control-attribution {
            background: rgba(17, 21, 28, 0.7) !important;
            color: var(--text-dim) !important;
            font-size: 9px !important;
            letter-spacing: 0.04em;
            border-top-left-radius: 4px;
        }
        html.light .leaflet-control-attribution {
            background: rgba(255, 255, 255, 0.8) !important;
        }
        .leaflet-control-attribution a { color: var(--text-mute) !important; }
        .leaflet-control-zoom a {
            background: var(--bg-elev) !important;
            color: var(--text) !important;
            border: 1px solid var(--border) !important;
        }
        .leaflet-control-zoom a:hover {
            background: var(--accent-soft) !important;
            border-color: var(--accent) !important;
        }
```

Remove `border-radius: 0.75rem` and the green glow `box-shadow` from `#map` — the new design uses an edge-to-edge map with no rounded corners or glow.

- [ ] **Step 2: Update `.map-container` padding so the map is edge-to-edge**

Find the `<div class="map-container p-0 sm:p-4 lg:p-6 …">` (around line 686). Change the class list so the inner padding is gone on desktop too (the map should reach the window edges):

```html
    <div class="map-container bg-[var(--bg)] transition-colors duration-300 relative">
```

- [ ] **Step 3: Add panel styles (legend, coords)**

Append to the `<style>` block:

```css
        /* Overlay panels on the map */
        .panel-legend {
            background: rgba(17, 21, 28, 0.92);
            border: 1px solid var(--border);
            border-radius: 6px;
            padding: 12px 14px;
            min-width: 170px;
            backdrop-filter: blur(10px);
            font-family: 'JetBrains Mono', monospace;
            transition: transform 0.2s ease;
        }
        html.light .panel-legend {
            background: rgba(255, 255, 255, 0.92);
        }
        .panel-legend:hover { transform: translateY(-1px); }
        .panel-legend .label {
            font-size: 9px; color: var(--text-dim);
            letter-spacing: 0.18em; text-transform: uppercase;
            margin-bottom: 10px;
            display: flex; justify-content: space-between; align-items: center;
        }
        .panel-legend .label .live {
            color: var(--accent);
            display: inline-flex; align-items: center; gap: 4px;
        }
        .panel-legend .label .live::before {
            content: ''; width: 5px; height: 5px;
            background: var(--accent); border-radius: 50%;
            box-shadow: 0 0 6px var(--accent-glow);
        }
        .panel-legend .row {
            display: flex; align-items: center; gap: 10px;
            margin-bottom: 6px;
            font-size: 11px;
            color: var(--text);
        }
        .panel-legend .row:last-child { margin-bottom: 0; }
        .panel-legend .row .glyph {
            width: 14px; height: 14px;
            display: inline-flex; align-items: center; justify-content: center;
            flex-shrink: 0;
        }
        .panel-legend .row .count {
            margin-left: auto; color: var(--text-mute); font-size: 10px;
        }
```

- [ ] **Step 4: Rewrite the `legend.onAdd` JS**

Find the existing `legend.onAdd = function() { … }` block (around line 982). Replace its `div.innerHTML = …` with:

```js
        legend.onAdd = function() {
            const div = L.DomUtil.create('div', 'leaflet-bar panel-legend');
            const azureGlyph = '<svg viewBox="0 0 20 20" width="14" height="14" fill="var(--azure)"><path d="M7.3 2.5h4.7L7.2 17a.8.8 0 01-.7.5H2.8a.7.7 0 01-.7-1l4.5-13.5a.8.8 0 01.7-.5z"/><path d="M14.2 12.2H6.7a.4.4 0 00-.3.6l4.8 4.5c.1.1.3.2.5.2h4.3l-1.8-5.3z" opacity="0.7"/></svg>';
            const awsGlyph = '<svg viewBox="0 0 24 24" width="14" height="14" fill="var(--aws)"><path d="M13.5 5.3v3.7l3.5 2-3.5 2v3.7l6.7-4.2V9.6L13.5 5.3zM10.5 5.3L3.8 9.6v3.9l6.7 4.2v-3.7l-3.5-2 3.5-2V5.3z"/></svg>';
            div.innerHTML = `
                <div class="label">Providers <span class="live">Live</span></div>
                <div class="row"><span class="glyph">${azureGlyph}</span><span>Azure</span><span class="count" id="legendAzureCount"></span></div>
                <div class="row"><span class="glyph">${awsGlyph}</span><span>AWS</span><span class="count" id="legendAwsCount"></span></div>
            `;
            return div;
        };
```

- [ ] **Step 5: Populate the legend counts dynamically**

Find the existing `updateRegionCount` function (around line 1359). After it sets `#visibleCount` and `#totalCount`, append:

```js
            const azureCount = regions.filter(r => r.provider === 'Azure').length;
            const awsCount = regions.filter(r => r.provider === 'AWS').length;
            const azureEl = document.getElementById('legendAzureCount');
            const awsEl = document.getElementById('legendAwsCount');
            if (azureEl) azureEl.textContent = azureCount;
            if (awsEl) awsEl.textContent = awsCount;
```

- [ ] **Step 6: Restyle the loading and error overlays**

Find the `#mapLoading` div (around line 689) and its inner content. Update its inline class to match the new aesthetic:

```html
        <div id="mapLoading" class="absolute inset-0 flex items-center justify-center z-[1000]" style="background: rgba(10, 13, 18, 0.92); backdrop-filter: blur(4px);">
            <div class="flex flex-col items-center gap-3">
                <svg aria-hidden="true" class="loading-spinner w-10 h-10" style="color: var(--accent);" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span style="color: var(--text-mute); font-family: 'JetBrains Mono', monospace; font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase;">Loading…</span>
            </div>
        </div>
```

Update the error overlay similarly (`#mapError`, around line 699) — same background style, ink color from tokens.

- [ ] **Step 7: Build, run, visually verify**

```bash
npm run build && npm run dev &
sleep 4
```

Open the browser. Verify:
- Map fills the available viewport edge-to-edge
- Legend at bottom-left reads `PROVIDERS · LIVE`, `Azure · 38`, `AWS · 34` (or whatever the actual counts are)
- Zoom controls (`+` / `−`) at bottom-right look like the other `.ctl` buttons
- Loading spinner is green-on-dark/light depending on theme
- No green glow around the map frame

- [ ] **Step 8: Commit**

```bash
git add layouts/index.html
git commit -m "feat(ui): restyle map chrome and legend"
```

---

### Task 6: Restructure the popup template

**Files:**
- Modify: `layouts/index.html`
  - JS: replace the popup-build loop and `popupHTML` template (around lines 1255–1330).
  - CSS: replace the Leaflet popup rules (around lines 192–296) with new tokenized rules.

- [ ] **Step 1: Replace the Leaflet popup CSS**

Find the existing block starting at `/* Leaflet popup - dark mode (default and explicit .dark) */` (around line 192) and ending after `.light .leaflet-popup-content .border-amber-500\/30 { … }` (around line 295). Replace the **entire** block with:

```css
        /* === LEAFLET POPUP === */
        .leaflet-popup-content-wrapper {
            background: var(--bg-elev) !important;
            color: var(--text) !important;
            border: 1px solid var(--border) !important;
            padding: 0 !important;
            border-radius: 10px !important;
            box-shadow:
                0 12px 40px rgba(0,0,0,0.5),
                0 0 0 1px rgba(0,255,136,0.04) !important;
            overflow: hidden;
        }
        html.light .leaflet-popup-content-wrapper {
            box-shadow:
                0 12px 40px rgba(15,20,25,0.10),
                0 0 0 1px rgba(0,128,90,0.04) !important;
        }
        .leaflet-popup-tip {
            background: var(--bg-elev) !important;
            border: 1px solid var(--border) !important;
            box-shadow: none !important;
        }
        .leaflet-container a.leaflet-popup-close-button {
            color: var(--text-mute) !important;
            font-size: 20px !important;
            width: 28px !important;
            height: 28px !important;
            padding: 4px !important;
            transition: color 0.2s, transform 0.2s;
            top: 8px !important;
            right: 8px !important;
        }
        .leaflet-container a.leaflet-popup-close-button:hover {
            color: var(--accent) !important;
            transform: scale(1.1);
        }
        .leaflet-popup-content { margin: 0 !important; width: auto !important; }

        @media (max-width: 640px) {
            .leaflet-popup-content-wrapper { max-width: calc(100vw - 40px) !important; }
            .leaflet-popup { max-width: calc(100vw - 20px) !important; }
        }

        /* Popup inner */
        .popup-card { width: 360px; max-width: calc(100vw - 40px); font-family: 'JetBrains Mono', monospace; }
        .popup-head {
            padding: 14px 16px 12px;
            border-bottom: 1px solid var(--border);
        }
        .popup-region-id {
            font-size: 9px; color: var(--text-dim);
            letter-spacing: 0.16em; text-transform: uppercase;
        }
        .popup-region-name {
            font-family: 'Space Grotesk', sans-serif;
            font-size: 19px; font-weight: 700;
            margin-top: 4px;
            letter-spacing: -0.01em;
            color: var(--text);
        }
        .popup-region-coord {
            font-size: 10px; color: var(--text-mute);
            margin-top: 6px; letter-spacing: 0.04em;
        }
        .popup-provider-strip {
            display: flex; align-items: center; gap: 10px;
            padding: 9px 16px;
            background: var(--bg-elev-2);
            border-bottom: 1px solid var(--border);
            font-size: 10px;
            color: var(--text-mute);
            text-transform: uppercase; letter-spacing: 0.12em;
        }
        .popup-provider-strip .pchip {
            display: inline-flex; align-items: center; gap: 6px;
            font-weight: 500;
        }
        .popup-provider-strip .pchip.azure { color: var(--azure); }
        .popup-provider-strip .pchip.aws { color: var(--aws); }
        .popup-provider-strip .pchip svg { width: 11px; height: 11px; }
        .popup-services { padding: 6px 16px 14px; }
        .popup-svc {
            display: grid;
            grid-template-columns: 16px 1fr auto;
            align-items: center; gap: 12px;
            padding: 9px 0;
            border-bottom: 1px solid var(--border);
            font-size: 12px;
        }
        .popup-svc:last-child { border-bottom: none; }
        .popup-svc .check { width: 14px; height: 14px; color: var(--accent); }
        .popup-svc .name {
            font-family: 'Space Grotesk', sans-serif;
            font-weight: 500;
            color: var(--text);
            letter-spacing: -0.005em;
        }
        .popup-svc .pills {
            display: flex; gap: 4px;
            font-family: 'JetBrains Mono', monospace;
            font-size: 9px;
            color: var(--text-mute);
        }
        .popup-svc .pill {
            border: 1px solid var(--border-strong);
            background: var(--bg-elev-2);
            padding: 3px 7px;
            border-radius: 4px;
            letter-spacing: 0.06em;
            text-transform: uppercase;
        }
        .popup-svc .pill.core {
            color: var(--accent);
            border-color: rgba(0, 255, 136, 0.3);
            background: rgba(0, 255, 136, 0.06);
        }
        html.light .popup-svc .pill.core {
            border-color: rgba(0, 128, 90, 0.3);
            background: rgba(0, 128, 90, 0.06);
        }
        .popup-svc .pill.noncore {
            color: var(--aws);
            border-color: rgba(255, 157, 61, 0.3);
            background: rgba(255, 157, 61, 0.06);
        }
        html.light .popup-svc .pill.noncore {
            border-color: rgba(217, 117, 6, 0.3);
            background: rgba(217, 117, 6, 0.06);
        }
        .popup-svc .available {
            font-family: 'JetBrains Mono', monospace;
            font-size: 9px;
            color: var(--text-mute);
            letter-spacing: 0.08em;
            text-transform: uppercase;
            border: 1px solid var(--border-strong);
            padding: 3px 7px;
            border-radius: 4px;
            background: var(--bg-elev-2);
        }
```

- [ ] **Step 2: Replace the popup-build JS**

Find the loop that builds `iconGrid`, `serviceList`, and `popupHTML` (around lines 1257–1329). Replace the contents starting at `let iconGrid = '';` and going through the end of `popupHTML = …;` with:

```js
                    const providerKey = region.provider.toLowerCase();
                    const providerGlyph = providerKey === 'azure'
                        ? '<svg viewBox="0 0 20 20" fill="currentColor"><path d="M7.3 2.5h4.7L7.2 17a.8.8 0 01-.7.5H2.8a.7.7 0 01-.7-1l4.5-13.5a.8.8 0 01.7-.5z"/></svg>'
                        : '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M13.5 5.3v3.7l3.5 2-3.5 2v3.7l6.7-4.2V9.6L13.5 5.3zM10.5 5.3L3.8 9.6v3.9l6.7 4.2v-3.7l-3.5-2 3.5-2V5.3z"/></svg>';

                    let serviceRows = '';
                    let svcCount = 0;

                    if (region.services) {
                        Object.keys(region.services).forEach(key => {
                            const serviceValue = region.services[key];
                            svcCount += 1;
                            const displayName = getServiceDisplayName(key, 'full');

                            const checkSvg = '<svg class="check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12l5 5L20 7"/></svg>';

                            if (serviceValue === true) {
                                serviceRows += `
                                    <div class="popup-svc">
                                        ${checkSvg}
                                        <span class="name">${displayName}</span>
                                        <span class="available">Available</span>
                                    </div>
                                `;
                            } else {
                                const configs = ensureArray(serviceValue);
                                const pills = configs
                                    .filter(c => c)
                                    .map(c => {
                                        const cls = c.tier === 'Core' ? 'pill core' : 'pill noncore';
                                        const edition = c.edition || 'Std';
                                        const tier = c.tier || 'N/A';
                                        return `<span class="${cls}">${edition} · ${tier}</span>`;
                                    })
                                    .join('');
                                serviceRows += `
                                    <div class="popup-svc">
                                        ${checkSvg}
                                        <span class="name">${displayName}</span>
                                        <span class="pills">${pills}</span>
                                    </div>
                                `;
                            }
                        });
                    }

                    const safeCoord = Array.isArray(region.coords)
                        ? `${region.coords[0].toFixed(3)}°N · ${region.coords[1].toFixed(3)}°E`
                        : '';
                    const regionIdSlug = (region.id || region.name).toLowerCase().replace(/_/g, '-');

                    const popupHTML = `
                        <div class="popup-card">
                            <div class="popup-head">
                                <div class="popup-region-id">Region // ${regionIdSlug}</div>
                                <div class="popup-region-name">${region.name}</div>
                                <div class="popup-region-coord">${safeCoord}</div>
                            </div>
                            <div class="popup-provider-strip">
                                <span class="pchip ${providerKey}">${providerGlyph} ${region.provider}</span>
                                <span style="color:var(--text-dim)">·</span>
                                <span>${svcCount} / 05 Services</span>
                            </div>
                            <div class="popup-services">${serviceRows}</div>
                        </div>
                    `;
```

Notes:
- The duplicate "VAULT" row is gone — when `vdc_vault` has multiple configs they now appear as **pills** on a single row.
- `region.coords[0].toFixed(3)` may need a null-guard if a region somehow has no coords; the existing code already filters those out at the start of the loop, so leave it.

- [ ] **Step 3: Build, run, verify by clicking a region with multiple Vault editions**

```bash
npm run build && npm run dev &
sleep 4
```

Open the browser, search for "Germany West Central" (or any Azure region with all 5 services), click it. Popup should show:
- Region ID line: `REGION // AZURE-GERMANY-WEST-CENTRAL`
- Big region name in Space Grotesk
- Coordinates line
- Provider strip with the Azure glyph in azure colour
- One row per service: Veeam Data Cloud Vault (with two pills `Foundation · Core` and `Advanced · Core` aligned right), then Microsoft 365 Protection / Microsoft Entra ID Protection / Salesforce Protection / Microsoft Azure Protection, each with an `AVAILABLE` pill.

Confirm there is **no duplicate VAULT row** anymore.

- [ ] **Step 4: Commit**

```bash
git add layouts/index.html
git commit -m "feat(ui): restructure popup template; collapse vault tiers to single row"
```

---

### Task 7: Replace circle markers with provider-shaped glyphs

**Files:**
- Modify: `layouts/index.html`
  - JS: replace the `L.circleMarker(...)` call and hover handlers (around lines 1331–1346).
  - CSS: append marker styles in the `<style>` block.

- [ ] **Step 1: Append marker styles**

Append to the `<style>` block:

```css
        /* === PROVIDER MARKERS === */
        .map-marker-dot {
            width: 22px; height: 22px;
            position: relative;
            display: flex; align-items: center; justify-content: center;
            filter: drop-shadow(0 2px 6px rgba(0,0,0,0.5));
            transition: transform 0.15s ease;
        }
        html.light .map-marker-dot {
            filter: drop-shadow(0 2px 4px rgba(15,20,25,0.25));
        }
        .map-marker-dot.azure { color: var(--azure); }
        .map-marker-dot.aws { color: var(--aws); }
        .map-marker-dot:hover { transform: scale(1.18); }
        .map-marker-dot svg { width: 100%; height: 100%; }
```

- [ ] **Step 2: Replace the marker creation block**

Find the existing block starting at `const marker = L.circleMarker(region.coords, { … }).bindPopup(popupHTML);` and including the two `marker.on('mouseover'...)` / `mouseout` handlers (around lines 1331–1346). Replace it with:

```js
                    const markerIcon = L.divIcon({
                        className: '',
                        html: `<div class="map-marker-dot ${providerKey}">${providerGlyph}</div>`,
                        iconSize: [22, 22],
                        iconAnchor: [11, 11],
                        popupAnchor: [0, -11]
                    });
                    const marker = L.marker(region.coords, {
                        icon: markerIcon,
                        keyboard: true,
                        alt: `${region.provider} region: ${region.name}`
                    }).bindPopup(popupHTML);
```

- [ ] **Step 3: Update Playwright test marker selector**

In `tests/ui.spec.ts`, find every occurrence of `path.leaflet-interactive` and replace with `.leaflet-marker-icon .map-marker-dot` (the new selector that picks up our glyph divs):

```bash
grep -n "path.leaflet-interactive" tests/ui.spec.ts
```

Replace each with:

```typescript
const markers = page.locator('.leaflet-marker-icon .map-marker-dot');
```

- [ ] **Step 4: Build, run, visually verify**

```bash
npm run build && npm run dev &
sleep 4
```

Open the browser. Verify:
- All markers are now small Azure-blue triangle or AWS-orange cube icons (NOT circles)
- Hovering a marker scales it slightly
- Clicking a marker opens the redesigned popup
- Marker clusters at low zoom still group correctly (the cluster icons themselves are not yet restyled — that's deliberate; cluster restyling is out of scope for this redesign and the existing styling remains)

- [ ] **Step 5: Run the Playwright tests**

```bash
npm run test:ui
```

Expected: tests that previously used `path.leaflet-interactive` now pass with the new `.leaflet-marker-icon .map-marker-dot` selector. If any test fails for other reasons (e.g. label text), note the failure for the next task.

- [ ] **Step 6: Commit**

```bash
git add layouts/index.html tests/ui.spec.ts
git commit -m "feat(ui): replace circle markers with provider-shaped glyph icons"
```

---

### Task 8: Update service display names, multi-select Azure rename, and initial map center

**Files:**
- Modify: `layouts/index.html`
  - JS: update `serviceDisplayNames` (around line 928–934).
  - JS: change `center: [-25, 140]` to a globally-balanced default (around line 962).
  - HTML: the multi-select option "Azure" was already renamed to "Azure Protection" in Task 3 — verify it.

- [ ] **Step 1: Update `serviceDisplayNames`**

Find the existing `serviceDisplayNames` constant (around line 928). Replace its body with:

```js
        const serviceDisplayNames = {
            'vdc_vault':         { short: 'Vault',             full: 'Veeam Data Cloud Vault' },
            'vdc_m365':          { short: 'M365',              full: 'Microsoft 365 Protection' },
            'vdc_entra_id':      { short: 'Entra ID',          full: 'Microsoft Entra ID Protection' },
            'vdc_salesforce':    { short: 'Salesforce',        full: 'Salesforce Protection' },
            'vdc_azure_backup':  { short: 'Azure Protection',  full: 'Microsoft Azure Protection' }
        };
```

These `full` names match the section headings in the official Veeam Data Cloud help-center user guide. `short` names appear in the filter-dropdown checkbox labels and the filter-button label (e.g. when only one service is selected). Note the `short` for `vdc_azure_backup` is now "Azure Protection" — this removes the collision with the "Azure" provider while staying aligned with the official "…Protection" naming.

- [ ] **Step 2: Update initial map center**

Find the `L.map('map', { … })` call (around line 961). Change `center: [-25, 140]` to `center: [25, 10]` and `zoom: 3` to `zoom: 2`:

```js
        map = L.map('map', {
            center: [25, 10],
            minZoom: 2.0,
            maxZoom: 6.0,
            zoom: 2,
            zoomControl: false,
            worldCopyJump: true,
            maxBoundsViscosity: 1.0,
            maxBounds: [[-60, -185], [90, 185]],
            fadeAnimation: !reducedMotion,
            zoomAnimation: !reducedMotion,
            markerZoomAnimation: !reducedMotion
        });
```

The new center `[25, 10]` puts Africa/Europe roughly in the centre of the viewport; at zoom 2, all continents are visible.

- [ ] **Step 3: Update Playwright test labels for the renamed Azure service**

The service-filter checkbox label is now "Azure Protection" (not "Azure"). Find each reference in `tests/ui.spec.ts`:

```bash
grep -n "name: 'Azure'" tests/ui.spec.ts
```

For each match where the context is a service-filter **checkbox** (not a provider-filter option), replace `name: 'Azure'` with `name: 'Azure Protection'`. Be careful — there's also a provider-filter test that checks `name: /azure/i` for the dropdown option; that one should remain since the provider's option is still labelled "Azure". Inspect each match's surrounding code to disambiguate before editing.

- [ ] **Step 4: Run Playwright tests again to confirm green**

```bash
npm run test:ui
```

Expected: all UI tests pass.

- [ ] **Step 5: Build and visually verify**

```bash
npm run build && npm run dev &
sleep 4
```

Open the browser. Verify:
- Initial view shows Africa centred; Europe, Americas, Asia all visible
- Service filter dropdown lists "Vault / M365 / Entra ID / Salesforce / Azure Protection"
- Popup row names match the official help-center names: "Veeam Data Cloud Vault", "Microsoft 365 Protection", "Microsoft Entra ID Protection", "Salesforce Protection", "Microsoft Azure Protection"

- [ ] **Step 6: Commit**

```bash
git add layouts/index.html tests/ui.spec.ts
git commit -m "feat(ui): adopt official Veeam help-center service names; fix initial map center"
```

---

### Task 9: Restyle the info panel (slide-out)

**Files:**
- Modify: `layouts/index.html` — info panel CSS (around lines 322–360) and HTML (around lines 718–844).

- [ ] **Step 1: Update info panel container CSS**

Find the existing `#infoPanel { … }` rule (around line 322). Replace it (and its `.dark`/`.light` siblings, plus `#infoPanelOverlay.open`, `#infoPanel.open`) with:

```css
        /* Info panel slide-out */
        #infoPanel {
            scrollbar-width: thin;
            scrollbar-color: var(--border-strong) transparent;
            transform: translateX(100%);
            transition: transform 0.28s cubic-bezier(0.25, 1, 0.5, 1);
            background: var(--bg-elev);
            border-left: 1px solid var(--border);
            color: var(--text);
            font-family: 'JetBrains Mono', monospace;
        }
        #infoPanel::-webkit-scrollbar { width: 6px; }
        #infoPanel::-webkit-scrollbar-track { background: transparent; }
        #infoPanel::-webkit-scrollbar-thumb {
            background: var(--border-strong);
            border-radius: 3px;
        }
        #infoPanel.open { transform: translateX(0); }
        #infoPanelOverlay.open { opacity: 1; }
        #infoBtn { /* uses .ctl-icon */ }
```

- [ ] **Step 2: Update info panel HTML content classes**

The info panel content is the largest single chunk to retoken. Find the `<div id="infoPanel" …>` (around line 720) and walk down to its closing `</div>` (around line 844). Update class attributes so colors come from tokens rather than Tailwind slate-* utilities:

Replace the entire `<div id="infoPanel" …>` element with:

```html
<div id="infoPanel" class="fixed top-0 right-0 h-full w-full sm:w-96 max-w-full shadow-2xl z-[2001] overflow-y-auto" role="dialog" aria-modal="true" aria-labelledby="infoPanelTitle">
    <div class="p-5" style="padding-top: calc(1.25rem + env(safe-area-inset-top));">
        <div class="flex items-center justify-between mb-4">
            <h2 id="infoPanelTitle" class="font-bold" style="font-family: 'Space Grotesk', sans-serif; font-size: 22px; letter-spacing: -0.01em;">About This Map</h2>
            <button id="closeInfoPanel" class="ctl ctl-icon" aria-label="Close panel">
                <svg aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                </svg>
            </button>
        </div>

        <div class="info-callout">
            <svg aria-hidden="true" class="info-callout-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
            </svg>
            <div>
                <p class="info-callout-title">Community Project</p>
                <p class="info-callout-body">This is an unofficial, community-maintained project. Not affiliated with or endorsed by Veeam Software. Data may be incomplete or outdated.</p>
            </div>
        </div>

        <div class="info-section">
            <h3 class="info-section-label">What is this?</h3>
            <p class="info-section-body">An interactive map visualizing Veeam Data Cloud (VDC) service availability across AWS and Azure regions. Quickly find where services like Veeam Data Cloud Vault, Microsoft 365 Protection, and more are available.</p>
        </div>

        <div class="info-stats">
            <div class="info-stat">
                <div class="info-stat-num" id="infoTotalRegions">0</div>
                <div class="info-stat-label">Total Regions</div>
            </div>
            <div class="info-stat">
                <div class="info-stat-num">5</div>
                <div class="info-stat-label">Services Tracked</div>
            </div>
        </div>

        <div class="info-section">
            <h3 class="info-section-label">Maintained By</h3>
            <a href="https://github.com/comnam90" target="_blank" rel="noopener noreferrer" class="info-link info-link-card">
                <div class="info-avatar">C</div>
                <div>
                    <div class="info-link-name">@comnam90</div>
                    <div class="info-link-sub">GitHub</div>
                </div>
                <svg aria-hidden="true" class="info-arrow" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
            </a>
        </div>

        <div class="info-section">
            <h3 class="info-section-label">Quick Links</h3>
            <div class="info-link-group">
                <a href="https://github.com/comnam90/veeam-data-cloud-services-map" target="_blank" rel="noopener noreferrer" class="info-link">
                    <svg aria-hidden="true" class="info-link-icon" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
                    <span>View on GitHub</span>
                    <svg aria-hidden="true" class="info-arrow" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
                </a>
                <a href="/api/docs" target="_blank" rel="noopener noreferrer" class="info-link">
                    <svg aria-hidden="true" class="info-link-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"/></svg>
                    <span>API Documentation</span>
                    <svg aria-hidden="true" class="info-arrow" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
                </a>
                <a href="https://www.veeam.com/products/veeam-data-cloud.html" target="_blank" rel="noopener noreferrer" class="info-link">
                    <svg aria-hidden="true" class="info-link-icon" style="color: var(--accent);" fill="currentColor" viewBox="0 0 144 144"><path d="M118.21 117.2c0 .49-.2.94-.53 1.27-.33.32-.77.53-1.27.53l-21.51.11v12.01H105c3.21 0 6.3-1.28 8.57-3.55l13.2-13.2c2.27-2.27 3.55-5.36 3.55-8.57V94.65h-12.11v22.56zM25.79 26.8c0-.49.2-.94.53-1.27.32-.32.77-.53 1.27-.53l21.51-.11V12.88H39c-3.21 0-6.3 1.28-8.57 3.55l-13.2 13.2a12.14 12.14 0 0 0-3.55 8.57v11.15h12.11V26.79zm-.47 90.68a1.8 1.8 0 0 1-.52-1.27l-.11-21.51H12.68v10.1c0 3.21 1.28 6.3 3.55 8.57l13.2 13.2c2.27 2.27 5.36 3.55 8.57 3.55h11.15v-12.11H26.59c-.49-.01-.94-.21-1.27-.54zm102.46-86.86-13.2-13.2a12.14 12.14 0 0 0-8.57-3.55H94.86v12.11h22.56c.49.01.94.21 1.27.54.32.32.52.77.52 1.27l.11 21.51h12.01V39.2c0-3.21-1.28-6.3-3.55-8.57zM71.86 78.79a6.65 6.65 0 1 0 0-13.3 6.65 6.65 0 0 0 0 13.3"/></svg>
                    <span>Official Veeam Data Cloud</span>
                    <svg aria-hidden="true" class="info-arrow" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
                </a>
            </div>
        </div>

        <div class="info-section">
            <h3 class="info-section-label">Found an Issue?</h3>
            <div class="info-link-group">
                <a href="https://github.com/comnam90/veeam-data-cloud-services-map/issues/new?template=missing-service.yml" target="_blank" rel="noopener noreferrer" class="info-link info-link-accent">
                    <svg aria-hidden="true" class="info-link-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                    <span>Report Missing Service</span>
                </a>
                <a href="https://github.com/comnam90/veeam-data-cloud-services-map/issues/new?template=missing-region.yml" target="_blank" rel="noopener noreferrer" class="info-link info-link-accent">
                    <svg aria-hidden="true" class="info-link-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                    <span>Report Missing Region</span>
                </a>
                <a href="https://github.com/comnam90/veeam-data-cloud-services-map/issues/new?template=incorrect-information.yml" target="_blank" rel="noopener noreferrer" class="info-link info-link-accent">
                    <svg aria-hidden="true" class="info-link-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
                    <span>Report Incorrect Info</span>
                </a>
            </div>
        </div>

        <div class="info-footer">
            {{ with .GitInfo }}
            <p>Last updated: {{ now.Format "January 2, 2006" }}</p>
            {{ end }}
            <p>Built with Hugo, Leaflet.js &amp; Tailwind CSS</p>
        </div>
    </div>
</div>
```

- [ ] **Step 3: Add info panel content CSS**

Append to the `<style>` block:

```css
        /* Info panel content */
        .info-callout {
            display: flex; gap: 10px;
            padding: 12px 14px;
            border-radius: 8px;
            border: 1px solid var(--accent);
            background: var(--accent-soft);
            margin-bottom: 16px;
        }
        .info-callout-icon { width: 18px; height: 18px; color: var(--accent); flex-shrink: 0; margin-top: 2px; }
        .info-callout-title {
            font-family: 'Space Grotesk', sans-serif;
            font-weight: 600;
            font-size: 13px;
            color: var(--accent);
            margin-bottom: 4px;
        }
        .info-callout-body {
            font-family: 'JetBrains Mono', monospace;
            font-size: 11px;
            color: var(--text-mute);
            line-height: 1.5;
        }
        .info-section { margin-bottom: 20px; }
        .info-section-label {
            font-family: 'JetBrains Mono', monospace;
            font-size: 10px;
            color: var(--text-dim);
            text-transform: uppercase;
            letter-spacing: 0.18em;
            margin-bottom: 10px;
        }
        .info-section-body {
            font-family: 'Space Grotesk', sans-serif;
            font-size: 14px;
            color: var(--text);
            line-height: 1.5;
        }
        .info-stats { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 20px; }
        .info-stat {
            background: var(--bg-elev-2);
            border: 1px solid var(--border);
            border-radius: 8px;
            padding: 12px;
        }
        .info-stat-num {
            font-family: 'Space Grotesk', sans-serif;
            font-weight: 700;
            font-size: 24px;
            color: var(--text);
            letter-spacing: -0.02em;
        }
        .info-stat-label {
            font-family: 'JetBrains Mono', monospace;
            font-size: 10px;
            color: var(--text-mute);
            text-transform: uppercase;
            letter-spacing: 0.1em;
            margin-top: 4px;
        }
        .info-link-group { display: flex; flex-direction: column; gap: 6px; }
        .info-link {
            display: flex; align-items: center; gap: 10px;
            padding: 10px 12px;
            background: var(--bg-elev-2);
            border: 1px solid var(--border);
            border-radius: 6px;
            font-family: 'JetBrains Mono', monospace;
            font-size: 12px;
            color: var(--text);
            text-decoration: none;
            transition: border-color 0.15s, background 0.15s;
        }
        .info-link:hover { border-color: var(--accent); background: var(--accent-soft); color: var(--accent); }
        .info-link-icon { width: 16px; height: 16px; flex-shrink: 0; color: var(--text-mute); }
        .info-link:hover .info-link-icon { color: var(--accent); }
        .info-link span { flex: 1; }
        .info-arrow { width: 12px; height: 12px; color: var(--text-dim); }
        .info-link-card { gap: 12px; padding: 10px 12px; }
        .info-avatar {
            width: 32px; height: 32px;
            border-radius: 50%;
            background: var(--accent);
            color: var(--bg);
            display: flex; align-items: center; justify-content: center;
            font-family: 'Space Grotesk', sans-serif;
            font-weight: 700;
            font-size: 13px;
            flex-shrink: 0;
        }
        .info-link-name {
            font-family: 'Space Grotesk', sans-serif;
            font-weight: 500;
            font-size: 13px;
            color: var(--text);
        }
        .info-link-sub {
            font-size: 10px;
            color: var(--text-mute);
            margin-top: 2px;
            letter-spacing: 0.04em;
        }
        .info-link-accent .info-link-icon { color: var(--accent); }
        .info-footer {
            padding-top: 16px;
            border-top: 1px solid var(--border);
            text-align: center;
        }
        .info-footer p {
            font-family: 'JetBrains Mono', monospace;
            font-size: 10px;
            color: var(--text-dim);
            margin-bottom: 4px;
            letter-spacing: 0.04em;
        }
```

- [ ] **Step 4: Build, run, verify the info panel**

```bash
npm run build && npm run dev &
sleep 4
```

Open the browser, click the (i) info button in the header. The panel slides in from the right. Verify:
- "About This Map" title in Space Grotesk
- Community Project callout uses the green accent border
- Stats cards show region counts
- Quick Links cards turn green-bordered on hover
- "Found an Issue?" cards use the green accent border throughout (no purple/blue/amber mix)
- Footer text in mono

- [ ] **Step 5: Commit**

```bash
git add layouts/index.html
git commit -m "feat(ui): retoken info panel content"
```

---

### Task 10: Final cleanup of old CSS and visual verification at both themes / viewports

**Files:**
- Modify: `layouts/index.html` — delete leftover unused CSS from prior design.

- [ ] **Step 1: Search the `<style>` block for unused rules**

Run a grep for any remaining hardcoded slate colours that were used by the old design but are no longer applied to live elements:

```bash
grep -nE "bg-slate-|text-slate-|border-slate-|#0f172a|#1e293b|#334155|#475569" layouts/index.html | head -40
```

For each match, check whether the CSS class is still used by an element in the new design. The map / overlay / Tailwind utilities you keep should be: any class that styles `info-*`, `popup-*`, `panel-*`, `ctl*`, `hud`, `status`, `brand`, `map-marker-dot`. Anything else that was specifically targeting old class names (`.header-gradient`, `.legend-container` selectors not used anymore) can be deleted.

This is housekeeping — leftover unused CSS is harmless but adds bytes. Aim to remove at least the dead `.header-gradient`, `.legend-container` (replaced by `.panel-legend`), and any `.dark` / `.light` selectors that target classes which no longer exist.

- [ ] **Step 2: Run typecheck + full build + all tests**

```bash
npm run typecheck
npm run build
npm run test:validate
npm run test:ui
```

Expected: all green.

- [ ] **Step 3: Manual verification at both themes and viewports**

Start the dev server:

```bash
npm run dev &
sleep 4
```

Use Chrome (or a manual browser) to verify each of the four states:

1. **Desktop dark (1440×900):** Open `http://localhost:8788/`. Expect: globally-centred map, status strip visible with `Online · Regions 72/72 · Providers 02 · Services 05`, marker glyphs (blue triangles for Azure, orange cubes for AWS), green pulse on the brand mark. Click a multi-service region — popup shows one row per service, Vault row has both edition pills.

2. **Desktop light (1440×900):** Click the theme toggle. Expect: cool-off-white background, same content/layout, accent is now muted green, AWS marker is darker orange.

3. **Mobile dark (393×852):** Open Chrome DevTools, switch to iPhone 15 Pro emulation. Expect: status strip hidden, controls wrap, marker popup fits within `calc(100vw - 40px)`, info panel takes full width when opened.

4. **Mobile light (393×852):** Toggle theme. Same checks.

Capture a screenshot for each of the four states and inspect for issues:
- No console errors
- No layout overflow (`document.documentElement.scrollWidth === window.innerWidth`)
- No flash of unstyled content on load
- Theme toggle persists across reloads (localStorage check)
- Reduced-motion users don't see the pulse on the brand mark — but this is fine, the existing `@media (prefers-reduced-motion: reduce)` rule already overrides it.

- [ ] **Step 4: Commit any cleanup changes**

```bash
git add layouts/index.html
git commit -m "chore(ui): remove unused old-design CSS"
```

- [ ] **Step 5: Open a PR**

```bash
git push -u origin <branch-name>
gh pr create --title "feat(ui): mission control redesign" --body "$(cat <<'EOF'
## Summary

- Redesigns the SPA with a paired dark / light "Mission Control / Workstation" aesthetic
- Replaces generic SaaS look with characterful Space Grotesk + JetBrains Mono typography
- Restructures popup: one row per service, edition pills aligned right (fixes Vault duplication)
- Replaces circle markers with provider-shaped glyphs
- Adopts the official Veeam help-center service names: Veeam Data Cloud Vault, Microsoft 365 Protection, Microsoft Entra ID Protection, Salesforce Protection, Microsoft Azure Protection
- Renames the "Azure" service filter to "Azure Protection" to remove collision with the Azure provider
- Fixes initial map centre (Australia → globally-balanced)
- Adds live data strip in the header (Online indicator, region count, provider/service counts)
- Both themes are first-class — same layout, same components, theme tokens only

## Test plan

- [ ] `npm run typecheck` passes
- [ ] `npm run build` passes
- [ ] `npm run test:ui` — all Playwright tests pass after marker selector + "Azure Protection" label updates
- [ ] Desktop dark — manual check
- [ ] Desktop light — manual check
- [ ] Mobile dark (iPhone 15 Pro) — manual check
- [ ] Mobile light — manual check
- [ ] Theme toggle persists across reload
- [ ] Popup shows Vault edition pills correctly when both Foundation and Advanced are present in a region
- [ ] Reduced-motion preference suppresses the brand mark pulse

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-Review

**Spec coverage** — Each item from the agreed scope ("Full redesign to A-v2 + A-2") is covered:

| Spec item | Covered by |
|---|---|
| Typography (Space Grotesk + JetBrains Mono) | Task 2 |
| Color tokens (dark + light) | Task 2 |
| Header restructure | Task 3 |
| Controls restyle | Task 4 |
| Popup restructure | Task 6 |
| Glyph markers | Task 7 |
| Status strip | Task 3 |
| Both themes | All tasks via `:root` + `html.light` tokens |
| Map chrome (no brackets/grid/scan-line) | Task 5 |
| Mobile breakpoints | Distributed (Task 3 hud, Task 4 controls, Task 6 popup, Task 9 info panel) |
| Vault duplication fix | Task 6 |
| Service display names | Task 8 |
| Initial map center | Task 8 |
| Supersede old plan | Task 1 |

**Placeholder scan** — No TBDs, no "Add appropriate error handling", no "implement later", no "similar to Task N" without showing the code. Every CSS block, JS replacement, and HTML chunk is given in full.

**Type consistency** — Reviewed: `providerKey`, `serviceDisplayNames`, `popupHTML`, `markerIcon` are used consistently across Tasks 6, 7, 8. Marker selector `.leaflet-marker-icon .map-marker-dot` is used identically in the JS (Task 7) and Playwright tests (Task 7 Step 3).

**Other notes for the executing engineer:**

- The `info-section .info-section-body` uses Space Grotesk (sans-serif) but the rest of body copy is JetBrains Mono. This is intentional — body prose reads better in proportional type while UI labels stay mono.
- Cluster styling (`.cluster-small`, `.cluster-medium`, `.cluster-large`) is left untouched on purpose. A redesign of clusters belongs to a follow-up; the current cluster pulse and provider-stripe indicator works fine with the new marker glyphs.
- If `npm run test:ui` flakes on WebKit due to existing Leaflet instability (CLAUDE.md notes this), use `--project=chromium` for the verification run.
- Hugo's `{{ with .GitInfo }}…{{ end }}` in the info-panel footer remains untouched — it must still render at build time.
