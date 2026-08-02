import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, lstatSync, readFileSync, realpathSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { TextDecoder } from "node:util";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const REPO_ROOT = resolve(dirname(SCRIPT_PATH), "..", "..", "..");

const CHECKER_ID = "043c-recovery-v2";
const PROTOCOL_ID = "043c-internal-rehearsal-v2";
const LEDGER_ID = "043c-recovery-ledger-v2";
const INCIDENT_ID = "043c-v1-pr107-freeze-linearity-incident";
const INCIDENT_SHA256 = "1419edb3f46c1472f7333b0a8970fb3897f5f534693229ce123dc9b53eb9ea8b";
const INCIDENT_BYTE_LENGTH = 3_680;
const P0_BASE = "798f3bc03dc7351691dcfcd9f1025b51809cec67";
const P0_BRANCH = "chore/043c-v2-recovery-p0";
const MAX_READ_BYTES = 2_097_152;
const MAX_C043C_BYTES = 65_536;

const SPEC_PATH = "specs/active/043-controlled-fiduciary-pilot-readiness-v1.md";
const V1_RUNBOOK_PATH = "runbooks/controlled-fiduciary-pilot-local-043.md";
const V1_VALIDATOR_PATH = "runbooks/validate-controlled-fiduciary-pilot-043c-state.ps1";
const V2_RUNBOOK_PATH = "runbooks/controlled-fiduciary-pilot-local-043c-v2.md";
const LEDGER_PATH = "evals/pilot/043c/recovery-ledger-v2.jsonl";
const NODE_VALIDATOR_PATH = "evals/pilot/043c/validate-recovery-v2.mjs";
const POWERSHELL_VALIDATOR_PATH = "runbooks/validate-controlled-fiduciary-pilot-043c-v2-state.ps1";
const PLAN_PATH = "docs/product/v1-plan.md";

const P0_MODIFIED_PATHS = [SPEC_PATH, V1_RUNBOOK_PATH, PLAN_PATH, V1_VALIDATOR_PATH].sort();
const P0_ADDED_PATHS = [V2_RUNBOOK_PATH, LEDGER_PATH, NODE_VALIDATOR_PATH, POWERSHELL_VALIDATOR_PATH].sort();
const P0_PATHS = [...P0_MODIFIED_PATHS, ...P0_ADDED_PATHS].sort();
const PROTECTED_043C_PATHS = new Set(P0_PATHS);

const INCIDENT_BEGIN = "<!-- 043C_V2_INCIDENT_SELECTION_BEGIN -->";
const INCIDENT_END = "<!-- 043C_V2_INCIDENT_SELECTION_END -->";
const PROTOCOL_V2_BEGIN = "<!-- 043C_PROTOCOL_V2_BEGIN -->";
const PROTOCOL_V2_END = "<!-- 043C_PROTOCOL_V2_END -->";
const V1_PROTOCOL_BEGIN = "<!-- 043C_PROTOCOL_V1_BEGIN -->";
const V1_PROTOCOL_END = "<!-- 043C_PROTOCOL_V1_END -->";
const V1_LEDGER_BEGIN = "<!-- 043C_DURABLE_STATE_LEDGER_BEGIN -->";
const V1_LEDGER_END = "<!-- 043C_DURABLE_STATE_LEDGER_END -->";

const V1_PROTOCOL_BYTES = 41_438;
const V1_PROTOCOL_SHA256 = "7e5430a63c0b94a3643beffef08b47bf60870ce17b73e453991de978cbf30fe4";
const V1_LEDGER_BYTES = 2_645;
const V1_LEDGER_SHA256 = "c0d574832011332c75860d7caef1441aeb6ae94edf61e218502049be32b92b77";

const LEDGER_KEYS = [
  "schemaVersion", "ledgerId", "sequence", "decisionId", "state", "previousState",
  "previousRecordSha256", "recordedAtUtc", "authorityOccurredAtUtc", "recordedByRole",
  "authorityType", "authorityRef", "incidentId", "incidentSha256", "protocolId",
  "protocolSha256", "qualificationSha256", "frozenCommit", "completedRun",
  "evidenceSha256", "cpoOutcome", "reviewRefs", "authorizations",
];

const AUTHORIZATION_KEYS = [
  "v1ExecutionAuthorized", "v2ExecutionAuthorized", "r1Authorized", "r2Authorized",
  "externalUseAuthorized", "realDataAuthorized", "productionAuthorized",
];

const REVIEW_REF_KEYS = [
  "p0ReviewedHead", "p0ReviewedTree", "cpoPostCodeReviewRef", "aiTechnicalReviewRef",
  "aiSecurityPrivacyReviewRef", "ctoTechnicalGateRef", "cpoPreMergeReviewRef",
  "p0MergeCommit", "p0MergeTree",
];

const REVIEW_REF_PATTERNS = Object.freeze({
  cpoPostCodeReviewRef: "043c-v2-p0-cpo-post-code-review-pass-",
  aiTechnicalReviewRef: "043c-v2-p0-ai-technical-review-pass-",
  aiSecurityPrivacyReviewRef: "043c-v2-p0-ai-security-privacy-review-pass-",
  ctoTechnicalGateRef: "043c-v2-p0-cto-technical-gate-pass-",
  cpoPreMergeReviewRef: "043c-v2-p0-cpo-pre-merge-review-pass-",
});
const AUTHORITY_ARTIFACT_KEYS = [
  "schemaVersion", "authorityRef", "outcome", "reviewedHead", "reviewedTree",
  "classifications",
];
const AUTHORITY_ARTIFACT_DEFINITIONS = Object.freeze([
  { refKey: "cpoPostCodeReviewRef", path: "authorities/cpo-post-code-review.json", ai: false },
  { refKey: "aiTechnicalReviewRef", path: "authorities/ai-technical-review.json", ai: true },
  { refKey: "aiSecurityPrivacyReviewRef", path: "authorities/ai-security-privacy-review.json", ai: true },
  { refKey: "ctoTechnicalGateRef", path: "authorities/cto-technical-gate.json", ai: false },
  { refKey: "cpoPreMergeReviewRef", path: "authorities/cpo-pre-merge-review.json", ai: false },
]);
const QUALIFICATION_ARTIFACT_PATH = "qualification/qualification.json";
const RUN_ARTIFACT_PATHS = Object.freeze({
  R1: {
    evidence: "runs/R1/evidence-summary.json",
    auditProjection: "runs/R1/audit-projection.json",
    businessState: "runs/R1/business-state.json",
  },
  R2: {
    evidence: "runs/R2/evidence-summary.json",
    auditProjection: "runs/R2/audit-projection.json",
    businessState: "runs/R2/business-state.json",
  },
});

const QUALIFICATION_KEYS = [
  "schemaVersion", "qualificationId", "ledgerId", "incidentId", "incidentSha256",
  "protocolId", "protocolSha256", "frozenCommit", "reviewRefs", "qClosed",
  "qualifications", "qualifiedAtUtc", "qualifiedByRole",
];
const QUALIFICATION_ITEM_KEYS = [
  "qId", "qClosed", "nominal", "nominalSha256", "mutant", "mutantSha256",
  "errorCode", "reviewRef",
];
const QUALIFICATION_ERROR_CODES = Object.freeze([
  "043C_V2_Q1_FINAL_PATH_MISMATCH",
  "043C_V2_Q2_ARTIFACT_SIZE_EXCEEDED",
  "043C_V2_Q3_PATH_CONFINEMENT_VIOLATION",
  "043C_V2_Q4_CONCURRENT_MUTATION_DETECTED",
  "043C_V2_Q5_CATALOG_READER_PROFILE_INVALID",
  "043C_V2_Q6_APPLICATION_READINESS_NOT_EXACT",
  "043C_V2_Q7_EVIDENCE_HASH_BINDING_INVALID",
]);

const EVIDENCE_KEYS = [
  "schemaVersion", "run", "outcome", "lastCompletedTask", "abortReasonCode",
  "runStartedAtUtc", "runEndedAtUtc", "protocolId", "protocolSha256", "frozenCommit",
  "resourceTargetSha256", "expectedBusinessEventCount", "missingExpectedBusinessEventCount",
  "unexpectedBusinessEventCount", "auditProjectionSha256", "businessStateSha256",
  "evidenceContentSha256", "qualificationSha256",
];
const EVIDENCE_DESCRIPTOR_KEYS = EVIDENCE_KEYS.filter((key) => key !== "evidenceContentSha256");
const CLOSED_ABORT_REASONS = new Set([
  "HARD_STOP", "OPERATOR_INTERRUPTION", "ENVIRONMENT_FAILURE", "PROTOCOL_DEVIATION",
  "EVIDENCE_INCOMPLETE",
]);

const AUDIT_PROJECTION_KEYS = [
  "schemaVersion", "run", "outcome", "lastCompletedTask", "runStartedAtUtc", "runEndedAtUtc",
  "tenantId", "accountantUserId", "reviewerUserId", "slots", "expectedBusinessEventCount",
  "missingExpectedBusinessEventCount", "unexpectedBusinessEventCount",
];
const AUDIT_SLOT_KEYS = [
  "slot", "action", "resourceType", "accountCode", "targetCode", "matchStatus", "resourceId",
  "occurredAtUtc", "actorUserId", "actorSubjectSha256", "actorRole", "requestIdSha256",
  "metadataSha256",
];
const BUSINESS_STATE_KEYS = [
  "schemaVersion", "run", "outcome", "lastCompletedTask", "tenantId", "accountantUserId",
  "reviewerUserId", "closingFolder", "balanceImport", "mappings", "workpaper", "document",
  "exportPack", "minimalAnnexVerified", "usefulnessAssessmentCompleted",
];
const BUSINESS_SUBOBJECT_KEYS = Object.freeze({
  closingFolder: ["id", "name", "periodStartOn", "periodEndOn", "externalRef", "status"],
  balanceImport: ["id", "closingFolderId", "version", "fileName", "rowCount", "totalDebit", "totalCredit"],
  mapping: ["id", "closingFolderId", "accountCode", "targetCode", "createdByUserId", "updatedByUserId"],
  workpaper: ["id", "closingFolderId", "anchorCode", "noteText", "status", "reviewComment", "basisImportVersion", "basisTaxonomyVersion", "evidenceCount", "reviewedAtUtc", "reviewedByUserId"],
  document: ["id", "workpaperId", "anchorCode", "fileName", "mediaType", "byteSize", "checksumSha256", "sourceLabel", "documentDate", "storageBackend", "verificationStatus", "reviewComment", "reviewedAtUtc", "reviewedByUserId"],
  exportPack: ["id", "closingFolderId", "idempotencyKeySha256", "storageObjectKeySha256", "sourceFingerprint", "storageBackend", "fileName", "mediaType", "byteSize", "checksumSha256", "basisImportVersion", "basisTaxonomyVersion", "createdAtUtc", "createdByUserId"],
});

const RESOURCE_DESCRIPTORS = Object.freeze({
  R1: {
    bytes: "schemaVersion=1\nrun=R1\njdbcUrl=jdbc:postgresql://127.0.0.1:5432/ritomer_043c_r1\ndatabaseName=ritomer_043c_r1\nroleName=ritomer_043c_r1_runner\nstorageRelativePath=runtime/R1/storage\n",
    sha256: "318de7101897fd534aa91fed72243fbfb29e78ac5951c57dccf09251b4d7b3b8",
  },
  R2: {
    bytes: "schemaVersion=1\nrun=R2\njdbcUrl=jdbc:postgresql://127.0.0.1:5432/ritomer_043c_r2\ndatabaseName=ritomer_043c_r2\nroleName=ritomer_043c_r2_runner\nstorageRelativePath=runtime/R2/storage\n",
    sha256: "dfc660e524eb9d91f7ee8f6e4d9273cac36c1c92d3595e285ba0afda8f78e2ef",
  },
});

const TASK_ROWS = Object.freeze([
  "| T00 | Verify D5, run-specific authority, protocolId/hash, frozenCommit, qualificationSha256, and resourceTargetSha256. |",
  "| T01 | Open the local run, generate runId, capture run_start_utc; provisioning and preflight already ended. |",
  "| T02 | Verify only frozen 043a fixtures: balance 359 bytes/SHA-256 2295b620704c2cfcdf1e37660388bd84a1d261c0b7697edf5bce21d0c04f9855; evidence 184 bytes/SHA-256 f5bb9a7ec0df043a8e845d10f029c2bdd6dd7ea2f62f9935f48cdc0d95339b27. |",
  "| T03 | Verify ACCOUNTANT/REVIEWER and common tenant with a non-auditing read including /api/me and no explicit X-Tenant-Id. |",
  "| T04 | Create exactly one synthetic closing folder using the constants below. |",
  "| T05 | Import balance-fy2025-v1.csv; require version 1, seven rows, debit/credit 149000.00. |",
  "| T06 | Create exactly the seven mappings below. |",
  "| T07 | Read canonical readiness, controls, summaries, and previews; GET emits no audit. |",
  "| T08 | Create BS.ASSET.CURRENT_SECTION workpaper, DRAFT, note Synthetic bank reconciliation FY2025. |",
  "| T09 | Upload evidence-bank-reconciliation-fy2025-v1.csv with frozen metadata. |",
  "| T10 | Move workpaper to READY_FOR_REVIEW. |",
  "| T11 | Handoff to already validated REVIEWER without mutation or audit. |",
  "| T12 | Move document UNVERIFIED to VERIFIED. |",
  "| T13 | Move workpaper READY_FOR_REVIEW to REVIEWED. |",
  "| T14 | Create export pack, verify annex/usefulness, capture run_end_utc, reconstruct audit/business projections, bind hashes, and seal evidence. State becomes CLEANUP_PENDING only. |",
  "| T15 | Stop runtime, operator removes exact run resources, then v2 read-only cleanup validation. |",
]);

const AUDIT_ROWS = Object.freeze([
  "| 1 | CLOSING_FOLDER.CREATED | CLOSING_FOLDER | ACCOUNTANT |",
  "| 2 | BALANCE_IMPORT.CREATED | BALANCE_IMPORT | ACCOUNTANT |",
  "| 3-9 | MANUAL_MAPPING.CREATED | MANUAL_MAPPING | ACCOUNTANT |",
  "| 10 | WORKPAPER.CREATED | WORKPAPER | ACCOUNTANT |",
  "| 11 | DOCUMENT.CREATED | DOCUMENT | ACCOUNTANT |",
  "| 12 | WORKPAPER.UPDATED | WORKPAPER | ACCOUNTANT |",
  "| 13 | DOCUMENT.VERIFICATION_UPDATED | DOCUMENT | REVIEWER |",
  "| 14 | WORKPAPER.REVIEW_STATUS_CHANGED | WORKPAPER | REVIEWER |",
  "| 15 | EXPORT_PACK.CREATED | EXPORT_PACK | ACCOUNTANT |",
]);

const MAPPING_ROWS = Object.freeze([
  ["1000", "BS.ASSET.CASH_AND_EQUIVALENTS"],
  ["1100", "BS.ASSET.TRADE_RECEIVABLES"],
  ["1200", "BS.ASSET.PREPAIDS_AND_OTHER_CURRENT"],
  ["2000", "BS.LIABILITY.TRADE_PAYABLES"],
  ["2800", "BS.EQUITY.RETAINED_EARNINGS"],
  ["3000", "PL.REVENUE.OPERATING_REVENUE"],
  ["4000", "PL.EXPENSE.OTHER_OPERATING_EXPENSES"],
]);

const AUDIT_SLOT_EXPECTATIONS = Object.freeze([
  ["CLOSING_FOLDER.CREATED", "CLOSING_FOLDER", null, null, "ACCOUNTANT"],
  ["BALANCE_IMPORT.CREATED", "BALANCE_IMPORT", null, null, "ACCOUNTANT"],
  ...MAPPING_ROWS.map(([accountCode, targetCode]) => ["MANUAL_MAPPING.CREATED", "MANUAL_MAPPING", accountCode, targetCode, "ACCOUNTANT"]),
  ["WORKPAPER.CREATED", "WORKPAPER", null, null, "ACCOUNTANT"],
  ["DOCUMENT.CREATED", "DOCUMENT", null, null, "ACCOUNTANT"],
  ["WORKPAPER.UPDATED", "WORKPAPER", null, null, "ACCOUNTANT"],
  ["DOCUMENT.VERIFICATION_UPDATED", "DOCUMENT", null, null, "REVIEWER"],
  ["WORKPAPER.REVIEW_STATUS_CHANGED", "WORKPAPER", null, null, "REVIEWER"],
  ["EXPORT_PACK.CREATED", "EXPORT_PACK", null, null, "ACCOUNTANT"],
]);
const AUDIT_QUERY_BYTES = 11_324;
const AUDIT_QUERY_SHA256 = "4e3539099197c4152e46756fb202233869698434a5505034d1fa071901184745";

const AUTHORIZATIONS_FALSE = Object.freeze({
  v1ExecutionAuthorized: false,
  v2ExecutionAuthorized: false,
  r1Authorized: false,
  r2Authorized: false,
  externalUseAuthorized: false,
  realDataAuthorized: false,
  productionAuthorized: false,
});

const DECISIONS = Object.freeze({
  D0: {
    state: "043C_V2_PLAN_HARDENED_IMPLEMENTATION_NOT_AUTHORIZED",
    role: "CPO",
    authorityType: "CPO_PLAN_HARDENING_DECISION",
    authorityRef: "043c-v2-d0-plan-hardening-decision",
    authorityOccurredAtUtc: "2026-08-01T23:42:26.302Z",
  },
  D1: {
    state: "043C_V2_IMPLEMENTATION_AUTHORIZED_NOT_STARTED",
    role: "CPO",
    authorityType: "CPO_IMPLEMENTATION_AUTHORIZATION",
    authorityRef: "043c-v2-d1-implementation-authorization",
    authorityOccurredAtUtc: "2026-08-02T04:43:41.000Z",
  },
  D2: {
    state: "043C_V2_IMPLEMENTED_PENDING_P0_DELIVERY",
    role: "PREPARATION_OWNER",
    authorityType: "P0_IMPLEMENTATION_EVIDENCE",
    authorityRef: "043c-v2-d2-implementation-evidence",
  },
  D3: {
    state: "043C_V2_P0_DELIVERED_PENDING_RECOVERY_SELECTION",
    role: "RECOVERY_COORDINATOR_043C",
    authorityType: "P0_POST_MERGE_EVIDENCE",
    authorityRef: "043c-v2-d3-p0-post-merge-evidence",
  },
  D4: {
    state: "043C_V2_RECOVERY_SELECTED_PENDING_CTO_FREEZE",
    role: "CPO",
    authorityType: "CPO_RECOVERY_SELECTION_DECISION",
    authorityRef: "043c-v2-d4-recovery-selection-decision",
  },
  D5: {
    state: "043C_V2_PROTOCOL_FROZEN_READY_FOR_R1_DECISION",
    role: "CTO",
    authorityType: "CTO_FREEZE_GATE_D5",
    authorityRef: "043c-v2-d5-cto-freeze-gate",
  },
  D6: {
    state: "043C_V2_R1_CLEANUP_VALIDATED_READY_FOR_R2_DECISION",
    role: "COORDINATOR_043C",
    authorityType: "R1_CLEANUP_EVIDENCE",
    authorityRef: "043c-v2-d6-r1-cleanup-evidence",
  },
  D7: {
    state: "043C_V2_R2_CLEANUP_VALIDATED_READY_FOR_FINAL_CPO_DECISION",
    role: "COORDINATOR_043C",
    authorityType: "R2_CLEANUP_EVIDENCE",
    authorityRef: "043c-v2-d7-r2-cleanup-evidence",
  },
  F1: {
    state: "GO_TO_EXTERNAL_GATE_REVIEW",
    role: "CPO",
    authorityType: "CPO_FINAL_DECISION",
    authorityRef: "043c-v2-f1-cpo-final-go-external-gate-review",
  },
  F2: {
    state: "NO_GO",
    role: "CPO",
    authorityType: "CPO_FINAL_DECISION",
    authorityRef: "043c-v2-f2-cpo-final-no-go",
  },
  F3: {
    state: "INCONCLUSIVE",
    role: "CPO",
    authorityType: "CPO_FINAL_DECISION",
    authorityRef: "043c-v2-f3-cpo-final-inconclusive",
  },
});

const ALLOWED_PREVIOUS_DECISIONS = new Map([
  ["D0", [null]], ["D1", ["D0"]], ["D2", ["D1"]], ["D3", ["D2"]],
  ["D4", ["D3"]], ["D5", ["D4"]], ["D6", ["D5"]], ["D7", ["D6"]],
  ["F1", ["D7"]], ["F2", ["D6", "D7"]], ["F3", ["D6", "D7"]],
]);

const PHASES = ["P0", "P1", "P2", "P3", "D6", "D7", "F1", "F2", "F3"];
const PHASE_DECISION = new Map([
  ["P0", "D2"], ["P1", "D3"], ["P2", "D4"], ["P3", "D5"],
  ["D6", "D6"], ["D7", "D7"], ["F1", "F1"], ["F2", "F2"], ["F3", "F3"],
]);
const PHASE_PREVIOUS = new Map([
  ["P1", ["D2"]], ["P2", ["D3"]], ["P3", ["D4"]], ["D6", ["D5"]],
  ["D7", ["D6"]], ["F1", ["D7"]], ["F2", ["D6", "D7"]],
  ["F3", ["D6", "D7"]],
]);

const SHA1_PATTERN = /^[0-9a-f]{40}$/;
const SHA256_PATTERN = /^[0-9a-f]{64}$/;
const UTC_MILLISECONDS_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const UTC_MICROSECONDS_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/;
const STRICT_UTF8 = new TextDecoder("utf-8", { fatal: true });

const FORENSIC_TRANSITIONS = [
  {
    label: "PR106",
    base: "534226772508e9f2998bdbad0cd786a468ebff33",
    source: "84406bb54de796821709f84c05da5bb826dde3bb",
    merge: "046aa64e05eeb280833d7c7ef9d3161a64b73af4",
    sequence: 3,
    state: "043C_POST_CODE_CPO_PASS_PENDING_CTO",
    frozenCommit: null,
  },
  {
    label: "PR107",
    base: "046aa64e05eeb280833d7c7ef9d3161a64b73af4",
    source: "a0686605f47d8e4b373173731330f66dd14901ce",
    merge: "27f230d8f641dcda89821e1b9d15434149741f84",
    sequence: 4,
    state: "043C_PROTOCOL_FROZEN_READY_FOR_R1_DECISION",
    frozenCommit: "046aa64e05eeb280833d7c7ef9d3161a64b73af4",
  },
];

class ValidationError extends Error {
  constructor(exitCode, code) {
    super(code);
    this.name = "ValidationError";
    this.exitCode = exitCode;
    this.code = code;
  }
}

function fail(exitCode, code) {
  throw new ValidationError(exitCode, code);
}

function requireInvariant(condition, code) {
  if (!condition) fail(4, code);
}

