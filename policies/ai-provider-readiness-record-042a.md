# AI Provider Readiness Record - 042a

## Record identity

| Field | Value |
| --- | --- |
| Record id | `042a-ai-provider-readiness-record-v1` |
| Scope | Controlled AI mapping runtime pilot on synthetic demo data only. |
| Surface | `DOCS_GIT / AI_GOVERNANCE / SECURITY_PRIVACY` |
| Current status | `PENDING_EVIDENCE` |
| Current decision | OpenAI API is documented as a candidate provider only. Manual UI evidence proves account/project preflight and candidate exact model visibility, but this record authorizes no provider, executable model snapshot, SDK, dependency, secret, network call, prompt runtime or provider runtime capability. |

This record is intentionally incomplete. Every provider fact without repository evidence remains `NON_DÉTERMINÉ` or `PENDING_ACCOUNT_PROOF`.

## Manual OpenAI account preflight evidence - 042b0b

Evidence source: manual OpenAI Platform/API UI observation supplied for this docs-only record. No screenshot, full project URL, internal project id, API key, secret or `.env` value is recorded.

| Evidence item | Recorded value | Evidence status |
| --- | --- | --- |
| OpenAI Platform/API accessible | `PROUVÉ` | `PROUVÉ_PAR_UI_PLATFORM_MANUELLE` |
| Dedicated project | `ritomer-dev` | `PROUVÉ_PAR_UI_PLATFORM_MANUELLE` |
| Billing API enabled | `PROUVÉ` | `PROUVÉ_PAR_UI_PLATFORM_MANUELLE` |
| Credits added | `$10` | `PROUVÉ_PAR_UI_PLATFORM_MANUELLE` |
| Auto recharge | `OFF` | `PROUVÉ_PAR_UI_PLATFORM_MANUELLE` |
| Project spend limit | `$10` | `PROUVÉ_PAR_UI_PLATFORM_MANUELLE` |
| Spend alert | `100 % / $10` | `PROUVÉ_PAR_UI_PLATFORM_MANUELLE` |
| Project-authorized models | `gpt-5.4-mini`, `gpt-5.4-mini-2026-03-17` | `PROUVÉ_PAR_UI_PLATFORM_MANUELLE` |
| Candidate exactModelId / snapshot visible in project | `gpt-5.4-mini-2026-03-17` | `PROUVÉ_PAR_UI_PLATFORM_MANUELLE` |
| API key created | `NOT_CREATED_USER_CONFIRMED` | `USER_CONFIRMED` |
| API key shared | `NO` | `USER_CONFIRMED` |
| AI network call performed by Codex | `NON` | `PROUVÉ_PAR_EXECUTION_CODEX` |

API key created: `NOT_CREATED_USER_CONFIRMED`.
API key shared: `NO`.
The API key must be created only later, at the `gate reseau provider signe`, and must never be committed, pasted into a chat, transmitted to Codex, or stored in a committed `.env` file.

This evidence proves project visibility only. It does not make the candidate exactModelId executable. Execution remains blocked until the separate provider network gate is signed and all privacy, security, runtime, secret-management, quota, budget, kill-switch, log-hygiene, payload-whitelist and golden-set evidence is complete.

Candidate framing:

- Candidate provider: `OpenAI API`.
- Candidate endpoint: `/v1/chat/completions`.
- Candidate domain: `eu.api.openai.com`.
- Public candidate model name: `gpt-5.4-mini`.
- Candidate exact model id / snapshot visible in project: `gpt-5.4-mini-2026-03-17`.
- Exact model id visibility status: `PROUVÉ_PAR_UI_PLATFORM_MANUELLE`.
- No automatic fallback is allowed to an alias, another model, another region or another provider.
- The candidate framing does not authorize an executable dated snapshot. The visible snapshot remains non-executable until the separate provider network gate is signed.

Current repository state:

- `mapping-suggestion-v2` exists as a normalized Ritomer application read-model and preserves `mapping-suggestion-v1`.
- `mapping-suggestion-v1` remains unchanged; v2 does not cause any implicit v1 to v2 switch.
- A deterministic offline engine exists.
- A local synthetic-demo-only endpoint exists for `GET /api/closing-folders/{closingFolderId}/mappings/suggestions-v2`.
- A local simulation UI consumes the v2 read-model.
- No real provider, AI network call, provider secret, provider runtime or provider SDK exists.

## Readiness fields

