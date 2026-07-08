# AI Provider Readiness Record - 042a

## Record identity

| Field | Value |
| --- | --- |
| Record id | `042a-ai-provider-readiness-record-v1` |
| Scope | Controlled AI mapping runtime pilot on synthetic demo data only. |
| Surface | `DOCS_GIT / AI_GOVERNANCE / SECURITY_PRIVACY` |
| Current status | `PENDING_EVIDENCE` |
| Current decision | OpenAI API is documented as a candidate provider only. Manual UI evidence proves account/project preflight, security/privacy UI observations, candidate exact model visibility and a non-conclusive local canary attempt. This record authorizes no provider, executable model snapshot, SDK, dependency, secret, network PASS, prompt runtime or provider runtime capability. |

This record is intentionally incomplete. Every provider fact without repository evidence remains `NON_DÉTERMINÉ`, `PENDING_EVIDENCE` or `PENDING_ACCOUNT_PROOF`.

## Manual OpenAI Platform/API preflight evidence - 042b0b / 042b0c / 042b1a

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
| Active API keys visible before canary | `0` | `PROUVÉ_PAR_UI_PLATFORM_MANUELLE` |
| API key status before canary | `NOT_CREATED_USER_CONFIRMED` | `USER_CONFIRMED` |
| Temporary API key for canary | `CREATED_MANUALLY_THEN_REVOKED` | `USER_CONFIRMED` |
| API keys active after revocation | `0` | `USER_CONFIRMED` |
| API key shared with ChatGPT/Codex/GitHub | `NO` | `USER_CONFIRMED` |
| Usage API | `$0.00` | `PROUVÉ_PAR_UI_PLATFORM_MANUELLE` |
| Total requests | `0` | `PROUVÉ_PAR_UI_PLATFORM_MANUELLE` |
| Total tokens | `0` | `PROUVÉ_PAR_UI_PLATFORM_MANUELLE` |
| Data controls visible | `PROUVÉ` | `PROUVÉ_PAR_UI_PLATFORM_MANUELLE` |
| API call logging | `ENABLED_PER_CALL_UI_OBSERVED` | `PROUVÉ_PAR_UI_PLATFORM_MANUELLE` |
| Audit logging | `NOT_ENABLED_UI_OBSERVED` | `PROUVÉ_PAR_UI_PLATFORM_MANUELLE` |
| Hosted tools controls | `NON_DÉTERMINÉ` | `PENDING_EVIDENCE` |
| Sharing controls | `NON_DÉTERMINÉ` | `PENDING_EVIDENCE` |
| AI network call performed by Codex for this closure | `NO` | `PROUVÉ_PAR_EXECUTION_CODEX` |

API key status before canary: `NOT_CREATED_USER_CONFIRMED`.
Temporary API key for canary: `CREATED_MANUALLY_THEN_REVOKED`.
API key shared with ChatGPT/Codex/GitHub: `NO`.
API keys active after revocation: `0`.
Any future API key must be created only under a new formal network or retry gate, and must never be committed, pasted into a chat, transmitted to Codex, or stored in a committed `.env` file.

The OpenAI API prepaid credits are recorded as provider-account budget evidence only. They are separate from Ritomer runtime execution because no provider runtime, secret, SDK, adapter or network call exists. Auto recharge remains `OFF`.

This evidence proves project visibility, manually observed UI controls and a failed non-conclusive local canary only. It does not make the candidate exactModelId executable. Execution remains blocked until the separate provider network gate is formally valid and all privacy, security, runtime, secret-management, quota, budget, kill-switch, log-hygiene, payload-whitelist and golden-set evidence is complete.

Hosted tools, sharing settings and data controls are recorded only where visible above. Any setting not explicitly listed remains `NON_DÉTERMINÉ` or `PENDING_EVIDENCE`.

Candidate framing:

- Candidate provider: `OpenAI API`.
- Candidate endpoint: `/v1/chat/completions`.
- Candidate domain: `eu.api.openai.com`.
- Local canary planned host for `042b1a`: `api.openai.com`.
- Public candidate model name: `gpt-5.4-mini`.
- Candidate exact model id / snapshot visible in project: `gpt-5.4-mini-2026-03-17`.
- Exact model id visibility status: `PROUVÉ_PAR_UI_PLATFORM_MANUELLE`.
- No automatic fallback is allowed to an alias, another model, another region or another provider.
- The candidate framing and `042b1a` canary attempt do not authorize an executable dated snapshot. The visible snapshot remains non-executable until the separate provider network gate is formally valid.

