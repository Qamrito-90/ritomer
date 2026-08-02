# 043 - Controlled fiduciary pilot readiness V1

## Status

Active.

- `043a`: `ACCEPTED_BY_DISTINCT_CPO_REVIEW`.
- `043b`: `LOCAL_SYNTHETIC_SIMULATION_VALIDATED / MERGED / AI_REVIEWED / OWNER_RISK_ACCEPTED_FOR_LOCAL_SYNTHETIC_ONLY / NOT_HUMAN_SIGNED / NOT_PRODUCTION_READY / NOT_EXTERNAL_READY / NOT_SEPARATION_OF_DUTIES_PROOF`.
- `043c v1` historical, quarantined and non-current:
  `PREPARATORY_IMPLEMENTED_PENDING_POST_CODE_CPO / EXECUTION_NOT_AUTHORIZED /
  R1_NOT_STARTED_NOT_AUTHORIZED / R2_NOT_STARTED_NOT_AUTHORIZED`.
- `043c v2` current: `D0-D2 / P0_LOCAL_IMPLEMENTATION /
  IMPLEMENTED_PENDING_P0_DELIVERY / NOT_EXECUTABLE`.
- Current sub-deliverable: `043c v2 P0 local implementation`, risk C, exactly
  eight authorized paths (`4M/4A` after commit).
- No transition between `043a`, `043b` and `043c` is automatic.

## Roadmap declaration

| Field | Value |
| --- | --- |
| Roadmap phase | Phase 0 - alpha interne reproductible |
| Primary workstream | Produit fiduciaire |
| Supporting workstream | Trust & operations |
| Outcome | Prove that the synthetic closing workflow can be rehearsed internally in a reproducible, controlled and evidence-bearing way. |
| Exit evidence | Frozen synthetic fixtures, deterministic validation, controlled single-operator two-role local simulation, then either two complete internal rehearsals for F1 or a cleanup-backed stop after R1/R2 for F2/F3, always with an explicit CPO decision. |
| Gate targeted | CPO decision on whether external-gate review may begin; never an external invitation by itself. |

The canonical outcome roadmap is `docs/product/product-roadmap.md`. This spec remains the detailed source of truth for `043`.

## Normative boundary

`043` prepares only level A readiness.

In `043c`, the F1 path is tested through two complete executions, `R1` and `R2`, of one strictly internal rehearsal protocol. A cleanup-backed interrupted or incomplete run may instead terminate through the human F2/F3 path; it never authorizes the following run.

`043` invites no external fiduciary. `043` collects no real participant observation.

The first external invitation requires a new CPO decision and prior satisfaction of both the fiduciary gate and the Security/Privacy gate. `GO_TO_EXTERNAL_GATE_REVIEW` is neither an invitation nor an authorization to collect observations.

No following spec is created automatically.

Each of `043a`, `043b` and `043c` requires a distinct CPO review. The distinct review of `043a` and the prior CTO Gate for `043b` are complete. The CTO Gate approved the local architecture with conditions for local synthetic use only. The local evidence and final post-code AI reviews for `043b` are complete. The former `043c` preparatory decision and S2 baseline are historical v1 facts only. The current v2 authority consists of D0, D1 and the P0 implementation evidence D2; it authorizes only the exact eight-path local implementation, never delivery or execution. A separate post-code CPO review, delivery authority, reviews on one exact head, merge authority, recovery selection, qualification and CTO Freeze Gate D5 remain mandatory before any run-specific authority. Human technical and Security reviews are deferred to the external gate and become mandatory again on any external-use trigger defined below.

## Surface and risk

| Sub-deliverable | Surface | Risk |
| --- | --- | --- |
| `043a` | `DOCS_GIT / FIXTURES_SYNTHETIQUES / GOVERNANCE_CHECKS` | B |
| `043b` | `BACKEND_LOCAL_AUTH / BACKEND_TEST_SAFETY / FRONTEND_LOCAL_HARNESS / CI_GIT / DOCS_GIT / SECURITY_DEBT_GOVERNANCE` | C for destructive PostgreSQL safety; B otherwise |
| `043c` preparation v1, historical and non-current | `DOCS_GIT / GOVERNANCE_CHECKS` | B (historical) |
| `043c` v2 P0, current | `DOCS_GIT / GOVERNANCE_CHECKS` | C |
| `043c` v2 R1/R2, not authorized by this increment | `QA_MANUAL / LOCAL_RUNTIME / DOCS_GIT` | C |

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

## 043c v1 - Historical quarantined rehearsal protocol

Everything from this heading through "Historical v1 preparatory acceptance" is
frozen historical v1 truth, not the current 043c state or Definition of Done.

Historical v1 status, non-current:
`PREPARATORY_IMPLEMENTED_PENDING_POST_CODE_CPO / EXECUTION_NOT_AUTHORIZED /
R1_NOT_STARTED_NOT_AUTHORIZED / R2_NOT_STARTED_NOT_AUTHORIZED`.

Historical v1 preparatory durable baseline, non-current:

`S2 = 043C_PREPARATORY_IMPLEMENTED_PENDING_POST_CODE_CPO`

For v1 forensic replay only, the durable truth is the last valid record of its
generic ledger. Its S0-S4 records are quarantined evidence and never compete
with the current v2 D0-D2 ledger.

The CPO decision represented by this increment grants only:

- `CPO_043C_PLAN_AUTHORIZATION=GRANTED`;
- `CPO_043C_PREPARATORY_IMPLEMENTATION_AUTHORIZATION=GRANTED`.

It does not grant:

- `043C_EXECUTION_AUTHORIZATION=NOT_GRANTED`;
- `R1_ONLY`;
- `R2_ONLY`;
- external use, real data, production or any following spec.

No S3, S4, S5, S6, S7, S8, S9, S10 or terminal record is materialized by this increment.

### Historical v1 preparatory file set - non-current

The historical v1 preparatory implementation was closed to exactly four paths:

1. `M specs/active/043-controlled-fiduciary-pilot-readiness-v1.md`
2. `M runbooks/controlled-fiduciary-pilot-local-043.md`
3. `M evals/mapping/validate-042a2-human-review-governance-kit.mjs`
4. `?? runbooks/validate-controlled-fiduciary-pilot-043c-state.ps1` (`A` only in a future committed historical range)

The historical v1 worktree matrix was `3M / 1UNTRACKED` with an empty index;
its committed historical matrix was `3M / 1A / 0D / 0R / 0C`. These values
are not current acceptance criteria. No backend, frontend, contract, migration,
fixture, policy, dependency, manifest, lockfile, `.env`,
`docs/product/v1-plan.md` or spec `044+` belonged to that historical increment.

