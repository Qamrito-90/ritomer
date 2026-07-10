# AI Mapping Annotation Guide - 042a2

## Guide identity

| Field | Value |
| --- | --- |
| Guide id | `042a2-ai-mapping-annotation-guide-v1` |
| Scope | Annotation rules for human semantic review, adjudication, future golden-set governance and provider-readiness, with `mapping-suggestion-v2` already delivered as a non-authoritative read-model. |
| Surface | `DOCS_GIT / AI_GOVERNANCE / FIDUCIARY_GOVERNANCE` |
| Current status | `DRAFT` |
| Human-review workflow state | `PENDING_HUMAN_RESPONSES` |
| Current decision | This guide does not create a golden set, validator, provider, prompt runtime, contract or runtime capability. |

All examples in this guide are synthetic and illustrative.

## Annotation objectives

The annotation process must prove that future mapping assistance can separate:

- a reviewable `SUGGESTION`;
- a business `ABSTENTION`;
- a policy block;
- a technical failure.

The process must also prove that annotators do not force approximate targets when evidence or taxonomy is insufficient.

## Formal outcomes

### `SUGGESTION`

A case is a `SUGGESTION` only when all conditions are true:

- the request has passed policy gates;
- the account is in the approved synthetic pilot business scope;
- exactly one admissible target is supported;
- evidence is sufficient, non-sensitive and tenant-scoped;
- no critical conflict remains;
- human review remains mandatory;
- the user can validate, choose another rubric or reject the proposition.

An admissible target is not a copied flag. It is a contextual predicate: the target is known in the exact taxonomy version/hash, selectable as a static property, not deprecated by lifecycle status, and allowed by the pilot scope, account context and cohort rules.

### `ABSTENTION`

A case is an `ABSTENTION` when the product should show `Aucune proposition` and no target should be exposed.

An `ABSTENTION` can be annotated only after the request is authorized and no policy block or technical failure applies.

Allowed reason codes:

- `OUT_OF_SCOPE`
- `CONFLICTING_SIGNALS`
- `INSUFFICIENT_EVIDENCE`
- `TAXONOMY_GAP`
- `AMBIGUOUS_TARGET`

An abstention must never contain a suggested target, a confidence value, a hidden ranking or provider free text.

### Policy block

A policy block happens when governance, privacy, tenant isolation, scope, secret handling or approval gates prevent the AI path.

It includes non-synthetic requests, cross-tenant requests, requests outside the approved allowlist, requests outside approved provenance and invalid gates.

It is not a business abstention. It must be routed to governance or incident handling, and no provider call is allowed.

### Technical failure

A technical failure happens when runtime is disabled, unavailable, timed out, invalid, malformed or otherwise unable to provide a validated output.

It includes `INVALID_MODEL_OUTPUT`. A provider output that names an unknown, deprecated, non-selectable or contextually inadmissible target is a technical failure, not `TAXONOMY_GAP`.

It is not a business abstention. The visible state is `Proposition momentanément indisponible`, with manual affectation still available.

## Reason-code definitions

| Reason code | Positive definition | Negative boundary |
| --- | --- | --- |
| `OUT_OF_SCOPE` | The business concept is established and the request is otherwise authorized, but the account is explicitly outside the approved pilot business perimeter. | Do not use for non-synthetic, cross-tenant, outside allowlist, outside provenance, invalid-gate, already affected or non-eligible cases; those are policy/precondition outcomes. Do not use when the case is in scope but ambiguous. |
| `CONFLICTING_SIGNALS` | Approved signals point to materially different target families, statements, normal sides, contra treatment or business concepts. | Do not use for simple lack of evidence, stale runtime state or broad but compatible candidates. |
| `INSUFFICIENT_EVIDENCE` | The business concept or candidate set cannot be established from approved, current and reviewable evidence. | Do not use for stale imports, expired runtime state, disabled runtime, timeout or output validation failure; those are technical or precondition states. Do not use when evidence is sufficient but taxonomy is missing. |
| `TAXONOMY_GAP` | The business concept is established and the frozen pilot taxonomy contains zero admissible targets for that valid concept. | Do not use for provider output that names an unknown, deprecated, non-selectable or contextually inadmissible target; annotate technical failure / `INVALID_MODEL_OUTPUT`. Do not use to hide weak support for an existing target. |
| `AMBIGUOUS_TARGET` | The business concept is established and multiple admissible targets remain plausible after evidence review. | Do not use when one admissible target is clearly better supported or when evidence is insufficient to establish candidates. |

