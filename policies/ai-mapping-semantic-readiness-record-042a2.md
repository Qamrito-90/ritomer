# AI Mapping Semantic Readiness Record - 042a2

## Record identity

| Field | Value |
| --- | --- |
| Record id | `042a2-ai-mapping-semantic-readiness-record-v1` |
| Scope | Semantic readiness before any `mapping-suggestion-v2` contract, prompt runtime, provider runtime or golden set update. |
| Surface | `DOCS_GIT / AI_GOVERNANCE / FIDUCIARY_GOVERNANCE` |
| Current status | `PENDING_EVIDENCE` |
| Current decision | No contract, provider, model, prompt runtime, golden set, validator, secret, network call, backend runtime or frontend runtime is approved by this record. |

This record is a draft semantic gate. It defines the business semantics that must be reviewed before a future contract can encode them.

## Boundary

`042a2a1` is docs-only.

- No `mapping-suggestion-v2` contract is created.
- No existing contract is modified.
- No provider is selected.
- No model is selected.
- No prompt runtime is created.
- No golden set or validator is created.
- No backend, frontend, DB, migration, OpenAPI, CI, dependency or runtime code is changed.
- No secret, `.env`, token, cookie, DSN or credential is read or required.
- No provider call or AI network call is made.
- No spec `043` is created.

## Canonical user-facing semantics

The product language must talk about `affectation` in the interface. `mapping` remains an internal technical term.

| Semantic outcome | User-facing title or label | Target visible | Confidence visible | Provider free text visible | Human actions |
| --- | --- | --- | --- | --- | --- |
| `SUGGESTION` | `Proposition à vérifier` | Yes, only when known, selectable and non-deprecated. | No numeric confidence. | No. Only approved deterministic or reviewed rationale fields may be visible. | `Valider la proposition`, `Choisir une autre cible`, `Rejeter`. |
| `ABSTENTION` | `Aucune proposition` | No. | No. | No. Deterministic message by `reasonCode` only. | No `Rejeter`. Allowed next actions depend on the reason code. |
| Technical degradation | `Proposition momentanément indisponible` | No. | No. | No. Deterministic technical message only. | Use manual affectation or retry later according to runbook and UI context. |

`ABSTENTION` is not a weak suggestion. It must not expose a target, a confidence value, a hidden ranking or a provider-generated explanation as decisionable product content.

## Policy and invalid-output boundaries

`POLICY_BLOCK` is not an `ABSTENTION` reason code. A non-synthetic request, cross-tenant request, request outside the approved allowlist, request outside approved provenance, or invalid gate must be blocked by policy before any provider call. It must never be counted as business abstention.

`OUT_OF_SCOPE` is allowed only for an account inside an otherwise authorized request when that account is outside the business perimeter of AI-assisted affectation.

`TAXONOMY_GAP` is allowed only when the frozen pilot taxonomy contains no admissible target for a valid business concept. A provider output that names an unknown, deprecated or non-selectable target is `INVALID_MODEL_OUTPUT` or another technical degradation state according to the future contract. It must never be counted as business abstention.

## Allowed abstention reason codes

Only these product reason codes are allowed for `ABSTENTION`:

- `OUT_OF_SCOPE`
- `CONFLICTING_SIGNALS`
- `INSUFFICIENT_EVIDENCE`
- `TAXONOMY_GAP`
- `AMBIGUOUS_TARGET`

No catch-all output reason code is allowed. If a case cannot be classified into one of these reason codes, the semantic set must be revised before contract work continues.

## Deterministic messages and actions

| Reason code | Deterministic user message | Allowed user actions |
| --- | --- | --- |
| `OUT_OF_SCOPE` | `Ce compte est hors du périmètre d'affectation assistée.` | Router hors périmètre IA. |
| `CONFLICTING_SIGNALS` | `Les signaux disponibles se contredisent.` | Choisir une affectation manuelle ou différer. |
| `INSUFFICIENT_EVIDENCE` | `Les preuves disponibles sont insuffisantes.` | Compléter l'analyse, choisir une affectation manuelle ou différer. |
| `TAXONOMY_GAP` | `La taxonomie ne contient pas de cible adaptée.` | Signaler le manque de taxonomie et différer. |
| `AMBIGUOUS_TARGET` | `Plusieurs cibles restent plausibles.` | Choisir une affectation manuelle ou différer. |

`Rejeter` is allowed only for a visible `SUGGESTION`. It is not allowed for `ABSTENTION`, because no proposition has been made.

## Decision tree

The future runtime contract must preserve this order unless a signed semantic review changes it.

