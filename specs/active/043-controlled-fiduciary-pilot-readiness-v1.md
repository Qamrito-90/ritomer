# 043 - Controlled fiduciary pilot readiness V1

## Status

Active.

- Current sub-deliverable: `043a` - `IMPLEMENTED_PENDING_DISTINCT_CPO_REVIEW`.
- `043b`: `NOT_STARTED / NOT_AUTHORIZED`.
- `043c`: `NOT_STARTED / NOT_AUTHORIZED`.
- No transition between `043a`, `043b` and `043c` is automatic.

## Roadmap declaration

| Field | Value |
| --- | --- |
| Roadmap phase | Phase 0 - alpha interne reproductible |
| Primary workstream | Produit fiduciaire |
| Supporting workstream | Trust & operations |
| Outcome | Prove that the synthetic closing workflow can be rehearsed internally in a reproducible, controlled and evidence-bearing way. |
| Exit evidence | Frozen synthetic fixtures, deterministic validation, controlled two-actor local harness, two internal rehearsal executions and an explicit CPO readiness decision. |
| Gate targeted | CPO decision on whether external-gate review may begin; never an external invitation by itself. |

The canonical outcome roadmap is `docs/product/product-roadmap.md`. This spec remains the detailed source of truth for `043`.

## Normative boundary

`043` prepares only level A readiness.

In `043c`, that readiness is tested through two executions, `R1` and `R2`, of one strictly internal rehearsal protocol.

`043` invites no external fiduciary. `043` collects no real participant observation.

The first external invitation requires a new CPO decision and prior satisfaction of both the fiduciary gate and the Security/Privacy gate. `GO_TO_EXTERNAL_GATE_REVIEW` is neither an invitation nor an authorization to collect observations.

No following spec is created automatically.

Each of `043a`, `043b` and `043c` requires a distinct CPO review. `043b` also requires a prior CTO Gate. `043c` may start only after post-code validation of `043b`, the required human technical review and a new CPO decision.

## Surface and risk

| Sub-deliverable | Surface | Risk |
| --- | --- | --- |
| `043a` | `DOCS_GIT / FIXTURES_SYNTHETIQUES / GOVERNANCE_CHECKS` | B |
| `043b` | `BACKEND_DEVTOOLS_LOCAL / FRONTEND_CONTEXT / AUTH_LOCAL / TENANT` | C |
| `043c` | `QA_MANUAL / LOCAL_RUNTIME / DOCS_GIT` | C |

Only the `043a` surface is authorized by the current mission.

## Sources reviewed

- `docs/product/documentation-governance.md`
- `docs/present/README.md`
- `docs/present/ux-cadrage-v1.md`
- `docs/present/architecture-cadrage-v1.md`
- `docs/present/ai-cadrage-v1.md`
- `docs/adr/*.md`
- `docs/product/v1-plan.md`
- `specs/backlog/042-controlled-ai-mapping-runtime-pilot-v1.md`
- `README.md`
- `docs/vision/*.md`
- `docs/playbooks/*.md`

No contract, runtime runbook or durable UI truth is changed by `043a`.

## Relationship to 042

`042-controlled-ai-mapping-runtime-pilot-v1` is moved to backlog only, never to Done, with pause reason `PAUSED_BY_SEPARATE_CPO_DECISION`.

The separate CPO decision opening `043` neither closes nor approves `042`. All historical evidence and blockers remain intact, including literally:

- `PENDING_HUMAN_RESPONSES`;
- human responses = `0`;
- adjudications = `0`;
- golden set `042a2` = `0`;
- `collectionAuthorized=false`;
- `distributionAuthorized=false`;
- `providerAuthorized=false`;
- `goldenPromotionAuthorized=false`;
- `adjudicationAuthorized=false`;
- `retryAuthorized=false`;
- `provider_runtime=STILL_BLOCKED`;
- `adapter_provider=NOT_AUTHORIZED`;
- `retry_remaining=0`;
- `fallback=FORBIDDEN`;
- Draft 2020-12 semantic validation = `NOT_PERFORMED`.

Historical statements that a `042` increment created no `043` remain true. The current `043` exists only because of the separate CPO decision recorded here.

## 043a - Pilot readiness foundation

### Objective

Create the documentary, synthetic-data and governance-check foundation needed to review level A readiness without starting a runtime, inviting a participant or collecting an observation.

### Included

- Move `042` from active to backlog and record its pause without altering its evidence.
- Create this active `043` spec and document `043a`, `043b` and `043c`.
- Create the canonical product roadmap, oriented around outcomes, proofs and gates.
- Freeze two Ritomer-created synthetic CSV fixtures and document their provenance and immutability.
- Add a blank internal observation template and a deterministic PowerShell validator.
- Adapt the `042a2a6a` checker so its PR #99 historical proof remains distinct from current lifecycle truth.
- Update only the permitted living documentation references.

