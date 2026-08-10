import { Buffer } from "node:buffer";
import {
  createHash,
  createHmac,
  pbkdf2Sync,
  randomBytes as nodeRandomBytes
} from "node:crypto";
import {
  lstat,
  readFile,
  realpath
} from "node:fs/promises";
import { resolve as resolveNativePath, win32 as path } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

export const PROTOCOL_ID = "043c-internal-rehearsal-v1";
export const PROTOCOL_VERSION = "1";
export const BINDING_SCHEMA_VERSION = "043c-command-binding-v1";
export const SUMMARY_SCHEMA_VERSION = "043c-run-summary-v1";
export const RECOVERY_SCHEMA_VERSION = "043c-recovery-state-v1";
export const ENVIRONMENT = "LOCAL_SYNTHETIC_LOOPBACK";
export const REPOSITORY = "Qamrito-90/ritomer";
export const TENANT_ID = "036a0000-0000-4000-8000-000000000001";
export const TENANT = Object.freeze({
  tenantId: TENANT_ID,
  tenantSlug: "ritomer-demo-036a",
  tenantName: "Ritomer Demo Fiduciaire SA (synthetic)"
});
export const RUN_ID_REGEX = /^r[12]-[0-9]{8}t[0-9]{6}z-[0-9a-f]{12}$/;
export const RUN_ID_LENGTH = 32;
export const SHA256_REGEX = /^[0-9a-f]{64}$/;
export const GIT_SHA1_REGEX = /^[0-9a-f]{40}$/;
export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export const SQL_IDENTIFIER_REGEX = /^[a-z][a-z0-9_]{0,62}$/;
export const LOCAL_PSQL_PATH = "C:\\Program Files\\PostgreSQL\\16\\bin\\psql.exe";
export const BACKEND_ORIGIN = "http://127.0.0.1:8080";
export const ACCOUNTANT_ORIGIN = "http://127.0.0.1:5173";
export const REVIEWER_ORIGIN = "http://127.0.0.1:5174";
export const PORTS = Object.freeze([8080, 5173, 5174]);
export const PHASES = Object.freeze([
  "PHASE_PREFLIGHT",
  "PHASE_PROVISION",
  "PHASE_RUNTIME",
  "PHASE_T00_T15",
  "PHASE_AUDIT",
  "PHASE_EVIDENCE",
  "PHASE_CLEANUP"
]);
export const RECOVERY_PHASE = "RECOVERY_CLEANUP_ONLY";
export const LOCAL_INPUT_NAMES = Object.freeze({
  postgresAdminUser: "RITOMER_043C_PG_ADMIN_USER",
  postgresAdminPassfile: "RITOMER_043C_PG_ADMIN_PASSFILE",
  jwtHmacSecret: "RITOMER_SECURITY_JWT_HMAC_SECRET",
  preExecutionReviewRecordPath: "RITOMER_043C_PRE_EXECUTION_REVIEW_RECORD_PATH",
  sensitiveAuthorizationRecordPath: "RITOMER_043C_SENSITIVE_AUTHORIZATION_RECORD_PATH"
});

export const FIXTURES = Object.freeze({
  balance: Object.freeze({
    relativePath: "fixtures/pilot/043/balance-fy2025-v1.csv",
    fileName: "balance-fy2025-v1.csv",
    mediaType: "text/csv",
    byteSize: 359,
    sha256: "2295b620704c2cfcdf1e37660388bd84a1d261c0b7697edf5bce21d0c04f9855"
  }),
  evidence: Object.freeze({
    relativePath: "fixtures/pilot/043/evidence-bank-reconciliation-fy2025-v1.csv",
    fileName: "evidence-bank-reconciliation-fy2025-v1.csv",
    mediaType: "text/csv",
    byteSize: 184,
    sha256: "f5bb9a7ec0df043a8e845d10f029c2bdd6dd7ea2f62f9935f48cdc0d95339b27",
    sourceLabel: "Ritomer internal synthetic fixture 043",
    documentDate: "2025-12-31"
  })
});

export const ACTORS = Object.freeze({
  ACCOUNTANT: Object.freeze({
    role: "ACCOUNTANT",
    origin: ACCOUNTANT_ORIGIN,
    userId: "036a0000-0000-4000-8000-000000000002",
    subject: "ritomer-demo-user-036a",
    email: "demo.accountant@example.invalid",
    displayName: "Demo Accountant 036a"
  }),
  REVIEWER: Object.freeze({
    role: "REVIEWER",
    origin: REVIEWER_ORIGIN,
    userId: "043b0000-0000-4000-8000-000000000002",
    subject: "ritomer-demo-reviewer-043b",
    email: "demo.reviewer.043b@example.invalid",
    displayName: "Demo Reviewer 043b"
  })
});

export const MAPPINGS = Object.freeze([
  Object.freeze({ accountCode: "1000", targetCode: "BS.ASSET.CASH_AND_EQUIVALENTS" }),
  Object.freeze({ accountCode: "1100", targetCode: "BS.ASSET.TRADE_RECEIVABLES" }),
  Object.freeze({ accountCode: "1200", targetCode: "BS.ASSET.PREPAIDS_AND_OTHER_CURRENT" }),
  Object.freeze({ accountCode: "2000", targetCode: "BS.LIABILITY.TRADE_PAYABLES" }),
  Object.freeze({ accountCode: "2800", targetCode: "BS.EQUITY.RETAINED_EARNINGS" }),
  Object.freeze({ accountCode: "3000", targetCode: "PL.REVENUE.OPERATING_REVENUE" }),
  Object.freeze({ accountCode: "4000", targetCode: "PL.EXPENSE.OTHER_OPERATING_EXPENSES" })
]);

export const MAPPING_TARGETS_V2 = Object.freeze([
  Object.freeze({ code: "BS.ASSET", label: "Asset", statement: "BALANCE_SHEET", summaryBucketCode: "BS.ASSET", sectionCode: "BS.ASSET", normalSide: "DEBIT", granularity: "LEAF", deprecated: true, selectable: true, displayOrder: 10 }),
  Object.freeze({ code: "BS.EQUITY", label: "Equity", statement: "BALANCE_SHEET", summaryBucketCode: "BS.EQUITY", sectionCode: "BS.EQUITY", normalSide: "CREDIT", granularity: "LEAF", deprecated: true, selectable: true, displayOrder: 20 }),
  Object.freeze({ code: "BS.LIABILITY", label: "Liability", statement: "BALANCE_SHEET", summaryBucketCode: "BS.LIABILITY", sectionCode: "BS.LIABILITY", normalSide: "CREDIT", granularity: "LEAF", deprecated: true, selectable: true, displayOrder: 30 }),
  Object.freeze({ code: "PL.EXPENSE", label: "Expense", statement: "INCOME_STATEMENT", summaryBucketCode: "PL.EXPENSE", sectionCode: "PL.EXPENSE", normalSide: "DEBIT", granularity: "LEAF", deprecated: true, selectable: true, displayOrder: 40 }),
  Object.freeze({ code: "PL.REVENUE", label: "Revenue", statement: "INCOME_STATEMENT", summaryBucketCode: "PL.REVENUE", sectionCode: "PL.REVENUE", normalSide: "CREDIT", granularity: "LEAF", deprecated: true, selectable: true, displayOrder: 50 }),
  Object.freeze({ code: "BS.ASSET.CURRENT_SECTION", label: "Current assets", statement: "BALANCE_SHEET", summaryBucketCode: "BS.ASSET", sectionCode: "BS.ASSET.CURRENT_SECTION", normalSide: "DEBIT", granularity: "SECTION", deprecated: false, selectable: false, displayOrder: 110 }),
  Object.freeze({ code: "BS.ASSET.CASH_AND_EQUIVALENTS", label: "Cash and cash equivalents", statement: "BALANCE_SHEET", summaryBucketCode: "BS.ASSET", sectionCode: "BS.ASSET.CURRENT_SECTION", normalSide: "DEBIT", granularity: "LEAF", deprecated: false, selectable: true, displayOrder: 111 }),
  Object.freeze({ code: "BS.ASSET.TRADE_RECEIVABLES", label: "Trade receivables", statement: "BALANCE_SHEET", summaryBucketCode: "BS.ASSET", sectionCode: "BS.ASSET.CURRENT_SECTION", normalSide: "DEBIT", granularity: "LEAF", deprecated: false, selectable: true, displayOrder: 112 }),
  Object.freeze({ code: "BS.ASSET.OTHER_RECEIVABLES", label: "Other receivables", statement: "BALANCE_SHEET", summaryBucketCode: "BS.ASSET", sectionCode: "BS.ASSET.CURRENT_SECTION", normalSide: "DEBIT", granularity: "LEAF", deprecated: false, selectable: true, displayOrder: 113 }),
  Object.freeze({ code: "BS.ASSET.INVENTORIES_AND_WIP", label: "Inventories and work in progress", statement: "BALANCE_SHEET", summaryBucketCode: "BS.ASSET", sectionCode: "BS.ASSET.CURRENT_SECTION", normalSide: "DEBIT", granularity: "LEAF", deprecated: false, selectable: true, displayOrder: 114 }),
  Object.freeze({ code: "BS.ASSET.PREPAIDS_AND_OTHER_CURRENT", label: "Prepaids and other current assets", statement: "BALANCE_SHEET", summaryBucketCode: "BS.ASSET", sectionCode: "BS.ASSET.CURRENT_SECTION", normalSide: "DEBIT", granularity: "LEAF", deprecated: false, selectable: true, displayOrder: 115 }),
  Object.freeze({ code: "BS.ASSET.NON_CURRENT_SECTION", label: "Non-current assets", statement: "BALANCE_SHEET", summaryBucketCode: "BS.ASSET", sectionCode: "BS.ASSET.NON_CURRENT_SECTION", normalSide: "DEBIT", granularity: "SECTION", deprecated: false, selectable: false, displayOrder: 120 }),
  Object.freeze({ code: "BS.ASSET.FINANCIAL_FIXED_ASSETS", label: "Financial fixed assets", statement: "BALANCE_SHEET", summaryBucketCode: "BS.ASSET", sectionCode: "BS.ASSET.NON_CURRENT_SECTION", normalSide: "DEBIT", granularity: "LEAF", deprecated: false, selectable: true, displayOrder: 121 }),
  Object.freeze({ code: "BS.ASSET.TANGIBLE_FIXED_ASSETS", label: "Tangible fixed assets", statement: "BALANCE_SHEET", summaryBucketCode: "BS.ASSET", sectionCode: "BS.ASSET.NON_CURRENT_SECTION", normalSide: "DEBIT", granularity: "LEAF", deprecated: false, selectable: true, displayOrder: 122 }),
  Object.freeze({ code: "BS.ASSET.INTANGIBLE_FIXED_ASSETS", label: "Intangible fixed assets", statement: "BALANCE_SHEET", summaryBucketCode: "BS.ASSET", sectionCode: "BS.ASSET.NON_CURRENT_SECTION", normalSide: "DEBIT", granularity: "LEAF", deprecated: false, selectable: true, displayOrder: 123 }),
  Object.freeze({ code: "BS.LIABILITY.CURRENT_SECTION", label: "Current liabilities", statement: "BALANCE_SHEET", summaryBucketCode: "BS.LIABILITY", sectionCode: "BS.LIABILITY.CURRENT_SECTION", normalSide: "CREDIT", granularity: "SECTION", deprecated: false, selectable: false, displayOrder: 210 }),
  Object.freeze({ code: "BS.LIABILITY.TRADE_PAYABLES", label: "Trade payables", statement: "BALANCE_SHEET", summaryBucketCode: "BS.LIABILITY", sectionCode: "BS.LIABILITY.CURRENT_SECTION", normalSide: "CREDIT", granularity: "LEAF", deprecated: false, selectable: true, displayOrder: 211 }),
  Object.freeze({ code: "BS.LIABILITY.OTHER_CURRENT_LIABILITIES", label: "Other current liabilities", statement: "BALANCE_SHEET", summaryBucketCode: "BS.LIABILITY", sectionCode: "BS.LIABILITY.CURRENT_SECTION", normalSide: "CREDIT", granularity: "LEAF", deprecated: false, selectable: true, displayOrder: 212 }),
  Object.freeze({ code: "BS.LIABILITY.ACCRUALS_AND_DEFERRED_INCOME", label: "Accruals and deferred income", statement: "BALANCE_SHEET", summaryBucketCode: "BS.LIABILITY", sectionCode: "BS.LIABILITY.CURRENT_SECTION", normalSide: "CREDIT", granularity: "LEAF", deprecated: false, selectable: true, displayOrder: 213 }),
  Object.freeze({ code: "BS.LIABILITY.SHORT_TERM_FINANCIAL_DEBT", label: "Short-term financial debt", statement: "BALANCE_SHEET", summaryBucketCode: "BS.LIABILITY", sectionCode: "BS.LIABILITY.CURRENT_SECTION", normalSide: "CREDIT", granularity: "LEAF", deprecated: false, selectable: true, displayOrder: 214 }),
  Object.freeze({ code: "BS.LIABILITY.NON_CURRENT_SECTION", label: "Non-current liabilities", statement: "BALANCE_SHEET", summaryBucketCode: "BS.LIABILITY", sectionCode: "BS.LIABILITY.NON_CURRENT_SECTION", normalSide: "CREDIT", granularity: "SECTION", deprecated: false, selectable: false, displayOrder: 220 }),
  Object.freeze({ code: "BS.LIABILITY.LONG_TERM_FINANCIAL_DEBT", label: "Long-term financial debt", statement: "BALANCE_SHEET", summaryBucketCode: "BS.LIABILITY", sectionCode: "BS.LIABILITY.NON_CURRENT_SECTION", normalSide: "CREDIT", granularity: "LEAF", deprecated: false, selectable: true, displayOrder: 221 }),
  Object.freeze({ code: "BS.EQUITY.CORE_SECTION", label: "Equity", statement: "BALANCE_SHEET", summaryBucketCode: "BS.EQUITY", sectionCode: "BS.EQUITY.CORE_SECTION", normalSide: "CREDIT", granularity: "SECTION", deprecated: false, selectable: false, displayOrder: 310 }),
  Object.freeze({ code: "BS.EQUITY.SHARE_CAPITAL", label: "Share capital", statement: "BALANCE_SHEET", summaryBucketCode: "BS.EQUITY", sectionCode: "BS.EQUITY.CORE_SECTION", normalSide: "CREDIT", granularity: "LEAF", deprecated: false, selectable: true, displayOrder: 311 }),
  Object.freeze({ code: "BS.EQUITY.CAPITAL_RESERVES", label: "Capital reserves", statement: "BALANCE_SHEET", summaryBucketCode: "BS.EQUITY", sectionCode: "BS.EQUITY.CORE_SECTION", normalSide: "CREDIT", granularity: "LEAF", deprecated: false, selectable: true, displayOrder: 312 }),
  Object.freeze({ code: "BS.EQUITY.RETAINED_EARNINGS", label: "Retained earnings", statement: "BALANCE_SHEET", summaryBucketCode: "BS.EQUITY", sectionCode: "BS.EQUITY.CORE_SECTION", normalSide: "CREDIT", granularity: "LEAF", deprecated: false, selectable: true, displayOrder: 313 }),
  Object.freeze({ code: "PL.REVENUE.OPERATING_SECTION", label: "Operating revenue", statement: "INCOME_STATEMENT", summaryBucketCode: "PL.REVENUE", sectionCode: "PL.REVENUE.OPERATING_SECTION", normalSide: "CREDIT", granularity: "SECTION", deprecated: false, selectable: false, displayOrder: 410 }),
  Object.freeze({ code: "PL.REVENUE.OPERATING_REVENUE", label: "Operating revenue", statement: "INCOME_STATEMENT", summaryBucketCode: "PL.REVENUE", sectionCode: "PL.REVENUE.OPERATING_SECTION", normalSide: "CREDIT", granularity: "LEAF", deprecated: false, selectable: true, displayOrder: 411 }),
  Object.freeze({ code: "PL.REVENUE.OTHER_SECTION", label: "Other revenue", statement: "INCOME_STATEMENT", summaryBucketCode: "PL.REVENUE", sectionCode: "PL.REVENUE.OTHER_SECTION", normalSide: "CREDIT", granularity: "SECTION", deprecated: false, selectable: false, displayOrder: 420 }),
  Object.freeze({ code: "PL.REVENUE.OTHER_REVENUE", label: "Other revenue", statement: "INCOME_STATEMENT", summaryBucketCode: "PL.REVENUE", sectionCode: "PL.REVENUE.OTHER_SECTION", normalSide: "CREDIT", granularity: "LEAF", deprecated: false, selectable: true, displayOrder: 421 }),
  Object.freeze({ code: "PL.EXPENSE.OPERATING_SECTION", label: "Operating expenses", statement: "INCOME_STATEMENT", summaryBucketCode: "PL.EXPENSE", sectionCode: "PL.EXPENSE.OPERATING_SECTION", normalSide: "DEBIT", granularity: "SECTION", deprecated: false, selectable: false, displayOrder: 510 }),
  Object.freeze({ code: "PL.EXPENSE.COST_OF_MATERIALS_AND_SERVICES", label: "Cost of materials and services", statement: "INCOME_STATEMENT", summaryBucketCode: "PL.EXPENSE", sectionCode: "PL.EXPENSE.OPERATING_SECTION", normalSide: "DEBIT", granularity: "LEAF", deprecated: false, selectable: true, displayOrder: 511 }),
  Object.freeze({ code: "PL.EXPENSE.PERSONNEL_EXPENSES", label: "Personnel expenses", statement: "INCOME_STATEMENT", summaryBucketCode: "PL.EXPENSE", sectionCode: "PL.EXPENSE.OPERATING_SECTION", normalSide: "DEBIT", granularity: "LEAF", deprecated: false, selectable: true, displayOrder: 512 }),
  Object.freeze({ code: "PL.EXPENSE.OTHER_OPERATING_EXPENSES", label: "Other operating expenses", statement: "INCOME_STATEMENT", summaryBucketCode: "PL.EXPENSE", sectionCode: "PL.EXPENSE.OPERATING_SECTION", normalSide: "DEBIT", granularity: "LEAF", deprecated: false, selectable: true, displayOrder: 513 }),
  Object.freeze({ code: "PL.EXPENSE.DEPRECIATION_AND_AMORTISATION", label: "Depreciation and amortisation", statement: "INCOME_STATEMENT", summaryBucketCode: "PL.EXPENSE", sectionCode: "PL.EXPENSE.OPERATING_SECTION", normalSide: "DEBIT", granularity: "LEAF", deprecated: false, selectable: true, displayOrder: 514 }),
  Object.freeze({ code: "PL.EXPENSE.FINANCIAL_SECTION", label: "Financial expenses", statement: "INCOME_STATEMENT", summaryBucketCode: "PL.EXPENSE", sectionCode: "PL.EXPENSE.FINANCIAL_SECTION", normalSide: "DEBIT", granularity: "SECTION", deprecated: false, selectable: false, displayOrder: 520 }),
  Object.freeze({ code: "PL.EXPENSE.FINANCIAL_EXPENSES", label: "Financial expenses", statement: "INCOME_STATEMENT", summaryBucketCode: "PL.EXPENSE", sectionCode: "PL.EXPENSE.FINANCIAL_SECTION", normalSide: "DEBIT", granularity: "LEAF", deprecated: false, selectable: true, displayOrder: 521 }),
  Object.freeze({ code: "PL.EXPENSE.TAX_SECTION", label: "Income tax", statement: "INCOME_STATEMENT", summaryBucketCode: "PL.EXPENSE", sectionCode: "PL.EXPENSE.TAX_SECTION", normalSide: "DEBIT", granularity: "SECTION", deprecated: false, selectable: false, displayOrder: 530 }),
  Object.freeze({ code: "PL.EXPENSE.INCOME_TAX", label: "Income tax", statement: "INCOME_STATEMENT", summaryBucketCode: "PL.EXPENSE", sectionCode: "PL.EXPENSE.TAX_SECTION", normalSide: "DEBIT", granularity: "LEAF", deprecated: false, selectable: true, displayOrder: 531 })
]);

export const FROZEN_BALANCE_LINES = Object.freeze([
  Object.freeze({ accountCode: "1000", accountLabel: "Synthetic cash account", debit: "105000", credit: "0" }),
  Object.freeze({ accountCode: "1100", accountLabel: "Synthetic trade receivables", debit: "25000", credit: "0" }),
  Object.freeze({ accountCode: "1200", accountLabel: "Synthetic prepaid expenses", debit: "7000", credit: "0" }),
  Object.freeze({ accountCode: "2000", accountLabel: "Synthetic trade payables", debit: "0", credit: "29000" }),
  Object.freeze({ accountCode: "2800", accountLabel: "Synthetic retained earnings", debit: "0", credit: "30000" }),
  Object.freeze({ accountCode: "3000", accountLabel: "Synthetic operating revenue", debit: "0", credit: "90000" }),
  Object.freeze({ accountCode: "4000", accountLabel: "Synthetic operating expenses", debit: "12000", credit: "0" })
]);

export const WORKPAPER_ANCHORS = Object.freeze([
  Object.freeze({ anchorCode: "BS.ASSET.CURRENT_SECTION", anchorLabel: "Current assets", summaryBucketCode: "BS.ASSET", statementKind: "BALANCE_SHEET", breakdownType: "SECTION", isCurrentStructure: true }),
  Object.freeze({ anchorCode: "BS.LIABILITY.CURRENT_SECTION", anchorLabel: "Current liabilities", summaryBucketCode: "BS.LIABILITY", statementKind: "BALANCE_SHEET", breakdownType: "SECTION", isCurrentStructure: true }),
  Object.freeze({ anchorCode: "BS.EQUITY.CORE_SECTION", anchorLabel: "Equity", summaryBucketCode: "BS.EQUITY", statementKind: "BALANCE_SHEET", breakdownType: "SECTION", isCurrentStructure: true }),
  Object.freeze({ anchorCode: "PL.REVENUE.OPERATING_SECTION", anchorLabel: "Operating revenue", summaryBucketCode: "PL.REVENUE", statementKind: "INCOME_STATEMENT", breakdownType: "SECTION", isCurrentStructure: true }),
  Object.freeze({ anchorCode: "PL.EXPENSE.OPERATING_SECTION", anchorLabel: "Operating expenses", summaryBucketCode: "PL.EXPENSE", statementKind: "INCOME_STATEMENT", breakdownType: "SECTION", isCurrentStructure: true })
]);

export const TASK_IDS = Object.freeze(Array.from({ length: 16 }, (_, index) => `T${String(index).padStart(2, "0")}`));
export const TASK_STATUSES = Object.freeze(["PASS", "FAIL", "NOT_REACHED"]);
export const RUN_RESULTS = Object.freeze(["COMPLETED", "INCOMPLETE", "PRE_EXECUTION_PREFLIGHT_FAILURE"]);
export const USEFULNESS_OBSERVATION_CODES = Object.freeze([
  "NO_FRICTION",
  "MINOR_FRICTION",
  "MAJOR_FRICTION",
  "BLOCKING_FRICTION"
]);

const FORBIDDEN_CLI_OPTIONS = /^(?:force|yes|ignore(?:-.+)?)$/;
const FORBIDDEN_EVIDENCE_KEY = /^(?:password|jwt|hmacSecret|secret|token|credential|passfile|passfileContents)$/i;
const PRIVATE_USER_PATH = /(?:[a-z]:\\Users\\[^\\\r\n]+|\\\\[^\\\r\n]+\\[^\\\r\n]+)/i;
const WINDOWS_DEVICE_PATH = /^(?:\\\\[?.]\\|\\[?.]\\)/;
const WINDOWS_DRIVE_ABSOLUTE = /^[A-Z]:\\/;
const UTC_MILLISECONDS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const STABLE_ERROR_CODE = /^[A-Z][A-Z0-9_]{0,95}$/;
const ALLOWED_RUNS = new Set(["R1", "R2"]);

function stableErrorCode(value, fallback = "ORCHESTRATOR_FAILURE") {
  return typeof value === "string" && STABLE_ERROR_CODE.test(value) ? value : fallback;
}

export class OrchestratorError extends Error {
  constructor(code, safeDetails = undefined) {
    const normalizedCode = stableErrorCode(code);
    super(normalizedCode);
    this.name = "OrchestratorError";
    this.code = normalizedCode;
    if (safeDetails !== undefined && normalizedCode === code) this.safeDetails = safeDetails;
  }
}

export function fail(code, safeDetails = undefined) {
  throw new OrchestratorError(code, safeDetails);
}

export function normalizeFailure(error, fallbackCode = "ORCHESTRATOR_FAILURE") {
  const candidate = error instanceof OrchestratorError ? error.code : fallbackCode;
  return new OrchestratorError(stableErrorCode(candidate, stableErrorCode(fallbackCode)));
}

export function assertPlainObject(value, code = "OBJECT_REQUIRED") {
  if (value === null || typeof value !== "object" || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) {
    fail(code);
  }
  return value;
}

export function assertExactKeys(value, expectedKeys, code = "OBJECT_SCHEMA_MISMATCH") {
  assertPlainObject(value, code);
  const actual = Object.keys(value);
  if (actual.length !== expectedKeys.length || actual.some((key, index) => key !== expectedKeys[index])) {
    fail(code);
  }
  return value;
}

export function assertClosedKeys(value, expectedKeys, code = "OBJECT_SCHEMA_MISMATCH") {
  assertPlainObject(value, code);
  const actual = Object.keys(value).sort();
  const expected = [...expectedKeys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    fail(code);
  }
  return value;
}

export function assertString(value, code, { pattern, values, allowEmpty = false } = {}) {
  if (typeof value !== "string" || (!allowEmpty && value.length === 0)) fail(code);
  if (pattern !== undefined && !pattern.test(value)) fail(code);
  if (values !== undefined && !values.includes(value)) fail(code);
  return value;
}

export function assertInteger(value, code, { minimum, maximum } = {}) {
  if (!Number.isSafeInteger(value)) fail(code);
  if (minimum !== undefined && value < minimum) fail(code);
  if (maximum !== undefined && value > maximum) fail(code);
  return value;
}

export function assertUtcMilliseconds(value, code = "UTC_MILLISECONDS_REQUIRED") {
  assertString(value, code, { pattern: UTC_MILLISECONDS });
  if (Number.isNaN(Date.parse(value))) fail(code);
  return value;
}

export function sha256Hex(value) {
  const bytes = Buffer.isBuffer(value) ? value : Buffer.from(String(value), "utf8");
  return createHash("sha256").update(bytes).digest("hex");
}

export function assertJsonValue(value, code = "JSON_VALUE_INVALID") {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) fail(code);
    return value;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => assertJsonValue(item, code));
    return value;
  }
  if (typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
    for (const nested of Object.values(value)) assertJsonValue(nested, code);
    return value;
  }
  fail(code);
}

function sortRecursively(value) {
  if (Array.isArray(value)) return value.map(sortRecursively);
  if (value !== null && typeof value === "object") {
    const sorted = {};
    for (const key of Object.keys(value).sort()) sorted[key] = sortRecursively(value[key]);
    return sorted;
  }
  return value;
}

export function canonicalJson(value) {
  assertJsonValue(value);
  return `${JSON.stringify(sortRecursively(value))}\n`;
}

class StrictJsonParser {
  constructor(text) {
    this.text = text;
    this.index = 0;
  }

  parse() {
    this.skipWhitespace();
    const value = this.parseValue();
    this.skipWhitespace();
    if (this.index !== this.text.length) fail("JSON_TRAILING_CONTENT");
    return value;
  }

  parseValue() {
    const character = this.text[this.index];
    if (character === "{") return this.parseObject();
    if (character === "[") return this.parseArray();
    if (character === '"') return this.parseString();
    if (character === "t") return this.parseLiteral("true", true);
    if (character === "f") return this.parseLiteral("false", false);
    if (character === "n") return this.parseLiteral("null", null);
    if (character === "-" || /[0-9]/.test(character ?? "")) return this.parseNumber();
    fail("JSON_INVALID");
  }

  parseObject() {
    this.index += 1;
    const result = {};
    const keys = new Set();
    this.skipWhitespace();
    if (this.text[this.index] === "}") {
      this.index += 1;
      return result;
    }
    while (true) {
      this.skipWhitespace();
      if (this.text[this.index] !== '"') fail("JSON_OBJECT_KEY_INVALID");
      const key = this.parseString();
      if (keys.has(key)) fail("JSON_DUPLICATE_KEY");
      keys.add(key);
      this.skipWhitespace();
      if (this.text[this.index] !== ":") fail("JSON_INVALID");
      this.index += 1;
      this.skipWhitespace();
      result[key] = this.parseValue();
      this.skipWhitespace();
      const separator = this.text[this.index];
      if (separator === "}") {
        this.index += 1;
        return result;
      }
      if (separator !== ",") fail("JSON_INVALID");
      this.index += 1;
    }
  }

  parseArray() {
    this.index += 1;
    const result = [];
    this.skipWhitespace();
    if (this.text[this.index] === "]") {
      this.index += 1;
      return result;
    }
    while (true) {
      this.skipWhitespace();
      result.push(this.parseValue());
      this.skipWhitespace();
      const separator = this.text[this.index];
      if (separator === "]") {
        this.index += 1;
        return result;
      }
      if (separator !== ",") fail("JSON_INVALID");
      this.index += 1;
    }
  }

  parseString() {
    const start = this.index;
    this.index += 1;
    let escaped = false;
    while (this.index < this.text.length) {
      const character = this.text[this.index];
      if (!escaped && character === '"') {
        this.index += 1;
        try {
          return JSON.parse(this.text.slice(start, this.index));
        } catch {
          fail("JSON_STRING_INVALID");
        }
      }
      if (!escaped && character === "\\") escaped = true;
      else escaped = false;
      if (character.charCodeAt(0) < 0x20) fail("JSON_STRING_INVALID");
      this.index += 1;
    }
    fail("JSON_STRING_INVALID");
  }

  parseLiteral(literal, value) {
    if (this.text.slice(this.index, this.index + literal.length) !== literal) fail("JSON_INVALID");
    this.index += literal.length;
    return value;
  }

  parseNumber() {
    const match = this.text.slice(this.index).match(/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/);
    if (match === null) fail("JSON_NUMBER_INVALID");
    this.index += match[0].length;
    const value = Number(match[0]);
    if (!Number.isFinite(value)) fail("JSON_NUMBER_INVALID");
    return value;
  }

  skipWhitespace() {
    while (/[\t\n\r ]/.test(this.text[this.index] ?? "")) this.index += 1;
  }
}

export function parseJsonStrict(text) {
  if (typeof text !== "string" || text.charCodeAt(0) === 0xfeff) fail("JSON_UTF8_BOM_FORBIDDEN");
  return new StrictJsonParser(text).parse();
}

export function parseCanonicalJson(text, code = "CANONICAL_JSON_REQUIRED") {
  const value = parseJsonStrict(text);
  if (canonicalJson(value) !== text) fail(code);
  return value;
}

export function validateRun(run) {
  assertString(run, "RUN_INVALID", { values: [...ALLOWED_RUNS] });
  return run;
}

export function validateRunId(runId, expectedRun = undefined) {
  assertString(runId, "RUN_ID_INVALID", { pattern: RUN_ID_REGEX });
  if (runId.length !== RUN_ID_LENGTH) fail("RUN_ID_INVALID");
  if (expectedRun !== undefined && !runId.startsWith(expectedRun.toLowerCase())) fail("RUN_ID_RUN_MISMATCH");
  return runId;
}

export function generateRunId({ run, now, randomBytes = nodeRandomBytes }) {
  validateRun(run);
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) fail("CLOCK_INVALID");
  const timestamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "z").toLowerCase();
  const entropy = Buffer.from(randomBytes(6));
  if (entropy.length !== 6) fail("RANDOM_BYTES_INVALID");
  const runId = `${run.toLowerCase()}-${timestamp}-${entropy.toString("hex")}`;
  return validateRunId(runId, run);
}

export function assertRunIdAvailable(runId, collisions) {
  validateRunId(runId);
  if (!Array.isArray(collisions)) fail("COLLISION_RESULT_INVALID");
  if (collisions.includes(runId)) fail("RUN_ID_COLLISION");
  return runId;
}

export function quoteSqlIdentifier(identifier) {
  assertString(identifier, "SQL_IDENTIFIER_INVALID", { pattern: SQL_IDENTIFIER_REGEX });
  return `"${identifier.replaceAll('"', '""')}"`;
}

export function quoteSqlLiteral(value) {
  if (typeof value !== "string" || value.includes("\0")) fail("SQL_LITERAL_INVALID");
  return `'${value.replaceAll("'", "''")}'`;
}

export function validateLocalAppDataRoot(localAppData, metadata = undefined) {
  assertString(localAppData, "LOCAL_APP_DATA_INVALID");
  if (!WINDOWS_DRIVE_ABSOLUTE.test(localAppData) || !path.isAbsolute(localAppData)) fail("LOCAL_APP_DATA_NOT_FIXED_ABSOLUTE");
  if (WINDOWS_DEVICE_PATH.test(localAppData) || localAppData.startsWith("\\\\")) fail("LOCAL_APP_DATA_NETWORK_OR_DEVICE");
  if (localAppData.includes("/")) fail("LOCAL_APP_DATA_SEPARATOR_INVALID");
  const normalized = path.normalize(localAppData);
  if (normalized !== localAppData || path.parse(localAppData).root === localAppData) fail("LOCAL_APP_DATA_NON_CANONICAL");
  if (metadata !== undefined) {
    assertClosedKeys(metadata, ["driveType", "canonicalPath", "reparse"], "LOCAL_APP_DATA_METADATA_INVALID");
    if (metadata.driveType !== "FIXED" || metadata.reparse !== false || metadata.canonicalPath !== localAppData) {
      fail("LOCAL_APP_DATA_UNSAFE");
    }
  }
  return localAppData;
}

export function deriveResources({ runId, localAppData }) {
  validateRunId(runId);
  validateLocalAppDataRoot(localAppData);
  const identifierRunId = runId.replaceAll("-", "_");
  const dbName = `ritomer_043c_${identifierRunId}`;
  const roleName = `${dbName}_runner`;
  quoteSqlIdentifier(dbName);
  quoteSqlIdentifier(roleName);
  const runtimeBase = path.join(localAppData, "Ritomer", "043c", "runtime");
  const evidenceBase = path.join(localAppData, "Ritomer", "043c", "evidence");
  const runtimeRoot = path.join(runtimeBase, runId);
  const storageRoot = path.join(runtimeRoot, "storage");
  const evidenceRoot = path.join(evidenceBase, runId);
  return Object.freeze({
    dbName,
    roleName,
    runtimeBase,
    runtimeRoot,
    storageRoot,
    evidenceBase,
    evidenceRoot,
    recoveryStatePath: path.join(evidenceRoot, "recovery-state.json"),
    exportPath: path.join(evidenceRoot, "export-pack.zip"),
    summaryPath: path.join(evidenceRoot, "run-summary.json"),
    summaryHashPath: path.join(evidenceRoot, "run-summary.json.sha256")
  });
}

export function globalRunSlotIdentitySha256(input) {
  assertClosedKeys(input, ["repository", "head", "evidenceBaseSha256", "runSlot"], "GLOBAL_RUN_SLOT_BINDING_MISMATCH");
  const { repository, head, evidenceBaseSha256, runSlot } = input;
  const identity = { repository, head, evidenceBaseSha256, runSlot };
  if (repository !== REPOSITORY) fail("GLOBAL_RUN_SLOT_BINDING_MISMATCH");
  assertString(head, "GLOBAL_RUN_SLOT_BINDING_MISMATCH", { pattern: GIT_SHA1_REGEX });
  assertString(evidenceBaseSha256, "GLOBAL_RUN_SLOT_BINDING_MISMATCH", { pattern: SHA256_REGEX });
  if (!ALLOWED_RUNS.has(runSlot)) fail("GLOBAL_RUN_SLOT_BINDING_MISMATCH");
  return sha256Hex(canonicalJson(identity));
}

