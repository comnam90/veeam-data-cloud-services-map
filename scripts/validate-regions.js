/**
 * Region Data Validator - Issue #12
 *
 * Validates YAML region files for syntax and schema compliance.
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const REQUIRED_FIELDS = ['id', 'name', 'provider', 'coords'];
const VALID_PROVIDERS = ['AWS', 'Azure'];
const ID_PATTERN = /^(aws|azure)-[a-z0-9-]+$/;
const VALID_EDITIONS = ['Foundation', 'Advanced'];
const VALID_TIERS = ['Core', 'Non-Core'];
const TIERED_SERVICES = ['vdc_vault'];

function validateRegionFile(filePath) {
  const errors = [];
  
  const content = fs.readFileSync(filePath, 'utf8');
  
  let data;
  try {
    data = yaml.load(content);
  } catch (e) {
    errors.push({
      type: 'yaml_syntax',
      message: e.message,
      file: filePath
    });
    return { valid: false, errors };
  }
  
  for (const field of REQUIRED_FIELDS) {
    if (data[field] === undefined) {
      errors.push({
        type: 'missing_field',
        field,
        message: `Missing required field: ${field}`,
        file: filePath
      });
    }
  }
  
  if (data.provider !== undefined && !VALID_PROVIDERS.includes(data.provider)) {
    errors.push({
      type: 'invalid_provider',
      value: data.provider,
      message: `Invalid provider: "${data.provider}". Must be exactly "AWS" or "Azure"`,
      file: filePath
    });
  }
  
  if (data.coords !== undefined) {
    const isValidCoords = Array.isArray(data.coords) &&
      data.coords.length === 2 &&
      typeof data.coords[0] === 'number' &&
      typeof data.coords[1] === 'number';
    
    if (!isValidCoords) {
      errors.push({
        type: 'invalid_coords',
        value: data.coords,
        message: 'Coordinates must be an array of two numbers [lat, lng]',
        file: filePath
      });
    }
  }
  
  if (data.id !== undefined && !ID_PATTERN.test(data.id)) {
    errors.push({
      type: 'invalid_id_format',
      value: data.id,
      message: `Invalid ID format: "${data.id}". Must match pattern: ${ID_PATTERN}`,
      file: filePath
    });
  }
  
  if (data.services) {
    for (const [serviceName, serviceConfig] of Object.entries(data.services)) {
      if (TIERED_SERVICES.includes(serviceName)) {
        if (Array.isArray(serviceConfig)) {
          for (const entry of serviceConfig) {
            if (entry.edition && !VALID_EDITIONS.includes(entry.edition)) {
              errors.push({
                type: 'invalid_service_config',
                service: serviceName,
                field: 'edition',
                value: entry.edition,
                message: `Invalid edition "${entry.edition}" for ${serviceName}. Must be one of: ${VALID_EDITIONS.join(', ')}`,
                file: filePath
              });
            }
            if (entry.tier && !VALID_TIERS.includes(entry.tier)) {
              errors.push({
                type: 'invalid_service_config',
                service: serviceName,
                field: 'tier',
                value: entry.tier,
                message: `Invalid tier "${entry.tier}" for ${serviceName}. Must be one of: ${VALID_TIERS.join(', ')}`,
                file: filePath
              });
            }
          }
        }
      }
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

function validateAllRegions(directory) {
  const errors = [];
  const seenIds = new Map();
  
  const files = fs.readdirSync(directory).filter(f => f.endsWith('.yaml'));
  
  for (const file of files) {
    const filePath = path.join(directory, file);
    const result = validateRegionFile(filePath);
    errors.push(...result.errors);
    
    const content = fs.readFileSync(filePath, 'utf8');
    try {
      const data = yaml.load(content);
      if (data && data.id) {
        if (seenIds.has(data.id)) {
          errors.push({
            type: 'duplicate_id',
            id: data.id,
            files: [seenIds.get(data.id), filePath],
            message: `Duplicate ID "${data.id}" found in multiple files`,
            file: filePath
          });
        } else {
          seenIds.set(data.id, filePath);
        }
      }
    } catch (e) {
      // YAML parse error already reported by validateRegionFile
    }
  }
  
  return { valid: errors.length === 0, errors };
}

function validateAllRegionsRecursive(directory) {
  const allErrors = [];
  const seenIds = new Map();
  
  function walkDir(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walkDir(fullPath);
      } else if (entry.name.endsWith('.yaml')) {
        const result = validateRegionFile(fullPath);
        allErrors.push(...result.errors);
        
        try {
          const content = fs.readFileSync(fullPath, 'utf8');
          const data = yaml.load(content);
          if (data && data.id) {
            if (seenIds.has(data.id)) {
              allErrors.push({
                type: 'duplicate_id',
                id: data.id,
                files: [seenIds.get(data.id), fullPath],
                message: `Duplicate ID "${data.id}" found in multiple files`,
                file: fullPath
              });
            } else {
              seenIds.set(data.id, fullPath);
            }
          }
        } catch (e) {
          // YAML parse error already reported
        }
      }
    }
  }
  
  walkDir(directory);
  return { valid: allErrors.length === 0, errors: allErrors };
}

module.exports = { validateRegionFile, validateAllRegions, validateAllRegionsRecursive };

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
};

if (require.main === module) {
  const dataDir = process.argv[2] || path.join(__dirname, '..', 'data', 'regions');
  
  console.log(`${colors.cyan}🔍 Validating region files in: ${dataDir}${colors.reset}\n`);
  
  const result = validateAllRegionsRecursive(dataDir);
  
  if (result.valid) {
    console.log(`${colors.green}✓ All region files are valid!${colors.reset}\n`);
    process.exit(0);
  } else {
    console.log(`${colors.red}✗ Validation failed with ${result.errors.length} error(s):${colors.reset}\n`);
    for (const error of result.errors) {
      const relPath = path.relative(dataDir, error.file);
      console.log(`  ${colors.red}•${colors.reset} ${colors.yellow}${relPath}${colors.reset}`);
      console.log(`    ${error.message}`);
    }
    console.log('');
    process.exit(1);
  }
}
