/**
 * API Integration Tests
 *
 * Tests all API endpoints to ensure they return expected responses.
 * Run with: npm test
 */

const { spawn } = require('child_process');
const http = require('http');

const BASE_URL = 'http://localhost:8788';
const TESTS_PASSED = [];
const TESTS_FAILED = [];

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function makeRequest(path) {
  return new Promise((resolve, reject) => {
    http.get(`${BASE_URL}${path}`, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, data: json, headers: res.headers });
        } catch (error) {
          resolve({ status: res.statusCode, data, headers: res.headers, parseError: error });
        }
      });
    }).on('error', reject);
  });
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function test(name, fn) {
  try {
    await fn();
    TESTS_PASSED.push(name);
    console.log(`${colors.green}✓${colors.reset} ${name}`);
  } catch (error) {
    TESTS_FAILED.push({ name, error: error.message });
    console.log(`${colors.red}✗${colors.reset} ${name}`);
    console.log(`  ${colors.red}${error.message}${colors.reset}`);
  }
}

async function runTests() {
  console.log(`\n${colors.cyan}🧪 Running API Tests${colors.reset}\n`);

  // Health endpoint tests
  await test('GET /api/v1/health returns 200', async () => {
    const res = await makeRequest('/api/v1/health');
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.data.status === 'healthy', `Expected status 'healthy', got '${res.data.status}'`);
    assert(typeof res.data.stats === 'object', 'Expected stats object');
    assert(typeof res.data.stats.totalRegions === 'number', 'Expected totalRegions to be a number');
  });

  await test('GET /api/v1/health includes correct headers', async () => {
    const res = await makeRequest('/api/v1/health');
    assert(res.headers['content-type'].includes('application/json'), 'Expected JSON content type');
    assert(res.headers['x-api-version'] === '1.0.0', 'Expected API version header');
    assert(res.headers['access-control-allow-origin'] === '*', 'Expected CORS header');
  });

  // Ping endpoint tests
  await test('GET /api/v1/ping returns 200', async () => {
    const res = await makeRequest('/api/v1/ping');
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.data.status === 'ok', `Expected status 'ok', got '${res.data.status}'`);
  });

  // Services endpoint tests
  await test('GET /api/v1/services returns all services', async () => {
    const res = await makeRequest('/api/v1/services');
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(Array.isArray(res.data.services), 'Expected services array');
    assert(res.data.services.length === 5, `Expected 5 services, got ${res.data.services.length}`);
    assert(res.data.count === 5, `Expected count 5, got ${res.data.count}`);
  });

  await test('GET /api/v1/services includes vdc_vault with correct structure', async () => {
    const res = await makeRequest('/api/v1/services');
    const vault = res.data.services.find(s => s.id === 'vdc_vault');
    assert(vault, 'vdc_vault service not found');
    assert(vault.type === 'tiered', 'vdc_vault should be tiered');
    assert(Array.isArray(vault.editions), 'vdc_vault should have editions array');
    assert(Array.isArray(vault.tiers), 'vdc_vault should have tiers array');
  });

  await test('GET /api/v1/services includes regionCount for all services', async () => {
    const res = await makeRequest('/api/v1/services');
    assert(res.data.services.every(s => typeof s.regionCount === 'number'), 'All services should have regionCount');
    assert(res.data.services.every(s => s.regionCount >= 0), 'All regionCounts should be non-negative');
  });

  await test('GET /api/v1/services includes providerBreakdown for all services', async () => {
    const res = await makeRequest('/api/v1/services');
    assert(res.data.services.every(s => s.providerBreakdown), 'All services should have providerBreakdown');
    assert(res.data.services.every(s => typeof s.providerBreakdown.AWS === 'number'), 'All should have AWS count');
    assert(res.data.services.every(s => typeof s.providerBreakdown.Azure === 'number'), 'All should have Azure count');
  });

  await test('GET /api/v1/services provider breakdown sums match regionCount', async () => {
    const res = await makeRequest('/api/v1/services');
    res.data.services.forEach(service => {
      const sum = service.providerBreakdown.AWS + service.providerBreakdown.Azure;
      assert(sum === service.regionCount,
        `${service.id}: provider breakdown sum (${sum}) should equal regionCount (${service.regionCount})`);
    });
  });

  await test('GET /api/v1/services vdc_vault includes configurationBreakdown', async () => {
    const res = await makeRequest('/api/v1/services');
    const vault = res.data.services.find(s => s.id === 'vdc_vault');
    assert(vault.configurationBreakdown, 'vdc_vault should have configurationBreakdown');
    assert(typeof vault.configurationBreakdown === 'object', 'configurationBreakdown should be an object');
    // Check for expected edition-tier combinations
    const keys = Object.keys(vault.configurationBreakdown);
    assert(keys.length > 0, 'configurationBreakdown should have entries');
    assert(keys.every(k => k.includes('-')), 'All keys should follow "Edition-Tier" format');
  });

  await test('GET /api/v1/services boolean services do not have configurationBreakdown', async () => {
    const res = await makeRequest('/api/v1/services');
    const booleanServices = res.data.services.filter(s => s.type === 'boolean');
    assert(booleanServices.length > 0, 'Should have boolean services');
    assert(booleanServices.every(s => !s.configurationBreakdown),
      'Boolean services should not have configurationBreakdown');
  });

  // Service detail endpoint tests
  await test('GET /api/v1/services/vdc_m365 returns service details', async () => {
    const res = await makeRequest('/api/v1/services/vdc_m365');
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.data.service.id === 'vdc_m365', 'Service ID should match');
    assert(res.data.service.type === 'boolean', 'vdc_m365 should be boolean');
    assert(Array.isArray(res.data.regions), 'Should have regions array');
    assert(res.data.providerBreakdown, 'Should have providerBreakdown');
  });

  await test('GET /api/v1/services/vdc_vault returns service details with configurations', async () => {
    const res = await makeRequest('/api/v1/services/vdc_vault');
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.data.service.id === 'vdc_vault', 'Service ID should match');
    assert(res.data.service.type === 'tiered', 'vdc_vault should be tiered');
    assert(Array.isArray(res.data.service.editions), 'Should have editions');
    assert(Array.isArray(res.data.service.tiers), 'Should have tiers');
    assert(res.data.configurationBreakdown, 'Should have configurationBreakdown');
  });

  await test('GET /api/v1/services/{id} provider breakdown has region lists', async () => {
    const res = await makeRequest('/api/v1/services/vdc_m365');
    assert(res.data.providerBreakdown.AWS, 'Should have AWS breakdown');
    assert(res.data.providerBreakdown.Azure, 'Should have Azure breakdown');
    assert(typeof res.data.providerBreakdown.AWS.count === 'number', 'AWS should have count');
    assert(Array.isArray(res.data.providerBreakdown.AWS.regions), 'AWS should have regions array');
    assert(typeof res.data.providerBreakdown.Azure.count === 'number', 'Azure should have count');
    assert(Array.isArray(res.data.providerBreakdown.Azure.regions), 'Azure should have regions array');
  });

  await test('GET /api/v1/services/{id} data consistency checks', async () => {
    const res = await makeRequest('/api/v1/services/vdc_m365');
    // Region count should match array length
    assert(res.data.regions.length === res.data.service.regionCount,
      `regions array length (${res.data.regions.length}) should match regionCount (${res.data.service.regionCount})`);
    // Provider breakdown counts should sum to total
    const awsCount = res.data.providerBreakdown.AWS.count;
    const azureCount = res.data.providerBreakdown.Azure.count;
    assert(awsCount + azureCount === res.data.service.regionCount,
      'Provider breakdown counts should sum to total regionCount');
    // Provider breakdown region lists should match counts
    assert(res.data.providerBreakdown.AWS.regions.length === awsCount,
      'AWS regions array should match AWS count');
    assert(res.data.providerBreakdown.Azure.regions.length === azureCount,
      'Azure regions array should match Azure count');
  });

  await test('GET /api/v1/services/vdc_vault configuration breakdown has region lists', async () => {
    const res = await makeRequest('/api/v1/services/vdc_vault');
    const configBreakdown = res.data.configurationBreakdown;
    assert(configBreakdown, 'Should have configurationBreakdown');
    const configs = Object.values(configBreakdown);
    assert(configs.length > 0, 'Should have at least one configuration');
    configs.forEach(config => {
      assert(typeof config.count === 'number', 'Each config should have count');
      assert(Array.isArray(config.regions), 'Each config should have regions array');
      assert(config.regions.length === config.count, 'Regions array length should match count');
    });
  });

  await test('GET /api/v1/services/invalid_service returns 404', async () => {
    const res = await makeRequest('/api/v1/services/invalid_service');
    assert(res.status === 404, `Expected 404, got ${res.status}`);
    assert(res.data.code === 'SERVICE_NOT_FOUND', 'Expected SERVICE_NOT_FOUND error code');
    assert(res.data.error, 'Should have error message');
    assert(res.data.parameter === 'serviceId', 'Should indicate serviceId parameter');
    assert(Array.isArray(res.data.allowedValues), 'Should provide allowed values');
  });

  await test('GET /api/v1/services/{id} for all valid service IDs', async () => {
    const serviceIds = ['vdc_vault', 'vdc_m365', 'vdc_entra_id', 'vdc_salesforce', 'vdc_azure_backup'];
    for (const serviceId of serviceIds) {
      const res = await makeRequest(`/api/v1/services/${serviceId}`);
      assert(res.status === 200, `${serviceId} should return 200, got ${res.status}`);
      assert(res.data.service.id === serviceId, `Service ID should be ${serviceId}`);
    }
  });

  // Regions endpoint tests
  await test('GET /api/v1/regions returns all regions', async () => {
    const res = await makeRequest('/api/v1/regions');
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(Array.isArray(res.data.data), 'Expected data array');
    assert(res.data.count > 0, 'Expected at least one region');
    assert(res.data.count === res.data.data.length, 'Count should match data length');
  });

  await test('GET /api/v1/regions?provider=AWS filters correctly', async () => {
    const res = await makeRequest('/api/v1/regions?provider=AWS');
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.data.filters.provider === 'AWS', 'Filter should be AWS');
    assert(res.data.data.every(r => r.provider === 'AWS'), 'All regions should be AWS');
  });

  await test('GET /api/v1/regions?provider=Azure filters correctly', async () => {
    const res = await makeRequest('/api/v1/regions?provider=Azure');
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.data.filters.provider === 'Azure', 'Filter should be Azure');
    assert(res.data.data.every(r => r.provider === 'Azure'), 'All regions should be Azure');
  });

  await test('GET /api/v1/regions?provider=invalid returns 400', async () => {
    const res = await makeRequest('/api/v1/regions?provider=GCP');
    assert(res.status === 400, `Expected 400, got ${res.status}`);
    // Accept either format: {code: 'INVALID_PARAMETER'} or {success: false, error: {name: 'ZodError'}}
    const hasCorrectError = res.data.code === 'INVALID_PARAMETER' ||
                           (res.data.success === false && res.data.error?.name === 'ZodError');
    assert(hasCorrectError, 'Expected INVALID_PARAMETER error code or ZodError');
  });

  await test('GET /api/v1/regions?service=vdc_vault filters correctly', async () => {
    const res = await makeRequest('/api/v1/regions?service=vdc_vault');
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.data.data.every(r => r.services.vdc_vault), 'All regions should have vdc_vault');
  });

  await test('GET /api/v1/regions?country=Japan filters correctly', async () => {
    const res = await makeRequest('/api/v1/regions?country=Japan');
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.data.filters.country === 'Japan', 'Filter should be Japan');
    assert(res.data.count > 0, 'Should find Japanese regions');
  });

  await test('GET /api/v1/regions?tier=Core filters correctly', async () => {
    const res = await makeRequest('/api/v1/regions?service=vdc_vault&tier=Core');
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.data.data.every(r =>
      r.services.vdc_vault.some(v => v.tier === 'Core')
    ), 'All regions should have Core tier');
  });

  await test('GET /api/v1/regions?tier=Core without service=vdc_vault returns 400', async () => {
    const res = await makeRequest('/api/v1/regions?tier=Core');
    assert(res.status === 400, `Expected 400, got ${res.status}`);
    assert(res.data.code === 'INVALID_PARAMETER', 'Expected INVALID_PARAMETER error code');
    assert(res.data.message.includes('vdc_vault'), 'Error message should mention vdc_vault');
  });

  await test('GET /api/v1/regions?edition=Advanced without service=vdc_vault returns 400', async () => {
    const res = await makeRequest('/api/v1/regions?edition=Advanced');
    assert(res.status === 400, `Expected 400, got ${res.status}`);
    assert(res.data.code === 'INVALID_PARAMETER', 'Expected INVALID_PARAMETER error code');
    assert(res.data.message.includes('vdc_vault'), 'Error message should mention vdc_vault');
    assert(res.data.parameter === 'edition', 'Should identify edition as the problematic parameter');
  });

  await test('GET /api/v1/regions?service=vdc_m365&tier=Core returns 400', async () => {
    const res = await makeRequest('/api/v1/regions?service=vdc_m365&tier=Core');
    assert(res.status === 400, `Expected 400, got ${res.status}`);
    assert(res.data.code === 'INVALID_PARAMETER', 'Expected INVALID_PARAMETER error code');
    assert(res.data.message.includes('vdc_vault'), 'Error message should mention vdc_vault requirement');
  });

  await test('GET /api/v1/regions?service=vdc_vault&edition=Foundation returns 200', async () => {
    const res = await makeRequest('/api/v1/regions?service=vdc_vault&edition=Foundation');
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.data.filters.edition === 'Foundation', 'Filter should show Foundation edition');
    assert(res.data.data.every(r =>
      r.services.vdc_vault.some(v => v.edition === 'Foundation')
    ), 'All regions should have Foundation edition');
  });

  // Region by ID endpoint tests
  await test('GET /api/v1/regions/{id} returns specific region', async () => {
    const allRegions = await makeRequest('/api/v1/regions');
    const firstRegion = allRegions.data.data[0];
    const res = await makeRequest(`/api/v1/regions/${firstRegion.id}`);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.data.id === firstRegion.id, 'Region ID should match');
    assert(res.data.name, 'Region should have a name');
    assert(res.data.provider, 'Region should have a provider');
  });

  await test('GET /api/v1/regions/invalid-id returns 404', async () => {
    const res = await makeRequest('/api/v1/regions/invalid-region-id');
    assert(res.status === 404, `Expected 404, got ${res.status}`);
    assert(res.data.code === 'REGION_NOT_FOUND', 'Expected REGION_NOT_FOUND error code');
  });

  // ===================================================================
  // Nearest Regions Endpoint Tests
  // ===================================================================

  await test('GET /api/v1/regions/nearest?lat=35.6762&lng=139.6503 returns 200', async () => {
    const res = await makeRequest('/api/v1/regions/nearest?lat=35.6762&lng=139.6503');
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.data.results, 'Expected results array');
    assert(res.data.count >= 1, 'Expected at least 1 result');
  });

  await test('Nearest regions returns Tokyo first for Tokyo coordinates', async () => {
    const res = await makeRequest('/api/v1/regions/nearest?lat=35.6762&lng=139.6503&limit=5&provider=AWS');
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.data.results[0].region.id === 'aws-ap-northeast-1', 
      `Expected Tokyo region first, got ${res.data.results[0].region.id}`);
  });

  await test('Nearest regions response includes distance in km and miles', async () => {
    const res = await makeRequest('/api/v1/regions/nearest?lat=35.6762&lng=139.6503&limit=1');
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.data.results[0].distance, 'Expected distance object');
    assert(typeof res.data.results[0].distance.km === 'number', 'Expected km as number');
    assert(typeof res.data.results[0].distance.miles === 'number', 'Expected miles as number');
  });

  await test('Nearest regions echoes query parameters in response', async () => {
    const res = await makeRequest('/api/v1/regions/nearest?lat=40.7128&lng=-74.0060&limit=3');
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.data.query.lat === 40.7128, 'Expected lat in query');
    assert(res.data.query.lng === -74.0060, 'Expected lng in query');
    assert(res.data.query.limit === 3, 'Expected limit in query');
  });

  await test('Nearest regions defaults to limit=5', async () => {
    const res = await makeRequest('/api/v1/regions/nearest?lat=0&lng=0');
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.data.count === 5, `Expected 5 results with default limit, got ${res.data.count}`);
    assert(res.data.query.limit === 5, 'Expected limit=5 in query echo');
  });

  await test('Nearest regions limit=0 returns all regions', async () => {
    const res = await makeRequest('/api/v1/regions/nearest?lat=0&lng=0&limit=0');
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.data.count > 50, `Expected all regions (>50), got ${res.data.count}`);
  });

  await test('Nearest regions limit=20 is maximum', async () => {
    const res = await makeRequest('/api/v1/regions/nearest?lat=0&lng=0&limit=20');
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.data.count === 20, `Expected exactly 20 results, got ${res.data.count}`);
  });

  await test('Nearest regions filters by provider=AWS', async () => {
    const res = await makeRequest('/api/v1/regions/nearest?lat=35.6762&lng=139.6503&provider=AWS&limit=10');
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.data.results.every(r => r.region.provider === 'AWS'), 'Expected all AWS regions');
    assert(res.data.query.provider === 'AWS', 'Expected provider in query');
  });

  await test('Nearest regions filters by provider=Azure', async () => {
    const res = await makeRequest('/api/v1/regions/nearest?lat=35.6762&lng=139.6503&provider=Azure&limit=10');
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.data.results.every(r => r.region.provider === 'Azure'), 'Expected all Azure regions');
  });

  await test('Nearest regions filters by service=vdc_vault', async () => {
    const res = await makeRequest('/api/v1/regions/nearest?lat=0&lng=0&service=vdc_vault&limit=10');
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.data.results.every(r => r.region.services.vdc_vault), 'Expected all regions with vdc_vault');
    assert(res.data.query.service === 'vdc_vault', 'Expected service in query');
  });

  await test('Nearest regions filters by service=vdc_m365', async () => {
    const res = await makeRequest('/api/v1/regions/nearest?lat=0&lng=0&service=vdc_m365&limit=10');
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.data.results.every(r => r.region.services.vdc_m365 === true), 'Expected all regions with vdc_m365');
  });

  await test('Nearest regions combines provider and service filters', async () => {
    const res = await makeRequest('/api/v1/regions/nearest?lat=0&lng=0&provider=AWS&service=vdc_vault&limit=10');
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.data.results.every(r => r.region.provider === 'AWS'), 'Expected all AWS');
    assert(res.data.results.every(r => r.region.services.vdc_vault), 'Expected all with vdc_vault');
  });

  await test('Nearest regions filters by tier=Core (with service=vdc_vault)', async () => {
    const res = await makeRequest('/api/v1/regions/nearest?lat=0&lng=0&service=vdc_vault&tier=Core&limit=10');
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const allHaveCoreTier = res.data.results.every(r => 
      r.region.services.vdc_vault?.some(config => config.tier === 'Core')
    );
    assert(allHaveCoreTier, 'Expected all regions with Core tier');
    assert(res.data.query.tier === 'Core', 'Expected tier in query');
  });

  await test('Nearest regions filters by edition=Advanced (with service=vdc_vault)', async () => {
    const res = await makeRequest('/api/v1/regions/nearest?lat=0&lng=0&service=vdc_vault&edition=Advanced&limit=10');
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const allHaveAdvanced = res.data.results.every(r => 
      r.region.services.vdc_vault?.some(config => config.edition === 'Advanced')
    );
    assert(allHaveAdvanced, 'Expected all regions with Advanced edition');
    assert(res.data.query.edition === 'Advanced', 'Expected edition in query');
  });

  await test('Nearest regions combines tier and edition filters', async () => {
    const res = await makeRequest('/api/v1/regions/nearest?lat=0&lng=0&service=vdc_vault&tier=Core&edition=Advanced&limit=10');
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const allMatch = res.data.results.every(r => 
      r.region.services.vdc_vault?.some(config => 
        config.tier === 'Core' && config.edition === 'Advanced'
      )
    );
    assert(allMatch, 'Expected all regions with Core+Advanced config');
  });

  await test('Nearest regions returns 400 for missing lat', async () => {
    const res = await makeRequest('/api/v1/regions/nearest?lng=139.6503');
    assert(res.status === 400, `Expected 400 for missing lat, got ${res.status}`);
    assert(res.data.code === 'INVALID_PARAMETER', 'Expected INVALID_PARAMETER code');
  });

  await test('Nearest regions returns 400 for missing lng', async () => {
    const res = await makeRequest('/api/v1/regions/nearest?lat=35.6762');
    assert(res.status === 400, `Expected 400 for missing lng, got ${res.status}`);
    assert(res.data.code === 'INVALID_PARAMETER', 'Expected INVALID_PARAMETER code');
  });

  await test('Nearest regions returns 400 for lat > 90', async () => {
    const res = await makeRequest('/api/v1/regions/nearest?lat=91&lng=0');
    assert(res.status === 400, `Expected 400 for lat > 90, got ${res.status}`);
  });

  await test('Nearest regions returns 400 for lat < -90', async () => {
    const res = await makeRequest('/api/v1/regions/nearest?lat=-91&lng=0');
    assert(res.status === 400, `Expected 400 for lat < -90, got ${res.status}`);
  });

  await test('Nearest regions returns 400 for lng > 180', async () => {
    const res = await makeRequest('/api/v1/regions/nearest?lat=0&lng=181');
    assert(res.status === 400, `Expected 400 for lng > 180, got ${res.status}`);
  });

  await test('Nearest regions returns 400 for lng < -180', async () => {
    const res = await makeRequest('/api/v1/regions/nearest?lat=0&lng=-181');
    assert(res.status === 400, `Expected 400 for lng < -180, got ${res.status}`);
  });

  await test('Nearest regions returns 400 for limit > 20', async () => {
    const res = await makeRequest('/api/v1/regions/nearest?lat=0&lng=0&limit=21');
    assert(res.status === 400, `Expected 400 for limit > 20, got ${res.status}`);
  });

  await test('Nearest regions returns 400 for invalid provider', async () => {
    const res = await makeRequest('/api/v1/regions/nearest?lat=0&lng=0&provider=GCP');
    assert(res.status === 400, `Expected 400 for invalid provider, got ${res.status}`);
  });

  await test('Nearest regions returns 400 for tier without service=vdc_vault', async () => {
    const res = await makeRequest('/api/v1/regions/nearest?lat=0&lng=0&tier=Core');
    assert(res.status === 400, `Expected 400 for tier without vdc_vault, got ${res.status}`);
    assert(res.data.code === 'INVALID_PARAMETER', 'Expected INVALID_PARAMETER code');
    assert(res.data.message.includes('vdc_vault'), 'Expected message about vdc_vault requirement');
  });

  await test('Nearest regions returns 400 for edition without service=vdc_vault', async () => {
    const res = await makeRequest('/api/v1/regions/nearest?lat=0&lng=0&edition=Advanced');
    assert(res.status === 400, `Expected 400 for edition without vdc_vault, got ${res.status}`);
    assert(res.data.code === 'INVALID_PARAMETER', 'Expected INVALID_PARAMETER code');
  });

  await test('Nearest regions returns 400 for tier with service=vdc_m365', async () => {
    const res = await makeRequest('/api/v1/regions/nearest?lat=0&lng=0&service=vdc_m365&tier=Core');
    assert(res.status === 400, `Expected 400 for tier with non-vault service, got ${res.status}`);
  });

  await test('Nearest regions has deterministic ordering for equal distances', async () => {
    const res = await makeRequest('/api/v1/regions/nearest?lat=0&lng=0&limit=20');
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    
    for (let i = 1; i < res.data.results.length; i++) {
      const prev = res.data.results[i - 1];
      const curr = res.data.results[i];
      
      if (prev.distance.km === curr.distance.km) {
        assert(prev.region.id < curr.region.id, 
          `Expected ${prev.region.id} < ${curr.region.id} for equal distances`);
      }
    }
  });

  await test('Nearest regions results are sorted by distance ascending', async () => {
    const res = await makeRequest('/api/v1/regions/nearest?lat=0&lng=0&limit=20');
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    
    for (let i = 1; i < res.data.results.length; i++) {
      const prev = res.data.results[i - 1];
      const curr = res.data.results[i];
      assert(prev.distance.km <= curr.distance.km, 
        `Expected distances to be ascending: ${prev.distance.km} <= ${curr.distance.km}`);
    }
  });

  // ===================================================================
  // Regions Compare Endpoint Tests
  // ===================================================================

  await test('GET /api/v1/regions/compare with 2 valid regions returns 200', async () => {
    const res = await makeRequest('/api/v1/regions/compare?ids=aws-us-east-1,azure-us-east');
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(Array.isArray(res.data.regions), 'Expected regions array');
    assert(res.data.regions.length === 2, 'Expected 2 regions');
    assert(res.data.comparison, 'Expected comparison object');
    assert(res.data.summary, 'Expected summary object');
  });

  await test('Regions compare response includes all service comparisons', async () => {
    const res = await makeRequest('/api/v1/regions/compare?ids=aws-us-east-1,azure-us-east');
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const serviceIds = ['vdc_vault', 'vdc_m365', 'vdc_entra_id', 'vdc_salesforce', 'vdc_azure_backup'];
    serviceIds.forEach(serviceId => {
      assert(res.data.comparison[serviceId], `Expected comparison for ${serviceId}`);
      assert(Array.isArray(res.data.comparison[serviceId].availableIn), `Expected availableIn array for ${serviceId}`);
      assert(Array.isArray(res.data.comparison[serviceId].missingFrom), `Expected missingFrom array for ${serviceId}`);
      assert(typeof res.data.comparison[serviceId].isCommon === 'boolean', `Expected isCommon boolean for ${serviceId}`);
      assert(typeof res.data.comparison[serviceId].details === 'object', `Expected details object for ${serviceId}`);
    });
  });

  await test('Regions compare isCommon is true only when service in all regions', async () => {
    const res = await makeRequest('/api/v1/regions/compare?ids=aws-us-east-1,aws-eu-west-2');
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    Object.entries(res.data.comparison).forEach(([serviceId, data]) => {
      const expectedIsCommon = data.availableIn.length === 2;
      assert(data.isCommon === expectedIsCommon, 
        `${serviceId}: isCommon should be ${expectedIsCommon}, got ${data.isCommon}`);
    });
  });

  await test('Regions compare missingFrom correctly lists regions', async () => {
    const res = await makeRequest('/api/v1/regions/compare?ids=aws-us-east-1,azure-us-east');
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    Object.entries(res.data.comparison).forEach(([serviceId, data]) => {
      const allRegionIds = res.data.regions.map(r => r.id);
      const combined = [...data.availableIn, ...data.missingFrom].sort();
      assert(JSON.stringify(combined) === JSON.stringify(allRegionIds.sort()), 
        `${serviceId}: availableIn + missingFrom should equal all region IDs`);
    });
  });

  await test('Regions compare details includes service configuration', async () => {
    const res = await makeRequest('/api/v1/regions/compare?ids=aws-us-east-1,azure-us-east');
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    Object.entries(res.data.comparison).forEach(([serviceId, data]) => {
      data.availableIn.forEach(regionId => {
        assert(data.details[regionId] !== undefined, 
          `${serviceId}: details should include ${regionId}`);
      });
    });
  });

  await test('Regions compare summary counts are accurate', async () => {
    const res = await makeRequest('/api/v1/regions/compare?ids=aws-us-east-1,azure-us-east');
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const { summary, comparison } = res.data;
    
    let calculatedCommon = 0;
    let calculatedPartial = 0;
    let calculatedUnavailable = 0;
    
    Object.values(comparison).forEach(data => {
      if (data.isCommon) calculatedCommon++;
      else if (data.availableIn.length === 0) calculatedUnavailable++;
      else calculatedPartial++;
    });
    
    assert(summary.commonServices === calculatedCommon, 
      `commonServices count mismatch: ${summary.commonServices} vs ${calculatedCommon}`);
    assert(summary.partialServices === calculatedPartial, 
      `partialServices count mismatch: ${summary.partialServices} vs ${calculatedPartial}`);
    assert(summary.unavailableServices === calculatedUnavailable, 
      `unavailableServices count mismatch: ${summary.unavailableServices} vs ${calculatedUnavailable}`);
    assert(summary.totalServices === 5, 'Expected 5 total services');
  });

  await test('Regions compare summary service IDs match counts', async () => {
    const res = await makeRequest('/api/v1/regions/compare?ids=aws-us-east-1,azure-us-east');
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const { summary } = res.data;
    
    assert(summary.commonServiceIds.length === summary.commonServices, 
      'commonServiceIds array length should match commonServices count');
    assert(summary.partialServiceIds.length === summary.partialServices, 
      'partialServiceIds array length should match partialServices count');
    assert(summary.unavailableServiceIds.length === summary.unavailableServices, 
      'unavailableServiceIds array length should match unavailableServices count');
  });

  await test('Regions compare with 3 regions works correctly', async () => {
    const res = await makeRequest('/api/v1/regions/compare?ids=aws-us-east-1,azure-us-east,aws-eu-west-2');
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.data.regions.length === 3, 'Expected 3 regions');
  });

  await test('Regions compare with 5 regions (maximum) returns 200', async () => {
    const res = await makeRequest('/api/v1/regions/compare?ids=aws-us-east-1,azure-us-east,aws-eu-west-2,aws-ap-northeast-1,azure-west-europe');
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.data.regions.length === 5, 'Expected 5 regions');
  });

  await test('Regions compare with duplicate IDs deduplicates silently', async () => {
    const res = await makeRequest('/api/v1/regions/compare?ids=aws-us-east-1,aws-us-east-1,azure-us-east');
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.data.regions.length === 2, 'Expected 2 unique regions after deduplication');
  });

  await test('Regions compare returns 400 for less than 2 region IDs', async () => {
    const res = await makeRequest('/api/v1/regions/compare?ids=aws-us-east-1');
    assert(res.status === 400, `Expected 400, got ${res.status}`);
    assert(res.data.code === 'INVALID_PARAMETER', 'Expected INVALID_PARAMETER error code');
    assert(res.data.message.includes('At least 2 region IDs'), 'Expected message about minimum regions');
  });

  await test('Regions compare returns 400 for more than 5 region IDs', async () => {
    const res = await makeRequest('/api/v1/regions/compare?ids=aws-us-east-1,azure-us-east,aws-eu-west-2,aws-ap-northeast-1,azure-west-europe,aws-ca-central-1');
    assert(res.status === 400, `Expected 400, got ${res.status}`);
    assert(res.data.code === 'INVALID_PARAMETER', 'Expected INVALID_PARAMETER error code');
    assert(res.data.message.includes('Maximum 5 region IDs'), 'Expected message about maximum regions');
  });

  await test('Regions compare returns 404 for invalid region ID', async () => {
    const res = await makeRequest('/api/v1/regions/compare?ids=aws-us-east-1,invalid-region-id');
    assert(res.status === 404, `Expected 404, got ${res.status}`);
    assert(res.data.code === 'REGION_NOT_FOUND', 'Expected REGION_NOT_FOUND error code');
    assert(res.data.message.includes('invalid-region-id'), 'Expected message to mention invalid ID');
  });

  await test('Regions compare returns 404 listing all invalid IDs', async () => {
    const res = await makeRequest('/api/v1/regions/compare?ids=invalid-1,invalid-2,aws-us-east-1');
    assert(res.status === 404, `Expected 404, got ${res.status}`);
    assert(res.data.code === 'REGION_NOT_FOUND', 'Expected REGION_NOT_FOUND error code');
    assert(res.data.message.includes('invalid-1'), 'Expected message to mention invalid-1');
    assert(res.data.message.includes('invalid-2'), 'Expected message to mention invalid-2');
  });

  await test('Regions compare handles vdc_vault tiered service correctly', async () => {
    const res = await makeRequest('/api/v1/regions/compare?ids=aws-us-east-1,azure-us-east');
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const vaultComparison = res.data.comparison.vdc_vault;
    
    vaultComparison.availableIn.forEach(regionId => {
      const details = vaultComparison.details[regionId];
      assert(Array.isArray(details), `vdc_vault details for ${regionId} should be an array`);
      if (details.length > 0) {
        assert(details[0].edition, 'vdc_vault config should have edition');
        assert(details[0].tier, 'vdc_vault config should have tier');
      }
    });
  });

  await test('Regions compare handles boolean services correctly', async () => {
    const res = await makeRequest('/api/v1/regions/compare?ids=aws-us-east-1,azure-us-east');
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const booleanServices = ['vdc_m365', 'vdc_entra_id', 'vdc_salesforce', 'vdc_azure_backup'];
    
    booleanServices.forEach(serviceId => {
      const serviceComparison = res.data.comparison[serviceId];
      serviceComparison.availableIn.forEach(regionId => {
        const details = serviceComparison.details[regionId];
        assert(details === true, `${serviceId} details for ${regionId} should be true`);
      });
    });
  });

  // Print summary
  console.log(`\n${colors.cyan}Test Summary${colors.reset}`);
  console.log(`${colors.green}Passed: ${TESTS_PASSED.length}${colors.reset}`);
  console.log(`${colors.red}Failed: ${TESTS_FAILED.length}${colors.reset}`);

  if (TESTS_FAILED.length > 0) {
    console.log(`\n${colors.red}Failed Tests:${colors.reset}`);
    TESTS_FAILED.forEach(({ name }) => console.log(`  - ${name}`));
    return false;
  } else {
    console.log(`\n${colors.green}All tests passed! ✨${colors.reset}\n`);
    return true;
  }
}