### Durable state ledger

The ledger is append-only at the documentary governance level. Generic validation accepts every valid machine prefix ending at S0, S1, S2, S3, S4, S7, S10 or one unique F1/F2/F3 terminal. Each JSONL record contains exactly sixteen fields in the fixed order shown by the records below. `resourceTargetSha256` is forbidden in this durable block.

<!-- 043C_DURABLE_STATE_LEDGER_BEGIN -->
{"schemaVersion":1,"sequence":0,"state":"043C_PLAN_HARDENED_IMPLEMENTATION_NOT_AUTHORIZED","previousState":null,"recordedAtUtc":"2026-07-29T14:43:47.532Z","recordedByRole":"CPO","authorityType":"CPO_PLAN_HARDENING_DECISION","authorityRef":"043c-plan-hardened-v1","protocolId":null,"protocolSha256":null,"frozenCommit":null,"r1Authorized":false,"r2Authorized":false,"completedRun":null,"evidenceSha256":null,"cpoOutcome":null}
{"schemaVersion":1,"sequence":1,"state":"043C_PREPARATORY_IMPLEMENTATION_AUTHORIZED","previousState":"043C_PLAN_HARDENED_IMPLEMENTATION_NOT_AUTHORIZED","recordedAtUtc":"2026-07-29T14:43:47.658Z","recordedByRole":"CPO","authorityType":"CPO_PREPARATORY_IMPLEMENTATION_DECISION","authorityRef":"043c-preparatory-implementation-authorized-v1","protocolId":null,"protocolSha256":null,"frozenCommit":null,"r1Authorized":false,"r2Authorized":false,"completedRun":null,"evidenceSha256":null,"cpoOutcome":null}
{"schemaVersion":1,"sequence":2,"state":"043C_PREPARATORY_IMPLEMENTED_PENDING_POST_CODE_CPO","previousState":"043C_PREPARATORY_IMPLEMENTATION_AUTHORIZED","recordedAtUtc":"2026-07-29T14:43:47.692Z","recordedByRole":"PREPARATION_OWNER","authorityType":"PREPARATORY_IMPLEMENTATION_EVIDENCE","authorityRef":"043c-preparatory-implementation-evidence-v1","protocolId":"043c-internal-rehearsal-v1","protocolSha256":"7e5430a63c0b94a3643beffef08b47bf60870ce17b73e453991de978cbf30fe4","frozenCommit":null,"r1Authorized":false,"r2Authorized":false,"completedRun":null,"evidenceSha256":null,"cpoOutcome":null}
{"schemaVersion":1,"sequence":3,"state":"043C_POST_CODE_CPO_PASS_PENDING_CTO","previousState":"043C_PREPARATORY_IMPLEMENTED_PENDING_POST_CODE_CPO","recordedAtUtc":"2026-07-31T12:54:09.772Z","recordedByRole":"CPO","authorityType":"CPO_POST_CODE_REVIEW","authorityRef":"043c-post-code-cpo-pass-pr105-v1","protocolId":"043c-internal-rehearsal-v1","protocolSha256":"7e5430a63c0b94a3643beffef08b47bf60870ce17b73e453991de978cbf30fe4","frozenCommit":null,"r1Authorized":false,"r2Authorized":false,"completedRun":null,"evidenceSha256":null,"cpoOutcome":null}
{"schemaVersion":1,"sequence":4,"state":"043C_PROTOCOL_FROZEN_READY_FOR_R1_DECISION","previousState":"043C_POST_CODE_CPO_PASS_PENDING_CTO","recordedAtUtc":"2026-07-31T16:14:43.752Z","recordedByRole":"CTO","authorityType":"CTO_GATE","authorityRef":"043c-cto-gate-s3-to-s4-pr106-v1","protocolId":"043c-internal-rehearsal-v1","protocolSha256":"7e5430a63c0b94a3643beffef08b47bf60870ce17b73e453991de978cbf30fe4","frozenCommit":"046aa64e05eeb280833d7c7ef9d3161a64b73af4","r1Authorized":false,"r2Authorized":false,"completedRun":null,"evidenceSha256":null,"cpoOutcome":null}
<!-- 043C_DURABLE_STATE_LEDGER_END -->

The S2 `protocolSha256` is calculated on the exact UTF-8/LF bytes between the unique protocol markers in `runbooks/controlled-fiduciary-pilot-local-043.md`. It is not calculated on a normalized or reserialized string.

Durable records use only these roles:

- `CPO`;
- `PREPARATION_OWNER`;
- `CTO`;
- `COORDINATOR_043C`.

They use only these authority types:

- `CPO_PLAN_HARDENING_DECISION`;
- `CPO_PREPARATORY_IMPLEMENTATION_DECISION`;
- `PREPARATORY_IMPLEMENTATION_EVIDENCE`;
- `CPO_POST_CODE_REVIEW`;
- `CTO_GATE`;
- `R1_CLEANUP_EVIDENCE`;
- `R2_CLEANUP_EVIDENCE`;
- `CPO_FINAL_DECISION`.

The closed state/role/authority matrix is:

| Durable state | Role | Authority |
| --- | --- | --- |
| S0 | `CPO` | `CPO_PLAN_HARDENING_DECISION` |
| S1 | `CPO` | `CPO_PREPARATORY_IMPLEMENTATION_DECISION` |
| S2 | `PREPARATION_OWNER` | `PREPARATORY_IMPLEMENTATION_EVIDENCE` |
| S3 | `CPO` | `CPO_POST_CODE_REVIEW` |
| S4 | `CTO` | `CTO_GATE` |
| S7 | `COORDINATOR_043C` | `R1_CLEANUP_EVIDENCE` |
| S10 | `COORDINATOR_043C` | `R2_CLEANUP_EVIDENCE` |
| F1/F2/F3 | `CPO` | `CPO_FINAL_DECISION` |

Every `authorityRef` must match `^043c-[a-z0-9][a-z0-9-]{6,95}$` and contain no identity, path, URL, secret or business data.

Ledger invariants:

- `sequence` starts at zero and increases by exactly one.
- `recordedAtUtc` uses strict UTC milliseconds and increases strictly.
- S0/S1 have null protocol id/hash; S2 and later bind the one protocol id/hash.
- `frozenCommit` stays null through S3 and is mandatory from S4.
- `S4_FROZEN_COMMIT_BINDING=TRANSITION_BASE_EXACT`.
- For a historical S3→S4 `043c-transition`, the appended S4 record must bind `frozenCommit` to the exact transition `range.base`; for the uncommitted worktree transition, it must bind `frozenCommit` to the exact current `HEAD`.
- Any arbitrary SHA is rejected, and every transition after S4 preserves the exact S4 `frozenCommit`.
- `r1Authorized` and `r2Authorized` stay false in every durable record because active run authorizations are local only.
- `previousState` is the exact transition source. S7 therefore names S6 and S10 names S9 even though those sources are local.
- S7 has `completedRun=R1` for a complete R1 and `null` for an interrupted R1.
- S10 has `completedRun=R2` for a complete R2 and `R1` for an interrupted R2.
- F1 requires `completedRun=R2`; F2/F3 preserve the last factually completed run.
- `evidenceSha256` is null through S4 and mandatory from S7.
- `cpoOutcome` is null through S10 and equals the exact terminal outcome at F1/F2/F3.
- S10 is receivable only after a durable S7 with `completedRun=R1`; its declared `previousState` remains the local source S9.
- F2/F3 name their immediately preceding S7 or S10 source checkpoint exactly in `previousState` and copy both `completedRun` and `evidenceSha256` from it.
- A terminal is unique, last and has no outgoing state.

### Historical v1 closed ledger validation profiles - non-current

The historical `WORKTREE_043C_PREPARATORY` profile remains available only for
forensic replay:

- exactly the four preparatory paths;
- exactly three ledger records with last state S2;
- empty index and exact `3M/1UNTRACKED`.

The future `WORKTREE_043C_DURABLE_TRANSITION` profile is closed to:

- only `M specs/active/043-controlled-fiduciary-pilot-readiness-v1.md`;
- empty index, no untracked path and no spec `044+`;
- exactly one JSONL record appended;
- zero prior-record modification or deletion;
- zero byte changed outside the marked ledger block;
- an allowed source/target transition with no local-only durable state.

The historical `043c-transition` profile verifies one direct single-parent `base→head` commit with exactly `1 M` on this spec and the same one-record append-only proof.

### Historical v1 mandatory entry gates - non-current

- `043b` Final AI Technical Review is `PASS`.
- `043b` Final AI Security/Privacy Review is `PASS`.
- Owner risk acceptance is limited to local synthetic use.
- Human technical and Security reviews have not occurred; they remain deferred to the external gate and become mandatory again on any external-use trigger.
- The historical distinct CPO decision for v1 preparatory implementation was satisfied.
- The historical v1 path required a distinct CPO post-code review of its exact four-path diff for S2 to S3; no v2 authority is derived from it.
- A new CTO Gate must bind the protocol hash and future frozen commit before S3 to S4.
- `PreparationPreflight` must succeed from S4 before a distinct CPO `R1_ONLY` decision may create local S5.
- Neither R1 nor R2 may begin from S2.

### Historical v1 exact state machine and gates - non-current

| ID | Exact state | Storage |
| --- | --- | --- |
| S0 | `043C_PLAN_HARDENED_IMPLEMENTATION_NOT_AUTHORIZED` | durable |
| S1 | `043C_PREPARATORY_IMPLEMENTATION_AUTHORIZED` | durable |
| S2 | `043C_PREPARATORY_IMPLEMENTED_PENDING_POST_CODE_CPO` | durable |
| S3 | `043C_POST_CODE_CPO_PASS_PENDING_CTO` | durable |
| S4 | `043C_PROTOCOL_FROZEN_READY_FOR_R1_DECISION` | durable |
| S5 | `R1_ONLY_AUTHORIZED_NOT_STARTED` | local only |
| S6 | `R1_STARTED_CLEANUP_NOT_VALIDATED` | local only |
| S7 | `R1_CLEANUP_VALIDATED_READY_FOR_R2_DECISION` | durable |
| S8 | `R2_ONLY_AUTHORIZED_NOT_STARTED` | local only |
| S9 | `R2_STARTED_CLEANUP_NOT_VALIDATED` | local only |
| S10 | `R2_CLEANUP_VALIDATED_READY_FOR_FINAL_CPO_DECISION` | durable |
| F1 | `GO_TO_EXTERNAL_GATE_REVIEW` | durable terminal |
| F2 | `NO_GO` | durable terminal |
| F3 | `INCONCLUSIVE` | durable terminal |

There is no S11. S5/S6/S8/S9 are forbidden as durable Git records.

The complete gate sequence is:

1. S0→S1: CPO preparatory implementation decision.
2. S1→S2: historical exact `3M/1A` diff and preparatory checks.
3. S2→S3: human CPO post-code review.
4. S3→S4: CTO Gate on diff, protocol, hash and frozen commit.
5. S4→S5: successful `PreparationPreflight`, then CPO `R1_ONLY`.
6. S5→S6: operator provisioning, successful `PreR1`, then atomic local state.
7. S6→S7: T15 and verified R1 cleanup, whether the run was complete or aborted.
8. S7→S8: only after complete R1, R1 audit `15/0/0`, `completedRun=R1` and a separate CPO `R2_ONLY`.
9. S7→F2/F3: separate human CPO decision after verified R1 cleanup; F1 is forbidden from S7.
10. S8→S9: operator provisioning, successful `PreR2`, then atomic local state.
11. S9→S10: T15 and verified R2 cleanup, whether the run was complete or aborted.
12. S10→F1/F2/F3: separate human CPO decision; F1 additionally requires both runs complete and both audits `15/0/0`.

Post-cleanup success and business success are separate facts. `PostR1Cleanup` and `PostR2Cleanup` return exactly one of:

- `CLEANUP_VERIFIED_RUN_COMPLETE`;
- `CLEANUP_VERIFIED_RUN_ABORTED`.

A verified aborted R1 reaches S7 with `completedRun=null`, blocks S8, and permits only F2/F3. A verified aborted R2 reaches S10 with `completedRun=R1`, blocks F1, and permits F2/F3.

If T15 is interrupted, the state remains S6 or S9. No durable checkpoint or terminal is recorded. The operator resumes the same T15 under the same run and authorization; that continuation is not a new run or a second business T15.

`POST_R2_COMPLETE_R1_PRECONDITION=REQUIRED`. `PostR2Cleanup` cumulatively requires durable S7, local S9, valid bindings, valid R1 evidence, valid R2 evidence, `completedRun=R1`, R1 outcome `COMPLETED`, R1 missing count `0`, R1 unexpected count `0`, and both R1/R2 resource targets absent. A forged S9 snapshot cannot compensate for an aborted or incomplete R1. R2 itself may be `COMPLETED` or `ABORTED`.

### Historical v1 frozen protocol and local schemas - non-current

The complete canonical protocol, T00–T15, exact audit matrix and full multiset SQL are frozen in `runbooks/controlled-fiduciary-pilot-local-043.md` under `protocolId=043c-internal-rehearsal-v1`.