### Exact Git path set

The current increment is limited to exactly 14 Git path endpoints, with no wildcard:

1. `specs/active/042-controlled-ai-mapping-runtime-pilot-v1.md` - rename source.
2. `specs/backlog/042-controlled-ai-mapping-runtime-pilot-v1.md` - rename destination and lifecycle note.
3. `specs/active/043-controlled-fiduciary-pilot-readiness-v1.md` - new active spec.
4. `docs/product/product-roadmap.md` - new canonical outcome roadmap.
5. `fixtures/pilot/043/README.md` - fixture governance.
6. `fixtures/pilot/043/balance-fy2025-v1.csv` - frozen synthetic balance.
7. `fixtures/pilot/043/evidence-bank-reconciliation-fy2025-v1.csv` - frozen synthetic evidence.
8. `fixtures/pilot/043/observation-template-v1.md` - blank template.
9. `fixtures/pilot/043/validate-043-pilot-fixtures.ps1` - deterministic validator.
10. `docs/product/v1-plan.md` - lifecycle and sequencing.
11. `evals/mapping/README.md` - current `042` lifecycle clarification.
12. `evals/mapping/validate-042a2-human-review-governance-kit.mjs` - historical/current separation.
13. `policies/ai-mapping-pilot-scope-manifest-042a2.md` - current backlog pointer.
14. `README.md` - discoverability of roadmap and frozen fixtures.

### Frozen fixtures

| Artifact | Classification | Expected bytes | Expected SHA-256 | Business invariant |
| --- | --- | ---: | --- | --- |
| `balance-fy2025-v1.csv` | `INTERNAL_ONLY` | 359 | `2295b620704c2cfcdf1e37660388bd84a1d261c0b7697edf5bce21d0c04f9855` | 7 data rows, debit = credit = `149000.00`, account `1200` present. |
| `evidence-bank-reconciliation-fy2025-v1.csv` | `INTERNAL_ONLY` | 184 | `f5bb9a7ec0df043a8e845d10f029c2bdd6dd7ea2f62f9935f48cdc0d95339b27` | MIME `text/csv`, provenance `RITOMER_INTERNAL_SYNTHETIC`, difference `0.00`. |

Both files are created de novo by Ritomer, contain no real data, use UTF-8 without BOM, LF endings and a terminal LF. Version `v1` is immutable: any change requires a `v2`, new size/hash, justification and a new review.

### Observation metrics

The blank template defines the unit `(runId, taskId, actorRole)` and may capture:

- UTC start and end timestamps;
- result among `COMPLETED`, `COMPLETED_WITH_HELP`, `NOT_COMPLETED`, `NOT_ATTEMPTED`;
- `productiveSeconds`, `incidentSeconds` and `excludedSeconds`;
- interventions, blockers, workarounds and corrections;
- comprehension, handoff, usefulness and irritants.

Allowed intervention categories are `PROTOCOL_CLARIFICATION`, `NAVIGATION_HINT`, `DOMAIN_EXPLANATION`, `TECHNICAL_RECOVERY`, `DATA_RESET` and `SESSION_AUTH_RECOVERY`.

No numerical performance threshold and no historical time baseline are introduced. A completed observation, identity, participant quote, screenshot, HAR, token, local path, real data or prefilled participant result must never be committed from this template.

### Checks

```powershell
.\fixtures\pilot\043\validate-043-pilot-fixtures.ps1
.\evals\mapping\validate-golden-set.ps1
.\evals\mapping\validate-042a2-candidate.ps1
.\evals\mapping\validate-042a2-candidate-cases.ps1
.\evals\mapping\validate-042a2-blind-review-pack.ps1
node --check evals/mapping/validate-042a2-human-review-governance-kit.mjs
node evals/mapping/validate-042a2-human-review-governance-kit.mjs
node evals/mapping/validate-042a2-human-review-governance-kit.mjs --base 14b7ef952f8d9594a53e63542ee2d6d80bbcaa2f --head fd8b63d2193c4adebb5a847405d1d30c1cae9214
git diff --name-status
git diff --stat
git diff --check
git status --short --branch --untracked-files=all
```

### Acceptance

- Exactly one `042` exists in backlog and no `042` exists in active or Done.
- Exactly one `043` exists in active and no `043` exists in backlog or Done.
- The PR #99 historical proof still reports the original active path and exact `6M / 13A` matrix.
- All protected `042` hashes, 17 cases, ledger, human-instance scans, PII/secret checks and D/E/F invariants remain unchanged and green.
- The roadmap contains all six workstreams, phases 0 to 7 and MCP maturity M0 to M5 without a date or committed future spec.
- Both fixtures match their exact bytes, hashes and business invariants.
- No runtime, provider, secret, personal data or real data is introduced.
- The distinct CPO review is still required; successful checks do not authorize `043b`.

