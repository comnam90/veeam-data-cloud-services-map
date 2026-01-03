/**
 * GET /api/v1/ping
 * Simple ping endpoint to test if Functions are working (no data dependencies)
 */

export async function onRequestGet(context) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'X-API-Version': '1.0.0',
  };

  const response = {
    status: 'ok',
    message: 'Cloudflare Pages Functions are working!',
    timestamp: new Date().toISOString(),
    environment: context.env.ENVIRONMENT || 'unknown',
  };

  return new Response(JSON.stringify(response, null, 2), {
    status: 200,
    headers,
  });
}

export async function onRequestOptions(context) {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
