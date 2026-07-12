# 042a2 Human Reviewer Instructions v1

## Documentary status

- `DRAFT`
- `NOT_EXECUTABLE`
- `NOT_DISTRIBUTABLE`
- `NOT_VALIDATED_BY_DRAFT_2020_12_ENGINE`

JSON syntax and repository invariants checked; Draft 2020-12 semantic validation not performed.

These answer-free instructions are shared unchanged for reviewer A and reviewer B. They do not authorize distribution or collection. `PR #99 technical exact-diff ratification = RATIFIED_WITH_NON_BLOCKING_CORRECTIONS` and `PR #99 Security/Privacy exact-diff ratification = RATIFIED_WITH_CONDITIONS_BEFORE_USE`; `corrective diff Security/Privacy review = REQUIRED_BEFORE_MERGE` and `operational Security/Privacy confirmation = REQUIRED_BEFORE_DISTRIBUTION` still apply.

## First-round separation of duties

The first real round requires four distinct humans. The labels below are documentary role slots, not participant identities and not proof of pseudonymization:

- `reviewer-a` reviews pack A;
- `reviewer-b` reviews pack B;
- `coordinator-1` controls custody and mechanical checks;
- `adjudicator-1` may adjudicate only after both responses are frozen.

Reviewers work independently. The coordinator does not decide accounting content. The adjudicator is not a reviewer. No AI system is a reviewer, coordinator or adjudicator.

Future participant pseudonyms and opaque references must be generated automatically and randomly, limited to one round, not derived from a name, e-mail, employee identifier, employer or HR identifier, and not reused across rounds without explicit approval. The documentary schemas constrain only their shape and do not prove this procedural property. No human response is intended for Git.

## Authorized material

A reviewer may use only:

- the one blind pack assigned to that reviewer;
- `reviewer-response-schema-v2.json` as documentary field guidance;
- this exact instruction version;
- the target catalog and neutral review input already contained in the assigned pack;
- a neutral clarification delivered identically to both reviewers through the governed clarification path.

The following are forbidden during a real round:

- the other blind pack or the other response;
- navigation elsewhere in the repository;
- AI systems, assistants, autocomplete agents or model outputs used to produce, complete, critique or correct a response;
- expected answers, oracles or solution keys;
- candidate fixtures or their metadata;
- builder, evaluator or validator internals;
- offline evaluator results;
- preliminary discussion, comparison, shared drafts or screen sharing between reviewers.

If forbidden material is encountered or independence is doubtful, stop and notify the coordinator without copying the material into the response.

## Fiduciary reading rules

- The account number is an auxiliary signal. It is never sufficient on its own.
- The account label is a useful semantic signal. It is never an isolated authority.
- An absent field means not provided and not proved. Do not invent, infer or fill a placeholder.
- A final target must be a known leaf in the exact supplied catalog, non-deprecated, selectable and contextually admissible.
- Roots and sections are forbidden as final targets.
- A nearby target is not an acceptable substitute for missing evidence or a taxonomy gap.
- Human review remains mandatory for every proposed target.

## Decision tree

Process the fail-closed gates separately: an unauthorized request is `POLICY_BLOCK`; an unmet account/import/eligibility condition is `PRECONDITION_BLOCK`; and a malformed or unknown, deprecated, non-selectable, root, section or contextually inadmissible supplied model result is `INVALID_MODEL_OUTPUT`. After processing any POLICY_BLOCK, PRECONDITION_BLOCK and INVALID_MODEL_OUTPUT conditions, apply the following semantic decision branch in order and stop at the first established result.

1. **`OUT_OF_SCOPE`** — use `ABSTENTION / OUT_OF_SCOPE` only when:
   - the request is authorized;
   - all preconditions are met;
   - the business concept is established;
   - that concept is explicitly outside the assistance perimeter.

   An isolated signal toward an out-of-scope concept is not enough when other material signals support an incompatible concept; use `CONFLICTING_SIGNALS` in that case.
2. **`CONFLICTING_SIGNALS`** — use `ABSTENTION / CONFLICTING_SIGNALS` when two or more positive and materially incompatible signals point to different concepts, treatments or target families.
3. **`INSUFFICIENT_EVIDENCE`** — use `ABSTENTION / INSUFFICIENT_EVIDENCE` when the authorized evidence cannot reliably establish the business concept or the admissible candidate set. Missing or weak evidence is not a conflict.
4. **Calcul des cibles admissibles** — only after the preceding results are excluded, calculate the exact known, non-deprecated, selectable and contextually admissible targets for the established concept:
   - **Zero admissible targets:** use `ABSTENTION / TAXONOMY_GAP`.
   - **Two or more admissible targets:** use `ABSTENTION / AMBIGUOUS_TARGET`.
   - **Exactly one admissible target:** use `SUGGESTION`.

`TAXONOMY_GAP` is allowed only when the business concept is established, the evidence is not insufficient, the absence of a target comes from the exact supplied catalog/taxonomy, and no approximate target is invented.

For `AMBIGUOUS_TARGET`, SUFFICIENT means sufficient to establish the business concept and the admissible candidate set; it does not mean sufficient to select, validate or approve one unique target. `CONFLICTING` is not allowed in the `AMBIGUOUS_TARGET` branch; materially conflicting evidence stops at step 2.

## Outcome matrix