// Start the dev server and run tests
console.log(`${colors.blue}Starting development server...${colors.reset}`);

const server = spawn('npm', ['run', 'dev'], {
  stdio: 'pipe',
  shell: true,
  detached: true
});

let serverReady = false;

function cleanup() {
  if (server.pid) {
    try {
      // Kill the process group to ensure all child processes (wrangler, etc) are killed
      process.kill(-server.pid);
    } catch (e) {
      // Ignore if already dead
    }
  }
}

// Handle cleanup on exit
process.on('SIGINT', () => {
  cleanup();
  process.exit();
});

process.on('SIGTERM', () => {
  cleanup();
  process.exit();
});

server.stdout.on('data', (data) => {
  const output = data.toString();
  // Wait for the server to be ready
  if (output.includes('Ready on') || output.includes('Listening on')) {
    if (!serverReady) {
      serverReady = true;
      console.log(`${colors.green}Server ready!${colors.reset}`);
      // Wait a bit more to ensure server is fully ready
      setTimeout(async () => {
        try {
          const success = await runTests();
          cleanup();
          process.exit(success ? 0 : 1);
        } catch (error) {
          console.error(error);
          cleanup();
          process.exit(1);
        }
      }, 1000);
    }
  }
});

server.stderr.on('data', (data) => {
  // Suppress verbose wrangler output
  const output = data.toString();
  if (!output.includes('wrangler') && !output.includes('esbuild')) {
    console.error(data.toString());
  }
});

// Handle server errors
server.on('error', (error) => {
  console.error(`${colors.red}Failed to start server:${colors.reset}`, error);
  cleanup();
  process.exit(1);
});

// Timeout after 30 seconds
setTimeout(() => {
  if (!serverReady) {
    console.error(`${colors.red}Server failed to start within 30 seconds${colors.reset}`);
    cleanup();
    process.exit(1);
  }
}, 30000);
