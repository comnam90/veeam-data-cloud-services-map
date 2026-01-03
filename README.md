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

## 📡 API Documentation

The map data is also exposed as a REST API for programmatic access. Perfect for CI/CD pipelines, monitoring systems, mobile apps, or automation.

### Base URL

```
https://vdcmap.bcthomas.com
```

### Interactive Documentation

- **Swagger UI:** [/api/docs/](https://vdcmap.bcthomas.com/api/docs/)
- **OpenAPI Spec:** [/api/openapi.yaml](https://vdcmap.bcthomas.com/api/openapi.yaml)

### Endpoints

#### `GET /api/v1/health`

Health check with statistics.

**Response:**
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "timestamp": "2025-01-03T10:30:00Z",
  "environment": "production",
  "stats": {
    "totalRegions": 63,
    "awsRegions": 27,
    "azureRegions": 36
  }
}
```

#### `GET /api/v1/ping`

Simple connectivity test (no data dependencies).

#### `GET /api/v1/services`

List all available VDC services with metadata.

**Response:**
```json
{
  "services": [
    {
      "id": "vdc_vault",
      "name": "Veeam Data Cloud Vault",
      "type": "tiered",
      "description": "Immutable backup storage with configurable pricing tiers",
      "editions": ["Foundation", "Advanced"],
      "tiers": ["Core", "Non-Core"]
    },
    {
      "id": "vdc_m365",
      "name": "VDC for Microsoft 365",
      "type": "boolean",
      "description": "Backup and recovery for Microsoft 365 data"
    }
    // ... more services
  ],
  "count": 5
}
```

#### `GET /api/v1/regions`

List all cloud regions with optional filters.

**Query Parameters:**
- `provider` - Filter by cloud provider (`AWS` | `Azure`)
- `country` - Filter by country name (searches region name and aliases)
- `service` - Filter by VDC service availability (`vdc_vault` | `vdc_m365` | `vdc_entra_id` | `vdc_salesforce` | `vdc_azure_backup`)
- `tier` - Filter by pricing tier (`Core` | `Non-Core`) - only for `vdc_vault`
- `edition` - Filter by edition (`Foundation` | `Advanced`) - only for `vdc_vault`

**Examples:**

```bash
# All regions
curl https://vdcmap.bcthomas.com/api/v1/regions

# All AWS regions
curl https://vdcmap.bcthomas.com/api/v1/regions?provider=AWS

# Regions with VDC Vault
curl https://vdcmap.bcthomas.com/api/v1/regions?service=vdc_vault

# Japanese regions with VDC Vault Core tier
curl https://vdcmap.bcthomas.com/api/v1/regions?country=Japan&service=vdc_vault&tier=Core

# Azure regions with M365 protection
curl https://vdcmap.bcthomas.com/api/v1/regions?provider=Azure&service=vdc_m365
```

**Response:**
```json
{
  "data": [
    {
      "id": "aws-us-east-1",
      "name": "US East 1 (N. Virginia)",
      "provider": "AWS",
      "coords": [38.9, -77.4],
      "aliases": ["Virginia", "N. Virginia", "US East", "IAD"],
      "services": {
        "vdc_vault": [
          {
            "edition": "Foundation",
            "tier": "Core"
          },
          {
            "edition": "Advanced",
            "tier": "Core"
          }
        ]
      }
    }
    // ... more regions
  ],
  "count": 63,
  "filters": {
    "provider": null,
    "country": null,
    "service": null,
    "tier": null,
    "edition": null
  }
}
```

#### `GET /api/v1/regions/{id}`

Get details for a specific region by ID.

**Example:**
```bash
curl https://vdcmap.bcthomas.com/api/v1/regions/aws-us-east-1
```

### Response Codes

- `200 OK` - Successful request
- `400 Bad Request` - Invalid query parameter
- `404 Not Found` - Region not found
- `500 Internal Server Error` - Server error

### CORS

All endpoints support CORS with `Access-Control-Allow-Origin: *` for public access.

### Rate Limiting

Currently no rate limiting. Please be respectful of the free hosting.

### Development & Testing

```bash
# Install dependencies
npm install

# Start local development server with API
npm run dev

# Run API tests
npm test

# Build for production
npm run build
```

The API is built with Cloudflare Pages Functions and automatically deployed on every push to `main`.
