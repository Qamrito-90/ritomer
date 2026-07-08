# AI Runtime Gates Record - 042a

## Record identity

| Field | Value |
| --- | --- |
| Record id | `042a-ai-runtime-gates-record-v1` |
| Scope | Gate pack draft for the controlled AI mapping runtime pilot. |
| Surface | `DOCS_GIT / AI_GOVERNANCE` |
| Current status | `PENDING_EVIDENCE` |
| Current decision | OpenAI API is documented as a candidate provider only. Manual UI evidence proves account/project preflight, security/privacy UI observations, candidate exact model visibility and a failed non-conclusive local canary. This record authorizes no executable model snapshot, dependency, prompt runtime, golden set update, validator, metrics, secret, network PASS or provider runtime code. |

This draft is not a signature. It records the evidence still required before any `042b` provider code and before any later provider network activation.

## Boundary

`042a1` prepares governance/readiness drafts only.

- OpenAI API is recorded only as a candidate provider for future review.
- `gpt-5.4-mini` is recorded as a public candidate model name visible in the OpenAI project.
- `gpt-5.4-mini-2026-03-17` is recorded as a candidate exactModelId / snapshot visible in the OpenAI project by manual UI evidence.
- The candidate exactModelId is not executable and is not selected for runtime activation by this record.
- No runtime prompt is created.
- No golden set, validator or metrics artifact is created.
- No backend, frontend, DB, OpenAPI, CI, SDK, dependency or runtime code is changed.
- No secret, `.env`, token, cookie, DSN or credential is read or required.
- This docs-only closure performs no provider call or AI network call.
- The `042b1a` local canary attempt is recorded as `FAILED_NON_CONCLUSIVE`, with no HTTP 200, no model returned, no provider usage validated and no network PASS.
- No spec `043` is created.

## Manual OpenAI Platform/API preflight evidence - 042b0b / 042b0c / 042b1a

This docs-only update records manual UI evidence from the OpenAI Platform/API account:

- OpenAI Platform/API accessible: `PROUVÉ`.
- Dedicated project created: `ritomer-dev`.
- Billing API enabled: `PROUVÉ`.
- Credits added: `$10`.
- Auto recharge: `OFF`.
- Project spend limit: `$10`.
- Spend alert: `100 % / $10`.
- Project-authorized models: `gpt-5.4-mini`, `gpt-5.4-mini-2026-03-17`.
- Candidate exactModelId / snapshot visible in project: `gpt-5.4-mini-2026-03-17`.
- Active API keys visible before canary: `0`.
- API key status before canary: `NOT_CREATED_USER_CONFIRMED`.
- Temporary API key for canary: `CREATED_MANUALLY_THEN_REVOKED`.
- API keys active after revocation: `0`.
- API key shared with ChatGPT/Codex/GitHub: `NO`.
- Usage API: `$0.00`.
- Total requests: `0`.
- Total tokens: `0`.
- Data controls visible: `PROUVÉ`.
- API call logging: `ENABLED_PER_CALL_UI_OBSERVED`.
- Audit logging: `NOT_ENABLED_UI_OBSERVED`.
- Hosted tools controls: `NON_DÉTERMINÉ`.
- Sharing controls: `NON_DÉTERMINÉ`.
- Any future API key creation is deferred to a new formal network or retry gate; the key must never be committed, pasted into a chat, transmitted to Codex, or stored in a committed `.env` file.
- No AI network call was performed by Codex for this closure.

This evidence does not authorize provider runtime code or a provider network call. The separate network gate remains required before any retry against `/v1/chat/completions`.

## Local OpenAI canary attempt - 042b1a

This docs-only record documents a user-supplied local canary outcome. It does not include any API key value, request header, raw provider response, screenshot, payload body or command output containing secrets. Codex did not read a secret and did not relaunch a network call.

Planned request:

- endpoint: `POST /v1/chat/completions`;
- host: `api.openai.com`;
- model: `gpt-5.4-mini-2026-03-17`;
- payload: public, non-business, non-Ritomer, non-client;
- `store=false` planned;
- no tools planned.

Result:

- first attempt: `FAIL NON_HTTP / ArgumentException`;
- second attempt: `FAIL NON_HTTP / RuntimeException`;
- HTTP 200 obtained: `NO`;
- model returned: `NO`;
- provider usage validated: `NO`;
- network PASS established: `NO`.

Security evidence:

- temporary API key created manually then revoked;
- API keys active after revocation: `0`;
- usage dashboard: `$0.00`;
- total requests: `0`;
- total tokens: `0`;
- secret shared with ChatGPT/Codex/GitHub: `NO`;
- `.env` file created or modified: `NO`;
- commit or repository file modified by canary: `NO`;
- sensitive payload sent: `NO`;
- Ritomer data sent: `NO`;
- client data sent: `NO`.

Decision:

- canary status: `FAILED_NON_CONCLUSIVE`;
- provider network activation: `STILL_BLOCKED`;
- `042b` provider runtime: `STILL_BLOCKED`;
- no third attempt is authorized by this record;
- any future attempt requires a new formal network gate or explicit retry gate.

