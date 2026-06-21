# AI Mapping Pilot Scope Manifest - 042a2

## Manifest identity

| Field | Value |
| --- | --- |
| Manifest id | `042a2-ai-mapping-pilot-scope-manifest-v1` |
| Scope | Draft business perimeter for a future semantic mapping pilot before contract v2, golden set update or provider runtime. |
| Surface | `DOCS_GIT / AI_GOVERNANCE / FIDUCIARY_GOVERNANCE` |
| Current status | `DRAFT` |
| Current decision | This manifest does not approve a provider, model, prompt runtime, contract, taxonomy snapshot, golden set, validator, secret, network call, backend runtime, frontend runtime or production activation. |

This manifest records the business perimeter that must be proven before a future pilot can evaluate AI-assisted affectation. It does not freeze a taxonomy and does not create a golden set.

## Boundary

`042a2a1b` is docs-only.

- No taxonomy file is created or modified.
- No snapshot, hash or target count is claimed.
- No existing contract is modified.
- No provider payload is approved.
- No golden set or validator is created.
- No provider, model, prompt runtime, backend runtime, frontend runtime, DB, migration, OpenAPI, CI or dependency is introduced.
- No secret, `.env`, token, cookie, DSN or credential is read or required.
- No provider call or AI network call is made.
- No spec `043` is created.

## Exact pilot objective

The future pilot objective is limited to assisting a human reviewer with affectation of eligible synthetic demo balance accounts.

For each eligible account, the future system must route the case to exactly one of these semantic paths:

- `SUGGESTION`, only when exactly one admissible target exists and is supported by sufficient non-sensitive evidence;
- `ABSTENTION`, only with one approved reason code;
- `POLICY_BLOCK`, before any provider call when authorization, eligibility, provenance, allowlist or gate checks fail;
- technical degradation, including `INVALID_MODEL_OUTPUT`, when runtime or output validation cannot produce a safe semantic result.

The pilot does not approve automated affectation, bulk apply, final accounting validation, statutory output, production use or customer data use.

## Target granularity

| Item | Current value | Evidence status | Requirement before use |
| --- | --- | --- | --- |
| Target granularity | `NON_DÉTERMINÉ` beyond the requirement that a suggestion needs one admissible final affectation target. | `PENDING_EVIDENCE` | Freeze the pilot taxonomy version/hash and prove which target level is selectable and admissible for the cohort. |
| Admissibility rule | `NON_DÉTERMINÉ` | `PENDING_EVIDENCE` | Define context rules that make a known, selectable and non-deprecated target admissible for the account, legal form, scope and cohort. |
| Section versus leaf handling | `NON_DÉTERMINÉ` | `PENDING_EVIDENCE` | Prove whether any section-level target can ever be admissible, or whether only selectable leaves are allowed. |

No target may be exposed by the future pilot only because it is known, selectable and non-deprecated. It must also satisfy the contextual admissibility predicate.

For the future pilot, `known` is derived by resolving the target id in the exact taxonomy snapshot version/hash. `selectable` and `deprecated` remain static serialized taxonomy properties, while `admissible` is a contextual predicate calculated from the resolved target, static properties and approved scope rules; it is never a stored flag.

## Included and excluded business families

No exact included or excluded accounting family is approved by this draft.

| Family perimeter item | Current value | Evidence status | Requirement before use |
| --- | --- | --- | --- |
| Balance sheet asset families | `NON_DÉTERMINÉ` | `PENDING_EVIDENCE` | Expert Board must approve included/excluded families against the frozen taxonomy. |
| Balance sheet liability families | `NON_DÉTERMINÉ` | `PENDING_EVIDENCE` | Expert Board must approve included/excluded families against the frozen taxonomy. |
| Equity families | `NON_DÉTERMINÉ` | `PENDING_EVIDENCE` | Expert Board must approve included/excluded families against the frozen taxonomy. |
| Income statement revenue families | `NON_DÉTERMINÉ` | `PENDING_EVIDENCE` | Expert Board must approve included/excluded families against the frozen taxonomy. |
| Income statement expense families | `NON_DÉTERMINÉ` | `PENDING_EVIDENCE` | Expert Board must approve included/excluded families against the frozen taxonomy. |
| Contra-account handling | `NON_DÉTERMINÉ` | `PENDING_EVIDENCE` | Expert Board must approve contra account rules and critical error checks. |
| Other business workflows | Excluded unless explicitly approved in this manifest or a successor. | `DRAFT` | A workflow outside approved AI-assisted affectation must route to `ABSTENTION / OUT_OF_SCOPE` when the request is otherwise authorized. |

## Legal forms and jurisdictions

| Item | Current value | Evidence status | Requirement before use |
| --- | --- | --- | --- |
| Covered legal forms | `NON_DÉTERMINÉ` | `PENDING_EVIDENCE` | Define and approve the legal forms covered by the pilot. |
| Excluded legal forms | `NON_DÉTERMINÉ` | `PENDING_EVIDENCE` | Define and approve exclusions. |
| Jurisdiction | `NON_DÉTERMINÉ` beyond the V1 Swiss product context. | `PENDING_EVIDENCE` | Confirm jurisdictional perimeter with Product and Expert Board. |
| CO/statutory implication | Not approved. | `DRAFT` | Any CO/statutory wording, filing, final account decision or legal annex output requires separate review. |

## Languages

