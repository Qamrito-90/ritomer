# 043 - Controlled fiduciary pilot readiness V1

## Status

Active.

- `043a`: `ACCEPTED_BY_DISTINCT_CPO_REVIEW`.
- `043b`: `LOCAL_SYNTHETIC_SIMULATION_VALIDATED / MERGED / AI_REVIEWED / OWNER_RISK_ACCEPTED_FOR_LOCAL_SYNTHETIC_ONLY / NOT_HUMAN_SIGNED / NOT_PRODUCTION_READY / NOT_EXTERNAL_READY / NOT_SEPARATION_OF_DUTIES_PROOF`.
- `043c`: `NOT_STARTED / NOT_AUTHORIZED`.
- Current sub-deliverable: `NONE`.
- No transition between `043a`, `043b` and `043c` is automatic.

## Roadmap declaration

| Field | Value |
| --- | --- |
| Roadmap phase | Phase 0 - alpha interne reproductible |
| Primary workstream | Produit fiduciaire |
| Supporting workstream | Trust & operations |
| Outcome | Prove that the synthetic closing workflow can be rehearsed internally in a reproducible, controlled and evidence-bearing way. |
| Exit evidence | Frozen synthetic fixtures, deterministic validation, controlled single-operator two-role local simulation, two internal rehearsal executions and an explicit CPO readiness decision. |
| Gate targeted | CPO decision on whether external-gate review may begin; never an external invitation by itself. |

The canonical outcome roadmap is `docs/product/product-roadmap.md`. This spec remains the detailed source of truth for `043`.

## Normative boundary

`043` prepares only level A readiness.

In `043c`, that readiness is tested through two executions, `R1` and `R2`, of one strictly internal rehearsal protocol.

`043` invites no external fiduciary. `043` collects no real participant observation.

The first external invitation requires a new CPO decision and prior satisfaction of both the fiduciary gate and the Security/Privacy gate. `GO_TO_EXTERNAL_GATE_REVIEW` is neither an invitation nor an authorization to collect observations.

No following spec is created automatically.

Each of `043a`, `043b` and `043c` requires a distinct CPO review. The distinct review of `043a` and the prior CTO Gate for `043b` are complete. The CTO Gate approved the local architecture with conditions for local synthetic use only. The local evidence and final post-code AI reviews for `043b` are complete. `043c` may start only after a new, distinct CPO decision and reconfirmation of the disposable database/storage protocol. Human technical and Security reviews are deferred to the external gate and become mandatory again on any external-use trigger defined below.

## Surface and risk

| Sub-deliverable | Surface | Risk |
| --- | --- | --- |
| `043a` | `DOCS_GIT / FIXTURES_SYNTHETIQUES / GOVERNANCE_CHECKS` | B |
| `043b` | `BACKEND_LOCAL_AUTH / BACKEND_TEST_SAFETY / FRONTEND_LOCAL_HARNESS / CI_GIT / DOCS_GIT / SECURITY_DEBT_GOVERNANCE` | C for destructive PostgreSQL safety; B otherwise |
| `043c` | `QA_MANUAL / LOCAL_RUNTIME / DOCS_GIT` | C |

The merged `043b` hotfix remained bounded to its exact 26-path implementation set. This post-merge closure is documentary-only in the four authorized living documents; it does not authorize `043c`, an external participant, production authentication, a provider, an MCP, real data or a following spec.

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
node evals/mapping/validate-042a2-human-review-governance-kit.mjs --base 14b7ef952f8d9594a53e63542ee2d6d80bbcaa2f --head 84e9854364d5803418de658b57ba73c0586641b2
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

## 043b - Local single-operator two-role simulation

Status: `LOCAL_SYNTHETIC_SIMULATION_VALIDATED / MERGED / AI_REVIEWED / OWNER_RISK_ACCEPTED_FOR_LOCAL_SYNTHETIC_ONLY / NOT_HUMAN_SIGNED / NOT_PRODUCTION_READY / NOT_EXTERNAL_READY / NOT_SEPARATION_OF_DUTIES_PROOF`.