## Positive and negative examples

| Scenario | Correct annotation | Incorrect annotation |
| --- | --- | --- |
| Synthetic bank/cash label with clear cash evidence and one admissible cash target. | `SUGGESTION` with the cash target. | `ABSTENTION / AMBIGUOUS_TARGET` without documenting the ambiguity. |
| Synthetic clearing label with both receivable and payable signals. | `ABSTENTION / CONFLICTING_SIGNALS`. | Forced receivable or payable suggestion. |
| Synthetic label is generic and evidence is absent. | `ABSTENTION / INSUFFICIENT_EVIDENCE`. | Weak suggestion forced without evidence. |
| Valid business concept exists but the pilot taxonomy has no admissible target. | `ABSTENTION / TAXONOMY_GAP`. | Suggesting a nearby but wrong target. |
| Two admissible expense targets remain equally plausible. | `ABSTENTION / AMBIGUOUS_TARGET`. | Selecting the first listed target. |
| Account in an authorized synthetic request belongs to a business workflow outside AI-assisted affectation. | `ABSTENTION / OUT_OF_SCOPE`. | Policy block or forced suggestion. |
| Request is non-synthetic, cross-tenant, outside allowlist, outside approved provenance or blocked by an invalid gate. | Policy block, with no provider call. | `ABSTENTION / OUT_OF_SCOPE`. |
| Provider output is malformed or timeout occurs. | Technical failure. | `ABSTENTION / INSUFFICIENT_EVIDENCE`. |
| Provider output names an unknown, deprecated, non-selectable or contextually inadmissible target. | Technical failure / `INVALID_MODEL_OUTPUT`. | `ABSTENTION / TAXONOMY_GAP`. |
| Tenant boundary or privacy gate blocks context use. | Policy block. | Any business abstention or suggestion. |

## Required annotation fields

Each annotated case must record:

- case id;
- synthetic dataset version;
- scope manifest version;
- scope manifest hash, or `PENDING_EVIDENCE` until a canonical manifest hash exists;
- taxonomy version;
- taxonomy hash, or `PENDING_EVIDENCE` until a frozen taxonomy hash exists;
- primary outcome: `SUGGESTION`, `ABSTENTION`, policy block or technical failure;
- reason code only when outcome is `ABSTENTION`;
- policy or technical code when outcome is policy block or technical failure;
- proposed target only when outcome is `SUGGESTION`;
- decision tree step;
- evidence state: sufficient, insufficient, missing, conflicting, stale/precondition or technical;
- business concept established: true or false;
- admissible candidate count;
- missing signals;
- conflicting signals;
- expected human action;
- legal form;
- contra-account indicator;
- maturity or closing context when relevant to admissibility;
- critical flags: active/passive, balance sheet/income statement, revenue/expense, contra account, target validity, taxonomy gap, policy incident, technical incident;
- first annotator pseudonymous id;
- second annotator pseudonymous id;
- adjudicator pseudonymous id when adjudication is needed;
- timestamp;
- adjudication status.

No annotation field may contain secrets, `.env` values, tokens, credentials, DSNs, cookies, raw customer data, raw CSV, private storage keys or cross-tenant data.

The strict blind-response artifact is intentionally narrower than this complete annotation record. A reviewer response contains only the fields authorized by `evals/mapping/reviews/042a2/reviewer-response-schema-v1.json`. Freeze metadata, comparison results, adjudication justification, timestamps, hashes and promotion evidence belong to the future human-controlled review record described below. The response schema alone must never be presented as a complete adjudication or promotion record.

## Double annotation rules

Independent blind double annotation is mandatory for 100% of the future golden set.

The future golden set must include, and therefore double annotate, at minimum:

- all abstentions;
- all critical cases;
- contra-account cases;
- multilingual labels;
- ambiguous labels;
- sensitive-looking labels after sanitization;
- taxonomy-gap candidates;
- active/passive, balance/result and revenue/expense boundary cases;
- `POLICY_BLOCK` candidates;
- `INVALID_MODEL_OUTPUT` candidates.

Annotators must work independently before adjudication. They must not see each other's preliminary labels.

## Human review and adjudication workflow - 042a2a6

This section is the operational protocol for collecting, freezing, comparing and adjudicating future human responses for the existing 042a2 blind packs. It defines the process only. It does not execute a review and does not authorize Codex or another AI system to create, complete, infer, correct or simulate a human response or adjudication.

### Workflow states

These workflow states are distinct from document statuses such as `DRAFT` or `PENDING_EVIDENCE`, blind-pack statuses, and the response artifact status `DRAFT_HUMAN_REVIEW` required by the existing schema.

| Workflow state | Entry condition | What it permits |
| --- | --- | --- |
| `PENDING_HUMAN_RESPONSES` | Initial and current state. One or both real human response sets are missing, incomplete, invalid, not independently produced or not frozen. | Distribution, independent human review, schema validation and correction by the same reviewer only. No cross-review, comparison or adjudication. |
| `PENDING_ADJUDICATION` | Both response sets are complete, conform to the existing schema, pass the response validator against their respective committed packs, have recorded hashes and freeze timestamps, and have valid independence attestations. | Controlled comparison and human adjudication. No response may be changed in place. |
| `ADJUDICATED_NOT_GOLDEN` | Every blind case has a final human disposition: an exact A/B agreement has been ratified, or a divergence has been resolved with the required trace and short justification. All stop conditions are cleared. | Use as adjudicated review evidence only. It is explicitly not a golden set. |
| `GOLDEN_CANDIDATE_PENDING_GOVERNANCE` | A future, separately authorized mission has assembled an evidence-linked candidate from the fully adjudicated record and all candidate checks pass. | Governance review only. No provider or runtime activation. |
| `GOLDEN_APPROVED` | A future explicit governance gate records the required human approvals and verifies the authoritative artifact, provenance, hashes and validators. | Only the scope expressly authorized by that future gate. This state is unreachable in `042a2a6`. |

States must not be skipped. If a frozen response is reopened, replaced or fails an integrity check, all downstream comparison and adjudication based on it are invalidated and the workflow returns to `PENDING_HUMAN_RESPONSES` with a new version and new freeze evidence.

### Roles and separation of duties

- A human review coordinator controls distribution, custody, validation evidence, freezing and state transitions. The coordinator does not answer cases on behalf of a reviewer.
- Reviewer A is a real human and receives only `reviewer-a-blind-v1.json`, `reviewer-response-schema-v1.json` and answer-free annotation instructions.
- Reviewer B is a real human and receives only `reviewer-b-blind-v1.json`, `reviewer-response-schema-v1.json` and answer-free annotation instructions.
- Reviewers work independently and must not exchange preliminary or final answers before both response sets are frozen.
- The default adjudicator is a senior human expert distinct from reviewers A and B.
- If a distinct senior adjudicator is unavailable or a governance boundary cannot be resolved by one expert, the final decision must be an explicitly documented joint human decision by CPO and IA Governance. Neither reviewer may adjudicate their own disputed answer or decide a divergence alone.
- Codex, an AI assistant, a model output, the candidate fixtures and the offline evaluator are not reviewers or adjudicators.

### Blind distribution and independence controls

Before each reviewer starts, the coordinator must record which committed pack and schema versions were distributed and attest that:

- reviewer A received only pack A and reviewer B received only pack B;
- neither reviewer received the other reviewer's pack or responses;
- neither reviewer received expected answers, solution fields, internal tags, source case ids, candidate fixture paths, candidate fixture contents, builder internals or validator internals that disclose the source mapping;
- neither reviewer copied an answer from `candidate-semantic-cases-v1.json`, `candidate-policy-fault-cases-v1.json`, another fixture, the offline evaluator report or another reviewer;
- no discussion, screen share, shared draft or comparison occurred before both freezes.

