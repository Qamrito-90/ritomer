import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

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
const EXPECTED_HISTORICAL_STATUS_BY_PATH = new Map([
  ...EXISTING_ALLOWED.map((path) => [path, "M"]),
  ...NEW_ALLOWED.map((path) => [path, "A"]),
]);

const CORRECTIVE_ALLOWED_FILE_SET = [
  "evals/mapping/validate-042a2-human-review-governance-kit.mjs",
  "evals/mapping/reviews/042a2/reviewer-instructions-v1.md",
  "evals/mapping/reviews/042a2/reviewer-response-schema-v2.json",
  "evals/mapping/reviews/042a2/restricted-participant-registry-schema-v1.json",
  "evals/mapping/reviews/042a2/reviewer-attestation-schema-v1.json",
  "evals/mapping/reviews/042a2/review-freeze-record-schema-v1.json",
  "evals/mapping/reviews/042a2/review-clarification-record-schema-v1.json",
  "evals/mapping/reviews/042a2/adjudication-dossier-manifest-schema-v1.json",
  "evals/mapping/reviews/042a2/workflow-ledger-record-schema-v1.json",
  "policies/ai-mapping-annotation-guide-042a2.md",
  "policies/ai-mapping-business-evaluation-protocol-042a2.md",
  "policies/ai-mapping-human-review-hardening-record-042a2.md",
  "runbooks/ai-mapping-human-review-coordinator-042a2.md",
  "evals/mapping/README.md",
  "specs/active/042-controlled-ai-mapping-runtime-pilot-v1.md",
  "docs/product/v1-plan.md",
].sort();

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
  "specs/active/042-controlled-ai-mapping-runtime-pilot-v1.md",
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

  let base;
  let head;
  let invalid = false;
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument !== "--base" && argument !== "--head") {
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
    if (argument === "--base") {
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

  if ((base === undefined) !== (head === undefined)) {
    addError("historical_mode_requires_base_and_head_together");
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
  console.log(`diff_base=${base}`);
  console.log(`diff_head=${head}`);
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

export function historicalChangeWhitelistViolations(changes) {
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
      const expectedStatus = EXPECTED_HISTORICAL_STATUS_BY_PATH.get(path);
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

function validateExactFileSet(range) {
  let historicalVerification;
  const changes = range.mode === "HISTORICAL"
    ? historicalChanges(range.base, range.head)
    : undefined;
  const actual = changes ? historicalChangedPaths(changes) : changedPaths();

  if (range.mode === "HISTORICAL") {
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
    const unexpected = actual.filter((path) => !CORRECTIVE_ALLOWED_FILE_SET.includes(path));
    assert(unexpected.length === 0, `worktree contains a path outside the corrective whitelist`);
    console.log(`diff_file_set_verified=${actual.length === 0 ? "CLEAN_COMMITTED_STATE" : `WORKTREE_ALLOWED_${actual.length}`}`);
  }

  for (const path of NEW_ALLOWED) {
    assert(existsSync(absolutePath(path)), `${path}: required new artifact missing`);
  }
  const forbiddenSurface = actual.filter((path) =>
    /(^|\/)(backend|frontend)(\/|$)|(^|\/)contracts\/|(^|\/)specs\/(active|backlog|done)\/043|(^|\/)(package\.json|pnpm-lock\.yaml|package-lock\.json|yarn\.lock|build\.gradle(?:\.kts)?|settings\.gradle(?:\.kts)?)$/i.test(path),
  );
  assert(forbiddenSurface.length === 0, `forbidden runtime, contract, spec 043, manifest or lockfile surface changed`);
  console.log(`manifest_lockfile_drift=${forbiddenSurface.length === 0 ? "NO" : "YES"}`);
  return historicalVerification;
}

function validateProtectedHashesAndCases() {
  let protectedArtifactsUnchanged = true;
  let protectedCaseBytesUnchanged = true;
  for (const [path, expectedHash] of PROTECTED_HASHES) {
    const actualHash = sha256Bytes(readFileSync(absolutePath(path)));
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
    "specs/active/042-controlled-ai-mapping-runtime-pilot-v1.md",
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

  for (const path of EXACT_ALLOWED_FILE_SET) {
    assert(!readText(path).includes(FORBIDDEN_VALIDATION_CLAIM), `${path}: forbidden validation claim present`);
  }
  const coherent = errors.length === errorCountBefore;
  console.log(`docs_policy_spec_readme_runbook_coherent=${coherent ? "YES" : "NO"}`);
  console.log(`subdeliverables_042a2a6_and_042a2a6a_distinct=${coherent ? "YES" : "NO"}`);
}

function trackedPaths() {
  return gitOutput(["ls-files", "-z"])
    .split("\0")
    .filter(Boolean)
    .map(normalizePath)
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
  const reviewPrefix = "evals/mapping/reviews/042a2/";
  const actualNames = tracked
    .filter((path) => path.startsWith(reviewPrefix) && !path.slice(reviewPrefix.length).includes("/"))
    .map((path) => path.slice(reviewPrefix.length))
    .sort();
  assert(sameArray(actualNames, EXPECTED_REVIEW_DIRECTORY), `tracked reviews/042a2 inventory contains a missing or unauthorized instance`);

  const promoted042a2 = tracked.filter((path) => /042a2.*golden|golden.*042a2/i.test(path));
  assert(promoted042a2.length === 0, `a tracked 042a2 golden artifact exists unexpectedly`);

  const activeSpecs = tracked
    .filter((path) => path.startsWith("specs/active/") && path.endsWith(".md"))
    .map((path) => path.slice("specs/active/".length))
    .sort();
  assert(sameArray(activeSpecs, ["042-controlled-ai-mapping-runtime-pilot-v1.md"]), `tracked specs/active must contain only spec 042`);
  const spec043 = tracked.filter((path) => /(^|\/)specs\/(?:active|backlog|done)\/043/i.test(path));
  assert(spec043.length === 0, `a tracked spec 043 artifact exists unexpectedly`);

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
  console.log(`spec_043_instances=${spec043.length}`);
  console.log("repo_wide_human_instance_scope=GIT_TRACKED_FILES_ONLY");
}

function addedLinesForScan(range) {
  const lines = [];
  const diffArgs = range.mode === "HISTORICAL"
    ? ["diff", "--unified=0", "--no-color", `${range.base}..${range.head}`, "--", ...EXACT_ALLOWED_FILE_SET]
    : ["diff", "--no-ext-diff", "--unified=0", "--no-color", "HEAD", "--", ...CORRECTIVE_ALLOWED_FILE_SET];
  const diff = gitOutput(diffArgs);
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
  console.log(`no_private_path_or_url_added=${privateLocationFindings === 0 ? "YES" : "NO"}`);
}

function main() {
  const range = parseCliArgs(process.argv.slice(2));
  if (range.mode === "INVALID") return;
  const historicalVerification = validateExactFileSet(range);
  validateProtectedHashesAndCases();
  validateSchemas();
  validateLedger();
  validateDocumentCoherence();
  validateNoRealInstances();
  validateAddedLineHygiene(range);
  return historicalVerification;
}

function runCli() {
  let historicalVerification;
  try {
    historicalVerification = main();
  } catch (error) {
    addError(`validator_internal_error:${error.name}`);
  }

  if (errors.length > 0) {
    console.error(`governance_kit_errors=${errors.length}`);
    errors.forEach((error) => console.error(error));
    process.exitCode = 1;
  } else {
    if (historicalVerification
      && Object.values(historicalVerification).every((verified) => verified === true)) {
      console.log("historical_change_types_verified=YES");
      console.log("historical_deletions_visible=YES");
      console.log("historical_rename_endpoints_visible=YES");
      console.log("historical_copy_endpoints_visible=YES");
      console.log("historical_expected_status_map=YES_6M_13A");
    }
    console.log("governance_kit_errors=0");
    console.log("governance_kit_result=PASS_STRUCTURAL_ONLY");
  }

  console.log("DRAFT_2020_12_SCHEMA_VALIDATION=NOT_PERFORMED");
}

const IS_DIRECT_EXECUTION = process.argv[1] !== undefined
  && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;

if (IS_DIRECT_EXECUTION) runCli();
