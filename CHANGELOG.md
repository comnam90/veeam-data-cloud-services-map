# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.3.0] - 2026-05-20

### Added
- Sync filter state to URL query params for shareable filtered views (#91)
- Playwright UI test suite with 33 tests covering search, filters, theme, popups, accessibility, and responsive design
- Playwright UI tests job in PR validation CI workflow, reusing the Hugo build artifact from the existing build job

### Fixed
- Scraper: ignore `<table class="Note">` admonitions when parsing region tables (#99)
- UI: dark mode select colours, safe area bottom padding, and error copy (#88)
- UI: add `aria-hidden` to decorative SVGs for screen reader correctness (#87)
- UI: align map UI with interface guidelines (#40)
- Map: open popup for regions selected from search results, including clustered markers (#77)

### Changed
- Bump hono from 4.12.7 to 4.12.18 (#92, #93, #94)
- Bump yaml from 2.8.2 to 2.8.3 (#89)

### Documentation
- Refresh `CLAUDE.md` with accurate paths and pointers (#97)

## [1.2.0] - 2026-03-21

### Added
- Azure Poland Central (Warsaw) region with VDC for Microsoft 365 and Entra ID support (#74)

### Changed
- Bump hono from 4.11.7 to 4.12.7 (#72)
- Bump undici and wrangler to latest versions (#73)

## [1.1.2] - 2025-01-22

### Fixed
- Add missing VDC for Azure service to NZ North and Austria East regions (#64)
- Add 8 missing Azure regions for VDC for Azure support (#63)
- Add missing VDC services to Azure regions (#52)

## [1.1.1] - 2025-01-03

### Added
- Comprehensive gitflow release guide (`GITFLOW_RELEASE_GUIDE.md`)
- AWS Taipei region corrected to `ap-east-2` (#45)
- VDC M365 service added to Azure Korea Central (#43)

### Changed
- Bump hono from 4.11.4 to 4.11.7 (#41)
- Bump wrangler from 4.54.0 to 4.59.1 (#39)

## [1.1.0] - 2024-12-29

### Added
- REST API for programmatic access to service availability data (Hono + Cloudflare Workers)
- OpenAPI/Scalar interactive API documentation at `/api/docs`
- `/api/v1/regions/nearest` endpoint to find closest regions by coordinates
- `/api/v1/regions/compare` endpoint to compare service availability across regions
- `/api/v1/services/{serviceId}` endpoint with detailed per-service region lists
- Region data for additional AWS and Azure regions
- Automated region scraping and validation pipeline
- LLM-friendly documentation (`static/llms.txt`, `static/llms-full.txt`)

### Changed
- Migrated deployment to Cloudflare Pages (from GitHub Pages)
- Region data moved to individual YAML files per region

## [1.0.0] - 2024-12-01

### Added
- Initial interactive map using Hugo, Leaflet.js, and Tailwind CSS
- YAML-driven region data for AWS and Azure regions
- Service filtering by provider, service type, and pricing tier
- Dark-mode map with CartoDB Dark Matter tiles
- GitHub Actions CI/CD pipeline

[1.2.0]: https://github.com/comnam90/veeam-data-cloud-services-map/compare/v1.1.2...v1.2.0
[1.1.2]: https://github.com/comnam90/veeam-data-cloud-services-map/compare/v1.1.1...v1.1.2
[1.1.1]: https://github.com/comnam90/veeam-data-cloud-services-map/compare/v1.1.0...v1.1.1
[1.1.0]: https://github.com/comnam90/veeam-data-cloud-services-map/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/comnam90/veeam-data-cloud-services-map/releases/tag/v1.0.0
