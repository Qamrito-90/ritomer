import { Buffer } from "node:buffer";
import { spawn as spawnProcess } from "node:child_process";
import { readdir } from "node:fs/promises";
import { createServer } from "node:net";
import { dirname, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import process from "node:process";
import { fileURLToPath, pathToFileURL, URL } from "node:url";

const FRONTEND_ROOT = dirname(fileURLToPath(import.meta.url));
const VITE_ENTRY = resolve(FRONTEND_ROOT, "node_modules", "vite", "bin", "vite.js");
export const BACKEND_ORIGIN = "http://127.0.0.1:8080";
export const FRONTEND_ORIGIN = "http://127.0.0.1:5173";
export const BACKEND_HEALTH_URL = `${BACKEND_ORIGIN}/actuator/health`;
const COOKIE_NAME = "__Host-ritomer-session";
export const REQUEST_TIMEOUT_MILLISECONDS = 2_000;
export const INTEGRATION_TIMEOUT_MILLISECONDS = 60 * 60 * 1_000;
export const SHUTDOWN_TIMEOUT_MILLISECONDS = 15_000;
const MAX_RESPONSE_BYTES = 64 * 1024;
const MAX_CHILD_OUTPUT_BYTES = 256 * 1024;
const RUN_ID = /^[0-9a-f]{32}$/;
const SHA256 = /^[0-9a-f]{64}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export const TENANT = Object.freeze({
  tenantId: "036a0000-0000-4000-8000-000000000001",
  tenantSlug: "ritomer-demo-036a",
  tenantName: "Ritomer Demo Fiduciaire SA (synthetic)"
});
// These are synthetic fixture bindings, never a product actor registry.
export const ACTORS = Object.freeze({
  ACCOUNTANT: Object.freeze({ actorKey: "actor-01", userId: "036a0000-0000-4000-8000-000000000002", subject: "ritomer-demo-user-036a", email: "demo.accountant@example.invalid", displayName: "Demo Accountant 036a" }),
  REVIEWER: Object.freeze({ actorKey: "actor-02", userId: "043b0000-0000-4000-8000-000000000002", subject: "ritomer-demo-reviewer-043b", email: "demo.reviewer.043b@example.invalid", displayName: "Demo Reviewer 043b" }),
  ADMIN: Object.freeze({ actorKey: "actor-03", userId: "046b0000-0000-4000-8000-000000000002", subject: "ritomer-demo-admin-046b", email: "demo.admin.046b@example.invalid", displayName: "Demo Admin 046b" })
});

// Wire enums are mirrored by Assert-M1DHarnessDiagnostic and checked together
// by the offline producer/consumer tests. No exception text is wire data.
export const HARNESS_FAILURE_CODES = Object.freeze([
  "HARNESS_FAILED", "HARNESS_ARGUMENTS_FORBIDDEN", "BACKEND_TARGET_MUST_BE_EXACT_LOOPBACK",
  "HARNESS_INHERITED_CONFIGURATION_REFUSED", "HARNESS_D_BINDING_REQUIRED", "ENVIRONMENT_FILE_GUARD_FAILED",
  "ENVIRONMENT_FILE_PRESENT", "AMBIGUOUS_SYSTEM_ENVIRONMENT", "UNKNOWN_ACTOR", "ME_CONTEXT_MISMATCH",
  "NON_LOOPBACK_REQUEST_FORBIDDEN", "PORT_UNAVAILABLE", "GET_SET_COOKIE_REQUIRED", "SESSION_COOKIE_CONTRACT_REJECTED",
  "OPERATION_CANCELLED", "REQUEST_TIMEOUT", "RESPONSE_TOO_LARGE", "INVALID_JSON", "REQUEST_PATH_REFUSED", "NO_STORE_REQUIRED",
  "HTTP_STATUS_MISMATCH", "HTTP_RESPONSE_UNAVAILABLE", "BOOTSTRAP_CONTRACT_MISMATCH", "EXPLICIT_LOGOUT_REQUIRED",
  "ACTOR_OPTION_MISMATCH", "SESSION_ROTATION_REQUIRED", "CSRF_ROTATION_REQUIRED", "LOGOUT_FAILED", "LOGOUT_COOKIE_NOT_EXPIRED",
  "CSRF_REJECTION_REQUIRED", "FOLDER_CONTEXT_MISMATCH", "ARCHIVE_RESULT_MISMATCH", "CHILD_STDIO_MUST_BE_PIPED",
  "CHILD_CONTROL_OUTPUT_REFUSED", "CHILD_OUTPUT_LIMIT", "CHILD_OUTPUT_FAILED", "HARNESS_ALREADY_STARTED",
  "PRIVATE_PARENT_STDIN_REQUIRED", "CONTROL_INPUT_LIMIT", "CONTROL_INPUT_REFUSED", "PARENT_EOF", "PARENT_INPUT_FAILED",
  "HARNESS_INTERRUPTED", "INTEGRATION_TIMEOUT", "BACKEND_PREFLIGHT_FAILED", "VITE_EXITED", "VITE_PROCESS_FAILED",
  "VITE_READINESS_FAILED", "EXPLICIT_FINISH_REQUIRED", "VITE_STOP_TIMEOUT", "VITE_STOP_FAILED", "INCOMPLETE_HARNESS_RESULT"
]);
export const HARNESS_FAILURE_STEPS = Object.freeze([
  "BINDING", "ENVIRONMENT", "BACKEND_HEALTH", "PORT_CHECK", "VITE_START", "VITE_READY", "LOGIN_ACCOUNTANT", "LOGIN_REVIEWER",
  "CSRF_REFUSALS", "ME_ACCOUNTANT", "FOLDER_CREATE", "FOLDER_UPDATE", "ACCOUNTANT_ARCHIVE_REFUSAL", "REVIEWER_READ",
  "REVIEWER_WRITE_REFUSAL", "LOGOUT_ACCOUNTANT", "ANONYMOUS_ME", "ME_REVIEWER", "LOGIN_ADMIN", "ARCHIVE", "WAIT_FINISH",
  "LOGOUT", "STOP", "COMPLETE", "UNAVAILABLE"
]);
const httpStatus = (value) => Number.isInteger(value) && value >= 100 && value <= 599;
const validFailure = ({ code, step, expectedStatus, receivedStatus }) => HARNESS_FAILURE_CODES.includes(code)
  && HARNESS_FAILURE_STEPS.includes(step)
  && (code === "HTTP_STATUS_MISMATCH" ? httpStatus(expectedStatus) && httpStatus(receivedStatus) && expectedStatus !== receivedStatus
    : code === "HTTP_RESPONSE_UNAVAILABLE" ? httpStatus(expectedStatus) && receivedStatus === null
      : expectedStatus === null && receivedStatus === null);
export class HarnessFailure extends Error {
  constructor(code, { step = "UNAVAILABLE", expectedStatus = null, receivedStatus = null } = {}) {
    const detail = { code, step, expectedStatus, receivedStatus };
    const safe = validFailure(detail) ? detail : { code: "HARNESS_FAILED", step: "UNAVAILABLE", expectedStatus: null, receivedStatus: null };
    super(safe.code); this.name = "HarnessFailure"; Object.assign(this, safe); Object.freeze(this);
  }
}
const failure = (code, detail) => new HarnessFailure(code, detail);
const safeFailure = (error, code, step = "UNAVAILABLE") => error instanceof HarnessFailure && validFailure(error)
  ? failure(error.code, { step: error.step === "UNAVAILABLE" ? step : error.step, expectedStatus: error.expectedStatus, receivedStatus: error.receivedStatus })
  : failure(code, { step });

export function validateHarnessInvocation(argv, environment) {
  if (!Array.isArray(argv) || argv.length !== 0) throw failure("HARNESS_ARGUMENTS_FORBIDDEN");
  const target = environment.RITOMER_LOCAL_DEMO_BACKEND_TARGET;
  if (target !== undefined && target !== BACKEND_ORIGIN) throw failure("BACKEND_TARGET_MUST_BE_EXACT_LOOPBACK");
  if (Object.keys(environment).some((name) =>
    /^(RITOMER_SECURITY_JWT_HMAC_SECRET|RITOMER_LOCAL_DEMO_PROXY_AUTH_ENABLED|RITOMER_LOCAL_DEMO_BEARER_TOKEN|NODE_OPTIONS|NODE_PATH|HTTP_PROXY|HTTPS_PROXY|ALL_PROXY|RITOMER_DB_TEST_PASSWORD)$/i.test(name)
    || /^VITE_/i.test(name))) throw failure("HARNESS_INHERITED_CONFIGURATION_REFUSED");
  if (environment.RITOMER_DB_RAIL_CAMPAIGN !== "D"
    || !RUN_ID.test(environment.RITOMER_DB_RAIL_RUN_ID ?? "")
    || !SHA256.test(environment.RITOMER_DB_RAIL_REVIEWED_OBJECT_SHA256 ?? "")
    || !SHA256.test(environment.RITOMER_DB_RAIL_RUNTIME_SHA256 ?? "")) {
    throw failure("HARNESS_D_BINDING_REQUIRED");
  }
  return Object.freeze({ runId: environment.RITOMER_DB_RAIL_RUN_ID,
    objectSha: environment.RITOMER_DB_RAIL_REVIEWED_OBJECT_SHA256,
    runtimeSha: environment.RITOMER_DB_RAIL_RUNTIME_SHA256 });
}

export async function assertNoEnvironmentFiles(readdirFunction = readdir) {
  let entries;
  try { entries = await readdirFunction(FRONTEND_ROOT, { withFileTypes: true }); }
  catch { throw failure("ENVIRONMENT_FILE_GUARD_FAILED"); }
  if (entries.some((entry) => (typeof entry === "string" ? entry : entry.name).toLowerCase().startsWith(".env"))) {
    throw failure("ENVIRONMENT_FILE_PRESENT");
  }
}

export function buildChildEnvironment(parentEnvironment, platform = process.platform) {
  const names = platform === "win32"
    ? ["PATH", "SystemRoot", "WINDIR", "ComSpec", "PATHEXT", "TEMP", "TMP"]
    : ["PATH", "HOME", "TMPDIR"];
  const result = {};
  for (const name of names) {
    const matches = Object.keys(parentEnvironment).filter((key) => platform === "win32"
      ? key.toLowerCase() === name.toLowerCase() : key === name);
    if (matches.length > 1) throw failure("AMBIGUOUS_SYSTEM_ENVIRONMENT");
    const value = parentEnvironment[matches[0]];
    if (typeof value === "string" && value.length > 0) result[name] = value;
  }
  result.RITOMER_LOCAL_DEMO_BACKEND_TARGET = BACKEND_ORIGIN;
  return result;
}

export function buildViteLaunch(parentEnvironment, { execPath = process.execPath, platform = process.platform } = {}) {
  return { command: execPath,
    args: [VITE_ENTRY, "--host", "127.0.0.1", "--port", "5173", "--strictPort", "--force"],
    options: { cwd: FRONTEND_ROOT, env: buildChildEnvironment(parentEnvironment, platform),
      shell: false, detached: false, stdio: ["ignore", "pipe", "pipe"], windowsHide: true } };
}

function exactJson(actual, expected) {
  if (Array.isArray(expected)) return Array.isArray(actual) && actual.length === expected.length
    && expected.every((value, index) => exactJson(actual[index], value));
  if (expected !== null && typeof expected === "object") return actual !== null && typeof actual === "object"
    && !Array.isArray(actual) && exactJson(Object.keys(actual).sort(), Object.keys(expected).sort())
    && Object.keys(expected).every((key) => exactJson(actual[key], expected[key]));
  return actual === expected;
}
export function expectedMePayload(role) {
  const actor = ACTORS[role];
  if (!actor) throw failure("UNKNOWN_ACTOR");
  return { actor: { userId: actor.userId, externalSubject: actor.subject, email: actor.email, displayName: actor.displayName },
    memberships: [{ ...TENANT, roles: [role] }], activeTenant: { ...TENANT }, effectiveRoles: [role] };
}
export function assertExpectedMe(role, payload) {
  if (!exactJson(payload, expectedMePayload(role))) throw failure("ME_CONTEXT_MISMATCH");
}

export function assertLoopbackUrl(rawUrl) {
  let parsed;
  try { parsed = new URL(rawUrl); } catch { throw failure("NON_LOOPBACK_REQUEST_FORBIDDEN"); }
  if (![FRONTEND_ORIGIN, BACKEND_ORIGIN].includes(parsed.origin) || parsed.username || parsed.password || parsed.hash) {
    throw failure("NON_LOOPBACK_REQUEST_FORBIDDEN");
  }
  return parsed;
}
export function assertPortAvailable(port, { createServerFunction = createServer } = {}) {
  return new Promise((resolvePromise, rejectPromise) => {
    const server = createServerFunction();
    server.once("error", () => rejectPromise(failure("PORT_UNAVAILABLE")));
    server.listen({ host: "127.0.0.1", port, exclusive: true }, () =>
      server.close((error) => error ? rejectPromise(failure("PORT_UNAVAILABLE")) : resolvePromise()));
  });
}

// Only the single contract cookie is accepted. No general cookie parser or persistence.
export function sessionCookieFromHeaders(headers, previous) {
  if (typeof headers?.getSetCookie !== "function") throw failure("GET_SET_COOKIE_REQUIRED");
  const values = headers.getSetCookie();
  if (!Array.isArray(values) || values.length > 1) throw failure("SESSION_COOKIE_CONTRACT_REJECTED");
  if (values.length === 0) return previous;
  const raw = values[0];
  if (typeof raw !== "string" || raw.length > 4096 || /[\r\n]/.test(raw)) throw failure("SESSION_COOKIE_CONTRACT_REJECTED");
  const parts = raw.split(";").map((part) => part.trim());
  const first = parts.shift();
  const match = /^__Host-ritomer-session=([A-Za-z0-9_-]*)$/.exec(first);
  if (!match || new Set(parts.map((part) => part.toLowerCase())).size !== parts.length
    || !["Secure", "HttpOnly", "Path=/", "SameSite=Lax"].every((part) => parts.includes(part))
    || parts.some((part) => !["Secure", "HttpOnly", "Path=/", "SameSite=Lax", "Max-Age=0", "Expires=Thu, 01 Jan 1970 00:00:00 GMT"].includes(part))) {
    throw failure("SESSION_COOKIE_CONTRACT_REJECTED");
  }
  if (parts.includes("Max-Age=0")) {
    if (match[1] !== "") throw failure("SESSION_COOKIE_CONTRACT_REJECTED");
    return undefined;
  }
  if (parts.some((part) => part.startsWith("Expires="))) throw failure("SESSION_COOKIE_CONTRACT_REJECTED");
  if (match[1].length < 16) throw failure("SESSION_COOKIE_CONTRACT_REJECTED");
  return `${COOKIE_NAME}=${match[1]}`;
}

const defaults = () => ({ spawnFunction: spawnProcess, fetchFunction: (...args) => globalThis.fetch(...args),
  readdirFunction: readdir, createServerFunction: createServer,
  nowFunction: () => performance.now(), setTimeoutFunction: globalThis.setTimeout, clearTimeoutFunction: globalThis.clearTimeout,
  processReference: process, input: process.stdin, execPath: process.execPath, platform: process.platform,
  writeStdout: (value) => process.stdout.write(value) });

// The timer races the entire operation including the response body, even for doubles ignoring AbortSignal.
export async function boundedOperation(operation, milliseconds, dependencies, signal, code = "REQUEST_TIMEOUT") {
  if (signal?.aborted) throw failure("OPERATION_CANCELLED");
  let timeout;
  let cancel;
  const controller = new globalThis.AbortController();
  const stop = new Promise((_, rejectPromise) => {
    timeout = dependencies.setTimeoutFunction(() => { controller.abort(); rejectPromise(failure(code)); }, milliseconds);
    cancel = () => { controller.abort(); rejectPromise(failure("OPERATION_CANCELLED")); };
    signal?.addEventListener("abort", cancel, { once: true });
  });
  try { return await Promise.race([Promise.resolve().then(() => operation(controller.signal)), stop]); }
  finally { dependencies.clearTimeoutFunction(timeout); signal?.removeEventListener("abort", cancel); }
}

async function readResponse(response) {
  let text;
  if (response.body?.getReader) {
    const reader = response.body.getReader();
    const chunks = [];
    let bytes = 0;
    try {
      for (;;) {
        const next = await reader.read();
        if (next.done) break;
        bytes += next.value.byteLength;
        if (bytes > MAX_RESPONSE_BYTES) { void reader.cancel(); throw failure("RESPONSE_TOO_LARGE"); }
        chunks.push(Buffer.from(next.value));
      }
      text = Buffer.concat(chunks).toString("utf8");
    } finally { reader.releaseLock(); }
  } else text = await response.text();
  if (typeof text !== "string" || Buffer.byteLength(text) > MAX_RESPONSE_BYTES) throw failure("RESPONSE_TOO_LARGE");
  let payload;
  try { payload = text === "" ? undefined : JSON.parse(text); } catch { throw failure("INVALID_JSON"); }
  return { status: response.status, headers: response.headers, payload };
}

export function createSessionJar(dependencyOverrides = {}, cancellationSignal) {
  const dependencies = { ...defaults(), ...dependencyOverrides };
  let cookie;
  let csrf;
  let authenticated = false;
  let epoch = 0;
  const clear = () => { cookie = undefined; csrf = undefined; authenticated = false; epoch += 1; };
  const request = async (path, { method = "GET", body, token = csrf, tenant = false, cleanup = false, expectedStatus } = {}) => {
    if (!/^\/api\/(?:session\/(?:bootstrap|local|logout)|me|closing-folders(?:\/[0-9a-f-]{36}(?:\/archive)?)?)$/.test(path)) {
      throw failure("REQUEST_PATH_REFUSED");
    }
    const version = epoch;
    const headers = { Accept: "application/json", Origin: FRONTEND_ORIGIN };
    if (cookie) headers.Cookie = cookie;
    if (method !== "GET" && token !== null && token !== undefined) headers["X-CSRF-TOKEN"] = token;
    if (tenant) headers["X-Tenant-Id"] = TENANT.tenantId;
    if (body !== undefined) headers["Content-Type"] = "application/json";
    let responseReceived = false;
    let result;
    try {
      result = await boundedOperation(async (signal) => {
        const response = await dependencies.fetchFunction(`${FRONTEND_ORIGIN}${path}`, {
          method, headers, redirect: "manual", signal, ...(body === undefined ? {} : { body: JSON.stringify(body) })
        });
        responseReceived = response !== null && typeof response === "object";
        return readResponse(response);
      }, REQUEST_TIMEOUT_MILLISECONDS, dependencies, cleanup ? undefined : cancellationSignal);
    } catch (error) {
      if (!responseReceived && httpStatus(expectedStatus) && !(error instanceof HarnessFailure && error.code !== "REQUEST_TIMEOUT")) {
        throw failure("HTTP_RESPONSE_UNAVAILABLE", { expectedStatus });
      }
      throw error;
    }
    if (version !== epoch || (!cleanup && cancellationSignal?.aborted)) throw failure("OPERATION_CANCELLED");
    cookie = sessionCookieFromHeaders(result.headers, cookie);
    if (result.status === 401 || result.payload?.code === "ACCESS_REVOKED") clear();
    if ((path.startsWith("/api/session/") || path === "/api/me") && result.headers.get("cache-control") !== "no-store") {
      throw failure("NO_STORE_REQUIRED");
    }
    return result;
  };
  const expect = async (path, status, options) => {
    const result = await request(path, { ...options, expectedStatus: status });
    if (result.status !== status) throw failure("HTTP_STATUS_MISMATCH", { expectedStatus: status, receivedStatus: result.status });
    return result.payload;
  };
  const bootstrap = async (state) => {
    const payload = await expect("/api/session/bootstrap", 200);
    const keys = state === "ANONYMOUS" ? ["actors", "csrf", "localLoginAvailable", "sessionState"] : ["csrf", "localLoginAvailable", "sessionState"];
    if (!payload || !exactJson(Object.keys(payload).sort(), keys) || payload.sessionState !== state
      || payload.localLoginAvailable !== true || payload.csrf?.headerName !== "X-CSRF-TOKEN"
      || !exactJson(Object.keys(payload.csrf).sort(), ["headerName", "token"])
      || typeof payload.csrf.token !== "string" || payload.csrf.token.length < 1 || payload.csrf.token.length > 4096
      || !cookie) throw failure("BOOTSTRAP_CONTRACT_MISMATCH");
    csrf = payload.csrf.token;
    authenticated = state === "AUTHENTICATED";
    return payload;
  };
  const login = async (role) => {
    if (authenticated) throw failure("EXPLICIT_LOGOUT_REQUIRED");
    const initial = await bootstrap("ANONYMOUS");
    const actor = ACTORS[role];
    if (!actor || !Array.isArray(initial.actors) || initial.actors.length > 50
      || initial.actors.filter((item) => item.actorKey === actor.actorKey).length !== 1) throw failure("ACTOR_OPTION_MISMATCH");
    const oldCookie = cookie;
    const oldCsrf = csrf;
    await expect("/api/session/local", 204, { method: "POST", body: { actorKey: actor.actorKey } });
    if (!cookie || cookie === oldCookie) throw failure("SESSION_ROTATION_REQUIRED");
    await bootstrap("AUTHENTICATED");
    if (csrf === oldCsrf) throw failure("CSRF_ROTATION_REQUIRED");
    assertExpectedMe(role, await expect("/api/me", 200));
    return oldCsrf;
  };
  const logout = async (cleanup = false) => {
    if (authenticated) {
      const result = await request("/api/session/logout", { method: "POST", cleanup, expectedStatus: 204 });
      const expired = result.status === 401 && result.payload?.code === "SESSION_EXPIRED"
        && result.headers.getSetCookie().length === 1
        && sessionCookieFromHeaders(result.headers) === undefined;
      if (result.status !== 204 && !expired) throw failure("HTTP_STATUS_MISMATCH", { expectedStatus: 204, receivedStatus: result.status });
      if (cookie !== undefined) throw failure("LOGOUT_COOKIE_NOT_EXPIRED");
    }
    clear();
  };
  return Object.freeze({ request, expect, login, logout, clear, getCsrf: () => csrf,
    hasCredentials: () => cookie !== undefined || csrf !== undefined });
}

export async function exerciseTwoJars(jarA, jarB, runId, onStep = () => {}) {
  onStep("LOGIN_ACCOUNTANT");
  const oldCsrfA = await jarA.login("ACCOUNTANT");
  onStep("LOGIN_REVIEWER");
  await jarB.login("REVIEWER");
  onStep("CSRF_REFUSALS");
  for (const token of [null, "synthetic-invalid-csrf", oldCsrfA, jarB.getCsrf()]) {
    const rejection = await jarA.expect("/api/session/logout", 403, { method: "POST", token });
    if (rejection?.code !== "CSRF_REJECTED") throw failure("CSRF_REJECTION_REQUIRED");
  }
  onStep("ME_ACCOUNTANT");
  assertExpectedMe("ACCOUNTANT", await jarA.expect("/api/me", 200));
  onStep("FOLDER_CREATE");
  const folder = await jarA.expect("/api/closing-folders", 201, { method: "POST", tenant: true,
    body: { name: `M1.1D ${runId} (synthetic)`, periodStartOn: "2025-01-01", periodEndOn: "2025-12-31" } });
  if (!UUID.test(folder?.id ?? "") || folder.tenantId !== TENANT.tenantId) throw failure("FOLDER_CONTEXT_MISMATCH");
  const path = `/api/closing-folders/${folder.id}`;
  onStep("FOLDER_UPDATE");
  await jarA.expect(path, 200, { method: "PATCH", tenant: true, body: { externalRef: `M1D-${runId}` } });
  onStep("ACCOUNTANT_ARCHIVE_REFUSAL");
  await jarA.expect(`${path}/archive`, 403, { method: "POST", tenant: true });
  onStep("REVIEWER_READ");
  const read = await jarB.expect(path, 200, { tenant: true });
  if (read?.id !== folder.id || read.tenantId !== TENANT.tenantId) throw failure("FOLDER_CONTEXT_MISMATCH");
  onStep("REVIEWER_WRITE_REFUSAL");
  await jarB.expect(path, 403, { method: "PATCH", tenant: true, body: { name: "Must be refused" } });
  onStep("LOGOUT_ACCOUNTANT");
  await jarA.logout();
  onStep("ANONYMOUS_ME");
  await jarA.expect("/api/me", 401);
  onStep("ME_REVIEWER");
  assertExpectedMe("REVIEWER", await jarB.expect("/api/me", 200));
  onStep("LOGIN_ADMIN");
  await jarA.login("ADMIN");
  onStep("ARCHIVE");
  const archived = await jarA.expect(`${path}/archive`, 200, { method: "POST", tenant: true });
  if (archived?.id !== folder.id || archived.tenantId !== TENANT.tenantId || archived.status !== "ARCHIVED") {
    throw failure("ARCHIVE_RESULT_MISMATCH");
  }
}

// Drain both streams concurrently, suppressing all child content. Only owner-produced records reach stdout.
export function drainChildOutput(child, onFailure) {
  if (!child.stdout || !child.stderr) throw failure("CHILD_STDIO_MUST_BE_PIPED");
  const detach = [];
  for (const stream of [child.stdout, child.stderr]) {
    let bytes = 0;
    let tail = "";
    const data = (chunk) => {
      bytes += Buffer.byteLength(chunk);
      const text = tail + String(chunk);
      if (text.includes("M1D_")) onFailure("CHILD_CONTROL_OUTPUT_REFUSED");
      tail = text.slice(-4);
      if (bytes > MAX_CHILD_OUTPUT_BYTES) onFailure("CHILD_OUTPUT_LIMIT");
    };
    const error = () => onFailure("CHILD_OUTPUT_FAILED");
    stream.on("data", data); stream.on("error", error);
    detach.push(() => { stream.off("data", data); stream.off("error", error); });
  }
  return () => detach.forEach((remove) => remove());
}

export function createHarnessRuntime({ environment = process.env, argv = process.argv.slice(2), dependencies: overrides = {} } = {}) {
  const dependencies = { ...defaults(), ...overrides };
  const cancellation = new globalThis.AbortController();
  const jars = [createSessionJar(dependencies, cancellation.signal), createSessionJar(dependencies, cancellation.signal)];
  let started = false;
  let jarsPassed = false;
  let finishing = false;
  let child;
  let childClosed = false;
  let detachOutput;
  let stopRequested = false;
  let firstFailure;
  let stopResolve;
  let readyResolve;
  let readyReject;
  let step = "BINDING";
  const stop = new Promise((resolvePromise) => { stopResolve = resolvePromise; });
  const ready = new Promise((resolvePromise, rejectPromise) => { readyResolve = resolvePromise; readyReject = rejectPromise; });
  ready.catch(() => undefined);
  // Every terminal failure uses the same immutable observation, including
  // events during finalization. Later cleanup still runs but cannot replace it.
  const observeFailure = (error, code, observedStep = step) => {
    firstFailure ??= safeFailure(error, code, observedStep);
    return firstFailure;
  };
  const fail = (code) => {
    observeFailure(failure(code), "HARNESS_FAILED");
    if (!stopRequested) { stopRequested = true; cancellation.abort(); stopResolve(); }
  };
  const listeners = [];
  const listen = (emitter, event, callback) => { emitter.on(event, callback); listeners.push(() => emitter.off(event, callback)); };
  const raceStop = (operation) => Promise.race([operation, stop.then(() => { if (stopRequested) throw firstFailure; })]);
  const run = async () => {
    if (started) throw failure("HARNESS_ALREADY_STARTED");
    started = true;
    let binding;
    let integrationTimer;
    let closeResolve;
    const closed = new Promise((resolvePromise) => { closeResolve = resolvePromise; });
    try {
      binding = validateHarnessInvocation(argv, environment);
      if (!dependencies.input || dependencies.input.isTTY === true) throw failure("PRIVATE_PARENT_STDIN_REQUIRED");
      let buffered = "";
      let finishSeen = false;
      listen(dependencies.input, "data", (chunk) => {
        buffered += String(chunk);
        if (buffered.length > 128) { fail("CONTROL_INPUT_LIMIT"); return; }
        if (!buffered.includes("\n")) return;
        if (finishSeen || !jarsPassed || buffered !== `M1D_FINISH ${binding.runId}\n`) {
          fail("CONTROL_INPUT_REFUSED"); return;
        }
        finishSeen = true; buffered = ""; finishing = true; stopResolve();
      });
      listen(dependencies.input, "end", () => { if (!finishing) fail("PARENT_EOF"); });
      listen(dependencies.input, "error", () => fail("PARENT_INPUT_FAILED"));
      for (const signal of ["SIGINT", "SIGTERM", "uncaughtException", "unhandledRejection"]) {
        listen(dependencies.processReference, signal, () => fail("HARNESS_INTERRUPTED"));
      }
      const deadline = dependencies.nowFunction() + INTEGRATION_TIMEOUT_MILLISECONDS;
      integrationTimer = dependencies.setTimeoutFunction(() => fail("INTEGRATION_TIMEOUT"),
        Math.max(0, deadline - dependencies.nowFunction()));
      step = "ENVIRONMENT";
      await raceStop(assertNoEnvironmentFiles(dependencies.readdirFunction));
      step = "BACKEND_HEALTH";
      await raceStop(boundedOperation(async (signal) => {
        const response = await dependencies.fetchFunction(BACKEND_HEALTH_URL, { method: "GET", redirect: "manual", signal });
        const result = await readResponse(response);
        if (result.status !== 200) throw failure("HTTP_STATUS_MISMATCH", { expectedStatus: 200, receivedStatus: result.status });
        if (result.payload?.status !== "UP") throw failure("BACKEND_PREFLIGHT_FAILED");
      }, REQUEST_TIMEOUT_MILLISECONDS, dependencies, cancellation.signal));
      step = "PORT_CHECK";
      await raceStop(boundedOperation(() => assertPortAvailable(5173, dependencies), REQUEST_TIMEOUT_MILLISECONDS, dependencies, cancellation.signal));
      step = "VITE_START";
      const launch = buildViteLaunch(environment, dependencies);
      child = dependencies.spawnFunction(launch.command, launch.args, launch.options);
      listen(child, "exit", () => { if (!finishing) fail("VITE_EXITED"); });
      listen(child, "error", () => fail("VITE_PROCESS_FAILED"));
      listen(child, "close", () => { childClosed = true; closeResolve(); if (!finishing) fail("VITE_EXITED"); });
      detachOutput = drainChildOutput(child, fail);
      // Only the unauthenticated root is retried during startup. No session keepalive.
      step = "VITE_READY";
      let available = false;
      for (let attempt = 0; attempt < 40 && !available; attempt += 1) {
        try {
          await raceStop(boundedOperation(async (signal) => {
            const response = await dependencies.fetchFunction(`${FRONTEND_ORIGIN}/`, { method: "GET", redirect: "manual", signal });
            if (response.status !== 200) throw failure("HTTP_STATUS_MISMATCH", { expectedStatus: 200, receivedStatus: response.status });
            await response.body?.cancel();
          }, REQUEST_TIMEOUT_MILLISECONDS, dependencies, cancellation.signal));
          available = true;
        } catch (error) {
          if (stopRequested) throw firstFailure;
          if (attempt === 39) throw safeFailure(error, "VITE_READINESS_FAILED");
          await raceStop(new Promise((resolvePromise) => dependencies.setTimeoutFunction(resolvePromise, 100)));
        }
      }
      await raceStop(exerciseTwoJars(jars[0], jars[1], binding.runId, (value) => { step = value; }));
      if (stopRequested) throw firstFailure;
      jarsPassed = true;
      dependencies.writeStdout(`M1D_JARS_RESULT ${binding.runId} ${binding.objectSha} ${binding.runtimeSha} PASS\n`);
      readyResolve();
      step = "WAIT_FINISH";
      await stop;
      if (stopRequested) throw firstFailure;
      if (!finishing) throw failure("EXPLICIT_FINISH_REQUIRED");
    } catch (error) {
      readyReject(observeFailure(error, "HARNESS_FAILED"));
    }
    dependencies.clearTimeoutFunction(integrationTimer);
    // Cancel active work first; cleanup may only close the existing sessions, never reopen them.
    finishing = true;
    cancellation.abort();
    step = "LOGOUT";
    try {
      await boundedOperation(async () => {
        await Promise.allSettled(jars.map(async (jar) => {
          try { await jar.logout(true); }
          catch (error) { observeFailure(error, "LOGOUT_FAILED", "LOGOUT"); }
        }));
      }, 5_000, dependencies);
    } catch (error) { observeFailure(error, "LOGOUT_FAILED"); }
    cancellation.abort();
    jars.forEach((jar) => jar.clear());
    step = "STOP";
    try {
      await boundedOperation(async () => {
        if (child && !childClosed) {
          child.kill("SIGTERM");
          try { await boundedOperation(() => closed, 2_000, dependencies, undefined, "VITE_STOP_TIMEOUT"); }
          catch { if (!childClosed) child.kill("SIGKILL"); await closed; }
        }
        if (child) await assertPortAvailable(5173, dependencies);
      }, SHUTDOWN_TIMEOUT_MILLISECONDS, dependencies, undefined, "VITE_STOP_TIMEOUT");
    } catch (error) { observeFailure(error, "VITE_STOP_FAILED"); }
    finally {
      detachOutput?.();
      listeners.forEach((remove) => remove());
      // Release the private stdin pipe after consuming the single terminal command.
      dependencies.input?.pause();
    }
    if (firstFailure) throw firstFailure;
    if (!jarsPassed || !childClosed) throw observeFailure(failure("INCOMPLETE_HARNESS_RESULT"), "HARNESS_FAILED", "COMPLETE");
    dependencies.writeStdout(`M1D_HARNESS_STOPPED ${binding.runId} JARS=PASS VITE_STOP=PASS\n`);
    return { exitCode: 0 };
  };
  return Object.freeze({ run, ready, shutdown: () => fail("HARNESS_INTERRUPTED") });
}

export const runHarness = (options) => createHarnessRuntime(options).run();
export async function runCli(options, { writeStderr = (text) => process.stderr.write(text), setExitCode = (code) => { process.exitCode = code; } } = {}) {
  let binding;
  try {
    binding = validateHarnessInvocation(options?.argv ?? process.argv.slice(2), options?.environment ?? process.env);
    setExitCode((await runHarness(options)).exitCode);
  } catch (error) {
    const { code, step, expectedStatus, receivedStatus } = safeFailure(error, "HARNESS_FAILED");
    // A rejected invocation has no trusted identity. Do not echo its environment
    // or manufacture a bound diagnostic; the rail refuses this incomplete line.
    const line = binding ? `HARNESS_FAILED ${JSON.stringify({ schemaVersion: 1, ...binding,
      diagnostic: { code, step, expectedStatus, receivedStatus } })}\n` : "HARNESS_FAILED UNAVAILABLE\n";
    writeStderr(Buffer.byteLength(line, "utf8") <= 2048 ? line : "HARNESS_FAILED UNAVAILABLE\n");
    setExitCode(1);
  }
}
if (process.argv[1] !== undefined && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) await runCli();
