# 043 — Clôture documentaire terminale

STATUS=DONE_TERMINALLY_CLOSED
FINAL_RESULT=STOPPED_INCONCLUSIVE
SUCCESSFULLY_DELIVERED=NO
R1_EXECUTED=NO
R2_EXECUTED=NO
EXTERNAL_READINESS_PROVED=NO
MUST_NOT_RESUME=YES

043_FINAL_STATUS=STOPPED_INCONCLUSIVE
043A=DELIVERED
043B=LOCAL_SYNTHETIC_SIMULATION_VALIDATED
043C_R1_EXECUTED=NO
043C_R2_EXECUTED=NO
043C_EXTERNAL_READINESS_PROVED=NO
043C_MUST_NOT_RESUME=YES

PR_114=CLOSED_WITHOUT_MERGE
PR_114_HEAD=FORENSIC_ONLY
PR_114_HEAD_SHA=b8e6058467dac12f5052510120342decb5aa6cc1
PR_114_BRANCH=FORENSIC_ONLY
PR_114_BRANCH_NAME=feat/043c-minimal-execution-orchestrator-v1
PR_114_IMPLEMENTATION=NOT_EXECUTABLE

## Résumé de clôture courant

- `043a` demeure livré.
- `043b` demeure une simulation locale synthétique validée, mono-opérateur et à deux rôles ; elle ne prouve ni préparation externe ni séparation réelle des fonctions.
- `043c` s’est terminé par `STOP_AND_RECORD_INCONCLUSIVE`.
- R1 et R2 n’ont jamais été exécutés et la préparation externe n’a pas été prouvée.
- La PR #114 a été fermée sans merge. Son head et sa branche exacts sont conservés uniquement comme éléments forensiques.
- L’implémentation rejetée de PR #114 n’est ni exécutable ni réutilisable.

Les quatre catégories bloquantes de la review indépendante étaient :

1. liaison insuffisante entre le head Git revu et le worktree/index d’exécution ;
2. preuve d’absence R2 insuffisamment liée aux identités exactes des ressources R1 ;
3. possibilité d’attribuer à T15 un échec d’utilité survenu à T14 ;
4. statut de volume fixe auto-attesté au lieu d’être vérifié depuis Windows.

Les octets du rapport indépendant nommé dans la trace GitHub ne sont pas accessibles. Ils ne sont donc pas présentés comme ayant été rehashés indépendamment.

Le classement de ce fichier sous `specs/done/` signifie uniquement `TERMINALLY_CLOSED_NOT_SUCCESSFULLY_DELIVERED` pour 043. Il ne redéfinit pas la sémantique des autres specs Done.

## Direction produit et autorisation courantes

NEXT_PRODUCT_DIRECTION=PHASE_1_DESIGN_PARTNER_READINESS
CURRENT_AUTHORIZATION=DOCS_ONLY_PREPARATION

PHASE_1_PUBLICATION_AUTHORIZED=NO
PHASE_1_OUTREACH_AUTHORIZED=NO
PHASE_1_INTERVIEW_AUTHORIZED=NO
PHASE_1_COLLECTION_AUTHORIZED=NO
PHASE_1_EXTERNAL_ACCESS_AUTHORIZED=NO
PHASE_1_REAL_DATA_AUTHORIZED=NO
PHASE_1_RUNTIME_AUTHORIZED=NO

Aucune nouvelle spec n’est créée ou numérotée par cette clôture. Aucune publication, prospection, interview, collecte, création d’accès externe, utilisation de données réelles ou capacité runtime n’est autorisée.

## Snapshot historique pré-clôture

Tout le contenu compris entre les marqueurs suivants est le snapshot pré-clôture exact. Les mots « Active », « current », les futures commandes, les gates et les instructions d’exécution qu’il contient sont historiques, sans autorité courante, et ne doivent pas être repris ou exécutés.

<!-- 043_TERMINAL_HISTORICAL_BEGIN -->
# 043 - Controlled fiduciary pilot readiness V1

## Status

Active.

- `043a`: `ACCEPTED_BY_DISTINCT_CPO_REVIEW`.
- `043b`: `LOCAL_SYNTHETIC_SIMULATION_VALIDATED / MERGED / AI_REVIEWED / OWNER_RISK_ACCEPTED_FOR_LOCAL_SYNTHETIC_ONLY / NOT_HUMAN_SIGNED / NOT_PRODUCTION_READY / NOT_EXTERNAL_READY / NOT_SEPARATION_OF_DUTIES_PROOF`.
- `043c`: `043C_SIMPLIFIED_REHEARSAL_DEFINED / EXECUTION_NOT_AUTHORIZED / R1_NOT_STARTED / R2_NOT_STARTED / V1_AUTHORITY_RAIL_SUPERSEDED_NOT_EXECUTABLE`.
- Current sub-deliverable: 043c simplified rehearsal definition; execution planning remains blocked until the exact fresh-run commands and feasibility evidence are separately reviewed.
- No transition between `043a`, `043b` and `043c` is automatic.