At the S3→S4 boundary, `S4_FROZEN_COMMIT_BINDING=TRANSITION_BASE_EXACT`: an uncommitted worktree S4 record binds the exact current `HEAD`, while a historical one-commit `043c-transition` binds the exact direct parent `range.base`. After that transition commit, the bound value is a strict ancestor of `HEAD` and remains byte-for-byte stable in every future record. The worktree is clean and every descendant commit through `HEAD` must be linear and modify only the spec 043 by one valid ledger-record append. Clean means both an empty porcelain status and no tracked index entry carrying `assume-unchanged`, `skip-worktree` or any unexpected `git ls-files -v` tag. The validator checks every commit so a forbidden runtime or documentation change followed by a revert is still rejected. The protocol blocks in `frozenCommit`, `HEAD` and the clean worktree are byte-identical, and no spec byte outside the ledger may change.

The read-only validator has exactly six modes:

- `SelfTest`;
- `PreparationPreflight`;
- `PreR1`;
- `PostR1Cleanup`;
- `PreR2`;
- `PostR2Cleanup`.

The future local files are documented and validated but are not created by this increment:

- `authorization.json`: exactly nine fields;
- `state/active-state.json`: exactly nine fields;
- `runs/R1/evidence-summary.json` and `runs/R2/evidence-summary.json`: exactly fourteen fields.

`resourceTargetSha256` is bound to a deterministic 180-byte UTF-8/LF descriptor per run. `ABORT_START_CONVENTION=NULL_ONLY_BEFORE_OR_AT_T00`: an `ABORTED` proof may keep `runStartedAtUtc=null` only when `lastCompletedTask` is `null` or `T00`; a non-null start is mandatory from `T01` onward. `runEndedAtUtc` and the abort reason remain mandatory. A `COMPLETED` proof requires a non-null start and `lastCompletedTask=T14`; T00 is never a completed run. An aborted proof keeps `expectedBusinessEventCount=15`, a missing count from 0 to 15 and a non-negative unexpected count from the final read-only snapshot; those counters never upgrade `ABORTED` to business success.

The PostgreSQL proof is deliberately cluster-level, not application readiness. For each R1/R2 runner it requires LOGIN, no SUPERUSER/CREATEDB/CREATEROLE/REPLICATION/BYPASSRLS, zero explicit membership and exact database ownership. The sole catalogue authentication channel is operator-managed PostgreSQL 17 Windows SSPI with fixed non-privileged reader `ritomer_043c_catalog_reader`, `require_auth=sspi`, `--no-password`, no credential and no fallback. `PreR1` and `PreR2` separately require `ApplicationReadiness=EXACT_STATE_PROVEN`; because no exact post-Flyway/seed application state is currently normalized, the current adapter fixes it to `NOT_PROVEN` and both modes remain fail-closed.

`LOCAL_APPLICATION_DATA_ROOT_POLICY=WINDOWS_FIXED_LOCAL_ONLY`. `%LOCALAPPDATA%` must be a non-empty, fully qualified canonical Windows `X:\...` path whose known root has `DriveType=Fixed`. UNC paths, a network share, a mapped network drive, a device path, URI paths, root-relative paths, drive-relative paths and other relative paths are rejected. Any network redirection fails closed; no automatic override exists. This policy is validated before any resource-state, storage or JSON read. Storage validation then covers every existing component from the approved `LocalApplicationData` root through `Ritomer/043c/<protocolId>/runtime/R1|R2/storage`. Every component must be the canonical directory under its approved parent and must not be a reparse point, junction or symlink. An absent target is `ABSENT` only when its existing parent chain is safe; an unsafe parent produces `OTHER`.

SEC-043C-005 étend la même règle fail-closed à `authorization.json`, `state\active-state.json`, `runs\R1\evidence-summary.json` et `runs\R2\evidence-summary.json`. `LOCAL_ARTIFACT_PATH_CONFINEMENT=STORAGE_AND_FOUR_JSON_ARTIFACTS` signifie que le storage, chacun de ces quatre artefacts, tous leurs parents existants et les fichiers finaux eux-mêmes doivent rester sur leur chemin canonique exact sous la racine `LocalApplicationData` approuvée. Aucun parent ni fichier final ne peut être une junction, un symlink, un reparse point ou une résolution extérieure à cette racine. Une absence n'est recevable que si toute la chaîne parente existante est canonique, accessible et sûre ; un parent fichier, inaccessible, reparse ou extérieur fait échouer le contrôle.

### Internal rehearsal boundary

The F1 path runs two executions, `R1` and `R2`, of the same strictly internal synthetic rehearsal. Each covers context, balance import, manual mapping, workpaper/evidence preparation, maker-to-reviewer handoff, reviewer verification, audit-ready export and usefulness assessment.

Each execution uses a separate disposable database and storage root. `R2` cannot begin until `R1` cleanup is proved. The canonical database, real customer data and external participants are forbidden. Runtime secrets remain local and must never enter Git, chat, logs or the observation template.

`CHECK_FINAL_CPO` is human-only, is not a T task and is not a validator mode. It may run from S7 for F2/F3 or from S10 for F1/F2/F3. The only allowed outcomes are:

- `GO_TO_EXTERNAL_GATE_REVIEW`;
- `NO_GO`;
- `INCONCLUSIVE`.

`GO_TO_EXTERNAL_GATE_REVIEW` does not authorize an invitation, collection, real data or a following spec. F3 is terminal for this protocol instance; any new attempt requires a new governed decision/protocol. A future closure may move `043` to Done only on an explicit terminal decision, and it creates no next spec.

### Historical v1 preparatory acceptance - non-current

- The historical worktree contained exactly the four v1-authorized paths with
  matrix `3M/1UNTRACKED` and an empty index; this is not the v2 P0 file-set.
- The durable block contains exactly S0, S1 and S2 with sixteen fields each.
- The S2 protocol hash matches the unique runbook block byte for byte.
- The PowerShell validator is statically read-only and its `SelfTest` is fully in-memory with exactly `91/91/0` probes.
- The checker accepts `WORKTREE_043C_PREPARATORY`, preserves all earlier profiles, adds historical `043c-preparation` pinned to base `1ecddd81e255bc049558e5f90bf65db394558d67`, and defines the future closed worktree/historical `043c-transition` profiles.
- The checker and validator buffer success output; no final line contains `PASS` when an error exists.
- Frozen fixture validation, allowed syntax/parsing checks, worktree checker and historical profiles are green.
- The real historical `043c-preparation` base→head check remains `NOT_RUN_NO_COMMIT_BY_SCOPE` because this increment creates no commit.
- No runtime, PostgreSQL, psql, Flyway, backend, Vite, browser, seed, smoke, R1 or R2 is executed.
- S2 still requires CPO post-code review and CTO Gate before any run-specific authorization.
- The catalogue result is cluster-level only, the SSPI contract is fail-closed, every runner has zero explicit membership, every storage ancestor is checked, and PreR1/PreR2 remain blocked until a separately governed exact application-readiness proof exists.

