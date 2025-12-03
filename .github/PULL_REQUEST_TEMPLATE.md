## Description

<!-- Brief description of what this PR changes -->

## Type of Change

- [ ] Adding a new region
- [ ] Adding a service to an existing region
- [ ] Correcting existing data
- [ ] Other (describe below)

## Regions/Services Affected

<!-- List the regions and/or services being added or modified -->

| Provider | Region | Service(s) |
|----------|--------|------------|
|          |        |            |

## Source / Evidence

<!-- 
REQUIRED: Provide links or references to verify this data.
Examples:
- Link to Veeam documentation
- Screenshot from Veeam console
- Official announcement
-->

## Checklist

- [ ] I have verified this information from an official Veeam source
- [ ] Region YAML files follow the correct structure:
  - [ ] `provider` is exactly `"AWS"` or `"Azure"` (case-sensitive)
  - [ ] `coords` is an array `[lat, lon]`, not a string
  - [ ] Tiered services (`vdc_vault`) use array of `{edition, tier}` objects
  - [ ] Boolean services (`vdc_m365`, `vdc_entra_id`, `vdc_salesforce`, `vdc_azure_backup`) are set to `true`
- [ ] I have tested locally with `hugo server` (if possible)
- [ ] File naming follows convention: `{provider}_{region_code}.yaml`

## Related Issues

<!-- Link any related issues: Fixes #123, Closes #456 -->