## Roadmap declaration

| Field | Value |
| --- | --- |
| Roadmap phase | Phase 0 - alpha interne reproductible |
| Primary workstream | Produit fiduciaire |
| Supporting workstream | Trust & operations |
| Outcome | Prove that the synthetic closing workflow can be rehearsed internally in a reproducible, controlled and evidence-bearing way. |
| Exit evidence | Frozen synthetic fixtures, controlled single-operator two-role local simulation, then two complete internal rehearsals on fresh disposable resources with exact `15/0/0` audit, hashed per-run evidence and cleanup proved before R2 and after R2, always followed by an explicit terminal decision. |
| Gate targeted | CPO decision on whether external-gate review may begin; never an external invitation by itself. |

The canonical outcome roadmap is `docs/product/product-roadmap.md`. This spec remains the detailed source of truth for `043`.

## Normative boundary

`043` prepares only level A readiness.

In `043c`, the only active path is a simplified, strictly internal rehearsal of T00-T15 on frozen synthetic data. R1 and R2 each have one attempt, use fresh disposable resources, require distinct sensitive-execution authorizations and remain unstarted and unauthorized.

`043` invites no external fiduciary. `043` collects no real participant observation.

The first external invitation requires a new CPO decision and prior satisfaction of both the fiduciary gate and the Security/Privacy gate. `GO_TO_EXTERNAL_GATE_REVIEW` is neither an invitation nor an authorization to collect observations.

No following spec is created automatically.

Each of `043a`, `043b` and `043c` requires a distinct CPO review. The distinct review of `043a` and the prior CTO Gate for `043b` are complete. The CTO Gate approved the local architecture with conditions for local synthetic use only. The local evidence and final post-code AI reviews for `043b` are complete. Owner decision `RITOMER-043C-REBASELINE-20260808-01` selects the simplified trajectory. This specification authorizes neither R1 nor R2 execution and opens no external gate; every future execution requires a separate pre-execution review and an exact sensitive-execution authorization. Human technical and Security reviews remain deferred to the external gate and become mandatory again on any external-use trigger defined below.

## Surface and risk

| Sub-deliverable | Surface | Risk |
| --- | --- | --- |
| `043a` | `DOCS_GIT / FIXTURES_SYNTHETIQUES / GOVERNANCE_CHECKS` | B |
| `043b` | `BACKEND_LOCAL_AUTH / BACKEND_TEST_SAFETY / FRONTEND_LOCAL_HARNESS / CI_GIT / DOCS_GIT / SECURITY_DEBT_GOVERNANCE` | C for destructive PostgreSQL safety; B otherwise |
| `043c` simplified rebaseline | `DOCS / CI_GIT / QA_MANUAL` | C because it changes durable review and execution governance |
| `043c` R1/R2, not authorized by this increment | `QA_MANUAL / LOCAL_RUNTIME / DOCS_GIT` | C |

The merged `043b` hotfix remains bounded to its exact 26-path implementation set. This local rebaseline changes exactly five tracked files, deletes one tracked v1 validator and adds no tracked path. It authorizes no rehearsal, external participant, production authentication, provider, MCP, real data or following spec.

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

## 043c - Simplified internal rehearsal definition (active)

Status: `043C_SIMPLIFIED_REHEARSAL_DEFINED / EXECUTION_NOT_AUTHORIZED / R1_NOT_STARTED / R2_NOT_STARTED / V1_AUTHORITY_RAIL_SUPERSEDED_NOT_EXECUTABLE`.

### Exclusive outcome

`043c` now has exactly one active outcome:

```text
Prouver, sur données synthétiques gelées et ressources locales fraîches,
que le parcours T00–T15 peut être exécuté deux fois de manière contrôlée,
tenant-scoped, observable, mesurable et nettoyable, avant toute décision
d’accès à un gate externe.
```

This rebaseline defines the rehearsal only. It does not prove feasibility of a fresh run, authorize execution, start R1 or R2, open an external gate or authorize an invitation.

### Owner decision, forensic provenance and cycle limits

