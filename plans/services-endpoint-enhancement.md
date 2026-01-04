# Services Endpoint Enhancement Plan

**Created:** 2026-01-04
**Status:** In Progress
**Feature:** Enhanced service statistics and detailed service endpoints

## Overview

Enhance the `/api/v1/services` endpoint and add a new `/api/v1/services/:serviceId` endpoint to provide regional availability statistics for each VDC service.

## Problem Statement

The current `/api/v1/services` endpoint provides basic metadata about available VDC services (name, description, type, editions, tiers) but lacks information about:
- How many regions support each service
- Which specific regions support a given service
- Breakdown of availability by cloud provider
- For tiered services (vdc_vault), which edition/tier combinations are available in how many regions

This makes it difficult to:
- Compare service coverage (e.g., "vdc_m365 is available in 23 regions vs vdc_salesforce in 12 regions")
- Identify all regions supporting a specific service programmatically
- Understand service distribution across AWS and Azure

## Proposed Solution

### 1. Enhance `/api/v1/services` Endpoint

**Current Response:**
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
    }
  ],
  "count": 5
}
```

**Enhanced Response:**
```json
{
  "services": [
    {
      "id": "vdc_vault",
      "name": "Veeam Data Cloud Vault",
      "type": "tiered",
      "description": "Immutable backup storage with configurable pricing tiers",
      "editions": ["Foundation", "Advanced"],
      "tiers": ["Core", "Non-Core"],
      "regionCount": 80,
      "providerBreakdown": {
        "AWS": 29,
        "Azure": 51
      },
      "configurationBreakdown": {
        "Foundation-Core": 12,
        "Foundation-Non-Core": 18,
        "Advanced-Core": 45,
        "Advanced-Non-Core": 8
      }
    },
    {
      "id": "vdc_m365",
      "name": "VDC for Microsoft 365",
      "type": "boolean",
      "description": "Backup and recovery for Microsoft 365 data",
      "regionCount": 23,
      "providerBreakdown": {
        "AWS": 0,
        "Azure": 23
      }
    }
  ],
  "count": 5
}
```

**New Fields:**
- `regionCount`: Total number of regions where service is available
- `providerBreakdown`: Count of regions per cloud provider (AWS/Azure)
- `configurationBreakdown`: (tiered services only) Count of regions per edition-tier combination

### 2. Create `/api/v1/services/:serviceId` Endpoint

**Endpoint:** `GET /api/v1/services/:serviceId`

**Path Parameters:**
- `serviceId` (required): Service identifier (vdc_vault, vdc_m365, vdc_entra_id, vdc_salesforce, vdc_azure_backup)

**Response (Boolean Service - vdc_m365):**
```json
{
  "service": {
    "id": "vdc_m365",
    "name": "VDC for Microsoft 365",
    "type": "boolean",
    "description": "Backup and recovery for Microsoft 365 data",
    "regionCount": 23
  },
  "regions": [
    "azure-au-east",
    "azure-brazil-south",
    "azure-canada-central",
    "..."
  ],
  "providerBreakdown": {
    "AWS": {
      "count": 0,
      "regions": []
    },
    "Azure": {
      "count": 23,
      "regions": ["azure-au-east", "azure-brazil-south", "..."]
    }
  }
}
```

**Response (Tiered Service - vdc_vault):**
```json
{
  "service": {
    "id": "vdc_vault",
    "name": "Veeam Data Cloud Vault",
    "type": "tiered",
    "description": "Immutable backup storage with configurable pricing tiers",
    "editions": ["Foundation", "Advanced"],
    "tiers": ["Core", "Non-Core"],
    "regionCount": 80
  },
  "regions": [
    "aws-af-south-1",
    "aws-ap-east-1",
    "..."
  ],
  "providerBreakdown": {
    "AWS": {
      "count": 29,
      "regions": ["aws-af-south-1", "aws-ap-east-1", "..."]
    },
    "Azure": {
      "count": 51,
      "regions": ["azure-au-east", "azure-australia-southeast", "..."]
    }
  },
  "configurationBreakdown": {
    "Foundation-Core": {
      "count": 12,
      "regions": ["aws-eu-north-1", "aws-eu-south-2", "..."]
    },
    "Foundation-Non-Core": {
      "count": 18,
      "regions": ["aws-af-south-1", "aws-ap-northeast-1", "..."]
    },
    "Advanced-Core": {
      "count": 45,
      "regions": ["aws-af-south-1", "aws-ap-east-1", "..."]
    },
    "Advanced-Non-Core": {
      "count": 8,
      "regions": ["azure-brazil-south", "azure-us-east", "..."]
    }
  }
}
```

**Error Response (404 - Service Not Found):**
```json
{
  "error": "Service not found",
  "code": "SERVICE_NOT_FOUND",
  "message": "Service with ID 'invalid_service' does not exist",
  "parameter": "serviceId",
  "value": "invalid_service",
  "allowedValues": ["vdc_vault", "vdc_m365", "vdc_entra_id", "vdc_salesforce", "vdc_azure_backup"]
}
```

## Implementation Plan

### Phase 1: Data Layer Enhancements
**File:** `src/functions/utils/data.ts`

1. Add `getServiceStatistics()` function to calculate region counts per service
2. Add `getServiceById()` function to retrieve a single service with statistics
3. Add `getServiceRegions()` function to get all regions supporting a service
4. Add helper functions for provider and configuration breakdowns

### Phase 2: Schema Definitions
**File:** `src/functions/schemas/common.ts`

1. Update `ServiceSchema` to include optional statistics fields
2. Create `ServiceStatisticsSchema` for detailed service info
3. Create `ProviderBreakdownSchema` for per-provider region lists
4. Create `ConfigurationBreakdownSchema` for tiered service configurations
5. Update error schema to include `SERVICE_NOT_FOUND` code

### Phase 3: Update Existing Services Endpoint
**File:** `src/functions/routes/v1/services.ts`

1. Import statistics functions from `utils/data.ts`
2. Update response to include statistics for each service
3. Update OpenAPI schema to document new fields

### Phase 4: Create Service Detail Endpoint
**File:** `src/functions/routes/v1/services-by-id.ts` (new)

1. Define path parameter schema for `serviceId`
2. Create route definition with OpenAPI metadata
3. Implement handler:
   - Validate serviceId
   - Return 404 if service doesn't exist
   - Return detailed service info with region lists
4. Export registration function

### Phase 5: Route Registration
**File:** `src/functions/_worker.ts`

1. Import `registerServiceByIdRoute`
2. Register route in route registration section
3. Ensure proper ordering (before catch-all routes if any)

### Phase 6: Documentation Updates

**Files to update:**
- `ARCHITECTURE.md`: Add new endpoint to route list, update examples
- `TESTING.md`: Add test cases for new endpoints
- `README.md`: Update API examples if present

### Phase 7: Testing

**Type Safety:**
```bash
npm run typecheck
```

**Manual Testing (after deployment):**
```bash
# Test enhanced services endpoint
curl /api/v1/services

