import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, "..", "..");
const NON_VALIDATION_WORDING =
  "JSON syntax and repository invariants checked; Draft 2020-12 semantic validation not performed.";
const FORBIDDEN_VALIDATION_CLAIM = "Schema" + " validated";
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
  "specs/active/042-controlled-ai-mapping-runtime-pilot-v1.md",
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

const PROTECTED_HASHES = new Map([
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
  return readFileSync(absolutePath(repoPath), "utf8");
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

function sameArray(actual, expected) {
  return actual.length === expected.length && actual.every((value, index) => value === expected[index]);
}

function gitOutput(args) {
  return execFileSync("git", args, {
    cwd: REPO_ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function changedPaths() {
  const raw = gitOutput(["status", "--porcelain=v1", "-z", "--untracked-files=all"]);
  const entries = raw.split("\0").filter(Boolean);
  const paths = [];
  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    const status = entry.slice(0, 2);
    let candidate = entry.slice(3);
    if (status.includes("R") || status.includes("C")) {
      index += 1;
      candidate = entries[index] ?? candidate;
    }
    paths.push(normalizePath(candidate));
  }
  return [...new Set(paths)].sort();
}

function validateExactFileSet() {
  const actual = changedPaths();
  if (actual.length > 0) {
    assert(sameArray(actual, EXACT_ALLOWED_FILE_SET), `changed file set differs from the exact 19-path 042a2a6a whitelist`);
  }
  for (const path of NEW_ALLOWED) {
    assert(existsSync(absolutePath(path)), `${path}: required new artifact missing`);
  }
  const forbiddenSurface = actual.filter((path) =>
    /(^|\/)(backend|frontend)(\/|$)|(^|\/)contracts\/|(^|\/)specs\/(active|backlog|done)\/043|(^|\/)(package\.json|pnpm-lock\.yaml|package-lock\.json|yarn\.lock|build\.gradle(?:\.kts)?|settings\.gradle(?:\.kts)?)$/i.test(path),
  );
  assert(forbiddenSurface.length === 0, `forbidden runtime, contract, spec 043, manifest or lockfile surface changed`);
  console.log(`exact_file_set=${actual.length === 0 ? "CLEAN_COMMITTED_STATE" : "YES_19_OF_19"}`);
  console.log("manifest_lockfile_drift=NO");
}

function validateProtectedHashesAndCases() {
  for (const [path, expectedHash] of PROTECTED_HASHES) {
    const actualHash = sha256Bytes(readFileSync(absolutePath(path)));
    assert(actualHash === expectedHash, `${path}: protected exact-byte SHA-256 mismatch`);
  }

  const semantic = parseJson("evals/mapping/fixtures/042a2/candidate-semantic-cases-v1.json");
  const policyFault = parseJson("evals/mapping/fixtures/042a2/candidate-policy-fault-cases-v1.json");
  const packA = parseJson("evals/mapping/reviews/042a2/reviewer-a-blind-v1.json");
  const packB = parseJson("evals/mapping/reviews/042a2/reviewer-b-blind-v1.json");
  if (semantic && policyFault && packA && packB) {
    const sourceCount = (semantic.cases?.length ?? -1)
      + (policyFault.policyCases?.length ?? -1)
      + (policyFault.invalidOutputCases?.length ?? -1);
    assert(sourceCount === 17, `protected candidate fixtures no longer contain the governed 17-case total`);
    assert(packA.cases?.length === 17 && packB.cases?.length === 17, `protected blind packs no longer contain 17 cases each`);
  }
  console.log("protected_v1_exact_byte_hashes_unchanged=YES");
  console.log("candidate_17_cases_exact_byte_unchanged=YES");
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

function validateSchemas() {
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
  }

  const attestationText = JSON.stringify(parsedSchemas.get("evals/mapping/reviews/042a2/reviewer-attestation-schema-v1.json") ?? {});
  assert(attestationText.includes("PRE_REVIEW") && attestationText.includes("AT_FREEZE"), `reviewer-attestation schema discriminators missing`);

  const clarificationText = JSON.stringify(parsedSchemas.get("evals/mapping/reviews/042a2/review-clarification-record-schema-v1.json") ?? {});
  assert(clarificationText.includes("MAY_INFLUENCE_DECISION") && clarificationText.includes("NO_DECISION_INFLUENCE"), `clarification schema discriminators missing`);

  const roundManifestText = JSON.stringify(parsedSchemas.get("evals/mapping/reviews/042a2/review-round-manifest-schema-v1.json") ?? {});
  assert(roundManifestText.includes("PRE_DISTRIBUTION") && roundManifestText.includes("DISTRIBUTED"), `round manifest lifecycle discriminators missing`);

  console.log(`json_schema_syntax_parsed=${parsedSchemas.size}_OF_${SCHEMA_PATHS.length}`);
  console.log("schema_governance_statuses_present=YES");
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
  const bytes = readFileSync(absolutePath(LEDGER_PATH));
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

  console.log("ledger_records=1");
  console.log("ledger_record_type=HARDENING_ONLY");
  console.log("ledger_state=PENDING_HUMAN_RESPONSES");
  console.log("ledger_all_authorizations_false=YES");
  console.log(`ledger_file_sha256=${sha256Bytes(bytes)}`);
}

function assertTokens(path, tokens) {
  const text = readText(path);
  for (const token of tokens) {
    assert(text.includes(token), `${path}: required coherence token ${token} missing`);
  }
}

function validateDocumentCoherence() {
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
    "specs/active/042-controlled-ai-mapping-runtime-pilot-v1.md",
    "docs/product/v1-plan.md",
    "evals/mapping/README.md",
    "runbooks/ai-mapping-human-review-coordinator-042a2.md",
  ];
  for (const path of stateDocs) {
    assertTokens(path, ["042a2a6a", "PENDING_HUMAN_RESPONSES"]);
  }

  const gateDocs = [
    "policies/ai-mapping-human-review-hardening-record-042a2.md",
    "specs/active/042-controlled-ai-mapping-runtime-pilot-v1.md",
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
    "specs/active/042-controlled-ai-mapping-runtime-pilot-v1.md",
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

  assertTokens("specs/active/042-controlled-ai-mapping-runtime-pilot-v1.md", [
    "### Protocole documentaire 042a2a6 - revue humaine et adjudication",
    "### Kit de hardening 042a2a6a - gouvernance de revue humaine",
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
    "spec `042` reste active",
    "provider_runtime=STILL_BLOCKED",
    "adapter_provider=NOT_AUTHORIZED",
    "retry_remaining=0",
    "fallback=FORBIDDEN",
  ]);

  for (const path of EXACT_ALLOWED_FILE_SET) {
    assert(!readText(path).includes(FORBIDDEN_VALIDATION_CLAIM), `${path}: forbidden validation claim present`);
  }
  console.log("docs_policy_spec_readme_runbook_coherent=YES");
  console.log("subdeliverables_042a2a6_and_042a2a6a_distinct=YES");
}

function walkFiles(directory) {
  const result = [];
  for (const entry of readdirSync(directory)) {
    const fullPath = resolve(directory, entry);
    if (statSync(fullPath).isDirectory()) result.push(...walkFiles(fullPath));
    else result.push(fullPath);
  }
  return result;
}

function validateNoRealInstances() {
  const reviewDirectory = absolutePath("evals/mapping/reviews/042a2");
  const actualNames = readdirSync(reviewDirectory).sort();
  assert(sameArray(actualNames, EXPECTED_REVIEW_DIRECTORY), `reviews/042a2 inventory contains a missing or unauthorized instance`);

  const mappingFiles = walkFiles(absolutePath("evals/mapping"))
    .map((path) => normalizePath(relative(REPO_ROOT, path)));
  const promoted042a2 = mappingFiles.filter((path) => /042a2.*golden|golden.*042a2/i.test(path));
  assert(promoted042a2.length === 0, `a 042a2 golden artifact exists unexpectedly`);

  const activeSpecs = readdirSync(absolutePath("specs/active"))
    .filter((name) => name.endsWith(".md"))
    .sort();
  assert(sameArray(activeSpecs, ["042-controlled-ai-mapping-runtime-pilot-v1.md"]), `specs/active must contain only spec 042`);

  console.log("human_response_instances=0");
  console.log("participant_registry_instances=0");
  console.log("attestation_instances=0");
  console.log("freeze_instances=0");
  console.log("clarification_instances=0");
  console.log("adjudication_instances=0");
  console.log("golden_set_042a2_instances=0");
  console.log("spec_043_instances=0");
}

function addedLinesForScan() {
  const lines = [];
  const diff = gitOutput(["diff", "--no-ext-diff", "--unified=0", "--no-color", "HEAD", "--", ...EXISTING_ALLOWED]);
  let currentPath;
  let currentLine = 0;
  for (const rawLine of diff.split("\n")) {
    if (rawLine.startsWith("+++ b/")) {
      currentPath = normalizePath(rawLine.slice(6));
      continue;
    }
    if (rawLine.startsWith("@@")) {
      const match = rawLine.match(/\+(\d+)(?:,(\d+))?/);
      currentLine = match ? Number(match[1]) : 0;
      continue;
    }
    if (rawLine.startsWith("+") && !rawLine.startsWith("+++")) {
      lines.push({ path: currentPath, line: currentLine, text: rawLine.slice(1) });
      currentLine += 1;
    } else if (rawLine.startsWith(" ")) {
      currentLine += 1;
    }
  }

  for (const path of NEW_ALLOWED) {
    const contentLines = readText(path).split(/\r?\n/);
    contentLines.forEach((text, index) => lines.push({ path, line: index + 1, text }));
  }
  return lines;
}

function validateAddedLineHygiene() {
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
  const privateUserPathPattern = new RegExp("C:" + "\\\\Users\\\\", "i");
  const urlPattern = /https?:\/\/[^\s"')]+/gi;
  const allowedPublicUrl = "https://json-schema.org/draft/2020-12/schema";

  for (const added of addedLinesForScan()) {
    for (const pattern of secretPatterns) {
      if (pattern.regex.test(added.text)) addError(`${added.path}:${added.line}:${pattern.category}`);
    }
    if (emailPattern.test(added.text)) addError(`${added.path}:${added.line}:personal_email_value`);
    if (privateUserPathPattern.test(added.text)) addError(`${added.path}:${added.line}:private_user_path`);
    const urls = added.text.match(urlPattern) ?? [];
    for (const url of urls) {
      if (url !== allowedPublicUrl) addError(`${added.path}:${added.line}:non_whitelisted_url`);
    }
  }

  const validatorSource = readText("evals/mapping/validate-042a2-human-review-governance-kit.mjs");
  assert(!/\bfetch\s*\(|from\s+["']node:(?:http|https|net|tls)["']/.test(validatorSource), `structural checker must not contain network code`);

  console.log("no_secret_value_added=YES");
  console.log("no_personal_data_instance_added=YES");
  console.log("no_private_path_or_url_added=YES");
}

function main() {
  validateExactFileSet();
  validateProtectedHashesAndCases();
  validateSchemas();
  validateLedger();
  validateDocumentCoherence();
  validateNoRealInstances();
  validateAddedLineHygiene();
}

try {
  main();
} catch (error) {
  addError(`validator_internal_error:${error.name}`);
}

if (errors.length > 0) {
  console.error(`governance_kit_errors=${errors.length}`);
  errors.forEach((error) => console.error(error));
  process.exitCode = 1;
} else {
  console.log("governance_kit_errors=0");
  console.log("governance_kit_result=PASS_STRUCTURAL_ONLY");
}

console.log("DRAFT_2020_12_SCHEMA_VALIDATION=NOT_PERFORMED");