Before this hotfix, the merged implementation was classified `MERGED_WITH_KNOWN_HIGH_FINDINGS` and local use was `LOCAL_USE_PAUSED`.

043b is a local single-operator two-role simulation.
It validates backend RBAC behavior under two synthetic identities.
It does not establish independent human sessions or segregation of duties.

043b est une simulation locale mono-opérateur de deux rôles.
Elle valide le comportement RBAC du backend sous deux identités synthétiques.
Elle n'établit ni deux sessions humaines indépendantes ni une séparation des fonctions.

Canonical classifications:

- `LOCAL_TWO_ROLE_SIMULATION`;
- `SINGLE_OPERATOR_CAPABLE`;
- `SYNTHETIC_ONLY`;
- `LOOPBACK_ONLY`;
- `NOT_PRODUCTION_AUTH`;
- `NOT_INDEPENDENT_ACTOR_BOUNDARY`;
- `NOT_PROOF_OF_SEGREGATION_OF_DUTIES`;
- `NOT_FOR_EXTERNAL_USE`;
- `NOT_FOR_REAL_DATA`.

Ports `5173` and `5174` remain separate visual contexts. They are not an identity boundary.

### Minimum Viable Safety hotfix file set

The hotfix is closed to exactly 26 paths: 24 modified and 2 added.

1. `backend/.env.example`
2. `backend/src/main/kotlin/ch/qamwaq/ritomer/shared/infrastructure/security/SecurityConfig.kt`
3. `backend/src/main/resources/application-local.yml`
4. `backend/src/test/kotlin/ch/qamwaq/ritomer/BalanceImportPersistenceIntegrationTest.kt`
5. `backend/src/test/kotlin/ch/qamwaq/ritomer/ControlsDbIntegrationTest.kt`
6. `backend/src/test/kotlin/ch/qamwaq/ritomer/DocumentsDbIntegrationTest.kt`
7. `backend/src/test/kotlin/ch/qamwaq/ritomer/ExportsDbIntegrationTest.kt`
8. `backend/src/test/kotlin/ch/qamwaq/ritomer/FinancialStatementsStructuredDbIntegrationTest.kt`
9. `backend/src/test/kotlin/ch/qamwaq/ritomer/FinancialSummaryDbIntegrationTest.kt`
10. `backend/src/test/kotlin/ch/qamwaq/ritomer/ManualMappingPersistenceIntegrationTest.kt`
11. `backend/src/test/kotlin/ch/qamwaq/ritomer/MappingSuggestionDecisionDbIntegrationTest.kt`
12. `backend/src/test/kotlin/ch/qamwaq/ritomer/PersistenceFoundationIntegrationTest.kt`
13. `backend/src/test/kotlin/ch/qamwaq/ritomer/WorkpapersDbIntegrationTest.kt`
14. `backend/src/test/kotlin/ch/qamwaq/ritomer/devtools/DemoSeedLocalAuthMeDbIntegrationTest.kt`
15. `backend/src/test/kotlin/ch/qamwaq/ritomer/devtools/DemoSeedLocalDbIntegrationTest.kt`
16. `backend/src/test/kotlin/ch/qamwaq/ritomer/devtools/DemoSeedLocalSourceGuardTest.kt`
17. `backend/src/test/kotlin/ch/qamwaq/ritomer/shared/infrastructure/security/SecurityConfigJwtValidationTest.kt` - added.
18. `backend/src/test/kotlin/ch/qamwaq/ritomer/testsupport/DisposablePostgresTestDatabaseSupport.kt` - added.
19. `frontend/local-two-actor-harness.mjs`
20. `frontend/local-two-actor-harness.test.ts`
21. `README.md`
22. `docs/product/v1-plan.md`
23. `specs/active/043-controlled-fiduciary-pilot-readiness-v1.md`
24. `runbooks/controlled-fiduciary-pilot-local-043.md`
25. `runbooks/local-dev.md`
26. `evals/mapping/validate-042a2-human-review-governance-kit.mjs`

