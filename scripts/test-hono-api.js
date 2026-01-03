/**
 * Test script for Hono API endpoints
 * Tests all endpoints to ensure they work correctly
 */

const BASE_URL = 'http://localhost:8788'

const tests = [
  {
    name: 'Ping endpoint',
    url: '/api/v1/ping',
    validate: (data) => {
      if (data.status !== 'ok') throw new Error('Status should be "ok"')
      if (!data.timestamp) throw new Error('Missing timestamp')
      return true
    }
  },
  {
    name: 'Services endpoint',
    url: '/api/v1/services',
    validate: (data) => {
      if (!Array.isArray(data.services)) throw new Error('services should be an array')
      if (data.count !== 5) throw new Error('Should have 5 services')
      return true
    }
  },
  {
    name: 'Health endpoint',
    url: '/api/v1/health',
    validate: (data) => {
      if (data.status !== 'healthy') throw new Error('Status should be "healthy"')
      if (!data.stats) throw new Error('Missing stats')
      if (data.stats.totalRegions === 0) throw new Error('Should have regions')
      return true
    }
  },
  {
    name: 'Regions endpoint (all)',
    url: '/api/v1/regions',
    validate: (data) => {
      if (!Array.isArray(data.data)) throw new Error('data should be an array')
      if (data.count === 0) throw new Error('Should have regions')
      if (!data.filters) throw new Error('Missing filters')
      return true
    }
  },
  {
    name: 'Regions endpoint (AWS filter)',
    url: '/api/v1/regions?provider=AWS',
    validate: (data) => {
      if (!Array.isArray(data.data)) throw new Error('data should be an array')
      if (data.filters.provider !== 'AWS') throw new Error('Filter should be AWS')
      const hasNonAWS = data.data.some(r => r.provider !== 'AWS')
      if (hasNonAWS) throw new Error('All regions should be AWS')
      return true
    }
  },
  {
    name: 'Regions endpoint (service filter)',
    url: '/api/v1/regions?service=vdc_vault',
    validate: (data) => {
      if (!Array.isArray(data.data)) throw new Error('data should be an array')
      const missingService = data.data.some(r => !r.services.vdc_vault)
      if (missingService) throw new Error('All regions should have vdc_vault')
      return true
    }
  },
  {
    name: 'Region by ID (aws-us-east-1)',
    url: '/api/v1/regions/aws-us-east-1',
    validate: (data) => {
      if (data.id !== 'aws-us-east-1') throw new Error('ID should match')
      if (data.provider !== 'AWS') throw new Error('Should be AWS')
      return true
    }
  },
  {
    name: 'Region by ID (404 test)',
    url: '/api/v1/regions/invalid-id',
    expectStatus: 404,
    validate: (data) => {
      if (data.code !== 'REGION_NOT_FOUND') throw new Error('Should return REGION_NOT_FOUND')
      return true
    }
  },
  {
    name: 'OpenAPI documentation',
    url: '/api/openapi.json',
    validate: (data) => {
      if (data.openapi !== '3.1.0') throw new Error('Should be OpenAPI 3.1.0')
      if (!data.paths) throw new Error('Missing paths')
      if (!data.paths['/api/v1/regions']) throw new Error('Missing regions endpoint')
      return true
    }
  }
]

async function runTests() {
  console.log('🧪 Testing Hono API endpoints...\n')

  let passed = 0
  let failed = 0

  for (const test of tests) {
    try {
      const url = `${BASE_URL}${test.url}`
      const response = await fetch(url)

      const expectedStatus = test.expectStatus || 200
      if (response.status !== expectedStatus) {
        throw new Error(`Expected status ${expectedStatus}, got ${response.status}`)
      }

      const data = await response.json()
      test.validate(data)

      console.log(`✅ ${test.name}`)
      passed++
    } catch (error) {
      console.log(`❌ ${test.name}: ${error.message}`)
      failed++
    }
  }

  console.log(`\n📊 Results: ${passed} passed, ${failed} failed`)

  if (failed > 0) {
    process.exit(1)
  }
}

runTests().catch(console.error)
