/**
 * GET /api/v1/debug
 * Debug endpoint to check if regions.json can be imported
 */

let regionsData;
let importError = null;

try {
  regionsData = await import('../../regions.json').then(m => m.default || m);
} catch (error) {
  importError = error.message;
}

export async function onRequestGet(context) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'X-API-Version': '1.0.0',
  };

  const response = {
    status: importError ? 'error' : 'ok',
    timestamp: new Date().toISOString(),
    environment: context.env.ENVIRONMENT || 'unknown',
    regionsJsonImport: {
      success: !importError,
      error: importError,
      dataLoaded: regionsData ? true : false,
      regionCount: regionsData ? regionsData.length : 0,
      firstRegion: regionsData && regionsData.length > 0 ? {
        id: regionsData[0].id,
        name: regionsData[0].name,
        provider: regionsData[0].provider
      } : null
    }
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