## 043b - Local two-actor pilot harness

Status: `NOT_STARTED / NOT_AUTHORIZED`.

### Mandatory entry gates

- `043a` accepted through its distinct CPO review.
- CTO Gate completed before any `043b` code.
- Exact future file set and post-code verification plan reconfirmed.
- Frozen fixtures still match their hashes.
- `042` remains backlog and `043` remains active.

### Planned outcome

Provide a local-only, two-actor harness for the same synthetic tenant:

- one common backend on `127.0.0.1:8080`;
- ACCOUNTANT Vite context on `127.0.0.1:5173`;
- REVIEWER Vite context on `127.0.0.1:5174`;
- strict ports, two distinct HS256 JWTs with an exact 60-minute TTL and no refresh, injected only into their respective server-side Vite processes;
- claims limited to `sub`, `iat`, `exp` and `jti`, with the signing secret removed from the child Vite environments;
- `/api/me` verification for both actors before any business action;
- roles and tenant resolved exclusively from PostgreSQL membership, never from role or tenant claims;
- no token in browser storage, URL, UI, shared log, command argument or repository file;
- no production authentication change, login/logout UI, role switch, tenant switch, endpoint, contract, migration or dependency.

The planned implementation keeps `frontend/vite.config.ts`, `frontend/src/**`, lockfiles, production security configuration, migrations, contracts and OpenAPI unchanged.

The planned harness may only support internal synthetic rehearsal. It must not invite or observe an external participant. Its implementation requires its own bounded mission, technical tests and human review of local auth, RBAC and tenant isolation.

### Stop conditions

Stop and replan if implementation would require a production auth change, mint endpoint, browser-side token, JWT-controlled role/tenant, non-loopback target, migration, public API contract, dependency or modification outside the separately approved `043b` file set.

## 043c - Internal rehearsal and readiness decision

Status: `NOT_STARTED / NOT_AUTHORIZED`.

### Mandatory entry gates

- Post-code `043b` checks are green.
- Human technical review of local auth, RBAC and tenant separation is complete.
- A distinct post-`043b` CPO review authorizes `043c`.
- The internal protocol and disposable data/storage controls are reconfirmed.

### Planned protocol

Run two executions, `R1` and `R2`, of the same strictly internal synthetic rehearsal. Each covers context, balance import, manual mapping, workpaper/evidence preparation, maker-to-reviewer handoff, reviewer verification, audit-ready export and usefulness assessment.

Each execution uses a separate disposable database and storage root. `R2` cannot begin until `R1` cleanup is proved. The canonical database, real customer data and external participants are forbidden. Runtime secrets remain local and must never enter Git, chat, logs or the observation template.

The only allowed CPO outcomes are:

- `GO_TO_EXTERNAL_GATE_REVIEW`;
- `NO_GO`;
- `INCONCLUSIVE`.

`GO_TO_EXTERNAL_GATE_REVIEW` does not authorize an invitation, collection, real data or a following spec. With `INCONCLUSIVE`, `043` remains active. A future closure may move `043` to Done only with evidence from both executions or an explicit `NO_GO`; it creates no next spec.

## Gates before any external invitation

The following are cumulative:

- a new explicit CPO invitation decision;
- fiduciary review of the protocol and business tasks;
- Security/Privacy approval of observation custody, storage, jurisdiction, ACL, retention and deletion;
- proof that the external exercise remains synthetic and tenant-isolated;
- approved participant communication and stop procedure;
- a result location outside Git; its current value is `NON DETERMINED`.

Expert Board involvement is not required for the internal level A rehearsal itself and must be reconsidered before any level B/C expansion.

## Absolute out of scope for 043a

- backend or frontend implementation;
- runtime runbook;
- JWT, browser, database or migration;
- contract, OpenAPI, dependency or provider;
- AI call, retry, MCP runtime, MCP server, chat or agent;
- public website, login page, hosting or production;
- external participant, participant observation or real data;
- statutory deliverable or official final pack;
- any spec numbered `044` or later.

## Stop conditions

Stop `043a` if a fifteenth Git path endpoint is required, a protected `042` hash changes, real/personal data appears, a business threshold/date/commercial promise must be invented, a runtime or contract change is needed, or any following spec/runtime is implicitly created.

## Definition of done for 043a

- Scope is limited to the exact 14 Git path endpoints.
- The lifecycle and pause of `042` are honest and evidence-preserving.
- This `043` spec and the canonical roadmap are present and coherent.
- Fixtures and blank template are frozen, documented and validated.
- Current and historical governance checker modes pass.
- All required checks are freshly executed and recorded.
- No commit, push or pull request is created by the implementation mission.
- A distinct CPO review remains required before any `043b` authorization.
