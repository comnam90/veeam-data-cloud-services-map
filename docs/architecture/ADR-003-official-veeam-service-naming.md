# ADR-003: Adopt Official Veeam Help-Center Service Names

**Status**: Accepted

## Context

The UI previously used a mix of ad-hoc service names produced from the YAML keys (`vdc_vault`, `vdc_m365`, `vdc_entra_id`, `vdc_salesforce`, `vdc_azure_backup`). The `serviceDisplayNames` map rendered them as a hybrid of ALL-CAPS brand acronyms and title-case product nouns — e.g. `M365 Protection`, `ENTRA ID Protection`, `SALESFORCE Protection`, `AZURE Protection`. The Vault row used short `Vault` / full `VAULT`.

Two problems emerged from this:

- The names didn’t match the section headings used in the official Veeam Data Cloud help-center user guide. Anyone reading both side-by-side had to mentally translate.
- The service-filter checkbox label `Azure` collided with the Azure cloud provider label in the provider filter directly above it. Users could mistake the service filter for a provider filter.

The names appear in three runtime contexts: the multi-select filter dropdown (short label), the filter-button label when one service is selected (short label), and the popup row per service (full label).

## Decision Drivers

- Vocabulary parity with the official Veeam documentation users are most likely to read alongside the map.
- Unambiguous filter labels — no two top-level controls should share a label.
- A single source of truth (`serviceDisplayNames`) drives every UI surface.

## Decision

Adopt the official help-center section names verbatim as the `full` display names:

| YAML key | `short` (filter UI) | `full` (popup row) |
| --- | --- | --- |
| `vdc_vault` | `Vault` | `Veeam Data Cloud Vault` |
| `vdc_m365` | `M365` | `Microsoft 365 Protection` |
| `vdc_entra_id` | `Entra ID` | `Microsoft Entra ID Protection` |
| `vdc_salesforce` | `Salesforce` | `Salesforce Protection` |
| `vdc_azure_backup` | `Azure Protection` | `Microsoft Azure Protection` |

The `short` for `vdc_azure_backup` is deliberately `Azure Protection` (not `Azure`) to disambiguate from the `Azure` cloud-provider filter that sits next to it in the header.

All UI surfaces — multi-select checkbox labels, multi-select button label, and popup rows — read these strings through `getServiceDisplayName(key, type)`. The Playwright test that filters by the Azure service uses the `Azure Protection` label accordingly.

## Options Considered

### Option A: Keep the ad-hoc names

- Pros: No code change; existing tests pass.
- Cons: Vocabulary divergence from official docs; ongoing collision between the `Azure` service short and the `Azure` provider option.

### Option B: Use only the short brand abbreviations everywhere (`Vault`, `M365`, `Entra`, `SF`, `Azure`)

- Pros: Most compact UI; no wrapping.
- Cons: `SF` is opaque without context; doesn't match any official Veeam naming; the `Azure` collision is unresolved.

### Option C: Adopt the official help-center names (chosen)

- Pros: Direct parity with documentation users already read; the `…Protection` suffix on the Azure service eliminates the provider collision naturally.
- Cons: Long labels — `Microsoft Entra ID Protection` wraps in the popup row on narrow widths. Accepted because the wrapping is benign and the disambiguation gain is worth it.

## Consequences

- Any future service added to the YAML schema MUST register a `{ short, full }` entry in `serviceDisplayNames` using the canonical Veeam help-center heading as `full`. If the official docs ever rename a section, this map is the single place to update.
- The `short` label for a new service MUST NOT collide with any existing provider value in `#providerFilter` (today: `Azure`, `AWS`). Where collision is unavoidable, follow the precedent set here and append `Protection` (or the equivalent product noun) to the `short`.
- Documentation surfaces that mention services (info panel “What is this?” copy, `static/llms*.txt`, future help text) should use the canonical `full` names.
- Tests asserting against service labels (e.g. `getByRole('checkbox', { name: 'Azure Protection' })`, `<input value=vdc_azure_backup> Azure Protection</label>` regex matches) must be updated in lockstep with any future rename.

## Links

- [PR #103](https://github.com/comnam90/veeam-data-cloud-services-map/pull/103) — the redesign that introduced this convention.
- Mission Control Redesign implementation plan: `plans/mission-control-redesign/plan.md`
- Veeam Data Cloud help-center: <https://www.veeam.com/products/veeam-data-cloud.html>
