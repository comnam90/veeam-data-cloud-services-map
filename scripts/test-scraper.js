/**
 * Region Scraper Tests
 *
 * Tests for the automated region scraping and comparison functionality.
 * Run with: node scripts/test-scraper.js
 */

const path = require('path');
const os = require('os');
const fs = require('fs');

const {
  parseRegionTable,
  parseVaultFAQ,
  normalizeRegionCode,
  findMatchingRegion,
  compareRegions,
  VEEAM_DOCS_URLS
} = require('./scrape-veeam-regions.js');

const {
  formatMissingRegionIssue,
  formatMissingServiceIssue,
  formatExtraServiceIssue,
  SERVICE_NAMES
} = require('./create-region-issues.js');

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

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}\n  Expected: ${expected}\n  Actual: ${actual}`);
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
  console.log(`\n${colors.cyan}🧪 Running Region Scraper Tests${colors.reset}\n`);

  // Test 1: normalizeRegionCode function
  await test('normalizeRegionCode removes spaces and special chars', async () => {
    assertEqual(normalizeRegionCode('us-east-1'), 'us-east-1', 'Should keep hyphens');
    assertEqual(normalizeRegionCode('US East 1'), 'useast1', 'Should remove spaces');
    assertEqual(normalizeRegionCode('US_EAST_1'), 'us-east-1', 'Should convert underscores to hyphens');
    assertEqual(normalizeRegionCode('East US (Virginia)'), 'eastusvirginia', 'Should remove parentheses');
  });

  // Test 2: parseRegionTable function with sample HTML matching real Veeam structure
  await test('parseRegionTable parses real Veeam table structure', async () => {
    const sampleHtml = `
      <table class="Blue_Table">
        <tr>
          <th><p><span>Global Region</span></p></th>
          <th><p><span>Azure Region</span></p></th>
        </tr>
        <tr>
          <td rowspan="3"><p><span>AMER</span></p></td>
          <td><p><span>East US</span></p></td>
        </tr>
        <tr>
          <td><p><span>West US</span></p></td>
        </tr>
        <tr>
          <td><p><span>Central US</span></p></td>
        </tr>
      </table>
    `;
    
    const regions = parseRegionTable(sampleHtml, 'vdc_m365');
    
    assert(regions.length === 3, `Should parse 3 regions, got ${regions.length}`);
    assert(regions[0].serviceKey === 'vdc_m365', 'Should set service key');
    assert(regions[0].provider === 'Azure', 'Should set provider to Azure');
    assert(regions.some(r => r.regionName === 'East US'), 'Should have East US');
    assert(regions.some(r => r.regionName === 'West US'), 'Should have West US');
    assert(regions.some(r => r.regionName === 'Central US'), 'Should have Central US');
  });

  // Test 3: findMatchingRegion function
  await test('findMatchingRegion finds regions by ID', async () => {
    const scrapedRegion = {
      provider: 'AWS',
      regionName: 'US East 1 (N. Virginia)',
      regionCode: 'us-east-1',
      serviceKey: 'vdc_m365'
    };
    
    const currentRegions = [
      {
        data: {
          id: 'aws-us-east-1',
          name: 'US East 1 (N. Virginia)',
          provider: 'AWS',
          services: {}
        }
      },
      {
        data: {
          id: 'azure-eastus',
          name: 'East US (Virginia)',
          provider: 'Azure',
          services: {}
        }
      }
    ];
    
    const match = findMatchingRegion(scrapedRegion, currentRegions);
    assert(match !== null, 'Should find a matching region');
    assertEqual(match.id, 'aws-us-east-1', 'Should match AWS region');
  });

  // Test 4: findMatchingRegion with provider mismatch
  await test('findMatchingRegion respects provider when specified', async () => {
    const scrapedRegion = {
      provider: 'Azure',
      regionName: 'East US',
      regionCode: 'eastus',
      serviceKey: 'vdc_m365'
    };
    
    const currentRegions = [
      {
        data: {
          id: 'aws-us-east-1',
          name: 'US East 1',
          provider: 'AWS',
          services: {}
        }
      },
      {
        data: {
          id: 'azure-eastus',
          name: 'East US',
          provider: 'Azure',
          services: {}
        }
      }
    ];
    
    const match = findMatchingRegion(scrapedRegion, currentRegions);
    assert(match !== null, 'Should find a matching region');
    assertEqual(match.provider, 'Azure', 'Should match Azure region, not AWS');
  });

  // Test 5: compareRegions detects missing regions
  await test('compareRegions detects missing regions', async () => {
    const scrapedData = [
      {
        provider: 'AWS',
        regionName: 'US West 3',
        regionCode: 'us-west-3',
        serviceKey: 'vdc_m365'
      }
    ];
    
    const currentRegions = [
      {
        data: {
          id: 'aws-us-east-1',
          name: 'US East 1',
          provider: 'AWS',
          services: { vdc_m365: true }
        }
      }
    ];
    
    const discrepancies = compareRegions(scrapedData, currentRegions);
    
    assert(discrepancies.missingRegions.length === 1, 
           'Should detect 1 missing region');
    assertEqual(discrepancies.missingRegions[0].regionCode, 'us-west-3',
                'Should identify the correct missing region');
  });

  // Test 6: compareRegions detects missing services
  await test('compareRegions detects missing services in existing regions', async () => {
    const scrapedData = [
      {
        provider: 'AWS',
        regionName: 'US East 1',
        regionCode: 'us-east-1',
        serviceKey: 'vdc_m365'
      }
    ];
    
    const currentRegions = [
      {
        data: {
          id: 'aws-us-east-1',
          name: 'US East 1 (N. Virginia)',
          provider: 'AWS',
          services: {
            vdc_vault: [
              { edition: 'Foundation', tier: 'Core' }
            ]
            // vdc_m365 is missing
          }
        }
      }
    ];
    
    const discrepancies = compareRegions(scrapedData, currentRegions);
    
    assert(discrepancies.missingServices.length === 1,
           `Should detect 1 missing service, got ${discrepancies.missingServices.length}`);
    assertEqual(discrepancies.missingServices[0].service, 'vdc_m365',
                'Should identify vdc_m365 as missing');
    assertEqual(discrepancies.missingServices[0].regionId, 'aws-us-east-1',
                'Should identify the correct region');
  });

  // Test 7: compareRegions now includes vault in scraping
  await test('compareRegions includes vault when checking services', async () => {
    const scrapedData = [
      {
        provider: 'AWS',
        regionName: 'US East 1',
        regionCode: 'us-east-1',
        serviceKey: 'vdc_m365'
      },
      {
        provider: 'AWS',
        regionName: 'US East 1',
        regionCode: null,
        serviceKey: 'vdc_vault',
        edition: ['Foundation'],
        tier: 'Core'
      }
    ];
    
    const currentRegions = [
      {
        data: {
          id: 'aws-us-east-1',
          name: 'US East 1',
          provider: 'AWS',
          services: {
            vdc_vault: [{ edition: 'Foundation', tier: 'Core' }],
            vdc_m365: true
          }
        }
      }
    ];
    
    const discrepancies = compareRegions(scrapedData, currentRegions);
    
    // Both services are properly tracked, no discrepancies expected
    assert(discrepancies.missingServices.length === 0, 
           'Should not flag any missing services when both match');
  });

  // Test 8: findMatchingRegion avoids false positives with similar names
  await test('findMatchingRegion avoids false positives for similar region names', async () => {
    const scrapedRegion = {
      provider: 'Azure',
      regionName: 'West US',
      regionCode: null,
      serviceKey: 'vdc_m365'
    };
    
    const currentRegions = [
      {
        data: {
          id: 'azure-westus',
          name: 'West US (California)',
          provider: 'Azure',
          services: { vdc_m365: true }
        }
      },
      {
        data: {
          id: 'azure-westus2',
          name: 'West US 2 (Washington)',
          provider: 'Azure',
          services: { vdc_m365: true }
        }
      },
      {
        data: {
          id: 'azure-westus3',
          name: 'West US 3 (Arizona)',
          provider: 'Azure',
          services: { vdc_m365: true }
        }
      }
    ];
    
    const matchedRegion = findMatchingRegion(scrapedRegion, currentRegions);
    
    // Should match "West US" exactly, not "West US 2" or "West US 3"
    assert(matchedRegion !== null, 'Should find a matching region');
    assertEqual(matchedRegion.id, 'azure-westus', 
                'Should match "West US" exactly, not "West US 2" or "West US 3"');
    assertEqual(matchedRegion.name, 'West US (California)',
                'Should match the correct region by name');
  });

  // Test 9: formatMissingRegionIssue creates valid issue
  await test('formatMissingRegionIssue creates valid GitHub issue format', async () => {
    const region = {
      provider: 'AWS',
      regionName: 'US West 3',
      regionCode: 'us-west-3',
      service: 'vdc_m365',
      source: 'https://example.com'
    };
    
    const issue = formatMissingRegionIssue(region);
    
    assert(issue.title.includes('Missing Region'), 'Title should mention missing region');
    assert(issue.title.includes('AWS'), 'Title should include provider');
    assert(issue.title.includes('US West 3'), 'Title should include region name');
    assert(issue.body.includes('us-west-3'), 'Body should include region code');
    assert(issue.labels.includes('missing-region'), 'Should have missing-region label');
    assert(issue.labels.includes('automated'), 'Should have automated label');
  });

  // Test 10: formatMissingServiceIssue creates valid issue
  await test('formatMissingServiceIssue creates valid GitHub issue format', async () => {
    const service = {
      regionId: 'aws-us-east-1',
      regionName: 'US East 1',
      provider: 'AWS',
      service: 'vdc_m365',
      source: 'https://example.com'
    };
    
    const issue = formatMissingServiceIssue(service);
    
    assert(issue.title.includes('Missing Service'), 'Title should mention missing service');
    assert(issue.title.includes('VDC for Microsoft 365'), 'Title should include service display name');
    assert(issue.body.includes('aws-us-east-1'), 'Body should include region ID');
    assert(issue.labels.includes('missing-service'), 'Should have missing-service label');
    assert(issue.labels.includes('automated'), 'Should have automated label');
  });

  // Test 11: formatExtraServiceIssue creates valid issue
  await test('formatExtraServiceIssue creates valid GitHub issue format', async () => {
    const service = {
      regionId: 'aws-us-east-1',
      regionName: 'US East 1',
      provider: 'AWS',
      service: 'vdc_salesforce',
      note: 'Test note'
    };
    
    const issue = formatExtraServiceIssue(service);
    
    assert(issue.title.includes('Verify Service'), 'Title should mention verification');
    assert(issue.title.includes('Salesforce'), 'Title should include service name');
    assert(issue.body.includes('Test note'), 'Body should include the note');
    assert(issue.labels.includes('needs-verification'), 'Should have needs-verification label');
  });

  // Test 12: VEEAM_DOCS_URLS contains all expected services
  await test('VEEAM_DOCS_URLS contains all required service URLs', async () => {
    assert(VEEAM_DOCS_URLS.vdc_m365, 'Should have M365 URL');
    assert(VEEAM_DOCS_URLS.vdc_azure_backup, 'Should have Azure backup URL');
    assert(VEEAM_DOCS_URLS.vdc_entra_id, 'Should have Entra ID URL');
    assert(VEEAM_DOCS_URLS.vdc_salesforce, 'Should have Salesforce URL');
    assert(VEEAM_DOCS_URLS.vdc_vault, 'Should have Vault URL');
    
    // Most URLs are from helpcenter, but Vault is from product page
    const helpcenterServices = ['vdc_m365', 'vdc_azure_backup', 'vdc_entra_id', 'vdc_salesforce'];
    for (const key of helpcenterServices) {
      assert(VEEAM_DOCS_URLS[key].startsWith('https://helpcenter.veeam.com'), 
             `${key} URL should be from helpcenter.veeam.com`);
    }
    
    // Vault URL is from the product page
    assert(VEEAM_DOCS_URLS.vdc_vault.startsWith('https://www.veeam.com'),
           'vdc_vault URL should be from www.veeam.com');
  });

  // Test 13: SERVICE_NAMES contains display names
  await test('SERVICE_NAMES provides display names for all services', async () => {
    assert(SERVICE_NAMES.vdc_m365, 'Should have M365 display name');
    assert(SERVICE_NAMES.vdc_azure_backup, 'Should have Azure backup display name');
    assert(SERVICE_NAMES.vdc_entra_id, 'Should have Entra ID display name');
    assert(SERVICE_NAMES.vdc_salesforce, 'Should have Salesforce display name');
    assert(SERVICE_NAMES.vdc_vault, 'Should have Vault display name');
  });

  // Test 14: parseVaultFAQ handles Non-Core appearing before Core (regex lookbehind test)
  await test('parseVaultFAQ handles Non-Core appearing before Core', async () => {
    const html = `
      <h3>Azure regions support?</h3>
      <p>Here is the list:</p>
      <p><strong>Non-Core Regions:</strong></p>
      <ul>
        <li>Region A</li>
      </ul>
      <p><strong>Core Regions:</strong></p>
      <ul>
        <li>Region B</li>
      </ul>
    `;
    
    const regions = parseVaultFAQ(html);
    
    const regionA = regions.find(r => r.regionName === 'Region A');
    const regionB = regions.find(r => r.regionName === 'Region B');
    
    assert(regionA, 'Should find Region A');
    assertEqual(regionA.tier, 'Non-Core', 'Region A should be Non-Core');
    
    assert(regionB, 'Should find Region B');
    assertEqual(regionB.tier, 'Core', 'Region B should be Core');
    
    // Ensure Region A is NOT also marked as Core (which would happen with the regex bug)
    const regionA_Core = regions.find(r => r.regionName === 'Region A' && r.tier === 'Core');
    assert(!regionA_Core, 'Region A should NOT be marked as Core');
  });

  // Test 15: findMatchingRegion supports same words any order
  await test('findMatchingRegion supports same words any order', async () => {
    const scrapedRegion = {
      provider: 'Azure',
      regionName: 'India Central',
      regionCode: null,
      serviceKey: 'vdc_vault'
    };
    
    const currentRegions = [
      {
        data: {
          id: 'azure-india-central',
          name: 'Central India (Pune)',
          provider: 'Azure',
          services: {}
        }
      }
    ];
    
    const match = findMatchingRegion(scrapedRegion, currentRegions);
    assert(match !== null, 'Should find match for India Central -> Central India');
    assertEqual(match.name, 'Central India (Pune)', 'Should match correct region');
  });

  // Test 16: findMatchingRegion prevents false positive alias matches
  await test('findMatchingRegion prevents false positive alias matches', async () => {
    const scrapedRegion = {
      provider: 'Azure',
      regionName: 'Australia Southeast',
      regionCode: null,
      serviceKey: 'vdc_vault'
    };
    
    const currentRegions = [
      {
        data: {
          id: 'azure-au-east',
          name: 'Australia East (Sydney)',
          provider: 'Azure',
          aliases: ['Australia', 'Sydney'],
          services: {}
        }
      }
    ];
    
    // "Australia Southeast" contains "Australia", but it shouldn't match "Australia East"
    // just because of the alias, as it implies a different region
    const match = findMatchingRegion(scrapedRegion, currentRegions);
    assert(match === null, 'Should NOT match Australia Southeast to Australia East');
  });

  // Test 17: parseVaultFAQ handles asterisk in Core regions
  await test('parseVaultFAQ handles asterisk in Core regions', async () => {
    const html = `
      <h3>Azure regions support?</h3>
      <p><strong>Core Regions:</strong></p>
      <ul>
        <li>Region Standard</li>
        <li>Region Restricted*</li>
      </ul>
    `;
    
    const regions = parseVaultFAQ(html);
    
    const standard = regions.find(r => r.regionName === 'Region Standard');
    const restricted = regions.find(r => r.regionName === 'Region Restricted');
    
    assert(standard, 'Should find Region Standard');
    assert(standard.edition.includes('Advanced'), 'Standard region should have Advanced edition');
    
    assert(restricted, 'Should find Region Restricted');
    assert(restricted.edition.length === 1, 'Restricted region should have only 1 edition');
    assert(restricted.edition[0] === 'Foundation', 'Restricted region should be Foundation only');
    assert(!restricted.edition.includes('Advanced'), 'Restricted region should NOT have Advanced edition');
  });

  // Print summary
  console.log(`\n${'='.repeat(60)}`);
  console.log(`${colors.cyan}Test Summary${colors.reset}`);
  console.log(`${'='.repeat(60)}`);
  console.log(`${colors.green}Passed:${colors.reset} ${TESTS_PASSED.length}`);
  console.log(`${colors.red}Failed:${colors.reset} ${TESTS_FAILED.length}`);
  
  if (TESTS_FAILED.length > 0) {
    console.log(`\n${colors.red}Failed Tests:${colors.reset}`);
    for (const { name, error } of TESTS_FAILED) {
      console.log(`  • ${name}`);
      console.log(`    ${error}`);
    }
    process.exit(1);
  } else {
    console.log(`\n${colors.green}✅ All tests passed!${colors.reset}\n`);
    process.exit(0);
  }
}

// Run tests
runTests().catch(error => {
  console.error(`\n${colors.red}Fatal error:${colors.reset}`, error);
  process.exit(1);
});