## Local OpenAI canary attempt - 042b1a

Evidence source: user-supplied local canary outcome for this docs-only closure. This record does not include any API key value, request header, raw provider response, screenshot, payload body or command output containing secrets. Codex did not read a secret and did not relaunch a network call.

Planned request:

| Field | Recorded value |
| --- | --- |
| Endpoint | `POST /v1/chat/completions` |
| Host | `api.openai.com` |
| Model | `gpt-5.4-mini-2026-03-17` |
| Payload class | Public, non-business, non-Ritomer, non-client |
| Storage parameter | `store=false` planned |
| Tools | None planned |

Observed result:

| Attempt | Result |
| --- | --- |
| First attempt | `FAIL NON_HTTP / ArgumentException` |
| Second attempt | `FAIL NON_HTTP / RuntimeException` |
| HTTP 200 obtained | `NO` |
| Model returned | `NO` |
| Provider usage validated | `NO` |
| Network PASS established | `NO` |

Security and post-revocation evidence:

| Evidence item | Recorded value |
| --- | --- |
| Temporary API key | `CREATED_MANUALLY_THEN_REVOKED` |
| API keys active after revocation | `0` |
| Usage dashboard | `$0.00` |
| Total requests | `0` |
| Total tokens | `0` |
| Secret shared with ChatGPT/Codex/GitHub | `NO` |
| `.env` file created or modified | `NO` |
| Commit or repository file modified by canary | `NO` |
| Sensitive payload sent | `NO` |
| Ritomer data sent | `NO` |
| Client data sent | `NO` |

Decision:

- Canary status: `FAILED_NON_CONCLUSIVE`.
- Provider network activation: `STILL_BLOCKED`.
- `042b` provider runtime: `STILL_BLOCKED`.
- No third attempt is authorized by this record.
- Any future attempt requires a new formal network gate or an explicit retry gate.

Maintained blockers:

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

## Official OpenAI source reminders

These public documentation reminders are not Ritomer approval evidence and do not replace legal/privacy review.

| Topic | Official OpenAI source | Record note |
| --- | --- | --- |
| API data use and retention | `https://developers.openai.com/api/docs/guides/your-data` | OpenAI documents that data sent to the OpenAI API is not used to train or improve OpenAI models unless explicitly opted in. The same page documents default abuse monitoring logs retained up to 30 days. |
| `/v1/chat/completions` retention table | `https://developers.openai.com/api/docs/guides/your-data` | The endpoint row documents `Data used for training = No`, `Abuse monitoring retention = 30 days`, `Application state retention = None, see exceptions`, and Zero Data Retention eligibility with limitations. |
| Zero Data Retention behavior | `https://developers.openai.com/api/docs/guides/your-data` | OpenAI documents that with Zero Data Retention enabled, the `store` parameter for `/v1/chat/completions` is always treated as `false`. Ritomer has not proven ZDR, MAM or equivalent behavior for this project. |
| Europe data residency | `https://developers.openai.com/api/docs/guides/your-data` | OpenAI documents `Europe (EEA + Switzerland)` with domain `eu.api.openai.com`, storage and processing support, and `/v1/chat/completions` support. The same table marks the region as requiring MAM or ZDR. Ritomer project region and processing/storage region remain unproven. |
| Prepaid billing and auto recharge | `https://help.openai.com/en/articles/8264644-how-can-i-set-up-prepaid-billing` | OpenAI documents prepaid API billing as pre-purchased API usage and describes Auto recharge setup. Ritomer manual evidence records auto recharge as `OFF`; this does not activate runtime. |
| API Platform audit logging | `https://help.openai.com/en/articles/9687866-admin-and-audit-logs-api-for-the-api-platform` | OpenAI documents Audit Log API capabilities and the data-controls path to enable audit logging. Ritomer manual evidence records audit logging as `NOT_ENABLED_UI_OBSERVED`. |

Current repository state:

- `mapping-suggestion-v2` exists as a normalized Ritomer application read-model and preserves `mapping-suggestion-v1`.
- `mapping-suggestion-v1` remains unchanged; v2 does not cause any implicit v1 to v2 switch.
- A deterministic offline engine exists.
- A local synthetic-demo-only endpoint exists for `GET /api/closing-folders/{closingFolderId}/mappings/suggestions-v2`.
- A local simulation UI consumes the v2 read-model.
- No real provider, successful AI network call, provider secret, provider runtime or provider SDK exists.
- The `042b1a` local canary attempt did not establish HTTP 200, model return, provider usage validation or network PASS.

