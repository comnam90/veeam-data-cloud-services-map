#!/usr/bin/env node

/**
 * Build script to convert YAML region files to JSON for API consumption
 * Reads all YAML files from data/regions/ and outputs a single JSON array
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const DATA_DIR = path.join(__dirname, '..', 'data', 'regions');
const OUTPUT_DIR = path.join(__dirname, '..', 'functions', '_shared');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'regions.json');

/**
 * Recursively find all YAML files in a directory
 */
function findYamlFiles(dir) {
  const files = [];
  const items = fs.readdirSync(dir);

  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      files.push(...findYamlFiles(fullPath));
    } else if (item.endsWith('.yaml') || item.endsWith('.yml')) {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * Load and parse a YAML file
 */
function loadYamlFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const data = yaml.load(content);
    return data;
  } catch (error) {
    console.error(`Error loading ${filePath}:`, error.message);
    return null;
  }
}

/**
 * Validate region data structure
 */
function validateRegion(region, filePath) {
  const errors = [];

  if (!region.id) errors.push('Missing id');
  if (!region.name) errors.push('Missing name');
  if (!region.provider) errors.push('Missing provider');
  if (!Array.isArray(region.coords) || region.coords.length !== 2) {
    errors.push('Invalid coords (must be array of [lat, lng])');
  }
  if (!region.services) errors.push('Missing services');

  if (errors.length > 0) {
    console.warn(`⚠️  Validation warnings for ${path.basename(filePath)}:`);
    errors.forEach(err => console.warn(`   - ${err}`));
    return false;
  }

  return true;
}

/**
 * Main build function
 */
function buildApiData() {
  console.log('🔨 Building API data from YAML files...\n');

  // Find all YAML files
  const yamlFiles = findYamlFiles(DATA_DIR);
  console.log(`📁 Found ${yamlFiles.length} YAML files`);

  // Load and parse all files
  const regions = [];
  let validCount = 0;
  let invalidCount = 0;

  for (const filePath of yamlFiles) {
    const region = loadYamlFile(filePath);

    if (region) {
      if (validateRegion(region, filePath)) {
        regions.push(region);
        validCount++;
      } else {
        invalidCount++;
      }
    } else {
      invalidCount++;
    }
  }

  console.log(`\n✅ Loaded ${validCount} valid regions`);
  if (invalidCount > 0) {
    console.log(`⚠️  ${invalidCount} regions had issues`);
  }

  // Sort regions by provider then name for consistent output
  regions.sort((a, b) => {
    if (a.provider !== b.provider) {
      return a.provider.localeCompare(b.provider);
    }
    return a.name.localeCompare(b.name);
  });

  // Create output directory if it doesn't exist
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    console.log(`📁 Created output directory: ${OUTPUT_DIR}`);
  }

  // Write JSON output
  const jsonOutput = JSON.stringify(regions, null, 2);
  fs.writeFileSync(OUTPUT_FILE, jsonOutput, 'utf8');

  console.log(`\n💾 Wrote ${regions.length} regions to ${path.relative(process.cwd(), OUTPUT_FILE)}`);
  console.log(`📊 Output size: ${(jsonOutput.length / 1024).toFixed(2)} KB`);

  // Print summary by provider
  const awsCount = regions.filter(r => r.provider === 'AWS').length;
  const azureCount = regions.filter(r => r.provider === 'Azure').length;
  console.log(`\n📈 Summary:`);
  console.log(`   AWS regions: ${awsCount}`);
  console.log(`   Azure regions: ${azureCount}`);
  console.log(`   Total: ${regions.length}`);

  console.log('\n✨ Build complete!\n');
}

// Run the build
try {
  buildApiData();
  process.exit(0);
} catch (error) {
  console.error('\n❌ Build failed:', error.message);
  console.error(error.stack);
  process.exit(1);
}
