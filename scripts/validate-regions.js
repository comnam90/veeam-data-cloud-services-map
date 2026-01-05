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
const BOOLEAN_SERVICES = ['vdc_m365', 'vdc_entra_id', 'vdc_salesforce', 'vdc_azure_backup'];

function validateRegionFile(filePath) {
  const errors = [];
  
  let content;
  try {
    content = fs.readFileSync(filePath, 'utf8');
  } catch (e) {
    errors.push({
      type: 'file_read_error',
      message: `Cannot read file: ${e.message}`,
      file: filePath
    });
    return { valid: false, errors, data: null };
  }
  
  let data;
  try {
    data = yaml.load(content);
  } catch (e) {
    errors.push({
      type: 'yaml_syntax',
      message: e.message,
      file: filePath
    });
    return { valid: false, errors, data: null };
  }
  
  if (!data || typeof data !== 'object') {
    errors.push({
      type: 'invalid_structure',
      message: 'File must contain a valid YAML object (not empty or null)',
      file: filePath
    });
    return { valid: false, errors, data: null };
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
    const [lat, lng] = Array.isArray(data.coords) ? data.coords : [];
    const isValidCoords = Array.isArray(data.coords) &&
      data.coords.length === 2 &&
      typeof lat === 'number' &&
      typeof lng === 'number' &&
      Number.isFinite(lat) &&
      Number.isFinite(lng) &&
      lat >= -90 && lat <= 90 &&
      lng >= -180 && lng <= 180;
    
    if (!isValidCoords) {
      errors.push({
        type: 'invalid_coords',
        value: data.coords,
        message: 'Coordinates must be [lat, lng] with lat in [-90, 90] and lng in [-180, 180]',
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
        if (!Array.isArray(serviceConfig)) {
          errors.push({
            type: 'invalid_service_config',
            service: serviceName,
            field: null,
            value: serviceConfig,
            message: `Tiered service "${serviceName}" must be an array of edition/tier objects`,
            file: filePath
          });
        } else {
          for (const entry of serviceConfig) {
            if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
              errors.push({
                type: 'invalid_service_config',
                service: serviceName,
                field: null,
                value: entry,
                message: `Invalid entry in ${serviceName} array: expected object with edition/tier, got ${entry === null ? 'null' : typeof entry}`,
                file: filePath
              });
              continue;
            }
            if (!entry.edition) {
              errors.push({
                type: 'invalid_service_config',
                service: serviceName,
                field: 'edition',
                value: entry.edition,
                message: `Missing required field "edition" in ${serviceName} entry`,
                file: filePath
              });
            } else if (!VALID_EDITIONS.includes(entry.edition)) {
              errors.push({
                type: 'invalid_service_config',
                service: serviceName,
                field: 'edition',
                value: entry.edition,
                message: `Invalid edition "${entry.edition}" for ${serviceName}. Must be one of: ${VALID_EDITIONS.join(', ')}`,
                file: filePath
              });
            }
            if (!entry.tier) {
              errors.push({
                type: 'invalid_service_config',
                service: serviceName,
                field: 'tier',
                value: entry.tier,
                message: `Missing required field "tier" in ${serviceName} entry`,
                file: filePath
              });
            } else if (!VALID_TIERS.includes(entry.tier)) {
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
      } else if (BOOLEAN_SERVICES.includes(serviceName)) {
        if (serviceConfig !== true) {
          errors.push({
            type: 'invalid_service_config',
            service: serviceName,
            field: null,
            value: serviceConfig,
            message: `Boolean service "${serviceName}" must be true, got ${typeof serviceConfig}`,
            file: filePath
          });
        }
      } else {
        const validServices = [...TIERED_SERVICES, ...BOOLEAN_SERVICES];
        errors.push({
          type: 'unknown_service',
          service: serviceName,
          value: serviceConfig,
          message: `Unknown service "${serviceName}". Valid services are: ${validServices.join(', ')}`,
          file: filePath
        });
      }
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
    data
  };
}

function checkDuplicateIds(validationResults, errors) {
  const idToFiles = new Map();
  
  for (const { filePath, data } of validationResults) {
    if (data && data.id) {
      if (!idToFiles.has(data.id)) {
        idToFiles.set(data.id, []);
      }
      idToFiles.get(data.id).push(filePath);
    }
  }
  
  for (const [id, files] of idToFiles) {
    if (files.length > 1) {
      errors.push({
        type: 'duplicate_id',
        id,
        files,
        message: `Duplicate ID "${id}" found in ${files.length} files`,
        file: files[0]
      });
    }
  }
}

function validateAllRegions(directory) {
  const errors = [];
  const validationResults = [];
  
  let files;
  try {
    files = fs.readdirSync(directory).filter(f => f.endsWith('.yaml'));
  } catch (e) {
    errors.push({
      type: 'directory_error',
      message: `Cannot read directory: ${e.message}`,
      file: directory
    });
    return { valid: false, errors };
  }
  
  for (const file of files) {
    const filePath = path.join(directory, file);
    const result = validateRegionFile(filePath);
    errors.push(...result.errors);
    validationResults.push({ filePath, data: result.data });
  }
  
  checkDuplicateIds(validationResults, errors);
  
  return { valid: errors.length === 0, errors };
}

function validateAllRegionsRecursive(directory) {
  const allErrors = [];
  const validationResults = [];
  
  function walkDir(dir) {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (e) {
      allErrors.push({
        type: 'directory_error',
        message: `Cannot read directory: ${e.message}`,
        file: dir
      });
      return;
    }
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walkDir(fullPath);
      } else if (entry.name.endsWith('.yaml')) {
        const result = validateRegionFile(fullPath);
        allErrors.push(...result.errors);
        validationResults.push({ filePath: fullPath, data: result.data });
      }
    }
  }
  
  walkDir(directory);
  checkDuplicateIds(validationResults, allErrors);
  
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