Any breach or credible doubt about these controls is a stop condition. The affected response set cannot be repaired by relabelling it as independent; a new independent review round is required.

### Future response artifacts, validation and freeze

The expected future response artifacts are real files authored and returned by the human reviewers, not generated or prefilled by Codex:

- `reviewer-a-response-v1.json`, validated against `reviewer-a-blind-v1.json`;
- `reviewer-b-response-v1.json`, validated against `reviewer-b-blind-v1.json`.

Until both sets are frozen, they must remain in access-separated, human-controlled collection storage and must not be merged into a shared repository location visible to the other reviewer. A future authorized evidence-ingestion task may store the two frozen files together under `evals/mapping/reviews/042a2/`; this protocol does not create them.

Each file must conform exactly to `evals/mapping/reviews/042a2/reviewer-response-schema-v1.json`, including exactly 17 unique blind case ids and the root status as the one-element JSON array `["DRAFT_HUMAN_REVIEW"]`. No additional field, expected answer, free-text justification or adjudication content may be added to a response file.

The coordinator must validate in this order:

1. Run `evals/mapping/validate-042a2-blind-review-pack.ps1` against the committed packs and schema.
2. Confirm strict JSON Schema conformance of each response, including array and union shapes.
3. Run `evals/mapping/validate-042a2-human-review-responses.ps1` separately for response A with pack A, then response B with pack B.
4. Record the exact paths, SHA-256 hashes, validator results, validation timestamps, reviewer pseudonymous ids, pack hashes, schema hash and independence attestations in the human-controlled freeze record.
5. Freeze both response files as immutable inputs. A changed hash or in-place edit cancels the freeze.

The PowerShell response validator is required but is not, by itself, evidence that every JSON Schema keyword was evaluated. Strict conformance to the committed schema remains mandatory. A missing, incomplete or invalid response is returned only to its originating reviewer for correction and leaves the workflow in `PENDING_HUMAN_RESPONSES`.

No comparison, opening of the opposite response set or adjudication may start until both complete response sets pass all checks and are frozen.

### Deterministic A/B comparison

Comparison joins response items by `blindCaseId`; array order is irrelevant. For each of the 17 ids, compare:

- `outcome`;
- `targetCode` for `SUGGESTION`, or `reasonCode` for every other outcome;
- `evidenceState`;
- `criticalFlags` as a normalized set;
- `expectedHumanAction`.

Classify each case as follows:

- **Agreement A/B**: every compared field is identical. The case is provisional consensus, but it still requires final human ratification in the adjudication record before the workflow can become `ADJUDICATED_NOT_GOLDEN`.
- **Divergence A/B**: at least one compared field differs. Preserve both frozen answers and enumerate every differing field before adjudication.
- **Invalid or missing response**: not a divergence. Stop, do not compare or adjudicate, and remain `PENDING_HUMAN_RESPONSES` until a valid independent response is frozen.
- **Abstention or insufficient evidence**: compare the exact abstention reason and evidence state; never infer or force a target. `INSUFFICIENT_EVIDENCE` is a valid business outcome when supported, not a missing reviewer response.
- **Taxonomy gap**: preserve `ABSTENTION / TAXONOMY_GAP`, record the gap for taxonomy governance and do not replace it with an approximate target.
- **Policy block**: preserve `POLICY_BLOCK`, require the existing business/governance cross-review and never trigger a provider call.
- **Precondition block**: preserve `PRECONDITION_BLOCK`, compare the exact precondition reason and route the case to `CHECK_PRECONDITION`; do not count it as business abstention or force a target.
- **Invalid model output**: preserve `INVALID_MODEL_OUTPUT`, require business/technical cross-review and never reinterpret it as `TAXONOMY_GAP`.

### Human adjudication and trace

Adjudication starts only in `PENDING_ADJUDICATION`. It covers all 17 cases: agreements are explicitly ratified or reopened as divergences, and divergences are resolved by the distinct human adjudicator or the documented CPO/IA Governance decision path.

For every case, the future human-controlled comparison/adjudication record must contain at least:

