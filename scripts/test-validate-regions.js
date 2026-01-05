/**
 * Region Data Validation Tests - Issue #12
 *
 * TDD tests for YAML region file validation.
 * Run with: npm run test:validate
 */

const path = require('path');
const os = require('os');
const fs = require('fs');

const { validateRegionFile, validateAllRegions, validateAllRegionsRecursive } = require('./validate-regions.js');

const TESTS_PASSED = [];
const TESTS_FAILED = [];

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
};

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

function createTempFile(content) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'validate-test-'));
  const filePath = path.join(tmpDir, 'test-region.yaml');
  fs.writeFileSync(filePath, content, 'utf8');
  return { filePath, cleanup: () => fs.rmSync(tmpDir, { recursive: true }) };
}

function createTempDir(files) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'validate-test-'));
  for (const [name, content] of Object.entries(files)) {
    fs.writeFileSync(path.join(tmpDir, name), content, 'utf8');
  }
  return { dirPath: tmpDir, cleanup: () => fs.rmSync(tmpDir, { recursive: true }) };
}

function createTempDirWithSubdirs(structure) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'validate-test-'));
  for (const [subdir, files] of Object.entries(structure)) {
    const subdirPath = path.join(tmpDir, subdir);
    fs.mkdirSync(subdirPath, { recursive: true });
    for (const [name, content] of Object.entries(files)) {
      fs.writeFileSync(path.join(subdirPath, name), content, 'utf8');
    }
  }
  return { dirPath: tmpDir, cleanup: () => fs.rmSync(tmpDir, { recursive: true }) };
}

