/**
 * Data access layer for region information
 * Loads regions from the generated JSON file
 */

import regionsData from './regions.json';

/**
 * Get all regions
 * @returns {Array} Array of all region objects
 */
export function getRegions() {
  return regionsData;
}

/**
 * Get a specific region by ID
 * @param {string} id - Region ID (e.g., "aws-us-east-1")
 * @returns {Object|undefined} Region object or undefined if not found
 */
export function getRegionById(id) {
  return regionsData.find(r => r.id === id);
}

/**
 * Get regions filtered by provider
 * @param {string} provider - Provider name ("AWS" or "Azure")
 * @returns {Array} Filtered array of regions
 */
export function getRegionsByProvider(provider) {
  return regionsData.filter(r => r.provider === provider);
}

/**
 * Get regions that have a specific service
 * @param {string} serviceName - Service name (e.g., "vdc_vault", "vdc_m365")
 * @returns {Array} Filtered array of regions
 */
export function getRegionsByService(serviceName) {
  return regionsData.filter(r => r.services && r.services[serviceName]);
}

/**
 * Get statistics about regions
 * @returns {Object} Statistics object
 */
export function getRegionStats() {
  const awsRegions = regionsData.filter(r => r.provider === 'AWS');
  const azureRegions = regionsData.filter(r => r.provider === 'Azure');

  return {
    totalRegions: regionsData.length,
    awsRegions: awsRegions.length,
    azureRegions: azureRegions.length
  };
}
