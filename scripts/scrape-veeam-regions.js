/**
 * Veeam Region Scraper
 * 
 * Scrapes official Veeam Data Cloud helpcenter pages to extract service availability
 * information for AWS and Azure regions.
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

// URLs to scrape
const VEEAM_DOCS_URLS = {
  vdc_m365: 'https://helpcenter.veeam.com/docs/vdc/userguide/m365_region_availability.html',
  vdc_azure_backup: 'https://helpcenter.veeam.com/docs/vdc/userguide/azure_regions.html',
  vdc_entra_id: 'https://helpcenter.veeam.com/docs/vdc/userguide/entra_id_regions.html',
  vdc_salesforce: 'https://helpcenter.veeam.com/docs/vdc/userguide/sf_regions.html',
  vdc_vault: 'https://www.veeam.com/products/veeam-data-cloud/cloud-storage-vault.html'
};

// Pattern for global region markers in Veeam tables
const GLOBAL_REGIONS_PATTERN = /^(AMER|APJ|EMEA)$/i;

/**
 * Check if a text value is a global region marker
 */
function isGlobalRegionMarker(text) {
  return GLOBAL_REGIONS_PATTERN.test(text);
}

/**
 * Extract region name without parentheses
 */
function extractRegionNameWithoutParentheses(name) {
  return name.split('(')[0].trim();
}

/**
 * Fetch HTML content from a URL with retries
 */
async function fetchWithRetry(url, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.text();
    } catch (error) {
      console.error(`Attempt ${attempt}/${maxRetries} failed for ${url}: ${error.message}`);
      if (attempt === maxRetries) {
        throw error;
      }
      // Wait before retrying (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt - 1)));
    }
  }
}

/**
 * Parse HTML table to extract region information
 * Actual Veeam table structure (verified with live data):
 * | Global Region | Azure Region |
 * | AMER/APJ/EMEA | East US, West US, etc. |
 * 
 * Due to rowspan, subsequent rows in a group only have the region name cell.
 * Note: Tables only list region display names, not codes.
 * All services are Azure-based (no AWS in these docs).
 */
function parseRegionTable(html, serviceKey) {
  const regions = [];
  
  // Extract table rows
  const tableRowPattern = /<tr[^>]*>(.*?)<\/tr>/gis;
  const cellPattern = /<t[dh][^>]*>(.*?)<\/t[dh]>/gis;
  
  const rows = [...html.matchAll(tableRowPattern)];
  
  for (let i = 0; i < rows.length; i++) {
    const rowHtml = rows[i][1];
    // Simple HTML stripping - adequate for table cells
    // For more complex parsing, consider using cheerio or jsdom
    const cells = [...rowHtml.matchAll(cellPattern)].map(match => 
      match[1].replace(/<[^>]+>/g, '').trim()
    );
    
    // Skip empty rows
    if (cells.length === 0) {
      continue;
    }
    
    // Skip header row: "Global Region" | "Azure Region"
    if (cells.some(cell => /^(global region|azure region|cloud provider|region name)$/i.test(cell))) {
      continue;
    }
    
    let regionName = null;
    
    if (cells.length === 1) {
      // Single cell = region name (due to rowspan on previous row's global region)
      const cell = cells[0];
      // Skip if it's a global region marker
      if (!isGlobalRegionMarker(cell)) {
        regionName = cell;
      }
    } else if (cells.length >= 2) {
      // Two cells = [Global Region, Region Name]
      const firstCell = cells[0];
      const secondCell = cells[1];
      
      // Skip if first cell is global region marker and no second cell
      if (isGlobalRegionMarker(firstCell) && secondCell) {
        regionName = secondCell;
      }
      // Otherwise, if first cell is not a global region, it's the region name
      else if (!isGlobalRegionMarker(firstCell)) {
        regionName = firstCell;
      }
    }
    
    if (regionName) {
      // All regions in these docs are Azure
      regions.push({
        provider: 'Azure',
        regionName: regionName,
        regionCode: null, // Codes not provided in HTML, will match by name
        serviceKey
      });
    }
  }
  
  return regions;
}

/**
 * Parse Vault FAQ page to extract region information
 * The Vault page has a different structure with nested lists showing editions and tiers
 */