export function assertExactDerivedPath(candidate, expected, allowedBase) {
  for (const value of [candidate, expected, allowedBase]) assertString(value, "PATH_INVALID");
  if (!path.isAbsolute(candidate) || WINDOWS_DEVICE_PATH.test(candidate) || candidate.startsWith("\\\\")) fail("PATH_NOT_LOCAL_ABSOLUTE");
  if (candidate.includes("/") || path.normalize(candidate) !== candidate) fail("PATH_NON_CANONICAL");
  if (candidate !== expected) fail("PATH_DERIVATION_MISMATCH");
  const relative = path.relative(allowedBase, candidate);
  if (relative === "" || relative.startsWith("..\\") || relative === ".." || path.isAbsolute(relative)) fail("PATH_OUTSIDE_ALLOWED_ROOT");
  return candidate;
}

export function validatePathInspection(inspection, expectedPath, allowedBase) {
  assertClosedKeys(inspection, ["path", "canonicalPath", "exists", "type", "reparse", "driveType"], "PATH_INSPECTION_INVALID");
  assertExactDerivedPath(inspection.path, expectedPath, allowedBase);
  if (inspection.canonicalPath !== expectedPath || inspection.driveType !== "FIXED") fail("PATH_CANONICAL_OR_DRIVE_MISMATCH");
  if (inspection.reparse !== false) fail("PATH_REPARSE_FORBIDDEN");
  if (inspection.exists && inspection.type !== "DIRECTORY") fail("PATH_TYPE_INVALID");
  if (!inspection.exists && inspection.type !== "ABSENT") fail("PATH_TYPE_INVALID");
  return inspection;
}

const TOOL_NAMES = Object.freeze(["node", "psql", "java", "cmd", "gradleWrapper", "harness"]);

export function buildToolEvidence(tools) {
  assertClosedKeys(tools, TOOL_NAMES, "TOOLS_INVALID");
  const evidence = {};
  for (const name of TOOL_NAMES) {
    const tool = tools[name];
    assertClosedKeys(tool, ["path", "version", "sha256"], "TOOL_INSPECTION_INVALID");
    assertString(tool.path, "TOOL_PATH_INVALID");
    if (!path.isAbsolute(tool.path) || WINDOWS_DEVICE_PATH.test(tool.path) || tool.path.startsWith("\\\\") || tool.path.includes("/")) fail("TOOL_PATH_INVALID");
    assertString(tool.version, "TOOL_VERSION_INVALID");
    assertString(tool.sha256, "TOOL_HASH_INVALID", { pattern: SHA256_REGEX });
    if (PRIVATE_USER_PATH.test(tool.path)) fail("TOOL_PRIVATE_PATH_FORBIDDEN");
    evidence[name] = Object.freeze({ path: tool.path, version: tool.version, sha256: tool.sha256 });
  }
  if (!/^22\./.test(evidence.node.version) || !/^16(?:\.|$)/.test(evidence.psql.version) || !/^21(?:\.|$)/.test(evidence.java.version) || !/^10(?:\.|$)/.test(evidence.cmd.version) || evidence.gradleWrapper.version !== "8.14.4" || !/^043b(?:-|$)/.test(evidence.harness.version)) fail("TOOL_VERSION_UNSUPPORTED");
  return Object.freeze(evidence);
}

export function validateToolEvidence(tools) {
  assertClosedKeys(tools, TOOL_NAMES, "TOOL_EVIDENCE_INVALID");
  for (const name of TOOL_NAMES) {
    assertClosedKeys(tools[name], ["path", "version", "sha256"], "TOOL_EVIDENCE_INVALID");
    assertString(tools[name].path, "TOOL_EVIDENCE_INVALID");
    if (!path.isAbsolute(tools[name].path) || WINDOWS_DEVICE_PATH.test(tools[name].path) || tools[name].path.startsWith("\\\\") || tools[name].path.includes("/") || PRIVATE_USER_PATH.test(tools[name].path)) fail("TOOL_EVIDENCE_INVALID");
    assertString(tools[name].version, "TOOL_EVIDENCE_INVALID");
    assertString(tools[name].sha256, "TOOL_EVIDENCE_INVALID", { pattern: SHA256_REGEX });
  }
  if (!/^22\./.test(tools.node.version) || !/^16(?:\.|$)/.test(tools.psql.version) || !/^21(?:\.|$)/.test(tools.java.version) || !/^10(?:\.|$)/.test(tools.cmd.version) || tools.gradleWrapper.version !== "8.14.4" || !/^043b(?:-|$)/.test(tools.harness.version)) fail("TOOL_VERSION_UNSUPPORTED");
  return tools;
}

const CLI_SCHEMA = Object.freeze({
  propose: Object.freeze({ required: ["run"], optional: ["prior-run-id"] }),
  run: Object.freeze({
    required: [
      "run",
      "run-id",
      "tenant-id",
      "environment",
      "proposal-sha256",
      "pre-execution-review-record-path",
      "pre-execution-review-sha256",
      "sensitive-authorization-record-path",
      "sensitive-authorization-sha256",
      "repository",
      "head",
      "protocol-version",
      "schema-version"
    ],
    optional: ["prior-run-id"]
  })
});

export function validateRecordPath(value) {
  assertString(value, "RECORD_PATH_INVALID");
  if (!path.isAbsolute(value) || WINDOWS_DEVICE_PATH.test(value) || value.startsWith("\\\\") || value.includes("/") || value.includes("\0") || path.normalize(value) !== value || value.endsWith("\\")) fail("RECORD_PATH_INVALID");
  return value;
}

export function parseCliArgs(argv) {
  if (!Array.isArray(argv) || argv.length === 0) fail("CLI_VERB_REQUIRED");
  const [verb, ...tokens] = argv;
  if (!Object.hasOwn(CLI_SCHEMA, verb)) fail("CLI_VERB_INVALID");
  const options = {};
  for (let index = 0; index < tokens.length; index += 2) {
    const optionToken = tokens[index];
    const value = tokens[index + 1];
    if (typeof optionToken !== "string" || !/^--[a-z0-9-]+$/.test(optionToken) || value === undefined || String(value).startsWith("--")) {
      fail("CLI_OPTION_SYNTAX_INVALID");
    }
    const name = optionToken.slice(2);
    if (FORBIDDEN_CLI_OPTIONS.test(name)) fail("CLI_BYPASS_OPTION_FORBIDDEN");
    const allowed = [...CLI_SCHEMA[verb].required, ...CLI_SCHEMA[verb].optional];
    if (!allowed.includes(name)) fail("CLI_OPTION_UNKNOWN", { option: name });
    if (Object.hasOwn(options, name)) fail("CLI_OPTION_DUPLICATE", { option: name });
    options[name] = String(value);
  }
  for (const name of CLI_SCHEMA[verb].required) {
    if (!Object.hasOwn(options, name)) fail("CLI_OPTION_REQUIRED", { option: name });
  }
  validateRun(options.run);
  if (options.run === "R1" && Object.hasOwn(options, "prior-run-id")) fail("PRIOR_RUN_ID_FORBIDDEN_FOR_R1");
  if (options.run === "R2" && !Object.hasOwn(options, "prior-run-id")) fail("PRIOR_RUN_ID_REQUIRED_FOR_R2");
  if (Object.hasOwn(options, "prior-run-id")) validateRunId(options["prior-run-id"], "R1");
  if (verb === "run") {
    validateRunId(options["run-id"], options.run);
    if (options["tenant-id"] !== TENANT_ID) fail("TENANT_ID_MISMATCH");
    if (options.environment !== ENVIRONMENT) fail("ENVIRONMENT_MISMATCH");
    if (options.repository !== REPOSITORY) fail("REPOSITORY_MISMATCH");
    validateRecordPath(options["pre-execution-review-record-path"]);
    validateRecordPath(options["sensitive-authorization-record-path"]);
    for (const name of ["proposal-sha256", "pre-execution-review-sha256", "sensitive-authorization-sha256"]) {
      assertString(options[name], "SHA256_INVALID", { pattern: SHA256_REGEX });
    }
    assertString(options.head, "GIT_HEAD_INVALID", { pattern: GIT_SHA1_REGEX });
    if (options["protocol-version"] !== PROTOCOL_VERSION || options["schema-version"] !== SUMMARY_SCHEMA_VERSION) {
      fail("VERSION_MISMATCH");
    }
  }
  return Object.freeze({ verb, options: Object.freeze(options) });
}

export function createProposal(input) {
  const keys = [
    "schemaVersion",
    "protocolId",
    "protocolVersion",
    "repository",
    "head",
    "orchestratorSha256",
    "run",
    "runId",
    "priorRunId",
    "tenantId",
    "environment",
    "resources",
    "fixtures",
    "tools",
    "ports",
    "evidenceSummarySchemaVersion"
  ];
  assertClosedKeys(input, keys, "PROPOSAL_SCHEMA_INVALID");
  const proposal = {};
  for (const key of keys) proposal[key] = input[key];
  validateProposal(proposal);
  return Object.freeze(proposal);
}

export function validateProposal(proposal) {
  assertClosedKeys(proposal, [
    "schemaVersion",
    "protocolId",
    "protocolVersion",
    "repository",
    "head",
    "orchestratorSha256",
    "run",
    "runId",
    "priorRunId",
    "tenantId",
    "environment",
    "resources",
    "fixtures",
    "tools",
    "ports",
    "evidenceSummarySchemaVersion"
  ], "PROPOSAL_SCHEMA_INVALID");
  if (proposal.schemaVersion !== "043c-proposal-v1" || proposal.protocolId !== PROTOCOL_ID || proposal.protocolVersion !== PROTOCOL_VERSION) fail("PROPOSAL_VERSION_INVALID");
  if (proposal.repository !== REPOSITORY || proposal.tenantId !== TENANT_ID || proposal.environment !== ENVIRONMENT) fail("PROPOSAL_SCOPE_INVALID");
  validateRun(proposal.run);
  validateRunId(proposal.runId, proposal.run);
  if (proposal.run === "R1" && proposal.priorRunId !== null) fail("PROPOSAL_PRIOR_RUN_INVALID");
  if (proposal.run === "R2") validateRunId(proposal.priorRunId, "R1");
  assertString(proposal.head, "PROPOSAL_HEAD_INVALID", { pattern: GIT_SHA1_REGEX });
  assertString(proposal.orchestratorSha256, "PROPOSAL_HASH_INVALID", { pattern: SHA256_REGEX });
  if (proposal.evidenceSummarySchemaVersion !== SUMMARY_SCHEMA_VERSION) fail("PROPOSAL_SUMMARY_VERSION_INVALID");
  assertClosedKeys(proposal.resources, ["dbName", "roleName", "runtimeRootSha256", "storageRootSha256", "evidenceRootSha256"], "PROPOSAL_RESOURCES_INVALID");
  quoteSqlIdentifier(proposal.resources.dbName);
  quoteSqlIdentifier(proposal.resources.roleName);
  for (const hash of [proposal.resources.runtimeRootSha256, proposal.resources.storageRootSha256, proposal.resources.evidenceRootSha256]) assertString(hash, "PROPOSAL_RESOURCES_INVALID", { pattern: SHA256_REGEX });
  if (!Array.isArray(proposal.fixtures) || proposal.fixtures.length !== 2) fail("PROPOSAL_FIXTURES_INVALID");
  if (!Array.isArray(proposal.ports) || proposal.ports.join(",") !== PORTS.join(",")) fail("PROPOSAL_PORTS_INVALID");
  validateToolEvidence(proposal.tools);
  return proposal;
}

export function proposalSha256(proposal) {
  validateProposal(proposal);
  return sha256Hex(canonicalJson(proposal));
}

export function proposalFromBinding(binding) {
  validateBinding(binding);
  return createProposal({
    schemaVersion: "043c-proposal-v1",
    protocolId: binding.protocolId,
    protocolVersion: binding.protocolVersion,
    repository: binding.repository,
    head: binding.head,
    orchestratorSha256: binding.orchestratorSha256,
    run: binding.run,
    runId: binding.runId,
    priorRunId: binding.priorRunId,
    tenantId: binding.tenantId,
    environment: binding.environment,
    resources: structuredClone(binding.resources),
    fixtures: binding.fixtures.map((fixture) => ({ fileName: fixture.name, byteSize: fixture.byteSize, sha256: fixture.sha256 })),
    tools: structuredClone(binding.tools),
    ports: [...binding.ports],
    evidenceSummarySchemaVersion: binding.evidenceSummarySchemaVersion
  });
}

export const BINDING_KEYS = Object.freeze([
  "schemaVersion",
  "protocolId",
  "protocolVersion",
  "orchestratorSha256",
  "repository",
  "head",
  "run",
  "runId",
  "priorRunId",
  "tenantId",
  "environment",
  "proposalSha256",
  "resources",
  "fixtures",
  "tools",
  "ports",
  "passfileMetadata",
  "preExecutionReview",
  "sensitiveAuthorization",
  "evidenceSummarySchemaVersion"
]);

export function createBinding(input) {
  assertClosedKeys(input, BINDING_KEYS, "BINDING_SCHEMA_INVALID");
  const binding = {};
  for (const key of BINDING_KEYS) binding[key] = input[key];
  validateBinding(binding);
  return Object.freeze(binding);
}

export function validateBinding(binding) {
  assertClosedKeys(binding, BINDING_KEYS, "BINDING_SCHEMA_INVALID");
  if (binding.schemaVersion !== BINDING_SCHEMA_VERSION || binding.protocolId !== PROTOCOL_ID || binding.protocolVersion !== PROTOCOL_VERSION) fail("BINDING_VERSION_INVALID");
  if (binding.repository !== REPOSITORY || binding.tenantId !== TENANT_ID || binding.environment !== ENVIRONMENT) fail("BINDING_SCOPE_INVALID");
  validateRun(binding.run);
  validateRunId(binding.runId, binding.run);
  if (binding.run === "R1" && binding.priorRunId !== null) fail("BINDING_PRIOR_RUN_INVALID");
  if (binding.run === "R2") validateRunId(binding.priorRunId, "R1");
  assertString(binding.orchestratorSha256, "BINDING_HASH_INVALID", { pattern: SHA256_REGEX });
  assertString(binding.proposalSha256, "BINDING_PROPOSAL_HASH_INVALID", { pattern: SHA256_REGEX });
  assertString(binding.head, "BINDING_HEAD_INVALID", { pattern: GIT_SHA1_REGEX });
  assertClosedKeys(binding.resources, ["dbName", "roleName", "runtimeRootSha256", "storageRootSha256", "evidenceRootSha256"], "BINDING_RESOURCES_INVALID");
  quoteSqlIdentifier(binding.resources.dbName);
  quoteSqlIdentifier(binding.resources.roleName);
  for (const hash of [binding.resources.runtimeRootSha256, binding.resources.storageRootSha256, binding.resources.evidenceRootSha256]) assertString(hash, "BINDING_RESOURCES_INVALID", { pattern: SHA256_REGEX });
  if (!Array.isArray(binding.fixtures) || binding.fixtures.length !== 2) fail("BINDING_FIXTURES_INVALID");
  for (const fixture of binding.fixtures) {
    assertClosedKeys(fixture, ["name", "byteSize", "sha256"], "BINDING_FIXTURE_INVALID");
    assertInteger(fixture.byteSize, "BINDING_FIXTURE_INVALID", { minimum: 1 });
    assertString(fixture.sha256, "BINDING_FIXTURE_INVALID", { pattern: SHA256_REGEX });
  }
  validateToolEvidence(binding.tools);
  if (!Array.isArray(binding.ports) || binding.ports.join(",") !== PORTS.join(",")) fail("BINDING_PORTS_INVALID");
  assertClosedKeys(binding.passfileMetadata, ["absolute", "outsideRepository", "regularFile", "nonReparse", "aclChecked", "contentRead", "pathSha256", "fileIdentitySha256", "aclSha256"], "BINDING_PASSFILE_METADATA_INVALID");
  if (
    binding.passfileMetadata.absolute !== true ||
    binding.passfileMetadata.outsideRepository !== true ||
    binding.passfileMetadata.regularFile !== true ||
    binding.passfileMetadata.nonReparse !== true ||
    binding.passfileMetadata.aclChecked !== true ||
    binding.passfileMetadata.contentRead !== false
  ) fail("BINDING_PASSFILE_METADATA_INVALID");
  for (const hash of [binding.passfileMetadata.pathSha256, binding.passfileMetadata.fileIdentitySha256, binding.passfileMetadata.aclSha256]) assertString(hash, "BINDING_PASSFILE_METADATA_INVALID", { pattern: SHA256_REGEX });
  assertClosedKeys(binding.preExecutionReview, ["recordId", "pathSha256", "sha256", "environmentBindingSha256"], "BINDING_REVIEW_INVALID");
  assertClosedKeys(binding.sensitiveAuthorization, ["recordId", "pathSha256", "sha256", "environmentBindingSha256", "preExecutionReviewRecordId", "preExecutionReviewPathSha256", "preExecutionReviewSha256"], "BINDING_AUTHORIZATION_INVALID");
  for (const record of [binding.preExecutionReview, binding.sensitiveAuthorization]) {
    assertString(record.recordId, "BINDING_RECORD_INVALID", { pattern: /^043c-[a-z0-9][a-z0-9-]{6,95}$/ });
    assertString(record.pathSha256, "BINDING_RECORD_INVALID", { pattern: SHA256_REGEX });
    assertString(record.sha256, "BINDING_RECORD_INVALID", { pattern: SHA256_REGEX });
  }
  assertString(binding.preExecutionReview.environmentBindingSha256, "BINDING_REVIEW_INVALID", { pattern: SHA256_REGEX });
  assertString(binding.sensitiveAuthorization.environmentBindingSha256, "BINDING_AUTHORIZATION_INVALID", { pattern: SHA256_REGEX });
  assertString(binding.sensitiveAuthorization.preExecutionReviewRecordId, "BINDING_AUTHORIZATION_INVALID", { pattern: /^043c-[a-z0-9][a-z0-9-]{6,95}$/ });
  for (const hash of [binding.sensitiveAuthorization.preExecutionReviewPathSha256, binding.sensitiveAuthorization.preExecutionReviewSha256]) {
    assertString(hash, "BINDING_AUTHORIZATION_INVALID", { pattern: SHA256_REGEX });
  }
  if (binding.preExecutionReview.environmentBindingSha256 !== binding.sensitiveAuthorization.environmentBindingSha256) fail("RECORD_ENVIRONMENT_BINDING_MISMATCH");
  if (
    binding.sensitiveAuthorization.preExecutionReviewRecordId !== binding.preExecutionReview.recordId ||
    binding.sensitiveAuthorization.preExecutionReviewPathSha256 !== binding.preExecutionReview.pathSha256 ||
    binding.sensitiveAuthorization.preExecutionReviewSha256 !== binding.preExecutionReview.sha256
  ) fail("RECORD_REVIEW_BINDING_MISMATCH");
  if (binding.evidenceSummarySchemaVersion !== SUMMARY_SCHEMA_VERSION) fail("BINDING_SUMMARY_VERSION_INVALID");
  assertNoSensitiveEvidence(binding);
  return binding;
}

export function serializeBinding(binding) {
  validateBinding(binding);
  return canonicalJson(binding);
}

export function parseBinding(text) {
  const binding = parseCanonicalJson(text, "BINDING_NON_CANONICAL");
  validateBinding(binding);
  return binding;
}

export function bindingSha256(binding) {
  return sha256Hex(serializeBinding(binding));
}

const REVIEW_RECORD_KEYS = Object.freeze([
  "schemaVersion",
  "recordId",
  "status",
  "proposalSha256",
  "commandSha256",
  "run",
  "runId",
  "priorRunId",
  "tenantId",
  "environment",
  "repository",
  "head",
  "environmentBindingSha256",
  "reviewedAtUtc"
]);

const AUTHORIZATION_RECORD_KEYS = Object.freeze([
  "schemaVersion",
  "recordId",
  "type",
  "status",
  "proposalSha256",
  "commandSha256",
  "environmentBindingSha256",
  "preExecutionReviewRecordId",
  "preExecutionReviewPathSha256",
  "preExecutionReviewSha256",
  "run",
  "runId",
  "priorRunId",
  "tenantId",
  "environment",
  "repository",
  "head",
  "authorizedAtUtc",
  "consumedAtUtc"
]);

export function parseReviewRecord(text) {
  const record = parseCanonicalJson(text, "REVIEW_RECORD_NON_CANONICAL");
  assertClosedKeys(record, REVIEW_RECORD_KEYS, "REVIEW_RECORD_SCHEMA_INVALID");
  if (record.schemaVersion !== "043c-pre-execution-review-v1" || record.status !== "PASS") fail("PRE_EXECUTION_REVIEW_NOT_PASS");
  validateBoundRecord(record, "REVIEW_RECORD_INVALID");
  assertString(record.environmentBindingSha256, "REVIEW_RECORD_INVALID", { pattern: SHA256_REGEX });
  assertUtcMilliseconds(record.reviewedAtUtc, "REVIEW_RECORD_TIME_INVALID");
  return record;
}

export function parseSensitiveAuthorizationRecord(text) {
  const record = parseCanonicalJson(text, "AUTHORIZATION_RECORD_NON_CANONICAL");
  assertClosedKeys(record, AUTHORIZATION_RECORD_KEYS, "AUTHORIZATION_RECORD_SCHEMA_INVALID");
  if (record.schemaVersion !== "043c-sensitive-authorization-v1" || record.type !== "SENSITIVE_EXECUTION" || record.status !== "YES" || record.consumedAtUtc !== null) {
    fail("SENSITIVE_AUTHORIZATION_NOT_USABLE");
  }
  validateBoundRecord(record, "AUTHORIZATION_RECORD_INVALID");
  assertString(record.environmentBindingSha256, "AUTHORIZATION_RECORD_INVALID", { pattern: SHA256_REGEX });
  assertString(record.preExecutionReviewRecordId, "AUTHORIZATION_RECORD_INVALID", { pattern: /^043c-[a-z0-9][a-z0-9-]{6,95}$/ });
  for (const hash of [record.preExecutionReviewPathSha256, record.preExecutionReviewSha256]) assertString(hash, "AUTHORIZATION_RECORD_INVALID", { pattern: SHA256_REGEX });
  assertUtcMilliseconds(record.authorizedAtUtc, "AUTHORIZATION_RECORD_TIME_INVALID");
  return record;
}

export function buildConsumedAuthorizationRecord(record, consumedAtUtc) {
  const exact = parseSensitiveAuthorizationRecord(canonicalJson(record));
  assertUtcMilliseconds(consumedAtUtc, "AUTHORIZATION_CONSUMED_TIME_INVALID");
  const consumed = { ...exact, status: "CONSUMED", consumedAtUtc };
  assertNoSensitiveEvidence(consumed);
  return Object.freeze(consumed);
}

function validateBoundRecord(record, code) {
  assertString(record.recordId, code, { pattern: /^043c-[a-z0-9][a-z0-9-]{6,95}$/ });
  for (const hash of [record.proposalSha256, record.commandSha256]) assertString(hash, code, { pattern: SHA256_REGEX });
  assertString(record.head, code, { pattern: GIT_SHA1_REGEX });
  validateRun(record.run);
  validateRunId(record.runId, record.run);
  if (record.run === "R1" && record.priorRunId !== null) fail(code);
  if (record.run === "R2") validateRunId(record.priorRunId, "R1");
  if (record.tenantId !== TENANT_ID || record.environment !== ENVIRONMENT || record.repository !== REPOSITORY) fail(code);
}

export function verifyBoundRecords({ binding, proposalHash, commandHash, reviewRecord, reviewBytes, reviewExpectedSha256, authorizationRecord, authorizationBytes, authorizationExpectedSha256 }) {
  validateBinding(binding);
  for (const hash of [proposalHash, commandHash, reviewExpectedSha256, authorizationExpectedSha256]) assertString(hash, "RECORD_HASH_INVALID", { pattern: SHA256_REGEX });
  if (sha256Hex(reviewBytes) !== reviewExpectedSha256 || sha256Hex(authorizationBytes) !== authorizationExpectedSha256) fail("RECORD_FILE_HASH_MISMATCH");
  if (binding.preExecutionReview.sha256 !== reviewExpectedSha256 || binding.sensitiveAuthorization.sha256 !== authorizationExpectedSha256) fail("BINDING_RECORD_HASH_MISMATCH");
  if (binding.preExecutionReview.recordId !== reviewRecord.recordId || binding.sensitiveAuthorization.recordId !== authorizationRecord.recordId) fail("BINDING_RECORD_ID_MISMATCH");
  const fields = ["run", "runId", "priorRunId", "tenantId", "environment", "repository", "head"];
  for (const field of fields) {
    if (reviewRecord[field] !== binding[field] || authorizationRecord[field] !== binding[field]) fail("RECORD_BINDING_MISMATCH", { field });
  }
  if (reviewRecord.proposalSha256 !== proposalHash || authorizationRecord.proposalSha256 !== proposalHash || reviewRecord.commandSha256 !== commandHash || authorizationRecord.commandSha256 !== commandHash) {
    fail("RECORD_COMMAND_BINDING_MISMATCH");
  }
  if (
    reviewRecord.environmentBindingSha256 !== binding.preExecutionReview.environmentBindingSha256 ||
    authorizationRecord.environmentBindingSha256 !== binding.sensitiveAuthorization.environmentBindingSha256 ||
    reviewRecord.environmentBindingSha256 !== authorizationRecord.environmentBindingSha256
  ) fail("RECORD_ENVIRONMENT_BINDING_MISMATCH");
  if (
    authorizationRecord.preExecutionReviewRecordId !== reviewRecord.recordId ||
    authorizationRecord.preExecutionReviewPathSha256 !== binding.preExecutionReview.pathSha256 ||
    authorizationRecord.preExecutionReviewSha256 !== reviewExpectedSha256
  ) fail("RECORD_REVIEW_BINDING_MISMATCH");
  return true;
}

export function assertNoSensitiveEvidence(value, pathLabel = "$") {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoSensitiveEvidence(item, `${pathLabel}[${index}]`));
    return value;
  }
  if (value !== null && typeof value === "object") {
    for (const [key, nested] of Object.entries(value)) {
      if (FORBIDDEN_EVIDENCE_KEY.test(key)) fail("SENSITIVE_EVIDENCE_KEY", { path: `${pathLabel}.${key}` });
      assertNoSensitiveEvidence(nested, `${pathLabel}.${key}`);
    }
    return value;
  }
  if (typeof value === "string" && (PRIVATE_USER_PATH.test(value) || /(?:bearer\s+|eyJ[a-zA-Z0-9_-]*\.)/i.test(value))) {
    fail("SENSITIVE_EVIDENCE_VALUE", { path: pathLabel });
  }
  return value;
}

export function sanitizeDiagnostic(error) {
  const failureValue = normalizeFailure(error);
  return Object.freeze({ code: failureValue.code });
}

const SYSTEM_ENVIRONMENT_NAMES = Object.freeze([
  "ComSpec",
  "PATH",
  "PATHEXT",
  "SystemDrive",
  "SystemRoot",
  "TEMP",
  "TMP",
  "WINDIR"
]);

const HARNESS_VITE_SYSTEM_ENVIRONMENT_NAMES = Object.freeze(["PATH", "SystemRoot", "WINDIR", "ComSpec", "PATHEXT", "TEMP", "TMP"]);

export const CHILD_ENVIRONMENT_SCHEMAS = Object.freeze({
  POSTGRESQL: Object.freeze([
    ...SYSTEM_ENVIRONMENT_NAMES,
    "PGAPPNAME",
    "PGCONNECT_TIMEOUT",
    "PGPASSFILE"
  ]),
  BACKEND: Object.freeze([
    ...SYSTEM_ENVIRONMENT_NAMES,
    "JAVA_HOME",
    "RITOMER_SECURITY_JWT_HMAC_SECRET",
    "RITOMER_WORKPAPERS_DOCUMENTS_STORAGE_BACKEND",
    "RITOMER_WORKPAPERS_DOCUMENTS_STORAGE_LOCAL_ROOT",
    "SPRING_DATASOURCE_HIKARI_MAXIMUM_POOL_SIZE",
    "SPRING_DATASOURCE_PASSWORD",
    "SPRING_DATASOURCE_URL",
    "SPRING_DATASOURCE_USERNAME"
  ]),
  HARNESS: Object.freeze([
    ...SYSTEM_ENVIRONMENT_NAMES,
    "RITOMER_SECURITY_JWT_HMAC_SECRET"
  ]),
  VITE_ACCOUNTANT: Object.freeze([
    ...HARNESS_VITE_SYSTEM_ENVIRONMENT_NAMES,
    "RITOMER_LOCAL_DEMO_BACKEND_TARGET",
    "RITOMER_LOCAL_DEMO_PROXY_AUTH_ENABLED",
    "RITOMER_LOCAL_DEMO_BEARER_TOKEN"
  ]),
  VITE_REVIEWER: Object.freeze([
    ...HARNESS_VITE_SYSTEM_ENVIRONMENT_NAMES,
    "RITOMER_LOCAL_DEMO_BACKEND_TARGET",
    "RITOMER_LOCAL_DEMO_PROXY_AUTH_ENABLED",
    "RITOMER_LOCAL_DEMO_BEARER_TOKEN"
  ])
});

export function buildChildEnvironment(kind, systemEnvironment, runtimeValues = {}) {
  if (!Object.hasOwn(CHILD_ENVIRONMENT_SCHEMAS, kind)) fail("CHILD_ENVIRONMENT_KIND_INVALID");
  assertPlainObject(systemEnvironment, "SYSTEM_ENVIRONMENT_INVALID");
  assertPlainObject(runtimeValues, "RUNTIME_ENVIRONMENT_INVALID");
  const allowed = new Set(CHILD_ENVIRONMENT_SCHEMAS[kind]);
  for (const key of Object.keys(runtimeValues)) {
    if (!allowed.has(key)) fail("CHILD_ENVIRONMENT_NAME_FORBIDDEN", { kind, name: key });
  }
  const result = {};
  for (const name of CHILD_ENVIRONMENT_SCHEMAS[kind]) {
    const value = Object.hasOwn(runtimeValues, name) ? runtimeValues[name] : systemEnvironment[name];
    if (value !== undefined) {
      if (typeof value !== "string" || value.includes("\0")) fail("CHILD_ENVIRONMENT_VALUE_INVALID", { kind, name });
      result[name] = value;
    }
  }
  if (kind === "POSTGRESQL") {
    if (result.PGCONNECT_TIMEOUT !== "5" || !result.PGAPPNAME?.startsWith("ritomer-043c-") || result.PGPASSFILE === undefined) {
      fail("POSTGRESQL_ENVIRONMENT_INCOMPLETE");
    }
  }
  if (kind === "BACKEND") {
    const required = [
      "SPRING_DATASOURCE_URL",
      "SPRING_DATASOURCE_USERNAME",
      "SPRING_DATASOURCE_PASSWORD",
      "SPRING_DATASOURCE_HIKARI_MAXIMUM_POOL_SIZE",
      "RITOMER_SECURITY_JWT_HMAC_SECRET",
      "RITOMER_WORKPAPERS_DOCUMENTS_STORAGE_BACKEND",
      "RITOMER_WORKPAPERS_DOCUMENTS_STORAGE_LOCAL_ROOT"
    ];
    if (required.some((name) => result[name] === undefined)) fail("BACKEND_ENVIRONMENT_INCOMPLETE");
    if (result.SPRING_DATASOURCE_HIKARI_MAXIMUM_POOL_SIZE !== "8" || result.RITOMER_WORKPAPERS_DOCUMENTS_STORAGE_BACKEND !== "LOCAL_FS") {
      fail("BACKEND_ENVIRONMENT_INVALID");
    }
  }
  if (kind === "VITE_ACCOUNTANT" || kind === "VITE_REVIEWER") {
    if (result.RITOMER_LOCAL_DEMO_BACKEND_TARGET !== BACKEND_ORIGIN || result.RITOMER_LOCAL_DEMO_PROXY_AUTH_ENABLED !== "true" || typeof result.RITOMER_LOCAL_DEMO_BEARER_TOKEN !== "string" || result.RITOMER_LOCAL_DEMO_BEARER_TOKEN.length === 0) fail("VITE_ENVIRONMENT_INVALID");
  }
  return Object.freeze(result);
}

export function assertSentinelsNotInherited(childEnvironment, sentinelNames) {
  assertPlainObject(childEnvironment, "CHILD_ENVIRONMENT_INVALID");
  if (!Array.isArray(sentinelNames) || sentinelNames.some((name) => typeof name !== "string")) fail("SENTINEL_NAMES_INVALID");
  for (const name of sentinelNames) {
    if (Object.hasOwn(childEnvironment, name)) fail("SENTINEL_ENVIRONMENT_INHERITED", { name });
  }
  return true;
}

export function validatePassfileInspection(inspection, repositoryRoot) {
  assertClosedKeys(inspection, ["path", "absolute", "outsideRepository", "regularFile", "nonReparse", "aclChecked", "isEnvFile", "contentRead", "fileIdentitySha256", "aclSha256"], "PASSFILE_INSPECTION_INVALID");
  assertString(repositoryRoot, "REPOSITORY_ROOT_INVALID");
  assertString(inspection.path, "PASSFILE_PATH_INVALID");
  const passfileBaseName = path.basename(inspection.path).toLowerCase();
  const envLikeName = passfileBaseName === ".env" || passfileBaseName.startsWith(".env.") || passfileBaseName.endsWith(".env");
  if (
    inspection.absolute !== true ||
    !path.isAbsolute(inspection.path) ||
    inspection.path.startsWith("\\\\") ||
    WINDOWS_DEVICE_PATH.test(inspection.path) ||
    inspection.outsideRepository !== true ||
    inspection.regularFile !== true ||
    inspection.nonReparse !== true ||
    inspection.aclChecked !== true ||
    inspection.isEnvFile !== false ||
    envLikeName ||
    inspection.contentRead !== false
  ) fail("PASSFILE_UNSAFE");
  const relative = path.relative(repositoryRoot, inspection.path);
  if (relative === "" || (!relative.startsWith("..\\") && relative !== "..")) fail("PASSFILE_INSIDE_REPOSITORY");
  assertString(inspection.fileIdentitySha256, "PASSFILE_IDENTITY_INVALID", { pattern: SHA256_REGEX });
  assertString(inspection.aclSha256, "PASSFILE_ACL_INVALID", { pattern: SHA256_REGEX });
  return Object.freeze({
    absolute: true,
    outsideRepository: true,
    regularFile: true,
    nonReparse: true,
    aclChecked: true,
    contentRead: false,
    pathSha256: sha256Hex(inspection.path),
    fileIdentitySha256: inspection.fileIdentitySha256,
    aclSha256: inspection.aclSha256
  });
}

const SENSITIVE_RUNTIME_INPUT_KEYS = Object.freeze([
  "postgresAdminUser",
  "postgresAdminPassfileInspection",
  "jwtHmacSecret",
  "systemEnvironment",
  "cmdExecutable",
  "nodeExecutable"
]);