The local/test/dbtest decoder accepts only HS256, requires a non-placeholder HMAC value of at least 32 UTF-8 bytes and enforces `iat`, `exp`, `exp > iat`, TTL at most 3,600 seconds, `exp > now` and `iat <= now + 60 seconds`. The non-local decoder function body, filter chain and authentication converter remain unchanged.

All 12 `db-integration` classes install `DisposablePostgresTestDatabaseGuardInitializer` before Flyway and use the same guarded primitive. The sole target is a direct local PostgreSQL connection at `jdbc:postgresql://127.0.0.1:5432/ritomer_043b_test`, role and owners `ritomer_043b_test_runner`, with exact activation and consent. Validation and fixed destruction share one connection and one transaction. No Cloud SQL Proxy, SSH tunnel, port forward, client/staging/production dump or real data is allowed. A sophisticated local tunnel that impersonates the exact endpoint remains an accepted residual operator risk for synthetic local use only.

Review state:

- `FINAL_AI_TECHNICAL_REVIEW=PASS`;
- `FINAL_AI_SECURITY_PRIVACY_REVIEW=PASS`;
- `AI_CTO_REVIEW=COMPLETED_WITH_CONDITIONS`;
- `OWNER_RISK_ACCEPTANCE=ACCEPTED_FOR_LOCAL_SYNTHETIC_ONLY`;
- `HUMAN_TECHNICAL_REVIEW=DEFERRED_TO_EXTERNAL_GATE`;
- `HUMAN_SECURITY_REVIEW=DEFERRED_TO_EXTERNAL_GATE`;
- `REVIEW_ARTIFACT_CLASSIFICATION=AI_GENERATED_REVIEW`;
- `REVIEW_SIGNATURE_STATUS=NOT_HUMAN_SIGNED`.

No human review is claimed complete. The final state remains limited to a local synthetic single-operator simulation and does not establish production readiness, external readiness or segregation of duties.

### Final closure evidence — 2026-07-27

This evidence closes only the local synthetic `043b` simulation. It authorizes neither `043c`, `R1`, `R2`, external use, production authentication nor real data.

| Surface | Sanitized final evidence |
| --- | --- |
| Git and CI | PR `#103`; `baseCommit=b46fb0d6dcfb2eca7d317ddfeaf34371686e7030`; `sourceCommit=13b297a6d4c6bb0ccd0d9ffb2052314275c7e273`; `mergeCommit=a484cd321066e65839aaa9d2b899db4620461f93`; `changedPaths=26`; `matrix=24M / 2A`; `sourceMergeTreeIdentity=PASS`; Backend CI `PASS`; Frontend CI `PASS`. |
| PostgreSQL | `dedicatedDatabase=ritomer_043b_test`; `dedicatedRole=ritomer_043b_test_runner`; `targetedDbIntegrationTests=8 PASS_EXECUTED`; `fullDbIntegrationTests=48 PASS_EXECUTED`; `dbIntegrationClasses=12`; `databaseAndRoleCleanup=PASS`. |
| Runtime and browser | `backendLoopback=PASS_127_0_0_1_8080`; `accountantProxy=PASS_127_0_0_1_5173`; `reviewerProxy=PASS_127_0_0_1_5174`; `sameTenant=PASS`; `distinctRoles=PASS`; `rbacMatrix=PASS`; `browserAuthorizationHeaderVisible=NO`; `browserJwtSurfaceDetected=NO` for HTML, URL, `localStorage`, `sessionStorage` and cookies; `coordinatedShutdown=PASS`; `runtimeCleanup=PASS`; `realSmoke=PASS_FRESH_DISPOSABLE_DB`, executed by the local user, never by Codex. |
| Post-merge baseline | `mainAlignedWithOrigin=PASS`; `worktreeClean=PASS`; `sourceMergeTreeIdentity=PASS`; `postMergeVerification=PASS`. |
| Reviews | Final AI Technical Review `PASS`; Final AI Security/Privacy Review `PASS`; `OWNER_RISK_ACCEPTANCE=ACCEPTED_FOR_LOCAL_SYNTHETIC_ONLY`; `AI_GENERATED_REVIEW`; `NOT_HUMAN_SIGNED`; human reviews deferred to the external gate. |

