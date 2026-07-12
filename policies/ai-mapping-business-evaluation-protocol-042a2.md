# AI Mapping Business Evaluation Protocol - 042a2

## Protocol identity

| Field | Value |
| --- | --- |
| Protocol id | `042a2-ai-mapping-business-evaluation-protocol-v1` |
| Scope | Business evaluation protocol for human review, adjudication, future golden-set governance and provider-runtime readiness; `mapping-suggestion-v2` already exists and is not approved by this protocol. |
| Surface | `DOCS_GIT / AI_GOVERNANCE / FIDUCIARY_GOVERNANCE` |
| Current status | `DRAFT` |
| Human-review workflow state | `PENDING_HUMAN_RESPONSES` |
| Current decision | This protocol does not approve a provider, model, prompt runtime, contract, golden set, operational response validator, runtime metric collector, secret, network call or production activation. The separate `042a2a6a` structural checker is not a Draft 2020-12 engine or evaluation tool. |

This protocol defines how business usefulness must be evaluated later. It does not execute the evaluation.

## Evaluation boundary

The future evaluation must use synthetic demo data only until separate approval says otherwise.

Forbidden in the evaluation dataset, logs, notes and reports:

- real customer data;
- raw CSV from a real customer;
- tenant, client or actor identifiers in clear;
- secrets, tokens, cookies, DSNs, credentials or `.env` values;
- private storage keys, signed URLs or document paths;
- provider prompt, payload or output logs.

Aucune réponse humaine n’est destinée à Git. Future response, attestation, freeze and disposition instances are données personnelles pseudonymisées, non anonymes. They remain outside the repository and may be referenced only through an opaque `custodyReference` bound to an exact-byte SHA-256.

Future pseudonyms and opaque references must be generated automatically and randomly, limited to one round, not derived from a name, e-mail, employee identifier, employer or HR identifier, and not reused across rounds without explicit approval. Documentary schema patterns do not prove these properties.

Real storage, jurisdiction, ACL, retention and deletion remain `NON DÉTERMINÉ / REQUIRED_BEFORE_DISTRIBUTION`. No operational content validator for personal data, private sources, URLs or paths is delivered here; it remains a future fail-closed condition.

Le coordinateur confirme uniquement les contrôles de custody, d’identité d’artefact, de hash, de timestamp et de présence des déclarations requises. Il ne certifie ni l’identité juridique, ni la vérité substantielle de la réponse, ni l’absence absolue d’usage d’IA ou d’accès interdit.

## Primary business objectives

| Metric | Objective | Promotion impact |
| --- | --- | --- |
| Median complete mapping time | At least 20% improvement versus manual baseline. | Miss blocks business promotion unless explicitly waived by CPO and Expert Board. |
| Manual searches | At least 30% reduction versus manual baseline. | Miss blocks business promotion unless root cause and remediation are documented. |
| Final critical errors | Zero. | Any final critical error blocks promotion. |
| Final quality | No more than 1 percentage point below adjudicated gold on the approved review scale. | Larger gap blocks promotion. |
| Autonomous comprehension/correction | At least 90%, then at least 95% after five reviewed cases. | Miss blocks broader pilot. |
| Critical error detection | 100% of injected critical errors detected. | Miss blocks promotion. |
| Other error detection | At least 95% detected. | Miss blocks promotion unless risk is accepted by Expert Board. |
| Overhead on manually resolvable abstentions | Less than 10% extra time versus manual baseline for abstentions a reviewer can resolve manually. | Miss blocks broader pilot unless root cause and remediation are documented. |
| `OUT_OF_SCOPE`, `POLICY_BLOCK`, `TAXONOMY_GAP` and `INVALID_MODEL_OUTPUT` boundaries | Measured by correct routing, not by treating the case as normal manual mapping or business abstention when it is not one. | Incorrect routing blocks promotion. |

## Definitions

- Complete mapping time: elapsed time from the first unresolved account entering review until the last account is correctly resolved or correctly routed to explicit deferral, policy block or technical degradation.
- Manual search: a deliberate human lookup, navigation, document/reference opening, taxonomy browsing action, external reference consultation or manual comparison performed to decide or route an affectation. Passive screen reading of the current case, automated suggestions and system-provided evidence already visible in the review surface are not counted.
- Final quality: senior expert score against adjudicated gold, using the approved evaluation rubric.
- Autonomous comprehension/correction: reviewer can understand the proposed semantic state and choose the correct next action without external explanation.
- Correct routing: business abstention, policy block and technical failure cases are directed to the documented action path instead of forcing a target or conflating categories.

