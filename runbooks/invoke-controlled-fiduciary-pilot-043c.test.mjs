import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import * as orchestrator from "./invoke-controlled-fiduciary-pilot-043c.mjs";

const RUN_ID = "r1-20260810t120000z-001122334455";
const R2_RUN_ID = "r2-20260810t130000z-aabbccddeeff";
const HEAD = "a".repeat(40);
const ORCHESTRATOR_HASH = "b".repeat(64);
const PROPOSAL_HASH = "c".repeat(64);
const REVIEW_HASH = "d".repeat(64);
const AUTHORIZATION_HASH = "e".repeat(64);
const REVIEW_RECORD_PATH = "C:\\Secure\\043c-pre-execution-review.json";
const AUTHORIZATION_RECORD_PATH = "C:\\Secure\\043c-sensitive-authorization.json";
const LOCAL_APP_DATA = "C:\\LocalAppData";
const REPOSITORY_ROOT = "C:\\dev\\ritomer";
const UUIDS = Object.freeze({
  folderId: "11111111-1111-4111-8111-111111111111",
  importId: "22222222-2222-4222-8222-222222222222",
  workpaperId: "33333333-3333-4333-8333-333333333333",
  documentId: "44444444-4444-4444-8444-444444444444",
  exportPackId: "55555555-5555-4555-8555-555555555555"
});
const EXPORT_BYTES = Buffer.from("PK\u0003\u0004synthetic-043c-export", "utf8");
const EXPORT_HASH = orchestrator.sha256Hex(EXPORT_BYTES);
const WORKPAPER_CREATED_AT = "2026-08-10T10:00:00.000Z";
const WORKPAPER_READY_AT = "2026-08-10T10:01:00.000Z";
const WORKPAPER_REVIEWED_AT = "2026-08-10T10:03:00.000Z";
const DOCUMENT_CREATED_AT = "2026-08-10T10:00:30.000Z";
const DOCUMENT_REVIEWED_AT = "2026-08-10T10:02:00.000Z";
const FOLDER_CREATED_AT = "2026-08-10T09:58:00.000Z";
const IMPORTED_AT = "2026-08-10T09:59:00.000Z";
const EXPORT_CREATED_AT = "2026-08-10T10:04:00.000Z";

const TOOLS = Object.freeze({
  node: Object.freeze({ path: "C:\\Program Files\\nodejs\\node.exe", version: "22.17.1", sha256: "1".repeat(64) }),
  psql: Object.freeze({ path: orchestrator.LOCAL_PSQL_PATH, version: "16", sha256: "2".repeat(64) }),
  java: Object.freeze({ path: "C:\\Program Files\\Eclipse Adoptium\\jdk-21\\bin\\java.exe", version: "21.0.10.7", sha256: "5".repeat(64) }),
  cmd: Object.freeze({ path: "C:\\Windows\\System32\\cmd.exe", version: "10.0.26100.1", sha256: "6".repeat(64) }),
  gradleWrapper: Object.freeze({ path: "C:\\dev\\ritomer\\backend\\gradlew.bat", version: "8.14.4", sha256: "3".repeat(64) }),
  harness: Object.freeze({ path: "C:\\dev\\ritomer\\frontend\\local-two-actor-harness.mjs", version: "043b", sha256: "4".repeat(64) })
});
const TOOL_EVIDENCE = orchestrator.buildToolEvidence(TOOLS);

function fixtureInspections() {
  return {
    balance: {
      fileName: orchestrator.FIXTURES.balance.fileName,
      byteSize: orchestrator.FIXTURES.balance.byteSize,
      sha256: orchestrator.FIXTURES.balance.sha256
    },
    evidence: {
      fileName: orchestrator.FIXTURES.evidence.fileName,
      byteSize: orchestrator.FIXTURES.evidence.byteSize,
      sha256: orchestrator.FIXTURES.evidence.sha256
    }
  };
}

function passfileMetadata() {
  return {
    absolute: true,
    outsideRepository: true,
    regularFile: true,
    nonReparse: true,
    aclChecked: true,
    contentRead: false,
    pathSha256: orchestrator.sha256Hex("C:\\Secure\\pgpass.conf"),
    fileIdentitySha256: "5".repeat(64),
    aclSha256: "6".repeat(64)
  };
}

function postgresAdminPassfileInspection() {
  return {
    path: "C:\\Secure\\pgpass.conf",
    absolute: true,
    outsideRepository: true,
    regularFile: true,
    nonReparse: true,
    aclChecked: true,
    isEnvFile: false,
    contentRead: false,
    fileIdentitySha256: "5".repeat(64),
    aclSha256: "6".repeat(64)
  };
}

function postgresAdminResult() {
  return { user: "ritomer_admin", login: true, superuser: false, createdb: true, createrole: true, replication: false, bypassrls: false, unexpectedMemberships: 0 };
}

function sensitiveRuntimeInputs() {
  return {
    postgresAdminUser: "ritomer_admin",
    postgresAdminPassfileInspection: postgresAdminPassfileInspection(),
    jwtHmacSecret: "043c-local-synthetic-hmac-secret-0001",
    systemEnvironment: { ComSpec: "C:\\Windows\\System32\\cmd.exe", SystemDrive: "C:", SystemRoot: "C:\\Windows", TEMP: "C:\\Temp", TMP: "C:\\Temp", WINDIR: "C:\\Windows", JAVA_HOME: "C:\\Program Files\\Eclipse Adoptium\\jdk-21" },
    cmdExecutable: "C:\\Windows\\System32\\cmd.exe",
    nodeExecutable: TOOLS.node.path
  };
}

function fakeEnvironmentBindingSha256() {
  return orchestrator.environmentBindingSha256(sensitiveRuntimeInputs(), { repositoryRoot: REPOSITORY_ROOT, passfileMetadata: passfileMetadata(), tools: TOOLS });
}

function localAppDataMetadata() {
  return { driveType: "FIXED", canonicalPath: LOCAL_APP_DATA, reparse: false };
}

function resources(runId = RUN_ID) {
  return orchestrator.deriveResources({ runId, localAppData: LOCAL_APP_DATA });
}

function fakeRuntimePlans(runId = RUN_ID) {
  const input = sensitiveRuntimeInputs();
  return orchestrator.buildRuntimePlans({
    repositoryRoot: REPOSITORY_ROOT,
    resources: resources(runId),
    systemEnvironment: input.systemEnvironment,
    runnerPassword: "043c-in-memory-runner-password-0001",
    hmacSecret: input.jwtHmacSecret,
    cmdExecutable: input.cmdExecutable,
    nodeExecutable: input.nodeExecutable
  });
}

function bindRuntimePlanToState(state, runtimePlans = fakeRuntimePlans(state.runId)) {
  const bound = structuredClone(state);
  bound.runtimePlanEvidenceSha256 = orchestrator.runtimePlanEvidenceSha256(runtimePlans);
  return bound;
}

function runtimeStartExpectedIdentity(state) {
  assert.match(state.runtimePlanEvidenceSha256, orchestrator.SHA256_REGEX);
  return orchestrator.runtimeStartIdentity(state.ownershipMarker, state.runtimePlanEvidenceSha256);
}

function catalogSnapshotForState(state) {
  return {
    database: { name: state.resources.dbName, owner: state.resources.roleName, encoding: "UTF8" },
    role: { name: state.resources.roleName, comment: state.ownershipMarker, login: true, superuser: false, createdb: false, createrole: false, inherit: false, replication: false, bypassrls: false, connectionLimit: 16 },
    membership: { role: state.resources.roleName, member: "ritomer_admin", adminOption: true, inheritOption: false, setOption: true },
    sessions: 0
  };
}

function pathProof(pathValue, exists) {
  return { path: pathValue, canonicalPath: pathValue, exists, type: exists ? "DIRECTORY" : "ABSENT", reparse: false, driveType: "FIXED" };
}

function preflightInspection({ databasePresent = false, rolePresent = false, runtimeRootPresent = false, storageRootPresent = false, evidenceRootPresent = false, occupiedPorts = [] } = {}) {
  const derived = resources();
  return {
    databasePresent,
    rolePresent,
    runtimeRootPresent,
    storageRootPresent,
    evidenceRootPresent,
    occupiedPorts,
    pathProof: {
      runtimeRoot: pathProof(derived.runtimeRoot, runtimeRootPresent),
      storageRoot: pathProof(derived.storageRoot, storageRootPresent),
      evidenceRoot: pathProof(derived.evidenceRoot, evidenceRootPresent)
    }
  };
}

function makeProposal({ run = "R1", runId = RUN_ID, priorRunId = null } = {}) {
  const derived = resources(runId);
  return orchestrator.createProposal({
    schemaVersion: "043c-proposal-v1",
    protocolId: orchestrator.PROTOCOL_ID,
    protocolVersion: orchestrator.PROTOCOL_VERSION,
    repository: orchestrator.REPOSITORY,
    head: HEAD,
    orchestratorSha256: ORCHESTRATOR_HASH,
    run,
    runId,
    priorRunId,
    tenantId: orchestrator.TENANT_ID,
    environment: orchestrator.ENVIRONMENT,
    resources: {
      dbName: derived.dbName,
      roleName: derived.roleName,
      runtimeRootSha256: orchestrator.sha256Hex(derived.runtimeRoot),
      storageRootSha256: orchestrator.sha256Hex(derived.storageRoot),
      evidenceRootSha256: orchestrator.sha256Hex(derived.evidenceRoot)
    },
    fixtures: [fixtureInspections().balance, fixtureInspections().evidence],
    tools: TOOL_EVIDENCE,
    ports: [...orchestrator.PORTS],
    evidenceSummarySchemaVersion: orchestrator.SUMMARY_SCHEMA_VERSION
  });
}

function proposedCommand(proposal) {
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
    proposalSha256: orchestrator.proposalSha256(proposal)
  };
}

function makeRecordTexts(proposal = makeProposal(), { reviewOverrides = {}, authorizationOverrides = {} } = {}) {
  const proposalSha256 = orchestrator.proposalSha256(proposal);
  const commandSha256 = orchestrator.sha256Hex(orchestrator.canonicalJson(proposedCommand(proposal)));
  const review = {
    schemaVersion: "043c-pre-execution-review-v1",
    recordId: "043c-review-record-001",
    status: "PASS",
    proposalSha256,
    commandSha256,
    environmentBindingSha256: fakeEnvironmentBindingSha256(),
    run: proposal.run,
    runId: proposal.runId,
    priorRunId: proposal.priorRunId,
    tenantId: proposal.tenantId,
    environment: proposal.environment,
    repository: proposal.repository,
    head: proposal.head,
    reviewedAtUtc: "2026-08-10T10:00:00.000Z",
    ...reviewOverrides
  };
  const reviewText = orchestrator.canonicalJson(review);
  const authorization = {
    schemaVersion: "043c-sensitive-authorization-v1",
    recordId: "043c-authorization-record-001",
    type: "SENSITIVE_EXECUTION",
    status: "YES",
    proposalSha256,
    commandSha256,
    environmentBindingSha256: fakeEnvironmentBindingSha256(),
    preExecutionReviewRecordId: review.recordId,
    preExecutionReviewPathSha256: orchestrator.sha256Hex(REVIEW_RECORD_PATH),
    preExecutionReviewSha256: orchestrator.sha256Hex(reviewText),
    run: proposal.run,
    runId: proposal.runId,
    priorRunId: proposal.priorRunId,
    tenantId: proposal.tenantId,
    environment: proposal.environment,
    repository: proposal.repository,
    head: proposal.head,
    authorizedAtUtc: "2026-08-10T10:01:00.000Z",
    consumedAtUtc: null,
    ...authorizationOverrides
  };
  const authorizationText = orchestrator.canonicalJson(authorization);
  return { review, authorization, reviewText, authorizationText, proposalSha256, commandSha256 };
}

function makeBinding({ proposal = makeProposal(), records = makeRecordTexts(proposal) } = {}) {
  const derived = resources(proposal.runId);
  return orchestrator.createBinding({
    schemaVersion: orchestrator.BINDING_SCHEMA_VERSION,
    protocolId: orchestrator.PROTOCOL_ID,
    protocolVersion: orchestrator.PROTOCOL_VERSION,
    orchestratorSha256: proposal.orchestratorSha256,
    repository: proposal.repository,
    head: proposal.head,
    run: proposal.run,
    runId: proposal.runId,
    priorRunId: proposal.priorRunId,
    tenantId: proposal.tenantId,
    environment: proposal.environment,
    proposalSha256: orchestrator.proposalSha256(proposal),
    resources: {
      dbName: derived.dbName,
      roleName: derived.roleName,
      runtimeRootSha256: orchestrator.sha256Hex(derived.runtimeRoot),
      storageRootSha256: orchestrator.sha256Hex(derived.storageRoot),
      evidenceRootSha256: orchestrator.sha256Hex(derived.evidenceRoot)
    },
    fixtures: [fixtureInspections().balance, fixtureInspections().evidence].map((fixture) => ({ name: fixture.fileName, byteSize: fixture.byteSize, sha256: fixture.sha256 })),
    tools: TOOL_EVIDENCE,
    ports: [...orchestrator.PORTS],
    passfileMetadata: passfileMetadata(),
    preExecutionReview: { recordId: records.review.recordId, pathSha256: orchestrator.sha256Hex(REVIEW_RECORD_PATH), sha256: orchestrator.sha256Hex(records.reviewText), environmentBindingSha256: records.review.environmentBindingSha256 },
    sensitiveAuthorization: {
      recordId: records.authorization.recordId,
      pathSha256: orchestrator.sha256Hex(AUTHORIZATION_RECORD_PATH),
      sha256: orchestrator.sha256Hex(records.authorizationText),
      environmentBindingSha256: records.authorization.environmentBindingSha256,
      preExecutionReviewRecordId: records.authorization.preExecutionReviewRecordId,
      preExecutionReviewPathSha256: records.authorization.preExecutionReviewPathSha256,
      preExecutionReviewSha256: records.authorization.preExecutionReviewSha256
    },
    evidenceSummarySchemaVersion: orchestrator.SUMMARY_SCHEMA_VERSION
  });
}

function makeRecoveryState({ engaged = false, allTasksPass = false, proposal = makeProposal(), records = null } = {}) {
  records ??= makeRecordTexts(proposal);
  const binding = makeBinding({ proposal, records });
  let state = orchestrator.createRecoveryState({
    binding,
    proposalSha256: records.proposalSha256,
    commandBindingSha256: orchestrator.bindingSha256(binding),
    recoveryNonce: "0123456789abcdef0123456789abcdef",
    resources: resources(),
    nowUtc: "2026-08-10T10:02:00.000Z"
  });
  if (engaged) {
    let pending = orchestrator.setPendingOperation(state, { id: "PROVISION_RESOURCES", target: state.resources.dbName, expectedIdentity: "8".repeat(64), nowUtc: "2026-08-10T10:02:01.000Z" });
    state = orchestrator.completePendingOperation(pending, { id: "PROVISION_RESOURCES", nowUtc: "2026-08-10T10:02:02.000Z" });
    state = bindRuntimePlanToState(state);
    pending = orchestrator.setPendingOperation(state, { id: "START_RUNTIME", target: state.resources.runtimeRoot, expectedIdentity: runtimeStartExpectedIdentity(state), nowUtc: "2026-08-10T10:02:03.000Z" });
    state = orchestrator.completePendingOperation(pending, { id: "START_RUNTIME", nowUtc: "2026-08-10T10:02:04.000Z" });
    state.processes = fakeRuntimeProcesses();
    state = orchestrator.engageRunAttempt(state, "2026-08-10T10:03:00.000Z");
  }
  if (allTasksPass) state.taskStatuses = orchestrator.TASK_IDS.map((taskId, index) => ({ taskId, status: index < 15 ? "PASS" : "NOT_REACHED", failureCode: null }));
  return { state, proposal, records, binding };
}

function throwsCode(action, code) {
  assert.throws(action, (error) => error instanceof orchestrator.OrchestratorError && error.code === code);
}

function validRunArgv() {
  return [
    "run", "--run", "R1", "--run-id", RUN_ID,
    "--tenant-id", orchestrator.TENANT_ID,
    "--environment", orchestrator.ENVIRONMENT,
    "--proposal-sha256", PROPOSAL_HASH,
    "--pre-execution-review-record-path", REVIEW_RECORD_PATH,
    "--pre-execution-review-sha256", REVIEW_HASH,
    "--sensitive-authorization-record-path", AUTHORIZATION_RECORD_PATH,
    "--sensitive-authorization-sha256", AUTHORIZATION_HASH,
    "--repository", orchestrator.REPOSITORY,
    "--head", HEAD,
    "--protocol-version", orchestrator.PROTOCOL_VERSION,
    "--schema-version", orchestrator.SUMMARY_SCHEMA_VERSION
  ];
}

test("I01 import is side-effect-free and exposes the closed public constants", async () => {
  assert.equal(orchestrator.PROTOCOL_ID, "043c-internal-rehearsal-v1");
  assert.equal(orchestrator.RUN_ID_LENGTH, 32);
  assert.deepEqual(orchestrator.PHASES, ["PHASE_PREFLIGHT", "PHASE_PROVISION", "PHASE_RUNTIME", "PHASE_T00_T15", "PHASE_AUDIT", "PHASE_EVIDENCE", "PHASE_CLEANUP"]);
  assert.equal(orchestrator.RECOVERY_PHASE, "RECOVERY_CLEANUP_ONLY");
  assert.deepEqual(orchestrator.runtimeInstrumentationSnapshot(), { readOnlyAdapterFactories: 0, realFilesystemReads: 0, realOutputWrites: 0, realNetworkCalls: 0, realChildProcesses: 0, realPostgresCalls: 0, realFilesystemMutations: 0 });
  const cacheBusted = await import(`./invoke-controlled-fiduciary-pilot-043c.mjs?side-effect-probe=${Date.now()}`);
  assert.deepEqual(cacheBusted.runtimeInstrumentationSnapshot(), { readOnlyAdapterFactories: 0, realFilesystemReads: 0, realOutputWrites: 0, realNetworkCalls: 0, realChildProcesses: 0, realPostgresCalls: 0, realFilesystemMutations: 0 });
  assert.equal(cacheBusted.isDirectExecution(import.meta.url, undefined), false);
});

test("I02 CLI accepts only the two exact verbs and closed option grammar", () => {
  assert.deepEqual(orchestrator.parseCliArgs(["propose", "--run", "R1"]), { verb: "propose", options: { run: "R1" } });
  assert.deepEqual(orchestrator.parseCliArgs(["propose", "--run", "R2", "--prior-run-id", RUN_ID]), { verb: "propose", options: { run: "R2", "prior-run-id": RUN_ID } });
  const parsed = orchestrator.parseCliArgs([
    "run", "--run", "R1", "--run-id", RUN_ID,
    "--tenant-id", orchestrator.TENANT_ID,
    "--environment", orchestrator.ENVIRONMENT,
    "--proposal-sha256", "1".repeat(64),
    "--pre-execution-review-record-path", REVIEW_RECORD_PATH,
    "--pre-execution-review-sha256", "2".repeat(64),
    "--sensitive-authorization-record-path", AUTHORIZATION_RECORD_PATH,
    "--sensitive-authorization-sha256", "3".repeat(64),
    "--repository", orchestrator.REPOSITORY,
    "--head", HEAD,
    "--protocol-version", orchestrator.PROTOCOL_VERSION,
    "--schema-version", orchestrator.SUMMARY_SCHEMA_VERSION
  ]);
  assert.equal(parsed.verb, "run");
  assert.equal(parsed.options["run-id"], RUN_ID);
});

test("I03 CLI rejects empty, unknown, duplicate, positional, missing and bypass options", () => {
  const cases = [
    [[], "CLI_VERB_REQUIRED"],
    [["recover"], "CLI_VERB_INVALID"],
    [["propose", "R1"], "CLI_OPTION_SYNTAX_INVALID"],
    [["propose", "--run=R1"], "CLI_OPTION_SYNTAX_INVALID"],
    [["propose", "--run"], "CLI_OPTION_SYNTAX_INVALID"],
    [["propose", "--run", "R1", "--run", "R1"], "CLI_OPTION_DUPLICATE"],
    [["propose", "--run", "R1", "--force", "true"], "CLI_BYPASS_OPTION_FORBIDDEN"],
    [["propose", "--run", "R1", "--yes", "true"], "CLI_BYPASS_OPTION_FORBIDDEN"],
    [["propose", "--run", "R1", "--ignore-review", "true"], "CLI_BYPASS_OPTION_FORBIDDEN"],
    [["propose", "--run", "R1", "--phase", "PHASE_RUNTIME"], "CLI_OPTION_UNKNOWN"],
    [["propose", "--run", "R1", "--prior-run-id", RUN_ID], "PRIOR_RUN_ID_FORBIDDEN_FOR_R1"],
    [["propose", "--run", "R2"], "PRIOR_RUN_ID_REQUIRED_FOR_R2"]
  ];
  for (const [argv, code] of cases) throwsCode(() => orchestrator.parseCliArgs(argv), code);
  for (const invalidPath of ["review.json", "C:/Secure/review.json", "\\\\server\\share\\review.json", "C:\\Secure\\..\\review.json", "\\\\?\\C:\\Secure\\review.json", "C:\\Secure\\"]) throwsCode(() => orchestrator.validateRecordPath(invalidPath), "RECORD_PATH_INVALID");
  const invalidRunPath = validRunArgv();
  invalidRunPath[invalidRunPath.indexOf("--pre-execution-review-record-path") + 1] = "review.json";
  throwsCode(() => orchestrator.parseCliArgs(invalidRunPath), "RECORD_PATH_INVALID");
});

test("I04 main dispatches only through injected adapters and the default sensitive path refuses", async () => {
  const before = orchestrator.runtimeInstrumentationSnapshot();
  const rig = completeFakeAdapters();
  const proposal = await orchestrator.main(["propose", "--run", "R1"], { adapters: rig.adapters });
  assert.equal(proposal.proposal.run, "R1");
  const callsAfterValidProposal = rig.calls.length;
  await assert.rejects(orchestrator.createOrchestrator(rig.adapters).propose({ run: "R1", force: true }), (error) => error.code === "PROPOSE_OPTIONS_INVALID");
  await assert.rejects(orchestrator.createOrchestrator(rig.adapters).run({ ...exactRunOptions(rig.records), force: "true" }), (error) => error.code === "RUN_OPTIONS_INVALID");
  assert.equal(rig.calls.length, callsAfterValidProposal, "invalid programmatic options must be rejected before any adapter call");
  await assert.rejects(orchestrator.main(validRunArgv()), (error) => error.code === "REAL_RUN_ADAPTERS_UNAVAILABLE");
  const moduleUrl = new URL("./invoke-controlled-fiduciary-pilot-043c.mjs", import.meta.url).href;
  const modulePath = fileURLToPath(moduleUrl);
  assert.equal(orchestrator.isDirectExecution(moduleUrl, modulePath), true);
  assert.equal(orchestrator.isDirectExecution(moduleUrl, `${modulePath}.different`), false);
  assert.equal(orchestrator.isDirectExecution("not-a-file-url", modulePath), false);
  assert.deepEqual(orchestrator.runtimeInstrumentationSnapshot(), before);
});

test("U01 runId generation is deterministic to the second and uses exactly six entropy bytes", () => {
  let requested = 0;
  const runId = orchestrator.generateRunId({
    run: "R1",
    now: new Date("2026-08-10T12:00:00.987Z"),
    randomBytes(length) {
      requested = length;
      return Buffer.from("001122334455", "hex");
    }
  });
  assert.equal(requested, 6);
  assert.equal(runId, RUN_ID);
  assert.equal(runId.length, 32);
});

test("U02 runId validation rejects prefix, case, date shape, entropy and length mutants", () => {
  const invalid = [
    RUN_ID.replace(/^r1/, "r3"),
    RUN_ID.toUpperCase(),
    RUN_ID.replace("20260810", "2026-08-"),
    RUN_ID.slice(0, -1),
    `${RUN_ID}0`,
    RUN_ID.replace("001122334455", "00112233445g"),
    RUN_ID.replaceAll("-", "_")
  ];
  for (const value of invalid) throwsCode(() => orchestrator.validateRunId(value), "RUN_ID_INVALID");
  throwsCode(() => orchestrator.validateRunId(RUN_ID, "R2"), "RUN_ID_RUN_MISMATCH");
});

test("U03 reviewed runId collision fails without silent regeneration", () => {
  throwsCode(() => orchestrator.assertRunIdAvailable(RUN_ID, [RUN_ID]), "RUN_ID_COLLISION");
  assert.equal(orchestrator.assertRunIdAvailable(RUN_ID, []), RUN_ID);
});

test("U04 deterministic resources are exact and SQL identifiers remain bounded", () => {
  const derived = resources();
  assert.equal(derived.dbName, "ritomer_043c_r1_20260810t120000z_001122334455");
  assert.equal(derived.roleName, "ritomer_043c_r1_20260810t120000z_001122334455_runner");
  assert.equal(derived.runtimeRoot, `${LOCAL_APP_DATA}\\Ritomer\\043c\\runtime\\${RUN_ID}`);
  assert.equal(derived.storageRoot, `${derived.runtimeRoot}\\storage`);
  assert.equal(derived.evidenceRoot, `${LOCAL_APP_DATA}\\Ritomer\\043c\\evidence\\${RUN_ID}`);
  assert.equal(orchestrator.quoteSqlIdentifier(derived.dbName), `"${derived.dbName}"`);
  for (const bad of ["UPPER", "a-b", "a\"b", "_leading", `a${"b".repeat(63)}`]) throwsCode(() => orchestrator.quoteSqlIdentifier(bad), "SQL_IDENTIFIER_INVALID");
});