export function validateSensitiveRuntimeInputs(input, context) {
  assertClosedKeys(input, SENSITIVE_RUNTIME_INPUT_KEYS, "SENSITIVE_RUNTIME_INPUT_INVALID");
  assertString(input.postgresAdminUser, "POSTGRES_ADMIN_USER_INVALID", { pattern: SQL_IDENTIFIER_REGEX });
  const passfileMetadata = validatePassfileInspection(input.postgresAdminPassfileInspection, context.repositoryRoot);
  if (canonicalJson(passfileMetadata) !== canonicalJson(context.passfileMetadata)) fail("PASSFILE_METADATA_MISMATCH");
  if (typeof input.jwtHmacSecret !== "string" || input.jwtHmacSecret.length < 32 || input.jwtHmacSecret.includes("\0")) fail("HMAC_SECRET_INVALID");
  assertPlainObject(input.systemEnvironment, "SYSTEM_ENVIRONMENT_INVALID");
  const allowedSystemNames = new Set([...SYSTEM_ENVIRONMENT_NAMES, "JAVA_HOME"]);
  for (const [name, value] of Object.entries(input.systemEnvironment)) {
    if (!allowedSystemNames.has(name)) fail("SYSTEM_ENVIRONMENT_NAME_FORBIDDEN", { name });
    if (typeof value !== "string" || value.includes("\0")) fail("SYSTEM_ENVIRONMENT_VALUE_INVALID", { name });
  }
  assertString(input.cmdExecutable, "CMD_EXECUTABLE_INVALID");
  assertString(input.nodeExecutable, "NODE_EXECUTABLE_INVALID");
  const fixedCmdExecutable = "C:\\Windows\\System32\\cmd.exe";
  if (input.systemEnvironment.SystemRoot !== "C:\\Windows" || input.systemEnvironment.ComSpec !== fixedCmdExecutable || input.cmdExecutable !== fixedCmdExecutable || input.cmdExecutable !== context.tools.cmd.path) fail("CMD_EXECUTABLE_INVALID");
  if (input.nodeExecutable !== context.tools.node.path) fail("NODE_EXECUTABLE_MISMATCH");
  if (input.systemEnvironment.JAVA_HOME === undefined || path.join(input.systemEnvironment.JAVA_HOME, "bin", "java.exe") !== context.tools.java.path) fail("JAVA_EXECUTABLE_MISMATCH");
  if (context.tools.psql.path !== LOCAL_PSQL_PATH) fail("PSQL_EXECUTABLE_MISMATCH");
  return input;
}

export function environmentBindingSha256(input, context) {
  validateSensitiveRuntimeInputs(input, context);
  const metadata = validatePassfileInspection(input.postgresAdminPassfileInspection, context.repositoryRoot);
  const environmentBinding = {
    postgresAdminUser: input.postgresAdminUser,
    passfileMetadata: metadata,
    repositoryRootSha256: sha256Hex(context.repositoryRoot),
    systemEnvironmentSha256: sha256Hex(canonicalJson(input.systemEnvironment)),
    jwtHmacSecretSha256: sha256Hex(Buffer.from(input.jwtHmacSecret, "utf8")),
    cmdExecutable: input.cmdExecutable,
    cmd: buildToolEvidence(context.tools).cmd,
    java: buildToolEvidence(context.tools).java,
    node: buildToolEvidence(context.tools).node,
    psql: buildToolEvidence(context.tools).psql
  };
  assertNoSensitiveEvidence(environmentBinding);
  return sha256Hex(canonicalJson(environmentBinding));
}

export function createScramVerifier(password, saltBytes, iterations = 4096) {
  if (typeof password !== "string" || password.length < 32 || password.includes("\0")) fail("RUNNER_PASSWORD_INVALID");
  const salt = Buffer.from(saltBytes);
  if (salt.length < 16 || salt.length > 64) fail("SCRAM_SALT_INVALID");
  assertInteger(iterations, "SCRAM_ITERATIONS_INVALID", { minimum: 4096, maximum: 1000000 });
  const saltedPassword = pbkdf2Sync(Buffer.from(password, "utf8"), salt, iterations, 32, "sha256");
  const clientKey = createHmac("sha256", saltedPassword).update("Client Key").digest();
  const storedKey = createHash("sha256").update(clientKey).digest("base64");
  const serverKey = createHmac("sha256", saltedPassword).update("Server Key").digest("base64");
  return `SCRAM-SHA-256$${iterations}:${salt.toString("base64")}$${storedKey}:${serverKey}`;
}

export function generateRunnerCredential(randomBytes = nodeRandomBytes) {
  const passwordBytes = Buffer.from(randomBytes(32));
  const saltBytes = Buffer.from(randomBytes(16));
  if (passwordBytes.length !== 32 || saltBytes.length !== 16) fail("RANDOM_BYTES_INVALID");
  const password = passwordBytes.toString("base64url");
  return Object.freeze({ password, verifier: createScramVerifier(password, saltBytes) });
}

export function validatePostgresAdmin(result, expectedUser) {
  assertClosedKeys(result, ["user", "login", "superuser", "createdb", "createrole", "replication", "bypassrls", "unexpectedMemberships"], "POSTGRES_ADMIN_RESULT_INVALID");
  if (
    result.user !== expectedUser ||
    result.login !== true ||
    result.superuser !== false ||
    result.createdb !== true ||
    result.createrole !== true ||
    result.replication !== false ||
    result.bypassrls !== false ||
    result.unexpectedMemberships !== 0
  ) fail("POSTGRES_ADMIN_PRIVILEGES_INVALID");
  return result;
}

export function buildPsqlInvocation({ adminUser, passfilePath, runId, database = "postgres", systemEnvironment = {} }) {
  assertString(adminUser, "POSTGRES_ADMIN_USER_INVALID", { pattern: SQL_IDENTIFIER_REGEX });
  validateRunId(runId);
  assertString(database, "POSTGRES_DATABASE_INVALID", { pattern: SQL_IDENTIFIER_REGEX });
  assertString(passfilePath, "PASSFILE_PATH_INVALID");
  const environment = buildChildEnvironment("POSTGRESQL", systemEnvironment, {
    PGPASSFILE: passfilePath,
    PGCONNECT_TIMEOUT: "5",
    PGAPPNAME: `ritomer-043c-${runId}`
  });
  const args = Object.freeze([
    "-X",
    "--no-password",
    "--host=127.0.0.1",
    "--port=5432",
    `--username=${adminUser}`,
    `--dbname=${database}`,
    "--set=ON_ERROR_STOP=1",
    "--quiet",
    "--no-align",
    "--tuples-only"
  ]);
  return Object.freeze({ executable: LOCAL_PSQL_PATH, args, environment, shell: false });
}

export function buildPostgresAdminInspectionPlan({ adminUser, passfilePath, runId, systemEnvironment }) {
  const invocation = buildPsqlInvocation({ adminUser, passfilePath, runId, database: "postgres", systemEnvironment });
  const stdin = assertSafeSql(`BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE READ ONLY;
SET LOCAL statement_timeout = '5s';
SELECT json_build_object(
  'user', current_user,
  'login', rolcanlogin,
  'superuser', rolsuper,
  'createdb', rolcreatedb,
  'createrole', rolcreaterole,
  'replication', rolreplication,
  'bypassrls', rolbypassrls,
  'unexpectedMemberships', (SELECT count(*) FROM pg_auth_members WHERE member = pg_roles.oid)
)::text
FROM pg_roles
WHERE rolname = current_user;
ROLLBACK;
`);
  return Object.freeze({ invocation, stdin, expectedRows: 1, readOnly: true });
}

function assertOwnershipMarker(marker, runId, recoveryNonce, bindingHash) {
  assertString(marker, "OWNERSHIP_MARKER_INVALID");
  const expected = `ritomer-043c:${runId}:${recoveryNonce}:${bindingHash}`;
  if (marker !== expected) fail("OWNERSHIP_MARKER_INVALID");
  return marker;
}

export function createOwnershipMarker({ runId, recoveryNonce, bindingSha256: bindingHash }) {
  validateRunId(runId);
  assertString(recoveryNonce, "RECOVERY_NONCE_INVALID", { pattern: /^[0-9a-f]{32}$/ });
  assertString(bindingHash, "BINDING_HASH_INVALID", { pattern: SHA256_REGEX });
  return `ritomer-043c:${runId}:${recoveryNonce}:${bindingHash}`;
}

const FORBIDDEN_DESTRUCTIVE_SQL = /(?:\bCASCADE\b|\bDROP\s+OWNED\b|\bREASSIGN\s+OWNED\b|\bFORCE\b|\bpg_terminate_backend\s*\()/i;

export function assertSafeSql(sql) {
  assertString(sql, "SQL_INVALID");
  if (FORBIDDEN_DESTRUCTIVE_SQL.test(sql)) fail("DESTRUCTIVE_SQL_FORBIDDEN");
  return sql;
}

export function buildPostgresPlan({ resources, adminUser, verifier, ownershipMarker }) {
  assertClosedKeys(resources, ["dbName", "roleName", "runtimeBase", "runtimeRoot", "storageRoot", "evidenceBase", "evidenceRoot", "recoveryStatePath", "exportPath", "summaryPath", "summaryHashPath"], "RESOURCES_INVALID");
  quoteSqlIdentifier(resources.dbName);
  quoteSqlIdentifier(resources.roleName);
  assertString(adminUser, "POSTGRES_ADMIN_USER_INVALID", { pattern: SQL_IDENTIFIER_REGEX });
  assertString(verifier, "SCRAM_VERIFIER_INVALID", { pattern: /^SCRAM-SHA-256\$[0-9]+:[A-Za-z0-9+/]+=*\$[A-Za-z0-9+/]+=*:[A-Za-z0-9+/]+=*$/ });
  assertString(ownershipMarker, "OWNERSHIP_MARKER_INVALID");
  const role = quoteSqlIdentifier(resources.roleName);
  const database = quoteSqlIdentifier(resources.dbName);
  const admin = quoteSqlIdentifier(adminUser);
  const marker = quoteSqlLiteral(ownershipMarker);
  const verifierLiteral = quoteSqlLiteral(verifier);
  const steps = [
    Object.freeze({
      id: "CREATE_RUNNER_ROLE",
      database: "postgres",
      stdin: assertSafeSql(`BEGIN;\nCREATE ROLE ${role}\n  LOGIN\n  NOSUPERUSER\n  NOCREATEDB\n  NOCREATEROLE\n  NOINHERIT\n  NOREPLICATION\n  NOBYPASSRLS\n  CONNECTION LIMIT 16\n  PASSWORD ${verifierLiteral};\nCOMMENT ON ROLE ${role} IS ${marker};\nGRANT ${role} TO ${admin}\n  WITH ADMIN TRUE, INHERIT FALSE, SET TRUE;\nCOMMIT;\n`)
    }),
    Object.freeze({
      id: "CREATE_RUN_DATABASE",
      database: "postgres",
      stdin: assertSafeSql(`CREATE DATABASE ${database}\n  WITH OWNER ${role}\n       TEMPLATE template0\n       ENCODING 'UTF8';\n`)
    }),
    Object.freeze({
      id: "HARDEN_RUN_DATABASE",
      database: resources.dbName,
      stdin: assertSafeSql(`BEGIN;\nSET ROLE ${role};\nREVOKE CONNECT, TEMPORARY ON DATABASE ${database} FROM PUBLIC;\nGRANT CONNECT ON DATABASE ${database} TO ${admin};\nDROP SCHEMA public;\nCREATE SCHEMA public AUTHORIZATION ${role};\nREVOKE ALL ON SCHEMA public FROM PUBLIC;\nRESET ROLE;\nCOMMIT;\n`)
    })
  ];
  const rollback = [
    Object.freeze({
      id: "DROP_RUN_DATABASE",
      database: "postgres",
      stdin: assertSafeSql(`SET ROLE ${role};\nDROP DATABASE ${database};\nRESET ROLE;\n`)
    }),
    Object.freeze({
      id: "DROP_RUNNER_ROLE",
      database: "postgres",
      stdin: assertSafeSql(`BEGIN;\nREVOKE ${role} FROM ${admin};\nDROP ROLE ${role};\nCOMMIT;\n`)
    })
  ];
  return Object.freeze({ steps: Object.freeze(steps), rollback: Object.freeze(rollback) });
}

export function validateCatalogIdentity(snapshot, { resources, adminUser, ownershipMarker, allowAbsent = false }) {
  assertClosedKeys(snapshot, ["database", "role", "membership", "sessions"], "CATALOG_SNAPSHOT_INVALID");
  assertInteger(snapshot.sessions, "CATALOG_SESSIONS_INVALID", { minimum: 0 });
  if (allowAbsent && snapshot.database === null && snapshot.role === null && snapshot.membership === null) return snapshot;
  assertClosedKeys(snapshot.database, ["name", "owner", "encoding"], "DATABASE_IDENTITY_INVALID");
  assertClosedKeys(snapshot.role, ["name", "comment", "login", "superuser", "createdb", "createrole", "inherit", "replication", "bypassrls", "connectionLimit"], "ROLE_IDENTITY_INVALID");
  assertClosedKeys(snapshot.membership, ["role", "member", "adminOption", "inheritOption", "setOption"], "MEMBERSHIP_IDENTITY_INVALID");
  if (
    snapshot.database.name !== resources.dbName ||
    snapshot.database.owner !== resources.roleName ||
    snapshot.database.encoding !== "UTF8" ||
    snapshot.role.name !== resources.roleName ||
    snapshot.role.comment !== ownershipMarker ||
    snapshot.role.login !== true ||
    snapshot.role.superuser !== false ||
    snapshot.role.createdb !== false ||
    snapshot.role.createrole !== false ||
    snapshot.role.inherit !== false ||
    snapshot.role.replication !== false ||
    snapshot.role.bypassrls !== false ||
    snapshot.role.connectionLimit !== 16 ||
    snapshot.membership.role !== resources.roleName ||
    snapshot.membership.member !== adminUser ||
    snapshot.membership.adminOption !== true ||
    snapshot.membership.inheritOption !== false ||
    snapshot.membership.setOption !== true
  ) fail("CATALOG_IDENTITY_DIVERGENT");
  return snapshot;
}

export function buildSpawnSpec({ label, executable, args, cwd, environment, expectedPort = null }) {
  assertString(label, "PROCESS_LABEL_INVALID", { pattern: /^[A-Z][A-Z0-9_]{1,63}$/ });
  assertString(executable, "PROCESS_EXECUTABLE_INVALID");
  if (!path.isAbsolute(executable) || WINDOWS_DEVICE_PATH.test(executable) || executable.startsWith("\\\\") || executable.includes("/")) {
    fail("PROCESS_EXECUTABLE_NOT_FIXED_ABSOLUTE");
  }
  if (!Array.isArray(args) || args.some((argument) => typeof argument !== "string" || argument.includes("\0"))) fail("PROCESS_ARGUMENTS_INVALID");
  assertString(cwd, "PROCESS_CWD_INVALID");
  if (!path.isAbsolute(cwd) || cwd.startsWith("\\\\") || WINDOWS_DEVICE_PATH.test(cwd) || cwd.includes("/")) fail("PROCESS_CWD_NOT_FIXED_ABSOLUTE");
  assertPlainObject(environment, "PROCESS_ENVIRONMENT_INVALID");
  if (expectedPort !== null && !PORTS.includes(expectedPort)) fail("PROCESS_EXPECTED_PORT_INVALID");
  const argvScan = [executable, ...args].join("\n");
  if (/password|jwt|hmac|passfile|bearer|credential/i.test(argvScan)) fail("SECRET_MATERIAL_IN_PROCESS_ARGUMENTS");
  return Object.freeze({
    label,
    executable,
    args: Object.freeze([...args]),
    cwd,
    environment: Object.freeze({ ...environment }),
    shell: false,
    expectedPort
  });
}

export function buildViteLaunchContract({ actorName, port, repositoryRoot, nodeExecutable, systemEnvironment }) {
  if (!['ACCOUNTANT', 'REVIEWER'].includes(actorName) || ![5173, 5174].includes(port) || (actorName === 'ACCOUNTANT') !== (port === 5173)) fail("VITE_LAUNCH_ACTOR_INVALID");
  assertString(repositoryRoot, "REPOSITORY_ROOT_INVALID");
  assertString(nodeExecutable, "PROCESS_EXECUTABLE_INVALID");
  assertPlainObject(systemEnvironment, "SYSTEM_ENVIRONMENT_INVALID");
  const frontendDirectory = path.join(repositoryRoot, "frontend");
  const environmentNames = [
    ...HARNESS_VITE_SYSTEM_ENVIRONMENT_NAMES.filter((name) => typeof systemEnvironment[name] === "string" && systemEnvironment[name].length > 0),
    "RITOMER_LOCAL_DEMO_BACKEND_TARGET",
    "RITOMER_LOCAL_DEMO_PROXY_AUTH_ENABLED",
    "RITOMER_LOCAL_DEMO_BEARER_TOKEN"
  ];
  return Object.freeze({
    label: `VITE_${actorName}`,
    delegatedBy: "TWO_ACTOR_HARNESS",
    executable: nodeExecutable,
    args: Object.freeze([path.join(frontendDirectory, "node_modules", "vite", "bin", "vite.js"), "--host", "127.0.0.1", "--port", String(port), "--strictPort"]),
    cwd: frontendDirectory,
    environmentNames: Object.freeze(environmentNames),
    fixedEnvironment: Object.freeze({ RITOMER_LOCAL_DEMO_BACKEND_TARGET: BACKEND_ORIGIN, RITOMER_LOCAL_DEMO_PROXY_AUTH_ENABLED: "true" }),
    secretEnvironmentName: "RITOMER_LOCAL_DEMO_BEARER_TOKEN",
    shell: false,
    expectedPort: port
  });
}

export function validateViteLaunchContract(contract) {
  assertClosedKeys(contract, ["label", "delegatedBy", "executable", "args", "cwd", "environmentNames", "fixedEnvironment", "secretEnvironmentName", "shell", "expectedPort"], "VITE_LAUNCH_CONTRACT_INVALID");
  if (!['VITE_ACCOUNTANT', 'VITE_REVIEWER'].includes(contract.label) || contract.delegatedBy !== "TWO_ACTOR_HARNESS" || contract.shell !== false || contract.secretEnvironmentName !== "RITOMER_LOCAL_DEMO_BEARER_TOKEN") fail("VITE_LAUNCH_CONTRACT_INVALID");
  assertString(contract.executable, "VITE_LAUNCH_CONTRACT_INVALID");
  assertString(contract.cwd, "VITE_LAUNCH_CONTRACT_INVALID");
  if (!Array.isArray(contract.args) || !Array.isArray(contract.environmentNames) || new Set(contract.environmentNames).size !== contract.environmentNames.length) fail("VITE_LAUNCH_CONTRACT_INVALID");
  const port = contract.label === "VITE_ACCOUNTANT" ? 5173 : 5174;
  const expectedArgs = [path.join(contract.cwd, "node_modules", "vite", "bin", "vite.js"), "--host", "127.0.0.1", "--port", String(port), "--strictPort"];
  if (canonicalJson(contract.args) !== canonicalJson(expectedArgs) || contract.expectedPort !== port) fail("VITE_LAUNCH_CONTRACT_INVALID");
  exactObject(contract.fixedEnvironment, { RITOMER_LOCAL_DEMO_BACKEND_TARGET: BACKEND_ORIGIN, RITOMER_LOCAL_DEMO_PROXY_AUTH_ENABLED: "true" }, "VITE_LAUNCH_CONTRACT_INVALID");
  const requiredNames = ["RITOMER_LOCAL_DEMO_BACKEND_TARGET", "RITOMER_LOCAL_DEMO_PROXY_AUTH_ENABLED", "RITOMER_LOCAL_DEMO_BEARER_TOKEN"];
  if (requiredNames.some((name) => !contract.environmentNames.includes(name)) || contract.environmentNames.some((name) => ![...HARNESS_VITE_SYSTEM_ENVIRONMENT_NAMES, ...requiredNames].includes(name))) fail("VITE_LAUNCH_CONTRACT_INVALID");
  return contract;
}

export function buildRuntimePlans({ repositoryRoot, resources, systemEnvironment, runnerPassword, hmacSecret, cmdExecutable, nodeExecutable }) {
  assertString(repositoryRoot, "REPOSITORY_ROOT_INVALID");
  if (typeof runnerPassword !== "string" || runnerPassword.length < 32 || runnerPassword.includes("\0")) fail("RUNNER_PASSWORD_INVALID");
  if (typeof hmacSecret !== "string" || hmacSecret.length < 32 || hmacSecret.includes("\0")) fail("HMAC_SECRET_INVALID");
  const backendDirectory = path.join(repositoryRoot, "backend");
  const frontendDirectory = path.join(repositoryRoot, "frontend");
  const backendEnvironment = buildChildEnvironment("BACKEND", systemEnvironment, {
    SPRING_DATASOURCE_URL: `jdbc:postgresql://127.0.0.1:5432/${resources.dbName}`,
    SPRING_DATASOURCE_USERNAME: resources.roleName,
    SPRING_DATASOURCE_PASSWORD: runnerPassword,
    SPRING_DATASOURCE_HIKARI_MAXIMUM_POOL_SIZE: "8",
    RITOMER_SECURITY_JWT_HMAC_SECRET: hmacSecret,
    RITOMER_WORKPAPERS_DOCUMENTS_STORAGE_BACKEND: "LOCAL_FS",
    RITOMER_WORKPAPERS_DOCUMENTS_STORAGE_LOCAL_ROOT: resources.storageRoot
  });
  const harnessEnvironment = buildChildEnvironment("HARNESS", systemEnvironment, {
    RITOMER_SECURITY_JWT_HMAC_SECRET: hmacSecret
  });
  const seed = buildSpawnSpec({
    label: "DEMO_SEED",
    executable: cmdExecutable,
    args: ["/d", "/s", "/c", '"gradlew.bat --no-daemon -PritomerDemoSeedEnabled=true -PritomerDemoSeedVariant=043b-two-actor-pilot demoSeedLocal"'],
    cwd: backendDirectory,
    environment: backendEnvironment,
    expectedPort: null
  });
  const backend = buildSpawnSpec({
    label: "BACKEND_GRADLE",
    executable: cmdExecutable,
    args: ["/d", "/s", "/c", '"gradlew.bat --no-daemon bootRun --args=\"--spring.profiles.active=local --server.address=127.0.0.1 --server.port=8080\""'],
    cwd: backendDirectory,
    environment: backendEnvironment,
    expectedPort: 8080
  });
  const harness = buildSpawnSpec({
    label: "TWO_ACTOR_HARNESS",
    executable: nodeExecutable,
    args: [path.join(frontendDirectory, "local-two-actor-harness.mjs")],
    cwd: frontendDirectory,
    environment: harnessEnvironment,
    expectedPort: null
  });
  const viteAccountant = buildViteLaunchContract({ actorName: "ACCOUNTANT", port: 5173, repositoryRoot, nodeExecutable, systemEnvironment });
  const viteReviewer = buildViteLaunchContract({ actorName: "REVIEWER", port: 5174, repositoryRoot, nodeExecutable, systemEnvironment });
  return Object.freeze({ seed, backend, harness, viteAccountant, viteReviewer });
}

export function spawnCommandLineSha256(spawnSpec) {
  assertClosedKeys(spawnSpec, ["label", "executable", "args", "cwd", "environment", "shell", "expectedPort"], "SPAWN_SPEC_INVALID");
  return sha256Hex(canonicalJson({ executable: spawnSpec.executable, args: spawnSpec.args }));
}

export function runtimePlanEvidence(runtimePlans) {
  assertClosedKeys(runtimePlans, ["seed", "backend", "harness", "viteAccountant", "viteReviewer"], "RUNTIME_PLANS_INVALID");
  const evidence = {};
  for (const name of ["seed", "backend", "harness"]) {
    const spec = runtimePlans[name];
    evidence[`${name}Sha256`] = sha256Hex(canonicalJson({
      label: spec.label,
      executable: spec.executable,
      args: spec.args,
      cwd: spec.cwd,
      environmentNames: Object.keys(spec.environment).sort(),
      shell: spec.shell,
      expectedPort: spec.expectedPort
    }));
  }
  for (const name of ["viteAccountant", "viteReviewer"]) {
    validateViteLaunchContract(runtimePlans[name]);
    evidence[`${name}Sha256`] = sha256Hex(canonicalJson(runtimePlans[name]));
  }
  return Object.freeze(evidence);
}

export function runtimePlanEvidenceSha256(runtimePlans) {
  return sha256Hex(canonicalJson(runtimePlanEvidence(runtimePlans)));
}

export function validateViteEnvironmentProofs(proofs, runtimePlans) {
  assertClosedKeys(proofs, ["ACCOUNTANT", "REVIEWER"], "VITE_ENVIRONMENT_PROOF_INVALID");
  for (const [actorName, planName] of [["ACCOUNTANT", "viteAccountant"], ["REVIEWER", "viteReviewer"]]) {
    const proof = proofs[actorName];
    const contract = validateViteLaunchContract(runtimePlans[planName]);
    assertClosedKeys(proof, ["contractSha256", "environmentNames", "fixedEnvironment", "secretEnvironmentName", "secretPresent", "forbiddenNamesAbsent"], "VITE_ENVIRONMENT_PROOF_INVALID");
    if (
      proof.contractSha256 !== sha256Hex(canonicalJson(contract)) ||
      canonicalJson(proof.environmentNames) !== canonicalJson(contract.environmentNames) ||
      canonicalJson(proof.fixedEnvironment) !== canonicalJson(contract.fixedEnvironment) ||
      proof.secretEnvironmentName !== contract.secretEnvironmentName ||
      proof.secretPresent !== true ||
      proof.forbiddenNamesAbsent !== true
    ) fail("VITE_ENVIRONMENT_PROOF_INVALID", { actorName });
  }
  return proofs;
}

export function runtimeStartIdentity(ownershipMarker, runtimePlanSha256) {
  assertString(ownershipMarker, "OWNERSHIP_MARKER_INVALID");
  assertString(runtimePlanSha256, "RUNTIME_PLAN_EVIDENCE_INVALID", { pattern: SHA256_REGEX });
  return sha256Hex(canonicalJson({ ownershipMarkerSha256: sha256Hex(ownershipMarker), runtimePlanEvidenceSha256: runtimePlanSha256 }));
}

function fixedCommandLineSha256(executable, args) {
  return sha256Hex(canonicalJson({ executable, args }));
}

export function expectedRuntimeProcessBindings(tools) {
  validateToolEvidence(tools);
  const frontendDirectory = path.dirname(tools.harness.path);
  if (path.basename(tools.gradleWrapper.path).toLowerCase() !== "gradlew.bat" || path.basename(tools.harness.path).toLowerCase() !== "local-two-actor-harness.mjs") fail("RUNTIME_TOOL_PATH_INVALID");
  const seedArgs = ["/d", "/s", "/c", '"gradlew.bat --no-daemon -PritomerDemoSeedEnabled=true -PritomerDemoSeedVariant=043b-two-actor-pilot demoSeedLocal"'];
  const backendArgs = ["/d", "/s", "/c", '"gradlew.bat --no-daemon bootRun --args=\"--spring.profiles.active=local --server.address=127.0.0.1 --server.port=8080\""'];
  const harnessArgs = [tools.harness.path];
  const viteEntry = path.join(frontendDirectory, "node_modules", "vite", "bin", "vite.js");
  const result = {
    DEMO_SEED: { executablePath: tools.cmd.path, executableSha256: tools.cmd.sha256, commandLineSha256: fixedCommandLineSha256(tools.cmd.path, seedArgs) },
    BACKEND_GRADLE: { executablePath: tools.cmd.path, executableSha256: tools.cmd.sha256, commandLineSha256: fixedCommandLineSha256(tools.cmd.path, backendArgs) },
    BACKEND_APPLICATION: { executablePath: tools.java.path, executableSha256: tools.java.sha256, commandLineSha256: null },
    TWO_ACTOR_HARNESS: { executablePath: tools.node.path, executableSha256: tools.node.sha256, commandLineSha256: fixedCommandLineSha256(tools.node.path, harnessArgs) },
    VITE_ACCOUNTANT: { executablePath: tools.node.path, executableSha256: tools.node.sha256, commandLineSha256: fixedCommandLineSha256(tools.node.path, [viteEntry, "--host", "127.0.0.1", "--port", "5173", "--strictPort"]) },
    VITE_REVIEWER: { executablePath: tools.node.path, executableSha256: tools.node.sha256, commandLineSha256: fixedCommandLineSha256(tools.node.path, [viteEntry, "--host", "127.0.0.1", "--port", "5174", "--strictPort"]) }
  };
  return Object.freeze(Object.fromEntries(Object.entries(result).map(([label, value]) => [label, Object.freeze(value)])));
}

export function validateRuntimeProcessPlanBindings(processes, tools) {
  validateRuntimeProcessSubset(processes);
  const expected = expectedRuntimeProcessBindings(tools);
  for (const descriptor of processes) {
    const binding = expected[descriptor.label];
    if (binding === undefined || descriptor.executablePath !== binding.executablePath || descriptor.executableSha256 !== binding.executableSha256) fail("RUNTIME_PROCESS_PLAN_BINDING_MISMATCH", { label: descriptor.label });
    if (binding.commandLineSha256 !== null && descriptor.commandLineSha256 !== binding.commandLineSha256) fail("RUNTIME_PROCESS_COMMAND_BINDING_MISMATCH", { label: descriptor.label });
  }
  return processes;
}

export function validateBackendApplicationBindingProof(proof, { processes, tools, ownershipMarker, runtimePlanSha256 }) {
  assertClosedKeys(proof, ["descriptorSha256", "commandLineSha256", "parentCommandLineSha256", "runtimePlanEvidenceSha256", "ownershipMarkerSha256", "runtimeMarkerSha256", "runtimeMarkerDurable", "exactObservedCommandLine"], "BACKEND_APPLICATION_BINDING_PROOF_INVALID");
  validateRuntimeProcessSubset(processes);
  validateToolEvidence(tools);
  assertString(ownershipMarker, "OWNERSHIP_MARKER_INVALID");
  assertString(runtimePlanSha256, "RUNTIME_PLAN_EVIDENCE_INVALID", { pattern: SHA256_REGEX });
  const application = processes.find((descriptor) => descriptor.label === "BACKEND_APPLICATION");
  const parent = processes.find((descriptor) => descriptor.label === "BACKEND_GRADLE");
  if (application === undefined || parent === undefined || application.parentPid !== parent.pid) fail("BACKEND_APPLICATION_BINDING_PROOF_INVALID");
  const descriptorSha256 = sha256Hex(canonicalJson(application));
  const runtimeMarkerSha256 = sha256Hex(canonicalJson({ descriptorSha256, ownershipMarkerSha256: sha256Hex(ownershipMarker), parentCommandLineSha256: parent.commandLineSha256, runtimePlanEvidenceSha256: runtimePlanSha256 }));
  if (
    proof.descriptorSha256 !== descriptorSha256 ||
    proof.commandLineSha256 !== application.commandLineSha256 ||
    proof.parentCommandLineSha256 !== parent.commandLineSha256 ||
    proof.runtimePlanEvidenceSha256 !== runtimePlanSha256 ||
    proof.ownershipMarkerSha256 !== sha256Hex(ownershipMarker) ||
    proof.runtimeMarkerSha256 !== runtimeMarkerSha256 ||
    proof.runtimeMarkerDurable !== true ||
    proof.exactObservedCommandLine !== true ||
    application.executablePath !== tools.java.path ||
    application.executableSha256 !== tools.java.sha256
  ) fail("BACKEND_APPLICATION_BINDING_PROOF_INVALID");
  return proof;
}

const PROCESS_DESCRIPTOR_KEYS = Object.freeze([
  "label",
  "pid",
  "parentPid",
  "creationTimeUtc",
  "executablePath",
  "executableSha256",
  "commandLineSha256",
  "expectedPort"
]);

export function validateProcessDescriptor(descriptor) {
  assertClosedKeys(descriptor, PROCESS_DESCRIPTOR_KEYS, "PROCESS_DESCRIPTOR_INVALID");
  assertString(descriptor.label, "PROCESS_DESCRIPTOR_INVALID", { pattern: /^[A-Z][A-Z0-9_]{1,63}$/ });
  assertInteger(descriptor.pid, "PROCESS_DESCRIPTOR_INVALID", { minimum: 1 });
  assertInteger(descriptor.parentPid, "PROCESS_DESCRIPTOR_INVALID", { minimum: 0 });
  assertUtcMilliseconds(descriptor.creationTimeUtc, "PROCESS_DESCRIPTOR_INVALID");
  assertString(descriptor.executablePath, "PROCESS_DESCRIPTOR_INVALID");
  if (!path.isAbsolute(descriptor.executablePath) || descriptor.executablePath.startsWith("\\\\") || WINDOWS_DEVICE_PATH.test(descriptor.executablePath)) fail("PROCESS_DESCRIPTOR_INVALID");
  assertString(descriptor.executableSha256, "PROCESS_DESCRIPTOR_INVALID", { pattern: SHA256_REGEX });
  assertString(descriptor.commandLineSha256, "PROCESS_DESCRIPTOR_INVALID", { pattern: SHA256_REGEX });
  if (descriptor.expectedPort !== null && !PORTS.includes(descriptor.expectedPort)) fail("PROCESS_DESCRIPTOR_INVALID");
  return descriptor;
}

export function assertProcessIdentity(expected, observed) {
  validateProcessDescriptor(expected);
  validateProcessDescriptor(observed);
  for (const key of PROCESS_DESCRIPTOR_KEYS) {
    if (expected[key] !== observed[key]) fail(key === "pid" ? "PROCESS_OWNERSHIP_MISMATCH" : "PROCESS_IDENTITY_OR_PID_REUSE", { label: expected.label });
  }
  return true;
}

export function leafFirstShutdownOrder(descriptors) {
  if (!Array.isArray(descriptors) || descriptors.length === 0) fail("PROCESS_TREE_INVALID");
  const byPid = new Map();
  for (const descriptor of descriptors) {
    validateProcessDescriptor(descriptor);
    if (byPid.has(descriptor.pid)) fail("PROCESS_TREE_DUPLICATE_PID");
    byPid.set(descriptor.pid, descriptor);
  }
  const depths = new Map();
  function depth(descriptor, visiting = new Set()) {
    if (depths.has(descriptor.pid)) return depths.get(descriptor.pid);
    if (visiting.has(descriptor.pid)) fail("PROCESS_TREE_CYCLE");
    visiting.add(descriptor.pid);
    const parent = byPid.get(descriptor.parentPid);
    const value = parent === undefined ? 0 : depth(parent, visiting) + 1;
    visiting.delete(descriptor.pid);
    depths.set(descriptor.pid, value);
    return value;
  }
  return Object.freeze([...descriptors].sort((left, right) => depth(right) - depth(left) || right.pid - left.pid));
}

export function ownedProcessSubtree(descriptors, rootLabel) {
  if (!Array.isArray(descriptors)) fail("PROCESS_DESCRIPTORS_INVALID");
  if (descriptors.length === 0) return Object.freeze([]);
  validateRuntimeProcessSubset(descriptors);
  const root = descriptors.find((descriptor) => descriptor.label === rootLabel);
  if (root === undefined) fail("PROCESS_ROOT_MISSING");
  const ownedPids = new Set([root.pid]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const descriptor of descriptors) {
      if (ownedPids.has(descriptor.parentPid) && !ownedPids.has(descriptor.pid)) {
        ownedPids.add(descriptor.pid);
        changed = true;
      }
    }
  }
  return Object.freeze(descriptors.filter((descriptor) => ownedPids.has(descriptor.pid)));
}

export function validateListener(listener, expectedPort, allowedOwnerPids) {
  assertClosedKeys(listener, ["port", "address", "pid"], "LISTENER_INVALID");
  if (listener.port !== expectedPort || !["127.0.0.1", "::1"].includes(listener.address)) fail("LISTENER_NON_LOOPBACK_OR_PORT_MISMATCH");
  if (!Array.isArray(allowedOwnerPids) || !allowedOwnerPids.includes(listener.pid)) fail("LISTENER_OWNER_MISMATCH");
  return listener;
}

export function validateReadiness(snapshot) {
  assertClosedKeys(snapshot, ["preExistingListeners", "backendHealth", "listeners", "harnessReady", "harnessSignal", "identities", "processes"], "READINESS_SNAPSHOT_INVALID");
  if (!Array.isArray(snapshot.preExistingListeners) || snapshot.preExistingListeners.length !== 0) fail("PORT_PREEXISTING_LISTENER");
  assertClosedKeys(snapshot.backendHealth, ["statusCode", "redirected", "body"], "BACKEND_READINESS_INVALID");
  if (snapshot.backendHealth.statusCode !== 200 || snapshot.backendHealth.redirected !== false || snapshot.backendHealth.body?.status !== "UP") fail("BACKEND_READINESS_INVALID");
  if (snapshot.harnessReady !== true || snapshot.harnessSignal !== "HARNESS_READY") fail("HARNESS_READINESS_INVALID");
  if (!Array.isArray(snapshot.listeners) || snapshot.listeners.length !== 3) fail("LISTENER_SET_INVALID");
  validateRuntimeProcessSet(snapshot.processes);
  for (const port of PORTS) {
    const listener = snapshot.listeners.find((candidate) => candidate.port === port);
    if (listener === undefined) fail("LISTENER_NON_LOOPBACK_OR_PORT_MISMATCH");
    const allowedOwnerPids = snapshot.processes.filter((descriptor) => descriptor.expectedPort === port).map((descriptor) => descriptor.pid);
    if (allowedOwnerPids.length !== 1) fail("LISTENER_OWNER_SET_INVALID");
    validateListener(listener, port, allowedOwnerPids);
  }
  assertClosedKeys(snapshot.identities, ["ACCOUNTANT", "REVIEWER"], "ACTOR_IDENTITIES_INVALID");
  for (const actorName of ["ACCOUNTANT", "REVIEWER"]) validateActorIdentity(snapshot.identities[actorName], actorName);
  return snapshot;
}

