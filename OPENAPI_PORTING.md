# OpenAPI Documentation Porting Status

## Overview

This document tracks the porting of LLM-optimized OpenAPI documentation from `static/api/openapi.yaml` (696 lines) into code-driven generation using Hono and Zod.

## Completed

✅ **Infrastructure Setup**
- Created `functions/schemas/common.ts` with reusable, documented schemas
- Demonstrated rich documentation pattern with RegionSchema
- Demonstrated parameter-level and schema-level descriptions
- Demonstrated "when to use" style documentation in description fields

✅ **Schema Documentation**
- RegionSchema with full field descriptions
- RegionServicesSchema with service explanations
- VdcVaultConfigSchema with tier and edition details
- ErrorResponseSchema with error code explanations

## Pattern Established

The common.ts file demonstrates the pattern for all schemas:

```typescript
export const RegionSchema = z.object({
  id: z.string().openapi({
    description: `
Unique identifier for this cloud region in the format "provider-region-code".
Use this ID when calling the /api/v1/regions/{id} endpoint to get details
about a specific region. The ID is stable and will not change.
    `.trim(),
    pattern: '^(aws|azure)-[a-z0-9-]+$',
    example: 'aws-us-east-1',
  }),
  // ... more fields with rich descriptions
}).openapi('Region')
```

## Remaining Work

The following route files should be updated to use the enhanced schemas from `common.ts` and add rich descriptions:

### High Priority
- [ ] `routes/v1/regions.ts` - Use common.ts schemas, add full endpoint description
- [ ] `routes/v1/regions-by-id.ts` - Use common.ts schemas, enhance descriptions
- [ ] `routes/v1/services.ts` - Add service catalog documentation

### Medium Priority
- [ ] `routes/v1/health.ts` - Add health status explanations
- [ ] `routes/v1/ping.ts` - Add connectivity test documentation

### Endpoint Descriptions to Port

From openapi.yaml, each endpoint needs:

1. **Summary**: One-line description (already present)
2. **Description**: Multi-paragraph explanation with:
   - What the endpoint does
   - "When to use this endpoint" section
   - "How filtering works" (for regions endpoint)
   - "Response includes" section
   - Use case examples

3. **Parameter Descriptions**: Each query/path parameter needs:
   - Schema-level description (what the data is)
   - Parameter-level description (how to use it)
   - Examples with context
   - Valid values explanation

4. **Response Descriptions**: Each response needs:
   - Success scenario explanation
   - Error scenario explanation
   - What each field means and how to use it

## Time Estimate

- Complete porting of all 5 endpoints: **4-6 hours**
- Testing and validation: **1 hour**
- **Total**: 5-7 hours

## Benefits of Code-Driven Documentation

Once complete:
- ✅ Single source of truth (docs = code)
- ✅ Type safety ensures accuracy
- ✅ Automatic updates when code changes
- ✅ IDE support while developing
- ✅ Runtime validation matches docs
- ✅ No documentation drift possible

## How to Complete

1. Update each route file to import from `common.ts`:
   ```typescript
   import { RegionSchema, ErrorResponseSchema } from '../../schemas/common'
   ```

2. Replace inline schemas with imported ones

3. Add rich descriptions to route definitions:
   ```typescript
   const route = createRoute({
     method: 'get',
     path: '/api/v1/regions',
     summary: '...',
     description: `
       Multi-line rich description here...

       **When to use this endpoint:**
       - Use case 1
       - Use case 2
     `,
     // ... rest of route
   })
   ```

4. Add parameter descriptions:
   ```typescript
   provider: z.enum(['AWS', 'Azure']).optional().openapi({
     description: 'Detailed explanation...',
     param: {
       description: 'Short param description'
     },
     example: 'AWS'
   })
   ```

5. Test with `npm run typecheck`

6. Verify generated OpenAPI at `/api/openapi.json`

## Current Status

**Phase 5 Status**: Foundation complete, patterns demonstrated
**Next Steps**: Apply patterns to all route files (4-6 hours estimated)