### Required post-code evidence

- Backend and frontend checks: `SATISFIED`, including Backend CI `PASS` and Frontend CI `PASS`.
- Real PostgreSQL evidence: `SATISFIED` on the dedicated disposable database and role.
- Targeted and full `dbIntegrationTest`: `SATISFIED`, respectively `8 PASS_EXECUTED` and `48 PASS_EXECUTED` across `12` classes.
- Local-user smoke: `SATISFIED`, `smoke_local_real=PASS_FRESH_DISPOSABLE_DB`.
- Final AI Technical and AI Security/Privacy reviews: `SATISFIED / PASS`; the artifacts remain `AI_GENERATED_REVIEW / NOT_HUMAN_SIGNED`.
- Merge and CI: `SATISFIED`, PR `#103` merged and both CI rails `PASS`.
- Post-merge verification: `SATISFIED`, including aligned `main`, clean pre-edit worktree and identical source/merge trees.
- These satisfied requirements do not authorize `043c` or an external participant.

Deferred debt, not implemented by this hotfix: two-person authentication, OIDC/SSO, MFA, independent sessions, real segregation of duties, KMS/Secret Manager, automated rotation, `jti` anti-replay, revocation, PostgreSQL RLS, global redaction, DLP, Windows Job Objects, complete process-tree termination, integrated backend lifecycle, automatic DB/role cleanup, retention policy, detailed membership audit, human review and pentest. The triggers restoring the corresponding gates are real/client data, any external user or participant, an external pilot, shared deployment, non-loopback access, production authentication or secret, first commercial use, external AI provider, exposed MCP, a claim of real segregation of duties or any external use of `043c`.

| Deferred debt | External trigger requiring it |
| --- | --- |
| Two-person authentication, OIDC/SSO, MFA, independent sessions, real segregation of duties | Any external user/participant or pilot, production authentication, or claim of real segregation of duties |
| KMS/Secret Manager and automated rotation | Production secret, shared deployment, or first commercial use |
| `jti` anti-replay and revocation | External user, production authentication, or first commercial use |
| PostgreSQL RLS | Real/client data or shared deployment |
| Global redaction and DLP | Real/client data, external AI provider, or exposed MCP |
| Windows Job Objects, complete process-tree termination, integrated backend lifecycle | Shared deployment or external participant |
| Automatic DB/role cleanup and retention policy | External pilot, real/client data, or shared deployment |
| Detailed membership audit | External user or claim of real segregation of duties |
| Human review and pentest | External gate, production, or first commercial use |

### Historical pre-hotfix record

The remainder of this 043b section preserves dated pre-hotfix evidence only. It is not the current safety posture or current file set.

The state immediately before the technical pre-audit correction loop was:

`IMPLEMENTED / NON_COMMITTED / BLOCKED_BY_TECHNICAL_PRE_AUDIT_CORRECTIONS / NOT_MERGE_READY`

At that historical stage, the corrected code and non-DB checks moved the sub-deliverable only to `CORRECTED_PENDING_LOCAL_DEDICATED_DB_EVIDENCE`.

### Mandatory entry gates

- `043a` accepted through its distinct CPO review: satisfied.
- CTO Gate completed before any `043b` code: satisfied with mandatory conditions `C1` to `C9`.
- Exact file set and post-code verification plan reconfirmed: satisfied.
- Frozen fixtures still match their hashes: satisfied at implementation entry.
- `042` remains backlog and `043` remains active: satisfied.

