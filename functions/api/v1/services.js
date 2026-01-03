/**
 * GET /api/v1/services
 * List available Veeam Data Cloud services with metadata
 */

import { jsonResponse, handleOptions } from '../../../_shared/response.js';

export async function onRequestGet(context) {
  const services = [
    {
      id: "vdc_vault",
      name: "Veeam Data Cloud Vault",
      type: "tiered",
      description: "Immutable backup storage with configurable pricing tiers",
      editions: ["Foundation", "Advanced"],
      tiers: ["Core", "Non-Core"]
    },
    {
      id: "vdc_m365",
      name: "VDC for Microsoft 365",
      type: "boolean",
      description: "Backup and recovery for Microsoft 365 data",
      editions: ["Flex", "Express", "Premium"]
    },
    {
      id: "vdc_entra_id",
      name: "VDC for Entra ID",
      type: "boolean",
      description: "Backup and recovery for Microsoft Entra ID (Azure AD)"
    },
    {
      id: "vdc_salesforce",
      name: "VDC for Salesforce",
      type: "boolean",
      description: "Backup and recovery for Salesforce data"
    },
    {
      id: "vdc_azure_backup",
      name: "VDC for Azure",
      type: "boolean",
      description: "Native Azure backup capabilities"
    }
  ];

  return jsonResponse({
    services,
    count: services.length
  });
}

export async function onRequestOptions(context) {
  return handleOptions();
}