export function validateProvisioningResult(result, state, { adminUser }) {
  validateRecoveryState(state);
  assertClosedKeys(result, ["databaseName", "roleName", "ownershipMarkerSha256", "rollbackPlanValidated", "catalogSnapshot"], "PROVISIONING_RESULT_INVALID");
  if (result.databaseName !== state.resources.dbName || result.roleName !== state.resources.roleName || result.ownershipMarkerSha256 !== sha256Hex(state.ownershipMarker) || result.rollbackPlanValidated !== true) fail("PROVISIONING_IDENTITY_DIVERGENT");
  validateCatalogIdentity(result.catalogSnapshot, { resources: state.resources, adminUser, ownershipMarker: state.ownershipMarker });
  return result;
}

export function validateRuntimeStartResult(result, { runtimePlans, tools, ownershipMarker }) {
  assertClosedKeys(result, ["processes", "readiness", "planEvidence", "backendApplicationBindingProof", "viteEnvironmentProofs"], "RUNTIME_START_RESULT_INVALID");
  validateRuntimeProcessSet(result.processes);
  validateRuntimeProcessPlanBindings(result.processes, tools);
  validateReadiness(result.readiness);
  if (canonicalJson(result.readiness.processes) !== canonicalJson(result.processes)) fail("RUNTIME_READINESS_PROCESS_MISMATCH");
  if (canonicalJson(result.planEvidence) !== canonicalJson(runtimePlanEvidence(runtimePlans))) fail("RUNTIME_PLAN_EVIDENCE_MISMATCH");
  validateViteEnvironmentProofs(result.viteEnvironmentProofs, runtimePlans);
  validateBackendApplicationBindingProof(result.backendApplicationBindingProof, { processes: result.processes, tools, ownershipMarker, runtimePlanSha256: runtimePlanEvidenceSha256(runtimePlans) });
  const backendRoot = result.processes.find((descriptor) => descriptor.label === "BACKEND_GRADLE");
  const harnessRoot = result.processes.find((descriptor) => descriptor.label === "TWO_ACTOR_HARNESS");
  if (backendRoot.executablePath !== runtimePlans.backend.executable || backendRoot.commandLineSha256 !== spawnCommandLineSha256(runtimePlans.backend)) fail("RUNTIME_BACKEND_PLAN_MISMATCH");
  if (harnessRoot.executablePath !== runtimePlans.harness.executable || harnessRoot.executableSha256 !== tools.node.sha256 || harnessRoot.commandLineSha256 !== spawnCommandLineSha256(runtimePlans.harness)) fail("RUNTIME_HARNESS_PLAN_MISMATCH");
  for (const label of ["VITE_ACCOUNTANT", "VITE_REVIEWER"]) {
    const vite = result.processes.find((descriptor) => descriptor.label === label);
    if (vite.executablePath !== tools.node.path || vite.executableSha256 !== tools.node.sha256) fail("RUNTIME_VITE_EXECUTABLE_MISMATCH");
  }
  return result;
}

export function validateRuntimeProcessSet(processes) {
  validateRuntimeProcessSubset(processes);
  if (processes.length !== 5) fail("RUNTIME_PROCESS_SET_INVALID");
  const requiredLabels = ["BACKEND_GRADLE", "BACKEND_APPLICATION", "TWO_ACTOR_HARNESS", "VITE_ACCOUNTANT", "VITE_REVIEWER"];
  if (processes.some((descriptor) => !requiredLabels.includes(descriptor.label)) || requiredLabels.some((label) => !processes.some((descriptor) => descriptor.label === label))) fail("RUNTIME_REQUIRED_PROCESS_MISSING");
  return processes;
}

export function validateRuntimeProcessSubset(processes) {
  if (!Array.isArray(processes) || processes.length < 1 || processes.length > 5) fail("RUNTIME_PROCESS_SET_INVALID");
  processes.forEach(validateProcessDescriptor);
  if (new Set(processes.map((descriptor) => descriptor.pid)).size !== processes.length || new Set(processes.map((descriptor) => descriptor.label)).size !== processes.length) fail("RUNTIME_PROCESS_SET_INVALID");
  const allowed = new Map([
    ["DEMO_SEED", null],
    ["BACKEND_GRADLE", null],
    ["BACKEND_APPLICATION", 8080],
    ["TWO_ACTOR_HARNESS", null],
    ["VITE_ACCOUNTANT", 5173],
    ["VITE_REVIEWER", 5174]
  ]);
  for (const descriptor of processes) if (!allowed.has(descriptor.label) || descriptor.expectedPort !== allowed.get(descriptor.label)) fail("RUNTIME_UNEXPECTED_PROCESS", { label: descriptor.label });
  if (processes.some((descriptor) => descriptor.label === "DEMO_SEED")) {
    if (processes.length !== 1) fail("RUNTIME_PROCESS_PHASE_INVALID");
    return processes;
  }
  const labels = new Set(processes.map((descriptor) => descriptor.label));
  if (labels.has("BACKEND_APPLICATION") && !labels.has("BACKEND_GRADLE")) fail("RUNTIME_PROCESS_PHASE_INVALID");
  if (labels.has("TWO_ACTOR_HARNESS") && (!labels.has("BACKEND_GRADLE") || !labels.has("BACKEND_APPLICATION"))) fail("RUNTIME_PROCESS_PHASE_INVALID");
  if (labels.has("VITE_ACCOUNTANT") && !labels.has("TWO_ACTOR_HARNESS")) fail("RUNTIME_PROCESS_PHASE_INVALID");
  if (labels.has("VITE_REVIEWER") && (!labels.has("VITE_ACCOUNTANT") || !labels.has("TWO_ACTOR_HARNESS"))) fail("RUNTIME_PROCESS_PHASE_INVALID");
  const byLabel = new Map(processes.map((descriptor) => [descriptor.label, descriptor]));
  const managedPids = new Set(processes.map((descriptor) => descriptor.pid));
  for (const rootLabel of ["BACKEND_GRADLE", "TWO_ACTOR_HARNESS"]) {
    const root = byLabel.get(rootLabel);
    if (root !== undefined && managedPids.has(root.parentPid)) fail("RUNTIME_PROCESS_TREE_OVERLAP", { rootLabel });
  }
  const backend = byLabel.get("BACKEND_GRADLE");
  const application = byLabel.get("BACKEND_APPLICATION");
  const harness = byLabel.get("TWO_ACTOR_HARNESS");
  if (application !== undefined && application.parentPid !== backend?.pid) fail("RUNTIME_PROCESS_TREE_INVALID");
  for (const label of ["VITE_ACCOUNTANT", "VITE_REVIEWER"]) {
    const vite = byLabel.get(label);
    if (vite !== undefined && vite.parentPid !== harness?.pid) fail("RUNTIME_PROCESS_TREE_INVALID");
  }
  return processes;
}

export function validateFreshResourceProof(proof, state) {
  validateRecoveryState(state);
  assertClosedKeys(proof, ["stateSha256", "catalogIdentityExact", "filesystemIdentityExact", "processIdentityExact"], "FRESH_RESOURCE_PROOF_INVALID");
  if (proof.stateSha256 !== sha256Hex(serializeRecoveryState(state)) || proof.catalogIdentityExact !== true || proof.filesystemIdentityExact !== true || proof.processIdentityExact !== true) fail("FRESH_RESOURCE_IDENTITY_DIVERGENT");
  return proof;
}

export function validateActorIdentity(identity, actorName) {
  if (!Object.hasOwn(ACTORS, actorName)) fail("ACTOR_NAME_INVALID");
  assertClosedKeys(identity, ["userId", "subject", "roles", "memberships"], "ACTOR_IDENTITY_INVALID");
  const expected = ACTORS[actorName];
  if (identity.userId !== expected.userId || identity.subject !== expected.subject || !Array.isArray(identity.roles) || identity.roles.length !== 1 || identity.roles[0] !== expected.role) {
    fail("ACTOR_IDENTITY_MISMATCH", { actor: actorName });
  }
  if (!Array.isArray(identity.memberships) || identity.memberships.length !== 1) fail("ACTOR_MEMBERSHIP_MISMATCH", { actor: actorName });
  assertClosedKeys(identity.memberships[0], ["tenantId", "role"], "ACTOR_MEMBERSHIP_MISMATCH");
  if (identity.memberships[0].tenantId !== TENANT_ID || identity.memberships[0].role !== expected.role) fail("ACTOR_MEMBERSHIP_MISMATCH", { actor: actorName });
  return identity;
}

export const RECOVERY_STATE_KEYS = Object.freeze([
  "schemaVersion",
  "protocolId",
  "protocolVersion",
  "orchestratorSha256",
  "repository",
  "head",
  "run",
  "runId",
  "priorRunId",
  "tenantId",
  "environment",
  "proposalSha256",
  "commandBindingSha256",
  "binding",
  "reviewRecord",
  "authorizationRecord",
  "recoveryNonce",
  "resources",
  "ownershipMarker",
  "runtimePlanEvidenceSha256",
  "processes",
  "pendingOperation",
  "completedOperations",
  "attempt",
  "taskStatuses",
  "auditResult",
  "exportEvidence",
  "usefulness",
  "cleanup",
  "createdAtUtc",
  "updatedAtUtc"
]);

const RECOVERY_RESOURCES_KEYS = Object.freeze([
  "dbName",
  "roleName",
  "runtimeRoot",
  "storageRoot",
  "evidenceRoot",
  "recoveryStatePath",
  "exportPath",
  "summaryPath",
  "summaryHashPath"
]);

export function createRecoveryState({ binding, proposalSha256: proposalHash, commandBindingSha256, recoveryNonce, resources, nowUtc }) {
  validateBinding(binding);
  if (bindingSha256(binding) !== commandBindingSha256) fail("BINDING_HASH_MISMATCH");
  assertString(recoveryNonce, "RECOVERY_NONCE_INVALID", { pattern: /^[0-9a-f]{32}$/ });
  assertString(proposalHash, "PROPOSAL_HASH_INVALID", { pattern: SHA256_REGEX });
  assertUtcMilliseconds(nowUtc);
  const ownershipMarker = createOwnershipMarker({ runId: binding.runId, recoveryNonce, bindingSha256: commandBindingSha256 });
  const resourceState = {};
  for (const key of RECOVERY_RESOURCES_KEYS) resourceState[key] = resources[key];
  const state = {
    schemaVersion: RECOVERY_SCHEMA_VERSION,
    protocolId: PROTOCOL_ID,
    protocolVersion: PROTOCOL_VERSION,
    orchestratorSha256: binding.orchestratorSha256,
    repository: binding.repository,
    head: binding.head,
    run: binding.run,
    runId: binding.runId,
    priorRunId: binding.priorRunId,
    tenantId: binding.tenantId,
    environment: binding.environment,
    proposalSha256: proposalHash,
    commandBindingSha256,
    binding: structuredClone(binding),
    reviewRecord: { ...binding.preExecutionReview },
    authorizationRecord: { ...binding.sensitiveAuthorization },
    recoveryNonce,
    resources: resourceState,
    ownershipMarker,
    runtimePlanEvidenceSha256: null,
    processes: [],
    pendingOperation: null,
    completedOperations: [],
    attempt: {
      engaged: false,
      startedAtUtc: null,
      authorizationConsumed: false,
      authorizationConsumedAtUtc: null
    },
    taskStatuses: TASK_IDS.map((taskId) => ({ taskId, status: "NOT_REACHED", failureCode: null })),
    auditResult: null,
    exportEvidence: null,
    usefulness: null,
    cleanup: { status: "NOT_STARTED", completedSteps: [], residuals: [] },
    createdAtUtc: nowUtc,
    updatedAtUtc: nowUtc
  };
  validateRecoveryState(state, { binding, commandBindingSha256, resources });
  return state;
}

function expectedBusinessOperationIds(runId) {
  const requestIds = buildTaskDescriptors({ runId }).flatMap((task) => task.requests.map((unused, index) => `${task.taskId}_REQUEST_${index + 1}`));
  return Object.freeze(["PROVISION_RESOURCES", "START_RUNTIME", ...requestIds, "PRESERVE_EXPORT"]);
}

export function validateRecoveryState(state, expected = undefined) {
  assertClosedKeys(state, RECOVERY_STATE_KEYS, "RECOVERY_STATE_SCHEMA_INVALID");
  if (state.schemaVersion !== RECOVERY_SCHEMA_VERSION || state.protocolId !== PROTOCOL_ID || state.protocolVersion !== PROTOCOL_VERSION) fail("RECOVERY_STATE_VERSION_INVALID");
  for (const hash of [state.orchestratorSha256, state.proposalSha256, state.commandBindingSha256]) assertString(hash, "RECOVERY_STATE_HASH_INVALID", { pattern: SHA256_REGEX });
  validateBinding(state.binding);
  if (state.binding.proposalSha256 !== state.proposalSha256 || proposalSha256(proposalFromBinding(state.binding)) !== state.proposalSha256) fail("RECOVERY_STATE_PROPOSAL_BINDING_MISMATCH");
  if (bindingSha256(state.binding) !== state.commandBindingSha256) fail("RECOVERY_STATE_BINDING_MISMATCH");
  assertString(state.head, "RECOVERY_STATE_HEAD_INVALID", { pattern: GIT_SHA1_REGEX });
  if (state.repository !== REPOSITORY || state.tenantId !== TENANT_ID || state.environment !== ENVIRONMENT) fail("RECOVERY_STATE_SCOPE_INVALID");
  validateRun(state.run);
  validateRunId(state.runId, state.run);
  if (state.run === "R1" && state.priorRunId !== null) fail("RECOVERY_STATE_PRIOR_RUN_INVALID");
  if (state.run === "R2") validateRunId(state.priorRunId, "R1");
  assertString(state.recoveryNonce, "RECOVERY_NONCE_INVALID", { pattern: /^[0-9a-f]{32}$/ });
  assertClosedKeys(state.reviewRecord, ["recordId", "pathSha256", "sha256", "environmentBindingSha256"], "RECOVERY_REVIEW_RECORD_INVALID");
  assertClosedKeys(state.authorizationRecord, ["recordId", "pathSha256", "sha256", "environmentBindingSha256", "preExecutionReviewRecordId", "preExecutionReviewPathSha256", "preExecutionReviewSha256"], "RECOVERY_AUTHORIZATION_RECORD_INVALID");
  for (const record of [state.reviewRecord, state.authorizationRecord]) {
    assertString(record.recordId, "RECOVERY_RECORD_INVALID", { pattern: /^043c-[a-z0-9][a-z0-9-]{6,95}$/ });
    assertString(record.pathSha256, "RECOVERY_RECORD_INVALID", { pattern: SHA256_REGEX });
    assertString(record.sha256, "RECOVERY_RECORD_INVALID", { pattern: SHA256_REGEX });
  }
  assertString(state.reviewRecord.environmentBindingSha256, "RECOVERY_REVIEW_RECORD_INVALID", { pattern: SHA256_REGEX });
  assertString(state.authorizationRecord.environmentBindingSha256, "RECOVERY_AUTHORIZATION_RECORD_INVALID", { pattern: SHA256_REGEX });
  assertString(state.authorizationRecord.preExecutionReviewRecordId, "RECOVERY_AUTHORIZATION_RECORD_INVALID", { pattern: /^043c-[a-z0-9][a-z0-9-]{6,95}$/ });
  for (const hash of [state.authorizationRecord.preExecutionReviewPathSha256, state.authorizationRecord.preExecutionReviewSha256]) assertString(hash, "RECOVERY_AUTHORIZATION_RECORD_INVALID", { pattern: SHA256_REGEX });
  if (state.reviewRecord.environmentBindingSha256 !== state.authorizationRecord.environmentBindingSha256) fail("RECOVERY_STATE_ENVIRONMENT_BINDING_MISMATCH");
  if (
    state.authorizationRecord.preExecutionReviewRecordId !== state.reviewRecord.recordId ||
    state.authorizationRecord.preExecutionReviewPathSha256 !== state.reviewRecord.pathSha256 ||
    state.authorizationRecord.preExecutionReviewSha256 !== state.reviewRecord.sha256
  ) fail("RECOVERY_STATE_REVIEW_BINDING_MISMATCH");
  if (canonicalJson(state.reviewRecord) !== canonicalJson(state.binding.preExecutionReview) || canonicalJson(state.authorizationRecord) !== canonicalJson(state.binding.sensitiveAuthorization)) fail("RECOVERY_STATE_BINDING_MISMATCH");
  assertClosedKeys(state.resources, RECOVERY_RESOURCES_KEYS, "RECOVERY_RESOURCES_INVALID");
  for (const key of RECOVERY_RESOURCES_KEYS) assertString(state.resources[key], "RECOVERY_RESOURCE_INVALID");
  const boundFields = ["orchestratorSha256", "repository", "head", "run", "runId", "priorRunId", "tenantId", "environment"];
  for (const field of boundFields) if (state.binding[field] !== state[field]) fail("RECOVERY_STATE_BINDING_MISMATCH", { field });
  if (state.binding.resources.dbName !== state.resources.dbName || state.binding.resources.roleName !== state.resources.roleName || state.binding.resources.runtimeRootSha256 !== sha256Hex(state.resources.runtimeRoot) || state.binding.resources.storageRootSha256 !== sha256Hex(state.resources.storageRoot) || state.binding.resources.evidenceRootSha256 !== sha256Hex(state.resources.evidenceRoot)) fail("RECOVERY_STATE_RESOURCE_MISMATCH");
  assertOwnershipMarker(state.ownershipMarker, state.runId, state.recoveryNonce, state.commandBindingSha256);
  if (state.runtimePlanEvidenceSha256 !== null) assertString(state.runtimePlanEvidenceSha256, "RECOVERY_RUNTIME_PLAN_EVIDENCE_INVALID", { pattern: SHA256_REGEX });
  if (!Array.isArray(state.processes)) fail("RECOVERY_PROCESSES_INVALID");
  if (state.processes.length > 0) {
    if (state.cleanup?.status === "NOT_STARTED" && state.pendingOperation?.id !== "START_RUNTIME") validateRuntimeProcessSet(state.processes);
    else validateRuntimeProcessSubset(state.processes);
    validateRuntimeProcessPlanBindings(state.processes, state.binding.tools);
  }
  if (state.pendingOperation !== null) {
    assertClosedKeys(state.pendingOperation, ["id", "target", "expectedIdentity", "recordedAtUtc"], "RECOVERY_PENDING_OPERATION_INVALID");
    assertString(state.pendingOperation.id, "RECOVERY_PENDING_OPERATION_INVALID", { pattern: /^[A-Z][A-Z0-9_]{1,63}$/ });
    assertString(state.pendingOperation.target, "RECOVERY_PENDING_OPERATION_INVALID");
    assertString(state.pendingOperation.expectedIdentity, "RECOVERY_PENDING_OPERATION_INVALID", { pattern: SHA256_REGEX });
    assertUtcMilliseconds(state.pendingOperation.recordedAtUtc, "RECOVERY_PENDING_OPERATION_INVALID");
  }
  if (!Array.isArray(state.completedOperations) || state.completedOperations.some((operation) => typeof operation !== "string" || !/^[A-Z][A-Z0-9_]{1,63}$/.test(operation))) fail("RECOVERY_COMPLETED_OPERATIONS_INVALID");
  if (new Set(state.completedOperations).size !== state.completedOperations.length) fail("RECOVERY_COMPLETED_OPERATIONS_INVALID");
  assertClosedKeys(state.attempt, ["engaged", "startedAtUtc", "authorizationConsumed", "authorizationConsumedAtUtc"], "RECOVERY_ATTEMPT_INVALID");
  if (typeof state.attempt.engaged !== "boolean" || typeof state.attempt.authorizationConsumed !== "boolean") fail("RECOVERY_ATTEMPT_INVALID");
  if (state.attempt.engaged !== state.attempt.authorizationConsumed) fail("RECOVERY_ATTEMPT_INVALID");
  if (state.attempt.engaged) {
    assertUtcMilliseconds(state.attempt.startedAtUtc, "RECOVERY_ATTEMPT_INVALID");
    assertUtcMilliseconds(state.attempt.authorizationConsumedAtUtc, "RECOVERY_ATTEMPT_INVALID");
  } else if (state.attempt.startedAtUtc !== null || state.attempt.authorizationConsumedAtUtc !== null) fail("RECOVERY_ATTEMPT_INVALID");
  if (!Array.isArray(state.taskStatuses) || state.taskStatuses.length !== 16) fail("RECOVERY_TASK_STATUSES_INVALID");
  state.taskStatuses.forEach((task, index) => {
    assertClosedKeys(task, ["taskId", "status", "failureCode"], "RECOVERY_TASK_STATUS_INVALID");
    if (task.taskId !== TASK_IDS[index] || !TASK_STATUSES.includes(task.status)) fail("RECOVERY_TASK_STATUS_INVALID");
    if ((task.status === "FAIL") !== (typeof task.failureCode === "string" && STABLE_ERROR_CODE.test(task.failureCode)) || (task.status !== "FAIL" && task.failureCode !== null)) fail("RECOVERY_TASK_STATUS_INVALID");
  });
  if (state.attempt.engaged) {
    if (state.taskStatuses[0].status !== "PASS" || (state.cleanup.status === "NOT_STARTED" && state.processes.length === 0)) fail("RECOVERY_ATTEMPT_TASK_CONTRADICTION");
    let terminalSeen = false;
    for (let index = 1; index < 15; index += 1) {
      const status = state.taskStatuses[index].status;
      if (terminalSeen && status !== "NOT_REACHED") fail("RECOVERY_TASK_ORDER_INVALID");
      if (status === "FAIL" || status === "NOT_REACHED") terminalSeen = true;
    }
    if (state.taskStatuses[15].status !== "NOT_REACHED" || state.taskStatuses[15].failureCode !== null) fail("RECOVERY_TASK_ORDER_INVALID");
  } else {
    if (!(["NOT_REACHED", "FAIL"].includes(state.taskStatuses[0].status)) || state.taskStatuses.slice(1).some((task) => task.status !== "NOT_REACHED")) fail("RECOVERY_PREFLIGHT_TASK_CONTRADICTION");
  }
  if (state.auditResult !== null) {
    assertClosedKeys(state.auditResult, ["expectedCount", "missingCount", "unexpectedCount", "actualCount", "status"], "RECOVERY_AUDIT_INVALID");
    for (const name of ["expectedCount", "missingCount", "unexpectedCount", "actualCount"]) assertInteger(state.auditResult[name], "RECOVERY_AUDIT_INVALID", { minimum: 0 });
    if (!["PASS_15_EXPECTED_0_MISSING_0_UNEXPECTED", "FAIL"].includes(state.auditResult.status) || state.auditResult.expectedCount !== 15 || state.taskStatuses[14].status !== "PASS") fail("RECOVERY_AUDIT_INVALID");
    if (state.auditResult.missingCount > state.auditResult.expectedCount || state.auditResult.unexpectedCount > state.auditResult.actualCount || state.auditResult.actualCount !== state.auditResult.expectedCount - state.auditResult.missingCount + state.auditResult.unexpectedCount) fail("RECOVERY_AUDIT_INVALID");
    const exactPassCounts = state.auditResult.missingCount === 0 && state.auditResult.unexpectedCount === 0 && state.auditResult.actualCount === 15;
    if ((state.auditResult.status === "PASS_15_EXPECTED_0_MISSING_0_UNEXPECTED") !== exactPassCounts) fail("RECOVERY_AUDIT_INVALID");
  }
  if (state.exportEvidence !== null) {
    assertClosedKeys(state.exportEvidence, ["exportPackId", "fileName", "byteSize", "sha256"], "RECOVERY_EXPORT_INVALID");
    assertString(state.exportEvidence.exportPackId, "RECOVERY_EXPORT_INVALID", { pattern: UUID_REGEX });
    assertString(state.exportEvidence.fileName, "RECOVERY_EXPORT_INVALID", { pattern: /^closing-folder-[0-9a-f-]{36}-export-pack-[0-9a-f-]{36}\.zip$/ });
    assertInteger(state.exportEvidence.byteSize, "RECOVERY_EXPORT_INVALID", { minimum: 1 });
    assertString(state.exportEvidence.sha256, "RECOVERY_EXPORT_INVALID", { pattern: SHA256_REGEX });
    if (state.taskStatuses[14].status !== "PASS") fail("RECOVERY_EXPORT_INVALID");
  }
  if (state.usefulness !== null) {
    validateUsefulness(state.usefulness);
    if (state.auditResult?.status !== "PASS_15_EXPECTED_0_MISSING_0_UNEXPECTED") fail("RECOVERY_USEFULNESS_INVALID");
  }
  assertClosedKeys(state.cleanup, ["status", "completedSteps", "residuals"], "RECOVERY_CLEANUP_INVALID");
  if (!["NOT_STARTED", "IN_PROGRESS", "FINALIZING", "COMPLETE", "PARTIAL"].includes(state.cleanup.status)) fail("RECOVERY_CLEANUP_INVALID");
  if (!Array.isArray(state.cleanup.completedSteps) || !Array.isArray(state.cleanup.residuals)) fail("RECOVERY_CLEANUP_INVALID");
  if (state.cleanup.completedSteps.some((step, index) => step !== CLEANUP_STEPS[index]) || new Set(state.cleanup.completedSteps).size !== state.cleanup.completedSteps.length || state.cleanup.residuals.some((item) => typeof item !== "string" || !/^[A-Z][A-Z0-9_]{0,95}:[A-Z][A-Z0-9_]{0,95}$/.test(item))) fail("RECOVERY_CLEANUP_INVALID");
  if (state.cleanup.status === "NOT_STARTED" && (state.cleanup.completedSteps.length !== 0 || state.cleanup.residuals.length !== 0)) fail("RECOVERY_CLEANUP_INVALID");
  if (state.cleanup.status === "FINALIZING" && (state.cleanup.completedSteps.length !== CLEANUP_STEPS.length - 1 || state.cleanup.residuals.length !== 0)) fail("RECOVERY_CLEANUP_INVALID");
  if (state.cleanup.status === "COMPLETE" && (state.cleanup.completedSteps.length !== CLEANUP_STEPS.length || state.cleanup.residuals.length !== 0)) fail("RECOVERY_CLEANUP_INVALID");
  if (state.cleanup.status === "PARTIAL" && state.cleanup.residuals.length === 0) fail("RECOVERY_CLEANUP_INVALID");
  const businessIds = expectedBusinessOperationIds(state.runId);
  const cleanupIndex = state.completedOperations.findIndex((id) => CLEANUP_STEPS.includes(id));
  const businessCompleted = cleanupIndex < 0 ? state.completedOperations : state.completedOperations.slice(0, cleanupIndex);
  const cleanupCompleted = cleanupIndex < 0 ? [] : state.completedOperations.slice(cleanupIndex);
  if (businessCompleted.some((id, index) => id !== businessIds[index]) || cleanupCompleted.some((id, index) => id !== CLEANUP_STEPS[index])) fail("RECOVERY_OPERATION_ORDER_INVALID");
  const durableCleanupSteps = state.cleanup.completedSteps.filter((id) => id !== CLEANUP_STEPS[9]);
  if (durableCleanupSteps.length !== cleanupCompleted.length || durableCleanupSteps.some((id, index) => id !== cleanupCompleted[index])) fail("RECOVERY_CLEANUP_OPERATION_MISMATCH");
  if (state.pendingOperation !== null) {
    const expectedPendingId = CLEANUP_STEPS.includes(state.pendingOperation.id) ? CLEANUP_STEPS[cleanupCompleted.length] : businessIds[businessCompleted.length];
    if (state.pendingOperation.id !== expectedPendingId || (CLEANUP_STEPS.includes(state.pendingOperation.id) && cleanupIndex < 0 && state.cleanup.status === "NOT_STARTED")) fail("RECOVERY_PENDING_OPERATION_ORDER_INVALID");
  }
  if (state.attempt.engaged && (businessCompleted.length < 2 || businessCompleted[0] !== "PROVISION_RESOURCES" || businessCompleted[1] !== "START_RUNTIME")) fail("RECOVERY_ATTEMPT_OPERATION_CONTRADICTION");
  if (state.processes.length > 0 && !businessCompleted.includes("START_RUNTIME") && state.pendingOperation?.id !== "START_RUNTIME") fail("RECOVERY_PROCESS_OPERATION_CONTRADICTION");
  if ((businessCompleted.includes("START_RUNTIME") || state.pendingOperation?.id === "START_RUNTIME" || state.processes.length > 0) && state.runtimePlanEvidenceSha256 === null) fail("RECOVERY_RUNTIME_PLAN_EVIDENCE_INVALID");
  const completedBusinessSet = new Set(businessCompleted);
  const taskRequests = buildTaskDescriptors({ runId: state.runId });
  for (let taskIndex = 3; taskIndex <= 14; taskIndex += 1) {
    const requestOperationIds = taskRequests[taskIndex].requests.map((unused, requestIndex) => `${TASK_IDS[taskIndex]}_REQUEST_${requestIndex + 1}`);
    const taskStatus = state.taskStatuses[taskIndex].status;
    if (taskStatus === "PASS" && requestOperationIds.some((id) => !completedBusinessSet.has(id))) fail("RECOVERY_TASK_OPERATION_MISMATCH", { taskId: TASK_IDS[taskIndex] });
    const taskTouched = requestOperationIds.some((id) => completedBusinessSet.has(id) || state.pendingOperation?.id === id);
    if (taskTouched && state.taskStatuses.slice(3, taskIndex).some((task) => task.status !== "PASS")) fail("RECOVERY_TASK_OPERATION_ORDER_INVALID", { taskId: TASK_IDS[taskIndex] });
  }
  if ((completedBusinessSet.has("PRESERVE_EXPORT") || state.pendingOperation?.id === "PRESERVE_EXPORT") && state.taskStatuses[14].status !== "PASS") fail("RECOVERY_EXPORT_OPERATION_MISMATCH");
  if (state.exportEvidence !== null && !completedBusinessSet.has("PRESERVE_EXPORT")) fail("RECOVERY_EXPORT_OPERATION_MISMATCH");
  if (state.auditResult !== null && (!completedBusinessSet.has("PRESERVE_EXPORT") || state.exportEvidence === null)) fail("RECOVERY_AUDIT_OPERATION_MISMATCH");
  assertUtcMilliseconds(state.createdAtUtc, "RECOVERY_STATE_TIME_INVALID");
  assertUtcMilliseconds(state.updatedAtUtc, "RECOVERY_STATE_TIME_INVALID");
  if (expected !== undefined) {
    const { binding, commandBindingSha256, resources } = expected;
    validateBinding(binding);
    if (state.commandBindingSha256 !== commandBindingSha256 || bindingSha256(binding) !== commandBindingSha256) fail("RECOVERY_STATE_BINDING_MISMATCH");
    const fields = ["orchestratorSha256", "repository", "head", "run", "runId", "priorRunId", "tenantId", "environment"];
    for (const field of fields) if (state[field] !== binding[field]) fail("RECOVERY_STATE_BINDING_MISMATCH", { field });
    if (state.reviewRecord.recordId !== binding.preExecutionReview.recordId || state.reviewRecord.sha256 !== binding.preExecutionReview.sha256) fail("RECOVERY_STATE_BINDING_MISMATCH");
    if (state.authorizationRecord.recordId !== binding.sensitiveAuthorization.recordId || state.authorizationRecord.sha256 !== binding.sensitiveAuthorization.sha256) fail("RECOVERY_STATE_BINDING_MISMATCH");
    if (canonicalJson(state.binding) !== canonicalJson(binding)) fail("RECOVERY_STATE_BINDING_MISMATCH");
    for (const key of RECOVERY_RESOURCES_KEYS) if (state.resources[key] !== resources[key]) fail("RECOVERY_STATE_RESOURCE_MISMATCH", { key });
  }
  return state;
}

export function serializeRecoveryState(state) {
  validateRecoveryState(state);
  return canonicalJson(state);
}

export function parseRecoveryState(text, expected = undefined) {
  let state;
  try {
    state = parseCanonicalJson(text, "RECOVERY_STATE_NON_CANONICAL");
    validateRecoveryState(state, expected);
  } catch (error) {
    if (error instanceof OrchestratorError && error.code.startsWith("RECOVERY_STATE_")) throw error;
    fail("RECOVERY_STATE_MALFORMED");
  }
  return state;
}

export function validatePreflightInspection(inspection, resources) {
  assertClosedKeys(resources, ["dbName", "roleName", "runtimeBase", "runtimeRoot", "storageRoot", "evidenceBase", "evidenceRoot", "recoveryStatePath", "exportPath", "summaryPath", "summaryHashPath"], "RESOURCES_INVALID");
  assertClosedKeys(inspection, ["databasePresent", "rolePresent", "runtimeRootPresent", "storageRootPresent", "evidenceRootPresent", "occupiedPorts", "pathProof"], "PREFLIGHT_INSPECTION_INVALID");
  if (!Array.isArray(inspection.occupiedPorts) || inspection.occupiedPorts.some((port) => !PORTS.includes(port))) fail("PREFLIGHT_INSPECTION_INVALID");
  const presenceValues = [inspection.databasePresent, inspection.rolePresent, inspection.runtimeRootPresent, inspection.storageRootPresent, inspection.evidenceRootPresent];
  if (presenceValues.some((value) => typeof value !== "boolean")) fail("PREFLIGHT_INSPECTION_INVALID");
  assertClosedKeys(inspection.pathProof, ["runtimeRoot", "storageRoot", "evidenceRoot"], "PREFLIGHT_PATH_PROOF_INVALID");
  validatePathInspection(inspection.pathProof.runtimeRoot, resources.runtimeRoot, resources.runtimeBase);
  validatePathInspection(inspection.pathProof.storageRoot, resources.storageRoot, resources.runtimeRoot);
  validatePathInspection(inspection.pathProof.evidenceRoot, resources.evidenceRoot, resources.evidenceBase);
  if (inspection.pathProof.runtimeRoot.exists !== inspection.runtimeRootPresent || inspection.pathProof.storageRoot.exists !== inspection.storageRootPresent || inspection.pathProof.evidenceRoot.exists !== inspection.evidenceRootPresent) fail("PREFLIGHT_PATH_PRESENCE_MISMATCH");
  return inspection;
}

