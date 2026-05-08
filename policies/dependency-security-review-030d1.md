# Dependency Security Review - 030d1

## Review identity

| Field | Value |
| --- | --- |
| Record id | `030d1-ai-provider-readiness-record-and-dependency-review-v1` |
| Scope | Future assisted mapping provider integration only. |
| Surface | `DOCS_ONLY / SECURITY_PRIVACY / IA_GOVERNANCE / DEPENDENCY_REVIEW` |
| Current runtime decision | No dependency, SDK, runtime JSON Schema library, provider client or model integration is approved or added by this review. |

External dependency evidence is not attached in the repo for this sub-deliverable. When a fact cannot be verified locally from existing repo evidence, it is marked `EVIDENCE_REQUIRED`.

## Decision summary

| Option | Status | Current decision |
| --- | --- | --- |
| RestClient or controlled HTTP client | `RECOMMENDED_DEFAULT` | Recommended future default strategy because it can be implemented without adding a provider SDK dependency and keeps retries, timeouts, logging and payload construction under application control. Runtime remains blocked until all `030d1` gates are signed. |
| Provider SDK | `BLOCKED_PENDING_REVIEW` | Blocked until a signed dependency/security review covers exact package, version, license, CVEs, transitive dependencies, telemetry, logging and patch plan. |
| Runtime JSON Schema library | `BLOCKED_PENDING_REVIEW` | Blocked until a signed dependency/security review covers exact package, version, license, CVEs, transitive dependencies, cold start impact and patch plan. |

## Option 1 - RestClient or controlled HTTP client

| Review field | Assessment |
| --- | --- |
| Status | `RECOMMENDED_DEFAULT` |
| Licence | No new licence delta if implemented with the backend HTTP stack already present in the application. Exact component/version evidence is required before runtime if a new artifact or version is introduced. |
| CVE connues | `EVIDENCE_REQUIRED` for the exact runtime component versions. No dependency audit was executed by this docs-only review. |
| Maintainers | Ritomer backend owners for the application wrapper; upstream component ownership must be confirmed if a specific new artifact/version is selected. |
| Cadence release | No new cadence if existing stack is reused; otherwise `EVIDENCE_REQUIRED`. |
| Dependances transitives | No new transitive dependencies expected if existing stack is reused; any new artifact requires a dependency tree review. |
| Logging | Application-owned only; must log only the allowed minimized fields from the readiness record. |
| Retry/backoff/timeouts | Application-owned; explicit timeout, bounded retry, bounded backoff and cost ceiling required before runtime. |
| Telemetry / phone-home | No telemetry or phone-home may be added. Any component telemetry must be proven absent or disabled. |
| Taille / cold start | Minimal additional impact if existing stack is reused; exact measurement required before runtime activation. |
| Compatibilite Cloud Run | Compatible in principle with Cloud Run outbound calls after provider approval, egress policy and secret handling review. |
| Compatibilite no-Docker local | Compatible because no Docker-only workflow is required. |
| Gestion secrets | Secrets must come from approved runtime configuration/secret management only; never in repo, logs, payloads, support bundles or `.env` reads by Codex. |
| Surface reseau | One explicitly approved provider endpoint allowlist after signed provider readiness; no broad SDK network behavior. |
| Plan de patch | Use existing backend patch process; if a new component/version is selected, re-run dependency/security review before runtime. |
| Decision actuelle | Recommended as the default future integration strategy, but it does not approve provider runtime. |

## Option 2 - Provider SDK

| Review field | Assessment |
| --- | --- |
| Status | `BLOCKED_PENDING_REVIEW` |
| Licence | `EVIDENCE_REQUIRED` for the exact SDK package and version. |
| CVE connues | `EVIDENCE_REQUIRED`; must be checked against exact package, version and transitives. |
| Maintainers | `NON_DETERMINE`; vendor/package maintainers must be documented with support path and bus-factor risk. |
| Cadence release | `NON_DETERMINE`; release cadence and security fix SLA required. |
| Dependances transitives | `NON_DETERMINE`; full dependency tree required. |
| Logging | `NON_DETERMINE`; SDK must prove it does not log prompts, payloads, outputs, labels, amounts, secrets or tenant/client identifiers. |
| Retry/backoff/timeouts | `NON_DETERMINE`; hidden retries or unbounded backoff are unacceptable. |
| Telemetry / phone-home | `NON_DETERMINE`; telemetry, analytics, debug upload or phone-home must be proven absent or disabled. |
| Taille / cold start | `NON_DETERMINE`; artifact size and Cloud Run cold start impact required. |
| Compatibilite Cloud Run | `EVIDENCE_REQUIRED`; network, thread, TLS and startup behavior must be reviewed. |
| Compatibilite no-Docker local | `EVIDENCE_REQUIRED`; no Docker-only local workflow may be introduced. |
| Gestion secrets | `EVIDENCE_REQUIRED`; SDK secret resolution must not read undeclared files or emit secrets in logs/errors. |
| Surface reseau | `NON_DETERMINE`; all outbound endpoints and support/debug channels must be documented. |
| Plan de patch | `EVIDENCE_REQUIRED`; owner, SLA and emergency patch process required. |
| Decision actuelle | Blocked. No provider SDK may be added for `030d1` or used by `030d runtime` until this review is signed. |

## Option 3 - Runtime JSON Schema library

| Review field | Assessment |
| --- | --- |
| Status | `BLOCKED_PENDING_REVIEW` |
| Licence | `EVIDENCE_REQUIRED` for the exact package and version. |
| CVE connues | `EVIDENCE_REQUIRED`; must be checked against exact package, version and transitives. |
| Maintainers | `NON_DETERMINE`; maintainers and support path required. |
| Cadence release | `NON_DETERMINE`; release cadence and security fix history required. |
| Dependances transitives | `NON_DETERMINE`; full dependency tree required. |
| Logging | Must not log schema inputs, prompts, outputs or validation payloads. Exact behavior is `EVIDENCE_REQUIRED`. |
| Retry/backoff/timeouts | Not normally applicable to local validation, but any remote validation, schema fetching or background update behavior is rejected unless reviewed. |
| Telemetry / phone-home | Must be absent. Proof is `EVIDENCE_REQUIRED`. |
| Taille / cold start | `NON_DETERMINE`; artifact size and startup impact required. |
| Compatibilite Cloud Run | `EVIDENCE_REQUIRED`; no filesystem, network or startup assumption incompatible with Cloud Run. |
| Compatibilite no-Docker local | `EVIDENCE_REQUIRED`; local validation must work without Docker, Docker Compose or Testcontainers. |
| Gestion secrets | Must not access secrets. Proof is `EVIDENCE_REQUIRED`. |
| Surface reseau | Should be none. Any network access is blocked pending review. |
| Plan de patch | `EVIDENCE_REQUIRED`; owner, SLA and emergency patch path required. |
| Decision actuelle | Blocked. No runtime JSON Schema library may be added until the review is signed. |

## Required evidence before changing a blocked status

- exact dependency coordinates and version;
- licence text or authoritative licence metadata;
- CVE scan result for the exact version and transitives;
- dependency tree;
- maintainer and release cadence review;
- logging and telemetry behavior evidence;
- Cloud Run and no-Docker local compatibility evidence;
- secret handling review;
- patch owner and emergency patch plan;
- CPO, CTO, security/privacy and IA governance signatures when the dependency affects provider runtime.
