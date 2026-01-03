/**
 * GET /api/v1/regions
 * List all regions with optional filtering
 */

import { getRegions } from '../../../shared/data.js';
import { jsonResponse, errorResponse, handleOptions, validateParam } from '../../../shared/response.js';

export async function onRequestGet(context) {
  const { searchParams } = new URL(context.request.url);

  // Get query parameters
  const provider = searchParams.get('provider');
  const service = searchParams.get('service');
  const tier = searchParams.get('tier');
  const edition = searchParams.get('edition');

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
      edition: edition || null
    }
  });
}

export async function onRequestOptions(context) {
  return handleOptions();
}