export function validateRecoveryResourceProof(proof, state) {
  validateRecoveryState(state);
  assertClosedKeys(proof, ["stateSha256", "ownershipMarkerSha256", "resourceIdentitiesExact", "processIdentitiesExact", "pathChainsSafe", "foreignResourcesPresent", "discoveredProcesses", "backendApplicationBindingProof", "discoveredExportEvidence"], "RECOVERY_RESOURCE_PROOF_INVALID");
  if (proof.stateSha256 !== sha256Hex(serializeRecoveryState(state)) || proof.ownershipMarkerSha256 !== sha256Hex(state.ownershipMarker)) fail("RECOVERY_RESOURCE_PROOF_BINDING_MISMATCH");
  if (proof.resourceIdentitiesExact !== true || proof.processIdentitiesExact !== true || proof.pathChainsSafe !== true || proof.foreignResourcesPresent !== false) fail("RECOVERY_RESOURCE_IDENTITY_DIVERGENT");
  if (!Array.isArray(proof.discoveredProcesses)) fail("RECOVERY_DISCOVERED_PROCESSES_INVALID");
  if (proof.discoveredProcesses.length > 0) {
    if (state.pendingOperation?.id !== "START_RUNTIME" || state.processes.length !== 0) fail("RECOVERY_DISCOVERED_PROCESSES_UNEXPECTED");
    if (state.runtimePlanEvidenceSha256 === null || state.pendingOperation.expectedIdentity !== runtimeStartIdentity(state.ownershipMarker, state.runtimePlanEvidenceSha256)) fail("RECOVERY_RUNTIME_PLAN_EVIDENCE_INVALID");
    validateRuntimeProcessSubset(proof.discoveredProcesses);
    validateRuntimeProcessPlanBindings(proof.discoveredProcesses, state.binding.tools);
    if (proof.discoveredProcesses.some((descriptor) => descriptor.label === "BACKEND_APPLICATION")) {
      validateBackendApplicationBindingProof(proof.backendApplicationBindingProof, { processes: proof.discoveredProcesses, tools: state.binding.tools, ownershipMarker: state.ownershipMarker, runtimePlanSha256: state.runtimePlanEvidenceSha256 });
    } else if (proof.backendApplicationBindingProof !== null) fail("BACKEND_APPLICATION_BINDING_PROOF_UNEXPECTED");
  } else if (proof.backendApplicationBindingProof !== null) {
    fail("BACKEND_APPLICATION_BINDING_PROOF_UNEXPECTED");
  }
  if (proof.discoveredExportEvidence !== null) {
    assertClosedKeys(proof.discoveredExportEvidence, ["exportPackId", "fileName", "byteSize", "sha256"], "RECOVERY_DISCOVERED_EXPORT_INVALID");
    if (state.pendingOperation?.id !== "PRESERVE_EXPORT" || state.exportEvidence !== null || state.taskStatuses[14].status !== "PASS") fail("RECOVERY_DISCOVERED_EXPORT_UNEXPECTED");
    const expectedIdentity = exportPersistenceIdentity({ path: state.resources.exportPath, ...proof.discoveredExportEvidence });
    if (state.pendingOperation.target !== proof.discoveredExportEvidence.exportPackId || state.pendingOperation.expectedIdentity !== expectedIdentity) fail("RECOVERY_DISCOVERED_EXPORT_IDENTITY_MISMATCH");
  }
  return proof;
}

async function persistRecoveryDiscoveries(adapters, state, proof) {
  if (proof.discoveredProcesses.length === 0 && proof.discoveredExportEvidence === null) return state;
  const priorHash = sha256Hex(serializeRecoveryState(state));
  let enriched;
  if (proof.discoveredExportEvidence !== null) {
    enriched = completePendingOperation(state, {
      id: "PRESERVE_EXPORT",
      nowUtc: adapters.now(),
      applyCompletion: (completedState) => {
        completedState.exportEvidence = { ...proof.discoveredExportEvidence };
        return completedState;
      }
    });
  } else {
    enriched = structuredClone(state);
    enriched.processes = proof.discoveredProcesses.map((descriptor) => ({ ...descriptor }));
    enriched.updatedAtUtc = adapters.now();
  }
  validateRecoveryState(enriched);
  await persistState(adapters, enriched, priorHash);
  return enriched;
}

export function selectPreflight({ recoveryStateText, inspection, binding, commandBindingSha256, resources }) {
  validatePreflightInspection(inspection, resources);
  const presenceValues = [inspection.databasePresent, inspection.rolePresent, inspection.runtimeRootPresent, inspection.storageRootPresent, inspection.evidenceRootPresent];
  if (recoveryStateText === null) {
    if (presenceValues.some(Boolean) || inspection.occupiedPorts.length !== 0) fail("INITIAL_RESOURCE_COLLISION");
    return Object.freeze({ mode: "INITIAL_RUN_PREFLIGHT", recoveryState: null });
  }
  if (typeof recoveryStateText !== "string") fail("RECOVERY_STATE_MALFORMED");
  const state = parseRecoveryState(recoveryStateText, { binding, commandBindingSha256, resources });
  if (state.cleanup.status === "COMPLETE") fail("RUN_ALREADY_CONSUMED");
  return Object.freeze({ mode: RECOVERY_PHASE, recoveryState: state });
}

export function setPendingOperation(state, { id, target, expectedIdentity, nowUtc }) {
  validateRecoveryState(state);
  if (state.pendingOperation !== null) fail("RECOVERY_PENDING_OPERATION_EXISTS");
  assertString(id, "RECOVERY_PENDING_OPERATION_INVALID", { pattern: /^[A-Z][A-Z0-9_]{1,63}$/ });
  assertString(target, "RECOVERY_PENDING_OPERATION_INVALID");
  assertString(expectedIdentity, "RECOVERY_PENDING_OPERATION_INVALID", { pattern: SHA256_REGEX });
  assertUtcMilliseconds(nowUtc);
  const next = structuredClone(state);
  next.pendingOperation = { id, target, expectedIdentity, recordedAtUtc: nowUtc };
  next.updatedAtUtc = nowUtc;
  validateRecoveryState(next);
  return next;
}

export function completePendingOperation(state, { id, nowUtc, applyCompletion = undefined }) {
  validateRecoveryState(state);
  if (state.pendingOperation?.id !== id || state.completedOperations.includes(id)) fail("RECOVERY_PENDING_OPERATION_MISMATCH");
  assertUtcMilliseconds(nowUtc);
  let next = structuredClone(state);
  next.pendingOperation = null;
  next.completedOperations.push(id);
  next.updatedAtUtc = nowUtc;
  if (applyCompletion !== undefined) {
    if (typeof applyCompletion !== "function") fail("RECOVERY_RESULT_APPLIER_INVALID");
    next = applyCompletion(next);
  }
  validateRecoveryState(next);
  return next;
}

export function engageRunAttempt(state, nowUtc) {
  validateRecoveryState(state);
  assertUtcMilliseconds(nowUtc);
  if (state.attempt.engaged) fail("T00_ATTEMPT_ALREADY_ENGAGED");
  const next = structuredClone(state);
  next.attempt = {
    engaged: true,
    startedAtUtc: nowUtc,
    authorizationConsumed: true,
    authorizationConsumedAtUtc: nowUtc
  };
  next.taskStatuses[0] = { taskId: "T00", status: "PASS", failureCode: null };
  next.updatedAtUtc = nowUtc;
  validateRecoveryState(next);
  return next;
}

export const T07_REQUEST_SUFFIXES = Object.freeze({
  CONTROLS: "T07-CONTROLS",
  FINANCIAL_SUMMARY: "T07-FINANCIAL-SUMMARY",
  FINANCIAL_STATEMENTS: "T07-FINANCIAL-STATEMENTS",
  WORKPAPERS: "T07-WORKPAPERS"
});

const REQUEST_KEYS = Object.freeze([
  "taskId",
  "actor",
  "origin",
  "method",
  "path",
  "requestId",
  "headers",
  "bodyKind",
  "body",
  "multipartParts",
  "expectedStatus",
  "responseContract"
]);

function request({ taskId, actor, method, requestPath, suffix, bodyKind = "NONE", body = null, multipartParts = null, expectedStatus, responseContract, accept = "application/json", tenant = true, extraHeaders = {} }) {
  const actorDefinition = ACTORS[actor];
  if (actorDefinition === undefined) fail("REQUEST_ACTOR_INVALID");
  const headers = { Accept: accept, "X-Request-Id": `${suffix.runId}-${suffix.value}` };
  if (tenant) headers["X-Tenant-Id"] = TENANT_ID;
  if (bodyKind === "JSON") headers["Content-Type"] = "application/json";
  Object.assign(headers, extraHeaders);
  const result = {
    taskId,
    actor,
    origin: actorDefinition.origin,
    method,
    path: requestPath,
    requestId: headers["X-Request-Id"],
    headers,
    bodyKind,
    body,
    multipartParts,
    expectedStatus,
    responseContract
  };
  validateRequestSpec(result);
  return Object.freeze(result);
}

export function validateRequestSpec(spec) {
  assertClosedKeys(spec, REQUEST_KEYS, "REQUEST_SCHEMA_INVALID");
  if (!TASK_IDS.includes(spec.taskId) || !["ACCOUNTANT", "REVIEWER"].includes(spec.actor)) fail("REQUEST_SCOPE_INVALID");
  if (spec.origin !== ACTORS[spec.actor].origin || ![ACCOUNTANT_ORIGIN, REVIEWER_ORIGIN].includes(spec.origin)) fail("REQUEST_ORIGIN_INVALID");
  assertString(spec.method, "REQUEST_METHOD_INVALID", { values: ["GET", "POST", "PUT"] });
  assertString(spec.path, "REQUEST_PATH_INVALID", { pattern: /^\/api\/[A-Za-z0-9._~{}\/-]+$/ });
  assertString(spec.requestId, "REQUEST_ID_INVALID", { pattern: /^r[12]-[0-9]{8}t[0-9]{6}z-[0-9a-f]{12}-T(?:0[3-9]|1[0-4])-[A-Z0-9-]+$/ });
  assertPlainObject(spec.headers, "REQUEST_HEADERS_INVALID");
  if (Object.keys(spec.headers).some((name) => name.toLowerCase() === "authorization")) fail("ORCHESTRATOR_AUTHORIZATION_HEADER_FORBIDDEN");
  if (spec.headers["X-Request-Id"] !== spec.requestId) fail("REQUEST_ID_HEADER_MISMATCH");
  if (spec.taskId === "T03") {
    if (Object.hasOwn(spec.headers, "X-Tenant-Id")) fail("T03_TENANT_HEADER_FORBIDDEN");
  } else if (spec.headers["X-Tenant-Id"] !== TENANT_ID) fail("BUSINESS_TENANT_HEADER_INVALID");
  if (spec.bodyKind === "JSON") {
    if (spec.headers["Content-Type"] !== "application/json" || spec.body === null || spec.multipartParts !== null) fail("JSON_REQUEST_INVALID");
  } else if (spec.bodyKind === "MULTIPART") {
    if (Object.keys(spec.headers).some((name) => name.toLowerCase() === "content-type") || spec.body !== null || !Array.isArray(spec.multipartParts)) fail("MULTIPART_REQUEST_INVALID");
  } else if (spec.bodyKind === "NONE") {
    if (spec.body !== null || spec.multipartParts !== null || Object.keys(spec.headers).some((name) => name.toLowerCase() === "content-type")) fail("BODYLESS_REQUEST_INVALID");
  } else fail("REQUEST_BODY_KIND_INVALID");
  if (spec.responseContract === "EXPORT_CONTENT") {
    if (spec.headers.Accept !== "application/zip") fail("EXPORT_ACCEPT_HEADER_INVALID");
  } else if (spec.headers.Accept !== "application/json") fail("JSON_ACCEPT_HEADER_INVALID");
  assertInteger(spec.expectedStatus, "REQUEST_EXPECTED_STATUS_INVALID", { minimum: 200, maximum: 299 });
  assertString(spec.responseContract, "RESPONSE_CONTRACT_INVALID");
  return spec;
}

function fixtureFilePart(name, fixture) {
  return Object.freeze({
    name,
    kind: "FILE",
    fileName: fixture.fileName,
    mediaType: fixture.mediaType,
    byteSize: fixture.byteSize,
    sha256: fixture.sha256
  });
}

function textPart(name, value) {
  return Object.freeze({ name, kind: "TEXT", value });
}

export function buildTaskDescriptors({ runId, folderId = "{folderId}", documentId = "{documentId}", exportPackId = "{exportPackId}" }) {
  validateRunId(runId);
  const s = (value) => ({ runId, value });
  const folderBase = `/api/closing-folders/${folderId}`;
  const anchorPath = `${folderBase}/workpapers/BS.ASSET.CURRENT_SECTION`;
  const noteText = `Synthetic 043c bank reconciliation ${runId}`;
  const tasks = [
    { taskId: "T00", kind: "LOCAL", contract: "ATOMIC_EXCLUSIVE_ATTEMPT_START", requests: [] },
    { taskId: "T01", kind: "LOCAL", contract: "FRESH_RESOURCES_AND_PROCESSES_EXACT", requests: [] },
    { taskId: "T02", kind: "LOCAL", contract: "FROZEN_FIXTURES_REVALIDATED", requests: [] },
    {
      taskId: "T03", kind: "HTTP", contract: "EXACT_TWO_ACTOR_IDENTITIES", requests: [
        request({ taskId: "T03", actor: "ACCOUNTANT", method: "GET", requestPath: "/api/me", suffix: s("T03-ACCOUNTANT-ME"), tenant: false, expectedStatus: 200, responseContract: "ME_ACCOUNTANT" }),
        request({ taskId: "T03", actor: "REVIEWER", method: "GET", requestPath: "/api/me", suffix: s("T03-REVIEWER-ME"), tenant: false, expectedStatus: 200, responseContract: "ME_REVIEWER" })
      ]
    },
    {
      taskId: "T04", kind: "HTTP", contract: "CREATE_FRESH_CLOSING_FOLDER", requests: [
        request({
          taskId: "T04", actor: "ACCOUNTANT", method: "POST", requestPath: "/api/closing-folders", suffix: s("T04-CREATE-FOLDER"), bodyKind: "JSON",
          body: { name: `043c ${runId} synthetic FY2025`, periodStartOn: "2025-01-01", periodEndOn: "2025-12-31", externalRef: `043c-${runId}` },
          expectedStatus: 201, responseContract: "CLOSING_FOLDER_CREATED"
        })
      ]
    },
    {
      taskId: "T05", kind: "HTTP", contract: "IMPORT_FROZEN_BALANCE", requests: [
        request({ taskId: "T05", actor: "ACCOUNTANT", method: "POST", requestPath: `${folderBase}/imports/balance`, suffix: s("T05-IMPORT-BALANCE"), bodyKind: "MULTIPART", multipartParts: [fixtureFilePart("file", FIXTURES.balance)], expectedStatus: 201, responseContract: "BALANCE_IMPORT_CREATED" })
      ]
    },
    {
      taskId: "T06", kind: "HTTP", contract: "CREATE_SEVEN_MANUAL_MAPPINGS", requests: [
        ...MAPPINGS.map((mapping) => request({ taskId: "T06", actor: "ACCOUNTANT", method: "PUT", requestPath: `${folderBase}/mappings/manual`, suffix: s(`T06-MAP-${mapping.accountCode}`), bodyKind: "JSON", body: { ...mapping }, expectedStatus: 201, responseContract: `MANUAL_MAPPING_CREATED_${mapping.accountCode}` })),
        request({ taskId: "T06", actor: "ACCOUNTANT", method: "GET", requestPath: `${folderBase}/mappings/manual`, suffix: s("T06-READ-MAPPINGS"), expectedStatus: 200, responseContract: "MANUAL_MAPPING_PROJECTION" })
      ]
    },
    {
      taskId: "T07", kind: "HTTP", contract: "DETERMINISTIC_READ_MODELS", requests: [
        request({ taskId: "T07", actor: "ACCOUNTANT", method: "GET", requestPath: `${folderBase}/controls`, suffix: s(T07_REQUEST_SUFFIXES.CONTROLS), expectedStatus: 200, responseContract: "CONTROLS_READY" }),
        request({ taskId: "T07", actor: "ACCOUNTANT", method: "GET", requestPath: `${folderBase}/financial-summary`, suffix: s(T07_REQUEST_SUFFIXES.FINANCIAL_SUMMARY), expectedStatus: 200, responseContract: "FINANCIAL_SUMMARY_READY" }),
        request({ taskId: "T07", actor: "ACCOUNTANT", method: "GET", requestPath: `${folderBase}/financial-statements/structured`, suffix: s(T07_REQUEST_SUFFIXES.FINANCIAL_STATEMENTS), expectedStatus: 200, responseContract: "STRUCTURED_STATEMENTS_READY" }),
        request({ taskId: "T07", actor: "ACCOUNTANT", method: "GET", requestPath: `${folderBase}/workpapers`, suffix: s(T07_REQUEST_SUFFIXES.WORKPAPERS), expectedStatus: 200, responseContract: "WORKPAPERS_EMPTY" })
      ]
    },
    {
      taskId: "T08", kind: "HTTP", contract: "CREATE_DRAFT_WORKPAPER", requests: [
        request({ taskId: "T08", actor: "ACCOUNTANT", method: "PUT", requestPath: anchorPath, suffix: s("T08-CREATE-WORKPAPER"), bodyKind: "JSON", body: { noteText, status: "DRAFT", evidences: [] }, expectedStatus: 201, responseContract: "WORKPAPER_DRAFT_CREATED" })
      ]
    },
    {
      taskId: "T09", kind: "HTTP", contract: "UPLOAD_FROZEN_DOCUMENT", requests: [
        request({ taskId: "T09", actor: "ACCOUNTANT", method: "POST", requestPath: `${anchorPath}/documents`, suffix: s("T09-UPLOAD-DOCUMENT"), bodyKind: "MULTIPART", multipartParts: [fixtureFilePart("file", FIXTURES.evidence), textPart("sourceLabel", FIXTURES.evidence.sourceLabel), textPart("documentDate", FIXTURES.evidence.documentDate)], expectedStatus: 201, responseContract: "DOCUMENT_CREATED" })
      ]
    },
    {
      taskId: "T10", kind: "HTTP", contract: "WORKPAPER_READY_TRANSITION", requests: [
        request({ taskId: "T10", actor: "ACCOUNTANT", method: "PUT", requestPath: anchorPath, suffix: s("T10-READY-WORKPAPER"), bodyKind: "JSON", body: { noteText, status: "READY_FOR_REVIEW", evidences: [] }, expectedStatus: 200, responseContract: "WORKPAPER_READY_UPDATED" })
      ]
    },
    {
      taskId: "T11", kind: "HTTP", contract: "REVIEWER_READ_NO_MUTATION", requests: [
        request({ taskId: "T11", actor: "REVIEWER", method: "GET", requestPath: `${folderBase}/workpapers`, suffix: s("T11-REVIEWER-WORKPAPERS"), expectedStatus: 200, responseContract: "WORKPAPERS_REVIEWER_READY" })
      ]
    },
    {
      taskId: "T12", kind: "HTTP", contract: "VERIFY_DOCUMENT_TRANSITION", requests: [
        request({ taskId: "T12", actor: "REVIEWER", method: "POST", requestPath: `${folderBase}/documents/${documentId}/verification-decision`, suffix: s("T12-VERIFY-DOCUMENT"), bodyKind: "JSON", body: { decision: "VERIFIED", comment: null }, expectedStatus: 200, responseContract: "DOCUMENT_VERIFIED" })
      ]
    },
    {
      taskId: "T13", kind: "HTTP", contract: "REVIEW_WORKPAPER_TRANSITION", requests: [
        request({ taskId: "T13", actor: "REVIEWER", method: "POST", requestPath: `${anchorPath}/review-decision`, suffix: s("T13-REVIEW-WORKPAPER"), bodyKind: "JSON", body: { decision: "REVIEWED", comment: null }, expectedStatus: 200, responseContract: "WORKPAPER_REVIEWED" })
      ]
    },
    {
      taskId: "T14", kind: "HTTP", contract: "CREATE_AND_VERIFY_EXPORT", requests: [
        request({ taskId: "T14", actor: "ACCOUNTANT", method: "POST", requestPath: `${folderBase}/export-packs`, suffix: s("T14-CREATE-EXPORT"), extraHeaders: { "Idempotency-Key": `${runId}-T14-EXPORT` }, expectedStatus: 201, responseContract: "EXPORT_CREATED" }),
        request({ taskId: "T14", actor: "ACCOUNTANT", method: "GET", requestPath: `${folderBase}/export-packs/${exportPackId}/content`, suffix: s("T14-DOWNLOAD-EXPORT"), accept: "application/zip", expectedStatus: 200, responseContract: "EXPORT_CONTENT" })
      ]
    },
    { taskId: "T15", kind: "LOCAL", contract: "AUDIT_EVIDENCE_CLEANUP_SUMMARY", requests: [] }
  ];
  for (const [index, task] of tasks.entries()) {
    assertClosedKeys(task, ["taskId", "kind", "contract", "requests"], "TASK_DESCRIPTOR_INVALID");
    if (task.taskId !== TASK_IDS[index] || !["LOCAL", "HTTP"].includes(task.kind) || !Array.isArray(task.requests)) fail("TASK_DESCRIPTOR_INVALID");
  }
  return Object.freeze(tasks.map((task) => Object.freeze({ ...task, requests: Object.freeze(task.requests) })));
}

export function validateUsefulness(usefulness) {
  assertClosedKeys(usefulness, ["usefulnessScore", "observationCode"], "USEFULNESS_INVALID");
  assertInteger(usefulness.usefulnessScore, "USEFULNESS_SCORE_INVALID", { minimum: 1, maximum: 5 });
  assertString(usefulness.observationCode, "USEFULNESS_OBSERVATION_INVALID", { values: USEFULNESS_OBSERVATION_CODES });
  return usefulness;
}

function exactObject(value, expected, code) {
  if (canonicalJson(value) !== canonicalJson(expected)) fail(code);
  return value;
}

export function expectedMePayload(actorName) {
  const actor = ACTORS[actorName];
  if (actor === undefined) fail("ACTOR_NAME_INVALID");
  return {
    actor: { userId: actor.userId, externalSubject: actor.subject, email: actor.email, displayName: actor.displayName },
    memberships: [{ tenantId: TENANT.tenantId, tenantSlug: TENANT.tenantSlug, tenantName: TENANT.tenantName, roles: [actor.role] }],
    activeTenant: { tenantId: TENANT.tenantId, tenantSlug: TENANT.tenantSlug, tenantName: TENANT.tenantName },
    effectiveRoles: [actor.role]
  };
}

function assertResponse(response, expectedStatus, code) {
  assertClosedKeys(response, ["status", "headers", "json", "bytes"], `${code}_RESPONSE_SCHEMA_INVALID`);
  if (response.status !== expectedStatus) fail(`${code}_HTTP_STATUS_INVALID`);
  assertPlainObject(response.headers, `${code}_HEADERS_INVALID`);
  return response;
}

function assertUuid(value, code) {
  return assertString(value, code, { pattern: UUID_REGEX });
}

function assertApiDateTime(value, code) {
  assertString(value, code, { pattern: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/ });
  if (!Number.isFinite(Date.parse(value))) fail(code);
  return value;
}

const DOCUMENT_SUMMARY_KEYS = Object.freeze(["id", "fileName", "mediaType", "byteSize", "checksumSha256", "sourceLabel", "documentDate", "createdAt", "createdByUserId", "verificationStatus", "reviewComment", "reviewedAt", "reviewedByUserId"]);
const WORKPAPER_ITEM_KEYS = Object.freeze(["anchorCode", "anchorLabel", "summaryBucketCode", "statementKind", "breakdownType", "isCurrentStructure", "workpaper", "documents", "documentVerificationSummary"]);
const WORKPAPER_DETAILS_KEYS = Object.freeze(["id", "noteText", "status", "reviewComment", "basisImportVersion", "basisTaxonomyVersion", "createdAt", "createdByUserId", "updatedAt", "updatedByUserId", "reviewedAt", "reviewedByUserId", "evidences"]);

function validateDocumentSummary(document, { expectedId, expectedStatus, priorDocument } = {}) {
  assertClosedKeys(document, DOCUMENT_SUMMARY_KEYS, "WORKPAPER_DOCUMENT_SCHEMA_INVALID");
  assertUuid(document.id, "WORKPAPER_DOCUMENT_ID_INVALID");
  if (expectedId !== undefined && document.id !== expectedId) fail("WORKPAPER_DOCUMENT_ID_CHANGED");
  if (
    document.fileName !== FIXTURES.evidence.fileName ||
    document.mediaType !== FIXTURES.evidence.mediaType ||
    document.byteSize !== FIXTURES.evidence.byteSize ||
    document.checksumSha256 !== FIXTURES.evidence.sha256 ||
    document.sourceLabel !== FIXTURES.evidence.sourceLabel ||
    document.documentDate !== FIXTURES.evidence.documentDate ||
    document.createdByUserId !== ACTORS.ACCOUNTANT.userId ||
    document.reviewComment !== null
  ) fail("WORKPAPER_DOCUMENT_METADATA_INVALID");
  assertApiDateTime(document.createdAt, "WORKPAPER_DOCUMENT_CREATED_AT_INVALID");
  if (priorDocument !== undefined) {
    for (const field of ["id", "fileName", "mediaType", "byteSize", "checksumSha256", "sourceLabel", "documentDate", "createdAt", "createdByUserId"]) {
      if (document[field] !== priorDocument[field]) fail("WORKPAPER_DOCUMENT_IDENTITY_CHANGED", { field });
    }
  }
  if (document.verificationStatus !== expectedStatus) fail("WORKPAPER_DOCUMENT_STATUS_INVALID");
  if (expectedStatus === "UNVERIFIED") {
    if (document.reviewedAt !== null || document.reviewedByUserId !== null) fail("WORKPAPER_DOCUMENT_REVIEW_STATE_INVALID");
  } else if (expectedStatus === "VERIFIED") {
    assertApiDateTime(document.reviewedAt, "WORKPAPER_DOCUMENT_REVIEWED_AT_INVALID");
    if (document.reviewedByUserId !== ACTORS.REVIEWER.userId) fail("WORKPAPER_DOCUMENT_REVIEWER_INVALID");
  } else fail("WORKPAPER_DOCUMENT_STATUS_INVALID");
  return document;
}

function validateWorkpaperItem(item, { expectedId, expectedStatus, expectedNote, priorWorkpaper, expectedDocument, expectedDocumentStatus, unchanged = false }) {
  assertClosedKeys(item, WORKPAPER_ITEM_KEYS, "WORKPAPER_ITEM_INVALID");
  const anchor = WORKPAPER_ANCHORS[0];
  for (const field of Object.keys(anchor)) if (item[field] !== anchor[field]) fail("WORKPAPER_ANCHOR_INVALID", { field });
  assertClosedKeys(item.workpaper, WORKPAPER_DETAILS_KEYS, "WORKPAPER_DETAILS_INVALID");
  const workpaper = item.workpaper;
  assertUuid(workpaper.id, "WORKPAPER_ID_INVALID");
  if (expectedId !== undefined && workpaper.id !== expectedId) fail("WORKPAPER_ID_CHANGED");
  if (workpaper.noteText !== expectedNote || workpaper.status !== expectedStatus || workpaper.reviewComment !== null || workpaper.basisImportVersion !== 1 || workpaper.basisTaxonomyVersion !== 2 || workpaper.createdByUserId !== ACTORS.ACCOUNTANT.userId || !Array.isArray(workpaper.evidences) || workpaper.evidences.length !== 0) fail("WORKPAPER_STATE_INVALID");
  assertApiDateTime(workpaper.createdAt, "WORKPAPER_CREATED_AT_INVALID");
  assertApiDateTime(workpaper.updatedAt, "WORKPAPER_UPDATED_AT_INVALID");
  if (priorWorkpaper !== undefined) {
    for (const field of ["id", "noteText", "basisImportVersion", "basisTaxonomyVersion", "createdAt", "createdByUserId"]) {
      if (workpaper[field] !== priorWorkpaper[field]) fail("WORKPAPER_IDENTITY_CHANGED", { field });
    }
  }
  if (expectedStatus === "REVIEWED") {
    if (workpaper.updatedByUserId !== ACTORS.REVIEWER.userId || workpaper.reviewedByUserId !== ACTORS.REVIEWER.userId) fail("WORKPAPER_REVIEWER_INVALID");
    assertApiDateTime(workpaper.reviewedAt, "WORKPAPER_REVIEWED_AT_INVALID");
  } else if (workpaper.updatedByUserId !== ACTORS.ACCOUNTANT.userId || workpaper.reviewedAt !== null || workpaper.reviewedByUserId !== null) fail("WORKPAPER_REVIEW_STATE_INVALID");
  if (!Array.isArray(item.documents)) fail("WORKPAPER_DOCUMENTS_INVALID");
  const expectedDocumentsCount = expectedDocumentStatus === undefined ? 0 : 1;
  if (item.documents.length !== expectedDocumentsCount) fail("WORKPAPER_DOCUMENTS_INVALID");
  if (expectedDocumentStatus !== undefined) validateDocumentSummary(item.documents[0], { expectedId: expectedDocument?.id, expectedStatus: expectedDocumentStatus, priorDocument: expectedDocument });
  const expectedSummary = expectedDocumentStatus === undefined
    ? { documentsCount: 0, unverifiedCount: 0, verifiedCount: 0, rejectedCount: 0 }
    : { documentsCount: 1, unverifiedCount: expectedDocumentStatus === "UNVERIFIED" ? 1 : 0, verifiedCount: expectedDocumentStatus === "VERIFIED" ? 1 : 0, rejectedCount: 0 };
  exactObject(item.documentVerificationSummary, expectedSummary, "WORKPAPER_DOCUMENT_SUMMARY_INVALID");
  if (unchanged && priorWorkpaper !== undefined && canonicalJson(workpaper) !== canonicalJson(priorWorkpaper)) fail("WORKPAPER_UNEXPECTED_MUTATION");
  return item;
}

function validateEmptyWorkpaperItems(items) {
  if (!Array.isArray(items) || items.length !== WORKPAPER_ANCHORS.length) fail("WORKPAPER_ANCHORS_INVALID");
  items.forEach((item, index) => exactObject(item, { ...WORKPAPER_ANCHORS[index], workpaper: null, documents: [], documentVerificationSummary: null }, "WORKPAPER_ANCHORS_INVALID"));
  return items;
}

function expectedControlsReady(closingFolderId) {
  return {
    closingFolderId,
    closingFolderStatus: "DRAFT",
    readiness: "READY",
    latestImportPresent: true,
    latestImportVersion: 1,
    mappingSummary: { total: 7, mapped: 7, unmapped: 0 },
    unmappedAccounts: [],
    controls: [
      { code: "LATEST_VALID_BALANCE_IMPORT_PRESENT", status: "PASS", severity: "BLOCKER", message: "Latest valid balance import version 1 is available." },
      { code: "MANUAL_MAPPING_COMPLETE_ON_LATEST_IMPORT", status: "PASS", severity: "BLOCKER", message: "Manual mapping is complete on the latest import." }
    ],
    nextAction: null
  };
}

function expectedFinancialSummaryReady(closingFolderId) {
  return {
    closingFolderId,
    closingFolderStatus: "DRAFT",
    readiness: "READY",
    statementState: "PREVIEW_READY",
    latestImportVersion: 1,
    coverage: { totalLines: 7, mappedLines: 7, unmappedLines: 0, mappedShare: "1" },
    blockers: [],
    nextAction: null,
    unmappedBalanceImpact: { debitTotal: "0", creditTotal: "0", netDebitMinusCredit: "0" },
    balanceSheetSummary: { assets: "137000", liabilities: "29000", equity: "30000", currentPeriodResult: "78000", totalAssets: "137000", totalLiabilitiesAndEquity: "137000" },
    incomeStatementSummary: { revenue: "90000", expenses: "12000", netResult: "78000" }
  };
}

function expectedStructuredStatementsReady(closingFolderId) {
  const group = (code, label, total, breakdownCode, breakdownLabel) => ({ code, label, total, breakdowns: [{ code: breakdownCode, label: breakdownLabel, breakdownType: "SECTION", total }] });
  return {
    closingFolderId,
    closingFolderStatus: "DRAFT",
    readiness: "READY",
    statementState: "PREVIEW_READY",
    presentationType: "STRUCTURED_PREVIEW",
    isStatutory: false,
    taxonomyVersion: 2,
    latestImportVersion: 1,
    coverage: { totalLines: 7, mappedLines: 7, unmappedLines: 0, mappedShare: "1" },
    blockers: [],
    nextAction: null,
    balanceSheet: {
      groups: [
        group("BS.ASSET", "Asset", "137000", "BS.ASSET.CURRENT_SECTION", "Current assets"),
        group("BS.LIABILITY", "Liability", "29000", "BS.LIABILITY.CURRENT_SECTION", "Current liabilities"),
        group("BS.EQUITY", "Equity", "30000", "BS.EQUITY.CORE_SECTION", "Equity")
      ],
      totals: { totalAssets: "137000", totalLiabilities: "29000", totalEquity: "30000", currentPeriodResult: "78000", totalLiabilitiesAndEquity: "137000" }
    },
    incomeStatement: {
      groups: [
        group("PL.REVENUE", "Revenue", "90000", "PL.REVENUE.OPERATING_SECTION", "Operating revenue"),
        group("PL.EXPENSE", "Expense", "12000", "PL.EXPENSE.OPERATING_SECTION", "Operating expenses")
      ],
      totals: { totalRevenue: "90000", totalExpenses: "12000", netResult: "78000" }
    }
  };
}