## Readiness fields

| Readiness field | Current value | Evidence status | Requirement before provider code or activation |
| --- | --- | --- | --- |
| Provider logical name | `openai-api` candidate | `PENDING_EVIDENCE` | Stable local provider name to be confirmed by CPO, CTO, Security/Privacy and IA Governance. |
| Legal vendor name | `NON_DÉTERMINÉ` | `PENDING_EVIDENCE` | Legal contracting entity and vendor evidence attached. |
| Provider status | `CANDIDATE_BLOCKED` | `PENDING_EVIDENCE` | Runtime requires explicit human approval; no implicit approval from this draft. |
| Candidate API domain | `eu.api.openai.com`, officially documented for `Europe (EEA + Switzerland)` | `OFFICIAL_DOCS_REVIEWED / PENDING_ACCOUNT_PROOF` | Confirm project region, domain availability and allowed use in the Ritomer OpenAI account/project before any network call. |
| Candidate endpoint | `/v1/chat/completions`, officially documented as supported for `eu.api.openai.com` | `OFFICIAL_DOCS_REVIEWED / PENDING_ACCOUNT_PROOF` | Test again only after a new formal network gate or explicit retry gate. |
| `042b1a` canary host | `api.openai.com` | `USER_CONFIRMED_NON_CONCLUSIVE` | Recorded as attempted local host only; it does not replace the future region/domain evidence requirement. |
| `042b1a` canary result | `FAILED_NON_CONCLUSIVE` | `USER_CONFIRMED_NON_CONCLUSIVE` | No HTTP 200, model return, provider usage validation or network PASS. |
| Public candidate model name | `gpt-5.4-mini` authorized in project `ritomer-dev` | `PROUVÉ_PAR_UI_PLATFORM_MANUELLE` | Manual UI proof must still be reviewed in the formal gates before any runtime use. |
| exactModelId / exact snapshot | `gpt-5.4-mini-2026-03-17` visible in project `ritomer-dev` | `PROUVÉ_PAR_UI_PLATFORM_MANUELLE` | Candidate snapshot visibility is proven, but it is not executable until the separate provider network gate is formally valid. Aliases, auto-upgrade and unproved snapshots remain forbidden. |
| Automatic fallback | `FORBIDDEN` | `PENDING_EVIDENCE` | No fallback to aliases, other models, other regions or other providers without a new formal record. |
| OpenAI account/project | OpenAI Platform/API accessible; dedicated project `ritomer-dev` created | `PROUVÉ_PAR_UI_PLATFORM_MANUELLE` | Manual account/project evidence must be reviewed in the formal gates; no project URL or internal project id is recorded here. |
| OpenAI project region | `NON_DÉTERMINÉ` | `PENDING_ACCOUNT_PROOF` | Project must be created in `Europe EEA + Switzerland` or equivalent evidenced OpenAI region scope before any network call. |
| Processing region | `NON_DÉTERMINÉ` | `PENDING_ACCOUNT_PROOF` | Exact processing region and failover behavior required. |
| Storage region | `NON_DÉTERMINÉ` | `PENDING_EVIDENCE` | Exact provider-side storage region required. |
| Prompt retention | `NON_DÉTERMINÉ` | `PENDING_EVIDENCE` | Exact duration, deletion path and exceptions required. |
| Payload retention | `NON_DÉTERMINÉ` | `PENDING_EVIDENCE` | Exact duration, deletion path and exceptions required. |
| Output retention | `NON_DÉTERMINÉ` | `PENDING_EVIDENCE` | Exact duration, deletion path and exceptions required. |
| Log retention | `NON_DÉTERMINÉ` | `PENDING_EVIDENCE` | Provider log content, duration and access controls required. |
| Trace retention | `NON_DÉTERMINÉ` | `PENDING_EVIDENCE` | Provider trace content, sampling, duration and access controls required. |
| Training / non-training | Official docs state `/v1/chat/completions` data used for training: `No`; Ritomer-specific legal/privacy decision remains `NON_DÉTERMINÉ`. | `OFFICIAL_DOCS_REVIEWED / PENDING_PRIVACY_REVIEW` | Proof that customer data and metadata are not used for training, or equivalent reviewed mechanism, still required before network activation. |
| Provider logging | Data controls visible; API call logging `ENABLED_PER_CALL_UI_OBSERVED`; audit logging `NOT_ENABLED_UI_OBSERVED`; no API usage observed after `042b1a`. | `PROUVÉ_PAR_UI_PLATFORM_MANUELLE / PENDING_RUNTIME_EVIDENCE` | Exact provider logging, debug logging, support logging, retention, access controls and opt-out status required. |
| Support/debug access | `NON_DÉTERMINÉ` | `PENDING_EVIDENCE` | Who can access prompts/payloads/outputs, why, for how long and under which controls. |
| Subprocessors | `NON_DÉTERMINÉ` | `PENDING_EVIDENCE` | Current subprocessor list and change notification process required. |
| DPA/SCC or equivalent | `NON_DÉTERMINÉ` | `PENDING_EVIDENCE` | Executed DPA and transfer mechanism, or equivalent legal basis. |
| ZDR or MAM | `NON_DÉTERMINÉ` | `PENDING_EVIDENCE` | Zero Data Retention or Modified Abuse Monitoring must be reviewed and resolved, with amendment if required. |
| `store=false` or equivalent | `NON_DÉTERMINÉ` | `PENDING_ACCOUNT_PROOF` | Confirm request storage behavior for `/v1/chat/completions` before any network call. |
| Tools disabled | `REQUIRED` | `PENDING_EVIDENCE` | No OpenAI tools may be enabled for this pilot request shape. |
| Excluded OpenAI capabilities | `REQUIRED` | `PENDING_EVIDENCE` | No web search, file search, code interpreter, MCP, batch, fine-tuning or RAG. |
| Deletion process | `NON_DÉTERMINÉ` | `PENDING_EVIDENCE` | Request path, SLA, deletion scope and exceptions required. |
| Deletion evidence | `NON_DÉTERMINÉ` | `PENDING_EVIDENCE` | Vendor confirmation or audit evidence required. |
| Incident process | `NON_DÉTERMINÉ` | `PENDING_EVIDENCE` | Provider incident workflow, escalation channel and customer action path required. |
| Incident notification delay | `NON_DÉTERMINÉ` | `PENDING_EVIDENCE` | Contractual notification delay required. |
| Encryption in transit | `NON_DÉTERMINÉ` | `PENDING_EVIDENCE` | Protocol and minimum encryption controls required. |
| Encryption at rest | `NON_DÉTERMINÉ` | `PENDING_EVIDENCE` | Provider at-rest encryption controls required. |
| Billing and cost limits | Billing API enabled; credits `$10`; auto recharge `OFF`; project spend limit `$10`; spend alert `100 % / $10`; usage API `$0.00`; total requests `0`; total tokens `0` after `042b1a` | `PROUVÉ_PAR_UI_PLATFORM_MANUELLE` | Runtime cost thresholds, hard-stop behavior, per-request/per-batch caps and owner response remain required before any network call. |
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

