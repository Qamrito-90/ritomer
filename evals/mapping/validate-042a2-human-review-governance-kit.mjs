import { execFileSync } from "node:child_process";
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
const HISTORICAL_SPEC_042_ACTIVE_PATH = "specs/active/042-controlled-ai-mapping-runtime-pilot-v1.md";
const CURRENT_SPEC_042_BACKLOG_PATH = "specs/backlog/042-controlled-ai-mapping-runtime-pilot-v1.md";
const CURRENT_SPEC_043_ACTIVE_PATH = "specs/active/043-controlled-fiduciary-pilot-readiness-v1.md";
const ROADMAP_PATH = "docs/product/product-roadmap.md";
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

  if (profile !== undefined && profile !== "043b" && profile !== "043b-hotfix") {
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

function validateExactFileSet(range) {
  let historicalVerification;
  let worktreeVerification;
  let worktreeProfile;
  const changes = range.mode === "HISTORICAL"
    || range.mode === "HISTORICAL_043B"
    || range.mode === "HISTORICAL_043B_HOTFIX"
    ? historicalChanges(range.base, range.head)
    : undefined;
  const actual = changes ? historicalChangedPaths(changes) : changedPaths();

  if (range.mode === "HISTORICAL_043B_HOTFIX") {
    historicalVerification = validate043bHotfixHistoricalRange(actual, changes, range);
  } else if (range.mode === "HISTORICAL_043B") {
    historicalVerification = validate043bHistoricalRange(actual, changes, range);
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
    } else {
      const exactCurrentFileSet = worktreeProfile === WORKTREE_PROFILES.CLEAN
        || worktreeProfile === WORKTREE_PROFILES.PILOT_043A;
      assert(exactCurrentFileSet, `worktree file set must be clean, exactly 043a, exactly 043b, or exactly the 26-path 043b-hotfix whitelist`);
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
    ? range.head
    : undefined;
  const historicalVerification = validateExactFileSet(range);
  validateProtectedHashesAndCases();
  validateSchemas();
  validateLedger();
  validateDocumentCoherence();
  validateRoadmap();
  validateNoRealInstances();
  if (range.mode !== "HISTORICAL_043B"
    && range.mode !== "HISTORICAL_043B_HOTFIX"
    && historicalVerification?.worktreeProfile !== WORKTREE_PROFILES.HOTFIX_043B) {
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
  const is043bHistorical = verification?.historicalProfile === "043b";
  const is043bHotfixHistorical = verification?.historicalProfile === "043b-hotfix";
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
