# AI Mapping Taxonomy Pilot Record - 042a2

## Record identity

| Field | Value |
| --- | --- |
| Record id | `042a2-ai-mapping-taxonomy-pilot-record-v1` |
| Scope | Draft requirements for a future pilot taxonomy used by semantic mapping readiness. |
| Surface | `DOCS_GIT / AI_GOVERNANCE / FIDUCIARY_GOVERNANCE` |
| Current status | `PENDING_EVIDENCE` |
| Proposed taxonomy version | `RITOMER-CH-KMU-MAPPING-PILOT-2026.06-v1` |
| Current decision | No taxonomy content, taxonomy contract, target list, schema, provider payload, prompt runtime, golden set or runtime capability is approved by this record. |

This record defines readiness requirements. It does not copy third-party taxonomy content and does not replace `contracts/reference/manual-mapping-targets-v2.yaml`.

## Boundary

`042a2a1` is docs-only.

- No taxonomy file is created or modified.
- No contract is modified.
- No provider payload is approved.
- No golden set or validator is created.
- No third-party content is copied into this mission.
- No target count, hash, freeze date or owner approval is claimed without evidence.

## Required taxonomy evidence

Before the proposed pilot taxonomy can be used by a contract, golden set or runtime, the following evidence must exist:

| Field | Current value | Evidence status | Requirement |
| --- | --- | --- | --- |
| Version | `RITOMER-CH-KMU-MAPPING-PILOT-2026.06-v1` | `DRAFT` | Immutable version string for one pilot cohort. |
| Source provenance | `NON_DÉTERMINÉ` | `PENDING_EVIDENCE` | Document source, authorship and derivation path. |
| Rights of use | `NON_DÉTERMINÉ` | `PENDING_EVIDENCE` | Proof that Ritomer can use, transform and evaluate the taxonomy. |
| Immutable target identifiers | `NON_DÉTERMINÉ` | `PENDING_EVIDENCE` | Stable ids that never change meaning silently. |
| Definitions | `NON_DÉTERMINÉ` | `PENDING_EVIDENCE` | Business definitions for every target and family. |
| Families | `NON_DÉTERMINÉ` | `PENDING_EVIDENCE` | Grouping by business family and statement. |
| Hierarchy | `NON_DÉTERMINÉ` | `PENDING_EVIDENCE` | Parent/child hierarchy and selectable leaves. |
| Status model | `NON_DÉTERMINÉ` | `PENDING_EVIDENCE` | Known/selectable/deprecated/admissible flags defined below. |
| Freeze date | `NON_DÉTERMINÉ` | `PENDING_EVIDENCE` | Date after which the cohort taxonomy cannot change silently. |
| Number of targets | `NON_DÉTERMINÉ` | `PENDING_EVIDENCE` | Exact count by family, selectable status and deprecated status. |
| Hash | `NON_DÉTERMINÉ` | `PENDING_EVIDENCE` | SHA-256 or approved equivalent over the canonical taxonomy artifact. |
| Owner approval | `NON_DÉTERMINÉ` | `PENDING_EVIDENCE` | Product, fiduciary expert and IA governance approval. |

## Status definitions

The future taxonomy must define these concepts consistently:

- `known`: the target id resolves in the exact frozen taxonomy version and hash used by the pilot cohort.
- `selectable`: a static taxonomy property stating whether the target can be chosen as a final affectation target when other rules allow it.
- `deprecated`: a lifecycle status. A deprecated target remains known for historical compatibility but must not be newly suggested or selected unless an explicit migration rule allows it.
- `admissible`: a contextual predicate, not a copied flag: `known AND selectable AND NOT deprecated AND context rules satisfied`.

Context rules include, at minimum, the approved pilot scope, account context, legal form, cohort, taxonomy family rules and any contra-account or statement-boundary constraints approved by Expert Board.

`selectable=true` is not sufficient by itself. A runtime suggestion requires exactly one admissible target.

A provider output that names an unknown, deprecated, non-selectable or contextually inadmissible target is an output validation failure, not a taxonomy gap. It must be routed as `INVALID_MODEL_OUTPUT` or another technical degradation state according to the future contract.

## Cohort freeze rules

- A pilot cohort must reference exactly one taxonomy version and hash.
- No silent update is allowed during a cohort.
- Any semantic change to a target definition requires a new version and new hash.
- Any new, removed, renamed, reparented, deprecated or de-deprecated target requires a new version and new hash.
- Historical results must remain interpretable against the original taxonomy version.
- A taxonomy gap observed during a cohort means the frozen pilot taxonomy contains no admissible target for a valid business concept; it must be routed as `TAXONOMY_GAP` and cannot be hidden by changing the taxonomy in place.
- Unknown, deprecated, non-selectable or contextually inadmissible targets emitted by a provider must not be counted as `TAXONOMY_GAP`.

## Required target fields

Each future target must provide at minimum:

- immutable `targetId`;
- human-readable label;
- formal definition;
- family;
- parent id or root marker;
- statement or equivalent accounting domain;
- normal side when applicable;
- `known`;
- `selectable`;
- `deprecated`;
- contextual admissibility rule;
- provenance;
- rights-of-use evidence pointer;
- owner approval pointer.

No field may embed tenant, client, actor, secret, credential, `.env`, raw customer data, private document path, storage key or signed URL.

## Critical taxonomy errors

Any confirmed critical taxonomy error blocks promotion:

- active/passive confusion;
- balance sheet / income statement confusion;
- revenue/expense confusion;
- contra account target missing or misclassified;
- unknown target exposed as admissible;
- deprecated target exposed as newly selectable;
- non-selectable target exposed as suggestion target;
- contextually inadmissible target exposed as suggestion target;
- unknown, deprecated, non-selectable or contextually inadmissible provider target classified as `TAXONOMY_GAP`;
- missing target hidden behind approximate classification;
- target definition copied from third-party content without rights evidence;
- silent taxonomy update during a cohort.

## Relationship to existing contracts

The existing `contracts/reference/manual-mapping-targets-v2.yaml` remains the current repository reference for delivered V1 behavior.

This record does not:

- approve `RITOMER-CH-KMU-MAPPING-PILOT-2026.06-v1` as a runtime taxonomy;
- modify current reference contracts;
- authorize provider payload fields;
- authorize a contract v2;
- authorize mapping decisions outside current backend authority.

## Approval placeholders

These placeholders do not constitute approvals or signatures.

| Role | Expected evidence | Current status |
| --- | --- | --- |
| Product owner | Confirms pilot cohort purpose and target scope. | `PENDING_EVIDENCE` |
| Fiduciary expert | Confirms accounting definitions, hierarchy and critical boundaries. | `PENDING_EVIDENCE` |
| Security/Privacy | Confirms provenance and absence of sensitive or unauthorized content. | `PENDING_EVIDENCE` |
| IA Governance | Confirms versioning, hash, admissibility and no silent update policy. | `PENDING_EVIDENCE` |