- `blindCaseId`;
- comparison classification: agreement or divergence;
- the immutable A and B response references and hashes;
- the compared A and B semantic values;
- final outcome, final reason code when applicable and final target only for `SUGGESTION`;
- final evidence state, critical flags and expected human action;
- a short human justification;
- for a divergence, why the non-selected annotation was rejected;
- adjudicator pseudonymous id and role, or the named CPO/IA Governance decision path;
- decision timestamp;
- taxonomy, policy, technical or guide follow-up when applicable.

The global record must also contain the pack, schema and response hashes, validation evidence, freeze timestamps, independence attestations, all unresolved issues, final workflow state and the identities/roles of the humans authorizing the transition. This record is a future real human evidence artifact; `042a2a6` does not create or populate it.

A divergence is non-adjudicable when the evidence cannot support a safe final semantic result, the required expertise is unavailable or a governance conflict remains. The workflow must stop; no approximate target, synthetic adjudication or silent majority rule is allowed.

### Stop conditions

Stop the workflow without advancing its state when any of the following occurs:

- a response set is missing, incomplete or not produced by its assigned human reviewer;
- a response is outside the committed schema, fails validation, is matched to the wrong pack or changes after freeze;
- reviewer independence is compromised or cannot be evidenced;
- expected answers, internal tags, source mappings or the other reviewer's answers leaked before freeze;
- an answer was copied or derived from candidate fixtures, evaluator output or another reviewer;
- a divergence cannot be adjudicated safely or the required distinct human decision path is unavailable;
- golden-set promotion is attempted without complete frozen responses, complete adjudication, hashes, validator evidence and future governance approval;
- any provider, provider retry, network AI call or fallback is attempted;
- the workflow requires a secret, credential, token, authorization header, `.env` value or other sensitive runtime configuration;
- real customer data, cross-tenant data or unauthorized evidence appears.

On a stop, preserve only the minimum non-sensitive evidence needed to explain the stop, record the responsible human owner and next permitted action, and do not invent missing proof.

### Explicit prohibitions

This protocol does not authorize or create:

- invented, simulated, AI-generated or Codex-generated human responses;
- invented, simulated, AI-generated or Codex-generated adjudication;
- a golden-set promotion or a `GOLDEN_APPROVED` claim;
- a provider, provider retry, AI network call or fallback;
- a secret or `.env` dependency;
- a runtime, contract, schema, database, migration or product behavior change;
- a spec `043`.

## Adjudication

Disagreements must follow the human decision path defined above: normally a senior expert different from both annotators, or the explicitly documented joint CPO/IA Governance path when that exception is required.

The adjudicator must record:

- final outcome;
- final reason code if applicable;
- final target only for `SUGGESTION`;
- why the losing annotation was rejected;
- whether the case should block promotion, update the taxonomy record, or update this guide.

Adjudication must prefer abstention over an approximate target when evidence remains weak.

Adjudication must not convert a policy block or invalid provider output into business abstention.

`POLICY_BLOCK` and `INVALID_MODEL_OUTPUT` cases require cross-review by business expertise and governance or technical expertise before they can support promotion.

## Critical error policy

Any confirmed critical error blocks promotion:

- active/passive confusion;
- balance sheet / income statement confusion;
- revenue/expense confusion;
- contra account misclassification;
- unknown, deprecated or non-selectable target exposed as suggestion;
- unknown, deprecated, non-selectable or contextually inadmissible provider target classified as `TAXONOMY_GAP` or another business abstention;
- taxonomy gap hidden by an approximate target;
- policy block classified as `OUT_OF_SCOPE` or another business abstention;
- policy or technical incident classified as business abstention;
- suggestion on a case requiring critical abstention.

## Promotion evidence required

Before this guide can support a contract or golden set:

- double annotation coverage must be measured;
- adjudication outcomes must be complete;
- critical errors must be zero in final annotated cases;
- disagreement rates must be reported by reason code and target family;
- all abstention reason codes must have positive and negative examples;
- a future golden set must distinguish valid taxonomy gaps, invalid provider targets, policy blocks and technical failures explicitly;
- Expert Board review must approve the taxonomy of reasons and examples.

No signature is recorded in this draft.
