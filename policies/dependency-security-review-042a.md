# Dependency Security Review - 042a

## Review identity

| Field | Value |
| --- | --- |
| Record id | `042a-dependency-security-review-v1` |
| Scope | Future controlled AI mapping runtime pilot. |
| Surface | `DOCS_GIT / AI_GOVERNANCE / DEPENDENCY_REVIEW` |
| Current status | `DRAFT` |
| Current decision | No dependency, SDK, runtime JSON Schema library, provider client or model integration is approved or added by this review. |

This draft adds no dependency and performs no package, CVE, license or transitive dependency audit.

## Current options

| Option | Current position | Current decision |
| --- | --- | --- |
| Existing backend HTTP stack / controlled client | `PENDING_EVIDENCE` | Possible future strategy, but not approved by this draft. If no new artifact is introduced, an explicit N/A justification is still required before `042b`. |
| Provider SDK | `PENDING_EVIDENCE` | Blocked until exact package, version, license, CVEs, transitive dependencies, telemetry, logging, timeout and patch plan are reviewed and signed. |
| Runtime JSON Schema library | `PENDING_EVIDENCE` | Blocked until exact package, version, license, CVEs, transitives, network behavior, logging behavior and cold start impact are reviewed and signed. |

## Evidence required before changing this draft

- exact dependency coordinates and version, or explicit no-new-dependency justification;
- license evidence;
- CVE scan for exact version and transitive dependencies;
- dependency tree;
- maintainer, release cadence and security fix history;
- telemetry, analytics, phone-home and debug upload behavior;
- logging behavior proving no prompt, payload, output, account label, raw amount, tenant/client/actor identity or secret is logged;
- retry, timeout, backoff and idempotence behavior;
- Cloud Run compatibility;
- no-Docker local compatibility;
- secret handling review;
- patch owner and emergency patch plan;
- CPO, CTO, Security/Privacy and IA Governance review when provider runtime is affected.

## N/A rule

`N/A` is not claimed by this draft.

If `042b` uses only an already present backend HTTP component without introducing a new artifact or version, `N/A` may be proposed only with explicit CTO and Security/Privacy justification. That justification must still confirm logging, retry, timeout, telemetry, secret handling and patch ownership.

## Current blockers

- No provider SDK may be added by `042b` without a completed dependency/security review.
- No runtime JSON Schema dependency may be added by `042b` without a completed dependency/security review.
- No dependency may be added to bypass provider-readiness, payload whitelist, contract readiness or runbook gates.
