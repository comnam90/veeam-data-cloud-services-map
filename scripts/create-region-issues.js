/**
 * Create GitHub Issues for Region Discrepancies
 * 
 * Reads the region-discrepancies.json file and creates GitHub issues
 * for missing regions and services.
 */

const fs = require('fs');
const path = require('path');

// Service display names for better issue descriptions
const SERVICE_NAMES = {
  vdc_m365: 'VDC for Microsoft 365',
  vdc_azure_backup: 'VDC for Azure',
  vdc_entra_id: 'VDC for Entra ID',
  vdc_salesforce: 'VDC for Salesforce',
  vdc_vault: 'VDC Vault'
};

/**
 * Format issue body for missing region
 */
function formatMissingRegionIssue(region) {
  const serviceName = SERVICE_NAMES[region.service] || region.service;
  
  let vaultInfo = '';
  if (region.service === 'vdc_vault' && region.tier && region.edition) {
    vaultInfo = `\n**Vault Tier:** ${region.tier}\n**Vault Edition:** ${Array.isArray(region.edition) ? region.edition.join(', ') : region.edition}\n`;
  }

  return {
    title: `[Missing Region]: ${region.provider} - ${region.regionName}`,
    body: `## Missing Region Detected by Automated Scraper

**Cloud Provider:** ${region.provider}

**Region Name:** ${region.regionName}

**Region Code:** ${region.regionCode}

**Service Found:** ${serviceName}${vaultInfo}

**Source:** ${region.source}

**Detection Date:** ${new Date().toISOString().split('T')[0]}

---

This region was found in the official Veeam documentation but is not present in the repository data. Please verify this information and add the region if it is indeed available.

**Note:** This issue was automatically created by the region maintenance workflow. The data may need manual verification before adding to the repository.`,
    labels: ['data-correction', 'missing-region', 'automated']
  };
}

/**
 * Format issue body for missing service
 */
function formatMissingServiceIssue(service) {
  const serviceName = SERVICE_NAMES[service.service] || service.service;
  
  let vaultInfo = '';
  if (service.service === 'vdc_vault' && service.tier && service.edition) {
    vaultInfo = `\n**Vault Tier:** ${service.tier}\n**Vault Edition:** ${Array.isArray(service.edition) ? service.edition.join(', ') : service.edition}\n`;
  }

  return {
    title: `[Missing Service]: ${serviceName} in ${service.provider} ${service.regionName}`,
    body: `## Missing Service Detected by Automated Scraper

**Cloud Provider:** ${service.provider}

**Region ID:** ${service.regionId}

**Region Name:** ${service.regionName}

**Missing Service:** ${serviceName}${vaultInfo}

**Source:** ${service.source}

**Detection Date:** ${new Date().toISOString().split('T')[0]}

---

This service was found to be available in this region according to official Veeam documentation, but it is not listed in the repository data for this region.

**Current region file location:** \`data/regions/${service.provider.toLowerCase()}/${service.regionId.replace(/-/g, '_')}.yaml\`

**Note:** This issue was automatically created by the region maintenance workflow. Please verify this information and update the region file if the service is indeed available.`,
    labels: ['data-correction', 'missing-service', 'automated']
  };
}

/**
 * Format issue body for potential service removal
 */
function formatExtraServiceIssue(service) {
  const serviceName = SERVICE_NAMES[service.service] || service.service;
  
  return {
    title: `[Verify Service]: ${serviceName} in ${service.provider} ${service.regionName}`,
    body: `## Service May Have Been Removed - Verification Needed

**Cloud Provider:** ${service.provider}

**Region ID:** ${service.regionId}

**Region Name:** ${service.regionName}

**Service in Question:** ${serviceName}

**Detection Date:** ${new Date().toISOString().split('T')[0]}

---

This service is currently listed in the repository data for this region, but was not found in the latest scrape of official Veeam documentation.

**Possible reasons:**
1. The service may have been removed/deprecated in this region
2. The documentation may have been updated
3. The automated scraper may have failed to detect it (parsing issue)

**Current region file location:** \`data/regions/${service.provider.toLowerCase()}/${service.regionId.replace(/-/g, '_')}.yaml\`

**Note:** ${service.note}

**Action required:** Please manually verify if this service is still available in this region and update the data accordingly.

This issue was automatically created by the region maintenance workflow.`,
    labels: ['data-correction', 'needs-verification', 'automated']
  };
}

/**
 * Create or update GitHub issue using GitHub CLI or API
 * In a real workflow, this would use the GitHub API via environment variables
 */