# Test service detail endpoint
curl /api/v1/services/vdc_m365
curl /api/v1/services/vdc_vault
curl /api/v1/services/vdc_entra_id
curl /api/v1/services/vdc_salesforce
curl /api/v1/services/vdc_azure_backup

# Test error handling
curl /api/v1/services/invalid_service  # Should return 404

# Verify OpenAPI spec
curl /api/openapi.json
```

## Data Calculation Logic

### Region Count Calculation

**For Boolean Services:**
```typescript
regions.filter(r => r.services[serviceId] === true).length
```

**For Tiered Services (vdc_vault):**
```typescript
regions.filter(r =>
  Array.isArray(r.services.vdc_vault) &&
  r.services.vdc_vault.length > 0
).length
```

### Provider Breakdown

```typescript
regions.reduce((acc, region) => {
  if (hasService(region, serviceId)) {
    acc[region.provider] = (acc[region.provider] || 0) + 1
  }
  return acc
}, { AWS: 0, Azure: 0 })
```

### Configuration Breakdown (vdc_vault only)

```typescript
regions.reduce((acc, region) => {
  region.services.vdc_vault?.forEach(config => {
    const key = `${config.edition}-${config.tier}`
    if (!acc[key]) {
      acc[key] = { count: 0, regions: [] }
    }
    acc[key].count++
    acc[key].regions.push(region.id)
  })
  return acc
}, {})
```

## Benefits

1. **Developer Experience:** Easily compare service coverage without manual counting
2. **Planning:** Quickly identify which regions support required services
3. **Multi-region Deployments:** Get complete list of eligible regions for a service
4. **Service Coverage Insights:** Understand distribution across cloud providers
5. **Tiered Service Planning:** For vdc_vault, see which regions support specific edition/tier combos

## Breaking Changes

None. This enhancement is fully backward compatible:
- Existing `/api/v1/services` endpoint adds optional fields
- New endpoint `/api/v1/services/:serviceId` is additive

## Performance Considerations

- All statistics calculated from in-memory JSON data (no database)
- Computation happens once per request (could be cached if needed)
- Data size is small (~80 regions, 5 services)
- Expected response time: <10ms
- No impact on existing endpoint performance

## Future Enhancements

Potential follow-up features:
- Query parameters for `/api/v1/services/:serviceId` to filter regions by provider
- Aggregate statistics endpoint (`/api/v1/statistics`)
- Geographic grouping (by continent, country)
- Historical availability tracking
- Service comparison endpoint

## Timeline

- **Phase 1-2:** Data layer & schemas (~30 min)
- **Phase 3-4:** Endpoint implementation (~45 min)
- **Phase 5-6:** Registration & docs (~20 min)
- **Phase 7:** Testing & validation (~15 min)
- **Total:** ~2 hours

## Success Criteria

- ✅ `/api/v1/services` returns statistics for all services
- ✅ `/api/v1/services/:serviceId` returns detailed service info with region lists
- ✅ Invalid service IDs return proper 404 error
- ✅ TypeScript compilation succeeds
- ✅ OpenAPI spec includes new endpoints
- ✅ Documentation updated
- ✅ All test cases pass
