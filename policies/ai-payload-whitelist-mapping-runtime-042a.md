# AI Payload Whitelist - Mapping Runtime 042a

## Record identity

| Field | Value |
| --- | --- |
| Record id | `042a-ai-payload-whitelist-mapping-runtime-v1` |
| Scope | Future provider payload for controlled mapping runtime pilot on synthetic demo data only. |
| Surface | `DOCS_GIT / AI_GOVERNANCE / SECURITY_PRIVACY` |
| Current status | `DRAFT` |
| Current decision | Draft whitelist only. It does not authorize provider code, provider selection, prompt runtime, secret use or network activation. |

## Schema evidence

Canonical schema source:

- Path: `contracts/ai/mapping-suggestion.schema.json`
- Algorithm: `SHA256`
- Command: `Get-FileHash -Algorithm SHA256 -LiteralPath 'contracts/ai/mapping-suggestion.schema.json'`
- Recalculated hash: `859073D97425F4EA44911AF3274FEA90C31A7CBF94010A38E61802232412C236`

If the schema changes for abstention or uncertainty, the whitelist must be reviewed against the new schema and the hash must be recalculated.

## Provider payload fields potentially authorizable

These fields are the maximum draft payload surface. They are authorizable only after signed gates and only for synthetic demo data.

| Field | Source | Transformation | Sent to provider | Loggable | Notes |
| --- | --- | --- | --- | --- | --- |
| `latestImportVersion` | Latest authorized synthetic demo import | Integer version only; no CSV content. | Yes | No | Anti-stale anchor. |
| `taxonomyVersion` | Published mapping taxonomy | Integer version only. | Yes | No | Target taxonomy anchor. |
| `accountCode` | Synthetic demo import line | Trim, uppercase if applicable, max 32 chars, allowed pattern `^[0-9A-Z._-]+$`; reject if it embeds tenant/client/actor identity. | Yes | No | Synthetic account identifier only. |
| `sanitizedAccountLabel` | Synthetic demo import line label | Sanitized as defined below; never raw customer/client labels. | Yes | No | Main mapping signal after minimization. |
| `balanceSignal` | Local debit/credit or balance fields | Enum only, values defined below; no amount, currency, bucket or magnitude. | Yes | No | Non-reversible direction signal. |
| target `code` | Published targets | Include only target code. | Yes | No | Candidate target identity. |
| target `label` | Published targets | Public taxonomy label only; no customer enrichment. | Yes | No | Candidate target label. |
| target `selectable` | Published targets | Boolean from taxonomy. | Yes | No | Must be `true` for sent candidates. |
| target `deprecated` | Published targets | Boolean from taxonomy. | Yes | No | Must be `false` for sent candidates. |
| `schemaVersion` | Canonical AI contract | Exact value from signed runtime contract. | Yes | Yes | Current value remains subject to contract readiness. |
| `schemaHash` | Canonical AI contract | Exact SHA-256 hash from canonical schema file. | Yes | Yes | Current hash documented above. |
| `promptVersion` | Future approved prompt | Exact pinned version only. | Yes | Yes | `042a1` does not create this prompt; value remains pending `042a2`. |

## Local metadata not sent to provider

These fields may be used locally for routing, audit, observability or cost control, but must not be included in the provider payload:

- `providerLogicalName`;
- `modelExactId`;
- cost or cost estimate;
- latency;
- request id;
- trace id.

Local logs/metrics for these fields must remain minimized and must not contain tenant/client/actor identities, prompts, payloads, outputs or sensitive data.

## Sanitization of `sanitizedAccountLabel`

`sanitizedAccountLabel` must be produced before any provider payload is built.

Required transformations:

- start only from a synthetic demo label authorized for the current tenant and closing folder;
- trim leading/trailing whitespace and collapse repeated whitespace to a single space;
- normalize control characters to spaces and remove non-printable characters;
- remove or redact emails, URLs, IBANs, phone numbers, UUIDs, long numeric references of 6 or more digits, storage-like paths, object keys and signed URL fragments;
- remove tenant, client, actor, file, document or workpaper identifiers when detected;
- remove secrets, tokens, cookies, DSNs, credentials and `.env`-style key/value fragments if detected;
- cap to 120 characters after sanitization;
- reject the provider payload if the sanitized label is empty, only redaction markers, or still matches a forbidden sensitive pattern.

Allowed label content after sanitization:

- generic accounting words;
- synthetic demo descriptors;
- short non-identifying abbreviations;
- punctuation needed for readability: space, hyphen, slash, apostrophe, dot and parentheses.

The sanitizer must not use cross-tenant context and must not call an external service.

## Allowed `balanceSignal` values

`balanceSignal` is a bounded enum. It must not encode amount, currency, exact balance, magnitude, threshold, percentile, customer size or raw debit/credit values.

Allowed values:

- `DEBIT_DOMINANT`: local source indicates debit direction only or debit-dominant behavior.
- `CREDIT_DOMINANT`: local source indicates credit direction only or credit-dominant behavior.
- `ZERO_OR_NEAR_ZERO`: local source indicates zero or locally negligible balance without exposing the threshold.
- `MIXED_OR_UNKNOWN`: both sides, missing values, invalid values or ambiguous direction.

If the runtime cannot compute one of these values without exposing raw amounts or business-sensitive thresholds, it must use `MIXED_OR_UNKNOWN` or avoid the provider call.

## Forbidden data

The provider payload, provider logs, application logs, traces, eval fixtures and support bundles must not contain:

- raw amounts;
- tenant, client or actor identities;
- raw CSV;
- documents;
- workpapers;
- raw audit data;
- secrets;
- tokens;
- cookies;
- DSNs;
- credentials;
- `.env` values;
- storage keys;
- signed URLs;
- real customer data;
- cross-tenant data.

Any detection of forbidden data blocks provider invocation and must produce fail-closed behavior.