### Implemented outcome

The bounded implementation provides a local-only, two-actor harness for the same synthetic tenant:

- one common backend on `127.0.0.1:8080`;
- ACCOUNTANT Vite context on `127.0.0.1:5173`;
- REVIEWER Vite context on `127.0.0.1:5174`;
- strict ports, two distinct HS256 JWTs with an exact 60-minute TTL and no refresh, injected only into their respective server-side Vite processes;
- claims limited to `sub`, `iat`, `exp` and `jti`, with the signing secret removed from the child Vite environments;
- `/api/me` verification for both actors before any business action;
- roles and tenant resolved exclusively from PostgreSQL membership, never from role or tenant claims;
- no token in browser storage, URL, UI, shared log, command argument or repository file;
- all-or-nothing startup, periodic post-readiness `/api/me` verification, coordinated shutdown on child exit, invalid identity, signal, uncaught error or JWT expiration;
- redaction of both exact tokens, the exact HMAC value, Authorization headers and JWT-like strings on separate prefixed stdout/stderr readers;
- no production authentication change, login/logout UI, role switch, tenant switch, endpoint, contract, migration or dependency.

The implementation keeps `frontend/vite.config.ts`, `frontend/src/**`, lockfiles, production security configuration, migrations, contracts and OpenAPI unchanged.

The opt-in seed variant is exactly `043b-two-actor-pilot`. It keeps the default `036a` seed unchanged, adds the deterministic REVIEWER and the deterministic 043b folder/import/lines/mappings, and classifies the added dataset as `HARNESS_ONLY_AUTH_RBAC_DATASET`. It pre-seeds no workpaper, document, export pack, reviewer decision, client data or other tenant. A second identical seed is a no-op with no additional audit.

The dataset does not import or validate the frozen 043a fixture. It proves only local auth/RBAC/tenant harness behavior; it does not prove the complete closing path, `043c`, `R1`, `R2` or external readiness. `043c` will restart from frozen 043a fixtures in disposable database and storage environments if separately authorized.

### Exact corrected implementation file set

The corrected implementation is limited to these 17 files:

1. `backend/build.gradle.kts`
2. `backend/src/main/kotlin/ch/qamwaq/ritomer/devtools/DemoSeedLocalActivation.kt`
3. `backend/src/main/kotlin/ch/qamwaq/ritomer/devtools/DemoSeedLocalService.kt`
4. `backend/src/test/kotlin/ch/qamwaq/ritomer/devtools/DemoSeedLocalActivationTest.kt`
5. `backend/src/test/kotlin/ch/qamwaq/ritomer/devtools/DemoSeedLocalDatasetTest.kt`
6. `backend/src/test/kotlin/ch/qamwaq/ritomer/devtools/DemoSeedLocalDbIntegrationTest.kt`
7. `backend/src/test/kotlin/ch/qamwaq/ritomer/devtools/DemoSeedLocalAuthMeDbIntegrationTest.kt`
8. `backend/src/test/kotlin/ch/qamwaq/ritomer/devtools/DemoSeedLocalSourceGuardTest.kt`
9. `frontend/local-two-actor-harness.mjs`
10. `frontend/local-two-actor-harness.test.ts`
11. `frontend/local-demo-proxy.test.ts`
12. `frontend/package.json`
13. `runbooks/controlled-fiduciary-pilot-local-043.md`
14. `runbooks/local-dev.md`
15. `specs/active/043-controlled-fiduciary-pilot-readiness-v1.md`
16. `docs/product/v1-plan.md`
17. `evals/mapping/validate-042a2-human-review-governance-kit.mjs`

### Technical pre-audit corrections