| Outcome | Reason or target field | Evidence state | Human action | Critical flags guidance |
| --- | --- | --- | --- | --- |
| `SUGGESTION` | `targetCode`; no `reasonCode` | `SUFFICIENT` | `REVIEW_TARGET` | Use `NONE` only when no boundary applies; otherwise record every material boundary flag. |
| `ABSTENTION` | `OUT_OF_SCOPE` | `SUFFICIENT` | `REVIEW_ABSTENTION_REASON` | Use relevant boundary flags where material. |
| `ABSTENTION` | `CONFLICTING_SIGNALS` | `CONFLICTING` | `REVIEW_ABSTENTION_REASON` | A material contradiction must stop before target calculation. |
| `ABSTENTION` | `INSUFFICIENT_EVIDENCE` | `INSUFFICIENT` or `MISSING` | `REVIEW_ABSTENTION_REASON` | Never invent missing proof. |
| `ABSTENTION` | `TAXONOMY_GAP` | `SUFFICIENT` | `REVIEW_ABSTENTION_REASON` | `TAXONOMY_GAP` flag required. |
| `ABSTENTION` | `AMBIGUOUS_TARGET` | `SUFFICIENT` uniquement | `REVIEW_ABSTENTION_REASON` | Two or more admissible targets remain after sufficient-evidence and conflict checks. |
| `POLICY_BLOCK` | One policy `reasonCode` | `POLICY_BLOCKED` | `ROUTE_TO_GOVERNANCE` | `POLICY_INCIDENT` required. |
| `PRECONDITION_BLOCK` | `STALE_IMPORT` | `STALE_PRECONDITION` | `CHECK_PRECONDITION` | Never force a business outcome. |
| `PRECONDITION_BLOCK` | `ACCOUNT_ALREADY_AFFECTED`, `ACCOUNT_NOT_IN_LATEST_IMPORT`, `NOT_ELIGIBLE` | `PRECONDITION_NOT_MET` | `CHECK_PRECONDITION` | Never force a business outcome. |
| `INVALID_MODEL_OUTPUT` | One invalid-output `reasonCode` | `TECHNICAL_INVALID` | `ROUTE_TO_TECHNICAL_REVIEW` | `TECHNICAL_INCIDENT` required; add `TARGET_VALIDITY` when relevant. |

`NONE` is exclusive in `criticalFlags`. It must not appear with another flag.

## Fiduciary glossary for technical fields

| Field | Fiduciary meaning |
| --- | --- |
| `caseId` | Neutral case identifier. In `REAL_ROUND`, it is the governed `blindCaseId` value `BR-*`; in `DRY_RUN`, it is a separate `DRY-*` id. It carries no accounting answer. |
| `reviewMode` | `REAL_ROUND` for a future governed 17-case response; `DRY_RUN` only for an out-of-corpus exercise. |
| `outcome` | The semantic route selected after applying the decision tree. |
| `reasonCode` | The bounded explanation category for a non-suggestion outcome; it is not free-form advice. |
| `targetCode` | Exact final selectable rubric code, present only for `SUGGESTION`. |
| `evidenceState` | Closed assessment: sufficient, missing, conflicting, policy-blocked, `STALE_PRECONDITION`, `PRECONDITION_NOT_MET` or technically invalid, according to the exact outcome/reason matrix. |
| `criticalFlags` | Material accounting/governance boundaries that require explicit attention. |
| `expectedHumanAction` | Governed next human route; it is not an expected answer or oracle. |
| `humanJustification` | Reviewer-authored rationale of 250–400 characters, grounded only in authorized material. |
| `decisiveSignal` | Short identification of the supplied signal that most strongly determined the route. |
| `mainAlternativeRejected` | Optional bounded record of the main plausible alternative and why it was not selected; omit it when not relevant. |
| `unresolvable` | Optional `true` marker when authorized evidence cannot safely support a final resolution; omit it otherwise. |

## Human justification

Every case requires a reviewer-authored justification between 250 and 400 characters. It must state the decisive supplied signal, explain the selected boundary, and avoid copied source text, expected-answer language or speculative facts. When a material alternative exists, record the principal rejected alternative and the reason for rejection. When no safe resolution is possible, use the applicable non-suggestion outcome and the optional `unresolvable=true` marker; never invent a target.

## Free-text data minimization

The following normative rule applies equally to `humanJustification`, `decisiveSignal`, `mainAlternativeRejected`, `reviewerQuestion`, `neutralReformulation` and `sharedResponse`:

Ne saisir aucun nom, e-mail, initiale nominative, employeur, identifiant de collaborateur, identifiant client ou tenant, dossier, import, chemin local ou réseau, URL, emplacement de stockage, référence personnelle, preuve de compétence ou contenu provenant d’une source privée. Utiliser uniquement les identifiants synthétiques et les codes fournis dans le pack. En cas de doute, arrêter la saisie et signaler l’incident sans recopier la donnée.

## Neutral clarification mechanism

The reviewer submits a question to `coordinator-1` without proposing an answer. The coordinator records a neutral reformulation and one identical response for A and B. If the clarification may influence a decision, both reviews pause, the same response is delivered to both, and both resume symmetrically. A clarification must never reveal a target, a source category, an expected answer, an oracle, another response or the coordinator’s accounting opinion.

## DRY_RUN_ONLY illustration

Any exercise must use an identifier such as `DRY-001`, material created outside the 17-case corpus and `reviewMode=DRY_RUN`. It may illustrate how to distinguish a missing precondition from insufficient business evidence, but must not reproduce a corpus label, target, expected answer, metadata source or case ordering. A dry run is never human evidence and never authorizes a real round.

## Required disclaimer

“Résultat de revue humaine sur cas synthétiques — NON AUTORITATIF — NOT_GOLDEN. Ne constitue ni un mapping officiel, ni une validation de mapping-suggestion-v2, ni une autorisation de provider. Le mapping manuel reste l’autorité métier.”

No response, attestation, freeze, adjudication or approval is created by these instructions.
