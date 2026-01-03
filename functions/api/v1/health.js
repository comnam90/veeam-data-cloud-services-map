/**
 * GET /api/v1/health
 * Health check endpoint with API statistics
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

// Handle OPTIONS requests
function handleOptions() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(),
  });
}

// Get region statistics
function getRegionStats() {
  const awsRegions = regionsData.filter(r => r.provider === 'AWS');
  const azureRegions = regionsData.filter(r => r.provider === 'Azure');
  return {
    totalRegions: regionsData.length,
    awsRegions: awsRegions.length,
    azureRegions: azureRegions.length
  };
}

export async function onRequestGet(context) {
  const stats = getRegionStats();

  return jsonResponse({
    status: "healthy",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
    environment: context.env.ENVIRONMENT || "unknown",
    stats: {
      totalRegions: stats.totalRegions,
      awsRegions: stats.awsRegions,
      azureRegions: stats.azureRegions
    }
  });
}

export async function onRequestOptions(context) {
  return handleOptions();
}