function sameArray(actual, expected) {
  return actual.length === expected.length
    && actual.every((value, index) => value === expected[index]);
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function strictUtf8Text(bytes, code, { terminalLf = true } = {}) {
  requireInvariant(Buffer.isBuffer(bytes), `${code}_NOT_BYTES`);
  requireInvariant(bytes.length <= MAX_READ_BYTES, `${code}_READ_SIZE_LIMIT`);
  requireInvariant(!(bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf), `${code}_BOM`);
  requireInvariant(!bytes.includes(0x0d), `${code}_NOT_LF_ONLY`);
  if (terminalLf) requireInvariant(bytes.length > 0 && bytes.at(-1) === 0x0a, `${code}_TERMINAL_LF`);
  try {
    return STRICT_UTF8.decode(bytes);
  } catch {
    fail(4, `${code}_INVALID_UTF8`);
  }
}

function countBufferOccurrences(bytes, marker) {
  const needle = Buffer.from(marker, "utf8");
  let count = 0;
  let offset = 0;
  while (offset <= bytes.length - needle.length) {
    const index = bytes.indexOf(needle, offset);
    if (index < 0) break;
    count += 1;
    offset = index + needle.length;
  }
  return count;
}

function extractMarkedContent(bytes, beginMarker, endMarker, code) {
  const begin = Buffer.from(beginMarker, "utf8");
  const end = Buffer.from(endMarker, "utf8");
  requireInvariant(countBufferOccurrences(bytes, beginMarker) === 1, `${code}_BEGIN_COUNT`);
  requireInvariant(countBufferOccurrences(bytes, endMarker) === 1, `${code}_END_COUNT`);
  const beginIndex = bytes.indexOf(begin);
  const endIndex = bytes.indexOf(end, beginIndex + begin.length);
  requireInvariant(endIndex > beginIndex, `${code}_MARKER_ORDER`);
  const contentStart = beginIndex + begin.length;
  requireInvariant(bytes[contentStart] === 0x0a, `${code}_BEGIN_LF`);
  requireInvariant(endIndex > contentStart + 1 && bytes[endIndex - 1] === 0x0a, `${code}_CONTENT_TERMINAL_LF`);
  const content = bytes.subarray(contentStart + 1, endIndex);
  strictUtf8Text(content, code);
  return {
    content,
    beginIndex,
    contentStart: contentStart + 1,
    endIndex,
    outside: Buffer.concat([bytes.subarray(0, contentStart + 1), bytes.subarray(endIndex)]),
  };
}

function validateExactMarkedHash(bytes, begin, end, length, hash, code) {
  const block = extractMarkedContent(bytes, begin, end, code);
  requireInvariant(block.content.length === length, `${code}_BYTE_LENGTH`);
  requireInvariant(sha256(block.content) === hash, `${code}_SHA256`);
  return block;
}

function worktreePath(repoPath) {
  return resolve(REPO_ROOT, ...repoPath.split("/"));
}

function readWorktreeFile(repoPath) {
  const absolute = worktreePath(repoPath);
  requireInvariant(existsSync(absolute), "WORKTREE_REQUIRED_FILE_MISSING");
  const stats = lstatSync(absolute);
  requireInvariant(stats.isFile() && !stats.isSymbolicLink(), "WORKTREE_REQUIRED_FILE_NOT_REGULAR");
  requireInvariant(stats.size <= MAX_READ_BYTES, "WORKTREE_REQUIRED_FILE_SIZE_LIMIT");
  return readFileSync(absolute);
}

function isPathOutside(root, candidate) {
  const value = relative(root, candidate);
  return value === ".." || value.startsWith("../") || value.startsWith("..\\") || isAbsolute(value);
}

function sameFilesystemPath(left, right) {
  return resolve(left).toLowerCase() === resolve(right).toLowerCase();
}

function createExternalArtifactInput(rootValue) {
  requireInvariant(typeof rootValue === "string" && rootValue.length > 0
    && !rootValue.includes("\0") && isAbsolute(rootValue), "ARTIFACT_ROOT_ABSOLUTE");
  const requestedRoot = resolve(rootValue);
  requireInvariant(existsSync(requestedRoot), "ARTIFACT_ROOT_MISSING");
  const rootStats = lstatSync(requestedRoot);
  requireInvariant(rootStats.isDirectory() && !rootStats.isSymbolicLink(), "ARTIFACT_ROOT_NOT_SAFE_DIRECTORY");
  const root = realpathSync(requestedRoot);
  requireInvariant(sameFilesystemPath(root, requestedRoot), "ARTIFACT_ROOT_REPARSE_OR_ALIAS");
  const repositoryRoot = realpathSync(REPO_ROOT);
  requireInvariant(isPathOutside(repositoryRoot, root), "ARTIFACT_ROOT_INSIDE_REPOSITORY");

  const read = (relativePath) => {
    requireInvariant(typeof relativePath === "string" && relativePath.length > 0
      && !relativePath.includes("\0") && !isAbsolute(relativePath), "ARTIFACT_RELATIVE_PATH");
    const candidate = resolve(root, ...relativePath.split("/"));
    requireInvariant(!isPathOutside(root, candidate) && !sameFilesystemPath(root, candidate), "ARTIFACT_PATH_CONFINEMENT");
    requireInvariant(existsSync(candidate), "ARTIFACT_REQUIRED_FILE_MISSING");
    const before = lstatSync(candidate);
    requireInvariant(before.isFile() && !before.isSymbolicLink(), "ARTIFACT_REQUIRED_FILE_NOT_REGULAR");
    requireInvariant(before.size > 0 && before.size <= MAX_C043C_BYTES, "ARTIFACT_REQUIRED_FILE_SIZE_LIMIT");
    const finalPath = realpathSync(candidate);
    requireInvariant(sameFilesystemPath(finalPath, candidate) && !isPathOutside(root, finalPath), "ARTIFACT_FILE_REPARSE_OR_ESCAPE");
    const bytes = readFileSync(candidate);
    const after = lstatSync(candidate);
    requireInvariant(before.dev === after.dev && before.ino === after.ino
      && before.size === after.size && before.mtimeMs === after.mtimeMs
      && bytes.length === after.size, "ARTIFACT_FILE_CONCURRENT_MUTATION");
    return bytes;
  };
  return { root, read, qualificationPreimagePaths: null };
}

function gitBytes(args) {
  try {
    return execFileSync("git", args, {
      cwd: REPO_ROOT,
      encoding: null,
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: MAX_READ_BYTES,
    });
  } catch {
    fail(3, "GIT_READ_FAILED");
  }
}

function gitText(args) {
  const bytes = gitBytes(args);
  try {
    return STRICT_UTF8.decode(bytes);
  } catch {
    fail(3, "GIT_OUTPUT_INVALID_UTF8");
  }
}

function gitSucceeds(args) {
  try {
    execFileSync("git", args, {
      cwd: REPO_ROOT,
      encoding: null,
      stdio: ["ignore", "ignore", "ignore"],
    });
    return true;
  } catch {
    return false;
  }
}

function ensureCommit(commit) {
  if (!SHA1_PATTERN.test(commit)) fail(2, "FULL_LOWERCASE_SHA_REQUIRED");
  if (!gitSucceeds(["cat-file", "-e", `${commit}^{commit}`])) fail(3, "GIT_COMMIT_MISSING");
}

function readCommitFile(commit, repoPath) {
  ensureCommit(commit);
  if (!gitSucceeds(["cat-file", "-e", `${commit}:${repoPath}`])) fail(3, "GIT_BLOB_MISSING");
  const sizeText = gitText(["cat-file", "-s", `${commit}:${repoPath}`]).trim();
  if (!/^\d+$/.test(sizeText)) fail(3, "GIT_BLOB_SIZE_INVALID");
  const size = Number(sizeText);
  if (!Number.isSafeInteger(size) || size > MAX_READ_BYTES) fail(3, "GIT_BLOB_SIZE_LIMIT");
  return gitBytes(["show", `${commit}:${repoPath}`]);
}

function commitParents(commit) {
  ensureCommit(commit);
  const output = gitText(["show", "-s", "--format=%P", commit]).trim();
  return output.length === 0 ? [] : output.split(" ");
}

function commitTree(commit) {
  ensureCommit(commit);
  const tree = gitText(["show", "-s", "--format=%T", commit]).trim();
  if (!SHA1_PATTERN.test(tree)) fail(3, "GIT_TREE_INVALID");
  return tree;
}

function currentHead() {
  const head = gitText(["rev-parse", "HEAD"]).trim();
  if (!SHA1_PATTERN.test(head)) fail(3, "GIT_HEAD_INVALID");
  return head;
}

function normalizeGitPath(value) {
  return value.replaceAll("\\", "/");
}

function parseNameStatusZ(bytes) {
  const text = STRICT_UTF8.decode(bytes);
  requireInvariant(text.length === 0 || text.endsWith("\0"), "GIT_NAME_STATUS_TERMINATOR");
  if (text.length === 0) return [];
  const tokens = text.slice(0, -1).split("\0");
  const records = [];
  for (let index = 0; index < tokens.length;) {
    const token = tokens[index++];
    const single = /^(A|M|D)$/.exec(token);
    const paired = /^([RC])(\d{1,3})$/.exec(token);
    requireInvariant(single !== null || paired !== null, "GIT_NAME_STATUS_KIND");
    const kind = single?.[1] ?? paired[1];
    const count = paired === null ? 1 : 2;
    requireInvariant(index + count <= tokens.length, "GIT_NAME_STATUS_PATH_COUNT");
    const paths = tokens.slice(index, index + count).map(normalizeGitPath);
    index += count;
    requireInvariant(paths.every((path) => path.length > 0), "GIT_NAME_STATUS_EMPTY_PATH");
    records.push({ status: kind, paths });
  }
  return records;
}

function historicalChanges(base, head) {
  return parseNameStatusZ(gitBytes([
    "diff", "--no-ext-diff", "--name-status", "-z", "--find-renames", "--find-copies",
    base, head, "--",
  ]));
}

function parseWorktreeStatusZ(bytes) {
  const text = STRICT_UTF8.decode(bytes);
  requireInvariant(text.length === 0 || text.endsWith("\0"), "GIT_STATUS_TERMINATOR");
  if (text.length === 0) return [];
  const tokens = text.slice(0, -1).split("\0");
  const records = [];
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    requireInvariant(token.length >= 4, "GIT_STATUS_RECORD");
    const status = token.slice(0, 2);
    const paths = [normalizeGitPath(token.slice(3))];
    if (status.includes("R") || status.includes("C")) {
      index += 1;
      requireInvariant(index < tokens.length, "GIT_STATUS_RENAME_PATH");
      paths.push(normalizeGitPath(tokens[index]));
    }
    records.push({ status, paths });
  }
  return records;
}

function currentWorktreeStatus() {
  return parseWorktreeStatusZ(gitBytes([
    "status", "--porcelain=v1", "-z", "--untracked-files=all",
  ]));
}

function validateIndexFlags(expectedTrackedPaths) {
  const bytes = gitBytes(["ls-files", "-v", "-z", "--", ...P0_PATHS]);
  const text = STRICT_UTF8.decode(bytes);
  requireInvariant(text.length === 0 || text.endsWith("\0"), "INDEX_FLAGS_TERMINATOR");
  const records = text.length === 0 ? [] : text.slice(0, -1).split("\0");
  const paths = [];
  for (const record of records) {
    const match = /^(.?) (.+)$/s.exec(record);
    requireInvariant(match !== null && match[1] === "H", "INDEX_FLAGS_UNEXPECTED_TAG");
    paths.push(normalizeGitPath(match[2]));
  }
  requireInvariant(sameArray(paths.sort(), [...expectedTrackedPaths].sort()), "INDEX_FLAGS_TRACKED_SET");
  return true;
}

function flattenedPaths(records) {
  return [...new Set(records.flatMap((record) => record.paths))].sort();
}

function validateP0Status(records, historical) {
  requireInvariant(sameArray(flattenedPaths(records), P0_PATHS), "P0_FILE_SET");
  const expected = new Map([
    ...P0_MODIFIED_PATHS.map((path) => [path, historical ? "M" : " M"]),
    ...P0_ADDED_PATHS.map((path) => [path, historical ? "A" : "??"]),
  ]);
  requireInvariant(records.length === 8, "P0_STATUS_COUNT");
  for (const record of records) {
    requireInvariant(record.paths.length === 1, "P0_RENAME_OR_COPY_FORBIDDEN");
    requireInvariant(expected.get(record.paths[0]) === record.status, "P0_STATUS_MATRIX");
  }
  return true;
}

function validateLedgerOnlyStatus(records, historical) {
  requireInvariant(records.length === 1, "LEDGER_ONLY_STATUS_COUNT");
  requireInvariant(records[0].paths.length === 1 && records[0].paths[0] === LEDGER_PATH, "LEDGER_ONLY_FILE_SET");
  requireInvariant(records[0].status === (historical ? "M" : " M"), "LEDGER_ONLY_STATUS");
  return true;
}

function protectedChanges(records) {
  return records.filter((record) => record.paths.some((path) => PROTECTED_043C_PATHS.has(path)));
}

function validateProtectedLedgerAppendStatus(records) {
  const protectedRecords = protectedChanges(records);
  requireInvariant(protectedRecords.length === 1, "PROTECTED_APPEND_STATUS_COUNT");
  requireInvariant(protectedRecords[0].status === "M"
    && sameArray(protectedRecords[0].paths, [LEDGER_PATH]), "PROTECTED_APPEND_FILE_SET");
  return true;
}

function validateProtectedBytesUnchanged(base, head, { includeLedger = true } = {}) {
  for (const path of P0_PATHS) {
    if (!includeLedger && path === LEDGER_PATH) continue;
    requireInvariant(readCommitFile(base, path).equals(readCommitFile(head, path)), "FROZEN_PROTECTED_BYTES_CHANGED");
  }
}

function exactKeys(object, expected, code) {
  requireInvariant(object !== null && typeof object === "object" && !Array.isArray(object), `${code}_OBJECT`);
  requireInvariant(sameArray(Object.keys(object), expected), `${code}_PROPERTY_ORDER`);
}

function validateCanonicalValue(value, code) {
  if (typeof value === "string") {
    requireInvariant(value.normalize("NFC") === value, `${code}_STRING_NOT_NFC`);
    return;
  }
  if (typeof value === "number") {
    requireInvariant(Number.isSafeInteger(value), `${code}_NUMBER_NOT_SAFE_INTEGER`);
    return;
  }
  if (value === null || typeof value === "boolean") return;
  if (Array.isArray(value)) {
    for (const item of value) validateCanonicalValue(item, code);
    return;
  }
  requireInvariant(typeof value === "object", `${code}_VALUE_TYPE`);
  for (const [key, item] of Object.entries(value)) {
    requireInvariant(key.normalize("NFC") === key, `${code}_KEY_NOT_NFC`);
    validateCanonicalValue(item, code);
  }
}

function validateCanonicalStringEscapes(line, code) {
  let inString = false;
  let escaped = false;
  for (const character of line) {
    if (!inString) {
      if (character === '"') inString = true;
      continue;
    }
    if (escaped) {
      requireInvariant(character === '"' || character === "\\", `${code}_STRING_ESCAPE`);
      escaped = false;
    } else if (character === "\\") {
      escaped = true;
    } else if (character === '"') {
      inString = false;
    }
  }
  requireInvariant(!inString && !escaped, `${code}_STRING_TERMINATION`);
}

function parseCanonicalObjectLine(line, expectedKeys, code) {
  requireInvariant(typeof line === "string" && line.length > 0 && !line.includes("\n") && !line.includes("\r"), `${code}_ONE_LINE`);
  validateCanonicalStringEscapes(line, code);
  let object;
  try {
    object = JSON.parse(line);
  } catch {
    fail(4, `${code}_JSON_SYNTAX`);
  }
  exactKeys(object, expectedKeys, code);
  validateCanonicalValue(object, code);
  requireInvariant(JSON.stringify(object) === line, `${code}_NOT_MINIFIED_CANONICAL`);
  return object;
}

function parseCanonicalJsonBytes(bytes, expectedKeys, code) {
  requireInvariant(bytes.length <= MAX_C043C_BYTES, `${code}_SIZE_LIMIT`);
  const text = strictUtf8Text(bytes, code);
  requireInvariant(text.indexOf("\n") === text.length - 1, `${code}_ONE_OBJECT_LINE`);
  return parseCanonicalObjectLine(text.slice(0, -1), expectedKeys, code);
}

function canonicalObjectBytes(object, expectedKeys, code) {
  exactKeys(object, expectedKeys, code);
  validateCanonicalValue(object, code);
  const bytes = Buffer.from(`${JSON.stringify(object)}\n`, "utf8");
  parseCanonicalJsonBytes(bytes, expectedKeys, code);
  return bytes;
}

function readArtifactInput(input, relativePath) {
  try {
    const bytes = input.read(relativePath);
    requireInvariant(Buffer.isBuffer(bytes) && bytes.length > 0
      && bytes.length <= MAX_C043C_BYTES, "ARTIFACT_INPUT_BYTES");
    return bytes;
  } catch (error) {
    if (error instanceof ValidationError) throw error;
    fail(4, "ARTIFACT_INPUT_READ_FAILED");
  }
}

function parseAuthorityArtifactBytes(bytes) {
  return parseCanonicalJsonBytes(bytes, AUTHORITY_ARTIFACT_KEYS, "AUTHORITY_ARTIFACT");
}

function loadArtifactProfile(records, input) {
  const hasReviews = records.some((record) => record.decisionId === "D3");
  const hasQualification = records.some((record) => record.decisionId === "D5");
  const hasR1 = records.some((record) => record.decisionId === "D6");
  const hasR2 = records.some((record) => record.decisionId === "D7");
  const required = hasReviews || hasQualification || hasR1 || hasR2;
  if (!required) return undefined;
  requireInvariant(input !== null && typeof input === "object" && !Array.isArray(input), "ARTIFACT_INPUT_REQUIRED");
  exactKeys(input, ["root", "read", "qualificationPreimagePaths"], "ARTIFACT_INPUT");
  requireInvariant(typeof input.root === "string" && input.root.length > 0
    && typeof input.read === "function", "ARTIFACT_INPUT_READER");

  const authorities = hasReviews
    ? AUTHORITY_ARTIFACT_DEFINITIONS.map((definition) => ({
      definition,
      artifact: parseAuthorityArtifactBytes(readArtifactInput(input, definition.path)),
    }))
    : undefined;
  const artifacts = {};
  if (hasQualification) {
    artifacts.qualificationBytes = readArtifactInput(input, QUALIFICATION_ARTIFACT_PATH);
    if (input.qualificationPreimagePaths !== null) {
      requireInvariant(Array.isArray(input.qualificationPreimagePaths)
        && input.qualificationPreimagePaths.length === QUALIFICATION_ERROR_CODES.length,
      "QUALIFICATION_PREIMAGE_PATHS_CLOSED_SET");
      artifacts.qualificationPreimages = input.qualificationPreimagePaths.map((paths, index) => {
        exactKeys(paths, ["qId", "nominalPath", "mutantPath"], "QUALIFICATION_PREIMAGE_PATH");
        requireInvariant(paths.qId === `Q${index + 1}`, "QUALIFICATION_PREIMAGE_PATH_ORDER");
        return {
          qId: paths.qId,
          nominalBytes: readArtifactInput(input, paths.nominalPath),
          mutantBytes: readArtifactInput(input, paths.mutantPath),
        };
      });
    }
  }
  if (hasR1) {
    artifacts.r1EvidenceBytes = readArtifactInput(input, RUN_ARTIFACT_PATHS.R1.evidence);
    artifacts.r1AuditProjectionBytes = readArtifactInput(input, RUN_ARTIFACT_PATHS.R1.auditProjection);
    artifacts.r1BusinessStateBytes = readArtifactInput(input, RUN_ARTIFACT_PATHS.R1.businessState);
  }
  if (hasR2) {
    artifacts.r2EvidenceBytes = readArtifactInput(input, RUN_ARTIFACT_PATHS.R2.evidence);
    artifacts.r2AuditProjectionBytes = readArtifactInput(input, RUN_ARTIFACT_PATHS.R2.auditProjection);
    artifacts.r2BusinessStateBytes = readArtifactInput(input, RUN_ARTIFACT_PATHS.R2.businessState);
  }
  return { authorities, artifacts };
}

function validateAuthorityArtifactBindings(records, authorities) {
  const d3 = records.find((record) => record.decisionId === "D3");
  if (d3 === undefined) {
    requireInvariant(authorities === undefined, "AUTHORITY_ARTIFACT_PRE_D3");
    return true;
  }
  requireInvariant(Array.isArray(authorities)
    && authorities.length === AUTHORITY_ARTIFACT_DEFINITIONS.length, "AUTHORITY_ARTIFACT_CLOSED_SET");
  for (let index = 0; index < authorities.length; index += 1) {
    const { definition, artifact } = authorities[index];
    requireInvariant(definition === AUTHORITY_ARTIFACT_DEFINITIONS[index], "AUTHORITY_ARTIFACT_ORDER");
    requireInvariant(artifact.schemaVersion === 2, "AUTHORITY_ARTIFACT_SCHEMA");
    requireInvariant(artifact.authorityRef === d3.reviewRefs[definition.refKey], "AUTHORITY_ARTIFACT_REF_BINDING");
    requireInvariant(artifact.outcome === "PASS", "AUTHORITY_ARTIFACT_OUTCOME");
    requireInvariant(artifact.reviewedHead === d3.reviewRefs.p0ReviewedHead, "AUTHORITY_ARTIFACT_HEAD_BINDING");
    requireInvariant(artifact.reviewedTree === d3.reviewRefs.p0ReviewedTree, "AUTHORITY_ARTIFACT_TREE_BINDING");
    const classifications = definition.ai ? ["AI_GENERATED", "NOT_HUMAN_SIGNED"] : [];
    requireInvariant(Array.isArray(artifact.classifications)
      && sameArray(artifact.classifications, classifications), "AUTHORITY_ARTIFACT_CLASSIFICATION");
  }
  return true;
}

function requireNullableString(value, code) {
  requireInvariant(value === null || (typeof value === "string" && value.length > 0), code);
}

function parseUtcMicroseconds(value, code) {
  requireInvariant(typeof value === "string" && UTC_MICROSECONDS_PATTERN.test(value), `${code}_FORMAT`);
  const millisecondsText = value.replace(/(\.\d{3})\d{3}Z$/, "$1Z");
  const milliseconds = Date.parse(millisecondsText);
  requireInvariant(Number.isFinite(milliseconds), `${code}_VALUE`);
  return milliseconds;
}