### 043c v2 — récupération versionnée append-only

#### Vérité courante P0 v2

La vérité courante de ce sous-livrable est exclusivement v2 : risque C,
`P0_LOCAL_IMPLEMENTATION / D0-D2 / IMPLEMENTED_PENDING_P0_DELIVERY /
NOT_EXECUTABLE`. Elle remplace comme vérité d'exécution les anciens statuts,
matrices et critères d'acceptation v1, qui restent seulement forensiques.

Le file-set P0 est fermé à exactement huit chemins :

1. `M specs/active/043-controlled-fiduciary-pilot-readiness-v1.md`
2. `M runbooks/controlled-fiduciary-pilot-local-043.md`
3. `M docs/product/v1-plan.md`
4. `M runbooks/validate-controlled-fiduciary-pilot-043c-state.ps1`
5. `A runbooks/controlled-fiduciary-pilot-local-043c-v2.md`
6. `A evals/pilot/043c/recovery-ledger-v2.jsonl`
7. `A evals/pilot/043c/validate-recovery-v2.mjs`
8. `A runbooks/validate-controlled-fiduciary-pilot-043c-v2-state.ps1`

Le worktree attendu est `4M/4UNTRACKED` avec index vide ; la plage historique
P0 attendue sera `4M/4A/0D/0R/0C`. Aucun neuvième chemin, commit, push, PR,
qualification, runtime, PostgreSQL, secret, donnée réelle ou livraison n'est
autorisé par D0-D2.

#### Autorité courante et quarantaine v1

Le protocole et le ledger v1 sont désormais une provenance historique
quarantainée. Ils restent byte-identiques et ne sont plus exécutables ni
transitionnables :

- protocole v1 : `41438` octets, SHA-256
  `7e5430a63c0b94a3643beffef08b47bf60870ce17b73e453991de978cbf30fe4` ;
- ledger v1 : `2645` octets, SHA-256
  `c0d574832011332c75860d7caef1441aeb6ae94edf61e218502049be32b92b77` ;
- SQL T14 : `11324` octets, SHA-256
  `4e3539099197c4152e46756fb202233869698434a5505034d1fa071901184745` ;
- `V1_EXECUTION=PERMANENTLY_NOT_AUTHORIZED` ;
- `V1_FURTHER_LEDGER_TRANSITIONS=FORBIDDEN` ;
- `NO_FALLBACK_V1=YES`.

Les décisions CPO D0 et D1 sont distinctes et non déductibles l'une de
l'autre :

- D0 : `043c-v2-d0-plan-hardening-decision`, autorité survenue le
  `2026-08-01T23:42:26.302Z` ;
- D1 : `043c-v2-d1-implementation-authorization`, autorité survenue le
  `2026-08-02T04:43:41.000Z`.

D1 autorise seulement l'implémentation locale P0 et ses checks. Toutes les
autorisations d'exécution restent fausses. `DELIVERY_AUTHORIZED` et
`MERGE_AUTHORIZED` restent des décisions externes au ledger et valent `NO`.

#### Incident et sélection immuables

Le bloc suivant est une photographie PLAN_ONLY historique. Son unique ligne
JSON est UTF-8 strict sans BOM, LF-only, avec ordre de propriétés fermé. Son
SHA-256 couvre la ligne JSON et son LF terminal, marqueurs exclus.

<!-- 043C_V2_INCIDENT_SELECTION_BEGIN -->
{"schemaVersion":2,"recordType":"043C_V2_INCIDENT_SELECTION","incidentId":"043c-v1-pr107-freeze-linearity-incident","primaryIncident":{"pullRequest":107,"createdAtUtc":"2026-07-31T21:56:31.000Z","mergedAtUtc":"2026-08-01T04:29:18.000Z","requiredMergeMethod":"SQUASH","requiredFinalParentCount":1,"baseCommit":"046aa64e05eeb280833d7c7ef9d3161a64b73af4","baseParentCount":2,"baseParents":["534226772508e9f2998bdbad0cd786a468ebff33","84406bb54de796821709f84c05da5bb826dde3bb"],"baseTree":"e21f5e44fd88dd6c1b69ea758f28b0ecc6c04d1e","sourceCommit":"a0686605f47d8e4b373173731330f66dd14901ce","sourceParentCount":1,"sourceParents":["046aa64e05eeb280833d7c7ef9d3161a64b73af4"],"sourceTree":"5ccbde08508092b684943959ce52c80f0e672296","mergeCommit":"27f230d8f641dcda89821e1b9d15434149741f84","mergeParentCount":2,"mergeParents":["046aa64e05eeb280833d7c7ef9d3161a64b73af4","a0686605f47d8e4b373173731330f66dd14901ce"],"mergeTree":"5ccbde08508092b684943959ce52c80f0e672296","actualMergeMethod":"MERGE_COMMIT","sourceMergeTreeIdentical":true},"forensicPrecedent":{"pullRequest":106,"createdAtUtc":"2026-07-31T13:21:30.000Z","mergedAtUtc":"2026-07-31T13:40:51.000Z","requiredMergeMethod":null,"baseCommit":"534226772508e9f2998bdbad0cd786a468ebff33","baseParentCount":2,"baseParents":["1ecddd81e255bc049558e5f90bf65db394558d67","4f8cfed4347cfbe2de64fecc54490eac09fc9bd7"],"baseTree":"7f13f26fcb0d01632e3f57eeb2fc4d3a03c6416c","sourceCommit":"84406bb54de796821709f84c05da5bb826dde3bb","sourceParentCount":1,"sourceParents":["534226772508e9f2998bdbad0cd786a468ebff33"],"sourceTree":"e21f5e44fd88dd6c1b69ea758f28b0ecc6c04d1e","mergeCommit":"046aa64e05eeb280833d7c7ef9d3161a64b73af4","mergeParentCount":2,"mergeParents":["534226772508e9f2998bdbad0cd786a468ebff33","84406bb54de796821709f84c05da5bb826dde3bb"],"mergeTree":"e21f5e44fd88dd6c1b69ea758f28b0ecc6c04d1e","actualMergeMethod":"MERGE_COMMIT","sourceMergeTreeIdentical":true},"cause":{"primary":"PR107_MERGED_WITH_TWO_PARENTS_DESPITE_SQUASH_SINGLE_PARENT_CONTRACT","protocolEffect":"V1_FROZEN_DESCENDANT_LINEARITY_BROKEN","subsequent":"POST_S4_NON_LEDGER_COMMITS_BREAK_V1_DESCENDANT_FILE_SET","firstViolatingCommit":"27f230d8f641dcda89821e1b9d15434149741f84","subsequentViolatingCommits":["dfeef921136eafa26d0b0e9c2cc7a299edb740a7","798f3bc03dc7351691dcfcd9f1025b51809cec67"],"mergeCommand":"NON_DETERMINED"},"v1":{"protocolId":"043c-internal-rehearsal-v1","protocolBytes":41438,"protocolSha256":"7e5430a63c0b94a3643beffef08b47bf60870ce17b73e453991de978cbf30fe4","ledgerBytes":2645,"ledgerSha256":"c0d574832011332c75860d7caef1441aeb6ae94edf61e218502049be32b92b77","frozenCommit":"046aa64e05eeb280833d7c7ef9d3161a64b73af4","lastDurableState":"043C_PROTOCOL_FROZEN_READY_FOR_R1_DECISION","status":"QUARANTINED_PERMANENTLY_NOT_AUTHORIZED","furtherLedgerTransitions":"FORBIDDEN","bytePreservation":"REQUIRED"},"selection":{"decision":"CONTINUE_SIMPLIFIED_043C_V2","status":"PLAN_ONLY_SELECTED_NOT_EXECUTABLE","selectedProtocolId":"043c-internal-rehearsal-v2","currentProtocolId":"043c-internal-rehearsal-v1","executableProtocolId":null,"runtimeV1Import":"FORBIDDEN","runtimeV1Selection":"FORBIDDEN","fallbackV1":"FORBIDDEN"},"authorizations":{"implementationAuthorized":false,"deliveryAuthorized":false,"mergeAuthorized":false,"v1ExecutionAuthorized":false,"v2ExecutionAuthorized":false,"r1Authorized":false,"r2Authorized":false,"externalUseAuthorized":false,"realDataAuthorized":false,"productionAuthorized":false},"integrity":{"algorithm":"SHA-256","coverage":"UTF8_LF_JSON_LINE_WITH_TERMINAL_LF_EXCLUDING_MARKERS","immutability":"BYTE_IDENTICAL_AFTER_FIRST_MERGE","futureCorrection":"NEW_VERSIONED_PROTOCOL_AND_LEDGER_WITH_CPO_SCOPE_EXCEPTION"}}
<!-- 043C_V2_INCIDENT_SELECTION_END -->