## Study design requirements

The future evaluation must include:

- a manual baseline run;
- an assisted run using the approved semantics;
- randomized case order or a counterbalanced crossover design to reduce learning and ordering bias;
- independent review by fiduciary experts;
- adjudication for disagreements;
- synthetic cases covering clear positives, abstentions, contra accounts, multilingual labels, ambiguous labels and sensitive-looking sanitized labels;
- injected critical errors for detection testing;
- separate measurement of business abstention, policy block and technical failure.

The same participant must not adjudicate their own disputed case.

## Human evidence gate before evaluation - 042a2a6

The collection, freeze, comparison and adjudication workflow is defined normatively in `policies/ai-mapping-annotation-guide-042a2.md`. The current state is `PENDING_HUMAN_RESPONSES` because the repository contains blind inputs and a response schema, but no real human response set, no adjudication record and no promoted 042a2 golden set.

Business evaluation must not start from candidate fixture answers, offline evaluator results, an AI-generated response or a partially collected review. Before any adjudicated labels can be used as evaluation evidence, the following cumulative conditions must be met:

- reviewer A received only pack A and reviewer B received only pack B;
- both reviewers are real humans and completed their 17 responses independently;
- each response conforms strictly to `evals/mapping/reviews/042a2/reviewer-response-schema-v1.json` and passes `evals/mapping/validate-042a2-human-review-responses.ps1` against its own committed pack;
- the committed blind pack and schema pass `evals/mapping/validate-042a2-blind-review-pack.ps1`;
- the two response files, pack files and schema have recorded hashes, validation results, freeze timestamps and independence attestations;
- both responses were frozen before any cross-review or comparison;
- comparison was performed by `blindCaseId`, not array position;
- every exact agreement was ratified and every divergence was resolved by a distinct human adjudicator or an explicitly documented joint CPO/IA Governance decision;
- `TAXONOMY_GAP`, `POLICY_BLOCK`, `PRECONDITION_BLOCK` and `INVALID_MODEL_OUTPUT` retained their required routing and were not converted into approximate suggestions;
- `STALE_IMPORT` used `STALE_PRECONDITION`, while `ACCOUNT_ALREADY_AFFECTED`, `ACCOUNT_NOT_IN_LATEST_IMPORT` and `NOT_ELIGIBLE` used `PRECONDITION_NOT_MET`;
- no stop condition remains open.

The workflow states have these business meanings:

- `PENDING_HUMAN_RESPONSES`: evaluation evidence is unavailable;
- `PENDING_ADJUDICATION`: two valid frozen response sets exist, but no adjudicated reference exists yet;
- `ADJUDICATED_NOT_GOLDEN`: all cases have final human dispositions, but they are review evidence only and must not be used as an authoritative scoring reference or described as an approved golden set;
- `GOLDEN_CANDIDATE_PENDING_GOVERNANCE`: a future separately authorized mission has materialized and validated a candidate for governance review;
- `GOLDEN_APPROVED`: a future explicit human governance gate has approved an authoritative artifact. This state is not reachable in `042a2a6`.

No state transition authorizes a provider, provider retry, AI network call, runtime activation, secret handling or spec `043`. If responses are missing or invalid, independence is compromised, expected answers leak, a frozen hash changes, a divergence is non-adjudicable, or promotion evidence is incomplete, evaluation and promotion stop at the last valid state.

## Governance hardening gate before collection - 042a2a6a

`042a2a6a` preserves the `042a2a6` protocol above and adds a separate kit with statuses `DRAFT / NOT_EXECUTABLE / NOT_DISTRIBUTABLE / NOT_VALIDATED_BY_DRAFT_2020_12_ENGINE`. Its schemas are documentary future structures and its Node checker verifies only JSON syntax and repository invariants.

The declared workflow state remains `PENDING_HUMAN_RESPONSES`; human responses, adjudications and the `042a2` golden set remain at zero. The `HARDENING_ONLY` baseline applies no transition, contains no human evidence and keeps collection, distribution, adjudication, golden promotion, provider and retry authorizations at `false`.

Any future authorization requires all of the following together:

- a valid ledger state;
- an authorized adjacent transition;
- referenced human evidence;
- verified exact-byte hashes;
- all required validations passed;
- all required human approvals present.

