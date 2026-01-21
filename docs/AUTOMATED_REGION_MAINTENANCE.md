# Automated Region Maintenance - Implementation Summary

## Overview
This document describes the automated region maintenance system for the Veeam Data Cloud Services Map. The system automatically scrapes official Veeam documentation, compares it with the repository data, and creates GitHub issues for discrepancies.

## Components

### 1. Web Scraper (`scripts/scrape-veeam-regions.js`)
**Purpose**: Fetch and parse Veeam helpcenter documentation pages to extract service availability information.

**Key Features**:
- Fetches HTML from 4 Veeam helpcenter URLs
- Parses HTML tables to extract region information (provider, region name, region code)
- Implements retry logic with exponential backoff (3 attempts)
- Normalizes region codes and provider names for comparison
- Loads current repository region data from YAML files
- Compares scraped data with repository data
- Generates `region-discrepancies.json` with findings

**URLs Scraped**:
- M365: https://helpcenter.veeam.com/docs/vdc/userguide/m365_region_availability.html
- Azure: https://helpcenter.veeam.com/docs/vdc/userguide/azure_regions.html
- Entra ID: https://helpcenter.veeam.com/docs/vdc/userguide/entra_id_regions.html
- Salesforce: https://helpcenter.veeam.com/docs/vdc/userguide/sf_regions.html

**Output**: `region-discrepancies.json` containing:
```json
{
  "timestamp": "2026-01-21T19:33:00Z",
  "scrapedRegions": 42,
  "currentRegions": 63,
  "discrepancies": {
    "missingRegions": [...],      // Regions in docs but not in repo
    "missingServices": [...],     // Services available but not listed
    "extraServices": [...]        // Services listed but not in docs (informational)
  },
  "errors": [...]                 // Scraping failures
}
```

### 2. Issue Generator (`scripts/create-region-issues.js`)
**Purpose**: Generate GitHub issue data from discrepancies.

**Key Features**:
- Reads `region-discrepancies.json`
- Formats three types of issues:
  1. **Missing Region**: Region exists in Veeam docs but not in repo
  2. **Missing Service**: Service available in region but not listed
  3. **Extra Service**: Service listed but not found in docs (verification needed)
- Limits to 10 issues per run to avoid spam
- Supports dry-run mode for testing
- Can skip "extra service" issues (via `--skip-extra-services` flag)
- Generates `issues-to-create.json` for GitHub Actions to process

**Issue Labels**:
- `automated`: All automated issues
- `missing-region`: Missing region issues
- `missing-service`: Missing service issues
- `needs-verification`: Extra service issues
- `data-correction`: All correction issues

### 3. GitHub Actions Workflow (`.github/workflows/region-maintenance.yml`)
**Purpose**: Run the scraper weekly and create GitHub issues automatically.

**Schedule**: Every Monday at 9:00 AM UTC (via cron: `0 9 * * 1`)

**Manual Trigger**: Available via workflow_dispatch with optional dry-run mode

**Workflow Steps**:
1. Checkout repository
2. Setup Node.js 20 with npm cache
3. Install dependencies
4. Run scraper (`scripts/scrape-veeam-regions.js`)
5. Check for discrepancies
   - Parse `region-discrepancies.json`
   - Count missing regions, missing services, extra services
   - Detect complete scraping failures
6. Generate issue data (`scripts/create-region-issues.js`)
   - Skip extra services if 2+ scraping errors
7. Create GitHub issues
   - Use GitHub CLI (`gh`)
   - Check for duplicates before creating
   - Rate limit: 1 second between issues
8. Upload artifacts (discrepancies and issues JSON files)
9. Post workflow summary

**Error Handling**:
- If all 4 services fail to scrape: No issues created (network issue)
- If 2+ services fail: Skip "extra services" issues (likely false positives)
- If only missing regions/services found: Create issues normally

**Permissions**:
- `contents: read`: Read repository data
- `issues: write`: Create issues

### 4. Test Suite (`scripts/test-scraper.js`)
**Purpose**: Comprehensive tests for scraper functionality.

**Test Coverage** (12 tests):
1. `normalizeRegionCode` removes spaces and special characters
2. `parseRegionTable` parses HTML table structure
3. `findMatchingRegion` finds regions by ID
4. `findMatchingRegion` respects provider when specified
5. `compareRegions` detects missing regions
6. `compareRegions` detects missing services
7. `compareRegions` skips vault in extra services
8. `formatMissingRegionIssue` creates valid issue format
9. `formatMissingServiceIssue` creates valid issue format
10. `formatExtraServiceIssue` creates valid issue format
11. `VEEAM_DOCS_URLS` contains all required URLs
12. `SERVICE_NAMES` provides display names

