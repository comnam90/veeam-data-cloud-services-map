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
    assert(res.data.code === 'INVALID_PARAMETER', 'Expected INVALID_PARAMETER error code');
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

  // Print summary
  console.log(`\n${colors.cyan}Test Summary${colors.reset}`);
  console.log(`${colors.green}Passed: ${TESTS_PASSED.length}${colors.reset}`);
  console.log(`${colors.red}Failed: ${TESTS_FAILED.length}${colors.reset}`);

  if (TESTS_FAILED.length > 0) {
    console.log(`\n${colors.red}Failed Tests:${colors.reset}`);
    TESTS_FAILED.forEach(({ name }) => console.log(`  - ${name}`));
    process.exit(1);
  } else {
    console.log(`\n${colors.green}All tests passed! ✨${colors.reset}\n`);
    process.exit(0);
  }
}

// Start the dev server and run tests
console.log(`${colors.blue}Starting development server...${colors.reset}`);

const server = spawn('npm', ['run', 'dev'], {
  stdio: 'pipe',
  shell: true
});

let serverReady = false;

server.stdout.on('data', (data) => {
  const output = data.toString();
  // Wait for the server to be ready
  if (output.includes('Ready on') || output.includes('Listening on')) {
    if (!serverReady) {
      serverReady = true;
      console.log(`${colors.green}Server ready!${colors.reset}`);
      // Wait a bit more to ensure server is fully ready
      setTimeout(() => {
        runTests().finally(() => {
          server.kill();
        });
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
  process.exit(1);
});

// Timeout after 30 seconds
setTimeout(() => {
  if (!serverReady) {
    console.error(`${colors.red}Server failed to start within 30 seconds${colors.reset}`);
    server.kill();
    process.exit(1);
  }
}, 30000);
