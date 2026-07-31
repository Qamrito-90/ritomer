import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { isDeepStrictEqual } from "node:util";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, "..", "..");
const NON_VALIDATION_WORDING =
  "JSON syntax and repository invariants checked; Draft 2020-12 semantic validation not performed.";
const FORBIDDEN_VALIDATION_CLAIM = "Schema" + " validated";
const FREE_TEXT_DATA_DOCTRINE =
  "Ne saisir aucun nom, e-mail, initiale nominative, employeur, identifiant de collaborateur, identifiant client ou tenant, dossier, import, chemin local ou réseau, URL, emplacement de stockage, référence personnelle, preuve de compétence ou contenu provenant d’une source privée. Utiliser uniquement les identifiants synthétiques et les codes fournis dans le pack. En cas de doute, arrêter la saisie et signaler l’incident sans recopier la donnée.";
const LEDGER_LIMIT_WORDING =
  "La chaîne SHA-256 fournit une détection locale des modifications lorsqu’un head ou un ancrage de confiance antérieur est déjà connu. Elle ne détecte pas à elle seule une troncation, un replay, un réordonnancement avec recalcul ou le remplacement complet du ledger. Elle n’authentifie aucun auteur, n’anonymise aucune donnée et n’établit ni exhaustivité, ni non-répudiation, ni signature officielle.";
const LEDGER_ANCHOR_WORDING =
  "Avant utilisation, un ancrage externe devra être prouvé : branche protégée, artefact CI protégé, tag signé, journal d’audit indépendant ou mécanisme équivalent. Sans ancrage, le ledger ne constitue pas une preuve autonome.";
const COORDINATOR_LIMIT_WORDING =
  "Le coordinateur confirme uniquement les contrôles de custody, d’identité d’artefact, de hash, de timestamp et de présence des déclarations requises. Il ne certifie ni l’identité juridique, ni la vérité substantielle de la réponse, ni l’absence absolue d’usage d’IA ou d’accès interdit.";
const FAIL_CLOSED_GATE_SEPARATION =
  "Process the fail-closed gates separately: an unauthorized request is `POLICY_BLOCK`; an unmet account/import/eligibility condition is `PRECONDITION_BLOCK`; and a malformed or unknown, deprecated, non-selectable, root, section or contextually inadmissible supplied model result is `INVALID_MODEL_OUTPUT`.";
const FIDUCIARY_GATE_PREFIX =
  "After processing any POLICY_BLOCK, PRECONDITION_BLOCK and INVALID_MODEL_OUTPUT conditions, apply the following semantic decision branch in order and stop at the first established result.";
const TAXONOMY_GAP_BOUNDARY =
  "`TAXONOMY_GAP` is allowed only when the business concept is established, the evidence is not insufficient, the absence of a target comes from the exact supplied catalog/taxonomy, and no approximate target is invented.";
const AMBIGUOUS_TARGET_SUFFICIENT_MEANING =
  "SUFFICIENT means sufficient to establish the business concept and the admissible candidate set; it does not mean sufficient to select, validate or approve one unique target.";
const AGREEMENT_RATIFICATION_AUTHORITY_BOUNDARY =
  "AGREEMENT_RATIFICATION confirms only the concordance and acceptability of two frozen human responses for this synthetic review round. It approves no official mapping and creates no golden set.";
const DIVERGENCE_ADJUDICATION_AUTHORITY_BOUNDARY =
  "DIVERGENCE_ADJUDICATION records only a traceable human disposition for this synthetic case and review round. It remains review evidence, may conclude NON_ADJUDICABLE, approves no official mapping and creates no golden set.";
const REVIEW_EVIDENCE_AUTHORITY_MARKERS = [
  "REVIEW_EVIDENCE_ONLY",
  "NOT_GOLDEN",
  "NOT_AUTHORITATIVE",
];
const PR99_TECHNICAL_RATIFICATION =
  "PR #99 technical exact-diff ratification = RATIFIED_WITH_NON_BLOCKING_CORRECTIONS";
const PR99_SECURITY_RATIFICATION =
  "PR #99 Security/Privacy exact-diff ratification = RATIFIED_WITH_CONDITIONS_BEFORE_USE";
const PR99_BASE = "14b7ef952f8d9594a53e63542ee2d6d80bbcaa2f";
const PR99_HEAD = "84e9854364d5803418de658b57ba73c0586641b2";
const HISTORICAL_043B_BASE = "b208658fc37956e2e55fb89dfaaaccafea87277c";
const HISTORICAL_043B_HOTFIX_BASE = "b46fb0d6dcfb2eca7d317ddfeaf34371686e7030";
const HISTORICAL_043C_PREPARATION_BASE = "1ecddd81e255bc049558e5f90bf65db394558d67";
const HISTORICAL_SPEC_042_ACTIVE_PATH = "specs/active/042-controlled-ai-mapping-runtime-pilot-v1.md";
const CURRENT_SPEC_042_BACKLOG_PATH = "specs/backlog/042-controlled-ai-mapping-runtime-pilot-v1.md";
const CURRENT_SPEC_043_ACTIVE_PATH = "specs/active/043-controlled-fiduciary-pilot-readiness-v1.md";
const ROADMAP_PATH = "docs/product/product-roadmap.md";
const CONTROLLED_043C_RUNBOOK_PATH = "runbooks/controlled-fiduciary-pilot-local-043.md";
const CONTROLLED_043C_VALIDATOR_PATH = "runbooks/validate-controlled-fiduciary-pilot-043c-state.ps1";
const GOVERNANCE_CHECKER_PATH = "evals/mapping/validate-042a2-human-review-governance-kit.mjs";
const DURABLE_043C_LEDGER_BEGIN = "<!-- 043C_DURABLE_STATE_LEDGER_BEGIN -->";
const DURABLE_043C_LEDGER_END = "<!-- 043C_DURABLE_STATE_LEDGER_END -->";
const PROTOCOL_043C_BEGIN = "<!-- 043C_PROTOCOL_V1_BEGIN -->";
const PROTOCOL_043C_END = "<!-- 043C_PROTOCOL_V1_END -->";
const PROTOCOL_043C_ID = "043c-internal-rehearsal-v1";
const GOVERNANCE_STATUSES = [
  "DRAFT",
  "NOT_EXECUTABLE",
  "NOT_DISTRIBUTABLE",
  "NOT_VALIDATED_BY_DRAFT_2020_12_ENGINE",
];

const EXISTING_ALLOWED = [
  "policies/ai-mapping-annotation-guide-042a2.md",
  "policies/ai-mapping-business-evaluation-protocol-042a2.md",
  "policies/dependency-security-review-042a.md",
  HISTORICAL_SPEC_042_ACTIVE_PATH,
  "docs/product/v1-plan.md",
  "evals/mapping/README.md",
];

const NEW_ALLOWED = [
  "policies/ai-mapping-human-review-hardening-record-042a2.md",
  "evals/mapping/reviews/042a2/reviewer-instructions-v1.md",
  "evals/mapping/reviews/042a2/reviewer-response-schema-v2.json",
  "evals/mapping/reviews/042a2/restricted-participant-registry-schema-v1.json",
  "evals/mapping/reviews/042a2/review-round-manifest-schema-v1.json",
  "evals/mapping/reviews/042a2/reviewer-attestation-schema-v1.json",
  "evals/mapping/reviews/042a2/review-freeze-record-schema-v1.json",
  "evals/mapping/reviews/042a2/workflow-ledger-record-schema-v1.json",
  "evals/mapping/reviews/042a2/workflow-transition-ledger-v1.jsonl",
  "evals/mapping/reviews/042a2/review-clarification-record-schema-v1.json",
  "evals/mapping/reviews/042a2/adjudication-dossier-manifest-schema-v1.json",
  "evals/mapping/validate-042a2-human-review-governance-kit.mjs",
  "runbooks/ai-mapping-human-review-coordinator-042a2.md",
];

const EXACT_ALLOWED_FILE_SET = [...EXISTING_ALLOWED, ...NEW_ALLOWED].sort();
const EXPECTED_HISTORICAL_STATUS_BY_PATH = new Map([
  ...EXISTING_ALLOWED.map((path) => [path, "M"]),
  ...NEW_ALLOWED.map((path) => [path, "A"]),
]);

const CURRENT_043A_ALLOWED_FILE_SET = [
  "README.md",
  ROADMAP_PATH,
  "docs/product/v1-plan.md",
  "evals/mapping/README.md",
  "evals/mapping/validate-042a2-human-review-governance-kit.mjs",
  "fixtures/pilot/043/balance-fy2025-v1.csv",
  "fixtures/pilot/043/evidence-bank-reconciliation-fy2025-v1.csv",
  "fixtures/pilot/043/observation-template-v1.md",
  "fixtures/pilot/043/README.md",
  "fixtures/pilot/043/validate-043-pilot-fixtures.ps1",
  "policies/ai-mapping-pilot-scope-manifest-042a2.md",
  HISTORICAL_SPEC_042_ACTIVE_PATH,
  CURRENT_SPEC_043_ACTIVE_PATH,
  CURRENT_SPEC_042_BACKLOG_PATH,
].sort();

const WORKTREE_PROFILES = Object.freeze({
  CLEAN: "CLEAN_CURRENT_STATE",
  PILOT_043A: "WORKTREE_043A_PILOT_READINESS_FOUNDATION",
  HARNESS_043B: "WORKTREE_043B_LOCAL_TWO_ACTOR_HARNESS",
  HOTFIX_043B: "WORKTREE_043B_MINIMUM_VIABLE_SAFETY_HOTFIX",
  PREPARATORY_043C: "WORKTREE_043C_PREPARATORY",
  DURABLE_TRANSITION_043C: "WORKTREE_043C_DURABLE_TRANSITION",
  INVALID: "INVALID_WORKTREE",
});

const CURRENT_043B_ALLOWED_FILE_SET = [
  "backend/build.gradle.kts",
  "backend/src/main/kotlin/ch/qamwaq/ritomer/devtools/DemoSeedLocalActivation.kt",
  "backend/src/main/kotlin/ch/qamwaq/ritomer/devtools/DemoSeedLocalService.kt",
  "backend/src/test/kotlin/ch/qamwaq/ritomer/devtools/DemoSeedLocalActivationTest.kt",
  "backend/src/test/kotlin/ch/qamwaq/ritomer/devtools/DemoSeedLocalDatasetTest.kt",
  "backend/src/test/kotlin/ch/qamwaq/ritomer/devtools/DemoSeedLocalDbIntegrationTest.kt",
  "backend/src/test/kotlin/ch/qamwaq/ritomer/devtools/DemoSeedLocalAuthMeDbIntegrationTest.kt",
  "backend/src/test/kotlin/ch/qamwaq/ritomer/devtools/DemoSeedLocalSourceGuardTest.kt",
  "frontend/local-two-actor-harness.mjs",
  "frontend/local-two-actor-harness.test.ts",
  "frontend/local-demo-proxy.test.ts",
  "frontend/package.json",
  "runbooks/controlled-fiduciary-pilot-local-043.md",
  "runbooks/local-dev.md",
  "specs/active/043-controlled-fiduciary-pilot-readiness-v1.md",
  "docs/product/v1-plan.md",
  "evals/mapping/validate-042a2-human-review-governance-kit.mjs",
].sort();

const FROZEN_043A_HASHES = new Map([
  ["fixtures/pilot/043/balance-fy2025-v1.csv", "2295b620704c2cfcdf1e37660388bd84a1d261c0b7697edf5bce21d0c04f9855"],
  ["fixtures/pilot/043/evidence-bank-reconciliation-fy2025-v1.csv", "f5bb9a7ec0df043a8e845d10f029c2bdd6dd7ea2f62f9935f48cdc0d95339b27"],
  ["fixtures/pilot/043/observation-template-v1.md", "c67c99fde0816cb1b25b56f34babfa5907c2189746f579fdec87c67fd8cb862e"],
  ["fixtures/pilot/043/README.md", "3b560d25ccee6e95f7bd4e93faf8acad8307288ee1724788312c48ab7ad5ebda"],
  ["fixtures/pilot/043/validate-043-pilot-fixtures.ps1", "95217e702a5347c8d50342646aaa11b32a2b661963f90adfd781269b8e7eb6c8"],
]);

const CURRENT_043B_RUNTIME_IMPLEMENTATION_PATHS = new Set([
  "backend/build.gradle.kts",
  "backend/src/main/kotlin/ch/qamwaq/ritomer/devtools/DemoSeedLocalActivation.kt",
  "backend/src/main/kotlin/ch/qamwaq/ritomer/devtools/DemoSeedLocalService.kt",
  "frontend/local-two-actor-harness.mjs",
]);

const CURRENT_043B_UNTRACKED_PATHS = new Set([
  "frontend/local-two-actor-harness.mjs",
  "frontend/local-two-actor-harness.test.ts",
  "runbooks/controlled-fiduciary-pilot-local-043.md",
]);

const EXPECTED_043B_HISTORICAL_STATUS_BY_PATH = new Map(
  CURRENT_043B_ALLOWED_FILE_SET.map((path) => [
    path,
    CURRENT_043B_UNTRACKED_PATHS.has(path) ? "A" : "M",
  ]),
);

const HOTFIX_043B_ALLOWED_FILE_SET = [
  "backend/.env.example",
  "backend/src/main/kotlin/ch/qamwaq/ritomer/shared/infrastructure/security/SecurityConfig.kt",
  "backend/src/main/resources/application-local.yml",
  "backend/src/test/kotlin/ch/qamwaq/ritomer/BalanceImportPersistenceIntegrationTest.kt",
  "backend/src/test/kotlin/ch/qamwaq/ritomer/ControlsDbIntegrationTest.kt",
  "backend/src/test/kotlin/ch/qamwaq/ritomer/DocumentsDbIntegrationTest.kt",
  "backend/src/test/kotlin/ch/qamwaq/ritomer/ExportsDbIntegrationTest.kt",
  "backend/src/test/kotlin/ch/qamwaq/ritomer/FinancialStatementsStructuredDbIntegrationTest.kt",
  "backend/src/test/kotlin/ch/qamwaq/ritomer/FinancialSummaryDbIntegrationTest.kt",
  "backend/src/test/kotlin/ch/qamwaq/ritomer/ManualMappingPersistenceIntegrationTest.kt",
  "backend/src/test/kotlin/ch/qamwaq/ritomer/MappingSuggestionDecisionDbIntegrationTest.kt",
  "backend/src/test/kotlin/ch/qamwaq/ritomer/PersistenceFoundationIntegrationTest.kt",
  "backend/src/test/kotlin/ch/qamwaq/ritomer/WorkpapersDbIntegrationTest.kt",
  "backend/src/test/kotlin/ch/qamwaq/ritomer/devtools/DemoSeedLocalAuthMeDbIntegrationTest.kt",
  "backend/src/test/kotlin/ch/qamwaq/ritomer/devtools/DemoSeedLocalDbIntegrationTest.kt",
  "backend/src/test/kotlin/ch/qamwaq/ritomer/devtools/DemoSeedLocalSourceGuardTest.kt",
  "backend/src/test/kotlin/ch/qamwaq/ritomer/shared/infrastructure/security/SecurityConfigJwtValidationTest.kt",
  "backend/src/test/kotlin/ch/qamwaq/ritomer/testsupport/DisposablePostgresTestDatabaseSupport.kt",
  "docs/product/v1-plan.md",
  "evals/mapping/validate-042a2-human-review-governance-kit.mjs",
  "frontend/local-two-actor-harness.mjs",
  "frontend/local-two-actor-harness.test.ts",
  "README.md",
  "runbooks/controlled-fiduciary-pilot-local-043.md",
  "runbooks/local-dev.md",
  "specs/active/043-controlled-fiduciary-pilot-readiness-v1.md",
].sort();

const HOTFIX_043B_ADDED_PATHS = new Set([
  "backend/src/test/kotlin/ch/qamwaq/ritomer/shared/infrastructure/security/SecurityConfigJwtValidationTest.kt",
  "backend/src/test/kotlin/ch/qamwaq/ritomer/testsupport/DisposablePostgresTestDatabaseSupport.kt",
]);

const EXPECTED_043B_HOTFIX_STATUS_BY_PATH = new Map(
  HOTFIX_043B_ALLOWED_FILE_SET.map((path) => [
    path,
    HOTFIX_043B_ADDED_PATHS.has(path) ? "A" : "M",
  ]),
);

const CURRENT_043C_PREPARATORY_FILE_SET = [
  CURRENT_SPEC_043_ACTIVE_PATH,
  CONTROLLED_043C_RUNBOOK_PATH,
  GOVERNANCE_CHECKER_PATH,
  CONTROLLED_043C_VALIDATOR_PATH,
].sort();

const CURRENT_043C_PREPARATORY_ADDED_PATHS = new Set([
  CONTROLLED_043C_VALIDATOR_PATH,
]);

const EXPECTED_043C_PREPARATORY_STATUS_BY_PATH = new Map(
  CURRENT_043C_PREPARATORY_FILE_SET.map((path) => [
    path,
    CURRENT_043C_PREPARATORY_ADDED_PATHS.has(path) ? "A" : "M",
  ]),
);

const CURRENT_043C_DURABLE_TRANSITION_FILE_SET = [
  CURRENT_SPEC_043_ACTIVE_PATH,
];

const EXPECTED_043C_DURABLE_TRANSITION_STATUS_BY_PATH = new Map([
  [CURRENT_SPEC_043_ACTIVE_PATH, "M"],
]);

const DURABLE_043C_LEDGER_KEYS = [
  "schemaVersion",
  "sequence",
  "state",
  "previousState",
  "recordedAtUtc",
  "recordedByRole",
  "authorityType",
  "authorityRef",
  "protocolId",
  "protocolSha256",
  "frozenCommit",
  "r1Authorized",
  "r2Authorized",
  "completedRun",
  "evidenceSha256",
  "cpoOutcome",
];

const DURABLE_043C_STATES = Object.freeze({
  S0: "043C_PLAN_HARDENED_IMPLEMENTATION_NOT_AUTHORIZED",
  S1: "043C_PREPARATORY_IMPLEMENTATION_AUTHORIZED",
  S2: "043C_PREPARATORY_IMPLEMENTED_PENDING_POST_CODE_CPO",
  S3: "043C_POST_CODE_CPO_PASS_PENDING_CTO",
  S4: "043C_PROTOCOL_FROZEN_READY_FOR_R1_DECISION",
  S7: "R1_CLEANUP_VALIDATED_READY_FOR_R2_DECISION",
  S10: "R2_CLEANUP_VALIDATED_READY_FOR_FINAL_CPO_DECISION",
  F1: "GO_TO_EXTERNAL_GATE_REVIEW",
  F2: "NO_GO",
  F3: "INCONCLUSIVE",
});

const LOCAL_ONLY_043C_STATES = new Set([
  "R1_ONLY_AUTHORIZED_NOT_STARTED",
  "R1_STARTED_CLEANUP_NOT_VALIDATED",
  "R2_ONLY_AUTHORIZED_NOT_STARTED",
  "R2_STARTED_CLEANUP_NOT_VALIDATED",
]);

const DURABLE_043C_ROLE_AUTHORITY = new Map([
  [DURABLE_043C_STATES.S0, ["CPO", "CPO_PLAN_HARDENING_DECISION"]],
  [DURABLE_043C_STATES.S1, ["CPO", "CPO_PREPARATORY_IMPLEMENTATION_DECISION"]],
  [DURABLE_043C_STATES.S2, ["PREPARATION_OWNER", "PREPARATORY_IMPLEMENTATION_EVIDENCE"]],
  [DURABLE_043C_STATES.S3, ["CPO", "CPO_POST_CODE_REVIEW"]],
  [DURABLE_043C_STATES.S4, ["CTO", "CTO_GATE"]],
  [DURABLE_043C_STATES.S7, ["COORDINATOR_043C", "R1_CLEANUP_EVIDENCE"]],
  [DURABLE_043C_STATES.S10, ["COORDINATOR_043C", "R2_CLEANUP_EVIDENCE"]],
  [DURABLE_043C_STATES.F1, ["CPO", "CPO_FINAL_DECISION"]],
  [DURABLE_043C_STATES.F2, ["CPO", "CPO_FINAL_DECISION"]],
  [DURABLE_043C_STATES.F3, ["CPO", "CPO_FINAL_DECISION"]],
]);

const DURABLE_043C_NEXT_STATES = new Map([
  [DURABLE_043C_STATES.S0, [DURABLE_043C_STATES.S1]],
  [DURABLE_043C_STATES.S1, [DURABLE_043C_STATES.S2]],
  [DURABLE_043C_STATES.S2, [DURABLE_043C_STATES.S3]],
  [DURABLE_043C_STATES.S3, [DURABLE_043C_STATES.S4]],
  [DURABLE_043C_STATES.S4, [DURABLE_043C_STATES.S7]],
  [DURABLE_043C_STATES.S7, [
    DURABLE_043C_STATES.S10,
    DURABLE_043C_STATES.F2,
    DURABLE_043C_STATES.F3,
  ]],
  [DURABLE_043C_STATES.S10, [
    DURABLE_043C_STATES.F1,
    DURABLE_043C_STATES.F2,
    DURABLE_043C_STATES.F3,
  ]],
  [DURABLE_043C_STATES.F1, []],
  [DURABLE_043C_STATES.F2, []],
  [DURABLE_043C_STATES.F3, []],
]);

const DURABLE_043C_DECLARED_PREVIOUS_STATES = new Map([
  [DURABLE_043C_STATES.S0, [null]],
  [DURABLE_043C_STATES.S1, [DURABLE_043C_STATES.S0]],
  [DURABLE_043C_STATES.S2, [DURABLE_043C_STATES.S1]],
  [DURABLE_043C_STATES.S3, [DURABLE_043C_STATES.S2]],
  [DURABLE_043C_STATES.S4, [DURABLE_043C_STATES.S3]],
  [DURABLE_043C_STATES.S7, ["R1_STARTED_CLEANUP_NOT_VALIDATED"]],
  [DURABLE_043C_STATES.S10, ["R2_STARTED_CLEANUP_NOT_VALIDATED"]],
  [DURABLE_043C_STATES.F1, [DURABLE_043C_STATES.S10]],
  [DURABLE_043C_STATES.F2, [DURABLE_043C_STATES.S7, DURABLE_043C_STATES.S10]],
  [DURABLE_043C_STATES.F3, [DURABLE_043C_STATES.S7, DURABLE_043C_STATES.S10]],
]);

const TERMINAL_043C_STATES = new Set([
  DURABLE_043C_STATES.F1,
  DURABLE_043C_STATES.F2,
  DURABLE_043C_STATES.F3,
]);

const VALIDATOR_043C_MODES = [
  "SelfTest",
  "PreparationPreflight",
  "PreR1",
  "PostR1Cleanup",
  "PreR2",
  "PostR2Cleanup",
];

const READ_PROCESS_043C_QUERY_IDS = [
  "GitStatus",
  "GitIndexFlags",
  "GitHeadCommit",
  "GitFrozenIsAncestorOfHead",
  "GitFrozenToHeadLinearHistory",
  "GitFrozenRunbookBlob",
  "GitHeadRunbookBlob",
  "GitFrozenSpecBlob",
  "GitCommitSpecBlob",
  "GitCommitRawDiff",
  "PsqlCatalog",
];

const READ_PROCESS_043C_GIT_QUERY_IDS = READ_PROCESS_043C_QUERY_IDS
  .filter((queryId) => queryId !== "PsqlCatalog");

const REQUIRED_043C_SELF_TEST_TOPICS = [
  "DURABLE_SOURCE_MISSING",
  "DURABLE_SOURCE_DUPLICATED",
  "DURABLE_STATE_MULTIPLE",
  "SEQUENCE_GAP",
  "SEQUENCE_DUPLICATE",
  "PREVIOUS_STATE_MISMATCH",
  "UNKNOWN_STATE",
  "EXTRA_PROPERTY",
  "UNKNOWN_RECORDED_BY_ROLE",
  "UNKNOWN_AUTHORITY_TYPE",
  "STATE_ROLE_AUTHORITY_MISMATCH",
  "PROTOCOL_ID_MISMATCH",
  "PROTOCOL_SHA256_MISMATCH",
  "PROTOCOL_SHA256_NON_NULL_BEFORE_S2",
  "PROTOCOL_SHA256_NULL_FROM_S2",
  "FROZEN_COMMIT_MISMATCH",
  "FROZEN_COMMIT_NON_NULL_BEFORE_S4",
  "FROZEN_COMMIT_NULL_FROM_S4",
  "FROZEN_DESCENDANT_SINGLE_LEDGER_APPEND_ACCEPTED",
  "FROZEN_BACKEND_CHANGE_REJECTED",
  "FROZEN_FRONTEND_CHANGE_REJECTED",
  "FROZEN_RUNBOOK_CHANGE_REJECTED",
  "FROZEN_PROTOCOL_CHANGE_REJECTED",
  "FROZEN_PRIOR_LEDGER_MUTATION_REJECTED",
  "FROZEN_SPEC_OUTSIDE_LEDGER_REJECTED",
  "FROZEN_NON_ANCESTOR_REJECTED",
  "FROZEN_INDEX_FLAGS_REJECTED",
  "COMPLETED_RUN_INVALID",
  "F1_REQUIRES_R2",
  "F1_REQUIRES_TWO_EXACT_AUDITS",
  "R1_ABORTED_CLEANUP_REQUIRED",
  "R1_ABORTED_CLEANUP_ALLOWS_S7",
  "R1_ABORTED_BLOCKS_R2",
  "R1_ABORTED_ALLOWS_NO_GO_OR_INCONCLUSIVE",
  "R1_COMPLETE_REQUIRES_R2_ONLY",
  "R2_ABORTED_BLOCKS_GO",
  "R2_ABORTED_CLEANUP_ALLOWS_S10",
  "R2_ABORTED_ALLOWS_NO_GO_OR_INCONCLUSIVE",
  "T15_INTERRUPTED_NO_CHECKPOINT",
  "MODE_STATE_MISMATCH",
  "LOCAL_STATE_FORBIDDEN_IN_GIT",
  "RESOURCE_TARGET_FORBIDDEN_IN_LEDGER",
  "WRITE_ATTEMPT_FORBIDDEN",
  "PASS_OUTPUT_FORBIDDEN_ON_ERROR",
  "S2_TO_S3_VALID",
  "S3_TO_S4_VALID",
  "S4_TO_S7_REQUIRES_RECEIVABLE_FIELDS",
  "S7_TO_S10_REQUIRES_R2_PATH",
  "S7_TO_F2_OR_F3_VALID",
  "S7_TO_F1_REJECTED",
  "S10_TO_F1_F2_F3_RULES",
  "CATALOG_BYPASSRLS_REJECTED",
  "CATALOG_DIRECT_MEMBERSHIP_REJECTED",
  "CATALOG_PREDEFINED_MEMBERSHIP_REJECTED",
  "CATALOG_OWNER_MISMATCH_REJECTED",
  "CATALOG_PRIVILEGED_FLAG_REJECTED",
  "CATALOG_RESULT_SHAPE_INCOMPLETE_REJECTED",
  "CATALOG_NOMINAL_EXACT_ACCEPTED",
  "CLUSTER_ONLY_PROOF_BLOCKS_PRE_RUN",
  "STORAGE_CHAIN_NORMAL_ACCEPTED",
  "STORAGE_ROOT_REPARSE_REJECTED",
  "STORAGE_RITOMER_REPARSE_REJECTED",
  "STORAGE_RUNTIME_REPARSE_REJECTED",
  "STORAGE_RUN_PARENT_REPARSE_REJECTED",
  "STORAGE_TARGET_REPARSE_REJECTED",
  "STORAGE_CANONICAL_ESCAPE_REJECTED",
  "STORAGE_TARGET_ABSENT_SAFE_PARENTS_ACCEPTED",
  "STORAGE_TARGET_ABSENT_UNSAFE_PARENT_REJECTED",
  "LOCAL_ARTIFACT_NOMINAL_READ_ACCEPTED",
  "LOCAL_ARTIFACT_AUTHORIZATION_FILE_REPARSE_REJECTED",
  "LOCAL_ARTIFACT_STATE_PARENT_REPARSE_REJECTED",
  "LOCAL_ARTIFACT_ACTIVE_STATE_FILE_REPARSE_REJECTED",
  "LOCAL_ARTIFACT_RUNS_PARENT_REPARSE_REJECTED",
  "LOCAL_ARTIFACT_R1_PARENT_REPARSE_REJECTED",
  "LOCAL_ARTIFACT_R2_PARENT_REPARSE_REJECTED",
  "LOCAL_ARTIFACT_EVIDENCE_FILE_REPARSE_REJECTED",
  "LOCAL_ARTIFACT_CANONICAL_ESCAPE_REJECTED",
  "LOCAL_ARTIFACT_ABSENT_SAFE_PREPARATION_ACCEPTED",
  "LOCAL_ARTIFACT_ABSENT_UNSAFE_PARENT_REJECTED",
  "POST_R2_COMPLETE_R1_NOMINAL_ACCEPTED",
  "POST_R2_R1_ABORTED_REJECTED",
  "POST_R2_COMPLETED_RUN_NULL_REJECTED",
  "POST_R2_R1_MISSING_NONZERO_REJECTED",
  "POST_R2_R1_UNEXPECTED_NONZERO_REJECTED",
  "LOCALAPPDATA_FIXED_LOCAL_ACCEPTED",
  "LOCALAPPDATA_UNC_REJECTED",
  "LOCALAPPDATA_DEVICE_PATH_REJECTED",
  "LOCALAPPDATA_NETWORK_DRIVE_REJECTED",
  "LOCALAPPDATA_RELATIVE_PATH_REJECTED",
  "ABORT_T00_NULL_START_ACCEPTED",
  "ABORT_T01_NULL_START_REJECTED",
];

const FROZEN_043B_DB_SAFETY_HASHES = new Map([
  ["backend/build.gradle.kts", "e43b54655a9bb71d29338ce0bd98a805d99f6d5c0a83fb5a4cc96624c2317397"],
  ["backend/src/test/kotlin/ch/qamwaq/ritomer/testsupport/DisposablePostgresTestDatabaseSupport.kt", "910d803c17e1ad05c3e2631426e6423ccfe7137f18b23bfe4fb35802c85426ef"],
  ["backend/src/test/kotlin/ch/qamwaq/ritomer/BalanceImportPersistenceIntegrationTest.kt", "36aebaa1b2e987f2dbdb7dc94a90d3fc44cac1323217f3baca23cf6120b8a732"],
  ["backend/src/test/kotlin/ch/qamwaq/ritomer/ControlsDbIntegrationTest.kt", "26ebb8b6cebbdf4a1fc91f22b9ddbe0ad91d1864e33273a7cd5cabbba14d5873"],
  ["backend/src/test/kotlin/ch/qamwaq/ritomer/DocumentsDbIntegrationTest.kt", "d796988254a22b235d0806915508f18efa344c214cb5e96820e1975dbfb776ee"],
  ["backend/src/test/kotlin/ch/qamwaq/ritomer/ExportsDbIntegrationTest.kt", "5fbd060716bf2e1a72cd6eaa6b275b44483cc6e63c3cdb9c9ca750fe23a6dce2"],
  ["backend/src/test/kotlin/ch/qamwaq/ritomer/FinancialStatementsStructuredDbIntegrationTest.kt", "67dc6f82d09ac9990c478cb0f3e54fdbbce8a1f4805946d9617fb6c2cb61a845"],
  ["backend/src/test/kotlin/ch/qamwaq/ritomer/FinancialSummaryDbIntegrationTest.kt", "8006e91f69adc5a62d584dfe6a210681870b7afd791189259add2d663d7ac995"],
  ["backend/src/test/kotlin/ch/qamwaq/ritomer/ManualMappingPersistenceIntegrationTest.kt", "5fc93975d2195057e405d9a416202625f13ad44a0e5ab9f89f4ebde968935230"],
  ["backend/src/test/kotlin/ch/qamwaq/ritomer/MappingSuggestionDecisionDbIntegrationTest.kt", "e2dee91df789fce56bb7d1911e17840fecdfc82d3d237b52143e04af68c1524a"],
  ["backend/src/test/kotlin/ch/qamwaq/ritomer/PersistenceFoundationIntegrationTest.kt", "d628a826918e590ce3f433c8df1a1e318789b624c4a06c2727ab8b81762d6bbe"],
  ["backend/src/test/kotlin/ch/qamwaq/ritomer/WorkpapersDbIntegrationTest.kt", "0a9a52de3a0629aab3d53f9c56ce132b5ca1307f7407f5ad8e8cb512a2914434"],
  ["backend/src/test/kotlin/ch/qamwaq/ritomer/devtools/DemoSeedLocalAuthMeDbIntegrationTest.kt", "0e418684eb497564f012175801708c8dea57aecc69ce3454549d0bcab09714a2"],
  ["backend/src/test/kotlin/ch/qamwaq/ritomer/devtools/DemoSeedLocalDbIntegrationTest.kt", "3f1a022391b594e56d501140f7267d7ac93ca07539d7af83f3ceb8a499ad9496"],
  ["backend/src/test/kotlin/ch/qamwaq/ritomer/devtools/DemoSeedLocalSourceGuardTest.kt", "9ec2671c88782a1e40c7473132636d217195f46ae1b34c280c494f2f283ee879"],
]);

const HOTFIX_043B_RUNTIME_IMPLEMENTATION_PATHS = new Set([
  "backend/src/main/kotlin/ch/qamwaq/ritomer/shared/infrastructure/security/SecurityConfig.kt",
  "backend/src/test/kotlin/ch/qamwaq/ritomer/testsupport/DisposablePostgresTestDatabaseSupport.kt",
  "frontend/local-two-actor-harness.mjs",
]);

const CURRENT_GOVERNANCE_FILE_SET = [...new Set(EXACT_ALLOWED_FILE_SET.map((path) =>
  path === HISTORICAL_SPEC_042_ACTIVE_PATH ? CURRENT_SPEC_042_BACKLOG_PATH : path,
))].sort();

const SCHEMA_PATHS = [
  "evals/mapping/reviews/042a2/reviewer-response-schema-v2.json",
  "evals/mapping/reviews/042a2/restricted-participant-registry-schema-v1.json",
  "evals/mapping/reviews/042a2/review-round-manifest-schema-v1.json",
  "evals/mapping/reviews/042a2/reviewer-attestation-schema-v1.json",
  "evals/mapping/reviews/042a2/review-freeze-record-schema-v1.json",
  "evals/mapping/reviews/042a2/workflow-ledger-record-schema-v1.json",
  "evals/mapping/reviews/042a2/review-clarification-record-schema-v1.json",
  "evals/mapping/reviews/042a2/adjudication-dossier-manifest-schema-v1.json",
];

const EXPECTED_REVIEW_DIRECTORY = [
  "adjudication-dossier-manifest-schema-v1.json",
  "restricted-participant-registry-schema-v1.json",
  "review-clarification-record-schema-v1.json",
  "review-freeze-record-schema-v1.json",
  "review-round-manifest-schema-v1.json",
  "reviewer-a-blind-v1.json",
  "reviewer-attestation-schema-v1.json",
  "reviewer-b-blind-v1.json",
  "reviewer-instructions-v1.md",
  "reviewer-response-schema-v1.json",
  "reviewer-response-schema-v2.json",
  "workflow-ledger-record-schema-v1.json",
  "workflow-transition-ledger-v1.jsonl",
].sort();

const DOCUMENTARY_HUMAN_REVIEW_ALLOWLIST = new Set([
  ...SCHEMA_PATHS,
  "evals/mapping/reviews/042a2/reviewer-a-blind-v1.json",
  "evals/mapping/reviews/042a2/reviewer-b-blind-v1.json",
  "evals/mapping/reviews/042a2/reviewer-response-schema-v1.json",
  "evals/mapping/reviews/042a2/reviewer-instructions-v1.md",
  "evals/mapping/reviews/042a2/workflow-transition-ledger-v1.jsonl",
  "evals/mapping/validate-042a2-human-review-responses.ps1",
  "evals/mapping/README.md",
  "policies/ai-mapping-annotation-guide-042a2.md",
  "policies/ai-mapping-business-evaluation-protocol-042a2.md",
  "policies/ai-mapping-human-review-hardening-record-042a2.md",
  "policies/ai-mapping-pilot-scope-manifest-042a2.md",
  "runbooks/ai-mapping-human-review-coordinator-042a2.md",
  HISTORICAL_SPEC_042_ACTIVE_PATH,
  CURRENT_SPEC_042_BACKLOG_PATH,
  "docs/product/v1-plan.md",
]);

const HUMAN_INSTANCE_SCHEMA_VERSIONS = new Set([
  "042a2-reviewer-response-v1",
  "042a2-reviewer-response-v2",
  "042a2-restricted-participant-registry-v1",
  "042a2-review-round-manifest-v1",
  "042a2-reviewer-attestation-v1",
  "042a2-review-freeze-record-v1",
  "042a2-review-clarification-record-v1",
  "042a2-adjudication-dossier-manifest-v1",
  "042a2-workflow-ledger-record-v1",
]);

const HUMAN_INSTANCE_STRUCTURAL_SIGNATURES = [
  ["reviewerPseudonym", "responses"],
  ["attestationType", "attestedAt"],
  ["manifestState", "distributionEvidence"],
  ["responseHash", "frozenAt"],
  ["agreementConfirmed", "approvalReference"],
];

const PROTECTED_HASHES = new Map([
  ["evals/mapping/reviews/042a2/workflow-transition-ledger-v1.jsonl", "f8f3759a537f743dbf5f78b20ca489995e7cb2e618c0f12c88507e4b43400447"],
  ["evals/mapping/reviews/042a2/reviewer-a-blind-v1.json", "19d654092fa6324d2e5eb80200ff1430e94a47cbbf671be62ea3ea668513fa59"],
  ["evals/mapping/reviews/042a2/reviewer-b-blind-v1.json", "bad54b421cbdee7357f6c618b3fa87f2f3e3a8a6e12d167dede09d84f5f8897f"],
  ["evals/mapping/reviews/042a2/reviewer-response-schema-v1.json", "2076ad96bce752e3689981a9b699adbb410eb7a635b35a0a02ffcfb1be23861c"],
  ["evals/mapping/build-042a2-blind-review-pack.ps1", "c8cdf1bd78736b5223183b90f9f1be75318f334ee83c996eff9f64a1619a7e58"],
  ["evals/mapping/validate-042a2-candidate-cases.ps1", "aad6d89c3ba94f7e890e896affdcd79c9577946fb9f5543d34ca549e3c7523ca"],
  ["evals/mapping/validate-042a2-blind-review-pack.ps1", "abe180bbbc672df8d9a2ad033098a505f4fb797b4fb30e9e8c7381fb51753508"],
  ["evals/mapping/validate-042a2-human-review-responses.ps1", "6ecf4e7a58d4134b6b557da0bcbf19cbcc4798842dfe9e85e07e6edbc34b373c"],
  ["evals/mapping/fixtures/042a2/candidate-semantic-cases-v1.json", "63aadb379da47c3909d9391646923ea173978e16ba256eff8bd903d1901d9f91"],
  ["evals/mapping/fixtures/042a2/candidate-policy-fault-cases-v1.json", "65b334a26f3054156421127bc20c1e8948c4e95bfc5a298a26d8b84d5b729d3c"],
]);

const PROTECTED_CASE_ARTIFACTS = new Set([
  "evals/mapping/reviews/042a2/reviewer-a-blind-v1.json",
  "evals/mapping/reviews/042a2/reviewer-b-blind-v1.json",
  "evals/mapping/fixtures/042a2/candidate-semantic-cases-v1.json",
  "evals/mapping/fixtures/042a2/candidate-policy-fault-cases-v1.json",
]);

const LEDGER_PATH = "evals/mapping/reviews/042a2/workflow-transition-ledger-v1.jsonl";
const EXPECTED_BASELINE_KEYS = [
  "schemaVersion",
  "recordType",
  "sequence",
  "previousRecordHash",
  "stateBefore",
  "stateAfter",
  "transitionApplied",
  "collectionAuthorized",
  "distributionAuthorized",
  "providerAuthorized",
  "goldenPromotionAuthorized",
  "adjudicationAuthorized",
  "retryAuthorized",
  "evidenceClass",
  "humanResponseEvidencePresent",
  "humanApprovalEvidencePresent",
  "humanSignaturePresent",
];

const EXPECTED_BASELINE = {
  schemaVersion: "042a2-workflow-ledger-record-v1",
  recordType: "HARDENING_ONLY",
  sequence: 0,
  previousRecordHash: "GENESIS",
  stateBefore: "PENDING_HUMAN_RESPONSES",
  stateAfter: "PENDING_HUMAN_RESPONSES",
  transitionApplied: false,
  collectionAuthorized: false,
  distributionAuthorized: false,
  providerAuthorized: false,
  goldenPromotionAuthorized: false,
  adjudicationAuthorized: false,
  retryAuthorized: false,
  evidenceClass: "CONFIGURATION_BASELINE",
  humanResponseEvidencePresent: false,
  humanApprovalEvidencePresent: false,
  humanSignaturePresent: false,
};

const errors = [];
const parsedSchemas = new Map();
let contentCommit;

function normalizePath(value) {
  return value.split(sep).join("/").replaceAll("\\", "/");
}

function absolutePath(repoPath) {
  return resolve(REPO_ROOT, repoPath);
}

function addError(message) {
  errors.push(message);
}

function assert(condition, message) {
  if (!condition) addError(message);
}

function readText(repoPath) {
  return contentCommit === undefined
    ? readFileSync(absolutePath(repoPath), "utf8")
    : gitOutput(["show", `${contentCommit}:${repoPath}`]);
}

function readTextAtCommit(repoPath, commit) {
  return commit === undefined
    ? readFileSync(absolutePath(repoPath), "utf8")
    : gitOutput(["show", `${commit}:${repoPath}`]);
}

function readBytes(repoPath, commit = contentCommit) {
  return commit === undefined
    ? readFileSync(absolutePath(repoPath))
    : gitBytes(["show", `${commit}:${repoPath}`]);
}

function pathExists(repoPath, commit = contentCommit) {
  return commit === undefined
    ? existsSync(absolutePath(repoPath))
    : gitCommandSucceeds(["cat-file", "-e", `${commit}:${repoPath}`]);
}

function parseJson(repoPath) {
  try {
    return JSON.parse(readText(repoPath));
  } catch (error) {
    addError(`${repoPath}: invalid JSON syntax (${error.name})`);
    return undefined;
  }
}

function sha256Bytes(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function validateFrozen043bDbSafetyContent() {
  const expectedPaths = [
    "backend/build.gradle.kts",
    "backend/src/test/kotlin/ch/qamwaq/ritomer/testsupport/DisposablePostgresTestDatabaseSupport.kt",
    ...HOTFIX_043B_ALLOWED_FILE_SET.filter((path) => path.endsWith("IntegrationTest.kt")),
    "backend/src/test/kotlin/ch/qamwaq/ritomer/devtools/DemoSeedLocalSourceGuardTest.kt",
  ].sort();
  const frozenPaths = [...FROZEN_043B_DB_SAFETY_HASHES.keys()].sort();
  const definitionExact = FROZEN_043B_DB_SAFETY_HASHES.size === 15
    && sameArray(frozenPaths, expectedPaths)
    && !FROZEN_043B_DB_SAFETY_HASHES.has(
      "evals/mapping/validate-042a2-human-review-governance-kit.mjs",
    );
  assert(definitionExact, `043b frozen DB safety snapshot must define exactly the 15 reviewed files`);

  let verified = definitionExact;
  for (const [path, expectedHash] of FROZEN_043B_DB_SAFETY_HASHES) {
    if (!pathExists(path)) {
      addError(`${path}:frozen_db_safety_file_missing`);
      verified = false;
      continue;
    }
    const actualHash = sha256Bytes(readBytes(path));
    if (actualHash !== expectedHash) {
      addError(`${path}:frozen_db_safety_hash_mismatch`);
      verified = false;
    }
  }
  return verified;
}

function sameArray(actual, expected) {
  return actual.length === expected.length && actual.every((value, index) => value === expected[index]);
}

export function classifyCurrentWorktreeProfile(paths) {
  if (!Array.isArray(paths) || paths.some((path) => typeof path !== "string" || path.length === 0)) {
    return WORKTREE_PROFILES.INVALID;
  }

  const normalized = paths.map(normalizePath);
  if (normalized.some((path) => path.length === 0) || new Set(normalized).size !== normalized.length) {
    return WORKTREE_PROFILES.INVALID;
  }
  normalized.sort();

  if (normalized.length === 0) return WORKTREE_PROFILES.CLEAN;
  if (sameArray(normalized, CURRENT_043A_ALLOWED_FILE_SET)) return WORKTREE_PROFILES.PILOT_043A;
  if (sameArray(normalized, CURRENT_043B_ALLOWED_FILE_SET)) return WORKTREE_PROFILES.HARNESS_043B;
  if (sameArray(normalized, HOTFIX_043B_ALLOWED_FILE_SET)) return WORKTREE_PROFILES.HOTFIX_043B;
  if (sameArray(normalized, CURRENT_043C_PREPARATORY_FILE_SET)) {
    return WORKTREE_PROFILES.PREPARATORY_043C;
  }
  if (sameArray(normalized, CURRENT_043C_DURABLE_TRANSITION_FILE_SET)) {
    return WORKTREE_PROFILES.DURABLE_TRANSITION_043C;
  }
  return WORKTREE_PROFILES.INVALID;
}

function gitOutput(args) {
  return execFileSync("git", args, {
    cwd: REPO_ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function gitBytes(args) {
  return execFileSync("git", args, {
    cwd: REPO_ROOT,
    encoding: null,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function gitCommandSucceeds(args) {
  try {
    execFileSync("git", args, {
      cwd: REPO_ROOT,
      encoding: "utf8",
      stdio: ["ignore", "ignore", "ignore"],
    });
    return true;
  } catch {
    return false;
  }
}

function parseCliArgs(args) {
  if (args.length === 0) return { mode: "WORKTREE" };

  let profile;
  let base;
  let head;
  let invalid = false;
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument !== "--profile" && argument !== "--base" && argument !== "--head") {
      addError("unsupported_argument");
      invalid = true;
      continue;
    }
    const value = args[index + 1];
    if (!value || value.startsWith("--")) {
      addError(`${argument}:full_sha_required`);
      invalid = true;
      continue;
    }
    index += 1;
    if (argument === "--profile") {
      if (profile !== undefined) {
        addError("--profile:duplicate_argument");
        invalid = true;
      }
      profile = value;
    } else if (argument === "--base") {
      if (base !== undefined) {
        addError("--base:duplicate_argument");
        invalid = true;
      }
      base = value;
    } else {
      if (head !== undefined) {
        addError("--head:duplicate_argument");
        invalid = true;
      }
      head = value;
    }
  }

  if (profile !== undefined
    && profile !== "043b"
    && profile !== "043b-hotfix"
    && profile !== "043c-preparation"
    && profile !== "043c-transition") {
    addError("--profile:unsupported_profile");
    invalid = true;
  }
  if ((base === undefined) !== (head === undefined)) {
    addError("historical_mode_requires_base_and_head_together");
    invalid = true;
  }
  if (profile !== undefined && (base === undefined || head === undefined)) {
    addError("historical_profile_requires_base_and_head_pair");
    invalid = true;
  }
  if (base === undefined || head === undefined) {
    console.log("validation_mode=INVALID_HISTORICAL_ARGUMENTS");
    return { mode: "INVALID" };
  }

  const fullShaPattern = /^[0-9a-f]{40}$/;
  if (!fullShaPattern.test(base)) {
    addError("--base:lowercase_full_sha_required");
    invalid = true;
  }
  if (!fullShaPattern.test(head)) {
    addError("--head:lowercase_full_sha_required");
    invalid = true;
  }
  if (profile === "043b") {
    if (base !== HISTORICAL_043B_BASE) {
      addError("--base:043b_exact_base_required");
      invalid = true;
    }
  } else if (profile === "043b-hotfix") {
    if (base !== HISTORICAL_043B_HOTFIX_BASE) {
      addError("--base:043b_hotfix_exact_base_required");
      invalid = true;
    }
  } else if (profile === "043c-preparation") {
    if (base !== HISTORICAL_043C_PREPARATION_BASE) {
      addError("--base:043c_preparation_exact_base_required");
      invalid = true;
    }
  } else if (profile === "043c-transition") {
    // A future durable transition cannot be pinned in advance. The closed
    // profile accepts only full SHA-1 commit ids and later proves that head is
    // a direct, single-parent child of base.
  } else {
    if (base !== PR99_BASE) {
      addError("--base:pr99_exact_base_required");
      invalid = true;
    }
    if (head !== PR99_HEAD) {
      addError("--head:pr99_exact_head_required");
      invalid = true;
    }
  }
  if (invalid) {
    console.log("validation_mode=INVALID_HISTORICAL_ARGUMENTS");
    return { mode: "INVALID" };
  }

  if (!gitCommandSucceeds(["cat-file", "-e", `${base}^{commit}`])) {
    addError("diff_base:git_commit_not_found");
  }
  if (!gitCommandSucceeds(["cat-file", "-e", `${head}^{commit}`])) {
    addError("diff_head:git_commit_not_found");
  }
  if (errors.length > 0) {
    console.log("validation_mode=INVALID_HISTORICAL_OBJECTS");
    return { mode: "INVALID" };
  }
  if (!gitCommandSucceeds(["merge-base", "--is-ancestor", base, head])) {
    addError("diff_base_is_not_ancestor_of_diff_head");
    console.log("validation_mode=INVALID_HISTORICAL_RANGE");
    return { mode: "INVALID" };
  }

  console.log("validation_mode=BASE_TO_HEAD");
  if (profile !== undefined) console.log(`historical_profile=${profile}`);
  console.log(`diff_base=${base}`);
  console.log(`diff_head=${head}`);
  if (profile === "043b") {
    console.log("historical_043b_base_pinned=YES");
    return { mode: "HISTORICAL_043B", profile, base, head };
  }
  if (profile === "043b-hotfix") {
    console.log("historical_043b_hotfix_base_pinned=YES");
    return { mode: "HISTORICAL_043B_HOTFIX", profile, base, head };
  }
  if (profile === "043c-preparation") {
    console.log("historical_043c_preparation_base_pinned=YES");
    return { mode: "HISTORICAL_043C_PREPARATION", profile, base, head };
  }
  if (profile === "043c-transition") {
    console.log("historical_043c_transition_full_sha_pair=YES");
    return { mode: "HISTORICAL_043C_TRANSITION", profile, base, head };
  }
  console.log("historical_pr99_range_pinned=YES");
  return { mode: "HISTORICAL", base, head };
}

function changedPaths() {
  const raw = gitOutput(["status", "--porcelain=v1", "-z", "--untracked-files=all"]);
  const entries = raw.split("\0").filter(Boolean);
  const paths = [];
  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    const status = entry.slice(0, 2);
    const candidate = entry.slice(3);
    paths.push(normalizePath(candidate));
    if (status.includes("R") || status.includes("C")) {
      index += 1;
      if (entries[index]) paths.push(normalizePath(entries[index]));
    }
  }
  return [...new Set(paths)].sort();
}

function stagedPaths() {
  return gitOutput(["diff", "--cached", "--name-only", "-z"])
    .split("\0")
    .filter(Boolean)
    .map(normalizePath)
    .sort();
}

function currentWorktreeStatusRecords() {
  const entries = gitOutput(["status", "--porcelain=v1", "-z", "--untracked-files=all"])
    .split("\0")
    .filter(Boolean);
  const records = [];
  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    const status = entry.slice(0, 2);
    const paths = [normalizePath(entry.slice(3))];
    if (status.includes("R") || status.includes("C")) {
      index += 1;
      if (entries[index]) paths.push(normalizePath(entries[index]));
    }
    records.push({ status, paths });
  }
  return records;
}

function environmentFilePaths() {
  const environmentPathspecs = [
    ".env",
    ".env.*",
    ":(glob)**/.env",
    ":(glob)**/.env.*",
  ];
  const tracked = gitOutput(["ls-files", "-z", "--cached", "--", ...environmentPathspecs]);
  const ignored = gitOutput([
    "ls-files",
    "-z",
    "--others",
    "--ignored",
    "--exclude-standard",
    "--",
    ...environmentPathspecs,
  ]);
  return [...new Set(`${tracked}${ignored}`
    .split("\0")
    .filter(Boolean)
    .map(normalizePath))]
    .filter((path) => path !== "backend/.env.example")
    .sort();
}

export function parseHistoricalNameStatus(rawOutput) {
  if (typeof rawOutput !== "string") {
    throw new TypeError("historical_name_status_output_must_be_a_string");
  }
  if (rawOutput.length === 0) return [];
  if (!rawOutput.endsWith("\0")) {
    throw new Error("historical_name_status_output_missing_terminal_nul");
  }

  const tokens = rawOutput.slice(0, -1).split("\0");
  const changes = [];
  let index = 0;
  while (index < tokens.length) {
    const statusToken = tokens[index];
    index += 1;
    if (statusToken.length === 0) {
      throw new Error("historical_name_status_empty_status_token");
    }

    const singlePathStatus = /^(A|M|D)$/.exec(statusToken);
    const scoredTwoPathStatus = /^([RC])([0-9]+)$/.exec(statusToken);
    let kind;
    let score = null;
    let pathCount;
    if (singlePathStatus) {
      kind = singlePathStatus[1];
      pathCount = 1;
    } else if (scoredTwoPathStatus) {
      kind = scoredTwoPathStatus[1];
      score = Number(scoredTwoPathStatus[2]);
      if (!Number.isInteger(score) || score < 0 || score > 100) {
        throw new Error(`historical_name_status_score_out_of_range:${statusToken}`);
      }
      pathCount = 2;
    } else {
      throw new Error(`historical_name_status_unknown_status:${statusToken}`);
    }

    const paths = [];
    for (let pathIndex = 0; pathIndex < pathCount; pathIndex += 1) {
      if (index >= tokens.length) {
        throw new Error(`historical_name_status_missing_path:${statusToken}:${pathIndex + 1}`);
      }
      const path = normalizePath(tokens[index]);
      index += 1;
      if (path.length === 0) {
        throw new Error(`historical_name_status_empty_path:${statusToken}:${pathIndex + 1}`);
      }
      paths.push(path);
    }
    changes.push({ kind, score, paths });
  }
  return changes;
}

export function historicalChangeWhitelistViolations(
  changes,
  expectedStatusByPath = EXPECTED_HISTORICAL_STATUS_BY_PATH,
) {
  const violations = [];
  const seenPaths = new Set();
  for (let index = 0; index < changes.length; index += 1) {
    const change = changes[index];
    const expectedPathCount = change?.kind === "R" || change?.kind === "C" ? 2 : 1;
    if (!change || !["A", "M", "D", "R", "C"].includes(change.kind)) {
      violations.push(`historical_change_${index + 1}:unknown_kind`);
      continue;
    }
    if (!Array.isArray(change.paths) || change.paths.length !== expectedPathCount) {
      violations.push(`historical_change_${index + 1}:${change.kind}:unexpected_path_count`);
      continue;
    }
    const scoreValid = change.kind === "R" || change.kind === "C"
      ? Number.isInteger(change.score) && change.score >= 0 && change.score <= 100
      : change.score === null;
    if (!scoreValid) violations.push(`historical_change_${index + 1}:${change.kind}:invalid_score`);

    for (const rawPath of change.paths) {
      if (typeof rawPath !== "string") {
        violations.push(`historical_change_${index + 1}:${change.kind}:invalid_path`);
        continue;
      }
      const path = normalizePath(rawPath);
      if (path.length === 0) {
        violations.push(`historical_change_${index + 1}:${change.kind}:empty_path`);
        continue;
      }
      if (seenPaths.has(path)) violations.push(`${path}:historical_path_repeated`);
      seenPaths.add(path);
      const expectedStatus = expectedStatusByPath.get(path);
      if (expectedStatus === undefined) {
        violations.push(`${path}:historical_path_outside_whitelist`);
      } else if (change.kind !== expectedStatus) {
        violations.push(`${path}:historical_status_${change.kind}_expected_${expectedStatus}`);
      }
    }
  }
  return violations;
}

function historicalChanges(base, head) {
  const rawOutput = gitOutput([
    "diff",
    "--no-ext-diff",
    "--name-status",
    "-z",
    "--find-renames",
    "--find-copies",
    "--find-copies-harder",
    "--diff-filter=ACDMR",
    `${base}..${head}`,
  ]);
  return parseHistoricalNameStatus(rawOutput);
}

function historicalChangedPaths(changes) {
  return [...new Set(changes.flatMap((change) => change.paths))].sort();
}

function historicalChangeTypeVisibilityEvidence() {
  function verifyProbe(rawOutput, expectedKind, expectedScore, expectedPaths) {
    const parsed = parseHistoricalNameStatus(rawOutput);
    const record = parsed[0];
    const projectedPaths = historicalChangedPaths(parsed);
    return parsed.length === 1
      && record.kind === expectedKind
      && record.score === expectedScore
      && sameArray(record.paths, expectedPaths)
      && sameArray(projectedPaths, [...expectedPaths].sort())
      && historicalChangeWhitelistViolations(parsed).length > 0;
  }

  const deletionPath = EXISTING_ALLOWED[0];
  const renamePaths = [EXISTING_ALLOWED[0], "outside/renamed-allowed.md"];
  const copyPaths = [EXISTING_ALLOWED[1], "outside/copied.md"];
  const deletionsVisible = verifyProbe(`D\0${deletionPath}\0`, "D", null, [deletionPath]);
  const renameEndpointsVisible = verifyProbe(
    `R100\0${renamePaths[0]}\0${renamePaths[1]}\0`,
    "R",
    100,
    renamePaths,
  );
  const copyEndpointsVisible = verifyProbe(
    `C100\0${copyPaths[0]}\0${copyPaths[1]}\0`,
    "C",
    100,
    copyPaths,
  );
  return {
    changeTypesVerified: deletionsVisible && renameEndpointsVisible && copyEndpointsVisible,
    deletionsVisible,
    renameEndpointsVisible,
    copyEndpointsVisible,
  };
}

function commitTreePaths(commit) {
  return gitOutput(["ls-tree", "-r", "--name-only", "-z", commit])
    .split("\0")
    .filter(Boolean)
    .map(normalizePath)
    .sort();
}

function validate043bPackageJsonCommitRange(base, head) {
  let basePackage;
  let headPackage;
  try {
    basePackage = JSON.parse(gitOutput(["show", `${base}:frontend/package.json`]));
    headPackage = JSON.parse(gitOutput(["show", `${head}:frontend/package.json`]));
  } catch (error) {
    addError(`frontend/package.json:043b_commit_JSON_${error.name}`);
    return false;
  }

  const baseWithoutScripts = { ...basePackage };
  const headWithoutScripts = { ...headPackage };
  delete baseWithoutScripts.scripts;
  delete headWithoutScripts.scripts;
  const nonScriptsUnchanged = isDeepStrictEqual(headWithoutScripts, baseWithoutScripts);
  assert(nonScriptsUnchanged, `frontend/package.json: every property outside scripts must remain structurally identical from 043b base to head`);

  let dependencyGroupsUnchanged = true;
  for (const property of [
    "dependencies",
    "devDependencies",
    "peerDependencies",
    "optionalDependencies",
    "packageManager",
  ]) {
    const unchanged = isDeepStrictEqual(headPackage[property], basePackage[property]);
    dependencyGroupsUnchanged = dependencyGroupsUnchanged && unchanged;
    assert(unchanged, `frontend/package.json:${property} must remain structurally identical from 043b base to head`);
  }

  const baseScripts = basePackage.scripts;
  const headScripts = headPackage.scripts;
  const scriptsAreObjects = baseScripts !== null
    && headScripts !== null
    && typeof baseScripts === "object"
    && typeof headScripts === "object"
    && !Array.isArray(baseScripts)
    && !Array.isArray(headScripts);
  assert(scriptsAreObjects, `frontend/package.json:scripts must remain JSON objects in the 043b commit range`);
  if (!scriptsAreObjects) return false;

  const baseScriptNames = Object.keys(baseScripts).sort();
  const headScriptNames = Object.keys(headScripts).sort();
  const addedScripts = headScriptNames.filter((name) => !Object.hasOwn(baseScripts, name));
  const removedScripts = baseScriptNames.filter((name) => !Object.hasOwn(headScripts, name));
  const modifiedScripts = baseScriptNames.filter((name) =>
    Object.hasOwn(headScripts, name) && headScripts[name] !== baseScripts[name]);
  const exactAddedScript = sameArray(addedScripts, ["dev:two-actor-local"])
    && headScripts["dev:two-actor-local"] === "node ./local-two-actor-harness.mjs";
  const existingScriptsUnchanged = removedScripts.length === 0 && modifiedScripts.length === 0;
  assert(exactAddedScript, `frontend/package.json: the committed 043b range must add only the exact dev:two-actor-local script`);
  assert(existingScriptsUnchanged, `frontend/package.json: the committed 043b range must not remove or modify existing scripts`);

  const lockfileUnchanged = gitCommandSucceeds(["diff", "--quiet", base, head, "--", "frontend/pnpm-lock.yaml"]);
  assert(lockfileUnchanged, `frontend/pnpm-lock.yaml: committed 043b lockfile drift is forbidden`);
  return nonScriptsUnchanged
    && dependencyGroupsUnchanged
    && exactAddedScript
    && existingScriptsUnchanged
    && lockfileUnchanged;
}

function validate043bHistoricalAnchors(base, head) {
  let fixturesUnchanged = true;
  let protectedArtifactsUnchanged = true;
  for (const commit of [base, head]) {
    for (const [path, expectedHash] of FROZEN_043A_HASHES) {
      const exact = pathExists(path, commit)
        && sha256Bytes(readBytes(path, commit)) === expectedHash;
      fixturesUnchanged = fixturesUnchanged && exact;
      assert(exact, `${path}: frozen 043a artifact differs at committed 043b ${commit === base ? "base" : "head"}`);
    }
    for (const [path, expectedHash] of PROTECTED_HASHES) {
      const exact = pathExists(path, commit)
        && sha256Bytes(readBytes(path, commit)) === expectedHash;
      protectedArtifactsUnchanged = protectedArtifactsUnchanged && exact;
      assert(exact, `${path}: protected 042 artifact differs at committed 043b ${commit === base ? "base" : "head"}`);
    }
  }
  return { fixturesUnchanged, protectedArtifactsUnchanged };
}

function validate043bHistoricalRange(actual, changes, range) {
  const exactFileSet = sameArray(actual, CURRENT_043B_ALLOWED_FILE_SET);
  assert(exactFileSet, `base-to-head file set differs from the exact 17-path 043b whitelist`);

  const whitelistViolations = historicalChangeWhitelistViolations(
    changes,
    EXPECTED_043B_HISTORICAL_STATUS_BY_PATH,
  );
  whitelistViolations.forEach(addError);
  const statusCounts = { A: 0, M: 0, D: 0, R: 0, C: 0 };
  for (const change of changes) statusCounts[change.kind] += 1;
  const expectedStatusMapVerified = exactFileSet
    && whitelistViolations.length === 0
    && statusCounts.M === 14
    && statusCounts.A === 3
    && statusCounts.D === 0
    && statusCounts.R === 0
    && statusCounts.C === 0;
  assert(expectedStatusMapVerified, `base-to-head statuses differ from the exact 14M/3A 043b matrix`);

  const visibilityEvidence = historicalChangeTypeVisibilityEvidence();
  assert(visibilityEvidence.changeTypesVerified, `historical 043b change-type probes failed`);

  const allowedPathsPresent = CURRENT_043B_ALLOWED_FILE_SET.every((path) => pathExists(path, range.head));
  assert(allowedPathsPresent, `every path in the closed 17-path 043b whitelist must exist in the head commit`);
  const forbiddenSurfaceAbsent = actual.filter(is043bForbiddenSurface).length === 0;
  assert(forbiddenSurfaceAbsent, `043b historical range changes a forbidden runtime, contract, CI, migration, lockfile or fixture surface`);

  const environmentFilesAbsent = commitTreePaths(range.head)
    .filter((path) => /(^|\/)\.env(?:\.|$)/i.test(path))
    .filter((path) => path !== "backend/.env.example")
    .length === 0;
  assert(environmentFilesAbsent, `043b head commit contains a tracked .env file outside the committed example`);

  const packageJsonScriptOnly = validate043bPackageJsonCommitRange(range.base, range.head);
  const anchors = validate043bHistoricalAnchors(range.base, range.head);
  const lifecycle = validate043bLifecycle();
  const sensitiveRuntime = validate043bSensitiveAndRuntimeAdditions(range);
  return {
    historicalProfile: "043b",
    exactFileSet,
    expectedStatusMapVerified,
    changeTypesVerified: visibilityEvidence.changeTypesVerified,
    deletionsVisible: visibilityEvidence.deletionsVisible,
    renameEndpointsVisible: visibilityEvidence.renameEndpointsVisible,
    copyEndpointsVisible: visibilityEvidence.copyEndpointsVisible,
    allowedPathsPresent,
    forbiddenSurfaceAbsent,
    environmentFilesAbsent,
    packageJsonScriptOnly,
    fixtures043aUnchanged: anchors.fixturesUnchanged,
    protected042ArtifactsUnchanged: anchors.protectedArtifactsUnchanged,
    ...lifecycle,
    ...sensitiveRuntime,
  };
}

function extractKotlinFunction(source, signature) {
  const start = source.indexOf(signature);
  if (start < 0) return undefined;
  const openBrace = source.indexOf("{", start);
  if (openBrace < 0) return undefined;
  let depth = 0;
  for (let index = openBrace; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1).replaceAll("\r\n", "\n");
    }
  }
  return undefined;
}

function validate043bHotfixContents(range = undefined) {
  const securityPath = "backend/src/main/kotlin/ch/qamwaq/ritomer/shared/infrastructure/security/SecurityConfig.kt";
  const securitySource = readText(securityPath);
  const baseSecuritySource = gitOutput([
    "show",
    `${range?.base ?? "HEAD"}:${securityPath}`,
  ]);
  const unchangedSecurityFunctions = [
    "fun securityFilterChain(",
    "fun jwtAuthenticationConverter(",
    "fun jwtDecoder(",
  ].every((signature) =>
    extractKotlinFunction(securitySource, signature)
      === extractKotlinFunction(baseSecuritySource, signature));
  assert(unchangedSecurityFunctions, `043b hotfix must preserve the filter chain, converter and non-local decoder function bodies`);

  const strictJwtMarkers = [
    `@Profile("local | test | dbtest")`,
    "fun localTestDbtestJwtDecoder(): JwtDecoder",
    `@Profile("!local & !test & !dbtest")`,
    ".macAlgorithm(MacAlgorithm.HS256)",
    "Clock.systemUTC()",
    "LOCAL_JWT_MAXIMUM_TTL_SECONDS = 3_600L",
    "LOCAL_JWT_MAXIMUM_FUTURE_IAT_SECONDS = 60L",
    "local-dev-only-jwt-hmac-secret-change-me",
    "__INVALID_RUNTIME_SECRET_REQUIRED__",
  ];
  const strictJwtContent = strictJwtMarkers.every((marker) => securitySource.includes(marker))
    && !/(issuer|audience|oidc|jwks)/i.test(securitySource);
  assert(strictJwtContent, `043b hotfix strict local JWT decoder markers are incomplete or broaden production auth`);

  const localYaml = readText("backend/src/main/resources/application-local.yml");
  const environmentExample = readText("backend/.env.example");
  const localConfigurationExact = /server:\s*\r?\n\s+address:\s*127\.0\.0\.1/.test(localYaml)
    && localYaml.includes("hmac-secret: ${RITOMER_SECURITY_JWT_HMAC_SECRET}")
    && !localYaml.includes("hmac-secret: ${RITOMER_SECURITY_JWT_HMAC_SECRET:")
    && environmentExample.includes("RITOMER_SECURITY_JWT_HMAC_SECRET=__INVALID_RUNTIME_SECRET_REQUIRED__")
    && !environmentExample.includes("RITOMER_SECURITY_JWT_HMAC_SECRET=local-dev-only-jwt-hmac-secret-change-me");
  assert(localConfigurationExact, `043b hotfix local server binding or non-functional secret model differs`);

  const harness = readText("frontend/local-two-actor-harness.mjs");
  const harnessTests = readText("frontend/local-two-actor-harness.test.ts");
  const harnessHardened = [
    "local-dev-only-jwt-hmac-secret-change-me",
    "__INVALID_RUNTIME_SECRET_REQUIRED__",
    "Buffer.byteLength(secret, \"utf8\") < 32",
  ].every((marker) => harness.includes(marker))
    && harnessTests.includes("JWT_HMAC_SECRET_PLACEHOLDER_FORBIDDEN") === false
    && harnessTests.includes("__INVALID_RUNTIME_SECRET_REQUIRED__")
    && harnessTests.includes("local-dev-only-jwt-hmac-secret-change-me");
  assert(harnessHardened, `043b hotfix harness secret policy is incomplete`);

  const frozenDbSafetyContent = validateFrozen043bDbSafetyContent();
  const sourceGuard = readText(
    "backend/src/test/kotlin/ch/qamwaq/ritomer/devtools/DemoSeedLocalSourceGuardTest.kt",
  );
  const authoritativeDeleteMarkers = [
    "targeted_append_only_delete_probes=",
    "delete_probe_export_pack=",
    "delete_probe_audit_event=",
    "unexpected_delete_outside_support=",
    "delete_sql_inside_support=",
  ];
  const compiledDeletePolicyExact = authoritativeDeleteMarkers.every((marker) =>
    sourceGuard.includes(marker))
    && !sourceGuard.includes(["raw", "delete", "outside", "support="].join("_"));
  assert(compiledDeletePolicyExact, `043b compiled scanner DELETE policy markers are incomplete or obsolete`);

  const canonicalEnglish = "043b is a local single-operator two-role simulation.";
  const canonicalFrench = "043b est une simulation locale mono-opérateur de deux rôles.";
  const documents = [
    "README.md",
    "docs/product/v1-plan.md",
    CURRENT_SPEC_043_ACTIVE_PATH,
    "runbooks/controlled-fiduciary-pilot-local-043.md",
    "runbooks/local-dev.md",
  ].map(readText);
  const forbiddenReviewClaims = [
    ["TWO", "INDEPENDENT", "ACTORS", "PROVED"].join("_"),
    ["SEGREGATION", "OF", "DUTIES", "PROVED"].join("_"),
    ["HUMAN", "REVIEWED"].join("_"),
    ["HUMAN", "APPROVED"].join("_"),
  ];
  const unsignedHumanSignaturePattern = new RegExp(
    `(?<!NOT_)${["HUMAN", "SIGNED"].join("_")}`,
  );
  const postureDocumented = documents.some((text) => text.includes(canonicalEnglish))
    && documents.some((text) => text.includes(canonicalFrench))
    && documents.every((text) =>
      !forbiddenReviewClaims.some((claim) => text.includes(claim))
      && !unsignedHumanSignaturePattern.test(text));
  assert(postureDocumented, `043b hotfix single-operator posture or review classification is incomplete`);

  return {
    unchangedSecurityFunctions,
    strictJwtContent,
    localConfigurationExact,
    harnessHardened,
    frozenDbSafetyContent,
    compiledDeletePolicyExact,
    postureDocumented,
  };
}

function validate043bHotfixHistoricalRange(actual, changes, range) {
  const exactFileSet = sameArray(actual, HOTFIX_043B_ALLOWED_FILE_SET);
  assert(exactFileSet, `base-to-head file set differs from the exact 26-path 043b-hotfix whitelist`);
  const whitelistViolations = historicalChangeWhitelistViolations(
    changes,
    EXPECTED_043B_HOTFIX_STATUS_BY_PATH,
  );
  whitelistViolations.forEach(addError);
  const statusCounts = { A: 0, M: 0, D: 0, R: 0, C: 0 };
  for (const change of changes) statusCounts[change.kind] += 1;
  const expectedStatusMapVerified = exactFileSet
    && whitelistViolations.length === 0
    && statusCounts.M === 24
    && statusCounts.A === 2
    && statusCounts.D === 0
    && statusCounts.R === 0
    && statusCounts.C === 0;
  assert(expectedStatusMapVerified, `base-to-head statuses differ from the exact 24M/2A 043b-hotfix matrix`);

  const visibilityEvidence = historicalChangeTypeVisibilityEvidence();
  assert(visibilityEvidence.changeTypesVerified, `historical 043b-hotfix change-type probes failed`);
  const allowedPathsPresent = HOTFIX_043B_ALLOWED_FILE_SET.every((path) => pathExists(path, range.head));
  assert(allowedPathsPresent, `every path in the closed 26-path 043b-hotfix whitelist must exist in the head commit`);
  const environmentFilesAbsent = commitTreePaths(range.head)
    .filter((path) => /(^|\/)\.env(?:\.|$)/i.test(path))
    .filter((path) => path !== "backend/.env.example")
    .length === 0;
  assert(environmentFilesAbsent, `043b-hotfix head commit contains a tracked .env file outside the example`);

  const content = validate043bHotfixContents(range);
  const lifecycle = validate043bLifecycle();
  const sensitiveRuntime = validate043bSensitiveAndRuntimeAdditions(
    range,
    HOTFIX_043B_ALLOWED_FILE_SET,
    HOTFIX_043B_RUNTIME_IMPLEMENTATION_PATHS,
  );
  return {
    historicalProfile: "043b-hotfix",
    exactFileSet,
    expectedStatusMapVerified,
    changeTypesVerified: visibilityEvidence.changeTypesVerified,
    deletionsVisible: visibilityEvidence.deletionsVisible,
    renameEndpointsVisible: visibilityEvidence.renameEndpointsVisible,
    copyEndpointsVisible: visibilityEvidence.copyEndpointsVisible,
    allowedPathsPresent,
    environmentFilesAbsent,
    ...content,
    ...lifecycle,
    ...sensitiveRuntime,
  };
}

function validate043bHotfixWorktree(actual) {
  const exactFileSet = sameArray(actual, HOTFIX_043B_ALLOWED_FILE_SET);
  assert(exactFileSet, `worktree file set must be exactly the closed 26-path 043b-hotfix whitelist`);
  const allowedPathsPresent = HOTFIX_043B_ALLOWED_FILE_SET.every((path) => existsSync(absolutePath(path)));
  assert(allowedPathsPresent, `every path in the closed 26-path 043b-hotfix whitelist must exist in the worktree`);
  const stagedEmpty = stagedPaths().length === 0;
  assert(stagedEmpty, `043b-hotfix worktree validation requires an empty staged index`);

  const records = currentWorktreeStatusRecords();
  const statusPaths = [...new Set(records.flatMap((record) => record.paths))].sort();
  const modifiedCount = records.filter((record) => record.status === " M").length;
  const untrackedCount = records.filter((record) => record.status === "??").length;
  const statusMatrixExact = records.length === 26
    && sameArray(statusPaths, HOTFIX_043B_ALLOWED_FILE_SET)
    && modifiedCount === 24
    && untrackedCount === 2
    && records.every((record) => record.paths.length === 1
      && record.status === (HOTFIX_043B_ADDED_PATHS.has(record.paths[0]) ? "??" : " M"));
  assert(statusMatrixExact, `043b-hotfix worktree status matrix must be exactly 24 unstaged modifications and 2 untracked additions`);

  const environmentFilesAbsent = environmentFilePaths().length === 0;
  assert(environmentFilesAbsent, `043b-hotfix worktree contains a tracked or ignored .env file outside the example`);
  const content = validate043bHotfixContents();
  const lifecycle = validate043bLifecycle();
  const sensitiveRuntime = validate043bSensitiveAndRuntimeAdditions(
    undefined,
    HOTFIX_043B_ALLOWED_FILE_SET,
    HOTFIX_043B_RUNTIME_IMPLEMENTATION_PATHS,
  );
  return {
    worktreeProfile: WORKTREE_PROFILES.HOTFIX_043B,
    exactFileSet,
    allowedPathsPresent,
    stagedEmpty,
    statusMatrixExact,
    environmentFilesAbsent,
    ...content,
    ...lifecycle,
    ...sensitiveRuntime,
  };
}

function countBufferOccurrences(bytes, markerBytes) {
  let count = 0;
  let offset = 0;
  while (offset <= bytes.length - markerBytes.length) {
    const index = bytes.indexOf(markerBytes, offset);
    if (index < 0) break;
    count += 1;
    offset = index + markerBytes.length;
  }
  return count;
}

function extractUniqueMarkedBlock(bytes, beginMarker, endMarker, label, issues) {
  const beginBytes = Buffer.from(beginMarker, "utf8");
  const endBytes = Buffer.from(endMarker, "utf8");
  const beginCount = countBufferOccurrences(bytes, beginBytes);
  const endCount = countBufferOccurrences(bytes, endBytes);
  if (beginCount !== 1) issues.push(`${label}:begin_marker_count_${beginCount}_expected_1`);
  if (endCount !== 1) issues.push(`${label}:end_marker_count_${endCount}_expected_1`);
  if (beginCount !== 1 || endCount !== 1) return undefined;

  const beginIndex = bytes.indexOf(beginBytes);
  const endIndex = bytes.indexOf(endBytes);
  const beginAtLineBoundary = beginIndex === 0 || bytes[beginIndex - 1] === 0x0a;
  const beginLineEnd = beginIndex + beginBytes.length;
  const beginOwnLine = beginLineEnd < bytes.length && bytes[beginLineEnd] === 0x0a;
  const endAtLineBoundary = endIndex > 0 && bytes[endIndex - 1] === 0x0a;
  const endLineEnd = endIndex + endBytes.length;
  const endOwnLine = endLineEnd === bytes.length || bytes[endLineEnd] === 0x0a;
  if (!beginAtLineBoundary || !beginOwnLine) issues.push(`${label}:begin_marker_must_be_an_exact_line`);
  if (!endAtLineBoundary || !endOwnLine) issues.push(`${label}:end_marker_must_be_an_exact_line`);
  if (endIndex <= beginLineEnd) {
    issues.push(`${label}:marker_order_invalid`);
    return undefined;
  }

  const body = bytes.subarray(beginLineEnd + 1, endIndex);
  if (body.length === 0) issues.push(`${label}:body_empty`);
  if (body.includes(0x0d)) issues.push(`${label}:CR_or_CRLF_forbidden`);
  if (body[0] === 0xef && body[1] === 0xbb && body[2] === 0xbf) {
    issues.push(`${label}:UTF8_BOM_forbidden`);
  }
  if (body.length === 0 || body[body.length - 1] !== 0x0a) {
    issues.push(`${label}:terminal_LF_required`);
  } else if (body.length > 1 && body[body.length - 2] === 0x0a) {
    issues.push(`${label}:exactly_one_terminal_LF_required`);
  }
  return body;
}

function extractUniqueMarkedRegion(bytes, beginMarker, endMarker, label, issues) {
  const body = extractUniqueMarkedBlock(bytes, beginMarker, endMarker, label, issues);
  if (!body) return undefined;
  const beginBytes = Buffer.from(beginMarker, "utf8");
  const endBytes = Buffer.from(endMarker, "utf8");
  const beginIndex = bytes.indexOf(beginBytes);
  const bodyStart = beginIndex + beginBytes.length + 1;
  const bodyEnd = bytes.indexOf(endBytes);
  return {
    body,
    prefix: bytes.subarray(0, bodyStart),
    suffix: bytes.subarray(bodyEnd),
  };
}

function strictUtcTimestamp(value) {
  return typeof value === "string"
    && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
    && !Number.isNaN(Date.parse(value))
    && new Date(value).toISOString() === value;
}

function validate043cProtocolBytes(runbookBytes) {
  const issues = [];
  if (runbookBytes[0] === 0xef && runbookBytes[1] === 0xbb && runbookBytes[2] === 0xbf) {
    issues.push("043c_protocol:runbook_UTF8_BOM_forbidden");
  }
  const body = extractUniqueMarkedBlock(
    runbookBytes,
    PROTOCOL_043C_BEGIN,
    PROTOCOL_043C_END,
    "043c_protocol",
    issues,
  );
  const protocolSha256 = body ? sha256Bytes(body) : undefined;
  if (body) {
    const protocolText = body.toString("utf8");
    if (!Buffer.from(protocolText, "utf8").equals(body)) {
      issues.push("043c_protocol:invalid_UTF8");
    }
    if (!protocolText.includes(PROTOCOL_043C_ID)) {
      issues.push("043c_protocol:protocol_id_missing");
    }
  }
  return { issues, body, protocolSha256 };
}

function validate043cDurableLedgerBytes(specBytes, expectedProtocolSha256) {
  const issues = [];
  const region = extractUniqueMarkedRegion(
    specBytes,
    DURABLE_043C_LEDGER_BEGIN,
    DURABLE_043C_LEDGER_END,
    "043c_durable_ledger",
    issues,
  );
  if (!region) return { issues, records: [], lines: [], region: undefined };

  const { body } = region;
  const text = body.toString("utf8");
  if (!Buffer.from(text, "utf8").equals(body)) issues.push("043c_durable_ledger:invalid_UTF8");
  const withoutTerminalLf = text.endsWith("\n") ? text.slice(0, -1) : text;
  const lines = withoutTerminalLf.split("\n");
  if (lines.some((line) => line.length === 0)) issues.push("043c_durable_ledger:blank_record_forbidden");

  const records = [];
  lines.forEach((line, index) => {
    try {
      const record = JSON.parse(line);
      if (record === null || typeof record !== "object" || Array.isArray(record)) {
        issues.push(`043c_durable_ledger:${index + 1}:record_must_be_an_object`);
        return;
      }
      records.push(record);
      if (JSON.stringify(record) !== line) {
        issues.push(`043c_durable_ledger:${index + 1}:compact_deterministic_JSON_required`);
      }
      if (!sameArray(Object.keys(record), DURABLE_043C_LEDGER_KEYS)) {
        issues.push(`043c_durable_ledger:${index + 1}:exact_16_key_order_required`);
      }
      if (Object.hasOwn(record, "resourceTargetSha256")) {
        issues.push(`043c_durable_ledger:${index + 1}:resourceTargetSha256_forbidden`);
      }
      if (LOCAL_ONLY_043C_STATES.has(record.state)) {
        issues.push(`043c_durable_ledger:${index + 1}:local_only_state_forbidden`);
      }
      const roleAuthority = DURABLE_043C_ROLE_AUTHORITY.get(record.state);
      if (!roleAuthority) {
        issues.push(`043c_durable_ledger:${index + 1}:unknown_durable_state`);
      } else if (record.recordedByRole !== roleAuthority[0]
        || record.authorityType !== roleAuthority[1]) {
        issues.push(`043c_durable_ledger:${index + 1}:state_role_authority_mismatch`);
      }
      if (!strictUtcTimestamp(record.recordedAtUtc)) {
        issues.push(`043c_durable_ledger:${index + 1}:recordedAtUtc_invalid`);
      }
      if (typeof record.authorityRef !== "string"
        || !/^043c-[a-z0-9][a-z0-9-]{6,95}$/.test(record.authorityRef)) {
        issues.push(`043c_durable_ledger:${index + 1}:authorityRef_invalid`);
      }
      if (record.schemaVersion !== 1) {
        issues.push(`043c_durable_ledger:${index + 1}:schemaVersion_must_be_1`);
      }
      if (record.r1Authorized !== false || record.r2Authorized !== false) {
        issues.push(`043c_durable_ledger:${index + 1}:durable_authorizations_must_be_false`);
      }
    } catch (error) {
      issues.push(`043c_durable_ledger:${index + 1}:invalid_JSON_${error.name}`);
    }
  });

  if (records.length !== lines.length || records.length === 0) {
    return { issues, records, lines, region };
  }

  let stableFrozenCommit;
  const seenStates = new Set();
  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    const previousRecord = index === 0 ? undefined : records[index - 1];
    const state = record.state;
    const label = `043c_durable_ledger:${index + 1}`;

    if (!Number.isInteger(record.sequence) || record.sequence !== index) {
      issues.push(`${label}:sequence_not_contiguous`);
    }
    if (seenStates.has(state)) issues.push(`${label}:durable_state_duplicate`);
    seenStates.add(state);

    const declaredPreviousStates = DURABLE_043C_DECLARED_PREVIOUS_STATES.get(state);
    if (!declaredPreviousStates || !declaredPreviousStates.includes(record.previousState)) {
      issues.push(`${label}:previousState_mismatch`);
    }
    if (index === 0) {
      if (state !== DURABLE_043C_STATES.S0) issues.push(`${label}:S0_must_be_first`);
    } else {
      const nextStates = DURABLE_043C_NEXT_STATES.get(previousRecord.state) ?? [];
      if (!nextStates.includes(state)) issues.push(`${label}:durable_transition_invalid`);
      if (strictUtcTimestamp(previousRecord.recordedAtUtc)
        && strictUtcTimestamp(record.recordedAtUtc)
        && Date.parse(record.recordedAtUtc) <= Date.parse(previousRecord.recordedAtUtc)) {
        issues.push(`${label}:recordedAtUtc_not_strictly_increasing`);
      }
    }

    if (index < records.length - 1 && TERMINAL_043C_STATES.has(state)) {
      issues.push(`${label}:terminal_must_be_unique_and_last`);
    }

    const beforeS2 = state === DURABLE_043C_STATES.S0 || state === DURABLE_043C_STATES.S1;
    if (beforeS2) {
      if (record.protocolId !== null) issues.push(`${label}:protocolId_must_be_null_before_S2`);
      if (record.protocolSha256 !== null) {
        issues.push(`${label}:protocolSha256_must_be_null_before_S2`);
      }
    } else {
      if (record.protocolId !== PROTOCOL_043C_ID) issues.push(`${label}:protocolId_mismatch`);
      if (typeof record.protocolSha256 !== "string"
        || !/^[0-9a-f]{64}$/.test(record.protocolSha256)
        || record.protocolSha256 !== expectedProtocolSha256) {
        issues.push(`${label}:protocolSha256_mismatch`);
      }
    }

    const beforeS4 = [
      DURABLE_043C_STATES.S0,
      DURABLE_043C_STATES.S1,
      DURABLE_043C_STATES.S2,
      DURABLE_043C_STATES.S3,
    ].includes(state);
    if (beforeS4) {
      if (record.frozenCommit !== null) issues.push(`${label}:frozenCommit_must_be_null_before_S4`);
    } else if (typeof record.frozenCommit !== "string"
      || !/^[0-9a-f]{40}$/.test(record.frozenCommit)) {
      issues.push(`${label}:frozenCommit_invalid_from_S4`);
    } else if (stableFrozenCommit === undefined) {
      stableFrozenCommit = record.frozenCommit;
    } else if (record.frozenCommit !== stableFrozenCommit) {
      issues.push(`${label}:frozenCommit_not_stable`);
    }

    let completedRunValid;
    if ([
      DURABLE_043C_STATES.S0,
      DURABLE_043C_STATES.S1,
      DURABLE_043C_STATES.S2,
      DURABLE_043C_STATES.S3,
      DURABLE_043C_STATES.S4,
    ].includes(state)) {
      completedRunValid = record.completedRun === null;
    } else if (state === DURABLE_043C_STATES.S7) {
      completedRunValid = record.completedRun === null || record.completedRun === "R1";
    } else if (state === DURABLE_043C_STATES.S10) {
      completedRunValid = record.completedRun === "R1" || record.completedRun === "R2";
    } else if (state === DURABLE_043C_STATES.F1) {
      completedRunValid = record.completedRun === "R2";
    } else {
      completedRunValid = record.completedRun === null
        || record.completedRun === "R1"
        || record.completedRun === "R2";
    }
    if (!completedRunValid) issues.push(`${label}:completedRun_invalid`);

    const beforeEvidence = [
      DURABLE_043C_STATES.S0,
      DURABLE_043C_STATES.S1,
      DURABLE_043C_STATES.S2,
      DURABLE_043C_STATES.S3,
      DURABLE_043C_STATES.S4,
    ].includes(state);
    if (beforeEvidence) {
      if (record.evidenceSha256 !== null) issues.push(`${label}:evidenceSha256_must_be_null`);
    } else if (typeof record.evidenceSha256 !== "string"
      || !/^[0-9a-f]{64}$/.test(record.evidenceSha256)) {
      issues.push(`${label}:evidenceSha256_invalid`);
    }

    if (TERMINAL_043C_STATES.has(state)) {
      if (record.cpoOutcome !== state) issues.push(`${label}:cpoOutcome_terminal_mismatch`);
      if (previousRecord
        && (record.previousState !== previousRecord.state
          || record.completedRun !== previousRecord.completedRun
          || record.evidenceSha256 !== previousRecord.evidenceSha256)) {
        issues.push(`${label}:terminal_must_preserve_source_facts`);
      }
    } else if (record.cpoOutcome !== null) {
      issues.push(`${label}:cpoOutcome_must_be_null_before_terminal`);
    }

    if (state === DURABLE_043C_STATES.S10
      && previousRecord?.state === DURABLE_043C_STATES.S7
      && previousRecord.completedRun !== "R1") {
      issues.push(`${label}:S10_requires_completed_R1_path`);
    }
    if (state === DURABLE_043C_STATES.F1
      && (previousRecord?.state !== DURABLE_043C_STATES.S10
        || previousRecord.completedRun !== "R2")) {
      issues.push(`${label}:F1_requires_completed_R2_path`);
    }
  }

  return { issues, records, lines, region };
}

function validate043cPreparatoryLedgerBytes(specBytes, expectedProtocolSha256) {
  const validation = validate043cDurableLedgerBytes(specBytes, expectedProtocolSha256);
  const issues = [...validation.issues];
  if (validation.records.length !== 3) {
    issues.push(`043c_preparatory_ledger:record_count_${validation.records.length}_expected_3`);
  }
  const expectedRecords = [
    {
      schemaVersion: 1,
      sequence: 0,
      state: DURABLE_043C_STATES.S0,
      previousState: null,
      recordedAtUtc: "2026-07-29T14:43:47.532Z",
      recordedByRole: "CPO",
      authorityType: "CPO_PLAN_HARDENING_DECISION",
      authorityRef: "043c-plan-hardened-v1",
      protocolId: null,
      protocolSha256: null,
      frozenCommit: null,
      r1Authorized: false,
      r2Authorized: false,
      completedRun: null,
      evidenceSha256: null,
      cpoOutcome: null,
    },
    {
      schemaVersion: 1,
      sequence: 1,
      state: DURABLE_043C_STATES.S1,
      previousState: DURABLE_043C_STATES.S0,
      recordedAtUtc: "2026-07-29T14:43:47.658Z",
      recordedByRole: "CPO",
      authorityType: "CPO_PREPARATORY_IMPLEMENTATION_DECISION",
      authorityRef: "043c-preparatory-implementation-authorized-v1",
      protocolId: null,
      protocolSha256: null,
      frozenCommit: null,
      r1Authorized: false,
      r2Authorized: false,
      completedRun: null,
      evidenceSha256: null,
      cpoOutcome: null,
    },
    {
      schemaVersion: 1,
      sequence: 2,
      state: DURABLE_043C_STATES.S2,
      previousState: DURABLE_043C_STATES.S1,
      recordedAtUtc: "2026-07-29T14:43:47.692Z",
      recordedByRole: "PREPARATION_OWNER",
      authorityType: "PREPARATORY_IMPLEMENTATION_EVIDENCE",
      authorityRef: "043c-preparatory-implementation-evidence-v1",
      protocolId: PROTOCOL_043C_ID,
      protocolSha256: expectedProtocolSha256,
      frozenCommit: null,
      r1Authorized: false,
      r2Authorized: false,
      completedRun: null,
      evidenceSha256: null,
      cpoOutcome: null,
    },
  ];
  expectedRecords.forEach((expected, index) => {
    if (!isDeepStrictEqual(validation.records[index], expected)) {
      issues.push(`043c_preparatory_ledger:${index + 1}:canonical_record_mismatch`);
    }
  });
  if (validation.records.at(-1)?.state !== DURABLE_043C_STATES.S2) {
    issues.push("043c_preparatory_ledger:last_state_must_be_S2");
  }
  return { ...validation, issues };
}

function validate043cSingleAppendTransition(
  baseSpecBytes,
  headSpecBytes,
  expectedProtocolSha256,
  expectedFrozenCommitForS4 = undefined,
) {
  const issues = [];
  const base = validate043cDurableLedgerBytes(baseSpecBytes, expectedProtocolSha256);
  const head = validate043cDurableLedgerBytes(headSpecBytes, expectedProtocolSha256);
  base.issues.forEach((issue) => issues.push(`043c_transition:base:${issue}`));
  head.issues.forEach((issue) => issues.push(`043c_transition:head:${issue}`));

  let outsideLedgerByteIdentical = false;
  let priorRecordsByteIdentical = false;
  let exactlyOneRecordAppended = false;
  if (base.region && head.region) {
    outsideLedgerByteIdentical = base.region.prefix.equals(head.region.prefix)
      && base.region.suffix.equals(head.region.suffix);
    if (!outsideLedgerByteIdentical) {
      issues.push("043c_transition:spec_outside_ledger_must_be_byte_identical");
    }

    priorRecordsByteIdentical = head.region.body.length >= base.region.body.length
      && head.region.body.subarray(0, base.region.body.length).equals(base.region.body);
    if (!priorRecordsByteIdentical) {
      issues.push("043c_transition:prior_records_must_be_byte_identical");
    }

    const appendedBytes = priorRecordsByteIdentical
      ? head.region.body.subarray(base.region.body.length)
      : Buffer.alloc(0);
    exactlyOneRecordAppended = head.records.length === base.records.length + 1
      && appendedBytes.length > 1
      && appendedBytes[appendedBytes.length - 1] === 0x0a
      && appendedBytes.indexOf(0x0a) === appendedBytes.length - 1;
    if (!exactlyOneRecordAppended) {
      issues.push("043c_transition:exactly_one_JSONL_record_must_be_appended");
    }
  }

  const sourceRecord = base.records.at(-1);
  const newRecord = head.records.at(-1);
  const isS3ToS4 = exactlyOneRecordAppended
    && sourceRecord?.state === DURABLE_043C_STATES.S3
    && newRecord?.state === DURABLE_043C_STATES.S4;
  if (isS3ToS4) {
    if (typeof expectedFrozenCommitForS4 !== "string"
      || !/^[0-9a-f]{40}$/.test(expectedFrozenCommitForS4)) {
      issues.push("043c_transition:S4_expected_frozen_commit_context_required");
    } else if (newRecord.frozenCommit !== expectedFrozenCommitForS4) {
      issues.push("043c_transition:S4_frozen_commit_must_equal_transition_base");
    }
  }

  return {
    issues,
    base,
    head,
    outsideLedgerByteIdentical,
    priorRecordsByteIdentical,
    exactlyOneRecordAppended,
  };
}

function newSynthetic043cRecord({
  sequence,
  state,
  previousState,
  recordedAtUtc,
  recordedByRole,
  authorityType,
  authorityRef,
  protocolId,
  protocolSha256,
  frozenCommit,
  completedRun = null,
  evidenceSha256 = null,
  cpoOutcome = null,
}) {
  return {
    schemaVersion: 1,
    sequence,
    state,
    previousState,
    recordedAtUtc,
    recordedByRole,
    authorityType,
    authorityRef,
    protocolId,
    protocolSha256,
    frozenCommit,
    r1Authorized: false,
    r2Authorized: false,
    completedRun,
    evidenceSha256,
    cpoOutcome,
  };
}

function synthetic043cSpecBytes(records) {
  const ledger = records.map((record) => JSON.stringify(record)).join("\n");
  return Buffer.from([
    "# Synthetic 043c transition probe",
    DURABLE_043C_LEDGER_BEGIN,
    ledger,
    DURABLE_043C_LEDGER_END,
    "synthetic_tail=true",
    "",
  ].join("\n"), "utf8");
}

function validate043cDurableTransitionSyntheticProbes() {
  const protocolHash = "a".repeat(64);
  const frozenCommit = "b".repeat(40);
  const baseRecords = [
    newSynthetic043cRecord({
      sequence: 0,
      state: DURABLE_043C_STATES.S0,
      previousState: null,
      recordedAtUtc: "2026-01-01T00:00:00.000Z",
      recordedByRole: "CPO",
      authorityType: "CPO_PLAN_HARDENING_DECISION",
      authorityRef: "043c-plan-hardened-probe",
      protocolId: null,
      protocolSha256: null,
      frozenCommit: null,
    }),
    newSynthetic043cRecord({
      sequence: 1,
      state: DURABLE_043C_STATES.S1,
      previousState: DURABLE_043C_STATES.S0,
      recordedAtUtc: "2026-01-01T00:00:00.001Z",
      recordedByRole: "CPO",
      authorityType: "CPO_PREPARATORY_IMPLEMENTATION_DECISION",
      authorityRef: "043c-preparatory-authorized-probe",
      protocolId: null,
      protocolSha256: null,
      frozenCommit: null,
    }),
    newSynthetic043cRecord({
      sequence: 2,
      state: DURABLE_043C_STATES.S2,
      previousState: DURABLE_043C_STATES.S1,
      recordedAtUtc: "2026-01-01T00:00:00.002Z",
      recordedByRole: "PREPARATION_OWNER",
      authorityType: "PREPARATORY_IMPLEMENTATION_EVIDENCE",
      authorityRef: "043c-preparatory-evidence-probe",
      protocolId: PROTOCOL_043C_ID,
      protocolSha256: protocolHash,
      frozenCommit: null,
    }),
  ];
  const s3 = newSynthetic043cRecord({
    sequence: 3,
    state: DURABLE_043C_STATES.S3,
    previousState: DURABLE_043C_STATES.S2,
    recordedAtUtc: "2026-01-01T00:00:00.003Z",
    recordedByRole: "CPO",
    authorityType: "CPO_POST_CODE_REVIEW",
    authorityRef: "043c-post-code-review-probe",
    protocolId: PROTOCOL_043C_ID,
    protocolSha256: protocolHash,
    frozenCommit: null,
  });
  const s4 = newSynthetic043cRecord({
    sequence: 4,
    state: DURABLE_043C_STATES.S4,
    previousState: DURABLE_043C_STATES.S3,
    recordedAtUtc: "2026-01-01T00:00:00.004Z",
    recordedByRole: "CTO",
    authorityType: "CTO_GATE",
    authorityRef: "043c-cto-gate-probe",
    protocolId: PROTOCOL_043C_ID,
    protocolSha256: protocolHash,
    frozenCommit,
  });

  const baseSpec = synthetic043cSpecBytes(baseRecords);
  const validHead = synthetic043cSpecBytes([...baseRecords, s3]);
  const valid = validate043cSingleAppendTransition(baseSpec, validHead, protocolHash);
  const validSingleAppendAccepted = valid.issues.length === 0;

  const mutatedBaseRecords = baseRecords.map((record) => ({ ...record }));
  mutatedBaseRecords[0].authorityRef = "043c-plan-hardened-other";
  const mutatedHead = synthetic043cSpecBytes([...mutatedBaseRecords, s3]);
  const mutation = validate043cSingleAppendTransition(baseSpec, mutatedHead, protocolHash);
  const oldRecordMutationRejected = mutation.issues.includes(
    "043c_transition:prior_records_must_be_byte_identical",
  );

  const doubleHead = synthetic043cSpecBytes([...baseRecords, s3, s4]);
  const doubleAppend = validate043cSingleAppendTransition(baseSpec, doubleHead, protocolHash);
  const twoAppendsRejected = doubleAppend.issues.includes(
    "043c_transition:exactly_one_JSONL_record_must_be_appended",
  );

  const outsideHead = Buffer.from(validHead);
  outsideHead[0] = outsideHead[0] === 0x23 ? 0x21 : 0x23;
  const outsideMutation = validate043cSingleAppendTransition(
    baseSpec,
    outsideHead,
    protocolHash,
  );
  const outsideLedgerMutationRejected = outsideMutation.issues.includes(
    "043c_transition:spec_outside_ledger_must_be_byte_identical",
  );

  const fifthPathRejected = classifyCurrentWorktreeProfile([
    ...CURRENT_043C_PREPARATORY_FILE_SET,
    "docs/product/v1-plan.md",
  ]) === WORKTREE_PROFILES.INVALID
    && classifyCurrentWorktreeProfile([
      ...CURRENT_043C_DURABLE_TRANSITION_FILE_SET,
      "docs/product/v1-plan.md",
    ]) === WORKTREE_PROFILES.INVALID;

  const s3Spec = synthetic043cSpecBytes([...baseRecords, s3]);
  const historicalS4Spec = synthetic043cSpecBytes([...baseRecords, s3, s4]);
  const historicalBinding = validate043cSingleAppendTransition(
    s3Spec,
    historicalS4Spec,
    protocolHash,
    frozenCommit,
  );
  const historicalBaseFrozenCommitAccepted = historicalBinding.issues.length === 0;

  const historicalArbitraryS4 = { ...s4, frozenCommit: "c".repeat(40) };
  const historicalArbitraryBinding = validate043cSingleAppendTransition(
    s3Spec,
    synthetic043cSpecBytes([...baseRecords, s3, historicalArbitraryS4]),
    protocolHash,
    frozenCommit,
  );
  const historicalArbitraryFrozenCommitRejected =
    historicalArbitraryBinding.issues.includes(
      "043c_transition:S4_frozen_commit_must_equal_transition_base",
    );

  const worktreeHeadCommit = "d".repeat(40);
  const worktreeS4 = { ...s4, frozenCommit: worktreeHeadCommit };
  const worktreeBinding = validate043cSingleAppendTransition(
    s3Spec,
    synthetic043cSpecBytes([...baseRecords, s3, worktreeS4]),
    protocolHash,
    worktreeHeadCommit,
  );
  const worktreeHeadFrozenCommitAccepted = worktreeBinding.issues.length === 0;

  const worktreeNonHeadS4 = { ...s4, frozenCommit: "e".repeat(40) };
  const worktreeNonHeadBinding = validate043cSingleAppendTransition(
    s3Spec,
    synthetic043cSpecBytes([...baseRecords, s3, worktreeNonHeadS4]),
    protocolHash,
    worktreeHeadCommit,
  );
  const worktreeNonHeadFrozenCommitRejected =
    worktreeNonHeadBinding.issues.includes(
      "043c_transition:S4_frozen_commit_must_equal_transition_base",
    );

  const omittedBindingContext = validate043cSingleAppendTransition(
    s3Spec,
    historicalS4Spec,
    protocolHash,
  );
  const exactFrozenCommitBindingOmissionRejected =
    omittedBindingContext.issues.includes(
      "043c_transition:S4_expected_frozen_commit_context_required",
    );

  const passed = validSingleAppendAccepted
    && oldRecordMutationRejected
    && twoAppendsRejected
    && outsideLedgerMutationRejected
    && fifthPathRejected
    && historicalBaseFrozenCommitAccepted
    && historicalArbitraryFrozenCommitRejected
    && worktreeHeadFrozenCommitAccepted
    && worktreeNonHeadFrozenCommitRejected
    && exactFrozenCommitBindingOmissionRejected;
  assert(passed, "043c_transition:mandatory_in_memory_append_only_probes_failed");
  return {
    transitionSyntheticProbes: passed,
    validSingleAppendAccepted,
    oldRecordMutationRejected,
    twoAppendsRejected,
    outsideLedgerMutationRejected,
    fifthPathRejected,
    S3_TO_S4_HISTORICAL_BASE_FROZEN_COMMIT_ACCEPTED:
      historicalBaseFrozenCommitAccepted,
    S3_TO_S4_HISTORICAL_ARBITRARY_FROZEN_COMMIT_REJECTED:
      historicalArbitraryFrozenCommitRejected,
    S3_TO_S4_WORKTREE_HEAD_FROZEN_COMMIT_ACCEPTED:
      worktreeHeadFrozenCommitAccepted,
    S3_TO_S4_WORKTREE_NON_HEAD_FROZEN_COMMIT_REJECTED:
      worktreeNonHeadFrozenCommitRejected,
    exactFrozenCommitBindingOmissionRejected,
  };
}

function quotedTokens(value) {
  return [...value.matchAll(/["']([^"']+)["']/g)].map((match) => match[1]);
}

function maskPowerShellNonExecutableText(source) {
  const blank = (value) => value.replace(/[^\r\n]/g, " ");
  return source
    .replace(/@'(?:\r?\n)[\s\S]*?^'@/gm, blank)
    .replace(/@"(?:\r?\n)[\s\S]*?^"@/gm, blank)
    .replace(/<#[\s\S]*?#>/g, blank)
    .replace(/'(?:''|[^'\r\n])*'/g, blank)
    .replace(/"(?:`[^\r\n]|[^"`\r\n])*"/g, blank)
    .replace(/#[^\r\n]*/g, blank);
}

function powerShellLiteralTexts(source) {
  const values = [];
  let index = 0;
  while (index < source.length) {
    if (source.startsWith("<#", index)) {
      const end = source.indexOf("#>", index + 2);
      index = end < 0 ? source.length : end + 2;
      continue;
    }
    if (source[index] === "#") {
      const end = source.indexOf("\n", index + 1);
      index = end < 0 ? source.length : end + 1;
      continue;
    }
    const hereQuote = source[index] === "@"
      && (source[index + 1] === "'" || source[index + 1] === "\"")
      && (source[index + 2] === "\n"
        || (source[index + 2] === "\r" && source[index + 3] === "\n"))
      ? source[index + 1]
      : undefined;
    if (hereQuote) {
      const bodyStart = source[index + 2] === "\r" ? index + 4 : index + 3;
      const closeToken = `\n${hereQuote}@`;
      const closeIndex = source.indexOf(closeToken, bodyStart);
      if (closeIndex < 0) {
        values.push(source.slice(bodyStart));
        break;
      }
      values.push(source.slice(bodyStart, closeIndex));
      index = closeIndex + closeToken.length;
      continue;
    }
    if (source[index] === "'") {
      let value = "";
      index += 1;
      while (index < source.length) {
        if (source[index] === "'" && source[index + 1] === "'") {
          value += "'";
          index += 2;
        } else if (source[index] === "'") {
          index += 1;
          break;
        } else {
          value += source[index];
          index += 1;
        }
      }
      values.push(value);
      continue;
    }
    if (source[index] === "\"") {
      let value = "";
      index += 1;
      while (index < source.length) {
        if (source[index] === "`" && index + 1 < source.length) {
          value += source[index + 1];
          index += 2;
        } else if (source[index] === "\"") {
          index += 1;
          break;
        } else {
          value += source[index];
          index += 1;
        }
      }
      values.push(value);
      continue;
    }
    index += 1;
  }
  return values;
}

function firstPowerShellParamBlock(source, executableSource) {
  const match = /\bparam\s*\(/i.exec(executableSource);
  if (!match) return undefined;
  const openIndex = executableSource.indexOf("(", match.index);
  let depth = 1;
  for (let index = openIndex + 1; index < executableSource.length; index += 1) {
    if (executableSource[index] === "(") depth += 1;
    if (executableSource[index] === ")") depth -= 1;
    if (depth === 0) return source.slice(openIndex + 1, index);
  }
  return undefined;
}

function regexEscape(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function powerShellFunctionRegions(source, executableSource, functionName) {
  const regions = [];
  const pattern = new RegExp(
    `\\bfunction\\s+${regexEscape(functionName)}\\s*\\{`,
    "gi",
  );
  let match;
  while ((match = pattern.exec(executableSource)) !== null) {
    const openIndex = executableSource.indexOf("{", match.index);
    let depth = 1;
    let closeIndex;
    for (let index = openIndex + 1; index < executableSource.length; index += 1) {
      if (executableSource[index] === "{") depth += 1;
      if (executableSource[index] === "}") depth -= 1;
      if (depth === 0) {
        closeIndex = index;
        break;
      }
    }
    if (closeIndex === undefined) break;
    regions.push({
      start: match.index,
      end: closeIndex + 1,
      bodyStart: openIndex + 1,
      bodyEnd: closeIndex,
      source: source.slice(openIndex + 1, closeIndex),
      executable: executableSource.slice(openIndex + 1, closeIndex),
    });
    pattern.lastIndex = closeIndex + 1;
  }
  return regions;
}

function powerShellLiteralArgumentCalls(region, commandName, parameterName) {
  const calls = [];
  const pattern = new RegExp(
    `\\b${regexEscape(commandName)}\\s+-${regexEscape(parameterName)}\\s+`
      + "(['\"])([^'\"\\r\\n]+)\\1",
    "gi",
  );
  for (const match of region.source.matchAll(pattern)) {
    const executableMatch = region.executable.slice(
      match.index,
      match.index + match[0].length,
    );
    const executablePrefix = new RegExp(
      `^\\b${regexEscape(commandName)}\\s+-${regexEscape(parameterName)}\\b`,
      "i",
    );
    if (executablePrefix.test(executableMatch)) calls.push(match[2]);
  }
  return calls;
}

function powerShellCorrelatedPatternCount(
  region,
  sourcePattern,
  executablePattern,
) {
  const flags = sourcePattern.flags.includes("g")
    ? sourcePattern.flags
    : `${sourcePattern.flags}g`;
  const pattern = new RegExp(sourcePattern.source, flags);
  let count = 0;
  for (const match of region.source.matchAll(pattern)) {
    const executableFragment = region.executable.slice(
      match.index,
      match.index + match[0].length,
    );
    executablePattern.lastIndex = 0;
    if (executablePattern.test(executableFragment)) count += 1;
  }
  return count;
}

function powerShellLiteralEqualityBranches(region, variableName) {
  const branches = [];
  const pattern = new RegExp(
    `\\b(?:if|elseif)\\s*\\(\\s*\\$${regexEscape(variableName)}`
      + "\\s+-ceq\\s+(['\"])([^'\"\\r\\n]+)\\1\\s*\\)\\s*\\{",
    "gi",
  );
  for (const match of region.source.matchAll(pattern)) {
    const openIndex = region.source.indexOf("{", match.index);
    if (openIndex < 0) continue;
    const executableHeader = region.executable.slice(match.index, openIndex + 1);
    if (!/\b(?:if|elseif)\s*\(/i.test(executableHeader)
      || !new RegExp(`\\$${regexEscape(variableName)}\\b`, "i")
        .test(executableHeader)
      || !/-ceq\b/i.test(executableHeader)
      || !/\{\s*$/.test(executableHeader)) {
      continue;
    }

    let depth = 1;
    let closeIndex;
    for (let index = openIndex + 1; index < region.executable.length; index += 1) {
      if (region.executable[index] === "{") depth += 1;
      if (region.executable[index] === "}") depth -= 1;
      if (depth === 0) {
        closeIndex = index;
        break;
      }
    }
    if (closeIndex === undefined) continue;
    branches.push({
      value: match[2],
      source: region.source.slice(openIndex + 1, closeIndex),
      executable: region.executable.slice(openIndex + 1, closeIndex),
    });
  }
  return branches;
}

function powerShellLiteralSwitchBranches(region, branchValue) {
  const branches = [];
  const pattern = new RegExp(
    `(['"])${regexEscape(branchValue)}\\1\\s*\\{`,
    "gi",
  );
  for (const match of region.source.matchAll(pattern)) {
    const openIndex = region.source.indexOf("{", match.index);
    if (openIndex < 0 || region.executable[openIndex] !== "{") continue;
    let depth = 1;
    let closeIndex;
    for (let index = openIndex + 1; index < region.executable.length; index += 1) {
      if (region.executable[index] === "{") depth += 1;
      if (region.executable[index] === "}") depth -= 1;
      if (depth === 0) {
        closeIndex = index;
        break;
      }
    }
    if (closeIndex === undefined) continue;
    branches.push({
      value: branchValue,
      start: openIndex + 1,
      end: closeIndex,
      source: region.source.slice(openIndex + 1, closeIndex),
      executable: region.executable.slice(openIndex + 1, closeIndex),
    });
  }
  return branches;
}

function mutatePowerShellSwitchBranch(
  source,
  functionName,
  branchValue,
  target,
  replacement,
) {
  const executableSource = maskPowerShellNonExecutableText(source);
  const regions = powerShellFunctionRegions(source, executableSource, functionName);
  if (regions.length !== 1) return source;
  const branches = powerShellLiteralSwitchBranches(regions[0], branchValue);
  if (branches.length !== 1) return source;
  const branch = branches[0];
  if (branch.source.split(target).length !== 2) return source;
  const mutatedBranch = branch.source.replace(target, replacement);
  const absoluteStart = regions[0].bodyStart + branch.start;
  const absoluteEnd = regions[0].bodyStart + branch.end;
  return source.slice(0, absoluteStart) + mutatedBranch + source.slice(absoluteEnd);
}

function powerShellExecutableBlockRegions(region, headerPattern) {
  const flags = headerPattern.flags.includes("g")
    ? headerPattern.flags
    : `${headerPattern.flags}g`;
  const pattern = new RegExp(headerPattern.source, flags);
  const blocks = [];
  for (const match of region.executable.matchAll(pattern)) {
    const openIndex = region.executable.indexOf("{", match.index);
    if (openIndex < 0) continue;
    let depth = 1;
    let closeIndex;
    for (let index = openIndex + 1; index < region.executable.length; index += 1) {
      if (region.executable[index] === "{") depth += 1;
      if (region.executable[index] === "}") depth -= 1;
      if (depth === 0) {
        closeIndex = index;
        break;
      }
    }
    if (closeIndex === undefined) continue;
    blocks.push({
      source: region.source.slice(openIndex + 1, closeIndex),
      executable: region.executable.slice(openIndex + 1, closeIndex),
    });
  }
  return blocks;
}

function validate043cExternalAdapterStructure(source, executableSource) {
  const issues = [];
  const requiredFunctions = [
    "Read-StrictUtf8File",
    "Get-RepositoryArtifacts",
    "Get-ReadToolPath",
    "Invoke-ReadProcess",
    "Convert-GitHeadCommitOutput",
    "Test-GitIndexFlagsOutput",
    "Test-LinearFrozenHistory",
    "Test-ExactLedgerOnlyRawDiff",
    "Test-SingleLedgerSpecAppend",
    "Test-FrozenGitEvidence",
    "Test-FrozenProtocolAndGit",
    "Convert-CatalogProof",
    "Test-ApprovedLocalApplicationDataRoot",
    "Test-StorageComponentChain",
    "Get-StorageResourceState",
    "Get-ResourceStates",
    "Get-LocalArtifactDefinition",
    "Get-LocalArtifactObservationToken",
    "Test-LocalArtifactComponentChain",
    "Test-SafeLocalJsonReadObservations",
    "Get-LocalArtifactPathState",
    "Read-SafeLocalJsonArtifact",
    "Test-ModeSnapshot",
    "Invoke-ExternalMode",
  ];
  const regions = new Map();
  for (const name of requiredFunctions) {
    const matches = powerShellFunctionRegions(source, executableSource, name);
    if (matches.length !== 1) {
      issues.push(`043c_validator:external_adapter_function_${name.replaceAll("-", "_")}_count_invalid`);
    } else {
      regions.set(name, matches[0]);
    }
  }
  if (regions.size !== requiredFunctions.length) return issues;

  const containsTokens = (functionName, tokens) => {
    const body = regions.get(functionName).executable;
    return tokens.every((token) =>
      new RegExp(`\\b${regexEscape(token)}\\b`, "i").test(body));
  };
  if (!containsTokens("Get-RepositoryArtifacts", [
    "Read-StrictUtf8File",
    "Get-MarkedTextBlock",
    "Convert-LedgerBlock",
    "Test-DurableLedger",
    "Get-Sha256Hex",
  ])) {
    issues.push("043c_validator:external_adapter_durable_protocol_reader_incomplete");
  }
  const repositoryLiterals = powerShellLiteralTexts(
    regions.get("Get-RepositoryArtifacts").source,
  );
  if (!repositoryLiterals.includes("043-controlled-fiduciary-pilot-readiness-v1.md")
    || !repositoryLiterals.includes("controlled-fiduciary-pilot-local-043.md")) {
    issues.push("043c_validator:external_adapter_repository_paths_incomplete");
  }

  const strictReader = regions.get("Read-StrictUtf8File").executable;
  if (!/\[\s*System\.IO\.File\s*\]::Exists\s*\(/i.test(strictReader)
    || !/\[\s*System\.IO\.File\s*\]::ReadAllBytes\s*\(/i.test(strictReader)
    || !/\bUTF8Encoding\b/i.test(strictReader)) {
    issues.push("043c_validator:external_adapter_strict_file_reader_incomplete");
  }

  const readProcess = regions.get("Invoke-ReadProcess");
  const readProcessLiterals = powerShellLiteralTexts(readProcess.source);
  const readProcessText = readProcessLiterals.join("\n");
  const readProcessParamBlock = firstPowerShellParamBlock(
    readProcess.source,
    readProcess.executable,
  );
  const readProcessValidateSets = readProcessParamBlock
    ? [...readProcessParamBlock.matchAll(/\[\s*ValidateSet\s*\(([\s\S]*?)\)\s*\]/gi)]
      .map((match) => quotedTokens(match[1]))
    : [];
  const readProcessParameterNames = readProcessParamBlock
    ? [...readProcessParamBlock.matchAll(/\$([A-Za-z_][A-Za-z0-9_]*)/g)]
      .map((match) => match[1])
      .filter((name) => !["true", "false", "null"].includes(name.toLowerCase()))
    : [];
  const exactReadProcessQuerySurface = readProcessValidateSets.length === 1
    && sameArray(readProcessValidateSets[0], READ_PROCESS_043C_QUERY_IDS)
    && sameArray(readProcessParameterNames, [
      "QueryId",
      "RepositoryRoot",
      "FrozenCommit",
      "Commit",
      "ParentCommit",
    ]);
  if (!exactReadProcessQuerySurface) {
    issues.push("043c_validator:external_adapter_exact_read_QueryId_ValidateSet_required");
  }

  const gitQueryArrayMatch = /\$gitQueryIds\s*=\s*@\(([\s\S]*?)\)/i.exec(
    readProcess.source,
  );
  const gitQueryArray = gitQueryArrayMatch ? quotedTokens(gitQueryArrayMatch[1]) : [];
  if (!sameArray(gitQueryArray, READ_PROCESS_043C_GIT_QUERY_IDS)
    || !/\$toolKind\s*=\s*if\s*\(\s*Test-ContainsOrdinal\b/i
      .test(readProcess.executable)
    || !containsTokens("Invoke-ReadProcess", [
      "Get-ReadToolPath",
      "Quote-ProcessArgument",
      "Test-ContainsOrdinal",
    ])) {
    issues.push("043c_validator:external_adapter_closed_read_query_routing_incomplete");
  }

  const argumentBranches = powerShellLiteralEqualityBranches(readProcess, "QueryId")
    .filter((branch) => /\$arguments\s*=/i.test(branch.executable));
  const branchFor = (queryId) =>
    argumentBranches.filter((branch) => branch.value === queryId);
  const exactQueryBranchSet = argumentBranches.length === READ_PROCESS_043C_QUERY_IDS.length
    && READ_PROCESS_043C_QUERY_IDS.every((queryId) => branchFor(queryId).length === 1);
  if (!exactQueryBranchSet) {
    issues.push("043c_validator:external_adapter_exact_QueryId_command_branches_required");
  }

  const quotedProcessValue = (name) =>
    new RegExp(`\\bQuote-ProcessArgument\\s+-Value\\s+\\$${name}\\b`, "i");
  const gitCommandRequirements = new Map([
    ["GitStatus", {
      literals: ["-C ", " status --porcelain=v1 -z --untracked-files=all"],
      patterns: [quotedProcessValue("RepositoryRoot")],
    }],
    ["GitIndexFlags", {
      literals: ["-C ", " ls-files -v -z --"],
      patterns: [quotedProcessValue("RepositoryRoot")],
    }],
    ["GitHeadCommit", {
      literals: ["-C ", " rev-parse --verify HEAD^{commit}"],
      patterns: [quotedProcessValue("RepositoryRoot")],
    }],
    ["GitFrozenIsAncestorOfHead", {
      literals: [
        "FROZEN_COMMIT_MISMATCH",
        "-C ",
        " merge-base --is-ancestor ",
        " HEAD",
      ],
      patterns: [
        quotedProcessValue("RepositoryRoot"),
        quotedProcessValue("FrozenCommit"),
        /\$FrozenCommit\s+-cnotmatch\s+\$script:Git40Pattern\b/i,
      ],
    }],
    ["GitFrozenToHeadLinearHistory", {
      literals: [
        "FROZEN_COMMIT_MISMATCH",
        "..HEAD",
        "-C ",
        " rev-list --reverse --topo-order --parents --ancestry-path ",
      ],
      patterns: [
        quotedProcessValue("RepositoryRoot"),
        quotedProcessValue("historyRange"),
        /\$FrozenCommit\s+-cnotmatch\s+\$script:Git40Pattern\b/i,
      ],
      sourcePatterns: [
        /\$historyRange\s*=\s*\$FrozenCommit\s*\+\s*["']\.\.HEAD["']/i,
      ],
    }],
    ["GitFrozenRunbookBlob", {
      literals: ["FROZEN_COMMIT_MISMATCH", ":", "-C ", " cat-file blob "],
      patterns: [
        quotedProcessValue("RepositoryRoot"),
        quotedProcessValue("blobReference"),
        /\$FrozenCommit\s+-cnotmatch\s+\$script:Git40Pattern\b/i,
      ],
      sourcePatterns: [
        /\$blobReference\s*=\s*\([\s\S]*?\$FrozenCommit[\s\S]*?\$script:GitRunbookPath/i,
      ],
    }],
    ["GitHeadRunbookBlob", {
      literals: ["HEAD:", "-C ", " cat-file blob "],
      patterns: [
        quotedProcessValue("RepositoryRoot"),
        quotedProcessValue("blobReference"),
      ],
      sourcePatterns: [
        /\$blobReference\s*=\s*["']HEAD:["']\s*\+\s*\$script:GitRunbookPath\b/i,
      ],
    }],
    ["GitFrozenSpecBlob", {
      literals: ["FROZEN_COMMIT_MISMATCH", ":", "-C ", " cat-file blob "],
      patterns: [
        quotedProcessValue("RepositoryRoot"),
        quotedProcessValue("blobReference"),
        /\$FrozenCommit\s+-cnotmatch\s+\$script:Git40Pattern\b/i,
      ],
      sourcePatterns: [
        /\$blobReference\s*=\s*\$FrozenCommit\s*\+\s*["']:["']\s*\+\s*\$script:GitSpecPath\b/i,
      ],
    }],
    ["GitCommitSpecBlob", {
      literals: ["FROZEN_HISTORY_INVALID", ":", "-C ", " cat-file blob "],
      patterns: [
        quotedProcessValue("RepositoryRoot"),
        quotedProcessValue("blobReference"),
        /\$Commit\s+-cnotmatch\s+\$script:Git40Pattern\b/i,
      ],
      sourcePatterns: [
        /\$blobReference\s*=\s*\$Commit\s*\+\s*["']:["']\s*\+\s*\$script:GitSpecPath\b/i,
      ],
    }],
    ["GitCommitRawDiff", {
      literals: [
        "FROZEN_HISTORY_INVALID",
        "-C ",
        " diff --no-ext-diff --no-renames --raw --abbrev=40 -z ",
        " ",
        " --",
      ],
      patterns: [
        quotedProcessValue("RepositoryRoot"),
        quotedProcessValue("ParentCommit"),
        quotedProcessValue("Commit"),
        /\$ParentCommit\s+-cnotmatch\s+\$script:Git40Pattern\b/i,
        /\$Commit\s+-cnotmatch\s+\$script:Git40Pattern\b/i,
        /\[\s*string\s*\]::Equals\s*\(\s*\$ParentCommit\s*,\s*\$Commit\b/i,
      ],
    }],
  ]);
  const fixedGitCommandsValid = exactQueryBranchSet
    && [...gitCommandRequirements].every(([queryId, requirement]) => {
      const branch = branchFor(queryId)[0];
      if (!branch) return false;
      const literals = powerShellLiteralTexts(branch.source);
      return (branch.executable.match(/\$arguments\s*=/gi) ?? []).length === 1
        && sameArray(literals, requirement.literals)
        && requirement.patterns.every((pattern) => pattern.test(branch.executable))
        && (requirement.sourcePatterns ?? [])
          .every((pattern) => pattern.test(branch.source));
    })
    && /^\$script:GitSpecPath\s*=\s*['"]specs\/active\/043-controlled-fiduciary-pilot-readiness-v1\.md['"]\s*$/m
      .test(source)
    && /^\$script:GitRunbookPath\s*=\s*['"]runbooks\/controlled-fiduciary-pilot-local-043\.md['"]\s*$/m
      .test(source);
  if (!fixedGitCommandsValid) {
    issues.push("043c_validator:external_adapter_fixed_frozen_git_commands_incomplete");
  }

  const indexFlagsParser = regions.get("Test-GitIndexFlagsOutput");
  const indexFlagsParserExact = containsTokens("Test-GitIndexFlagsOutput", [
    "IsNullOrEmpty",
    "Substring",
    "Split",
  ])
    && powerShellLiteralTexts(indexFlagsParser.source)
      .includes("GIT_INDEX_FLAGS_INVALID")
    && /\$Text\[\s*\$Text\.Length\s*-\s*1\s*\]\s*-ne\s*\$nul\b/i
      .test(indexFlagsParser.executable)
    && /\bforeach\s*\(\s*\$entry\s+in\s+\$entries\s*\)\s*\{/i
      .test(indexFlagsParser.executable)
    && /\$entry\[\s*0\s*\]\s*-cne\s*\[\s*char\s*\]\s*['"]H['"]/i
      .test(indexFlagsParser.source)
    && /\$entry\[\s*1\s*\]\s*-cne\s*\[\s*char\s*\]\s*['"] ['"]/i
      .test(indexFlagsParser.source)
    && /\$entry\.Substring\s*\(\s*2\s*\)\.Length\s*-eq\s*0\b/i
      .test(indexFlagsParser.executable)
    && !/\b(?:Invoke-ReadProcess|ProcessStartInfo|Get-ReadToolPath)\b/i
      .test(indexFlagsParser.executable);
  if (!indexFlagsParserExact) {
    issues.push("043c_validator:external_adapter_git_index_flags_parser_incomplete");
  }

  const gitEnvironmentBranches = powerShellLiteralEqualityBranches(readProcess, "toolKind")
    .filter((branch) =>
      branch.value === "Git" && /\bEnvironmentVariables\b/i.test(branch.executable));
  const gitEnvironmentSource = gitEnvironmentBranches[0]?.source ?? "";
  const gitEnvironmentClosed = gitEnvironmentBranches.length === 1
    && /\$startInfo\.EnvironmentVariables\[\s*['"]GIT_OPTIONAL_LOCKS['"]\s*\]\s*=\s*['"]0['"]/i
      .test(gitEnvironmentSource)
    && /\$startInfo\.EnvironmentVariables\[\s*['"]GIT_NO_REPLACE_OBJECTS['"]\s*\]\s*=\s*['"]1['"]/i
      .test(gitEnvironmentSource);
  if (!gitEnvironmentClosed) {
    issues.push("043c_validator:external_adapter_git_read_environment_not_fail_closed");
  }

  const frozenProtocolAndGit = regions.get("Test-FrozenProtocolAndGit");
  const frozenQueryCalls = powerShellLiteralArgumentCalls(
    frozenProtocolAndGit,
    "Invoke-ReadProcess",
    "QueryId",
  );
  const allFrozenGitQueriesWired = frozenQueryCalls.length
      === READ_PROCESS_043C_GIT_QUERY_IDS.length
    && READ_PROCESS_043C_GIT_QUERY_IDS.every((queryId) =>
      frozenQueryCalls.filter((value) => value === queryId).length === 1)
    && !frozenQueryCalls.includes("PsqlCatalog")
    && containsTokens("Test-FrozenProtocolAndGit", [
      "Invoke-ReadProcess",
      "Convert-GitHeadCommitOutput",
      "Test-GitIndexFlagsOutput",
      "Test-LinearFrozenHistory",
      "Get-Sha256Hex",
      "Get-Utf8Bytes",
      "Test-FrozenGitEvidence",
    ])
    && (frozenProtocolAndGit.executable.match(/\bTest-GitIndexFlagsOutput\b/gi) ?? [])
      .length === 1
    && (regions.get("Test-FrozenGitEvidence").executable
      .match(/\bTest-GitIndexFlagsOutput\b/gi) ?? []).length === 1;
  if (!allFrozenGitQueriesWired) {
    issues.push("043c_validator:external_adapter_frozen_git_QueryId_wiring_incomplete");
  }
  const indexFlagsDataflowExact =
    (frozenProtocolAndGit.executable.match(/\$indexFlags\s*=/gi) ?? []).length === 1
    && (frozenProtocolAndGit.executable.match(/\$indexFlagsValidation\s*=/gi) ?? [])
      .length === 1
    && /\$indexFlags\s*=\s*Invoke-ReadProcess\s+-QueryId\s+['"]GitIndexFlags['"][\s\S]{0,160}?-RepositoryRoot\s+\$RepositoryRoot\b/i
      .test(frozenProtocolAndGit.source)
    && /\$indexFlagsValidation\s*=\s*Test-GitIndexFlagsOutput\s+-Text\s+\(\s*\[\s*string\s*\]\s*\$indexFlags\.Value\s*\)/i
      .test(frozenProtocolAndGit.executable)
    && /\bif\s*\(\s*-not\s+\$indexFlagsValidation\.Valid\s*\)\s*\{\s*return\s+\$indexFlagsValidation\b/i
      .test(frozenProtocolAndGit.executable)
    && /\bIndexFlagsOutput\s*=\s*\[\s*string\s*\]\s*\$indexFlags\.Value\b/i
      .test(frozenProtocolAndGit.executable);
  if (!indexFlagsDataflowExact) {
    issues.push("043c_validator:external_adapter_git_index_flags_dataflow_incomplete");
  }

  const sqlLiterals = readProcessLiterals.filter((value) => /\bSELECT\b/i.test(value));
  const mutatingSql = /\b(?:CREATE|DROP|TRUNCATE|DELETE|INSERT|UPDATE|ALTER|GRANT|REVOKE|MERGE|CALL|COPY)\b/i;
  const catalogSql = sqlLiterals[0] ?? "";
  const catalogSqlValid = sqlLiterals.length === 1
    && !mutatingSql.test(catalogSql)
    && [
      "pg_database",
      "pg_roles",
      "pg_auth_members",
      "membership.member",
      "runner_role.oid",
      "pg_get_userbyid",
      "target_database.datdba",
      "rolcanlogin",
      "rolsuper",
      "rolcreatedb",
      "rolcreaterole",
      "rolreplication",
      "rolbypassrls",
      "explicit_membership_count",
      "ritomer_043c_r1",
      "ritomer_043c_r1_runner",
      "ritomer_043c_r2",
      "ritomer_043c_r2_runner",
      "current_database",
      "current_user",
      "session_user",
      "inet_server_addr",
      "inet_server_port",
    ].every((token) => catalogSql.includes(token))
    && /FROM\s+pg_auth_members\s+AS\s+membership[\s\S]*?WHERE\s+membership\.member\s*=\s*runner_role\.oid\b/i
      .test(catalogSql)
    && !/\bmembership\.roleid\b/i.test(catalogSql);
  const closedCatalogConnection = [
    "host=localhost hostaddr=127.0.0.1 port=5432 dbname=postgres ",
    "user=ritomer_043c_catalog_reader require_auth=sspi connect_timeout=5",
    "-X --no-password --dbname=",
    "--tuples-only --no-align --quiet --set=ON_ERROR_STOP=1 --file=-",
  ].every((literal) => readProcessLiterals.includes(literal))
    && !readProcessText.includes("--host=127.0.0.1")
    && !readProcessText.includes("--dbname=postgres")
    && !/\b(?:passfile|password|service)=/i.test(readProcessText);
  if (!catalogSqlValid
    || !closedCatalogConnection
    || !containsTokens("Invoke-ReadProcess", ["Get-ReadToolPath"])) {
    issues.push("043c_validator:external_adapter_closed_SSPI_catalog_process_incomplete");
  }
  if (!/\bProcessStartInfo\b/i.test(readProcess.executable)
    || !/\bDiagnostics\.Process\b/i.test(readProcess.executable)
    || !/UseShellExecute\s*=\s*\$false/i.test(readProcess.executable)
    || !/EnvironmentVariables\s*\.\s*Clear\s*\(/i.test(readProcess.executable)
    || !/RedirectStandardOutput\s*=\s*\$true/i.test(readProcess.executable)
    || !/RedirectStandardError\s*=\s*\$true/i.test(readProcess.executable)
    || !/WaitForExit\s*\(\s*10000\s*\)/i.test(readProcess.executable)) {
    issues.push("043c_validator:external_adapter_child_process_confinement_incomplete");
  }
  const processTypePattern = /\b(?:ProcessStartInfo|Diagnostics\.Process)\b/gi;
  for (const match of executableSource.matchAll(processTypePattern)) {
    if (match.index < readProcess.start || match.index >= readProcess.end) {
      issues.push("043c_validator:process_API_outside_closed_read_adapter");
      break;
    }
  }

  const headCommitParser = regions.get("Convert-GitHeadCommitOutput");
  const headCommitParserExact = /\$Text\.Length\s+-ne\s+41\b/i
    .test(headCommitParser.executable)
    && /\$Text\[\s*40\s*\]\s+-ne\s+\[\s*char\s*\]\s*10\b/i
      .test(headCommitParser.executable)
    && /\$Text\.Substring\s*\(\s*0\s*,\s*40\s*\)/i
      .test(headCommitParser.executable)
    && /\$commit\s+-cnotmatch\s+\$script:Git40Pattern\b/i
      .test(headCommitParser.executable);
  if (!headCommitParserExact) {
    issues.push("043c_validator:frozen_git_head_commit_parser_incomplete");
  }

  const linearHistory = regions.get("Test-LinearFrozenHistory");
  const linearHistoryLiterals = powerShellLiteralTexts(linearHistory.source);
  const linearHistoryExact = linearHistoryLiterals
    .includes("^([0-9a-f]{40}) ([0-9a-f]{40})$")
    && /\$FrozenCommit\s+-cnotmatch\s+\$script:Git40Pattern\b/i
      .test(linearHistory.executable)
    && /\$HeadCommit\s+-cnotmatch\s+\$script:Git40Pattern\b/i
      .test(linearHistory.executable)
    && /\$HistoryText\.Length\s+-eq\s+0\b/i.test(linearHistory.executable)
    && /\.EndsWith\s*\(\s*["']`n["']/i.test(linearHistory.source)
    && /\.Contains\s*\(\s*["']`r["']\s*\)/i.test(linearHistory.source)
    && /\$expectedParent\s*=\s*\$FrozenCommit\b/i.test(linearHistory.executable)
    && /\$parent\s*,\s*\$expectedParent\b/i.test(linearHistory.executable)
    && /\$commit\s*,\s*\$parent\b/i.test(linearHistory.executable)
    && /\$seenCommits\.ContainsKey\s*\(\s*\$commit\s*\)/i
      .test(linearHistory.executable)
    && /\$expectedParent\s*=\s*\$commit\b/i.test(linearHistory.executable)
    && /\$entries\.Count\s+-eq\s+0\b/i.test(linearHistory.executable)
    && /\$entries\[\s*\$entries\.Count\s*-\s*1\s*\]\.Commit[\s\S]*?\$HeadCommit\b/i
      .test(linearHistory.executable);
  if (!linearHistoryExact) {
    issues.push("043c_validator:frozen_git_linear_nonempty_single_parent_history_incomplete");
  }

  const exactRawDiff = regions.get("Test-ExactLedgerOnlyRawDiff");
  const exactRawDiffLiterals = powerShellLiteralTexts(exactRawDiff.source);
  const exactRawDiffStructural = exactRawDiffLiterals.includes(
    "\\A:100644 100644 ([0-9a-f]{40}) ([0-9a-f]{40}) M",
  )
    && exactRawDiffLiterals.includes("\\z")
    && /\$nul\s*=\s*\[\s*string\s*\]\s*\[\s*char\s*\]\s*0\b/i
      .test(exactRawDiff.executable)
    && /\[\s*regex\s*\]::Escape\s*\(\s*\$script:GitSpecPath\s*\)/i
      .test(exactRawDiff.executable)
    && /\$match\.Groups\[\s*1\s*\]\.Value\b/i.test(exactRawDiff.executable)
    && /\$match\.Groups\[\s*2\s*\]\.Value\b/i.test(exactRawDiff.executable)
    && /\$zeroObjectId\b/i.test(exactRawDiff.executable)
    && (exactRawDiff.executable.match(/\[\s*string\s*\]::Equals\s*\(/gi) ?? [])
      .length >= 3;
  if (!exactRawDiffStructural) {
    issues.push("043c_validator:frozen_git_exact_spec_1M_raw_diff_incomplete");
  }

  const singleLedgerAppend = regions.get("Test-SingleLedgerSpecAppend");
  const singleLedgerAppendExact = containsTokens("Test-SingleLedgerSpecAppend", [
    "Get-MarkedDocumentSections",
    "Convert-LedgerBlock",
    "Test-DurableLedger",
  ])
    && (singleLedgerAppend.executable.match(/\bGet-MarkedDocumentSections\b/gi) ?? [])
      .length === 2
    && (singleLedgerAppend.executable.match(/\bConvert-LedgerBlock\b/gi) ?? [])
      .length === 2
    && (singleLedgerAppend.executable.match(/\bTest-DurableLedger\b/gi) ?? [])
      .length === 2
    && /\$previous\.Value\.Prefix[\s\S]*?\$next\.Value\.Prefix\b/i
      .test(singleLedgerAppend.executable)
    && /\$previous\.Value\.Suffix[\s\S]*?\$next\.Value\.Suffix\b/i
      .test(singleLedgerAppend.executable)
    && /\$nextBlock\.StartsWith\s*\(\s*\$previousBlock\b/i
      .test(singleLedgerAppend.executable)
    && /\$addedRecord\s*=\s*\$nextBlock\.Substring\s*\(\s*\$previousBlock\.Length\s*\)/i
      .test(singleLedgerAppend.executable)
    && /\$addedRecordBody\.Contains\s*\(\s*["']`n["']\s*\)/i
      .test(singleLedgerAppend.source)
    && /\$addedRecordBody\.Contains\s*\(\s*["']`r["']\s*\)/i
      .test(singleLedgerAppend.source)
    && /@\(\s*\$nextRecords\.Value\s*\)\.Count\s+-ne\s+\(@\(\s*\$previousRecords\.Value\s*\)\.Count\s*\+\s*1\s*\)/i
      .test(singleLedgerAppend.executable)
    && (singleLedgerAppend.executable
      .match(/-ExpectedProtocolSha256\s+\$ExpectedProtocolSha256\b/gi) ?? [])
      .length === 2
    && (singleLedgerAppend.executable
      .match(/-ExpectedFrozenCommit\s+\$ExpectedFrozenCommit\b/gi) ?? [])
      .length === 2;
  if (!singleLedgerAppendExact) {
    issues.push("043c_validator:frozen_git_single_ledger_append_validation_incomplete");
  }

  const frozenEvidence = regions.get("Test-FrozenGitEvidence");
  const frozenEvidenceLoops = powerShellExecutableBlockRegions(
    frozenEvidence,
    /\bfor\s*\(\s*\$index\s*=\s*0\s*;[\s\S]*?\$index\s+-lt\s+\$entries\.Count[\s\S]*?\)\s*\{/i,
  );
  const frozenEvidenceLoop = frozenEvidenceLoops[0];
  const perCommitChecksInsideLoop = frozenEvidenceLoops.length === 1
    && /\bTest-ExactLedgerOnlyRawDiff\b/i.test(frozenEvidenceLoop.executable)
    && /\bTest-SingleLedgerSpecAppend\b/i.test(frozenEvidenceLoop.executable)
    && /\$step\.Commit[\s\S]*?\$entry\.Commit\b/i.test(frozenEvidenceLoop.executable)
    && /\$previousSpecText\s*=\s*\[\s*string\s*\]\s*\$step\.SpecText\b/i
      .test(frozenEvidenceLoop.executable);
  const frozenEvidenceExact = containsTokens("Test-FrozenGitEvidence", [
    "Convert-GitHeadCommitOutput",
    "Test-GitIndexFlagsOutput",
    "Test-LinearFrozenHistory",
    "Get-MarkedTextBlock",
    "Test-ExactLedgerOnlyRawDiff",
    "Test-SingleLedgerSpecAppend",
  ])
    && /\$Evidence\.WorktreeStatus\s+-isnot\s+\[\s*string\s*\]/i
      .test(frozenEvidence.executable)
    && /\(\s*\[\s*string\s*\]\s*\$Evidence\.WorktreeStatus\s*\)\.Length\s+-ne\s+0\b/i
      .test(frozenEvidence.executable)
    && (frozenEvidence.executable.match(/\$indexFlags\s*=/gi) ?? []).length === 1
    && /\$indexFlags\s*=\s*Test-GitIndexFlagsOutput\s+-Text\s+\(\s*\[\s*string\s*\]\s*\$Evidence\.IndexFlagsOutput\s*\)/i
      .test(frozenEvidence.executable)
    && /\bif\s*\(\s*-not\s+\$indexFlags\.Valid\s*\)\s*\{\s*return\s+\$indexFlags\b/i
      .test(frozenEvidence.executable)
    && /\$Evidence\.AncestorValid\s+-isnot\s+\[\s*bool\s*\]/i
      .test(frozenEvidence.executable)
    && /-not\s+\$Evidence\.AncestorValid\b/i.test(frozenEvidence.executable)
    && /\$frozenProtocol\.Value\s*,\s*\[\s*string\s*\]\s*\$headProtocol\.Value\b/i
      .test(frozenEvidence.executable)
    && /\$headProtocol\.Value\s*,\s*\[\s*string\s*\]\s*\$Evidence\.CurrentProtocolText\b/i
      .test(frozenEvidence.executable)
    && /\$steps\.Count\s+-ne\s+\$entries\.Count\b/i.test(frozenEvidence.executable)
    && /\$previousSpecText\s*=\s*\[\s*string\s*\]\s*\$Evidence\.FrozenSpecText\b/i
      .test(frozenEvidence.executable)
    && /\$previousSpecText\s*,\s*\[\s*string\s*\]\s*\$Evidence\.CurrentSpecText\b/i
      .test(frozenEvidence.executable)
    && perCommitChecksInsideLoop;
  if (!frozenEvidenceExact) {
    issues.push("043c_validator:frozen_git_evidence_validation_incomplete");
  }

  const historyLoops = powerShellExecutableBlockRegions(
    frozenProtocolAndGit,
    /\bforeach\s*\(\s*\$entry\s+in\s+@\(\s*\$historyValidation\.Value\s*\)\s*\)\s*\{/i,
  );
  const historyLoop = historyLoops[0];
  const historyLoopQueryCalls = historyLoop
    ? powerShellLiteralArgumentCalls(historyLoop, "Invoke-ReadProcess", "QueryId")
    : [];
  const perCommitQueriesInsideLoop = historyLoops.length === 1
    && sameArray(historyLoopQueryCalls, ["GitCommitRawDiff", "GitCommitSpecBlob"])
    && /\$steps\.Add\s*\(\s*\[\s*pscustomobject\s*\]@\{/i
      .test(historyLoop.executable)
    && ["Commit", "RawDiff", "SpecText"].every((property) =>
      new RegExp(`\\b${property}\\s*=`, "i").test(historyLoop.executable));
  const frozenEvidenceProperties = [
    "WorktreeStatus",
    "IndexFlagsOutput",
    "AncestorValid",
    "HeadCommitOutput",
    "HistoryOutput",
    "FrozenRunbookText",
    "HeadRunbookText",
    "CurrentProtocolText",
    "FrozenSpecText",
    "CurrentSpecText",
    "CommitSteps",
    "FrozenCommit",
    "ProtocolSha256",
  ];
  const frozenOrchestrationExact = /\(\s*\[\s*string\s*\]\s*\$status\.Value\s*\)\.Length\s+-ne\s+0\b/i
    .test(frozenProtocolAndGit.executable)
    && /-not\s+\$ancestor\.Valid\b/i.test(frozenProtocolAndGit.executable)
    && /\$historyValidation\s*=\s*Test-LinearFrozenHistory\b/i
      .test(frozenProtocolAndGit.executable)
    && /\$protocolSha256\s*=\s*Get-Sha256Hex\b/i
      .test(frozenProtocolAndGit.executable)
    && frozenEvidenceProperties.every((property) =>
      new RegExp(`\\b${property}\\s*=`, "i").test(frozenProtocolAndGit.executable))
    && /return\s+Test-FrozenGitEvidence\s+-Evidence\s+\$evidence\b/i
      .test(frozenProtocolAndGit.executable)
    && perCommitQueriesInsideLoop;
  if (!frozenOrchestrationExact) {
    issues.push("043c_validator:frozen_git_orchestration_incomplete");
  }

  const catalogParser = regions.get("Convert-CatalogProof");
  const catalogParserLiterals = powerShellLiteralTexts(catalogParser.source);
  const catalogParserExact = containsTokens("Convert-CatalogProof", [
    "Test-OrdinalSequence",
  ])
    && [
      "AUTH",
      "postgres",
      "ritomer_043c_catalog_reader",
      "127.0.0.1",
      "5432",
      "R1",
      "ritomer_043c_r1",
      "ritomer_043c_r1_runner",
      "R2",
      "ritomer_043c_r2",
      "ritomer_043c_r2_runner",
      "CATALOG_PROOF_INVALID",
      "CATALOG_TARGET_PRESENT_POLICY_SAFE",
      "ABSENT",
      "OTHER",
      "^(?:0|[1-9][0-9]*)$",
    ].every((literal) => catalogParserLiterals.includes(literal))
    && /\$lines\.Count\s+-ne\s+4\b/i.test(catalogParser.executable)
    && /\$lines\[\s*3\s*\]\s+-cne\s+['"]{2}/i.test(catalogParser.source)
    && /\$parts\.Count\s+-ne\s+13\b/i.test(catalogParser.executable)
    && /\$parts\[\s*3\s*\]\s+-ceq\s+\$expected\.RoleName\b/i
      .test(catalogParser.executable)
    && /\$parts\[\s*6\s*\]\s+-ceq\s+['"]1['"]/i.test(catalogParser.source)
    && [7, 8, 9, 10, 11, 12].every((index) =>
      new RegExp(`\\$parts\\[\\s*${index}\\s*\\]\\s+-ceq\\s+['"]0['"]`, "i")
        .test(catalogParser.source))
    && /\$parts\[\s*12\s*\]\s+-cnotmatch\b/i.test(catalogParser.executable)
    && !/\.Trim\s*\(/i.test(catalogParser.executable)
    && !/\b(?:Invoke-ReadProcess|Get-StorageResourceState|ProcessStartInfo|GetAttributes)\b/i
      .test(catalogParser.executable);
  if (!catalogParserExact) {
    issues.push("043c_validator:pure_catalog_result_parser_or_policy_incomplete");
  }

  const storageChain = regions.get("Test-StorageComponentChain");
  const storageChainLiterals = powerShellLiteralTexts(storageChain.source);
  const storageChainExact = [
    "LocalApplicationData",
    "Ritomer",
    "043c",
    "runtime",
    "storage",
    "ABSENT",
    "PRESENT_SAFE",
    "OTHER",
  ].every((literal) => storageChainLiterals.includes(literal))
    && /\$expectedNames\s*=\s*@\(\s*['"]LocalApplicationData['"]\s*,\s*['"]Ritomer['"]\s*,\s*['"]043c['"]\s*,\s*\$script:ProtocolId\s*,\s*['"]runtime['"]\s*,\s*\$Run\s*,\s*['"]storage['"]\s*\)/i
      .test(storageChain.source)
    && containsTokens("Test-StorageComponentChain", [
      "GetFullPath",
      "GetPathRoot",
      "Combine",
      "StartsWith",
      "OrdinalIgnoreCase",
      "CanonicalPath",
      "Exists",
      "IsDirectory",
      "IsReparsePoint",
    ])
    && /\$Components\.Count\s+-ne\s+\$expectedNames\.Count\b/i
      .test(storageChain.executable)
    && /\$missingSeen\s*=\s*\$true\b/i.test(storageChain.executable)
    && !/\b(?:Invoke-ReadProcess|GetAttributes|EnumerateFileSystemEntries|ProcessStartInfo)\b/i
      .test(storageChain.executable);
  if (!storageChainExact) {
    issues.push("043c_validator:pure_storage_component_chain_validation_incomplete");
  }

  const resourceStates = regions.get("Get-ResourceStates");
  const resourceLiterals = powerShellLiteralTexts(resourceStates.source);
  const resourceReaderExact = containsTokens("Get-ResourceStates", [
    "Invoke-ReadProcess",
    "Convert-CatalogProof",
    "Get-StorageResourceState",
  ])
    && resourceLiterals.includes("PsqlCatalog")
    && ["ABSENT", "CATALOG_TARGET_PRESENT_POLICY_SAFE", "PRESENT_EMPTY_SAFE",
      "CLUSTER_LEVEL_PRESENT", "OTHER"].every((literal) =>
      resourceLiterals.includes(literal))
    && /Convert-CatalogProof\s+-Output\s+\$catalog\.Value\b/i
      .test(resourceStates.executable)
    && (resourceStates.executable.match(/\bGet-StorageResourceState\b/gi) ?? [])
      .length === 2
    && !resourceLiterals.includes("READY");
  if (!resourceReaderExact) {
    issues.push("043c_validator:external_adapter_catalog_and_resource_wiring_incomplete");
  }

  const storageReaderRegion = regions.get("Get-StorageResourceState");
  const storageReader = storageReaderRegion.executable;
  const storageReaderLiterals = powerShellLiteralTexts(storageReaderRegion.source);
  const storageReaderExact = /\[\s*System\.IO\.File\s*\]::GetAttributes\s*\(/i
    .test(storageReader)
    && /\[\s*System\.IO\.Directory\s*\]::EnumerateFileSystemEntries\s*\(/i
      .test(storageReader)
    && /\bTest-StorageComponentChain\s+-ApprovedRootCanonical\s+\$rootFull\s+`?\s*-Run\s+\$Run\s+-Components\b/i
      .test(storageReader)
    && /\$componentNames\s*=\s*@\(\s*['"]LocalApplicationData['"]\s*,\s*['"]Ritomer['"]\s*,\s*['"]043c['"]\s*,\s*\$script:ProtocolId\s*,\s*['"]runtime['"]\s*,\s*\$Run\s*,\s*['"]storage['"]\s*\)/i
      .test(storageReaderRegion.source)
    && ["PRESENT_SAFE", "PRESENT_EMPTY_SAFE", "OTHER"].every((literal) =>
      storageReaderLiterals.includes(literal))
    && !storageReaderLiterals.includes("READY")
    && !/\[\s*System\.IO\.Directory\s*\]::Exists\s*\(/i.test(storageReader);
  if (!storageReaderExact) {
    issues.push("043c_validator:external_adapter_seven_component_storage_inspection_incomplete");
  }
  const localArtifactIds = [
    "AUTHORIZATION",
    "ACTIVE_STATE",
    "R1_EVIDENCE",
    "R2_EVIDENCE",
  ];
  const localArtifactRelativePaths = new Map([
    ["AUTHORIZATION", "authorization.json"],
    ["ACTIVE_STATE", "state\\active-state.json"],
    ["R1_EVIDENCE", "runs\\R1\\evidence-summary.json"],
    ["R2_EVIDENCE", "runs\\R2\\evidence-summary.json"],
  ]);
  const localArtifactIdsMatch =
    /\$script:LocalArtifactIds\s*=\s*@\(([\s\S]*?)\)/i.exec(source);
  const localArtifactMapMatch =
    /\$script:LocalArtifactRelativePaths\s*=\s*\[ordered\]@\{([\s\S]*?)\}/i
      .exec(source);
  const allPowerShellLiterals = powerShellLiteralTexts(source);
  const closedArtifactDefinitionsExact = localArtifactIdsMatch
    && sameArray(quotedTokens(localArtifactIdsMatch[1]), localArtifactIds)
    && localArtifactMapMatch
    && localArtifactIds.every((artifactId) => {
      const relativePath = localArtifactRelativePaths.get(artifactId);
      const assignment = new RegExp(
        `^\\s*${artifactId}\\s*=\\s*['"]${regexEscape(relativePath)}['"]\\s*$`,
        "mi",
      );
      return assignment.test(localArtifactMapMatch[1])
        && allPowerShellLiterals.filter((value) => value === relativePath).length === 1;
    });
  if (!closedArtifactDefinitionsExact) {
    issues.push("043c_validator:closed_local_artifact_ids_or_paths_invalid");
  }

  const exactParameterSurface = (functionName, expectedNames, validateSetValues) => {
    const region = regions.get(functionName);
    const paramBlock = firstPowerShellParamBlock(region.source, region.executable);
    if (!paramBlock) return false;
    const parameterNames = [...paramBlock.matchAll(/\$([A-Za-z_][A-Za-z0-9_]*)/g)]
      .map((match) => match[1])
      .filter((name) => !["true", "false", "null"].includes(name.toLowerCase()));
    const validateSets = [...paramBlock
      .matchAll(/\[\s*ValidateSet\s*\(([\s\S]*?)\)\s*\]/gi)]
      .map((match) => quotedTokens(match[1]));
    return sameArray(parameterNames, expectedNames)
      && validateSetValues.every((expectedSet) =>
        validateSets.some((actualSet) => sameArray(actualSet, expectedSet)));
  };

  const approvedLocalApplicationDataRoot =
    regions.get("Test-ApprovedLocalApplicationDataRoot");
  const approvedRootLiterals = powerShellLiteralTexts(
    approvedLocalApplicationDataRoot.source,
  );
  const approvedRootParameterSurface = exactParameterSurface(
    "Test-ApprovedLocalApplicationDataRoot",
    ["CandidateRoot", "DriveType"],
    [],
  );
  const approvedRootPolicyExact = approvedRootParameterSurface
    && ["\\\\?\\", "\\\\.\\", "\\??\\", "\\\\", "/",
      "^[A-Za-z][A-Za-z0-9+.-]+:", "^[A-Za-z]:\\\\",
      "^[A-Za-z]:\\\\$", "LOCALAPPDATA_ROOT_INVALID"].every((literal) =>
      approvedRootLiterals.includes(literal))
    && containsTokens("Test-ApprovedLocalApplicationDataRoot", [
      "IsNullOrWhiteSpace",
      "StartsWith",
      "Contains",
      "GetFullPath",
      "GetPathRoot",
      "TrimEnd",
      "Ordinal",
      "OrdinalIgnoreCase",
      "CanonicalRoot",
      "VolumeRoot",
    ])
    && /\$CandidateRoot\s+-isnot\s+\[\s*string\s*\]/i
      .test(approvedLocalApplicationDataRoot.executable)
    && /\$DriveType\s+-eq\s+\[\s*System\.IO\.DriveType\s*\]::Network\b/i
      .test(approvedLocalApplicationDataRoot.executable)
    && /\$DriveType\s+-ne\s+\[\s*System\.IO\.DriveType\s*\]::Fixed\b/i
      .test(approvedLocalApplicationDataRoot.executable)
    && /\$candidateCanonicalForm[\s\S]{0,220}?\$canonicalRoot[\s\S]{0,160}?OrdinalIgnoreCase/i
      .test(approvedLocalApplicationDataRoot.executable)
    && /\$canonicalRoot\.StartsWith\s*\(\s*\$volumeRoot[\s\S]{0,120}?OrdinalIgnoreCase/i
      .test(approvedLocalApplicationDataRoot.executable)
    && !/\b(?:DriveInfo|GetAttributes|ReadAllBytes|Get-Content|Invoke-ReadProcess|EnumerateFileSystemEntries)\b/i
      .test(approvedLocalApplicationDataRoot.executable);
  if (!approvedRootPolicyExact) {
    issues.push(
      "043c_validator:approved_local_application_data_root_policy_incomplete",
    );
  }

  const artifactDefinition = regions.get("Get-LocalArtifactDefinition");
  const artifactDefinitionExact = exactParameterSurface(
    "Get-LocalArtifactDefinition",
    ["ArtifactId"],
    [localArtifactIds],
  )
    && /\$script:LocalArtifactRelativePaths\[\s*\$ArtifactId\s*\]/i
      .test(artifactDefinition.executable)
    && /\$relativePath\s+-split\s+['"]\\\\['"]/i.test(artifactDefinition.source)
    && ["ArtifactId", "RelativePath", "RelativeComponents"].every((property) =>
      new RegExp(`\\b${property}\\s*=`, "i").test(artifactDefinition.executable));
  if (!artifactDefinitionExact) {
    issues.push("043c_validator:closed_local_artifact_definition_incomplete");
  }

  const localArtifactChain = regions.get("Test-LocalArtifactComponentChain");
  const localArtifactChainLiterals = powerShellLiteralTexts(localArtifactChain.source);
  const localArtifactChainParameterSurface = exactParameterSurface(
    "Test-LocalArtifactComponentChain",
    ["ApprovedRootCanonical", "ProtocolId", "ArtifactId", "ExpectedState", "Components"],
    [localArtifactIds, ["PRESENT", "ABSENT"]],
  );
  const localArtifactChainExact = localArtifactChainParameterSurface
    && /\$ProtocolId\s+-cne\s+\$script:ProtocolId\b/i
      .test(localArtifactChain.executable)
    && /\$expectedNames\s*=\s*@\(\s*['"]LocalApplicationData['"]\s*,\s*['"]Ritomer['"]\s*,\s*['"]043c['"]\s*,\s*\$ProtocolId\s*\)\s*\+\s*@\(\s*\$definition\.RelativeComponents\s*\)/i
      .test(localArtifactChain.source)
    && containsTokens("Test-LocalArtifactComponentChain", [
      "Get-LocalArtifactDefinition",
      "GetFullPath",
      "GetPathRoot",
      "Combine",
      "StartsWith",
      "OrdinalIgnoreCase",
      "CanonicalPath",
      "Exists",
      "Attributes",
      "IsDirectory",
      "IsReparsePoint",
      "Length",
      "LastWriteUtcTicks",
      "Get-LocalArtifactObservationToken",
    ])
    && /\$Components\.Count\s+-ne\s+\$expectedNames\.Count\b/i
      .test(localArtifactChain.executable)
    && /\$missingSeen\s*=\s*\$true\b/i.test(localArtifactChain.executable)
    && /\$index\s+-lt\s+\$finalIndex[\s\S]{0,240}?\$component\.IsReparsePoint\b/i
      .test(localArtifactChain.executable)
    && /elseif\s*\(\s*\$component\.IsDirectory\s+-or\s*\$component\.IsReparsePoint\b/i
      .test(localArtifactChain.executable)
    && /\$ExpectedState\s+-ceq\s+['"]PRESENT['"][\s\S]{0,180}?\$ExpectedState\s+-ceq\s+['"]ABSENT['"]/i
      .test(localArtifactChain.source)
    && ["PRESENT_SAFE", "ABSENT_SAFE"].every((literal) =>
      localArtifactChainLiterals.includes(literal))
    && !/\b(?:GetAttributes|ReadAllBytes|FileInfo|Get-Content|Invoke-ReadProcess)\b/i
      .test(localArtifactChain.executable);
  if (!localArtifactChainExact) {
    issues.push("043c_validator:pure_local_artifact_chain_validation_incomplete");
  }

  const observationToken = regions.get("Get-LocalArtifactObservationToken");
  const observationTokenExact = [
    "Name",
    "CanonicalPath",
    "Exists",
    "Attributes",
    "IsDirectory",
    "IsReparsePoint",
    "Length",
    "LastWriteUtcTicks",
  ].every((property) =>
    new RegExp(`\\$component\\.${property}\\b`, "i")
      .test(observationToken.executable))
    && !/\b(?:GetAttributes|ReadAllBytes|FileInfo|Get-Content)\b/i
      .test(observationToken.executable);
  if (!observationTokenExact) {
    issues.push("043c_validator:local_artifact_observation_token_incomplete");
  }

  const safeReadObservations = regions.get("Test-SafeLocalJsonReadObservations");
  const safeReadObservationExact = exactParameterSurface(
    "Test-SafeLocalJsonReadObservations",
    ["Before", "After", "Bytes", "ExpectedKeys"],
    [],
  )
    && /\$Before\.Value\.ObservationToken[\s\S]{0,160}?\$After\.Value\.ObservationToken/i
      .test(safeReadObservations.executable)
    && (safeReadObservations.executable.match(/\.Value\.FileLength\b/gi) ?? [])
      .length >= 2
    && /\bTest-StrictJsonBytes\b/i.test(safeReadObservations.executable)
    && /\bGet-Sha256Hex\b/i.test(safeReadObservations.executable)
    && !/\b(?:GetAttributes|ReadAllBytes|FileInfo|Get-Content)\b/i
      .test(safeReadObservations.executable);
  if (!safeReadObservationExact) {
    issues.push("043c_validator:pure_safe_local_JSON_observation_check_incomplete");
  }

  const localArtifactState = regions.get("Get-LocalArtifactPathState");
  const localArtifactStateParameterSurface = exactParameterSurface(
    "Get-LocalArtifactPathState",
    ["ApprovedRoot", "ProtocolId", "ArtifactId", "ExpectedState"],
    [localArtifactIds, ["PRESENT", "ABSENT"]],
  );
  const localArtifactStateExact = localArtifactStateParameterSurface
    && /\$ProtocolId\s+-cne\s+\$script:ProtocolId\b/i
      .test(localArtifactState.executable)
    && /\[\s*System\.IO\.File\s*\]::GetAttributes\s*\(/i
      .test(localArtifactState.executable)
    && /\[\s*System\.IO\.FileInfo\s*\]::new\s*\(/i
      .test(localArtifactState.executable)
    && /\bTest-LocalArtifactComponentChain\b/i
      .test(localArtifactState.executable)
    && ["Attributes", "IsDirectory", "IsReparsePoint", "Length",
      "LastWriteUtcTicks"].every((property) =>
      new RegExp(`\\b${property}\\s*=`, "i").test(localArtifactState.executable))
    && !/\[\s*System\.IO\.File\s*\]::(?:Exists|ReadAllBytes)\s*\(/i
      .test(localArtifactState.executable)
    && !/\bGet-Content\b/i.test(localArtifactState.executable);
  if (!localArtifactStateExact) {
    issues.push("043c_validator:external_local_artifact_chain_observer_incomplete");
  }

  const safeLocalJsonReader = regions.get("Read-SafeLocalJsonArtifact");
  const safeLocalJsonReaderParameterSurface = exactParameterSurface(
    "Read-SafeLocalJsonArtifact",
    ["ApprovedRoot", "ArtifactId", "ExpectedKeys"],
    [localArtifactIds],
  );
  const safeLocalJsonReaderExact = safeLocalJsonReaderParameterSurface
    && (safeLocalJsonReader.executable
      .match(/\bGet-LocalArtifactPathState\b/gi) ?? []).length === 2
    && (powerShellLiteralTexts(safeLocalJsonReader.source)
      .filter((value) => value === "PRESENT").length === 2)
    && /\[\s*System\.IO\.File\s*\]::ReadAllBytes\s*\(/i
      .test(safeLocalJsonReader.executable)
    && /\bTest-SafeLocalJsonReadObservations\b/i
      .test(safeLocalJsonReader.executable)
    && !/\[\s*System\.IO\.File\s*\]::Exists\s*\(/i
      .test(safeLocalJsonReader.executable)
    && !/\bGet-Content\b/i.test(safeLocalJsonReader.executable);
  if (!safeLocalJsonReaderParameterSurface) {
    issues.push("043c_validator:safe_local_JSON_reader_parameter_surface_invalid");
  }
  if (!safeLocalJsonReaderExact) {
    issues.push("043c_validator:safe_local_JSON_reader_pre_post_validation_incomplete");
  }

  const modeSnapshot = regions.get("Test-ModeSnapshot");
  const modeSnapshotLiterals = powerShellLiteralTexts(modeSnapshot.source);
  const externalModes = VALIDATOR_043C_MODES.filter((mode) => mode !== "SelfTest");
  const exactFiveModeBranches = /\bswitch\s*\(\s*\$SelectedMode\s*\)/i
    .test(modeSnapshot.executable)
    && externalModes.every((mode) =>
      modeSnapshotLiterals.filter((value) => value === mode).length === 1);
  if (!exactFiveModeBranches
    || !["S4", "S5", "S6", "S7", "S8", "S9"].every((state) =>
      new RegExp(`\\$script:States\\.${state}\\b`, "i").test(modeSnapshot.executable))
    || modeSnapshotLiterals.filter((value) => value === "EXACT_STATE_PROVEN").length !== 2
    || modeSnapshotLiterals.filter((value) => value === "CLUSTER_LEVEL_PRESENT").length !== 2
    || modeSnapshotLiterals.includes("READY")) {
    issues.push("043c_validator:external_adapter_five_mode_assertions_incomplete");
  }

  const postR2Branches = powerShellLiteralSwitchBranches(
    modeSnapshot,
    "PostR2Cleanup",
  );
  const postR2Branch = postR2Branches[0];
  const postR2CompleteR1PreconditionsExact = postR2Branches.length === 1
    && powerShellCorrelatedPatternCount(
      postR2Branch,
      /\$Snapshot\.CompletedRun\s+-ceq\s+(['"])R1\1/i,
      /^\$Snapshot\.CompletedRun\s+-ceq\b/i,
    ) === 1
    && powerShellCorrelatedPatternCount(
      postR2Branch,
      /\$Snapshot\.R1Outcome\s+-ceq\s+(['"])COMPLETED\1/i,
      /^\$Snapshot\.R1Outcome\s+-ceq\b/i,
    ) === 1
    && powerShellCorrelatedPatternCount(
      postR2Branch,
      /\$Snapshot\.R1Missing\s+-eq\s+0\b/i,
      /^\$Snapshot\.R1Missing\s+-eq\s+0\b/i,
    ) === 1
    && powerShellCorrelatedPatternCount(
      postR2Branch,
      /\$Snapshot\.R1Unexpected\s+-eq\s+0\b/i,
      /^\$Snapshot\.R1Unexpected\s+-eq\s+0\b/i,
    ) === 1;
  if (!postR2CompleteR1PreconditionsExact) {
    issues.push("043c_validator:post_r2_complete_r1_preconditions_incomplete");
  }

  const externalMode = regions.get("Invoke-ExternalMode");
  const externalModeLiterals = powerShellLiteralTexts(externalMode.source);
  if (!containsTokens("Invoke-ExternalMode", [
    "Test-ApprovedLocalApplicationDataRoot",
    "Get-RepositoryArtifacts",
    "Test-FrozenProtocolAndGit",
    "Get-ResourceStates",
    "Get-LocalArtifactPathState",
    "Read-SafeLocalJsonArtifact",
    "Test-ModeSnapshot",
  ])
    || !localArtifactIds.every((artifactId) =>
      new RegExp(
        `\\bRead-SafeLocalJsonArtifact\\b[\\s\\S]{0,180}?-ArtifactId\\s+['"]${artifactId}['"]`,
        "i",
      ).test(externalMode.source))
    || !/\bLocalApplicationData\b/i.test(externalMode.executable)
    || !/Get-ResourceStates\s+-LocalApplicationDataRoot\s+\$localBase\b/i
      .test(externalMode.executable)
    || !/ApplicationReadiness\s*=\s*['"]NOT_PROVEN['"]/i.test(externalMode.source)
    || externalModeLiterals.includes("EXACT_STATE_PROVEN")
    || !/Valid\s*=\s*\$modeCheck\.Valid/i.test(externalMode.executable)) {
    issues.push("043c_validator:external_adapter_orchestration_incomplete_or_stubbed");
  }

  const approvedRootCallIndex = externalMode.executable.search(
    /\$approvedLocalRoot\s*=\s*Test-ApprovedLocalApplicationDataRoot\b/i,
  );
  const driveInfoIndex = externalMode.executable.search(
    /\[\s*System\.IO\.DriveInfo\s*\]::new\s*\(/i,
  );
  const localRootSyntaxIndex = externalMode.executable.search(
    /\$localRootSyntaxInvalid\s*=/i,
  );
  const localReaderIndexes = [
    "Get-RepositoryArtifacts",
    "Test-FrozenProtocolAndGit",
    "Get-ResourceStates",
    "Get-LocalArtifactPathState",
    "Read-SafeLocalJsonArtifact",
  ].map((name) => externalMode.executable.search(
    new RegExp(`\\b${regexEscape(name)}\\b`, "i"),
  ));
  const preApprovedRootExecutable = approvedRootCallIndex >= 0
    ? externalMode.executable.slice(0, approvedRootCallIndex)
    : externalMode.executable;
  const noLocalReadOrInspectionBeforeApprovedRoot =
    !/\b(?:Get-RepositoryArtifacts|Test-FrozenProtocolAndGit|Get-ResourceStates|Convert-CatalogProof|Test-StorageComponentChain|Get-StorageResourceState|Get-LocalArtifactPathState|Read-SafeLocalJsonArtifact|Read-StrictUtf8File|Invoke-ReadProcess|Get-Content|Test-Path|Resolve-Path|Get-Item(?:Property)?|Get-ChildItem)\b/i
      .test(preApprovedRootExecutable)
    && !/\[\s*System\.IO\.(?!(?:Path|DriveInfo)\b)/i
      .test(preApprovedRootExecutable);
  const approvedLocalRootOrchestrationExact = approvedRootCallIndex >= 0
    && (externalMode.executable.match(
      /\bTest-ApprovedLocalApplicationDataRoot\b/gi,
    ) ?? []).length === 1
    && localRootSyntaxIndex >= 0
    && driveInfoIndex > localRootSyntaxIndex
    && approvedRootCallIndex > driveInfoIndex
    && localReaderIndexes.every((index) => index > approvedRootCallIndex)
    && noLocalReadOrInspectionBeforeApprovedRoot
    && /\$localBaseCandidate\s*=\s*\[\s*System\.Environment\s*\]::GetFolderPath\s*\(/i
      .test(externalMode.executable)
    && /\$deviceRootPrefixes\s*=\s*@\(\s*['"]\\\\\?\\['"]\s*,\s*['"]\\\\\.\\['"]\s*,\s*['"]\\\?\?\\['"]\s*\)/i
      .test(externalMode.source)
    && /\$localBaseCandidate\s+-cnotmatch\s+['"]\^\[A-Za-z\]:\\\\['"]/i
      .test(externalMode.source)
    && /\$localBaseCandidate\s+-cmatch\s+['"]\^\[A-Za-z\]\[A-Za-z0-9\+\.\-\]\+:['"]/i
      .test(externalMode.source)
    && /\bif\s*\(\s*\$localRootSyntaxInvalid\s*\)\s*\{\s*return\b/i
      .test(externalMode.executable)
    && /\$approvedLocalRoot\s*=\s*Test-ApprovedLocalApplicationDataRoot\s+`?\s*-CandidateRoot\s+\$localBaseCandidate\s+-DriveType\s+\$localDriveInfo\.DriveType\b/i
      .test(externalMode.source)
    && /\bif\s*\(\s*-not\s+\$approvedLocalRoot\.Valid\s*\)\s*\{\s*return\b/i
      .test(externalMode.executable)
    && (externalMode.executable.match(/\$localBase\s*=/gi) ?? []).length === 1
    && /\$localBase\s*=\s*\[\s*string\s*\]\s*\$approvedLocalRoot\.Value\.CanonicalRoot\b/i
      .test(externalMode.executable);
  if (!approvedLocalRootOrchestrationExact) {
    issues.push(
      "043c_validator:approved_local_application_data_root_policy_missing_or_late",
    );
  }

  const postR2SnapshotDataflowExact =
    /\$modeCheck\s*=\s*Test-ModeSnapshot\s+-SelectedMode\s+\$SelectedMode\s+`?\s*-Snapshot\s+\$snapshot\b/i
      .test(externalMode.source)
    && /\bCompletedRun\s*=\s*if\s*\(\s*\$null\s+-eq\s+\$current\.completedRun\s*\)/i
      .test(externalMode.executable)
    && /\$snapshot\.R1Outcome\s*=\s*\[\s*string\s*\]\s*\$r1EvidenceFile\.Value\.Record\.outcome\b/i
      .test(externalMode.executable)
    && /\$snapshot\.R1Missing\s*=\s*\[\s*int\s*\]\s*\$r1EvidenceFile\.Value\.Record\.missingExpectedBusinessEventCount\b/i
      .test(externalMode.executable)
    && /\$snapshot\.R1Unexpected\s*=\s*\[\s*int\s*\]\s*\$r1EvidenceFile\.Value\.Record\.unexpectedBusinessEventCount\b/i
      .test(externalMode.executable);
  if (!postR2SnapshotDataflowExact) {
    issues.push("043c_validator:post_r2_complete_r1_snapshot_dataflow_incomplete");
  }

  const preparationBranches = powerShellLiteralEqualityBranches(
    externalMode,
    "SelectedMode",
  ).filter((branch) => branch.value === "PreparationPreflight");
  const preparationBranch = preparationBranches[0];
  const preparationAbsenceFailClosed = preparationBranches.length === 1
    && /\bforeach\s*\(\s*\$artifactId\s+in\s+\$script:LocalArtifactIds\s*\)\s*\{/i
      .test(preparationBranch.executable)
    && /\bGet-LocalArtifactPathState\b[\s\S]{0,200}?-ArtifactId\s+\$artifactId\b[\s\S]{0,120}?-ExpectedState\s+['"]ABSENT['"]/i
      .test(preparationBranch.source)
    && /\bif\s*\(\s*-not\s+\$absence\.Valid\s*\)\s*\{/i
      .test(preparationBranch.executable);
  if (!preparationAbsenceFailClosed) {
    issues.push("043c_validator:preparation_local_artifact_absence_not_fail_closed");
  }
  if (/\[\s*System\.IO\.File\s*\]::(?:Exists|ReadAllBytes)\s*\(/i
    .test(externalMode.executable)
    || /\bGet-Content\b/i.test(externalMode.executable)) {
    issues.push("043c_validator:direct_local_artifact_IO_in_external_mode_forbidden");
  }
  if (!/\$externalResult\s*=\s*Invoke-ExternalMode\s+-SelectedMode\s+\$Mode/i
    .test(executableSource)) {
    issues.push("043c_validator:external_adapter_top_level_routing_missing");
  }
  return issues;
}

function validate043cPowerShellSource(bytes) {
  const issues = [];
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    issues.push("043c_validator:UTF8_BOM_forbidden");
  }
  const source = bytes.toString("utf8");
  if (!Buffer.from(source, "utf8").equals(bytes)) issues.push("043c_validator:invalid_UTF8");
  if (source.includes("\r")) issues.push("043c_validator:CR_or_CRLF_forbidden");
  if (!source.endsWith("\n")) issues.push("043c_validator:terminal_LF_required");

  const executableSource = maskPowerShellNonExecutableText(source);
  const scriptParamBlock = firstPowerShellParamBlock(source, executableSource);
  const scriptValidateSets = scriptParamBlock
    ? [...scriptParamBlock.matchAll(/\[\s*ValidateSet\s*\(([\s\S]*?)\)\s*\]/gi)]
      .map((match) => quotedTokens(match[1]))
    : [];
  const modeSet = scriptValidateSets.find((values) => values.includes("SelfTest"));
  if (scriptValidateSets.length !== 1
    || !modeSet
    || !sameArray([...modeSet].sort(), [...VALIDATOR_043C_MODES].sort())) {
    issues.push("043c_validator:exact_six_mode_ValidateSet_required");
  }

  const scriptParameterNames = scriptParamBlock
    ? [...scriptParamBlock.matchAll(/\$([A-Za-z_][A-Za-z0-9_]*)/g)]
      .map((match) => match[1])
      .filter((name) => !["true", "false", "null"].includes(name.toLowerCase()))
    : [];
  if (!scriptParamBlock
    || !sameArray([...new Set(scriptParameterNames)].sort(), ["Mode"])) {
    issues.push("043c_validator:Mode_must_be_the_only_script_parameter");
  }
  validate043cExternalAdapterStructure(source, executableSource).forEach((issue) =>
    issues.push(issue));
  const durableLedgerRegions = powerShellFunctionRegions(
    source,
    executableSource,
    "Test-DurableLedger",
  );
  const durableTerminalSourceExact = durableLedgerRegions.length === 1
    && /\bif\s*\(\s*\(\s*Test-ContainsOrdinal\s+-Values\s+@\(\s*\$script:States\.F1\s*,\s*\$script:States\.F2\s*,\s*\$script:States\.F3\s*\)\s+-Candidate\s+\$state\s*\)\s+-and[\s\S]{0,600}?\[\s*string\s*\]::Equals\s*\(\s*\[\s*string\s*\]\s*\$record\.previousState\s*,\s*\[\s*string\s*\]\s*\$previousRecord\.state\s*,\s*\[\s*System\.StringComparison\s*\]::Ordinal\s*\)/i
      .test(durableLedgerRegions[0].executable);
  if (!durableTerminalSourceExact) {
    issues.push("043c_validator:durable_terminal_previousState_source_equality_missing");
  }
  const forbiddenCommands = [
    "Remove-Item",
    "New-Item",
    "Set-Content",
    "Add-Content",
    "Move-Item",
    "Copy-Item",
    "Clear-Content",
    "Out-File",
    "Export-Csv",
    "Rename-Item",
    "Set-Item",
    "Set-Acl",
    "Set-ItemProperty",
    "New-ItemProperty",
    "Remove-ItemProperty",
    "Rename-ItemProperty",
    "Export-Clixml",
  ];
  for (const command of forbiddenCommands) {
    const executableCommandToken = new RegExp(
      `\\b${command.replace("-", "\\-")}\\b`,
      "i",
    );
    if (executableCommandToken.test(executableSource)) {
      issues.push(`043c_validator:write_command_${command.replace("-", "_")}_forbidden`);
    }
  }
  if (/\bgit(?:\.exe)?\s+(?:add|commit|checkout|switch|reset|restore|clean|merge|rebase|push|pull|fetch|tag|branch)\b/i
    .test(executableSource)) {
    issues.push("043c_validator:mutating_git_command_forbidden");
  }
  const mutatingSqlPattern = /(?:^|[;\r\n])\s*(?:CREATE|DROP|TRUNCATE|DELETE|INSERT|UPDATE|ALTER|GRANT|REVOKE|MERGE|CALL|COPY)\b/i;
  if (powerShellLiteralTexts(source).some((value) =>
    value !== " merge-base --is-ancestor " && mutatingSqlPattern.test(value))
    || /\bpsql(?:\.exe)?\b[^\r\n;|{}]*\b(?:CREATE|DROP|TRUNCATE|DELETE|INSERT|UPDATE|ALTER|GRANT|REVOKE|MERGE|CALL|COPY)\b/i
      .test(executableSource)
    || /\bExecuteNonQuery\s*\(/i.test(executableSource)) {
    issues.push("043c_validator:mutating_SQL_command_forbidden");
  }
  if (/\b(?:Invoke-WebRequest|Invoke-RestMethod|Start-BitsTransfer|Test-NetConnection|curl|wget)\b/i
    .test(executableSource)
    || /\b(?:HttpClient|WebClient|TcpClient|UdpClient|HttpWebRequest)\b/i.test(executableSource)) {
    issues.push("043c_validator:network_command_forbidden");
  }
  if (/\b(?:Invoke-Expression|Start-Process)\b/i.test(executableSource)) {
    issues.push("043c_validator:dynamic_or_child_process_execution_forbidden");
  }
  if (/\[(?:System\.)?IO\.(?:File|Directory)\]::(?:Write|WriteAll|Append|Create|CreateDirectory|Delete|Move|Copy|Replace|OpenWrite|SetAttributes|SetCreationTime|SetLastWriteTime)/i
    .test(executableSource)
    || /\b(?:StreamWriter|FileStream)\b/i.test(executableSource)
    || /\b(?:FileInfo|DirectoryInfo)\b[^\r\n]*\.\s*(?:Create|CreateText|Delete|MoveTo|CopyTo|OpenWrite)\s*\(/i
      .test(executableSource)
    || /\bTee-Object\b[^\r\n]*\bFilePath\b/i.test(executableSource)
    || /(?:^|[\s;|{}()])(?:\*|\d+)?>>?(?:&\d+)?(?=\s|[$.'"`A-Za-z_])/m
      .test(executableSource)) {
    issues.push("043c_validator:dotnet_or_redirection_write_API_forbidden");
  }

  const selfTestTopicCoverage = REQUIRED_043C_SELF_TEST_TOPICS.every((topic) =>
    source.includes(topic));
  if (!selfTestTopicCoverage) issues.push("043c_validator:mandatory_self_test_topics_incomplete");
  return { issues, source, selfTestTopicCoverage };
}

function safePowerShellEnvironment() {
  const environment = {};
  for (const key of ["SystemRoot", "WINDIR", "ComSpec", "PATHEXT", "PSModulePath"]) {
    if (typeof process.env[key] === "string") environment[key] = process.env[key];
  }
  return environment;
}

function run043cPowerShellSelfTest() {
  const systemRoot = process.env.SystemRoot ?? process.env.WINDIR;
  if (typeof systemRoot !== "string" || systemRoot.length === 0) {
    addError("043c_validator:selftest_windows_system_root_unavailable");
    return false;
  }
  const executable = resolve(
    systemRoot,
    "System32",
    "WindowsPowerShell",
    "v1.0",
    "powershell.exe",
  );
  const result = spawnSync(executable, [
    "-NoLogo",
    "-NoProfile",
    "-NonInteractive",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    absolutePath(CONTROLLED_043C_VALIDATOR_PATH),
    "-Mode",
    "SelfTest",
  ], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    env: safePowerShellEnvironment(),
    windowsHide: true,
    maxBuffer: 10 * 1024 * 1024,
  });

  if (result.error) {
    addError(`043c_validator:selftest_process_${result.error.name}`);
    return false;
  }
  const stdoutLines = (result.stdout ?? "").split(/\r?\n/).filter(Boolean);
  const stderrLines = (result.stderr ?? "").split(/\r?\n/).filter(Boolean);
  const combined = [...stdoutLines, ...stderrLines];
  const modeExact = stdoutLines.filter((line) => line === "mode=SelfTest").length === 1;
  const verdictPass = stdoutLines.filter((line) => line === "verdict=PASS").length === 1;
  const probeMatches = stdoutLines
    .map((line) => /^probe_([A-Z][A-Z0-9_]*)=PASS$/.exec(line))
    .filter((match) => match !== null);
  const probeTopicCounts = new Map();
  for (const match of probeMatches) {
    probeTopicCounts.set(match[1], (probeTopicCounts.get(match[1]) ?? 0) + 1);
  }
  const mandatoryProbeOutputsExact = REQUIRED_043C_SELF_TEST_TOPICS.every((topic) =>
    probeTopicCounts.get(topic) === 1);
  const probeOutputsUnique = [...probeTopicCounts.values()].every((count) => count === 1);
  const probeTopicSetExact = probeTopicCounts.size === REQUIRED_043C_SELF_TEST_TOPICS.length
    && [...probeTopicCounts.keys()].every((topic) =>
      REQUIRED_043C_SELF_TEST_TOPICS.includes(topic));
  const integerOutput = (key) => {
    const pattern = new RegExp(`^${key}=(\\d+)$`);
    const matches = stdoutLines.map((line) => pattern.exec(line)).filter((match) => match !== null);
    return matches.length === 1 ? Number(matches[0][1]) : undefined;
  };
  const selfTestProbeCount = integerOutput("selfTestProbeCount");
  const selfTestSucceededCount = integerOutput("selfTestSucceededCount");
  const selfTestFailedCount = integerOutput("selfTestFailedCount");
  const aggregateProbeCountsExact = selfTestProbeCount === REQUIRED_043C_SELF_TEST_TOPICS.length
    && selfTestSucceededCount === REQUIRED_043C_SELF_TEST_TOPICS.length
    && selfTestFailedCount === 0;
  const exactSummaryLines = [
    "expectedBusinessEventCount=15",
    "missingExpectedBusinessEventCount=0",
    "unexpectedBusinessEventCount=0",
    "externalAccessPerformed=false",
    "stateWritePerformed=false",
    "errorCodes=NONE",
  ];
  const exactSummaryValid = exactSummaryLines.every((expected) =>
    stdoutLines.filter((line) => line === expected).length === 1);
  const outputShapeValid = stdoutLines.every((line) =>
    line === "mode=SelfTest"
      || line === "verdict=PASS"
      || /^probe_[A-Z][A-Z0-9_]*=PASS$/.test(line)
      || /^selfTest(?:Probe|Succeeded|Failed)Count=\d+$/.test(line)
      || exactSummaryLines.includes(line));
  const explicitFailure = combined.some((line) =>
    /(?:^|[=_])FAIL(?:$|[=_])|errors?=[1-9]\d*|failed(?:Count)?=[1-9]\d*/i.test(line));
  const exitSuccess = result.status === 0 && result.signal === null;
  assert(exitSuccess, "043c_validator:selftest_nonzero_exit");
  assert(stderrLines.length === 0, "043c_validator:selftest_stderr_must_be_empty");
  assert(modeExact, "043c_validator:selftest_mode_output_missing");
  assert(verdictPass, "043c_validator:selftest_positive_verdict_missing");
  assert(
    mandatoryProbeOutputsExact,
    "043c_validator:selftest_mandatory_probe_output_missing_or_duplicated",
  );
  assert(probeOutputsUnique, "043c_validator:selftest_probe_output_duplicated");
  assert(probeTopicSetExact, "043c_validator:selftest_probe_topic_set_differs");
  assert(aggregateProbeCountsExact, "043c_validator:selftest_probe_counts_inconsistent");
  assert(exactSummaryValid, "043c_validator:selftest_summary_output_invalid");
  assert(outputShapeValid, "043c_validator:selftest_unexpected_output_line");
  assert(!explicitFailure, "043c_validator:selftest_failure_output_present");
  return exitSuccess
    && stderrLines.length === 0
    && modeExact
    && verdictPass
    && mandatoryProbeOutputsExact
    && probeOutputsUnique
    && probeTopicSetExact
    && aggregateProbeCountsExact
    && exactSummaryValid
    && outputShapeValid
    && !explicitFailure;
}

function validate043cContent({
  executeSelfTest,
  sourceCommit = undefined,
  requirePreparatoryLedger,
}) {
  const requiredPathsPresent = CURRENT_043C_PREPARATORY_FILE_SET.every((path) =>
    pathExists(path, sourceCommit));
  assert(requiredPathsPresent, "043c_preparation:all_four_artifacts_must_exist");
  if (!requiredPathsPresent) {
    return {
      contentValid: false,
      protocolHashValid: false,
      ledgerValid: false,
      validatorReadOnly: false,
      selfTestValid: false,
      statusBoundaryValid: false,
    };
  }

  const runbookBytes = readBytes(CONTROLLED_043C_RUNBOOK_PATH, sourceCommit);
  const protocol = validate043cProtocolBytes(runbookBytes);
  protocol.issues.forEach(addError);
  const specBytes = readBytes(CURRENT_SPEC_043_ACTIVE_PATH, sourceCommit);
  const ledger = requirePreparatoryLedger
    ? validate043cPreparatoryLedgerBytes(specBytes, protocol.protocolSha256)
    : validate043cDurableLedgerBytes(specBytes, protocol.protocolSha256);
  ledger.issues.forEach(addError);
  const validator = validate043cPowerShellSource(
    readBytes(CONTROLLED_043C_VALIDATOR_PATH, sourceCommit),
  );
  validator.issues.forEach(addError);

  const canonical043bStatus = "LOCAL_SYNTHETIC_SIMULATION_VALIDATED / MERGED / AI_REVIEWED / OWNER_RISK_ACCEPTED_FOR_LOCAL_SYNTHETIC_ONLY / NOT_HUMAN_SIGNED / NOT_PRODUCTION_READY / NOT_EXTERNAL_READY / NOT_SEPARATION_OF_DUTIES_PROOF";
  const spec = readTextAtCommit(CURRENT_SPEC_043_ACTIVE_PATH, sourceCommit);
  const runbook = readTextAtCommit(CONTROLLED_043C_RUNBOOK_PATH, sourceCommit);
  const statusBoundaryValid = spec.includes(canonical043bStatus)
    && runbook.includes(canonical043bStatus)
    && spec.includes(DURABLE_043C_STATES.S2)
    && spec.includes("043C_EXECUTION_AUTHORIZATION=NOT_GRANTED")
    && runbook.includes("043C_EXECUTION_AUTHORIZATION=NOT_GRANTED");
  assert(statusBoundaryValid, "043c_preparation:043b_or_043c_authorization_boundary_invalid");
  const confinementArtifacts = [
    "authorization.json",
    "state\\active-state.json",
    "runs\\R1\\evidence-summary.json",
    "runs\\R2\\evidence-summary.json",
  ];
  const confinementMarker =
    "LOCAL_ARTIFACT_PATH_CONFINEMENT=STORAGE_AND_FOUR_JSON_ARTIFACTS";
  const localArtifactDocumentationValid = [spec, runbook].every((document) =>
    document.includes(confinementMarker)
      && confinementArtifacts.every((artifact) => document.includes(artifact))
      && document.includes("storage")
      && document.includes("tous leurs parents")
      && document.includes("fichiers finaux")
      && document.includes("junction")
      && document.includes("symlink")
      && document.includes("reparse point")
      && document.includes("racine"));
  assert(
    localArtifactDocumentationValid,
    "043c_preparation:local_artifact_confinement_documentation_incomplete",
  );
  const localApplicationDataRootDocumentationValid = [spec, runbook].every(
    (document) =>
      document.includes(
        "LOCAL_APPLICATION_DATA_ROOT_POLICY=WINDOWS_FIXED_LOCAL_ONLY",
      )
      && document.includes("%LOCALAPPDATA%")
      && document.includes("DriveType=Fixed")
      && document.includes("UNC")
      && document.includes("mapped network drive")
      && document.includes("device path")
      && document.includes("network redirection fails closed")
      && document.includes("no automatic override"),
  );
  assert(
    localApplicationDataRootDocumentationValid,
    "043c_preparation:local_application_data_root_documentation_incomplete",
  );
  const ctoBlockingCorrectionsDocumentationValid = [spec, runbook].every(
    (document) =>
      document.includes("S4_FROZEN_COMMIT_BINDING=TRANSITION_BASE_EXACT")
      && document.includes("POST_R2_COMPLETE_R1_PRECONDITION=REQUIRED")
      && document.includes("ABORT_START_CONVENTION=NULL_ONLY_BEFORE_OR_AT_T00"),
  );
  assert(
    ctoBlockingCorrectionsDocumentationValid,
    "043c_preparation:cto_blocking_corrections_documentation_incomplete",
  );

  const visible = sourceCommit === undefined
    ? worktreeVisiblePaths()
    : commitTreePaths(sourceCommit);
  const committedLocalStateArtifacts = visible.filter((path) =>
    /(^|\/)(?:authorization|active-state|evidence-summary)\.json$/i.test(path));
  assert(
    committedLocalStateArtifacts.length === 0,
    "043c_preparation:local_authorization_state_or_evidence_artifact_in_Git",
  );

  let selfTestValid = !executeSelfTest;
  if (executeSelfTest) {
    if (validator.issues.length > 0) {
      addError("043c_validator:selftest_not_executed_source_read_only_validation_failed");
      selfTestValid = false;
    } else {
      selfTestValid = run043cPowerShellSelfTest();
    }
  }
  const protocolHashValid = protocol.issues.length === 0
    && typeof protocol.protocolSha256 === "string"
    && /^[0-9a-f]{64}$/.test(protocol.protocolSha256);
  const ledgerValid = ledger.issues.length === 0
    && ledger.records.length > 0
    && (!requirePreparatoryLedger
      || (ledger.records.length === 3
        && ledger.records.at(-1)?.state === DURABLE_043C_STATES.S2));
  const validatorReadOnly = validator.issues.length === 0;
  return {
    contentValid: protocolHashValid
      && ledgerValid
      && validatorReadOnly
      && selfTestValid
      && statusBoundaryValid
      && localArtifactDocumentationValid
      && localApplicationDataRootDocumentationValid
      && ctoBlockingCorrectionsDocumentationValid
      && committedLocalStateArtifacts.length === 0,
    protocolHashValid,
    ledgerValid,
    validatorReadOnly,
    selfTestValid,
    statusBoundaryValid,
    localArtifactDocumentationValid,
    localApplicationDataRootDocumentationValid,
    ctoBlockingCorrectionsDocumentationValid,
  };
}

function validate043cPreparationContent(options) {
  return validate043cContent({ ...options, requirePreparatoryLedger: true });
}

function validate043cGenericContent(options) {
  return validate043cContent({ ...options, requirePreparatoryLedger: false });
}

function validate043cPreparationSyntheticProbes() {
  const durableTransitionProbes = validate043cDurableTransitionSyntheticProbes();
  const exactNameStatus = CURRENT_043C_PREPARATORY_FILE_SET
    .map((path) => `${EXPECTED_043C_PREPARATORY_STATUS_BY_PATH.get(path)}\0${path}\0`)
    .join("");
  const exactChanges = parseHistoricalNameStatus(exactNameStatus);
  const exactAccepted = historicalChangeWhitelistViolations(
    exactChanges,
    EXPECTED_043C_PREPARATORY_STATUS_BY_PATH,
  ).length === 0;
  const fifthPathRejected = historicalChangeWhitelistViolations(
    [...exactChanges, { kind: "M", score: null, paths: ["docs/product/v1-plan.md"] }],
    EXPECTED_043C_PREPARATORY_STATUS_BY_PATH,
  ).length > 0;
  const deletionRejected = historicalChangeWhitelistViolations(
    [{ kind: "D", score: null, paths: [CURRENT_SPEC_043_ACTIVE_PATH] }],
    EXPECTED_043C_PREPARATORY_STATUS_BY_PATH,
  ).length > 0;
  const renameRejected = historicalChangeWhitelistViolations(
    [{
      kind: "R",
      score: 100,
      paths: [CURRENT_SPEC_043_ACTIVE_PATH, "outside/renamed-043c.md"],
    }],
    EXPECTED_043C_PREPARATORY_STATUS_BY_PATH,
  ).length > 0;
  const copyRejected = historicalChangeWhitelistViolations(
    [{
      kind: "C",
      score: 100,
      paths: [CONTROLLED_043C_RUNBOOK_PATH, "outside/copied-043c.md"],
    }],
    EXPECTED_043C_PREPARATORY_STATUS_BY_PATH,
  ).length > 0;
  const profileClassificationExact = classifyCurrentWorktreeProfile(
    CURRENT_043C_PREPARATORY_FILE_SET,
  ) === WORKTREE_PROFILES.PREPARATORY_043C;
  const profileClassificationRejectsFifth = classifyCurrentWorktreeProfile([
    ...CURRENT_043C_PREPARATORY_FILE_SET,
    "docs/product/v1-plan.md",
  ]) === WORKTREE_PROFILES.INVALID;
  const legacyProfilesPreserved = classifyCurrentWorktreeProfile([]) === WORKTREE_PROFILES.CLEAN
    && classifyCurrentWorktreeProfile(CURRENT_043A_ALLOWED_FILE_SET) === WORKTREE_PROFILES.PILOT_043A
    && classifyCurrentWorktreeProfile(CURRENT_043B_ALLOWED_FILE_SET) === WORKTREE_PROFILES.HARNESS_043B
    && classifyCurrentWorktreeProfile(HOTFIX_043B_ALLOWED_FILE_SET) === WORKTREE_PROFILES.HOTFIX_043B;
  const pr104BasePinned = HISTORICAL_043C_PREPARATION_BASE
    === "1ecddd81e255bc049558e5f90bf65db394558d67";
  const failureOutputSuppressesPositiveBuffer = bufferedSuccessLines(
    ["probe=PASS", "governance_kit_result=PASS_STRUCTURAL_ONLY"],
    ["synthetic_failure"],
  ).length === 0;
  const failureDetailSuppressesPositiveToken = !failureOnlyLine(
    "synthetic_failure_with_PASS_token",
  ).includes("PASS");
  const writeAssignmentRejected = validate043cPowerShellSource(
    Buffer.from("$created = New-Item -Path $target\n", "utf8"),
  ).issues.includes("043c_validator:write_command_New_Item_forbidden");
  const outputRedirectionRejected = validate043cPowerShellSource(
    Buffer.from("Write-Output value > $target\n", "utf8"),
  ).issues.includes("043c_validator:dotnet_or_redirection_write_API_forbidden");
  const mutatingSqlRejected = validate043cPowerShellSource(
    Buffer.from("$query = \"DELETE FROM audit_event\"\n", "utf8"),
  ).issues.includes("043c_validator:mutating_SQL_command_forbidden");
  const childProcessRejected = validate043cPowerShellSource(
    Buffer.from("Start-Process -FilePath tool.exe\n", "utf8"),
  ).issues.includes("043c_validator:dynamic_or_child_process_execution_forbidden");
  let indexFlagsDataflowMutationRejected = true;
  let directLocalReadMutationRejected = true;
  let missingPostReadValidationMutationRejected = true;
  let missingFinalFileControlMutationRejected = true;
  let missingArtifactIdMutationRejected = true;
  let freePathParameterMutationRejected = true;
  let missingApprovedRootPolicyCallMutationRejected = true;
  let localReadBeforeApprovedRootMutationRejected = true;
  let postR2CompletedRunRemovedMutationRejected = true;
  let postR2R1OutcomeRemovedMutationRejected = true;
  let postR2R1MissingRemovedMutationRejected = true;
  let postR2R1UnexpectedRemovedMutationRejected = true;
  let postR2CompletedRunWrongValueSpoofMutationRejected = true;
  let postR2R1OutcomeWrongValueSpoofMutationRejected = true;
  if (contentCommit === undefined) {
    const validatorSource = readFileSync(
      absolutePath(CONTROLLED_043C_VALIDATOR_PATH),
      "utf8",
    );
    const disconnectedIndexFlagsSource = validatorSource
      .replace(
        "Test-GitIndexFlagsOutput -Text ([string] $indexFlags.Value)",
        "Test-GitIndexFlagsOutput -Text ('H synthetic.txt' + ([string] [char] 0))",
      )
      .replace(
        "IndexFlagsOutput = [string] $indexFlags.Value",
        "IndexFlagsOutput = ('H synthetic.txt' + ([string] [char] 0))",
      );
    const mutationApplied = disconnectedIndexFlagsSource !== validatorSource
      && !disconnectedIndexFlagsSource.includes(
        "Test-GitIndexFlagsOutput -Text ([string] $indexFlags.Value)",
      )
      && !disconnectedIndexFlagsSource.includes(
        "IndexFlagsOutput = [string] $indexFlags.Value",
      );
    indexFlagsDataflowMutationRejected = mutationApplied
      && validate043cPowerShellSource(
        Buffer.from(disconnectedIndexFlagsSource, "utf8"),
      ).issues.includes(
        "043c_validator:external_adapter_git_index_flags_dataflow_incomplete",
      );

    const directLocalReadSource = validatorSource.replace(
      "Read-SafeLocalJsonArtifact -ApprovedRoot $localBase `\n"
        + "      -ArtifactId 'AUTHORIZATION' `",
      "[System.IO.File]::ReadAllBytes($localBase)",
    );
    directLocalReadMutationRejected = directLocalReadSource !== validatorSource
      && validate043cPowerShellSource(
        Buffer.from(directLocalReadSource, "utf8"),
      ).issues.includes(
        "043c_validator:direct_local_artifact_IO_in_external_mode_forbidden",
      );

    const missingPostReadValidationSource = validatorSource.replace(
      "$after = Get-LocalArtifactPathState -ApprovedRoot $ApprovedRoot `",
      "$after = $before # post-read validation removed",
    );
    missingPostReadValidationMutationRejected =
      missingPostReadValidationSource !== validatorSource
      && validate043cPowerShellSource(
        Buffer.from(missingPostReadValidationSource, "utf8"),
      ).issues.includes(
        "043c_validator:safe_local_JSON_reader_pre_post_validation_incomplete",
      );

    const missingFinalFileControlSource = validatorSource.replace(
      "} elseif ($component.IsDirectory -or\n"
        + "            $component.IsReparsePoint -or",
      "} elseif ($component.IsDirectory -or\n"
        + "            $false -or",
    );
    missingFinalFileControlMutationRejected =
      missingFinalFileControlSource !== validatorSource
      && validate043cPowerShellSource(
        Buffer.from(missingFinalFileControlSource, "utf8"),
      ).issues.includes(
        "043c_validator:pure_local_artifact_chain_validation_incomplete",
      );

    const missingArtifactIdSource = validatorSource.replace(
      "$script:LocalArtifactIds = @(\n"
        + "  'AUTHORIZATION',\n"
        + "  'ACTIVE_STATE',\n"
        + "  'R1_EVIDENCE',\n"
        + "  'R2_EVIDENCE'\n"
        + ")",
      "$script:LocalArtifactIds = @(\n"
        + "  'AUTHORIZATION',\n"
        + "  'ACTIVE_STATE',\n"
        + "  'R1_EVIDENCE'\n"
        + ")",
    );
    missingArtifactIdMutationRejected = missingArtifactIdSource !== validatorSource
      && validate043cPowerShellSource(
        Buffer.from(missingArtifactIdSource, "utf8"),
      ).issues.includes(
        "043c_validator:closed_local_artifact_ids_or_paths_invalid",
      );

    const freePathParameterSource = validatorSource.replace(
      "function Read-SafeLocalJsonArtifact {\n"
        + "  param(\n"
        + "    [string] $ApprovedRoot,",
      "function Read-SafeLocalJsonArtifact {\n"
        + "  param(\n"
        + "    [string] $Path,\n"
        + "    [string] $ApprovedRoot,",
    );
    freePathParameterMutationRejected = freePathParameterSource !== validatorSource
      && validate043cPowerShellSource(
        Buffer.from(freePathParameterSource, "utf8"),
      ).issues.includes(
        "043c_validator:safe_local_JSON_reader_parameter_surface_invalid",
      );

    const missingApprovedRootPolicyCallSource = validatorSource.replace(
      "Test-ApprovedLocalApplicationDataRoot `\n"
        + "    -CandidateRoot $localBaseCandidate -DriveType $localDriveInfo.DriveType",
      "New-CheckResult -Valid $true",
    );
    missingApprovedRootPolicyCallMutationRejected =
      missingApprovedRootPolicyCallSource !== validatorSource
      && validate043cPowerShellSource(
        Buffer.from(missingApprovedRootPolicyCallSource, "utf8"),
      ).issues.includes(
          "043c_validator:approved_local_application_data_root_policy_missing_or_late",
      );

    const localReadBeforeApprovedRootSource = validatorSource.replace(
      "$approvedLocalRoot = Test-ApprovedLocalApplicationDataRoot `",
      "[void] [System.IO.File]::GetAttributes($localBaseCandidate)\n"
        + "  $approvedLocalRoot = Test-ApprovedLocalApplicationDataRoot `",
    );
    localReadBeforeApprovedRootMutationRejected =
      localReadBeforeApprovedRootSource !== validatorSource
      && validate043cPowerShellSource(
        Buffer.from(localReadBeforeApprovedRootSource, "utf8"),
      ).issues.includes(
        "043c_validator:approved_local_application_data_root_policy_missing_or_late",
      );

    const postR2MutantRejected = (target) => {
      const mutatedSource = mutatePowerShellSwitchBranch(
        validatorSource,
        "Test-ModeSnapshot",
        "PostR2Cleanup",
        target,
        "$true -and",
      );
      return mutatedSource !== validatorSource
        && validate043cPowerShellSource(
          Buffer.from(mutatedSource, "utf8"),
        ).issues.includes(
          "043c_validator:post_r2_complete_r1_preconditions_incomplete",
        );
    };
    postR2CompletedRunRemovedMutationRejected = postR2MutantRejected(
      "($Snapshot.CompletedRun -ceq 'R1') -and",
    );
    postR2R1OutcomeRemovedMutationRejected = postR2MutantRejected(
      "($Snapshot.R1Outcome -ceq 'COMPLETED') -and",
    );
    postR2R1MissingRemovedMutationRejected = postR2MutantRejected(
      "($Snapshot.R1Missing -eq 0) -and",
    );
    postR2R1UnexpectedRemovedMutationRejected = postR2MutantRejected(
      "($Snapshot.R1Unexpected -eq 0) -and",
    );
    const postR2SpoofMutantRejected = (target, replacement) => {
      const mutatedSource = mutatePowerShellSwitchBranch(
        validatorSource,
        "Test-ModeSnapshot",
        "PostR2Cleanup",
        target,
        replacement,
      );
      return mutatedSource !== validatorSource
        && validate043cPowerShellSource(
          Buffer.from(mutatedSource, "utf8"),
        ).issues.includes(
          "043c_validator:post_r2_complete_r1_preconditions_incomplete",
        );
    };
    postR2CompletedRunWrongValueSpoofMutationRejected =
      postR2SpoofMutantRejected(
        "($Snapshot.CompletedRun -ceq 'R1') -and",
        "($Snapshot.CompletedRun -ceq 'R2') -and\n"
          + "        # $Snapshot.CompletedRun -ceq 'R1'",
      );
    postR2R1OutcomeWrongValueSpoofMutationRejected =
      postR2SpoofMutantRejected(
        "($Snapshot.R1Outcome -ceq 'COMPLETED') -and",
        "($Snapshot.R1Outcome -ceq 'ABORTED') -and\n"
          + "        # $Snapshot.R1Outcome -ceq 'COMPLETED'",
      );
  }
  const externalStubSource = [
    "function Read-StrictUtf8File {}",
    "function Get-RepositoryArtifacts {}",
    "function Get-ReadToolPath {}",
    "function Invoke-ReadProcess {}",
    "function Convert-GitHeadCommitOutput {}",
    "function Test-GitIndexFlagsOutput {}",
    "function Test-LinearFrozenHistory {}",
    "function Test-ExactLedgerOnlyRawDiff {}",
    "function Test-SingleLedgerSpecAppend {}",
    "function Test-FrozenGitEvidence {}",
    "function Test-FrozenProtocolAndGit {}",
    "function Convert-CatalogProof {}",
    "function Test-ApprovedLocalApplicationDataRoot {}",
    "function Test-StorageComponentChain {}",
    "function Get-StorageResourceState {}",
    "function Get-ResourceStates {}",
    "function Get-LocalArtifactDefinition {}",
    "function Get-LocalArtifactObservationToken {}",
    "function Test-LocalArtifactComponentChain {}",
    "function Test-SafeLocalJsonReadObservations {}",
    "function Get-LocalArtifactPathState {}",
    "function Read-SafeLocalJsonArtifact {}",
    "function Test-ModeSnapshot {}",
    "function Invoke-ExternalMode {",
    "  return [pscustomobject]@{ Valid = $false; CleanupDisposition = 'NONE' }",
    "}",
    "",
  ].join("\n");
  const externalStubExecutable = maskPowerShellNonExecutableText(externalStubSource);
  const unconditionalExternalStubRejected = validate043cExternalAdapterStructure(
    externalStubSource,
    externalStubExecutable,
  ).includes("043c_validator:external_adapter_orchestration_incomplete_or_stubbed");
  const passed = exactAccepted
    && fifthPathRejected
    && deletionRejected
    && renameRejected
    && copyRejected
    && profileClassificationExact
    && profileClassificationRejectsFifth
    && legacyProfilesPreserved
    && pr104BasePinned
    && failureOutputSuppressesPositiveBuffer
    && failureDetailSuppressesPositiveToken
    && writeAssignmentRejected
    && outputRedirectionRejected
    && mutatingSqlRejected
    && childProcessRejected
    && indexFlagsDataflowMutationRejected
    && directLocalReadMutationRejected
    && missingPostReadValidationMutationRejected
    && missingFinalFileControlMutationRejected
    && missingArtifactIdMutationRejected
    && freePathParameterMutationRejected
    && missingApprovedRootPolicyCallMutationRejected
    && localReadBeforeApprovedRootMutationRejected
    && postR2CompletedRunRemovedMutationRejected
    && postR2R1OutcomeRemovedMutationRejected
    && postR2R1MissingRemovedMutationRejected
    && postR2R1UnexpectedRemovedMutationRejected
    && postR2CompletedRunWrongValueSpoofMutationRejected
    && postR2R1OutcomeWrongValueSpoofMutationRejected
    && unconditionalExternalStubRejected
    && durableTransitionProbes.transitionSyntheticProbes;
  assert(passed, "043c_preparation:in_memory_profile_or_change_type_probes_failed");
  return passed;
}

function validate043cPreparationAddedLineHygiene(range = undefined) {
  const addedLines = range?.mode === "HISTORICAL_043C_PREPARATION"
    ? parseAddedLinesFromUnifiedDiff(gitOutput([
      "diff",
      "--no-ext-diff",
      "--unified=0",
      "--no-color",
      "--find-renames",
      "--find-copies",
      `${range.base}..${range.head}`,
      "--",
      ...CURRENT_043C_PREPARATORY_FILE_SET,
    ]))
    : addedLinesForCurrentPaths(CURRENT_043C_PREPARATORY_FILE_SET);
  const highConfidenceSecretPatterns = [
    new RegExp("sk" + "-(?:proj|svcacct)-[A-Za-z0-9_-]{12,}", "i"),
    new RegExp("xox" + "[aboprs]-[A-Za-z0-9-]{12,}", "i"),
    new RegExp("(?:gh" + "[pousr]_|github" + "_pat_)[A-Za-z0-9_]{20,}", "i"),
    new RegExp("AK" + "IA[0-9A-Z]{16}"),
    new RegExp("BEGIN" + " (?:RSA |EC )?PRIVATE" + " KEY", "i"),
    /\beyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/,
  ];
  const emailPattern = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
  const swissIbanPattern = /\bCH\d{2}(?:\s?[A-Z0-9]){17}\b/gi;
  const privateLocationPatterns = [
    new RegExp("[A-Za-z]:" + "\\\\(?:Users|Documents and Settings)\\\\", "i"),
    /(?:^|[\s"'])\/(?:home|Users)\/[^\s"']+/i,
    new RegExp("(?:^|[\\s\"'])" + "\\\\\\\\" + "[A-Za-z0-9._$-]+\\\\[A-Za-z0-9._$-]+(?:\\\\|[\\s\"']|$)", "i"),
    new RegExp("file" + ":\\/\\/", "i"),
  ];
  const runtimeActivationPatterns = [
    /\b(?:api\.openai\.com|api\.anthropic\.com|generativelanguage\.googleapis\.com)\b/i,
    /^\s*import\s+(?:org\.springframework\.ai|com\.openai|com\.anthropic)\./i,
    /\b(?:McpServer|MCPServer|StdioServerTransport|SseServerTransport|StreamableHTTPServerTransport)\s*\(/,
  ];
  let secretFindings = 0;
  let personalOrPrivateFindings = 0;
  let runtimeActivationFindings = 0;
  for (const added of addedLines) {
    if (highConfidenceSecretPatterns.some((pattern) => pattern.test(added.text))) {
      secretFindings += 1;
      addError(`${added.path}:${added.line}:043c_high_confidence_secret_value`);
    }
    for (const email of added.text.match(emailPattern) ?? []) {
      const lower = email.toLowerCase();
      if (!lower.endsWith(".invalid") && !lower.endsWith(".example") && !lower.endsWith(".test")) {
        personalOrPrivateFindings += 1;
        addError(`${added.path}:${added.line}:043c_personal_email_value`);
      }
    }
    if ((added.text.match(swissIbanPattern) ?? []).length > 0) {
      personalOrPrivateFindings += 1;
      addError(`${added.path}:${added.line}:043c_swiss_iban_value`);
    }
    const normalizedEscapes = added.text.replaceAll("\\/", "/").replaceAll("\\\\", "\\");
    if ([added.text, normalizedEscapes].some((text) =>
      privateLocationPatterns.some((pattern) => pattern.test(text)))) {
      personalOrPrivateFindings += 1;
      addError(`${added.path}:${added.line}:043c_private_path_value`);
    }
    if ([GOVERNANCE_CHECKER_PATH, CONTROLLED_043C_VALIDATOR_PATH].includes(added.path)
      && runtimeActivationPatterns.some((pattern) => pattern.test(added.text))) {
      runtimeActivationFindings += 1;
      addError(`${added.path}:${added.line}:043c_ai_provider_or_mcp_runtime_activation`);
    }
  }
  return {
    noHighConfidenceSecret: secretFindings === 0,
    noPersonalOrPrivateData: personalOrPrivateFindings === 0,
    noAiProviderOrMcpRuntime: runtimeActivationFindings === 0,
  };
}

function validate043cPreparationHistoricalRange(actual, changes, range) {
  const exactFileSet = sameArray(actual, CURRENT_043C_PREPARATORY_FILE_SET);
  assert(exactFileSet, "base-to-head file set differs from the exact 4-path 043c-preparation whitelist");
  const whitelistViolations = historicalChangeWhitelistViolations(
    changes,
    EXPECTED_043C_PREPARATORY_STATUS_BY_PATH,
  );
  whitelistViolations.forEach(addError);
  const statusCounts = { A: 0, M: 0, D: 0, R: 0, C: 0 };
  for (const change of changes) statusCounts[change.kind] += 1;
  const expectedStatusMapVerified = exactFileSet
    && whitelistViolations.length === 0
    && statusCounts.M === 3
    && statusCounts.A === 1
    && statusCounts.D === 0
    && statusCounts.R === 0
    && statusCounts.C === 0;
  assert(
    expectedStatusMapVerified,
    "base-to-head statuses differ from the exact 3M/1A 043c-preparation matrix",
  );
  const allowedPathsPresent = CURRENT_043C_PREPARATORY_FILE_SET.every((path) =>
    pathExists(path, range.head));
  assert(allowedPathsPresent, "043c-preparation head must contain all four authorized artifacts");
  const environmentFilesAbsent = commitTreePaths(range.head)
    .filter((path) => /(^|\/)\.env(?:\.|$)/i.test(path))
    .filter((path) => path !== "backend/.env.example")
    .length === 0;
  assert(environmentFilesAbsent, "043c-preparation head contains a tracked .env file");
  const content = validate043cPreparationContent({
    executeSelfTest: false,
    sourceCommit: range.head,
  });
  const syntheticProbes = validate043cPreparationSyntheticProbes();
  const hygiene = validate043cPreparationAddedLineHygiene(range);
  return {
    historicalProfile: "043c-preparation",
    exactFileSet,
    expectedStatusMapVerified,
    allowedPathsPresent,
    environmentFilesAbsent,
    syntheticProbes,
    ...content,
    ...hygiene,
  };
}

function validate043cPreparationWorktree(actual) {
  const exactFileSet = sameArray(actual, CURRENT_043C_PREPARATORY_FILE_SET);
  assert(exactFileSet, "worktree file set must be exactly the closed 4-path 043c-preparation whitelist");
  const headPinned = gitOutput(["rev-parse", "HEAD"]).trim() === HISTORICAL_043C_PREPARATION_BASE;
  assert(headPinned, "043c-preparation worktree HEAD must equal the exact PR #104 baseline");
  const allowedPathsPresent = CURRENT_043C_PREPARATORY_FILE_SET.every((path) =>
    existsSync(absolutePath(path)));
  assert(allowedPathsPresent, "043c-preparation worktree must contain all four authorized artifacts");
  const stagedEmpty = stagedPaths().length === 0;
  assert(stagedEmpty, "043c-preparation worktree validation requires an empty staged index");
  const records = currentWorktreeStatusRecords();
  const statusPaths = [...new Set(records.flatMap((record) => record.paths))].sort();
  const modifiedCount = records.filter((record) => record.status === " M").length;
  const untrackedCount = records.filter((record) => record.status === "??").length;
  const statusMatrixExact = records.length === 4
    && sameArray(statusPaths, CURRENT_043C_PREPARATORY_FILE_SET)
    && modifiedCount === 3
    && untrackedCount === 1
    && records.every((record) => record.paths.length === 1
      && record.status === (CURRENT_043C_PREPARATORY_ADDED_PATHS.has(record.paths[0])
        ? "??"
        : " M"));
  assert(statusMatrixExact, "043c-preparation worktree status matrix must be exactly 3M/1 untracked A");
  const environmentFilesAbsent = environmentFilePaths().length === 0;
  assert(environmentFilesAbsent, "043c-preparation worktree contains a tracked or ignored .env file");
  const content = validate043cPreparationContent({
    executeSelfTest: true,
  });
  const syntheticProbes = validate043cPreparationSyntheticProbes();
  const hygiene = validate043cPreparationAddedLineHygiene();
  return {
    worktreeProfile: WORKTREE_PROFILES.PREPARATORY_043C,
    exactFileSet,
    headPinned,
    allowedPathsPresent,
    stagedEmpty,
    statusMatrixExact,
    environmentFilesAbsent,
    syntheticProbes,
    ...content,
    ...hygiene,
  };
}

function validate043cDurableTransitionHistoricalRange(actual, changes, range) {
  const exactFileSet = sameArray(actual, CURRENT_043C_DURABLE_TRANSITION_FILE_SET);
  assert(
    exactFileSet,
    "base-to-head file set must be exactly the spec-only 043c durable transition",
  );
  const whitelistViolations = historicalChangeWhitelistViolations(
    changes,
    EXPECTED_043C_DURABLE_TRANSITION_STATUS_BY_PATH,
  );
  whitelistViolations.forEach(addError);
  const statusCounts = { A: 0, M: 0, D: 0, R: 0, C: 0 };
  for (const change of changes) statusCounts[change.kind] += 1;
  const expectedStatusMapVerified = exactFileSet
    && whitelistViolations.length === 0
    && statusCounts.M === 1
    && statusCounts.A === 0
    && statusCounts.D === 0
    && statusCounts.R === 0
    && statusCounts.C === 0;
  assert(
    expectedStatusMapVerified,
    "base-to-head status must be exactly 1M on the spec 043 ledger carrier",
  );

  const parentTokens = gitOutput(["rev-list", "--parents", "-n", "1", range.head])
    .trim()
    .split(/\s+/);
  const directSingleParentCommit = parentTokens.length === 2
    && parentTokens[0] === range.head
    && parentTokens[1] === range.base;
  assert(
    directSingleParentCommit,
    "043c durable transition head must be a direct single-parent child of base",
  );

  const requiredPathsPresent = [
    CURRENT_SPEC_043_ACTIVE_PATH,
    CONTROLLED_043C_RUNBOOK_PATH,
    CONTROLLED_043C_VALIDATOR_PATH,
    GOVERNANCE_CHECKER_PATH,
  ].every((path) => pathExists(path, range.head));
  assert(requiredPathsPresent, "043c durable transition head is missing a required artifact");

  const baseProtocol = validate043cProtocolBytes(
    readBytes(CONTROLLED_043C_RUNBOOK_PATH, range.base),
  );
  const headProtocol = validate043cProtocolBytes(
    readBytes(CONTROLLED_043C_RUNBOOK_PATH, range.head),
  );
  baseProtocol.issues.forEach((issue) => addError(`043c_transition:base:${issue}`));
  headProtocol.issues.forEach((issue) => addError(`043c_transition:head:${issue}`));
  const protocolStable = baseProtocol.issues.length === 0
    && headProtocol.issues.length === 0
    && baseProtocol.protocolSha256 === headProtocol.protocolSha256;
  assert(protocolStable, "043c durable transition protocol hash must remain stable");

  const transition = validate043cSingleAppendTransition(
    readBytes(CURRENT_SPEC_043_ACTIVE_PATH, range.base),
    readBytes(CURRENT_SPEC_043_ACTIVE_PATH, range.head),
    headProtocol.protocolSha256,
    range.base,
  );
  transition.issues.forEach(addError);
  const appendOnlyTransitionValid = transition.issues.length === 0;

  const visible = commitTreePaths(range.head);
  const localOnlyArtifactsAbsent = visible.filter((path) =>
    /(^|\/)(?:authorization|active-state|evidence-summary)\.json$/i.test(path))
    .length === 0;
  assert(localOnlyArtifactsAbsent, "043c durable transition head contains a local-only artifact");
  const futureSpecsAbsent = visible.filter((path) => {
    const match = /^specs\/(?:active|backlog|done)\/(\d+)(?:[-_.]|$)/i.exec(path);
    return match !== null && Number(match[1]) >= 44;
  }).length === 0;
  assert(futureSpecsAbsent, "043c durable transition head contains a spec numbered 044+");

  const content = validate043cGenericContent({
    executeSelfTest: false,
    sourceCommit: range.head,
  });
  const probes = validate043cDurableTransitionSyntheticProbes();
  return {
    historicalProfile: "043c-transition",
    exactFileSet,
    expectedStatusMapVerified,
    directSingleParentCommit,
    requiredPathsPresent,
    protocolStable,
    appendOnlyTransitionValid,
    localOnlyArtifactsAbsent,
    futureSpecsAbsent,
    ...content,
    ...probes,
  };
}

function validate043cDurableTransitionWorktree(actual) {
  const exactFileSet = sameArray(actual, CURRENT_043C_DURABLE_TRANSITION_FILE_SET);
  assert(
    exactFileSet,
    "worktree file set must be exactly the spec-only 043c durable transition",
  );
  const head = gitOutput(["rev-parse", "HEAD"]).trim();
  const requiredPathsPresent = [
    CURRENT_SPEC_043_ACTIVE_PATH,
    CONTROLLED_043C_RUNBOOK_PATH,
    CONTROLLED_043C_VALIDATOR_PATH,
    GOVERNANCE_CHECKER_PATH,
  ].every((path) => existsSync(absolutePath(path)));
  assert(requiredPathsPresent, "043c durable transition worktree is missing a required artifact");
  const stagedEmpty = stagedPaths().length === 0;
  assert(stagedEmpty, "043c durable transition worktree requires an empty staged index");

  const records = currentWorktreeStatusRecords();
  const statusMatrixExact = records.length === 1
    && records[0].status === " M"
    && sameArray(records[0].paths, CURRENT_043C_DURABLE_TRANSITION_FILE_SET);
  assert(
    statusMatrixExact,
    "043c durable transition worktree status matrix must be exactly 1M/0 untracked",
  );

  const baseProtocol = validate043cProtocolBytes(
    readBytes(CONTROLLED_043C_RUNBOOK_PATH, head),
  );
  const currentProtocol = validate043cProtocolBytes(
    readBytes(CONTROLLED_043C_RUNBOOK_PATH),
  );
  baseProtocol.issues.forEach((issue) => addError(`043c_transition:base:${issue}`));
  currentProtocol.issues.forEach((issue) => addError(`043c_transition:head:${issue}`));
  const protocolStable = baseProtocol.issues.length === 0
    && currentProtocol.issues.length === 0
    && baseProtocol.protocolSha256 === currentProtocol.protocolSha256;
  assert(protocolStable, "043c durable transition worktree protocol hash must remain stable");

  const transition = validate043cSingleAppendTransition(
    readBytes(CURRENT_SPEC_043_ACTIVE_PATH, head),
    readBytes(CURRENT_SPEC_043_ACTIVE_PATH),
    currentProtocol.protocolSha256,
    head,
  );
  transition.issues.forEach(addError);
  const appendOnlyTransitionValid = transition.issues.length === 0;

  const visible = worktreeVisiblePaths();
  const localOnlyArtifactsAbsent = visible.filter((path) =>
    /(^|\/)(?:authorization|active-state|evidence-summary)\.json$/i.test(path))
    .length === 0;
  assert(
    localOnlyArtifactsAbsent,
    "043c durable transition worktree contains a local-only artifact",
  );
  const futureSpecsAbsent = visible.filter((path) => {
    const match = /^specs\/(?:active|backlog|done)\/(\d+)(?:[-_.]|$)/i.exec(path);
    return match !== null && Number(match[1]) >= 44;
  }).length === 0;
  assert(futureSpecsAbsent, "043c durable transition worktree contains a spec numbered 044+");

  const content = validate043cGenericContent({ executeSelfTest: true });
  const probes = validate043cDurableTransitionSyntheticProbes();
  return {
    worktreeProfile: WORKTREE_PROFILES.DURABLE_TRANSITION_043C,
    exactFileSet,
    requiredPathsPresent,
    stagedEmpty,
    statusMatrixExact,
    protocolStable,
    appendOnlyTransitionValid,
    localOnlyArtifactsAbsent,
    futureSpecsAbsent,
    ...content,
    ...probes,
  };
}

function validateExactFileSet(range) {
  let historicalVerification;
  let worktreeVerification;
  let worktreeProfile;
  const changes = range.mode === "HISTORICAL"
    || range.mode === "HISTORICAL_043B"
    || range.mode === "HISTORICAL_043B_HOTFIX"
    || range.mode === "HISTORICAL_043C_PREPARATION"
    || range.mode === "HISTORICAL_043C_TRANSITION"
    ? historicalChanges(range.base, range.head)
    : undefined;
  const actual = changes ? historicalChangedPaths(changes) : changedPaths();

  if (range.mode === "HISTORICAL_043B_HOTFIX") {
    historicalVerification = validate043bHotfixHistoricalRange(actual, changes, range);
  } else if (range.mode === "HISTORICAL_043B") {
    historicalVerification = validate043bHistoricalRange(actual, changes, range);
  } else if (range.mode === "HISTORICAL_043C_PREPARATION") {
    historicalVerification = validate043cPreparationHistoricalRange(actual, changes, range);
  } else if (range.mode === "HISTORICAL_043C_TRANSITION") {
    historicalVerification = validate043cDurableTransitionHistoricalRange(
      actual,
      changes,
      range,
    );
  } else if (range.mode === "HISTORICAL") {
    const exact = sameArray(actual, EXACT_ALLOWED_FILE_SET);
    assert(exact, `base-to-head file set differs from the exact 19-path PR #99 whitelist`);
    console.log(`diff_file_set_verified=${exact ? "YES_19_OF_19" : `NO_${actual.length}_OF_19`}`);

    const whitelistViolations = historicalChangeWhitelistViolations(changes);
    whitelistViolations.forEach(addError);
    const statusCounts = { A: 0, M: 0, D: 0, R: 0, C: 0 };
    for (const change of changes) statusCounts[change.kind] += 1;
    const expectedStatusMapVerified = exact
      && whitelistViolations.length === 0
      && statusCounts.M === EXISTING_ALLOWED.length
      && statusCounts.A === NEW_ALLOWED.length
      && statusCounts.D === 0
      && statusCounts.R === 0
      && statusCounts.C === 0;
    assert(expectedStatusMapVerified, `base-to-head statuses differ from the exact 6M/13A PR #99 matrix`);

    const visibilityEvidence = historicalChangeTypeVisibilityEvidence();
    assert(visibilityEvidence.changeTypesVerified, `historical change-type probes failed`);
    assert(visibilityEvidence.deletionsVisible, `historical deletion path projection is incomplete`);
    assert(visibilityEvidence.renameEndpointsVisible, `historical rename endpoint projection is incomplete`);
    assert(visibilityEvidence.copyEndpointsVisible, `historical copy endpoint projection is incomplete`);
    historicalVerification = {
      changeTypesVerified: expectedStatusMapVerified && visibilityEvidence.changeTypesVerified,
      deletionsVisible: visibilityEvidence.deletionsVisible,
      renameEndpointsVisible: visibilityEvidence.renameEndpointsVisible,
      copyEndpointsVisible: visibilityEvidence.copyEndpointsVisible,
      expectedStatusMapVerified,
    };
  } else {
    worktreeProfile = classifyCurrentWorktreeProfile(actual);
    if (worktreeProfile === WORKTREE_PROFILES.HARNESS_043B) {
      worktreeVerification = validate043bWorktree(actual);
    } else if (worktreeProfile === WORKTREE_PROFILES.HOTFIX_043B) {
      worktreeVerification = validate043bHotfixWorktree(actual);
    } else if (worktreeProfile === WORKTREE_PROFILES.PREPARATORY_043C) {
      worktreeVerification = validate043cPreparationWorktree(actual);
    } else if (worktreeProfile === WORKTREE_PROFILES.DURABLE_TRANSITION_043C) {
      worktreeVerification = validate043cDurableTransitionWorktree(actual);
    } else {
      const exactCurrentFileSet = worktreeProfile === WORKTREE_PROFILES.CLEAN
        || worktreeProfile === WORKTREE_PROFILES.PILOT_043A;
      assert(exactCurrentFileSet, `worktree file set must be clean, exactly 043a, exactly 043b, exactly the 26-path 043b-hotfix whitelist, exactly 043c-preparation, or exactly one 043c durable ledger transition`);
      console.log(`diff_file_set_verified=${actual.length === 0 ? "CLEAN_COMMITTED_STATE" : exactCurrentFileSet ? "YES_14_OF_14" : `NO_${actual.length}_OF_14`}`);
      console.log(`current_043a_exact_file_set=${exactCurrentFileSet ? "YES" : "NO"}`);
      worktreeVerification = { worktreeProfile };
    }
  }

  for (const path of NEW_ALLOWED) {
    assert(pathExists(path), `${path}: required new artifact missing`);
  }
  if (range.mode === "HISTORICAL" || (range.mode === "WORKTREE"
    && worktreeProfile !== WORKTREE_PROFILES.HARNESS_043B
    && worktreeProfile !== WORKTREE_PROFILES.HOTFIX_043B)) {
    const forbiddenSurface = actual.filter((path) =>
      /(^|\/)(backend|frontend)(\/|$)|(^|\/)contracts\/|(^|\/)(package\.json|pnpm-lock\.yaml|package-lock\.json|yarn\.lock|build\.gradle(?:\.kts)?|settings\.gradle(?:\.kts)?)$/i.test(path),
    );
    assert(forbiddenSurface.length === 0, `forbidden runtime, contract, manifest or lockfile surface changed`);
    console.log(`manifest_lockfile_drift=${forbiddenSurface.length === 0 ? "NO" : "YES"}`);
    console.log(`no_runtime_change=${forbiddenSurface.length === 0 ? "YES" : "NO"}`);
  }
  return historicalVerification ?? worktreeVerification;
}

function is043bForbiddenSurface(path) {
  return path === "frontend/vite.config.ts"
    || path.startsWith("frontend/src/")
    || /(^|\/)pnpm-lock\.yaml$/i.test(path)
    || /(^|\/)SecurityConfig[^/]*$/i.test(path)
    || /(^|\/)application[^/]*\.ya?ml$/i.test(path)
    || /(^|\/)db\/migration\//i.test(path)
    || path.startsWith("contracts/")
    || path.startsWith(".github/workflows/")
    || path.startsWith("fixtures/pilot/043/");
}

function validate043bPackageJson() {
  let headPackage;
  let currentPackage;
  try {
    headPackage = JSON.parse(gitOutput(["show", "HEAD:frontend/package.json"]));
  } catch (error) {
    addError(`frontend/package.json:HEAD_JSON_${error.name}`);
    return false;
  }
  try {
    currentPackage = JSON.parse(readText("frontend/package.json"));
  } catch (error) {
    addError(`frontend/package.json:WORKTREE_JSON_${error.name}`);
    return false;
  }

  const headWithoutScripts = { ...headPackage };
  const currentWithoutScripts = { ...currentPackage };
  delete headWithoutScripts.scripts;
  delete currentWithoutScripts.scripts;
  const nonScriptsUnchanged = isDeepStrictEqual(currentWithoutScripts, headWithoutScripts);
  assert(nonScriptsUnchanged, `frontend/package.json: every property outside scripts must remain structurally identical to HEAD`);

  let dependencyGroupsUnchanged = true;
  for (const property of [
    "dependencies",
    "devDependencies",
    "peerDependencies",
    "optionalDependencies",
    "packageManager",
  ]) {
    const unchanged = isDeepStrictEqual(currentPackage[property], headPackage[property]);
    dependencyGroupsUnchanged = dependencyGroupsUnchanged && unchanged;
    assert(unchanged, `frontend/package.json:${property} must remain structurally identical to HEAD`);
  }

  const headScripts = headPackage.scripts;
  const currentScripts = currentPackage.scripts;
  const scriptsAreObjects = headScripts !== null
    && currentScripts !== null
    && typeof headScripts === "object"
    && typeof currentScripts === "object"
    && !Array.isArray(headScripts)
    && !Array.isArray(currentScripts);
  assert(scriptsAreObjects, `frontend/package.json:scripts must remain JSON objects`);
  if (!scriptsAreObjects) return false;

  const headScriptNames = Object.keys(headScripts).sort();
  const currentScriptNames = Object.keys(currentScripts).sort();
  const addedScripts = currentScriptNames.filter((name) => !Object.hasOwn(headScripts, name));
  const removedScripts = headScriptNames.filter((name) => !Object.hasOwn(currentScripts, name));
  const modifiedScripts = headScriptNames.filter((name) =>
    Object.hasOwn(currentScripts, name) && currentScripts[name] !== headScripts[name]);
  const exactAddedScript = sameArray(addedScripts, ["dev:two-actor-local"])
    && currentScripts["dev:two-actor-local"] === "node ./local-two-actor-harness.mjs";
  const existingScriptsUnchanged = removedScripts.length === 0 && modifiedScripts.length === 0;
  assert(exactAddedScript, `frontend/package.json: dev:two-actor-local must be the sole added script with its exact command`);
  assert(existingScriptsUnchanged, `frontend/package.json: no existing script may be removed or modified`);

  const lockfileUnchanged = gitCommandSucceeds(["diff", "--quiet", "HEAD", "--", "frontend/pnpm-lock.yaml"]);
  assert(lockfileUnchanged, `frontend/pnpm-lock.yaml: lockfile drift is forbidden`);
  return nonScriptsUnchanged
    && dependencyGroupsUnchanged
    && exactAddedScript
    && existingScriptsUnchanged
    && lockfileUnchanged;
}

function validateFrozen043aHashes() {
  let unchanged = true;
  for (const [path, expectedHash] of FROZEN_043A_HASHES) {
    const present = pathExists(path);
    assert(present, `${path}: frozen 043a artifact missing`);
    if (!present) {
      unchanged = false;
      continue;
    }
    const actualHash = sha256Bytes(readBytes(path));
    unchanged = unchanged && actualHash === expectedHash;
    assert(actualHash === expectedHash, `${path}: frozen 043a exact-byte SHA-256 mismatch`);
  }
  return unchanged;
}

function hasContradictory043cStatus(text) {
  const lines = text.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!/043c/i.test(line)) continue;

    const candidates = [{ text: line, requiresDeclarationSyntax: true }];
    for (let nextIndex = index + 1; nextIndex < lines.length && nextIndex <= index + 3; nextIndex += 1) {
      if (lines[nextIndex].trim().length === 0) continue;
      if (/^\s*(?:status|state)\s*:/i.test(lines[nextIndex])) {
        candidates.push({ text: lines[nextIndex], requiresDeclarationSyntax: false });
      }
      break;
    }

    for (const candidate of candidates) {
      const withoutBlockedStatuses = candidate.text
        .replace(/NOT[_ -]?STARTED/gi, "")
        .replace(/NOT[_ -]?AUTHORIZED/gi, "");
      const activationPresent = /\b(?:STARTED|AUTHORIZED|IMPLEMENTED|IN[_ -]?PROGRESS)\b/i
        .test(withoutBlockedStatuses);
      const declarationSyntaxPresent = /(?:043c.{0,60}(?::|=|\b(?:status|state|reste|remains|is|est)\b)|(?:status|state).{0,60}043c)/i
        .test(withoutBlockedStatuses);
      if (activationPresent && (!candidate.requiresDeclarationSyntax || declarationSyntaxPresent)) return true;
    }
  }
  return false;
}

function validate043bLifecycle() {
  const activeSpec = readText(CURRENT_SPEC_043_ACTIVE_PATH);
  const sectionStart = activeSpec.indexOf("## 043c -");
  const sectionEnd = sectionStart < 0 ? -1 : activeSpec.indexOf("\n## ", sectionStart + 1);
  const section = sectionStart < 0
    ? ""
    : activeSpec.slice(sectionStart, sectionEnd < 0 ? activeSpec.length : sectionEnd);
  const exactStatusLine = "Status: `NOT_STARTED / NOT_AUTHORIZED`.";
  const statusLines = section.split(/\r?\n/).filter((line) => /^Status\s*:/i.test(line));
  const specKeeps043cBlocked = sameArray(statusLines, [exactStatusLine]);
  const plan = readText("docs/product/v1-plan.md");
  const runbook = readText("runbooks/controlled-fiduciary-pilot-local-043.md");
  const planKeeps043cBlocked = plan.includes("`043c` reste `NOT_STARTED / NOT_AUTHORIZED`");
  const runbookKeeps043cBlocked = runbook.includes("`043c` reste `NOT_STARTED / NOT_AUTHORIZED`");
  const contradictoryActivation = [activeSpec, plan, runbook].some(hasContradictory043cStatus);
  const notAuthorized = specKeeps043cBlocked
    && planKeeps043cBlocked
    && runbookKeeps043cBlocked
    && !contradictoryActivation;
  assert(notAuthorized, `043c must have one canonical NOT_STARTED / NOT_AUTHORIZED status and no contradictory activation`);

  const visible = worktreeVisiblePaths();
  const futureSpecs = visible.filter((path) => {
    const match = /^specs\/(?:active|backlog|done)\/(\d+)(?:[-_.]|$)/i.exec(path);
    return match !== null && Number(match[1]) >= 44;
  });
  assert(futureSpecs.length === 0, `no spec numbered 044 or later is authorized`);
  return { notAuthorized, futureSpecsAbsent: futureSpecs.length === 0 };
}

function validate043bSensitiveAndRuntimeAdditions(
  range = undefined,
  fileSet = CURRENT_043B_ALLOWED_FILE_SET,
  runtimePaths = CURRENT_043B_RUNTIME_IMPLEMENTATION_PATHS,
) {
  const addedLines = range?.mode === "HISTORICAL_043B"
    || range?.mode === "HISTORICAL_043B_HOTFIX"
    ? parseAddedLinesFromUnifiedDiff(gitOutput([
      "diff",
      "--no-ext-diff",
      "--unified=0",
      "--no-color",
      "--find-renames",
      "--find-copies",
      `${range.base}..${range.head}`,
      "--",
      ...fileSet,
    ]))
    : addedLinesForCurrentPaths(fileSet);
  const highConfidenceSecretPatterns = [
    { category: "provider_key_value", regex: new RegExp("sk" + "-(?:proj|svcacct)-[A-Za-z0-9_-]{12,}", "i") },
    { category: "slack_token_value", regex: new RegExp("xox" + "[aboprs]-[A-Za-z0-9-]{12,}", "i") },
    { category: "github_token_value", regex: new RegExp("(?:gh" + "[pousr]_|github" + "_pat_)[A-Za-z0-9_]{20,}", "i") },
    { category: "aws_access_key_value", regex: new RegExp("AK" + "IA[0-9A-Z]{16}") },
    { category: "private_key_value", regex: new RegExp("BEGIN" + " (?:RSA |EC )?PRIVATE" + " KEY", "i") },
    { category: "jwt_value", regex: /\beyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/ },
  ];
  const emailPattern = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
  const swissIbanPattern = /\bCH\d{2}(?:\s?[A-Z0-9]){17}\b/gi;
  const privateLocationPatterns = [
    new RegExp("[A-Za-z]:" + "\\\\(?:Users|Documents and Settings)\\\\", "i"),
    /(?:^|[\s"'])\/(?:home|Users)\/[^\s"']+/i,
    new RegExp("(?:^|[\\s\"'])" + "\\\\\\\\" + "[A-Za-z0-9._$-]+\\\\[A-Za-z0-9._$-]+(?:\\\\|[\\s\"']|$)", "i"),
    new RegExp("file" + ":\\/\\/", "i"),
  ];
  const aiOrMcpModule = "(?:openai|@anthropic-ai|@google/generative-ai|@modelcontextprotocol(?:/[^\"']+)?|langchain|@langchain/[^\"']+)";
  const providerOrMcpActivationPatterns = [
    new RegExp(`^\\s*import(?:\\s+[^\"']*\\s+from\\s+|\\s*)[\"']${aiOrMcpModule}[\"']`, "i"),
    new RegExp(`\\bimport\\s*\\(\\s*[\"']${aiOrMcpModule}[\"']`, "i"),
    new RegExp(`\\brequire\\s*\\(\\s*[\"']${aiOrMcpModule}[\"']`, "i"),
    new RegExp(`(?:[\"']|\\b)${aiOrMcpModule}(?:[\"']|\\b)`, "i"),
    /^\s*import\s+(?:org\.springframework\.ai|com\.openai|com\.anthropic)\./i,
    /\b(?:OpenAI|Anthropic|McpServer|MCPServer|StdioServerTransport|SseServerTransport|StreamableHTTPServerTransport)\s*\(/,
    /\b(?:mcp-server|model-context-protocol|modelcontextprotocol)\b/i,
    /\b(?:api\.openai\.com|api\.anthropic\.com|generativelanguage\.googleapis\.com)\b/i,
  ];
  const loopbackHttpPrefix = "http" + "://127.0.0.1";

  let secretFindings = 0;
  let personalOrRealDataFindings = 0;
  let providerOrMcpFindings = 0;
  for (const added of addedLines) {
    for (const pattern of highConfidenceSecretPatterns) {
      if (pattern.regex.test(added.text)) {
        secretFindings += 1;
        addError(`${added.path}:${added.line}:043b_${pattern.category}`);
      }
    }

    const emails = added.text.match(emailPattern) ?? [];
    for (const email of emails) {
      const lowerEmail = email.toLowerCase();
      if (!lowerEmail.endsWith(".invalid") && !lowerEmail.endsWith(".example") && !lowerEmail.endsWith(".test")) {
        personalOrRealDataFindings += 1;
        addError(`${added.path}:${added.line}:043b_personal_email_value`);
      }
    }
    if ((added.text.match(swissIbanPattern) ?? []).length > 0) {
      personalOrRealDataFindings += 1;
      addError(`${added.path}:${added.line}:043b_swiss_iban_value`);
    }
    const normalizedEscapes = added.text.replaceAll("\\/", "/").replaceAll("\\\\", "\\");
    if ([added.text, normalizedEscapes].some((text) =>
      privateLocationPatterns.some((pattern) => pattern.test(text)))) {
      personalOrRealDataFindings += 1;
      addError(`${added.path}:${added.line}:043b_private_path_value`);
    }

    if (runtimePaths.has(added.path)) {
      for (const pattern of providerOrMcpActivationPatterns) {
        if (pattern.test(added.text)) {
          providerOrMcpFindings += 1;
          addError(`${added.path}:${added.line}:043b_ai_provider_or_mcp_runtime_activation`);
        }
      }
      const urls = added.text.match(/https?:\/\/[^\s"'`]+/gi) ?? [];
      for (const urlValue of urls) {
        if (!urlValue.startsWith(loopbackHttpPrefix)) {
          providerOrMcpFindings += 1;
          addError(`${added.path}:${added.line}:043b_non_loopback_runtime_url`);
        }
      }
    }
  }

  return {
    noHighConfidenceSecret: secretFindings === 0,
    noPersonalOrRealData: personalOrRealDataFindings === 0,
    noAiProviderOrMcpRuntime: providerOrMcpFindings === 0,
  };
}

function validate043bWorktree(actual) {
  const exactFileSet = sameArray(actual, CURRENT_043B_ALLOWED_FILE_SET);
  assert(exactFileSet, `worktree file set must be exactly the closed 17-path 043b whitelist`);
  const allowedPathsPresent = CURRENT_043B_ALLOWED_FILE_SET.every((path) => existsSync(absolutePath(path)));
  assert(allowedPathsPresent, `every path in the closed 17-path 043b whitelist must exist in the worktree`);

  const staged = stagedPaths();
  const stagedEmpty = staged.length === 0;
  assert(stagedEmpty, `043b worktree validation requires an empty staged index`);

  const statusRecords = currentWorktreeStatusRecords();
  const statusPaths = [...new Set(statusRecords.flatMap((record) => record.paths))].sort();
  const modifiedCount = statusRecords.filter((record) => record.status === " M").length;
  const untrackedCount = statusRecords.filter((record) => record.status === "??").length;
  const statusMatrixExact = statusRecords.length === CURRENT_043B_ALLOWED_FILE_SET.length
    && sameArray(statusPaths, CURRENT_043B_ALLOWED_FILE_SET)
    && modifiedCount === 14
    && untrackedCount === 3
    && statusRecords.every((record) => record.paths.length === 1
      && record.status === (CURRENT_043B_UNTRACKED_PATHS.has(record.paths[0]) ? "??" : " M"));
  assert(statusMatrixExact, `043b worktree status matrix must be exactly 14 unstaged modifications and 3 untracked additions`);

  const forbiddenSurface = actual.filter(is043bForbiddenSurface);
  const forbiddenSurfaceAbsent = forbiddenSurface.length === 0;
  assert(forbiddenSurfaceAbsent, `043b forbidden runtime, configuration, contract, CI, migration, lockfile or fixture surface changed`);

  const environmentFiles = environmentFilePaths();
  const environmentFilesAbsent = environmentFiles.length === 0;
  assert(environmentFilesAbsent, `043b worktree contains a tracked or ignored .env file outside the committed example`);

  const packageJsonScriptOnly = validate043bPackageJson();
  const fixtures043aUnchanged = validateFrozen043aHashes();
  const lifecycle = validate043bLifecycle();
  const sensitiveRuntime = validate043bSensitiveAndRuntimeAdditions();
  return {
    worktreeProfile: WORKTREE_PROFILES.HARNESS_043B,
    exactFileSet,
    allowedPathsPresent,
    stagedEmpty,
    statusMatrixExact,
    forbiddenSurfaceAbsent,
    environmentFilesAbsent,
    packageJsonScriptOnly,
    fixtures043aUnchanged,
    ...lifecycle,
    ...sensitiveRuntime,
  };
}

function validateProtectedHashesAndCases() {
  let protectedArtifactsUnchanged = true;
  let protectedCaseBytesUnchanged = true;
  for (const [path, expectedHash] of PROTECTED_HASHES) {
    const actualHash = sha256Bytes(readBytes(path));
    if (actualHash !== expectedHash) {
      protectedArtifactsUnchanged = false;
      if (PROTECTED_CASE_ARTIFACTS.has(path)) protectedCaseBytesUnchanged = false;
    }
    assert(actualHash === expectedHash, `${path}: protected exact-byte SHA-256 mismatch`);
  }

  const semantic = parseJson("evals/mapping/fixtures/042a2/candidate-semantic-cases-v1.json");
  const policyFault = parseJson("evals/mapping/fixtures/042a2/candidate-policy-fault-cases-v1.json");
  const packA = parseJson("evals/mapping/reviews/042a2/reviewer-a-blind-v1.json");
  const packB = parseJson("evals/mapping/reviews/042a2/reviewer-b-blind-v1.json");
  let candidateCasesUnchanged = protectedCaseBytesUnchanged && Boolean(semantic && policyFault && packA && packB);
  if (semantic && policyFault && packA && packB) {
    const sourceCount = (semantic.cases?.length ?? -1)
      + (policyFault.policyCases?.length ?? -1)
      + (policyFault.invalidOutputCases?.length ?? -1);
    const sourceCountValid = sourceCount === 17;
    const packCountValid = packA.cases?.length === 17 && packB.cases?.length === 17;
    candidateCasesUnchanged = protectedCaseBytesUnchanged && sourceCountValid && packCountValid;
    assert(sourceCountValid, `protected candidate fixtures no longer contain the governed 17-case total`);
    assert(packCountValid, `protected blind packs no longer contain 17 cases each`);
  }
  console.log(`protected_v1_exact_byte_hashes_unchanged=${protectedArtifactsUnchanged ? "YES" : "NO"}`);
  console.log(`candidate_17_cases_exact_byte_unchanged=${candidateCasesUnchanged ? "YES" : "NO"}`);
  console.log(`protected_artifacts_unchanged=${protectedArtifactsUnchanged ? "YES" : "NO"}`);
  console.log(`protected_042_artifacts_unchanged=${protectedArtifactsUnchanged ? "YES" : "NO"}`);
}

function validateObjectClosure(node, repoPath, pointer = "#", containerKey = "") {
  if (!node || typeof node !== "object" || Array.isArray(node)) return;
  const isSchemaObject = containerKey !== "properties" && containerKey !== "$defs";
  const isPartialApplicator = /\/(?:allOf|anyOf|oneOf|contains)(?:\/|$)|\/(?:if|then|else)(?:\/|$)/.test(pointer);
  if (isSchemaObject && !isPartialApplicator && (node.type === "object" || Object.hasOwn(node, "properties"))) {
    assert(node.additionalProperties === false, `${repoPath}${pointer}: modeled object must set additionalProperties=false`);
  }
  for (const [key, value] of Object.entries(node)) {
    if (Array.isArray(value)) {
      value.forEach((item, index) => validateObjectClosure(item, repoPath, `${pointer}/${key}/${index}`, key));
    } else if (value && typeof value === "object") {
      validateObjectClosure(value, repoPath, `${pointer}/${key}`, key);
    }
  }
}

function collectPropertyNames(node, result = new Set()) {
  if (!node || typeof node !== "object") return result;
  if (!Array.isArray(node) && node.properties && typeof node.properties === "object") {
    Object.keys(node.properties).forEach((key) => result.add(key));
  }
  const values = Array.isArray(node) ? node : Object.values(node);
  values.forEach((value) => collectPropertyNames(value, result));
  return result;
}

function resolveLocalDefinition(schema, reference) {
  const name = reference?.replace("#/$defs/", "");
  return name ? schema?.$defs?.[name] : undefined;
}

function topLevelSchemaBranches(schema) {
  if (!schema) return [];
  if (schema.properties) return [schema];
  return (schema.oneOf ?? [])
    .map((entry) => resolveLocalDefinition(schema, entry?.$ref))
    .filter(Boolean);
}

function validateResponseCustodyReferences(schema, label) {
  const branches = topLevelSchemaBranches(schema);
  assert(branches.length > 0, `${label}: no modeled root branch found`);
  for (const branch of branches) {
    for (const responseProperty of ["responseA", "responseB"]) {
      assert((branch.required ?? []).includes(responseProperty), `${label}: ${responseProperty} must be required`);
      const responseReference = resolveLocalDefinition(schema, branch.properties?.[responseProperty]?.$ref);
      assert(Boolean(responseReference), `${label}: ${responseProperty} reference missing`);
      if (!responseReference) continue;
      assert((responseReference.required ?? []).includes("custodyReference"), `${label}: ${responseProperty} custodyReference must be required`);
      assert((responseReference.required ?? []).includes("sha256"), `${label}: ${responseProperty} exact-byte SHA-256 must be required`);
      assert(!(responseReference.required ?? []).includes("repositoryPath"), `${label}: ${responseProperty} repositoryPath must be absent`);
      assert(!Object.hasOwn(responseReference.properties ?? {}, "repositoryPath"), `${label}: ${responseProperty} repositoryPath property must be absent`);
      assert(
        responseReference.properties?.custodyReference?.$ref === "#/$defs/CustodyReference",
        `${label}: ${responseProperty} must use the opaque custody reference definition`,
      );
    }
  }
  const custodyReference = schema?.$defs?.CustodyReference;
  assert(
    custodyReference?.type === "string"
      && typeof custodyReference?.pattern === "string"
      && custodyReference?.description?.includes("exact-byte SHA-256")
      && custodyReference?.description?.includes("no URL")
      && custodyReference?.description?.includes("no path")
      && custodyReference?.description?.includes("no provider")
      && custodyReference?.description?.includes("no bucket")
      && custodyReference?.description?.includes("no tenant")
      && custodyReference?.description?.includes("no identity"),
    `${label}: custody reference constraints or limitations missing`,
  );
  assert(
    custodyReference?.description?.includes("automatically and randomly")
      && custodyReference?.description?.includes("limited to one review round")
      && custodyReference?.description?.includes("not be identity-derived")
      && custodyReference?.description?.includes("not be reused across rounds without explicit approval")
      && custodyReference?.description?.includes("does not prove"),
    `${label}: procedural custody-reference doctrine missing`,
  );
  if (typeof custodyReference?.pattern === "string") {
    try {
      const custodyPattern = new RegExp(custodyReference.pattern);
      assert(custodyPattern.test("custody-ref-round-r4nd0m"), `${label}: custody pattern rejects an opaque sample`);
      for (const locator of [
        "https" + "://example.invalid/response",
        "C:" + "\\" + "Users" + "\\" + "private\\response.json",
        "/" + "home/private/response.json",
        "\\" + "\\" + "server" + "\\" + "share\\response.json",
        "s3" + "://bucket/response.json",
      ]) {
        assert(!custodyPattern.test(locator), `${label}: custody pattern accepts a locator-shaped value`);
      }
    } catch {
      addError(`${label}:custody_pattern_invalid`);
    }
  }
}

function validateAdjudicationBranches(schema) {
  const refs = schema?.oneOf ?? [];
  assert(refs.length === 2, `adjudication-dossier-manifest schema: exactly two discriminated branches required`);
  const branches = refs.map((entry) => resolveLocalDefinition(schema, entry?.$ref)).filter(Boolean);
  const agreement = branches.find((branch) => branch.properties?.dossierMode?.const === "AGREEMENT_RATIFICATION");
  const divergence = branches.find((branch) => branch.properties?.dossierMode?.const === "DIVERGENCE_ADJUDICATION");
  const artifactStatus = schema?.$defs?.ArtifactStatus;
  const artifactStatusIsNonAuthoritative = artifactStatus?.minItems === 2
    && artifactStatus?.maxItems === 2
    && artifactStatus?.prefixItems?.[0]?.const === "NOT_GOLDEN"
    && artifactStatus?.prefixItems?.[1]?.const === "NOT_AUTHORITATIVE"
    && artifactStatus?.items === false;
  let agreementAuthorityBounded = false;
  let divergenceAuthorityBounded = false;
  assert(Boolean(agreement) && Boolean(divergence), `adjudication-dossier-manifest schema: agreement/divergence discriminators missing`);
  assert(artifactStatusIsNonAuthoritative, `adjudication-dossier-manifest schema: root status must remain NOT_GOLDEN and NOT_AUTHORITATIVE`);
  if (agreement) {
    const agreementDescription = agreement.description ?? "";
    agreementAuthorityBounded = artifactStatusIsNonAuthoritative
      && agreement.properties?.status?.$ref === "#/$defs/ArtifactStatus"
      && REVIEW_EVIDENCE_AUTHORITY_MARKERS.every((marker) => agreementDescription.includes(marker))
      && agreementDescription.includes(AGREEMENT_RATIFICATION_AUTHORITY_BOUNDARY);
    assert(agreementAuthorityBounded, `adjudication-dossier-manifest schema: agreement authority boundary missing`);
    assert(agreement.additionalProperties === false, `adjudication-dossier-manifest schema: agreement branch must be closed`);
    assert(agreement.properties?.agreementConfirmed?.const === true, `adjudication-dossier-manifest schema: agreementConfirmed=true missing`);
    for (const field of [
      "responseA",
      "responseB",
      "agreementConfirmed",
      "explicitHumanRatification",
      "ratifierPseudonym",
      "approvalReference",
      "ratifiedAt",
      "authorizedTransitionReference",
    ]) {
      assert((agreement.required ?? []).includes(field), `adjudication-dossier-manifest schema: agreement must require ${field}`);
    }
    assert(agreement.properties?.explicitHumanRatification?.const === true, `adjudication-dossier-manifest schema: explicit human ratification marker missing`);
    assert(
      agreement.properties?.ratifierPseudonym?.pattern === "^adjudicator-[a-z0-9][a-z0-9-]{0,39}$",
      `adjudication-dossier-manifest schema: agreement ratifier must use the registered adjudicator role`,
    );
    const approvalReference = resolveLocalDefinition(schema, agreement.properties?.approvalReference?.$ref);
    const transitionReference = resolveLocalDefinition(schema, agreement.properties?.authorizedTransitionReference?.$ref);
    assert((approvalReference?.required ?? []).includes("sha256"), `adjudication-dossier-manifest schema: agreement approval reference must be hash-bound`);
    assert((transitionReference?.required ?? []).includes("sha256"), `adjudication-dossier-manifest schema: agreement transition reference must be hash-bound`);
    for (const forbiddenProperty of [
      "divergentFields",
      "frozenJustificationA",
      "frozenJustificationB",
      "humanJustification",
      "justification",
      "comment",
      "note",
      "freeText",
    ]) {
      assert(!Object.hasOwn(agreement.properties ?? {}, forbiddenProperty), `adjudication-dossier-manifest schema: agreement forbids ${forbiddenProperty}`);
    }
    assert(!Object.hasOwn(agreement.properties ?? {}, "evidencePurpose"), `adjudication-dossier-manifest schema: agreement evidencePurpose field is forbidden`);
  }
  if (divergence) {
    const divergenceDescription = divergence.description ?? "";
    divergenceAuthorityBounded = artifactStatusIsNonAuthoritative
      && divergence.properties?.status?.$ref === "#/$defs/ArtifactStatus"
      && REVIEW_EVIDENCE_AUTHORITY_MARKERS.every((marker) => divergenceDescription.includes(marker))
      && divergenceDescription.includes(DIVERGENCE_ADJUDICATION_AUTHORITY_BOUNDARY);
    assert(divergenceAuthorityBounded, `adjudication-dossier-manifest schema: divergence authority boundary missing`);
    assert(divergence.additionalProperties === false, `adjudication-dossier-manifest schema: divergence branch must be closed`);
    assert((divergence.required ?? []).includes("divergentFields"), `adjudication-dossier-manifest schema: divergentFields must be required`);
    const divergentFields = resolveLocalDefinition(schema, divergence.properties?.divergentFields?.$ref)
      ?? divergence.properties?.divergentFields;
    assert(divergentFields?.minItems === 1, `adjudication-dossier-manifest schema: divergentFields must be non-empty`);
    assert((divergence.required ?? []).includes("roleSeparationConfirmed"), `adjudication-dossier-manifest schema: role separation must be required`);
    assert(divergence.properties?.roleSeparationConfirmed?.const === true, `adjudication-dossier-manifest schema: role separation must be explicit`);
    const decisionRoute = resolveLocalDefinition(schema, divergence.properties?.decisionRoute?.$ref);
    const decisionText = JSON.stringify(decisionRoute ?? {});
    assert(
      decisionText.includes("HumanAdjudicationRoute") && decisionText.includes("NonAdjudicableStopRoute"),
      `adjudication-dossier-manifest schema: manual adjudication and NON_ADJUDICABLE_STOP routes required`,
    );
    const routeDefinitions = (decisionRoute?.oneOf ?? []).map((entry) => resolveLocalDefinition(schema, entry?.$ref));
    const manualRoute = routeDefinitions.find((route) => route?.properties?.route?.const === "HUMAN_ADJUDICATION");
    assert((manualRoute?.required ?? []).includes("manualDecisionRequired"), `adjudication-dossier-manifest schema: manual route marker must be required`);
    assert(manualRoute?.properties?.manualDecisionRequired?.const === true, `adjudication-dossier-manifest schema: manual adjudication must be true`);
    assert(!Object.hasOwn(divergence.properties ?? {}, "evidencePurpose"), `adjudication-dossier-manifest schema: divergence evidencePurpose field is forbidden`);
  }
  console.log(`agreement_ratification_authority_boundary=${agreementAuthorityBounded ? "PASS" : "FAIL"}`);
  console.log(`divergence_adjudication_authority_boundary=${divergenceAuthorityBounded ? "PASS" : "FAIL"}`);
}

function validateSchemas() {
  const errorCountBefore = errors.length;
  for (const path of SCHEMA_PATHS) {
    const schema = parseJson(path);
    if (!schema) continue;
    parsedSchemas.set(path, schema);
    assert(schema.$schema === "https://json-schema.org/draft/2020-12/schema", `${path}: Draft 2020-12 documentary target missing`);
    assert(Array.isArray(schema["x-ritomer-status"]), `${path}: x-ritomer-status must be an array`);
    assert(sameArray(schema["x-ritomer-status"] ?? [], GOVERNANCE_STATUSES), `${path}: four governance statuses missing or out of order`);
    assert(typeof schema.$comment === "string" && schema.$comment.includes(NON_VALIDATION_WORDING), `${path}: exact non-validation wording missing from $comment`);
    assert(!readText(path).includes(FORBIDDEN_VALIDATION_CLAIM), `${path}: forbidden wording present`);
    validateObjectClosure(schema, path);
  }

  const response = parsedSchemas.get("evals/mapping/reviews/042a2/reviewer-response-schema-v2.json");
  if (response) {
    const responseText = JSON.stringify(response);
    for (const token of ["REAL_ROUND", "DRY_RUN", "PRECONDITION_BLOCK", "NOT_GOLDEN", "NOT_AUTHORITATIVE", "humanJustification", "decisiveSignal", "expectedHumanAction"]) {
      assert(responseText.includes(token), `reviewer-response-schema-v2.json: required token ${token} missing`);
    }
    assert(responseText.includes('"minLength":250') && responseText.includes('"maxLength":400'), `reviewer-response-schema-v2.json: human justification bounds missing`);
    for (let index = 1; index <= 17; index += 1) {
      const blindCaseId = `BR-${String(index).padStart(3, "0")}`;
      assert(responseText.includes(`"const":"${blindCaseId}"`), `reviewer-response-schema-v2.json: exact-once constraint missing for ${blindCaseId}`);
    }
    const exactIdConstraints = response.$defs?.AllBlindCaseIdsExactlyOnce?.allOf ?? [];
    assert(exactIdConstraints.length === 17, `reviewer-response-schema-v2.json: exact-once constraint set must contain 17 entries`);
    for (const constraint of exactIdConstraints) {
      assert(constraint.minContains === 1 && constraint.maxContains === 1, `reviewer-response-schema-v2.json: each BR id must have minContains=maxContains=1`);
    }
    const forbiddenProperties = ["expectedAnswer", "oracle", "sourceCaseId", "expectedOutcome", "expectedTarget"];
    const propertyNames = collectPropertyNames(response);
    for (const propertyName of forbiddenProperties) {
      assert(!propertyNames.has(propertyName), `reviewer-response-schema-v2.json: forbidden property ${propertyName}`);
    }
    assert(!propertyNames.has("action"), `reviewer-response-schema-v2.json: legacy action alias is forbidden; use expectedHumanAction`);

    const ambiguousTarget = response.$defs?.AmbiguousTargetAbstention;
    assert(
      ambiguousTarget?.properties?.evidenceState?.const === "SUFFICIENT"
        && !Object.hasOwn(ambiguousTarget?.properties?.evidenceState ?? {}, "enum"),
      `reviewer-response-schema-v2.json: AMBIGUOUS_TARGET must require SUFFICIENT only`,
    );
    assert(
      ambiguousTarget?.properties?.evidenceState?.description === AMBIGUOUS_TARGET_SUFFICIENT_MEANING
        && !JSON.stringify(ambiguousTarget).includes("CONFLICTING"),
      `reviewer-response-schema-v2.json: AMBIGUOUS_TARGET SUFFICIENT meaning or conflict exclusion missing`,
    );

    const preconditionRefs = response.$defs?.PreconditionBlock?.oneOf ?? [];
    assert(preconditionRefs.length === 2, `reviewer-response-schema-v2.json: PRECONDITION_BLOCK must have two reason-bound branches`);
    const preconditionBranches = preconditionRefs
      .map((entry) => entry?.$ref?.replace("#/$defs/", ""))
      .map((name) => response.$defs?.[name])
      .filter(Boolean);
    const staleBranch = preconditionBranches.find((branch) => branch.properties?.reasonCode?.const === "STALE_IMPORT");
    const unmetBranch = preconditionBranches.find((branch) => Array.isArray(branch.properties?.reasonCode?.enum));
    assert(staleBranch?.properties?.evidenceState?.const === "STALE_PRECONDITION", `reviewer-response-schema-v2.json: STALE_IMPORT evidence state differs`);
    assert(
      sameArray(
        unmetBranch?.properties?.reasonCode?.enum ?? [],
        ["ACCOUNT_ALREADY_AFFECTED", "ACCOUNT_NOT_IN_LATEST_IMPORT", "NOT_ELIGIBLE"],
      ) && unmetBranch?.properties?.evidenceState?.const === "PRECONDITION_NOT_MET",
      `reviewer-response-schema-v2.json: non-stale precondition mapping differs`,
    );

    for (const definitionName of ["HumanJustification", "DecisiveSignal", "MainAlternativeRejected"]) {
      const definition = response.$defs?.[definitionName];
      assert(
        definition?.description?.includes(FREE_TEXT_DATA_DOCTRINE),
        `reviewer-response-schema-v2.json: ${definitionName} data-minimization doctrine missing`,
      );
      assert(
        definition?.type === "string"
          && !Object.hasOwn(definition ?? {}, "enum")
          && !Object.hasOwn(definition ?? {}, "properties"),
        `reviewer-response-schema-v2.json: ${definitionName} must remain a non-enum string`,
      );
    }
  }

  const attestation = parsedSchemas.get("evals/mapping/reviews/042a2/reviewer-attestation-schema-v1.json") ?? {};
  const attestationText = JSON.stringify(attestation);
  assert(attestationText.includes("PRE_REVIEW") && attestationText.includes("AT_FREEZE"), `reviewer-attestation schema discriminators missing`);
  const atFreeze = findSchemaBranchByConst(attestation, "attestationType", "AT_FREEZE");
  for (const declaration of ["noAiAssistantUsed", "noForbiddenSourceAccess"]) {
    assert((atFreeze?.required ?? []).includes(declaration), `reviewer-attestation schema: AT_FREEZE must require ${declaration}`);
    assert(atFreeze?.properties?.[declaration]?.const === true, `reviewer-attestation schema: AT_FREEZE ${declaration} must be true`);
  }
  const preReview = findSchemaBranchByConst(attestation, "attestationType", "PRE_REVIEW");
  const competenceEvidenceRef = preReview?.properties?.eligibilityCompetenceEvidence?.$ref?.replace("#/$defs/", "");
  const competenceEvidence = attestation.$defs?.[competenceEvidenceRef];
  assert((preReview?.required ?? []).includes("eligibilityCompetenceEvidence"), `reviewer-attestation schema: PRE_REVIEW evidence reference missing`);
  assert(competenceEvidence?.additionalProperties === false, `reviewer-attestation schema: eligibility evidence object must be closed`);
  assert(
    sameArray(competenceEvidence?.required ?? [], ["attestationReference", "sha256"])
      && competenceEvidence?.properties?.attestationReference?.$ref === "#/$defs/AttestationReference"
      && competenceEvidence?.properties?.sha256?.$ref === "#/$defs/Sha256",
    `reviewer-attestation schema: eligibility evidence must contain only an opaque reference and exact-byte SHA-256`,
  );

  const participantRegistry = parsedSchemas.get("evals/mapping/reviews/042a2/restricted-participant-registry-schema-v1.json") ?? {};
  const proceduralDescriptions = [
    response?.$defs?.ReviewerPseudonym?.description,
    participantRegistry.description,
    attestation.$defs?.ReviewerPseudonym?.description,
    attestation.$defs?.AttestationReference?.description,
  ];
  for (const description of proceduralDescriptions) {
    assert(
      description?.includes("automatically and randomly")
        && description?.includes("one review round")
        && description?.includes("not be derived")
        && description?.includes("not be reused across rounds without explicit approval")
        && description?.includes("does not prove"),
      `human-review schemas: pseudonym/reference procedural doctrine missing`,
    );
  }

  const clarification = parsedSchemas.get("evals/mapping/reviews/042a2/review-clarification-record-schema-v1.json") ?? {};
  const clarificationText = JSON.stringify(clarification);
  assert(clarificationText.includes("MAY_INFLUENCE_DECISION") && clarificationText.includes("NO_DECISION_INFLUENCE"), `clarification schema discriminators missing`);
  assert(
    clarification.$defs?.ClarificationText?.type === "string"
      && clarification.$defs?.ClarificationText?.maxLength === 500
      && !Object.hasOwn(clarification.$defs?.ClarificationText ?? {}, "format")
      && !Object.hasOwn(clarification.$defs?.ClarificationText ?? {}, "contentEncoding")
      && !Object.hasOwn(clarification.$defs?.ClarificationText ?? {}, "enum")
      && clarification.$defs?.ClarificationText?.description?.includes(FREE_TEXT_DATA_DOCTRINE),
    `clarification schema: plain-text 500-character data-minimization constraint missing`,
  );

  validateResponseCustodyReferences(
    parsedSchemas.get("evals/mapping/reviews/042a2/review-freeze-record-schema-v1.json"),
    "review-freeze-record schema",
  );
  const adjudication = parsedSchemas.get("evals/mapping/reviews/042a2/adjudication-dossier-manifest-schema-v1.json");
  validateResponseCustodyReferences(adjudication, "adjudication-dossier-manifest schema");
  validateAdjudicationBranches(adjudication);

  const roundManifestText = JSON.stringify(parsedSchemas.get("evals/mapping/reviews/042a2/review-round-manifest-schema-v1.json") ?? {});
  assert(roundManifestText.includes("PRE_DISTRIBUTION") && roundManifestText.includes("DISTRIBUTED"), `round manifest lifecycle discriminators missing`);

  console.log(`json_schema_syntax_parsed=${parsedSchemas.size}_OF_${SCHEMA_PATHS.length}`);
  console.log(`schema_governance_statuses_present=${errors.length === errorCountBefore ? "YES" : "NO"}`);
}

function findHardeningSchemaBranch(node) {
  if (!node || typeof node !== "object") return undefined;
  if (!Array.isArray(node) && node.properties?.recordType?.const === "HARDENING_ONLY") return node;
  const values = Array.isArray(node) ? node : Object.values(node);
  for (const value of values) {
    const found = findHardeningSchemaBranch(value);
    if (found) return found;
  }
  return undefined;
}

function findSchemaBranchByConst(node, propertyName, constValue) {
  if (!node || typeof node !== "object") return undefined;
  if (!Array.isArray(node) && node.properties?.[propertyName]?.const === constValue) return node;
  const values = Array.isArray(node) ? node : Object.values(node);
  for (const value of values) {
    const found = findSchemaBranchByConst(value, propertyName, constValue);
    if (found) return found;
  }
  return undefined;
}

function validateLedger() {
  const bytes = readBytes(LEDGER_PATH);
  assert(!(bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf), `${LEDGER_PATH}: UTF-8 BOM forbidden`);
  const text = bytes.toString("utf8");
  assert(!text.includes("\r"), `${LEDGER_PATH}: CR/CRLF forbidden; LF required`);
  assert(text.endsWith("\n"), `${LEDGER_PATH}: terminal LF required`);
  const body = text.endsWith("\n") ? text.slice(0, -1) : text;
  const lines = body.split("\n");
  assert(lines.length === 1, `${LEDGER_PATH}: exactly one baseline record required`);
  assert(lines.every((line) => line.length > 0), `${LEDGER_PATH}: blank lines forbidden`);
  assert(lines.every((line) => line.startsWith("{") && !line.trimStart().startsWith("//") && !line.trimStart().startsWith("#")), `${LEDGER_PATH}: comments or non-JSON lines forbidden`);

  const records = [];
  for (let index = 0; index < lines.length; index += 1) {
    try {
      const record = JSON.parse(lines[index]);
      records.push(record);
      assert(JSON.stringify(record) === lines[index], `${LEDGER_PATH}:${index + 1}: deterministic compact serialization/order required`);
    } catch (error) {
      addError(`${LEDGER_PATH}:${index + 1}: invalid JSONL record (${error.name})`);
    }
  }

  assert(records.filter((record) => record.recordType === "HARDENING_ONLY").length === 1, `${LEDGER_PATH}: exactly one HARDENING_ONLY record required`);
  const baseline = records[0];
  if (baseline) {
    assert(sameArray(Object.keys(baseline), EXPECTED_BASELINE_KEYS), `${LEDGER_PATH}: deterministic baseline property order differs`);
    for (const [key, expected] of Object.entries(EXPECTED_BASELINE)) {
      assert(baseline[key] === expected, `${LEDGER_PATH}: baseline invariant ${key} differs`);
    }
  }

  for (let index = 1; index < records.length; index += 1) {
    assert(records[index].sequence === records[index - 1].sequence + 1, `${LEDGER_PATH}:${index + 1}: sequence must be monotonic`);
    assert(records[index].previousRecordHash === sha256Bytes(Buffer.from(lines[index - 1], "utf8")), `${LEDGER_PATH}:${index + 1}: previousRecordHash mismatch`);
  }

  const ledgerSchema = parsedSchemas.get("evals/mapping/reviews/042a2/workflow-ledger-record-schema-v1.json");
  if (ledgerSchema) {
    const schemaText = JSON.stringify(ledgerSchema);
    assert(ledgerSchema.description?.includes(LEDGER_LIMIT_WORDING), `workflow ledger schema: SHA-256 limitation wording missing`);
    assert(ledgerSchema.description?.includes(LEDGER_ANCHOR_WORDING), `workflow ledger schema: external-anchor wording missing`);
    for (const token of ["HARDENING_ONLY", "TRANSITION", "STOP", "INVALIDATION", "NON_ADJUDICABLE", "PENDING_HUMAN_RESPONSES", "REVIEW_ROUND_DISTRIBUTION_AUTHORIZED", "InvalidationGate"]) {
      assert(schemaText.includes(token), `workflow ledger schema: required token ${token} missing`);
    }
    const hardeningBranch = findHardeningSchemaBranch(ledgerSchema);
    assert(Boolean(hardeningBranch), `workflow ledger schema: HARDENING_ONLY branch missing`);
    if (hardeningBranch) {
      for (const [key, expected] of Object.entries(EXPECTED_BASELINE)) {
        if (key === "schemaVersion") {
          assert(
            hardeningBranch.properties?.schemaVersion?.$ref === "#/$defs/SchemaVersion"
              && ledgerSchema.$defs?.SchemaVersion?.const === expected,
            `workflow ledger schema: HARDENING_ONLY const schemaVersion differs`,
          );
        } else {
          assert(hardeningBranch.properties?.[key]?.const === expected, `workflow ledger schema: HARDENING_ONLY const ${key} differs`);
        }
      }
    }
    const distributionBranch = findSchemaBranchByConst(ledgerSchema, "transitionType", "REVIEW_ROUND_DISTRIBUTION_AUTHORIZED");
    assert(Boolean(distributionBranch), `workflow ledger schema: pre-distribution authorization transition missing`);
    if (distributionBranch) {
      assert(distributionBranch.properties?.stateBefore?.const === "PENDING_HUMAN_RESPONSES", `workflow ledger schema: pre-distribution stateBefore differs`);
      assert(distributionBranch.properties?.stateAfter?.const === "PENDING_HUMAN_RESPONSES", `workflow ledger schema: pre-distribution must not advance state`);
      assert(distributionBranch.properties?.collectionAuthorized?.const === true, `workflow ledger schema: pre-distribution collection authorization missing`);
      assert(distributionBranch.properties?.distributionAuthorized?.const === true, `workflow ledger schema: pre-distribution distribution authorization missing`);
      assert(distributionBranch.properties?.humanResponseEvidencePresent?.const === false, `workflow ledger schema: pre-distribution cannot claim response evidence`);
    }
    const invalidation = ledgerSchema.$defs?.Invalidation;
    assert(invalidation?.properties?.invalidationGate?.$ref === "#/$defs/InvalidationGate", `workflow ledger schema: fail-safe invalidation gate missing`);
    assert(!(invalidation?.required ?? []).includes("transitionGate"), `workflow ledger schema: invalidation must not require the normal authorization gate`);
    const approvalQuorum = ledgerSchema.$defs?.ApprovalQuorum;
    assert(approvalQuorum?.properties?.quorumPolicyReference?.$ref === "#/$defs/EvidenceReference", `workflow ledger schema: versioned quorum policy reference missing`);
    assert(!Object.hasOwn(approvalQuorum?.properties ?? {}, "requiredApprovals"), `workflow ledger schema: unchecked quorum count claim forbidden`);
    const expectedQuorumTypes = new Map([
      ["REVIEW_ROUND_DISTRIBUTION_AUTHORIZED", "DISTRIBUTION_AUTHORIZATION"],
      ["HUMAN_RESPONSES_FROZEN", "REVIEW_FREEZE"],
      ["ADJUDICATION_COMPLETED", "ADJUDICATION"],
      ["GOLDEN_CANDIDATE_ASSEMBLED", "GOVERNANCE_PROMOTION"],
      ["GOLDEN_GOVERNANCE_APPROVED", "GOVERNANCE_PROMOTION"],
    ]);
    for (const [transitionType, quorumType] of expectedQuorumTypes) {
      const branch = findSchemaBranchByConst(ledgerSchema, "transitionType", transitionType);
      assert(
        branch?.properties?.transitionGate?.properties?.approvalQuorum?.properties?.quorumType?.const === quorumType,
        `workflow ledger schema: ${transitionType} must bind quorum type ${quorumType}`,
      );
    }
  }

  const allAuthorizationsFalse = baseline
    && [
      "collectionAuthorized",
      "distributionAuthorized",
      "providerAuthorized",
      "goldenPromotionAuthorized",
      "adjudicationAuthorized",
      "retryAuthorized",
    ].every((key) => baseline[key] === false);
  console.log(`ledger_records=${records.length}`);
  console.log(`ledger_record_type=${baseline?.recordType ?? "INVALID"}`);
  console.log(`ledger_state=${baseline?.stateAfter ?? "INVALID"}`);
  console.log(`ledger_all_authorizations_false=${allAuthorizationsFalse ? "YES" : "NO"}`);
  const ledgerHash = sha256Bytes(bytes);
  console.log(`ledger_file_sha256=${ledgerHash}`);
  console.log(`baseline_ledger_unchanged=${ledgerHash === PROTECTED_HASHES.get(LEDGER_PATH) ? "YES" : "NO"}`);
}

function assertTokens(path, tokens) {
  const text = readText(path);
  for (const token of tokens) {
    assert(text.includes(token), `${path}: required coherence token ${token} missing`);
  }
}

function validateDocumentCoherence() {
  const errorCountBefore = errors.length;
  const statusDocs = [
    "policies/ai-mapping-human-review-hardening-record-042a2.md",
    "evals/mapping/README.md",
    "evals/mapping/reviews/042a2/reviewer-instructions-v1.md",
    "runbooks/ai-mapping-human-review-coordinator-042a2.md",
  ];
  for (const path of statusDocs) {
    assertTokens(path, [...GOVERNANCE_STATUSES, NON_VALIDATION_WORDING]);
  }

  const stateDocs = [
    "policies/ai-mapping-human-review-hardening-record-042a2.md",
    "policies/ai-mapping-annotation-guide-042a2.md",
    "policies/ai-mapping-business-evaluation-protocol-042a2.md",
    CURRENT_SPEC_042_BACKLOG_PATH,
    "docs/product/v1-plan.md",
    "evals/mapping/README.md",
    "runbooks/ai-mapping-human-review-coordinator-042a2.md",
  ];
  for (const path of stateDocs) {
    assertTokens(path, ["042a2a6a", "PENDING_HUMAN_RESPONSES"]);
  }

  const gateDocs = [
    "policies/ai-mapping-human-review-hardening-record-042a2.md",
    CURRENT_SPEC_042_BACKLOG_PATH,
    "docs/product/v1-plan.md",
    "evals/mapping/README.md",
    "runbooks/ai-mapping-human-review-coordinator-042a2.md",
  ];
  for (const path of gateDocs) {
    assertTokens(path, ["REQUIRED_BEFORE_MERGE", "REQUIRED_BEFORE_DISTRIBUTION", "STOP_DEPENDENCY_REQUIRED"]);
  }

  const authDocs = [
    "policies/ai-mapping-human-review-hardening-record-042a2.md",
    "policies/ai-mapping-annotation-guide-042a2.md",
    CURRENT_SPEC_042_BACKLOG_PATH,
  ];
  const authTokens = [
    "collectionAuthorized=false",
    "distributionAuthorized=false",
    "providerAuthorized=false",
    "goldenPromotionAuthorized=false",
    "adjudicationAuthorized=false",
    "retryAuthorized=false",
  ];
  for (const path of authDocs) assertTokens(path, authTokens);

  assertTokens(CURRENT_SPEC_042_BACKLOG_PATH, [
    "### Protocole documentaire 042a2a6 - revue humaine et adjudication",
    "### Kit de hardening 042a2a6a - gouvernance de revue humaine",
    "PAUSED_BY_SEPARATE_CPO_DECISION",
    "provider_runtime=STILL_BLOCKED",
    "adapter_provider=NOT_AUTHORIZED",
    "retry_remaining=0",
    "fallback=FORBIDDEN",
  ]);
  assertTokens("docs/product/v1-plan.md", [
    "`042a2a6` formalise uniquement le protocole DOCS_ONLY",
    "`042a2a6a` durcit distinctement ce protocole",
    "provider_runtime=STILL_BLOCKED",
    "adapter_provider=NOT_AUTHORIZED",
    "retry_remaining=0",
    "fallback=FORBIDDEN",
  ]);
  assertTokens("evals/mapping/README.md", [
    "spec `042` est en backlog",
    "spec `043` est active",
    "provider_runtime=STILL_BLOCKED",
    "adapter_provider=NOT_AUTHORIZED",
    "retry_remaining=0",
    "fallback=FORBIDDEN",
  ]);
  assertTokens("policies/ai-mapping-pilot-scope-manifest-042a2.md", [
    CURRENT_SPEC_042_BACKLOG_PATH,
    CURRENT_SPEC_043_ACTIVE_PATH,
  ]);

  const reviewerInstructionsPath = "evals/mapping/reviews/042a2/reviewer-instructions-v1.md";
  const reviewerInstructions = readText(reviewerInstructionsPath);
  const decisionTreeStart = reviewerInstructions.indexOf("## Decision tree");
  const decisionTreeEnd = reviewerInstructions.indexOf("## Outcome matrix", decisionTreeStart + 1);
  assert(decisionTreeStart >= 0 && decisionTreeEnd > decisionTreeStart, `${reviewerInstructionsPath}: bounded decision-tree section missing`);
  const decisionTree = reviewerInstructions.slice(decisionTreeStart, decisionTreeEnd);
  const gateSeparationIndex = decisionTree.indexOf(FAIL_CLOSED_GATE_SEPARATION);
  const gatePrefixIndex = decisionTree.indexOf(FIDUCIARY_GATE_PREFIX);
  const outOfScopeIndex = decisionTree.indexOf("OUT_OF_SCOPE");
  const fiduciaryGatePrefixPass = gateSeparationIndex >= 0
    && gatePrefixIndex > gateSeparationIndex
    && outOfScopeIndex > gatePrefixIndex;
  assert(fiduciaryGatePrefixPass, `${reviewerInstructionsPath}: fail-closed gate prefix must precede the semantic branch`);
  const orderedDecisionTokens = [
    "OUT_OF_SCOPE",
    "CONFLICTING_SIGNALS",
    "INSUFFICIENT_EVIDENCE",
    "Calcul des cibles admissibles",
    "TAXONOMY_GAP",
    "AMBIGUOUS_TARGET",
    "SUGGESTION",
  ];
  let previousIndex = -1;
  let decisionOrderPass = true;
  for (const token of orderedDecisionTokens) {
    const index = decisionTree.indexOf(token, previousIndex + 1);
    if (index <= previousIndex) decisionOrderPass = false;
    assert(index > previousIndex, `${reviewerInstructionsPath}: decision-tree token ${token} is missing or out of order`);
    previousIndex = index;
  }
  const decisionTreeLines = decisionTree.split(/\r?\n/);
  const targetCalculationLineIndex = decisionTreeLines.findIndex((line) => line.includes("Calcul des cibles admissibles"));
  const zeroTargetLineIndex = decisionTreeLines.findIndex((line) =>
    line.includes("Zero admissible targets") && line.includes("ABSTENTION / TAXONOMY_GAP"));
  const multipleTargetsLineIndex = decisionTreeLines.findIndex((line) =>
    line.includes("Two or more admissible targets") && line.includes("ABSTENTION / AMBIGUOUS_TARGET"));
  const oneTargetLineIndex = decisionTreeLines.findIndex((line) =>
    line.includes("Exactly one admissible target") && line.includes("SUGGESTION"));
  const targetCardinalityMappingsPass = targetCalculationLineIndex >= 0
    && zeroTargetLineIndex > targetCalculationLineIndex
    && multipleTargetsLineIndex > zeroTargetLineIndex
    && oneTargetLineIndex > multipleTargetsLineIndex;
  assert(targetCardinalityMappingsPass, `${reviewerInstructionsPath}: zero, multiple and single admissible-target mappings must be explicit and ordered`);
  const zeroTargetTaxonomyGapPass = decisionOrderPass
    && targetCardinalityMappingsPass
    && decisionTree.includes(TAXONOMY_GAP_BOUNDARY);
  assert(zeroTargetTaxonomyGapPass, `${reviewerInstructionsPath}: zero-target TAXONOMY_GAP doctrine missing`);
  const responseSchema = parsedSchemas.get("evals/mapping/reviews/042a2/reviewer-response-schema-v2.json");
  const ambiguousTargetEvidenceState = responseSchema?.$defs?.AmbiguousTargetAbstention?.properties?.evidenceState;
  const ambiguousTargetSufficientMeaningPass = decisionTree.includes(AMBIGUOUS_TARGET_SUFFICIENT_MEANING)
    && decisionTree.includes("`CONFLICTING` is not allowed in the `AMBIGUOUS_TARGET` branch")
    && ambiguousTargetEvidenceState?.description === AMBIGUOUS_TARGET_SUFFICIENT_MEANING
    && ambiguousTargetEvidenceState?.const === "SUFFICIENT"
    && !Object.hasOwn(ambiguousTargetEvidenceState ?? {}, "enum");
  assert(ambiguousTargetSufficientMeaningPass, `${reviewerInstructionsPath}: AMBIGUOUS_TARGET SUFFICIENT meaning differs between instructions and schema`);
  console.log(`fiduciary_gate_prefix=${fiduciaryGatePrefixPass ? "PASS" : "FAIL"}`);
  console.log(`zero_target_taxonomy_gap=${zeroTargetTaxonomyGapPass ? "PASS" : "FAIL"}`);
  console.log(`ambiguous_target_sufficient_meaning=${ambiguousTargetSufficientMeaningPass ? "PASS" : "FAIL"}`);
  assertTokens(reviewerInstructionsPath, [
    FREE_TEXT_DATA_DOCTRINE,
    "`AMBIGUOUS_TARGET` | `SUFFICIENT` uniquement",
    "`STALE_IMPORT` | `STALE_PRECONDITION`",
    "`ACCOUNT_ALREADY_AFFECTED`, `ACCOUNT_NOT_IN_LATEST_IMPORT`, `NOT_ELIGIBLE` | `PRECONDITION_NOT_MET`",
  ]);

  const coordinatorBoundaryDocs = [
    "policies/ai-mapping-annotation-guide-042a2.md",
    "policies/ai-mapping-business-evaluation-protocol-042a2.md",
    "policies/ai-mapping-human-review-hardening-record-042a2.md",
    "runbooks/ai-mapping-human-review-coordinator-042a2.md",
  ];
  for (const path of coordinatorBoundaryDocs) assertTokens(path, [COORDINATOR_LIMIT_WORDING]);

  const custodyDocs = [
    "policies/ai-mapping-annotation-guide-042a2.md",
    "policies/ai-mapping-business-evaluation-protocol-042a2.md",
    "policies/ai-mapping-human-review-hardening-record-042a2.md",
    "runbooks/ai-mapping-human-review-coordinator-042a2.md",
  ];
  for (const path of custodyDocs) {
    assertTokens(path, [
      "Aucune réponse humaine n’est destinée à Git",
      "données personnelles pseudonymisées, non anonymes",
      "custodyReference",
      "REQUIRED_BEFORE_DISTRIBUTION",
      "automatically and randomly",
      "Real storage, jurisdiction, ACL, retention and deletion",
      "No operational",
      "fail-closed",
    ]);
  }

  for (const path of [
    "policies/ai-mapping-human-review-hardening-record-042a2.md",
    "runbooks/ai-mapping-human-review-coordinator-042a2.md",
  ]) {
    assertTokens(path, [LEDGER_LIMIT_WORDING, LEDGER_ANCHOR_WORDING]);
  }

  for (const path of [
    "policies/ai-mapping-human-review-hardening-record-042a2.md",
    "evals/mapping/README.md",
    CURRENT_SPEC_042_BACKLOG_PATH,
    "docs/product/v1-plan.md",
  ]) {
    assertTokens(path, [
      PR99_TECHNICAL_RATIFICATION,
      PR99_SECURITY_RATIFICATION,
      "corrective diff Security/Privacy review = REQUIRED_BEFORE_MERGE",
      "IA Governance / fiduciary review of D/E/F = REQUIRED_BEFORE_MERGE",
      "operational Security/Privacy confirmation = REQUIRED_BEFORE_DISTRIBUTION",
    ]);
  }

  for (const path of CURRENT_GOVERNANCE_FILE_SET) {
    assert(!readText(path).includes(FORBIDDEN_VALIDATION_CLAIM), `${path}: forbidden validation claim present`);
  }
  const coherent = errors.length === errorCountBefore;
  console.log(`docs_policy_spec_readme_runbook_coherent=${coherent ? "YES" : "NO"}`);
  console.log(`subdeliverables_042a2a6_and_042a2a6a_distinct=${coherent ? "YES" : "NO"}`);
}

function normalizeSearchText(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replaceAll("’", "'")
    .replace(/[`*_#|]/g, " ")
    .replace(/[–—]/g, "-")
    .replace(/[ \t]+/g, " ")
    .toLowerCase();
}

function validateRoadmap() {
  const roadmapFilePresent = pathExists(ROADMAP_PATH);
  assert(roadmapFilePresent, `${ROADMAP_PATH}: canonical product roadmap missing`);
  console.log(`roadmap_file_present=${roadmapFilePresent ? "YES" : "NO"}`);
  if (!roadmapFilePresent) {
    console.log("roadmap_six_workstreams=NO");
    console.log("roadmap_mcp_m0_to_m5=NO");
    console.log("roadmap_no_automatic_specs=NO");
    console.log("roadmap_no_invented_dates=NO");
    return;
  }

  const rawRoadmap = readText(ROADMAP_PATH);
  const roadmap = normalizeSearchText(rawRoadmap);
  const lines = roadmap.split(/\r?\n/);
  const requiredWorkstreams = [
    "produit fiduciaire",
    "saas & identite",
    "trust & operations",
    "go-to-market",
    "ia-native",
    "agent platform & mcp",
  ];
  const sixWorkstreamsPresent = requiredWorkstreams.every((workstream) => roadmap.includes(workstream));
  assert(sixWorkstreamsPresent, `${ROADMAP_PATH}: the six canonical workstreams are not all present`);

  const requiredMcpMaturities = [
    ["m0", "capability catalog"],
    ["m1", "mcp local read-only"],
    ["m2", "copilot ritomer read-only"],
    ["m3", "outils de brouillon"],
    ["m4", "mcp distant prive"],
    ["m5", "workflows agentiques controles"],
  ];
  const mcpM0ToM5Present = requiredMcpMaturities.every(([level, label]) =>
    lines.some((line) => line.includes(level) && line.includes(label)),
  );
  assert(mcpM0ToM5Present, `${ROADMAP_PATH}: MCP maturity M0 through M5 is incomplete`);

  const noAutomaticSuccessor = lines.some((line) =>
    line.includes("aucune spec") && line.includes("automati"),
  );
  const noCommitted044Plus = lines.some((line) =>
    line.includes("aucune spec")
      && line.includes("044")
      && (line.includes("cree") || line.includes("engag")),
  );
  const futurePortfolioCandidateOnly = lines.some((line) =>
    line.includes("spec") && line.includes("candidate") && line.includes("future"),
  );
  const noAutomaticSpecs = noAutomaticSuccessor && noCommitted044Plus && futurePortfolioCandidateOnly;
  assert(noAutomaticSpecs, `${ROADMAP_PATH}: future specs must remain candidates with no automatic or committed 044+ spec`);

  const noCalendarYear = !/\b20\d{2}\b/.test(roadmap);
  const explicitNoInventedPlanning = lines.some((line) =>
    line.includes("aucune date")
      && line.includes("capacite")
      && line.includes("promesse commerciale"),
  );
  const noInventedDates = noCalendarYear && explicitNoInventedPlanning;
  assert(noInventedDates, `${ROADMAP_PATH}: roadmap contains a calendar year or omits the no-invented-planning commitment`);

  console.log(`roadmap_six_workstreams=${sixWorkstreamsPresent ? "YES" : "NO"}`);
  console.log(`roadmap_mcp_m0_to_m5=${mcpM0ToM5Present ? "YES" : "NO"}`);
  console.log(`roadmap_no_automatic_specs=${noAutomaticSpecs ? "YES" : "NO"}`);
  console.log(`roadmap_no_invented_dates=${noInventedDates ? "YES" : "NO"}`);
}

function trackedPaths() {
  if (contentCommit !== undefined) return commitTreePaths(contentCommit);
  return gitOutput(["ls-files", "-z"])
    .split("\0")
    .filter(Boolean)
    .map(normalizePath)
    .sort();
}

function worktreeVisiblePaths() {
  if (contentCommit !== undefined) return commitTreePaths(contentCommit);
  return gitOutput(["ls-files", "-z", "--cached", "--others", "--exclude-standard"])
    .split("\0")
    .filter(Boolean)
    .map(normalizePath)
    .filter((path) => existsSync(absolutePath(path)))
    .sort();
}

function inspectJsonObjectForHumanInstance(node, findings) {
  if (!node || typeof node !== "object") return;
  if (!Array.isArray(node)) {
    if (typeof node.schemaVersion === "string" && HUMAN_INSTANCE_SCHEMA_VERSIONS.has(node.schemaVersion)) {
      findings.add("human_instance_schema_version");
    }
    for (const signature of HUMAN_INSTANCE_STRUCTURAL_SIGNATURES) {
      if (signature.every((propertyName) => Object.hasOwn(node, propertyName))) {
        findings.add(`human_instance_signature_${signature.join("+")}`);
      }
    }
  }
  const values = Array.isArray(node) ? node : Object.values(node);
  for (const value of values) {
    if (value && typeof value === "object") {
      inspectJsonObjectForHumanInstance(value, findings);
    }
  }
}

function validateNoRealInstances() {
  const errorCountBefore = errors.length;
  const tracked = trackedPaths();
  const visible = worktreeVisiblePaths();
  const reviewPrefix = "evals/mapping/reviews/042a2/";
  const actualNames = tracked
    .filter((path) => path.startsWith(reviewPrefix) && !path.slice(reviewPrefix.length).includes("/"))
    .map((path) => path.slice(reviewPrefix.length))
    .sort();
  assert(sameArray(actualNames, EXPECTED_REVIEW_DIRECTORY), `tracked reviews/042a2 inventory contains a missing or unauthorized instance`);

  const promoted042a2 = tracked.filter((path) => /042a2.*golden|golden.*042a2/i.test(path));
  assert(promoted042a2.length === 0, `a tracked 042a2 golden artifact exists unexpectedly`);

  const spec042Backlog = visible.filter((path) => /^specs\/backlog\/042(?:[-_.]|$)/i.test(path));
  const spec042ActiveOrDone = visible.filter((path) => /^specs\/(?:active|done)\/042(?:[-_.]|$)/i.test(path));
  const spec043Active = visible.filter((path) => /^specs\/active\/043(?:[-_.]|$)/i.test(path));
  const spec043OutsideActive = visible.filter((path) => /^specs\/(?:backlog|done)\/043(?:[-_.]|$)/i.test(path));
  const spec042BacklogValid = spec042Backlog.length === 1 && spec042Backlog[0] === CURRENT_SPEC_042_BACKLOG_PATH;
  const spec042ActiveOrDoneValid = spec042ActiveOrDone.length === 0;
  const spec043ActiveValid = spec043Active.length === 1 && spec043Active[0] === CURRENT_SPEC_043_ACTIVE_PATH;
  const spec043OutsideActiveValid = spec043OutsideActive.length === 0;
  assert(spec042BacklogValid, `current lifecycle must contain exactly one backlog spec 042 at the canonical path`);
  assert(spec042ActiveOrDoneValid, `current lifecycle must contain no active or done spec 042`);
  assert(spec043ActiveValid, `current lifecycle must contain exactly one active spec 043 at the canonical path`);
  assert(spec043OutsideActiveValid, `current lifecycle must contain no backlog or done spec 043`);

  const humanFilenamePattern = /(?:reviewer|human-review).*(?:response|attestation)|(?:response|attestation).*(?:reviewer|human-review)|(?:review|human).*(?:freeze|clarification)|(?:freeze|clarification).*(?:review|human)|participant.*registry|registry.*participant|adjudication.*dossier|dossier.*adjudication|review-round.*manifest|manifest.*review-round/i;
  for (const path of tracked) {
    if (/(^|\/)\.env(?:\.|$)/i.test(path)) continue;
    if (path.endsWith(".jsonl") && path !== LEDGER_PATH) {
      addError(`${path}:unauthorized_jsonl_outside_hardening_baseline`);
    }
    if (DOCUMENTARY_HUMAN_REVIEW_ALLOWLIST.has(path)) continue;
    if (humanFilenamePattern.test(path)) {
      addError(`${path}:human_instance_filename_not_allowlisted`);
    }
    if (!path.endsWith(".json")) continue;
    try {
      const json = JSON.parse(readText(path).replace(/^\uFEFF/, ""));
      const findings = new Set();
      inspectJsonObjectForHumanInstance(json, findings);
      for (const category of findings) addError(`${path}:${category}`);
    } catch (error) {
      addError(`${path}:tracked_json_could_not_be_inspected_${error.name}`);
    }
  }

  const noHumanInstanceFinding = errors.length === errorCountBefore;
  const humanCount = noHumanInstanceFinding ? "0" : "NONZERO_OR_UNINSPECTED";
  console.log(`human_response_instances=${humanCount}`);
  console.log(`participant_registry_instances=${humanCount}`);
  console.log(`attestation_instances=${humanCount}`);
  console.log(`freeze_instances=${humanCount}`);
  console.log(`clarification_instances=${humanCount}`);
  console.log(`adjudication_instances=${humanCount}`);
  console.log(`golden_set_042a2_instances=${promoted042a2.length}`);
  console.log(`spec_042_backlog_instances=${spec042Backlog.length}`);
  console.log(`spec_042_active_or_done_instances=${spec042ActiveOrDone.length}`);
  console.log(`spec_043_active_instances=${spec043Active.length}`);
  console.log(`spec_043_outside_active_instances=${spec043OutsideActive.length}`);
  console.log(`spec_043_instances=${spec043Active.length + spec043OutsideActive.length}`);
  console.log(`042_backlog_only=${spec042BacklogValid && spec042ActiveOrDoneValid ? "YES" : "NO"}`);
  console.log(`043_active_only=${spec043ActiveValid && spec043OutsideActiveValid ? "YES" : "NO"}`);
  console.log(contentCommit === undefined
    ? "spec_lifecycle_scope=WORKTREE_VISIBLE_TRACKED_AND_UNTRACKED"
    : "spec_lifecycle_scope=HEAD_COMMIT_TRACKED_ONLY");
  console.log(contentCommit === undefined
    ? "repo_wide_human_instance_scope=GIT_TRACKED_FILES_ONLY"
    : "repo_wide_human_instance_scope=HEAD_COMMIT_TRACKED_ONLY");
}

function parseAddedLinesFromUnifiedDiff(diff) {
  const lines = [];
  let currentPath;
  let currentLine = 0;
  for (const rawLine of diff.split("\n")) {
    if (rawLine.startsWith("diff --git ")) {
      currentPath = undefined;
      currentLine = 0;
      continue;
    }
    if (rawLine.startsWith("+++ b/")) {
      currentPath = normalizePath(rawLine.slice(6));
      continue;
    }
    if (rawLine === "+++ /dev/null") {
      currentPath = undefined;
      continue;
    }
    if (rawLine.startsWith("@@")) {
      const match = rawLine.match(/\+(\d+)(?:,(\d+))?/);
      currentLine = match ? Number(match[1]) : 0;
      continue;
    }
    if (rawLine.startsWith("+") && !rawLine.startsWith("+++")) {
      if (currentPath !== undefined) {
        lines.push({ path: currentPath, line: currentLine, text: rawLine.slice(1) });
      }
      currentLine += 1;
    } else if (rawLine.startsWith(" ")) {
      currentLine += 1;
    }
  }
  return lines;
}

function currentUntrackedPaths() {
  return gitOutput(["ls-files", "-z", "--others", "--exclude-standard"])
    .split("\0")
    .filter(Boolean)
    .map(normalizePath)
    .filter((path) => CURRENT_043A_ALLOWED_FILE_SET.includes(path))
    .filter((path) => existsSync(absolutePath(path)))
    .sort();
}

function addedLinesComparedToPrevious(currentPath, previousText) {
  const previousLineCounts = new Map();
  for (const line of previousText.split(/\r?\n/)) {
    previousLineCounts.set(line, (previousLineCounts.get(line) ?? 0) + 1);
  }

  const added = [];
  const currentLines = readText(currentPath).split(/\r?\n/);
  currentLines.forEach((line, index) => {
    const previousCount = previousLineCounts.get(line) ?? 0;
    if (previousCount > 0) {
      previousLineCounts.set(line, previousCount - 1);
    } else {
      added.push({ path: currentPath, line: index + 1, text: line });
    }
  });
  return added;
}

function addedLinesForCurrentPaths(paths) {
  const lines = parseAddedLinesFromUnifiedDiff(gitOutput([
    "diff",
    "--no-ext-diff",
    "--unified=0",
    "--no-color",
    "--find-renames",
    "HEAD",
    "--",
    ...paths,
  ]));
  const allowed = new Set(paths);
  const untracked = gitOutput(["ls-files", "-z", "--others", "--exclude-standard"])
    .split("\0")
    .filter(Boolean)
    .map(normalizePath)
    .filter((path) => allowed.has(path) && existsSync(absolutePath(path)))
    .sort();
  for (const path of untracked) {
    readText(path).split(/\r?\n/).forEach((text, index) => {
      lines.push({ path, line: index + 1, text });
    });
  }
  return lines;
}

function addedLinesForScan(range) {
  const diffArgs = range.mode === "HISTORICAL"
    ? ["diff", "--unified=0", "--no-color", `${range.base}..${range.head}`, "--", ...EXACT_ALLOWED_FILE_SET]
    : ["diff", "--no-ext-diff", "--unified=0", "--no-color", "--find-renames", "HEAD", "--", ...CURRENT_043A_ALLOWED_FILE_SET];
  const lines = parseAddedLinesFromUnifiedDiff(gitOutput(diffArgs));
  if (range.mode === "HISTORICAL") return lines;

  for (const path of currentUntrackedPaths()) {
    if (path === CURRENT_SPEC_042_BACKLOG_PATH) {
      const previousText = gitOutput(["show", `HEAD:${HISTORICAL_SPEC_042_ACTIVE_PATH}`]);
      lines.push(...addedLinesComparedToPrevious(path, previousText));
    } else {
      readText(path).split(/\r?\n/).forEach((text, index) => {
        lines.push({ path, line: index + 1, text });
      });
    }
  }
  return lines;
}

function validateAddedLineHygiene(range) {
  const secretPatterns = [
    { category: "provider_key_variable", regex: new RegExp("OPENAI" + "_API" + "_KEY", "i") },
    { category: "bearer_header", regex: new RegExp("Authorization" + ":\\s*Bearer", "i") },
    { category: "provider_key_prefix", regex: new RegExp("sk" + "-proj-") },
    { category: "private_key_block", regex: new RegExp("BEGIN" + " PRIVATE" + " KEY", "i") },
    { category: "slack_token_prefix", regex: new RegExp("xox" + "b-") },
    { category: "github_token_prefix", regex: new RegExp("gh" + "p_") },
    { category: "github_personal_token_prefix", regex: new RegExp("github" + "_pat_") },
  ];
  const emailPattern = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
  const privateLocationPatterns = [
    new RegExp("[A-Za-z]:" + "\\\\(?:Users|Documents and Settings)\\\\", "i"),
    /(?:^|[\s"'])\/(?:home|Users)\/[^\s"']+/i,
    /(?:^|[\s"'])\\\\[A-Za-z0-9._$-]+\\[A-Za-z0-9._$-]+(?:\\|[\s"']|$)/,
    new RegExp("file" + ":\\/\\/", "i"),
  ];
  const urlPattern = /\b[A-Za-z][A-Za-z0-9+.-]*:\/\/[^\s"')]+/g;
  const schemeRelativeLocatorPattern = /(?:^|[\s"'(])\/\/[A-Za-z0-9._$-]+\/[A-Za-z0-9._$/-]+/g;
  const allowedPublicUrl = "https://json-schema.org/draft/2020-12/schema";
  let secretFindings = 0;
  let personalDataFindings = 0;
  let privateLocationFindings = 0;

  for (const added of addedLinesForScan(range)) {
    const normalizedEscapes = added.text.replaceAll("\\/", "/").replaceAll("\\\\", "\\");
    for (const pattern of secretPatterns) {
      if (pattern.regex.test(added.text)) {
        secretFindings += 1;
        addError(`${added.path}:${added.line}:${pattern.category}`);
      }
    }
    if (emailPattern.test(added.text)) {
      personalDataFindings += 1;
      addError(`${added.path}:${added.line}:personal_email_value`);
    }
    const locationScanVariants = [added.text, normalizedEscapes];
    let privateLocationFound = false;
    for (const locationScanText of locationScanVariants) {
      for (const privateLocationPattern of privateLocationPatterns) {
        if (privateLocationPattern.test(locationScanText)) {
          privateLocationFindings += 1;
          addError(`${added.path}:${added.line}:private_path_or_locator`);
          privateLocationFound = true;
          break;
        }
      }
      if (privateLocationFound) break;
    }
    const urls = new Set([
      ...(added.text.match(urlPattern) ?? []),
      ...(normalizedEscapes.match(urlPattern) ?? []),
    ]);
    for (const url of urls) {
      if (url !== allowedPublicUrl) {
        privateLocationFindings += 1;
        addError(`${added.path}:${added.line}:non_whitelisted_url`);
      }
    }
    const schemeRelativeLocators = new Set([
      ...(added.text.match(schemeRelativeLocatorPattern) ?? []),
      ...(normalizedEscapes.match(schemeRelativeLocatorPattern) ?? []),
    ]);
    for (const ignoredLocatorValue of schemeRelativeLocators) {
      void ignoredLocatorValue;
      privateLocationFindings += 1;
      addError(`${added.path}:${added.line}:network_locator`);
    }
  }

  const validatorSource = readText("evals/mapping/validate-042a2-human-review-governance-kit.mjs");
  assert(!/\bfetch\s*\(|from\s+["']node:(?:http|https|net|tls)["']/.test(validatorSource), `structural checker must not contain network code`);

  console.log(`added_line_hygiene_scope=${range.mode === "HISTORICAL" ? "BASE_TO_HEAD" : "HEAD_TO_WORKTREE"}`);
  console.log(`no_secret_value_added=${secretFindings === 0 ? "YES" : "NO"}`);
  console.log(`no_personal_data_instance_added=${personalDataFindings === 0 ? "YES" : "NO"}`);
  console.log(`no_personal_data_added=${personalDataFindings === 0 ? "YES" : "NO"}`);
  console.log(`no_private_path_or_url_added=${privateLocationFindings === 0 ? "YES" : "NO"}`);
}

function main() {
  const range = parseCliArgs(process.argv.slice(2));
  if (range.mode === "INVALID") return;
  contentCommit = range.mode === "HISTORICAL_043B"
    || range.mode === "HISTORICAL_043B_HOTFIX"
    || range.mode === "HISTORICAL_043C_PREPARATION"
    || range.mode === "HISTORICAL_043C_TRANSITION"
    ? range.head
    : undefined;
  const historicalVerification = validateExactFileSet(range);
  if (range.mode === "WORKTREE"
    && historicalVerification?.worktreeProfile === WORKTREE_PROFILES.CLEAN
    && pathExists(CONTROLLED_043C_VALIDATOR_PATH)) {
    Object.assign(
      historicalVerification,
      validate043cGenericContent({ executeSelfTest: true }),
    );
  }
  validateProtectedHashesAndCases();
  validateSchemas();
  validateLedger();
  validateDocumentCoherence();
  validateRoadmap();
  validateNoRealInstances();
  if (range.mode !== "HISTORICAL_043B"
    && range.mode !== "HISTORICAL_043B_HOTFIX"
    && range.mode !== "HISTORICAL_043C_PREPARATION"
    && range.mode !== "HISTORICAL_043C_TRANSITION"
    && historicalVerification?.worktreeProfile !== WORKTREE_PROFILES.HOTFIX_043B
    && historicalVerification?.worktreeProfile !== WORKTREE_PROFILES.PREPARATORY_043C
    && historicalVerification?.worktreeProfile !== WORKTREE_PROFILES.DURABLE_TRANSITION_043C) {
    validateAddedLineHygiene(range);
  }
  return historicalVerification;
}

function bufferedSuccessLines(bufferedOutput, failures) {
  return failures.length === 0 ? [...bufferedOutput] : [];
}

function failureOnlyLine(value) {
  return String(value).replace(/PASS/gi, "POSITIVE_VERDICT");
}

function runCli() {
  const bufferedOutput = [];
  const originalConsoleLog = console.log;
  console.log = (...values) => bufferedOutput.push(values.join(" "));

  let verification;
  try {
    verification = main();
  } catch (error) {
    addError(`validator_internal_error:${error.name}`);
  } finally {
    console.log = originalConsoleLog;
  }

  const is043bWorktree = verification?.worktreeProfile === WORKTREE_PROFILES.HARNESS_043B;
  const is043bHotfixWorktree = verification?.worktreeProfile === WORKTREE_PROFILES.HOTFIX_043B;
  const is043cPreparatoryWorktree = verification?.worktreeProfile
    === WORKTREE_PROFILES.PREPARATORY_043C;
  const is043cDurableTransitionWorktree = verification?.worktreeProfile
    === WORKTREE_PROFILES.DURABLE_TRANSITION_043C;
  const is043bHistorical = verification?.historicalProfile === "043b";
  const is043bHotfixHistorical = verification?.historicalProfile === "043b-hotfix";
  const is043cPreparatoryHistorical = verification?.historicalProfile === "043c-preparation";
  const is043cDurableTransitionHistorical = verification?.historicalProfile
    === "043c-transition";
  if (is043bWorktree) {
    const evidenceValues = Object.entries(verification)
      .filter(([key]) => key !== "worktreeProfile")
      .map(([, value]) => value);
    assert(evidenceValues.length > 0 && evidenceValues.every((value) => value === true), `043b worktree evidence is incomplete`);
  }
  if (is043bHistorical) {
    const evidenceValues = Object.entries(verification)
      .filter(([key]) => key !== "historicalProfile")
      .map(([, value]) => value);
    assert(evidenceValues.length > 0 && evidenceValues.every((value) => value === true), `043b historical evidence is incomplete`);
  }
  if (is043bHotfixWorktree) {
    const evidenceValues = Object.entries(verification)
      .filter(([key]) => key !== "worktreeProfile")
      .map(([, value]) => value);
    assert(evidenceValues.length > 0 && evidenceValues.every((value) => value === true), `043b-hotfix worktree evidence is incomplete`);
  }
  if (is043bHotfixHistorical) {
    const evidenceValues = Object.entries(verification)
      .filter(([key]) => key !== "historicalProfile")
      .map(([, value]) => value);
    assert(evidenceValues.length > 0 && evidenceValues.every((value) => value === true), `043b-hotfix historical evidence is incomplete`);
  }
  if (is043cPreparatoryWorktree) {
    const evidenceValues = Object.entries(verification)
      .filter(([key]) => key !== "worktreeProfile")
      .map(([, value]) => value);
    assert(
      evidenceValues.length > 0 && evidenceValues.every((value) => value === true),
      "043c-preparation worktree evidence is incomplete",
    );
  }
  if (is043cPreparatoryHistorical) {
    const evidenceValues = Object.entries(verification)
      .filter(([key]) => key !== "historicalProfile")
      .map(([, value]) => value);
    assert(
      evidenceValues.length > 0 && evidenceValues.every((value) => value === true),
      "043c-preparation historical evidence is incomplete",
    );
  }
  if (is043cDurableTransitionWorktree) {
    const evidenceValues = Object.entries(verification)
      .filter(([key]) => key !== "worktreeProfile")
      .map(([, value]) => value);
    assert(
      evidenceValues.length > 0 && evidenceValues.every((value) => value === true),
      "043c durable transition worktree evidence is incomplete",
    );
  }
  if (is043cDurableTransitionHistorical) {
    const evidenceValues = Object.entries(verification)
      .filter(([key]) => key !== "historicalProfile")
      .map(([, value]) => value);
    assert(
      evidenceValues.length > 0 && evidenceValues.every((value) => value === true),
      "043c durable transition historical evidence is incomplete",
    );
  }

  if (errors.length > 0) {
    console.error(`governance_kit_errors=${errors.length}`);
    errors.forEach((error) => console.error(failureOnlyLine(error)));
    process.exitCode = 1;
  } else {
    bufferedSuccessLines(bufferedOutput, errors).forEach((line) => console.log(line));
    if (is043bHotfixWorktree) {
      console.log("validation_mode=WORKTREE");
      console.log("worktree_profile=043B_MINIMUM_VIABLE_SAFETY_HOTFIX");
      console.log("diff_file_set_verified=YES_26_OF_26");
      console.log("043b_hotfix_status_map=YES_24M_2UNTRACKED");
      console.log("043b_hotfix_staged_changes=NO");
      console.log("043b_hotfix_environment_files=NONE");
      console.log("frozen_db_safety_content=PASS_15_OF_15");
      console.log("targeted_append_only_delete_probes=2");
      console.log("delete_probe_export_pack=PASS");
      console.log("delete_probe_audit_event=PASS");
      console.log("unexpected_delete_outside_support=0");
      console.log("delete_sql_inside_support=0");
      console.log("043c_not_authorized=YES");
      console.log("worktree_043b_hotfix_profile=PASS_26_OF_26");
    } else if (is043bWorktree) {
      console.log("validation_mode=WORKTREE");
      console.log("worktree_profile=043B_LOCAL_TWO_ACTOR_HARNESS");
      console.log("diff_file_set_verified=YES_17_OF_17");
      console.log("043b_runtime_scope_exact=YES");
      console.log("043b_package_json_script_only=YES");
      console.log("043b_forbidden_surface_drift=NO");
      console.log("043c_not_authorized=YES");
      console.log("043b_staged_changes=NO");
      console.log("043b_worktree_status_map=YES_14M_3UNTRACKED");
      console.log("043b_environment_files=NONE");
      console.log("fixtures_043a_unchanged=YES");
      console.log("043b_no_spec_044_plus=YES");
      console.log("043b_no_high_confidence_secret=YES");
      console.log("043b_no_personal_or_real_data=YES");
      console.log("043b_no_ai_provider=YES");
      console.log("043b_no_mcp_runtime=YES");
      console.log("worktree_043b_profile=PASS_17_OF_17");
    } else if (is043bHotfixHistorical) {
      console.log("historical_043b_hotfix_content_scope=HEAD_COMMIT_ONLY");
      console.log("historical_043b_hotfix_diff_file_set=YES_26_OF_26");
      console.log("historical_043b_hotfix_status_map=YES_24M_2A");
      console.log("historical_043b_hotfix_deletions=NONE");
      console.log("historical_043b_hotfix_renames=NONE");
      console.log("historical_043b_hotfix_copies=NONE");
      console.log("frozen_db_safety_content=PASS_15_OF_15");
      console.log("targeted_append_only_delete_probes=2");
      console.log("delete_probe_export_pack=PASS");
      console.log("delete_probe_audit_event=PASS");
      console.log("unexpected_delete_outside_support=0");
      console.log("delete_sql_inside_support=0");
      console.log("historical_043b_hotfix_profile=PASS_26_OF_26");
    } else if (is043bHistorical) {
      console.log("historical_043b_content_scope=HEAD_COMMIT_ONLY");
      console.log("historical_043b_diff_file_set=YES_17_OF_17");
      console.log("historical_043b_status_map=YES_14M_3A");
      console.log("historical_043b_deletions=NONE");
      console.log("historical_043b_renames=NONE");
      console.log("historical_043b_copies=NONE");
      console.log("historical_043b_package_json_script_only=YES");
      console.log("historical_043b_fixtures_043a_base_and_head_unchanged=YES");
      console.log("historical_043b_protected_042_base_and_head_unchanged=YES");
      console.log("historical_043b_no_high_confidence_secret=YES");
      console.log("historical_043b_no_personal_or_real_data=YES");
      console.log("historical_043b_profile=PASS_17_OF_17");
    } else if (is043cPreparatoryWorktree) {
      console.log("validation_mode=WORKTREE");
      console.log("worktree_profile=WORKTREE_043C_PREPARATORY");
      console.log("diff_file_set_verified=YES_4_OF_4");
      console.log("043c_preparation_status_map=YES_3M_1UNTRACKED");
      console.log("043c_preparation_staged_changes=NO");
      console.log("043c_preparation_environment_files=NONE");
      console.log("043c_preparation_content_scope=CONTROLLED_WORKTREE");
      console.log("043c_preparation_ledger=PASS_3_RECORDS_16_FIELDS");
      console.log("043c_preparation_protocol_hash=PASS");
      console.log("043c_preparation_validator_read_only=PASS");
      console.log("043c_preparation_selftest=PASS");
      console.log("043c_local_artifact_mutants_rejected=PASS_5_OF_5");
      console.log("mutant_direct_ReadAllBytes=REJECTED");
      console.log("mutant_post_read_validation_removed=REJECTED");
      console.log("mutant_final_file_control_removed=REJECTED");
      console.log("mutant_artifact_id_omitted=REJECTED");
      console.log("mutant_free_Path_parameter=REJECTED");
      console.log("043c_frozen_commit_binding_probes=PASS_4_OF_4");
      console.log("S3_TO_S4_HISTORICAL_BASE_FROZEN_COMMIT_ACCEPTED=PASS");
      console.log("S3_TO_S4_HISTORICAL_ARBITRARY_FROZEN_COMMIT_REJECTED=PASS");
      console.log("S3_TO_S4_WORKTREE_HEAD_FROZEN_COMMIT_ACCEPTED=PASS");
      console.log("S3_TO_S4_WORKTREE_NON_HEAD_FROZEN_COMMIT_REJECTED=PASS");
      console.log("mutant_s4_frozen_commit_binding_omitted=REJECTED");
      console.log("043c_post_r2_complete_r1_mutants_rejected=PASS_4_OF_4");
      console.log("mutant_post_r2_completed_run_removed=REJECTED");
      console.log("mutant_post_r2_r1_outcome_removed=REJECTED");
      console.log("mutant_post_r2_r1_missing_removed=REJECTED");
      console.log("mutant_post_r2_r1_unexpected_removed=REJECTED");
      console.log("043c_post_r2_literal_spoof_mutants_rejected=PASS_2_OF_2");
      console.log("mutant_post_r2_completed_run_wrong_value_comment=REJECTED");
      console.log("mutant_post_r2_r1_outcome_wrong_value_comment=REJECTED");
      console.log("043c_localappdata_root_policy_mutant_rejected=PASS_1_OF_1");
      console.log("mutant_localappdata_root_policy_call_removed=REJECTED");
      console.log("043c_localappdata_pre_policy_read_mutant_rejected=PASS_1_OF_1");
      console.log("mutant_localappdata_read_before_policy=REJECTED");
      console.log("043c_execution_authorized=NO");
      console.log("worktree_043c_preparation_profile=PASS_4_OF_4");
    } else if (is043cPreparatoryHistorical) {
      console.log("historical_043c_preparation_content_scope=HEAD_COMMIT_ONLY");
      console.log("historical_043c_preparation_diff_file_set=YES_4_OF_4");
      console.log("historical_043c_preparation_status_map=YES_3M_1A");
      console.log("historical_043c_preparation_deletions=NONE");
      console.log("historical_043c_preparation_renames=NONE");
      console.log("historical_043c_preparation_copies=NONE");
      console.log("historical_043c_preparation_candidate_code_executed=NO");
      console.log("historical_043c_preparation_profile=PASS_4_OF_4");
    } else if (is043cDurableTransitionWorktree) {
      console.log("validation_mode=WORKTREE");
      console.log("worktree_profile=WORKTREE_043C_DURABLE_TRANSITION");
      console.log("043c_transition_status_map=YES_1M_0UNTRACKED");
      console.log("043c_transition_staged_changes=NO");
      console.log("043c_transition_append_only=PASS_1_RECORD");
      console.log("043c_transition_prior_records_byte_identical=YES");
      console.log("043c_transition_spec_outside_ledger_byte_identical=YES");
      console.log("043c_transition_local_only_artifacts=NONE");
      console.log("043c_transition_spec_044_plus=NONE");
      console.log("s3_to_s4_worktree_head_binding_rule=ENFORCED");
      console.log("post_s4_frozen_commit_stability_rule=ENFORCED");
      console.log("worktree_043c_transition_profile=PASS_1_OF_1");
    } else if (is043cDurableTransitionHistorical) {
      console.log("historical_043c_transition_content_scope=BASE_AND_HEAD_BLOBS");
      console.log("historical_043c_transition_status_map=YES_1M");
      console.log("historical_043c_transition_direct_single_parent=YES");
      console.log("historical_043c_transition_append_only=PASS_1_RECORD");
      console.log("historical_043c_transition_prior_records_byte_identical=YES");
      console.log("historical_043c_transition_spec_outside_ledger_byte_identical=YES");
      console.log("s3_to_s4_historical_range_base_binding_rule=ENFORCED");
      console.log("post_s4_frozen_commit_stability_rule=ENFORCED");
      console.log("historical_043c_transition_profile=PASS_1_OF_1");
    } else if (verification
      && Object.values(verification).every((verified) => verified === true)) {
      console.log("historical_change_types_verified=YES");
      console.log("historical_deletions_visible=YES");
      console.log("historical_rename_endpoints_visible=YES");
      console.log("historical_copy_endpoints_visible=YES");
      console.log("historical_expected_status_map=YES_6M_13A");
    }
    console.log("governance_kit_errors=0");
    console.log("governance_kit_result=PASS_STRUCTURAL_ONLY");
  }

  console.log(failureOnlyLine("DRAFT_2020_12_SCHEMA_VALIDATION=NOT_PERFORMED"));
}

const IS_DIRECT_EXECUTION = process.argv[1] !== undefined
  && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;

if (IS_DIRECT_EXECUTION) runCli();