La ligne fait exactement `3680` octets LF inclus et porte le SHA-256
`1419edb3f46c1472f7333b0a8970fb3897f5f534693229ce123dc9b53eb9ea8b`.
Ses booléens `implementationAuthorized=false`, `deliveryAuthorized=false` et
`mergeAuthorized=false` décrivent la sélection PLAN_ONLY historique, jamais
l'autorité courante après D1. La hiérarchie normative est :

1. bloc incident/sélection = provenance historique figée ;
2. dernier record valide du ledger v2 = état durable courant ;
3. delivery et merge = décisions externes liées à un head/base précis.

#### Protocole v2

Le protocole autonome utilise `protocolId=043c-internal-rehearsal-v2` et les
marqueurs `<!-- 043C_PROTOCOL_V2_BEGIN -->` et
`<!-- 043C_PROTOCOL_V2_END -->`. `protocolSha256` est calculé sur les octets
UTF-8 stricts après le LF du marqueur BEGIN et avant le premier octet du
marqueur END ; le dernier octet couvert est l'unique LF terminal. BOM, CR,
normalisation et re-sérialisation sont interdits.

#### Contrat du ledger v2

<!-- 043C_RECOVERY_LEDGER_V2_CONTRACT_BEGIN -->

Le ledger `evals/pilot/043c/recovery-ledger-v2.jsonl` est UTF-8 strict sans
BOM, LF-only, sans ligne vide, avec une ligne JSON minifiée par record, premier
octet `{`, dernier octet LF et taille totale maximale de `65536` octets. Chaque
record possède exactement ces vingt-trois propriétés dans cet ordre :

1. `schemaVersion`
2. `ledgerId`
3. `sequence`
4. `decisionId`
5. `state`
6. `previousState`
7. `previousRecordSha256`
8. `recordedAtUtc`
9. `authorityOccurredAtUtc`
10. `recordedByRole`
11. `authorityType`
12. `authorityRef`
13. `incidentId`
14. `incidentSha256`
15. `protocolId`
16. `protocolSha256`
17. `qualificationSha256`
18. `frozenCommit`
19. `completedRun`
20. `evidenceSha256`
21. `cpoOutcome`
22. `reviewRefs`
23. `authorizations`

`schemaVersion` est l'entier `2`; `ledgerId` vaut
`043c-recovery-ledger-v2`; `decisionId` est une chaîne unique et immuable de
pattern `^(?:D[0-7]|F[1-3])$`. `authorityRef` respecte
`^043c-v2-(?:d[0-7]|f[1-3])-[a-z0-9](?:[a-z0-9-]{5,78}[a-z0-9])$`.
Les timestamps sont strictement `yyyy-MM-ddTHH:mm:ss.fffZ`,
`authorityOccurredAtUtc <= recordedAtUtc`, et `recordedAtUtc` croît
strictement. `sequence` commence à zéro et égale l'index physique.
`previousRecordSha256` est nul seulement en D0, puis vaut le SHA-256 de la
ligne précédente LF inclus. `previousState` est nul seulement en D0, puis
reprend l'état durable précédent exact.