The state alone is never evaluation evidence and never authorizes distribution, adjudication, promotion, provider activation or retry. PR #99 exact-diff ratifications do not replace the remaining `corrective diff Security/Privacy review = REQUIRED_BEFORE_MERGE`, `IA Governance / fiduciary review of D/E/F = REQUIRED_BEFORE_MERGE` or `operational Security/Privacy confirmation = REQUIRED_BEFORE_DISTRIBUTION` gates. The Draft 2020-12 engine gate is `STOP_DEPENDENCY_REQUIRED`; no library is selected or added.

JSON syntax and repository invariants checked; Draft 2020-12 semantic validation not performed.

No real response, registry, manifest, attestation, freeze, clarification or adjudication dossier is materialized by this hardening gate.

## Required event fields

Evaluation notes may record only minimized fields:

- synthetic case id;
- semantic outcome;
- reason code when outcome is `ABSTENTION`;
- policy or technical code when outcome is `POLICY_BLOCK` or technical failure;
- target id only for `SUGGESTION`;
- elapsed time bucket or measured duration, without sensitive context;
- number of manual searches;
- reviewer decision;
- adjudication result;
- critical error flags;
- version ids for taxonomy, annotation guide and semantic record.

Do not record provider prompts, provider outputs, raw payloads, raw account labels from real customers, raw amounts, tenant/client/actor identities or secrets.

## Critical errors

The following errors have zero tolerance:

- active/passive confusion;
- balance sheet / income statement confusion;
- revenue/expense confusion;
- contra account misclassification;
- unknown, deprecated or non-selectable target exposed as suggestion;
- unknown, deprecated, non-selectable or contextually inadmissible provider target counted as `TAXONOMY_GAP` or another business abstention;
- `TAXONOMY_GAP` hidden by an approximate target;
- `POLICY_BLOCK` counted as `OUT_OF_SCOPE` or another business abstention;
- policy or technical incident classified as business abstention;
- suggestion on a case requiring critical abstention.

Any critical error blocks promotion until root cause, remediation and re-evaluation are documented.

## Routing and invalid-output scoring

`OUT_OF_SCOPE`, `POLICY_BLOCK`, `TAXONOMY_GAP` and `INVALID_MODEL_OUTPUT` boundaries are not scored as normal manual mapping misses.

`OUT_OF_SCOPE` is scored only for an account inside an otherwise authorized request that is outside the approved business perimeter of AI-assisted affectation. It is measured by correct routing, not by manual mapping accuracy.

`POLICY_BLOCK` is scored for non-synthetic, cross-tenant, outside allowlist, outside approved provenance or invalid-gate requests. It must prove correct policy routing, no provider call and exclusion from business abstention metrics.

`TAXONOMY_GAP` is scored only when the frozen pilot taxonomy contains no admissible target for a valid business concept. It is measured by correct routing and gap capture, not by forcing a target.

`INVALID_MODEL_OUTPUT` or the future technical degradation state is scored when provider output is malformed or names an unknown, deprecated, non-selectable or contextually inadmissible target. It must be excluded from business abstention metrics.

They are scored by:

- whether the case was routed to the correct path;
- whether no target was forced;
- whether no confidence was shown;
- whether the user-facing message and action set matched the semantic record;
- whether no provider call occurred for policy blocks;
- whether invalid provider target cases were counted as technical degradation, not `TAXONOMY_GAP`;
- whether the taxonomy or scope gap was captured for follow-up.

The future golden set must distinguish at least these cases explicitly:

- authorized account outside the business perimeter: `ABSTENTION / OUT_OF_SCOPE`;
- non-synthetic, cross-tenant, outside allowlist, outside provenance or invalid gate: `POLICY_BLOCK`;
- valid business concept absent from the frozen pilot taxonomy: `ABSTENTION / TAXONOMY_GAP`;
- provider returns an unknown, deprecated, non-selectable or contextually inadmissible target: `INVALID_MODEL_OUTPUT` or the future technical degradation state.

## Promotion gate

Before this protocol can support runtime activation:

- the annotation guide must be approved;
- the pilot taxonomy must be frozen and hashed;
- the semantic readiness record must be approved;
- the contract must encode the approved semantics;
- the human-review workflow must have reached `ADJUDICATED_NOT_GOLDEN` with complete frozen response, comparison and adjudication evidence;
- the golden set and validator must be created in a separate future authorized mission, reach `GOLDEN_CANDIDATE_PENDING_GOVERNANCE` and pass;
- `GOLDEN_APPROVED` must be recorded only by a later explicit human governance gate;
- business evaluation results must meet the objectives above;
- Expert Board and IA Governance must sign the result.

No business-evaluation, golden-set, provider, collection or distribution approval is recorded by this draft.
