/**
 * GET /api/v1/regions/{id}
 * Get a specific region by ID
 */

import { getRegionById } from '../../../../shared/data.js';
import { jsonResponse, errorResponse, handleOptions } from '../../../../shared/response.js';

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
