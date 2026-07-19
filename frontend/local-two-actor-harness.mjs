import { Buffer } from "node:buffer";
import { spawn as spawnProcess } from "node:child_process";
import { createHmac, randomBytes as secureRandomBytes } from "node:crypto";
import { readdir } from "node:fs/promises";
import { createServer } from "node:net";
import { dirname, resolve } from "node:path";
import process from "node:process";
import {
  clearTimeout,
  setTimeout
} from "node:timers";
import { fileURLToPath, pathToFileURL, URL } from "node:url";

const FRONTEND_ROOT = dirname(fileURLToPath(import.meta.url));
const VITE_ENTRY = resolve(FRONTEND_ROOT, "node_modules", "vite", "bin", "vite.js");

export const BACKEND_ORIGIN = "http://127.0.0.1:8080";
export const BACKEND_HEALTH_URL = `${BACKEND_ORIGIN}/actuator/health`;
export const JWT_TTL_SECONDS = 3600;

const HMAC_SECRET_ENV = "RITOMER_SECURITY_JWT_HMAC_SECRET";
const BACKEND_TARGET_ENV = "RITOMER_LOCAL_DEMO_BACKEND_TARGET";
const PROXY_AUTH_ENABLED_ENV = "RITOMER_LOCAL_DEMO_PROXY_AUTH_ENABLED";
const BEARER_TOKEN_ENV = "RITOMER_LOCAL_DEMO_BEARER_TOKEN";
const FORBIDDEN_CHILD_ENV_NAME = /(TOKEN|SECRET|PASSWORD|CREDENTIAL|API_KEY)/i;
const JWT_LIKE_VALUE = /[A-Za-z0-9_-]{2,}\.[A-Za-z0-9_-]{2,}\.[A-Za-z0-9_-]{2,}/g;
const AUTHORIZATION_HEADER = /\bAuthorization\s*(?:\\?["'])?\s*[:=][^\r\n]*/gi;
const SENSITIVE_ME_PAYLOAD_FIELD = /(?:actor|userId|externalSubject|email|displayName|memberships|activeTenant|effectiveRoles|tenantId|tenantSlug|tenantName|roles|jti)\s*["']?\s*[:=]/i;
const MAX_BUFFERED_LOG_LINE = 64 * 1024;
export const READINESS_POLICY = Object.freeze({
  attempts: 100,
  intervalMilliseconds: 100,
  requestTimeoutMilliseconds: 2_000
});
const REQUEST_TIMEOUT_MILLISECONDS = 2_000;
const PROCESS_STOP_TIMEOUT_MILLISECONDS = 2_000;
const PORT_RELEASE_ATTEMPTS = 20;
const PORT_RELEASE_INTERVAL_MILLISECONDS = 50;
export const IDENTITY_MONITOR_INTERVAL_MILLISECONDS = 1_000;
export const IDENTITY_MONITOR_TRANSIENT_FAILURE_THRESHOLD = 3;
const READINESS_PHASE = "API_ME";
const READINESS_CATEGORIES = new Set([
  "CONNECTION",
  "TIMEOUT",
  "HTTP_STATUS",
  "INVALID_JSON",
  "IDENTITY_MISMATCH",
  "TENANT_MISMATCH",
  "ROLE_MISMATCH",
  "MEMBERSHIP_MISMATCH",
  "CHILD_EXITED",
  "UNKNOWN"
]);
const READINESS_INVALID_FIELDS = new Set([
  "actor",
  "activeTenant",
  "effectiveRoles",
  "memberships",
  "payload"
]);
const MONITOR_DIAGNOSTIC_LEVELS = new Set(["DEGRADED", "FAILED"]);
const MONITOR_DIAGNOSTIC_THRESHOLDS = new Set([
  1,
  IDENTITY_MONITOR_TRANSIENT_FAILURE_THRESHOLD
]);

const TENANT = Object.freeze({
  tenantId: "036a0000-0000-4000-8000-000000000001",
  tenantSlug: "ritomer-demo-036a",
  tenantName: "Ritomer Demo Fiduciaire SA (synthetic)"
});

export const ACTORS = Object.freeze({
  ACCOUNTANT: Object.freeze({
    name: "ACCOUNTANT",
    port: 5173,
    subject: "ritomer-demo-user-036a",
    userId: "036a0000-0000-4000-8000-000000000002",
    email: "demo.accountant@example.invalid",
    displayName: "Demo Accountant 036a",
    role: "ACCOUNTANT"
  }),
  REVIEWER: Object.freeze({
    name: "REVIEWER",
    port: 5174,
    subject: "ritomer-demo-reviewer-043b",
    userId: "043b0000-0000-4000-8000-000000000002",
    email: "demo.reviewer.043b@example.invalid",
    displayName: "Demo Reviewer 043b",
    role: "REVIEWER"
  })
});

const ACTOR_SEQUENCE = Object.freeze([ACTORS.ACCOUNTANT, ACTORS.REVIEWER]);
const HARNESS_IDENTITY_VALUES = Object.freeze([
  TENANT.tenantId,
  TENANT.tenantSlug,
  TENANT.tenantName,
  ...ACTOR_SEQUENCE.flatMap((actor) => [
    actor.subject,
    actor.userId,
    actor.email,
    actor.displayName
  ])
]);
const ALLOWED_HTTP_ORIGINS = new Set([
  BACKEND_ORIGIN,
  ...ACTOR_SEQUENCE.map((actor) => `http://127.0.0.1:${actor.port}`)
]);

export class HarnessFailure extends Error {
  constructor(code) {
    super(code);
    this.name = "HarnessFailure";
    this.code = code;
  }
}

function failure(code) {
  return new HarnessFailure(code);
}

export function validateHarnessInvocation(argv, environment) {
  if (!Array.isArray(argv) || argv.length !== 0) {
    throw failure("HARNESS_ARGUMENTS_FORBIDDEN");
  }

  const requestedTarget = environment?.[BACKEND_TARGET_ENV];
  if (requestedTarget !== undefined && requestedTarget !== BACKEND_ORIGIN) {
    throw failure("BACKEND_TARGET_MUST_BE_EXACT_LOOPBACK");
  }
}

export async function assertNoEnvironmentFiles(readdirFunction = readdir) {
  let entries;
  try {
    entries = await readdirFunction(FRONTEND_ROOT, { withFileTypes: true });
  } catch {
    throw failure("ENVIRONMENT_FILE_GUARD_FAILED");
  }

  const hasEnvironmentFile = entries.some((entry) => {
    const name = typeof entry === "string" ? entry : entry.name;
    return typeof name === "string" && name.toLowerCase().startsWith(".env");
  });

  if (hasEnvironmentFile) {
    throw failure("ENVIRONMENT_FILE_PRESENT");
  }
}

export function requireHmacSecret(environment) {
  const secret = environment?.[HMAC_SECRET_ENV];

  if (typeof secret !== "string" || secret.length === 0 || secret.trim().length === 0) {
    throw failure("JWT_HMAC_SECRET_MISSING");
  }

  if (Buffer.byteLength(secret, "utf8") < 32) {
    throw failure("JWT_HMAC_SECRET_TOO_SHORT");
  }

  return secret;
}

function encodeJson(value) {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

function signJwt(subject, secret, issuedAtSeconds, randomBytesFunction) {
  const header = { alg: "HS256", typ: "JWT" };
  const jti = Buffer.from(randomBytesFunction(32)).toString("base64url");
  const payload = {
    sub: subject,
    iat: issuedAtSeconds,
    exp: issuedAtSeconds + JWT_TTL_SECONDS,
    jti
  };
  const unsignedToken = `${encodeJson(header)}.${encodeJson(payload)}`;
  const signature = createHmac("sha256", Buffer.from(secret, "utf8"))
    .update(unsignedToken, "ascii")
    .digest("base64url");

  return {
    value: `${unsignedToken}.${signature}`,
    iat: payload.iat,
    exp: payload.exp,
    jti: payload.jti
  };
}

export function createActorTokens(
  secret,
  {
    nowMilliseconds = Date.now(),
    randomBytesFunction = secureRandomBytes
  } = {}
) {
  if (!Number.isFinite(nowMilliseconds)) {
    throw failure("JWT_CLOCK_INVALID");
  }

  const issuedAtSeconds = Math.floor(nowMilliseconds / 1_000);
  const accountant = signJwt(
    ACTORS.ACCOUNTANT.subject,
    secret,
    issuedAtSeconds,
    randomBytesFunction
  );
  const reviewer = signJwt(
    ACTORS.REVIEWER.subject,
    secret,
    issuedAtSeconds,
    randomBytesFunction
  );

  if (accountant.jti === reviewer.jti || accountant.value === reviewer.value) {
    throw failure("JWT_ACTOR_VALUES_NOT_DISTINCT");
  }

  return Object.freeze({ ACCOUNTANT: accountant, REVIEWER: reviewer });
}

function systemEnvironmentNames(platform) {
  if (platform === "win32") {
    return ["PATH", "SystemRoot", "WINDIR", "ComSpec", "PATHEXT", "TEMP", "TMP"];
  }

  return ["PATH", "HOME", "TMPDIR"];
}

function environmentValue(environment, requestedName, platform) {
  if (platform !== "win32") {
    return environment?.[requestedName];
  }

  const actualName = Object.keys(environment ?? {}).find(
    (name) => name.toLowerCase() === requestedName.toLowerCase()
  );
  return actualName === undefined ? undefined : environment[actualName];
}

export function buildChildEnvironment(
  parentEnvironment,
  bearerToken,
  platform = process.platform
) {
  const childEnvironment = {};

  for (const name of systemEnvironmentNames(platform)) {
    const value = environmentValue(parentEnvironment, name, platform);
    if (typeof value === "string" && value.length > 0) {
      childEnvironment[name] = value;
    }
  }

  childEnvironment[BACKEND_TARGET_ENV] = BACKEND_ORIGIN;
  childEnvironment[PROXY_AUTH_ENABLED_ENV] = "true";
  childEnvironment[BEARER_TOKEN_ENV] = bearerToken;

  for (const name of Object.keys(childEnvironment)) {
    if (name.toUpperCase().startsWith("VITE_")) {
      throw failure("SENSITIVE_VITE_ENVIRONMENT_FORBIDDEN");
    }
    if (FORBIDDEN_CHILD_ENV_NAME.test(name) && name !== BEARER_TOKEN_ENV) {
      throw failure("SENSITIVE_CHILD_ENVIRONMENT_FORBIDDEN");
    }
  }

  return childEnvironment;
}

function actorByName(actorName) {
  const actor = ACTORS[actorName];
  if (actor === undefined) {
    throw failure("UNKNOWN_ACTOR");
  }
  return actor;
}

export function buildViteLaunch(
  actorName,
  bearerToken,
  parentEnvironment,
  {
    execPath = process.execPath,
    platform = process.platform
  } = {}
) {
  const actor = actorByName(actorName);

  return {
    command: execPath,
    args: [
      VITE_ENTRY,
      "--host",
      "127.0.0.1",
      "--port",
      String(actor.port),
      "--strictPort"
    ],
    options: {
      cwd: FRONTEND_ROOT,
      env: buildChildEnvironment(parentEnvironment, bearerToken, platform),
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true
    }
  };
}

function exactJsonValue(actual, expected) {
  if (Array.isArray(expected)) {
    return Array.isArray(actual)
      && actual.length === expected.length
      && expected.every((value, index) => exactJsonValue(actual[index], value));
  }

  if (expected !== null && typeof expected === "object") {
    if (actual === null || typeof actual !== "object" || Array.isArray(actual)) {
      return false;
    }
    const actualKeys = Object.keys(actual).sort();
    const expectedKeys = Object.keys(expected).sort();
    return exactJsonValue(actualKeys, expectedKeys)
      && expectedKeys.every((key) => exactJsonValue(actual[key], expected[key]));
  }

  return actual === expected;
}

export function expectedMePayload(actorName) {
  const actor = actorByName(actorName);
  const tenantMembership = {
    tenantId: TENANT.tenantId,
    tenantSlug: TENANT.tenantSlug,
    tenantName: TENANT.tenantName,
    roles: [actor.role]
  };

  return {
    actor: {
      userId: actor.userId,
      externalSubject: actor.subject,
      email: actor.email,
      displayName: actor.displayName
    },
    memberships: [tenantMembership],
    activeTenant: {
      tenantId: TENANT.tenantId,
      tenantSlug: TENANT.tenantSlug,
      tenantName: TENANT.tenantName
    },
    effectiveRoles: [actor.role]
  };
}

export function classifyMePayload(actorName, payload) {
  const expected = expectedMePayload(actorName);

  if (!exactJsonValue(payload?.actor, expected.actor)) {
    return { category: "IDENTITY_MISMATCH", invalidField: "actor" };
  }
  if (!exactJsonValue(payload?.activeTenant, expected.activeTenant)) {
    return { category: "TENANT_MISMATCH", invalidField: "activeTenant" };
  }
  if (!exactJsonValue(payload?.effectiveRoles, expected.effectiveRoles)) {
    return { category: "ROLE_MISMATCH", invalidField: "effectiveRoles" };
  }
  if (!exactJsonValue(payload?.memberships, expected.memberships)) {
    return { category: "MEMBERSHIP_MISMATCH", invalidField: "memberships" };
  }
  if (!exactJsonValue(payload, expected)) {
    return { category: "INVALID_JSON", invalidField: "payload" };
  }

  return undefined;
}

export function assertExpectedMe(actorName, payload) {
  if (classifyMePayload(actorName, payload) !== undefined) {
    throw failure(`${actorName}_ME_IDENTITY_MISMATCH`);
  }
}

export function formatReadinessDiagnostic(actorName, readinessState) {
  actorByName(actorName);
  const category = READINESS_CATEGORIES.has(readinessState?.category)
    ? readinessState.category
    : "UNKNOWN";
  const attempts = Number.isInteger(readinessState?.attempts) && readinessState.attempts >= 0
    ? readinessState.attempts
    : 0;
  const lastHttpStatus = Number.isInteger(readinessState?.lastHttpStatus)
    && readinessState.lastHttpStatus >= 100
    && readinessState.lastHttpStatus <= 599
    ? String(readinessState.lastHttpStatus)
    : "NONE";
  const invalidField = READINESS_INVALID_FIELDS.has(readinessState?.invalidField)
    ? ` invalidField=${readinessState.invalidField}`
    : "";

  return `HARNESS_READINESS_FAILED actor=${actorName} phase=${READINESS_PHASE} category=${category} attempts=${attempts} lastHttpStatus=${lastHttpStatus}${invalidField}`;
}

export function formatMonitorDiagnostic(actorName, level, monitorState) {
  actorByName(actorName);
  const safeLevel = MONITOR_DIAGNOSTIC_LEVELS.has(level) ? level : "FAILED";
  const category = READINESS_CATEGORIES.has(monitorState?.category)
    ? monitorState.category
    : "UNKNOWN";
  const consecutiveFailures = Number.isInteger(monitorState?.consecutiveFailures)
    && monitorState.consecutiveFailures >= 1
    && monitorState.consecutiveFailures <= IDENTITY_MONITOR_TRANSIENT_FAILURE_THRESHOLD
    ? monitorState.consecutiveFailures
    : 1;
  const threshold = MONITOR_DIAGNOSTIC_THRESHOLDS.has(monitorState?.threshold)
    ? monitorState.threshold
    : 1;
  const httpStatus = category === "HTTP_STATUS"
    && Number.isInteger(monitorState?.lastHttpStatus)
    && monitorState.lastHttpStatus >= 100
    && monitorState.lastHttpStatus <= 599
    ? ` httpStatus=${monitorState.lastHttpStatus}`
    : "";
  const invalidField = READINESS_INVALID_FIELDS.has(monitorState?.invalidField)
    ? ` invalidField=${monitorState.invalidField}`
    : "";

  return `HARNESS_MONITOR_${safeLevel} actor=${actorName} category=${category} consecutiveFailures=${consecutiveFailures} threshold=${threshold}${httpStatus}${invalidField}`;
}

function replaceExact(value, sensitiveValue, replacement) {
  if (typeof sensitiveValue !== "string" || sensitiveValue.length === 0) {
    return value;
  }
  return value.split(sensitiveValue).join(replacement);
}

export function redactSensitiveText(
  text,
  { tokens = [], secret = "", sensitiveValues = [] } = {}
) {
  const rawText = String(text);
  if (SENSITIVE_ME_PAYLOAD_FIELD.test(rawText)) {
    return "[REDACTED_SENSITIVE_PAYLOAD]";
  }

  let redacted = rawText.replace(AUTHORIZATION_HEADER, "[REDACTED_AUTHORIZATION]");

  for (const token of tokens) {
    redacted = replaceExact(redacted, token, "[REDACTED_TOKEN]");
  }
  redacted = replaceExact(redacted, secret, "[REDACTED_SECRET]");
  for (const sensitiveValue of sensitiveValues) {
    redacted = replaceExact(redacted, sensitiveValue, "[REDACTED_SENSITIVE]");
  }

  return redacted.replace(JWT_LIKE_VALUE, "[REDACTED_JWT]");
}

function attachLineForwarder(stream, actorName, write, redactionMaterial, onFailure) {
  let buffered = "";

  const emitLine = (line) => {
    write(`[${actorName}] ${redactSensitiveText(line, redactionMaterial)}\n`);
  };
  const onData = (chunk) => {
    buffered += String(chunk);
    if (buffered.length > MAX_BUFFERED_LOG_LINE) {
      buffered = "";
      onFailure("CHILD_LOG_LINE_TOO_LONG");
      return;
    }

    let lineBreak = buffered.indexOf("\n");
    while (lineBreak >= 0) {
      const rawLine = buffered.slice(0, lineBreak);
      buffered = buffered.slice(lineBreak + 1);
      emitLine(rawLine.endsWith("\r") ? rawLine.slice(0, -1) : rawLine);
      lineBreak = buffered.indexOf("\n");
    }
  };
  const onEnd = () => {
    if (buffered.length > 0) {
      emitLine(buffered.endsWith("\r") ? buffered.slice(0, -1) : buffered);
      buffered = "";
    }
  };
  const onError = () => onFailure("CHILD_LOG_STREAM_FAILED");

  stream.on("data", onData);
  stream.once("end", onEnd);
  stream.once("error", onError);

  return () => {
    stream.off("data", onData);
    stream.off("end", onEnd);
    stream.off("error", onError);
  };
}

export function attachRedactedChildOutput(
  child,
  actorName,
  redactionMaterial,
  {
    writeStdout = (value) => process.stdout.write(value),
    writeStderr = (value) => process.stderr.write(value),
    onFailure = () => undefined
  } = {}
) {
  if (child.stdout === null || child.stderr === null) {
    throw failure("CHILD_STDIO_MUST_BE_PIPED");
  }

  const detachStdout = attachLineForwarder(
    child.stdout,
    actorName,
    writeStdout,
    redactionMaterial,
    onFailure
  );
  const detachStderr = attachLineForwarder(
    child.stderr,
    actorName,
    writeStderr,
    redactionMaterial,
    onFailure
  );

  return () => {
    detachStdout();
    detachStderr();
  };
}

export function assertLoopbackUrl(rawUrl) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw failure("NON_LOOPBACK_REQUEST_FORBIDDEN");
  }

  if (
    parsed.protocol !== "http:"
    || parsed.hostname !== "127.0.0.1"
    || !ALLOWED_HTTP_ORIGINS.has(parsed.origin)
  ) {
    throw failure("NON_LOOPBACK_REQUEST_FORBIDDEN");
  }

  return parsed;
}

export function assertPortAvailable(
  port,
  { createServerFunction = createServer } = {}
) {
  return new Promise((resolvePromise, rejectPromise) => {
    const server = createServerFunction();
    let settled = false;

    const reject = () => {
      if (settled) return;
      settled = true;
      rejectPromise(failure("PORT_UNAVAILABLE"));
    };

    server.once("error", reject);
    server.listen({ host: "127.0.0.1", port, exclusive: true }, () => {
      server.close((closeError) => {
        if (settled) return;
        settled = true;
        if (closeError !== undefined) {
          rejectPromise(failure("PORT_PROBE_CLOSE_FAILED"));
        } else {
          resolvePromise();
        }
      });
    });
  });
}

function createDefaultDependencies() {
  return {
    spawnFunction: spawnProcess,
    fetchFunction: (...args) => globalThis.fetch(...args),
    readdirFunction: readdir,
    createServerFunction: createServer,
    randomBytesFunction: secureRandomBytes,
    nowFunction: () => Date.now(),
    setTimeoutFunction: setTimeout,
    clearTimeoutFunction: clearTimeout,
    processReference: process,
    platform: process.platform,
    execPath: process.execPath,
    writeStdout: (value) => process.stdout.write(value),
    writeStderr: (value) => process.stderr.write(value),
    readinessPolicy: READINESS_POLICY
  };
}

function delay(milliseconds, dependencies) {
  return new Promise((resolvePromise) => {
    dependencies.setTimeoutFunction(resolvePromise, milliseconds);
  });
}

async function fetchWithTimeout(url, dependencies) {
  assertLoopbackUrl(url);
  const controller = new globalThis.AbortController();
  const timeout = dependencies.setTimeoutFunction(
    () => controller.abort(),
    REQUEST_TIMEOUT_MILLISECONDS
  );

  try {
    return await dependencies.fetchFunction(url, {
      method: "GET",
      redirect: "manual",
      headers: { Accept: "application/json" },
      signal: controller.signal
    });
  } finally {
    dependencies.clearTimeoutFunction(timeout);
  }
}

function isAbortError(error) {
  return error !== null
    && typeof error === "object"
    && "name" in error
    && error.name === "AbortError";
}

function readinessFailureResult(category, lastHttpStatus = undefined, invalidField = undefined) {
  return { ready: false, category, lastHttpStatus, invalidField };
}

export function isTransientReadinessFailure(result) {
  return result?.category === "CONNECTION"
    || result?.category === "TIMEOUT"
    || (result?.category === "HTTP_STATUS"
      && Number.isInteger(result.lastHttpStatus)
      && result.lastHttpStatus >= 500
      && result.lastHttpStatus <= 599);
}

async function probeActorReadiness(actor, dependencies, cancellationSignal = undefined) {
  const url = `http://127.0.0.1:${actor.port}/api/me`;
  assertLoopbackUrl(url);
  if (cancellationSignal?.aborted === true) {
    return { ready: false, cancelled: true };
  }

  const controller = new globalThis.AbortController();
  let requestTimedOut = false;
  const cancelRequest = () => controller.abort();
  cancellationSignal?.addEventListener("abort", cancelRequest, { once: true });
  const timeout = dependencies.setTimeoutFunction(() => {
    requestTimedOut = true;
    controller.abort();
  }, dependencies.readinessPolicy.requestTimeoutMilliseconds);
  let response;

  try {
    try {
      response = await dependencies.fetchFunction(url, {
        method: "GET",
        redirect: "manual",
        headers: { Accept: "application/json" },
        signal: controller.signal
      });
    } catch (error) {
      if (cancellationSignal?.aborted === true) {
        return { ready: false, cancelled: true };
      }
      return readinessFailureResult(
        requestTimedOut || isAbortError(error) ? "TIMEOUT" : "CONNECTION"
      );
    }

    const lastHttpStatus = Number.isInteger(response?.status) ? response.status : undefined;
    if (lastHttpStatus !== 200) {
      return readinessFailureResult("HTTP_STATUS", lastHttpStatus);
    }

    let payload;
    try {
      payload = await response.json();
    } catch (error) {
      if (cancellationSignal?.aborted === true) {
        return { ready: false, cancelled: true };
      }
      return readinessFailureResult(
        requestTimedOut || isAbortError(error) ? "TIMEOUT" : "INVALID_JSON",
        lastHttpStatus
      );
    }

    if (cancellationSignal?.aborted === true) {
      return { ready: false, cancelled: true };
    }
    if (requestTimedOut) {
      return readinessFailureResult("TIMEOUT", lastHttpStatus);
    }

    const mismatch = classifyMePayload(actor.name, payload);
    if (mismatch !== undefined) {
      return readinessFailureResult(
        mismatch.category,
        lastHttpStatus,
        mismatch.invalidField
      );
    }

    return { ready: true, lastHttpStatus };
  } finally {
    dependencies.clearTimeoutFunction(timeout);
    cancellationSignal?.removeEventListener("abort", cancelRequest);
  }
}

async function preflightBackend(dependencies) {
  let response;
  try {
    response = await fetchWithTimeout(BACKEND_HEALTH_URL, dependencies);
  } catch {
    throw failure("BACKEND_PREFLIGHT_FAILED");
  }

  if (response.status !== 200) {
    throw failure("BACKEND_PREFLIGHT_FAILED");
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw failure("BACKEND_PREFLIGHT_FAILED");
  }

  if (payload?.status !== "UP") {
    throw failure("BACKEND_PREFLIGHT_FAILED");
  }
}

function timeoutPromise(promise, milliseconds, dependencies) {
  return new Promise((resolvePromise, rejectPromise) => {
    const timeout = dependencies.setTimeoutFunction(
      () => rejectPromise(failure("PROCESS_STOP_TIMEOUT")),
      milliseconds
    );
    promise.then(
      (value) => {
        dependencies.clearTimeoutFunction(timeout);
        resolvePromise(value);
      },
      () => {
        dependencies.clearTimeoutFunction(timeout);
        rejectPromise(failure("PROCESS_STOP_FAILED"));
      }
    );
  });
}

function normalizeFailure(error, fallbackCode) {
  return error instanceof HarnessFailure ? error : failure(fallbackCode);
}

export function createHarnessRuntime({
  environment = process.env,
  argv = process.argv.slice(2),
  dependencies: dependencyOverrides = {}
} = {}) {
  const dependencies = { ...createDefaultDependencies(), ...dependencyOverrides };
  const children = [];
  const processListeners = [];
  let expirationTimer;
  let identityMonitorTimer;
  let identityMonitorInFlight;
  let identityMonitorAbortController;
  let stopRequest;
  let stopResolve;
  let readyResolve;
  let readyReject;
  let started = false;
  let shuttingDown = false;
  let readySettled = false;
  const monitorConsecutiveFailures = new Map(
    ACTOR_SEQUENCE.map((actor) => [actor.name, 0])
  );

  const stopPromise = new Promise((resolvePromise) => {
    stopResolve = resolvePromise;
  });
  const ready = new Promise((resolvePromise, rejectPromise) => {
    readyResolve = resolvePromise;
    readyReject = rejectPromise;
  });
  ready.catch(() => undefined);

  const requestStop = (code, exitCode = 1) => {
    if (stopRequest !== undefined) return;
    stopRequest = { code, exitCode };
    stopResolve(stopRequest);
  };

  const raceStop = async (operation) => {
    const outcome = await Promise.race([
      Promise.resolve(operation).then(
        (value) => ({ kind: "value", value }),
        (error) => ({ kind: "error", error })
      ),
      stopPromise.then((request) => ({ kind: "stop", request }))
    ]);

    if (outcome.kind === "stop") {
      throw failure(outcome.request.code);
    }
    if (outcome.kind === "error") {
      throw outcome.error;
    }
    return outcome.value;
  };

  const installProcessListener = (eventName, listener) => {
    dependencies.processReference.on(eventName, listener);
    processListeners.push([eventName, listener]);
  };

  const installProcessGuards = () => {
    installProcessListener("SIGINT", () => requestStop("SIGINT", 0));
    installProcessListener("SIGTERM", () => requestStop("SIGTERM", 0));
    installProcessListener("uncaughtException", () => requestStop("UNCAUGHT_EXCEPTION", 1));
    installProcessListener("unhandledRejection", () => requestStop("UNHANDLED_REJECTION", 1));
  };

  const removeProcessGuards = () => {
    for (const [eventName, listener] of processListeners) {
      dependencies.processReference.off(eventName, listener);
    }
    processListeners.length = 0;
  };

  const registerChild = (actor, child, detachOutput) => {
    let closeResolve;
    const closePromise = new Promise((resolvePromise) => {
      closeResolve = resolvePromise;
    });
    const record = {
      actor,
      child,
      detachOutput,
      closed: false,
      closePromise
    };
    const onExit = () => {
      if (!shuttingDown) requestStop(`${actor.name}_PROCESS_EXITED`, 1);
    };
    const onClose = () => {
      record.closed = true;
      closeResolve();
      if (!shuttingDown) requestStop(`${actor.name}_PROCESS_EXITED`, 1);
    };
    const onError = () => {
      if (!shuttingDown) requestStop(`${actor.name}_PROCESS_FAILED`, 1);
    };

    child.once("exit", onExit);
    child.once("close", onClose);
    child.once("error", onError);
    record.onExit = onExit;
    record.onClose = onClose;
    record.onError = onError;
    children.push(record);
    return record;
  };

  const startActor = (actor, token, redactionMaterial) => {
    const launch = buildViteLaunch(actor.name, token, environment, {
      execPath: dependencies.execPath,
      platform: dependencies.platform
    });
    let child;
    try {
      child = dependencies.spawnFunction(launch.command, launch.args, launch.options);
    } catch {
      throw failure(`${actor.name}_START_FAILED`);
    }

    const record = registerChild(actor, child, () => undefined);
    try {
      record.detachOutput = attachRedactedChildOutput(child, actor.name, redactionMaterial, {
        writeStdout: dependencies.writeStdout,
        writeStderr: dependencies.writeStderr,
        onFailure: (code) => requestStop(code, 1)
      });
    } catch {
      throw failure(`${actor.name}_START_FAILED`);
    }

    return record;
  };

  const waitForActorReadiness = async (actor, readinessState) => {
    for (
      let attempt = 1;
      attempt <= dependencies.readinessPolicy.attempts;
      attempt += 1
    ) {
      readinessState.attempts = attempt;
      let result;
      try {
        result = await probeActorReadiness(actor, dependencies);
      } catch {
        result = readinessFailureResult("UNKNOWN");
      }
      if (result.ready) return;

      readinessState.category = result.category;
      readinessState.lastHttpStatus = result.lastHttpStatus;
      readinessState.invalidField = result.invalidField;
      if (!isTransientReadinessFailure(result)) {
        throw failure(`${actor.name}_READINESS_FAILED`);
      }
      if (attempt < dependencies.readinessPolicy.attempts) {
        await raceStop(delay(dependencies.readinessPolicy.intervalMilliseconds, dependencies));
      }
    }
    throw failure(`${actor.name}_READINESS_FAILED`);
  };

  const awaitActorReadiness = async (actor) => {
    const readinessState = {
      attempts: 0,
      category: "UNKNOWN",
      lastHttpStatus: undefined,
      invalidField: undefined
    };

    try {
      await raceStop(waitForActorReadiness(actor, readinessState));
    } catch (error) {
      const readinessCode = `${actor.name}_READINESS_FAILED`;
      const childExited = error instanceof HarnessFailure
        && (error.code === `${actor.name}_PROCESS_EXITED`
          || error.code === `${actor.name}_PROCESS_FAILED`);

      if (!childExited && (!(error instanceof HarnessFailure) || error.code !== readinessCode)) {
        throw error;
      }
      if (childExited) {
        readinessState.category = "CHILD_EXITED";
        readinessState.lastHttpStatus = undefined;
        readinessState.invalidField = undefined;
      }

      dependencies.writeStderr(
        `${formatReadinessDiagnostic(actor.name, readinessState)}\n`
      );
      throw failure(readinessCode);
    }
  };

  const stopChild = async (record) => {
    if (!record.closed) {
      try {
        record.child.kill("SIGTERM");
      } catch {
        throw failure("PROCESS_STOP_FAILED");
      }

      try {
        await timeoutPromise(
          record.closePromise,
          PROCESS_STOP_TIMEOUT_MILLISECONDS,
          dependencies
        );
      } catch {
        if (!record.closed) {
          try {
            record.child.kill("SIGKILL");
          } catch {
            throw failure("PROCESS_STOP_FAILED");
          }
          await timeoutPromise(
            record.closePromise,
            PROCESS_STOP_TIMEOUT_MILLISECONDS,
            dependencies
          );
        }
      }
    }
    record.detachOutput();
    record.child.off("exit", record.onExit);
    record.child.off("close", record.onClose);
    record.child.off("error", record.onError);
  };

  const verifyOwnedPortsReleased = async () => {
    const ownedPorts = [...new Set(children.map((record) => record.actor.port))];
    for (const port of ownedPorts) {
      let released = false;
      for (let attempt = 0; attempt < PORT_RELEASE_ATTEMPTS; attempt += 1) {
        try {
          await assertPortAvailable(port, {
            createServerFunction: dependencies.createServerFunction
          });
          released = true;
          break;
        } catch {
          if (attempt + 1 < PORT_RELEASE_ATTEMPTS) {
            await delay(PORT_RELEASE_INTERVAL_MILLISECONDS, dependencies);
          }
        }
      }
      if (!released) throw failure("PORT_RELEASE_FAILED");
    }
  };

  const cancelIdentityMonitor = async () => {
    identityMonitorAbortController?.abort();
    if (identityMonitorTimer !== undefined) {
      dependencies.clearTimeoutFunction(identityMonitorTimer);
      identityMonitorTimer = undefined;
    }
    if (identityMonitorInFlight !== undefined) {
      await identityMonitorInFlight;
    }
  };

  const shutdownChildren = async () => {
    shuttingDown = true;
    if (expirationTimer !== undefined) {
      dependencies.clearTimeoutFunction(expirationTimer);
      expirationTimer = undefined;
    }
    await cancelIdentityMonitor();

    const results = await Promise.allSettled(children.map((record) => stopChild(record)));
    if (results.some((result) => result.status === "rejected")) {
      throw failure("PROCESS_STOP_FAILED");
    }
    await verifyOwnedPortsReleased();
  };

  const monitorActorIdentity = async (actor) => {
    let result;
    try {
      result = await probeActorReadiness(
        actor,
        dependencies,
        identityMonitorAbortController.signal
      );
    } catch {
      result = readinessFailureResult("UNKNOWN");
    }

    if (result.cancelled === true || stopRequest !== undefined) return false;
    if (result.ready) {
      monitorConsecutiveFailures.set(actor.name, 0);
      return true;
    }

    const transient = isTransientReadinessFailure(result);
    const consecutiveFailures = transient
      ? (monitorConsecutiveFailures.get(actor.name) ?? 0) + 1
      : 1;
    const threshold = transient ? IDENTITY_MONITOR_TRANSIENT_FAILURE_THRESHOLD : 1;
    monitorConsecutiveFailures.set(actor.name, consecutiveFailures);
    const failed = consecutiveFailures >= threshold;
    dependencies.writeStderr(
      `${formatMonitorDiagnostic(actor.name, failed ? "FAILED" : "DEGRADED", {
        ...result,
        consecutiveFailures,
        threshold
      })}\n`
    );

    if (failed) {
      requestStop(`${actor.name}_ME_REQUEST_FAILED`, 1);
      return false;
    }
    return true;
  };

  const runIdentityMonitorCycle = async () => {
    for (const actor of ACTOR_SEQUENCE) {
      if (!await monitorActorIdentity(actor)) return;
    }
  };

  const scheduleIdentityMonitor = () => {
    if (stopRequest !== undefined || identityMonitorAbortController.signal.aborted) return;
    identityMonitorTimer = dependencies.setTimeoutFunction(async () => {
      identityMonitorTimer = undefined;
      if (stopRequest !== undefined || identityMonitorAbortController.signal.aborted) return;

      const cyclePromise = runIdentityMonitorCycle();
      identityMonitorInFlight = cyclePromise;
      try {
        await cyclePromise;
      } finally {
        if (identityMonitorInFlight === cyclePromise) {
          identityMonitorInFlight = undefined;
        }
        scheduleIdentityMonitor();
      }
    }, IDENTITY_MONITOR_INTERVAL_MILLISECONDS);
  };

  const startIdentityMonitor = () => {
    identityMonitorAbortController = new globalThis.AbortController();
    scheduleIdentityMonitor();
  };

  const run = async () => {
    if (started) throw failure("HARNESS_ALREADY_STARTED");
    started = true;
    installProcessGuards();

    let primaryFailure;
    let requestedExitCode = 1;
    try {
      validateHarnessInvocation(argv, environment);
      await assertNoEnvironmentFiles(dependencies.readdirFunction);
      const secret = requireHmacSecret(environment);
      const tokens = createActorTokens(secret, {
        nowMilliseconds: dependencies.nowFunction(),
        randomBytesFunction: dependencies.randomBytesFunction
      });
      const redactionMaterial = {
        tokens: ACTOR_SEQUENCE.map((actor) => tokens[actor.name].value),
        secret,
        sensitiveValues: [
          ...HARNESS_IDENTITY_VALUES,
          ...ACTOR_SEQUENCE.map((actor) => tokens[actor.name].jti)
        ]
      };

      const expirationMilliseconds = Math.max(
        0,
        tokens.ACCOUNTANT.exp * 1_000 - dependencies.nowFunction()
      );
      expirationTimer = dependencies.setTimeoutFunction(
        () => requestStop("JWT_EXPIRED", 1),
        expirationMilliseconds
      );

      await raceStop(preflightBackend(dependencies));
      for (const actor of ACTOR_SEQUENCE) {
        try {
          await raceStop(assertPortAvailable(actor.port, {
            createServerFunction: dependencies.createServerFunction
          }));
        } catch (error) {
          throw normalizeFailure(error, `PORT_${actor.port}_UNAVAILABLE`);
        }
      }

      for (const actor of ACTOR_SEQUENCE) {
        startActor(actor, tokens[actor.name].value, redactionMaterial);
        await awaitActorReadiness(actor);
      }

      dependencies.writeStdout("HARNESS_READY\n");
      readySettled = true;
      readyResolve();
      startIdentityMonitor();

      const request = await stopPromise;
      requestedExitCode = request.exitCode;
      if (request.exitCode !== 0) {
        primaryFailure = failure(request.code);
      }
    } catch (error) {
      primaryFailure = normalizeFailure(error, "HARNESS_START_FAILED");
      if (!readySettled) {
        readySettled = true;
        readyReject(primaryFailure);
      }
    }

    try {
      await shutdownChildren();
    } catch (error) {
      if (primaryFailure === undefined) {
        primaryFailure = normalizeFailure(error, "HARNESS_SHUTDOWN_FAILED");
      }
    } finally {
      removeProcessGuards();
    }

    if (primaryFailure !== undefined) throw primaryFailure;
    return { exitCode: requestedExitCode };
  };

  const shutdown = (code = "SHUTDOWN_REQUESTED", exitCode = 0) => {
    requestStop(code, exitCode);
    return stopPromise;
  };

  return Object.freeze({ run, ready, shutdown });
}

export async function runHarness(options) {
  return createHarnessRuntime(options).run();
}

async function runCli() {
  try {
    const result = await runHarness();
    process.exitCode = result.exitCode;
  } catch (error) {
    const safeFailure = normalizeFailure(error, "HARNESS_FAILED");
    process.stderr.write(`HARNESS_FAILED code=${safeFailure.code}\n`);
    process.exitCode = 1;
  }
}

const IS_DIRECT_EXECUTION = process.argv[1] !== undefined
  && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;

if (IS_DIRECT_EXECUTION) {
  await runCli();
}