- Owner decision: `RITOMER-043C-REBASELINE-20260808-01`, decision `SIMPLIFY`.
- Baseline main preserved as forensic provenance: `5e7ec1a6cf908bf5587248d94bd4db2d1e36370c`.
- Rejected PR #110 head preserved as forensic history: `8691275d64294b181c5be8ae340f0cd4e34f1a19`.
- Package V3 SHA-256 preserved as forensic history: `698b328db5cb43a7662f3856ef60a970eefa7fdeeae5c498d41e72bea3906e8f`.
- Exact rebaseline change matrix against that baseline: `5M / 0A / 1D / 0R / 0C`.

```text
MAX_MAJOR_CYCLES_TOTAL=3
MAJOR_CYCLE_1=SIMPLIFICATION_IMPLEMENTATION_AND_DELIVERY
MAJOR_CYCLE_2=R1_SINGLE_ATTEMPT
MAJOR_CYCLE_3=R2_SINGLE_ATTEMPT
MAX_IMPLEMENTATION_HEADS=2
MAX_R1_ATTEMPTS=1
MAX_R2_ATTEMPTS=1
NO_FOURTH_CYCLE=YES
```

The three major cycles form a static total ceiling, not a remaining-cycle counter. Implementation, delivery and review records, including the iterations or implementation heads actually consumed, are preserved in the applicable Evidence Packs and pull requests, not as current state in this specification.

### Minimum evidence contract

Every future authorized R1/R2 cycle must cumulatively prove all of the following. Per-run items apply separately to each run that crosses the exact attempt boundary defined below; cycle-level cleanup and terminal-decision items apply at the last factually reachable stop:

- the frozen synthetic fixtures and their exact published byte sizes and SHA-256 values;
- `SYNTHETIC_ONLY` and `LOOPBACK_ONLY`, with no real or external data;
- one exact tenant shared by the two logical roles `ACCOUNTANT` and `REVIEWER`;
- a single-operator-capable two-role simulation, never a claim of independent human sessions or real segregation of duties;
- one complete T00-T15 path;
- exact audit result `15 expected / 0 missing / 0 unexpected`;
- the export or final result already provided by the existing path;
- usefulness measurement and a sanitized observation;
- fresh disposable resource identities fixed separately for the run;
- absence of the prior run's resources before R2, plus verified cleanup after R2;
- one sanitized evidence summary per run, hashed over its exact bytes;
- human selection of exactly one terminal outcome: `GO_TO_EXTERNAL_GATE_REVIEW`, `NO_GO` or `INCONCLUSIVE`.

The detailed operational checklist and the exact T00-T15/audit mapping live only in `runbooks/controlled-fiduciary-pilot-local-043.md`. No new runtime, service, dependency, fixture, contract, migration, validator, ledger, manifest or tracked authority artifact is introduced.

### Exact run-attempt boundary

```text
RUN_ATTEMPT_START
=
PRE_EXECUTION_REVIEW=PASS
AND
SENSITIVE_EXECUTION_AUTHORIZED=YES
  bound to the exact run, runId, tenantId, environment and command
AND
all run preflight checks are PASS
AND
fresh disposable resource identities are fixed and recorded
AND
the first T00 action is engaged.
```

This boundary has the following closed consequences:

1. A preparation failure before the boundary is `PRE_EXECUTION_PREFLIGHT_FAILURE`. It consumes no R1/R2 attempt, forbids T00 and requires a new review whenever a material condition changes.
2. At the boundary, the exact sensitive-execution authorization is consumed.
3. After the boundary, every failure, stop or incomplete result consumes the run's single attempt.
4. No silent retry, opportunistic reset or second attempt of the same run is permitted.
5. R1 must reach T15, produce its hashed evidence and complete cleanup before R2 can become eligible.
6. Incomplete R1, incomplete cleanup or an audit other than `15/0/0` sets `R2_AUTHORIZED=NO`, forbids `GO_TO_EXTERNAL_GATE_REVIEW` and ends the cycle in `INCONCLUSIVE` or `NO_GO`.
7. Incomplete R2, incomplete cleanup or an audit other than `15/0/0` permits no third run and ends in `INCONCLUSIVE` or `NO_GO`.
8. R1 and R2 each require a distinct sensitive `AUTHORIZATION_RECORD`.
9. This rebaseline emits neither record and executes neither run.

### Superseded v1 authority material

The S0-S10/F1-F3 append-to-Git authority rail and every v1 proof attached to it are `HISTORICAL / SUPERSEDED / NOT_EXECUTABLE`. The v1 material remains available through the protected block below and Git history. The rejected v2 trajectory remains available only through Git, PR #110 and package V3. None of this material is selectable, required or executable by the active contract.

