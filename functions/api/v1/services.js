/**
 * GET /api/v1/services
 * List available Veeam Data Cloud services with metadata
 */

// CORS headers
function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

// Security headers
function securityHeaders() {
  return {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
  };
}

// JSON response helper
function jsonResponse(data, status = 200, additionalHeaders = {}) {
  const headers = {
    'Content-Type': 'application/json',
    'X-API-Version': '1.0.0',
    'Cache-Control': 'public, max-age=3600',
    ...corsHeaders(),
    ...securityHeaders(),
    ...additionalHeaders,
  };
  return new Response(JSON.stringify(data, null, 2), { status, headers });
}

// Handle OPTIONS requests
function handleOptions() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(),
  });
}

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
