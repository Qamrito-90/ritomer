# AI Provider Readiness Record - 030d1

## Record identity

| Field | Value |
| --- | --- |
| Record id | `030d1-ai-provider-readiness-record-and-dependency-review-v1` |
| Scope | Future AI provider use for assisted mapping suggestions only. Docs-only readiness record; no runtime activation. |
| Surface | `DOCS_ONLY / SECURITY_PRIVACY / IA_GOVERNANCE / DEPENDENCY_REVIEW` |
| Possible status | `DRAFT` / `PENDING_EVIDENCE` / `SIGNED` / `REJECTED` |
| Current status | `PENDING_EVIDENCE` |
| Current decision | No provider, model, SDK, dependency, runtime prompt, secret, network call or runtime AI capability is approved by this record. |

This record is intentionally incomplete from a vendor evidence perspective. Every vendor field without evidence remains `NON_DETERMINE`. When external proof is required and absent from the repo, the evidence status is `EVIDENCE_REQUIRED`.

## Provider readiness fields

| Readiness field | Current value | Evidence status | Runtime requirement before `030d` |
| --- | --- | --- | --- |
| Provider logique | `NON_DETERMINE` | `EVIDENCE_REQUIRED` | Stable logical provider name signed by CPO, CTO, security/privacy and IA governance. |
| Nom legal fournisseur | `NON_DETERMINE` | `EVIDENCE_REQUIRED` | Legal vendor name and contracting entity attached to the record. |
| Statut provider | `NON_DETERMINE` | `EVIDENCE_REQUIRED` | Allowed values are `NON_DETERMINE`, `CANDIDAT`, `APPROUVE`; runtime requires signed approval. |
| Modele exact | `NON_DETERMINE` | `EVIDENCE_REQUIRED` | Exact model id/version only; family aliases and moving aliases are rejected. |
| Alias auto-upgrade | `INTERDIT` | `POLICY_DEFINED` | Values such as `latest`, implicit upgrades or family-level model ids are not allowed. |
| Regions de traitement | `NON_DETERMINE` | `EVIDENCE_REQUIRED` | Exact processing regions, including failover behavior, must be attached. |
| Regions de stockage | `NON_DETERMINE` | `EVIDENCE_REQUIRED` | Exact storage regions for provider-side data must be attached. |
| Retention prompts | `NON_DETERMINE` | `EVIDENCE_REQUIRED` | Duration, deletion path and exceptions required. |
| Retention payloads | `NON_DETERMINE` | `EVIDENCE_REQUIRED` | Duration, deletion path and exceptions required. |
| Retention outputs | `NON_DETERMINE` | `EVIDENCE_REQUIRED` | Duration, deletion path and exceptions required. |
| Retention logs | `NON_DETERMINE` | `EVIDENCE_REQUIRED` | Log content, duration and access controls required. |
| Retention traces | `NON_DETERMINE` | `EVIDENCE_REQUIRED` | Trace content, sampling, duration and access controls required. |
| Training / non-training | `NON_DETERMINE` | `EVIDENCE_REQUIRED` | Proof that customer data is not used for training, or equivalent signed mechanism. |
| Logging provider | `NON_DETERMINE` | `EVIDENCE_REQUIRED` | Exact provider logging, debug logging, support logging and opt-out status required. |
| Support / debug access | `NON_DETERMINE` | `EVIDENCE_REQUIRED` | Who can access payloads/outputs, why, for how long, and under which controls. |
| Sous-traitants | `NON_DETERMINE` | `EVIDENCE_REQUIRED` | Current subprocessor list and change-notification process required. |
| DPA / SCC / mecanisme equivalent | `NON_DETERMINE` | `EVIDENCE_REQUIRED` | Signed DPA and transfer mechanism, or equivalent legal basis, required. |
| Deletion process | `NON_DETERMINE` | `EVIDENCE_REQUIRED` | Deletion request path, SLA, scope and exceptions required. |
| Preuve de deletion attendue | `NON_DETERMINE` | `EVIDENCE_REQUIRED` | Vendor deletion confirmation or audit evidence required. |
| Incident process | `NON_DETERMINE` | `EVIDENCE_REQUIRED` | Provider incident workflow, escalation channel and customer action path required. |
| Delai notification incident | `NON_DETERMINE` | `EVIDENCE_REQUIRED` | Contractual notification delay required. |
| Chiffrement transit | `NON_DETERMINE` | `EVIDENCE_REQUIRED` | Protocol and minimum encryption requirements required. |
| Chiffrement repos | `NON_DETERMINE` | `EVIDENCE_REQUIRED` | Provider at-rest encryption controls required. |
| Limites cout | `NON_DETERMINE` | `EVIDENCE_REQUIRED` | Pilot budget, per-request/per-batch cap and cost spike threshold required. |
| Limites latence | `NON_DETERMINE` | `EVIDENCE_REQUIRED` | Timeout, p50/p95 target and fallback threshold required. |
| Rate limit | `NON_DETERMINE` | `EVIDENCE_REQUIRED` | Rate limits, retry budget and backoff policy required. |
| Contacts escalation | `NON_DETERMINE` | `EVIDENCE_REQUIRED` | Provider and internal escalation contacts required. |
| Signatures attendues | `CPO / CTO / security / privacy / IA governance` | `EVIDENCE_REQUIRED` | No signature is recorded in this file. |

