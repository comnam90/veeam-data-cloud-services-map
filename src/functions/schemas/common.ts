/**
 * Common OpenAPI schemas with rich LLM-optimized documentation
 * Ported from static/api/openapi.yaml
 */

import { z } from '@hono/zod-openapi'

/**
 * VDC Vault service configuration with tier and edition
 */
export const VdcVaultConfigSchema = z.object({
  edition: z.enum(['Foundation', 'Advanced']).openapi({
    description: `
Service edition level. Foundation provides core backup and recovery features.
Advanced includes additional capabilities like compliance features and
ransomware protection.
    `.trim(),
    example: 'Advanced',
  }),
  tier: z.enum(['Core', 'Non-Core']).openapi({
    description: `
Pricing tier. Core tier offers premium performance and lower latency at higher
cost. Non-Core tier is optimized for cost-effective long-term retention.
    `.trim(),
    example: 'Core',
  }),
})

/**
 * Region services with detailed descriptions
 */
export const RegionServicesSchema = z.object({
  vdc_vault: z.array(VdcVaultConfigSchema).optional().openapi({
    description: `
Veeam Data Cloud Vault availability in this region. This is a tiered service,
meaning different edition and tier combinations may be available. Each array
element represents one available combination.

- edition: Foundation (entry-level) or Advanced (full-featured)
- tier: Core (premium performance) or Non-Core (cost-optimized)

A region may offer multiple combinations (e.g., both Foundation/Core and Advanced/Core).
If this property is absent, VDC Vault is not available in this region.
    `.trim(),
  }),
  vdc_m365: z.boolean().optional().openapi({
    description: `
Indicates whether VDC for Microsoft 365 is available in this region. This service
provides backup and recovery for Exchange Online, SharePoint Online, OneDrive for
Business, and Microsoft Teams. True means available, false or absent means not available.
    `.trim(),
  }),
  vdc_entra_id: z.boolean().optional().openapi({
    description: `
Indicates whether VDC for Entra ID (formerly Azure Active Directory) is available
in this region. This service protects Azure AD identities, groups, and configurations.
True means available, false or absent means not available.
    `.trim(),
  }),
  vdc_salesforce: z.boolean().optional().openapi({
    description: `
Indicates whether VDC for Salesforce is available in this region. This service
provides backup and recovery for Salesforce CRM data, metadata, and configurations.
True means available, false or absent means not available.
    `.trim(),
  }),
  vdc_azure_backup: z.boolean().optional().openapi({
    description: `
Indicates whether VDC for Azure is available in this region. This service provides
backup and recovery for Azure virtual machines and other Azure resources.
True means available, false or absent means not available.
    `.trim(),
  }),
})

/**
 * Complete region schema with all documentation
 */
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
  name: z.string().openapi({
    description: `
Human-readable display name for the region, typically matching the official
name used by the cloud provider. This is what users will recognize when
selecting regions in a UI.
    `.trim(),
    example: 'US East 1 (N. Virginia)',
  }),
  provider: z.enum(['AWS', 'Azure']).openapi({
    description: `
The cloud provider that operates this region. Currently supports Amazon Web
Services (AWS) and Microsoft Azure. Use this field to group or filter regions
by cloud provider when building multi-cloud solutions.
    `.trim(),
    example: 'AWS',
  }),
  coords: z.tuple([z.number(), z.number()]).openapi({
    description: `
Geographic coordinates of the region's approximate data center location,
provided as [latitude, longitude]. Use these coordinates for:
- Displaying regions on a map visualization
- Calculating distance from user location to find nearest region
- Meeting data residency requirements based on geography
Coordinates are approximate and represent the general area, not exact facility locations.
    `.trim(),
    example: [38.9, -77.4],
  }),
  aliases: z.array(z.string()).optional().openapi({
    description: `
Alternative names and common abbreviations for this region that users might
search for. Includes country names, city names, airport codes, and colloquial
terms. When using the country parameter in /api/v1/regions, these aliases are
searched along with the official region name. For example, "IAD" is an alias
for "US East 1 (N. Virginia)".
    `.trim(),
    example: ['Virginia', 'N. Virginia', 'US East', 'IAD'],
  }),
  services: RegionServicesSchema.openapi({
    description: `
Complete catalog of Veeam Data Cloud services available in this region.
Services are included only if available; absent properties mean that service
is not offered in this region. Service availability determines where you can
deploy VDC workloads.
    `.trim(),
  }),
}).openapi('Region')

/**
 * Error response schema
 */
export const ErrorResponseSchema = z.object({
  error: z.string().openapi({
    description: `
Short, human-readable error title suitable for displaying to users.
This is a brief summary of what went wrong.
    `.trim(),
    example: 'Region not found',
  }),
  code: z.string().openapi({
    description: `
Machine-readable error code in SCREAMING_SNAKE_CASE format. Use this code
to programmatically handle specific error conditions. Common codes include:
- REGION_NOT_FOUND: Requested region ID doesn't exist
- INVALID_PARAMETER: Query parameter has invalid value
- INVALID_PROVIDER: Provider must be "AWS" or "Azure"
- INVALID_SERVICE: Service ID not recognized
- INVALID_TIER: Tier must be "Core" or "Non-Core"
- INVALID_EDITION: Edition must be "Foundation" or "Advanced"
    `.trim(),
    pattern: '^[A-Z_]+$',
    example: 'REGION_NOT_FOUND',
  }),
  message: z.string().openapi({
    description: `
Detailed, developer-friendly error message explaining what went wrong and
how to fix it. This message includes specific details like the invalid value
provided and what values are acceptable. LLMs and automated systems can use
this message to automatically correct and retry requests.
    `.trim(),
    example: 'No region found with ID: invalid-region-id',
  }),
  parameter: z.string().optional().openapi({
    description: `
The name of the query parameter or path parameter that caused the error.
Only present when the error is related to a specific parameter. Use this
to highlight the problematic field in error messages or forms.
    `.trim(),
    example: 'provider',
  }),
  value: z.string().optional().openapi({
    description: `
The invalid value that was provided for the parameter. Only present when
the error is related to an invalid parameter value. Use this to show users
exactly what they sent that was incorrect.
    `.trim(),
    example: 'GCP',
  }),
  allowedValues: z.array(z.string()).optional().openapi({
    description: 'List of valid values for the parameter',
    example: ['AWS', 'Azure'],
  }),
}).openapi('Error')
