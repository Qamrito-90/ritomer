# AI Runtime Gates Record - 042a

## Record identity

| Field | Value |
| --- | --- |
| Record id | `042a-ai-runtime-gates-record-v1` |
| Scope | Gate pack draft for the controlled AI mapping runtime pilot. |
| Surface | `DOCS_GIT / AI_GOVERNANCE` |
| Current status | `PENDING_EVIDENCE` |
| Current decision | No provider, model, dependency, prompt runtime, golden set update, validator, metrics, secret, network call or runtime code is approved by this record. |

This draft is not a signature. It records the evidence still required before any `042b` provider code and before any later provider network activation.

## Boundary

`042a1` prepares governance/readiness drafts only.

- No provider is selected.
- No model is selected.
- No runtime prompt is created.
- No golden set, validator or metrics artifact is created.
- No backend, frontend, DB, OpenAPI, CI, SDK, dependency or runtime code is changed.
- No secret, `.env`, token, cookie, DSN or credential is read or required.
- No provider call or AI network call is made.
- No spec `043` is created.

## Existing state versus target state

| Area | Exists now | Required before `042b` code | Required before provider network activation |
| --- | --- | --- | --- |
| Mapping suggestions | `030` no-provider suggestions and human decisions exist. | Preserve no-provider path and manual mapping authority. | Prove fallback to no-provider then manual mapping after provider failure. |
| Feature flag | `ritomer.ai.mapping-suggestions.enabled` exists in backend code. | A dedicated provider-runtime flag is required but not verified as existing. | Provider-runtime flag must be default off and kill-switchable. |
| Provider | No provider approved. | Provider-readiness record must be complete and signed for exact provider/model. | Activation gate must confirm allowed endpoint, secret handling and network controls. |
| Contract | `mapping-suggestion-v1` exists. | Contract decision required for abstention and uncertainty before code consuming those semantics. | Runtime output validation must match the signed contract and schema hash. |
| Golden set | `030c` golden set exists. | `042a2` must produce/update a synthetic golden set before runtime. | Golden set must be green with provider-runtime checks before activation. |
| Runbook | IA incident runbook exists. | Runbook must cover provider-runtime kill switch and incidents. | Runbook must be validated with activation evidence. |

## Contract readiness check

Read-only check performed against:

- `contracts/ai/mapping-suggestion.schema.json`
- `contracts/openapi/mapping-suggestions-api.yaml`

Result:

- `mapping-suggestion-v1` currently requires `suggestedTargetCode` and does not define `abstention`.
- `mapping-suggestion-v1` currently does not define `uncertainty`.
- OpenAPI degradation states represent disabled/no import/unavailable/timeout/invalid output/insufficient evidence, but not per-account abstention or uncertainty as structured output fields.

Decision:

- No contract is modified by `042a1`.
- `042b` is BLOCKED until a contract decision explicitly defines whether abstention and uncertainty are added to `mapping-suggestion-v1`, represented through a new schema version, or kept outside the provider output/read-model.

## Schema pinning evidence

Canonical schema source:

- Path: `contracts/ai/mapping-suggestion.schema.json`
- Algorithm: `SHA256`
- Command: `Get-FileHash -Algorithm SHA256 -LiteralPath 'contracts/ai/mapping-suggestion.schema.json'`
- Recalculated hash: `859073D97425F4EA44911AF3274FEA90C31A7CBF94010A38E61802232412C236`

This hash is evidence for the current contract only. If the contract changes to support abstention or uncertainty, the hash must be recalculated from the new canonical schema.

## Gate before `042b` provider code

All gates below are cumulative with the existing `030d` requirements. They must be signed and merged before any `042b` provider code starts.

| Gate | Current status | Evidence required |
| --- | --- | --- |
| CPO approval | `PENDING_EVIDENCE` | Product approval for a synthetic-demo-only runtime pilot and no production/customer data. |
| CTO Gate | `PENDING_EVIDENCE` | Backend-only gateway architecture, no microservice, no GraphQL, no RAG, no vector store, default-off flags, fail-closed behavior and no-Docker local compatibility. |
| Security/Privacy Review | `PENDING_EVIDENCE` | Provider privacy evidence, payload minimization, log hygiene, secret handling and incident controls. |
| IA Governance Review | `PENDING_EVIDENCE` | Evidence-first behavior, structured output, human-in-the-loop, model/prompt/schema pinning and eval plan. |
| Expert Board | `PENDING_EVIDENCE` | Business relevance, abstention/uncertainty semantics, payload whitelist, golden set scope and stop criteria. |
| Provider readiness | `PENDING_EVIDENCE` | Completed `policies/ai-provider-readiness-record-042a.md` for exact provider and exact model. |
| Dependency/security review | `PENDING_EVIDENCE` | Completed `policies/dependency-security-review-042a.md`, or explicit N/A justification if no new dependency is introduced. |
| Payload whitelist | `PENDING_EVIDENCE` | Signed whitelist based on `policies/ai-payload-whitelist-mapping-runtime-042a.md`. |
| Runbook | `PENDING_EVIDENCE` | Incident runbook updated for provider-runtime kill switch, fallback and privacy/cost/timeout/cross-tenant incidents. |
| Golden set | `PENDING_EVIDENCE` | `042a2` synthetic golden set green. |
| Contract readiness | `PENDING_EVIDENCE` | Explicit contract decision for abstention and uncertainty before any consuming code. |

## Gate before provider network activation

Provider network activation is a separate later gate. Passing the pre-code gate does not authorize a provider call.

Before any provider network call:

- all pre-code gates must remain satisfied;
- provider exact legal/vendor evidence must be attached;
- provider/model/region/retention/training/logging/cost/latency/quota evidence must be complete;
- secret management must be approved without repo secrets or `.env` dependency;
- provider-runtime flag must be proven default off;
- flag off must prove zero prompt, zero provider request, zero provider network, zero provider cost and zero provider log;
- no-provider fallback and manual mapping fallback must be proven;
- logs/metrics must be proven free of payloads, prompts, outputs, account labels, raw amounts, tenant/client/actor identities and secrets;
- golden set and validation checks must be green;
- no browser provider call may exist.

## Current blockers for `042b`

- `042b` provider code is blocked until the pre-code gates above are signed and merged.
- `042b` is blocked until the abstention/uncertainty contract decision is explicit.
- `042b` is blocked until provider and exact model evidence replaces `NON_DÉTERMINÉ`.
- `042b` is blocked until dependency/security is signed or N/A is explicitly justified.
- Provider network activation remains blocked even after `042b` code until the activation gate is signed.