Official OpenAI documentation reminders for the future gate:

- `https://developers.openai.com/api/docs/guides/your-data` documents that data sent to the OpenAI API is not used to train or improve OpenAI models unless explicitly opted in.
- The same OpenAI data controls page documents default abuse monitoring logs retained up to 30 days, and documents `/v1/chat/completions` as `No` for training use, `30 days` for abuse monitoring retention, and Zero Data Retention eligible with limitations.
- The same page documents `eu.api.openai.com` for `Europe (EEA + Switzerland)`, with `/v1/chat/completions` supported for storage and processing, and marks the region as requiring MAM or ZDR.
- `https://help.openai.com/en/articles/8264644-how-can-i-set-up-prepaid-billing` documents prepaid API billing as pre-purchased API usage and documents Auto recharge setup; Ritomer manual evidence records auto recharge as `OFF`.
- `https://help.openai.com/en/articles/9687866-admin-and-audit-logs-api-for-the-api-platform` documents API Platform audit logging capabilities and enablement from Data controls; Ritomer manual evidence records audit logging as `NOT_ENABLED_UI_OBSERVED`.

These official documentation reminders and the failed `042b1a` canary do not decide DPA/SCC/subprocessors, ZDR or MAM, `store=false` behavior for the Ritomer project, effective project region, processing/storage region, retention, support/debug access, deletion process, incident notification process, real runtime quotas, kill switch, runtime log hygiene, authoritative golden set status or canary retry protocol. Those items remain blocked before any provider network activation.

Current repository state:

- `mapping-suggestion-v2` exists as a normalized Ritomer application read-model.
- The deterministic offline engine exists for local candidate evaluation and local simulation.
- `GET /api/closing-folders/{closingFolderId}/mappings/suggestions-v2` exists only as a local synthetic-demo-only, read-only endpoint guarded by profile `local`, default-off flag and immutable demo allowlist.
- A local frontend simulation consumes the v2 read-model without creating a decision endpoint, auto-apply, bulk apply or implicit v1 switch.
- `mapping-suggestion-v1` remains unchanged and keeps serving the existing no-provider suggestion review flow.
- No real provider, provider SDK, provider runtime, successful AI network call, secret or `.env` dependency exists for `042b0` / `042b1a`.
- The `042b1a` canary did not establish HTTP 200, model return, provider usage validation or network PASS.

## Existing state versus target state

| Area | Exists now | Required before `042b` code | Required before provider network activation |
| --- | --- | --- | --- |
| Mapping suggestions | `030` no-provider v1 suggestions, `mapping-suggestion-v2` normalized read-model, deterministic offline engine, local synthetic-demo-only endpoint and local simulation UI exist. | Preserve v1, v2 separation, no-provider path and manual mapping authority. | Prove fallback to no-provider then manual mapping after provider failure. |
| Feature flag | `ritomer.ai.mapping-suggestions.enabled` exists in backend code. | A dedicated provider-runtime flag is required but not verified as existing. | Provider-runtime flag must be default off and kill-switchable. |
| Provider | No real provider exists. The `042b1a` canary is `FAILED_NON_CONCLUSIVE`. | Provider-readiness record must be complete and carry required human validation for exact provider/model. | Activation gate must confirm allowed endpoint, secret handling and network controls. |
| Contract | `mapping-suggestion-v1` remains unchanged; `mapping-suggestion-v2` exists and preserves v1 without implicit switch. | Future provider-output consumer code must explicitly bind to the validated runtime contract/schema hash and must not reuse v1 implicitly. | Runtime output validation must match the validated contract and schema hash. |
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
- `042b` remains blocked by provider-readiness, required human signatures, exact model id gate review/pinning, privacy/legal evidence, quotas, budget cap, kill switch evidence, log hygiene, an authoritative green golden set and the separate network activation gate.

## Schema pinning evidence

Canonical schema source:

- Path: `contracts/ai/mapping-suggestion.schema.json`
- Algorithm: `SHA256`
- Command: `Get-FileHash -Algorithm SHA256 -LiteralPath 'contracts/ai/mapping-suggestion.schema.json'`
- Recalculated hash: `859073D97425F4EA44911AF3274FEA90C31A7CBF94010A38E61802232412C236`

This hash is evidence for the v1 contract only. Any future provider runtime binding must pin the exact selected contract and schema hash explicitly.

## Gate before `042b` provider code

All gates below are cumulative with the existing `030d` requirements. They must carry required human validation and be merged before any `042b` provider code starts.