function parseVaultFAQ(html) {
  const regions = [];
  
  // Extract Azure regions section
  const azureMatch = html.match(/Azure regions[^?]*?support[^?]*?\?[\s\S]{0,8000}/i);
  if (azureMatch) {
    const azureSection = azureMatch[0];
    
    // Extract Core Regions
    const coreMatch = azureSection.match(/(?<!Non-)Core Regions:[\s\S]*?<ul>([\s\S]*?)<\/ul>/i);
    if (coreMatch) {
      const coreList = coreMatch[1];
      const liPattern = /<li>(.*?)<\/li>/gi;
      const coreRegions = [...coreList.matchAll(liPattern)];
      
      for (const match of coreRegions) {
        let regionName = match[1].replace(/<[^>]+>/g, '').trim();
        // Remove footnote markers like *
        regionName = regionName.replace(/\*/g, '');
        
        if (regionName && !regionName.toLowerCase().includes('edition')) {
          regions.push({
            provider: 'Azure',
            regionName: regionName,
            regionCode: null,
            serviceKey: 'vdc_vault',
            edition: ['Foundation', 'Advanced'], // Might be limited, but start with both
            tier: 'Core'
          });
        }
      }
    }
    
    // Extract Non-Core Regions
    const nonCoreMatch = azureSection.match(/Non-Core Regions:[\s\S]*?<ul>([\s\S]*?)<\/ul>/i);
    if (nonCoreMatch) {
      const nonCoreList = nonCoreMatch[1];
      const liPattern = /<li>(.*?)<\/li>/gi;
      const nonCoreRegions = [...nonCoreList.matchAll(liPattern)];
      
      for (const match of nonCoreRegions) {
        let regionName = match[1].replace(/<[^>]+>/g, '').trim();
        regionName = regionName.replace(/\*/g, '');
        
        // Check if Advanced is unavailable (marked with *)
        const hasAdvanced = !match[1].includes('*');
        const editions = hasAdvanced ? ['Foundation', 'Advanced'] : ['Foundation'];
        
        if (regionName && !regionName.toLowerCase().includes('edition')) {
          regions.push({
            provider: 'Azure',
            regionName: regionName,
            regionCode: null,
            serviceKey: 'vdc_vault',
            edition: editions,
            tier: 'Non-Core'
          });
        }
      }
    }
  }
  
  // Extract AWS regions section
  const awsMatch = html.match(/AWS regions[^?]*?support[^?]*?\?[\s\S]{0,8000}/i);
  if (awsMatch) {
    const awsSection = awsMatch[0];
    
    // Foundation Core
    const foundationCoreMatch = awsSection.match(/Foundation Core regions:[\s\S]*?<ul>([\s\S]*?)<\/ul>/i);
    if (foundationCoreMatch) {
      const list = foundationCoreMatch[1];
      const liPattern = /<li>(.*?)<\/li>/gi;
      const awsRegions = [...list.matchAll(liPattern)];
      
      for (const match of awsRegions) {
        const regionName = match[1].replace(/<[^>]+>/g, '').trim();
        if (regionName) {
          regions.push({
            provider: 'AWS',
            regionName: regionName,
            regionCode: null,
            serviceKey: 'vdc_vault',
            edition: ['Foundation'],
            tier: 'Core'
          });
        }
      }
    }
    
    // Advanced Core
    const advancedCoreMatch = awsSection.match(/Advanced Core Regions:[\s\S]*?<ul>([\s\S]*?)<\/ul>/i);
    if (advancedCoreMatch) {
      const list = advancedCoreMatch[1];
      const liPattern = /<li>(.*?)<\/li>/gi;
      const awsRegions = [...list.matchAll(liPattern)];
      
      for (const match of awsRegions) {
        const regionName = match[1].replace(/<[^>]+>/g, '').trim();
        if (regionName) {
          // Check if this region already exists in Foundation Core
          const existingIdx = regions.findIndex(r => 
            r.provider === 'AWS' && 
            r.regionName === regionName &&
            r.tier === 'Core'
          );
          
          if (existingIdx >= 0) {
            // Add Advanced to existing entry
            if (!regions[existingIdx].edition.includes('Advanced')) {
              regions[existingIdx].edition.push('Advanced');
            }
          } else {
            // New entry for Advanced only
            regions.push({
              provider: 'AWS',
              regionName: regionName,
              regionCode: null,
              serviceKey: 'vdc_vault',
              edition: ['Advanced'],
              tier: 'Core'
            });
          }
        }
      }
    }
    
    // Foundation Non-Core
    const foundationNonCoreMatch = awsSection.match(/Foundation Non-Core Regions:[\s\S]*?<ul>([\s\S]*?)<\/ul>/i);
    if (foundationNonCoreMatch) {
      const list = foundationNonCoreMatch[1];
      const liPattern = /<li>(.*?)<\/li>/gi;
      const awsRegions = [...list.matchAll(liPattern)];
      
      for (const match of awsRegions) {
        const regionName = match[1].replace(/<[^>]+>/g, '').trim();
        if (regionName) {
          regions.push({
            provider: 'AWS',
            regionName: regionName,
            regionCode: null,
            serviceKey: 'vdc_vault',
            edition: ['Foundation'],
            tier: 'Non-Core'
          });
        }
      }
    }
  }
  
  return regions;
}