function validateQualificationBytes(bytes, bindings = {}) {
  const manifest = parseCanonicalJsonBytes(bytes, QUALIFICATION_KEYS, "QUALIFICATION");
  requireInvariant(manifest.schemaVersion === 2
    && manifest.qualificationId === "043c-v2-q1-q7-qualification"
    && manifest.ledgerId === LEDGER_ID, "QUALIFICATION_IDENTITY");
  requireInvariant(manifest.incidentId === INCIDENT_ID && manifest.incidentSha256 === INCIDENT_SHA256, "QUALIFICATION_INCIDENT_BINDING");
  requireInvariant(manifest.protocolId === PROTOCOL_ID && SHA256_PATTERN.test(manifest.protocolSha256), "QUALIFICATION_PROTOCOL_BINDING");
  requireInvariant(SHA1_PATTERN.test(manifest.frozenCommit), "QUALIFICATION_FROZEN_COMMIT");
  validateReviewRefs(manifest.reviewRefs);
  requireInvariant(manifest.qClosed === true && Array.isArray(manifest.qualifications)
    && manifest.qualifications.length === 7, "QUALIFICATION_CLOSED_SET");
  parseUtc(manifest.qualifiedAtUtc, "QUALIFICATION_QUALIFIED_AT");
  requireInvariant(manifest.qualifiedByRole === "RECOVERY_COORDINATOR_043C", "QUALIFICATION_ROLE");

  for (let index = 0; index < manifest.qualifications.length; index += 1) {
    const qualification = manifest.qualifications[index];
    const qId = `Q${index + 1}`;
    exactKeys(qualification, QUALIFICATION_ITEM_KEYS, "QUALIFICATION_ITEM");
    requireInvariant(qualification.qId === qId && qualification.qClosed === true, "QUALIFICATION_ITEM_ID_CLOSED");
    requireInvariant(qualification.nominal === "PASS" && qualification.mutant === "REJECTED", "QUALIFICATION_ITEM_OUTCOMES");
    requireInvariant(SHA256_PATTERN.test(qualification.nominalSha256)
      && SHA256_PATTERN.test(qualification.mutantSha256)
      && qualification.nominalSha256 !== qualification.mutantSha256, "QUALIFICATION_ITEM_PROOF_HASHES");
    requireInvariant(qualification.errorCode === QUALIFICATION_ERROR_CODES[index], "QUALIFICATION_ITEM_ERROR_CODE");
    requireInvariant(qualification.reviewRef === `043c-v2-q${index + 1}-review-pass-${qualification.nominalSha256}`, "QUALIFICATION_ITEM_REVIEW_REF");
  }
  if (bindings.preimages !== undefined) {
    requireInvariant(Array.isArray(bindings.preimages)
      && bindings.preimages.length === QUALIFICATION_ERROR_CODES.length, "QUALIFICATION_PREIMAGE_CLOSED_SET");
    for (let index = 0; index < bindings.preimages.length; index += 1) {
      const preimage = bindings.preimages[index];
      exactKeys(preimage, ["qId", "nominalBytes", "mutantBytes"], "QUALIFICATION_PREIMAGE");
      const qualification = manifest.qualifications[index];
      requireInvariant(preimage.qId === qualification.qId, "QUALIFICATION_PREIMAGE_ORDER");
      requireInvariant(Buffer.isBuffer(preimage.nominalBytes)
        && preimage.nominalBytes.length > 0 && preimage.nominalBytes.length <= MAX_C043C_BYTES
        && Buffer.isBuffer(preimage.mutantBytes)
        && preimage.mutantBytes.length > 0 && preimage.mutantBytes.length <= MAX_C043C_BYTES,
      "QUALIFICATION_PREIMAGE_BYTES");
      requireInvariant(sha256(preimage.nominalBytes) === qualification.nominalSha256,
        "QUALIFICATION_NOMINAL_PREIMAGE_HASH");
      requireInvariant(sha256(preimage.mutantBytes) === qualification.mutantSha256,
        "QUALIFICATION_MUTANT_PREIMAGE_HASH");
    }
  }
  if (bindings.protocolSha256 !== undefined) {
    requireInvariant(manifest.protocolSha256 === bindings.protocolSha256, "QUALIFICATION_PROTOCOL_HASH_MISMATCH");
  }
  if (bindings.frozenCommit !== undefined) {
    requireInvariant(manifest.frozenCommit === bindings.frozenCommit, "QUALIFICATION_FROZEN_MISMATCH");
  }
  if (bindings.reviewRefs !== undefined) {
    requireInvariant(JSON.stringify(manifest.reviewRefs) === JSON.stringify(bindings.reviewRefs), "QUALIFICATION_REVIEW_REFS_MISMATCH");
  }
  return { manifest, bytes, sha256: sha256(bytes) };
}

function validateAuditProjectionBytes(bytes, expected = {}) {
  const projection = parseCanonicalJsonBytes(bytes, AUDIT_PROJECTION_KEYS, "AUDIT_PROJECTION");
  requireInvariant(projection.schemaVersion === 2 && ["R1", "R2"].includes(projection.run), "AUDIT_PROJECTION_IDENTITY");
  requireInvariant(["COMPLETED", "ABORTED"].includes(projection.outcome), "AUDIT_PROJECTION_OUTCOME");
  requireInvariant(projection.lastCompletedTask === null || /^T(?:0\d|1[0-4])$/.test(projection.lastCompletedTask), "AUDIT_PROJECTION_LAST_TASK");
  const startedAt = projection.runStartedAtUtc === null
    ? null : parseUtcMicroseconds(projection.runStartedAtUtc, "AUDIT_PROJECTION_STARTED_AT");
  const endedAt = parseUtcMicroseconds(projection.runEndedAtUtc, "AUDIT_PROJECTION_ENDED_AT");
  for (const key of ["tenantId", "accountantUserId", "reviewerUserId"]) requireNullableString(projection[key], "AUDIT_PROJECTION_ID_VALUE");
  requireInvariant(Array.isArray(projection.slots) && projection.slots.length === 15, "AUDIT_PROJECTION_SLOT_COUNT");
  let missingSlots = 0;
  for (let index = 0; index < projection.slots.length; index += 1) {
    const slot = projection.slots[index];
    exactKeys(slot, AUDIT_SLOT_KEYS, "AUDIT_PROJECTION_SLOT");
    const [action, resourceType, accountCode, targetCode, actorRole] = AUDIT_SLOT_EXPECTATIONS[index];
    requireInvariant(slot.slot === index + 1 && slot.action === action && slot.resourceType === resourceType
      && slot.accountCode === accountCode && slot.targetCode === targetCode, "AUDIT_PROJECTION_SLOT_EXPECTATION");
    requireInvariant(slot.matchStatus === "MATCHED" || slot.matchStatus === "MISSING", "AUDIT_PROJECTION_MATCH_STATUS");
    const dynamicKeys = [
      "resourceId", "occurredAtUtc", "actorUserId", "actorSubjectSha256", "actorRole",
      "requestIdSha256", "metadataSha256",
    ];
    if (slot.matchStatus === "MISSING") {
      missingSlots += 1;
      requireInvariant(dynamicKeys.every((key) => slot[key] === null), "AUDIT_PROJECTION_MISSING_SLOT_FACTS");
    } else {
      requireInvariant(dynamicKeys.every((key) => typeof slot[key] === "string" && slot[key].length > 0), "AUDIT_PROJECTION_MATCHED_SLOT_FACTS");
      parseUtcMicroseconds(slot.occurredAtUtc, "AUDIT_PROJECTION_SLOT_OCCURRED_AT");
      requireInvariant(slot.actorRole === actorRole, "AUDIT_PROJECTION_SLOT_ACTOR_ROLE");
      requireInvariant(slot.actorUserId === (actorRole === "ACCOUNTANT" ? projection.accountantUserId : projection.reviewerUserId), "AUDIT_PROJECTION_SLOT_ACTOR_ID");
      for (const key of ["actorSubjectSha256", "requestIdSha256", "metadataSha256"]) {
        requireInvariant(SHA256_PATTERN.test(slot[key]), "AUDIT_PROJECTION_SLOT_HASH");
      }
    }
  }
  requireInvariant(projection.expectedBusinessEventCount === 15
    && Number.isSafeInteger(projection.missingExpectedBusinessEventCount)
    && projection.missingExpectedBusinessEventCount === missingSlots
    && Number.isSafeInteger(projection.unexpectedBusinessEventCount)
    && projection.unexpectedBusinessEventCount >= 0, "AUDIT_PROJECTION_COUNTS");
  if (projection.outcome === "COMPLETED") {
    requireInvariant(projection.lastCompletedTask === "T14" && projection.runStartedAtUtc !== null
      && projection.missingExpectedBusinessEventCount === 0
      && projection.unexpectedBusinessEventCount === 0, "AUDIT_PROJECTION_COMPLETED");
  }
  for (const key of ["run", "outcome", "lastCompletedTask"]) {
    if (expected[key] !== undefined) requireInvariant(projection[key] === expected[key], `AUDIT_PROJECTION_${key}_MISMATCH`);
  }
  if (expected.runStartedAtUtc !== undefined) {
    const expectedStartedAt = expected.runStartedAtUtc === null ? null : Date.parse(expected.runStartedAtUtc);
    requireInvariant(startedAt === expectedStartedAt, "AUDIT_PROJECTION_runStartedAtUtc_MISMATCH");
  }
  if (expected.runEndedAtUtc !== undefined) {
    requireInvariant(endedAt === Date.parse(expected.runEndedAtUtc), "AUDIT_PROJECTION_runEndedAtUtc_MISMATCH");
  }
  return { projection, bytes, sha256: sha256(bytes) };
}

function validateBusinessStateBytes(bytes, expected = {}) {
  const state = parseCanonicalJsonBytes(bytes, BUSINESS_STATE_KEYS, "BUSINESS_STATE");
  requireInvariant(state.schemaVersion === 2 && ["R1", "R2"].includes(state.run), "BUSINESS_STATE_IDENTITY");
  requireInvariant(["COMPLETED", "ABORTED"].includes(state.outcome), "BUSINESS_STATE_OUTCOME");
  requireInvariant(state.lastCompletedTask === null || /^T(?:0\d|1[0-4])$/.test(state.lastCompletedTask), "BUSINESS_STATE_LAST_TASK");
  for (const key of ["tenantId", "accountantUserId", "reviewerUserId"]) requireNullableString(state[key], "BUSINESS_STATE_ID_VALUE");
  for (const key of ["closingFolder", "balanceImport", "workpaper", "document", "exportPack"]) {
    if (state[key] !== null) exactKeys(state[key], BUSINESS_SUBOBJECT_KEYS[key], `BUSINESS_STATE_${key}`);
  }
  requireInvariant(Array.isArray(state.mappings) && state.mappings.length <= 7, "BUSINESS_STATE_MAPPINGS_COUNT");
  for (let index = 0; index < state.mappings.length; index += 1) {
    const mapping = state.mappings[index];
    exactKeys(mapping, BUSINESS_SUBOBJECT_KEYS.mapping, "BUSINESS_STATE_MAPPING");
    requireInvariant(mapping.accountCode === MAPPING_ROWS[index][0]
      && mapping.targetCode === MAPPING_ROWS[index][1], "BUSINESS_STATE_MAPPING_ORDER");
    if (state.closingFolder !== null) {
      requireInvariant(mapping.closingFolderId === state.closingFolder.id
        && mapping.createdByUserId === state.accountantUserId
        && mapping.updatedByUserId === state.accountantUserId, "BUSINESS_STATE_MAPPING_BINDINGS");
    }
  }
  if (state.closingFolder !== null) {
    const suffix = state.run;
    requireInvariant(state.closingFolder.name === `Demo Closing FY2025 043c ${suffix} internal rehearsal (synthetic)`
      && state.closingFolder.periodStartOn === "2025-01-01"
      && state.closingFolder.periodEndOn === "2025-12-31"
      && state.closingFolder.externalRef === `DEMO-043C-${suffix}-INTERNAL-REHEARSAL`
      && state.closingFolder.status === "DRAFT", "BUSINESS_STATE_CLOSING_CONSTANTS");
  }
  if (state.balanceImport !== null) {
    requireInvariant(state.balanceImport.version === 1 && state.balanceImport.fileName === "balance-fy2025-v1.csv"
      && state.balanceImport.rowCount === 7 && state.balanceImport.totalDebit === "149000.00"
      && state.balanceImport.totalCredit === "149000.00", "BUSINESS_STATE_BALANCE_CONSTANTS");
    if (state.closingFolder !== null) requireInvariant(state.balanceImport.closingFolderId === state.closingFolder.id, "BUSINESS_STATE_BALANCE_BINDING");
  }
  if (state.workpaper !== null) {
    requireInvariant(state.workpaper.anchorCode === "BS.ASSET.CURRENT_SECTION"
      && state.workpaper.noteText === "Synthetic bank reconciliation FY2025.", "BUSINESS_STATE_WORKPAPER_CONSTANTS");
    if (state.closingFolder !== null) requireInvariant(state.workpaper.closingFolderId === state.closingFolder.id, "BUSINESS_STATE_WORKPAPER_FOLDER_BINDING");
    if (state.outcome === "COMPLETED") {
      requireInvariant(state.workpaper.status === "REVIEWED" && state.workpaper.reviewComment === null
        && state.workpaper.basisImportVersion === 1 && state.workpaper.basisTaxonomyVersion === 2
        && state.workpaper.evidenceCount === 0 && state.workpaper.reviewedByUserId === state.reviewerUserId,
      "BUSINESS_STATE_WORKPAPER_COMPLETED_CONSTANTS");
      parseUtcMicroseconds(state.workpaper.reviewedAtUtc, "BUSINESS_STATE_WORKPAPER_REVIEWED_AT");
    }
  }
  if (state.document !== null) {
    requireInvariant(state.document.anchorCode === "BS.ASSET.CURRENT_SECTION"
      && state.document.fileName === "evidence-bank-reconciliation-fy2025-v1.csv"
      && state.document.mediaType === "text/csv" && state.document.byteSize === 184
      && state.document.checksumSha256 === "f5bb9a7ec0df043a8e845d10f029c2bdd6dd7ea2f62f9935f48cdc0d95339b27"
      && state.document.sourceLabel === "Ritomer internal synthetic fixture 043"
      && state.document.documentDate === "2025-12-31" && state.document.storageBackend === "LOCAL_FS", "BUSINESS_STATE_DOCUMENT_CONSTANTS");
    if (state.workpaper !== null) requireInvariant(state.document.workpaperId === state.workpaper.id, "BUSINESS_STATE_DOCUMENT_WORKPAPER_BINDING");
    if (state.outcome === "COMPLETED") {
      requireInvariant(state.document.verificationStatus === "VERIFIED" && state.document.reviewComment === null
        && state.document.reviewedByUserId === state.reviewerUserId, "BUSINESS_STATE_DOCUMENT_COMPLETED_CONSTANTS");
      parseUtcMicroseconds(state.document.reviewedAtUtc, "BUSINESS_STATE_DOCUMENT_REVIEWED_AT");
    }
  }
  if (state.exportPack !== null) {
    if (state.closingFolder !== null) requireInvariant(state.exportPack.closingFolderId === state.closingFolder.id, "BUSINESS_STATE_EXPORT_FOLDER_BINDING");
    if (state.outcome === "COMPLETED") {
      requireInvariant(SHA256_PATTERN.test(state.exportPack.idempotencyKeySha256)
        && SHA256_PATTERN.test(state.exportPack.storageObjectKeySha256)
        && SHA256_PATTERN.test(state.exportPack.sourceFingerprint)
        && SHA256_PATTERN.test(state.exportPack.checksumSha256)
        && state.closingFolder !== null
        && state.exportPack.fileName === `closing-folder-${state.closingFolder.id}-export-pack-${state.exportPack.id}.zip`
        && state.exportPack.storageBackend === "LOCAL_FS" && state.exportPack.mediaType === "application/zip"
        && Number.isSafeInteger(state.exportPack.byteSize) && state.exportPack.byteSize > 0
        && state.exportPack.basisImportVersion === 1 && state.exportPack.basisTaxonomyVersion === 2
        && state.exportPack.createdByUserId === state.accountantUserId, "BUSINESS_STATE_EXPORT_COMPLETED_CONSTANTS");
      parseUtcMicroseconds(state.exportPack.createdAtUtc, "BUSINESS_STATE_EXPORT_CREATED_AT");
    }
  }
  requireInvariant(typeof state.minimalAnnexVerified === "boolean"
    && typeof state.usefulnessAssessmentCompleted === "boolean", "BUSINESS_STATE_BOOLEAN_TYPES");
  if (state.outcome === "COMPLETED") {
    requireInvariant(state.lastCompletedTask === "T14"
      && [state.tenantId, state.accountantUserId, state.reviewerUserId, state.closingFolder,
        state.balanceImport, state.workpaper, state.document, state.exportPack].every((value) => value !== null)
      && state.mappings.length === 7 && state.minimalAnnexVerified === true
      && state.usefulnessAssessmentCompleted === true, "BUSINESS_STATE_COMPLETED");
  }
  for (const key of ["run", "outcome", "lastCompletedTask"]) {
    if (expected[key] !== undefined) requireInvariant(state[key] === expected[key], `BUSINESS_STATE_${key}_MISMATCH`);
  }
  return { state, bytes, sha256: sha256(bytes) };
}

function validateEvidenceBytes(bytes, bindings = {}) {
  const evidence = parseCanonicalJsonBytes(bytes, EVIDENCE_KEYS, "EVIDENCE");
  requireInvariant(evidence.schemaVersion === 2 && ["R1", "R2"].includes(evidence.run), "EVIDENCE_IDENTITY");
  requireInvariant(["COMPLETED", "ABORTED"].includes(evidence.outcome), "EVIDENCE_OUTCOME");
  requireInvariant(evidence.lastCompletedTask === null || /^T(?:0\d|1[0-4])$/.test(evidence.lastCompletedTask), "EVIDENCE_LAST_TASK");
  parseUtc(evidence.runEndedAtUtc, "EVIDENCE_ENDED_AT");
  if (evidence.runStartedAtUtc !== null) {
    const started = parseUtc(evidence.runStartedAtUtc, "EVIDENCE_STARTED_AT");
    requireInvariant(started <= Date.parse(evidence.runEndedAtUtc), "EVIDENCE_TIME_ORDER");
  }
  requireInvariant(evidence.protocolId === PROTOCOL_ID && SHA256_PATTERN.test(evidence.protocolSha256)
    && SHA1_PATTERN.test(evidence.frozenCommit) && SHA256_PATTERN.test(evidence.resourceTargetSha256)
    && evidence.resourceTargetSha256 === RESOURCE_DESCRIPTORS[evidence.run].sha256, "EVIDENCE_BINDING_SHAPES");
  requireInvariant(evidence.expectedBusinessEventCount === 15
    && Number.isSafeInteger(evidence.missingExpectedBusinessEventCount)
    && evidence.missingExpectedBusinessEventCount >= 0 && evidence.missingExpectedBusinessEventCount <= 15
    && Number.isSafeInteger(evidence.unexpectedBusinessEventCount)
    && evidence.unexpectedBusinessEventCount >= 0, "EVIDENCE_COUNTS");
  for (const key of ["auditProjectionSha256", "businessStateSha256", "evidenceContentSha256", "qualificationSha256"]) {
    requireInvariant(SHA256_PATTERN.test(evidence[key]), `EVIDENCE_${key}_SHAPE`);
  }
  if (evidence.outcome === "COMPLETED") {
    requireInvariant(evidence.lastCompletedTask === "T14" && evidence.abortReasonCode === null
      && evidence.runStartedAtUtc !== null && evidence.missingExpectedBusinessEventCount === 0
      && evidence.unexpectedBusinessEventCount === 0, "EVIDENCE_COMPLETED_CONTRACT");
  } else {
    requireInvariant(CLOSED_ABORT_REASONS.has(evidence.abortReasonCode), "EVIDENCE_ABORT_REASON");
    const nullableStart = evidence.lastCompletedTask === null || evidence.lastCompletedTask === "T00";
    requireInvariant(evidence.runStartedAtUtc !== null || nullableStart, "EVIDENCE_ABORT_START_CONVENTION");
  }

  if (bindings.qualificationSha256 !== undefined) {
    requireInvariant(evidence.qualificationSha256 === bindings.qualificationSha256, "EVIDENCE_QUALIFICATION_MISMATCH");
  }
  if (bindings.protocolSha256 !== undefined) requireInvariant(evidence.protocolSha256 === bindings.protocolSha256, "EVIDENCE_PROTOCOL_MISMATCH");
  if (bindings.frozenCommit !== undefined) requireInvariant(evidence.frozenCommit === bindings.frozenCommit, "EVIDENCE_FROZEN_MISMATCH");

  if (bindings.auditProjectionBytes !== undefined) {
    const projection = validateAuditProjectionBytes(bindings.auditProjectionBytes, evidence);
    requireInvariant(projection.sha256 === evidence.auditProjectionSha256, "EVIDENCE_AUDIT_PROJECTION_HASH");
    requireInvariant(projection.projection.expectedBusinessEventCount === evidence.expectedBusinessEventCount
      && projection.projection.missingExpectedBusinessEventCount === evidence.missingExpectedBusinessEventCount
      && projection.projection.unexpectedBusinessEventCount === evidence.unexpectedBusinessEventCount, "EVIDENCE_AUDIT_COUNTS");
  }
  if (bindings.businessStateBytes !== undefined) {
    const state = validateBusinessStateBytes(bindings.businessStateBytes, evidence);
    requireInvariant(state.sha256 === evidence.businessStateSha256, "EVIDENCE_BUSINESS_STATE_HASH");
  }

  const descriptor = {};
  for (const key of EVIDENCE_DESCRIPTOR_KEYS) descriptor[key] = evidence[key];
  const descriptorBytes = canonicalObjectBytes(descriptor, EVIDENCE_DESCRIPTOR_KEYS, "EVIDENCE_DESCRIPTOR");
  requireInvariant(sha256(descriptorBytes) === evidence.evidenceContentSha256, "EVIDENCE_CONTENT_HASH");
  return { evidence, bytes, descriptorBytes, sha256: sha256(bytes) };
}

function d7EvidenceIndexSha256(r1EvidenceSha256, r2EvidenceSha256) {
  requireInvariant(SHA256_PATTERN.test(r1EvidenceSha256) && SHA256_PATTERN.test(r2EvidenceSha256), "D7_INDEX_HASH_INPUT");
  const index = Buffer.from(`R1=${r1EvidenceSha256}\nR2=${r2EvidenceSha256}\n`, "ascii");
  requireInvariant(index.length === 136, "D7_INDEX_BYTE_LENGTH");
  return sha256(index);
}

