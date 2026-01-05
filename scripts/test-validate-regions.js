/**
 * Region Data Validation Tests - Issue #12
 *
 * TDD tests for YAML region file validation.
 * Run with: npm run test:validate
 */

const path = require('path');
const os = require('os');
const fs = require('fs');

// Import the validator module (does not exist yet - tests will fail)
const { validateRegionFile, validateAllRegions } = require('./validate-regions.js');

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

async function runTests() {
  console.log(`\n${colors.cyan}🧪 Running Region Validation Tests (Issue #12)${colors.reset}\n`);

  // Test 1: YAML Syntax Validation
  await test('Should_FailValidation_When_YAMLSyntaxIsInvalid_Issue12', async () => {
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
  await test('Should_FailValidation_When_RequiredFieldsAreMissing_Issue12', async () => {
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
  await test('Should_FailValidation_When_ProviderIsNotExactlyAWSOrAzure_Issue12', async () => {
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
  await test('Should_FailValidation_When_CoordsIsNotNumberArray_Issue12', async () => {
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

  await test('Should_FailValidation_When_CoordsHasWrongArrayLength_Issue12', async () => {
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
  await test('Should_FailValidation_When_IDDoesNotMatchPattern_Issue12', async () => {
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
  await test('Should_FailValidation_When_DuplicateIDsExistAcrossFiles_Issue12', async () => {
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
  await test('Should_FailValidation_When_TieredServiceHasInvalidEdition_Issue12', async () => {
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

  await test('Should_FailValidation_When_TieredServiceHasInvalidTier_Issue12', async () => {
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
  await test('Should_PassValidation_When_AllFieldsAreValid_Issue12', async () => {
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
