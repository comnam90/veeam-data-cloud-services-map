# User Journey: Nearest Region Discovery API

## User Persona

- **Who**: SRE / DevOps / Platform Engineer building automation (CLI, Terraform wrapper, pipeline step)
- **Goal**: Select the closest region that meets provider + service requirements
- **Context**: Time-constrained build/deploy workflow; failures block releases
- **Success Metric**: Region choice is correct and repeatable; integration requires minimal custom logic

## Journey Stages

### 1) Awareness (Need emerges)

**What user is doing**: Trying to pick a region for a user/site with known coordinates.

**What user is thinking**: “I don’t want to download all regions and write distance code again.”

**What user is feeling**: Impatient; wants a reliable primitive for automation.

#### Pain points (Awareness)

- Existing workflow requires full dataset download and bespoke filtering.
- Inconsistent results across teams if each implements their own logic.

#### Opportunity (Awareness)

- Provide a single endpoint with deterministic sorting and documented filters.

### 2) Evaluation (Reads docs, tries curl)

**What user is doing**: Checks OpenAPI and LLM docs; runs a sample request.

**What user is thinking**: “Do these filters match how `/api/v1/regions` behaves?”

**What user is feeling**: Cautiously optimistic; looking for sharp edges.

#### Pain points (Evaluation)

- Ambiguity around parameter casing and valid enum values can waste time.
- Unclear rounding/units makes tests brittle.

#### Opportunities (Evaluation — DX requirements)

- `provider` must be one of `AWS` or `Azure` (case-sensitive; consistent with `/api/v1/regions`).
- `service` is restricted to known service IDs; unknown values return `400`.
- Distance values are consistently rounded (e.g., 2 decimals) and include both km and miles.

### 3) Integration (Implements in script/pipeline)

**What user is doing**: Adds a step that calls `/api/v1/regions/nearest` and selects the first result.

**What user is thinking**: “I need stable output so my automation and tests don’t flap.”

**What user is feeling**: Focused; wants copy/paste reliability.

#### Pain points (Integration)

- Non-deterministic ordering on ties can break snapshot tests.
- Weak error messages create long debugging cycles.

#### Opportunities (Integration)

- Tie-break by `region.id` for determinism.
- Clear, actionable 400s (invalid `lat/lng`, unknown `service`, invalid `tier/edition` combos).

### 4) Operation (Runs in production workflows)

**What user is doing**: Uses the endpoint at scale in repeated jobs.

**What user is thinking**: “This must remain fast and consistent as regions grow.”

**What user is feeling**: Trusting but wants guardrails.

#### Pain points (Operation)

- If validation rules change silently, pipelines can break.
- If performance regresses, it delays deployments.

#### Opportunities (Operation)

- Keep request/response stable; document any behavior changes.
- Maintain predictable limits (`limit` default and max; `limit=0` means unlimited).

### 5) Maintenance (Evolves services/regions)

**What user is doing**: Updates service filters or adds new service IDs.

**What user is thinking**: “I need docs and enums to stay synced.”

**What user is feeling**: Wants confidence; dislikes chasing breaking changes.

#### Pain points (Maintenance)

- Drift between OpenAPI, docs, and runtime validation causes confusion.

#### Opportunities (Maintenance)

- Update OpenAPI + `static/llms*.txt` alongside endpoint changes.
