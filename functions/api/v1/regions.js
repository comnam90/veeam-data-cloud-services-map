/**
 * GET /api/v1/regions
 * List all regions with optional filtering
 */

import regionsData from '../../regions.json';

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

// Error response helper
function errorResponse(error, code, status = 400, additionalInfo = {}) {
  const errorData = {
    error,
    code,
    message: error,
    ...additionalInfo,
  };
  const headers = {
    'Content-Type': 'application/json',
    'X-API-Version': '1.0.0',
    ...corsHeaders(),
    ...securityHeaders(),
  };
  return new Response(JSON.stringify(errorData, null, 2), { status, headers });
}

// Handle OPTIONS requests
function handleOptions() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(),
  });
}

// Validate query parameter
function validateParam(paramName, value, allowedValues) {
  if (value && !allowedValues.includes(value)) {
    return errorResponse(
      'Invalid parameter',
      'INVALID_PARAMETER',
      400,
      {
        parameter: paramName,
        value: value,
        allowedValues: allowedValues,
      }
    );
  }
  return null;
}

// Get all regions
function getRegions() {
  return regionsData;
}

export async function onRequestGet(context) {
  const { searchParams } = new URL(context.request.url);

  // Get query parameters
  const provider = searchParams.get('provider');
  const service = searchParams.get('service');
  const tier = searchParams.get('tier');
  const edition = searchParams.get('edition');
  const country = searchParams.get('country');

  // Validate parameters
  const providerValidation = validateParam('provider', provider, ['AWS', 'Azure']);
  if (providerValidation) return providerValidation;

  const serviceValidation = validateParam('service', service, [
    'vdc_vault',
    'vdc_m365',
    'vdc_entra_id',
    'vdc_salesforce',
    'vdc_azure_backup'
  ]);
  if (serviceValidation) return serviceValidation;

  const tierValidation = validateParam('tier', tier, ['Core', 'Non-Core']);
  if (tierValidation) return tierValidation;

  const editionValidation = validateParam('edition', edition, ['Foundation', 'Advanced']);
  if (editionValidation) return editionValidation;

  // Get all regions
  let regions = getRegions();

  // Apply filters
  if (provider) {
    regions = regions.filter(r => r.provider === provider);
  }

  if (country) {
    const countryLower = country.toLowerCase();
    regions = regions.filter(r => {
      // Check if country matches the name or any alias
      if (r.name.toLowerCase().includes(countryLower)) return true;
      if (r.aliases && Array.isArray(r.aliases)) {
        return r.aliases.some(alias => alias.toLowerCase().includes(countryLower));
      }
      return false;
    });
  }

  if (service) {
    regions = regions.filter(r => {
      const hasService = r.services && r.services[service];
      if (!hasService) return false;

      // For boolean services, just check existence
      if (typeof r.services[service] === 'boolean') {
        return r.services[service];
      }

      // For tiered services (vdc_vault), check array
      return Array.isArray(r.services[service]) && r.services[service].length > 0;
    });
  }

  // Filter by tier (only applicable to vdc_vault)
  if (tier && service === 'vdc_vault') {
    regions = regions.filter(r => {
      return r.services.vdc_vault?.some(v => v.tier === tier);
    });
  }

  // Filter by edition (only applicable to vdc_vault)
  if (edition && service === 'vdc_vault') {
    regions = regions.filter(r => {
      return r.services.vdc_vault?.some(v => v.edition === edition);
    });
  }

  // Return filtered results
  return jsonResponse({
    data: regions,
    count: regions.length,
    filters: {
      provider: provider || null,
      service: service || null,
      tier: tier || null,
      edition: edition || null,
      country: country || null
    }
  });
}

export async function onRequestOptions(context) {
  return handleOptions();
}