export function validateTaskResponse(spec, response, state = {}) {
  validateRequestSpec(spec);
  assertResponse(response, spec.expectedStatus, spec.taskId);
  const body = response.json;
  switch (spec.responseContract) {
    case "ME_ACCOUNTANT":
      exactObject(body, expectedMePayload("ACCOUNTANT"), "T03_ACCOUNTANT_IDENTITY_MISMATCH");
      break;
    case "ME_REVIEWER":
      exactObject(body, expectedMePayload("REVIEWER"), "T03_REVIEWER_IDENTITY_MISMATCH");
      break;
    case "CLOSING_FOLDER_CREATED":
      assertClosedKeys(body, ["id", "tenantId", "name", "periodStartOn", "periodEndOn", "externalRef", "status", "archivedAt", "archivedByUserId", "createdAt", "updatedAt"], "T04_BODY_INVALID");
      assertUuid(body.id, "T04_FOLDER_ID_INVALID");
      assertApiDateTime(body.createdAt, "T04_FOLDER_TIME_INVALID");
      assertApiDateTime(body.updatedAt, "T04_FOLDER_TIME_INVALID");
      if (body.tenantId !== TENANT_ID || body.status !== "DRAFT" || body.name !== spec.body.name || body.periodStartOn !== "2025-01-01" || body.periodEndOn !== "2025-12-31" || body.externalRef !== spec.body.externalRef || body.archivedAt !== null || body.archivedByUserId !== null || body.createdAt !== body.updatedAt || response.headers?.Location !== `/api/closing-folders/${body.id}`) fail("T04_FOLDER_STATE_INVALID");
      state.folderId = body.id;
      break;
    case "BALANCE_IMPORT_CREATED":
      assertClosedKeys(body, ["importId", "version", "closingFolderId", "importedAt", "importedByUserId", "rowCount", "totalDebit", "totalCredit", "diffSummary"], "T05_BODY_INVALID");
      assertUuid(body.importId, "T05_IMPORT_ID_INVALID");
      assertApiDateTime(body.importedAt, "T05_IMPORT_TIME_INVALID");
      if (body.closingFolderId !== state.folderId || body.version !== 1 || body.importedByUserId !== ACTORS.ACCOUNTANT.userId || body.rowCount !== 7 || body.totalDebit !== "149000" || body.totalCredit !== "149000") fail("T05_IMPORT_STATE_INVALID");
      exactObject(body.diffSummary, { previousVersion: null, addedCount: 7, removedCount: 0, changedCount: 0 }, "T05_DIFF_INVALID");
      state.importId = body.importId;
      break;
    case "MANUAL_MAPPING_PROJECTION":
      assertClosedKeys(body, ["closingFolderId", "taxonomyVersion", "latestImportVersion", "targets", "lines", "mappings", "summary"], "T06_PROJECTION_INVALID");
      if (body.closingFolderId !== state.folderId || body.taxonomyVersion !== 2 || body.latestImportVersion !== 1 || !Array.isArray(body.targets) || !Array.isArray(body.lines) || !Array.isArray(body.mappings)) fail("T06_PROJECTION_INVALID");
      exactObject(body.targets, MAPPING_TARGETS_V2, "T06_TARGET_SET_INVALID");
      exactObject(body.lines, FROZEN_BALANCE_LINES, "T06_LINES_INVALID");
      exactObject(body.mappings, MAPPINGS, "T06_MAPPING_SET_INVALID");
      const targetCodes = new Set();
      for (const target of body.targets) {
        assertClosedKeys(target, ["code", "label", "statement", "summaryBucketCode", "sectionCode", "normalSide", "granularity", "deprecated", "selectable", "displayOrder"], "T06_TARGET_INVALID");
        if (targetCodes.has(target.code) || !["BALANCE_SHEET", "INCOME_STATEMENT"].includes(target.statement) || !["DEBIT", "CREDIT"].includes(target.normalSide) || !["LEAF", "SECTION"].includes(target.granularity) || typeof target.deprecated !== "boolean" || typeof target.selectable !== "boolean" || !Number.isSafeInteger(target.displayOrder)) fail("T06_TARGET_INVALID");
        for (const field of ["code", "label", "summaryBucketCode", "sectionCode"]) assertString(target[field], "T06_TARGET_INVALID");
        targetCodes.add(target.code);
      }
      for (const mapping of MAPPINGS) {
        const target = body.targets.find((candidate) => candidate.code === mapping.targetCode);
        if (target === undefined || target.selectable !== true || target.deprecated !== false) fail("T06_TARGET_SET_INVALID", { targetCode: mapping.targetCode });
      }
      exactObject(body.summary, { total: 7, mapped: 7, unmapped: 0 }, "T06_SUMMARY_INVALID");
      break;
    case "CONTROLS_READY": {
      exactObject(body, expectedControlsReady(state.folderId), "T07_CONTROLS_INVALID");
      break;
    }
    case "FINANCIAL_SUMMARY_READY":
      exactObject(body, expectedFinancialSummaryReady(state.folderId), "T07_FINANCIAL_SUMMARY_INVALID");
      break;
    case "STRUCTURED_STATEMENTS_READY": {
      exactObject(body, expectedStructuredStatementsReady(state.folderId), "T07_STRUCTURED_STATEMENTS_INVALID");
      break;
    }
    case "WORKPAPERS_EMPTY":
      assertClosedKeys(body, ["closingFolderId", "closingFolderStatus", "readiness", "latestImportVersion", "blockers", "nextAction", "summaryCounts", "items", "staleWorkpapers"], "T07_WORKPAPERS_INVALID");
      if (body.closingFolderId !== state.folderId || body.closingFolderStatus !== "DRAFT" || body.readiness !== "READY" || body.latestImportVersion !== 1 || body.nextAction !== null || !Array.isArray(body.blockers) || body.blockers.length !== 0 || !Array.isArray(body.staleWorkpapers) || body.staleWorkpapers.length !== 0) fail("T07_WORKPAPERS_INVALID");
      validateEmptyWorkpaperItems(body.items);
      exactObject(body.summaryCounts, { totalCurrentAnchors: 5, withWorkpaperCount: 0, readyForReviewCount: 0, reviewedCount: 0, staleCount: 0, missingCount: 5 }, "T07_WORKPAPER_COUNTS_INVALID");
      break;
    case "WORKPAPER_DRAFT_CREATED":
      validateWorkpaperItem(body, { expectedStatus: "DRAFT", expectedNote: spec.body.noteText });
      state.workpaperId = body.workpaper.id;
      state.workpaperNote = body.workpaper.noteText;
      state.workpaperSnapshot = structuredClone(body.workpaper);
      state.priorWorkpaperStatus = body.workpaper.status;
      break;
    case "DOCUMENT_CREATED":
      validateDocumentSummary(body, { expectedStatus: "UNVERIFIED" });
      state.documentId = body.id;
      state.documentSnapshot = structuredClone(body);
      state.priorDocumentStatus = body.verificationStatus;
      break;
    case "WORKPAPER_READY_UPDATED":
      if (state.priorWorkpaperStatus !== "DRAFT") fail("T10_PRIOR_STATE_NOT_PROVEN");
      validateWorkpaperItem(body, { expectedId: state.workpaperId, expectedStatus: "READY_FOR_REVIEW", expectedNote: spec.body.noteText, priorWorkpaper: state.workpaperSnapshot, expectedDocument: state.documentSnapshot, expectedDocumentStatus: "UNVERIFIED" });
      state.workpaperSnapshot = structuredClone(body.workpaper);
      state.priorWorkpaperStatus = body.workpaper.status;
      break;
    case "WORKPAPERS_REVIEWER_READY": {
      assertClosedKeys(body, ["closingFolderId", "closingFolderStatus", "readiness", "latestImportVersion", "blockers", "nextAction", "summaryCounts", "items", "staleWorkpapers"], "T11_WORKPAPERS_INVALID");
      if (body.closingFolderId !== state.folderId || body.closingFolderStatus !== "DRAFT" || body.readiness !== "READY" || body.latestImportVersion !== 1 || body.nextAction !== null || !Array.isArray(body.blockers) || body.blockers.length !== 0 || !Array.isArray(body.items) || body.items.length !== 5 || !Array.isArray(body.staleWorkpapers) || body.staleWorkpapers.length !== 0) fail("T11_WORKPAPERS_INVALID");
      exactObject(body.summaryCounts, { totalCurrentAnchors: 5, withWorkpaperCount: 1, readyForReviewCount: 1, reviewedCount: 0, staleCount: 0, missingCount: 4 }, "T11_WORKPAPER_COUNTS_INVALID");
      validateWorkpaperItem(body.items[0], { expectedId: state.workpaperId, expectedStatus: "READY_FOR_REVIEW", expectedNote: state.workpaperNote, priorWorkpaper: state.workpaperSnapshot, expectedDocument: state.documentSnapshot, expectedDocumentStatus: "UNVERIFIED", unchanged: true });
      body.items.slice(1).forEach((item, index) => exactObject(item, { ...WORKPAPER_ANCHORS[index + 1], workpaper: null, documents: [], documentVerificationSummary: null }, "T11_WORKPAPER_ANCHORS_INVALID"));
      if (canonicalJson(body.items[0].documents[0]) !== canonicalJson(state.documentSnapshot)) fail("T11_DOCUMENT_UNEXPECTED_MUTATION");
      break;
    }
    case "DOCUMENT_VERIFIED":
      if (state.priorDocumentStatus !== "UNVERIFIED") fail("T12_DOCUMENT_TRANSITION_INVALID");
      validateDocumentSummary(body, { expectedId: state.documentId, expectedStatus: "VERIFIED", priorDocument: state.documentSnapshot });
      state.documentSnapshot = structuredClone(body);
      state.priorDocumentStatus = body.verificationStatus;
      break;
    case "WORKPAPER_REVIEWED":
      if (state.priorWorkpaperStatus !== "READY_FOR_REVIEW") fail("T13_PRIOR_STATE_NOT_PROVEN");
      validateWorkpaperItem(body, { expectedId: state.workpaperId, expectedStatus: "REVIEWED", expectedNote: state.workpaperNote, priorWorkpaper: state.workpaperSnapshot, expectedDocument: state.documentSnapshot, expectedDocumentStatus: "VERIFIED" });
      state.workpaperSnapshot = structuredClone(body.workpaper);
      state.priorWorkpaperStatus = body.workpaper.status;
      break;
    case "EXPORT_CREATED":
      assertClosedKeys(body, ["exportPackId", "closingFolderId", "fileName", "mediaType", "byteSize", "checksumSha256", "basisImportVersion", "basisTaxonomyVersion", "createdAt", "createdByUserId"], "T14_EXPORT_INVALID");
      assertUuid(body.exportPackId, "T14_EXPORT_ID_INVALID");
      assertApiDateTime(body.createdAt, "T14_EXPORT_TIME_INVALID");
      const expectedFileName = `closing-folder-${state.folderId}-export-pack-${body.exportPackId}.zip`;
      if (body.closingFolderId !== state.folderId || body.fileName !== expectedFileName || body.mediaType !== "application/zip" || !Number.isSafeInteger(body.byteSize) || body.byteSize < 1 || !SHA256_REGEX.test(body.checksumSha256) || body.basisImportVersion !== 1 || body.basisTaxonomyVersion !== 2 || body.createdByUserId !== ACTORS.ACCOUNTANT.userId || response.headers?.Location !== `/api/closing-folders/${state.folderId}/export-packs/${body.exportPackId}`) fail("T14_EXPORT_INVALID");
      state.exportPackId = body.exportPackId;
      state.exportFileName = body.fileName;
      state.exportByteSize = body.byteSize;
      state.exportSha256 = body.checksumSha256;
      break;
    case "EXPORT_CONTENT": {
      const header = (name) => Object.entries(response.headers).find(([key]) => key.toLowerCase() === name.toLowerCase())?.[1];
      if (!Buffer.isBuffer(response.bytes) || response.json !== null || header("content-type") !== "application/zip" || Number(header("content-length")) !== state.exportByteSize || header("cache-control") !== "private, no-store" || header("content-disposition") !== `attachment; filename="${state.exportFileName}"` || response.bytes.length !== state.exportByteSize || sha256Hex(response.bytes) !== state.exportSha256) fail("T14_EXPORT_CONTENT_INVALID");
      break;
    }
    default: {
      const mappingMatch = spec.responseContract.match(/^MANUAL_MAPPING_CREATED_(\d{4})$/);
      if (mappingMatch === null) fail("RESPONSE_CONTRACT_UNKNOWN");
      const expected = MAPPINGS.find((mapping) => mapping.accountCode === mappingMatch[1]);
      exactObject(body, expected, "T06_MAPPING_RESPONSE_INVALID");
    }
  }
  return state;
}

export const AUDIT_QUERY_SQL = String.raw`\set ON_ERROR_STOP on

BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '5s';

WITH p AS (
  SELECT
    :'run_id'::text AS run_id,
    :'folder_id'::uuid AS folder_id
),
actual AS (
  SELECT
    ae.tenant_id,
    ae.actor_user_id,
    ae.actor_subject,
    ae.actor_roles,
    ae.request_id,
    ae.action,
    ae.resource_type,
    CASE
      WHEN ae.resource_type <> 'MANUAL_MAPPING' THEN ae.resource_id
      WHEN EXISTS (
        SELECT 1
        FROM manual_mapping mm
        CROSS JOIN p
        WHERE mm.id::text = ae.resource_id
          AND mm.tenant_id = ae.tenant_id
          AND mm.closing_folder_id = p.folder_id
          AND mm.account_code = ae.metadata->>'accountCode'
          AND mm.target_code = ae.metadata #>> '{targetCode,after}'
      )
      THEN (ae.metadata->>'accountCode') || '->' || (ae.metadata #>> '{targetCode,after}')
      ELSE '__INVALID_MANUAL_MAPPING_RESOURCE__:' || ae.resource_id
    END AS resource_key
  FROM audit_event ae
  CROSS JOIN p
  WHERE left(ae.request_id, char_length(p.run_id) + 1) = p.run_id || '-'
)
SELECT jsonb_build_object(
  'tenantId', tenant_id::text,
  'actorUserId', actor_user_id::text,
  'actorSubject', actor_subject,
  'actorRoles', actor_roles,
  'requestId', request_id,
  'action', action,
  'resourceType', resource_type,
  'resourceKey', resource_key
)::text
FROM actual
ORDER BY request_id, action, resource_type, resource_key;

ROLLBACK;
`;

export function assertAuditQueryReadOnly(sql = AUDIT_QUERY_SQL) {
  assertString(sql, "AUDIT_QUERY_INVALID");
  if (!/BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;/i.test(sql) || !/ROLLBACK;/i.test(sql) || !/SET LOCAL statement_timeout = '5s';/i.test(sql)) fail("AUDIT_QUERY_NOT_READ_ONLY");
  if (/\b(?:INSERT|UPDATE|DELETE|TRUNCATE|CREATE|ALTER|DROP|GRANT|REVOKE|COMMIT)\b/i.test(sql)) fail("AUDIT_QUERY_MUTATION_FORBIDDEN");
  const actualSection = sql.slice(sql.indexOf("actual AS ("), sql.indexOf("SELECT jsonb_build_object"));
  if (!/WHERE left\(ae\.request_id, char_length\(p\.run_id\) \+ 1\) = p\.run_id \|\| '-'/i.test(actualSection)) fail("AUDIT_NAMESPACE_FILTER_INVALID");
  if (/WHERE[\s\S]*ae\.tenant_id\s*=\s*p\.tenant_id/i.test(actualSection)) fail("AUDIT_TENANT_PREFILTER_FORBIDDEN");
  if (!/FROM manual_mapping mm/i.test(sql) || !/mm\.id::text = ae\.resource_id/i.test(sql)) fail("AUDIT_MAPPING_IDENTITY_JOIN_MISSING");
  return sql;
}

export function buildAuditQueryPlan({ runId, folderId }) {
  validateRunId(runId);
  assertUuid(folderId, "AUDIT_FOLDER_ID_INVALID");
  assertAuditQueryReadOnly();
  return Object.freeze({
    databaseMode: "RUNNER_READ_ONLY",
    stdin: AUDIT_QUERY_SQL,
    variables: Object.freeze({ run_id: runId, folder_id: folderId }),
    expectedRows: 15
  });
}

const AUDIT_EVENT_KEYS = Object.freeze([
  "tenantId",
  "actorUserId",
  "actorSubject",
  "actorRoles",
  "requestId",
  "action",
  "resourceType",
  "resourceKey"
]);

function auditEvent(actorName, runId, suffix, action, resourceType, resourceKey) {
  const actor = ACTORS[actorName];
  return Object.freeze({
    tenantId: TENANT_ID,
    actorUserId: actor.userId,
    actorSubject: actor.subject,
    actorRoles: Object.freeze([actor.role]),
    requestId: `${runId}-${suffix}`,
    action,
    resourceType,
    resourceKey
  });
}

export function expectedAuditEvents({ runId, folderId, importId, workpaperId, documentId, exportPackId }) {
  validateRunId(runId);
  for (const [name, value] of Object.entries({ folderId, importId, workpaperId, documentId, exportPackId })) assertUuid(value, `AUDIT_${name.toUpperCase()}_INVALID`);
  const events = [
    auditEvent("ACCOUNTANT", runId, "T04-CREATE-FOLDER", "CLOSING_FOLDER.CREATED", "CLOSING_FOLDER", folderId),
    auditEvent("ACCOUNTANT", runId, "T05-IMPORT-BALANCE", "BALANCE_IMPORT.CREATED", "BALANCE_IMPORT", importId),
    ...MAPPINGS.map((mapping) => auditEvent("ACCOUNTANT", runId, `T06-MAP-${mapping.accountCode}`, "MANUAL_MAPPING.CREATED", "MANUAL_MAPPING", `${mapping.accountCode}->${mapping.targetCode}`)),
    auditEvent("ACCOUNTANT", runId, "T08-CREATE-WORKPAPER", "WORKPAPER.CREATED", "WORKPAPER", workpaperId),
    auditEvent("ACCOUNTANT", runId, "T09-UPLOAD-DOCUMENT", "DOCUMENT.CREATED", "DOCUMENT", documentId),
    auditEvent("ACCOUNTANT", runId, "T10-READY-WORKPAPER", "WORKPAPER.UPDATED", "WORKPAPER", workpaperId),
    auditEvent("REVIEWER", runId, "T12-VERIFY-DOCUMENT", "DOCUMENT.VERIFICATION_UPDATED", "DOCUMENT", documentId),
    auditEvent("REVIEWER", runId, "T13-REVIEW-WORKPAPER", "WORKPAPER.REVIEW_STATUS_CHANGED", "WORKPAPER", workpaperId),
    auditEvent("ACCOUNTANT", runId, "T14-CREATE-EXPORT", "EXPORT_PACK.CREATED", "EXPORT_PACK", exportPackId)
  ];
  if (events.length !== 15) fail("AUDIT_EXPECTED_CARDINALITY_INVALID");
  return Object.freeze(events);
}

