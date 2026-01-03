/**
 * GET /api/v1/regions/{id}
 * Get a specific region by ID
 */

import regionsData from '../../../regions.json';

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

// Get region by ID
function getRegionById(id) {
  return regionsData.find(r => r.id === id);
}

export async function onRequestGet(context) {
  const { id } = context.params;

  // Get the region
  const region = getRegionById(id);

  // Return 404 if not found
  if (!region) {
    return errorResponse(
      'Region not found',
      'REGION_NOT_FOUND',
      404,
      {
        message: `No region found with ID: ${id}`,
        requestedId: id
      }
    );
  }

  // Return the region
  return jsonResponse(region);
}

export async function onRequestOptions(context) {
  return handleOptions();
}