async function createGitHubIssue(issue, dryRun = false) {
  if (dryRun) {
    console.log('\n--- DRY RUN: Would create issue ---');
    console.log(`Title: ${issue.title}`);
    console.log(`Labels: ${issue.labels.join(', ')}`);
    console.log(`Body:\n${issue.body}`);
    console.log('---\n');
    return { created: false, dryRun: true };
  }
  
  // In the actual GitHub Actions workflow, we would use the GitHub API here
  // For now, this is a placeholder that outputs the issue data
  const issueData = {
    title: issue.title,
    body: issue.body,
    labels: issue.labels
  };
  
  // Write to a file that the GitHub Action can process
  return issueData;
}

/**
 * Check if an issue already exists (to avoid duplicates)
 */
function isDuplicateIssue(issueTitle, existingIssues) {
  // This would query the GitHub API in a real implementation
  // For now, we'll use a simple check
  return existingIssues.some(existing => 
    existing.title === issueTitle
  );
}

/**
 * Main function to process discrepancies and create issues
 */
async function createIssuesFromDiscrepancies(discrepanciesPath, options = {}) {
  const {
    dryRun = false,
    maxIssuesPerRun = 10,
    skipExtraServices = false
  } = options;
  
  console.log('🔍 Loading discrepancies...');
  
  if (!fs.existsSync(discrepanciesPath)) {
    console.error(`❌ Discrepancies file not found: ${discrepanciesPath}`);
    process.exit(1);
  }
  
  const data = JSON.parse(fs.readFileSync(discrepanciesPath, 'utf8'));
  const { discrepancies, errors } = data;
  
  console.log('\n📊 Discrepancies Summary:');
  console.log(`   Missing Regions: ${discrepancies.missingRegions.length}`);
  console.log(`   Missing Services: ${discrepancies.missingServices.length}`);
  console.log(`   Extra Services: ${discrepancies.extraServices.length}`);
  console.log(`   Scraping Errors: ${errors.length}`);
  
  const issuesToCreate = [];
  
  // Process missing regions
  for (const region of discrepancies.missingRegions) {
    const issue = formatMissingRegionIssue(region);
    issuesToCreate.push(issue);
  }
  
  // Process missing services
  for (const service of discrepancies.missingServices) {
    const issue = formatMissingServiceIssue(service);
    issuesToCreate.push(issue);
  }
  
  // Process extra services (services that may have been removed)
  if (!skipExtraServices && discrepancies.extraServices.length > 0) {
    for (const service of discrepancies.extraServices) {
      const issue = formatExtraServiceIssue(service);
      issuesToCreate.push(issue);
    }
  }
  
  if (issuesToCreate.length === 0) {
    console.log('\n✅ No issues to create. Data is up to date!');
    return { created: 0, skipped: 0 };
  }
  
  // Limit number of issues per run to avoid spam
  if (issuesToCreate.length > maxIssuesPerRun) {
    console.log(`\n⚠️  Found ${issuesToCreate.length} issues, limiting to ${maxIssuesPerRun} per run`);
    issuesToCreate.splice(maxIssuesPerRun);
  }
  
  console.log(`\n📝 Creating ${issuesToCreate.length} issue(s)...`);
  
  const results = [];
  for (const issue of issuesToCreate) {
    const result = await createGitHubIssue(issue, dryRun);
    results.push(result);
  }
  
  if (dryRun) {
    console.log('\n✅ Dry run completed. No actual issues were created.');
  } else {
    // Write issues to a file for the GitHub Action to process
    const issuesOutputPath = path.join(
      path.dirname(discrepanciesPath),
      'issues-to-create.json'
    );
    fs.writeFileSync(
      issuesOutputPath,
      JSON.stringify({ issues: results }, null, 2)
    );
    console.log(`\n💾 Issue data written to ${issuesOutputPath}`);
    console.log('   The GitHub Action will create these issues.');
  }
  
  return {
    created: dryRun ? 0 : issuesToCreate.length,
    skipped: 0
  };
}

// Export for testing
module.exports = {
  createIssuesFromDiscrepancies,
  formatMissingRegionIssue,
  formatMissingServiceIssue,
  formatExtraServiceIssue,
  SERVICE_NAMES
};

// Run if called directly
if (require.main === module) {
  const discrepanciesPath = process.argv[2] || 
    path.join(__dirname, '..', 'region-discrepancies.json');
  
  const dryRun = process.argv.includes('--dry-run');
  const skipExtraServices = process.argv.includes('--skip-extra-services');
  
  createIssuesFromDiscrepancies(discrepanciesPath, {
    dryRun,
    skipExtraServices,
    maxIssuesPerRun: 10
  })
    .then(result => {
      console.log(`\n✅ Completed: ${result.created} issues prepared`);
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Fatal error:', error);
      process.exit(1);
    });
}