export function validateAuditEvent(event) {
  assertClosedKeys(event, AUDIT_EVENT_KEYS, "AUDIT_EVENT_SCHEMA_INVALID");
  assertUuid(event.tenantId, "AUDIT_EVENT_TENANT_INVALID");
  assertUuid(event.actorUserId, "AUDIT_EVENT_ACTOR_INVALID");
  assertString(event.actorSubject, "AUDIT_EVENT_SUBJECT_INVALID");
  if (!Array.isArray(event.actorRoles) || event.actorRoles.length !== 1 || typeof event.actorRoles[0] !== "string" || !/^[A-Z][A-Z0-9_]{0,63}$/.test(event.actorRoles[0])) fail("AUDIT_EVENT_ROLES_INVALID");
  assertString(event.requestId, "AUDIT_EVENT_REQUEST_ID_INVALID", { pattern: /^r[12]-[0-9]{8}t[0-9]{6}z-[0-9a-f]{12}-[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/ });
  assertString(event.action, "AUDIT_EVENT_ACTION_INVALID", { pattern: /^[A-Z_]+\.[A-Z_]+$/ });
  assertString(event.resourceType, "AUDIT_EVENT_RESOURCE_TYPE_INVALID", { pattern: /^[A-Z_]+$/ });
  assertString(event.resourceKey, "AUDIT_EVENT_RESOURCE_KEY_INVALID");
  return event;
}

export function parseAuditRows(text) {
  if (typeof text !== "string" || Buffer.byteLength(text, "utf8") > 1024 * 1024 || text.charCodeAt(0) === 0xfeff || text.includes("\r")) fail("AUDIT_OUTPUT_INVALID");
  const payload = text.endsWith("\n") ? text.slice(0, -1) : text;
  if (payload.length === 0) return Object.freeze([]);
  const lines = payload.split("\n");
  if (lines.length > 1000 || lines.some((line) => line.length === 0 || Buffer.byteLength(line, "utf8") > 65536)) fail("AUDIT_OUTPUT_CARDINALITY_INVALID");
  return Object.freeze(lines.map((line) => {
    const event = parseJsonStrict(line);
    validateAuditEvent(event);
    return event;
  }));
}

function auditMultisetKey(event) {
  validateAuditEvent(event);
  return canonicalJson(event);
}

export function compareAuditMultiset(expected, actual) {
  if (!Array.isArray(expected) || !Array.isArray(actual)) fail("AUDIT_MULTISET_INPUT_INVALID");
  expected.forEach(validateAuditEvent);
  actual.forEach(validateAuditEvent);
  const missingCounts = new Map();
  const unexpectedCounts = new Map();
  for (const event of expected) {
    const key = auditMultisetKey(event);
    missingCounts.set(key, (missingCounts.get(key) ?? 0) + 1);
  }
  for (const event of actual) {
    const key = auditMultisetKey(event);
    const remaining = missingCounts.get(key) ?? 0;
    if (remaining > 0) missingCounts.set(key, remaining - 1);
    else unexpectedCounts.set(key, (unexpectedCounts.get(key) ?? 0) + 1);
  }
  const missingCount = [...missingCounts.values()].reduce((sum, count) => sum + count, 0);
  const unexpectedCount = [...unexpectedCounts.values()].reduce((sum, count) => sum + count, 0);
  return Object.freeze({
    expectedCount: expected.length,
    missingCount,
    unexpectedCount,
    actualCount: actual.length,
    status: expected.length === 15 && missingCount === 0 && unexpectedCount === 0 && actual.length === 15
      ? "PASS_15_EXPECTED_0_MISSING_0_UNEXPECTED"
      : "FAIL"
  });
}

export function assertAuditMultiset(expected, actual) {
  const result = compareAuditMultiset(expected, actual);
  if (result.status !== "PASS_15_EXPECTED_0_MISSING_0_UNEXPECTED") fail("AUDIT_MULTISET_MISMATCH", result);
  return result;
}

export const SUMMARY_KEYS = Object.freeze([
  "schemaVersion",
  "protocolId",
  "run",
  "runId",
  "tenantId",
  "environment",
  "commandEvidence",
  "reviewEvidence",
  "authorizationEvidence",
  "resources",
  "actors",
  "fixtures",
  "runAttempt",
  "tasks",
  "audit",
  "export",
  "usefulness",
  "cleanup",
  "status",
  "failureCode",
  "startedAtUtc",
  "endedAtUtc"
]);

const SUMMARY_NESTED_KEYS = Object.freeze({
  commandEvidence: Object.freeze(["orchestratorSha256", "repository", "head", "proposalSha256", "commandBindingSha256"]),
  reviewEvidence: Object.freeze(["recordId", "sha256", "status"]),
  authorizationEvidence: Object.freeze(["recordId", "sha256", "status", "consumedAtUtc"]),
  resources: Object.freeze(["dbName", "roleName", "runtimeRootSha256", "storageRootSha256", "evidenceRootSha256"]),
  runAttempt: Object.freeze(["engaged", "startedAtUtc"]),
  audit: Object.freeze(["expectedCount", "missingCount", "unexpectedCount", "actualCount", "status"]),
  export: Object.freeze(["exportPackId", "fileName", "byteSize", "sha256", "contentVerified"]),
  cleanup: Object.freeze(["status", "completedSteps", "residuals"])
});

export function buildRunSummary(input) {
  assertClosedKeys(input, SUMMARY_KEYS, "EVIDENCE_SUMMARY_SCHEMA_INVALID");
  const summary = {};
  for (const key of SUMMARY_KEYS) summary[key] = sortRecursively(input[key]);
  validateRunSummary(summary);
  return summary;
}

export function validateRunSummary(summary) {
  assertExactKeys(summary, SUMMARY_KEYS, "EVIDENCE_SUMMARY_SCHEMA_INVALID");
  if (summary.schemaVersion !== SUMMARY_SCHEMA_VERSION || summary.protocolId !== PROTOCOL_ID || summary.tenantId !== TENANT_ID || summary.environment !== ENVIRONMENT) fail("EVIDENCE_SUMMARY_SCOPE_INVALID");
  validateRun(summary.run);
  validateRunId(summary.runId, summary.run);
  for (const [name, keys] of Object.entries(SUMMARY_NESTED_KEYS)) assertClosedKeys(summary[name], keys, `EVIDENCE_${name.toUpperCase()}_INVALID`);
  for (const hash of [summary.commandEvidence.orchestratorSha256, summary.commandEvidence.proposalSha256, summary.commandEvidence.commandBindingSha256, summary.reviewEvidence.sha256, summary.authorizationEvidence.sha256, summary.resources.runtimeRootSha256, summary.resources.storageRootSha256, summary.resources.evidenceRootSha256]) {
    assertString(hash, "EVIDENCE_HASH_INVALID", { pattern: SHA256_REGEX });
  }
  assertString(summary.commandEvidence.head, "EVIDENCE_HEAD_INVALID", { pattern: GIT_SHA1_REGEX });
  if (summary.commandEvidence.repository !== REPOSITORY) fail("EVIDENCE_REPOSITORY_INVALID");
  assertString(summary.reviewEvidence.recordId, "EVIDENCE_REVIEW_INVALID", { pattern: /^043c-[a-z0-9][a-z0-9-]{6,95}$/ });
  if (summary.reviewEvidence.status !== "PASS") fail("EVIDENCE_REVIEW_INVALID");
  assertString(summary.authorizationEvidence.recordId, "EVIDENCE_AUTHORIZATION_INVALID", { pattern: /^043c-[a-z0-9][a-z0-9-]{6,95}$/ });
  if (!["YES", "CONSUMED"].includes(summary.authorizationEvidence.status)) fail("EVIDENCE_AUTHORIZATION_INVALID");
  if (summary.authorizationEvidence.status === "CONSUMED") assertUtcMilliseconds(summary.authorizationEvidence.consumedAtUtc, "EVIDENCE_AUTHORIZATION_TIME_INVALID");
  else if (summary.authorizationEvidence.consumedAtUtc !== null) fail("EVIDENCE_AUTHORIZATION_TIME_INVALID");
  quoteSqlIdentifier(summary.resources.dbName);
  quoteSqlIdentifier(summary.resources.roleName);
  if (!Array.isArray(summary.actors) || summary.actors.length !== 2) fail("EVIDENCE_ACTORS_INVALID");
  summary.actors.forEach((actor, index) => {
    assertClosedKeys(actor, ["role", "userId", "subject"], "EVIDENCE_ACTOR_INVALID");
    const expected = ACTORS[index === 0 ? "ACCOUNTANT" : "REVIEWER"];
    if (actor.role !== expected.role || actor.userId !== expected.userId || actor.subject !== expected.subject) fail("EVIDENCE_ACTOR_INVALID");
  });
  if (!Array.isArray(summary.fixtures) || summary.fixtures.length !== 2) fail("EVIDENCE_FIXTURES_INVALID");
  summary.fixtures.forEach((fixture, index) => {
    assertClosedKeys(fixture, ["name", "byteSize", "sha256"], "EVIDENCE_FIXTURE_INVALID");
    const expected = index === 0 ? FIXTURES.balance : FIXTURES.evidence;
    if (fixture.name !== expected.fileName || fixture.byteSize !== expected.byteSize || fixture.sha256 !== expected.sha256) fail("EVIDENCE_FIXTURE_INVALID");
  });
  if (typeof summary.runAttempt.engaged !== "boolean") fail("EVIDENCE_RUN_ATTEMPT_INVALID");
  if (summary.runAttempt.engaged) assertUtcMilliseconds(summary.runAttempt.startedAtUtc, "EVIDENCE_RUN_ATTEMPT_INVALID");
  else if (summary.runAttempt.startedAtUtc !== null) fail("EVIDENCE_RUN_ATTEMPT_INVALID");
  if (!Array.isArray(summary.tasks) || summary.tasks.length !== 16) fail("EVIDENCE_TASKS_INVALID");
  summary.tasks.forEach((task, index) => {
    assertClosedKeys(task, ["taskId", "status", "failureCode"], "EVIDENCE_TASK_INVALID");
    if (task.taskId !== TASK_IDS[index] || !TASK_STATUSES.includes(task.status)) fail("EVIDENCE_TASK_INVALID");
    if ((task.status === "FAIL") !== (typeof task.failureCode === "string" && STABLE_ERROR_CODE.test(task.failureCode))) fail("EVIDENCE_TASK_FAILURE_INVALID");
    if (task.status !== "FAIL" && task.failureCode !== null) fail("EVIDENCE_TASK_FAILURE_INVALID");
  });
  if (summary.runAttempt.engaged) {
    if (summary.tasks[0].status !== "PASS") fail("EVIDENCE_TASK_SEQUENCE_INVALID");
    let terminalSeen = false;
    let failureSeen = false;
    for (const task of summary.tasks.slice(1, 15)) {
      if (terminalSeen && task.status !== "NOT_REACHED") fail("EVIDENCE_TASK_SEQUENCE_INVALID");
      if (task.status === "FAIL") {
        if (failureSeen) fail("EVIDENCE_TASK_SEQUENCE_INVALID");
        failureSeen = true;
        terminalSeen = true;
      } else if (task.status === "NOT_REACHED") terminalSeen = true;
    }
  } else if (!["FAIL", "NOT_REACHED"].includes(summary.tasks[0].status) || summary.tasks.slice(1, 15).some((task) => task.status !== "NOT_REACHED")) fail("EVIDENCE_PREFLIGHT_TASK_SEQUENCE_INVALID");
  const audit = summary.audit;
  for (const name of ["expectedCount", "missingCount", "unexpectedCount", "actualCount"]) assertInteger(audit[name], "EVIDENCE_AUDIT_INVALID", { minimum: 0 });
  if (!["PASS_15_EXPECTED_0_MISSING_0_UNEXPECTED", "FAIL", "NOT_REACHED"].includes(audit.status)) fail("EVIDENCE_AUDIT_INVALID");
  const exactAuditPass = audit.expectedCount === 15 && audit.missingCount === 0 && audit.unexpectedCount === 0 && audit.actualCount === 15;
  if (audit.status !== "NOT_REACHED" && (audit.missingCount > audit.expectedCount || audit.unexpectedCount > audit.actualCount || audit.actualCount !== audit.expectedCount - audit.missingCount + audit.unexpectedCount)) fail("EVIDENCE_AUDIT_CONTRADICTION");
  if ((audit.status === "PASS_15_EXPECTED_0_MISSING_0_UNEXPECTED") !== exactAuditPass && audit.status !== "NOT_REACHED") fail("EVIDENCE_AUDIT_CONTRADICTION");
  if (audit.status === "NOT_REACHED" && [audit.expectedCount, audit.missingCount, audit.unexpectedCount, audit.actualCount].some((count) => count !== 0)) fail("EVIDENCE_AUDIT_CONTRADICTION");
  if (audit.status !== "NOT_REACHED" && (audit.expectedCount !== 15 || summary.tasks[14].status !== "PASS")) fail("EVIDENCE_AUDIT_TASK_CONTRADICTION");
  const exportEvidence = summary.export;
  if (exportEvidence.exportPackId !== null) assertUuid(exportEvidence.exportPackId, "EVIDENCE_EXPORT_INVALID");
  if (exportEvidence.fileName !== null) assertString(exportEvidence.fileName, "EVIDENCE_EXPORT_INVALID");
  if (exportEvidence.byteSize !== null) assertInteger(exportEvidence.byteSize, "EVIDENCE_EXPORT_INVALID", { minimum: 1 });
  if (exportEvidence.sha256 !== null) assertString(exportEvidence.sha256, "EVIDENCE_EXPORT_INVALID", { pattern: SHA256_REGEX });
  if (typeof exportEvidence.contentVerified !== "boolean") fail("EVIDENCE_EXPORT_INVALID");
  const exportFieldsPresent = [exportEvidence.exportPackId, exportEvidence.fileName, exportEvidence.byteSize, exportEvidence.sha256].every((value) => value !== null);
  const exportFieldsAbsent = [exportEvidence.exportPackId, exportEvidence.fileName, exportEvidence.byteSize, exportEvidence.sha256].every((value) => value === null);
  if ((!exportFieldsPresent && !exportFieldsAbsent) || exportEvidence.contentVerified !== exportFieldsPresent) fail("EVIDENCE_EXPORT_CONTRADICTION");
  if (exportFieldsPresent && summary.tasks[14].status !== "PASS") fail("EVIDENCE_EXPORT_TASK_CONTRADICTION");
  if (summary.usefulness !== null) {
    validateUsefulness(summary.usefulness);
    if (audit.status !== "PASS_15_EXPECTED_0_MISSING_0_UNEXPECTED") fail("EVIDENCE_USEFULNESS_CONTRADICTION");
  }
  if (!["NOT_STARTED", "COMPLETE", "PARTIAL"].includes(summary.cleanup.status) || !Array.isArray(summary.cleanup.completedSteps) || !Array.isArray(summary.cleanup.residuals)) fail("EVIDENCE_CLEANUP_INVALID");
  if (summary.cleanup.completedSteps.some((step, index) => step !== CLEANUP_STEPS[index]) || new Set(summary.cleanup.completedSteps).size !== summary.cleanup.completedSteps.length || summary.cleanup.residuals.some((item) => typeof item !== "string" || !/^[A-Z][A-Z0-9_]{0,95}:[A-Z][A-Z0-9_]{0,95}$/.test(item))) fail("EVIDENCE_CLEANUP_INVALID");
  if (summary.cleanup.status === "COMPLETE" && (summary.cleanup.completedSteps.length !== CLEANUP_STEPS.length || summary.cleanup.residuals.length !== 0)) fail("EVIDENCE_CLEANUP_CONTRADICTION");
  if (summary.cleanup.status === "PARTIAL" && summary.cleanup.residuals.length === 0) fail("EVIDENCE_CLEANUP_CONTRADICTION");
  if (summary.cleanup.status === "NOT_STARTED" && (summary.cleanup.completedSteps.length !== 0 || summary.cleanup.residuals.length !== 0)) fail("EVIDENCE_CLEANUP_CONTRADICTION");
  if (!RUN_RESULTS.includes(summary.status)) fail("EVIDENCE_RESULT_INVALID");
  if (summary.failureCode !== null && (typeof summary.failureCode !== "string" || !STABLE_ERROR_CODE.test(summary.failureCode))) fail("EVIDENCE_FAILURE_CODE_INVALID");
  assertUtcMilliseconds(summary.startedAtUtc, "EVIDENCE_START_TIME_INVALID");
  assertUtcMilliseconds(summary.endedAtUtc, "EVIDENCE_END_TIME_INVALID");
  if (Date.parse(summary.endedAtUtc) < Date.parse(summary.startedAtUtc)) fail("EVIDENCE_TIME_ORDER_INVALID");
  const materiallyComplete = summary.runAttempt.engaged && summary.tasks.slice(0, 15).every((task) => task.status === "PASS") && audit.status === "PASS_15_EXPECTED_0_MISSING_0_UNEXPECTED" && summary.cleanup.status === "COMPLETE" && summary.authorizationEvidence.status === "CONSUMED" && summary.export.contentVerified && summary.usefulness !== null;
  const declaredComplete = summary.status === "COMPLETED" && summary.tasks[15].status === "PASS" && summary.failureCode === null;
  if (materiallyComplete !== declaredComplete) fail("EVIDENCE_COMPLETION_BIDIRECTIONAL_MISMATCH");
  if (summary.status === "COMPLETED") {
    if (!summary.runAttempt.engaged || summary.tasks.some((task) => task.status !== "PASS") || audit.status !== "PASS_15_EXPECTED_0_MISSING_0_UNEXPECTED" || summary.cleanup.status !== "COMPLETE" || summary.failureCode !== null || summary.authorizationEvidence.status !== "CONSUMED" || !summary.export.contentVerified || summary.usefulness === null) fail("EVIDENCE_COMPLETION_CONTRADICTION");
  }
  if (summary.status === "INCOMPLETE" && (!summary.runAttempt.engaged || typeof summary.failureCode !== "string" || summary.authorizationEvidence.status !== "CONSUMED" || summary.tasks[15].status !== "FAIL" || summary.tasks[15].failureCode !== summary.failureCode)) fail("EVIDENCE_INCOMPLETE_CONTRADICTION");
  if (summary.status === "PRE_EXECUTION_PREFLIGHT_FAILURE" && (summary.runAttempt.engaged || typeof summary.failureCode !== "string" || summary.authorizationEvidence.status !== "YES" || summary.tasks[15].status !== "FAIL" || summary.tasks[15].failureCode !== summary.failureCode || audit.status !== "NOT_REACHED" || exportFieldsPresent || summary.usefulness !== null)) fail("EVIDENCE_PREFLIGHT_CONTRADICTION");
  assertNoSensitiveEvidence(summary);
  return summary;
}

export function serializeRunSummary(summary) {
  validateRunSummary(summary);
  const ordered = {};
  for (const key of SUMMARY_KEYS) ordered[key] = sortRecursively(summary[key]);
  const text = `${JSON.stringify(ordered)}\n`;
  if (text.charCodeAt(0) === 0xfeff || text.includes("\r") || !text.endsWith("\n") || text.endsWith("\n\n")) fail("EVIDENCE_SERIALIZATION_INVALID");
  const reparsed = parseJsonStrict(text);
  assertExactKeys(reparsed, SUMMARY_KEYS, "EVIDENCE_REPARSE_INVALID");
  if (canonicalJson(reparsed) !== canonicalJson(summary)) fail("EVIDENCE_REPARSE_INVALID");
  assertNoSensitiveEvidence(reparsed);
  return text;
}

export function buildSummaryChecksum(summaryBytes) {
  const bytes = Buffer.isBuffer(summaryBytes) ? summaryBytes : Buffer.from(summaryBytes, "utf8");
  const parsed = parseJsonStrict(bytes.toString("utf8"));
  validateRunSummary(parsed);
  if (!bytes.equals(Buffer.from(serializeRunSummary(parsed), "utf8"))) fail("EVIDENCE_SERIALIZATION_INVALID");
  return `${sha256Hex(bytes)}  run-summary.json\n`;
}

export function verifySummaryAndChecksum(summaryBytes, checksumText) {
  if (typeof checksumText !== "string" || checksumText !== `${sha256Hex(summaryBytes)}  run-summary.json\n`) fail("EVIDENCE_HASH_MISMATCH");
  const bytes = Buffer.from(summaryBytes);
  const parsed = parseJsonStrict(bytes.toString("utf8"));
  validateRunSummary(parsed);
  if (!bytes.equals(Buffer.from(serializeRunSummary(parsed), "utf8"))) fail("EVIDENCE_SERIALIZATION_INVALID");
  return parsed;
}

export const CLEANUP_STEPS = Object.freeze([
  "SHUTDOWN_HARNESS_AND_RELEASE_ACTOR_PORTS",
  "STOP_BACKEND_TREE_AND_RELEASE_BACKEND_PORT",
  "RETAIN_SANITIZED_EXPORT_AND_EVIDENCE",
  "VALIDATE_AND_REMOVE_EXACT_RUNTIME_ROOT",
  "REQUIRE_ZERO_DATABASE_SESSIONS",
  "DROP_EXACT_DATABASE_UNDER_OWNER",
  "REVOKE_MEMBERSHIP_AND_DROP_EXACT_ROLE",
  "VERIFY_DATABASE_AND_ROLE_ABSENT",
  "VERIFY_STORAGE_ABSENT_AND_PORTS_FREE",
  "FINALIZE_SUMMARY_REMOVE_STATE_AND_HASH"
]);

export function createCleanupPlan(state) {
  validateRecoveryState(state);
  return Object.freeze(CLEANUP_STEPS.map((id, index) => Object.freeze({
    index: index + 1,
    id,
    mode: RECOVERY_PHASE,
    ownershipMarker: state.ownershipMarker,
    runId: state.runId
  })));
}

function isCompletedR1Summary(summary) {
  return summary.run === "R1" && summary.status === "COMPLETED" && summary.tasks[15]?.status === "PASS" && summary.audit.status === "PASS_15_EXPECTED_0_MISSING_0_UNEXPECTED" && summary.cleanup.status === "COMPLETE" && summary.export.contentVerified === true && summary.usefulness !== null;
}

export function validateR1EvidenceArtifact(evidence) {
  assertClosedKeys(evidence, ["summaryBytes", "checksumText", "summarySha256", "absenceProof"], "R2_EVIDENCE_INVALID");
  if (!Buffer.isBuffer(evidence.summaryBytes) || typeof evidence.checksumText !== "string") fail("R2_EVIDENCE_INVALID");
  assertString(evidence.summarySha256, "R2_EVIDENCE_INVALID", { pattern: SHA256_REGEX });
  if (sha256Hex(evidence.summaryBytes) !== evidence.summarySha256) fail("R2_SUMMARY_HASH_MISMATCH");
  const summary = verifySummaryAndChecksum(evidence.summaryBytes, evidence.checksumText);
  if (!isCompletedR1Summary(summary)) fail("R2_SUMMARY_INELIGIBLE");
  assertClosedKeys(evidence.absenceProof, ["runId", "databaseAbsent", "roleAbsent", "runtimeAbsent", "storageAbsent", "recoveryStateAbsent", "portsFree", "exportRetained", "exactOwnershipChecked"], "R2_ABSENCE_PROOF_INVALID");
  validateRunId(evidence.absenceProof.runId, "R1");
  if (evidence.absenceProof.runId !== summary.runId || evidence.absenceProof.databaseAbsent !== true || evidence.absenceProof.roleAbsent !== true || evidence.absenceProof.runtimeAbsent !== true || evidence.absenceProof.storageAbsent !== true || evidence.absenceProof.recoveryStateAbsent !== true || evidence.absenceProof.exportRetained !== true || evidence.absenceProof.exactOwnershipChecked !== true || !Array.isArray(evidence.absenceProof.portsFree) || evidence.absenceProof.portsFree.join(",") !== PORTS.join(",")) fail("R2_ABSENCE_PROOF_INVALID");
  return Object.freeze({ summary, summarySha256: evidence.summarySha256 });
}

export function isR2Eligible(evidence) {
  try {
    validateR1EvidenceArtifact(evidence);
    return true;
  } catch {
    return false;
  }
}

export function assertRunSequence({ run, priorRunId = null, priorEvidence, engagedRuns }) {
  validateRun(run);
  if (!Array.isArray(engagedRuns) || engagedRuns.some((candidate) => !["R1", "R2"].includes(candidate))) fail("ENGAGED_RUNS_INVALID");
  if (engagedRuns.length > 2 || new Set(engagedRuns).size !== engagedRuns.length) fail("ENGAGED_RUNS_INVALID");
  if (engagedRuns.filter((candidate) => candidate === run).length > 0) fail(`${run}_ATTEMPT_ALREADY_ENGAGED`);
  if (run === "R1" && engagedRuns.length > 0) fail("R1_ATTEMPT_ALREADY_ENGAGED");
  if (run === "R2") {
    validateRunId(priorRunId, "R1");
    if (engagedRuns.includes("R2")) fail("R2_ATTEMPT_ALREADY_ENGAGED");
    let validatedEvidence;
    try {
      validatedEvidence = validateR1EvidenceArtifact(priorEvidence);
    } catch {
      fail("R2_INELIGIBLE");
    }
    if (validatedEvidence.summary.runId !== priorRunId) fail("R2_INELIGIBLE");
  }
  return true;
}

async function persistState(adapters, state, expectedPreviousHash) {
  const bytes = Buffer.from(serializeRecoveryState(state), "utf8");
  const result = await adapters.writeStateAtomic({
    path: state.resources.recoveryStatePath,
    bytes,
    expectedPreviousHash
  });
  assertClosedKeys(result, ["durable", "sha256"], "RECOVERY_STATE_PERSIST_RESULT_INVALID");
  if (result.durable !== true || result.sha256 !== sha256Hex(bytes)) fail("RECOVERY_STATE_PERSIST_FAILED");
  return result.sha256;
}

async function writeAheadEffect({ adapters, state, operation, effect, applyResult = undefined }) {
  const priorHash = sha256Hex(serializeRecoveryState(state));
  let next = setPendingOperation(state, operation);
  await persistState(adapters, next, priorHash);
  const durablePendingState = next;
  let result;
  try {
    result = await effect(next);
    const pendingHash = sha256Hex(serializeRecoveryState(next));
    next = completePendingOperation(next, { id: operation.id, nowUtc: adapters.now(), applyCompletion: applyResult === undefined ? undefined : (completedState) => applyResult(completedState, result) });
    await persistState(adapters, next, pendingHash);
    return Object.freeze({ state: next, result });
  } catch (error) {
    if (error !== null && typeof error === "object") error.recoveryState = durablePendingState;
    throw error;
  }
}

function assertCleanupProof(result, expected, code) {
  assertClosedKeys(result, Object.keys(expected), code);
  for (const [key, value] of Object.entries(expected)) {
    if (Array.isArray(value)) {
      if (!Array.isArray(result[key]) || result[key].length !== value.length || result[key].some((item, index) => item !== value[index])) fail(code);
    } else if (result[key] !== value) fail(code);
  }
  return result;
}

export function exportPersistenceIdentity({ path: exportPath, exportPackId, fileName, byteSize, sha256 }) {
  assertString(exportPath, "EXPORT_PATH_INVALID");
  assertString(exportPackId, "EXPORT_PACK_ID_INVALID", { pattern: UUID_REGEX });
  assertString(fileName, "EXPORT_FILE_NAME_INVALID", { pattern: /^closing-folder-[0-9a-f-]{36}-export-pack-[0-9a-f-]{36}\.zip$/ });
  assertInteger(byteSize, "EXPORT_BYTE_SIZE_INVALID", { minimum: 1 });
  assertString(sha256, "EXPORT_HASH_INVALID", { pattern: SHA256_REGEX });
  return sha256Hex(canonicalJson({ path: exportPath, exportPackId, fileName, byteSize, sha256 }));
}

export function validatePreservedExportResult(result, { expectedExportPackId, expectedFileName, expectedSha256, expectedByteSize }) {
  return assertCleanupProof(result, { durable: true, exportPackId: expectedExportPackId, fileName: expectedFileName, sha256: expectedSha256, byteSize: expectedByteSize }, "EXPORT_PERSISTENCE_PROOF_INVALID");
}

export async function executeCleanup({ state, adapters, finalizeSummary }) {
  validateRecoveryState(state);
  assertAdapterMethods(adapters, CLEANUP_ADAPTER_METHODS);
  if (state.cleanup.status === "COMPLETE") fail("RUN_ALREADY_CONSUMED");
  let current = structuredClone(state);
  const resumingFinalization = current.cleanup.status === "FINALIZING";
  if (!resumingFinalization) {
    const cleanupPreviousHash = sha256Hex(serializeRecoveryState(current));
    current.cleanup.status = "IN_PROGRESS";
    current.cleanup.residuals = [];
    current.updatedAtUtc = adapters.now();
    await persistState(adapters, current, cleanupPreviousHash);
  }
  if (current.pendingOperation !== null && !CLEANUP_STEPS.includes(current.pendingOperation.id)) {
    const pendingHash = sha256Hex(serializeRecoveryState(current));
    current = completePendingOperation(current, { id: current.pendingOperation.id, nowUtc: adapters.now() });
    await persistState(adapters, current, pendingHash);
  }
  const residuals = [];
  let halted = false;
  if (current.processes.length > 0) {
    try {
      const identityInspection = await adapters.inspectProcessIdentities({ expected: current.processes.map((descriptor) => ({ ...descriptor })) });
      assertClosedKeys(identityInspection, ["observed", "absentLabels"], "PROCESS_IDENTITY_INSPECTION_INVALID");
      if (!Array.isArray(identityInspection.observed) || !Array.isArray(identityInspection.absentLabels)) fail("PROCESS_IDENTITY_INSPECTION_INVALID");
      const expectedLabels = current.processes.map((descriptor) => descriptor.label);
      const observedLabels = identityInspection.observed.map((descriptor) => descriptor?.label);
      if (new Set(observedLabels).size !== observedLabels.length || new Set(identityInspection.absentLabels).size !== identityInspection.absentLabels.length || [...observedLabels, ...identityInspection.absentLabels].length !== expectedLabels.length || expectedLabels.some((label) => !observedLabels.includes(label) && !identityInspection.absentLabels.includes(label))) fail("PROCESS_IDENTITY_INSPECTION_INVALID");
      for (const expectedDescriptor of current.processes) {
        if (identityInspection.absentLabels.includes(expectedDescriptor.label)) continue;
        const observedDescriptor = identityInspection.observed.find((descriptor) => descriptor.label === expectedDescriptor.label);
        if (observedDescriptor === undefined) fail("PROCESS_IDENTITY_INSPECTION_INVALID");
        assertProcessIdentity(expectedDescriptor, observedDescriptor);
      }
    } catch (error) {
      residuals.push(`PROCESS_IDENTITY_PREFLIGHT:${normalizeFailure(error, "PROCESS_IDENTITY_OR_PID_REUSE").code}`);
      halted = true;
    }
  }
  async function step(id, target, effect, validateResult = (value) => value, applyCleanupResult = (stateValue) => stateValue) {
    if (halted) return undefined;
    try {
      if (current.cleanup.completedSteps.includes(id)) {
        if ([CLEANUP_STEPS[4], CLEANUP_STEPS[7], CLEANUP_STEPS[8]].includes(id)) return validateResult(await effect(current));
        return undefined;
      }
      let outcome;
      const expectedIdentity = sha256Hex(`${current.ownershipMarker}:${id}:${target}`);
      if (current.pendingOperation !== null) {
        if (current.pendingOperation.id !== id || current.pendingOperation.target !== target || current.pendingOperation.expectedIdentity !== expectedIdentity) fail("RECOVERY_PENDING_OPERATION_MISMATCH");
        const result = validateResult(await effect(current));
        const priorHash = sha256Hex(serializeRecoveryState(current));
        const completed = completePendingOperation(current, { id, nowUtc: adapters.now(), applyCompletion: (completedState) => {
          completedState.cleanup.completedSteps.push(id);
          return applyCleanupResult(completedState, result);
        } });
        await persistState(adapters, completed, priorHash);
        outcome = { state: completed, result };
      } else {
        outcome = await writeAheadEffect({
          adapters,
          state: current,
          operation: { id, target, expectedIdentity, nowUtc: adapters.now() },
          effect: async (pendingState) => validateResult(await effect(pendingState)),
          applyResult: (completedState, result) => {
            completedState.cleanup.completedSteps.push(id);
            return applyCleanupResult(completedState, result);
          }
        });
      }
      current = structuredClone(outcome.state);
      return outcome.result;
    } catch (error) {
      if (error?.recoveryState !== undefined) current = error.recoveryState;
      const failureValue = normalizeFailure(error, "CLEANUP_STEP_FAILED");
      residuals.push(`${id}:${failureValue.code}`);
      halted = true;
      return undefined;
    }
  }
  const markerHash = sha256Hex(current.ownershipMarker);
  const harnessRootPresent = current.processes.some((descriptor) => descriptor.label === "TWO_ACTOR_HARNESS");
  const backendRootPresent = current.processes.some((descriptor) => descriptor.label === "BACKEND_GRADLE");
  const seedProcesses = current.processes.filter((descriptor) => descriptor.label === "DEMO_SEED");
  const harnessProcesses = harnessRootPresent ? leafFirstShutdownOrder(ownedProcessSubtree(current.processes, "TWO_ACTOR_HARNESS")) : [];
  const backendOwned = [...seedProcesses, ...(backendRootPresent ? ownedProcessSubtree(current.processes, "BACKEND_GRADLE") : [])];
  const backendProcesses = backendOwned.length > 0 ? leafFirstShutdownOrder(backendOwned) : [];
  await step(CLEANUP_STEPS[0], "HARNESS", () => adapters.shutdownHarness({ state: current, processes: harnessProcesses, ports: [5173, 5174] }), (result) => assertCleanupProof(result, { stopped: true, releasedPorts: [5173, 5174], ownershipMarkerSha256: markerHash }, "HARNESS_SHUTDOWN_PROOF_INVALID"), (completedState) => {
    completedState.processes = completedState.processes.filter((descriptor) => !["TWO_ACTOR_HARNESS", "VITE_ACCOUNTANT", "VITE_REVIEWER"].includes(descriptor.label));
    return completedState;
  });
  await step(CLEANUP_STEPS[1], "BACKEND_TREE", () => adapters.stopBackendTree({ state: current, processes: backendProcesses, port: 8080 }), (result) => assertCleanupProof(result, { stopped: true, releasedPorts: [8080], ownershipMarkerSha256: markerHash }, "BACKEND_SHUTDOWN_PROOF_INVALID"), (completedState) => {
    completedState.processes = [];
    return completedState;
  });
  await step(CLEANUP_STEPS[2], current.resources.exportPath, () => adapters.retainEvidence({ exportEvidence: current.exportEvidence, exportPath: current.resources.exportPath }), (result) => assertCleanupProof(result, { retained: true, exportSha256: current.exportEvidence?.sha256 ?? null }, "EVIDENCE_RETENTION_PROOF_INVALID"));
  await step(CLEANUP_STEPS[3], current.resources.runtimeRoot, () => adapters.removeRuntimeRoot({ path: current.resources.runtimeRoot, marker: current.ownershipMarker, runId: current.runId }), (result) => assertCleanupProof(result, { absent: true, pathSha256: sha256Hex(current.resources.runtimeRoot), ownershipMarkerSha256: markerHash }, "RUNTIME_REMOVAL_PROOF_INVALID"));
  const sessions = await step(CLEANUP_STEPS[4], current.resources.dbName, () => adapters.countDatabaseSessions({ dbName: current.resources.dbName, marker: current.ownershipMarker }));
  if (sessions !== undefined) {
    if (!Number.isSafeInteger(sessions) || sessions < 0) residuals.push(`${CLEANUP_STEPS[4]}:CATALOG_OUTPUT_INVALID`);
    else if (sessions !== 0) {
      residuals.push(`${CLEANUP_STEPS[4]}:CLEANUP_RESIDUAL_SESSIONS`);
      halted = true;
    }
  }
  if (sessions === 0) {
    await step(CLEANUP_STEPS[5], current.resources.dbName, () => adapters.dropDatabase({ dbName: current.resources.dbName, roleName: current.resources.roleName, marker: current.ownershipMarker }), (result) => assertCleanupProof(result, { absent: true, databaseName: current.resources.dbName, ownershipMarkerSha256: markerHash }, "DATABASE_DROP_PROOF_INVALID"));
    await step(CLEANUP_STEPS[6], current.resources.roleName, () => adapters.dropRole({ roleName: current.resources.roleName, marker: current.ownershipMarker }), (result) => assertCleanupProof(result, { absent: true, roleName: current.resources.roleName, ownershipMarkerSha256: markerHash }, "ROLE_DROP_PROOF_INVALID"));
  }
  await step(CLEANUP_STEPS[7], "POSTGRES_CATALOG", () => adapters.verifyCatalogAbsent({ dbName: current.resources.dbName, roleName: current.resources.roleName }), (result) => assertCleanupProof(result, { databaseAbsent: true, roleAbsent: true }, "CATALOG_ABSENCE_PROOF_INVALID"));
  await step(CLEANUP_STEPS[8], "FILESYSTEM_AND_PORTS", () => adapters.verifyFinalAbsence({ resources: current.resources, ports: PORTS }), (result) => assertCleanupProof(result, { runtimeAbsent: true, storageAbsent: true, portsFree: [...PORTS], evidenceRetained: true }, "FINAL_ABSENCE_PROOF_INVALID"));
  if (residuals.length > 0) {
    const priorHash = sha256Hex(serializeRecoveryState(current));
    current.cleanup.status = "PARTIAL";
    current.cleanup.residuals = [...new Set([...current.cleanup.residuals, ...residuals])];
    current.updatedAtUtc = adapters.now();
    await persistState(adapters, current, priorHash);
    return Object.freeze({ state: current, status: "PARTIAL", exitCode: 1, r2Eligible: false });
  }
  if (!resumingFinalization) {
    const finalizingPreviousHash = sha256Hex(serializeRecoveryState(current));
    current.cleanup.status = "FINALIZING";
    current.updatedAtUtc = adapters.now();
    await persistState(adapters, current, finalizingPreviousHash);
  }
  const completedState = structuredClone(current);
  completedState.cleanup.status = "COMPLETE";
  completedState.cleanup.residuals = [];
  completedState.cleanup.completedSteps.push(CLEANUP_STEPS[9]);
  const finalization = await finalizeSummary(completedState);
  assertClosedKeys(finalization, ["summaryBytes", "checksumText"], "EVIDENCE_FINALIZATION_INVALID");
  const verifiedSummary = verifySummaryAndChecksum(finalization.summaryBytes, finalization.checksumText);
  const summaryWrite = await adapters.writeSummaryAndChecksum({
    summaryPath: current.resources.summaryPath,
    summaryHashPath: current.resources.summaryHashPath,
    summaryBytes: finalization.summaryBytes,
    checksumText: finalization.checksumText
  });
  assertCleanupProof(summaryWrite, { durable: true, summarySha256: sha256Hex(finalization.summaryBytes), checksumSha256: sha256Hex(finalization.checksumText) }, "EVIDENCE_WRITE_PROOF_INVALID");
  const expectedStateSha256 = sha256Hex(serializeRecoveryState(current));
  const stateRemoval = await adapters.removeRecoveryState({ path: current.resources.recoveryStatePath, expectedSha256: expectedStateSha256 });
  assertCleanupProof(stateRemoval, { removed: true, removedSha256: expectedStateSha256 }, "RECOVERY_STATE_REMOVAL_PROOF_INVALID");
  const r2Eligible = isCompletedR1Summary(verifiedSummary);
  return Object.freeze({ state: completedState, status: "COMPLETE", exitCode: 0, r2Eligible });
}

const CLEANUP_ADAPTER_METHODS = Object.freeze([
  "now",
  "writeStateAtomic",
  "inspectProcessIdentities",
  "shutdownHarness",
  "stopBackendTree",
  "retainEvidence",
  "removeRuntimeRoot",
  "countDatabaseSessions",
  "dropDatabase",
  "dropRole",
  "verifyCatalogAbsent",
  "verifyFinalAbsence",
  "writeSummaryAndChecksum",
  "removeRecoveryState"
]);

function assertAdapterMethods(adapters, methods) {
  assertPlainObject(adapters, "ADAPTERS_INVALID");
  for (const method of methods) if (typeof adapters[method] !== "function") fail("ADAPTER_METHOD_MISSING", { method });
  return adapters;
}

export async function executeHttpTaskContract({ runId, requestAdapter, onRequest = async () => {}, onTask = async () => {} }) {
  validateRunId(runId);
  if (typeof requestAdapter !== "function" || typeof onRequest !== "function" || typeof onTask !== "function") fail("HTTP_TASK_ADAPTER_INVALID");
  const executionState = {
    folderId: undefined,
    importId: undefined,
    workpaperId: undefined,
    documentId: undefined,
    exportPackId: undefined,
    exportByteSize: undefined,
    exportSha256: undefined,
    exportBytes: undefined,
    priorWorkpaperStatus: undefined,
    priorDocumentStatus: undefined
  };
  const executedRequestIds = new Set();
  for (let taskNumber = 3; taskNumber <= 14; taskNumber += 1) {
    const taskId = `T${String(taskNumber).padStart(2, "0")}`;
    let descriptors = buildTaskDescriptors({
      runId,
      folderId: executionState.folderId ?? "{folderId}",
      documentId: executionState.documentId ?? "{documentId}",
      exportPackId: executionState.exportPackId ?? "{exportPackId}"
    }).find((task) => task.taskId === taskId).requests;
    for (let index = 0; index < descriptors.length; index += 1) {
      if (taskId === "T14" && index === 1) {
        descriptors = buildTaskDescriptors({ runId, folderId: executionState.folderId, documentId: executionState.documentId, exportPackId: executionState.exportPackId }).find((task) => task.taskId === taskId).requests;
      }
      const spec = descriptors[index];
      if (executedRequestIds.has(spec.requestId)) fail("REQUEST_RETRY_FORBIDDEN", { taskId });
      executedRequestIds.add(spec.requestId);
      await onRequest({ stage: "BEFORE", taskId, index, spec });
      const response = await requestAdapter(spec);
      validateTaskResponse(spec, response, executionState);
      if (spec.responseContract === "EXPORT_CONTENT") executionState.exportBytes = Buffer.from(response.bytes);
      await onRequest({ stage: "AFTER", taskId, index, spec });
    }
    await onTask({ taskId, status: "PASS" });
  }
  return Object.freeze({ ...executionState, executedRequestIds: Object.freeze([...executedRequestIds]) });
}

const PROPOSE_ADAPTER_METHODS = Object.freeze([
  "now",
  "randomBytes",
  "inspectProposalContext",
  "emit"
]);

const ORCHESTRATOR_ADAPTER_METHODS = Object.freeze([
  "inspectRunContext",
  "readRecoveryState",
  "inspectPreflight",
  "validateRecoveryResources",
  "readBoundRecords",
  "scanEngagedRuns",
  "readR1Evidence",
  "readSensitiveRuntimeInputs",
  "inspectPostgresAdmin",
  "writeStateAtomic",
  "provisionResources",
  "startRuntime",
  "validateFreshResources",
  "validateFixtures",
  "engageAttemptAtomic",
  "request",
  "queryAudit",
  "chooseUsefulness",
  "preserveExport",
  "inspectProcessIdentities",
  "shutdownHarness",
  "stopBackendTree",
  "retainEvidence",
  "removeRuntimeRoot",
  "countDatabaseSessions",
  "dropDatabase",
  "dropRole",
  "verifyCatalogAbsent",
  "verifyFinalAbsence",
  "writeSummaryAndChecksum",
  "removeRecoveryState",
  "emit",
  "now",
  "randomBytes"
]);

function validateInspectionFixtures(fixtures) {
  assertClosedKeys(fixtures, ["balance", "evidence"], "FIXTURE_INSPECTIONS_INVALID");
  for (const name of ["balance", "evidence"]) {
    assertClosedKeys(fixtures[name], ["fileName", "byteSize", "sha256"], "FIXTURE_INSPECTION_INVALID");
    const expected = FIXTURES[name];
    if (fixtures[name].fileName !== expected.fileName || fixtures[name].byteSize !== expected.byteSize || fixtures[name].sha256 !== expected.sha256) fail("FIXTURE_HASH_OR_SIZE_MISMATCH", { name });
  }
  return fixtures;
}

const RUNTIME_INSTRUMENTATION = {
  readOnlyAdapterFactories: 0,
  realFilesystemReads: 0,
  realOutputWrites: 0,
  realNetworkCalls: 0,
  realChildProcesses: 0,
  realPostgresCalls: 0,
  realFilesystemMutations: 0
};

export function runtimeInstrumentationSnapshot() {
  return Object.freeze({ ...RUNTIME_INSTRUMENTATION });
}

async function readControlledBytes(filePath, maximumBytes = 32 * 1024 * 1024) {
  assertString(filePath, "READ_ONLY_PATH_INVALID");
  if (!path.isAbsolute(filePath) || filePath.startsWith("\\\\") || WINDOWS_DEVICE_PATH.test(filePath) || filePath.includes("/")) fail("READ_ONLY_PATH_INVALID");
  RUNTIME_INSTRUMENTATION.realFilesystemReads += 1;
  const metadata = await lstat(filePath);
  if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.size < 1 || metadata.size > maximumBytes) fail("READ_ONLY_FILE_INVALID");
  const canonical = await realpath(filePath);
  if (path.normalize(canonical).toLowerCase() !== path.normalize(filePath).toLowerCase()) fail("READ_ONLY_FILE_REPARSE_OR_ESCAPE");
  const bytes = await readFile(filePath);
  if (bytes.length !== metadata.size) fail("READ_ONLY_FILE_CHANGED_DURING_INSPECTION");
  return bytes;
}

export function extractWindowsFileVersion(executableBytes) {
  const bytes = Buffer.from(executableBytes);
  for (const key of ["ProductVersion\0", "FileVersion\0"]) {
    const needle = Buffer.from(key, "utf16le");
    const keyOffset = bytes.indexOf(needle);
    if (keyOffset < 0) continue;
    const scanStart = keyOffset + needle.length;
    const scanEnd = Math.min(bytes.length - 2, scanStart + 512);
    for (let offset = scanStart + (scanStart % 2); offset <= scanEnd; offset += 2) {
      const first = bytes.readUInt16LE(offset);
      if (first < 0x30 || first > 0x39) continue;
      let value = "";
      for (let cursor = offset; cursor <= scanEnd; cursor += 2) {
        const codeUnit = bytes.readUInt16LE(cursor);
        if (codeUnit === 0) break;
        if (codeUnit < 0x20 || codeUnit > 0x7e) {
          value = "";
          break;
        }
        value += String.fromCharCode(codeUnit);
      }
      const match = /^(\d+)(?:[., ]+(\d+))(?:[., ]+(\d+))?(?:[., ]+(\d+))?/.exec(value);
      if (match !== null) return match.slice(1).filter((part) => part !== undefined).join(".");
    }
  }
  fail("WINDOWS_FILE_VERSION_METADATA_INVALID");
}

async function readGitHeadWithoutProcess(repositoryRoot) {
  const gitHeadPath = path.join(repositoryRoot, ".git", "HEAD");
  const headText = (await readControlledBytes(gitHeadPath, 1024)).toString("ascii").trim();
  if (GIT_SHA1_REGEX.test(headText)) return headText;
  const match = /^ref: (refs\/[a-zA-Z0-9._\/-]+)$/.exec(headText);
  if (match === null || match[1].includes("..")) fail("GIT_HEAD_INVALID");
  const looseRefPath = path.join(repositoryRoot, ".git", ...match[1].split("/"));
  try {
    const loose = (await readControlledBytes(looseRefPath, 1024)).toString("ascii").trim();
    assertString(loose, "GIT_HEAD_INVALID", { pattern: GIT_SHA1_REGEX });
    return loose;
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
    const packedText = (await readControlledBytes(path.join(repositoryRoot, ".git", "packed-refs"), 4 * 1024 * 1024)).toString("utf8");
    const line = packedText.split(/\r?\n/).find((candidate) => candidate.endsWith(` ${match[1]}`));
    const packed = line?.split(" ", 1)[0];
    assertString(packed, "GIT_HEAD_INVALID", { pattern: GIT_SHA1_REGEX });
    return packed;
  }
}

async function inspectFixedLocalRoot(localAppData, systemDrive) {
  validateLocalAppDataRoot(localAppData);
  assertString(systemDrive, "SYSTEM_DRIVE_INVALID", { pattern: /^[A-Z]:$/ });
  if (path.parse(localAppData).root.slice(0, 2) !== systemDrive) fail("LOCAL_APP_DATA_NOT_SYSTEM_FIXED_DRIVE");
  const root = path.parse(localAppData).root;
  const relativeParts = path.relative(root, localAppData).split("\\").filter(Boolean);
  let current = root;
  for (const part of relativeParts) {
    current = path.join(current, part);
    RUNTIME_INSTRUMENTATION.realFilesystemReads += 1;
    const metadata = await lstat(current);
    if (!metadata.isDirectory() || metadata.isSymbolicLink()) fail("LOCAL_APP_DATA_REPARSE_OR_TYPE_INVALID");
    const canonical = await realpath(current);
    if (path.normalize(canonical).toLowerCase() !== path.normalize(current).toLowerCase()) fail("LOCAL_APP_DATA_REPARSE_OR_ESCAPE");
  }
  return Object.freeze({ driveType: "FIXED", canonicalPath: localAppData, reparse: false });
}

async function inspectReadOnlyProposalContext(localAppData, systemDrive, javaHome) {
  const modulePath = fileURLToPath(import.meta.url);
  const repositoryRoot = path.dirname(path.dirname(modulePath));
  const expectedModulePath = path.join(repositoryRoot, "runbooks", "invoke-controlled-fiduciary-pilot-043c.mjs");
  if (path.normalize(modulePath).toLowerCase() !== path.normalize(expectedModulePath).toLowerCase()) fail("ORCHESTRATOR_LOCATION_INVALID");
  const localAppDataMetadata = await inspectFixedLocalRoot(localAppData, systemDrive);
  validateLocalAppDataRoot(localAppData, localAppDataMetadata);
  const nodePath = path.normalize(process.execPath);
  const psqlPath = LOCAL_PSQL_PATH;
  assertString(javaHome, "JAVA_HOME_INVALID");
  const javaPath = path.join(javaHome, "bin", "java.exe");
  const cmdPath = "C:\\Windows\\System32\\cmd.exe";
  const gradleWrapperPath = path.join(repositoryRoot, "backend", "gradlew.bat");
  const harnessPath = path.join(repositoryRoot, "frontend", "local-two-actor-harness.mjs");
  const wrapperPropertiesPath = path.join(repositoryRoot, "backend", "gradle", "wrapper", "gradle-wrapper.properties");
  const [orchestratorBytes, nodeBytes, psqlBytes, javaBytes, cmdBytes, gradleWrapperBytes, harnessBytes, wrapperPropertiesBytes, balanceBytes, evidenceBytes, head] = await Promise.all([
    readControlledBytes(modulePath),
    readControlledBytes(nodePath, 128 * 1024 * 1024),
    readControlledBytes(psqlPath),
    readControlledBytes(javaPath),
    readControlledBytes(cmdPath),
    readControlledBytes(gradleWrapperPath),
    readControlledBytes(harnessPath),
    readControlledBytes(wrapperPropertiesPath, 64 * 1024),
    readControlledBytes(path.join(repositoryRoot, FIXTURES.balance.relativePath.replaceAll("/", "\\")), FIXTURES.balance.byteSize + 1),
    readControlledBytes(path.join(repositoryRoot, FIXTURES.evidence.relativePath.replaceAll("/", "\\")), FIXTURES.evidence.byteSize + 1),
    readGitHeadWithoutProcess(repositoryRoot)
  ]);
  const distribution = /gradle-([0-9]+(?:\.[0-9]+)+)-(?:bin|all)\.zip/.exec(wrapperPropertiesBytes.toString("utf8"));
  if (distribution === null) fail("GRADLE_VERSION_INVALID");
  const psqlVersion = extractWindowsFileVersion(psqlBytes);
  if (psqlVersion.split(".", 1)[0] !== "16") fail("PSQL_VERSION_INVALID");
  const javaVersion = extractWindowsFileVersion(javaBytes);
  if (javaVersion.split(".", 1)[0] !== "21") fail("JAVA_VERSION_INVALID");
  const cmdVersion = extractWindowsFileVersion(cmdBytes);
  if (cmdVersion.split(".", 1)[0] !== "10") fail("CMD_VERSION_INVALID");
  const fixtures = {
    balance: { fileName: FIXTURES.balance.fileName, byteSize: balanceBytes.length, sha256: sha256Hex(balanceBytes) },
    evidence: { fileName: FIXTURES.evidence.fileName, byteSize: evidenceBytes.length, sha256: sha256Hex(evidenceBytes) }
  };
  validateInspectionFixtures(fixtures);
  return {
    localAppData,
    localAppDataMetadata,
    head,
    orchestratorSha256: sha256Hex(orchestratorBytes),
    tools: {
      node: { path: nodePath, version: process.versions.node, sha256: sha256Hex(nodeBytes) },
      psql: { path: psqlPath, version: psqlVersion, sha256: sha256Hex(psqlBytes) },
      java: { path: javaPath, version: javaVersion, sha256: sha256Hex(javaBytes) },
      cmd: { path: cmdPath, version: cmdVersion, sha256: sha256Hex(cmdBytes) },
      gradleWrapper: { path: gradleWrapperPath, version: distribution[1], sha256: sha256Hex(gradleWrapperBytes) },
      harness: { path: harnessPath, version: "043b-two-actor", sha256: sha256Hex(harnessBytes) }
    },
    fixtures
  };
}

export function createReadOnlyProposalAdapters({ localAppData = process.env.LOCALAPPDATA, systemDrive = process.env.SystemDrive, javaHome = process.env.JAVA_HOME } = {}) {
  RUNTIME_INSTRUMENTATION.readOnlyAdapterFactories += 1;
  return Object.freeze({
    now: () => new Date().toISOString(),
    randomBytes: (length) => nodeRandomBytes(length),
    inspectProposalContext: () => inspectReadOnlyProposalContext(localAppData, systemDrive, javaHome),
    emit: async ({ stream, text: outputText }) => {
      if (!['stdout', 'stderr'].includes(stream) || typeof outputText !== "string") fail("OUTPUT_INVALID");
      RUNTIME_INSTRUMENTATION.realOutputWrites += 1;
      const destination = stream === "stdout" ? process.stdout : process.stderr;
      if (!destination.write(outputText)) await new Promise((resolvePromise) => destination.once("drain", resolvePromise));
    }
  });
}

function proposalFromContext({ run, runId, priorRunId, context, resources }) {
  assertClosedKeys(context, ["head", "orchestratorSha256", "tools", "fixtures"], "PROPOSAL_CONTEXT_INVALID");
  validateInspectionFixtures(context.fixtures);
  assertString(context.head, "HEAD_INVALID", { pattern: GIT_SHA1_REGEX });
  assertString(context.orchestratorSha256, "ORCHESTRATOR_HASH_INVALID", { pattern: SHA256_REGEX });
  const toolEvidence = buildToolEvidence(context.tools);
  const proposalResources = {
    dbName: resources.dbName,
    roleName: resources.roleName,
    runtimeRootSha256: sha256Hex(resources.runtimeRoot),
    storageRootSha256: sha256Hex(resources.storageRoot),
    evidenceRootSha256: sha256Hex(resources.evidenceRoot)
  };
  return createProposal({
    schemaVersion: "043c-proposal-v1",
    protocolId: PROTOCOL_ID,
    protocolVersion: PROTOCOL_VERSION,
    repository: REPOSITORY,
    head: context.head,
    orchestratorSha256: context.orchestratorSha256,
    run,
    runId,
    priorRunId,
    tenantId: TENANT_ID,
    environment: ENVIRONMENT,
    resources: proposalResources,
    fixtures: [context.fixtures.balance, context.fixtures.evidence],
    tools: toolEvidence,
    ports: [...PORTS],
    evidenceSummarySchemaVersion: SUMMARY_SCHEMA_VERSION
  });
}

function commandMaterial(proposal) {
  validateProposal(proposal);
  return {
    verb: "run",
    run: proposal.run,
    runId: proposal.runId,
    priorRunId: proposal.priorRunId,
    tenantId: proposal.tenantId,
    environment: proposal.environment,
    repository: proposal.repository,
    head: proposal.head,
    protocolVersion: proposal.protocolVersion,
    schemaVersion: proposal.evidenceSummarySchemaVersion,
    proposalSha256: proposalSha256(proposal)
  };
}

