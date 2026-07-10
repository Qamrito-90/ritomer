# Dependency Security Review - 042a

## Review identity

| Field | Value |
| --- | --- |
| Record id | `042a-dependency-security-review-v1` |
| Scope | Future controlled AI mapping runtime pilot. |
| Surface | `DOCS_GIT / AI_GOVERNANCE / DEPENDENCY_REVIEW` |
| Current status | `PENDING_N/A_JUSTIFICATION` |
| Current decision | No dependency, SDK, runtime JSON Schema library, provider client or model integration is accepted or added by this review. The `042b1b` retry was executed locally by the user with `curl.exe` and has no repository dependency impact. Direct backend HTTP without SDK remains the preferred candidate strategy if a future implementation can justify it. |

This draft adds no dependency and performs no package, CVE, license or transitive dependency audit. Because no SDK/provider dependency is added by this docs-only mission, the review remains `PENDING_N/A_JUSTIFICATION`, with no human signature.

## Manual OpenAI Platform/API preflight evidence - 042b0b / 042b0c / 042b1a / 042b1b

The manual OpenAI Platform/API account, security/privacy UI evidence, failed non-conclusive canary `042b1a` and final failed retry `042b1b` have no dependency impact:

- no provider SDK is added or accepted;
- no provider client package, runtime JSON Schema library or model integration is added;
- no API key value, secret, `.env` value or credential is read or recorded by Codex;
- the `042b1a` temporary API key was created manually and then revoked, outside repository dependency management;
- the `042b1b` retry was run locally by the user with `curl.exe`, outside repository dependency management;
- the `042b1b` temporary API key was revoked immediately after the attempt, outside repository dependency management;
- the `042b1b` API key value was not recorded in the repo, Codex or GitHub;
- the `042b1b` ChatGPT exposure is recorded only as `YES_ONE_TEMPORARY_KEY_PASTED_AND_TREATED_AS_COMPROMISED`, with no key value recorded here;
- the `042b1b` retry execution secret value is `NOT_RECORDED`;
- no AI network call is performed by Codex for this closure;
- active API keys after revocation remain `0`;
- API usage remains `$0.00`, with total requests `0`, total tokens `0`, Responses and Chat Completions `0 requests / 0 input tokens`, and July spend `$0.00 / $10.00`;
- the `042b1a` canary produced no HTTP 200, no model returned, no provider usage validation and no network PASS;
- the `042b1b` retry produced `FAIL_HTTP_400_INVALID_REQUEST_ERROR / STOP_NO_FALLBACK`, no HTTP 200, no model returned, no usage tokens returned, no provider usage validation and no network PASS;
- Data controls, API call logging and audit logging UI observations do not add a runtime dependency;
- official OpenAI documentation was reviewed via public web documentation only, not via an OpenAI API call;
- direct backend HTTP without SDK remains only a preferred candidate strategy, still pending explicit N/A justification before any `042b` implementation.

## Current options

| Option | Current position | Current decision |
| --- | --- | --- |
| Existing backend HTTP stack / controlled client | `PREFERRED_PENDING_N/A_JUSTIFICATION` | Preferred future strategy, but not accepted by this draft. If no new artifact is introduced, an explicit N/A justification is still required before `042b`. |
| Provider SDK | `PENDING_EVIDENCE` | Blocked until exact package, version, license, CVEs, transitive dependencies, telemetry, logging, timeout and patch plan are reviewed and validated. |
| Runtime JSON Schema library | `PENDING_EVIDENCE` | Blocked until exact package, version, license, CVEs, transitives, network behavior, logging behavior and cold start impact are reviewed and validated. |

## Draft 2020-12 engine gate - 042a2a6a

| Field | Value |
| --- | --- |
| Sub-deliverable | `042a2a6a`, sub-deliverable 2 |
| Gate | `STOP_DEPENDENCY_REQUIRED` |
| Selected library | `NONE` |
| Dependency added | `NONE` |
| Draft 2020-12 semantic validation | `NOT_PERFORMED` |

The governance kit targets JSON Schema Draft 2020-12 as documentation only. Its Node built-in checker parses JSON and verifies repository invariants; it is not a JSON Schema engine.

The following are not acceptable as Draft 2020-12 conformance evidence:

- transitive Ajv 6, which does not satisfy the required Draft 2020-12 engine gate;
- partial PowerShell validation;
- the custom structural checker introduced by `042a2a6a`;
- successful JSON parsing alone.

No library is selected and no manifest or lockfile is changed. A future dependency review must record the exact engine and version, license, CVEs, transitive dependencies, telemetry, logging behavior, maintenance posture, patch owner and compatibility with the supported local, CI and production environments before this stop can be reconsidered.

JSON syntax and repository invariants checked; Draft 2020-12 semantic validation not performed.

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

Any future new dependency must record exact version, license, CVE status, transitive dependencies, telemetry/logging behavior, retry/backoff behavior and owner before implementation.

## N/A rule

`N/A` is not claimed by this draft.

If `042b` uses only an already present backend HTTP component without introducing a new artifact or version, `N/A` may be proposed only with explicit CTO and Security/Privacy justification. That justification must still confirm logging, retry, timeout, telemetry, secret handling and patch ownership.

## Current blockers

- No provider SDK may be added by `042b` without a completed dependency/security review.
- No runtime JSON Schema dependency may be added by `042b` without a completed dependency/security review.
- The `042a2a6a` Draft 2020-12 engine gate remains `STOP_DEPENDENCY_REQUIRED`; neither Ajv 6, partial PowerShell checks nor a custom validator may be relabelled as semantic conformance.
- No dependency may be added to bypass provider-readiness, payload whitelist, contract readiness or runbook gates.
