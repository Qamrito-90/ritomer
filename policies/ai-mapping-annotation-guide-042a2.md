# AI Mapping Annotation Guide - 042a2

## Guide identity

| Field | Value |
| --- | --- |
| Guide id | `042a2-ai-mapping-annotation-guide-v1` |
| Scope | Annotation rules for semantic readiness before `mapping-suggestion-v2`, golden set update or runtime provider work. |
| Surface | `DOCS_GIT / AI_GOVERNANCE / FIDUCIARY_GOVERNANCE` |
| Current status | `DRAFT` |
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

## Adjudication

Disagreements must be adjudicated by a senior expert who is different from both annotators.

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