## Payload minimization matrix

| Field | Source | Transformation | Sent provider | Loggable | Justification | Residual risk | Required proof / signature |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `accountCode` | Latest tenant-scoped balance import line | Normalize, trim, bound length, reject malformed values. | Yes, after whitelist signature | No | Needed to bind the suggestion to one imported account line. | Account codes can reveal chart structure. | Payload whitelist signature; no-log test. |
| `accountLabel` sanitized | Latest tenant-scoped balance import line | Trim, normalize spaces, bound length, remove emails, phone numbers, IBANs, URLs, client/tenant identifiers, private references and obvious names if not necessary. | Yes, sanitized only | No | Main mapping signal when minimized. | Free text can retain sensitive context after sanitization. | Sanitizer tests; privacy/security signature. |
| Raw `debit` | Latest tenant-scoped balance import line | Exclude by default. | No | No | Raw amounts are not required by default. | Runtime bug could leak amounts if whitelist is bypassed. | Flag-off and no-raw-amount tests. |
| Raw `credit` | Latest tenant-scoped balance import line | Exclude by default. | No | No | Raw amounts are not required by default. | Runtime bug could leak amounts if whitelist is bypassed. | Flag-off and no-raw-amount tests. |
| Derived debit/credit signals | Latest tenant-scoped balance import line | Use only non-reversible signals: `debit-dominant`, `credit-dominant`, `zero/near-zero`, normal side and relative non-reversible bucket. | Yes, only if signed | No | Helps classify normal side without exposing raw amounts. | Derived buckets can still disclose coarse financial shape. | Payload whitelist signature; privacy/security review. |
| Tenant identifier | Application context | Use only for auth, RBAC and tenant scoping before the provider call. | No | No | Not needed by the provider. | Cross-tenant leakage if accidentally included. | Tenant/RBAC tests; payload snapshot redaction. |
| Client identifier | Application context | Use only inside backend authorization and scoping. | No | No | Not needed by the provider. | Client identity exposure. | Payload whitelist signature. |
| Actor identifier | Application context | Use only inside backend authorization and scoping. | No | No | Not needed by the provider. | User privacy exposure. | Payload whitelist signature. |
| Targets | Published mapping taxonomy | Include only `selectable=true` and `deprecated=false` targets; send code and public taxonomy metadata only. | Yes, filtered only | No, except aggregate counts | Provider needs allowed choices. | Taxonomy payload may be large and can reveal product structure. | Contract/taxonomy check; IA governance signature. |
| Evidence refs | Tenant-scoped allowed evidence | Short typed refs only; no snippets, no document path, no storage key, no signed URL, no private text. | Yes | No | Evidence-first suggestions need verifiable anchors. | Ref can still point to sensitive source if type discipline fails. | Evidence whitelist tests; privacy/security signature. |
| `schemaVersion` | Versioned AI contract | Exact value only. | Yes | Yes | Strict output validation and reproducibility. | Low. | Schema pinning approval. |
| Schema hash | Versioned AI contract | Exact hash of the runtime schema. | Yes if needed | Yes | Detects schema drift. | Low. | Schema pinning approval. |
| `promptVersion` | Future approved prompt | Exact pinned version only. | Yes | Yes | Prompt reproducibility. | Low. | Prompt pinning approval. |
| Model exact ID | Signed provider readiness record | Exact model id only; no alias. | Yes | Yes | Model pinning, cost and latency control. | Model id can change semantics if vendor reuses names. | Provider readiness signature. |
| Provider logical name | Signed provider readiness record | Stable non-secret logical name. | Yes if needed | Yes | Observability and fallback routing. | Low. | Provider readiness signature. |
| Request / trace id technique | Observability layer | Technical id without tenant/client/actor in clear. | No by default | Yes | Correlation without exposing business identifiers to provider. | Correlation id misuse could link events. | Observability review. |
| Raw prompt | Runtime orchestration | Never whitelisted as loggable or support bundle content. | Not applicable | No | Contains minimized but still sensitive business context. | Critical if logged. | Log redaction tests. |
| Raw output | Runtime orchestration | Never whitelisted as loggable or support bundle content. | Not applicable | No | May echo sensitive prompt content. | Critical if logged. | Log redaction tests. |
| Full payload | Runtime orchestration | Never whitelisted as loggable or support bundle content. | Not applicable | No | Full payload can reconstruct business data. | Critical if logged. | Log redaction tests. |

