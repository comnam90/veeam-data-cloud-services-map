# Veeam Cloud Service Map 🗺️

> ⚠️ **Community Project Disclaimer:** This is an unofficial, community-maintained project and is **not affiliated with, endorsed by, or supported by Veeam Software**. The information provided may be incomplete or outdated. Always refer to [official Veeam documentation](https://www.veeam.com/) for authoritative service availability information. Use at your own risk—no warranty or liability is provided.

A lightweight, interactive map to visualize Veeam Data Cloud (VDC) services across AWS and Azure regions. Designed to quickly answer "Where is X available?" without navigating complex spreadsheets.

**🎉 New:** Now includes a REST API for programmatic access to service availability data! See the [API Documentation](#-api-documentation) section below.

## 🚀 Tech Stack

* **Framework:** [Hugo](https://gohugo.io/) (Static Site Generator)
* **Styling:** [Tailwind CSS](https://tailwindcss.com/) (via CDN for simplicity)
* **Map Engine:** [Leaflet.js](https://leafletjs.com/) (OpenStreetMap/CartoDB Dark Matter tiles)
* **Data Source:** YAML files in `data/regions/` (No database required)

## 🛠️ Quick Start

### 1. Prerequisites

You need **Hugo** installed on your machine.

* **Windows (Chocolatey):** `choco install hugo-extended`
* **macOS (Brew):** `brew install hugo`
* **Linux:** `sudo apt-get install hugo`

### 2. Run Locally

Clone this repo and run the server:

```bash
hugo server
````

Navigate to `http://localhost:1313/`. The site will auto-reload when you edit files.

## 📝 Managing Data (The Important Part)

The map is data-driven. You do not need to touch the HTML to add a new location. Just add a new YAML file to `data/regions/`.

### Adding a New Region

1. Copy the template file: `.github/region-template.yaml`
2. Place it in the appropriate folder: `data/regions/aws/` or `data/regions/azure/`
3. Rename following the convention: `{provider}_{region_code}.yaml` (e.g., `aws_us_east_1.yaml`)
4. Fill in the details and delete any services not available in that region

```yaml
id: "aws-us-east-1"                 # Unique ID
name: "US East (N. Virginia)"       # Display Name
provider: "AWS"                     # "AWS" or "Azure" (Case sensitive for icon/color)
coords: [38.0339, -78.5079]         # [Latitude, Longitude]
aliases:                            # Optional: searchable alternative names
  - "Virginia"
  - "US East"

services:
  # Boolean Service - just mark as available (editions are universal)
  vdc_m365: true

  # Tiered Service - editions and tiers vary by region
  vdc_vault:
    - edition: "Advanced"
      tier: "Core"
    - edition: "Foundation"
      tier: "Non-Core"
```

### Available Keys

**Tiered Services** (edition + tier per region):
* `vdc_vault` - Veeam Data Cloud Vault (Core/Non-Core pricing tiers)

**Boolean Services** (just `true` if available):
* `vdc_m365` - VDC for Microsoft 365 (Flex/Express/Premium editions available in all M365 regions)
* `vdc_entra_id` - VDC for Entra ID
* `vdc_salesforce` - VDC for Salesforce
* `vdc_azure_backup` - VDC for Azure

*Note: New service keys will automatically appear in the popup, but you may need to add a matching SVG icon in `layouts/index.html` if you want a custom logo for it.*

## ⚙️ How it Works

1. **Data Injection:** Hugo reads all YAML files in `data/regions` and injects them into the HTML as a JavaScript object `const regions = [...]`.
2. **Normalization:** A script runs on page load to fix common data entry errors (like strings wrapped in quotes) so the map doesn't crash.
3. **Rendering:** Leaflet.js loops through this data. If a region matches the active filters (Provider/Service/Tier), it draws a circle marker.
4. **Popups:** Clicking a marker generates an HTML popup on the fly using the data attributes.

## 🤝 Contributing

Found incorrect or missing data? We have issue templates to make reporting easy:

* **[Report Missing Service](../../issues/new?template=missing-service.yml)** - Service missing from an existing region
* **[Report Missing Region](../../issues/new?template=missing-region.yml)** - Entire region not on the map
* **[Report Incorrect Info](../../issues/new?template=incorrect-information.yml)** - Wrong coordinates, tier, etc.

Want to submit a fix directly? PRs welcome! The PR template will guide you through providing source verification.

## 🎨 Customization

* **Icons:** defined in the `getServiceIcon()` function in `layouts/index.html`. They are inline SVGs.
* **Colors:** Provider badge colors are set in `getProviderBadgeColor()`.
* **Map Style:** The base map is "CartoDB Dark Matter". You can change the `L.tileLayer` URL in `index.html` if you want a light mode map.
