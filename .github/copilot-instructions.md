# Copilot Instructions for Veeam Cloud Service Map

## Project Overview
A Hugo static site displaying an interactive Leaflet.js map of Veeam Data Cloud (VDC) service availability across AWS and Azure regions. Data-driven architecture—**no HTML changes needed to add regions**.

## Architecture
- **Hugo** generates static HTML by injecting YAML data into `layouts/index.html`
- **Data flow**: `data/regions/*.yaml` → Hugo template → JavaScript object `regions[]` → Leaflet markers
- Single-page app with all logic in `layouts/index.html` (no separate JS files)

## Adding New Regions (Most Common Task)
Create a new file in `data/regions/` with this structure:

```yaml
id: "provider-region-code"           # Unique identifier
name: "Human Readable Name"          # Display name for popup
provider: "AWS"                      # MUST be exactly "AWS" or "Azure" (case-sensitive)
coords: [-33.8688, 151.2093]         # [latitude, longitude] as array
services:
  vdc_vault:                         # Tiered service (see below)
    - edition: "Advanced"
      tier: "Core"                   # "Core" or "Non-Core"
  vdc_m365: true                     # Boolean service (available or not listed)
```

### Service Types
**Tiered services** (edition + tier matter per region):
- `vdc_vault` - Veeam Data Cloud Vault

**Boolean services** (available globally with same editions, just mark presence):
- `vdc_m365` - Veeam Data Cloud for Microsoft 365 (Flex/Express/Premium available everywhere)
- `vdc_entra_id` - Veeam Data Cloud for Entra ID
- `vdc_salesforce` - Veeam Data Cloud for Salesforce
- `vdc_azure_backup` - Veeam Data Cloud for Azure

### Valid Service Keys
- `vdc_vault` - Veeam Data Cloud Vault (tiered: edition + Core/Non-Core)
- `vdc_m365` - Veeam Data Cloud for Microsoft 365 (boolean: `true` if available)
- `vdc_entra_id` - Veeam Data Cloud for Entra ID (boolean: `true` if available)
- `vdc_salesforce` - Veeam Data Cloud for Salesforce (boolean: `true` if available)
- `vdc_azure_backup` - Veeam Data Cloud for Azure (boolean: `true` if available)

### Critical Conventions
- **Provider values are case-sensitive**: Use exactly `"AWS"` or `"Azure"`
- **Coords must be an array**, not a string: `coords: [-33, 151]` ✓ vs `coords: "[-33, 151]"` ✗
- **Tiered services use arrays**: `vdc_vault` contains an array of `{edition, tier}` objects
- **Boolean services use `true`**: `vdc_m365`, `vdc_entra_id`, `vdc_salesforce`, `vdc_azure_backup` are just `true` if available

### Tier Pricing Context (VDC Vault)
- **Core**: Standard pricing ($14/TB Foundation, $24/TB Advanced)
- **Non-Core**: Price uplift applies—used for less common regions

## Development Commands
```bash
hugo server          # Dev server at http://localhost:1313 with hot reload
hugo                 # Build to public/ directory
```

## Deployment
- **Target**: GitHub Pages (via GitHub Actions - not yet configured)
- **TODO**: Create `.github/workflows/hugo.yml` for automated deployment
- Region data is manually maintained—no external sync or validation required

## Modifying the Map UI
All UI code lives in `layouts/index.html`:
- **Service icons**: `getServiceIcon()` function (~line 130) - inline SVGs keyed by service name
- **Provider colors**: `getProviderBadgeColor()` function (~line 145) - returns Tailwind classes
- **Filters**: Dropdowns in navbar section (~lines 55-70) - add `<option>` for new services
- **Map styling**: CartoDB Dark Matter tiles; change `L.tileLayer` URL for different theme

## Adding a New Service Type
1. Add YAML entries under the new service key in region files
2. Add icon SVG to `getServiceIcon()` in `layouts/index.html`
3. Add `<option value="service_key">Display Name</option>` to `#serviceFilter` dropdown

**Note**: Keep filter dropdown in sync with valid service keys—missing options is a known issue to watch for.

## File Structure Reference
```
data/regions/          # Region YAML files (main data source)
layouts/index.html     # Single template with all HTML, CSS, JS
static/icons/          # Static assets (currently unused)
config.yaml            # Hugo config (minimal settings)
```

## Keeping Instructions Current
**When making changes, flag if this file needs updating:**
- Adding a new service key? Update "Valid Service Keys" section
- Adding new filter types or UI components? Document in "Modifying the Map UI"
- Changing data structure in YAML? Update the example in "Adding New Regions"
- Setting up GitHub Actions deployment? Remove the TODO and document the workflow

**Also check if `README.md` needs updating:**
- New service keys should be added to "Available Keys" section
- Changes to dev workflow or prerequisites
- New customization options or file structure changes

If you notice these instructions or the README are outdated or missing context that would have helped, suggest specific updates.