| Item | Current value | Evidence status | Requirement before use |
| --- | --- | --- | --- |
| Covered account-label languages | `NON_DÉTERMINÉ` | `PENDING_EVIDENCE` | Approve languages covered by annotation, golden set and evaluation. |
| Multilingual label handling | Required as future test coverage, not approved as runtime capability. | `DRAFT` | Golden set must include multilingual labels once created in a separate mission. |
| Provider output language | `NON_DÉTERMINÉ` | `PENDING_EVIDENCE` | Future contract must prevent provider free text from becoming user-facing wording. |

## Eligible accounts and entries

Eligible entries for future evaluation must satisfy all conditions below:

- synthetic demo data only;
- request authorized, tenant-scoped and inside approved provenance;
- account belongs to the latest approved synthetic demo balance import for the pilot;
- account is inside the approved pilot business perimeter;
- account is not already affected when the future precondition defines already affected accounts as non-eligible;
- account is not excluded by closing state, import state, scope, legal form, taxonomy cohort, policy gate or runtime gate;
- evidence can be minimized and reviewed without real customer data, raw amounts, secrets, private paths, tenant/client/actor identifiers or provider logs.

Accounts or entries already affected, non-eligible, stale, outside allowed provenance, outside the synthetic demo perimeter, or blocked by a gate are precondition or policy outcomes. They must not be counted as business abstentions.

## Non-eligible data and requests

The following are outside this manifest:

- real customer data;
- raw CSV from a real customer;
- non-synthetic requests;
- cross-tenant requests;
- requests outside approved allowlist or provenance;
- invalid gate requests;
- already affected accounts when the future precondition excludes them;
- stale imports, stale runtime context or expired runtime state;
- secrets, tokens, cookies, DSNs, credentials or `.env` values;
- private storage keys, signed URLs or document paths;
- provider prompt, payload or output logs;
- production activation.

Non-synthetic, cross-tenant, outside allowlist, outside provenance or invalid-gate requests must route to `POLICY_BLOCK`, show the deterministic policy message, make no provider call and stay outside business abstention metrics.

## Manifest versioning and canonicalization

| Item | Current value | Evidence status | Requirement before use |
| --- | --- | --- | --- |
| Manifest version | `042a2-ai-mapping-pilot-scope-manifest-v1` | `DRAFT` | Immutable manifest id for this draft. |
| Canonical artifact | `policies/ai-mapping-pilot-scope-manifest-042a2.md` | `DRAFT` | Future approval must define the canonical source and exact serialization. |
| Canonicalization method | `NON_DÉTERMINÉ` | `PENDING_EVIDENCE` | Define whitespace, ordering, encoding and normalization rules before hashing. |
| Future hash | `NON_DÉTERMINÉ` | `PENDING_EVIDENCE` | Compute a hash only after canonicalization, scope approval and immutable artifact freeze. |
| Change rule | Any business perimeter change requires a new manifest version and hash. | `DRAFT` | No silent scope change during a cohort. |

## Provenance and rights of use

| Item | Current value | Evidence status | Requirement before use |
| --- | --- | --- | --- |
| Source provenance | `NON_DÉTERMINÉ` | `PENDING_EVIDENCE` | Document source, authorship and derivation path for all perimeter decisions. |
| Rights of use | `NON_DÉTERMINÉ` | `PENDING_EVIDENCE` | Prove Ritomer may use, transform and evaluate the scope, taxonomy and annotation artifacts. |
| Third-party content | Not approved. | `DRAFT` | Do not copy third-party taxonomy, guide or evaluation content without rights evidence. |
| Owner approval | `NON_DÉTERMINÉ` | `PENDING_EVIDENCE` | Product, fiduciary expert and IA Governance approval are required before use. |

## Relationship to other records

- `policies/ai-mapping-semantic-readiness-record-042a2.md` defines semantic routing and user-facing states.
- `policies/ai-mapping-taxonomy-pilot-record-042a2.md` defines taxonomy readiness requirements and admissibility.
- `policies/ai-mapping-annotation-guide-042a2.md` defines annotation and adjudication requirements.
- `policies/ai-mapping-business-evaluation-protocol-042a2.md` defines future evaluation requirements.
- `specs/active/042-controlled-ai-mapping-runtime-pilot-v1.md` remains the active spec context.

This manifest does not override any approved contract, current manual mapping authority or existing backend behavior.

## Candidate projection note after 042a2a2a

A synthetic de-mapped input projection candidate now exists at `evals/mapping/fixtures/042a2/demo-input-unmapped-v1.json`.

Candidate projection status:

- status remains `CANDIDATE / PENDING_EVIDENCE / NOT_AUTHORITATIVE`;
- source dataset is `036a-local-demo-synthetic`;
- balance import version is `1`;
- account labels are English-only synthetic labels from the existing seed;
- account codes are exactly `1000`, `1100`, `2000`, `2800`, `3000` and `4000`;
- account `4000` keeps the label `Synthetic operating expenses`;
- no raw amount, tenant/client/actor identifier, current affectation target, expected target or historical mapping target is stored;
- SHA-256 over canonical UTF-8-no-BOM LF bytes is `B3C616B729014E6A87BB2124C10970EDF954D9F98FBD1F5C08E42B7ACAAA6D3F`;
- command is `.\evals\mapping\validate-042a2-candidate.ps1`.

This projection is a candidate fixture only. It does not approve the pilot scope, a golden set, a provider payload, a runtime path or production/customer-data use.