/**
 * Load current region data from YAML files
 */
function loadCurrentRegions(dataDir) {
  const regions = [];
  
  function walkDir(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walkDir(fullPath);
      } else if (entry.name.endsWith('.yaml')) {
        try {
          const content = fs.readFileSync(fullPath, 'utf8');
          const data = yaml.load(content);
          regions.push({
            filePath: fullPath,
            data
          });
        } catch (error) {
          console.error(`Error reading ${fullPath}: ${error.message}`);
        }
      }
    }
  }
  
  walkDir(dataDir);
  return regions;
}

/**
 * Normalize region identifiers for comparison
 */
function normalizeRegionCode(code) {
  if (!code) return '';
  return code.toLowerCase()
    .replace(/\s+/g, '')
    .replace(/_/g, '-')
    .replace(/\(/g, '')
    .replace(/\)/g, '');
}

/**
 * Normalize region text for comparison
 */
function normalizeRegionText(text, removeSpaces = false) {
  if (!text) return '';
  let normalized = text.toLowerCase().trim();
  
  // Handle common abbreviations and variations
  // Order matters: more specific patterns first
  normalized = normalized
    .replace(/\bnorth europe\b/g, 'eu north')
    .replace(/\bsouth europe\b/g, 'eu south')
    .replace(/\beuropean\b/g, 'eu')
    .replace(/\bamerica\b/g, 'us')
    .replace(/\bunited states\b/g, 'us')
    .replace(/\bmiddle east\b/g, 'me');
  
  if (removeSpaces) {
    normalized = normalized.replace(/\s+/g, '');
  }
  return normalized;
}

/**
 * Find matching region in current data
 * Updated to work primarily with region names since Veeam docs don't provide codes
 * Also checks aliases for better matching
 */
function findMatchingRegion(scrapedRegion, currentRegions) {
  // Since we don't have region codes from Veeam docs, match primarily by name
  for (const { data } of currentRegions) {
    if (!data || !data.name) continue;
    
    // Provider must match
    if (scrapedRegion.provider && data.provider) {
      if (scrapedRegion.provider !== data.provider) {
        continue;
      }
    }
    
    // Match by region name
    if (scrapedRegion.regionName) {
      const normalizedScrapedName = normalizeRegionText(scrapedRegion.regionName);
      const normalizedCurrentName = normalizeRegionText(data.name);
      const currentNameWithoutParens = extractRegionNameWithoutParentheses(data.name);
      const normalizedCurrentNameWithoutParens = normalizeRegionText(currentNameWithoutParens);
      
      // Priority 1: Exact match after normalization
      // E.g., "east us" === "east us"
      if (normalizedScrapedName === normalizedCurrentNameWithoutParens) {
        return data;
      }
      
      // Priority 2: Exact match with parenthetical content
      // E.g., "east us" matches "east us (virginia)"
      if (normalizedScrapedName === normalizedCurrentName) {
        return data;
      }
      
      // Priority 3: Word boundary match to avoid "West US" matching "West US 2"
      // Use word boundaries to ensure we match complete words
      const scrapedWords = normalizedScrapedName.split(/\s+/);
      const currentWords = normalizedCurrentNameWithoutParens.split(/\s+/);
      
      // Check if all words from scraped name appear in current name in order
      if (scrapedWords.length > 0 && currentWords.length > 0) {
        let scrapedIdx = 0;
        for (const currentWord of currentWords) {
          if (scrapedIdx < scrapedWords.length && currentWord === scrapedWords[scrapedIdx]) {
            scrapedIdx++;
          }
        }
        // If all scraped words matched in order and counts match, it's a match
        if (scrapedIdx === scrapedWords.length && scrapedWords.length === currentWords.length) {
          return data;
        }
      }

      // Priority 3.5: Same words, any order
      // E.g. "India Central" matches "Central India"
      if (scrapedWords.length > 0 && currentWords.length > 0) {
        const scrapedWordsSet = new Set(scrapedWords);
        const currentWordsSet = new Set(currentWords);
        
        if (scrapedWordsSet.size === currentWordsSet.size && 
            scrapedWords.length === currentWords.length &&
            [...scrapedWordsSet].every(word => currentWordsSet.has(word))) {
          return data;
        }
      }
      
      // Priority 4: Substring match (less specific, used for partial matches)
      // E.g., "East US" should match "East US (Virginia)"
      if (normalizedCurrentName.includes(normalizedScrapedName)) {
        return data;
      }
      
      // Priority 5: Try matching without spaces for compound names
      const normalizedScrapedNoSpaces = normalizeRegionText(normalizedScrapedName, true);
      const normalizedCurrentNoSpaces = normalizeRegionText(currentNameWithoutParens, true);
      
      if (normalizedScrapedNoSpaces === normalizedCurrentNoSpaces) {
        return data;
      }
      
      // Priority 6: Check aliases if available
      // E.g., "India Central" might match alias "India" in "Central India" region
      if (data.aliases && Array.isArray(data.aliases)) {
        for (const alias of data.aliases) {
          const normalizedAlias = normalizeRegionText(alias);
          
          // Exact alias match
          if (normalizedScrapedName === normalizedAlias) {
            return data;
          }
        }
      }
    }
  }
  
  return null;
}