This record does not authorize network activation. The `042b1a` canary status is `FAILED_NON_CONCLUSIVE`, with provider network activation and `042b` provider runtime still blocked.

Before any further provider network call:

- CPO, CTO, Security/Privacy, IA Governance and Expert Board gates must carry human signatures;
- the manual Ritomer OpenAI account/project evidence must be reviewed without recording a full project URL or internal project id;
- the OpenAI project must be created in `Europe EEA + Switzerland` or an evidenced equivalent region scope;
- the candidate domain `eu.api.openai.com` must be confirmed for the Ritomer project;
- DPA/SCC/subprocessors must be reviewed and archived;
- ZDR or MAM must be resolved, with ZDR amendment if required;
- model availability proof in the Ritomer project must be reviewed and accepted in the gate evidence;
- candidate exactModelId visibility is manually proven as `gpt-5.4-mini-2026-03-17`, but it must still be pinned in the formal network gate before execution;
- `/v1/chat/completions` may be tested again only after a new formal network gate or explicit retry gate;
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
- secrets must come only from validated runtime configuration or secret management;
- no secret, `.env` value, token, cookie, DSN or credential may be committed, read by Codex or logged;
- payload whitelist and runbook must carry required human validation and remain current;
- canary retry protocol must be corrected before any retry;
- `mapping-suggestion-v1` must remain unchanged, and any v2 runtime binding must stay explicit without implicit switch.