function bindingFromContext({ proposal, resources, context, passfileMetadata, reviewRecord, authorizationRecord, reviewPath, authorizationPath, reviewSha256, authorizationSha256 }) {
  return createBinding({
    schemaVersion: BINDING_SCHEMA_VERSION,
    protocolId: PROTOCOL_ID,
    protocolVersion: PROTOCOL_VERSION,
    orchestratorSha256: proposal.orchestratorSha256,
    repository: proposal.repository,
    head: proposal.head,
    run: proposal.run,
    runId: proposal.runId,
    priorRunId: proposal.priorRunId,
    tenantId: proposal.tenantId,
    environment: proposal.environment,
    proposalSha256: proposalSha256(proposal),
    resources: {
      dbName: resources.dbName,
      roleName: resources.roleName,
      runtimeRootSha256: sha256Hex(resources.runtimeRoot),
      storageRootSha256: sha256Hex(resources.storageRoot),
      evidenceRootSha256: sha256Hex(resources.evidenceRoot)
    },
    fixtures: [context.fixtures.balance, context.fixtures.evidence].map((fixture) => ({ name: fixture.fileName, byteSize: fixture.byteSize, sha256: fixture.sha256 })),
    tools: buildToolEvidence(context.tools),
    ports: [...PORTS],
    passfileMetadata,
    preExecutionReview: { recordId: reviewRecord.recordId, pathSha256: sha256Hex(reviewPath), sha256: reviewSha256, environmentBindingSha256: reviewRecord.environmentBindingSha256 },
    sensitiveAuthorization: {
      recordId: authorizationRecord.recordId,
      pathSha256: sha256Hex(authorizationPath),
      sha256: authorizationSha256,
      environmentBindingSha256: authorizationRecord.environmentBindingSha256,
      preExecutionReviewRecordId: authorizationRecord.preExecutionReviewRecordId,
      preExecutionReviewPathSha256: authorizationRecord.preExecutionReviewPathSha256,
      preExecutionReviewSha256: authorizationRecord.preExecutionReviewSha256
    },
    evidenceSummarySchemaVersion: SUMMARY_SCHEMA_VERSION
  });
}

function validateRunContext(context) {
  assertClosedKeys(context, ["localAppData", "localAppDataMetadata", "repositoryRoot", "head", "orchestratorSha256", "tools", "fixtures", "passfileMetadata", "environmentBindingSha256"], "RUN_CONTEXT_INVALID");
  validateLocalAppDataRoot(context.localAppData, context.localAppDataMetadata);
  assertString(context.repositoryRoot, "REPOSITORY_ROOT_INVALID");
  if (!path.isAbsolute(context.repositoryRoot)) fail("REPOSITORY_ROOT_INVALID");
  assertString(context.head, "HEAD_INVALID", { pattern: GIT_SHA1_REGEX });
  assertString(context.orchestratorSha256, "ORCHESTRATOR_HASH_INVALID", { pattern: SHA256_REGEX });
  buildToolEvidence(context.tools);
  if (context.tools.gradleWrapper.path !== path.join(context.repositoryRoot, "backend", "gradlew.bat") || context.tools.harness.path !== path.join(context.repositoryRoot, "frontend", "local-two-actor-harness.mjs")) fail("REPOSITORY_TOOL_PATH_MISMATCH");
  validateInspectionFixtures(context.fixtures);
  assertClosedKeys(context.passfileMetadata, ["absolute", "outsideRepository", "regularFile", "nonReparse", "aclChecked", "contentRead", "pathSha256", "fileIdentitySha256", "aclSha256"], "PASSFILE_METADATA_INVALID");
  for (const hash of [context.passfileMetadata.pathSha256, context.passfileMetadata.fileIdentitySha256, context.passfileMetadata.aclSha256]) assertString(hash, "PASSFILE_METADATA_INVALID", { pattern: SHA256_REGEX });
  assertString(context.environmentBindingSha256, "ENVIRONMENT_BINDING_HASH_INVALID", { pattern: SHA256_REGEX });
  return context;
}

function summaryFromExecution({ binding, proposalHash, state, execution, audit, usefulness, cleanup, status, failureCode, startedAtUtc, endedAtUtc }) {
  return buildRunSummary({
    schemaVersion: SUMMARY_SCHEMA_VERSION,
    protocolId: PROTOCOL_ID,
    run: binding.run,
    runId: binding.runId,
    tenantId: binding.tenantId,
    environment: binding.environment,
    commandEvidence: { orchestratorSha256: binding.orchestratorSha256, repository: binding.repository, head: binding.head, proposalSha256: proposalHash, commandBindingSha256: bindingSha256(binding) },
    reviewEvidence: { recordId: binding.preExecutionReview.recordId, sha256: binding.preExecutionReview.sha256, status: "PASS" },
    authorizationEvidence: { recordId: binding.sensitiveAuthorization.recordId, sha256: binding.sensitiveAuthorization.sha256, status: state.attempt.authorizationConsumed ? "CONSUMED" : "YES", consumedAtUtc: state.attempt.authorizationConsumedAtUtc },
    resources: { dbName: state.resources.dbName, roleName: state.resources.roleName, runtimeRootSha256: sha256Hex(state.resources.runtimeRoot), storageRootSha256: sha256Hex(state.resources.storageRoot), evidenceRootSha256: sha256Hex(state.resources.evidenceRoot) },
    actors: ["ACCOUNTANT", "REVIEWER"].map((name) => ({ role: ACTORS[name].role, userId: ACTORS[name].userId, subject: ACTORS[name].subject })),
    fixtures: [FIXTURES.balance, FIXTURES.evidence].map((fixture) => ({ name: fixture.fileName, byteSize: fixture.byteSize, sha256: fixture.sha256 })),
    runAttempt: { engaged: state.attempt.engaged, startedAtUtc: state.attempt.startedAtUtc },
    tasks: state.taskStatuses.map((task) => ({ ...task })),
    audit,
    export: execution?.exportPackId ? { exportPackId: execution.exportPackId, fileName: execution.exportFileName, byteSize: execution.exportByteSize, sha256: execution.exportSha256, contentVerified: Buffer.isBuffer(execution.exportBytes) } : { exportPackId: null, fileName: null, byteSize: null, sha256: null, contentVerified: false },
    usefulness,
    cleanup,
    status,
    failureCode,
    startedAtUtc,
    endedAtUtc
  });
}

function summaryFromRecoveryState(state, endedAtUtc, forcedFailureCode = null) {
  validateRecoveryState(state);
  const tasks = state.taskStatuses.map((task) => ({ ...task }));
  const audit = state.auditResult ?? { expectedCount: 0, missingCount: 0, unexpectedCount: 0, actualCount: 0, status: "NOT_REACHED" };
  const completed = state.attempt.engaged &&
    tasks.slice(0, 15).every((task) => task.status === "PASS") &&
    audit.status === "PASS_15_EXPECTED_0_MISSING_0_UNEXPECTED" &&
    state.cleanup.status === "COMPLETE" &&
    state.exportEvidence !== null &&
    state.usefulness !== null;
  tasks[15] = completed
    ? { taskId: "T15", status: "PASS", failureCode: null }
    : { taskId: "T15", status: "FAIL", failureCode: forcedFailureCode ?? "RUN_INCOMPLETE_AFTER_CLEANUP" };
  const status = completed ? "COMPLETED" : state.attempt.engaged ? "INCOMPLETE" : "PRE_EXECUTION_PREFLIGHT_FAILURE";
  const failureCode = completed ? null : forcedFailureCode ?? tasks.find((task) => task.status === "FAIL")?.failureCode ?? "RUN_INCOMPLETE";
  const summary = buildRunSummary({
    schemaVersion: SUMMARY_SCHEMA_VERSION,
    protocolId: PROTOCOL_ID,
    run: state.run,
    runId: state.runId,
    tenantId: state.tenantId,
    environment: state.environment,
    commandEvidence: { orchestratorSha256: state.orchestratorSha256, repository: state.repository, head: state.head, proposalSha256: state.proposalSha256, commandBindingSha256: state.commandBindingSha256 },
    reviewEvidence: { recordId: state.reviewRecord.recordId, sha256: state.reviewRecord.sha256, status: "PASS" },
    authorizationEvidence: { recordId: state.authorizationRecord.recordId, sha256: state.authorizationRecord.sha256, status: state.attempt.authorizationConsumed ? "CONSUMED" : "YES", consumedAtUtc: state.attempt.authorizationConsumedAtUtc },
    resources: { dbName: state.resources.dbName, roleName: state.resources.roleName, runtimeRootSha256: sha256Hex(state.resources.runtimeRoot), storageRootSha256: sha256Hex(state.resources.storageRoot), evidenceRootSha256: sha256Hex(state.resources.evidenceRoot) },
    actors: ["ACCOUNTANT", "REVIEWER"].map((name) => ({ role: ACTORS[name].role, userId: ACTORS[name].userId, subject: ACTORS[name].subject })),
    fixtures: [FIXTURES.balance, FIXTURES.evidence].map((fixture) => ({ name: fixture.fileName, byteSize: fixture.byteSize, sha256: fixture.sha256 })),
    runAttempt: { engaged: state.attempt.engaged, startedAtUtc: state.attempt.startedAtUtc },
    tasks,
    audit,
    export: state.exportEvidence === null
      ? { exportPackId: null, fileName: null, byteSize: null, sha256: null, contentVerified: false }
      : { exportPackId: state.exportEvidence.exportPackId, fileName: state.exportEvidence.fileName, byteSize: state.exportEvidence.byteSize, sha256: state.exportEvidence.sha256, contentVerified: true },
    usefulness: state.usefulness,
    cleanup: { status: state.cleanup.status, completedSteps: [...state.cleanup.completedSteps], residuals: [...state.cleanup.residuals] },
    status,
    failureCode,
    startedAtUtc: state.createdAtUtc,
    endedAtUtc
  });
  return summary;
}

function assertCliScopeMatches(options, context) {
  if (options["tenant-id"] !== TENANT_ID || options.environment !== ENVIRONMENT || options.repository !== REPOSITORY || options.head !== context.head || options["protocol-version"] !== PROTOCOL_VERSION || options["schema-version"] !== SUMMARY_SCHEMA_VERSION) fail("RUN_SCOPE_MISMATCH");
}

async function markTask(adapters, state, taskId, status, failureCode = null) {
  const index = TASK_IDS.indexOf(taskId);
  if (index < 0 || !TASK_STATUSES.includes(status)) fail("TASK_STATUS_INVALID");
  const priorHash = sha256Hex(serializeRecoveryState(state));
  const next = structuredClone(state);
  next.taskStatuses[index] = { taskId, status, failureCode };
  next.updatedAtUtc = adapters.now();
  await persistState(adapters, next, priorHash);
  return next;
}

export function createOrchestrator(adapters) {
  assertPlainObject(adapters, "ADAPTERS_INVALID");

  async function proposeUnsafe(input) {
    assertPlainObject(input, "PROPOSE_OPTIONS_INVALID");
    validateRun(input.run);
    assertClosedKeys(input, input.run === "R2" ? ["run", "priorRunId"] : ["run"], "PROPOSE_OPTIONS_INVALID");
    const { run, priorRunId = null } = input;
    assertAdapterMethods(adapters, PROPOSE_ADAPTER_METHODS);
    if (run === "R1" && priorRunId !== null) fail("PRIOR_RUN_ID_FORBIDDEN_FOR_R1");
    if (run === "R2") validateRunId(priorRunId, "R1");
    const inspected = await adapters.inspectProposalContext();
    assertClosedKeys(inspected, ["localAppData", "localAppDataMetadata", "head", "orchestratorSha256", "tools", "fixtures"], "PROPOSAL_CONTEXT_INVALID");
    validateLocalAppDataRoot(inspected.localAppData, inspected.localAppDataMetadata);
    const runId = generateRunId({ run, now: new Date(adapters.now()), randomBytes: adapters.randomBytes });
    const resources = deriveResources({ runId, localAppData: inspected.localAppData });
    const proposal = proposalFromContext({ run, runId, priorRunId, context: { head: inspected.head, orchestratorSha256: inspected.orchestratorSha256, tools: inspected.tools, fixtures: inspected.fixtures }, resources });
    const proposedCommand = commandMaterial(proposal);
    const envelope = {
      schemaVersion: "043c-proposal-envelope-v1",
      proposal,
      proposalSha256: proposalSha256(proposal),
      proposedCommand,
      proposedCommandSha256: sha256Hex(canonicalJson(proposedCommand))
    };
    assertNoSensitiveEvidence(envelope);
    const output = canonicalJson(envelope);
    await adapters.emit({ stream: "stdout", text: output });
    return Object.freeze(envelope);
  }

  async function propose(input) {
    try {
      return await proposeUnsafe(input);
    } catch (error) {
      throw normalizeFailure(error);
    }
  }

  async function runUnsafe(options) {
    assertPlainObject(options, "RUN_OPTIONS_INVALID");
    const expectedOptionKeys = options.run === "R2" ? [...CLI_SCHEMA.run.required, "prior-run-id"] : [...CLI_SCHEMA.run.required];
    assertClosedKeys(options, expectedOptionKeys, "RUN_OPTIONS_INVALID");
    if (Object.values(options).some((value) => typeof value !== "string")) fail("RUN_OPTIONS_INVALID");
    options = parseCliArgs(["run", ...Object.entries(options).flatMap(([name, value]) => [`--${name}`, value])]).options;
    assertAdapterMethods(adapters, ORCHESTRATOR_ADAPTER_METHODS);
    const priorRunId = options["prior-run-id"] ?? null;
    const context = validateRunContext(await adapters.inspectRunContext({ options: { ...options } }));
    assertCliScopeMatches(options, context);
    const resources = deriveResources({ runId: options["run-id"], localAppData: context.localAppData });
    const recoveryStateText = await adapters.readRecoveryState({ path: resources.recoveryStatePath });

    if (recoveryStateText !== null) {
      let recoveryState = parseRecoveryState(recoveryStateText);
      const fields = {
        run: options.run,
        runId: options["run-id"],
        priorRunId,
        tenantId: options["tenant-id"],
        environment: options.environment,
        repository: options.repository,
        head: options.head,
        orchestratorSha256: context.orchestratorSha256,
        proposalSha256: options["proposal-sha256"]
      };
      for (const [field, value] of Object.entries(fields)) if (recoveryState[field] !== value) fail("RECOVERY_STATE_BINDING_MISMATCH", { field });
      if (
        canonicalJson(buildToolEvidence(context.tools)) !== canonicalJson(recoveryState.binding.tools) ||
        canonicalJson(context.passfileMetadata) !== canonicalJson(recoveryState.binding.passfileMetadata) ||
        context.environmentBindingSha256 !== recoveryState.binding.preExecutionReview.environmentBindingSha256 ||
        context.environmentBindingSha256 !== recoveryState.binding.sensitiveAuthorization.environmentBindingSha256
      ) fail("RECOVERY_STATE_ENVIRONMENT_METADATA_MISMATCH");
      if (recoveryState.reviewRecord.sha256 !== options["pre-execution-review-sha256"] || recoveryState.authorizationRecord.sha256 !== options["sensitive-authorization-sha256"]) fail("RECOVERY_STATE_RECORD_HASH_MISMATCH");
      if (recoveryState.binding.preExecutionReview.pathSha256 !== sha256Hex(options["pre-execution-review-record-path"]) || recoveryState.binding.sensitiveAuthorization.pathSha256 !== sha256Hex(options["sensitive-authorization-record-path"])) fail("RECOVERY_STATE_RECORD_PATH_MISMATCH");
      for (const key of RECOVERY_RESOURCES_KEYS) if (recoveryState.resources[key] !== resources[key]) fail("RECOVERY_STATE_RESOURCE_MISMATCH", { key });
      if (recoveryState.cleanup.status === "COMPLETE") fail("RUN_ALREADY_CONSUMED");
      const recoveryInspection = validatePreflightInspection(await adapters.inspectPreflight({ resources, ports: PORTS, mode: RECOVERY_PHASE }), resources);
      const recoveryProof = await adapters.validateRecoveryResources({ state: recoveryState, resources, inspection: recoveryInspection });
      validateRecoveryResourceProof(recoveryProof, recoveryState);
      recoveryState = await persistRecoveryDiscoveries(adapters, recoveryState, recoveryProof);
      const cleanup = await executeCleanup({
        state: recoveryState,
        adapters,
        finalizeSummary: async (cleanedState) => {
          const summary = summaryFromRecoveryState(cleanedState, cleanedState.updatedAtUtc);
          const summaryBytes = Buffer.from(serializeRunSummary(summary), "utf8");
          return { summaryBytes, checksumText: buildSummaryChecksum(summaryBytes) };
        }
      });
      await adapters.emit({ stream: "stdout", text: canonicalJson({ mode: RECOVERY_PHASE, run: recoveryState.run, runId: recoveryState.runId, cleanupStatus: cleanup.status }) });
      return cleanup;
    }

    const records = await adapters.readBoundRecords({
      reviewRecordPath: options["pre-execution-review-record-path"],
      reviewExpectedSha256: options["pre-execution-review-sha256"],
      authorizationRecordPath: options["sensitive-authorization-record-path"],
      authorizationExpectedSha256: options["sensitive-authorization-sha256"]
    });
    assertClosedKeys(records, ["reviewText", "reviewBytes", "authorizationText", "authorizationBytes"], "BOUND_RECORDS_INVALID");
    if (!Buffer.isBuffer(records.reviewBytes) || !Buffer.isBuffer(records.authorizationBytes) || records.reviewBytes.toString("utf8") !== records.reviewText || records.authorizationBytes.toString("utf8") !== records.authorizationText) fail("BOUND_RECORD_BYTES_INVALID");
    const proposal = proposalFromContext({
      run: options.run,
      runId: options["run-id"],
      priorRunId,
      context: { head: context.head, orchestratorSha256: context.orchestratorSha256, tools: context.tools, fixtures: context.fixtures },
      resources
    });
    const proposalHash = proposalSha256(proposal);
    if (proposalHash !== options["proposal-sha256"]) fail("PROPOSAL_HASH_MISMATCH");
    const proposedCommandHash = sha256Hex(canonicalJson(commandMaterial(proposal)));
    const reviewRecord = parseReviewRecord(records.reviewText);
    const authorizationRecord = parseSensitiveAuthorizationRecord(records.authorizationText);
    const binding = bindingFromContext({
      proposal,
      resources,
      context,
      passfileMetadata: context.passfileMetadata,
      reviewRecord,
      authorizationRecord,
      reviewPath: options["pre-execution-review-record-path"],
      authorizationPath: options["sensitive-authorization-record-path"],
      reviewSha256: options["pre-execution-review-sha256"],
      authorizationSha256: options["sensitive-authorization-sha256"]
    });
    const bindingHash = bindingSha256(binding);
    assertNoSensitiveEvidence(binding);
    verifyBoundRecords({
      binding,
      proposalHash,
      commandHash: proposedCommandHash,
      reviewRecord,
      reviewBytes: records.reviewBytes,
      reviewExpectedSha256: options["pre-execution-review-sha256"],
      authorizationRecord,
      authorizationBytes: records.authorizationBytes,
      authorizationExpectedSha256: options["sensitive-authorization-sha256"]
    });
    const inspection = await adapters.inspectPreflight({ resources, ports: PORTS, mode: "INITIAL_RUN_PREFLIGHT" });
    selectPreflight({ recoveryStateText: null, inspection, binding, commandBindingSha256: bindingHash, resources });
    const engagedRuns = await adapters.scanEngagedRuns({ run: options.run, evidenceBase: resources.evidenceBase });
    const priorEvidence = options.run === "R2" ? await adapters.readR1Evidence({ priorRunId }) : null;
    assertRunSequence({ run: options.run, priorRunId, priorEvidence, engagedRuns });
    const recoveryNonce = Buffer.from(adapters.randomBytes(16)).toString("hex");
    let state = createRecoveryState({ binding, proposalSha256: proposalHash, commandBindingSha256: bindingHash, recoveryNonce, resources, nowUtc: adapters.now() });
    let execution = null;
    let currentTaskId = "T00";
    try {
      await persistState(adapters, state, null);
      const sensitiveInputs = validateSensitiveRuntimeInputs(await adapters.readSensitiveRuntimeInputs({ run: options.run, runId: options["run-id"] }), context);
      const currentEnvironmentBindingSha256 = environmentBindingSha256(sensitiveInputs, context);
      if (
        reviewRecord.environmentBindingSha256 !== currentEnvironmentBindingSha256 ||
        authorizationRecord.environmentBindingSha256 !== currentEnvironmentBindingSha256 ||
        binding.preExecutionReview.environmentBindingSha256 !== currentEnvironmentBindingSha256 ||
        binding.sensitiveAuthorization.environmentBindingSha256 !== currentEnvironmentBindingSha256 ||
        context.environmentBindingSha256 !== currentEnvironmentBindingSha256
      ) fail("RECORD_ENVIRONMENT_BINDING_MISMATCH");
      const adminInspectionPlan = buildPostgresAdminInspectionPlan({
        adminUser: sensitiveInputs.postgresAdminUser,
        passfilePath: sensitiveInputs.postgresAdminPassfileInspection.path,
        runId: state.runId,
        systemEnvironment: sensitiveInputs.systemEnvironment
      });
      const adminInspection = await adapters.inspectPostgresAdmin(adminInspectionPlan);
      validatePostgresAdmin(adminInspection, sensitiveInputs.postgresAdminUser);
      const runnerCredential = generateRunnerCredential(adapters.randomBytes);
      const postgresPlan = buildPostgresPlan({
        resources,
        adminUser: sensitiveInputs.postgresAdminUser,
        verifier: runnerCredential.verifier,
        ownershipMarker: state.ownershipMarker
      });
      const runtimePlans = buildRuntimePlans({
        repositoryRoot: context.repositoryRoot,
        resources,
        systemEnvironment: sensitiveInputs.systemEnvironment,
        runnerPassword: runnerCredential.password,
        hmacSecret: sensitiveInputs.jwtHmacSecret,
        cmdExecutable: sensitiveInputs.cmdExecutable,
        nodeExecutable: sensitiveInputs.nodeExecutable
      });
      const runtimePlanHash = runtimePlanEvidenceSha256(runtimePlans);
      const runtimePlanPreviousHash = sha256Hex(serializeRecoveryState(state));
      const runtimePlanState = structuredClone(state);
      runtimePlanState.runtimePlanEvidenceSha256 = runtimePlanHash;
      runtimePlanState.updatedAtUtc = adapters.now();
      validateRecoveryState(runtimePlanState);
      await persistState(adapters, runtimePlanState, runtimePlanPreviousHash);
      state = runtimePlanState;
      let outcome = await writeAheadEffect({
        adapters,
        state,
        operation: { id: "PROVISION_RESOURCES", target: resources.dbName, expectedIdentity: sha256Hex(state.ownershipMarker), nowUtc: adapters.now() },
        effect: (pendingState) => adapters.provisionResources({ state: pendingState, binding, adminInspectionPlan, postgresPlan }),
        applyResult: (completedState, result) => {
          validateProvisioningResult(result, completedState, { adminUser: sensitiveInputs.postgresAdminUser });
          return completedState;
        }
      });
      state = outcome.state;
      outcome = await writeAheadEffect({
        adapters,
        state,
        operation: { id: "START_RUNTIME", target: resources.runtimeRoot, expectedIdentity: runtimeStartIdentity(state.ownershipMarker, runtimePlanHash), nowUtc: adapters.now() },
        effect: (pendingState) => adapters.startRuntime({ state: pendingState, binding, runtimePlans }),
        applyResult: (completedState, result) => {
          const runtime = validateRuntimeStartResult(result, { runtimePlans, tools: context.tools, ownershipMarker: completedState.ownershipMarker });
          completedState.processes = runtime.processes.map((descriptor) => ({ ...descriptor }));
          return completedState;
        }
      });
      state = outcome.state;
      const freshProof = await adapters.validateFreshResources({ state, binding });
      validateFreshResourceProof(freshProof, state);
      const fixtureProof = await adapters.validateFixtures({ fixtures: context.fixtures });
      validateInspectionFixtures(fixtureProof);
      if (canonicalJson(fixtureProof) !== canonicalJson(context.fixtures)) fail("FIXTURE_REVALIDATION_MISMATCH");
      const priorStateHash = sha256Hex(serializeRecoveryState(state));
      const engagementAtUtc = adapters.now();
      const engagedState = engageRunAttempt(state, engagementAtUtc);
      const engagementBytes = Buffer.from(serializeRecoveryState(engagedState), "utf8");
      const reviewExpectedBytes = Buffer.from(records.reviewBytes);
      const reviewRecordPath = options["pre-execution-review-record-path"];
      const reviewRecordPathSha256 = sha256Hex(reviewRecordPath);
      const reviewExpectedSha256 = options["pre-execution-review-sha256"];
      const authorizationExpectedBytes = Buffer.from(records.authorizationBytes);
      const authorizationConsumedBytes = Buffer.from(canonicalJson(buildConsumedAuthorizationRecord(authorizationRecord, engagementAtUtc)), "utf8");
      const authorizationRecordPath = options["sensitive-authorization-record-path"];
      const authorizationRecordPathSha256 = sha256Hex(authorizationRecordPath);
      const authorizationExpectedSha256 = options["sensitive-authorization-sha256"];
      const authorizationConsumedSha256 = sha256Hex(authorizationConsumedBytes);
      const evidenceBaseSha256 = sha256Hex(resources.evidenceBase);
      const globalRunSlotIdentity = globalRunSlotIdentitySha256({ repository: state.repository, head: state.head, evidenceBaseSha256, runSlot: state.run });
      const engagement = await adapters.engageAttemptAtomic({
        statePath: resources.recoveryStatePath,
        evidenceBase: resources.evidenceBase,
        evidenceBaseSha256,
        runSlot: state.run,
        repository: state.repository,
        head: state.head,
        globalRunSlotIdentitySha256: globalRunSlotIdentity,
        expectedPreviousHash: priorStateHash,
        bytes: engagementBytes,
        reviewRecordPath,
        reviewRecordPathSha256,
        reviewExpectedBytes,
        reviewExpectedSha256,
        reviewRecordId: reviewRecord.recordId,
        authorizationRecordPath,
        authorizationRecordPathSha256,
        authorizationExpectedBytes,
        authorizationExpectedSha256,
        authorizationConsumedBytes,
        authorizationConsumedSha256,
        authorizationRecordId: authorizationRecord.recordId,
        proposalSha256: proposalHash,
        proposedCommandSha256: proposedCommandHash,
        commandBindingSha256: bindingHash,
        environmentBindingSha256: currentEnvironmentBindingSha256
      });
      assertClosedKeys(engagement, ["durable", "sha256", "reviewStillPass", "reviewRecordId", "reviewRecordPathSha256", "reviewCurrentSha256", "authorizationConsumed", "authorizationRecordId", "authorizationRecordPathSha256", "authorizationPriorSha256", "authorizationConsumedSha256", "proposalSha256", "proposedCommandSha256", "commandBindingSha256", "environmentBindingSha256", "globalRunSlotClaimed", "globalRunSlotIdentitySha256", "runSlot", "evidenceBaseSha256"], "T00_ENGAGEMENT_RESULT_INVALID");
      if (
        engagement.durable !== true ||
        engagement.sha256 !== sha256Hex(engagementBytes) ||
        engagement.reviewStillPass !== true ||
        engagement.reviewRecordId !== reviewRecord.recordId ||
        engagement.reviewRecordPathSha256 !== reviewRecordPathSha256 ||
        engagement.reviewCurrentSha256 !== reviewExpectedSha256 ||
        engagement.authorizationConsumed !== true ||
        engagement.authorizationRecordId !== authorizationRecord.recordId ||
        engagement.authorizationRecordPathSha256 !== authorizationRecordPathSha256 ||
        engagement.authorizationPriorSha256 !== authorizationExpectedSha256 ||
        engagement.authorizationConsumedSha256 !== authorizationConsumedSha256 ||
        engagement.proposalSha256 !== proposalHash ||
        engagement.proposedCommandSha256 !== proposedCommandHash ||
        engagement.commandBindingSha256 !== bindingHash ||
        engagement.environmentBindingSha256 !== currentEnvironmentBindingSha256 ||
        engagement.globalRunSlotClaimed !== true ||
        engagement.globalRunSlotIdentitySha256 !== globalRunSlotIdentity ||
        engagement.runSlot !== state.run ||
        engagement.evidenceBaseSha256 !== evidenceBaseSha256
      ) fail("T00_ENGAGEMENT_FAILED");
      state = engagedState;
      currentTaskId = "T01";
      state = await markTask(adapters, state, "T01", "PASS");
      currentTaskId = "T02";
      state = await markTask(adapters, state, "T02", "PASS");
      execution = await executeHttpTaskContract({
        runId: state.runId,
        requestAdapter: adapters.request,
        onRequest: async ({ stage, taskId, index, spec }) => {
          currentTaskId = taskId;
          const id = `${taskId}_REQUEST_${index + 1}`;
          if (stage === "BEFORE") {
            const priorHash = sha256Hex(serializeRecoveryState(state));
            state = setPendingOperation(state, { id, target: spec.requestId, expectedIdentity: sha256Hex(canonicalJson(spec)), nowUtc: adapters.now() });
            await persistState(adapters, state, priorHash);
          } else {
            const priorHash = sha256Hex(serializeRecoveryState(state));
            state = completePendingOperation(state, { id, nowUtc: adapters.now() });
            await persistState(adapters, state, priorHash);
          }
        },
        onTask: async ({ taskId }) => {
          state = await markTask(adapters, state, taskId, "PASS");
        }
      });
      outcome = await writeAheadEffect({
        adapters,
        state,
        operation: { id: "PRESERVE_EXPORT", target: execution.exportPackId, expectedIdentity: exportPersistenceIdentity({ path: resources.exportPath, exportPackId: execution.exportPackId, fileName: execution.exportFileName, byteSize: execution.exportBytes.length, sha256: execution.exportSha256 }), nowUtc: adapters.now() },
        effect: () => adapters.preserveExport({ path: resources.exportPath, exportPackId: execution.exportPackId, fileName: execution.exportFileName, bytes: execution.exportBytes, expectedSha256: execution.exportSha256 }),
        applyResult: (completedState, result) => {
          validatePreservedExportResult(result, { expectedExportPackId: execution.exportPackId, expectedFileName: execution.exportFileName, expectedSha256: execution.exportSha256, expectedByteSize: execution.exportBytes.length });
          completedState.exportEvidence = { exportPackId: execution.exportPackId, fileName: execution.exportFileName, byteSize: execution.exportByteSize, sha256: execution.exportSha256 };
          return completedState;
        }
      });
      state = outcome.state;
      currentTaskId = "T15";
      let statePreviousHash = sha256Hex(serializeRecoveryState(state));
      const actualAudit = await adapters.queryAudit(buildAuditQueryPlan({ runId: state.runId, folderId: execution.folderId }));
      const actualEvents = typeof actualAudit === "string" ? parseAuditRows(actualAudit) : actualAudit;
      const audit = compareAuditMultiset(expectedAuditEvents({ runId: state.runId, folderId: execution.folderId, importId: execution.importId, workpaperId: execution.workpaperId, documentId: execution.documentId, exportPackId: execution.exportPackId }), actualEvents);
      statePreviousHash = sha256Hex(serializeRecoveryState(state));
      state.auditResult = { ...audit };
      state.updatedAtUtc = adapters.now();
      await persistState(adapters, state, statePreviousHash);
      if (audit.status !== "PASS_15_EXPECTED_0_MISSING_0_UNEXPECTED") fail("AUDIT_MULTISET_MISMATCH", audit);
      const usefulness = validateUsefulness(await adapters.chooseUsefulness({ scores: [1, 2, 3, 4, 5], observationCodes: USEFULNESS_OBSERVATION_CODES }));
      statePreviousHash = sha256Hex(serializeRecoveryState(state));
      state.usefulness = { ...usefulness };
      state.updatedAtUtc = adapters.now();
      await persistState(adapters, state, statePreviousHash);
      const cleanup = await executeCleanup({
        state,
        adapters,
        finalizeSummary: async (cleanedState) => {
          const summary = summaryFromRecoveryState(cleanedState, cleanedState.updatedAtUtc);
          const summaryBytes = Buffer.from(serializeRunSummary(summary), "utf8");
          return { summaryBytes, checksumText: buildSummaryChecksum(summaryBytes) };
        }
      });
      await adapters.emit({ stream: "stdout", text: canonicalJson({ mode: "INITIAL_RUN", run: binding.run, runId: binding.runId, cleanupStatus: cleanup.status }) });
      return cleanup;
    } catch (error) {
      const failureValue = normalizeFailure(error);
      if (error?.recoveryState !== undefined) state = error.recoveryState;
      try {
        const durableStateText = await adapters.readRecoveryState({ path: resources.recoveryStatePath });
        if (typeof durableStateText === "string") state = parseRecoveryState(durableStateText, { binding, commandBindingSha256: bindingHash, resources });
        if ((state.pendingOperation?.id === "START_RUNTIME" && state.processes.length === 0) || (state.pendingOperation?.id === "PRESERVE_EXPORT" && state.exportEvidence === null)) {
          const recoveryInspection = validatePreflightInspection(await adapters.inspectPreflight({ resources, ports: PORTS, mode: RECOVERY_PHASE }), resources);
          const recoveryProof = await adapters.validateRecoveryResources({ state, resources, inspection: recoveryInspection });
          validateRecoveryResourceProof(recoveryProof, state);
          state = await persistRecoveryDiscoveries(adapters, state, recoveryProof);
        }
        if (TASK_IDS.slice(0, 15).includes(currentTaskId) && state.taskStatuses[TASK_IDS.indexOf(currentTaskId)].status === "NOT_REACHED") state = await markTask(adapters, state, currentTaskId, "FAIL", failureValue.code);
        await executeCleanup({
          state,
          adapters,
          finalizeSummary: async (cleanedState) => {
            const summary = summaryFromRecoveryState(cleanedState, cleanedState.updatedAtUtc, failureValue.code);
            const summaryBytes = Buffer.from(serializeRunSummary(summary), "utf8");
            return { summaryBytes, checksumText: buildSummaryChecksum(summaryBytes) };
          }
        });
      } catch {
        // The original stable failure remains authoritative; recovery state stays durable.
      }
      throw failureValue;
    }
  }

  async function run(options) {
    try {
      return await runUnsafe(options);
    } catch (error) {
      throw normalizeFailure(error);
    }
  }

  return Object.freeze({ propose, run });
}

export async function main(argv = process.argv.slice(2), { adapters, proposalAdapterFactory = createReadOnlyProposalAdapters } = {}) {
  const parsed = parseCliArgs(argv);
  let selectedAdapters = adapters;
  if (selectedAdapters === undefined) {
    if (parsed.verb !== "propose") fail("REAL_RUN_ADAPTERS_UNAVAILABLE");
    selectedAdapters = await proposalAdapterFactory();
  }
  const api = createOrchestrator(selectedAdapters);
  if (parsed.verb === "propose") {
    return api.propose(parsed.options.run === "R2" ? { run: parsed.options.run, priorRunId: parsed.options["prior-run-id"] } : { run: parsed.options.run });
  }
  const result = await api.run(parsed.options);
  assertClosedKeys(result, ["state", "status", "exitCode", "r2Eligible"], "RUN_RESULT_INVALID");
  if (![0, 1].includes(result.exitCode) || (result.status === "COMPLETE") !== (result.exitCode === 0)) fail("RUN_RESULT_INVALID");
  if (result.exitCode !== 0) fail("CLEANUP_PARTIAL");
  return result;
}

export function isDirectExecution(moduleUrl, argvEntry) {
  if (typeof moduleUrl !== "string" || typeof argvEntry !== "string") return false;
  try {
    return resolveNativePath(argvEntry) === resolveNativePath(fileURLToPath(moduleUrl));
  } catch {
    return false;
  }
}

if (isDirectExecution(import.meta.url, process.argv[1])) {
  main().catch((error) => {
    process.stderr.write(canonicalJson(sanitizeDiagnostic(error)));
    process.exitCode = 1;
  });
}