/**
 * Compare scraped data with current data and identify discrepancies
 */
function compareRegions(scrapedData, currentRegions) {
  const discrepancies = {
    missingRegions: [],
    missingServices: [],
    extraServices: []
  };
  
  for (const scrapedRegion of scrapedData) {
    const matchingRegion = findMatchingRegion(scrapedRegion, currentRegions);
    
    if (!matchingRegion) {
      // Region exists in Veeam docs but not in our data
      discrepancies.missingRegions.push({
        provider: scrapedRegion.provider || 'Unknown',
        regionName: scrapedRegion.regionName,
        regionCode: scrapedRegion.regionCode,
        service: scrapedRegion.serviceKey,
        source: VEEAM_DOCS_URLS[scrapedRegion.serviceKey]
      });
    } else {
      // Region exists, check if service is listed
      const hasService = matchingRegion.services && 
                        matchingRegion.services[scrapedRegion.serviceKey];
      
      if (!hasService) {
        const discrepancy = {
          regionId: matchingRegion.id,
          regionName: matchingRegion.name,
          provider: matchingRegion.provider,
          service: scrapedRegion.serviceKey,
          source: VEEAM_DOCS_URLS[scrapedRegion.serviceKey]
        };
        
        // For Vault, include edition and tier info
        if (scrapedRegion.serviceKey === 'vdc_vault' && scrapedRegion.edition && scrapedRegion.tier) {
          discrepancy.edition = scrapedRegion.edition;
          discrepancy.tier = scrapedRegion.tier;
        }
        
        discrepancies.missingServices.push(discrepancy);
      } else if (scrapedRegion.serviceKey === 'vdc_vault' && scrapedRegion.edition && scrapedRegion.tier) {
        // For Vault, check if the edition/tier matches
        const currentVaultConfig = matchingRegion.services.vdc_vault;
        if (Array.isArray(currentVaultConfig)) {
          // Check if each scraped edition/tier combo exists
          for (const scrapedEdition of scrapedRegion.edition) {
            const found = currentVaultConfig.some(config => 
              config.edition === scrapedEdition && config.tier === scrapedRegion.tier
            );
            
            if (!found) {
              discrepancies.missingServices.push({
                regionId: matchingRegion.id,
                regionName: matchingRegion.name,
                provider: matchingRegion.provider,
                service: scrapedRegion.serviceKey,
                edition: [scrapedEdition],
                tier: scrapedRegion.tier,
                source: VEEAM_DOCS_URLS[scrapedRegion.serviceKey],
                note: `Edition "${scrapedEdition}" with tier "${scrapedRegion.tier}" not found in current data`
              });
            }
          }
        }
      }
    }
  }
  
  // Check for services in our data that aren't in scraped data (potential removals)
  const scrapedServicesByRegion = new Map();
  
  for (const scraped of scrapedData) {
    const key = normalizeRegionCode(scraped.regionCode);
    if (!scrapedServicesByRegion.has(key)) {
      scrapedServicesByRegion.set(key, new Set());
    }
    scrapedServicesByRegion.get(key).add(scraped.serviceKey);
  }
  
  for (const { data } of currentRegions) {
    if (!data || !data.services) continue;
    
    const normalizedId = normalizeRegionCode(data.id);
    
    for (const serviceKey of Object.keys(data.services)) {
      // Check if this is a scraped service
      if (!Object.keys(VEEAM_DOCS_URLS).includes(serviceKey)) continue;
      
      // Check if we found this service for this region
      let foundInScraped = false;
      for (const [scrapedKey, services] of scrapedServicesByRegion) {
        if (normalizedId.includes(scrapedKey) || scrapedKey.includes(normalizedId)) {
          if (services.has(serviceKey)) {
            foundInScraped = true;
            break;
          }
        }
      }
      
      if (!foundInScraped) {
        // Service listed in our data but not found in Veeam docs
        // This could mean it was removed or our scraping missed it
        discrepancies.extraServices.push({
          regionId: data.id,
          regionName: data.name,
          provider: data.provider,
          service: serviceKey,
          note: 'Listed in repo but not found in Veeam docs - may have been removed or scraping issue'
        });
      }
    }
  }
  
  return discrepancies;
}