test("U05 canonical JSON recursively sorts object keys, preserves array order and has one LF", () => {
  const text = orchestrator.canonicalJson({ z: { b: 2, a: 1 }, a: [{ y: 2, x: 1 }, 3] });
  assert.equal(text, '{"a":[{"x":1,"y":2},3],"z":{"a":1,"b":2}}\n');
  assert.deepEqual(orchestrator.parseCanonicalJson(text), { a: [{ x: 1, y: 2 }, 3], z: { a: 1, b: 2 } });
  assert.equal(orchestrator.sha256Hex("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
});

test("U06 strict JSON rejects duplicate keys, BOM, trailing bytes, noncanonical ordering and invalid values", () => {
  throwsCode(() => orchestrator.parseJsonStrict('{"a":1,"a":2}'), "JSON_DUPLICATE_KEY");
  throwsCode(() => orchestrator.parseJsonStrict('\ufeff{}\n'), "JSON_UTF8_BOM_FORBIDDEN");
  throwsCode(() => orchestrator.parseJsonStrict('{}x'), "JSON_TRAILING_CONTENT");
  throwsCode(() => orchestrator.parseCanonicalJson('{"b":1,"a":2}\n'), "CANONICAL_JSON_REQUIRED");
  throwsCode(() => orchestrator.canonicalJson({ a: undefined }), "JSON_VALUE_INVALID");
  throwsCode(() => orchestrator.canonicalJson({ a: Number.NaN }), "JSON_VALUE_INVALID");
  throwsCode(() => orchestrator.canonicalJson(new Date()), "JSON_VALUE_INVALID");
});

test("U07 evidence sanitation rejects secret keys, JWT/bearer values and private user paths", () => {
  for (const value of [
    { password: "redacted" },
    { token: "redacted" },
    { nested: { passfile: "redacted" } },
    { value: "Bearer abc" },
    { value: "eyJhbGciOiJIUzI1NiJ9.payload.signature" },
    { value: "C:\\Users\\Example\\private.txt" }
  ]) throwsCode(() => orchestrator.assertNoSensitiveEvidence(value), value.password !== undefined ? "SENSITIVE_EVIDENCE_KEY" : value.token !== undefined || value.nested !== undefined ? "SENSITIVE_EVIDENCE_KEY" : "SENSITIVE_EVIDENCE_VALUE");
  assert.deepEqual(orchestrator.sanitizeDiagnostic(new Error("C:\\Users\\Example\\secret")), { code: "ORCHESTRATOR_FAILURE" });
});

test("PTH01 fixed local roots and exact derived leaves pass closed containment checks", () => {
  orchestrator.validateLocalAppDataRoot(LOCAL_APP_DATA, { driveType: "FIXED", canonicalPath: LOCAL_APP_DATA, reparse: false });
  const derived = resources();
  assert.equal(orchestrator.assertExactDerivedPath(derived.runtimeRoot, derived.runtimeRoot, derived.runtimeBase), derived.runtimeRoot);
  assert.equal(orchestrator.validatePathInspection({ path: derived.runtimeRoot, canonicalPath: derived.runtimeRoot, exists: false, type: "ABSENT", reparse: false, driveType: "FIXED" }, derived.runtimeRoot, derived.runtimeBase).exists, false);
});

test("PTH02 path guards reject relative, UNC, device, alternate separator, traversal, case and root mutants", () => {
  for (const bad of ["relative\\path", "\\\\server\\share", "\\\\?\\C:\\LocalAppData", "c:\\LocalAppData", "C:/LocalAppData", "C:\\"] ) {
    assert.throws(() => orchestrator.validateLocalAppDataRoot(bad), orchestrator.OrchestratorError);
  }
  assert.throws(() => orchestrator.validateLocalAppDataRoot("Z:\\Mapped", { driveType: "NETWORK", canonicalPath: "Z:\\Mapped", reparse: false }), orchestrator.OrchestratorError);
  const derived = resources();
  const badLeaves = [
    derived.runtimeBase,
    `${derived.runtimeBase}\\..\\evidence\\${RUN_ID}`,
    `${derived.runtimeBase}\\${RUN_ID.toUpperCase()}`,
    `${derived.runtimeBase}\\${RUN_ID}x`,
    `C:\\Other\\${RUN_ID}`
  ];
  for (const candidate of badLeaves) assert.throws(() => orchestrator.assertExactDerivedPath(candidate, derived.runtimeRoot, derived.runtimeBase), orchestrator.OrchestratorError);
  throwsCode(() => orchestrator.validatePathInspection({ path: derived.runtimeRoot, canonicalPath: derived.runtimeRoot, exists: true, type: "DIRECTORY", reparse: true, driveType: "FIXED" }, derived.runtimeRoot, derived.runtimeBase), "PATH_REPARSE_FORBIDDEN");
});

test("B01 canonical binding serializes, reparses and invalidates tampering", () => {
  const binding = makeBinding();
  const text = orchestrator.serializeBinding(binding);
  assert.deepEqual(orchestrator.parseBinding(text), JSON.parse(text));
  assert.match(orchestrator.bindingSha256(binding), orchestrator.SHA256_REGEX);
  const tampered = text.replace(orchestrator.TENANT_ID, "036a0000-0000-4000-8000-000000000099");
  assert.throws(() => orchestrator.parseBinding(tampered), orchestrator.OrchestratorError);
  const parsed = JSON.parse(text);
  parsed.extra = true;
  throwsCode(() => orchestrator.validateBinding(parsed), "BINDING_SCHEMA_INVALID");
  for (const length of [39, 41, 64]) {
    const wrongHead = structuredClone(binding);
    wrongHead.head = "a".repeat(length);
    throwsCode(() => orchestrator.validateBinding(wrongHead), "BINDING_HEAD_INVALID");
  }
});

test("B02 binding never contains raw private roots or secret material", () => {
  const bindingText = orchestrator.serializeBinding(makeBinding());
  assert.equal(bindingText.includes(LOCAL_APP_DATA), false);
  assert.equal(/password|jwt|credential|C:\\\\Users\\/i.test(bindingText), false);
  assert.doesNotThrow(() => orchestrator.assertNoSensitiveEvidence(JSON.parse(bindingText)));
});

test("B03 review and authorization records require canonical exact PASS/YES single-use bindings", () => {
  const records = makeRecordTexts();
  const parsedReview = orchestrator.parseReviewRecord(records.reviewText);
  const parsedAuthorization = orchestrator.parseSensitiveAuthorizationRecord(records.authorizationText);
  assert.equal(parsedReview.status, "PASS");
  assert.equal(parsedReview.environmentBindingSha256, fakeEnvironmentBindingSha256());
  assert.equal(parsedAuthorization.status, "YES");
  assert.deepEqual(
    [parsedAuthorization.preExecutionReviewRecordId, parsedAuthorization.preExecutionReviewPathSha256, parsedAuthorization.preExecutionReviewSha256],
    [parsedReview.recordId, orchestrator.sha256Hex(REVIEW_RECORD_PATH), orchestrator.sha256Hex(records.reviewText)]
  );
  const replay = { ...records.authorization, consumedAtUtc: "2026-08-10T10:02:00.000Z" };
  throwsCode(() => orchestrator.parseSensitiveAuthorizationRecord(orchestrator.canonicalJson(replay)), "SENSITIVE_AUTHORIZATION_NOT_USABLE");
  for (const status of ["FAIL", "INCONCLUSIVE"]) {
    const nonPass = makeRecordTexts(makeProposal(), { reviewOverrides: { status } });
    throwsCode(() => orchestrator.parseReviewRecord(nonPass.reviewText), "PRE_EXECUTION_REVIEW_NOT_PASS");
  }
  const reviewWithoutEnvironment = { ...records.review };
  delete reviewWithoutEnvironment.environmentBindingSha256;
  throwsCode(() => orchestrator.parseReviewRecord(orchestrator.canonicalJson(reviewWithoutEnvironment)), "REVIEW_RECORD_SCHEMA_INVALID");
  const authorizationWithoutReviewHash = { ...records.authorization };
  delete authorizationWithoutReviewHash.preExecutionReviewSha256;
  throwsCode(() => orchestrator.parseSensitiveAuthorizationRecord(orchestrator.canonicalJson(authorizationWithoutReviewHash)), "AUTHORIZATION_RECORD_SCHEMA_INVALID");
  const consumed = orchestrator.buildConsumedAuthorizationRecord(records.authorization, "2026-08-10T10:03:00.000Z");
  assert.deepEqual(
    [consumed.preExecutionReviewRecordId, consumed.preExecutionReviewPathSha256, consumed.preExecutionReviewSha256],
    [records.review.recordId, orchestrator.sha256Hex(REVIEW_RECORD_PATH), orchestrator.sha256Hex(records.reviewText)]
  );
  const duplicate = records.reviewText.replace('{', '{"status":"PASS",');
  throwsCode(() => orchestrator.parseReviewRecord(duplicate), "JSON_DUPLICATE_KEY");
});

test("B04 record file hashes, IDs and every bound tuple are checked", () => {
  const proposal = makeProposal();
  const records = makeRecordTexts(proposal);
  const binding = makeBinding({ proposal, records });
  assert.equal(orchestrator.verifyBoundRecords({
    binding,
    proposalHash: records.proposalSha256,
    commandHash: records.commandSha256,
    reviewRecord: records.review,
    reviewBytes: Buffer.from(records.reviewText),
    reviewExpectedSha256: orchestrator.sha256Hex(records.reviewText),
    authorizationRecord: records.authorization,
    authorizationBytes: Buffer.from(records.authorizationText),
    authorizationExpectedSha256: orchestrator.sha256Hex(records.authorizationText)
  }), true);
  throwsCode(() => orchestrator.verifyBoundRecords({
    binding,
    proposalHash: records.proposalSha256,
    commandHash: records.commandSha256,
    reviewRecord: { ...records.review, runId: R2_RUN_ID },
    reviewBytes: Buffer.from(records.reviewText),
    reviewExpectedSha256: orchestrator.sha256Hex(records.reviewText),
    authorizationRecord: records.authorization,
    authorizationBytes: Buffer.from(records.authorizationText),
    authorizationExpectedSha256: orchestrator.sha256Hex(records.authorizationText)
  }), "RECORD_BINDING_MISMATCH");
});

test("B05 authorization binds the exact review identity and both records bind the same environment", () => {
  const proposal = makeProposal();
  const reviewBindingMutants = [
    { preExecutionReviewRecordId: "043c-review-record-002" },
    { preExecutionReviewPathSha256: "0".repeat(64) },
    { preExecutionReviewSha256: "1".repeat(64) }
  ];
  for (const authorizationOverrides of reviewBindingMutants) {
    const records = makeRecordTexts(proposal, { authorizationOverrides });
    throwsCode(() => makeBinding({ proposal, records }), "RECORD_REVIEW_BINDING_MISMATCH");
  }
  const environmentMismatch = makeRecordTexts(proposal, { authorizationOverrides: { environmentBindingSha256: "0".repeat(64) } });
  throwsCode(() => makeBinding({ proposal, records: environmentMismatch }), "RECORD_ENVIRONMENT_BINDING_MISMATCH");

  const records = makeRecordTexts(proposal);
  const binding = makeBinding({ proposal, records });
  assert.equal(binding.preExecutionReview.environmentBindingSha256, fakeEnvironmentBindingSha256());
  assert.equal(binding.sensitiveAuthorization.environmentBindingSha256, binding.preExecutionReview.environmentBindingSha256);
  assert.deepEqual(
    [binding.sensitiveAuthorization.preExecutionReviewRecordId, binding.sensitiveAuthorization.preExecutionReviewPathSha256, binding.sensitiveAuthorization.preExecutionReviewSha256],
    [binding.preExecutionReview.recordId, binding.preExecutionReview.pathSha256, binding.preExecutionReview.sha256]
  );
});

test("R01 initial and recovery preflights are exclusive and collisions are never adopted", () => {
  const { state, binding } = makeRecoveryState();
  const absent = preflightInspection();
  assert.equal(orchestrator.selectPreflight({ recoveryStateText: null, inspection: absent, binding, commandBindingSha256: orchestrator.bindingSha256(binding), resources: resources() }).mode, "INITIAL_RUN_PREFLIGHT");
  for (const field of ["databasePresent", "rolePresent", "runtimeRootPresent", "storageRootPresent", "evidenceRootPresent"]) {
    const collision = preflightInspection({ [field]: true });
    throwsCode(() => orchestrator.selectPreflight({ recoveryStateText: null, inspection: collision, binding, commandBindingSha256: orchestrator.bindingSha256(binding), resources: resources() }), "INITIAL_RESOURCE_COLLISION");
  }
  throwsCode(() => orchestrator.selectPreflight({ recoveryStateText: null, inspection: preflightInspection({ occupiedPorts: [8080] }), binding, commandBindingSha256: orchestrator.bindingSha256(binding), resources: resources() }), "INITIAL_RESOURCE_COLLISION");
  const recovery = orchestrator.selectPreflight({ recoveryStateText: orchestrator.serializeRecoveryState(state), inspection: preflightInspection({ evidenceRootPresent: true }), binding, commandBindingSha256: orchestrator.bindingSha256(binding), resources: resources() });
  assert.equal(recovery.mode, orchestrator.RECOVERY_PHASE);
});

test("R02 malformed, incomplete, divergent and completed recovery state all refuse", () => {
  const { state, binding } = makeRecoveryState();
  const absent = preflightInspection({ evidenceRootPresent: true });
  const args = { inspection: absent, binding, commandBindingSha256: orchestrator.bindingSha256(binding), resources: resources() };
  assert.throws(() => orchestrator.selectPreflight({ recoveryStateText: "{}\n", ...args }), orchestrator.OrchestratorError);
  const divergent = structuredClone(state);
  divergent.head = "f".repeat(40);
  assert.throws(() => orchestrator.selectPreflight({ recoveryStateText: orchestrator.serializeRecoveryState(divergent), ...args }), orchestrator.OrchestratorError);
  const proposalRelabel = structuredClone(state);
  proposalRelabel.proposalSha256 = "e".repeat(64);
  throwsCode(() => orchestrator.validateRecoveryState(proposalRelabel), "RECOVERY_STATE_PROPOSAL_BINDING_MISMATCH");
  const completed = structuredClone(state);
  completed.cleanup.status = "COMPLETE";
  completed.cleanup.completedSteps = [...orchestrator.CLEANUP_STEPS];
  completed.completedOperations = orchestrator.CLEANUP_STEPS.slice(0, -1);
  throwsCode(() => orchestrator.selectPreflight({ recoveryStateText: orchestrator.serializeRecoveryState(completed), ...args }), "RUN_ALREADY_CONSUMED");
  const forgedProgress = makeRecoveryState({ engaged: true }).state;
  forgedProgress.taskStatuses = orchestrator.TASK_IDS.map((taskId, index) => ({ taskId, status: index < 15 ? "PASS" : "NOT_REACHED", failureCode: null }));
  throwsCode(() => orchestrator.serializeRecoveryState(forgedProgress), "RECOVERY_TASK_OPERATION_MISMATCH");
});

test("R03 pending operation is durable before completion and T00 is single-use", () => {
  const { state } = makeRecoveryState();
  const pending = orchestrator.setPendingOperation(state, { id: "PROVISION_RESOURCES", target: state.resources.dbName, expectedIdentity: "9".repeat(64), nowUtc: "2026-08-10T10:02:01.000Z" });
  assert.equal(pending.pendingOperation.id, "PROVISION_RESOURCES");
  const completed = orchestrator.completePendingOperation(pending, { id: "PROVISION_RESOURCES", nowUtc: "2026-08-10T10:02:02.000Z" });
  assert.equal(completed.pendingOperation, null);
  assert.deepEqual(completed.completedOperations, ["PROVISION_RESOURCES"]);
  const runtimeReady = bindRuntimePlanToState(completed);
  const runtimePending = orchestrator.setPendingOperation(runtimeReady, { id: "START_RUNTIME", target: state.resources.runtimeRoot, expectedIdentity: runtimeStartExpectedIdentity(runtimeReady), nowUtc: "2026-08-10T10:02:03.000Z" });
  const runtimeCompleted = orchestrator.completePendingOperation(runtimePending, { id: "START_RUNTIME", nowUtc: "2026-08-10T10:02:04.000Z" });
  runtimeCompleted.processes = fakeRuntimeProcesses();
  const engaged = orchestrator.engageRunAttempt(runtimeCompleted, "2026-08-10T10:03:00.000Z");
  assert.equal(engaged.attempt.authorizationConsumed, true);
  throwsCode(() => orchestrator.engageRunAttempt(engaged, "2026-08-10T10:03:01.000Z"), "T00_ATTEMPT_ALREADY_ENGAGED");
});

test("PG01 SCRAM verifier is deterministic, correctly shaped and never exposes the password", () => {
  const password = "0123456789abcdef0123456789abcdef";
  const verifier = orchestrator.createScramVerifier(password, Buffer.alloc(16, 7));
  assert.match(verifier, /^SCRAM-SHA-256\$4096:[A-Za-z0-9+/]+=*\$[A-Za-z0-9+/]+=*:[A-Za-z0-9+/]+=*$/);
  assert.equal(verifier.includes(password), false);
  assert.equal(verifier, orchestrator.createScramVerifier(password, Buffer.alloc(16, 7)));
  throwsCode(() => orchestrator.createScramVerifier("short", Buffer.alloc(16)), "RUNNER_PASSWORD_INVALID");
});

test("PG02 PostgreSQL plan is exact, inverse and contains no forbidden destructive clause", () => {
  const derived = resources();
  const marker = orchestrator.createOwnershipMarker({ runId: RUN_ID, recoveryNonce: "0123456789abcdef0123456789abcdef", bindingSha256: "8".repeat(64) });
  const verifier = orchestrator.createScramVerifier("0123456789abcdef0123456789abcdef", Buffer.alloc(16, 1));
  const plan = orchestrator.buildPostgresPlan({ resources: derived, adminUser: "ritomer_admin", verifier, ownershipMarker: marker });
  assert.deepEqual(plan.steps.map((step) => step.id), ["CREATE_RUNNER_ROLE", "CREATE_RUN_DATABASE", "HARDEN_RUN_DATABASE"]);
  assert.deepEqual(plan.rollback.map((step) => step.id), ["DROP_RUN_DATABASE", "DROP_RUNNER_ROLE"]);
  const sql = [...plan.steps, ...plan.rollback].map((step) => step.stdin).join("\n");
  assert.match(sql, /NOSUPERUSER/);
  assert.match(sql, /NOINHERIT/);
  assert.match(sql, /CONNECTION LIMIT 16/);
  assert.match(sql, /TEMPLATE template0/);
  assert.match(sql, /ENCODING 'UTF8'/);
  assert.match(sql, /REVOKE CONNECT, TEMPORARY/);
  const harden = plan.steps.find((step) => step.id === "HARDEN_RUN_DATABASE").stdin;
  const hardenOrder = ["BEGIN;", `SET ROLE \"${derived.roleName}\";`, "REVOKE CONNECT, TEMPORARY", "DROP SCHEMA public;", `CREATE SCHEMA public AUTHORIZATION \"${derived.roleName}\";`, "RESET ROLE;", "COMMIT;"];
  for (let index = 1; index < hardenOrder.length; index += 1) assert.ok(harden.indexOf(hardenOrder[index - 1]) < harden.indexOf(hardenOrder[index]), `hardening order: ${hardenOrder[index]}`);
  assert.equal(/CASCADE|DROP OWNED|REASSIGN OWNED|pg_terminate_backend|FORCE/i.test(sql), false);
  for (const bad of ["DROP DATABASE x WITH (FORCE);", "DROP OWNED BY x;", "REASSIGN OWNED BY x TO y;", "DROP SCHEMA x CASCADE;", "SELECT pg_terminate_backend(1);"]) assert.throws(() => orchestrator.assertSafeSql(bad), orchestrator.OrchestratorError);
});

test("PG03 psql invocation uses fixed executable, argument array, shell false and a stripped environment", () => {
  const invocation = orchestrator.buildPsqlInvocation({
    adminUser: "ritomer_admin",
    passfilePath: "C:\\Secure\\pgpass.conf",
    runId: RUN_ID,
    systemEnvironment: { SystemRoot: "C:\\Windows", TEMP: "C:\\Temp", PGHOST: "evil", SENTINEL_SECRET: "do-not-inherit" }
  });
  assert.equal(invocation.executable, orchestrator.LOCAL_PSQL_PATH);
  assert.equal(invocation.shell, false);
  assert.deepEqual(invocation.args.slice(0, 4), ["-X", "--no-password", "--host=127.0.0.1", "--port=5432"]);
  assert.equal(Object.hasOwn(invocation.environment, "PGHOST"), false);
  assert.equal(Object.hasOwn(invocation.environment, "SENTINEL_SECRET"), false);
  assert.equal(invocation.environment.PGCONNECT_TIMEOUT, "5");
});

test("PG04 admin, passfile and catalog identities are exact and divergence is blocking", () => {
  const admin = { user: "ritomer_admin", login: true, superuser: false, createdb: true, createrole: true, replication: false, bypassrls: false, unexpectedMemberships: 0 };
  assert.equal(orchestrator.validatePostgresAdmin(admin, "ritomer_admin").createdb, true);
  for (const field of ["superuser", "replication", "bypassrls"]) assert.throws(() => orchestrator.validatePostgresAdmin({ ...admin, [field]: true }, "ritomer_admin"), orchestrator.OrchestratorError);
  const metadata = orchestrator.validatePassfileInspection(postgresAdminPassfileInspection(), REPOSITORY_ROOT);
  assert.equal(metadata.contentRead, false);
  assert.throws(() => orchestrator.validatePassfileInspection({ ...postgresAdminPassfileInspection(), path: `${REPOSITORY_ROOT}\\.env`, outsideRepository: false, isEnvFile: true }, REPOSITORY_ROOT), orchestrator.OrchestratorError);
  assert.throws(() => orchestrator.validatePassfileInspection({ ...postgresAdminPassfileInspection(), path: "C:\\Secure\\.env", isEnvFile: false }, REPOSITORY_ROOT), orchestrator.OrchestratorError);
  const derived = resources();
  const marker = orchestrator.createOwnershipMarker({ runId: RUN_ID, recoveryNonce: "0123456789abcdef0123456789abcdef", bindingSha256: "8".repeat(64) });
  const snapshot = {
    database: { name: derived.dbName, owner: derived.roleName, encoding: "UTF8" },
    role: { name: derived.roleName, comment: marker, login: true, superuser: false, createdb: false, createrole: false, inherit: false, replication: false, bypassrls: false, connectionLimit: 16 },
    membership: { role: derived.roleName, member: "ritomer_admin", adminOption: true, inheritOption: false, setOption: true },
    sessions: 0
  };
  assert.equal(orchestrator.validateCatalogIdentity(snapshot, { resources: derived, adminUser: "ritomer_admin", ownershipMarker: marker }).sessions, 0);
  assert.throws(() => orchestrator.validateCatalogIdentity({ ...snapshot, database: { ...snapshot.database, owner: "foreign" } }, { resources: derived, adminUser: "ritomer_admin", ownershipMarker: marker }), orchestrator.OrchestratorError);
});

test("PG05 sensitive runtime inputs are closed and produce only a bounded read-only admin inspection", () => {
  const context = { repositoryRoot: REPOSITORY_ROOT, passfileMetadata: passfileMetadata(), tools: TOOLS };
  assert.equal(orchestrator.validateSensitiveRuntimeInputs(sensitiveRuntimeInputs(), context).postgresAdminUser, "ritomer_admin");
  const plan = orchestrator.buildPostgresAdminInspectionPlan({ adminUser: "ritomer_admin", passfilePath: "C:\\Secure\\pgpass.conf", runId: RUN_ID, systemEnvironment: sensitiveRuntimeInputs().systemEnvironment });
  assert.equal(plan.readOnly, true);
  assert.equal(plan.expectedRows, 1);
  assert.match(plan.stdin, /SERIALIZABLE READ ONLY/);
  assert.match(plan.stdin, /statement_timeout = '5s'/);
  assert.match(plan.stdin, /ROLLBACK/);
  const injected = sensitiveRuntimeInputs();
  injected.systemEnvironment = { ...injected.systemEnvironment, NODE_OPTIONS: "--require=C:\\foreign\\inject.cjs" };
  throwsCode(() => orchestrator.validateSensitiveRuntimeInputs(injected, context), "SYSTEM_ENVIRONMENT_NAME_FORBIDDEN");
  throwsCode(() => orchestrator.validateSensitiveRuntimeInputs({ ...sensitiveRuntimeInputs(), nodeExecutable: "C:\\Tools\\foreign-node.exe" }, context), "NODE_EXECUTABLE_MISMATCH");
  const foreignJava = sensitiveRuntimeInputs();
  foreignJava.systemEnvironment = { ...foreignJava.systemEnvironment, JAVA_HOME: "C:\\Foreign\\jdk-21" };
  throwsCode(() => orchestrator.validateSensitiveRuntimeInputs(foreignJava, context), "JAVA_EXECUTABLE_MISMATCH");
  const changedEnvironmentBinding = { ...sensitiveRuntimeInputs(), systemEnvironment: { ...sensitiveRuntimeInputs().systemEnvironment, JAVA_HOME: "C:\\Foreign\\jdk-21" } };
  assert.throws(() => orchestrator.environmentBindingSha256(changedEnvironmentBinding, context), orchestrator.OrchestratorError);
  const changedHmac = { ...sensitiveRuntimeInputs(), jwtHmacSecret: "043c-local-synthetic-hmac-secret-0002" };
  assert.notEqual(orchestrator.environmentBindingSha256(changedHmac, context), orchestrator.environmentBindingSha256(sensitiveRuntimeInputs(), context));
  assert.equal(orchestrator.canonicalJson({ environmentBindingSha256: orchestrator.environmentBindingSha256(changedHmac, context) }).includes(changedHmac.jwtHmacSecret), false);
  const versionResource = Buffer.concat([Buffer.alloc(8), Buffer.from("ProductVersion\0", "utf16le"), Buffer.alloc(4), Buffer.from("16.9.1.0\0", "utf16le")]);
  assert.equal(orchestrator.extractWindowsFileVersion(versionResource), "16.9.1.0");
  throwsCode(() => orchestrator.extractWindowsFileVersion(Buffer.from("not-a-version")), "WINDOWS_FILE_VERSION_METADATA_INVALID");
});

test("E01 child environments are distinct allowlists and sentinel secrets never inherit", () => {
  const parent = { SystemRoot: "C:\\Windows", TEMP: "C:\\Temp", SENTINEL_SECRET: "never", PGHOST: "foreign", NODE_OPTIONS: "--require=C:\\foreign\\inject.cjs" };
  const postgres = orchestrator.buildChildEnvironment("POSTGRESQL", parent, { PGPASSFILE: "C:\\Secure\\pgpass.conf", PGCONNECT_TIMEOUT: "5", PGAPPNAME: `ritomer-043c-${RUN_ID}` });
  const backend = orchestrator.buildChildEnvironment("BACKEND", parent, {
    SPRING_DATASOURCE_URL: `jdbc:postgresql://127.0.0.1:5432/${resources().dbName}`,
    SPRING_DATASOURCE_USERNAME: resources().roleName,
    SPRING_DATASOURCE_PASSWORD: "runner-secret-in-memory",
    SPRING_DATASOURCE_HIKARI_MAXIMUM_POOL_SIZE: "8",
    RITOMER_SECURITY_JWT_HMAC_SECRET: "hmac-in-memory",
    RITOMER_WORKPAPERS_DOCUMENTS_STORAGE_BACKEND: "LOCAL_FS",
    RITOMER_WORKPAPERS_DOCUMENTS_STORAGE_LOCAL_ROOT: resources().storageRoot
  });
  const harness = orchestrator.buildChildEnvironment("HARNESS", parent, { RITOMER_SECURITY_JWT_HMAC_SECRET: "hmac-in-memory" });
  const viteValues = { RITOMER_LOCAL_DEMO_BACKEND_TARGET: orchestrator.BACKEND_ORIGIN, RITOMER_LOCAL_DEMO_PROXY_AUTH_ENABLED: "true", RITOMER_LOCAL_DEMO_BEARER_TOKEN: "actor-token" };
  const viteAccountant = orchestrator.buildChildEnvironment("VITE_ACCOUNTANT", parent, viteValues);
  const viteReviewer = orchestrator.buildChildEnvironment("VITE_REVIEWER", parent, viteValues);
  assert.equal(Object.hasOwn(postgres, "SPRING_DATASOURCE_PASSWORD"), false);
  assert.equal(Object.hasOwn(harness, "SPRING_DATASOURCE_PASSWORD"), false);
  assert.equal(Object.hasOwn(harness, "PGPASSFILE"), false);
  assert.deepEqual(Object.keys(viteAccountant), ["SystemRoot", "TEMP", "RITOMER_LOCAL_DEMO_BACKEND_TARGET", "RITOMER_LOCAL_DEMO_PROXY_AUTH_ENABLED", "RITOMER_LOCAL_DEMO_BEARER_TOKEN"]);
  assert.deepEqual(viteReviewer, viteAccountant);
  for (const environment of [postgres, backend, harness, viteAccountant, viteReviewer]) orchestrator.assertSentinelsNotInherited(environment, ["SENTINEL_SECRET", "PGHOST", "NODE_OPTIONS"]);
});

test("E02 process plans require absolute executables, shell false and no secret-bearing argv", () => {
  const environment = { SystemRoot: "C:\\Windows" };
  const spec = orchestrator.buildSpawnSpec({ label: "SAFE_PROCESS", executable: "C:\\Tools\\safe.exe", args: ["--fixed", "value"], cwd: REPOSITORY_ROOT, environment, expectedPort: 8080 });
  assert.equal(spec.shell, false);
  assert.deepEqual(spec.args, ["--fixed", "value"]);
  assert.throws(() => orchestrator.buildSpawnSpec({ label: "BAD_PROCESS", executable: "relative.exe", args: [], cwd: REPOSITORY_ROOT, environment }), orchestrator.OrchestratorError);
  assert.throws(() => orchestrator.buildSpawnSpec({ label: "BAD_PROCESS", executable: "C:\\Tools\\safe.exe", args: ["--password=secret"], cwd: REPOSITORY_ROOT, environment }), orchestrator.OrchestratorError);
});

function descriptor({ label, pid, parentPid = 0, expectedPort = null, creationTimeUtc = "2026-08-10T10:00:00.000Z", executablePath = "C:\\Tools\\safe.exe", executableSha256 = "1".repeat(64), commandLineSha256 = "2".repeat(64) }) {
  return { label, pid, parentPid, creationTimeUtc, executablePath, executableSha256, commandLineSha256, expectedPort };
}

function boundRuntimeDescriptor({ label, pid, parentPid = 0, expectedPort = null }) {
  const binding = orchestrator.expectedRuntimeProcessBindings(TOOL_EVIDENCE)[label];
  return descriptor({
    label,
    pid,
    parentPid,
    expectedPort,
    executablePath: binding.executablePath,
    executableSha256: binding.executableSha256,
    commandLineSha256: binding.commandLineSha256 ?? "7".repeat(64)
  });
}

function fakeRuntimeProcesses() {
  return [boundRuntimeDescriptor({ label: "BACKEND_GRADLE", pid: 10 }), boundRuntimeDescriptor({ label: "BACKEND_APPLICATION", pid: 11, parentPid: 10, expectedPort: 8080 }), boundRuntimeDescriptor({ label: "TWO_ACTOR_HARNESS", pid: 20 }), boundRuntimeDescriptor({ label: "VITE_ACCOUNTANT", pid: 21, parentPid: 20, expectedPort: 5173 }), boundRuntimeDescriptor({ label: "VITE_REVIEWER", pid: 22, parentPid: 20, expectedPort: 5174 })];
}

function backendApplicationBindingProof(processes, ownershipMarker, runtimePlans) {
  const application = processes.find((item) => item.label === "BACKEND_APPLICATION");
  const parent = processes.find((item) => item.label === "BACKEND_GRADLE");
  if (application === undefined || parent === undefined) return null;
  const descriptorSha256 = orchestrator.sha256Hex(orchestrator.canonicalJson(application));
  const runtimePlanEvidenceSha256 = orchestrator.runtimePlanEvidenceSha256(runtimePlans);
  const ownershipMarkerSha256 = orchestrator.sha256Hex(ownershipMarker);
  return {
    descriptorSha256,
    commandLineSha256: application.commandLineSha256,
    parentCommandLineSha256: parent.commandLineSha256,
    runtimePlanEvidenceSha256,
    ownershipMarkerSha256,
    runtimeMarkerSha256: orchestrator.sha256Hex(orchestrator.canonicalJson({ descriptorSha256, ownershipMarkerSha256, parentCommandLineSha256: parent.commandLineSha256, runtimePlanEvidenceSha256 })),
    runtimeMarkerDurable: true,
    exactObservedCommandLine: true
  };
}

function viteEnvironmentProofs(runtimePlans) {
  return Object.fromEntries([["ACCOUNTANT", "viteAccountant"], ["REVIEWER", "viteReviewer"]].map(([actorName, planName]) => {
    const contract = runtimePlans[planName];
    return [actorName, {
      contractSha256: orchestrator.sha256Hex(orchestrator.canonicalJson(contract)),
      environmentNames: [...contract.environmentNames],
      fixedEnvironment: { ...contract.fixedEnvironment },
      secretEnvironmentName: contract.secretEnvironmentName,
      secretPresent: true,
      forbiddenNamesAbsent: true
    }];
  }));
}

function fakeRuntimeResult(runtimePlans, ownershipMarker) {
  let processes = fakeRuntimeProcesses();
  const identities = {
    ACCOUNTANT: { userId: orchestrator.ACTORS.ACCOUNTANT.userId, subject: orchestrator.ACTORS.ACCOUNTANT.subject, roles: ["ACCOUNTANT"], memberships: [{ tenantId: orchestrator.TENANT_ID, role: "ACCOUNTANT" }] },
    REVIEWER: { userId: orchestrator.ACTORS.REVIEWER.userId, subject: orchestrator.ACTORS.REVIEWER.subject, roles: ["REVIEWER"], memberships: [{ tenantId: orchestrator.TENANT_ID, role: "REVIEWER" }] }
  };
  return { processes, readiness: { preExistingListeners: [], backendHealth: { statusCode: 200, redirected: false, body: { status: "UP" } }, listeners: [{ port: 8080, address: "127.0.0.1", pid: 11 }, { port: 5173, address: "127.0.0.1", pid: 21 }, { port: 5174, address: "127.0.0.1", pid: 22 }], harnessReady: true, harnessSignal: "HARNESS_READY", identities, processes }, planEvidence: orchestrator.runtimePlanEvidence(runtimePlans), backendApplicationBindingProof: backendApplicationBindingProof(processes, ownershipMarker, runtimePlans), viteEnvironmentProofs: viteEnvironmentProofs(runtimePlans) };
}

test("L01 process identity uses the full tuple and shutdown order is leaf-first", () => {
  const root = descriptor({ label: "BACKEND_ROOT", pid: 10, expectedPort: 8080 });
  const child = descriptor({ label: "JAVA_CHILD", pid: 11, parentPid: 10 });
  const leaf = descriptor({ label: "WORKER_LEAF", pid: 12, parentPid: 11 });
  assert.equal(orchestrator.assertProcessIdentity(root, { ...root }), true);
  for (const mutant of [{ ...root, creationTimeUtc: "2026-08-10T10:00:01.000Z" }, { ...root, commandLineSha256: "3".repeat(64) }, { ...root, executableSha256: "4".repeat(64) }]) assert.throws(() => orchestrator.assertProcessIdentity(root, mutant), orchestrator.OrchestratorError);
  assert.deepEqual(orchestrator.leafFirstShutdownOrder([root, leaf, child]).map((item) => item.pid), [12, 11, 10]);
  assert.deepEqual(orchestrator.ownedProcessSubtree(fakeRuntimeProcesses(), "BACKEND_GRADLE").map((item) => item.label), ["BACKEND_GRADLE", "BACKEND_APPLICATION"]);
  assert.deepEqual(orchestrator.ownedProcessSubtree(fakeRuntimeProcesses(), "TWO_ACTOR_HARNESS").map((item) => item.label), ["TWO_ACTOR_HARNESS", "VITE_ACCOUNTANT", "VITE_REVIEWER"]);
  for (const mutate of [
    (items) => { items[2].parentPid = items[1].pid; },
    (items) => { items[1].parentPid = items[2].pid; },
    (items) => { items[3].parentPid = items[1].pid; }
  ]) {
    const overlapping = fakeRuntimeProcesses();
    mutate(overlapping);
    assert.throws(() => orchestrator.validateRuntimeProcessSet(overlapping), orchestrator.OrchestratorError);
  }
});

test("L02 readiness rejects pre-existing, wildcard, wrong-owner and identity mutants", () => {
  const identities = {
    ACCOUNTANT: { userId: orchestrator.ACTORS.ACCOUNTANT.userId, subject: orchestrator.ACTORS.ACCOUNTANT.subject, roles: ["ACCOUNTANT"], memberships: [{ tenantId: orchestrator.TENANT_ID, role: "ACCOUNTANT" }] },
    REVIEWER: { userId: orchestrator.ACTORS.REVIEWER.userId, subject: orchestrator.ACTORS.REVIEWER.subject, roles: ["REVIEWER"], memberships: [{ tenantId: orchestrator.TENANT_ID, role: "REVIEWER" }] }
  };
  const processes = [descriptor({ label: "BACKEND_GRADLE", pid: 10 }), descriptor({ label: "BACKEND_APPLICATION", pid: 11, parentPid: 10, expectedPort: 8080 }), descriptor({ label: "TWO_ACTOR_HARNESS", pid: 20 }), descriptor({ label: "VITE_ACCOUNTANT", pid: 21, parentPid: 20, expectedPort: 5173 }), descriptor({ label: "VITE_REVIEWER", pid: 22, parentPid: 20, expectedPort: 5174 })];
  const ready = { preExistingListeners: [], backendHealth: { statusCode: 200, redirected: false, body: { status: "UP" } }, listeners: [{ port: 8080, address: "127.0.0.1", pid: 11 }, { port: 5173, address: "127.0.0.1", pid: 21 }, { port: 5174, address: "::1", pid: 22 }], harnessReady: true, harnessSignal: "HARNESS_READY", identities, processes };
  assert.equal(orchestrator.validateReadiness(ready).harnessReady, true);
  assert.throws(() => orchestrator.validateReadiness({ ...ready, preExistingListeners: [8080] }), orchestrator.OrchestratorError);
  assert.throws(() => orchestrator.validateReadiness({ ...ready, listeners: ready.listeners.map((item, index) => index === 0 ? { ...item, address: "0.0.0.0" } : item) }), orchestrator.OrchestratorError);
  assert.throws(() => orchestrator.validateReadiness({ ...ready, listeners: ready.listeners.map((item, index) => index === 0 ? { ...item, pid: 999 } : item) }), orchestrator.OrchestratorError);
  assert.throws(() => orchestrator.validateReadiness({ ...ready, listeners: ready.listeners.map((item, index) => index === 1 ? { ...item, pid: 11 } : item) }), orchestrator.OrchestratorError);
  assert.throws(() => orchestrator.validateReadiness({ ...ready, identities: { ...identities, REVIEWER: { ...identities.REVIEWER, subject: "foreign" } } }), orchestrator.OrchestratorError);
  assert.throws(() => orchestrator.validateListener({ port: 8080, address: "127.0.0.1", pid: 99 }, 8080, [10]), orchestrator.OrchestratorError);
});

function documentSummary(status = "UNVERIFIED") {
  return {
    id: UUIDS.documentId,
    fileName: orchestrator.FIXTURES.evidence.fileName,
    mediaType: "text/csv",
    byteSize: orchestrator.FIXTURES.evidence.byteSize,
    checksumSha256: orchestrator.FIXTURES.evidence.sha256,
    sourceLabel: orchestrator.FIXTURES.evidence.sourceLabel,
    documentDate: orchestrator.FIXTURES.evidence.documentDate,
    createdAt: DOCUMENT_CREATED_AT,
    createdByUserId: orchestrator.ACTORS.ACCOUNTANT.userId,
    verificationStatus: status,
    reviewComment: null,
    reviewedAt: status === "VERIFIED" ? DOCUMENT_REVIEWED_AT : null,
    reviewedByUserId: status === "VERIFIED" ? orchestrator.ACTORS.REVIEWER.userId : null
  };
}

function workpaperItem(status, documentStatus = undefined, reviewed = false) {
  const documents = documentStatus === undefined ? [] : [documentSummary(documentStatus)];
  const anchor = orchestrator.WORKPAPER_ANCHORS[0];
  return {
    ...anchor,
    workpaper: {
      id: UUIDS.workpaperId,
      noteText: `Synthetic 043c bank reconciliation ${RUN_ID}`,
      status,
      reviewComment: null,
      basisImportVersion: 1,
      basisTaxonomyVersion: 2,
      createdAt: WORKPAPER_CREATED_AT,
      createdByUserId: orchestrator.ACTORS.ACCOUNTANT.userId,
      updatedAt: status === "DRAFT" ? WORKPAPER_CREATED_AT : reviewed ? WORKPAPER_REVIEWED_AT : WORKPAPER_READY_AT,
      updatedByUserId: reviewed ? orchestrator.ACTORS.REVIEWER.userId : orchestrator.ACTORS.ACCOUNTANT.userId,
      reviewedAt: reviewed ? WORKPAPER_REVIEWED_AT : null,
      reviewedByUserId: reviewed ? orchestrator.ACTORS.REVIEWER.userId : null,
      evidences: []
    },
    documents,
    documentVerificationSummary: documentStatus === undefined
      ? { documentsCount: 0, unverifiedCount: 0, verifiedCount: 0, rejectedCount: 0 }
      : { documentsCount: 1, unverifiedCount: documentStatus === "UNVERIFIED" ? 1 : 0, verifiedCount: documentStatus === "VERIFIED" ? 1 : 0, rejectedCount: 0 }
  };
}

function emptyWorkpaperItems() {
  return orchestrator.WORKPAPER_ANCHORS.map((anchor) => ({ ...anchor, workpaper: null, documents: [], documentVerificationSummary: null }));
}

function mappingTargets() {
  return orchestrator.MAPPING_TARGETS_V2.map((target) => ({ ...target }));
}

function controlsReadyBody() {
  return { closingFolderId: UUIDS.folderId, closingFolderStatus: "DRAFT", readiness: "READY", latestImportPresent: true, latestImportVersion: 1, mappingSummary: { total: 7, mapped: 7, unmapped: 0 }, unmappedAccounts: [], controls: [{ code: "LATEST_VALID_BALANCE_IMPORT_PRESENT", status: "PASS", severity: "BLOCKER", message: "Latest valid balance import version 1 is available." }, { code: "MANUAL_MAPPING_COMPLETE_ON_LATEST_IMPORT", status: "PASS", severity: "BLOCKER", message: "Manual mapping is complete on the latest import." }], nextAction: null };
}

function financialSummaryReadyBody() {
  return { closingFolderId: UUIDS.folderId, closingFolderStatus: "DRAFT", readiness: "READY", statementState: "PREVIEW_READY", latestImportVersion: 1, coverage: { totalLines: 7, mappedLines: 7, unmappedLines: 0, mappedShare: "1" }, blockers: [], nextAction: null, unmappedBalanceImpact: { debitTotal: "0", creditTotal: "0", netDebitMinusCredit: "0" }, balanceSheetSummary: { assets: "137000", liabilities: "29000", equity: "30000", currentPeriodResult: "78000", totalAssets: "137000", totalLiabilitiesAndEquity: "137000" }, incomeStatementSummary: { revenue: "90000", expenses: "12000", netResult: "78000" } };
}

function structuredStatementsReadyBody() {
  const group = (code, label, total, breakdownCode, breakdownLabel) => ({ code, label, total, breakdowns: [{ code: breakdownCode, label: breakdownLabel, breakdownType: "SECTION", total }] });
  return {
    closingFolderId: UUIDS.folderId, closingFolderStatus: "DRAFT", readiness: "READY", statementState: "PREVIEW_READY", presentationType: "STRUCTURED_PREVIEW", isStatutory: false, taxonomyVersion: 2, latestImportVersion: 1, coverage: { totalLines: 7, mappedLines: 7, unmappedLines: 0, mappedShare: "1" }, blockers: [], nextAction: null,
    balanceSheet: { groups: [group("BS.ASSET", "Asset", "137000", "BS.ASSET.CURRENT_SECTION", "Current assets"), group("BS.LIABILITY", "Liability", "29000", "BS.LIABILITY.CURRENT_SECTION", "Current liabilities"), group("BS.EQUITY", "Equity", "30000", "BS.EQUITY.CORE_SECTION", "Equity")], totals: { totalAssets: "137000", totalLiabilities: "29000", totalEquity: "30000", currentPeriodResult: "78000", totalLiabilitiesAndEquity: "137000" } },
    incomeStatement: { groups: [group("PL.REVENUE", "Revenue", "90000", "PL.REVENUE.OPERATING_SECTION", "Operating revenue"), group("PL.EXPENSE", "Expense", "12000", "PL.EXPENSE.OPERATING_SECTION", "Operating expenses")], totals: { totalRevenue: "90000", totalExpenses: "12000", netResult: "78000" } }
  };
}

function responseFor(spec) {
  const response = (status, json, headers = {}, bytes = null) => ({ status, headers, json, bytes });
  switch (spec.responseContract) {
    case "ME_ACCOUNTANT": return response(200, orchestrator.expectedMePayload("ACCOUNTANT"));
    case "ME_REVIEWER": return response(200, orchestrator.expectedMePayload("REVIEWER"));
    case "CLOSING_FOLDER_CREATED": return response(201, { id: UUIDS.folderId, tenantId: orchestrator.TENANT_ID, ...spec.body, status: "DRAFT", archivedAt: null, archivedByUserId: null, createdAt: FOLDER_CREATED_AT, updatedAt: FOLDER_CREATED_AT }, { Location: `/api/closing-folders/${UUIDS.folderId}` });
    case "BALANCE_IMPORT_CREATED": return response(201, { importId: UUIDS.importId, version: 1, closingFolderId: UUIDS.folderId, importedAt: IMPORTED_AT, importedByUserId: orchestrator.ACTORS.ACCOUNTANT.userId, rowCount: 7, totalDebit: "149000", totalCredit: "149000", diffSummary: { previousVersion: null, addedCount: 7, removedCount: 0, changedCount: 0 } });
    case "MANUAL_MAPPING_PROJECTION": return response(200, { closingFolderId: UUIDS.folderId, taxonomyVersion: 2, latestImportVersion: 1, targets: mappingTargets(), lines: orchestrator.FROZEN_BALANCE_LINES.map((line) => ({ ...line })), mappings: orchestrator.MAPPINGS.map((mapping) => ({ ...mapping })), summary: { total: 7, mapped: 7, unmapped: 0 } });
    case "CONTROLS_READY": return response(200, controlsReadyBody());
    case "FINANCIAL_SUMMARY_READY": return response(200, financialSummaryReadyBody());
    case "STRUCTURED_STATEMENTS_READY": return response(200, structuredStatementsReadyBody());
    case "WORKPAPERS_EMPTY": return response(200, { closingFolderId: UUIDS.folderId, closingFolderStatus: "DRAFT", readiness: "READY", latestImportVersion: 1, blockers: [], nextAction: null, items: emptyWorkpaperItems(), staleWorkpapers: [], summaryCounts: { totalCurrentAnchors: 5, withWorkpaperCount: 0, readyForReviewCount: 0, reviewedCount: 0, staleCount: 0, missingCount: 5 } });
    case "WORKPAPER_DRAFT_CREATED": return response(201, workpaperItem("DRAFT"));
    case "DOCUMENT_CREATED": return response(201, documentSummary("UNVERIFIED"));
    case "WORKPAPER_READY_UPDATED": return response(200, workpaperItem("READY_FOR_REVIEW", "UNVERIFIED"));
    case "WORKPAPERS_REVIEWER_READY": return response(200, { closingFolderId: UUIDS.folderId, closingFolderStatus: "DRAFT", readiness: "READY", latestImportVersion: 1, blockers: [], nextAction: null, summaryCounts: { totalCurrentAnchors: 5, withWorkpaperCount: 1, readyForReviewCount: 1, reviewedCount: 0, staleCount: 0, missingCount: 4 }, items: [workpaperItem("READY_FOR_REVIEW", "UNVERIFIED"), ...emptyWorkpaperItems().slice(1)], staleWorkpapers: [] });
    case "DOCUMENT_VERIFIED": return response(200, documentSummary("VERIFIED"));
    case "WORKPAPER_REVIEWED": return response(200, workpaperItem("REVIEWED", "VERIFIED", true));
    case "EXPORT_CREATED": {
      const fileName = `closing-folder-${UUIDS.folderId}-export-pack-${UUIDS.exportPackId}.zip`;
      return response(201, { exportPackId: UUIDS.exportPackId, closingFolderId: UUIDS.folderId, fileName, mediaType: "application/zip", byteSize: EXPORT_BYTES.length, checksumSha256: EXPORT_HASH, basisImportVersion: 1, basisTaxonomyVersion: 2, createdAt: EXPORT_CREATED_AT, createdByUserId: orchestrator.ACTORS.ACCOUNTANT.userId }, { Location: `/api/closing-folders/${UUIDS.folderId}/export-packs/${UUIDS.exportPackId}` });
    }
    case "EXPORT_CONTENT": return response(200, null, { "Content-Type": "application/zip", "Content-Length": String(EXPORT_BYTES.length), "Cache-Control": "private, no-store", "Content-Disposition": `attachment; filename="closing-folder-${UUIDS.folderId}-export-pack-${UUIDS.exportPackId}.zip"` }, Buffer.from(EXPORT_BYTES));
    default:
      if (spec.responseContract.startsWith("MANUAL_MAPPING_CREATED_")) return response(201, { ...spec.body });
      throw new Error(`Unknown fake contract ${spec.responseContract}`);
  }
}

test("H01 the closed task plan has T00-T15 in order and exactly 24 non-retried HTTP requests", async () => {
  const requests = [];
  const tasks = [];
  const result = await orchestrator.executeHttpTaskContract({
    runId: RUN_ID,
    requestAdapter: async (spec) => {
      requests.push(spec);
      return responseFor(spec);
    },
    onTask: async ({ taskId }) => tasks.push(taskId)
  });
  assert.equal(requests.length, 24);
  assert.equal(new Set(requests.map((spec) => spec.requestId)).size, 24);
  assert.deepEqual(tasks, orchestrator.TASK_IDS.slice(3, 15));
  assert.equal(result.folderId, UUIDS.folderId);
  assert.equal(result.documentId, UUIDS.documentId);
  assert.equal(result.exportPackId, UUIDS.exportPackId);
  assert.deepEqual(result.exportBytes, EXPORT_BYTES);
});

test("H02 actors, headers, exact T07 suffixes and the ZIP Accept exception are closed", () => {
  const requests = orchestrator.buildTaskDescriptors({ runId: RUN_ID, ...UUIDS }).flatMap((task) => task.requests);
  const t03 = requests.filter((spec) => spec.taskId === "T03");
  assert.equal(t03.length, 2);
  assert.equal(t03.every((spec) => !Object.hasOwn(spec.headers, "X-Tenant-Id")), true);
  assert.equal(requests.filter((spec) => spec.taskId !== "T03").every((spec) => spec.headers["X-Tenant-Id"] === orchestrator.TENANT_ID), true);
  assert.equal(requests.every((spec) => !Object.keys(spec.headers).some((name) => name.toLowerCase() === "authorization")), true);
  assert.deepEqual(requests.filter((spec) => spec.taskId === "T07").map((spec) => spec.requestId.slice(RUN_ID.length + 1)), Object.values(orchestrator.T07_REQUEST_SUFFIXES));
  const download = requests.find((spec) => spec.responseContract === "EXPORT_CONTENT");
  assert.equal(download.headers.Accept, "application/zip");
  assert.equal(requests.filter((spec) => spec !== download).every((spec) => spec.headers.Accept === "application/json"), true);
});

test("H03 JSON and multipart bodies are exact, ordered and never set a multipart content type", () => {
  const requests = orchestrator.buildTaskDescriptors({ runId: RUN_ID, ...UUIDS }).flatMap((task) => task.requests);
  const balance = requests.find((spec) => spec.taskId === "T05");
  assert.deepEqual(balance.multipartParts, [{ name: "file", kind: "FILE", fileName: orchestrator.FIXTURES.balance.fileName, mediaType: "text/csv", byteSize: 359, sha256: orchestrator.FIXTURES.balance.sha256 }]);
  assert.equal(Object.keys(balance.headers).some((name) => name.toLowerCase() === "content-type"), false);
  const evidence = requests.find((spec) => spec.taskId === "T09");
  assert.deepEqual(evidence.multipartParts.map((part) => part.name), ["file", "sourceLabel", "documentDate"]);
  assert.equal(evidence.multipartParts[0].fileName, "evidence-bank-reconciliation-fy2025-v1.csv");
  assert.equal(evidence.multipartParts[1].value, "Ritomer internal synthetic fixture 043");
  assert.equal(evidence.multipartParts[2].value, "2025-12-31");
  const createFolder = requests.find((spec) => spec.taskId === "T04");
  assert.deepEqual(createFolder.body, { name: `043c ${RUN_ID} synthetic FY2025`, periodStartOn: "2025-01-01", periodEndOn: "2025-12-31", externalRef: `043c-${RUN_ID}` });
});

test("H03a the full taxonomy-v2 target catalog is frozen by independent cardinality and canonical hash", () => {
  assert.equal(orchestrator.MAPPING_TARGETS_V2.length, 39);
  assert.equal(orchestrator.sha256Hex(orchestrator.canonicalJson(orchestrator.MAPPING_TARGETS_V2)), "69c01e755274e002ceb44928331e6256836ee663cf8453d13e822ab51cf8f699");
  assert.deepEqual(orchestrator.MAPPING_TARGETS_V2.map((target) => target.displayOrder), [...orchestrator.MAPPING_TARGETS_V2].map((target) => target.displayOrder).sort((left, right) => left - right));
});

test("H03b independent table matches all twenty-four exact request contracts", () => {
  const folderBase = `/api/closing-folders/${UUIDS.folderId}`;
  const anchorPath = `${folderBase}/workpapers/BS.ASSET.CURRENT_SECTION`;
  const expectedMappings = [
    ["1000", "BS.ASSET.CASH_AND_EQUIVALENTS"],
    ["1100", "BS.ASSET.TRADE_RECEIVABLES"],
    ["1200", "BS.ASSET.PREPAIDS_AND_OTHER_CURRENT"],
    ["2000", "BS.LIABILITY.TRADE_PAYABLES"],
    ["2800", "BS.EQUITY.RETAINED_EARNINGS"],
    ["3000", "PL.REVENUE.OPERATING_REVENUE"],
    ["4000", "PL.EXPENSE.OTHER_OPERATING_EXPENSES"]
  ];
  const expected = [];
  const add = ({ taskId, actor, method, requestPath, suffix, expectedStatus, responseContract, bodyKind = "NONE", body = null, multipartParts = null, tenant = true, accept = "application/json", extraHeaders = {} }) => {
    const requestId = `${RUN_ID}-${suffix}`;
    const headers = { Accept: accept, "X-Request-Id": requestId };
    if (tenant) headers["X-Tenant-Id"] = orchestrator.TENANT_ID;
    if (bodyKind === "JSON") headers["Content-Type"] = "application/json";
    Object.assign(headers, extraHeaders);
    expected.push({ taskId, actor, origin: actor === "ACCOUNTANT" ? orchestrator.ACCOUNTANT_ORIGIN : orchestrator.REVIEWER_ORIGIN, method, path: requestPath, requestId, headers, bodyKind, body, multipartParts, expectedStatus, responseContract });
  };
  add({ taskId: "T03", actor: "ACCOUNTANT", method: "GET", requestPath: "/api/me", suffix: "T03-ACCOUNTANT-ME", tenant: false, expectedStatus: 200, responseContract: "ME_ACCOUNTANT" });
  add({ taskId: "T03", actor: "REVIEWER", method: "GET", requestPath: "/api/me", suffix: "T03-REVIEWER-ME", tenant: false, expectedStatus: 200, responseContract: "ME_REVIEWER" });
  add({ taskId: "T04", actor: "ACCOUNTANT", method: "POST", requestPath: "/api/closing-folders", suffix: "T04-CREATE-FOLDER", bodyKind: "JSON", body: { name: `043c ${RUN_ID} synthetic FY2025`, periodStartOn: "2025-01-01", periodEndOn: "2025-12-31", externalRef: `043c-${RUN_ID}` }, expectedStatus: 201, responseContract: "CLOSING_FOLDER_CREATED" });
  add({ taskId: "T05", actor: "ACCOUNTANT", method: "POST", requestPath: `${folderBase}/imports/balance`, suffix: "T05-IMPORT-BALANCE", bodyKind: "MULTIPART", multipartParts: [{ name: "file", kind: "FILE", fileName: "balance-fy2025-v1.csv", mediaType: "text/csv", byteSize: 359, sha256: "2295b620704c2cfcdf1e37660388bd84a1d261c0b7697edf5bce21d0c04f9855" }], expectedStatus: 201, responseContract: "BALANCE_IMPORT_CREATED" });
  for (const [accountCode, targetCode] of expectedMappings) add({ taskId: "T06", actor: "ACCOUNTANT", method: "PUT", requestPath: `${folderBase}/mappings/manual`, suffix: `T06-MAP-${accountCode}`, bodyKind: "JSON", body: { accountCode, targetCode }, expectedStatus: 201, responseContract: `MANUAL_MAPPING_CREATED_${accountCode}` });
  add({ taskId: "T06", actor: "ACCOUNTANT", method: "GET", requestPath: `${folderBase}/mappings/manual`, suffix: "T06-READ-MAPPINGS", expectedStatus: 200, responseContract: "MANUAL_MAPPING_PROJECTION" });
  for (const [requestPath, suffix, responseContract] of [
    [`${folderBase}/controls`, "T07-CONTROLS", "CONTROLS_READY"],
    [`${folderBase}/financial-summary`, "T07-FINANCIAL-SUMMARY", "FINANCIAL_SUMMARY_READY"],
    [`${folderBase}/financial-statements/structured`, "T07-FINANCIAL-STATEMENTS", "STRUCTURED_STATEMENTS_READY"],
    [`${folderBase}/workpapers`, "T07-WORKPAPERS", "WORKPAPERS_EMPTY"]
  ]) add({ taskId: "T07", actor: "ACCOUNTANT", method: "GET", requestPath, suffix, expectedStatus: 200, responseContract });
  const noteText = `Synthetic 043c bank reconciliation ${RUN_ID}`;
  add({ taskId: "T08", actor: "ACCOUNTANT", method: "PUT", requestPath: anchorPath, suffix: "T08-CREATE-WORKPAPER", bodyKind: "JSON", body: { noteText, status: "DRAFT", evidences: [] }, expectedStatus: 201, responseContract: "WORKPAPER_DRAFT_CREATED" });
  add({ taskId: "T09", actor: "ACCOUNTANT", method: "POST", requestPath: `${anchorPath}/documents`, suffix: "T09-UPLOAD-DOCUMENT", bodyKind: "MULTIPART", multipartParts: [
    { name: "file", kind: "FILE", fileName: "evidence-bank-reconciliation-fy2025-v1.csv", mediaType: "text/csv", byteSize: 184, sha256: "f5bb9a7ec0df043a8e845d10f029c2bdd6dd7ea2f62f9935f48cdc0d95339b27" },
    { name: "sourceLabel", kind: "TEXT", value: "Ritomer internal synthetic fixture 043" },
    { name: "documentDate", kind: "TEXT", value: "2025-12-31" }
  ], expectedStatus: 201, responseContract: "DOCUMENT_CREATED" });
  add({ taskId: "T10", actor: "ACCOUNTANT", method: "PUT", requestPath: anchorPath, suffix: "T10-READY-WORKPAPER", bodyKind: "JSON", body: { noteText, status: "READY_FOR_REVIEW", evidences: [] }, expectedStatus: 200, responseContract: "WORKPAPER_READY_UPDATED" });
  add({ taskId: "T11", actor: "REVIEWER", method: "GET", requestPath: `${folderBase}/workpapers`, suffix: "T11-REVIEWER-WORKPAPERS", expectedStatus: 200, responseContract: "WORKPAPERS_REVIEWER_READY" });
  add({ taskId: "T12", actor: "REVIEWER", method: "POST", requestPath: `${folderBase}/documents/${UUIDS.documentId}/verification-decision`, suffix: "T12-VERIFY-DOCUMENT", bodyKind: "JSON", body: { decision: "VERIFIED", comment: null }, expectedStatus: 200, responseContract: "DOCUMENT_VERIFIED" });
  add({ taskId: "T13", actor: "REVIEWER", method: "POST", requestPath: `${anchorPath}/review-decision`, suffix: "T13-REVIEW-WORKPAPER", bodyKind: "JSON", body: { decision: "REVIEWED", comment: null }, expectedStatus: 200, responseContract: "WORKPAPER_REVIEWED" });
  add({ taskId: "T14", actor: "ACCOUNTANT", method: "POST", requestPath: `${folderBase}/export-packs`, suffix: "T14-CREATE-EXPORT", extraHeaders: { "Idempotency-Key": `${RUN_ID}-T14-EXPORT` }, expectedStatus: 201, responseContract: "EXPORT_CREATED" });
  add({ taskId: "T14", actor: "ACCOUNTANT", method: "GET", requestPath: `${folderBase}/export-packs/${UUIDS.exportPackId}/content`, suffix: "T14-DOWNLOAD-EXPORT", accept: "application/zip", expectedStatus: 200, responseContract: "EXPORT_CONTENT" });
  const actual = orchestrator.buildTaskDescriptors({ runId: RUN_ID, ...UUIDS }).flatMap((task) => task.requests);
  assert.equal(expected.length, 24);
  assert.deepEqual(actual, expected);
});

test("H04 usefulness is closed to integer 1..5 and four non-free-text observations", () => {
  for (const usefulnessScore of [1, 5]) for (const observationCode of orchestrator.USEFULNESS_OBSERVATION_CODES) assert.doesNotThrow(() => orchestrator.validateUsefulness({ usefulnessScore, observationCode }));
  for (const usefulnessScore of [0, 6, 1.5, "5"]) assert.throws(() => orchestrator.validateUsefulness({ usefulnessScore, observationCode: "NO_FRICTION" }), orchestrator.OrchestratorError);
  assert.throws(() => orchestrator.validateUsefulness({ usefulnessScore: 3, observationCode: "looked good" }), orchestrator.OrchestratorError);
  assert.throws(() => orchestrator.validateUsefulness({ usefulnessScore: 3, observationCode: "NO_FRICTION", comment: "free text" }), orchestrator.OrchestratorError);
});

test("H05 201-only creates reject mapping and export replay/no-op status 200", () => {
  const plan = orchestrator.buildTaskDescriptors({ runId: RUN_ID, ...UUIDS });
  const mapping = plan.find((task) => task.taskId === "T06").requests[0];
  const exportCreate = plan.find((task) => task.taskId === "T14").requests[0];
  assert.throws(() => orchestrator.validateTaskResponse(mapping, { ...responseFor(mapping), status: 200 }, {}), orchestrator.OrchestratorError);
  assert.throws(() => orchestrator.validateTaskResponse(exportCreate, { ...responseFor(exportCreate), status: 200 }, { folderId: UUIDS.folderId }), orchestrator.OrchestratorError);
});

test("H06 every HTTP boundary stops once, without retrying the failed request", async () => {
  for (let failureIndex = 0; failureIndex < 24; failureIndex += 1) {
    let calls = 0;
    await assert.rejects(orchestrator.executeHttpTaskContract({
      runId: RUN_ID,
      requestAdapter: async (spec) => {
        const index = calls++;
        if (index === failureIndex) throw new orchestrator.OrchestratorError("INJECTED_HTTP_FAILURE");
        return responseFor(spec);
      }
    }), (error) => error.code === "INJECTED_HTTP_FAILURE");
    assert.equal(calls, failureIndex + 1);
  }
});

test("H06b every response boundary rejects an unexpected status with the exact task stop code", async () => {
  for (let failureIndex = 0; failureIndex < 24; failureIndex += 1) {
    let calls = 0;
    let failedTaskId;
    await assert.rejects(orchestrator.executeHttpTaskContract({
      runId: RUN_ID,
      requestAdapter: async (spec) => {
        const index = calls++;
        const valid = responseFor(spec);
        if (index !== failureIndex) return valid;
        failedTaskId = spec.taskId;
        return { ...valid, status: spec.expectedStatus === 200 ? 201 : 200 };
      }
    }), (error) => error.code === `${failedTaskId}_HTTP_STATUS_INVALID`);
    assert.equal(calls, failureIndex + 1);
  }
});

test("H07 response validators kill wrong identity, count, decimal type, transition and ZIP mutants", () => {
  const plan = orchestrator.buildTaskDescriptors({ runId: RUN_ID, ...UUIDS });
  const me = plan.find((task) => task.taskId === "T03").requests[0];
  const meResponse = responseFor(me);
  assert.throws(() => orchestrator.validateTaskResponse(me, { ...meResponse, json: { ...meResponse.json, effectiveRoles: ["REVIEWER"] } }, {}), orchestrator.OrchestratorError);
  const importRequest = plan.find((task) => task.taskId === "T05").requests[0];
  const importResponse = responseFor(importRequest);
  assert.throws(() => orchestrator.validateTaskResponse(importRequest, { ...importResponse, json: { ...importResponse.json, totalDebit: 149000 } }, { folderId: UUIDS.folderId }), orchestrator.OrchestratorError);
  const ready = plan.find((task) => task.taskId === "T10").requests[0];
  assert.throws(() => orchestrator.validateTaskResponse(ready, responseFor(ready), { folderId: UUIDS.folderId, workpaperId: UUIDS.workpaperId }), orchestrator.OrchestratorError);
  const content = plan.find((task) => task.taskId === "T14").requests[1];
  const contentResponse = responseFor(content);
  assert.throws(() => orchestrator.validateTaskResponse(content, { ...contentResponse, headers: { ...contentResponse.headers, "Cache-Control": "private,no-store" } }, { exportByteSize: EXPORT_BYTES.length, exportSha256: EXPORT_HASH }), orchestrator.OrchestratorError);
});

test("H08 projection, anchor identity, document identity and real transition mutants are rejected", async () => {
  const mutants = new Map([
    ["CLOSING_FOLDER_CREATED", (body) => { delete body.createdAt; return body; }],
    ["BALANCE_IMPORT_CREATED", (body) => { delete body.importedByUserId; return body; }],
    ["MANUAL_MAPPING_PROJECTION", (body) => ({ ...body, lines: Array.from({ length: 7 }, () => ({ garbage: true })) })],
    ["CONTROLS_READY", (body) => { delete body.controls[0].message; return body; }],
    ["FINANCIAL_SUMMARY_READY", (body) => ({ ...body, unmappedBalanceImpact: { ...body.unmappedBalanceImpact, debitTotal: "1" } })],
    ["STRUCTURED_STATEMENTS_READY", (body) => { body.balanceSheet.groups[0].label = "Wrong"; return body; }],
    ["WORKPAPERS_EMPTY", (body) => ({ ...body, items: Array.from({ length: 5 }, () => structuredClone(body.items[0])) })],
    ["WORKPAPERS_REVIEWER_READY", (body) => ({ ...body, items: [structuredClone(body.items[0])] })],
    ["WORKPAPER_READY_UPDATED", (body) => ({ ...body, workpaper: { ...body.workpaper, status: "DRAFT" } })],
    ["DOCUMENT_VERIFIED", (body) => ({ ...body, verificationStatus: "UNVERIFIED", reviewedAt: null, reviewedByUserId: null })],
    ["WORKPAPER_REVIEWED", (body) => ({ ...body, workpaper: { ...body.workpaper, status: "READY_FOR_REVIEW", reviewedAt: null, reviewedByUserId: null, updatedByUserId: orchestrator.ACTORS.ACCOUNTANT.userId } })],
    ["EXPORT_CREATED", (body) => { delete body.fileName; return body; }]
  ]);
  for (const [contract, mutate] of mutants) {
    await assert.rejects(orchestrator.executeHttpTaskContract({
      runId: RUN_ID,
      requestAdapter: async (spec) => {
        const valid = responseFor(spec);
        return spec.responseContract === contract ? { ...valid, json: mutate(structuredClone(valid.json)) } : valid;
      }
    }), orchestrator.OrchestratorError, contract);
  }
  for (const mutation of [
    (body) => { body.items[0].documents[0].id = "77777777-7777-4777-8777-777777777777"; },
    (body) => { body.items[0].workpaper.id = "77777777-7777-4777-8777-777777777777"; },
    (body) => { body.items[0].documents[0].createdByUserId = orchestrator.ACTORS.REVIEWER.userId; }
  ]) {
    await assert.rejects(orchestrator.executeHttpTaskContract({
      runId: RUN_ID,
      requestAdapter: async (spec) => {
        const valid = responseFor(spec);
        if (spec.responseContract !== "WORKPAPERS_REVIEWER_READY") return valid;
        const body = structuredClone(valid.json);
        mutation(body);
        return { ...valid, json: body };
      }
    }), orchestrator.OrchestratorError);
  }
  for (const mutateTargets of [
    (targets) => targets.slice(1),
    (targets) => [...targets, structuredClone(targets[0])],
    (targets) => [targets[1], targets[0], ...targets.slice(2)],
    (targets) => targets.map((target, index) => index === 6 ? { ...target, displayOrder: 999 } : target)
  ]) {
    await assert.rejects(orchestrator.executeHttpTaskContract({
      runId: RUN_ID,
      requestAdapter: async (spec) => {
        const valid = responseFor(spec);
        if (spec.responseContract !== "MANUAL_MAPPING_PROJECTION") return valid;
        return { ...valid, json: { ...valid.json, targets: mutateTargets(structuredClone(valid.json.targets)) } };
      }
    }), orchestrator.OrchestratorError);
  }
});

function cloneHttpResponse(response) {
  return {
    status: response.status,
    headers: { ...response.headers },
    json: response.json === null ? null : structuredClone(response.json),
    bytes: Buffer.isBuffer(response.bytes) ? Buffer.from(response.bytes) : response.bytes
  };
}

function valueAtPath(root, path) {
  return path.reduce((value, segment) => value[segment], root);
}

function setValueAtPath(root, path, value) {
  const parent = path.slice(0, -1).reduce((candidate, segment) => candidate[segment], root);
  parent[path.at(-1)] = value;
}

function deleteValueAtPath(root, path) {
  const parent = path.slice(0, -1).reduce((candidate, segment) => candidate[segment], root);
  delete parent[path.at(-1)];
}

function mutatedLeaf(value) {
  if (value === null) return "MUTANT_NOT_NULL";
  if (typeof value === "string") return `${value}__MUTANT`;
  if (typeof value === "number") return value + 1;
  if (typeof value === "boolean") return !value;
  throw new Error(`No independent leaf mutant for ${typeof value}`);
}

function collectExactDtoMutationPaths(value, path = [], result = []) {
  if (Array.isArray(value)) {
    result.push({ path, replacement: value.length === 0 ? [{}] : value.slice(1), kind: "array-cardinality" });
    value.forEach((entry, index) => collectExactDtoMutationPaths(entry, [...path, index], result));
    return result;
  }
  if (value !== null && typeof value === "object") {
    Object.entries(value).forEach(([key, entry]) => collectExactDtoMutationPaths(entry, [...path, key], result));
    return result;
  }
  result.push({ path, replacement: mutatedLeaf(value), kind: "leaf" });
  return result;
}

function responseMutantMatrix() {
  const plan = orchestrator.buildTaskDescriptors({ runId: RUN_ID, ...UUIDS });
  const requests = plan.flatMap((task) => task.requests);
  const cases = [];
  const add = (name, contract, expectedCode, mutate) => cases.push({ name, contract, expectedCode, mutate });
  const addJsonSet = (contract, path, replacement, expectedCode, name = path.join(".")) => add(
    `${contract} ${name}`,
    contract,
    expectedCode,
    (response) => {
      const current = valueAtPath(response.json, path);
      setValueAtPath(response.json, path, typeof replacement === "function" ? replacement(current) : replacement);
    }
  );
  const addJsonDelete = (contract, path, expectedCode) => add(
    `${contract} missing ${path.join(".")}`,
    contract,
    expectedCode,
    (response) => deleteValueAtPath(response.json, path)
  );
  const addExactDto = (contract, body, expectedCode) => {
    for (const mutant of collectExactDtoMutationPaths(body)) {
      addJsonSet(contract, mutant.path, structuredClone(mutant.replacement), expectedCode, `${mutant.kind} ${mutant.path.join(".") || "root"}`);
    }
    addJsonSet(contract, ["unexpectedDtoField"], true, expectedCode, "unexpected DTO field");
  };

  const representativeByTask = new Map();
  for (const spec of requests.filter((candidate) => Number(candidate.taskId.slice(1)) >= 4)) {
    representativeByTask.set(spec.taskId, representativeByTask.get(spec.taskId) ?? spec.responseContract);
    add(`${spec.responseContract} unexpected status`, spec.responseContract, `${spec.taskId}_HTTP_STATUS_INVALID`, (response) => { response.status = response.status === 200 ? 201 : 200; });
  }
  for (const [taskId, contract] of representativeByTask) {
    add(`${taskId} response closed schema`, contract, `${taskId}_RESPONSE_SCHEMA_INVALID`, (response) => { response.unexpected = true; });
    add(`${taskId} response headers object`, contract, `${taskId}_HEADERS_INVALID`, (response) => { response.headers = null; });
  }

  addJsonSet("CLOSING_FOLDER_CREATED", ["id"], "not-a-uuid", "T04_FOLDER_ID_INVALID");
  addJsonSet("CLOSING_FOLDER_CREATED", ["createdAt"], "not-a-time", "T04_FOLDER_TIME_INVALID");
  addJsonSet("CLOSING_FOLDER_CREATED", ["updatedAt"], "not-a-time", "T04_FOLDER_TIME_INVALID");
  for (const [field, replacement] of [
    ["tenantId", "99999999-9999-4999-8999-999999999999"], ["name", "wrong name"], ["periodStartOn", "2025-01-02"],
    ["periodEndOn", "2025-12-30"], ["externalRef", "wrong-ref"], ["status", "ARCHIVED"], ["archivedAt", FOLDER_CREATED_AT],
    ["archivedByUserId", orchestrator.ACTORS.REVIEWER.userId], ["createdAt", "2026-08-10T09:57:00.000Z"]
  ]) addJsonSet("CLOSING_FOLDER_CREATED", [field], replacement, "T04_FOLDER_STATE_INVALID");
  addJsonDelete("CLOSING_FOLDER_CREATED", ["externalRef"], "T04_BODY_INVALID");
  addJsonSet("CLOSING_FOLDER_CREATED", ["unexpectedDtoField"], true, "T04_BODY_INVALID");
  add("CLOSING_FOLDER_CREATED Location", "CLOSING_FOLDER_CREATED", "T04_FOLDER_STATE_INVALID", (response) => { response.headers.Location = "/api/closing-folders/wrong"; });
  add("CLOSING_FOLDER_CREATED missing Location", "CLOSING_FOLDER_CREATED", "T04_FOLDER_STATE_INVALID", (response) => { delete response.headers.Location; });

  addJsonSet("BALANCE_IMPORT_CREATED", ["importId"], "not-a-uuid", "T05_IMPORT_ID_INVALID");
  addJsonSet("BALANCE_IMPORT_CREATED", ["importedAt"], "not-a-time", "T05_IMPORT_TIME_INVALID");
  for (const [field, replacement] of [
    ["version", 2], ["closingFolderId", "99999999-9999-4999-8999-999999999999"],
    ["importedByUserId", orchestrator.ACTORS.REVIEWER.userId], ["rowCount", 8], ["totalDebit", 149000], ["totalCredit", "149001"]
  ]) addJsonSet("BALANCE_IMPORT_CREATED", [field], replacement, "T05_IMPORT_STATE_INVALID");
  for (const [field, replacement] of [["previousVersion", 1], ["addedCount", 6], ["removedCount", 1], ["changedCount", 1]]) {
    addJsonSet("BALANCE_IMPORT_CREATED", ["diffSummary", field], replacement, "T05_DIFF_INVALID");
  }
  addJsonDelete("BALANCE_IMPORT_CREATED", ["diffSummary"], "T05_BODY_INVALID");
  addJsonSet("BALANCE_IMPORT_CREATED", ["unexpectedDtoField"], true, "T05_BODY_INVALID");

  const mappingContracts = requests.filter((spec) => spec.responseContract.startsWith("MANUAL_MAPPING_CREATED_")).map((spec) => spec.responseContract);
  for (const contract of mappingContracts) {
    addJsonSet(contract, ["accountCode"], "9999", "T06_MAPPING_RESPONSE_INVALID");
    addJsonSet(contract, ["targetCode"], "BS.ASSET.CASH_AND_EQUIVALENTS__MUTANT", "T06_MAPPING_RESPONSE_INVALID");
  }
  addJsonDelete(mappingContracts[0], ["targetCode"], "T06_MAPPING_RESPONSE_INVALID");
  addJsonSet(mappingContracts[0], ["unexpectedDtoField"], true, "T06_MAPPING_RESPONSE_INVALID");

  addJsonDelete("MANUAL_MAPPING_PROJECTION", ["summary"], "T06_PROJECTION_INVALID");
  addJsonSet("MANUAL_MAPPING_PROJECTION", ["unexpectedDtoField"], true, "T06_PROJECTION_INVALID");
  for (const [field, replacement] of [["closingFolderId", "99999999-9999-4999-8999-999999999999"], ["taxonomyVersion", 3], ["latestImportVersion", 2], ["targets", null], ["lines", null], ["mappings", null]]) {
    addJsonSet("MANUAL_MAPPING_PROJECTION", [field], replacement, "T06_PROJECTION_INVALID");
  }
  const targetMutants = {
    code: "WRONG.CODE", label: "Wrong label", statement: "WRONG_STATEMENT", summaryBucketCode: "WRONG.BUCKET", sectionCode: "WRONG.SECTION",
    normalSide: "WRONG_SIDE", granularity: "WRONG_GRANULARITY", deprecated: (value) => !value, selectable: (value) => !value, displayOrder: 999
  };
  for (const [field, replacement] of Object.entries(targetMutants)) addJsonSet("MANUAL_MAPPING_PROJECTION", ["targets", 0, field], replacement, "T06_TARGET_SET_INVALID");
  addJsonSet("MANUAL_MAPPING_PROJECTION", ["targets"], (targets) => targets.slice(1), "T06_TARGET_SET_INVALID", "target cardinality");
  addJsonSet("MANUAL_MAPPING_PROJECTION", ["targets"], (targets) => [targets[1], targets[0], ...targets.slice(2)], "T06_TARGET_SET_INVALID", "target ordering");
  for (const [field, replacement] of [["accountCode", "9999"], ["accountLabel", "Wrong label"], ["debit", "1"], ["credit", "1"]]) addJsonSet("MANUAL_MAPPING_PROJECTION", ["lines", 0, field], replacement, "T06_LINES_INVALID");
  for (const [field, replacement] of [["accountCode", "9999"], ["targetCode", "WRONG.TARGET"]]) addJsonSet("MANUAL_MAPPING_PROJECTION", ["mappings", 0, field], replacement, "T06_MAPPING_SET_INVALID");
  for (const [field, replacement] of [["total", 8], ["mapped", 6], ["unmapped", 1]]) addJsonSet("MANUAL_MAPPING_PROJECTION", ["summary", field], replacement, "T06_SUMMARY_INVALID");

  addExactDto("CONTROLS_READY", controlsReadyBody(), "T07_CONTROLS_INVALID");
  addExactDto("FINANCIAL_SUMMARY_READY", financialSummaryReadyBody(), "T07_FINANCIAL_SUMMARY_INVALID");
  addExactDto("STRUCTURED_STATEMENTS_READY", structuredStatementsReadyBody(), "T07_STRUCTURED_STATEMENTS_INVALID");

  addJsonDelete("WORKPAPERS_EMPTY", ["summaryCounts"], "T07_WORKPAPERS_INVALID");
  addJsonSet("WORKPAPERS_EMPTY", ["unexpectedDtoField"], true, "T07_WORKPAPERS_INVALID");
  for (const [field, replacement] of [
    ["closingFolderId", "99999999-9999-4999-8999-999999999999"], ["closingFolderStatus", "ARCHIVED"], ["readiness", "BLOCKED"],
    ["latestImportVersion", 2], ["blockers", [{}]], ["nextAction", {}], ["staleWorkpapers", [{}]]
  ]) addJsonSet("WORKPAPERS_EMPTY", [field], replacement, "T07_WORKPAPERS_INVALID");
  addJsonSet("WORKPAPERS_EMPTY", ["items"], (items) => items.slice(1), "WORKPAPER_ANCHORS_INVALID", "anchor cardinality");
  for (const [field, replacement] of [
    ["anchorCode", "WRONG"], ["anchorLabel", "Wrong"], ["summaryBucketCode", "WRONG"], ["statementKind", "WRONG"],
    ["breakdownType", "WRONG"], ["isCurrentStructure", false], ["workpaper", {}], ["documents", [{}]], ["documentVerificationSummary", {}]
  ]) addJsonSet("WORKPAPERS_EMPTY", ["items", 0, field], replacement, "WORKPAPER_ANCHORS_INVALID");
  for (const field of ["totalCurrentAnchors", "withWorkpaperCount", "readyForReviewCount", "reviewedCount", "staleCount", "missingCount"]) {
    addJsonSet("WORKPAPERS_EMPTY", ["summaryCounts", field], (value) => value + 1, "T07_WORKPAPER_COUNTS_INVALID");
  }

  const addDocumentCases = ({ contract, prefix, expectedStatus, priorIdentity }) => {
    addJsonSet(contract, [...prefix, "unexpectedDtoField"], true, "WORKPAPER_DOCUMENT_SCHEMA_INVALID");
    addJsonDelete(contract, [...prefix, "sourceLabel"], "WORKPAPER_DOCUMENT_SCHEMA_INVALID");
    addJsonSet(contract, [...prefix, "id"], "not-a-uuid", "WORKPAPER_DOCUMENT_ID_INVALID");
    if (priorIdentity) addJsonSet(contract, [...prefix, "id"], "77777777-7777-4777-8777-777777777777", "WORKPAPER_DOCUMENT_ID_CHANGED", "valid changed document id");
    for (const [field, replacement] of [
      ["fileName", "wrong.csv"], ["mediaType", "application/octet-stream"], ["byteSize", 185], ["checksumSha256", "0".repeat(64)],
      ["sourceLabel", "Wrong source"], ["documentDate", "2025-12-30"], ["createdByUserId", orchestrator.ACTORS.REVIEWER.userId], ["reviewComment", "unexpected"]
    ]) addJsonSet(contract, [...prefix, field], replacement, "WORKPAPER_DOCUMENT_METADATA_INVALID");
    addJsonSet(contract, [...prefix, "createdAt"], "not-a-time", "WORKPAPER_DOCUMENT_CREATED_AT_INVALID");
    if (priorIdentity) addJsonSet(contract, [...prefix, "createdAt"], "2026-08-10T10:00:31.000Z", "WORKPAPER_DOCUMENT_IDENTITY_CHANGED", "valid changed document creation time");
    addJsonSet(contract, [...prefix, "verificationStatus"], expectedStatus === "VERIFIED" ? "UNVERIFIED" : "VERIFIED", "WORKPAPER_DOCUMENT_STATUS_INVALID");
    if (expectedStatus === "VERIFIED") {
      addJsonSet(contract, [...prefix, "reviewedAt"], "not-a-time", "WORKPAPER_DOCUMENT_REVIEWED_AT_INVALID");
      addJsonSet(contract, [...prefix, "reviewedByUserId"], orchestrator.ACTORS.ACCOUNTANT.userId, "WORKPAPER_DOCUMENT_REVIEWER_INVALID");
    } else {
      addJsonSet(contract, [...prefix, "reviewedAt"], DOCUMENT_REVIEWED_AT, "WORKPAPER_DOCUMENT_REVIEW_STATE_INVALID");
      addJsonSet(contract, [...prefix, "reviewedByUserId"], orchestrator.ACTORS.REVIEWER.userId, "WORKPAPER_DOCUMENT_REVIEW_STATE_INVALID");
    }
  };

  const addWorkpaperItemCases = ({ contract, prefix = [], expectedStatus, priorIdentity, hasDocument, unchanged = false }) => {
    addJsonSet(contract, [...prefix, "unexpectedDtoField"], true, "WORKPAPER_ITEM_INVALID");
    addJsonDelete(contract, [...prefix, "anchorLabel"], "WORKPAPER_ITEM_INVALID");
    for (const [field, replacement] of [
      ["anchorCode", "WRONG"], ["anchorLabel", "Wrong"], ["summaryBucketCode", "WRONG"], ["statementKind", "WRONG"], ["breakdownType", "WRONG"], ["isCurrentStructure", false]
    ]) addJsonSet(contract, [...prefix, field], replacement, "WORKPAPER_ANCHOR_INVALID");
    addJsonSet(contract, [...prefix, "workpaper", "unexpectedDtoField"], true, "WORKPAPER_DETAILS_INVALID");
    addJsonDelete(contract, [...prefix, "workpaper", "noteText"], "WORKPAPER_DETAILS_INVALID");
    addJsonSet(contract, [...prefix, "workpaper", "id"], "not-a-uuid", "WORKPAPER_ID_INVALID");
    if (priorIdentity) addJsonSet(contract, [...prefix, "workpaper", "id"], "77777777-7777-4777-8777-777777777777", "WORKPAPER_ID_CHANGED", "valid changed workpaper id");
    for (const [field, replacement] of [
      ["noteText", "Wrong note"], ["status", expectedStatus === "DRAFT" ? "READY_FOR_REVIEW" : "DRAFT"], ["reviewComment", "unexpected"],
      ["basisImportVersion", 2], ["basisTaxonomyVersion", 3], ["createdByUserId", orchestrator.ACTORS.REVIEWER.userId], ["evidences", [{}]]
    ]) addJsonSet(contract, [...prefix, "workpaper", field], replacement, "WORKPAPER_STATE_INVALID");
    addJsonSet(contract, [...prefix, "workpaper", "createdAt"], "not-a-time", "WORKPAPER_CREATED_AT_INVALID");
    addJsonSet(contract, [...prefix, "workpaper", "updatedAt"], "not-a-time", "WORKPAPER_UPDATED_AT_INVALID");
    if (priorIdentity) addJsonSet(contract, [...prefix, "workpaper", "createdAt"], "2026-08-10T10:00:01.000Z", "WORKPAPER_IDENTITY_CHANGED", "valid changed workpaper creation time");
    if (expectedStatus === "REVIEWED") {
      addJsonSet(contract, [...prefix, "workpaper", "updatedByUserId"], orchestrator.ACTORS.ACCOUNTANT.userId, "WORKPAPER_REVIEWER_INVALID");
      addJsonSet(contract, [...prefix, "workpaper", "reviewedByUserId"], orchestrator.ACTORS.ACCOUNTANT.userId, "WORKPAPER_REVIEWER_INVALID");
      addJsonSet(contract, [...prefix, "workpaper", "reviewedAt"], "not-a-time", "WORKPAPER_REVIEWED_AT_INVALID");
    } else {
      addJsonSet(contract, [...prefix, "workpaper", "updatedByUserId"], orchestrator.ACTORS.REVIEWER.userId, "WORKPAPER_REVIEW_STATE_INVALID");
      addJsonSet(contract, [...prefix, "workpaper", "reviewedAt"], WORKPAPER_REVIEWED_AT, "WORKPAPER_REVIEW_STATE_INVALID");
      addJsonSet(contract, [...prefix, "workpaper", "reviewedByUserId"], orchestrator.ACTORS.REVIEWER.userId, "WORKPAPER_REVIEW_STATE_INVALID");
    }
    addJsonSet(contract, [...prefix, "documents"], hasDocument ? [] : [documentSummary("UNVERIFIED")], "WORKPAPER_DOCUMENTS_INVALID", "document cardinality");
    for (const field of ["documentsCount", "unverifiedCount", "verifiedCount", "rejectedCount"]) {
      addJsonSet(contract, [...prefix, "documentVerificationSummary", field], (value) => value + 1, "WORKPAPER_DOCUMENT_SUMMARY_INVALID");
    }
    if (unchanged) addJsonSet(contract, [...prefix, "workpaper", "updatedAt"], "2026-08-10T10:01:01.000Z", "WORKPAPER_UNEXPECTED_MUTATION", "reviewer-read workpaper mutation");
  };

  addWorkpaperItemCases({ contract: "WORKPAPER_DRAFT_CREATED", expectedStatus: "DRAFT", priorIdentity: false, hasDocument: false });
  addDocumentCases({ contract: "DOCUMENT_CREATED", prefix: [], expectedStatus: "UNVERIFIED", priorIdentity: false });
  addWorkpaperItemCases({ contract: "WORKPAPER_READY_UPDATED", expectedStatus: "READY_FOR_REVIEW", priorIdentity: true, hasDocument: true });
  addDocumentCases({ contract: "WORKPAPER_READY_UPDATED", prefix: ["documents", 0], expectedStatus: "UNVERIFIED", priorIdentity: true });

  addJsonDelete("WORKPAPERS_REVIEWER_READY", ["summaryCounts"], "T11_WORKPAPERS_INVALID");
  addJsonSet("WORKPAPERS_REVIEWER_READY", ["unexpectedDtoField"], true, "T11_WORKPAPERS_INVALID");
  for (const [field, replacement] of [
    ["closingFolderId", "99999999-9999-4999-8999-999999999999"], ["closingFolderStatus", "ARCHIVED"], ["readiness", "BLOCKED"],
    ["latestImportVersion", 2], ["blockers", [{}]], ["nextAction", {}], ["items", []], ["staleWorkpapers", [{}]]
  ]) addJsonSet("WORKPAPERS_REVIEWER_READY", [field], replacement, "T11_WORKPAPERS_INVALID");
  for (const field of ["totalCurrentAnchors", "withWorkpaperCount", "readyForReviewCount", "reviewedCount", "staleCount", "missingCount"]) {
    addJsonSet("WORKPAPERS_REVIEWER_READY", ["summaryCounts", field], (value) => value + 1, "T11_WORKPAPER_COUNTS_INVALID");
  }
  for (const [field, replacement] of [
    ["anchorCode", "WRONG"], ["anchorLabel", "Wrong"], ["summaryBucketCode", "WRONG"], ["statementKind", "WRONG"],
    ["breakdownType", "WRONG"], ["isCurrentStructure", false], ["workpaper", {}], ["documents", [{}]], ["documentVerificationSummary", {}]
  ]) addJsonSet("WORKPAPERS_REVIEWER_READY", ["items", 1, field], replacement, "T11_WORKPAPER_ANCHORS_INVALID");
  addWorkpaperItemCases({ contract: "WORKPAPERS_REVIEWER_READY", prefix: ["items", 0], expectedStatus: "READY_FOR_REVIEW", priorIdentity: true, hasDocument: true, unchanged: true });
  addDocumentCases({ contract: "WORKPAPERS_REVIEWER_READY", prefix: ["items", 0, "documents", 0], expectedStatus: "UNVERIFIED", priorIdentity: true });

  addDocumentCases({ contract: "DOCUMENT_VERIFIED", prefix: [], expectedStatus: "VERIFIED", priorIdentity: true });
  addWorkpaperItemCases({ contract: "WORKPAPER_REVIEWED", expectedStatus: "REVIEWED", priorIdentity: true, hasDocument: true });
  addDocumentCases({ contract: "WORKPAPER_REVIEWED", prefix: ["documents", 0], expectedStatus: "VERIFIED", priorIdentity: true });

  addJsonDelete("EXPORT_CREATED", ["fileName"], "T14_EXPORT_INVALID");
  addJsonSet("EXPORT_CREATED", ["unexpectedDtoField"], true, "T14_EXPORT_INVALID");
  addJsonSet("EXPORT_CREATED", ["exportPackId"], "not-a-uuid", "T14_EXPORT_ID_INVALID");
  addJsonSet("EXPORT_CREATED", ["createdAt"], "not-a-time", "T14_EXPORT_TIME_INVALID");
  for (const [field, replacement] of [
    ["closingFolderId", "99999999-9999-4999-8999-999999999999"], ["fileName", "wrong.zip"], ["mediaType", "application/octet-stream"],
    ["byteSize", "27"], ["checksumSha256", "not-a-hash"], ["basisImportVersion", 2], ["basisTaxonomyVersion", 3], ["createdByUserId", orchestrator.ACTORS.REVIEWER.userId]
  ]) addJsonSet("EXPORT_CREATED", [field], replacement, "T14_EXPORT_INVALID");
  addJsonSet("EXPORT_CREATED", ["byteSize"], 0, "T14_EXPORT_INVALID", "zero byte size");
  addJsonSet("EXPORT_CREATED", ["byteSize"], (size) => size + 1, "T14_EXPORT_CONTENT_INVALID", "creation/content byte-size correlation");
  addJsonSet("EXPORT_CREATED", ["checksumSha256"], "0".repeat(64), "T14_EXPORT_CONTENT_INVALID", "creation/content checksum correlation");
  add("EXPORT_CREATED Location", "EXPORT_CREATED", "T14_EXPORT_INVALID", (response) => { response.headers.Location = "/api/closing-folders/wrong/export-packs/wrong"; });
  add("EXPORT_CREATED missing Location", "EXPORT_CREATED", "T14_EXPORT_INVALID", (response) => { delete response.headers.Location; });

  for (const [header, replacement] of [
    ["Content-Type", "application/octet-stream"], ["Content-Length", "not-a-number"], ["Cache-Control", "private,no-store"],
    ["Content-Disposition", `attachment; filename="wrong.zip"`]
  ]) add(`EXPORT_CONTENT ${header}`, "EXPORT_CONTENT", "T14_EXPORT_CONTENT_INVALID", (response) => { response.headers[header] = replacement; });
  for (const header of ["Content-Type", "Content-Length", "Cache-Control", "Content-Disposition"]) {
    add(`EXPORT_CONTENT missing ${header}`, "EXPORT_CONTENT", "T14_EXPORT_CONTENT_INVALID", (response) => { delete response.headers[header]; });
  }
  add("EXPORT_CONTENT JSON body", "EXPORT_CONTENT", "T14_EXPORT_CONTENT_INVALID", (response) => { response.json = {}; });
  add("EXPORT_CONTENT non-Buffer body", "EXPORT_CONTENT", "T14_EXPORT_CONTENT_INVALID", (response) => { response.bytes = new Uint8Array(response.bytes); });
  add("EXPORT_CONTENT byte length", "EXPORT_CONTENT", "T14_EXPORT_CONTENT_INVALID", (response) => { response.bytes = Buffer.concat([response.bytes, Buffer.from([0])]); });
  add("EXPORT_CONTENT checksum", "EXPORT_CONTENT", "T14_EXPORT_CONTENT_INVALID", (response) => { response.bytes[0] ^= 0xff; });

  return cases;
}

test("H08b independent Kotlin-DTO response matrix kills every decisive T04-T14 field, status, identity, timestamp and header mutant with the exact stop code", async () => {
  const mutants = responseMutantMatrix();
  assert.ok(mutants.length >= 250, `response matrix unexpectedly small: ${mutants.length}`);
  for (const mutant of mutants) {
    let mutated = 0;
    await assert.rejects(
      orchestrator.executeHttpTaskContract({
        runId: RUN_ID,
        requestAdapter: async (spec) => {
          const response = cloneHttpResponse(responseFor(spec));
          if (spec.responseContract === mutant.contract && mutated === 0) {
            mutated += 1;
            mutant.mutate(response);
          }
          return response;
        }
      }),
      (error) => error?.code === mutant.expectedCode,
      `${mutant.name} must stop with ${mutant.expectedCode}`
    );
    assert.equal(mutated, 1, `${mutant.name} did not target exactly one response`);
  }
});

function auditEvents() {
  return orchestrator.expectedAuditEvents({ runId: RUN_ID, ...UUIDS });
}

test("A01 audit query is read-only, bounded to the full run namespace and has no tenant prefilter", () => {
  const plan = orchestrator.buildAuditQueryPlan({ runId: RUN_ID, folderId: UUIDS.folderId });
  assert.match(plan.stdin, /REPEATABLE READ READ ONLY/);
  assert.match(plan.stdin, /ROLLBACK;/);
  assert.match(plan.stdin, /statement_timeout = '5s'/);
  assert.match(plan.stdin, /left\(ae\.request_id, char_length\(p\.run_id\) \+ 1\)/);
  assert.equal(/WHERE[\s\S]*ae\.tenant_id\s*=\s*p\.tenant_id/i.test(plan.stdin.slice(plan.stdin.indexOf("actual AS ("), plan.stdin.indexOf("SELECT jsonb_build_object"))), false);
  assert.match(plan.stdin, /FROM manual_mapping mm/);
  for (const mutation of ["DELETE FROM audit_event;", "COMMIT;", "DROP TABLE audit_event;"]) assert.throws(() => orchestrator.assertAuditQueryReadOnly(`${plan.stdin}\n${mutation}`), orchestrator.OrchestratorError);
});

test("A02 exact multiset passes only at 15 expected, 0 missing, 0 unexpected and 15 actual", () => {
  const events = auditEvents();
  assert.deepEqual(orchestrator.assertAuditMultiset(events, structuredClone(events)), { expectedCount: 15, missingCount: 0, unexpectedCount: 0, actualCount: 15, status: "PASS_15_EXPECTED_0_MISSING_0_UNEXPECTED" });
});

test("A03 multiset kills missing, duplicate, unexpected, set-only and count-only mutants", () => {
  const events = auditEvents();
  const mutants = [
    events.slice(1),
    [...events, events[0]],
    [...events.slice(0, -1), { ...events.at(-1), action: "PARASITE.READ" }],
    [...events.slice(0, -1), structuredClone(events[0])],
    Array.from({ length: 15 }, () => structuredClone(events[0]))
  ];
  for (const actual of mutants) throwsCode(() => orchestrator.assertAuditMultiset(events, actual), "AUDIT_MULTISET_MISMATCH");
});

test("A04 multiset kills cross-tenant, wrong actor, role, request/action and resource mutants", () => {
  const events = auditEvents();
  const changes = [
    { tenantId: "99999999-9999-4999-8999-999999999999" },
    { actorUserId: orchestrator.ACTORS.REVIEWER.userId },
    { actorSubject: "foreign-subject" },
    { actorRoles: ["REVIEWER"] },
    { requestId: `${RUN_ID}-T14-CREATE-EXPORT` },
    { action: "EXPORT_PACK.CREATED" },
    { resourceType: "FOREIGN_RESOURCE" },
    { resourceKey: "foreign-resource" }
  ];
  for (const change of changes) {
    const actual = structuredClone(events);
    actual[0] = { ...actual[0], ...change };
    throwsCode(() => orchestrator.assertAuditMultiset(events, actual), "AUDIT_MULTISET_MISMATCH");
  }
});

test("A05 audit row parser preserves bounded parasite cardinality for multiset comparison", () => {
  const text = `${auditEvents().map((event) => JSON.stringify(event)).join("\n")}\n`;
  assert.equal(orchestrator.parseAuditRows(text).length, 15);
  assert.equal(orchestrator.parseAuditRows("").length, 0);
  assert.equal(orchestrator.parseAuditRows(text.split("\n").slice(1).join("\n")).length, 14);
  const parasite = { ...auditEvents()[0], requestId: `${RUN_ID}-PARASITE` };
  const sixteen = orchestrator.parseAuditRows(`${text}${JSON.stringify(parasite)}\n`);
  assert.equal(sixteen.length, 16);
  assert.deepEqual(orchestrator.compareAuditMultiset(auditEvents(), sixteen), { expectedCount: 15, missingCount: 0, unexpectedCount: 1, actualCount: 16, status: "FAIL" });
  const foreignRole = orchestrator.parseAuditRows(`${text}${JSON.stringify({ ...parasite, actorRoles: ["OWNER"] })}\n`);
  assert.deepEqual(orchestrator.compareAuditMultiset(auditEvents(), foreignRole), { expectedCount: 15, missingCount: 0, unexpectedCount: 1, actualCount: 16, status: "FAIL" });
  assert.throws(() => orchestrator.parseAuditRows(text.replace("\n", "\r\n")), orchestrator.OrchestratorError);
  assert.throws(() => orchestrator.parseAuditRows(text.replace('{', '{"tenantId":"duplicate",')), orchestrator.OrchestratorError);
  assert.throws(() => orchestrator.parseAuditRows("\n\n"), orchestrator.OrchestratorError);
});

test("A06 orchestration persists exact failed audit counts before cleanup and summary", async () => {
  const parasite = { ...auditEvents()[0], requestId: `${RUN_ID}-PARASITE` };
  let capturedSummary;
  const rig = completeFakeAdapters({
    queryAudit: async () => [...auditEvents(), parasite],
    writeSummaryAndChecksum: async ({ summaryBytes, checksumText }) => {
      capturedSummary = orchestrator.verifySummaryAndChecksum(summaryBytes, checksumText);
      return { durable: true, summarySha256: orchestrator.sha256Hex(summaryBytes), checksumSha256: orchestrator.sha256Hex(checksumText) };
    }
  });
  await assert.rejects(orchestrator.createOrchestrator(rig.adapters).run(exactRunOptions(rig.records)), (error) => error.code === "AUDIT_MULTISET_MISMATCH");
  assert.deepEqual(capturedSummary.audit, { expectedCount: 15, missingCount: 0, unexpectedCount: 1, actualCount: 16, status: "FAIL" });
  assert.equal(capturedSummary.status, "INCOMPLETE");
  assert.deepEqual(capturedSummary.tasks[15], { taskId: "T15", status: "FAIL", failureCode: "AUDIT_MULTISET_MISMATCH" });
  const durableAuditState = rig.calls.findLast((call) => call.state?.auditResult?.status === "FAIL")?.state;
  assert.notEqual(durableAuditState, undefined);
  for (const impossibleAudit of [
    { expectedCount: 15, missingCount: 0, unexpectedCount: 0, actualCount: 14, status: "FAIL" },
    { expectedCount: 15, missingCount: 16, unexpectedCount: 1, actualCount: 0, status: "FAIL" },
    { expectedCount: 15, missingCount: 0, unexpectedCount: 17, actualCount: 16, status: "FAIL" }
  ]) {
    const mutant = structuredClone(durableAuditState);
    mutant.auditResult = impossibleAudit;
    throwsCode(() => orchestrator.validateRecoveryState(mutant), "RECOVERY_AUDIT_INVALID");
  }
});

function summaryInput({ status = "COMPLETED", cleanupStatus = "COMPLETE", runAttemptEngaged = true, failureCode = null } = {}) {
  const completed = status === "COMPLETED";
  const terminalFailure = failureCode ?? "INJECTED_FAILURE";
  return {
    schemaVersion: orchestrator.SUMMARY_SCHEMA_VERSION,
    protocolId: orchestrator.PROTOCOL_ID,
    run: "R1",
    runId: RUN_ID,
    tenantId: orchestrator.TENANT_ID,
    environment: orchestrator.ENVIRONMENT,
    commandEvidence: { orchestratorSha256: ORCHESTRATOR_HASH, repository: orchestrator.REPOSITORY, head: HEAD, proposalSha256: PROPOSAL_HASH, commandBindingSha256: "f".repeat(64) },
    reviewEvidence: { recordId: "043c-review-record-001", sha256: REVIEW_HASH, status: "PASS" },
    authorizationEvidence: { recordId: "043c-authorization-record-001", sha256: AUTHORIZATION_HASH, status: runAttemptEngaged ? "CONSUMED" : "YES", consumedAtUtc: runAttemptEngaged ? "2026-08-10T10:03:00.000Z" : null },
    resources: { dbName: resources().dbName, roleName: resources().roleName, runtimeRootSha256: "1".repeat(64), storageRootSha256: "2".repeat(64), evidenceRootSha256: "3".repeat(64) },
    actors: ["ACCOUNTANT", "REVIEWER"].map((name) => ({ role: orchestrator.ACTORS[name].role, userId: orchestrator.ACTORS[name].userId, subject: orchestrator.ACTORS[name].subject })),
    fixtures: [orchestrator.FIXTURES.balance, orchestrator.FIXTURES.evidence].map((fixture) => ({ name: fixture.fileName, byteSize: fixture.byteSize, sha256: fixture.sha256 })),
    runAttempt: { engaged: runAttemptEngaged, startedAtUtc: runAttemptEngaged ? "2026-08-10T10:03:00.000Z" : null },
    tasks: orchestrator.TASK_IDS.map((taskId, index) => {
      if (completed) return { taskId, status: "PASS", failureCode: null };
      if (index === 15) return { taskId, status: "FAIL", failureCode: terminalFailure };
      if (!runAttemptEngaged && index === 0) return { taskId, status: "FAIL", failureCode: terminalFailure };
      if (runAttemptEngaged && index === 0) return { taskId, status: "PASS", failureCode: null };
      if (runAttemptEngaged && index === 1) return { taskId, status: "FAIL", failureCode: terminalFailure };
      return { taskId, status: "NOT_REACHED", failureCode: null };
    }),
    audit: completed ? { expectedCount: 15, missingCount: 0, unexpectedCount: 0, actualCount: 15, status: "PASS_15_EXPECTED_0_MISSING_0_UNEXPECTED" } : { expectedCount: 0, missingCount: 0, unexpectedCount: 0, actualCount: 0, status: "NOT_REACHED" },
    export: completed ? { exportPackId: UUIDS.exportPackId, fileName: "synthetic.zip", byteSize: EXPORT_BYTES.length, sha256: EXPORT_HASH, contentVerified: true } : { exportPackId: null, fileName: null, byteSize: null, sha256: null, contentVerified: false },
    usefulness: completed ? { usefulnessScore: 5, observationCode: "NO_FRICTION" } : null,
    cleanup: { status: cleanupStatus, completedSteps: cleanupStatus === "COMPLETE" ? [...orchestrator.CLEANUP_STEPS] : [], residuals: cleanupStatus === "PARTIAL" ? ["VERIFY_FINAL_ABSENCE:RESIDUAL_RESOURCE"] : [] },
    status,
    failureCode,
    startedAtUtc: "2026-08-10T10:02:00.000Z",
    endedAtUtc: "2026-08-10T10:05:00.000Z"
  };
}

function r1EvidenceArtifact() {
  const summaryBytes = Buffer.from(orchestrator.serializeRunSummary(orchestrator.buildRunSummary(summaryInput())));
  return {
    summaryBytes,
    checksumText: orchestrator.buildSummaryChecksum(summaryBytes),
    summarySha256: orchestrator.sha256Hex(summaryBytes),
    absenceProof: { runId: RUN_ID, databaseAbsent: true, roleAbsent: true, runtimeAbsent: true, storageAbsent: true, recoveryStateAbsent: true, portsFree: [...orchestrator.PORTS], exportRetained: true, exactOwnershipChecked: true }
  };
}

test("S01 summary has the exact top-level order, T00-T15 order and closed statuses", () => {
  const summary = orchestrator.buildRunSummary(summaryInput());
  assert.deepEqual(Object.keys(summary), orchestrator.SUMMARY_KEYS);
  assert.deepEqual(summary.tasks.map((task) => task.taskId), orchestrator.TASK_IDS);
  assert.equal(summary.tasks.every((task) => task.status === "PASS"), true);
});

test("S02 summary bytes are compact UTF-8/LF, reparsed exactly and independently hashed", () => {
  const summary = orchestrator.buildRunSummary(summaryInput());
  const text = orchestrator.serializeRunSummary(summary);
  assert.equal(text.startsWith("\ufeff"), false);
  assert.equal(text.includes("\r"), false);
  assert.equal(text.endsWith("\n") && !text.endsWith("\n\n"), true);
  const checksum = orchestrator.buildSummaryChecksum(Buffer.from(text));
  assert.equal(checksum, `${orchestrator.sha256Hex(Buffer.from(text))}  run-summary.json\n`);
  assert.deepEqual(orchestrator.verifySummaryAndChecksum(Buffer.from(text), checksum), summary);
  const nestedReordered = summaryInput();
  nestedReordered.commandEvidence = Object.fromEntries(Object.entries(nestedReordered.commandEvidence).reverse());
  nestedReordered.audit = Object.fromEntries(Object.entries(nestedReordered.audit).reverse());
  assert.equal(orchestrator.serializeRunSummary(nestedReordered), text);
  throwsCode(() => orchestrator.verifySummaryAndChecksum(Buffer.from(text), `${"0".repeat(64)}  run-summary.json\n`), "EVIDENCE_HASH_MISMATCH");
  for (const noncanonical of [JSON.stringify(summary, null, 2), `${JSON.stringify(summary)}\r\n`, ` ${JSON.stringify(summary)}\n`]) {
    const bytes = Buffer.from(noncanonical);
    throwsCode(() => orchestrator.verifySummaryAndChecksum(bytes, `${orchestrator.sha256Hex(bytes)}  run-summary.json\n`), "EVIDENCE_SERIALIZATION_INVALID");
  }
});

test("S03 summary rejects unknown fields, wrong task order, non-string decimals, contradictory completion and secret placement", () => {
  const extra = summaryInput();
  extra.extra = true;
  throwsCode(() => orchestrator.buildRunSummary(extra), "EVIDENCE_SUMMARY_SCHEMA_INVALID");
  const wrongOrder = summaryInput();
  [wrongOrder.tasks[0], wrongOrder.tasks[1]] = [wrongOrder.tasks[1], wrongOrder.tasks[0]];
  assert.throws(() => orchestrator.buildRunSummary(wrongOrder), orchestrator.OrchestratorError);
  const incomplete = summaryInput();
  incomplete.tasks[5] = { taskId: "T05", status: "FAIL", failureCode: "FAILED" };
  assert.throws(() => orchestrator.buildRunSummary(incomplete), orchestrator.OrchestratorError);
  const auditWithoutT14 = summaryInput();
  auditWithoutT14.tasks[14] = { taskId: "T14", status: "NOT_REACHED", failureCode: null };
  assert.throws(() => orchestrator.buildRunSummary(auditWithoutT14), orchestrator.OrchestratorError);
  const preflightWithBusiness = summaryInput({ status: "PRE_EXECUTION_PREFLIGHT_FAILURE", runAttemptEngaged: false, failureCode: "PREFLIGHT_FAILED" });
  preflightWithBusiness.tasks[1] = { taskId: "T01", status: "PASS", failureCode: null };
  assert.throws(() => orchestrator.buildRunSummary(preflightWithBusiness), orchestrator.OrchestratorError);
  const usefulnessWithoutAudit = summaryInput({ status: "INCOMPLETE", runAttemptEngaged: true, failureCode: "AUDIT_FAILED" });
  usefulnessWithoutAudit.usefulness = { usefulnessScore: 5, observationCode: "NO_FRICTION" };
  assert.throws(() => orchestrator.buildRunSummary(usefulnessWithoutAudit), orchestrator.OrchestratorError);
  const falselyIncomplete = summaryInput();
  falselyIncomplete.status = "INCOMPLETE";
  falselyIncomplete.failureCode = "FALSE_FAILURE";
  falselyIncomplete.tasks[15] = { taskId: "T15", status: "FAIL", failureCode: "FALSE_FAILURE" };
  throwsCode(() => orchestrator.buildRunSummary(falselyIncomplete), "EVIDENCE_COMPLETION_BIDIRECTIONAL_MISMATCH");
  const secret = summaryInput();
  secret.commandEvidence = { ...secret.commandEvidence, repository: "Bearer hidden" };
  assert.throws(() => orchestrator.buildRunSummary(secret), orchestrator.OrchestratorError);
  const hostileFailureCode = summaryInput({ status: "INCOMPLETE", runAttemptEngaged: true, failureCode: "db-password-hunter2" });
  assert.throws(() => orchestrator.buildRunSummary(hostileFailureCode), orchestrator.OrchestratorError);
  const hostileResidual = summaryInput({ status: "INCOMPLETE", cleanupStatus: "PARTIAL", runAttemptEngaged: true, failureCode: "CLEANUP_PARTIAL" });
  hostileResidual.cleanup.residuals = ["password=hunter2"];
  assert.throws(() => orchestrator.buildRunSummary(hostileResidual), orchestrator.OrchestratorError);
  for (const impossibleAudit of [
    { expectedCount: 15, missingCount: 0, unexpectedCount: 0, actualCount: 14, status: "FAIL" },
    { expectedCount: 15, missingCount: 16, unexpectedCount: 1, actualCount: 0, status: "FAIL" },
    { expectedCount: 15, missingCount: 0, unexpectedCount: 17, actualCount: 16, status: "FAIL" }
  ]) {
    const mutant = summaryInput({ status: "INCOMPLETE", failureCode: "AUDIT_FAILED" });
    mutant.audit = impossibleAudit;
    assert.throws(() => orchestrator.buildRunSummary(mutant), orchestrator.OrchestratorError);
  }
});

test("S04 pre-execution failure summary remains valid only with an unengaged attempt", () => {
  const input = summaryInput({ status: "PRE_EXECUTION_PREFLIGHT_FAILURE", cleanupStatus: "COMPLETE", runAttemptEngaged: false, failureCode: "PREFLIGHT_FAILED" });
  assert.equal(orchestrator.buildRunSummary(input).status, "PRE_EXECUTION_PREFLIGHT_FAILURE");
  input.runAttempt = { engaged: true, startedAtUtc: "2026-08-10T10:03:00.000Z" };
  assert.throws(() => orchestrator.buildRunSummary(input), orchestrator.OrchestratorError);
});

function cleanupRig({ sessions = 0, failAt = null, invalidAt = null } = {}) {
  const effects = [];
  const record = (name, value) => async (...args) => {
    effects.push(name);
    if (failAt === name) throw new orchestrator.OrchestratorError("INJECTED_CLEANUP_FAILURE");
    if (invalidAt === name) return false;
    return typeof value === "function" ? value(...args) : value;
  };
  const adapters = {
    now: () => "2026-08-10T10:05:00.000Z",
    writeStateAtomic: async ({ bytes }) => ({ durable: true, sha256: orchestrator.sha256Hex(bytes) }),
    inspectProcessIdentities: record("inspectProcessIdentities", ({ expected }) => ({ observed: expected.map((descriptorValue) => ({ ...descriptorValue })), absentLabels: [] })),
    shutdownHarness: record("shutdownHarness", ({ state }) => ({ stopped: true, releasedPorts: [5173, 5174], ownershipMarkerSha256: orchestrator.sha256Hex(state.ownershipMarker) })),
    stopBackendTree: record("stopBackendTree", ({ state }) => ({ stopped: true, releasedPorts: [8080], ownershipMarkerSha256: orchestrator.sha256Hex(state.ownershipMarker) })),
    retainEvidence: record("retainEvidence", ({ exportEvidence }) => ({ retained: true, exportSha256: exportEvidence?.sha256 ?? null })),
    removeRuntimeRoot: record("removeRuntimeRoot", ({ path, marker }) => ({ absent: true, pathSha256: orchestrator.sha256Hex(path), ownershipMarkerSha256: orchestrator.sha256Hex(marker) })),
    countDatabaseSessions: record("countDatabaseSessions", () => sessions),
    dropDatabase: record("dropDatabase", ({ dbName, marker }) => ({ absent: true, databaseName: dbName, ownershipMarkerSha256: orchestrator.sha256Hex(marker) })),
    dropRole: record("dropRole", ({ roleName, marker }) => ({ absent: true, roleName, ownershipMarkerSha256: orchestrator.sha256Hex(marker) })),
    verifyCatalogAbsent: record("verifyCatalogAbsent", () => ({ databaseAbsent: true, roleAbsent: true })),
    verifyFinalAbsence: record("verifyFinalAbsence", () => ({ runtimeAbsent: true, storageAbsent: true, portsFree: [...orchestrator.PORTS], evidenceRetained: true })),
    writeSummaryAndChecksum: record("writeSummaryAndChecksum", ({ summaryBytes, checksumText }) => ({ durable: true, summarySha256: orchestrator.sha256Hex(summaryBytes), checksumSha256: orchestrator.sha256Hex(checksumText) })),
    removeRecoveryState: record("removeRecoveryState", ({ expectedSha256 }) => ({ removed: true, removedSha256: expectedSha256 }))
  };
  return { adapters, effects, setSessions(value) { sessions = value; } };
}

async function preflightFinalization() {
  const summary = orchestrator.buildRunSummary(summaryInput({ status: "PRE_EXECUTION_PREFLIGHT_FAILURE", cleanupStatus: "COMPLETE", runAttemptEngaged: false, failureCode: "PREFLIGHT_FAILED" }));
  const summaryBytes = Buffer.from(orchestrator.serializeRunSummary(summary));
  return { summaryBytes, checksumText: orchestrator.buildSummaryChecksum(summaryBytes) };
}

test("C01 cleanup executes the exact destructive-safe order and removes state only after durable evidence", async () => {
  const { state } = makeRecoveryState();
  const rig = cleanupRig();
  const result = await orchestrator.executeCleanup({ state, adapters: rig.adapters, finalizeSummary: preflightFinalization });
  assert.equal(result.status, "COMPLETE");
  assert.equal(result.r2Eligible, false);
  assert.deepEqual(rig.effects, ["shutdownHarness", "stopBackendTree", "retainEvidence", "removeRuntimeRoot", "countDatabaseSessions", "dropDatabase", "dropRole", "verifyCatalogAbsent", "verifyFinalAbsence", "writeSummaryAndChecksum", "removeRecoveryState"]);
  assert.deepEqual(result.state.cleanup.completedSteps, orchestrator.CLEANUP_STEPS);
});

test("C02 residual sessions produce PARTIAL, never terminate or drop, and block R2", async () => {
  const { state } = makeRecoveryState();
  const rig = cleanupRig({ sessions: 1 });
  const result = await orchestrator.executeCleanup({ state, adapters: rig.adapters, finalizeSummary: preflightFinalization });
  assert.equal(result.status, "PARTIAL");
  assert.equal(result.exitCode, 1);
  assert.equal(result.r2Eligible, false);
  assert.equal(rig.effects.includes("dropDatabase"), false);
  assert.equal(rig.effects.includes("dropRole"), false);
  assert.match(result.state.cleanup.residuals.join("\n"), /CLEANUP_RESIDUAL_SESSIONS/);
});

test("C03 foreign/divergent cleanup target is preserved and later destructive steps never run", async () => {
  const { state } = makeRecoveryState();
  const rig = cleanupRig({ failAt: "removeRuntimeRoot" });
  const result = await orchestrator.executeCleanup({ state, adapters: rig.adapters, finalizeSummary: preflightFinalization });
  assert.equal(result.status, "PARTIAL");
  assert.equal(rig.effects.includes("dropDatabase"), false);
  assert.equal(rig.effects.includes("removeRecoveryState"), false);
});

test("C04 cleanup re-entry resumes only cleanup, rechecks sessions and never broadens scope", async () => {
  const { state } = makeRecoveryState();
  const rig = cleanupRig({ sessions: 1 });
  const partial = await orchestrator.executeCleanup({ state, adapters: rig.adapters, finalizeSummary: preflightFinalization });
  rig.setSessions(0);
  rig.effects.length = 0;
  const complete = await orchestrator.executeCleanup({ state: partial.state, adapters: rig.adapters, finalizeSummary: preflightFinalization });
  assert.equal(complete.status, "COMPLETE");
  assert.deepEqual(rig.effects.slice(0, 3), ["countDatabaseSessions", "dropDatabase", "dropRole"]);
  assert.equal(rig.effects.includes("shutdownHarness"), false);
});

test("C05 a pending business mutation is closed before cleanup-only and is never resumed", async () => {
  const { state } = makeRecoveryState();
  const pending = orchestrator.setPendingOperation(state, { id: "PROVISION_RESOURCES", target: state.resources.dbName, expectedIdentity: "7".repeat(64), nowUtc: "2026-08-10T10:02:01.000Z" });
  const rig = cleanupRig();
  const complete = await orchestrator.executeCleanup({ state: pending, adapters: rig.adapters, finalizeSummary: preflightFinalization });
  assert.equal(complete.state.pendingOperation, null);
  assert.equal(complete.state.completedOperations.includes("PROVISION_RESOURCES"), true);
  assert.equal(complete.status, "COMPLETE");
});

test("C06 every cleanup boundary fails closed on throw or invalid resolved proof", async () => {
  const stepAdapters = ["shutdownHarness", "stopBackendTree", "retainEvidence", "removeRuntimeRoot", "countDatabaseSessions", "dropDatabase", "dropRole", "verifyCatalogAbsent", "verifyFinalAbsence"];
  for (const adapterName of stepAdapters) {
    const { state } = makeRecoveryState();
    const rig = cleanupRig({ failAt: adapterName });
    const result = await orchestrator.executeCleanup({ state, adapters: rig.adapters, finalizeSummary: preflightFinalization });
    assert.equal(result.status, "PARTIAL", `${adapterName} throw must remain recoverable and partial`);
    assert.equal(rig.effects.includes("removeRecoveryState"), false);
  }
  for (const adapterName of ["verifyFinalAbsence", "writeSummaryAndChecksum", "removeRecoveryState"]) {
    const { state } = makeRecoveryState();
    const rig = cleanupRig({ invalidAt: adapterName });
    if (adapterName === "verifyFinalAbsence") {
      const result = await orchestrator.executeCleanup({ state, adapters: rig.adapters, finalizeSummary: preflightFinalization });
      assert.equal(result.status, "PARTIAL");
    } else {
      await assert.rejects(orchestrator.executeCleanup({ state, adapters: rig.adapters, finalizeSummary: preflightFinalization }), orchestrator.OrchestratorError);
    }
    assert.equal(rig.effects.includes("removeRecoveryState") && adapterName !== "removeRecoveryState", false);
  }
});

test("C07 PID reuse is preserved, while a post-shutdown failure re-enters with durably absent processes", async () => {
  const engaged = makeRecoveryState({ engaged: true }).state;
  const reuseRig = cleanupRig();
  reuseRig.adapters.inspectProcessIdentities = async ({ expected }) => ({ observed: expected.map((descriptorValue, index) => index === 0 ? { ...descriptorValue, creationTimeUtc: "2026-08-10T10:00:01.000Z" } : { ...descriptorValue }), absentLabels: [] });
  const reuse = await orchestrator.executeCleanup({ state: engaged, adapters: reuseRig.adapters, finalizeSummary: preflightFinalization });
  assert.equal(reuse.status, "PARTIAL");
  assert.equal(reuseRig.effects.includes("shutdownHarness"), false);

  const firstRig = cleanupRig({ failAt: "retainEvidence" });
  const partial = await orchestrator.executeCleanup({ state: engaged, adapters: firstRig.adapters, finalizeSummary: preflightFinalization });
  assert.equal(partial.status, "PARTIAL", JSON.stringify(partial.state.cleanup.residuals));
  assert.deepEqual(partial.state.processes, []);
  assert.deepEqual(partial.state.cleanup.completedSteps, orchestrator.CLEANUP_STEPS.slice(0, 2));
  const secondRig = cleanupRig();
  const completed = await orchestrator.executeCleanup({ state: partial.state, adapters: secondRig.adapters, finalizeSummary: preflightFinalization });
  assert.equal(completed.status, "COMPLETE");
  assert.equal(secondRig.effects.includes("inspectProcessIdentities"), false);
});

test("C08 a shutdown effect followed by a failed completion CAS re-enters through exact ABSENT proof only", async () => {
  const engaged = makeRecoveryState({ engaged: true }).state;
  let durableBytes = Buffer.from(orchestrator.serializeRecoveryState(engaged));
  let harnessAbsent = false;
  let completionFailureInjected = false;
  let shutdownCalls = 0;
  const rig = cleanupRig();
  rig.adapters.writeStateAtomic = async ({ bytes, expectedPreviousHash }) => {
    assert.equal(expectedPreviousHash, orchestrator.sha256Hex(durableBytes));
    const candidate = JSON.parse(Buffer.from(bytes).toString("utf8"));
    if (!completionFailureInjected && candidate.pendingOperation === null && candidate.cleanup.completedSteps.includes(orchestrator.CLEANUP_STEPS[0])) {
      completionFailureInjected = true;
      throw new orchestrator.OrchestratorError("INJECTED_POST_SHUTDOWN_CAS_FAILURE");
    }
    durableBytes = Buffer.from(bytes);
    return { durable: true, sha256: orchestrator.sha256Hex(durableBytes) };
  };
  rig.adapters.inspectProcessIdentities = async ({ expected }) => ({
    observed: expected.filter((item) => !harnessAbsent || !["TWO_ACTOR_HARNESS", "VITE_ACCOUNTANT", "VITE_REVIEWER"].includes(item.label)).map((item) => ({ ...item })),
    absentLabels: harnessAbsent ? ["TWO_ACTOR_HARNESS", "VITE_ACCOUNTANT", "VITE_REVIEWER"] : []
  });
  rig.adapters.shutdownHarness = async ({ state }) => {
    shutdownCalls += 1;
    harnessAbsent = true;
    return { stopped: true, releasedPorts: [5173, 5174], ownershipMarkerSha256: orchestrator.sha256Hex(state.ownershipMarker) };
  };
  rig.adapters.removeRecoveryState = async ({ expectedSha256 }) => {
    assert.equal(expectedSha256, orchestrator.sha256Hex(durableBytes));
    durableBytes = null;
    return { removed: true, removedSha256: expectedSha256 };
  };
  const partial = await orchestrator.executeCleanup({ state: engaged, adapters: rig.adapters, finalizeSummary: preflightFinalization });
  assert.equal(partial.status, "PARTIAL");
  assert.equal(partial.state.pendingOperation.id, orchestrator.CLEANUP_STEPS[0]);
  assert.equal(shutdownCalls, 1);
  const durablePending = orchestrator.parseRecoveryState(durableBytes.toString("utf8"));
  const completed = await orchestrator.executeCleanup({ state: durablePending, adapters: rig.adapters, finalizeSummary: preflightFinalization });
  assert.equal(completed.status, "COMPLETE", JSON.stringify(completed.state.cleanup.residuals));
  assert.equal(shutdownCalls, 2, "the exact pending shutdown is idempotently re-proven, never skipped");

  const exactAbsenceRig = cleanupRig();
  exactAbsenceRig.adapters.inspectProcessIdentities = async ({ expected }) => ({ observed: expected.slice(3).map((item) => ({ ...item })), absentLabels: expected.slice(0, 3).map((item) => item.label) });
  const absentIsIdempotent = await orchestrator.executeCleanup({ state: engaged, adapters: exactAbsenceRig.adapters, finalizeSummary: preflightFinalization });
  assert.equal(absentIsIdempotent.status, "COMPLETE");
  assert.equal(exactAbsenceRig.effects.includes("shutdownHarness"), true);
  assert.equal(exactAbsenceRig.effects.includes("stopBackendTree"), true);
});

test("C09 FINALIZING recovery rewrites byte-identical summary evidence after a state-removal crash", async () => {
  const initial = makeRecoveryState().state;
  let durableBytes = Buffer.from(orchestrator.serializeRecoveryState(initial));
  let removalAttempts = 0;
  let clockTick = 0;
  const summaryWrites = [];
  const rig = cleanupRig();
  rig.adapters.now = () => new Date(Date.UTC(2026, 7, 10, 10, 5, clockTick++)).toISOString();
  rig.adapters.writeStateAtomic = async ({ bytes, expectedPreviousHash }) => {
    assert.equal(expectedPreviousHash, orchestrator.sha256Hex(durableBytes));
    durableBytes = Buffer.from(bytes);
    return { durable: true, sha256: orchestrator.sha256Hex(durableBytes) };
  };
  rig.adapters.writeSummaryAndChecksum = async ({ summaryBytes, checksumText }) => {
    summaryWrites.push({ summaryBytes: Buffer.from(summaryBytes), checksumText });
    return { durable: true, summarySha256: orchestrator.sha256Hex(summaryBytes), checksumSha256: orchestrator.sha256Hex(checksumText) };
  };
  rig.adapters.removeRecoveryState = async ({ expectedSha256 }) => {
    removalAttempts += 1;
    assert.equal(expectedSha256, orchestrator.sha256Hex(durableBytes));
    if (removalAttempts === 1) throw new orchestrator.OrchestratorError("INJECTED_AFTER_SUMMARY_BEFORE_STATE_REMOVAL");
    durableBytes = null;
    return { removed: true, removedSha256: expectedSha256 };
  };
  const deterministicFinalization = async (cleanedState) => {
    const input = summaryInput({ status: "PRE_EXECUTION_PREFLIGHT_FAILURE", cleanupStatus: "COMPLETE", runAttemptEngaged: false, failureCode: "PREFLIGHT_FAILED" });
    input.endedAtUtc = cleanedState.updatedAtUtc;
    const summary = orchestrator.buildRunSummary(input);
    const summaryBytes = Buffer.from(orchestrator.serializeRunSummary(summary));
    return { summaryBytes, checksumText: orchestrator.buildSummaryChecksum(summaryBytes) };
  };
  await assert.rejects(orchestrator.executeCleanup({ state: initial, adapters: rig.adapters, finalizeSummary: deterministicFinalization }), (error) => error.code === "INJECTED_AFTER_SUMMARY_BEFORE_STATE_REMOVAL");
  const finalizingState = orchestrator.parseRecoveryState(durableBytes.toString("utf8"));
  assert.equal(finalizingState.cleanup.status, "FINALIZING");
  const completed = await orchestrator.executeCleanup({ state: finalizingState, adapters: rig.adapters, finalizeSummary: deterministicFinalization });
  assert.equal(completed.status, "COMPLETE");
  assert.equal(summaryWrites.length, 2);
  assert.deepEqual(summaryWrites[1], summaryWrites[0]);
});

test("C10 every remaining cleanup step survives a post-effect pre-CAS window with one material mutation and exact cleanup-only re-entry", async () => {
  const cleanupAdapterNames = [
    "shutdownHarness",
    "stopBackendTree",
    "retainEvidence",
    "removeRuntimeRoot",
    "countDatabaseSessions",
    "dropDatabase",
    "dropRole",
    "verifyCatalogAbsent",
    "verifyFinalAbsence"
  ];
  const targetCases = [
    { index: 1, name: "STOP_BACKEND_TREE", adapter: "stopBackendTree", readOnly: false },
    { index: 2, name: "RETAIN_EVIDENCE", adapter: "retainEvidence", readOnly: false },
    { index: 3, name: "REMOVE_RUNTIME_ROOT", adapter: "removeRuntimeRoot", readOnly: false },
    { index: 4, name: "VERIFY_ZERO_DB_SESSIONS", adapter: "countDatabaseSessions", readOnly: true },
    { index: 5, name: "DROP_RUN_DATABASE", adapter: "dropDatabase", readOnly: false },
    { index: 6, name: "DROP_RUNNER_ROLE", adapter: "dropRole", readOnly: false },
    { index: 7, name: "VERIFY_CATALOG_ABSENT", adapter: "verifyCatalogAbsent", readOnly: true },
    { index: 8, name: "VERIFY_FINAL_ABSENCE", adapter: "verifyFinalAbsence", readOnly: true }
  ];

  for (const target of targetCases) {
    const initial = makeRecoveryState({ engaged: true }).state;
    const initialTasks = structuredClone(initial.taskStatuses);
    const initialCompletedOperations = [...initial.completedOperations];
    const initialProcesses = structuredClone(initial.processes);
    const exactResources = structuredClone(initial.resources);
    const markerSha256 = orchestrator.sha256Hex(initial.ownershipMarker);
    let durableBytes = Buffer.from(orchestrator.serializeRecoveryState(initial));
    let completionCasFailureInjected = false;
    let recoveryStateRemovals = 0;
    let summaryWrites = 0;
    const stateWrites = [];
    const stepCalls = [];
    const materialMutations = {
      shutdownHarness: 0,
      stopBackendTree: 0,
      retainEvidence: 0,
      removeRuntimeRoot: 0,
      dropDatabase: 0,
      dropRole: 0
    };
    const world = {
      harnessPresent: true,
      backendPresent: true,
      evidenceRetained: false,
      runtimePresent: true,
      databasePresent: true,
      rolePresent: true
    };
    const recordStep = (name) => stepCalls.push(name);
    const mutateMaterialOnce = (name, present, remove) => {
      if (present()) {
        materialMutations[name] += 1;
        remove();
      }
    };
    const assertExactStateScope = (state) => {
      assert.equal(state.runId, initial.runId, `${target.name} run scope`);
      assert.equal(state.ownershipMarker, initial.ownershipMarker, `${target.name} ownership scope`);
      assert.deepEqual(state.resources, exactResources, `${target.name} resource scope`);
    };
    const adapters = {
      now: () => "2026-08-10T10:05:00.000Z",
      writeStateAtomic: async ({ path, bytes, expectedPreviousHash }) => {
        assert.equal(path, exactResources.recoveryStatePath, `${target.name} recovery path`);
        assert.ok(Buffer.isBuffer(durableBytes), `${target.name} cannot recreate an absent state`);
        const durableHash = orchestrator.sha256Hex(durableBytes);
        assert.equal(expectedPreviousHash, durableHash, `${target.name} exact CAS predecessor`);
        const previous = orchestrator.parseRecoveryState(durableBytes.toString("utf8"));
        const candidate = orchestrator.parseRecoveryState(Buffer.from(bytes).toString("utf8"));
        const isTargetCompletion = previous.pendingOperation?.id === orchestrator.CLEANUP_STEPS[target.index]
          && candidate.pendingOperation === null
          && !previous.cleanup.completedSteps.includes(orchestrator.CLEANUP_STEPS[target.index])
          && candidate.cleanup.completedSteps.includes(orchestrator.CLEANUP_STEPS[target.index]);
        if (!completionCasFailureInjected && isTargetCompletion) {
          completionCasFailureInjected = true;
          stateWrites.push({ expectedPreviousHash, candidateSha256: orchestrator.sha256Hex(bytes), committed: false, target: candidate.cleanup.completedSteps.at(-1) });
          throw new orchestrator.OrchestratorError("INJECTED_POST_EFFECT_PRE_CAS_FAILURE");
        }
        durableBytes = Buffer.from(bytes);
        stateWrites.push({ expectedPreviousHash, candidateSha256: orchestrator.sha256Hex(bytes), committed: true, target: candidate.pendingOperation?.id ?? candidate.cleanup.completedSteps.at(-1) ?? null });
        return { durable: true, sha256: orchestrator.sha256Hex(durableBytes) };
      },
      inspectProcessIdentities: async ({ expected }) => {
        for (const descriptorValue of expected) {
          assert.deepEqual(descriptorValue, initialProcesses.find((candidate) => candidate.label === descriptorValue.label), `${target.name} process identity scope`);
        }
        const absentLabels = expected
          .filter((descriptorValue) => (["TWO_ACTOR_HARNESS", "VITE_ACCOUNTANT", "VITE_REVIEWER"].includes(descriptorValue.label) && !world.harnessPresent)
            || (["BACKEND_GRADLE", "BACKEND_APPLICATION", "DEMO_SEED"].includes(descriptorValue.label) && !world.backendPresent))
          .map((descriptorValue) => descriptorValue.label);
        return {
          observed: expected.filter((descriptorValue) => !absentLabels.includes(descriptorValue.label)).map((descriptorValue) => ({ ...descriptorValue })),
          absentLabels
        };
      },
      shutdownHarness: async ({ state, processes, ports }) => {
        recordStep("shutdownHarness");
        assertExactStateScope(state);
        assert.deepEqual(processes.map((process) => process.label), ["VITE_REVIEWER", "VITE_ACCOUNTANT", "TWO_ACTOR_HARNESS"], `${target.name} harness subtree`);
        assert.deepEqual(ports, [5173, 5174], `${target.name} actor ports`);
        mutateMaterialOnce("shutdownHarness", () => world.harnessPresent, () => { world.harnessPresent = false; });
        return { stopped: true, releasedPorts: [5173, 5174], ownershipMarkerSha256: markerSha256 };
      },
      stopBackendTree: async ({ state, processes, port }) => {
        recordStep("stopBackendTree");
        assertExactStateScope(state);
        assert.deepEqual(processes.map((process) => process.label), ["BACKEND_APPLICATION", "BACKEND_GRADLE"], `${target.name} backend subtree`);
        assert.equal(port, 8080, `${target.name} backend port`);
        mutateMaterialOnce("stopBackendTree", () => world.backendPresent, () => { world.backendPresent = false; });
        return { stopped: true, releasedPorts: [8080], ownershipMarkerSha256: markerSha256 };
      },
      retainEvidence: async ({ exportEvidence, exportPath }) => {
        recordStep("retainEvidence");
        assert.equal(exportEvidence, null, `${target.name} exact export evidence`);
        assert.equal(exportPath, exactResources.exportPath, `${target.name} export path`);
        mutateMaterialOnce("retainEvidence", () => !world.evidenceRetained, () => { world.evidenceRetained = true; });
        return { retained: true, exportSha256: null };
      },
      removeRuntimeRoot: async ({ path, marker, runId }) => {
        recordStep("removeRuntimeRoot");
        assert.equal(path, exactResources.runtimeRoot, `${target.name} runtime path`);
        assert.equal(marker, initial.ownershipMarker, `${target.name} runtime ownership`);
        assert.equal(runId, initial.runId, `${target.name} runtime runId`);
        mutateMaterialOnce("removeRuntimeRoot", () => world.runtimePresent, () => { world.runtimePresent = false; });
        return { absent: true, pathSha256: orchestrator.sha256Hex(path), ownershipMarkerSha256: orchestrator.sha256Hex(marker) };
      },
      countDatabaseSessions: async ({ dbName, marker }) => {
        recordStep("countDatabaseSessions");
        assert.equal(dbName, exactResources.dbName, `${target.name} session database`);
        assert.equal(marker, initial.ownershipMarker, `${target.name} session ownership`);
        return 0;
      },
      dropDatabase: async ({ dbName, roleName, marker }) => {
        recordStep("dropDatabase");
        assert.equal(dbName, exactResources.dbName, `${target.name} dropped database`);
        assert.equal(roleName, exactResources.roleName, `${target.name} database owner`);
        assert.equal(marker, initial.ownershipMarker, `${target.name} database ownership marker`);
        mutateMaterialOnce("dropDatabase", () => world.databasePresent, () => { world.databasePresent = false; });
        return { absent: true, databaseName: dbName, ownershipMarkerSha256: orchestrator.sha256Hex(marker) };
      },
      dropRole: async ({ roleName, marker }) => {
        recordStep("dropRole");
        assert.equal(roleName, exactResources.roleName, `${target.name} dropped role`);
        assert.equal(marker, initial.ownershipMarker, `${target.name} role ownership marker`);
        mutateMaterialOnce("dropRole", () => world.rolePresent, () => { world.rolePresent = false; });
        return { absent: true, roleName, ownershipMarkerSha256: orchestrator.sha256Hex(marker) };
      },
      verifyCatalogAbsent: async ({ dbName, roleName }) => {
        recordStep("verifyCatalogAbsent");
        assert.equal(dbName, exactResources.dbName, `${target.name} verified database`);
        assert.equal(roleName, exactResources.roleName, `${target.name} verified role`);
        assert.equal(world.databasePresent, false, `${target.name} database must already be absent`);
        assert.equal(world.rolePresent, false, `${target.name} role must already be absent`);
        return { databaseAbsent: true, roleAbsent: true };
      },
      verifyFinalAbsence: async ({ resources: verifiedResources, ports }) => {
        recordStep("verifyFinalAbsence");
        assert.deepEqual(verifiedResources, exactResources, `${target.name} final resource scope`);
        assert.deepEqual(ports, [...orchestrator.PORTS], `${target.name} final port scope`);
        assert.deepEqual(world, { harnessPresent: false, backendPresent: false, evidenceRetained: true, runtimePresent: false, databasePresent: false, rolePresent: false }, `${target.name} final world`);
        return { runtimeAbsent: true, storageAbsent: true, portsFree: [...orchestrator.PORTS], evidenceRetained: true };
      },
      writeSummaryAndChecksum: async ({ summaryPath, summaryHashPath, summaryBytes, checksumText }) => {
        summaryWrites += 1;
        assert.equal(summaryPath, exactResources.summaryPath, `${target.name} summary path`);
        assert.equal(summaryHashPath, exactResources.summaryHashPath, `${target.name} checksum path`);
        return { durable: true, summarySha256: orchestrator.sha256Hex(summaryBytes), checksumSha256: orchestrator.sha256Hex(checksumText) };
      },
      removeRecoveryState: async ({ path, expectedSha256 }) => {
        recoveryStateRemovals += 1;
        assert.equal(path, exactResources.recoveryStatePath, `${target.name} removed state path`);
        assert.ok(Buffer.isBuffer(durableBytes), `${target.name} state must exist before removal`);
        assert.equal(expectedSha256, orchestrator.sha256Hex(durableBytes), `${target.name} removed state CAS`);
        durableBytes = null;
        return { removed: true, removedSha256: expectedSha256 };
      }
    };

    const partial = await orchestrator.executeCleanup({ state: initial, adapters, finalizeSummary: preflightFinalization });
    assert.equal(completionCasFailureInjected, true, `${target.name} failure injection reached`);
    assert.equal(partial.status, "PARTIAL", `${target.name} first pass`);
    assert.deepEqual(stepCalls, cleanupAdapterNames.slice(0, target.index + 1), `${target.name} halts exactly after target effect`);
    assert.equal(stepCalls.filter((name) => name === target.adapter).length, 1, `${target.name} first effect call`);
    assert.ok(Buffer.isBuffer(durableBytes), `${target.name} durable pending state retained`);
    const durablePending = orchestrator.parseRecoveryState(durableBytes.toString("utf8"));
    assert.equal(durablePending.pendingOperation?.id, orchestrator.CLEANUP_STEPS[target.index], `${target.name} durable pending operation`);
    assert.deepEqual(durablePending.cleanup.completedSteps, orchestrator.CLEANUP_STEPS.slice(0, target.index), `${target.name} no false completion`);
    assert.equal(stateWrites.filter((write) => write.committed === false).length, 1, `${target.name} one failed CAS`);

    const completed = await orchestrator.executeCleanup({ state: durablePending, adapters, finalizeSummary: preflightFinalization });
    assert.equal(completed.status, "COMPLETE", `${target.name} re-entry completes`);
    assert.equal(completed.state.pendingOperation, null, `${target.name} pending operation cleared`);
    assert.deepEqual(completed.state.cleanup.completedSteps, orchestrator.CLEANUP_STEPS, `${target.name} exact cleanup completion`);
    assert.deepEqual(completed.state.taskStatuses, initialTasks, `${target.name} no business task replay`);
    assert.deepEqual(completed.state.completedOperations.filter((id) => !orchestrator.CLEANUP_STEPS.includes(id)), initialCompletedOperations, `${target.name} no business operation replay`);
    assert.equal(stepCalls.filter((name) => name === target.adapter).length, 2, `${target.name} exact idempotent effect/probe replay`);
    assert.equal(materialMutations.shutdownHarness, 1, `${target.name} harness material mutation`);
    assert.equal(materialMutations.stopBackendTree, 1, `${target.name} backend material mutation`);
    assert.equal(materialMutations.retainEvidence, 1, `${target.name} evidence material mutation`);
    assert.equal(materialMutations.removeRuntimeRoot, 1, `${target.name} runtime material mutation`);
    assert.equal(materialMutations.dropDatabase, 1, `${target.name} database material mutation`);
    assert.equal(materialMutations.dropRole, 1, `${target.name} role material mutation`);
    if (target.readOnly) assert.equal(Object.hasOwn(materialMutations, target.adapter), false, `${target.name} remains a read-only probe`);
    else assert.equal(materialMutations[target.adapter], 1, `${target.name} exact target material mutation`);
    assert.equal(stepCalls.every((name) => cleanupAdapterNames.includes(name)), true, `${target.name} cleanup-only adapters`);
    assert.equal(summaryWrites, 1, `${target.name} one final evidence write`);
    assert.equal(recoveryStateRemovals, 1, `${target.name} one state removal`);
    assert.equal(durableBytes, null, `${target.name} state consumed after exact completion`);
  }

  const removalInitial = makeRecoveryState().state;
  let removalDurableBytes = Buffer.from(orchestrator.serializeRecoveryState(removalInitial));
  let finalizingSnapshot = null;
  let removedStateSha256 = null;
  let removalMaterialMutations = 0;
  let removalAdapterCalls = 0;
  const removalSummaryWrites = [];
  const removalRig = cleanupRig();
  removalRig.adapters.writeStateAtomic = async ({ path, bytes, expectedPreviousHash }) => {
    assert.equal(path, removalInitial.resources.recoveryStatePath);
    assert.ok(Buffer.isBuffer(removalDurableBytes));
    assert.equal(expectedPreviousHash, orchestrator.sha256Hex(removalDurableBytes));
    removalDurableBytes = Buffer.from(bytes);
    const candidate = orchestrator.parseRecoveryState(removalDurableBytes.toString("utf8"));
    if (candidate.cleanup.status === "FINALIZING") finalizingSnapshot = Buffer.from(removalDurableBytes);
    return { durable: true, sha256: orchestrator.sha256Hex(removalDurableBytes) };
  };
  removalRig.adapters.writeSummaryAndChecksum = async ({ summaryBytes, checksumText }) => {
    removalSummaryWrites.push({ summaryBytes: Buffer.from(summaryBytes), checksumText });
    return { durable: true, summarySha256: orchestrator.sha256Hex(summaryBytes), checksumSha256: orchestrator.sha256Hex(checksumText) };
  };
  removalRig.adapters.removeRecoveryState = async ({ path, expectedSha256 }) => {
    removalAdapterCalls += 1;
    assert.equal(path, removalInitial.resources.recoveryStatePath);
    if (removalDurableBytes === null) {
      assert.equal(expectedSha256, removedStateSha256, "stale exact re-entry stays bound to the consumed object");
      throw new orchestrator.OrchestratorError("RUN_ALREADY_CONSUMED");
    }
    assert.equal(expectedSha256, orchestrator.sha256Hex(removalDurableBytes));
    removedStateSha256 = expectedSha256;
    removalDurableBytes = null;
    removalMaterialMutations += 1;
    throw new orchestrator.OrchestratorError("INJECTED_AFTER_STATE_REMOVAL_COMMIT");
  };
  await assert.rejects(
    orchestrator.executeCleanup({ state: removalInitial, adapters: removalRig.adapters, finalizeSummary: preflightFinalization }),
    (error) => error.code === "INJECTED_AFTER_STATE_REMOVAL_COMMIT"
  );
  assert.equal(removalDurableBytes, null);
  assert.equal(removalMaterialMutations, 1);
  assert.ok(Buffer.isBuffer(finalizingSnapshot));
  removalRig.effects.length = 0;
  const staleFinalizingState = orchestrator.parseRecoveryState(finalizingSnapshot.toString("utf8"));
  await assert.rejects(
    orchestrator.executeCleanup({ state: staleFinalizingState, adapters: removalRig.adapters, finalizeSummary: preflightFinalization }),
    (error) => error.code === "RUN_ALREADY_CONSUMED"
  );
  assert.equal(removalMaterialMutations, 1, "committed removal is never materially repeated");
  assert.equal(removalAdapterCalls, 2, "stale exact re-entry is observed then refused as consumed");
  assert.deepEqual(removalRig.effects, ["countDatabaseSessions", "verifyCatalogAbsent", "verifyFinalAbsence"], "stale FINALIZING re-entry performs read-only cleanup probes only");
  assert.equal(removalSummaryWrites.length, 2);
  assert.deepEqual(removalSummaryWrites[1], removalSummaryWrites[0]);
});

test("SEQ01 R2 requires a complete hashed R1 with exact audit, cleanup and absence; no R3 exists", () => {
  const evidence = r1EvidenceArtifact();
  assert.equal(orchestrator.isR2Eligible(evidence), true);
  const tamperedBytes = Buffer.from(evidence.summaryBytes);
  tamperedBytes[10] ^= 1;
  for (const mutant of [
    { ...evidence, summaryBytes: tamperedBytes },
    { ...evidence, checksumText: `${"0".repeat(64)}  run-summary.json\n` },
    { ...evidence, summarySha256: "0".repeat(64) },
    { ...evidence, absenceProof: { ...evidence.absenceProof, databaseAbsent: false } },
    { ...evidence, absenceProof: { ...evidence.absenceProof, portsFree: [8080, 5173] } },
    { ...evidence, extra: true }
  ]) assert.equal(orchestrator.isR2Eligible(mutant), false);
  assert.equal(orchestrator.assertRunSequence({ run: "R2", priorRunId: RUN_ID, priorEvidence: evidence, engagedRuns: [] }), true);
  throwsCode(() => orchestrator.assertRunSequence({ run: "R2", priorRunId: RUN_ID, priorEvidence: { ...evidence, absenceProof: { ...evidence.absenceProof, runtimeAbsent: false } }, engagedRuns: [] }), "R2_INELIGIBLE");
  throwsCode(() => orchestrator.assertRunSequence({ run: "R2", priorRunId: "r1-20260810t120000z-ffeeddccbbaa", priorEvidence: evidence, engagedRuns: [] }), "R2_INELIGIBLE");
  throwsCode(() => orchestrator.assertRunSequence({ run: "R2", priorRunId: RUN_ID, priorEvidence: evidence, engagedRuns: ["R1", "R1"] }), "ENGAGED_RUNS_INVALID");
  throwsCode(() => orchestrator.assertRunSequence({ run: "R1", priorEvidence: null, engagedRuns: ["R2"] }), "R1_ATTEMPT_ALREADY_ENGAGED");
  throwsCode(() => orchestrator.validateRun("R3"), "RUN_INVALID");
});

function exactRunOptions(records = makeRecordTexts()) {
  const options = {
    run: records.review.run,
    "run-id": records.review.runId,
    "tenant-id": orchestrator.TENANT_ID,
    environment: orchestrator.ENVIRONMENT,
    "proposal-sha256": records.proposalSha256,
    "pre-execution-review-record-path": REVIEW_RECORD_PATH,
    "pre-execution-review-sha256": orchestrator.sha256Hex(records.reviewText),
    "sensitive-authorization-record-path": AUTHORIZATION_RECORD_PATH,
    "sensitive-authorization-sha256": orchestrator.sha256Hex(records.authorizationText),
    repository: orchestrator.REPOSITORY,
    head: HEAD,
    "protocol-version": orchestrator.PROTOCOL_VERSION,
    "schema-version": orchestrator.SUMMARY_SCHEMA_VERSION
  };
  if (records.review.priorRunId !== null) options["prior-run-id"] = records.review.priorRunId;
  return options;
}

function runArgvFromOptions(options) {
  return ["run", ...Object.entries(options).flatMap(([name, value]) => [`--${name}`, value])];
}

function atomicEngagementOperation({ state, priorStateBytes, records, reviewRecordPath = REVIEW_RECORD_PATH, authorizationRecordPath = AUTHORIZATION_RECORD_PATH }) {
  const stateBytes = Buffer.from(orchestrator.serializeRecoveryState(state));
  const reviewExpectedBytes = Buffer.from(records.reviewText);
  const authorizationExpectedBytes = Buffer.from(records.authorizationText);
  const authorizationConsumedBytes = Buffer.from(orchestrator.canonicalJson(orchestrator.buildConsumedAuthorizationRecord(records.authorization, state.attempt.authorizationConsumedAtUtc)));
  const evidenceBase = resources(state.runId).evidenceBase;
  const evidenceBaseSha256 = orchestrator.sha256Hex(evidenceBase);
  return {
    statePath: state.resources.recoveryStatePath,
    evidenceBase,
    evidenceBaseSha256,
    runSlot: state.run,
    repository: state.repository,
    head: state.head,
    globalRunSlotIdentitySha256: orchestrator.globalRunSlotIdentitySha256({ repository: state.repository, head: state.head, evidenceBaseSha256, runSlot: state.run }),
    expectedPreviousHash: orchestrator.sha256Hex(priorStateBytes),
    bytes: stateBytes,
    reviewRecordPath,
    reviewRecordPathSha256: orchestrator.sha256Hex(reviewRecordPath),
    reviewExpectedBytes,
    reviewExpectedSha256: orchestrator.sha256Hex(reviewExpectedBytes),
    reviewRecordId: records.review.recordId,
    authorizationRecordPath,
    authorizationRecordPathSha256: orchestrator.sha256Hex(authorizationRecordPath),
    authorizationExpectedBytes,
    authorizationExpectedSha256: orchestrator.sha256Hex(authorizationExpectedBytes),
    authorizationConsumedBytes,
    authorizationConsumedSha256: orchestrator.sha256Hex(authorizationConsumedBytes),
    authorizationRecordId: records.authorization.recordId,
    proposalSha256: records.proposalSha256,
    proposedCommandSha256: records.commandSha256,
    commandBindingSha256: state.commandBindingSha256,
    environmentBindingSha256: records.authorization.environmentBindingSha256
  };
}

function completeFakeAdapters(overrides = {}, configuration = {}) {
  const calls = [];
  const records = configuration.records ?? makeRecordTexts(configuration.proposal ?? makeProposal());
  const reviewRecordFiles = new Map([[REVIEW_RECORD_PATH, Buffer.from(records.reviewText)]]);
  const authorizationRecordFiles = new Map([[AUTHORIZATION_RECORD_PATH, Buffer.from(records.authorizationText)]]);
  let durableStateBytes = null;
  let liveProcesses = [];
  let durableExportEvidence = null;
  const consumedAuthorizationRecordIds = new Set();
  const claimedGlobalRunSlots = configuration.claimedGlobalRunSlots ?? new Set();
  const engagementPredecessorStates = [];
  let engagementCommitCount = 0;
  let stateWriteFailureInjected = false;
  let engagementFailureInjected = false;
  let engagementHookApplied = false;
  const replaceDurableState = ({ bytes, expectedPreviousHash }) => {
    const priorHash = durableStateBytes === null ? null : orchestrator.sha256Hex(durableStateBytes);
    assert.equal(expectedPreviousHash, priorHash, "recovery-state CAS must match the exact durable predecessor");
    durableStateBytes = Buffer.from(bytes);
    return { durable: true, sha256: orchestrator.sha256Hex(durableStateBytes) };
  };
  const writeDurableState = (operation) => {
    const candidateState = JSON.parse(Buffer.from(operation.bytes).toString("utf8"));
    const mustFail = !stateWriteFailureInjected && typeof configuration.failStateWriteWhen === "function" && configuration.failStateWriteWhen(candidateState);
    if (mustFail) {
      stateWriteFailureInjected = true;
      if (configuration.failStateWriteAfterCommit === true) replaceDurableState(operation);
      throw new orchestrator.OrchestratorError("INJECTED_STATE_PERSIST_FAILURE");
    }
    return replaceDurableState(operation);
  };
  const base = {
    now: () => "2026-08-10T10:05:00.000Z",
    randomBytes: (length) => Buffer.alloc(length, 1),
    inspectProposalContext: async () => ({ localAppData: LOCAL_APP_DATA, localAppDataMetadata: localAppDataMetadata(), head: HEAD, orchestratorSha256: ORCHESTRATOR_HASH, tools: TOOLS, fixtures: fixtureInspections() }),
    inspectRunContext: async () => ({ localAppData: LOCAL_APP_DATA, localAppDataMetadata: localAppDataMetadata(), repositoryRoot: REPOSITORY_ROOT, head: HEAD, orchestratorSha256: ORCHESTRATOR_HASH, tools: TOOLS, fixtures: fixtureInspections(), passfileMetadata: passfileMetadata(), environmentBindingSha256: fakeEnvironmentBindingSha256() }),
    readRecoveryState: async () => durableStateBytes === null ? null : durableStateBytes.toString("utf8"),
    inspectPreflight: async ({ resources: inspectedResources }) => ({
      ...preflightInspection(),
      pathProof: {
        runtimeRoot: pathProof(inspectedResources.runtimeRoot, false),
        storageRoot: pathProof(inspectedResources.storageRoot, false),
        evidenceRoot: pathProof(inspectedResources.evidenceRoot, false)
      }
    }),
    validateRecoveryResources: async ({ state }) => ({
      stateSha256: orchestrator.sha256Hex(orchestrator.serializeRecoveryState(state)),
      ownershipMarkerSha256: orchestrator.sha256Hex(state.ownershipMarker),
      resourceIdentitiesExact: true,
      processIdentitiesExact: true,
      pathChainsSafe: true,
      foreignResourcesPresent: false,
      discoveredProcesses: state.pendingOperation?.id === "START_RUNTIME" && state.processes.length === 0 ? liveProcesses : [],
      backendApplicationBindingProof: state.pendingOperation?.id === "START_RUNTIME" && state.processes.length === 0 && liveProcesses.some((processValue) => processValue.label === "BACKEND_APPLICATION") ? backendApplicationBindingProof(liveProcesses, state.ownershipMarker, fakeRuntimePlans(state.runId)) : null,
      discoveredExportEvidence: state.pendingOperation?.id === "PRESERVE_EXPORT" && state.exportEvidence === null ? durableExportEvidence : null
    }),
    readBoundRecords: async ({ reviewRecordPath, reviewExpectedSha256, authorizationRecordPath, authorizationExpectedSha256 }) => {
      const reviewBytes = reviewRecordFiles.get(reviewRecordPath);
      const authorizationBytes = authorizationRecordFiles.get(authorizationRecordPath);
      if (!Buffer.isBuffer(reviewBytes) || orchestrator.sha256Hex(reviewBytes) !== reviewExpectedSha256 || !Buffer.isBuffer(authorizationBytes) || orchestrator.sha256Hex(authorizationBytes) !== authorizationExpectedSha256) throw new orchestrator.OrchestratorError("RECORD_FILE_HASH_MISMATCH");
      return { reviewText: reviewBytes.toString("utf8"), reviewBytes: Buffer.from(reviewBytes), authorizationText: authorizationBytes.toString("utf8"), authorizationBytes: Buffer.from(authorizationBytes) };
    },
    scanEngagedRuns: async () => [],
    readR1Evidence: async () => r1EvidenceArtifact(),
    readSensitiveRuntimeInputs: async () => sensitiveRuntimeInputs(),
    inspectPostgresAdmin: async () => postgresAdminResult(),
    writeStateAtomic: async (operation) => writeDurableState(operation),
    provisionResources: async ({ state }) => ({ databaseName: state.resources.dbName, roleName: state.resources.roleName, ownershipMarkerSha256: orchestrator.sha256Hex(state.ownershipMarker), rollbackPlanValidated: true, catalogSnapshot: catalogSnapshotForState(state) }),
    startRuntime: async ({ state, runtimePlans }) => {
      const result = fakeRuntimeResult(runtimePlans, state.ownershipMarker);
      liveProcesses = result.processes;
      return result;
    },
    validateFreshResources: async ({ state }) => ({ stateSha256: orchestrator.sha256Hex(orchestrator.serializeRecoveryState(state)), catalogIdentityExact: true, filesystemIdentityExact: true, processIdentityExact: true }),
    validateFixtures: async () => fixtureInspections(),
    engageAttemptAtomic: async (operation) => {
      engagementPredecessorStates.push(durableStateBytes === null ? null : orchestrator.parseRecoveryState(durableStateBytes.toString("utf8")));
      if (!engagementHookApplied && typeof configuration.beforeEngagement === "function") {
        engagementHookApplied = true;
        configuration.beforeEngagement({ operation, reviewRecordFiles, authorizationRecordFiles, records });
      }
      if (operation.reviewRecordPathSha256 !== orchestrator.sha256Hex(operation.reviewRecordPath)) throw new orchestrator.OrchestratorError("REVIEW_RECORD_PATH_MISMATCH");
      const currentReviewBytes = reviewRecordFiles.get(operation.reviewRecordPath);
      if (!Buffer.isBuffer(currentReviewBytes)) throw new orchestrator.OrchestratorError("REVIEW_RECORD_NOT_CURRENT");
      if (!Buffer.isBuffer(operation.reviewExpectedBytes) || !currentReviewBytes.equals(operation.reviewExpectedBytes) || orchestrator.sha256Hex(currentReviewBytes) !== operation.reviewExpectedSha256) throw new orchestrator.OrchestratorError("REVIEW_RECORD_CHANGED");
      const currentReview = orchestrator.parseReviewRecord(currentReviewBytes.toString("utf8"));
      const engagedState = orchestrator.parseRecoveryState(operation.bytes.toString("utf8"));
      const reviewBoundFields = ["run", "runId", "priorRunId", "tenantId", "environment", "repository", "head"];
      if (
        currentReview.recordId !== operation.reviewRecordId ||
        currentReview.proposalSha256 !== operation.proposalSha256 ||
        currentReview.commandSha256 !== operation.proposedCommandSha256 ||
        currentReview.environmentBindingSha256 !== operation.environmentBindingSha256 ||
        engagedState.reviewRecord.recordId !== operation.reviewRecordId ||
        engagedState.reviewRecord.pathSha256 !== operation.reviewRecordPathSha256 ||
        engagedState.reviewRecord.sha256 !== operation.reviewExpectedSha256 ||
        engagedState.reviewRecord.environmentBindingSha256 !== operation.environmentBindingSha256 ||
        reviewBoundFields.some((field) => currentReview[field] !== engagedState[field])
      ) throw new orchestrator.OrchestratorError("REVIEW_ATOMIC_BINDING_MISMATCH");

      const expectedEvidenceBase = resources(engagedState.runId).evidenceBase;
      const expectedEvidenceBaseSha256 = orchestrator.sha256Hex(expectedEvidenceBase);
      const expectedGlobalRunSlotIdentitySha256 = orchestrator.globalRunSlotIdentitySha256({
        repository: engagedState.repository,
        head: engagedState.head,
        evidenceBaseSha256: expectedEvidenceBaseSha256,
        runSlot: engagedState.run
      });
      if (
        operation.evidenceBase !== expectedEvidenceBase ||
        operation.evidenceBaseSha256 !== expectedEvidenceBaseSha256 ||
        operation.repository !== engagedState.repository ||
        operation.head !== engagedState.head ||
        operation.runSlot !== engagedState.run ||
        operation.globalRunSlotIdentitySha256 !== expectedGlobalRunSlotIdentitySha256
      ) throw new orchestrator.OrchestratorError("GLOBAL_RUN_SLOT_BINDING_MISMATCH");

      if (consumedAuthorizationRecordIds.has(operation.authorizationRecordId)) throw new orchestrator.OrchestratorError("AUTHORIZATION_RECORD_ALREADY_CONSUMED");
      if (claimedGlobalRunSlots.has(expectedGlobalRunSlotIdentitySha256)) throw new orchestrator.OrchestratorError("GLOBAL_RUN_SLOT_ALREADY_CLAIMED");
      if (operation.authorizationRecordPathSha256 !== orchestrator.sha256Hex(operation.authorizationRecordPath)) throw new orchestrator.OrchestratorError("AUTHORIZATION_RECORD_PATH_MISMATCH");
      const currentAuthorizationBytes = authorizationRecordFiles.get(operation.authorizationRecordPath);
      if (!Buffer.isBuffer(currentAuthorizationBytes)) throw new orchestrator.OrchestratorError("AUTHORIZATION_RECORD_NOT_CURRENT");
      if (!Buffer.isBuffer(operation.authorizationExpectedBytes) || !currentAuthorizationBytes.equals(operation.authorizationExpectedBytes) || orchestrator.sha256Hex(currentAuthorizationBytes) !== operation.authorizationExpectedSha256) throw new orchestrator.OrchestratorError("AUTHORIZATION_RECORD_CHANGED");
      if (!Buffer.isBuffer(operation.authorizationConsumedBytes) || orchestrator.sha256Hex(operation.authorizationConsumedBytes) !== operation.authorizationConsumedSha256) throw new orchestrator.OrchestratorError("AUTHORIZATION_CONSUMED_BYTES_INVALID");
      const currentAuthorization = orchestrator.parseSensitiveAuthorizationRecord(currentAuthorizationBytes.toString("utf8"));
      const consumedAuthorization = orchestrator.parseJsonStrict(operation.authorizationConsumedBytes.toString("utf8"));
      const restoredAuthorization = { ...consumedAuthorization, status: "YES", consumedAtUtc: null };
      if (
        currentAuthorization.recordId !== operation.authorizationRecordId ||
        currentAuthorization.proposalSha256 !== operation.proposalSha256 ||
        currentAuthorization.commandSha256 !== operation.proposedCommandSha256 ||
        currentAuthorization.environmentBindingSha256 !== operation.environmentBindingSha256 ||
        currentAuthorization.preExecutionReviewRecordId !== currentReview.recordId ||
        currentAuthorization.preExecutionReviewPathSha256 !== operation.reviewRecordPathSha256 ||
        currentAuthorization.preExecutionReviewSha256 !== operation.reviewExpectedSha256 ||
        reviewBoundFields.some((field) => currentAuthorization[field] !== engagedState[field]) ||
        engagedState.commandBindingSha256 !== operation.commandBindingSha256 ||
        engagedState.proposalSha256 !== operation.proposalSha256 ||
        engagedState.authorizationRecord.recordId !== operation.authorizationRecordId ||
        engagedState.authorizationRecord.pathSha256 !== operation.authorizationRecordPathSha256 ||
        engagedState.authorizationRecord.sha256 !== operation.authorizationExpectedSha256 ||
        engagedState.authorizationRecord.environmentBindingSha256 !== operation.environmentBindingSha256 ||
        engagedState.authorizationRecord.preExecutionReviewRecordId !== currentReview.recordId ||
        engagedState.authorizationRecord.preExecutionReviewPathSha256 !== operation.reviewRecordPathSha256 ||
        engagedState.authorizationRecord.preExecutionReviewSha256 !== operation.reviewExpectedSha256 ||
        engagedState.attempt.engaged !== true ||
        consumedAuthorization.status !== "CONSUMED" ||
        consumedAuthorization.consumedAtUtc !== engagedState.attempt.authorizationConsumedAtUtc ||
        orchestrator.canonicalJson(restoredAuthorization) !== currentAuthorizationBytes.toString("utf8")
      ) throw new orchestrator.OrchestratorError("AUTHORIZATION_ATOMIC_BINDING_MISMATCH");
      const priorHash = durableStateBytes === null ? null : orchestrator.sha256Hex(durableStateBytes);
      if (operation.expectedPreviousHash !== priorHash) throw new orchestrator.OrchestratorError("ATOMIC_STATE_CAS_MISMATCH");
      const nextAuthorizationBytes = Buffer.from(operation.authorizationConsumedBytes);
      const persisted = replaceDurableState(operation);
      authorizationRecordFiles.set(operation.authorizationRecordPath, nextAuthorizationBytes);
      consumedAuthorizationRecordIds.add(operation.authorizationRecordId);
      claimedGlobalRunSlots.add(expectedGlobalRunSlotIdentitySha256);
      engagementCommitCount += 1;
      if (configuration.failEngagementAfterCommit === true && !engagementFailureInjected) {
        engagementFailureInjected = true;
        throw new orchestrator.OrchestratorError("INJECTED_ENGAGEMENT_AFTER_COMMIT_FAILURE");
      }
      let result = {
        ...persisted,
        reviewStillPass: true,
        reviewRecordId: operation.reviewRecordId,
        reviewRecordPathSha256: operation.reviewRecordPathSha256,
        reviewCurrentSha256: orchestrator.sha256Hex(currentReviewBytes),
        authorizationConsumed: true,
        authorizationRecordId: operation.authorizationRecordId,
        authorizationRecordPathSha256: operation.authorizationRecordPathSha256,
        authorizationPriorSha256: operation.authorizationExpectedSha256,
        authorizationConsumedSha256: operation.authorizationConsumedSha256,
        proposalSha256: operation.proposalSha256,
        proposedCommandSha256: operation.proposedCommandSha256,
        commandBindingSha256: operation.commandBindingSha256,
        environmentBindingSha256: operation.environmentBindingSha256,
        globalRunSlotClaimed: true,
        globalRunSlotIdentitySha256: expectedGlobalRunSlotIdentitySha256,
        runSlot: operation.runSlot,
        evidenceBaseSha256: operation.evidenceBaseSha256
      };
      if (typeof configuration.engagementResultMutator === "function") result = configuration.engagementResultMutator({ ...result });
      return result;
    },
    request: async (spec) => responseFor(spec),
    queryAudit: async () => auditEvents(),
    chooseUsefulness: async () => ({ usefulnessScore: 5, observationCode: "NO_FRICTION" }),
    preserveExport: async ({ exportPackId, fileName, bytes, expectedSha256 }) => {
      durableExportEvidence = { exportPackId, fileName, byteSize: bytes.length, sha256: expectedSha256 };
      return { durable: true, exportPackId, fileName, sha256: expectedSha256, byteSize: bytes.length };
    },
    inspectProcessIdentities: async ({ expected }) => ({ observed: expected.map((descriptorValue) => ({ ...descriptorValue })), absentLabels: [] }),
    shutdownHarness: async ({ state }) => ({ stopped: true, releasedPorts: [5173, 5174], ownershipMarkerSha256: orchestrator.sha256Hex(state.ownershipMarker) }),
    stopBackendTree: async ({ state }) => ({ stopped: true, releasedPorts: [8080], ownershipMarkerSha256: orchestrator.sha256Hex(state.ownershipMarker) }),
    retainEvidence: async ({ exportEvidence }) => ({ retained: true, exportSha256: exportEvidence?.sha256 ?? null }),
    removeRuntimeRoot: async ({ path, marker }) => ({ absent: true, pathSha256: orchestrator.sha256Hex(path), ownershipMarkerSha256: orchestrator.sha256Hex(marker) }),
    countDatabaseSessions: async () => 0,
    dropDatabase: async ({ dbName, marker }) => ({ absent: true, databaseName: dbName, ownershipMarkerSha256: orchestrator.sha256Hex(marker) }),
    dropRole: async ({ roleName, marker }) => ({ absent: true, roleName, ownershipMarkerSha256: orchestrator.sha256Hex(marker) }),
    verifyCatalogAbsent: async () => ({ databaseAbsent: true, roleAbsent: true }),
    verifyFinalAbsence: async () => ({ runtimeAbsent: true, storageAbsent: true, portsFree: [...orchestrator.PORTS], evidenceRetained: true }),
    writeSummaryAndChecksum: async ({ summaryBytes, checksumText }) => ({ durable: true, summarySha256: orchestrator.sha256Hex(summaryBytes), checksumSha256: orchestrator.sha256Hex(checksumText) }),
    removeRecoveryState: async ({ expectedSha256 }) => {
      assert.notEqual(durableStateBytes, null, "recovery state must exist before exact removal");
      assert.equal(expectedSha256, orchestrator.sha256Hex(durableStateBytes), "recovery-state removal must bind the last durable bytes");
      durableStateBytes = null;
      return { removed: true, removedSha256: expectedSha256 };
    },
    emit: async ({ stream, text }) => { calls.push({ stream, text }); }
  };
  const adapters = {};
  for (const [name, implementation] of Object.entries({ ...base, ...overrides })) {
    adapters[name] = async (...args) => {
      if (name === "writeStateAtomic" || name === "engageAttemptAtomic") {
        calls.push({ name, expectedPreviousHash: args[0].expectedPreviousHash, state: JSON.parse(Buffer.from(args[0].bytes).toString("utf8")) });
      } else if (name === "request") calls.push({ name, requestId: args[0].requestId });
      else if (name !== "emit") calls.push({ name });
      const result = await implementation(...args);
      if (name === "readRecoveryState" && typeof result === "string") durableStateBytes = Buffer.from(result, "utf8");
      return result;
    };
  }
  adapters.now = () => {
    calls.push({ name: "now" });
    return "2026-08-10T10:05:00.000Z";
  };
  adapters.randomBytes = (length) => {
    calls.push({ name: "randomBytes" });
    return Buffer.alloc(length, 1);
  };
  return {
    adapters,
    calls,
    records,
    durableStateText: () => durableStateBytes === null ? null : durableStateBytes.toString("utf8"),
    reviewRecordText: (recordPath = REVIEW_RECORD_PATH) => reviewRecordFiles.get(recordPath)?.toString("utf8") ?? null,
    authorizationRecordText: (recordPath = AUTHORIZATION_RECORD_PATH) => authorizationRecordFiles.get(recordPath)?.toString("utf8") ?? null,
    consumedAuthorizationCount: () => consumedAuthorizationRecordIds.size,
    claimedRunSlotCount: () => claimedGlobalRunSlots.size,
    engagementCommitCount: () => engagementCommitCount,
    engagementPredecessorStates: () => structuredClone(engagementPredecessorStates)
  };
}

function replaceReviewAtEngagement({ operation, reviewRecordFiles, records }, reviewOverrides, { rebindExpected = false } = {}) {
  const replacementBytes = Buffer.from(orchestrator.canonicalJson({ ...records.review, ...reviewOverrides }));
  reviewRecordFiles.set(operation.reviewRecordPath, replacementBytes);
  if (rebindExpected) {
    operation.reviewExpectedBytes = Buffer.from(replacementBytes);
    operation.reviewExpectedSha256 = orchestrator.sha256Hex(replacementBytes);
  }
}

function assertPreT00Refusal(rig, label) {
  assert.equal(rig.calls.some((call) => call.name === "request"), false, label);
  assert.equal(rig.consumedAuthorizationCount(), 0, label);
  assert.equal(rig.claimedRunSlotCount(), 0, label);
  assert.equal(rig.engagementCommitCount(), 0, label);
  assert.equal(orchestrator.parseSensitiveAuthorizationRecord(rig.authorizationRecordText()).status, "YES", label);
  const predecessors = rig.engagementPredecessorStates();
  assert.equal(predecessors.length, 1, label);
  assert.equal(predecessors[0].attempt.engaged, false, label);
  assert.equal(predecessors[0].attempt.authorizationConsumed, false, label);
  assert.equal(predecessors[0].taskStatuses[0].status, "NOT_REACHED", label);
  assert.equal(rig.durableStateText(), null, label);
}

test("O01 propose is read-only through injected adapters and emits canonical non-secret evidence", async () => {
  const rig = completeFakeAdapters();
  const instance = orchestrator.createOrchestrator(rig.adapters);
  const envelope = await instance.propose({ run: "R1" });
  assert.equal(envelope.proposal.run, "R1");
  assert.match(envelope.proposalSha256, orchestrator.SHA256_REGEX);
  const effectNames = rig.calls.map((call) => call.name).filter(Boolean);
  assert.equal(effectNames.includes("inspectProposalContext"), true);
  assert.equal(effectNames.some((name) => ["provisionResources", "startRuntime", "request", "queryAudit", "removeRuntimeRoot"].includes(name)), false);
  assert.doesNotThrow(() => orchestrator.assertNoSensitiveEvidence(envelope));
  const serialized = JSON.stringify(envelope);
  for (const privateValue of [LOCAL_APP_DATA, resources().runtimeRoot, resources().storageRoot, resources().evidenceRoot]) assert.equal(serialized.includes(privateValue), false);
});

test("O02 full R1 orchestration succeeds entirely against fakes with no real adapter fallback", async () => {
  const proposal = makeProposal();
  const records = makeRecordTexts(proposal);
  let postgresPlansObserved = false;
  let runtimePlansObserved = false;
  let boundRecordInputs;
  let harnessCleanupLabels = [];
  let backendCleanupLabels = [];
  const rig = completeFakeAdapters({
    readBoundRecords: async (inputs) => {
      boundRecordInputs = inputs;
      return { reviewText: records.reviewText, reviewBytes: Buffer.from(records.reviewText), authorizationText: records.authorizationText, authorizationBytes: Buffer.from(records.authorizationText) };
    },
    provisionResources: async ({ state, adminInspectionPlan, postgresPlan }) => {
      assert.equal(adminInspectionPlan.readOnly, true);
      assert.match(adminInspectionPlan.stdin, /READ ONLY/);
      assert.match(adminInspectionPlan.stdin, /ROLLBACK/);
      assert.deepEqual(postgresPlan.steps.map((step) => step.id), ["CREATE_RUNNER_ROLE", "CREATE_RUN_DATABASE", "HARDEN_RUN_DATABASE"]);
      assert.deepEqual(postgresPlan.rollback.map((step) => step.id), ["DROP_RUN_DATABASE", "DROP_RUNNER_ROLE"]);
      postgresPlansObserved = true;
      return { databaseName: state.resources.dbName, roleName: state.resources.roleName, ownershipMarkerSha256: orchestrator.sha256Hex(state.ownershipMarker), rollbackPlanValidated: true, catalogSnapshot: catalogSnapshotForState(state) };
    },
    startRuntime: async ({ state, runtimePlans }) => {
      assert.deepEqual(Object.keys(runtimePlans), ["seed", "backend", "harness", "viteAccountant", "viteReviewer"]);
      assert.deepEqual([runtimePlans.seed.label, runtimePlans.backend.label, runtimePlans.harness.label], ["DEMO_SEED", "BACKEND_GRADLE", "TWO_ACTOR_HARNESS"]);
      assert.equal(Object.hasOwn(runtimePlans.harness.environment, "NODE_OPTIONS"), false);
      assert.equal(runtimePlans.seed.shell || runtimePlans.backend.shell || runtimePlans.harness.shell, false);
      assert.deepEqual(runtimePlans.viteAccountant.environmentNames.slice(-3), ["RITOMER_LOCAL_DEMO_BACKEND_TARGET", "RITOMER_LOCAL_DEMO_PROXY_AUTH_ENABLED", "RITOMER_LOCAL_DEMO_BEARER_TOKEN"]);
      assert.equal(JSON.stringify(runtimePlans.viteAccountant).includes("actor-token"), false);
      runtimePlansObserved = true;
      return fakeRuntimeResult(runtimePlans, state.ownershipMarker);
    },
    shutdownHarness: async ({ state, processes }) => {
      harnessCleanupLabels = processes.map((descriptorValue) => descriptorValue.label);
      return { stopped: true, releasedPorts: [5173, 5174], ownershipMarkerSha256: orchestrator.sha256Hex(state.ownershipMarker) };
    },
    stopBackendTree: async ({ state, processes }) => {
      backendCleanupLabels = processes.map((descriptorValue) => descriptorValue.label);
      return { stopped: true, releasedPorts: [8080], ownershipMarkerSha256: orchestrator.sha256Hex(state.ownershipMarker) };
    }
  });
  const options = exactRunOptions(records);
  const result = await orchestrator.createOrchestrator(rig.adapters).run(options);
  assert.equal(result.status, "COMPLETE", JSON.stringify(result.state.cleanup.residuals));
  assert.equal(result.r2Eligible, true);
  assert.equal(postgresPlansObserved, true);
  assert.equal(runtimePlansObserved, true);
  assert.deepEqual(boundRecordInputs, { reviewRecordPath: REVIEW_RECORD_PATH, reviewExpectedSha256: orchestrator.sha256Hex(records.reviewText), authorizationRecordPath: AUTHORIZATION_RECORD_PATH, authorizationExpectedSha256: orchestrator.sha256Hex(records.authorizationText) });
  assert.deepEqual(harnessCleanupLabels, ["VITE_REVIEWER", "VITE_ACCOUNTANT", "TWO_ACTOR_HARNESS"]);
  assert.deepEqual(backendCleanupLabels, ["BACKEND_APPLICATION", "BACKEND_GRADLE"]);
  const names = rig.calls.map((call) => call.name).filter(Boolean);
  assert.equal(names.includes("provisionResources"), true);
  assert.equal(names.includes("startRuntime"), true);
  assert.equal(names.filter((name) => name === "request").length, 24);
  assert.equal(names.includes("queryAudit"), true);
  assert.equal(names.includes("removeRecoveryState"), true);
  const firstStateWrite = rig.calls.find((call) => call.name === "writeStateAtomic");
  assert.equal(firstStateWrite.expectedPreviousHash, null);
  assert.equal(firstStateWrite.state.pendingOperation, null);
  for (const [effectName, operationId] of [["provisionResources", "PROVISION_RESOURCES"], ["startRuntime", "START_RUNTIME"]]) {
    const effectIndex = rig.calls.findIndex((call) => call.name === effectName);
    const precedingWrite = [...rig.calls.slice(0, effectIndex)].reverse().find((call) => call.name === "writeStateAtomic");
    assert.equal(precedingWrite.state.pendingOperation.id, operationId);
  }
  const engagedWrite = rig.calls.find((call) => call.name === "engageAttemptAtomic");
  assert.equal(engagedWrite.state.attempt.engaged, true);
  assert.deepEqual(engagedWrite.state.processes.map((processValue) => processValue.label), fakeRuntimeProcesses().map((processValue) => processValue.label));
  const durableStateJson = JSON.stringify(rig.calls.filter((call) => call.state !== undefined).map((call) => call.state));
  for (const forbidden of [REVIEW_RECORD_PATH, AUTHORIZATION_RECORD_PATH, sensitiveRuntimeInputs().postgresAdminPassfileInspection.path, sensitiveRuntimeInputs().jwtHmacSecret, Buffer.alloc(32, 1).toString("base64url")]) assert.equal(durableStateJson.includes(forbidden), false);
});

test("O03 exact recovery enters cleanup-only and never calls a business adapter", async () => {
  const { state, records } = makeRecoveryState();
  const rig = completeFakeAdapters({
    readRecoveryState: async () => orchestrator.serializeRecoveryState(state),
    inspectPreflight: async () => preflightInspection({ evidenceRootPresent: true })
  });
  const result = await orchestrator.createOrchestrator(rig.adapters).run(exactRunOptions(records));
  assert.equal(result.status, "COMPLETE");
  const names = rig.calls.map((call) => call.name).filter(Boolean);
  assert.equal(names.includes("validateRecoveryResources"), true);
  assert.equal(names.some((name) => ["readBoundRecords", "provisionResources", "startRuntime", "engageAttemptAtomic", "request", "queryAudit", "chooseUsefulness"].includes(name)), false);
  assert.equal(names.includes("removeRecoveryState"), true);
});

test("O05 recovery durably adopts exact discovered runtime descriptors only for pending START_RUNTIME", async () => {
  const base = makeRecoveryState();
  let pending = orchestrator.setPendingOperation(base.state, { id: "PROVISION_RESOURCES", target: base.state.resources.dbName, expectedIdentity: "8".repeat(64), nowUtc: "2026-08-10T10:02:01.000Z" });
  let state = orchestrator.completePendingOperation(pending, { id: "PROVISION_RESOURCES", nowUtc: "2026-08-10T10:02:02.000Z" });
  state = bindRuntimePlanToState(state);
  state = orchestrator.setPendingOperation(state, { id: "START_RUNTIME", target: state.resources.runtimeRoot, expectedIdentity: runtimeStartExpectedIdentity(state), nowUtc: "2026-08-10T10:02:03.000Z" });
  let harnessLabels = [];
  let backendLabels = [];
  const discoveredProcesses = fakeRuntimeProcesses();
  const rig = completeFakeAdapters({
    readRecoveryState: async () => orchestrator.serializeRecoveryState(state),
    inspectPreflight: async () => preflightInspection({ evidenceRootPresent: true }),
    validateRecoveryResources: async ({ state: inspectedState }) => ({
      stateSha256: orchestrator.sha256Hex(orchestrator.serializeRecoveryState(inspectedState)),
      ownershipMarkerSha256: orchestrator.sha256Hex(inspectedState.ownershipMarker),
      resourceIdentitiesExact: true,
      processIdentitiesExact: true,
      pathChainsSafe: true,
      foreignResourcesPresent: false,
      discoveredProcesses,
      backendApplicationBindingProof: backendApplicationBindingProof(discoveredProcesses, inspectedState.ownershipMarker, fakeRuntimePlans(inspectedState.runId)),
      discoveredExportEvidence: null
    }),
    shutdownHarness: async ({ state: cleanupState, processes }) => {
      harnessLabels = processes.map((item) => item.label);
      return { stopped: true, releasedPorts: [5173, 5174], ownershipMarkerSha256: orchestrator.sha256Hex(cleanupState.ownershipMarker) };
    },
    stopBackendTree: async ({ state: cleanupState, processes }) => {
      backendLabels = processes.map((item) => item.label);
      return { stopped: true, releasedPorts: [8080], ownershipMarkerSha256: orchestrator.sha256Hex(cleanupState.ownershipMarker) };
    }
  });
  const result = await orchestrator.createOrchestrator(rig.adapters).run(exactRunOptions(base.records));
  assert.equal(result.status, "COMPLETE");
  assert.deepEqual(harnessLabels, ["VITE_REVIEWER", "VITE_ACCOUNTANT", "TWO_ACTOR_HARNESS"]);
  assert.deepEqual(backendLabels, ["BACKEND_APPLICATION", "BACKEND_GRADLE"]);
  const names = rig.calls.map((call) => call.name).filter(Boolean);
  assert.equal(names.includes("startRuntime"), false);
  const adoptionWrite = rig.calls.find((call) => call.name === "writeStateAtomic" && call.state.pendingOperation?.id === "START_RUNTIME" && call.state.processes.length === 5);
  assert.notEqual(adoptionWrite, undefined);
  const hostileProof = { stateSha256: orchestrator.sha256Hex(orchestrator.serializeRecoveryState(base.state)), ownershipMarkerSha256: orchestrator.sha256Hex(base.state.ownershipMarker), resourceIdentitiesExact: true, processIdentitiesExact: true, pathChainsSafe: true, foreignResourcesPresent: false, discoveredProcesses, backendApplicationBindingProof: null, discoveredExportEvidence: null };
  throwsCode(() => orchestrator.validateRecoveryResourceProof(hostileProof, base.state), "RECOVERY_DISCOVERED_PROCESSES_UNEXPECTED");
});

test("O05b every exact partial runtime launch prefix is recoverable as cleanup-only", async () => {
  const prefixes = [
    [boundRuntimeDescriptor({ label: "DEMO_SEED", pid: 7 })],
    fakeRuntimeProcesses().slice(0, 1),
    fakeRuntimeProcesses().slice(0, 2),
    fakeRuntimeProcesses().slice(0, 3),
    fakeRuntimeProcesses().slice(0, 4)
  ];
  for (const discoveredProcesses of prefixes) {
    const base = makeRecoveryState();
    let pending = orchestrator.setPendingOperation(base.state, { id: "PROVISION_RESOURCES", target: base.state.resources.dbName, expectedIdentity: "8".repeat(64), nowUtc: "2026-08-10T10:02:01.000Z" });
    let state = orchestrator.completePendingOperation(pending, { id: "PROVISION_RESOURCES", nowUtc: "2026-08-10T10:02:02.000Z" });
    state = bindRuntimePlanToState(state);
    state = orchestrator.setPendingOperation(state, { id: "START_RUNTIME", target: state.resources.runtimeRoot, expectedIdentity: runtimeStartExpectedIdentity(state), nowUtc: "2026-08-10T10:02:03.000Z" });
    const rig = completeFakeAdapters({
      readRecoveryState: async () => orchestrator.serializeRecoveryState(state),
      inspectPreflight: async () => preflightInspection({ evidenceRootPresent: true }),
      validateRecoveryResources: async ({ state: inspectedState }) => ({ stateSha256: orchestrator.sha256Hex(orchestrator.serializeRecoveryState(inspectedState)), ownershipMarkerSha256: orchestrator.sha256Hex(inspectedState.ownershipMarker), resourceIdentitiesExact: true, processIdentitiesExact: true, pathChainsSafe: true, foreignResourcesPresent: false, discoveredProcesses, backendApplicationBindingProof: backendApplicationBindingProof(discoveredProcesses, inspectedState.ownershipMarker, fakeRuntimePlans(inspectedState.runId)), discoveredExportEvidence: null })
    });
    const result = await orchestrator.createOrchestrator(rig.adapters).run(exactRunOptions(base.records));
    assert.equal(result.status, "COMPLETE");
    assert.equal(rig.calls.some((call) => call.name === "startRuntime"), false);
  }
  throwsCode(() => orchestrator.validateRuntimeProcessSubset([fakeRuntimeProcesses()[0], fakeRuntimeProcesses()[4]]), "RUNTIME_PROCESS_PHASE_INVALID");
  const base = makeRecoveryState();
  let pending = orchestrator.setPendingOperation(base.state, { id: "PROVISION_RESOURCES", target: base.state.resources.dbName, expectedIdentity: "8".repeat(64), nowUtc: "2026-08-10T10:02:01.000Z" });
  let recoveryState = orchestrator.completePendingOperation(pending, { id: "PROVISION_RESOURCES", nowUtc: "2026-08-10T10:02:02.000Z" });
  recoveryState = bindRuntimePlanToState(recoveryState);
  recoveryState = orchestrator.setPendingOperation(recoveryState, { id: "START_RUNTIME", target: recoveryState.resources.runtimeRoot, expectedIdentity: runtimeStartExpectedIdentity(recoveryState), nowUtc: "2026-08-10T10:02:03.000Z" });
  for (const mutation of [
    { executablePath: "C:\\Foreign\\cmd.exe" },
    { executableSha256: "8".repeat(64) },
    { commandLineSha256: "9".repeat(64) }
  ]) {
    const discoveredProcesses = fakeRuntimeProcesses();
    discoveredProcesses[0] = { ...discoveredProcesses[0], ...mutation };
    const proof = { stateSha256: orchestrator.sha256Hex(orchestrator.serializeRecoveryState(recoveryState)), ownershipMarkerSha256: orchestrator.sha256Hex(recoveryState.ownershipMarker), resourceIdentitiesExact: true, processIdentitiesExact: true, pathChainsSafe: true, foreignResourcesPresent: false, discoveredProcesses, backendApplicationBindingProof: backendApplicationBindingProof(discoveredProcesses, recoveryState.ownershipMarker, fakeRuntimePlans(recoveryState.runId)), discoveredExportEvidence: null };
    assert.throws(() => orchestrator.validateRecoveryResourceProof(proof, recoveryState), orchestrator.OrchestratorError);
  }
  const alteredApplication = fakeRuntimeProcesses();
  const staleApplicationProof = backendApplicationBindingProof(alteredApplication, recoveryState.ownershipMarker, fakeRuntimePlans(recoveryState.runId));
  alteredApplication[1] = { ...alteredApplication[1], commandLineSha256: "8".repeat(64) };
  const alteredProof = { stateSha256: orchestrator.sha256Hex(orchestrator.serializeRecoveryState(recoveryState)), ownershipMarkerSha256: orchestrator.sha256Hex(recoveryState.ownershipMarker), resourceIdentitiesExact: true, processIdentitiesExact: true, pathChainsSafe: true, foreignResourcesPresent: false, discoveredProcesses: alteredApplication, backendApplicationBindingProof: staleApplicationProof, discoveredExportEvidence: null };
  throwsCode(() => orchestrator.validateRecoveryResourceProof(alteredProof, recoveryState), "BACKEND_APPLICATION_BINDING_PROOF_INVALID");
});

test("O04 unexpected adapter access fails fast and stable errors never expose raw diagnostics", async () => {
  const rig = completeFakeAdapters({ inspectProposalContext: async () => { throw new Error("C:\\Users\\Example\\private-secret"); } });
  await assert.rejects(orchestrator.createOrchestrator(rig.adapters).propose({ run: "R1" }), (error) => error.code === "ORCHESTRATOR_FAILURE" && !JSON.stringify(error).includes("private-secret"));
  assert.deepEqual(orchestrator.sanitizeDiagnostic(new Error("C:\\Users\\Example\\private-secret")), { code: "ORCHESTRATOR_FAILURE" });
  const hostile = new orchestrator.OrchestratorError("C:\\Users\\Example\\private-secret", { token: "hidden" });
  assert.deepEqual(orchestrator.sanitizeDiagnostic(hostile), { code: "ORCHESTRATOR_FAILURE" });
  assert.equal(JSON.stringify(orchestrator.normalizeFailure(hostile)).includes("private-secret"), false);
  await assert.rejects(orchestrator.createOrchestrator({}).propose({ run: "R1" }), (error) => error.code === "ADAPTER_METHOD_MISSING" && !JSON.stringify(error).includes("private-secret"));
});

test("O06 critical orchestration boundaries fail once, preserve the original code and never bypass cleanup", async () => {
  const boundaries = [
    "inspectRunContext",
    "readRecoveryState",
    "readBoundRecords",
    "inspectPreflight",
    "scanEngagedRuns",
    "readSensitiveRuntimeInputs",
    "inspectPostgresAdmin",
    "writeStateAtomic",
    "provisionResources",
    "startRuntime",
    "validateFreshResources",
    "validateFixtures",
    "engageAttemptAtomic",
    "preserveExport",
    "queryAudit",
    "chooseUsefulness",
    "writeSummaryAndChecksum",
    "removeRecoveryState"
  ];
  for (const method of boundaries) {
    const rig = completeFakeAdapters({ [method]: async () => { throw new orchestrator.OrchestratorError("INJECTED_BOUNDARY_FAILURE"); } });
    await assert.rejects(orchestrator.createOrchestrator(rig.adapters).run(exactRunOptions(rig.records)), (error) => error.code === "INJECTED_BOUNDARY_FAILURE", `${method} must preserve a stable original failure`);
    const names = rig.calls.map((call) => call.name).filter(Boolean);
    if (["inspectRunContext", "readRecoveryState", "readBoundRecords", "inspectPreflight", "scanEngagedRuns", "readSensitiveRuntimeInputs", "inspectPostgresAdmin", "writeStateAtomic"].includes(method)) assert.equal(names.includes("provisionResources"), false);
    if (!["inspectRunContext", "readRecoveryState", "readBoundRecords", "inspectPreflight", "scanEngagedRuns", "readSensitiveRuntimeInputs", "inspectPostgresAdmin", "writeStateAtomic", "writeSummaryAndChecksum", "removeRecoveryState"].includes(method)) assert.equal(names.includes("shutdownHarness"), true, `${method} must enter cleanup after managed state exists`);
    assert.equal(names.filter((name) => name === method).length >= 1, true);
  }
  const r2Proposal = makeProposal({ run: "R2", runId: R2_RUN_ID, priorRunId: RUN_ID });
  const r2Rig = completeFakeAdapters({ readR1Evidence: async () => { throw new orchestrator.OrchestratorError("INJECTED_BOUNDARY_FAILURE"); } }, { proposal: r2Proposal });
  await assert.rejects(orchestrator.createOrchestrator(r2Rig.adapters).run(exactRunOptions(r2Rig.records)), (error) => error.code === "INJECTED_BOUNDARY_FAILURE");
  assert.equal(r2Rig.calls.some((call) => call.name === "readSensitiveRuntimeInputs"), false);
});

test("O07 the in-memory T00 CAS consumes one authorization record globally and exactly once", async () => {
  const rig = completeFakeAdapters();
  const base = makeRecoveryState().state;
  let pending = orchestrator.setPendingOperation(base, { id: "PROVISION_RESOURCES", target: base.resources.dbName, expectedIdentity: "8".repeat(64), nowUtc: "2026-08-10T10:02:01.000Z" });
  let ready = orchestrator.completePendingOperation(pending, { id: "PROVISION_RESOURCES", nowUtc: "2026-08-10T10:02:02.000Z" });
  ready = bindRuntimePlanToState(ready);
  pending = orchestrator.setPendingOperation(ready, { id: "START_RUNTIME", target: ready.resources.runtimeRoot, expectedIdentity: runtimeStartExpectedIdentity(ready), nowUtc: "2026-08-10T10:02:03.000Z" });
  ready = orchestrator.completePendingOperation(pending, { id: "START_RUNTIME", nowUtc: "2026-08-10T10:02:04.000Z", applyCompletion: (stateValue) => { stateValue.processes = fakeRuntimeProcesses(); return stateValue; } });
  const readyBytes = Buffer.from(orchestrator.serializeRecoveryState(ready));
  await rig.adapters.writeStateAtomic({ path: ready.resources.recoveryStatePath, bytes: readyBytes, expectedPreviousHash: null });
  const engaged = orchestrator.engageRunAttempt(ready, "2026-08-10T10:03:00.000Z");
  const engagedBytes = Buffer.from(orchestrator.serializeRecoveryState(engaged));
  const engagement = atomicEngagementOperation({ state: engaged, priorStateBytes: readyBytes, records: rig.records });
  const proof = await rig.adapters.engageAttemptAtomic(engagement);
  assert.equal(proof.reviewStillPass, true);
  assert.equal(proof.reviewRecordId, rig.records.review.recordId);
  assert.equal(proof.reviewRecordPathSha256, orchestrator.sha256Hex(REVIEW_RECORD_PATH));
  assert.equal(proof.reviewCurrentSha256, orchestrator.sha256Hex(rig.records.reviewText));
  assert.equal(proof.authorizationRecordPathSha256, orchestrator.sha256Hex(AUTHORIZATION_RECORD_PATH));
  assert.equal(proof.authorizationPriorSha256, orchestrator.sha256Hex(rig.records.authorizationText));
  assert.equal(proof.commandBindingSha256, engaged.commandBindingSha256);
  assert.equal(proof.globalRunSlotClaimed, true);
  assert.equal(proof.globalRunSlotIdentitySha256, engagement.globalRunSlotIdentitySha256);
  assert.equal(proof.runSlot, "R1");
  assert.equal(proof.evidenceBaseSha256, orchestrator.sha256Hex(resources().evidenceBase));
  assert.equal(orchestrator.parseReviewRecord(rig.reviewRecordText()).status, "PASS");
  assert.equal(orchestrator.parseJsonStrict(rig.authorizationRecordText()).status, "CONSUMED");
  await assert.rejects(rig.adapters.engageAttemptAtomic({ ...engagement, expectedPreviousHash: orchestrator.sha256Hex(engagedBytes) }), (error) => error.code === "AUTHORIZATION_RECORD_ALREADY_CONSUMED");
  await assert.rejects(rig.adapters.engageAttemptAtomic({ ...engagement, expectedPreviousHash: orchestrator.sha256Hex(engagedBytes), authorizationRecordId: "043c-authorization-record-002" }), (error) => error.code === "GLOBAL_RUN_SLOT_ALREADY_CLAIMED");
  assert.equal(rig.engagementCommitCount(), 1);
});

test("O07b T00 atomically rejects post-read authorization replacement, relocation and partial or mismatched proof", async () => {
  const replacementCases = [
    {
      label: "REVOKED_SAME_PATH",
      expectedCode: "AUTHORIZATION_RECORD_CHANGED",
      beforeEngagement: ({ authorizationRecordFiles, records }) => authorizationRecordFiles.set(AUTHORIZATION_RECORD_PATH, Buffer.from(orchestrator.canonicalJson({ ...records.authorization, status: "NO" })))
    },
    {
      label: "SAME_ID_DIFFERENT_BYTES",
      expectedCode: "AUTHORIZATION_RECORD_CHANGED",
      beforeEngagement: ({ authorizationRecordFiles, records }) => authorizationRecordFiles.set(AUTHORIZATION_RECORD_PATH, Buffer.from(orchestrator.canonicalJson({ ...records.authorization, authorizedAtUtc: "2026-08-10T10:01:01.000Z" })))
    },
    {
      label: "SAME_ID_DIFFERENT_PATH",
      expectedCode: "AUTHORIZATION_RECORD_NOT_CURRENT",
      beforeEngagement: ({ authorizationRecordFiles }) => {
        const bytes = authorizationRecordFiles.get(AUTHORIZATION_RECORD_PATH);
        authorizationRecordFiles.delete(AUTHORIZATION_RECORD_PATH);
        authorizationRecordFiles.set("C:\\Secure\\relocated-authorization.json", bytes);
      }
    }
  ];
  for (const mutation of replacementCases) {
    const rig = completeFakeAdapters({}, { beforeEngagement: mutation.beforeEngagement });
    await assert.rejects(orchestrator.createOrchestrator(rig.adapters).run(exactRunOptions(rig.records)), (error) => error.code === mutation.expectedCode, mutation.label);
    assert.equal(rig.calls.some((call) => call.name === "request"), false, mutation.label);
    assert.equal(rig.consumedAuthorizationCount(), 0, mutation.label);
    assert.equal(rig.claimedRunSlotCount(), 0, mutation.label);
    assert.equal(rig.durableStateText(), null, mutation.label);
  }

  const beforeCommitFailure = completeFakeAdapters({}, { beforeEngagement: () => { throw new orchestrator.OrchestratorError("INJECTED_AUTHORIZATION_CAS_FAILURE"); } });
  await assert.rejects(orchestrator.createOrchestrator(beforeCommitFailure.adapters).run(exactRunOptions(beforeCommitFailure.records)), (error) => error.code === "INJECTED_AUTHORIZATION_CAS_FAILURE");
  assert.equal(beforeCommitFailure.consumedAuthorizationCount(), 0);
  assert.equal(beforeCommitFailure.claimedRunSlotCount(), 0);
  assert.equal(orchestrator.parseSensitiveAuthorizationRecord(beforeCommitFailure.authorizationRecordText()).status, "YES");

  const mismatchedProof = completeFakeAdapters({}, { engagementResultMutator: (result) => ({ ...result, commandBindingSha256: "0".repeat(64) }) });
  await assert.rejects(orchestrator.createOrchestrator(mismatchedProof.adapters).run(exactRunOptions(mismatchedProof.records)), (error) => error.code === "T00_ENGAGEMENT_FAILED");
  assert.equal(mismatchedProof.consumedAuthorizationCount(), 1);
  assert.equal(mismatchedProof.claimedRunSlotCount(), 1);
  assert.equal(orchestrator.parseJsonStrict(mismatchedProof.authorizationRecordText()).status, "CONSUMED");
  assert.equal(mismatchedProof.calls.some((call) => call.name === "request"), false);
  assert.equal(mismatchedProof.durableStateText(), null);
});

test("O07c T00 revalidates the exact current PASS review before every atomic engagement", async () => {
  const replacementCases = [
    {
      label: "STATUS_FAIL_SAME_PATH",
      expectedCode: "REVIEW_RECORD_CHANGED",
      beforeEngagement: (context) => replaceReviewAtEngagement(context, { status: "FAIL" })
    },
    {
      label: "STATUS_INCONCLUSIVE_SAME_PATH",
      expectedCode: "REVIEW_RECORD_CHANGED",
      beforeEngagement: (context) => replaceReviewAtEngagement(context, { status: "INCONCLUSIVE" })
    },
    {
      label: "SAME_ID_DIFFERENT_BYTES",
      expectedCode: "REVIEW_RECORD_CHANGED",
      beforeEngagement: (context) => replaceReviewAtEngagement(context, { reviewedAtUtc: "2026-08-10T10:00:01.000Z" })
    },
    {
      label: "SAME_BYTES_RELOCATED",
      expectedCode: "REVIEW_RECORD_NOT_CURRENT",
      beforeEngagement: ({ operation, reviewRecordFiles }) => {
        const bytes = reviewRecordFiles.get(operation.reviewRecordPath);
        reviewRecordFiles.delete(operation.reviewRecordPath);
        reviewRecordFiles.set("C:\\Secure\\relocated-review.json", bytes);
      }
    },
    {
      label: "REVIEW_DELETED",
      expectedCode: "REVIEW_RECORD_NOT_CURRENT",
      beforeEngagement: ({ operation, reviewRecordFiles }) => reviewRecordFiles.delete(operation.reviewRecordPath)
    },
    {
      label: "CURRENT_HASH_DIFFERENT",
      expectedCode: "REVIEW_RECORD_CHANGED",
      beforeEngagement: ({ operation, reviewRecordFiles, records }) => reviewRecordFiles.set(operation.reviewRecordPath, Buffer.from(`${records.reviewText} `))
    },
    {
      label: "REVIEW_ENVIRONMENT_BINDING_DIFFERENT",
      expectedCode: "REVIEW_RECORD_CHANGED",
      beforeEngagement: (context) => replaceReviewAtEngagement(context, { environmentBindingSha256: "0".repeat(64) })
    },
    {
      label: "REVIEW_PATH_HASH_DIFFERENT",
      expectedCode: "REVIEW_RECORD_PATH_MISMATCH",
      beforeEngagement: ({ operation }) => { operation.reviewRecordPathSha256 = "0".repeat(64); }
    }
  ];
  for (const mutation of replacementCases) {
    const rig = completeFakeAdapters({}, { beforeEngagement: mutation.beforeEngagement });
    await assert.rejects(orchestrator.createOrchestrator(rig.adapters).run(exactRunOptions(rig.records)), (error) => error.code === mutation.expectedCode, mutation.label);
    assertPreT00Refusal(rig, mutation.label);
  }
});

test("O07d the T00 adapter rejects rebound non-PASS or tuple-divergent review bytes inside its critical section", async () => {
  const exactAdapterCases = [
    { label: "NON_PASS_FAIL", overrides: { status: "FAIL" }, expectedCode: "PRE_EXECUTION_REVIEW_NOT_PASS" },
    { label: "NON_PASS_INCONCLUSIVE", overrides: { status: "INCONCLUSIVE" }, expectedCode: "PRE_EXECUTION_REVIEW_NOT_PASS" },
    { label: "DIFFERENT_RECORD_ID", overrides: { recordId: "043c-review-record-002" }, expectedCode: "REVIEW_ATOMIC_BINDING_MISMATCH" },
    { label: "DIFFERENT_PROPOSAL", overrides: { proposalSha256: "0".repeat(64) }, expectedCode: "REVIEW_ATOMIC_BINDING_MISMATCH" },
    { label: "DIFFERENT_COMMAND", overrides: { commandSha256: "1".repeat(64) }, expectedCode: "REVIEW_ATOMIC_BINDING_MISMATCH" },
    { label: "DIFFERENT_RUN_TUPLE", overrides: { run: "R2", runId: R2_RUN_ID, priorRunId: RUN_ID }, expectedCode: "REVIEW_ATOMIC_BINDING_MISMATCH" },
    { label: "DIFFERENT_RUN_ID", overrides: { runId: "r1-20260810t121500z-112233445566" }, expectedCode: "REVIEW_ATOMIC_BINDING_MISMATCH" },
    { label: "DIFFERENT_TENANT", overrides: { tenantId: "036a0000-0000-4000-8000-000000000099" }, expectedCode: "REVIEW_RECORD_INVALID" },
    { label: "DIFFERENT_ENVIRONMENT", overrides: { environment: "LOCAL_SYNTHETIC_OTHER" }, expectedCode: "REVIEW_RECORD_INVALID" },
    { label: "DIFFERENT_REPOSITORY", overrides: { repository: "Qamrito-90/other" }, expectedCode: "REVIEW_RECORD_INVALID" },
    { label: "DIFFERENT_HEAD", overrides: { head: "f".repeat(40) }, expectedCode: "REVIEW_ATOMIC_BINDING_MISMATCH" },
    { label: "DIFFERENT_ENVIRONMENT_BINDING", overrides: { environmentBindingSha256: "2".repeat(64) }, expectedCode: "REVIEW_ATOMIC_BINDING_MISMATCH" }
  ];
  for (const mutation of exactAdapterCases) {
    const rig = completeFakeAdapters({}, {
      beforeEngagement: (context) => replaceReviewAtEngagement(context, mutation.overrides, { rebindExpected: true })
    });
    await assert.rejects(orchestrator.createOrchestrator(rig.adapters).run(exactRunOptions(rig.records)), (error) => error.code === mutation.expectedCode, mutation.label);
    assertPreT00Refusal(rig, mutation.label);
  }
});

test("O07e authorization-to-review and environment bindings refuse every canonical cross-record mutant", async () => {
  const proposal = makeProposal();
  const bindingCases = [
    { label: "OTHER_REVIEW_ID", overrides: { preExecutionReviewRecordId: "043c-review-record-002" }, expectedCode: "RECORD_REVIEW_BINDING_MISMATCH" },
    { label: "OTHER_REVIEW_PATH_HASH", overrides: { preExecutionReviewPathSha256: "0".repeat(64) }, expectedCode: "RECORD_REVIEW_BINDING_MISMATCH" },
    { label: "OTHER_REVIEW_SHA", overrides: { preExecutionReviewSha256: "1".repeat(64) }, expectedCode: "RECORD_REVIEW_BINDING_MISMATCH" },
    { label: "AUTHORIZATION_REVIEW_ENVIRONMENT_DIFFER", overrides: { environmentBindingSha256: "2".repeat(64) }, expectedCode: "RECORD_ENVIRONMENT_BINDING_MISMATCH" }
  ];
  for (const mutation of bindingCases) {
    const records = makeRecordTexts(proposal, { authorizationOverrides: mutation.overrides });
    const rig = completeFakeAdapters({}, { proposal, records });
    await assert.rejects(orchestrator.createOrchestrator(rig.adapters).run(exactRunOptions(records)), (error) => error.code === mutation.expectedCode, mutation.label);
    assert.equal(rig.calls.some((call) => ["provisionResources", "startRuntime", "engageAttemptAtomic", "request"].includes(call.name)), false, mutation.label);
    assert.equal(rig.consumedAuthorizationCount(), 0, mutation.label);
    assert.equal(rig.claimedRunSlotCount(), 0, mutation.label);
  }

  const wrongEnvironmentHash = "3".repeat(64);
  const records = makeRecordTexts(proposal, {
    reviewOverrides: { environmentBindingSha256: wrongEnvironmentHash },
    authorizationOverrides: { environmentBindingSha256: wrongEnvironmentHash }
  });
  const rig = completeFakeAdapters({}, { proposal, records });
  await assert.rejects(orchestrator.createOrchestrator(rig.adapters).run(exactRunOptions(records)), (error) => error.code === "RECORD_ENVIRONMENT_BINDING_MISMATCH");
  assert.equal(rig.calls.some((call) => ["provisionResources", "startRuntime", "engageAttemptAtomic", "request"].includes(call.name)), false);
});

test("O07f every mutated review or scoped-slot result is rejected after preserving the atomic commit", async () => {
  const proofMutants = [
    { label: "REVIEW_NOT_PASS", mutate: (result) => ({ ...result, reviewStillPass: false }) },
    { label: "REVIEW_ID", mutate: (result) => ({ ...result, reviewRecordId: "043c-review-record-002" }) },
    { label: "REVIEW_PATH", mutate: (result) => ({ ...result, reviewRecordPathSha256: "0".repeat(64) }) },
    { label: "REVIEW_CURRENT_SHA", mutate: (result) => ({ ...result, reviewCurrentSha256: "1".repeat(64) }) },
    { label: "SLOT_BOOLEAN", mutate: (result) => ({ ...result, globalRunSlotClaimed: false }) },
    { label: "SLOT_IDENTITY", mutate: (result) => ({ ...result, globalRunSlotIdentitySha256: "2".repeat(64) }) },
    { label: "RUN_SLOT", mutate: (result) => ({ ...result, runSlot: "R2" }) },
    { label: "EVIDENCE_BASE", mutate: (result) => ({ ...result, evidenceBaseSha256: "3".repeat(64) }) }
  ];
  for (const mutant of proofMutants) {
    const rig = completeFakeAdapters({}, { engagementResultMutator: mutant.mutate });
    await assert.rejects(orchestrator.createOrchestrator(rig.adapters).run(exactRunOptions(rig.records)), (error) => error.code === "T00_ENGAGEMENT_FAILED", mutant.label);
    assert.equal(rig.calls.some((call) => call.name === "request"), false, mutant.label);
    assert.equal(rig.engagementCommitCount(), 1, mutant.label);
    assert.equal(rig.consumedAuthorizationCount(), 1, mutant.label);
    assert.equal(rig.claimedRunSlotCount(), 1, mutant.label);
    assert.equal(orchestrator.parseReviewRecord(rig.reviewRecordText()).status, "PASS", mutant.label);
    assert.equal(orchestrator.parseJsonStrict(rig.authorizationRecordText()).status, "CONSUMED", mutant.label);
    assert.equal(rig.durableStateText(), null, mutant.label);
  }
});

test("O07g the global slot identity is exact, rejects a second R1 runId and keeps R2 distinct", async () => {
  const evidenceBaseSha256 = orchestrator.sha256Hex(resources().evidenceBase);
  const r1Material = { repository: orchestrator.REPOSITORY, head: HEAD, evidenceBaseSha256, runSlot: "R1" };
  const exactR1Identity = orchestrator.sha256Hex(orchestrator.canonicalJson(r1Material));
  assert.equal(orchestrator.globalRunSlotIdentitySha256(r1Material), exactR1Identity);
  assert.notEqual(orchestrator.globalRunSlotIdentitySha256({ ...r1Material, runSlot: "R2" }), exactR1Identity);

  const sharedGlobalRunSlots = new Set();
  const firstR1 = completeFakeAdapters({}, { claimedGlobalRunSlots: sharedGlobalRunSlots });
  const firstResult = await orchestrator.createOrchestrator(firstR1.adapters).run(exactRunOptions(firstR1.records));
  assert.equal(firstResult.status, "COMPLETE");
  assert.equal(sharedGlobalRunSlots.size, 1);

  const secondR1Proposal = makeProposal({ runId: "r1-20260810t121500z-112233445566" });
  const secondR1 = completeFakeAdapters({}, { proposal: secondR1Proposal, claimedGlobalRunSlots: sharedGlobalRunSlots });
  await assert.rejects(orchestrator.createOrchestrator(secondR1.adapters).run(exactRunOptions(secondR1.records)), (error) => error.code === "GLOBAL_RUN_SLOT_ALREADY_CLAIMED");
  assert.equal(secondR1.calls.some((call) => call.name === "request"), false);
  assert.equal(secondR1.engagementCommitCount(), 0);
  assert.equal(secondR1.consumedAuthorizationCount(), 0);
  assert.equal(orchestrator.parseSensitiveAuthorizationRecord(secondR1.authorizationRecordText()).status, "YES");
  assert.equal(sharedGlobalRunSlots.size, 1);

  const r2Proposal = makeProposal({ run: "R2", runId: R2_RUN_ID, priorRunId: RUN_ID });
  const r2 = completeFakeAdapters({ request: async () => { throw new orchestrator.OrchestratorError("R2_AFTER_T00_SENTINEL"); } }, { proposal: r2Proposal, claimedGlobalRunSlots: sharedGlobalRunSlots });
  await assert.rejects(orchestrator.createOrchestrator(r2.adapters).run(exactRunOptions(r2.records)), (error) => error.code === "R2_AFTER_T00_SENTINEL");
  assert.equal(r2.engagementCommitCount(), 1);
  assert.equal(r2.consumedAuthorizationCount(), 1);
  assert.equal(r2.calls.filter((call) => call.name === "request").length, 1);
  assert.equal(sharedGlobalRunSlots.size, 2);
});

test("O08 preserved export recovery closes the exact pending effect without retry or filename fabrication", async () => {
  let capturedSummary;
  const rig = completeFakeAdapters({
    writeSummaryAndChecksum: async ({ summaryBytes, checksumText }) => {
      capturedSummary = orchestrator.verifySummaryAndChecksum(summaryBytes, checksumText);
      return { durable: true, summarySha256: orchestrator.sha256Hex(summaryBytes), checksumSha256: orchestrator.sha256Hex(checksumText) };
    }
  }, {
    failStateWriteWhen: (candidate) => candidate.pendingOperation === null && candidate.completedOperations.at(-1) === "PRESERVE_EXPORT" && candidate.exportEvidence !== null
  });
  await assert.rejects(orchestrator.createOrchestrator(rig.adapters).run(exactRunOptions(rig.records)), (error) => error.code === "INJECTED_STATE_PERSIST_FAILURE");
  assert.equal(rig.calls.filter((call) => call.name === "preserveExport").length, 1);
  assert.equal(rig.calls.filter((call) => call.state?.completedOperations?.at(-1) === "PRESERVE_EXPORT" && call.state.exportEvidence !== null && call.state.pendingOperation === null && call.state.auditResult === null && call.state.usefulness === null && call.state.taskStatuses[15].status === "NOT_REACHED" && call.state.cleanup.status === "NOT_STARTED").length, 2);
  assert.deepEqual(capturedSummary.export, {
    exportPackId: UUIDS.exportPackId,
    fileName: `closing-folder-${UUIDS.folderId}-export-pack-${UUIDS.exportPackId}.zip`,
    byteSize: EXPORT_BYTES.length,
    sha256: EXPORT_HASH,
    contentVerified: true
  });
  assert.equal(rig.durableStateText(), null);
});

test("O09 T00 post-commit interruption remains globally consumed and cleanup-only", async () => {
  let capturedSummary;
  const rig = completeFakeAdapters({
    writeSummaryAndChecksum: async ({ summaryBytes, checksumText }) => {
      capturedSummary = orchestrator.verifySummaryAndChecksum(summaryBytes, checksumText);
      return { durable: true, summarySha256: orchestrator.sha256Hex(summaryBytes), checksumSha256: orchestrator.sha256Hex(checksumText) };
    }
  }, { failEngagementAfterCommit: true });
  await assert.rejects(orchestrator.createOrchestrator(rig.adapters).run(exactRunOptions(rig.records)), (error) => error.code === "INJECTED_ENGAGEMENT_AFTER_COMMIT_FAILURE");
  assert.equal(rig.calls.filter((call) => call.name === "engageAttemptAtomic").length, 1);
  assert.equal(rig.calls.filter((call) => call.name === "request").length, 0);
  assert.equal(rig.consumedAuthorizationCount(), 1);
  assert.equal(rig.claimedRunSlotCount(), 1);
  assert.equal(orchestrator.parseJsonStrict(rig.authorizationRecordText()).status, "CONSUMED");
  assert.equal(capturedSummary.runAttempt.engaged, true);
  assert.equal(capturedSummary.authorizationEvidence.status, "CONSUMED");
  assert.equal(capturedSummary.tasks[0].status, "PASS");
  assert.equal(capturedSummary.status, "INCOMPLETE");
});

test("O10 every business response completion CAS is write-ahead, single-shot and cleanup-only after interruption", async () => {
  const descriptors = orchestrator.buildTaskDescriptors({ runId: RUN_ID });
  const operations = descriptors.flatMap((task) => task.requests.map((request, index) => ({ id: `${task.taskId}_REQUEST_${index + 1}`, requestId: request.requestId })));
  for (const [targetIndex, target] of operations.entries()) {
    const rig = completeFakeAdapters({}, {
      failStateWriteWhen: (candidate) => candidate.pendingOperation === null && candidate.completedOperations.at(-1) === target.id
    });
    await assert.rejects(orchestrator.createOrchestrator(rig.adapters).run(exactRunOptions(rig.records)), (error) => error.code === "INJECTED_STATE_PERSIST_FAILURE", target.id);
    const requestCalls = rig.calls.filter((call) => call.name === "request");
    assert.equal(requestCalls.length, targetIndex + 1, `${target.id} must stop before any later request`);
    assert.equal(requestCalls.filter((call) => call.requestId === target.requestId).length, 1, `${target.id} must never retry`);
    assert.equal(rig.durableStateText(), null, `${target.id} must close through cleanup-only`);
  }
});

test("O11 provisioning, runtime, audit and usefulness post-effect CAS failures never retry", async () => {
  const cases = [
    { label: "PROVISION", effectName: "provisionResources", predicate: (candidate) => candidate.pendingOperation === null && candidate.completedOperations.at(-1) === "PROVISION_RESOURCES" },
    { label: "RUNTIME", effectName: "startRuntime", predicate: (candidate) => candidate.pendingOperation === null && candidate.completedOperations.at(-1) === "START_RUNTIME" && candidate.processes.length === 5 },
    { label: "AUDIT", effectName: "queryAudit", predicate: (candidate) => candidate.auditResult !== null },
    { label: "USEFULNESS", effectName: "chooseUsefulness", predicate: (candidate) => candidate.usefulness !== null }
  ];
  for (const boundary of cases) {
    const rig = completeFakeAdapters({}, { failStateWriteWhen: boundary.predicate });
    await assert.rejects(orchestrator.createOrchestrator(rig.adapters).run(exactRunOptions(rig.records)), (error) => error.code === "INJECTED_STATE_PERSIST_FAILURE", boundary.label);
    assert.equal(rig.calls.filter((call) => call.name === boundary.effectName).length, 1, `${boundary.label} must never retry its completed effect`);
    assert.equal(rig.durableStateText(), null, `${boundary.label} must finish cleanup-only`);
  }
});

test("O12 CLI main converts a normal PARTIAL cleanup result into a stable nonzero failure", async () => {
  const rig = completeFakeAdapters({ countDatabaseSessions: async () => 1 });
  await assert.rejects(orchestrator.main(runArgvFromOptions(exactRunOptions(rig.records)), { adapters: rig.adapters }), (error) => error.code === "CLEANUP_PARTIAL");
  assert.equal(rig.calls.some((call) => call.name === "removeRecoveryState"), false);
});

test("Z01 in-memory suite records zero real network, child-process, PostgreSQL or filesystem mutation", () => {
  assert.deepEqual(orchestrator.runtimeInstrumentationSnapshot(), { readOnlyAdapterFactories: 0, realFilesystemReads: 0, realOutputWrites: 0, realNetworkCalls: 0, realChildProcesses: 0, realPostgresCalls: 0, realFilesystemMutations: 0 });
});