| ID | Seq. | Etat | Précédent | Rôle | authorityType | authorityRef |
|---|---:|---|---|---|---|---|
| D0 | 0 | `043C_V2_PLAN_HARDENED_IMPLEMENTATION_NOT_AUTHORIZED` | null | `CPO` | `CPO_PLAN_HARDENING_DECISION` | `043c-v2-d0-plan-hardening-decision` |
| D1 | 1 | `043C_V2_IMPLEMENTATION_AUTHORIZED_NOT_STARTED` | D0 | `CPO` | `CPO_IMPLEMENTATION_AUTHORIZATION` | `043c-v2-d1-implementation-authorization` |
| D2 | 2 | `043C_V2_IMPLEMENTED_PENDING_P0_DELIVERY` | D1 | `PREPARATION_OWNER` | `P0_IMPLEMENTATION_EVIDENCE` | `043c-v2-d2-implementation-evidence` |
| D3 | 3 | `043C_V2_P0_DELIVERED_PENDING_RECOVERY_SELECTION` | D2 | `RECOVERY_COORDINATOR_043C` | `P0_POST_MERGE_EVIDENCE` | `043c-v2-d3-p0-post-merge-evidence` |
| D4 | 4 | `043C_V2_RECOVERY_SELECTED_PENDING_CTO_FREEZE` | D3 | `CPO` | `CPO_RECOVERY_SELECTION_DECISION` | `043c-v2-d4-recovery-selection-decision` |
| D5 | 5 | `043C_V2_PROTOCOL_FROZEN_READY_FOR_R1_DECISION` | D4 | `CTO` | `CTO_FREEZE_GATE_D5` | `043c-v2-d5-cto-freeze-gate` |
| D6 | 6 | `043C_V2_R1_CLEANUP_VALIDATED_READY_FOR_R2_DECISION` | D5 | `COORDINATOR_043C` | `R1_CLEANUP_EVIDENCE` | `043c-v2-d6-r1-cleanup-evidence` |
| D7 | 7 | `043C_V2_R2_CLEANUP_VALIDATED_READY_FOR_FINAL_CPO_DECISION` | D6 | `COORDINATOR_043C` | `R2_CLEANUP_EVIDENCE` | `043c-v2-d7-r2-cleanup-evidence` |
| F1 | 8 | `GO_TO_EXTERNAL_GATE_REVIEW` | D7 | `CPO` | `CPO_FINAL_DECISION` | `043c-v2-f1-cpo-final-go-external-gate-review` |
| F2 | 7 ou 8 | `NO_GO` | D6 ou D7 | `CPO` | `CPO_FINAL_DECISION` | `043c-v2-f2-cpo-final-no-go` |
| F3 | 7 ou 8 | `INCONCLUSIVE` | D6 ou D7 | `CPO` | `CPO_FINAL_DECISION` | `043c-v2-f3-cpo-final-inconclusive` |

Nullabilité et bindings fermés :

- D0/D1 : protocole, qualification, gel, completed run, evidence, outcome et
  reviews sont nuls ;
- D2 : `protocolId`/`protocolSha256` requis ; qualification, gel, completed
  run, evidence, outcome et reviews nuls ;
- D3/D4 : protocole/hash/reviews requis ; qualification, gel, completed run,
  evidence et outcome nuls ;
- D5 : protocole/hash/reviews/qualification/gel requis ; completed run,
  evidence et outcome nuls ;
- D6 : evidence R1 requise ; `completedRun=R1` seulement si R1 est complet,
  sinon null ; outcome nul ;
- D7 exige D6 complet ; `completedRun=R2` si R2 est complet, sinon `R1` ;
  evidence D7 requise ; outcome nul ;
- F1 exige D7 complet et deux audits `15/0/0` ; F2/F3 partent de D6 ou D7 ;
  tous copient exactement le dernier completed run et evidence durables ;
- `cpoOutcome` est nul D0-D7, puis égale exactement l'état terminal ;
- un terminal est physiquement dernier et interdit tout append ultérieur.

Le libellé durable D6 contient `READY_FOR_R2_DECISION` parce qu'il désigne un
checkpoint de cleanup, pas une autorisation R2. Si R1 est `ABORTED`, D6 porte
`completedRun=null`, interdit tous les modes R2 et permet uniquement F2/F3.

`incidentId` et `incidentSha256` sont non nuls et stables sur tous les records.
`protocolId` et `protocolSha256` sont stables dès D2,
`qualificationSha256` et `frozenCommit` dès D5. `frozenCommit` est le commit
D4 exact, jamais le merge P0.

`reviewRefs` est null D0-D2, puis possède exactement, dans cet ordre :

1. `p0ReviewedHead`
2. `p0ReviewedTree`
3. `cpoPostCodeReviewRef`
4. `aiTechnicalReviewRef`
5. `aiSecurityPrivacyReviewRef`
6. `ctoTechnicalGateRef`
7. `cpoPreMergeReviewRef`
8. `p0MergeCommit`
9. `p0MergeTree`

Les quatre valeurs Git sont des SHA-1 lowercase. Si `H=p0ReviewedHead`,
`T=tree(H)` et `M=p0MergeCommit`, alors `M != H`, `M` est mono-parent sur la
base P0, `p0ReviewedTree=p0MergeTree=T`, et le merge utilise le head H exact.
Les cinq références valent respectivement
`043c-v2-p0-cpo-post-code-review-pass-<H>`,
`043c-v2-p0-ai-technical-review-pass-<H>`,
`043c-v2-p0-ai-security-privacy-review-pass-<H>`,
`043c-v2-p0-cto-technical-gate-pass-<H>` et
`043c-v2-p0-cpo-pre-merge-review-pass-<H>`. Elles restent byte-identiques dès
D3. Les reviews IA restent `AI_GENERATED / NOT_HUMAN_SIGNED`.

`authorizations` est toujours non nul et contient exactement, dans cet ordre,
sept booléens tous faux : `v1ExecutionAuthorized`, `v2ExecutionAuthorized`,
`r1Authorized`, `r2Authorized`, `externalUseAuthorized`,
`realDataAuthorized`, `productionAuthorized`. Les propriétés Git ou
d'implémentation/delivery/merge sont interdites dans le ledger.

<!-- 043C_RECOVERY_LEDGER_V2_CONTRACT_END -->

#### Canonicalisation et schémas locaux v2

La canonicalisation C043C impose UTF-8 strict sans BOM, NFC, JSON minifié,
ordre déclaré, aucune propriété dupliquée/supplémentaire, aucune whitespace
hors chaîne, entiers décimaux sans zéro initial, montants chaînes à deux
décimales, une ligne avec LF terminal, aucun CR, maximum `65536` octets et
SHA-256 lowercase sur les octets exacts LF inclus.

`authorization.json` possède exactement : `schemaVersion`, `run`, `decision`,
`authorizedAtUtc`, `authorityRef`, `protocolId`, `protocolSha256`,
`frozenCommit`, `qualificationSha256`, `resourceTargetSha256`. Tous sont non
nuls. `run=R1|R2`, `decision=R1_ONLY|R2_ONLY`; R1 exige D5, R2 exige D6 avec
R1 `COMPLETED` et `15/0/0`.

`state/active-state.json` possède exactement : `schemaVersion`, `state`,
`run`, `recordedAtUtc`, `authorityRef`, `protocolId`, `protocolSha256`,
`frozenCommit`, `qualificationSha256`, `resourceTargetSha256`. Ses états sont
`R1_ONLY_AUTHORIZED_NOT_STARTED`, `R1_STARTED_CLEANUP_NOT_VALIDATED`,
`R2_ONLY_AUTHORIZED_NOT_STARTED`, `R2_STARTED_CLEANUP_NOT_VALIDATED`.
Les bindings copient byte pour byte l'autorisation ; le passage STARTED est
atomique immédiatement avant T00.