/**
 * Main scraping function
 */
async function scrapeVeeamRegions() {
  console.log('🔍 Starting Veeam region scraper...\n');
  
  const allScrapedData = [];
  const errors = [];
  
  // Scrape each service page
  for (const [serviceKey, url] of Object.entries(VEEAM_DOCS_URLS)) {
    console.log(`📥 Fetching ${serviceKey} data from ${url}...`);
    
    try {
      const html = await fetchWithRetry(url);
      
      // Use different parser for Vault FAQ page
      let regions;
      if (serviceKey === 'vdc_vault') {
        regions = parseVaultFAQ(html);
      } else {
        regions = parseRegionTable(html, serviceKey);
      }
      
      console.log(`   ✓ Found ${regions.length} regions for ${serviceKey}`);
      allScrapedData.push(...regions);
    } catch (error) {
      const errorMsg = `Failed to scrape ${serviceKey}: ${error.message}`;
      console.error(`   ✗ ${errorMsg}`);
      errors.push({ serviceKey, url, error: error.message });
    }
  }
  
  console.log(`\n📊 Total regions scraped: ${allScrapedData.length}`);
  
  // Load current region data
  const dataDir = path.join(__dirname, '..', 'data', 'regions');
  console.log(`\n📂 Loading current region data from ${dataDir}...`);
  const currentRegions = loadCurrentRegions(dataDir);
  console.log(`   ✓ Loaded ${currentRegions.length} region files`);
  
  // Compare and find discrepancies
  console.log('\n🔍 Comparing scraped data with current data...');
  const discrepancies = compareRegions(allScrapedData, currentRegions);
  
  // Report results
  console.log('\n📋 Results:');
  console.log(`   Missing Regions: ${discrepancies.missingRegions.length}`);
  console.log(`   Missing Services: ${discrepancies.missingServices.length}`);
  console.log(`   Extra Services: ${discrepancies.extraServices.length}`);
  
  if (errors.length > 0) {
    console.log(`   ⚠️  Scraping Errors: ${errors.length}`);
  }
  
  // Write results to file
  const outputPath = path.join(__dirname, '..', 'region-discrepancies.json');
  const output = {
    timestamp: new Date().toISOString(),
    scrapedRegions: allScrapedData.length,
    currentRegions: currentRegions.length,
    discrepancies,
    errors
  };
  
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
  console.log(`\n💾 Results saved to ${outputPath}`);
  
  return output;
}

// Export for testing
module.exports = {
  scrapeVeeamRegions,
  parseRegionTable,
  parseVaultFAQ,
  loadCurrentRegions,
  compareRegions,
  normalizeRegionCode,
  findMatchingRegion,
  VEEAM_DOCS_URLS
};

// Run if called directly
if (require.main === module) {
  scrapeVeeamRegions()
    .then(result => {
      const hasIssues = 
        result.discrepancies.missingRegions.length > 0 ||
        result.discrepancies.missingServices.length > 0 ||
        result.errors.length > 0;
      
      if (hasIssues) {
        console.log('\n⚠️  Discrepancies or errors found. Review the output file.');
        process.exit(1);
      } else {
        console.log('\n✅ No discrepancies found. Data is up to date!');
        process.exit(0);
      }
    })
    .catch(error => {
      console.error('\n❌ Fatal error:', error);
      process.exit(1);
    });
}
