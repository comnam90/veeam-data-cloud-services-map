/**
 * GET /api/v1/health
 * Health check endpoint with API statistics
 */

import { getRegions, getRegionStats } from '../../../shared/data.js';
import { jsonResponse, handleOptions } from '../../../shared/response.js';

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