function validateAvailableArtifactBindings(records, artifacts, protocolSha256) {
  const d5 = records.find((record) => record.decisionId === "D5");
  const d6 = records.find((record) => record.decisionId === "D6");
  const d7 = records.find((record) => record.decisionId === "D7");
  if (d5 === undefined && artifacts === undefined) return {};
  if (d5 !== undefined) {
    requireInvariant(artifacts !== null && typeof artifacts === "object" && !Array.isArray(artifacts),
      "ARTIFACT_QUALIFICATION_REQUIRED");
  } else {
    requireInvariant(artifacts !== null && typeof artifacts === "object" && !Array.isArray(artifacts),
      "ARTIFACT_BINDINGS_OBJECT");
  }
  const allowedKeys = new Set([
    "qualificationBytes", "qualificationPreimages",
    "r1EvidenceBytes", "r1AuditProjectionBytes", "r1BusinessStateBytes",
    "r2EvidenceBytes", "r2AuditProjectionBytes", "r2BusinessStateBytes",
  ]);
  requireInvariant(Object.keys(artifacts).every((key) => allowedKeys.has(key)), "ARTIFACT_BINDINGS_PROPERTY");
  requireInvariant(artifacts.qualificationPreimages === undefined
    || artifacts.qualificationBytes !== undefined, "ARTIFACT_QUALIFICATION_BUNDLE_INCOMPLETE");
  const r1BindingCount = ["r1EvidenceBytes", "r1AuditProjectionBytes", "r1BusinessStateBytes"]
    .filter((key) => artifacts[key] !== undefined).length;
  requireInvariant(r1BindingCount === 0 || r1BindingCount === 3, "ARTIFACT_R1_BUNDLE_INCOMPLETE");
  const r2BindingCount = ["r2EvidenceBytes", "r2AuditProjectionBytes", "r2BusinessStateBytes"]
    .filter((key) => artifacts[key] !== undefined).length;
  requireInvariant(r2BindingCount === 0 || r2BindingCount === 3, "ARTIFACT_R2_BUNDLE_INCOMPLETE");
  if (d5 !== undefined) {
    requireInvariant(Buffer.isBuffer(artifacts.qualificationBytes), "ARTIFACT_QUALIFICATION_REQUIRED");
  }
  if (d6 !== undefined) {
    requireInvariant(Buffer.isBuffer(artifacts.r1EvidenceBytes)
      && Buffer.isBuffer(artifacts.r1AuditProjectionBytes)
      && Buffer.isBuffer(artifacts.r1BusinessStateBytes), "ARTIFACT_R1_BUNDLE_REQUIRED");
  }
  if (d7 !== undefined) {
    requireInvariant(Buffer.isBuffer(artifacts.r2EvidenceBytes)
      && Buffer.isBuffer(artifacts.r2AuditProjectionBytes)
      && Buffer.isBuffer(artifacts.r2BusinessStateBytes), "ARTIFACT_R2_BUNDLE_REQUIRED");
  }
  let qualification;
  if (artifacts.qualificationBytes !== undefined) {
    qualification = validateQualificationBytes(artifacts.qualificationBytes, {
      protocolSha256,
      frozenCommit: d5?.frozenCommit,
      reviewRefs: records.find((record) => record.reviewRefs !== null)?.reviewRefs,
      preimages: artifacts.qualificationPreimages,
    });
    if (d5 !== undefined) requireInvariant(qualification.sha256 === d5.qualificationSha256, "LEDGER_QUALIFICATION_FILE_HASH");
  }
  const commonBindings = {
    protocolSha256,
    frozenCommit: d5?.frozenCommit,
    qualificationSha256: qualification?.sha256 ?? d5?.qualificationSha256,
  };
  let r1;
  let r2;
  if (artifacts.r1EvidenceBytes !== undefined) {
    r1 = validateEvidenceBytes(artifacts.r1EvidenceBytes, {
      ...commonBindings,
      auditProjectionBytes: artifacts.r1AuditProjectionBytes,
      businessStateBytes: artifacts.r1BusinessStateBytes,
    });
    requireInvariant(r1.evidence.run === "R1", "ARTIFACT_R1_RUN");
    if (d6 !== undefined) {
      requireInvariant(r1.sha256 === d6.evidenceSha256, "LEDGER_D6_FILE_HASH");
      requireInvariant((r1.evidence.outcome === "COMPLETED" ? "R1" : null) === d6.completedRun, "LEDGER_D6_COMPLETED_RUN_BINDING");
    }
  }
  if (artifacts.r2EvidenceBytes !== undefined) {
    r2 = validateEvidenceBytes(artifacts.r2EvidenceBytes, {
      ...commonBindings,
      auditProjectionBytes: artifacts.r2AuditProjectionBytes,
      businessStateBytes: artifacts.r2BusinessStateBytes,
    });
    requireInvariant(r2.evidence.run === "R2", "ARTIFACT_R2_RUN");
    requireInvariant(r1 !== undefined, "ARTIFACT_R2_REQUIRES_R1");
    if (d7 !== undefined) {
      requireInvariant(d7EvidenceIndexSha256(r1.sha256, r2.sha256) === d7.evidenceSha256, "LEDGER_D7_INDEX_HASH");
      requireInvariant((r2.evidence.outcome === "COMPLETED" ? "R2" : "R1") === d7.completedRun, "LEDGER_D7_COMPLETED_RUN_BINDING");
    }
  }
  const terminal = records.at(-1);
  if (terminal.decisionId === "F1") {
    requireInvariant(r1 === undefined || (r1.evidence.outcome === "COMPLETED"
      && r1.evidence.missingExpectedBusinessEventCount === 0 && r1.evidence.unexpectedBusinessEventCount === 0), "ARTIFACT_F1_R1_NOT_COMPLETE");
    requireInvariant(r2 === undefined || (r2.evidence.outcome === "COMPLETED"
      && r2.evidence.missingExpectedBusinessEventCount === 0 && r2.evidence.unexpectedBusinessEventCount === 0), "ARTIFACT_F1_R2_NOT_COMPLETE");
  }
  return { qualification, r1, r2 };
}

function parseUtc(value, code) {
  requireInvariant(typeof value === "string" && UTC_MILLISECONDS_PATTERN.test(value), `${code}_FORMAT`);
  const milliseconds = Date.parse(value);
  requireInvariant(Number.isFinite(milliseconds) && new Date(milliseconds).toISOString() === value, `${code}_VALUE`);
  return milliseconds;
}

function validateReviewRefs(reviewRefs) {
  exactKeys(reviewRefs, REVIEW_REF_KEYS, "REVIEW_REFS");
  for (const key of ["p0ReviewedHead", "p0ReviewedTree", "p0MergeCommit", "p0MergeTree"]) {
    requireInvariant(SHA1_PATTERN.test(reviewRefs[key]), `REVIEW_REFS_${key}_SHA`);
  }
  requireInvariant(reviewRefs.p0ReviewedTree === reviewRefs.p0MergeTree, "REVIEW_REFS_TREE_MISMATCH");
  requireInvariant(reviewRefs.p0MergeCommit !== reviewRefs.p0ReviewedHead, "REVIEW_REFS_MERGE_EQUALS_HEAD");
  for (const [key, prefix] of Object.entries(REVIEW_REF_PATTERNS)) {
    requireInvariant(reviewRefs[key] === `${prefix}${reviewRefs.p0ReviewedHead}`, `REVIEW_REFS_${key}_VALUE`);
  }
}

function validateAuthorizations(authorizations) {
  exactKeys(authorizations, AUTHORIZATION_KEYS, "AUTHORIZATIONS");
  for (const key of AUTHORIZATION_KEYS) {
    requireInvariant(authorizations[key] === false, `AUTHORIZATION_${key}_MUST_BE_FALSE`);
  }
}

function decisionIndex(decisionId) {
  if (/^D[0-7]$/.test(decisionId)) return Number(decisionId.slice(1));
  return Number.POSITIVE_INFINITY;
}

function validateLedgerBytes(bytes, options = {}) {
  requireInvariant(bytes.length <= MAX_C043C_BYTES, "LEDGER_SIZE_LIMIT");
  const text = strictUtf8Text(bytes, "LEDGER");
  requireInvariant(bytes[0] === 0x7b, "LEDGER_FIRST_BYTE");
  const lines = text.split("\n");
  requireInvariant(lines.at(-1) === "", "LEDGER_TERMINAL_LINE");
  lines.pop();
  requireInvariant(lines.length > 0 && lines.every((line) => line.length > 0), "LEDGER_EMPTY_LINE");

  const records = [];
  let previousRecordedAt = -1;
  let previousAuthorityAt = -1;
  let previousLine;
  let stableProtocolHash;
  let stableReviewRefs;
  let stableQualification;
  let stableFrozen;

  for (let index = 0; index < lines.length; index += 1) {
    const record = parseCanonicalObjectLine(lines[index], LEDGER_KEYS, "LEDGER_RECORD");
    requireInvariant(record.schemaVersion === 2 && record.ledgerId === LEDGER_ID, "LEDGER_IDENTITY");
    requireInvariant(record.sequence === index, "LEDGER_SEQUENCE");
    requireInvariant(typeof record.decisionId === "string" && Object.hasOwn(DECISIONS, record.decisionId), "LEDGER_DECISION_ID");
    requireInvariant(!records.some((prior) => prior.decisionId === record.decisionId), "LEDGER_DECISION_DUPLICATE");
    const definition = DECISIONS[record.decisionId];
    requireInvariant(record.state === definition.state, "LEDGER_STATE");

    const prior = records.at(-1);
    const priorDecision = prior?.decisionId ?? null;
    requireInvariant(ALLOWED_PREVIOUS_DECISIONS.get(record.decisionId).includes(priorDecision), "LEDGER_TRANSITION");
    requireInvariant(record.previousState === (prior?.state ?? null), "LEDGER_PREVIOUS_STATE");
    const expectedPreviousHash = previousLine === undefined
      ? null
      : sha256(Buffer.from(`${previousLine}\n`, "utf8"));
    requireInvariant(record.previousRecordSha256 === expectedPreviousHash, "LEDGER_PREVIOUS_RECORD_SHA256");

    const recordedAt = parseUtc(record.recordedAtUtc, "LEDGER_RECORDED_AT");
    const authorityAt = parseUtc(record.authorityOccurredAtUtc, "LEDGER_AUTHORITY_AT");
    requireInvariant(recordedAt >= authorityAt, "LEDGER_RECORDED_BEFORE_AUTHORITY");
    requireInvariant(recordedAt > previousRecordedAt, "LEDGER_RECORDED_AT_NOT_INCREASING");
    requireInvariant(authorityAt > previousAuthorityAt, "LEDGER_AUTHORITY_AT_NOT_INCREASING");
    if (definition.authorityOccurredAtUtc !== undefined) {
      requireInvariant(record.authorityOccurredAtUtc === definition.authorityOccurredAtUtc, "LEDGER_FIXED_AUTHORITY_AT");
    }
    requireInvariant(record.recordedByRole === definition.role, "LEDGER_ROLE");
    requireInvariant(record.authorityType === definition.authorityType, "LEDGER_AUTHORITY_TYPE");
    requireInvariant(record.authorityRef === definition.authorityRef, "LEDGER_AUTHORITY_REF");
    requireInvariant(record.incidentId === INCIDENT_ID && record.incidentSha256 === INCIDENT_SHA256, "LEDGER_INCIDENT_BINDING");

    const ordinal = decisionIndex(record.decisionId);
    if (ordinal < 2) {
      requireInvariant(record.protocolId === null && record.protocolSha256 === null, "LEDGER_PROTOCOL_PRE_D2");
    } else {
      requireInvariant(record.protocolId === PROTOCOL_ID && SHA256_PATTERN.test(record.protocolSha256), "LEDGER_PROTOCOL_FROM_D2");
      stableProtocolHash ??= record.protocolSha256;
      requireInvariant(record.protocolSha256 === stableProtocolHash, "LEDGER_PROTOCOL_HASH_NOT_STABLE");
      if (options.protocolSha256 !== undefined) {
        requireInvariant(record.protocolSha256 === options.protocolSha256, "LEDGER_PROTOCOL_HASH_MISMATCH");
      }
    }

    if (ordinal < 3) {
      requireInvariant(record.reviewRefs === null, "LEDGER_REVIEW_REFS_PRE_D3");
    } else {
      validateReviewRefs(record.reviewRefs);
      stableReviewRefs ??= JSON.stringify(record.reviewRefs);
      requireInvariant(JSON.stringify(record.reviewRefs) === stableReviewRefs, "LEDGER_REVIEW_REFS_NOT_STABLE");
    }

    if (ordinal < 5) {
      requireInvariant(record.qualificationSha256 === null, "LEDGER_QUALIFICATION_PRE_D5");
      requireInvariant(record.frozenCommit === null, "LEDGER_FROZEN_PRE_D5");
    } else {
      requireInvariant(SHA256_PATTERN.test(record.qualificationSha256), "LEDGER_QUALIFICATION_FROM_D5");
      requireInvariant(SHA1_PATTERN.test(record.frozenCommit), "LEDGER_FROZEN_FROM_D5");
      stableQualification ??= record.qualificationSha256;
      stableFrozen ??= record.frozenCommit;
      requireInvariant(record.qualificationSha256 === stableQualification, "LEDGER_QUALIFICATION_NOT_STABLE");
      requireInvariant(record.frozenCommit === stableFrozen, "LEDGER_FROZEN_NOT_STABLE");
      if (options.expectedFrozen !== undefined) {
        requireInvariant(record.frozenCommit === options.expectedFrozen, "LEDGER_FROZEN_BINDING");
      }
    }

    if (record.decisionId === "D6") {
      requireInvariant((record.completedRun === null || record.completedRun === "R1")
        && SHA256_PATTERN.test(record.evidenceSha256), "LEDGER_D6_EVIDENCE");
    } else if (record.decisionId === "D7") {
      requireInvariant(prior.completedRun === "R1", "LEDGER_D7_REQUIRES_COMPLETE_R1");
      requireInvariant((record.completedRun === "R1" || record.completedRun === "R2")
        && SHA256_PATTERN.test(record.evidenceSha256), "LEDGER_D7_EVIDENCE");
    } else if (record.decisionId.startsWith("F")) {
      if (record.decisionId === "F1") {
        requireInvariant(prior.decisionId === "D7" && prior.completedRun === "R2", "LEDGER_F1_REQUIRES_COMPLETE_R2");
      }
      requireInvariant(record.cpoOutcome === record.state, "LEDGER_TERMINAL_OUTCOME");
      requireInvariant(record.completedRun === prior.completedRun && record.evidenceSha256 === prior.evidenceSha256, "LEDGER_TERMINAL_EVIDENCE_STABILITY");
    } else {
      requireInvariant(record.completedRun === null && record.evidenceSha256 === null, "LEDGER_EVIDENCE_NULLABILITY");
      requireInvariant(record.cpoOutcome === null, "LEDGER_CPO_OUTCOME_NULLABILITY");
    }
    if (!record.decisionId.startsWith("F")) requireInvariant(record.cpoOutcome === null, "LEDGER_NON_TERMINAL_OUTCOME");
    validateAuthorizations(record.authorizations);

    previousRecordedAt = recordedAt;
    previousAuthorityAt = authorityAt;
    previousLine = lines[index];
    records.push(record);
  }

  if (options.expectedDecision !== undefined) {
    const expected = Array.isArray(options.expectedDecision) ? options.expectedDecision : [options.expectedDecision];
    requireInvariant(expected.includes(records.at(-1).decisionId), "LEDGER_PHASE_DECISION");
  }
  const artifactProfile = loadArtifactProfile(records, options.artifactInput);
  validateAuthorityArtifactBindings(records, artifactProfile?.authorities);
  validateAvailableArtifactBindings(records, artifactProfile?.artifacts, stableProtocolHash);
  return { records, lines, protocolSha256: stableProtocolHash, artifactProfile };
}

function validateV1Bytes(reader) {
  const protocolBlock = validateExactMarkedHash(
    reader(V1_RUNBOOK_PATH), V1_PROTOCOL_BEGIN, V1_PROTOCOL_END,
    V1_PROTOCOL_BYTES, V1_PROTOCOL_SHA256, "V1_PROTOCOL",
  );
  const ledgerBlock = validateExactMarkedHash(
    reader(SPEC_PATH), V1_LEDGER_BEGIN, V1_LEDGER_END,
    V1_LEDGER_BYTES, V1_LEDGER_SHA256, "V1_LEDGER",
  );
  return { protocolBlock, ledgerBlock };
}

function validateIncident(reader) {
  return validateExactMarkedHash(
    reader(SPEC_PATH), INCIDENT_BEGIN, INCIDENT_END,
    INCIDENT_BYTE_LENGTH, INCIDENT_SHA256, "INCIDENT_SELECTION",
  );
}

function countTextOccurrences(text, value) {
  return text.split(value).length - 1;
}

function validateProtocolSemantics(text, runbookText) {
  requireInvariant(text.startsWith(`protocolId=${PROTOCOL_ID}\nprotocolVersion=2\nclassification=INTERNAL_SYNTHETIC_ONLY\ncurrentDurableState=${DECISIONS.D2.state}\nexecutionAuthorized=false\nfallbackV1=false\n`), "V2_PROTOCOL_IDENTITY_HEADER");
  requireInvariant(!/\b(?:executionAuthorized|fallbackV1)\s*=\s*true\b/i.test(text), "V2_PROTOCOL_POSITIVE_EXECUTION_SELECTION");
  for (const boundary of [
    "LOCAL_SYNTHETIC_ONLY=true", "V1_EXECUTION_AUTHORIZED=false", "V2_EXECUTION_AUTHORIZED=false",
    "R1_AUTHORIZED=false", "R2_AUTHORIZED=false", "EXTERNAL_USE_AUTHORIZED=false",
    "REAL_DATA_AUTHORIZED=false", "PRODUCTION_AUTHORIZED=false",
  ]) {
    requireInvariant(countTextOccurrences(runbookText, boundary) === 1, "V2_PROTOCOL_PERMANENT_BOUNDARY");
  }

  for (const [decisionId, definition] of Object.entries(DECISIONS)) {
    const stateRow = `| ${decisionId} | ${definition.state} | ${definition.role} | ${definition.authorityType} |`;
    const authorityRow = `| ${decisionId} | ${definition.authorityRef} |`;
    requireInvariant(countTextOccurrences(text, stateRow) === 1, "V2_PROTOCOL_DECISION_TUPLE");
    requireInvariant(countTextOccurrences(text, authorityRow) === 1, "V2_PROTOCOL_AUTHORITY_REF");
  }
  requireInvariant(text.includes("F1 is allowed only after complete D7. F2/F3\nmay follow D6 or D7."), "V2_PROTOCOL_TERMINAL_TRANSITIONS");
  requireInvariant(text.includes("R1 aborted may reach D6 only after verified cleanup, completedRun=null, and\nthen permits F2/F3 only. R2 cannot start. R2 aborted may reach D7 after\ncomplete R1 and verified cleanup, completedRun=R1, and permits F2/F3 only."), "V2_PROTOCOL_ABORT_TRANSITIONS");
  requireInvariant(text.includes("Allowed abort reasons: HARD_STOP, OPERATOR_INTERRUPTION, ENVIRONMENT_FAILURE,\nPROTOCOL_DEVIATION, EVIDENCE_INCOMPLETE."), "V2_PROTOCOL_ABORT_REASONS");

  const taskRows = text.match(/^\| T\d{2} \|.*\|$/gm) ?? [];
  requireInvariant(taskRows.length === 16 && sameArray(taskRows, TASK_ROWS), "V2_PROTOCOL_TASK_ROWS");
  const auditRows = text.match(/^\| (?:\d+|\d+-\d+) \| [A-Z_.]+ \| [A-Z_]+ \| (?:ACCOUNTANT|REVIEWER) \|$/gm) ?? [];
  requireInvariant(sameArray(auditRows, AUDIT_ROWS), "V2_PROTOCOL_AUDIT_ROWS");
  const representedAuditSlots = auditRows.reduce((count, row) => {
    const slot = /^\| (\d+)(?:-(\d+))? \|/.exec(row);
    return count + (slot[2] === undefined ? 1 : Number(slot[2]) - Number(slot[1]) + 1);
  }, 0);
  requireInvariant(representedAuditSlots === 15, "V2_PROTOCOL_AUDIT_SLOT_COUNT");
  requireInvariant(countTextOccurrences(text, "~~~sql\n") === 1, "V2_PROTOCOL_AUDIT_QUERY_COUNT");
  const auditQueryStart = text.indexOf("~~~sql\n") + "~~~sql\n".length;
  const auditQueryEnd = text.indexOf("~~~\n", auditQueryStart);
  requireInvariant(auditQueryEnd > auditQueryStart, "V2_PROTOCOL_AUDIT_QUERY_END");
  const auditQueryBytes = Buffer.from(text.slice(auditQueryStart, auditQueryEnd), "utf8");
  requireInvariant(auditQueryBytes.length === AUDIT_QUERY_BYTES
    && auditQueryBytes.at(-1) === 0x0a && sha256(auditQueryBytes) === AUDIT_QUERY_SHA256,
  "V2_PROTOCOL_AUDIT_QUERY_HASH");
  for (const [account, target] of MAPPING_ROWS) {
    requireInvariant(countTextOccurrences(text, `| ${account} | ${target} |`) === 1, "V2_PROTOCOL_MAPPING_TUPLE");
  }

  const qualificationRows = text.match(/^\| Q[1-7] \|.*\| 043C_V2_Q[1-7]_[A-Z0-9_]+ \|$/gm) ?? [];
  requireInvariant(qualificationRows.length === 7, "V2_PROTOCOL_QUALIFICATION_ROWS");
  for (let index = 0; index < QUALIFICATION_ERROR_CODES.length; index += 1) {
    requireInvariant(qualificationRows[index].startsWith(`| Q${index + 1} |`)
      && qualificationRows[index].endsWith(`| ${QUALIFICATION_ERROR_CODES[index]} |`), "V2_PROTOCOL_QUALIFICATION_CODE");
  }

  for (const [run, descriptor] of Object.entries(RESOURCE_DESCRIPTORS)) {
    const bytes = Buffer.from(descriptor.bytes, "utf8");
    requireInvariant(bytes.length === 180 && sha256(bytes) === descriptor.sha256, "V2_PROTOCOL_RESOURCE_DESCRIPTOR_CONSTANT");
    requireInvariant(countTextOccurrences(text, descriptor.bytes) === 1, "V2_PROTOCOL_RESOURCE_DESCRIPTOR");
    requireInvariant(text.includes(`${run} SHA-256: ${descriptor.sha256}.`), "V2_PROTOCOL_RESOURCE_DESCRIPTOR_HASH");
  }
  return true;
}

function validateProtocolV2(reader) {
  const runbookBytes = reader(V2_RUNBOOK_PATH);
  const runbookText = strictUtf8Text(runbookBytes, "V2_RUNBOOK");
  const block = extractMarkedContent(runbookBytes, PROTOCOL_V2_BEGIN, PROTOCOL_V2_END, "V2_PROTOCOL");
  const text = STRICT_UTF8.decode(block.content);
  validateProtocolSemantics(text, runbookText);
  requireInvariant(!/\b(?:V1_EXECUTION_AUTHORIZED|V2_EXECUTION_AUTHORIZED|R1_AUTHORIZED|R2_AUTHORIZED|EXTERNAL_USE_AUTHORIZED|REAL_DATA_AUTHORIZED|PRODUCTION_AUTHORIZED)\s*=\s*YES\b/.test(text), "V2_PROTOCOL_EXECUTION_SELECTION");
  requireInvariant(!/fallbackV1\s*=\s*true/i.test(text), "V2_PROTOCOL_V1_FALLBACK");
  return { ...block, sha256: sha256(block.content), text };
}

