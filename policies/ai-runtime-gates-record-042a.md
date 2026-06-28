# AI Runtime Gates Record - 042a

## Record identity

| Field | Value |
| --- | --- |
| Record id | `042a-ai-runtime-gates-record-v1` |
| Scope | Gate pack draft for the controlled AI mapping runtime pilot. |
| Surface | `DOCS_GIT / AI_GOVERNANCE` |
| Current status | `PENDING_EVIDENCE` |
| Current decision | OpenAI API is documented as a candidate provider only. This record authorizes no exact model snapshot, dependency, prompt runtime, golden set update, validator, metrics, secret, network call or provider runtime code. |

This draft is not a signature. It records the evidence still required before any `042b` provider code and before any later provider network activation.

## Boundary

`042a1` prepares governance/readiness drafts only.

- OpenAI API is recorded only as a candidate provider for future review.
- `gpt-5.4-mini` is recorded only as a public candidate model name.
- No exact model id or dated model snapshot is selected.
- No runtime prompt is created.
- No golden set, validator or metrics artifact is created.
- No backend, frontend, DB, OpenAPI, CI, SDK, dependency or runtime code is changed.
- No secret, `.env`, token, cookie, DSN or credential is read or required.
- No provider call or AI network call is made.
- No spec `043` is created.

Current repository state:

- `mapping-suggestion-v2` exists as a normalized Ritomer application read-model.
- The deterministic offline engine exists for local candidate evaluation and local simulation.
- `GET /api/closing-folders/{closingFolderId}/mappings/suggestions-v2` exists only as a local synthetic-demo-only, read-only endpoint guarded by profile `local`, default-off flag and immutable demo allowlist.
- A local frontend simulation consumes the v2 read-model without creating a decision endpoint, auto-apply, bulk apply or implicit v1 switch.
- `mapping-suggestion-v1` remains unchanged and keeps serving the existing no-provider suggestion review flow.
- No real provider, provider SDK, provider runtime, AI network call, secret or `.env` dependency exists for `042b0`.

## Existing state versus target state

| Area | Exists now | Required before `042b` code | Required before provider network activation |
| --- | --- | --- | --- |
| Mapping suggestions | `030` no-provider v1 suggestions, `mapping-suggestion-v2` normalized read-model, deterministic offline engine, local synthetic-demo-only endpoint and local simulation UI exist. | Preserve v1, v2 separation, no-provider path and manual mapping authority. | Prove fallback to no-provider then manual mapping after provider failure. |
| Feature flag | `ritomer.ai.mapping-suggestions.enabled` exists in backend code. | A dedicated provider-runtime flag is required but not verified as existing. | Provider-runtime flag must be default off and kill-switchable. |
| Provider | No real provider exists. | Provider-readiness record must be complete and signed for exact provider/model. | Activation gate must confirm allowed endpoint, secret handling and network controls. |
| Contract | `mapping-suggestion-v1` remains unchanged; `mapping-suggestion-v2` exists and preserves v1 without implicit switch. | Future provider-output consumer code must explicitly bind to the signed runtime contract/schema hash and must not reuse v1 implicitly. | Runtime output validation must match the signed contract and schema hash. |
| Golden set | `030c` golden set exists; `042a2` candidate sets remain non-authoritative. | An authoritative synthetic golden set must be created and green before provider runtime. | Authoritative golden set must be green with provider-runtime checks before activation. |
| Runbook | IA incident runbook exists. | Runbook must cover provider-runtime kill switch and incidents. | Runbook must be validated with activation evidence. |

## Contract readiness check

Read-only check performed against:

- `contracts/ai/mapping-suggestion.schema.json`
- `contracts/ai/mapping-suggestion-v2.schema.json`
- `contracts/openapi/mapping-suggestions-api.yaml`
- `contracts/openapi/mapping-suggestions-v2-api.yaml`

Result:

- `mapping-suggestion-v1` still requires `suggestedTargetCode`; it remains unchanged.
- `mapping-suggestion-v2` now carries normalized Ritomer outcomes `SUGGESTION`, `ABSTENTION`, `POLICY_BLOCK`, `PRECONDITION_BLOCK` and `TECHNICAL_DEGRADATION`.
- The v2 OpenAPI exposes only the local default-off synthetic-demo endpoint; it is not a real provider endpoint and does not authorize a provider network call.
- There is no implicit switch from v1 to v2.

Decision:

- No contract is modified by this hardening pass.
- `042b` is not blocked by missing v1 semantics: v2 exists and preserves v1.
- `042b` remains blocked by provider-readiness, required human signatures, exact model id proof, privacy/legal evidence, quotas, budget cap, kill switch evidence, log hygiene, an authoritative green golden set and the separate network activation gate.

## Schema pinning evidence

Canonical schema source:

- Path: `contracts/ai/mapping-suggestion.schema.json`
- Algorithm: `SHA256`
- Command: `Get-FileHash -Algorithm SHA256 -LiteralPath 'contracts/ai/mapping-suggestion.schema.json'`
- Recalculated hash: `859073D97425F4EA44911AF3274FEA90C31A7CBF94010A38E61802232412C236`

This hash is evidence for the v1 contract only. Any future provider runtime binding must pin the exact selected contract and schema hash explicitly.

## Gate before `042b` provider code

All gates below are cumulative with the existing `030d` requirements. They must be signed and merged before any `042b` provider code starts.

| Gate | Current status | Evidence required |
| --- | --- | --- |
| CPO approval | `PENDING_EVIDENCE` | Product approval for a synthetic-demo-only runtime pilot and no production/customer data. |
| CTO Gate | `PENDING_EVIDENCE` | Backend-only gateway architecture, no microservice, no GraphQL, no RAG, no vector store, default-off flags, fail-closed behavior and no-Docker local compatibility. |
| Security/Privacy Review | `PENDING_EVIDENCE` | Provider privacy evidence, payload minimization, log hygiene, secret handling and incident controls. |
| IA Governance Review | `PENDING_EVIDENCE` | Evidence-first behavior, structured output, human-in-the-loop, model/prompt/schema pinning and eval plan. |
| Expert Board | `PENDING_EVIDENCE` | Business relevance, v2 outcomes/reason codes, payload whitelist, golden set scope and stop criteria. |
| Provider readiness | `PENDING_EVIDENCE` | Completed `policies/ai-provider-readiness-record-042a.md` for exact provider and exact model. |
| Dependency/security review | `PENDING_N/A_JUSTIFICATION` | Completed `policies/dependency-security-review-042a.md`, or explicit N/A justification if no new dependency is introduced. |
| Payload whitelist | `PENDING_EVIDENCE` | Signed whitelist based on `policies/ai-payload-whitelist-mapping-runtime-042a.md`. |
| Runbook | `PENDING_EVIDENCE` | Incident runbook updated for provider-runtime kill switch, fallback and privacy/cost/timeout/cross-tenant incidents. |
| Golden set | `PENDING_EVIDENCE` | `042a2` synthetic golden set green. |
| Contract readiness | `PENDING_EVIDENCE` | Explicit provider-output contract binding, schema hash pinning, v1 preservation and no implicit v1 to v2 switch. |

## Gate before provider network activation

Provider network activation is a separate later gate. Passing the pre-code gate does not authorize a provider call.

Before any provider network call:

- all pre-code gates must remain satisfied;
- CPO, CTO, Security/Privacy, IA Governance and Expert Board gates must be signed;
- Ritomer OpenAI account/project must be identified;
- OpenAI project must be created in `Europe EEA + Switzerland` or an evidenced equivalent region scope;
- candidate domain `eu.api.openai.com` must be confirmed;
- candidate endpoint `/v1/chat/completions` must remain untested until this network gate is signed;
- provider exact legal/vendor evidence must be attached;
- provider/model/region/retention/training/logging/cost/latency/quota evidence must be complete;
- model availability in the Ritomer project must be proven;
- `exactModelId` or exact snapshot must be proven and pinned; public model name `gpt-5.4-mini` is not enough;
- no automatic fallback to alias, another model, another region or another provider may exist;
- DPA/SCC/subprocessors must be reviewed and archived;
- ZDR or MAM must be approved, with ZDR amendment if required;
- OpenAI tools must be disabled;
- `store=false` or equivalent request-storage behavior must be confirmed;
- web search, file search, code interpreter, MCP, batch, fine-tuning and RAG must remain excluded;
- real project RPM/TPM quotas and rate limits must be documented;
- hard budget cap and hard stop behavior must be in place;
- secret management must be approved without repo secrets or `.env` dependency;
- provider-runtime flag must be proven default off;
- flag off must prove zero prompt, zero provider request, zero provider network, zero provider cost and zero provider log;
- no-provider fallback and manual mapping fallback must be proven;
- kill switch must be tested;
- logs/metrics must be proven free of payloads, prompts, outputs, headers, account labels, raw amounts, internal tenant labels, tenant/client/actor identities and secrets;
- authoritative golden set and validation checks must be green;
- no browser provider call may exist.

## Current blockers for `042b`

- `042b` provider code is blocked until the pre-code gates above are signed and merged.
- `042b` is blocked until provider-readiness is complete for the candidate provider and exact model id.
- `042b` is blocked until OpenAI account/project, domain, endpoint, project region, DPA/SCC/subprocessors, ZDR or MAM, privacy, retention, logging, RPM/TPM quotas and budget cap evidence are complete.
- `042b` is blocked until provider and exact model evidence replaces `NON_DÉTERMINÉ` / `PENDING_ACCOUNT_PROOF`.
- `042b` is blocked until kill switch, log hygiene and the authoritative golden set are proven green.
- `042b` is blocked until dependency/security is completed or N/A is explicitly justified.
- Provider network activation remains blocked even after `042b` code until the activation gate is signed.