**Run Tests**: `npm run test:scraper`

## Usage

### Local Development
```bash
# Install dependencies
npm install

# Run scraper (will fail if network blocked, but handles gracefully)
npm run scrape:regions

# Generate issues in dry-run mode
node scripts/create-region-issues.js region-discrepancies.json --dry-run

# Generate issues skipping extra services
node scripts/create-region-issues.js region-discrepancies.json --skip-extra-services

# View results
cat region-discrepancies.json | jq
cat issues-to-create.json | jq
```

### GitHub Actions
```bash
# View workflow runs
gh run list --workflow=region-maintenance.yml

# Manually trigger workflow
gh workflow run region-maintenance.yml

# Manually trigger with dry-run
gh workflow run region-maintenance.yml -f dry_run=true

# View workflow logs
gh run view <run-id> --log
```

## Design Decisions

### Why Parse HTML Instead of Using an API?
Veeam doesn't provide a public API for service availability. The helpcenter pages are the authoritative source, so we parse HTML tables.

### Why Skip VDC Vault?
VDC Vault availability is not publicly documented in the helpcenter pages that we scrape. It must be maintained manually.

### Why Limit to 10 Issues Per Run?
To avoid spam if there are many discrepancies. The workflow can run multiple times to create all issues gradually.

### Why Skip "Extra Services" on Scraping Failures?
If we can't scrape the data, all services in our repo will appear as "extra" (false positives). This would create noise without value.

### Why Use Retry Logic?
Network requests can fail temporarily. Retrying with exponential backoff improves reliability without overwhelming servers.

### Why Normalize Region Codes?
Different sources may format region codes differently (e.g., "us-east-1" vs "us_east_1" vs "US East 1"). Normalization enables accurate matching.

## Maintenance

### Adding a New Service
1. Add the service URL to `VEEAM_DOCS_URLS` in `scripts/scrape-veeam-regions.js`
2. Add the service display name to `SERVICE_NAMES` in `scripts/create-region-issues.js`
3. Update the README documentation
4. Add tests for the new service

### Modifying Parsing Logic
The `parseRegionTable()` function may need updates if Veeam changes their HTML table structure. Check the function if scraping starts failing consistently.

### Updating the Schedule
Edit the cron expression in `.github/workflows/region-maintenance.yml`:
```yaml
schedule:
  - cron: '0 9 * * 1'  # Monday at 9 AM UTC
```

## Troubleshooting

### Workflow Not Creating Issues
1. Check workflow runs in GitHub Actions
2. Review the workflow summary for error messages
3. Download artifacts to inspect `region-discrepancies.json`
4. Check if scraping errors are preventing issue creation

### False Positives
If the workflow creates incorrect issues, it may be due to:
1. HTML parsing issues (update `parseRegionTable()`)
2. Region matching problems (check `normalizeRegionCode()`)
3. Scraping failures (check for network errors in logs)

### Testing Changes
Always test locally before pushing:
```bash
npm run test:scraper    # Run tests
npm run scrape:regions  # Test scraper
node scripts/create-region-issues.js region-discrepancies.json --dry-run
```

## Future Improvements

### Potential Enhancements
1. **Machine learning**: Train a model to improve HTML parsing accuracy
2. **Historical tracking**: Store snapshots of Veeam docs to detect changes over time
3. **Auto-PR creation**: Automatically create PRs for simple changes (e.g., new regions)
4. **Webhook integration**: Trigger scraping when Veeam docs are updated
5. **Dashboard**: Create a web dashboard showing scraping history and trends
6. **Email notifications**: Send summary emails to maintainers
7. **Vault scraping**: If Veeam publishes Vault availability, add it to the scraper

### Known Limitations
1. **HTML parsing fragility**: Changes to Veeam's HTML structure may break parsing
2. **Manual verification required**: Automated issues still need human review
3. **No real-time updates**: Weekly schedule means up to 7 days lag
4. **No Vault support**: Vault availability must be manually maintained

## Security Considerations

### Permissions
The workflow uses minimal permissions:
- `contents: read`: Only reads repository files
- `issues: write`: Only creates issues (can't close or modify existing ones)

### Secrets
No secrets are required. The workflow uses `GITHUB_TOKEN` which is automatically provided.

### Rate Limiting
- GitHub API: Respects GitHub's rate limits with 1-second delays
- Veeam helpcenter: Uses retry logic with exponential backoff

### Input Validation
All scraped data is validated before use to prevent injection attacks.

## Contact
For questions or issues with the automated region maintenance system, please open an issue in the repository with the `automated` label.

---
**Last Updated**: 2026-01-21
**Version**: 1.0.0