function validateV1PermanentQuarantineSource(v1Source) {
  const validateSet = /\[ValidateSet\(([^]*?)\)\]\s*\[string\]\s*\$Mode/.exec(v1Source);
  requireInvariant(validateSet !== null, "V1_VALIDATOR_MODE_SET_MISSING");
  const modes = [...validateSet[1].matchAll(/'([^']+)'/g)].map((match) => match[1]);
  requireInvariant(sameArray(modes, [
    "SelfTest", "PreparationPreflight", "PreR1", "PostR1Cleanup", "PreR2", "PostR2Cleanup",
  ]), "V1_VALIDATOR_MODE_SET");

  const initialization = v1Source.indexOf("$script:ProtocolId");
  requireInvariant(initialization > 0, "V1_VALIDATOR_INITIALIZATION_MARKER");
  const earlyGuard = v1Source.slice(0, initialization);
  requireInvariant(/if\s*\(\s*-not\s+\[string\]::Equals\(\s*\$Mode\s*,\s*'SelfTest'\s*,\s*\[System\.StringComparison\]::Ordinal\s*\)\s*\)/s.test(earlyGuard), "V1_VALIDATOR_EARLY_SELFTEST_GUARD");
  for (const marker of [
    "errorCode=E_V1_EXTERNAL_MODE_PERMANENTLY_DISABLED",
    "V1_EXECUTION=PERMANENTLY_NOT_AUTHORIZED",
    "V2_VALIDATOR_REQUIRED=YES",
    "externalAccessPerformed=false",
    "stateWritePerformed=false",
  ]) {
    requireInvariant(earlyGuard.includes(marker), "V1_VALIDATOR_QUARANTINE_OUTPUT");
  }
  requireInvariant(/\bexit\s+40\b/.test(earlyGuard), "V1_VALIDATOR_EARLY_GUARD_EXIT");
  requireInvariant(!/\b(?:Get-Content|Get-Item|Get-ChildItem|Test-Path|Resolve-Path|Invoke-WebRequest|Invoke-RestMethod|Start-Process|New-Item|Set-Content|Add-Content|Out-File|Remove-Item|Move-Item|Copy-Item|execFileSync|psql|git)\b/i.test(earlyGuard), "V1_VALIDATOR_IO_BEFORE_GUARD");
  requireInvariant(!/validate-controlled-fiduciary-pilot-043c-v2-state\.ps1|043c-internal-rehearsal-v2/i.test(v1Source), "V1_VALIDATOR_V2_IMPORT");
  requireInvariant(!/^\s*(?:\.|&)\s+[^\r\n]*043c-v2-state\.ps1/im.test(v1Source), "V1_VALIDATOR_V2_DOT_SOURCE");

  const executableLines = v1Source.split("\n").filter((line) => !/^\s*function\s+/i.test(line));
  requireInvariant(executableLines.filter((line) => /\bInvoke-SelfTest\b/.test(line)).length === 1, "V1_VALIDATOR_SELFTEST_DISPATCH");
  requireInvariant(executableLines.every((line) => !/\bInvoke-ExternalMode\b/.test(line)), "V1_VALIDATOR_EXTERNAL_DISPATCH");
  return true;
}