async function runTests() {
  console.log(`\n${colors.cyan}🧪 Running Region Validation Tests (Issue #12)${colors.reset}\n`);

  // Test 1: YAML Syntax Validation
  await test('Invalid YAML syntax fails validation', async () => {
    const invalidYaml = `
id: "aws-test"
name: "Test Region
  provider: "AWS"  # Missing closing quote on previous line
`;
    const { filePath, cleanup } = createTempFile(invalidYaml);
    try {
      const result = validateRegionFile(filePath);
      assert(result.valid === false, 'Expected validation to fail for invalid YAML syntax');
      assert(result.errors.length > 0, 'Expected at least one error');
      assert(
        result.errors.some(e => e.type === 'yaml_syntax'),
        'Expected error type to be yaml_syntax'
      );
    } finally {
      cleanup();
    }
  });

  // Test 2: Required Fields Validation
  await test('Missing required fields fails validation', async () => {
    const missingFieldsYaml = `
name: "Test Region"
provider: "AWS"
`;
    const { filePath, cleanup } = createTempFile(missingFieldsYaml);
    try {
      const result = validateRegionFile(filePath);
      assert(result.valid === false, 'Expected validation to fail for missing required fields');
      assert(result.errors.length > 0, 'Expected at least one error');
      assert(
        result.errors.some(e => e.type === 'missing_field' && e.field === 'id'),
        'Expected error for missing id field'
      );
      assert(
        result.errors.some(e => e.type === 'missing_field' && e.field === 'coords'),
        'Expected error for missing coords field'
      );
    } finally {
      cleanup();
    }
  });

  // Test 3: Provider Enum Validation (case-sensitive)
  await test('Lowercase provider value fails validation', async () => {
    const lowercaseProviderYaml = `
id: "aws-test-region"
name: "Test Region"
provider: "aws"
coords: [38.9, -77.4]
`;
    const { filePath, cleanup } = createTempFile(lowercaseProviderYaml);
    try {
      const result = validateRegionFile(filePath);
      assert(result.valid === false, 'Expected validation to fail for lowercase provider');
      assert(result.errors.length > 0, 'Expected at least one error');
      assert(
        result.errors.some(e => e.type === 'invalid_provider'),
        'Expected error type to be invalid_provider'
      );
    } finally {
      cleanup();
    }
  });

  // Test 4: Coordinates Format Validation
  await test('String coordinates fail validation', async () => {
    const stringCoordsYaml = `
id: "aws-test-region"
name: "Test Region"
provider: "AWS"
coords: "38.9, -77.4"
`;
    const { filePath, cleanup } = createTempFile(stringCoordsYaml);
    try {
      const result = validateRegionFile(filePath);
      assert(result.valid === false, 'Expected validation to fail for string coords');
      assert(result.errors.length > 0, 'Expected at least one error');
      assert(
        result.errors.some(e => e.type === 'invalid_coords'),
        'Expected error type to be invalid_coords'
      );
    } finally {
      cleanup();
    }
  });

  await test('Coordinates with wrong array length fails validation', async () => {
    const wrongLengthCoordsYaml = `
id: "aws-test-region"
name: "Test Region"
provider: "AWS"
coords: [38.9]
`;
    const { filePath, cleanup } = createTempFile(wrongLengthCoordsYaml);
    try {
      const result = validateRegionFile(filePath);
      assert(result.valid === false, 'Expected validation to fail for wrong array length');
      assert(result.errors.length > 0, 'Expected at least one error');
      assert(
        result.errors.some(e => e.type === 'invalid_coords'),
        'Expected error type to be invalid_coords'
      );
    } finally {
      cleanup();
    }
  });

  // Test 6: ID Format Validation
  await test('Invalid ID format fails validation', async () => {
    const invalidIdYaml = `
id: "US-East-1"
name: "Test Region"
provider: "AWS"
coords: [38.9, -77.4]
`;
    const { filePath, cleanup } = createTempFile(invalidIdYaml);
    try {
      const result = validateRegionFile(filePath);
      assert(result.valid === false, 'Expected validation to fail for invalid ID format');
      assert(result.errors.length > 0, 'Expected at least one error');
      assert(
        result.errors.some(e => e.type === 'invalid_id_format'),
        'Expected error type to be invalid_id_format'
      );
    } finally {
      cleanup();
    }
  });

  // Test 7: ID Uniqueness Across Files
  await test('Duplicate IDs across files fails validation', async () => {
    const region1 = `
id: "aws-us-east-1"
name: "US East 1"
provider: "AWS"
coords: [38.9, -77.4]
`;
    const region2 = `
id: "aws-us-east-1"
name: "US East 1 Duplicate"
provider: "AWS"
coords: [39.0, -78.0]
`;
    const { dirPath, cleanup } = createTempDir({
      'region1.yaml': region1,
      'region2.yaml': region2
    });
    try {
      const result = validateAllRegions(dirPath);
      assert(result.valid === false, 'Expected validation to fail for duplicate IDs');
      assert(result.errors.length > 0, 'Expected at least one error');
      assert(
        result.errors.some(e => e.type === 'duplicate_id'),
        'Expected error type to be duplicate_id'
      );
    } finally {
      cleanup();
    }
  });

  // Test 8: Tiered Service Schema Validation (vdc_vault)
  await test('Invalid edition value fails validation', async () => {
    const invalidEditionYaml = `
id: "aws-test-region"
name: "Test Region"
provider: "AWS"
coords: [38.9, -77.4]
services:
  vdc_vault:
    - edition: "Basic"
      tier: "Core"
`;
    const { filePath, cleanup } = createTempFile(invalidEditionYaml);
    try {
      const result = validateRegionFile(filePath);
      assert(result.valid === false, 'Expected validation to fail for invalid edition');
      assert(result.errors.length > 0, 'Expected at least one error');
      assert(
        result.errors.some(e => e.type === 'invalid_service_config'),
        'Expected error type to be invalid_service_config'
      );
    } finally {
      cleanup();
    }
  });

  await test('Invalid tier value fails validation', async () => {
    const invalidTierYaml = `
id: "aws-test-region"
name: "Test Region"
provider: "AWS"
coords: [38.9, -77.4]
services:
  vdc_vault:
    - edition: "Foundation"
      tier: "Standard"
`;
    const { filePath, cleanup } = createTempFile(invalidTierYaml);
    try {
      const result = validateRegionFile(filePath);
      assert(result.valid === false, 'Expected validation to fail for invalid tier');
      assert(result.errors.length > 0, 'Expected at least one error');
      assert(
        result.errors.some(e => e.type === 'invalid_service_config'),
        'Expected error type to be invalid_service_config'
      );
    } finally {
      cleanup();
    }
  });

  // Test 10: Valid region file should pass
  await test('Valid region file passes validation', async () => {
    const validYaml = `
id: "aws-us-east-1"
name: "US East 1"
provider: "AWS"
coords: [38.9, -77.4]
services:
  vdc_vault:
    - edition: "Foundation"
      tier: "Core"
    - edition: "Advanced"
      tier: "Non-Core"
  vdc_m365: true
`;
    const { filePath, cleanup } = createTempFile(validYaml);
    try {
      const result = validateRegionFile(filePath);
      assert(result.valid === true, 'Expected validation to pass for valid region');
      assert(result.errors.length === 0, 'Expected no errors');
    } finally {
      cleanup();
    }
  });

  // Test 11: Boolean service validation
  await test('Boolean service with string value fails validation', async () => {
    const invalidBooleanYaml = `
id: "aws-test-region"
name: "Test Region"
provider: "AWS"
coords: [38.9, -77.4]
services:
  vdc_m365: "true"
`;
    const { filePath, cleanup } = createTempFile(invalidBooleanYaml);
    try {
      const result = validateRegionFile(filePath);
      assert(result.valid === false, 'Expected validation to fail for string boolean service');
      assert(
        result.errors.some(e => e.type === 'invalid_service_config' && e.service === 'vdc_m365'),
        'Expected error for invalid boolean service'
      );
    } finally {
      cleanup();
    }
  });

  // Test 12: Tiered service must be array
  await test('Tiered service defined as boolean fails validation', async () => {
    const invalidTieredYaml = `
id: "aws-test-region"
name: "Test Region"
provider: "AWS"
coords: [38.9, -77.4]
services:
  vdc_vault: true
`;
    const { filePath, cleanup } = createTempFile(invalidTieredYaml);
    try {
      const result = validateRegionFile(filePath);
      assert(result.valid === false, 'Expected validation to fail for non-array tiered service');
      assert(
        result.errors.some(e => e.type === 'invalid_service_config' && e.service === 'vdc_vault'),
        'Expected error for tiered service not being array'
      );
    } finally {
      cleanup();
    }
  });

  // Test 13: Tiered service missing required fields
  await test('Tiered service entry missing edition fails validation', async () => {
    const missingEditionYaml = `
id: "aws-test-region"
name: "Test Region"
provider: "AWS"
coords: [38.9, -77.4]
services:
  vdc_vault:
    - tier: "Core"
`;
    const { filePath, cleanup } = createTempFile(missingEditionYaml);
    try {
      const result = validateRegionFile(filePath);
      assert(result.valid === false, 'Expected validation to fail for missing edition');
      assert(
        result.errors.some(e => e.type === 'invalid_service_config' && e.field === 'edition'),
        'Expected error for missing edition field'
      );
    } finally {
      cleanup();
    }
  });

  // Test 14: Duplicate IDs across subdirectories (recursive)
  await test('Duplicate IDs across subdirectories detected by recursive validation', async () => {
    const region1 = `
id: "aws-us-east-1"
name: "US East 1"
provider: "AWS"
coords: [38.9, -77.4]
`;
    const region2 = `
id: "aws-us-east-1"
name: "Duplicate in Azure folder"
provider: "Azure"
coords: [39.0, -78.0]
`;
    const { dirPath, cleanup } = createTempDirWithSubdirs({
      'aws': { 'region1.yaml': region1 },
      'azure': { 'region2.yaml': region2 }
    });
    try {
      const result = validateAllRegionsRecursive(dirPath);
      assert(result.valid === false, 'Expected validation to fail for duplicate IDs across subdirs');
      assert(
        result.errors.some(e => e.type === 'duplicate_id'),
        'Expected duplicate_id error'
      );
    } finally {
      cleanup();
    }
  });

  // Test 15: Invalid coordinate values (out of range)
  await test('Coordinates outside valid range fail validation', async () => {
    const invalidCoordsYaml = `
id: "aws-test-region"
name: "Test Region"
provider: "AWS"
coords: [100, -77.4]
`;
    const { filePath, cleanup } = createTempFile(invalidCoordsYaml);
    try {
      const result = validateRegionFile(filePath);
      assert(result.valid === false, 'Expected validation to fail for latitude > 90');
      assert(
        result.errors.some(e => e.type === 'invalid_coords'),
        'Expected invalid_coords error'
      );
    } finally {
      cleanup();
    }
  });

  // Test 16: Empty YAML file fails validation
  await test('Empty YAML file fails validation', async () => {
    const emptyYaml = '';
    const { filePath, cleanup } = createTempFile(emptyYaml);
    try {
      const result = validateRegionFile(filePath);
      assert(result.valid === false, 'Expected validation to fail for empty file');
      assert(
        result.errors.some(e => e.type === 'invalid_structure'),
        'Expected invalid_structure error'
      );
    } finally {
      cleanup();
    }
  });

  // Test 17: Unknown service name fails validation
  await test('Unknown service name fails validation', async () => {
    const unknownServiceYaml = `
id: "aws-test-region"
name: "Test Region"
provider: "AWS"
coords: [38.9, -77.4]
services:
  vdc_unknown_service: true
`;
    const { filePath, cleanup } = createTempFile(unknownServiceYaml);
    try {
      const result = validateRegionFile(filePath);
      assert(result.valid === false, 'Expected validation to fail for unknown service');
      assert(
        result.errors.some(e => e.type === 'unknown_service'),
        'Expected unknown_service error'
      );
    } finally {
      cleanup();
    }
  });

  // Test 18: Duplicate ID reports all files involved
  await test('Duplicate ID error includes all affected files', async () => {
    const region1 = `
id: "aws-us-east-1"
name: "US East 1"
provider: "AWS"
coords: [38.9, -77.4]
`;
    const region2 = `
id: "aws-us-east-1"
name: "US East 1 Copy"
provider: "AWS"
coords: [39.0, -78.0]
`;
    const region3 = `
id: "aws-us-east-1"
name: "US East 1 Another Copy"
provider: "AWS"
coords: [40.0, -79.0]
`;
    const { dirPath, cleanup } = createTempDir({
      'region1.yaml': region1,
      'region2.yaml': region2,
      'region3.yaml': region3
    });
    try {
      const result = validateAllRegions(dirPath);
      assert(result.valid === false, 'Expected validation to fail for duplicate IDs');
      const dupError = result.errors.find(e => e.type === 'duplicate_id');
      assert(dupError, 'Expected duplicate_id error');
      assert(dupError.files.length === 3, `Expected 3 files in duplicate error, got ${dupError.files.length}`);
    } finally {
      cleanup();
    }
  });

  // Test 19: Tiered service with non-object array entry fails validation
  await test('Tiered service with non-object array entry fails validation', async () => {
    const nonObjectEntryYaml = `
id: "aws-test-region"
name: "Test Region"
provider: "AWS"
coords: [38.9, -77.4]
services:
  vdc_vault:
    - edition: "Foundation"
      tier: "Core"
    - null
    - "invalid string entry"
`;
    const { filePath, cleanup } = createTempFile(nonObjectEntryYaml);
    try {
      const result = validateRegionFile(filePath);
      assert(result.valid === false, 'Expected validation to fail for non-object entry');
      assert(
        result.errors.some(e => e.type === 'invalid_service_config' && e.message.includes('expected object')),
        'Expected error for non-object array entry'
      );
    } finally {
      cleanup();
    }
  });

  // Summary
  console.log(`\n${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  console.log(`${colors.green}Passed: ${TESTS_PASSED.length}${colors.reset}`);
  console.log(`${colors.red}Failed: ${TESTS_FAILED.length}${colors.reset}`);

  if (TESTS_FAILED.length > 0) {
    console.log(`\n${colors.red}Failed Tests:${colors.reset}`);
    TESTS_FAILED.forEach(({ name, error }) => {
      console.log(`  ${colors.red}✗${colors.reset} ${name}`);
      console.log(`    ${error}`);
    });
    process.exit(1);
  }

  console.log(`\n${colors.green}All tests passed!${colors.reset}\n`);
}

runTests().catch((error) => {
  console.error(`${colors.red}Test runner failed:${colors.reset}`, error.message);
  process.exit(1);
});