- `dbIntegrationTest` skips only while `RITOMER_DB_TESTS_ENABLED` is not `true`; once enabled it fails closed unless the URL targets the exact `ritomer_043b_test` database, the username is exactly `ritomer_043b_test_runner`, a password variable is present and the exact destructive consent is present.
- Both destructive 043b DB test classes declare `DisposablePostgresTestDatabaseGuardInitializer`, which resolves the Spring datasource properties, checks consent before connection, executes only `select current_database(), current_user, session_user`, and refuses any identity other than the dedicated database/login/session triple before refresh and Flyway.
- Every 043b reset repeats the same identity guard through the injected datasource immediately before `TRUNCATE`.
- Startup `/api/me` readiness retries only connection failures, timeouts and HTTP `500..599`; all other HTTP statuses, invalid JSON, identity/tenant/role/membership mismatches, child exit and unknown failures stop on the first result. Redirects are observed without automatic following.
- The governance checker preserves worktree 043a, worktree 043b and PR #99 modes and adds the pinned `--profile 043b --base b208658fc37956e2e55fb89dfaaaccafea87277c --head <full-sha>` commit-range mode. That mode reads file content only from the head commit and requires exactly `14M / 3A` across the closed 17 paths.

### Historical required post-code evidence

- automated backend, frontend, fixture and governance checks must be freshly executed;
- `dbIntegrationTest` must execute against PostgreSQL, never H2, MockMvc-only or a skipped task;
- `smoke_local_real=NOT_RUN_USER_LOCAL_REQUIRED` until the local user runs the secret-dependent smoke;
- technical and Security/Privacy reviews are required before merge;
- implementation and automated checks do not authorize `043c` or an external participant.

If explicit PostgreSQL configuration is absent from the execution process, the result must be recorded as `ENV_BLOCKED_DB_INTEGRATION`; 043b is then implemented but neither fully post-code validated nor merge-ready.

Fresh Codex evidence on `2026-07-13` records exactly that state: `dbIntegrationTest` was `SKIPPED` because the explicit PostgreSQL test variables were absent from the process, so the result is `ENV_BLOCKED_DB_INTEGRATION`, not PASS. No `.env` or secret value was read or requested. Backend unit/modulith/build checks, frontend syntax/targeted/full/lint/build checks, frozen fixture validation and the pinned historical governance validation passed.

At that date, the required current-worktree governance command was also red for an explicit scope reason: the unchanged 043a validator accepted only a clean tree or its exact 14-path documentation/fixture whitelist and rejected every backend/frontend/manifest change, while that mission authorized only the exact 15-path 043b runtime set. Updating the validator would then have required a forbidden sixteenth file. This was recorded as `CHECK_BLOCKED_APPROVED_FILE_SET`, never as PASS.

Those `2026-07-13` results remain dated history, including `ENV_BLOCKED_DB_INTEGRATION`, `CHECK_BLOCKED_APPROVED_FILE_SET`, the earlier `smoke_local_real=NOT_RUN_USER_LOCAL_REQUIRED` and the earlier `PASS_COMBINED_EVIDENCE`. They are not overwritten by the hotfix. The historical checker accepted the former 17-path worktree and its simulated base-to-commit range. The current hotfix state is defined above.

### Stop conditions

Stop and replan if implementation would require a production auth change, mint endpoint, browser-side token, JWT-controlled role/tenant, non-loopback target, migration, public API contract, dependency or modification outside the approved `043b` file set.

## 043c - Internal rehearsal and readiness decision

Status: `NOT_STARTED / NOT_AUTHORIZED`.

### Mandatory entry gates

- `043b` Final AI Technical Review is `PASS`.
- `043b` Final AI Security/Privacy Review is `PASS`.
- Owner risk acceptance is limited to local synthetic use.
- Human technical and Security reviews have not occurred; they remain deferred to the external gate and become mandatory again on any external-use trigger.
- A distinct post-`043b` CPO decision is still required before `043c`.
- The internal protocol and disposable database/storage controls must be reconfirmed before `R1`.
- Until both remaining entry conditions are satisfied, `043c` remains `NOT_STARTED / NOT_AUTHORIZED`; neither `R1` nor `R2` may begin.

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