| Readiness field | Current value | Evidence status | Requirement before provider code or activation |
| --- | --- | --- | --- |
| Provider logical name | `openai-api` candidate | `PENDING_EVIDENCE` | Stable local provider name to be confirmed by CPO, CTO, Security/Privacy and IA Governance. |
| Legal vendor name | `NON_DÉTERMINÉ` | `PENDING_EVIDENCE` | Legal contracting entity and vendor evidence attached. |
| Provider status | `CANDIDATE_BLOCKED` | `PENDING_EVIDENCE` | Runtime requires explicit human approval; no implicit approval from this draft. |
| Candidate API domain | `eu.api.openai.com` | `PENDING_ACCOUNT_PROOF` | Confirm domain availability and allowed use in the Ritomer OpenAI account/project before any network call. |
| Candidate endpoint | `/v1/chat/completions` | `PENDING_ACCOUNT_PROOF` | Test only after the provider network activation gate is signed. |
| Public candidate model name | `gpt-5.4-mini` authorized in project `ritomer-dev` | `PROUVÉ_PAR_UI_PLATFORM_MANUELLE` | Manual UI proof must still be reviewed in the signed gates before any runtime use. |
| exactModelId / exact snapshot | `gpt-5.4-mini-2026-03-17` visible in project `ritomer-dev` | `PROUVÉ_PAR_UI_PLATFORM_MANUELLE` | Candidate snapshot visibility is proven, but it is not executable until the separate provider network gate is signed. Aliases, auto-upgrade and unproved snapshots remain forbidden. |
| Automatic fallback | `FORBIDDEN` | `PENDING_EVIDENCE` | No fallback to aliases, other models, other regions or other providers without a new signed record. |
| OpenAI account/project | OpenAI Platform/API accessible; dedicated project `ritomer-dev` created | `PROUVÉ_PAR_UI_PLATFORM_MANUELLE` | Manual account/project evidence must be reviewed in the signed gates; no project URL or internal project id is recorded here. |
| OpenAI project region | `NON_DÉTERMINÉ` | `PENDING_ACCOUNT_PROOF` | Project must be created in `Europe EEA + Switzerland` or equivalent evidenced OpenAI region scope before any network call. |
| Processing region | `NON_DÉTERMINÉ` | `PENDING_ACCOUNT_PROOF` | Exact processing region and failover behavior required. |
| Storage region | `NON_DÉTERMINÉ` | `PENDING_EVIDENCE` | Exact provider-side storage region required. |
| Prompt retention | `NON_DÉTERMINÉ` | `PENDING_EVIDENCE` | Exact duration, deletion path and exceptions required. |
| Payload retention | `NON_DÉTERMINÉ` | `PENDING_EVIDENCE` | Exact duration, deletion path and exceptions required. |
| Output retention | `NON_DÉTERMINÉ` | `PENDING_EVIDENCE` | Exact duration, deletion path and exceptions required. |
| Log retention | `NON_DÉTERMINÉ` | `PENDING_EVIDENCE` | Provider log content, duration and access controls required. |
| Trace retention | `NON_DÉTERMINÉ` | `PENDING_EVIDENCE` | Provider trace content, sampling, duration and access controls required. |
| Training / non-training | `NON_DÉTERMINÉ` | `PENDING_EVIDENCE` | Proof that customer data and metadata are not used for training, or equivalent signed mechanism. |
| Provider logging | `NON_DÉTERMINÉ` | `PENDING_EVIDENCE` | Exact provider logging, debug logging, support logging and opt-out status required. |
| Support/debug access | `NON_DÉTERMINÉ` | `PENDING_EVIDENCE` | Who can access prompts/payloads/outputs, why, for how long and under which controls. |
| Subprocessors | `NON_DÉTERMINÉ` | `PENDING_EVIDENCE` | Current subprocessor list and change notification process required. |
| DPA/SCC or equivalent | `NON_DÉTERMINÉ` | `PENDING_EVIDENCE` | Signed DPA and transfer mechanism, or equivalent legal basis. |
| ZDR or MAM | `NON_DÉTERMINÉ` | `PENDING_EVIDENCE` | Zero Data Retention or Modified Abuse Monitoring must be reviewed and approved, with amendment if required. |
| `store=false` or equivalent | `NON_DÉTERMINÉ` | `PENDING_ACCOUNT_PROOF` | Confirm request storage behavior for `/v1/chat/completions` before any network call. |
| Tools disabled | `REQUIRED` | `PENDING_EVIDENCE` | No OpenAI tools may be enabled for this pilot request shape. |
| Excluded OpenAI capabilities | `REQUIRED` | `PENDING_EVIDENCE` | No web search, file search, code interpreter, MCP, batch, fine-tuning or RAG. |
| Deletion process | `NON_DÉTERMINÉ` | `PENDING_EVIDENCE` | Request path, SLA, deletion scope and exceptions required. |
| Deletion evidence | `NON_DÉTERMINÉ` | `PENDING_EVIDENCE` | Vendor confirmation or audit evidence required. |
| Incident process | `NON_DÉTERMINÉ` | `PENDING_EVIDENCE` | Provider incident workflow, escalation channel and customer action path required. |
| Incident notification delay | `NON_DÉTERMINÉ` | `PENDING_EVIDENCE` | Contractual notification delay required. |
| Encryption in transit | `NON_DÉTERMINÉ` | `PENDING_EVIDENCE` | Protocol and minimum encryption controls required. |
| Encryption at rest | `NON_DÉTERMINÉ` | `PENDING_EVIDENCE` | Provider at-rest encryption controls required. |
| Billing and cost limits | Billing API enabled; credits `$10`; auto recharge `OFF`; project spend limit `$10`; spend alert `100 % / $10` | `PROUVÉ_PAR_UI_PLATFORM_MANUELLE` | Runtime cost thresholds, hard-stop behavior, per-request/per-batch caps and owner response remain required before any network call. |
| Latency limits | `NON_DÉTERMINÉ` | `PENDING_EVIDENCE` | Timeout, p50/p95 target and fallback threshold required. |
| Quotas | `NON_DÉTERMINÉ` | `PENDING_ACCOUNT_PROOF` | Real project RPM/TPM quotas, rate limits, retry budget and backoff policy required. |
| Kill switch | `PENDING_TEST` | `PENDING_EVIDENCE` | Provider-runtime kill switch must be tested before first network call. |
| Internal log hygiene | `PENDING_TEST` | `PENDING_EVIDENCE` | Internal logs must exclude prompts, payloads, outputs, headers, secrets, internal tenant labels and account labels. |
| Golden set and evals | `PENDING_GREEN` | `PENDING_EVIDENCE` | Golden set and evals must be green before any user exposure. |
| Internal escalation contacts | `NON_DÉTERMINÉ` | `PENDING_EVIDENCE` | IA owner, security/privacy owner, platform owner and CPO/CTO path required. |
| Provider escalation contacts | `NON_DÉTERMINÉ` | `PENDING_EVIDENCE` | Provider support/security contact and incident channel required. |