1. If the request is non-synthetic, cross-tenant, outside the approved allowlist, outside approved provenance or blocked by an invalid gate, classify `POLICY_BLOCK`; make no provider call and do not classify business abstention.
2. If provider runtime is disabled, unavailable, timed out, malformed or invalid, return a technical degradation state, not a business abstention. A provider output that names an unknown, deprecated or non-selectable target is `INVALID_MODEL_OUTPUT` or another technical degradation state according to the future contract.
3. If an account inside an otherwise authorized request is outside the business perimeter of AI-assisted affectation, classify `ABSTENTION / OUT_OF_SCOPE`.
4. If the frozen pilot taxonomy contains no admissible target for a valid business concept, classify `ABSTENTION / TAXONOMY_GAP`.
5. If available evidence is missing, stale, not tenant-scoped or insufficient for review, classify `ABSTENTION / INSUFFICIENT_EVIDENCE`.
6. If evidence, balance direction, label or taxonomy signals materially conflict, classify `ABSTENTION / CONFLICTING_SIGNALS`.
7. If several admissible targets remain plausible after evidence review, classify `ABSTENTION / AMBIGUOUS_TARGET`.
8. If one admissible target remains supported by sufficient non-sensitive evidence, classify `SUGGESTION`.
9. If none of the rules can be applied deterministically, block contract promotion and revise this semantic record. Do not invent a fallback product reason code.

Approximate targets are forbidden. The system must prefer abstention over forcing a weak target.

## Positive and negative examples

These examples are synthetic and illustrative. They do not create a golden set.

| Case | Expected semantic outcome | Reason |
| --- | --- | --- |
| A synthetic bank account label clearly points to a selectable cash target and evidence is non-sensitive. | `SUGGESTION` | One known selectable target is supported. |
| A synthetic clearing account has debit and credit signals that point to different families. | `ABSTENTION / CONFLICTING_SIGNALS` | The system must not force an approximate target. |
| A synthetic account label is too generic and no usable evidence exists. | `ABSTENTION / INSUFFICIENT_EVIDENCE` | The user must complete analysis or decide manually. |
| A non-synthetic request, cross-tenant request, request outside allowlist, request outside approved provenance or invalid gate reaches the AI path. | `POLICY_BLOCK` | It must be blocked before any provider call and must not count as business abstention. |
| An account in an authorized synthetic request belongs to a business workflow not approved for AI-assisted affectation. | `ABSTENTION / OUT_OF_SCOPE` | It must route outside the AI-assisted affectation business scope. |
| A valid business category is absent from the frozen pilot taxonomy. | `ABSTENTION / TAXONOMY_GAP` | The taxonomy gap must be visible and deferred. |
| Two selectable targets remain equally plausible after evidence review. | `ABSTENTION / AMBIGUOUS_TARGET` | Human affectation or deferral is required. |
| Provider returns prose with a plausible target. | Technical degradation / `INVALID_MODEL_OUTPUT`, not `SUGGESTION`. | Provider free text is not product evidence. |
| Provider returns an unknown, deprecated or non-selectable target. | Technical degradation / `INVALID_MODEL_OUTPUT`, not `ABSTENTION / TAXONOMY_GAP`. | Invalid provider targets must not be exposed as suggestions or counted as business abstentions. |

## Critical semantic errors

Any critical error below blocks promotion to contract/runtime work:

- active/passive confusion;
- balance sheet / income statement confusion;
- revenue/expense confusion;
- contra account misclassification;
- unknown, deprecated or non-selectable target exposed as a suggestion;
- unknown, deprecated or non-selectable provider target classified as `TAXONOMY_GAP` or another business abstention;
- `TAXONOMY_GAP` hidden behind an approximate target;
- `POLICY_BLOCK` classified as `OUT_OF_SCOPE` or another business abstention;
- policy or technical incident classified as business abstention;
- suggestion emitted for a case requiring critical abstention.

## Contract-readiness blockers

Before a future `mapping-suggestion-v2` contract is drafted or approved:

- the semantic outcomes above must be approved by CPO, CTO, Security/Privacy, IA Governance and Expert Board as applicable;
- the contract must decide whether technical degradation is per-account, batch-level, or read-model state;
- the contract must encode that `ABSTENTION` has no target and no confidence;
- the contract must encode that `SUGGESTION` remains human-review-only;
- the contract must prevent provider free text from becoming visible product wording;
- the contract must define stable fields for deterministic messages or message keys;
- the contract must preserve the allowed reason-code set without a catch-all product output.
- the contract must distinguish `POLICY_BLOCK`, technical degradation and business `ABSTENTION`;
- the contract must prevent unknown, deprecated or non-selectable provider targets from being represented as `TAXONOMY_GAP`.

## Approval placeholders

These placeholders do not constitute approvals or signatures.

| Role | Expected evidence | Current status |
| --- | --- | --- |
| CPO | Product approval for the semantic states and user-facing actions. | `PENDING_EVIDENCE` |
| CTO | Confirmation that future contract/runtime can encode the semantics fail-closed. | `PENDING_EVIDENCE` |
| Security/Privacy | Confirmation that technical, policy and business abstentions are not conflated in logs or incidents. | `PENDING_EVIDENCE` |
| IA Governance | Approval of outcome taxonomy, no free-text provider wording and no forced target. | `PENDING_EVIDENCE` |
| Expert Board | Business validation of reason codes, decision tree and critical error list. | `PENDING_EVIDENCE` |