Chaque `runs/R1|R2/evidence-summary.json` possède exactement :
`schemaVersion`, `run`, `outcome`, `lastCompletedTask`, `abortReasonCode`,
`runStartedAtUtc`, `runEndedAtUtc`, `protocolId`, `protocolSha256`,
`frozenCommit`, `resourceTargetSha256`, `expectedBusinessEventCount`,
`missingExpectedBusinessEventCount`, `unexpectedBusinessEventCount`,
`auditProjectionSha256`, `businessStateSha256`, `evidenceContentSha256`,
`qualificationSha256`. `COMPLETED` exige T14, raison null, timestamps non nuls
et `15/0/0`. `ABORTED` exige une raison fermée ; le début peut être nul
seulement avant ou à T00 ; la fin et les compteurs factuels sont obligatoires.

Le manifeste hors Git
`%LOCALAPPDATA%\Ritomer\043c\043c-internal-rehearsal-v2\qualification\qualification.json`
possède exactement : `schemaVersion`, `qualificationId`, `ledgerId`,
`incidentId`, `incidentSha256`, `protocolId`, `protocolSha256`,
`frozenCommit`, `reviewRefs`, `qClosed`, `qualifications`, `qualifiedAtUtc`,
`qualifiedByRole`. Les sept objets Q1-Q7 ordonnés possèdent `qId`, `qClosed`,
`nominal`, `nominalSha256`, `mutant`, `mutantSha256`, `errorCode`, `reviewRef`.
Tous doivent être complets, revus et verts ; le fichier entier LF inclus donne
`qualificationSha256`, nul D0-D4 puis stable dès D5.

#### Hashes de preuve

`auditProjectionSha256` couvre l'objet C043C ordonné `schemaVersion`, `run`,
`outcome`, `lastCompletedTask`, `runStartedAtUtc`, `runEndedAtUtc`, `tenantId`,
`accountantUserId`, `reviewerUserId`, `slots`, les trois compteurs. Les quinze
slots ordonnés couvrent `slot`, `action`, `resourceType`, `accountCode`,
`targetCode`, `matchStatus`, `resourceId`, `occurredAtUtc`, `actorUserId`,
`actorSubjectSha256`, `actorRole`, `requestIdSha256`, `metadataSha256` depuis
le dernier snapshot PostgreSQL `REPEATABLE READ READ ONLY` avant T15.

`businessStateSha256` couvre l'objet ordonné `schemaVersion`, `run`, `outcome`,
`lastCompletedTask`, les trois identités, `closingFolder`, `balanceImport`,
`mappings`, `workpaper`, `document`, `exportPack`,
`minimalAnnexVerified`, `usefulnessAssessmentCompleted`, avec les sous-objets,
constantes T04-T14 et sept mappings exacts du protocole.

`evidenceContentSha256` couvre les dix-sept autres propriétés du résumé dans
leur ordre, LF inclus. Le hash du fichier couvre ensuite les dix-huit
propriétés, LF inclus. D6 lie le hash exact du fichier R1. D7 lie le SHA-256 de
l'index ASCII exact de 136 octets `R1=<sha256-r1>\nR2=<sha256-r2>\n`. Un
terminal copie le dernier `evidenceSha256` durable.

#### Invariants, qualifications et livraison

Les invariants permanents sont exactement : `043C2-I01` octets v1/incident et
temporalité ; `043C2-I02` vingt-trois champs/ordre/decisionId ; `043C2-I03`
tuple autorité, reviews et autorisations ; `043C2-I04` transitions et chaîne
SHA ; `043C2-I05` CLI fermée et aucun fallback ; `043C2-I06` file-set P0 exact ;
`043C2-I07` même H/T pour les cinq reviews ; `043C2-I08` D3 puis D4 unitaires ;
`043C2-I09` D5/qualification/gel D4 ; `043C2-I10` descendants protégés et
ledger append-only ; `043C2-I11` squash mono-parent/tree identique ;
`043C2-I12` replay PR106/PR107 ; `043C2-I13` racine Fixed et handles confinés ;
`043C2-I14` schémas 10/10/18/18, taille et TOCTOU ; `043C2-I15` tous les
hashes de preuve et D6/D7 ; `043C2-I16` v1 SelfTest seulement ; `043C2-I17`
gates/read-only v2 ; `043C2-I18` PostgreSQL 17/SSPI/reader minimal ;
`043C2-I19` Flyway/seed/readiness exacte ; `043C2-I20` cleanup et R1 complet
avant R2. Node prouve I01-I12 `12/12/0`, PowerShell I13-I20 `8/8/0`, union
`20/20/0`. Aucun SelfTest ne ferme une qualification.

Q1-Q7 restent des preuves réelles séparées : Q1 volume Fixed/final path ; Q2
`65536` accepté et `65537` rejeté ; Q3 UNC/mapped/device/reparse/escape rejeté ;
Q4 mutation concurrente détectée ; Q5 PostgreSQL 17/SSPI/reader exact ; Q6
Flyway/seed donnant `EXACT_STATE_PROVEN` ; Q7 projections et chaîne de hashes.
Leurs mutants échouent respectivement avec
`043C_V2_Q1_FINAL_PATH_MISMATCH`, `043C_V2_Q2_ARTIFACT_SIZE_EXCEEDED`,
`043C_V2_Q3_PATH_CONFINEMENT_VIOLATION`,
`043C_V2_Q4_CONCURRENT_MUTATION_DETECTED`,
`043C_V2_Q5_CATALOG_READER_PROFILE_INVALID`,
`043C_V2_Q6_APPLICATION_READINESS_NOT_EXACT` et
`043C_V2_Q7_EVIDENCE_HASH_BINDING_INVALID`.

La séquence de livraison est fermée : P0 implémente les huit chemins et D0-D2,
checks locaux puis review CPO, delivery séparée, cinq reviews/gates sur le même
head et squash autorisé séparément ; P1 append D3 seul après preuve post-merge
P0 ; P2 append D4 seul après décision CPO ; P3 exige Q1-Q7 verts, CTO Freeze
Gate sur la base D4 exacte et append D5 seul. `CTO TECHNICAL GATE P0` ne vaut
jamais `CTO FREEZE GATE D5`. Aucun état, completed run, frozen commit ou
autorisation n'est repris automatiquement d'une version ou phase antérieure.

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