| Gate | Current status | Evidence required |
| --- | --- | --- |
| CPO approval | `PENDING_EVIDENCE` | Product approval for a synthetic-demo-only runtime pilot and no production/customer data. |
| CTO Gate | `PENDING_EVIDENCE` | Backend-only gateway architecture, no microservice, no GraphQL, no RAG, no vector store, default-off flags, fail-closed behavior and no-Docker local compatibility. |
| Security/Privacy Review | `PENDING_EVIDENCE` | Provider privacy evidence, payload minimization, log hygiene, secret handling and incident controls. |
| IA Governance Review | `PENDING_EVIDENCE` | Evidence-first behavior, structured output, human-in-the-loop, model/prompt/schema pinning and eval plan. |
| Expert Board | `PENDING_EVIDENCE` | Business relevance, v2 outcomes/reason codes, payload whitelist, golden set scope and stop criteria. |
| Provider readiness | `PENDING_EVIDENCE` | Completed `policies/ai-provider-readiness-record-042a.md` for exact provider and exact model. Current exactModelId visibility is manual UI evidence only and remains non-executable. |
| Dependency/security review | `PENDING_N/A_JUSTIFICATION` | Completed `policies/dependency-security-review-042a.md`, or explicit N/A justification if no new dependency is introduced. |
| Payload whitelist | `PENDING_EVIDENCE` | Human-validated whitelist based on `policies/ai-payload-whitelist-mapping-runtime-042a.md`. |
| Runbook | `PENDING_EVIDENCE` | Incident runbook updated for provider-runtime kill switch, fallback and privacy/cost/timeout/cross-tenant incidents. |
| Golden set | `PENDING_EVIDENCE` | `042a2` synthetic golden set green. |
| Contract readiness | `PENDING_EVIDENCE` | Explicit provider-output contract binding, schema hash pinning, v1 preservation and no implicit v1 to v2 switch. |

## Gate before provider network activation

Provider network activation is a separate later gate. Passing the pre-code gate does not authorize a provider call. The `042b1a` canary is recorded as `FAILED_NON_CONCLUSIVE` and does not satisfy this gate.

Before any further provider network call:

- all pre-code gates must remain satisfied;
- CPO, CTO, Security/Privacy, IA Governance and Expert Board gates must carry human signatures;
- Ritomer OpenAI account/project must be identified;
- OpenAI project must be created in `Europe EEA + Switzerland` or an evidenced equivalent region scope;
- candidate domain `eu.api.openai.com` must be confirmed;
- candidate endpoint `/v1/chat/completions` must not be retried until a new formal network gate or explicit retry gate exists;
- API key creation must happen only at the controlled network test or retry gate, with no key committed, transmitted to Codex, pasted into a chat or stored in a committed `.env` file;
- provider exact legal/vendor evidence must be attached;
- provider/model/region/retention/training/logging/cost/latency/quota evidence must be complete;
- model availability in the Ritomer project must be reviewed from the manual UI evidence and accepted in the gate evidence;
- candidate exactModelId visibility is manually proven as `gpt-5.4-mini-2026-03-17`, but it must still be pinned in the network gate before execution; public model name `gpt-5.4-mini` is not enough;
- no automatic fallback to alias, another model, another region or another provider may exist;
- DPA/SCC/subprocessors must be reviewed and archived;
- ZDR or MAM must be resolved, with ZDR amendment if required;
- OpenAI tools must be disabled;
- `store=false` or equivalent request-storage behavior must be confirmed;
- web search, file search, code interpreter, MCP, batch, fine-tuning and RAG must remain excluded;
- real project RPM/TPM quotas and rate limits must be documented;
- hard budget cap and hard stop behavior must be in place;
- secret management must be validated without repo secrets or `.env` dependency;
- provider-runtime flag must be proven default off;
- flag off must prove zero prompt, zero provider request, zero provider network, zero provider cost and zero provider log;
- no-provider fallback and manual mapping fallback must be proven;
- kill switch must be tested;
- logs/metrics must be proven free of payloads, prompts, outputs, headers, account labels, raw amounts, internal tenant labels, tenant/client/actor identities and secrets;
- authoritative golden set and validation checks must be green;
- canary retry protocol must be corrected;
- no browser provider call may exist.

## Current blockers for `042b`

- `042b` provider code is blocked until the pre-code gates above carry required human validation and are merged.
- `042b` is blocked until provider-readiness is complete for the candidate provider and exact model id.
- `042b` is blocked until OpenAI account/project, domain, endpoint, project region, DPA/SCC/subprocessors, ZDR or MAM, privacy, retention, logging, RPM/TPM quotas and budget cap evidence are complete.
- `042b` is blocked until the manual exactModelId evidence is reviewed in the gates and all remaining provider, privacy/legal, quota, budget, kill switch, log hygiene and golden set evidence replaces `NON_DÉTERMINÉ` / `PENDING_ACCOUNT_PROOF`.
- `042b` is blocked until kill switch, log hygiene and the authoritative golden set are proven green.
- `042b` is blocked until dependency/security is completed or N/A is explicitly justified.
- `042b` is blocked until the canary retry protocol is corrected.
- Provider network activation remains blocked even after `042b` code until the activation gate is formally valid.

Maintained blockers after `042b1a`:

- DPA/SCC/subprocessors.
- ZDR or MAM.
- `store=false` or equivalent behavior confirmed for the project.
- Effective processing/storage region.
- Retention for prompts, payloads, outputs, logs and traces.
- Support/debug access.
- Deletion process.
- Incident notification.
- Real runtime quotas.
- Kill switch.
- Runtime log hygiene.
- Authoritative golden set.
- CPO/CTO/Security/IA Governance/Expert Board human signatures.
- Corrected canary retry protocol.