## Approval placeholders

These placeholders do not constitute approvals or signatures.

| Role | Expected evidence | Current status |
| --- | --- | --- |
| CPO | Product approval for synthetic-demo-only provider pilot. | `PENDING_EVIDENCE` |
| CTO | Runtime architecture, flags, failure mode and operational gate approval. | `PENDING_EVIDENCE` |
| Security/Privacy | Provider, logging, retention, DPA/SCC, deletion, incident and secret handling review. | `PENDING_EVIDENCE` |
| IA Governance | Model/prompt/schema pinning, evals, fallback and human-in-the-loop review. | `PENDING_EVIDENCE` |
| Expert Board | Business relevance, v2 outcomes/reason codes, whitelist and golden set review. | `PENDING_EVIDENCE` |

## Network activation boundary

This record does not authorize network activation.

Before the first provider network call:

- CPO, CTO, Security/Privacy, IA Governance and Expert Board gates must be signed;
- the manual Ritomer OpenAI account/project evidence must be reviewed without recording a full project URL or internal project id;
- the OpenAI project must be created in `Europe EEA + Switzerland` or an evidenced equivalent region scope;
- the candidate domain `eu.api.openai.com` must be confirmed for the Ritomer project;
- DPA/SCC/subprocessors must be reviewed and archived;
- ZDR or MAM must be approved, with ZDR amendment if required;
- model availability proof in the Ritomer project must be reviewed and accepted in the gate evidence;
- candidate exactModelId visibility is manually proven as `gpt-5.4-mini-2026-03-17`, but it must still be pinned in the signed network gate before execution;
- `/v1/chat/completions` may be tested only after the separate network activation gate;
- OpenAI tools must be disabled;
- `store=false` or equivalent request-storage behavior must be confirmed;
- web search, file search, code interpreter, MCP, batch, fine-tuning and RAG must remain excluded;
- real project RPM/TPM quotas and rate limits must be recorded;
- a hard budget cap and hard stop behavior must be proven;
- the kill switch must be tested;
- internal logs must be proven free of prompts, payloads, outputs, headers, secrets, internal tenant labels and account labels;
- an authoritative golden set and evals must be green before user exposure;
- all remaining `NON_DÉTERMINÉ` provider fields above must be replaced by evidenced values;
- the provider-runtime flag must be proven default off;
- the activation gate must prove zero provider request when flags are off;
- secrets must come only from approved runtime configuration or secret management;
- no secret, `.env` value, token, cookie, DSN or credential may be committed, read by Codex or logged;
- payload whitelist and runbook must be signed and current;
- `mapping-suggestion-v1` must remain unchanged, and any v2 runtime binding must stay explicit without implicit switch.