The rejected head and trajectory of PR #110, together with package V3, are evidence only. The package classification is:

```text
FORENSIC_ONLY
NOT_EXECUTED
SUPERSEDED_BY_SIMPLIFY_DECISION
PACKAGE_V4_FORBIDDEN
```

The former signer-account, CNG, certificate, RSA-PSS, CA0, signed-receipt, replay-reservation, authority-hold/recovery, authority-manifest and operational PowerShell package mechanisms are outside the active trajectory. The deleted v1 validator has no replacement. Git and PR #110 preserve their history.

The active control effect is:

```text
TRACKED_CONTROL_FILES_DELTA=-1
NET_LINE_REDUCTION_REQUIRED=YES
```

### Historical v1 protected block

<!-- 043C_V1_HISTORICAL_BEGIN -->
> `HISTORICAL / SUPERSEDED / NOT_EXECUTABLE`
>
> The following v1 block is preserved byte-for-byte from `origin/main` for forensic continuity. Any use of “current”, any S0-S4 record, hash, commit, decision, profile, validator command or gate inside the block describes the superseded v1 rail only and has no authority in the simplified trajectory.

## 043c - Internal rehearsal and readiness decision

Status: `PREPARATORY_IMPLEMENTED_PENDING_POST_CODE_CPO / EXECUTION_NOT_AUTHORIZED / R1_NOT_STARTED_NOT_AUTHORIZED / R2_NOT_STARTED_NOT_AUTHORIZED`.

Current preparatory durable baseline:

`S2 = 043C_PREPARATORY_IMPLEMENTED_PENDING_POST_CODE_CPO`

The durable truth is always the last valid record of the generic ledger. The three records materialized by this preparatory worktree are the exact S0/S1/S2 baseline; future governed transitions append one record at a time without rewriting this section outside the marked ledger block.

The CPO decision represented by this increment grants only:

- `CPO_043C_PLAN_AUTHORIZATION=GRANTED`;
- `CPO_043C_PREPARATORY_IMPLEMENTATION_AUTHORIZATION=GRANTED`.

It does not grant:

- `043C_EXECUTION_AUTHORIZATION=NOT_GRANTED`;
- `R1_ONLY`;
- `R2_ONLY`;
- external use, real data, production or any following spec.

No S3, S4, S5, S6, S7, S8, S9, S10 or terminal record is materialized by this increment.

### Exact preparatory file set

The preparatory implementation is closed to exactly four paths:

1. `M specs/active/043-controlled-fiduciary-pilot-readiness-v1.md`
2. `M runbooks/controlled-fiduciary-pilot-local-043.md`
3. `M evals/mapping/validate-042a2-human-review-governance-kit.mjs`
4. `?? runbooks/validate-controlled-fiduciary-pilot-043c-state.ps1` (`A` only in a future committed historical range)

The exact current worktree matrix is `3M / 1UNTRACKED` with an empty index; its future committed historical matrix would be `3M / 1A / 0D / 0R / 0C`. No backend, frontend, contract, migration, fixture, policy, dependency, manifest, lockfile, `.env`, `docs/product/v1-plan.md` or spec `044+` is part of this increment.

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

### Closed ledger validation profiles

The current `WORKTREE_043C_PREPARATORY` profile remains exact and unchanged:

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

### Mandatory entry gates

- `043b` Final AI Technical Review is `PASS`.
- `043b` Final AI Security/Privacy Review is `PASS`.
- Owner risk acceptance is limited to local synthetic use.
- Human technical and Security reviews have not occurred; they remain deferred to the external gate and become mandatory again on any external-use trigger.
- The distinct CPO decision for preparatory implementation is satisfied.
- A distinct CPO post-code review of the exact four-path diff is still required for S2 to S3.
- A new CTO Gate must bind the protocol hash and future frozen commit before S3 to S4.
- `PreparationPreflight` must succeed from S4 before a distinct CPO `R1_ONLY` decision may create local S5.
- Neither R1 nor R2 may begin from S2.

### Exact state machine and gates

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
2. S1→S2: exact `3M/1A` diff and preparatory checks.
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

### Frozen protocol and local schemas

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

### Preparatory acceptance

- The worktree contains exactly the four authorized paths with matrix `3M/1UNTRACKED` and an empty index.
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

<!-- 043C_V1_HISTORICAL_END -->

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
<!-- 043_TERMINAL_HISTORICAL_END -->