## Logs autorises

Only these fields are authorized in structured logs or metrics, and only in minimized form:

- technical request id / trace id;
- final state;
- provider logical name;
- `schemaVersion`, `promptVersion`, exact model id and schema hash;
- aggregate latency;
- counts of accounts, suggestions and rejected outputs;
- normalized rejection reason;
- aggregate estimated cost.

## Logs interdits

The following are forbidden in application logs, provider logs, traces, support bundles and eval fixtures:

- raw prompt;
- raw output;
- full payload;
- account labels;
- amounts;
- evidence snippets;
- tenant/client identifiers;
- secrets, tokens, credentials, DSN or `.env` values;
- storage keys or signed URLs;
- cross-tenant data.

## Gates before `030d runtime`

`030d runtime` is blocked until every gate below is satisfied and evidenced:

- CPO approval;
- CTO Gate;
- Security/Privacy Review;
- IA Governance Review;
- signed Dependency Review;
- signed Provider Readiness Record;
- DPA/SCC/deletion/incident proofs attached;
- signed payload whitelist;
- golden set `030c` green;
- runbook ready;
- feature flag and kill switch validated;
- prompt/schema/model pinning validated.

## Future runtime tests to require

- flag off => zero prompt, zero provider request, zero network, zero cost, zero provider log;
- `TIMEOUT`;
- `UNAVAILABLE`;
- `INVALID_MODEL_OUTPUT`;
- `INSUFFICIENT_EVIDENCE`;
- no raw prompt/output/payload in logs;
- `accountLabel` sanitization;
- no raw amounts;
- target selectable and non deprecated;
- tenant/RBAC;
- no auto-write;
- no `audit_event` on `GET`;
- no `POST /decision` until the contract/runtime sub-deliverable explicitly introduces it;
- golden set green;
- Modulith boundaries.

## Signature placeholders

These placeholders do not constitute signatures.

| Role | Expected evidence | Current status |
| --- | --- | --- |
| CPO | Product approval for provider use and payload whitelist. | `PENDING_EVIDENCE` |
| CTO | Runtime architecture and operational gate approval. | `PENDING_EVIDENCE` |
| Security | Provider, logging, secret handling and incident controls review. | `PENDING_EVIDENCE` |
| Privacy | DPA/SCC, retention, deletion and minimization review. | `PENDING_EVIDENCE` |
| IA governance | Model/prompt/schema pinning, evals and fallback review. | `PENDING_EVIDENCE` |
