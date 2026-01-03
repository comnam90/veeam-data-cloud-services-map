/**
 * Response utilities for Cloudflare Pages Functions
 * Handles CORS, JSON formatting, and error responses
 */

/**
 * Get CORS headers
 * @returns {Object} CORS headers object
 */
export function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400', // 24 hours
  };
}

/**
 * Get security headers
 * @returns {Object} Security headers object
 */
export function securityHeaders() {
  return {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
  };
}

/**
 * Create a successful JSON response with CORS headers
 * @param {*} data - Data to return in response body
 * @param {number} status - HTTP status code (default: 200)
 * @param {Object} additionalHeaders - Additional headers to include
 * @returns {Response} Cloudflare Response object
 */
export function jsonResponse(data, status = 200, additionalHeaders = {}) {
  const headers = {
    'Content-Type': 'application/json',
    'X-API-Version': '1.0.0',
    'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
    ...corsHeaders(),
    ...securityHeaders(),
    ...additionalHeaders,
  };

  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers,
  });
}

/**
 * Create an error response
 * @param {string} error - Short error description
 * @param {string} code - Machine-readable error code
 * @param {number} status - HTTP status code (default: 400)
 * @param {Object} additionalInfo - Additional error information
 * @returns {Response} Cloudflare Response object
 */
export function errorResponse(error, code, status = 400, additionalInfo = {}) {
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

  return new Response(JSON.stringify(errorData, null, 2), {
    status,
    headers,
  });
}

/**
 * Handle OPTIONS requests for CORS preflight
 * @returns {Response} Cloudflare Response object
 */
export function handleOptions() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(),
  });
}

/**
 * Validate query parameter value against allowed values
 * @param {string} paramName - Parameter name
 * @param {string} value - Parameter value
 * @param {Array<string>} allowedValues - Array of allowed values
 * @returns {Response|null} Error response if invalid, null if valid
 */
export function validateParam(paramName, value, allowedValues) {
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
