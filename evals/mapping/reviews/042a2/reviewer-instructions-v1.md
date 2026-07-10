# 042a2 Human Reviewer Instructions v1

## Documentary status

- `DRAFT`
- `NOT_EXECUTABLE`
- `NOT_DISTRIBUTABLE`
- `NOT_VALIDATED_BY_DRAFT_2020_12_ENGINE`

JSON syntax and repository invariants checked; Draft 2020-12 semantic validation not performed.

These answer-free instructions are shared unchanged for reviewer A and reviewer B. They do not authorize distribution or collection. A Security/Privacy review is required before merge, and a new operational Security/Privacy confirmation is required before any future distribution.

## First-round separation of duties

The first real round requires four distinct humans represented only by generic pseudonyms in repository-facing artifacts:

- `reviewer-a` reviews pack A;
- `reviewer-b` reviews pack B;
- `coordinator-1` controls custody and mechanical checks;
- `adjudicator-1` may adjudicate only after both responses are frozen.

Reviewers work independently. The coordinator does not decide accounting content. The adjudicator is not a reviewer. No AI system is a reviewer, coordinator or adjudicator.

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

Apply the tree in order and stop at the first supported result.

1. **Authorized request boundary**
   - Use `POLICY_BLOCK` for a request blocked by governance, privacy, tenant, provenance, allowlist, cohort or gate rules.
   - Use `ABSTENTION / OUT_OF_SCOPE` only when the request is authorized and the business concept is established, but that concept is explicitly outside the assistance perimeter.
2. **Case preconditions**
   - Use `PRECONDITION_BLOCK` when the case cannot be reviewed because an account/import/eligibility precondition is not satisfied.
   - Use `ABSTENTION` only after the preconditions are satisfied and the lack of a target is a business-semantic result.
3. **Evidence sufficiency**
   - Use `ABSTENTION / INSUFFICIENT_EVIDENCE` when the concept or candidate set cannot be established from supplied evidence.
   - Use `ABSTENTION / AMBIGUOUS_TARGET` when the concept is established and two or more admissible targets remain plausible.
4. **Taxonomy versus invalid output**
   - Use `ABSTENTION / TAXONOMY_GAP` when a valid established concept has no admissible target in the exact supplied taxonomy.
   - Use `INVALID_MODEL_OUTPUT` when a supplied model result is malformed or proposes an unknown, deprecated, non-selectable, root, section or contextually inadmissible target.
5. **Conflicts**
   - Use `ABSTENTION / CONFLICTING_SIGNALS` only when supplied material signals point materially to different concepts or target families.
   - Use `INSUFFICIENT_EVIDENCE` for a simple lack of proof without a material contradiction.
6. **Suggestion**
   - Use `SUGGESTION` only when exactly one final target is admissible and supported by sufficient evidence.

## Outcome matrix

| Outcome | Reason or target field | Evidence state | Human action | Critical flags guidance |
| --- | --- | --- | --- | --- |
| `SUGGESTION` | `targetCode` required; `reasonCode` absent | `SUFFICIENT` | `REVIEW_TARGET` | Use `NONE` only when no boundary applies; otherwise record every material boundary flag. |
| `ABSTENTION` | One business `reasonCode`; `targetCode` absent | `CONFLICTING`, `INSUFFICIENT`, `MISSING` or `SUFFICIENT`, consistently with the reason | `REVIEW_ABSTENTION_REASON` | Use `TAXONOMY_GAP` for an actual gap and relevant boundary flags where material. |
| `POLICY_BLOCK` | One policy `reasonCode`; `targetCode` absent | `POLICY_BLOCKED` | `ROUTE_TO_GOVERNANCE` | `POLICY_INCIDENT` required. |
| `PRECONDITION_BLOCK` | One precondition `reasonCode`; `targetCode` absent | `STALE_PRECONDITION` | `CHECK_PRECONDITION` | Use only material boundary flags; never force a business outcome. |
| `INVALID_MODEL_OUTPUT` | One invalid-output `reasonCode`; `targetCode` absent | `TECHNICAL_INVALID` | `ROUTE_TO_TECHNICAL_REVIEW` | `TECHNICAL_INCIDENT` required; add `TARGET_VALIDITY` when relevant. |

`NONE` is exclusive in `criticalFlags`. It must not appear with another flag.

## Fiduciary glossary for technical fields

| Field | Fiduciary meaning |
| --- | --- |
| `caseId` | Neutral case identifier. In `REAL_ROUND`, it is the governed `blindCaseId` value `BR-*`; in `DRY_RUN`, it is a separate `DRY-*` id. It carries no accounting answer. |
| `reviewMode` | `REAL_ROUND` for a future governed 17-case response; `DRY_RUN` only for an out-of-corpus exercise. |
| `outcome` | The semantic route selected after applying the decision tree. |
| `reasonCode` | The bounded explanation category for a non-suggestion outcome; it is not free-form advice. |
| `targetCode` | Exact final selectable rubric code, present only for `SUGGESTION`. |
| `evidenceState` | Assessment of whether supplied evidence is sufficient, missing, conflicting, blocked, stale or technically invalid. |
| `criticalFlags` | Material accounting/governance boundaries that require explicit attention. |
| `expectedHumanAction` | Governed next human route; it is not an expected answer or oracle. |
| `humanJustification` | Reviewer-authored rationale of 250–400 characters, grounded only in authorized material. |
| `decisiveSignal` | Short identification of the supplied signal that most strongly determined the route. |
| `mainAlternativeRejected` | Optional bounded record of the main plausible alternative and why it was not selected; omit it when not relevant. |
| `unresolvable` | Optional `true` marker when authorized evidence cannot safely support a final resolution; omit it otherwise. |

## Human justification

Every case requires a reviewer-authored justification between 250 and 400 characters. It must state the decisive supplied signal, explain the selected boundary, and avoid copied source text, expected-answer language or speculative facts. When a material alternative exists, record the principal rejected alternative and the reason for rejection. When no safe resolution is possible, use the applicable non-suggestion outcome and the optional `unresolvable=true` marker; never invent a target.

## Neutral clarification mechanism

The reviewer submits a question to `coordinator-1` without proposing an answer. The coordinator records a neutral reformulation and one identical response for A and B. If the clarification may influence a decision, both reviews pause, the same response is delivered to both, and both resume symmetrically. A clarification must never reveal a target, a source category, an expected answer, an oracle, another response or the coordinator’s accounting opinion.

## DRY_RUN_ONLY illustration

Any exercise must use an identifier such as `DRY-001`, material created outside the 17-case corpus and `reviewMode=DRY_RUN`. It may illustrate how to distinguish a missing precondition from insufficient business evidence, but must not reproduce a corpus label, target, expected answer, metadata source or case ordering. A dry run is never human evidence and never authorizes a real round.

## Required disclaimer

“Résultat de revue humaine sur cas synthétiques — NON AUTORITATIF — NOT_GOLDEN. Ne constitue ni un mapping officiel, ni une validation de mapping-suggestion-v2, ni une autorisation de provider. Le mapping manuel reste l’autorité métier.”

No response, attestation, freeze, adjudication or approval is created by these instructions.