function validateReadOnlySources(reader) {
  const nodeBytes = reader(NODE_VALIDATOR_PATH);
  requireInvariant(nodeBytes.equals(readFileSync(SCRIPT_PATH)), "EXECUTING_CHECKER_BLOB_MISMATCH");
  const nodeSource = strictUtf8Text(nodeBytes, "NODE_VALIDATOR");
  const v1Source = strictUtf8Text(reader(V1_VALIDATOR_PATH), "V1_VALIDATOR");
  const powershellSource = strictUtf8Text(reader(POWERSHELL_VALIDATOR_PATH), "POWERSHELL_VALIDATOR");
  const allowedNodeImports = new Set([
    "node:child_process", "node:crypto", "node:fs", "node:path", "node:url", "node:util",
  ]);
  const imports = [...nodeSource.matchAll(/from\s+["']([^"']+)["']/g)].map((match) => match[1]);
  requireInvariant(imports.length > 0 && imports.every((value) => allowedNodeImports.has(value)), "NODE_VALIDATOR_IMPORT_SURFACE");
  requireInvariant(imports.filter((value) => value === "node:fs").length === 1
    && /import\s*\{\s*existsSync,\s*lstatSync,\s*readFileSync,\s*realpathSync\s*}\s*from\s*["']node:fs["']/.test(nodeSource), "NODE_VALIDATOR_FS_READ_ONLY_IMPORT");
  requireInvariant(imports.filter((value) => value === "node:child_process").length === 1
    && /import\s*\{\s*execFileSync\s*}\s*from\s*["']node:child_process["']/.test(nodeSource), "NODE_VALIDATOR_PROCESS_IMPORT");
  const processCalls = [...nodeSource.matchAll(/\bexecFileSync\s*\(/g)].length;
  const gitProcessCalls = [...nodeSource.matchAll(/\bexecFileSync\s*\(\s*["']git["']/g)].length;
  requireInvariant(processCalls === 2 && gitProcessCalls === processCalls, "NODE_VALIDATOR_PROCESS_SURFACE");
  requireInvariant(!/\b(?:require|eval|Function)\s*\(|\bimport\s*\(/.test(nodeSource), "NODE_VALIDATOR_DYNAMIC_EXECUTION_SURFACE");
  requireInvariant(!/validate-controlled-fiduciary-pilot-043c-state\.ps1/.test(powershellSource), "POWERSHELL_VALIDATOR_V1_IMPORT");
  requireInvariant(!/fallbackV1\s*=\s*true/i.test(powershellSource), "POWERSHELL_VALIDATOR_V1_FALLBACK");
  requireInvariant(!/\b(?:Invoke-WebRequest|Invoke-RestMethod|Start-Process|New-Item|Set-Content|Add-Content|Out-File|Remove-Item|Move-Item|Copy-Item)\b/i.test(powershellSource), "POWERSHELL_VALIDATOR_MUTATING_OR_NETWORK_SURFACE");
  validateV1PermanentQuarantineSource(v1Source);
  return true;
}

function validateFoundation(reader, expectedDecision, expectedFrozen = undefined, artifactInput = undefined) {
  validateV1Bytes(reader);
  validateIncident(reader);
  const protocol = validateProtocolV2(reader);
  const ledgerBytes = reader(LEDGER_PATH);
  const ledger = validateLedgerBytes(ledgerBytes, {
    protocolSha256: protocol.sha256,
    expectedDecision,
    expectedFrozen,
    artifactInput,
  });
  validateReadOnlySources(reader);
  validateReviewRefGitBindings(ledger.records);
  return { protocol, ledger, ledgerBytes };
}

function validateP0Artifacts(reader, expectedDecision = "D2") {
  for (const path of P0_PATHS) strictUtf8Text(reader(path), `P0_FILE_${path.replaceAll(/[^A-Za-z0-9]/g, "_")}`);
  return validateFoundation(reader, expectedDecision);
}

function validateSingleLedgerAppend(baseBytes, headBytes) {
  requireInvariant(headBytes.length > baseBytes.length, "LEDGER_APPEND_MISSING");
  requireInvariant(headBytes.subarray(0, baseBytes.length).equals(baseBytes), "LEDGER_PRIOR_BYTES_MUTATED");
  const suffix = headBytes.subarray(baseBytes.length);
  strictUtf8Text(suffix, "LEDGER_APPEND");
  requireInvariant(!suffix.subarray(0, -1).includes(0x0a), "LEDGER_APPEND_RECORD_COUNT");
  return true;
}

function validateReviewRefBindings(refs, bindings) {
  exactKeys(bindings, [
    "reviewedParents", "mergeParents", "reviewedTree", "mergeTree",
    "reviewedChanges", "mergeChanges",
  ], "REVIEW_REF_BINDINGS");
  requireInvariant(refs.p0MergeCommit !== refs.p0ReviewedHead, "P0_MERGE_EQUALS_REVIEWED_HEAD");
  requireInvariant(bindings.reviewedTree === refs.p0ReviewedTree, "REVIEWED_HEAD_TREE_BINDING");
  requireInvariant(bindings.mergeTree === refs.p0MergeTree, "P0_MERGE_TREE_BINDING");
  requireInvariant(refs.p0ReviewedTree === refs.p0MergeTree, "P0_REVIEWED_MERGE_TREE_IDENTITY");
  requireInvariant(sameArray(bindings.reviewedParents, [P0_BASE]), "P0_REVIEWED_HEAD_PARENT");
  requireInvariant(sameArray(bindings.mergeParents, [P0_BASE]), "P0_MERGE_PARENT");
  validateP0Status(bindings.reviewedChanges, true);
  validateP0Status(bindings.mergeChanges, true);
  return true;
}

function validateReviewRefGitBindings(records) {
  const record = records.find((candidate) => candidate.decisionId === "D3");
  if (record === undefined) return;
  const refs = record.reviewRefs;
  ensureCommit(refs.p0ReviewedHead);
  ensureCommit(refs.p0MergeCommit);
  validateReviewRefBindings(refs, {
    reviewedParents: commitParents(refs.p0ReviewedHead),
    mergeParents: commitParents(refs.p0MergeCommit),
    reviewedTree: commitTree(refs.p0ReviewedHead),
    mergeTree: commitTree(refs.p0MergeCommit),
    reviewedChanges: historicalChanges(P0_BASE, refs.p0ReviewedHead),
    mergeChanges: historicalChanges(P0_BASE, refs.p0MergeCommit),
  });
}

function validateDirectSourceTopologyBindings(base, head, parents) {
  requireInvariant(SHA1_PATTERN.test(base) && SHA1_PATTERN.test(head), "SOURCE_TOPOLOGY_SHA");
  requireInvariant(base !== head, "SOURCE_HEAD_EQUALS_BASE");
  requireInvariant(parents.length === 1, "SOURCE_PARENT_COUNT");
  requireInvariant(parents[0] === base, "SOURCE_PARENT_BINDING");
  return true;
}

function validateDirectSourceTopology(base, head) {
  ensureCommit(base);
  ensureCommit(head);
  validateDirectSourceTopologyBindings(base, head, commitParents(head));
}

function validatePostMergeTopologyBindings(bindings) {
  exactKeys(bindings, [
    "base", "source", "final", "sourceParents", "finalParents", "sourceTree", "finalTree",
  ], "POST_MERGE_TOPOLOGY");
  validateDirectSourceTopologyBindings(bindings.base, bindings.source, bindings.sourceParents);
  requireInvariant(SHA1_PATTERN.test(bindings.final)
    && SHA1_PATTERN.test(bindings.sourceTree) && SHA1_PATTERN.test(bindings.finalTree), "POST_MERGE_TOPOLOGY_SHA");
  requireInvariant(bindings.final !== bindings.source && bindings.final !== bindings.base, "POST_MERGE_COMMIT_IDENTITY");
  requireInvariant(bindings.finalParents.length === 1, "POST_MERGE_PARENT_COUNT");
  requireInvariant(bindings.finalParents[0] === bindings.base, "POST_MERGE_PARENT_BINDING");
  requireInvariant(bindings.sourceTree === bindings.finalTree, "POST_MERGE_TREE_MISMATCH");
  return true;
}

function validateP0Source(base, head) {
  if (base !== P0_BASE) fail(3, "P0_BASE_MISMATCH");
  validateDirectSourceTopology(base, head);
  validateP0Status(historicalChanges(base, head), true);
  validateV1Bytes((path) => readCommitFile(base, path));
  return validateP0Artifacts((path) => readCommitFile(head, path));
}

function validateTransitionSource(phase, base, head, artifactInput = undefined) {
  validateDirectSourceTopology(base, head);
  validateLedgerOnlyStatus(historicalChanges(base, head), true);
  const baseReader = (path) => readCommitFile(base, path);
  const headReader = (path) => readCommitFile(head, path);
  const baseLedgerBytes = baseReader(LEDGER_PATH);
  const headLedgerBytes = headReader(LEDGER_PATH);
  validateSingleLedgerAppend(baseLedgerBytes, headLedgerBytes);
  const prior = PHASE_PREVIOUS.get(phase);
  requireInvariant(prior !== undefined, "TRANSITION_PHASE_PREDECESSOR");
  const baseProtocol = validateProtocolV2(baseReader);
  const baseLedger = validateLedgerBytes(baseLedgerBytes, {
    protocolSha256: baseProtocol.sha256,
    expectedDecision: prior,
    artifactInput,
  });
  const inheritedFrozen = baseLedger.records.find((record) => record.decisionId === "D5")?.frozenCommit;
  const expectedFrozen = phase === "P3" ? base : inheritedFrozen;
  const result = validateFoundation(headReader, PHASE_DECISION.get(phase), expectedFrozen, artifactInput);
  return result;
}

function validateSource(phase, base, head, artifactInput = undefined) {
  return phase === "P0"
    ? validateP0Source(base, head)
    : validateTransitionSource(phase, base, head, artifactInput);
}

function validateWorktree(config) {
  const { phase, base } = config;
  ensureCommit(base);
  if (currentHead() !== base) fail(3, "WORKTREE_BASE_NOT_HEAD");
  const staged = gitBytes(["diff", "--cached", "--name-only", "-z"]);
  requireInvariant(staged.length === 0, "WORKTREE_INDEX_NOT_EMPTY");
  const records = currentWorktreeStatus();
  const reader = readWorktreeFile;

  if (phase === "P0") {
    if (base !== P0_BASE) fail(3, "P0_BASE_MISMATCH");
    const branch = gitText(["branch", "--show-current"]).trim();
    if (branch !== P0_BRANCH) fail(3, "P0_BRANCH_MISMATCH");
    validateIndexFlags(P0_MODIFIED_PATHS);
    validateP0Status(records, false);
    if (!gitSucceeds(["diff", "--check"])) fail(4, "P0_DIFF_CHECK");
    validateV1Bytes((path) => readCommitFile(base, path));
    return validateP0Artifacts(reader, ["D1", "D2"]);
  }

  validateIndexFlags(P0_PATHS);
  validateLedgerOnlyStatus(records, false);
  const baseReader = (path) => readCommitFile(base, path);
  const baseLedgerBytes = baseReader(LEDGER_PATH);
  const headLedgerBytes = reader(LEDGER_PATH);
  validateSingleLedgerAppend(baseLedgerBytes, headLedgerBytes);
  const baseProtocol = validateProtocolV2(baseReader);
  const baseLedger = validateLedgerBytes(baseLedgerBytes, {
    protocolSha256: baseProtocol.sha256,
    expectedDecision: PHASE_PREVIOUS.get(phase),
    artifactInput: config.artifactInput,
  });
  const inheritedFrozen = baseLedger.records.find((record) => record.decisionId === "D5")?.frozenCommit;
  const expectedFrozen = phase === "P3" ? base : inheritedFrozen;
  return validateFoundation(reader, PHASE_DECISION.get(phase), expectedFrozen, config.artifactInput);
}

function validatePostMerge(config) {
  const { phase, base, source, final } = config;
  validateSource(phase, base, source, config.artifactInput);
  ensureCommit(final);
  validatePostMergeTopologyBindings({
    base,
    source,
    final,
    sourceParents: commitParents(source),
    finalParents: commitParents(final),
    sourceTree: commitTree(source),
    finalTree: commitTree(final),
  });
  const finalResult = phase === "P0"
    ? validateP0Source(base, final)
    : validateTransitionSource(phase, base, final, config.artifactInput);
  return finalResult;
}

function walkLinearDescendants(frozen, head) {
  ensureCommit(frozen);
  ensureCommit(head);
  requireInvariant(frozen !== head, "FROZEN_DESCENDANTS_EMPTY");
  const reverse = [];
  let cursor = head;
  const seen = new Set();
  while (cursor !== frozen) {
    requireInvariant(!seen.has(cursor), "FROZEN_DESCENDANTS_CYCLE");
    seen.add(cursor);
    const parents = commitParents(cursor);
    requireInvariant(parents.length === 1, "FROZEN_DESCENDANTS_NON_LINEAR");
    reverse.push(cursor);
    cursor = parents[0];
    requireInvariant(reverse.length <= 64, "FROZEN_DESCENDANTS_LIMIT");
  }
  return reverse.reverse();
}

function validateFrozenDescendants(config) {
  const { frozen, head } = config;
  const commits = walkLinearDescendants(frozen, head);
  const frozenReader = (path) => readCommitFile(frozen, path);
  const frozenProtocol = validateProtocolV2(frozenReader);
  const frozenLedger = validateLedgerBytes(frozenReader(LEDGER_PATH), {
    protocolSha256: frozenProtocol.sha256,
    expectedDecision: "D4",
  });
  requireInvariant(frozenLedger.records.at(-1).frozenCommit === null, "FROZEN_BASE_ALREADY_FROZEN");

  let previous = frozen;
  let previousLedgerBytes = frozenReader(LEDGER_PATH);
  for (const commit of commits) {
    const changes = historicalChanges(previous, commit);
    const protectedRecords = protectedChanges(changes);
    if (protectedRecords.length === 0) {
      validateProtectedBytesUnchanged(previous, commit);
    } else {
      validateProtectedLedgerAppendStatus(changes);
      validateProtectedBytesUnchanged(previous, commit, { includeLedger: false });
      const reader = (path) => readCommitFile(commit, path);
      const ledgerBytes = reader(LEDGER_PATH);
      validateSingleLedgerAppend(previousLedgerBytes, ledgerBytes);
      validateFoundation(reader, undefined, frozen, config.artifactInput);
      previousLedgerBytes = ledgerBytes;
    }
    previous = commit;
  }
  const finalReader = (path) => readCommitFile(head, path);
  const finalResult = validateFoundation(finalReader, undefined, frozen, config.artifactInput);
  requireInvariant(decisionIndex(finalResult.ledger.records.at(-1).decisionId) >= 5, "FROZEN_DESCENDANTS_BEFORE_D5");
  validateProtectedBytesUnchanged(frozen, head, { includeLedger: false });
  return finalResult;
}

function validateForensicLedgerAppend(baseSpec, sourceSpec, transition) {
  const baseBlock = extractMarkedContent(baseSpec, V1_LEDGER_BEGIN, V1_LEDGER_END, `${transition.label}_BASE_LEDGER`);
  const sourceBlock = extractMarkedContent(sourceSpec, V1_LEDGER_BEGIN, V1_LEDGER_END, `${transition.label}_SOURCE_LEDGER`);
  requireInvariant(baseBlock.outside.equals(sourceBlock.outside), `${transition.label}_SPEC_OUTSIDE_LEDGER`);
  validateSingleLedgerAppend(baseBlock.content, sourceBlock.content);
  const lines = STRICT_UTF8.decode(sourceBlock.content).trimEnd().split("\n");
  let record;
  try {
    record = JSON.parse(lines.at(-1));
  } catch {
    fail(4, `${transition.label}_LEDGER_JSON`);
  }
  requireInvariant(record.sequence === transition.sequence && record.state === transition.state, `${transition.label}_TRANSITION_RECORD`);
  requireInvariant(record.frozenCommit === transition.frozenCommit, `${transition.label}_FROZEN_BINDING`);
}

function validateForensicTransition(transition) {
  for (const commit of [transition.base, transition.source, transition.merge]) ensureCommit(commit);
  requireInvariant(sameArray(commitParents(transition.source), [transition.base]), `${transition.label}_SOURCE_PARENT`);
  requireInvariant(sameArray(commitParents(transition.merge), [transition.base, transition.source]), `${transition.label}_MERGE_PARENTS`);
  requireInvariant(commitTree(transition.source) === commitTree(transition.merge), `${transition.label}_TREE_IDENTITY`);
  const changes = historicalChanges(transition.base, transition.source);
  requireInvariant(changes.length === 1 && changes[0].status === "M"
    && sameArray(changes[0].paths, [SPEC_PATH]), `${transition.label}_FILE_SET`);
  const baseSpec = readCommitFile(transition.base, SPEC_PATH);
  const sourceSpec = readCommitFile(transition.source, SPEC_PATH);
  validateForensicLedgerAppend(baseSpec, sourceSpec, transition);
  validateExactMarkedHash(
    readCommitFile(transition.source, V1_RUNBOOK_PATH), V1_PROTOCOL_BEGIN, V1_PROTOCOL_END,
    V1_PROTOCOL_BYTES, V1_PROTOCOL_SHA256, `${transition.label}_V1_PROTOCOL`,
  );
}

function validateV1ForensicReplay() {
  for (const transition of FORENSIC_TRANSITIONS) validateForensicTransition(transition);
  validateV1Bytes((path) => readCommitFile(P0_BASE, path));
  return true;
}

function parseCliArgs(args) {
  requireCli(args.length > 0, "CLI_MODE_REQUIRED");
  if (args.includes("--fallback") || args.some((value) => /^V1(?:Execution|ForRuntime|Selection)$/i.test(value))) {
    fail(4, "V1_FALLBACK_OR_SELECTION");
  }
  const values = new Map();
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index];
    const value = args[index + 1];
    requireCli(typeof key === "string" && key.startsWith("--") && value !== undefined && !value.startsWith("--"), "CLI_KEY_VALUE_PAIR");
    requireCli(!values.has(key), "CLI_DUPLICATE_OPTION");
    values.set(key, value);
  }
  const mode = values.get("--mode");
  const definitions = new Map([
    ["SelfTest", []],
    ["Worktree", ["--phase", "--base"]],
    ["Source", ["--phase", "--base", "--head"]],
    ["FrozenDescendants", ["--frozen", "--head"]],
    ["PostMerge", ["--phase", "--base", "--source", "--final"]],
    ["V1ForensicReplay", []],
  ]);
  requireCli(definitions.has(mode), "CLI_MODE_UNSUPPORTED");
  const artifactModes = new Set(["Worktree", "Source", "FrozenDescendants", "PostMerge"]);
  const allowed = new Set(["--mode", ...definitions.get(mode), ...(artifactModes.has(mode) ? ["--artifact-root"] : [])]);
  requireCli([...values.keys()].every((key) => allowed.has(key)), "CLI_OPTION_SURFACE");
  const config = { mode };
  for (const key of definitions.get(mode)) {
    requireCli(values.has(key), "CLI_REQUIRED_OPTION");
    config[key.slice(2)] = values.get(key);
  }
  if (config.phase !== undefined) requireCli(PHASES.includes(config.phase), "CLI_PHASE_UNSUPPORTED");
  const artifactRootRequired = mode === "FrozenDescendants"
    || (["Worktree", "Source", "PostMerge"].includes(mode) && config.phase !== "P0");
  requireCli(values.has("--artifact-root") === artifactRootRequired, "CLI_ARTIFACT_ROOT_SURFACE");
  if (artifactRootRequired) config.artifactRoot = values.get("--artifact-root");
  for (const key of ["base", "head", "frozen", "source", "final"]) {
    if (config[key] !== undefined) requireCli(SHA1_PATTERN.test(config[key]), "CLI_FULL_LOWERCASE_SHA_REQUIRED");
  }
  return config;
}

function requireCli(condition, code) {
  if (!condition) fail(2, code);
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function nominalReviewRefs(
  head = "1".repeat(40), tree = "2".repeat(40), merge = "3".repeat(40),
) {
  return {
    p0ReviewedHead: head,
    p0ReviewedTree: tree,
    cpoPostCodeReviewRef: `${REVIEW_REF_PATTERNS.cpoPostCodeReviewRef}${head}`,
    aiTechnicalReviewRef: `${REVIEW_REF_PATTERNS.aiTechnicalReviewRef}${head}`,
    aiSecurityPrivacyReviewRef: `${REVIEW_REF_PATTERNS.aiSecurityPrivacyReviewRef}${head}`,
    ctoTechnicalGateRef: `${REVIEW_REF_PATTERNS.ctoTechnicalGateRef}${head}`,
    cpoPreMergeReviewRef: `${REVIEW_REF_PATTERNS.cpoPreMergeReviewRef}${head}`,
    p0MergeCommit: merge,
    p0MergeTree: tree,
  };
}

function nominalAuthorityArtifactBytes(definition, refs) {
  return canonicalObjectBytes({
    schemaVersion: 2,
    authorityRef: refs[definition.refKey],
    outcome: "PASS",
    reviewedHead: refs.p0ReviewedHead,
    reviewedTree: refs.p0ReviewedTree,
    classifications: definition.ai ? ["AI_GENERATED", "NOT_HUMAN_SIGNED"] : [],
  }, AUTHORITY_ARTIFACT_KEYS, "SYNTHETIC_AUTHORITY_ARTIFACT");
}

function authorityMutationBytes(bytes, mutate, code) {
  const artifact = JSON.parse(STRICT_UTF8.decode(bytes));
  mutate(artifact);
  return canonicalObjectBytes(artifact, AUTHORITY_ARTIFACT_KEYS, code);
}

function nominalArtifactFiles({
  refs = nominalReviewRefs(), qualification = undefined, r1 = undefined, r2 = undefined,
} = {}) {
  const files = new Map();
  for (const definition of AUTHORITY_ARTIFACT_DEFINITIONS) {
    files.set(definition.path, nominalAuthorityArtifactBytes(definition, refs));
  }
  let qualificationPreimagePaths = null;
  if (qualification !== undefined) {
    files.set(QUALIFICATION_ARTIFACT_PATH, qualification.qualificationBytes);
    qualificationPreimagePaths = qualification.qualificationPreimages.map((preimage) => {
      const nominalPath = `selftest-preimages/${preimage.qId}-nominal.bin`;
      const mutantPath = `selftest-preimages/${preimage.qId}-mutant.bin`;
      files.set(nominalPath, preimage.nominalBytes);
      files.set(mutantPath, preimage.mutantBytes);
      return { qId: preimage.qId, nominalPath, mutantPath };
    });
  }
  if (r1 !== undefined) {
    files.set(RUN_ARTIFACT_PATHS.R1.evidence, r1.evidenceBytes);
    files.set(RUN_ARTIFACT_PATHS.R1.auditProjection, r1.auditProjectionBytes);
    files.set(RUN_ARTIFACT_PATHS.R1.businessState, r1.businessStateBytes);
  }
  if (r2 !== undefined) {
    files.set(RUN_ARTIFACT_PATHS.R2.evidence, r2.evidenceBytes);
    files.set(RUN_ARTIFACT_PATHS.R2.auditProjection, r2.auditProjectionBytes);
    files.set(RUN_ARTIFACT_PATHS.R2.businessState, r2.businessStateBytes);
  }
  return { files, qualificationPreimagePaths };
}

function memoryArtifactInput(bundle) {
  return {
    root: "C:\\043c-v2-selftest-artifacts",
    read: (relativePath) => {
      requireInvariant(bundle.files.has(relativePath), "ARTIFACT_REQUIRED_FILE_MISSING");
      return Buffer.from(bundle.files.get(relativePath));
    },
    qualificationPreimagePaths: bundle.qualificationPreimagePaths,
  };
}

function nominalQualificationBundle() {
  const qualificationPreimages = QUALIFICATION_ERROR_CODES.map((errorCode, index) => {
    const qId = `Q${index + 1}`;
    return {
      qId,
      nominalBytes: canonicalObjectBytes({
        qId, outcome: "PASS", errorCode: null,
      }, ["qId", "outcome", "errorCode"], "SYNTHETIC_QUALIFICATION_NOMINAL_PREIMAGE"),
      mutantBytes: canonicalObjectBytes({
        qId, outcome: "REJECTED", errorCode,
      }, ["qId", "outcome", "errorCode"], "SYNTHETIC_QUALIFICATION_MUTANT_PREIMAGE"),
    };
  });
  const qualifications = QUALIFICATION_ERROR_CODES.map((errorCode, index) => {
    const preimage = qualificationPreimages[index];
    const nominalSha256 = sha256(preimage.nominalBytes);
    return {
      qId: preimage.qId,
      qClosed: true,
      nominal: "PASS",
      nominalSha256,
      mutant: "REJECTED",
      mutantSha256: sha256(preimage.mutantBytes),
      errorCode,
      reviewRef: `043c-v2-q${index + 1}-review-pass-${nominalSha256}`,
    };
  });
  const qualificationBytes = canonicalObjectBytes({
    schemaVersion: 2,
    qualificationId: "043c-v2-q1-q7-qualification",
    ledgerId: LEDGER_ID,
    incidentId: INCIDENT_ID,
    incidentSha256: INCIDENT_SHA256,
    protocolId: PROTOCOL_ID,
    protocolSha256: "a".repeat(64),
    frozenCommit: "b".repeat(40),
    reviewRefs: nominalReviewRefs(),
    qClosed: true,
    qualifications,
    qualifiedAtUtc: "2026-08-02T07:00:00.000Z",
    qualifiedByRole: "RECOVERY_COORDINATOR_043C",
  }, QUALIFICATION_KEYS, "SYNTHETIC_QUALIFICATION");
  return { qualificationBytes, qualificationPreimages };
}

function nominalAuditProjectionBytes(run) {
  const slots = AUDIT_SLOT_EXPECTATIONS.map(([action, resourceType, accountCode, targetCode, actorRole], index) => ({
    slot: index + 1,
    action,
    resourceType,
    accountCode,
    targetCode,
    matchStatus: "MATCHED",
    resourceId: `resource-${index + 1}`,
    occurredAtUtc: `2026-08-02T08:00:00.${String(index + 1).padStart(6, "0")}Z`,
    actorUserId: actorRole === "ACCOUNTANT" ? "accountant-user" : "reviewer-user",
    actorSubjectSha256: "1".repeat(64),
    actorRole,
    requestIdSha256: "2".repeat(64),
    metadataSha256: "3".repeat(64),
  }));
  return canonicalObjectBytes({
    schemaVersion: 2,
    run,
    outcome: "COMPLETED",
    lastCompletedTask: "T14",
    runStartedAtUtc: "2026-08-02T08:00:00.000000Z",
    runEndedAtUtc: "2026-08-02T08:15:00.000000Z",
    tenantId: "synthetic-tenant",
    accountantUserId: "accountant-user",
    reviewerUserId: "reviewer-user",
    slots,
    expectedBusinessEventCount: 15,
    missingExpectedBusinessEventCount: 0,
    unexpectedBusinessEventCount: 0,
  }, AUDIT_PROJECTION_KEYS, "SYNTHETIC_AUDIT_PROJECTION");
}

function nominalBusinessStateBytes(run) {
  const mappings = MAPPING_ROWS.map(([accountCode, targetCode], index) => ({
    id: `mapping-${index + 1}`,
    closingFolderId: "closing-folder",
    accountCode,
    targetCode,
    createdByUserId: "accountant-user",
    updatedByUserId: "accountant-user",
  }));
  return canonicalObjectBytes({
    schemaVersion: 2,
    run,
    outcome: "COMPLETED",
    lastCompletedTask: "T14",
    tenantId: "synthetic-tenant",
    accountantUserId: "accountant-user",
    reviewerUserId: "reviewer-user",
    closingFolder: {
      id: "closing-folder",
      name: `Demo Closing FY2025 043c ${run} internal rehearsal (synthetic)`,
      periodStartOn: "2025-01-01",
      periodEndOn: "2025-12-31",
      externalRef: `DEMO-043C-${run}-INTERNAL-REHEARSAL`,
      status: "DRAFT",
    },
    balanceImport: {
      id: "balance-import",
      closingFolderId: "closing-folder",
      version: 1,
      fileName: "balance-fy2025-v1.csv",
      rowCount: 7,
      totalDebit: "149000.00",
      totalCredit: "149000.00",
    },
    mappings,
    workpaper: {
      id: "workpaper",
      closingFolderId: "closing-folder",
      anchorCode: "BS.ASSET.CURRENT_SECTION",
      noteText: "Synthetic bank reconciliation FY2025.",
      status: "REVIEWED",
      reviewComment: null,
      basisImportVersion: 1,
      basisTaxonomyVersion: 2,
      evidenceCount: 0,
      reviewedAtUtc: "2026-08-02T08:13:00.000000Z",
      reviewedByUserId: "reviewer-user",
    },
    document: {
      id: "document",
      workpaperId: "workpaper",
      anchorCode: "BS.ASSET.CURRENT_SECTION",
      fileName: "evidence-bank-reconciliation-fy2025-v1.csv",
      mediaType: "text/csv",
      byteSize: 184,
      checksumSha256: "f5bb9a7ec0df043a8e845d10f029c2bdd6dd7ea2f62f9935f48cdc0d95339b27",
      sourceLabel: "Ritomer internal synthetic fixture 043",
      documentDate: "2025-12-31",
      storageBackend: "LOCAL_FS",
      verificationStatus: "VERIFIED",
      reviewComment: null,
      reviewedAtUtc: "2026-08-02T08:12:00.000000Z",
      reviewedByUserId: "reviewer-user",
    },
    exportPack: {
      id: "export-pack",
      closingFolderId: "closing-folder",
      idempotencyKeySha256: "4".repeat(64),
      storageObjectKeySha256: "5".repeat(64),
      sourceFingerprint: "7".repeat(64),
      storageBackend: "LOCAL_FS",
      fileName: "closing-folder-closing-folder-export-pack-export-pack.zip",
      mediaType: "application/zip",
      byteSize: 1,
      checksumSha256: "6".repeat(64),
      basisImportVersion: 1,
      basisTaxonomyVersion: 2,
      createdAtUtc: "2026-08-02T08:14:00.000000Z",
      createdByUserId: "accountant-user",
    },
    minimalAnnexVerified: true,
    usefulnessAssessmentCompleted: true,
  }, BUSINESS_STATE_KEYS, "SYNTHETIC_BUSINESS_STATE");
}

function nominalEvidenceBundle(run, qualificationSha256) {
  const auditProjectionBytes = nominalAuditProjectionBytes(run);
  const businessStateBytes = nominalBusinessStateBytes(run);
  const values = {
    schemaVersion: 2,
    run,
    outcome: "COMPLETED",
    lastCompletedTask: "T14",
    abortReasonCode: null,
    runStartedAtUtc: "2026-08-02T08:00:00.000Z",
    runEndedAtUtc: "2026-08-02T08:15:00.000Z",
    protocolId: PROTOCOL_ID,
    protocolSha256: "a".repeat(64),
    frozenCommit: "b".repeat(40),
    resourceTargetSha256: RESOURCE_DESCRIPTORS[run].sha256,
    expectedBusinessEventCount: 15,
    missingExpectedBusinessEventCount: 0,
    unexpectedBusinessEventCount: 0,
    auditProjectionSha256: sha256(auditProjectionBytes),
    businessStateSha256: sha256(businessStateBytes),
    qualificationSha256,
  };
  const descriptor = {};
  for (const key of EVIDENCE_DESCRIPTOR_KEYS) descriptor[key] = values[key];
  values.evidenceContentSha256 = sha256(canonicalObjectBytes(descriptor, EVIDENCE_DESCRIPTOR_KEYS, "SYNTHETIC_EVIDENCE_DESCRIPTOR"));
  const evidence = {};
  for (const key of EVIDENCE_KEYS) evidence[key] = values[key];
  return {
    evidenceBytes: canonicalObjectBytes(evidence, EVIDENCE_KEYS, "SYNTHETIC_EVIDENCE"),
    auditProjectionBytes,
    businessStateBytes,
  };
}

function evidenceBytesWithRecalculatedContent(evidence, code) {
  const descriptor = {};
  for (const key of EVIDENCE_DESCRIPTOR_KEYS) descriptor[key] = evidence[key];
  evidence.evidenceContentSha256 = sha256(canonicalObjectBytes(descriptor, EVIDENCE_DESCRIPTOR_KEYS, `${code}_DESCRIPTOR`));
  return canonicalObjectBytes(evidence, EVIDENCE_KEYS, code);
}

function abortedEvidenceBundle(run, qualificationSha256) {
  const auditProjection = JSON.parse(STRICT_UTF8.decode(nominalAuditProjectionBytes(run)));
  Object.assign(auditProjection, {
    outcome: "ABORTED",
    lastCompletedTask: "T00",
    runStartedAtUtc: null,
    missingExpectedBusinessEventCount: 15,
  });
  auditProjection.slots = auditProjection.slots.map((slot) => ({
    ...slot,
    matchStatus: "MISSING",
    resourceId: null,
    occurredAtUtc: null,
    actorUserId: null,
    actorSubjectSha256: null,
    actorRole: null,
    requestIdSha256: null,
    metadataSha256: null,
  }));
  const auditProjectionBytes = canonicalObjectBytes(
    auditProjection, AUDIT_PROJECTION_KEYS, "SYNTHETIC_ABORTED_AUDIT_PROJECTION",
  );
  const businessState = JSON.parse(STRICT_UTF8.decode(nominalBusinessStateBytes(run)));
  Object.assign(businessState, {
    outcome: "ABORTED",
    lastCompletedTask: "T00",
    tenantId: null,
    accountantUserId: null,
    reviewerUserId: null,
    closingFolder: null,
    balanceImport: null,
    mappings: [],
    workpaper: null,
    document: null,
    exportPack: null,
    minimalAnnexVerified: false,
    usefulnessAssessmentCompleted: false,
  });
  const businessStateBytes = canonicalObjectBytes(
    businessState, BUSINESS_STATE_KEYS, "SYNTHETIC_ABORTED_BUSINESS_STATE",
  );
  const evidence = JSON.parse(STRICT_UTF8.decode(nominalEvidenceBundle(run, qualificationSha256).evidenceBytes));
  Object.assign(evidence, {
    outcome: "ABORTED",
    lastCompletedTask: "T00",
    abortReasonCode: "HARD_STOP",
    runStartedAtUtc: null,
    missingExpectedBusinessEventCount: 15,
    auditProjectionSha256: sha256(auditProjectionBytes),
    businessStateSha256: sha256(businessStateBytes),
  });
  return {
    evidenceBytes: evidenceBytesWithRecalculatedContent(evidence, "SYNTHETIC_ABORTED_EVIDENCE"),
    auditProjectionBytes,
    businessStateBytes,
  };
}

function nominalRecord(decisionId, sequence, overrides = {}) {
  const definition = DECISIONS[decisionId];
  const protocolFromD2 = decisionIndex(decisionId) >= 2;
  const reviewsFromD3 = decisionIndex(decisionId) >= 3;
  const qualificationFromD5 = decisionIndex(decisionId) >= 5;
  const milliseconds = sequence;
  const authorityOccurredAtUtc = definition.authorityOccurredAtUtc
    ?? `2026-08-02T05:00:00.${String(milliseconds).padStart(3, "0")}Z`;
  const recordedAtUtc = `2026-08-02T06:00:00.${String(milliseconds).padStart(3, "0")}Z`;
  return {
    schemaVersion: 2,
    ledgerId: LEDGER_ID,
    sequence,
    decisionId,
    state: definition.state,
    previousState: null,
    previousRecordSha256: null,
    recordedAtUtc,
    authorityOccurredAtUtc,
    recordedByRole: definition.role,
    authorityType: definition.authorityType,
    authorityRef: definition.authorityRef,
    incidentId: INCIDENT_ID,
    incidentSha256: INCIDENT_SHA256,
    protocolId: protocolFromD2 ? PROTOCOL_ID : null,
    protocolSha256: protocolFromD2 ? "a".repeat(64) : null,
    qualificationSha256: qualificationFromD5 ? "c".repeat(64) : null,
    frozenCommit: qualificationFromD5 ? "b".repeat(40) : null,
    completedRun: null,
    evidenceSha256: null,
    cpoOutcome: null,
    reviewRefs: reviewsFromD3 ? nominalReviewRefs() : null,
    authorizations: { ...AUTHORIZATIONS_FALSE },
    ...overrides,
  };
}

function nominalLedgerThrough(decisionId) {
  const ordered = ["D0", "D1", "D2", "D3", "D4", "D5", "D6", "D7"];
  const records = [];
  for (const id of ordered) {
    const overrides = {};
    if (id === "D6") Object.assign(overrides, { completedRun: "R1", evidenceSha256: "d".repeat(64) });
    if (id === "D7") Object.assign(overrides, { completedRun: "R2", evidenceSha256: "e".repeat(64) });
    records.push(nominalRecord(id, records.length, overrides));
    if (id === decisionId) break;
  }
  return records;
}

function serializeRecords(input) {
  const records = cloneJson(input);
  const lines = [];
  for (let index = 0; index < records.length; index += 1) {
    records[index].sequence = index;
    records[index].previousState = index === 0 ? null : records[index - 1].state;
    records[index].previousRecordSha256 = index === 0
      ? null
      : sha256(Buffer.from(`${lines[index - 1]}\n`, "utf8"));
    lines.push(JSON.stringify(records[index]));
  }
  return Buffer.from(`${lines.join("\n")}\n`, "utf8");
}

function qualificationMutationBytes(bytes, mutate, code) {
  const manifest = JSON.parse(STRICT_UTF8.decode(bytes));
  mutate(manifest);
  return canonicalObjectBytes(manifest, QUALIFICATION_KEYS, code);
}

function expectFailure(callback, exitCode = 4, expectedCode = undefined) {
  try {
    callback();
    return false;
  } catch (error) {
    return error instanceof ValidationError && error.exitCode === exitCode
      && (expectedCode === undefined || error.code === expectedCode);
  }
}

function selfTestI01() {
  const blocks = [
    ["V1_PROTOCOL", Buffer.from("protocol-v1-frozen\n")],
    ["V1_LEDGER", Buffer.from('{"sequence":0,"state":"FROZEN"}\n')],
    ["INCIDENT", Buffer.from('{"implementationAuthorized":false,"deliveryAuthorized":false,"mergeAuthorized":false}\n')],
  ];
  const blockMutantsRejected = blocks.every(([label, payload]) => {
    const begin = `<!-- ${label}_BEGIN -->`;
    const end = `<!-- ${label}_END -->`;
    const document = Buffer.concat([Buffer.from(`${begin}\n`), payload, Buffer.from(end)]);
    validateExactMarkedHash(document, begin, end, payload.length, sha256(payload), `SYNTHETIC_${label}`);
    const wrongHash = `${sha256(payload).slice(0, -1)}${sha256(payload).endsWith("0") ? "1" : "0"}`;
    return expectFailure(() => validateExactMarkedHash(
      document, begin, end, payload.length, wrongHash, `SYNTHETIC_${label}`,
    ));
  });
  const temporalProvenanceExact = Date.parse(DECISIONS.D0.authorityOccurredAtUtc)
    < Date.parse(DECISIONS.D1.authorityOccurredAtUtc);
  const incidentMutant = nominalLedgerThrough("D2");
  incidentMutant[2].incidentSha256 = "f".repeat(64);
  return blockMutantsRejected
    && temporalProvenanceExact
    && expectFailure(() => validateLedgerBytes(
      serializeRecords(incidentMutant),
      { protocolSha256: "a".repeat(64), expectedDecision: "D2" },
    ));
}

function selfTestI02() {
  const nominal = serializeRecords(nominalLedgerThrough("D2"));
  validateLedgerBytes(nominal, { protocolSha256: "a".repeat(64), expectedDecision: "D2" });
  const records = nominalLedgerThrough("D2");
  records[2].decisionId = "D3";
  const wrongDecision = serializeRecords(records);
  const gitProperty = nominalLedgerThrough("D2");
  gitProperty[2].deliveryAuthorized = false;
  const first = JSON.parse(STRICT_UTF8.decode(nominal).split("\n")[0]);
  const reordered = { ledgerId: first.ledgerId, schemaVersion: first.schemaVersion };
  for (const key of LEDGER_KEYS.slice(2)) reordered[key] = first[key];
  const lines = STRICT_UTF8.decode(nominal).trimEnd().split("\n");
  lines[0] = JSON.stringify(reordered);
  return expectFailure(() => validateLedgerBytes(wrongDecision, { protocolSha256: "a".repeat(64) }))
    && expectFailure(() => validateLedgerBytes(serializeRecords(gitProperty), { protocolSha256: "a".repeat(64) }))
    && expectFailure(() => validateLedgerBytes(Buffer.from(`${lines.join("\n")}\n`), { protocolSha256: "a".repeat(64) }));
}

function selfTestI03() {
  const authMutant = nominalLedgerThrough("D2");
  authMutant[2].authorizations.v2ExecutionAuthorized = true;
  const reviewMutant = nominalLedgerThrough("D2");
  reviewMutant[2].reviewRefs = nominalReviewRefs();
  const qualificationMutant = nominalLedgerThrough("D2");
  qualificationMutant[2].qualificationSha256 = "c".repeat(64);
  const roleMutant = nominalLedgerThrough("D2");
  roleMutant[2].recordedByRole = "CPO";
  const authorityTypeMutant = nominalLedgerThrough("D2");
  authorityTypeMutant[2].authorityType = "UNBOUND_AUTHORITY";
  const authorityRefMutant = nominalLedgerThrough("D2");
  authorityRefMutant[2].authorityRef = DECISIONS.D1.authorityRef;
  return expectFailure(() => validateLedgerBytes(serializeRecords(authMutant), { protocolSha256: "a".repeat(64) }))
    && expectFailure(() => validateLedgerBytes(serializeRecords(reviewMutant), { protocolSha256: "a".repeat(64) }))
    && expectFailure(() => validateLedgerBytes(serializeRecords(qualificationMutant), { protocolSha256: "a".repeat(64) }))
    && expectFailure(() => validateLedgerBytes(serializeRecords(roleMutant), { protocolSha256: "a".repeat(64) }), 4, "LEDGER_ROLE")
    && expectFailure(() => validateLedgerBytes(serializeRecords(authorityTypeMutant), { protocolSha256: "a".repeat(64) }), 4, "LEDGER_AUTHORITY_TYPE")
    && expectFailure(() => validateLedgerBytes(serializeRecords(authorityRefMutant), { protocolSha256: "a".repeat(64) }), 4, "LEDGER_AUTHORITY_REF");
}

function selfTestI04() {
  const nominal = serializeRecords(nominalLedgerThrough("D2"));
  const lines = STRICT_UTF8.decode(nominal).trimEnd().split("\n");
  const record = JSON.parse(lines[1]);
  record.previousRecordSha256 = "f".repeat(64);
  lines[1] = JSON.stringify(record);
  const timestampMutant = nominalLedgerThrough("D2");
  timestampMutant[1].recordedAtUtc = "2026-08-02T04:43:40.999Z";
  return expectFailure(() => validateLedgerBytes(Buffer.from(`${lines.join("\n")}\n`), { protocolSha256: "a".repeat(64) }))
    && expectFailure(() => validateLedgerBytes(serializeRecords(timestampMutant), { protocolSha256: "a".repeat(64) }));
}

function selfTestI05() {
  const nominal = parseCliArgs(["--mode", "Worktree", "--phase", "P0", "--base", P0_BASE]);
  const future = parseCliArgs([
    "--mode", "Source", "--phase", "P3", "--base", "a".repeat(40),
    "--head", "b".repeat(40), "--artifact-root", "C:\\043c-v2-artifacts",
  ]);
  const fallbackRejected = expectFailure(() => parseCliArgs([
    "--mode", "Worktree", "--phase", "P0", "--base", P0_BASE, "--fallback", "v1",
  ]), 4);
  const selectionRejected = expectFailure(() => parseCliArgs(["--mode", "V1Execution"]), 4);
  const qualificationRejected = expectFailure(() => parseCliArgs(["--mode", "Qualification"]), 2);
  const failureHasNoPositiveVerdict = !failureLines(
    { mode: "Worktree", phase: "P0" },
    "SYNTHETIC_FAILURE_WITH_PASS_TOKEN",
  ).join("\n").includes("PASS");
  return nominal.mode === "Worktree"
    && future.artifactRoot === "C:\\043c-v2-artifacts"
    && fallbackRejected
    && selectionRejected
    && qualificationRejected
    && expectFailure(() => parseCliArgs([
      "--mode", "Source", "--phase", "P3", "--base", "a".repeat(40), "--head", "b".repeat(40),
    ]), 2, "CLI_ARTIFACT_ROOT_SURFACE")
    && expectFailure(() => parseCliArgs([
      "--mode", "Worktree", "--phase", "P0", "--base", P0_BASE,
      "--artifact-root", "C:\\043c-v2-artifacts",
    ]), 2, "CLI_ARTIFACT_ROOT_SURFACE")
    && expectFailure(() => parseCliArgs([
      "--mode", "FrozenDescendants", "--frozen", "a".repeat(40), "--head", "b".repeat(40),
    ]), 2, "CLI_ARTIFACT_ROOT_SURFACE")
    && failureHasNoPositiveVerdict;
}

function selfTestI06() {
  const nominal = [
    ...P0_MODIFIED_PATHS.map((path) => ({ status: " M", paths: [path] })),
    ...P0_ADDED_PATHS.map((path) => ({ status: "??", paths: [path] })),
  ];
  validateP0Status(nominal, false);
  const historical = [
    ...P0_MODIFIED_PATHS.map((path) => ({ status: "M", paths: [path] })),
    ...P0_ADDED_PATHS.map((path) => ({ status: "A", paths: [path] })),
  ];
  validateP0Status(historical, true);
  validateLedgerOnlyStatus([{ status: "M", paths: [LEDGER_PATH] }], true);
  return expectFailure(() => validateP0Status([
    ...nominal, { status: "??", paths: ["outside/ninth-path.txt"] },
  ], false));
}

function selfTestI07() {
  const records = nominalLedgerThrough("D4");
  const refs = records[3].reviewRefs;
  const ledgerBytes = serializeRecords(records);
  const nominalFiles = nominalArtifactFiles({ refs });
  const nominalInput = memoryArtifactInput(nominalFiles);
  validateLedgerBytes(ledgerBytes, {
    protocolSha256: "a".repeat(64), expectedDecision: "D4", artifactInput: nominalInput,
  });
  const changes = [
    ...P0_MODIFIED_PATHS.map((path) => ({ status: "M", paths: [path] })),
    ...P0_ADDED_PATHS.map((path) => ({ status: "A", paths: [path] })),
  ];
  const bindings = {
    reviewedParents: [P0_BASE],
    mergeParents: [P0_BASE],
    reviewedTree: refs.p0ReviewedTree,
    mergeTree: refs.p0MergeTree,
    reviewedChanges: changes,
    mergeChanges: cloneJson(changes),
  };
  validateReviewRefBindings(refs, bindings);
  const authorityFailure = (definitionIndex, mutate, expectedCode, rawBytes = undefined) => {
    const bundle = {
      files: new Map(nominalFiles.files), qualificationPreimagePaths: null,
    };
    const definition = AUTHORITY_ARTIFACT_DEFINITIONS[definitionIndex];
    if (mutate === null) bundle.files.delete(definition.path);
    else bundle.files.set(definition.path, rawBytes ?? authorityMutationBytes(
      bundle.files.get(definition.path), mutate, `SYNTHETIC_AUTHORITY_MUTANT_${definitionIndex}`,
    ));
    return expectFailure(() => validateLedgerBytes(ledgerBytes, {
      protocolSha256: "a".repeat(64), expectedDecision: "D4",
      artifactInput: memoryArtifactInput(bundle),
    }), 4, expectedCode);
  };
  records[4].reviewRefs.aiTechnicalReviewRef = "different-review";
  return expectFailure(() => validateLedgerBytes(serializeRecords(records), {
    protocolSha256: "a".repeat(64), artifactInput: nominalInput,
  }))
    && authorityFailure(0, null, "ARTIFACT_REQUIRED_FILE_MISSING")
    && authorityFailure(0, (artifact) => { artifact.outcome = "FAIL"; }, "AUTHORITY_ARTIFACT_OUTCOME")
    && authorityFailure(0, (artifact) => { artifact.reviewedHead = "f".repeat(40); }, "AUTHORITY_ARTIFACT_HEAD_BINDING")
    && authorityFailure(0, (artifact) => { artifact.reviewedTree = "f".repeat(40); }, "AUTHORITY_ARTIFACT_TREE_BINDING")
    && authorityFailure(0, (artifact) => { artifact.authorityRef = "malformed"; }, "AUTHORITY_ARTIFACT_REF_BINDING")
    && authorityFailure(1, (artifact) => { artifact.classifications = []; }, "AUTHORITY_ARTIFACT_CLASSIFICATION")
    && authorityFailure(0, () => {}, "AUTHORITY_ARTIFACT_JSON_SYNTAX", Buffer.from("{malformed}\n"))
    && expectFailure(() => validateReviewRefBindings(refs, {
      ...bindings, reviewedTree: "f".repeat(40),
    }), 4, "REVIEWED_HEAD_TREE_BINDING")
    && expectFailure(() => validateReviewRefBindings(refs, {
      ...bindings, mergeParents: [refs.p0ReviewedHead],
    }), 4, "P0_MERGE_PARENT");
}

function selfTestI08() {
  const p0PreD2 = serializeRecords(nominalLedgerThrough("D1"));
  const p0PostD2 = serializeRecords(nominalLedgerThrough("D2"));
  validateLedgerBytes(p0PreD2, { expectedDecision: ["D1", "D2"] });
  validateLedgerBytes(p0PostD2, { protocolSha256: "a".repeat(64), expectedDecision: ["D1", "D2"] });
  const d3 = serializeRecords(nominalLedgerThrough("D3"));
  const d4 = serializeRecords(nominalLedgerThrough("D4"));
  const authorityInput = memoryArtifactInput(nominalArtifactFiles());
  validateLedgerBytes(d3, {
    protocolSha256: "a".repeat(64), expectedDecision: PHASE_DECISION.get("P1"), artifactInput: authorityInput,
  });
  validateLedgerBytes(d4, {
    protocolSha256: "a".repeat(64), expectedDecision: PHASE_DECISION.get("P2"), artifactInput: authorityInput,
  });
  return expectFailure(() => validateLedgerBytes(
    serializeRecords(nominalLedgerThrough("D0")), { expectedDecision: ["D1", "D2"] },
  ), 4, "LEDGER_PHASE_DECISION")
    && expectFailure(() => validateLedgerBytes(
      d3, { protocolSha256: "a".repeat(64), expectedDecision: ["D1", "D2"] },
    ), 4, "LEDGER_PHASE_DECISION")
    && expectFailure(() => validateLedgerBytes(d3, {
      protocolSha256: "a".repeat(64), expectedDecision: "D4", artifactInput: authorityInput,
    }));
}

function selfTestI09() {
  const records = nominalLedgerThrough("D5");
  const qualification = nominalQualificationBundle();
  const { qualificationBytes, qualificationPreimages } = qualification;
  const nominalFiles = nominalArtifactFiles({ qualification });
  const artifactInput = memoryArtifactInput(nominalFiles);
  records[5].qualificationSha256 = sha256(qualificationBytes);
  validateLedgerBytes(serializeRecords(records), {
    protocolSha256: "a".repeat(64), expectedDecision: "D5", expectedFrozen: "b".repeat(40),
    artifactInput,
  });
  validateQualificationBytes(qualificationBytes, {
    protocolSha256: "a".repeat(64), frozenCommit: "b".repeat(40), reviewRefs: nominalReviewRefs(),
    preimages: qualificationPreimages,
  });

  const missingQ = qualificationMutationBytes(qualificationBytes, (manifest) => {
    manifest.qualifications.pop();
  }, "SYNTHETIC_QUALIFICATION_MISSING_Q");
  const duplicateQ = qualificationMutationBytes(qualificationBytes, (manifest) => {
    manifest.qualifications[1] = cloneJson(manifest.qualifications[0]);
  }, "SYNTHETIC_QUALIFICATION_DUPLICATE_Q");
  const reorderedQ = qualificationMutationBytes(qualificationBytes, (manifest) => {
    [manifest.qualifications[0], manifest.qualifications[1]] = [manifest.qualifications[1], manifest.qualifications[0]];
  }, "SYNTHETIC_QUALIFICATION_REORDERED_Q");
  const openQ = qualificationMutationBytes(qualificationBytes, (manifest) => {
    manifest.qualifications[0].qClosed = false;
  }, "SYNTHETIC_QUALIFICATION_OPEN_Q");
  const openManifest = qualificationMutationBytes(qualificationBytes, (manifest) => {
    manifest.qClosed = false;
  }, "SYNTHETIC_QUALIFICATION_OPEN_MANIFEST");
  const redQ = qualificationMutationBytes(qualificationBytes, (manifest) => {
    manifest.qualifications[0].nominal = "FAIL";
  }, "SYNTHETIC_QUALIFICATION_RED_Q");
  const indeterminateQ = qualificationMutationBytes(qualificationBytes, (manifest) => {
    manifest.qualifications[0].mutant = "INDETERMINATE";
  }, "SYNTHETIC_QUALIFICATION_INDETERMINATE_Q");
  const errorCodeQ = qualificationMutationBytes(qualificationBytes, (manifest) => {
    manifest.qualifications[0].errorCode = QUALIFICATION_ERROR_CODES[1];
  }, "SYNTHETIC_QUALIFICATION_ERROR_CODE_Q");
  const reviewQ = qualificationMutationBytes(qualificationBytes, (manifest) => {
    manifest.qualifications[0].reviewRef = `043c-v2-q1-review-pass-${"f".repeat(64)}`;
  }, "SYNTHETIC_QUALIFICATION_REVIEW_Q");
  const nominalPreimageMutant = qualificationPreimages.map((preimage) => ({ ...preimage }));
  nominalPreimageMutant[0].nominalBytes = Buffer.from(nominalPreimageMutant[0].nominalBytes);
  nominalPreimageMutant[0].nominalBytes[0] ^= 1;
  const mutantPreimageMutant = qualificationPreimages.map((preimage) => ({ ...preimage }));
  mutantPreimageMutant[0].mutantBytes = Buffer.from(mutantPreimageMutant[0].mutantBytes);
  mutantPreimageMutant[0].mutantBytes[0] ^= 1;
  const boundaryPreimages = qualificationPreimages.map((preimage) => ({ ...preimage }));
  boundaryPreimages[1].nominalBytes = Buffer.alloc(MAX_C043C_BYTES, 0x61);
  const boundaryQualification = qualificationMutationBytes(qualificationBytes, (manifest) => {
    manifest.qualifications[1].nominalSha256 = sha256(boundaryPreimages[1].nominalBytes);
    manifest.qualifications[1].reviewRef = `043c-v2-q2-review-pass-${manifest.qualifications[1].nominalSha256}`;
  }, "SYNTHETIC_QUALIFICATION_BOUNDARY_PREIMAGE");
  validateQualificationBytes(boundaryQualification, { preimages: boundaryPreimages });
  const oversizedPreimages = qualificationPreimages.map((preimage) => ({ ...preimage }));
  oversizedPreimages[1].nominalBytes = Buffer.alloc(MAX_C043C_BYTES + 1, 0x61);
  const hashMutantRecords = cloneJson(records);
  hashMutantRecords[5].qualificationSha256 = "f".repeat(64);
  const bom = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), qualificationBytes]);
  const crlf = Buffer.concat([qualificationBytes.subarray(0, -1), Buffer.from("\r\n")]);
  const noTerminalLf = qualificationBytes.subarray(0, -1);
  const oversized = Buffer.alloc(MAX_C043C_BYTES + 1, 0x20);
  const invalidUtf8 = Buffer.from(qualificationBytes);
  invalidUtf8[1] = 0xff;
  const parsedQualification = JSON.parse(STRICT_UTF8.decode(qualificationBytes));
  const reorderedQualification = { qualificationId: parsedQualification.qualificationId };
  for (const key of QUALIFICATION_KEYS.filter((key) => key !== "qualificationId")) {
    reorderedQualification[key] = parsedQualification[key];
  }
  const reorderedQualificationBytes = Buffer.from(`${JSON.stringify(reorderedQualification)}\n`, "utf8");
  const missingQualificationFiles = {
    files: new Map(nominalFiles.files),
    qualificationPreimagePaths: nominalFiles.qualificationPreimagePaths,
  };
  missingQualificationFiles.files.delete(QUALIFICATION_ARTIFACT_PATH);
  const qualificationInput = (bytes, preimages = qualificationPreimages) => {
    const bundle = {
      files: new Map(nominalFiles.files),
      qualificationPreimagePaths: nominalFiles.qualificationPreimagePaths,
    };
    bundle.files.set(QUALIFICATION_ARTIFACT_PATH, bytes);
    for (let index = 0; index < preimages.length; index += 1) {
      const paths = bundle.qualificationPreimagePaths[index];
      bundle.files.set(paths.nominalPath, preimages[index].nominalBytes);
      bundle.files.set(paths.mutantPath, preimages[index].mutantBytes);
    }
    return memoryArtifactInput(bundle);
  };
  const qualificationProfileFailure = (bytes, expectedCode, preimages = qualificationPreimages) => expectFailure(
    () => validateLedgerBytes(serializeRecords(records), {
      protocolSha256: "a".repeat(64), expectedDecision: "D5", expectedFrozen: "b".repeat(40),
      artifactInput: qualificationInput(bytes, preimages),
    }), 4, expectedCode,
  );
  const boundaryRecords = cloneJson(records);
  boundaryRecords[5].qualificationSha256 = sha256(boundaryQualification);
  validateLedgerBytes(serializeRecords(boundaryRecords), {
    protocolSha256: "a".repeat(64), expectedDecision: "D5", expectedFrozen: "b".repeat(40),
    artifactInput: qualificationInput(boundaryQualification, boundaryPreimages),
  });

  return expectFailure(() => validateLedgerBytes(serializeRecords(records), {
    protocolSha256: "a".repeat(64), expectedDecision: "D5", expectedFrozen: "b".repeat(40),
  }), 4, "ARTIFACT_INPUT_REQUIRED")
    && expectFailure(() => validateLedgerBytes(serializeRecords(records), {
      protocolSha256: "a".repeat(64), expectedDecision: "D5", expectedFrozen: "b".repeat(40),
      artifactInput: memoryArtifactInput(missingQualificationFiles),
    }), 4, "ARTIFACT_REQUIRED_FILE_MISSING")
    && expectFailure(() => validateLedgerBytes(serializeRecords(hashMutantRecords), {
      protocolSha256: "a".repeat(64), expectedDecision: "D5", expectedFrozen: "b".repeat(40),
      artifactInput,
    }), 4, "LEDGER_QUALIFICATION_FILE_HASH")
    && expectFailure(() => validateLedgerBytes(serializeRecords(records), {
      protocolSha256: "a".repeat(64), expectedDecision: "D5", expectedFrozen: "c".repeat(40),
      artifactInput,
    }), 4, "LEDGER_FROZEN_BINDING")
    && expectFailure(() => validateQualificationBytes(qualificationBytes, {
      protocolSha256: "f".repeat(64), frozenCommit: "b".repeat(40),
      reviewRefs: nominalReviewRefs(), preimages: qualificationPreimages,
    }), 4, "QUALIFICATION_PROTOCOL_HASH_MISMATCH")
    && expectFailure(() => validateQualificationBytes(qualificationBytes, {
      protocolSha256: "a".repeat(64), frozenCommit: "c".repeat(40),
      reviewRefs: nominalReviewRefs(), preimages: qualificationPreimages,
    }), 4, "QUALIFICATION_FROZEN_MISMATCH")
    && expectFailure(() => validateQualificationBytes(qualificationBytes, {
      protocolSha256: "a".repeat(64), frozenCommit: "b".repeat(40),
      reviewRefs: nominalReviewRefs("4".repeat(40), "5".repeat(40), "6".repeat(40)),
      preimages: qualificationPreimages,
    }), 4, "QUALIFICATION_REVIEW_REFS_MISMATCH")
    && qualificationProfileFailure(missingQ, "QUALIFICATION_CLOSED_SET")
    && qualificationProfileFailure(duplicateQ, "QUALIFICATION_ITEM_ID_CLOSED")
    && qualificationProfileFailure(reorderedQ, "QUALIFICATION_ITEM_ID_CLOSED")
    && qualificationProfileFailure(openQ, "QUALIFICATION_ITEM_ID_CLOSED")
    && qualificationProfileFailure(openManifest, "QUALIFICATION_CLOSED_SET")
    && qualificationProfileFailure(redQ, "QUALIFICATION_ITEM_OUTCOMES")
    && qualificationProfileFailure(indeterminateQ, "QUALIFICATION_ITEM_OUTCOMES")
    && qualificationProfileFailure(errorCodeQ, "QUALIFICATION_ITEM_ERROR_CODE")
    && qualificationProfileFailure(reviewQ, "QUALIFICATION_ITEM_REVIEW_REF")
    && qualificationProfileFailure(qualificationBytes, "QUALIFICATION_NOMINAL_PREIMAGE_HASH", nominalPreimageMutant)
    && qualificationProfileFailure(qualificationBytes, "QUALIFICATION_MUTANT_PREIMAGE_HASH", mutantPreimageMutant)
    && expectFailure(() => validateQualificationBytes(qualificationBytes, { preimages: oversizedPreimages }), 4, "QUALIFICATION_PREIMAGE_BYTES")
    && expectFailure(() => validateQualificationBytes(bom), 4, "QUALIFICATION_BOM")
    && expectFailure(() => validateQualificationBytes(crlf), 4, "QUALIFICATION_NOT_LF_ONLY")
    && expectFailure(() => validateQualificationBytes(noTerminalLf), 4, "QUALIFICATION_TERMINAL_LF")
    && expectFailure(() => validateQualificationBytes(oversized), 4, "QUALIFICATION_SIZE_LIMIT")
    && expectFailure(() => validateQualificationBytes(invalidUtf8), 4, "QUALIFICATION_INVALID_UTF8")
    && expectFailure(() => validateQualificationBytes(reorderedQualificationBytes), 4, "QUALIFICATION_PROPERTY_ORDER");
}

function selfTestI10() {
  const base = serializeRecords(nominalLedgerThrough("D4"));
  const head = serializeRecords(nominalLedgerThrough("D5"));
  validateSingleLedgerAppend(base, head);
  validateLedgerOnlyStatus([{ status: "M", paths: [LEDGER_PATH] }], true);
  const mutation = Buffer.from(head);
  mutation[0] ^= 1;
  const protectedCheckerMutation = [
    { status: "M", paths: [LEDGER_PATH] },
    { status: "M", paths: [NODE_VALIDATOR_PATH] },
  ];
  const qualification = nominalQualificationBundle();
  const { qualificationBytes } = qualification;
  const qualificationSha256 = sha256(qualificationBytes);
  const r1 = nominalEvidenceBundle("R1", qualificationSha256);
  const r2 = nominalEvidenceBundle("R2", qualificationSha256);
  const fullFiles = nominalArtifactFiles({ qualification, r1, r2 });
  const fullInput = memoryArtifactInput(fullFiles);
  const filesWithR1Mutation = (path, bytes) => {
    const files = new Map(fullFiles.files);
    files.set(path, bytes);
    return { files, qualificationPreimagePaths: fullFiles.qualificationPreimagePaths };
  };
  const boundRecords = nominalLedgerThrough("D7");
  for (const record of boundRecords.filter((record) => decisionIndex(record.decisionId) >= 5)) {
    record.qualificationSha256 = qualificationSha256;
  }
  boundRecords[6].evidenceSha256 = sha256(r1.evidenceBytes);
  boundRecords[7].evidenceSha256 = d7EvidenceIndexSha256(sha256(r1.evidenceBytes), sha256(r2.evidenceBytes));
  validateLedgerBytes(serializeRecords(boundRecords), {
    protocolSha256: "a".repeat(64), expectedDecision: "D7", expectedFrozen: "b".repeat(40),
    artifactInput: fullInput,
  });

  const evidenceMutant = JSON.parse(STRICT_UTF8.decode(r1.evidenceBytes));
  evidenceMutant.evidenceContentSha256 = "f".repeat(64);
  const evidenceMutantBytes = canonicalObjectBytes(evidenceMutant, EVIDENCE_KEYS, "SYNTHETIC_EVIDENCE_MUTANT");
  const businessStateEvidenceCountMutant = JSON.parse(STRICT_UTF8.decode(r1.businessStateBytes));
  businessStateEvidenceCountMutant.workpaper.evidenceCount = 1;
  const businessStateEvidenceCountMutantBytes = canonicalObjectBytes(
    businessStateEvidenceCountMutant, BUSINESS_STATE_KEYS, "SYNTHETIC_BUSINESS_STATE_EVIDENCE_COUNT_MUTANT",
  );
  const businessStateOpenMutant = JSON.parse(STRICT_UTF8.decode(r1.businessStateBytes));
  businessStateOpenMutant.closingFolder.status = "OPEN";
  const businessStateOpenMutantBytes = canonicalObjectBytes(
    businessStateOpenMutant, BUSINESS_STATE_KEYS, "SYNTHETIC_BUSINESS_STATE_OPEN_MUTANT",
  );
  const businessStateFingerprintMutant = JSON.parse(STRICT_UTF8.decode(r1.businessStateBytes));
  businessStateFingerprintMutant.exportPack.sourceFingerprint = "synthetic-source-fingerprint";
  const businessStateFingerprintMutantBytes = canonicalObjectBytes(
    businessStateFingerprintMutant, BUSINESS_STATE_KEYS, "SYNTHETIC_BUSINESS_STATE_FINGERPRINT_MUTANT",
  );
  const businessStateFileNameMutant = JSON.parse(STRICT_UTF8.decode(r1.businessStateBytes));
  businessStateFileNameMutant.exportPack.fileName = "audit-ready-export-pack.zip";
  const businessStateFileNameMutantBytes = canonicalObjectBytes(
    businessStateFileNameMutant, BUSINESS_STATE_KEYS, "SYNTHETIC_BUSINESS_STATE_FILE_NAME_MUTANT",
  );
  const auditStartedAtMillisecondsMutant = JSON.parse(STRICT_UTF8.decode(r1.auditProjectionBytes));
  auditStartedAtMillisecondsMutant.runStartedAtUtc = "2026-08-02T08:00:00.000Z";
  const auditStartedAtMillisecondsMutantBytes = canonicalObjectBytes(
    auditStartedAtMillisecondsMutant, AUDIT_PROJECTION_KEYS, "SYNTHETIC_AUDIT_STARTED_AT_MILLISECONDS_MUTANT",
  );
  const auditEndedAtMillisecondsMutant = JSON.parse(STRICT_UTF8.decode(r1.auditProjectionBytes));
  auditEndedAtMillisecondsMutant.runEndedAtUtc = "2026-08-02T08:15:00.000Z";
  const auditEndedAtMillisecondsMutantBytes = canonicalObjectBytes(
    auditEndedAtMillisecondsMutant, AUDIT_PROJECTION_KEYS, "SYNTHETIC_AUDIT_ENDED_AT_MILLISECONDS_MUTANT",
  );
  const workpaperReviewedAtMillisecondsMutant = JSON.parse(STRICT_UTF8.decode(r1.businessStateBytes));
  workpaperReviewedAtMillisecondsMutant.workpaper.reviewedAtUtc = "2026-08-02T08:13:00.000Z";
  const workpaperReviewedAtMillisecondsMutantBytes = canonicalObjectBytes(
    workpaperReviewedAtMillisecondsMutant, BUSINESS_STATE_KEYS,
    "SYNTHETIC_WORKPAPER_REVIEWED_AT_MILLISECONDS_MUTANT",
  );
  const documentReviewedAtMillisecondsMutant = JSON.parse(STRICT_UTF8.decode(r1.businessStateBytes));
  documentReviewedAtMillisecondsMutant.document.reviewedAtUtc = "2026-08-02T08:12:00.000Z";
  const documentReviewedAtMillisecondsMutantBytes = canonicalObjectBytes(
    documentReviewedAtMillisecondsMutant, BUSINESS_STATE_KEYS,
    "SYNTHETIC_DOCUMENT_REVIEWED_AT_MILLISECONDS_MUTANT",
  );
  const exportCreatedAtMillisecondsMutant = JSON.parse(STRICT_UTF8.decode(r1.businessStateBytes));
  exportCreatedAtMillisecondsMutant.exportPack.createdAtUtc = "2026-08-02T08:14:00.000Z";
  const exportCreatedAtMillisecondsMutantBytes = canonicalObjectBytes(
    exportCreatedAtMillisecondsMutant, BUSINESS_STATE_KEYS, "SYNTHETIC_EXPORT_CREATED_AT_MILLISECONDS_MUTANT",
  );
  const abortedR1 = abortedEvidenceBundle("R1", qualificationSha256);
  const abortedEvidence = JSON.parse(STRICT_UTF8.decode(abortedR1.evidenceBytes));
  validateEvidenceBytes(abortedR1.evidenceBytes, {
    protocolSha256: "a".repeat(64), frozenCommit: "b".repeat(40), qualificationSha256,
    auditProjectionBytes: abortedR1.auditProjectionBytes,
    businessStateBytes: abortedR1.businessStateBytes,
  });
  const invalidAbortStart = { ...abortedEvidence, lastCompletedTask: "T01" };
  const invalidAbortStartBytes = evidenceBytesWithRecalculatedContent(invalidAbortStart, "SYNTHETIC_INVALID_ABORT_START");

  const abortedD6 = nominalLedgerThrough("D6");
  for (const record of abortedD6.filter((record) => decisionIndex(record.decisionId) >= 5)) {
    record.qualificationSha256 = qualificationSha256;
  }
  abortedD6[6].completedRun = null;
  abortedD6[6].evidenceSha256 = sha256(abortedR1.evidenceBytes);
  const abortedD6Input = memoryArtifactInput(nominalArtifactFiles({ qualification, r1: abortedR1 }));
  validateLedgerBytes(serializeRecords(abortedD6), {
    protocolSha256: "a".repeat(64), expectedDecision: "D6", artifactInput: abortedD6Input,
  });
  const f2AfterD6 = [...abortedD6, nominalRecord("F2", 7, {
    qualificationSha256, completedRun: null,
    evidenceSha256: abortedD6[6].evidenceSha256, cpoOutcome: DECISIONS.F2.state,
  })];
  validateLedgerBytes(serializeRecords(f2AfterD6), {
    protocolSha256: "a".repeat(64), expectedDecision: "F2", artifactInput: abortedD6Input,
  });
  const abortedR2 = abortedEvidenceBundle("R2", qualificationSha256);
  const abortedD7 = nominalLedgerThrough("D7");
  for (const record of abortedD7.filter((record) => decisionIndex(record.decisionId) >= 5)) {
    record.qualificationSha256 = qualificationSha256;
  }
  abortedD7[6].evidenceSha256 = sha256(r1.evidenceBytes);
  abortedD7[7].completedRun = "R1";
  abortedD7[7].evidenceSha256 = d7EvidenceIndexSha256(sha256(r1.evidenceBytes), sha256(abortedR2.evidenceBytes));
  validateLedgerBytes(serializeRecords(abortedD7), {
    protocolSha256: "a".repeat(64), expectedDecision: "D7",
    artifactInput: memoryArtifactInput(nominalArtifactFiles({ qualification, r1, r2: abortedR2 })),
  });
  const prematureD7 = nominalLedgerThrough("D7");
  prematureD7[6].completedRun = null;
  prematureD7[7].completedRun = "R1";
  const f2AfterD5 = [...nominalLedgerThrough("D5"), nominalRecord("F2", 6, {
    completedRun: null, evidenceSha256: null, cpoOutcome: DECISIONS.F2.state,
  })];

  const evidenceMutantFiles = {
    files: new Map(fullFiles.files), qualificationPreimagePaths: fullFiles.qualificationPreimagePaths,
  };
  evidenceMutantFiles.files.set(RUN_ARTIFACT_PATHS.R1.evidence, evidenceMutantBytes);
  const businessStateMutantFiles = {
    files: new Map(fullFiles.files), qualificationPreimagePaths: fullFiles.qualificationPreimagePaths,
  };
  businessStateMutantFiles.files.set(
    RUN_ARTIFACT_PATHS.R1.businessState, businessStateEvidenceCountMutantBytes,
  );
  const businessStateOpenMutantFiles = {
    files: new Map(fullFiles.files), qualificationPreimagePaths: fullFiles.qualificationPreimagePaths,
  };
  businessStateOpenMutantFiles.files.set(RUN_ARTIFACT_PATHS.R1.businessState, businessStateOpenMutantBytes);
  const businessStateFingerprintMutantFiles = {
    files: new Map(fullFiles.files), qualificationPreimagePaths: fullFiles.qualificationPreimagePaths,
  };
  businessStateFingerprintMutantFiles.files.set(
    RUN_ARTIFACT_PATHS.R1.businessState, businessStateFingerprintMutantBytes,
  );
  const businessStateFileNameMutantFiles = {
    files: new Map(fullFiles.files), qualificationPreimagePaths: fullFiles.qualificationPreimagePaths,
  };
  businessStateFileNameMutantFiles.files.set(
    RUN_ARTIFACT_PATHS.R1.businessState, businessStateFileNameMutantBytes,
  );
  const missingR2Files = {
    files: new Map(fullFiles.files), qualificationPreimagePaths: fullFiles.qualificationPreimagePaths,
  };
  missingR2Files.files.delete(RUN_ARTIFACT_PATHS.R2.evidence);

  return expectFailure(() => validateSingleLedgerAppend(base, mutation))
    && expectFailure(() => validateLedgerOnlyStatus(protectedCheckerMutation, true))
    && expectFailure(() => validateEvidenceBytes(evidenceMutantBytes))
    && expectFailure(() => validateEvidenceBytes(invalidAbortStartBytes))
    && expectFailure(() => validateLedgerBytes(serializeRecords(boundRecords), {
      protocolSha256: "a".repeat(64), expectedDecision: "D7",
      artifactInput: memoryArtifactInput(evidenceMutantFiles),
    }), 4, "EVIDENCE_CONTENT_HASH")
    && expectFailure(() => validateLedgerBytes(serializeRecords(boundRecords), {
      protocolSha256: "a".repeat(64), expectedDecision: "D7",
      artifactInput: memoryArtifactInput(businessStateMutantFiles),
    }), 4, "BUSINESS_STATE_WORKPAPER_COMPLETED_CONSTANTS")
    && expectFailure(() => validateLedgerBytes(serializeRecords(boundRecords), {
      protocolSha256: "a".repeat(64), expectedDecision: "D7",
      artifactInput: memoryArtifactInput(businessStateOpenMutantFiles),
    }), 4, "BUSINESS_STATE_CLOSING_CONSTANTS")
    && expectFailure(() => validateLedgerBytes(serializeRecords(boundRecords), {
      protocolSha256: "a".repeat(64), expectedDecision: "D7",
      artifactInput: memoryArtifactInput(businessStateFingerprintMutantFiles),
    }), 4, "BUSINESS_STATE_EXPORT_COMPLETED_CONSTANTS")
    && expectFailure(() => validateLedgerBytes(serializeRecords(boundRecords), {
      protocolSha256: "a".repeat(64), expectedDecision: "D7",
      artifactInput: memoryArtifactInput(businessStateFileNameMutantFiles),
    }), 4, "BUSINESS_STATE_EXPORT_COMPLETED_CONSTANTS")
    && expectFailure(() => validateLedgerBytes(serializeRecords(boundRecords), {
      protocolSha256: "a".repeat(64), expectedDecision: "D7",
      artifactInput: memoryArtifactInput(filesWithR1Mutation(
        RUN_ARTIFACT_PATHS.R1.auditProjection, auditStartedAtMillisecondsMutantBytes,
      )),
    }), 4, "AUDIT_PROJECTION_STARTED_AT_FORMAT")
    && expectFailure(() => validateLedgerBytes(serializeRecords(boundRecords), {
      protocolSha256: "a".repeat(64), expectedDecision: "D7",
      artifactInput: memoryArtifactInput(filesWithR1Mutation(
        RUN_ARTIFACT_PATHS.R1.auditProjection, auditEndedAtMillisecondsMutantBytes,
      )),
    }), 4, "AUDIT_PROJECTION_ENDED_AT_FORMAT")
    && expectFailure(() => validateLedgerBytes(serializeRecords(boundRecords), {
      protocolSha256: "a".repeat(64), expectedDecision: "D7",
      artifactInput: memoryArtifactInput(filesWithR1Mutation(
        RUN_ARTIFACT_PATHS.R1.businessState, workpaperReviewedAtMillisecondsMutantBytes,
      )),
    }), 4, "BUSINESS_STATE_WORKPAPER_REVIEWED_AT_FORMAT")
    && expectFailure(() => validateLedgerBytes(serializeRecords(boundRecords), {
      protocolSha256: "a".repeat(64), expectedDecision: "D7",
      artifactInput: memoryArtifactInput(filesWithR1Mutation(
        RUN_ARTIFACT_PATHS.R1.businessState, documentReviewedAtMillisecondsMutantBytes,
      )),
    }), 4, "BUSINESS_STATE_DOCUMENT_REVIEWED_AT_FORMAT")
    && expectFailure(() => validateLedgerBytes(serializeRecords(boundRecords), {
      protocolSha256: "a".repeat(64), expectedDecision: "D7",
      artifactInput: memoryArtifactInput(filesWithR1Mutation(
        RUN_ARTIFACT_PATHS.R1.businessState, exportCreatedAtMillisecondsMutantBytes,
      )),
    }), 4, "BUSINESS_STATE_EXPORT_CREATED_AT_FORMAT")
    && expectFailure(() => validateLedgerBytes(serializeRecords(boundRecords), {
      protocolSha256: "a".repeat(64), expectedDecision: "D7",
      artifactInput: memoryArtifactInput(missingR2Files),
    }), 4, "ARTIFACT_REQUIRED_FILE_MISSING")
    && expectFailure(() => validateLedgerBytes(serializeRecords(prematureD7), { protocolSha256: "a".repeat(64) }))
    && expectFailure(() => validateLedgerBytes(serializeRecords(f2AfterD5), { protocolSha256: "a".repeat(64) }));
}

function selfTestI11() {
  const bindings = {
    base: "a".repeat(40),
    source: "b".repeat(40),
    final: "d".repeat(40),
    sourceParents: ["a".repeat(40)],
    finalParents: ["a".repeat(40)],
    sourceTree: "c".repeat(40),
    finalTree: "c".repeat(40),
  };
  validatePostMergeTopologyBindings(bindings);
  return expectFailure(() => validatePostMergeTopologyBindings({
    ...bindings, sourceParents: ["e".repeat(40)],
  }), 4, "SOURCE_PARENT_BINDING")
    && expectFailure(() => validatePostMergeTopologyBindings({
      ...bindings, finalParents: [bindings.source],
    }), 4, "POST_MERGE_PARENT_BINDING")
    && expectFailure(() => validatePostMergeTopologyBindings({
      ...bindings, finalTree: "e".repeat(40),
    }), 4, "POST_MERGE_TREE_MISMATCH");
}

function selfTestI12() {
  const begin = V1_LEDGER_BEGIN;
  const end = V1_LEDGER_END;
  const baseLine = '{"sequence":0,"state":"BASE","frozenCommit":null}\n';
  const appendLine = '{"sequence":1,"state":"FROZEN","frozenCommit":"base"}\n';
  const base = Buffer.from(`prefix\n${begin}\n${baseLine}${end}\nsuffix\n`);
  const source = Buffer.from(`prefix\n${begin}\n${baseLine}${appendLine}${end}\nsuffix\n`);
  const transition = { label: "SYNTHETIC_FORENSIC", sequence: 1, state: "FROZEN", frozenCommit: "base" };
  validateForensicLedgerAppend(base, source, transition);
  const outsideMutant = Buffer.from(`changed\n${begin}\n${baseLine}${appendLine}${end}\nsuffix\n`);
  return expectFailure(() => validateForensicLedgerAppend(base, outsideMutant, transition));
}

function runSelfTest() {
  const probes = [
    selfTestI01, selfTestI02, selfTestI03, selfTestI04, selfTestI05, selfTestI06,
    selfTestI07, selfTestI08, selfTestI09, selfTestI10, selfTestI11, selfTestI12,
  ];
  const results = probes.map((probe, index) => {
    try {
      return { id: `043C2-I${String(index + 1).padStart(2, "0")}`, passed: probe() === true };
    } catch {
      return { id: `043C2-I${String(index + 1).padStart(2, "0")}`, passed: false };
    }
  });
  requireInvariant(results.length === 12 && results.every((result) => result.passed), "SELF_TEST_INVARIANTS_FAILED");
  return results;
}

function inputScope(mode) {
  if (mode === "SelfTest") return "MEMORY";
  if (mode === "Worktree") return "WORKTREE";
  return "GIT_BLOBS";
}

function successLines(config) {
  const lines = [
    `checker=${CHECKER_ID}`,
    `mode=${config.mode}`,
    `phase=${config.phase ?? "NONE"}`,
    `inputScope=${inputScope(config.mode)}`,
    "readOnly=true",
    "fallbackV1=false",
  ];
  lines.push("errorCount=0", "errorCodes=NONE", "verdict=PASS");
  return lines;
}

function failureLines(config, code) {
  const safeCode = String(code).replace(/PASS/gi, "POSITIVE");
  return [
    `checker=${CHECKER_ID}`,
    `mode=${config?.mode ?? "INVALID"}`,
    `phase=${config?.phase ?? "NONE"}`,
    `inputScope=${config === undefined ? "MEMORY" : inputScope(config.mode)}`,
    "readOnly=true",
    "fallbackV1=false",
    "errorCount=1",
    `errorCodes=${safeCode}`,
    "verdict=FAIL",
  ];
}

function publicValidationError(error) {
  if (!(error instanceof ValidationError)) return new ValidationError(5, "E_INTERNAL");
  const code = error.code;
  if (code === "V1_FALLBACK_OR_SELECTION") return new ValidationError(4, "E_V1_FALLBACK");
  if (code.startsWith("CLI_MODE")) return new ValidationError(2, "E_CLI_MODE");
  if (code.startsWith("CLI_PHASE")) return new ValidationError(2, "E_CLI_PHASE");
  if (code.includes("CLI_FULL_LOWERCASE_SHA")) return new ValidationError(2, "E_CLI_SHA");
  if (code.startsWith("CLI_")) return new ValidationError(2, "E_CLI_ARGUMENT");

  if (code === "GIT_COMMIT_MISSING") return new ValidationError(3, "E_GIT_OBJECT_MISSING");
  if (code === "GIT_BLOB_MISSING") return new ValidationError(3, "E_GIT_BLOB_MISSING");
  if (code.startsWith("GIT_") || code === "FULL_LOWERCASE_SHA_REQUIRED") return new ValidationError(3, "E_GIT_UNAVAILABLE");
  if (["P0_BASE_MISMATCH", "P0_BRANCH_MISMATCH", "WORKTREE_BASE_NOT_HEAD"].includes(code)) {
    return new ValidationError(3, "E_BASELINE_DRIFT");
  }

  if (/^(?:PR106|PR107)_/.test(code)) {
    return new ValidationError(4, code.startsWith("PR106_") ? "E_FORENSIC_PR106" : "E_FORENSIC_PR107");
  }
  if (code.startsWith("FORENSIC_")) return new ValidationError(4, "E_FORENSIC_PR107");
  if (code.startsWith("FROZEN_") || code.startsWith("PROTECTED_")) return new ValidationError(4, "E_FROZEN_DESCENDANT");
  if (code.includes("PARENT_COUNT")) return new ValidationError(4, "E_PARENT_COUNT");
  if (code.includes("PARENT_BINDING") || code.endsWith("_PARENT")) return new ValidationError(4, "E_PARENT_BINDING");
  if (code.includes("TREE") && !code.startsWith("INDEX_FLAGS")) return new ValidationError(4, "E_TREE_IDENTITY");
  if (code.includes("ANCESTRY") || ["SOURCE_HEAD_EQUALS_BASE", "POST_MERGE_COMMIT_IDENTITY"].includes(code)) {
    return new ValidationError(4, "E_ANCESTRY");
  }
  if (code.startsWith("INDEX_FLAGS") || code === "WORKTREE_INDEX_NOT_EMPTY") return new ValidationError(4, "E_INDEX_FLAGS");
  if (code.includes("FILE_SET") || code === "P0_STATUS_COUNT" || code.startsWith("LEDGER_ONLY_STATUS_COUNT")) {
    return new ValidationError(4, "E_FILE_SET");
  }
  if (code.startsWith("WORKTREE_") || code.startsWith("P0_STATUS_") || code.startsWith("GIT_STATUS_")
    || code.startsWith("GIT_NAME_STATUS_") || code === "P0_RENAME_OR_COPY_FORBIDDEN"
    || code === "P0_DIFF_CHECK" || code.startsWith("P0_FILE_")) {
    return new ValidationError(4, "E_WORKTREE_STATE");
  }
  if (code.startsWith("LEDGER_APPEND") || code === "LEDGER_PRIOR_BYTES_MUTATED"
    || code === "LEDGER_PREVIOUS_RECORD_SHA256") {
    return new ValidationError(4, "E_LEDGER_APPEND");
  }
  if (code.startsWith("INCIDENT_SELECTION") || code.startsWith("LEDGER_INCIDENT")) {
    return new ValidationError(4, "E_INCIDENT_CONTRACT");
  }
  if (code.includes("FROZEN_BINDING") || code.startsWith("LEDGER_FROZEN_")
    || code.startsWith("P0_MERGE_") || code.startsWith("REVIEWED_HEAD_")) {
    return new ValidationError(4, "E_FREEZE_BINDING");
  }
  if (code.startsWith("QUALIFICATION_") || code === "LEDGER_QUALIFICATION_FILE_HASH"
    || code.startsWith("ARTIFACT_QUALIFICATION_")) {
    return new ValidationError(4, "E_FREEZE_BINDING");
  }
  if (code.startsWith("LEDGER_") || code.startsWith("REVIEW_REFS_") || code.startsWith("AUTHORIZATION_")
    || code.startsWith("AUTHORIZATIONS_") || code.startsWith("AUTHORITY_ARTIFACT_")
    || code.startsWith("AUDIT_PROJECTION_") || code.startsWith("BUSINESS_STATE_")
    || code.startsWith("EVIDENCE_") || code.startsWith("ARTIFACT_") || code.startsWith("D7_INDEX_")) {
    return new ValidationError(4, "E_LEDGER_V2");
  }
  if (code.startsWith("V1_PROTOCOL") || code.startsWith("V1_LEDGER")) {
    return new ValidationError(4, "E_V1_IMMUTABILITY");
  }
  if (code.includes("V1_FALLBACK") || code.includes("V1_IMPORT") || code.includes("V2_IMPORT")
    || code.includes("V2_DOT_SOURCE")) {
    return new ValidationError(4, "E_V1_FALLBACK");
  }
  if (code.startsWith("NODE_VALIDATOR_") || code.startsWith("POWERSHELL_VALIDATOR_")
    || code.startsWith("V1_VALIDATOR_") || code === "EXECUTING_CHECKER_BLOB_MISMATCH") {
    return new ValidationError(4, "E_READ_ONLY_POLICY");
  }
  if (code.startsWith("V2_PROTOCOL") || code.startsWith("V2_RUNBOOK")) {
    return new ValidationError(4, "E_PROTOCOL_V2");
  }
  if (code.startsWith("SELF_TEST") || code.startsWith("SYNTHETIC_")) return new ValidationError(4, "E_SELF_TEST");
  if (code.startsWith("OUTPUT_")) return new ValidationError(4, "E_OUTPUT_BUFFER");
  return new ValidationError(5, "E_INTERNAL");
}

function runMode(config) {
  if (config.mode === "SelfTest") return runSelfTest();
  const effectiveConfig = config.artifactRoot === undefined
    ? config
    : { ...config, artifactInput: createExternalArtifactInput(config.artifactRoot) };
  if (config.mode === "Worktree") validateWorktree(effectiveConfig);
  else if (config.mode === "Source") validateSource(
    config.phase, config.base, config.head, effectiveConfig.artifactInput,
  );
  else if (config.mode === "FrozenDescendants") validateFrozenDescendants(effectiveConfig);
  else if (config.mode === "PostMerge") validatePostMerge(effectiveConfig);
  else if (config.mode === "V1ForensicReplay") validateV1ForensicReplay();
  return undefined;
}

function runCli() {
  let config;
  try {
    config = parseCliArgs(process.argv.slice(2));
    runMode(config);
    process.stdout.write(`${successLines(config).join("\n")}\n`);
  } catch (error) {
    const normalized = publicValidationError(error);
    process.stdout.write(`${failureLines(config, normalized.code).join("\n")}\n`);
    process.exitCode = normalized.exitCode;
  }
}

const DIRECT_EXECUTION = process.argv[1] !== undefined
  && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;

if (DIRECT_EXECUTION) runCli();
