// @vitest-environment node

import { Buffer } from "node:buffer";
import { createHmac } from "node:crypto";
import { EventEmitter } from "node:events";
import { readFileSync } from "node:fs";
import { createServer } from "node:net";
import type { AddressInfo } from "node:net";
import { dirname, join } from "node:path";
import { PassThrough } from "node:stream";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ACTORS,
  BACKEND_HEALTH_URL,
  BACKEND_ORIGIN,
  IDENTITY_MONITOR_INTERVAL_MILLISECONDS,
  IDENTITY_MONITOR_TRANSIENT_FAILURE_THRESHOLD,
  JWT_TTL_SECONDS,
  READINESS_POLICY,
  assertExpectedMe,
  assertLoopbackUrl,
  assertNoEnvironmentFiles,
  assertPortAvailable,
  attachRedactedChildOutput,
  buildChildEnvironment,
  buildViteLaunch,
  classifyMePayload,
  createActorTokens,
  createHarnessRuntime,
  expectedMePayload,
  formatMonitorDiagnostic,
  formatReadinessDiagnostic,
  isTransientReadinessFailure,
  redactSensitiveText,
  requireHmacSecret,
  validateHarnessInvocation
} from "./local-two-actor-harness.mjs";

type ActorName = "ACCOUNTANT" | "REVIEWER";

type FakeChild = EventEmitter & {
  stdout: PassThrough | null;
  stderr: PassThrough | null;
  exitCode: number | null;
  signalCode: string | null;
  kill: ReturnType<typeof vi.fn>;
};

type RuntimeFixtureOptions = {
  occupiedPorts?: Set<number>;
  closeOnSpawn?: ActorName;
  wrongInitialMe?: ActorName;
  captureExpiration?: boolean;
  readinessFailure?: ReadinessFailure;
  startupOutcomes?: Partial<Record<ActorName, StartupOutcome[]>>;
  monitorOutcomes?: Partial<Record<ActorName, MonitorOutcome[]>>;
  readinessPolicy?: {
    attempts: number;
    intervalMilliseconds: number;
    requestTimeoutMilliseconds: number;
  };
};

type ReadinessFailure = {
  actor?: ActorName;
  kind:
    | "CONNECTION"
    | "TIMEOUT"
    | "HTTP_401"
    | "HTTP_403"
    | "HTTP_422"
    | "HTTP_302"
    | "HTTP_500"
    | "INVALID_JSON"
    | "IDENTITY_MISMATCH"
    | "TENANT_MISMATCH"
    | "ROLE_MISMATCH"
    | "MEMBERSHIP_COUNT_MISMATCH"
    | "MEMBERSHIP_CONTENT_MISMATCH"
    | "UNKNOWN";
};

type StartupOutcome = ReadinessFailure | { kind: "SUCCESS" };

type MonitorOutcome = ReadinessFailure | {
  kind: "SUCCESS" | "DEFERRED_SUCCESS";
};

const frontendRoot = dirname(fileURLToPath(import.meta.url));
const harnessSourcePath = join(frontendRoot, "local-two-actor-harness.mjs");
const HMAC_SECRET = "synthetic-hmac-secret-for-043b-tests-only";
const SENSITIVE_ERROR_SENTINEL = [
  "Authorization: Bearer sensitiveHeader.sensitivePayload.sensitiveSignature",
  HMAC_SECRET,
  ACTORS.ACCOUNTANT.userId,
  ACTORS.ACCOUNTANT.email,
  ACTORS.ACCOUNTANT.displayName,
  expectedMePayload("ACCOUNTANT").activeTenant.tenantId
].join(" ");
const BACKEND_CONTRACT_ME_PAYLOADS = {
  ACCOUNTANT: {
    actor: {
      userId: "036a0000-0000-4000-8000-000000000002",
      externalSubject: "ritomer-demo-user-036a",
      email: "demo.accountant@example.invalid",
      displayName: "Demo Accountant 036a"
    },
    memberships: [{
      tenantId: "036a0000-0000-4000-8000-000000000001",
      tenantSlug: "ritomer-demo-036a",
      tenantName: "Ritomer Demo Fiduciaire SA (synthetic)",
      roles: ["ACCOUNTANT"]
    }],
    activeTenant: {
      tenantId: "036a0000-0000-4000-8000-000000000001",
      tenantSlug: "ritomer-demo-036a",
      tenantName: "Ritomer Demo Fiduciaire SA (synthetic)"
    },
    effectiveRoles: ["ACCOUNTANT"]
  },
  REVIEWER: {
    actor: {
      userId: "043b0000-0000-4000-8000-000000000002",
      externalSubject: "ritomer-demo-reviewer-043b",
      email: "demo.reviewer.043b@example.invalid",
      displayName: "Demo Reviewer 043b"
    },
    memberships: [{
      tenantId: "036a0000-0000-4000-8000-000000000001",
      tenantSlug: "ritomer-demo-036a",
      tenantName: "Ritomer Demo Fiduciaire SA (synthetic)",
      roles: ["REVIEWER"]
    }],
    activeTenant: {
      tenantId: "036a0000-0000-4000-8000-000000000001",
      tenantSlug: "ritomer-demo-036a",
      tenantName: "Ritomer Demo Fiduciaire SA (synthetic)"
    },
    effectiveRoles: ["REVIEWER"]
  }
} as const;

afterEach(() => {
  vi.restoreAllMocks();
});

describe("local two-actor JWT contract", () => {
  it("creates two distinct HS256 JWTs with the exact four-claim payload and 3600 second TTL", () => {
    const randomValues = [Buffer.alloc(32, 0x11), Buffer.alloc(32, 0x22)];
    const randomBytesFunction = vi.fn(() => randomValues.shift() ?? Buffer.alloc(32, 0x33));
    const nowMilliseconds = 1_700_000_000_123;

    const tokens = createActorTokens(HMAC_SECRET, {
      nowMilliseconds,
      randomBytesFunction
    });
    const accountant = decodeJwt(tokens.ACCOUNTANT.value);
    const reviewer = decodeJwt(tokens.REVIEWER.value);

    expect(accountant.header).toEqual({ alg: "HS256", typ: "JWT" });
    expect(Object.keys(accountant.header)).toEqual(["alg", "typ"]);
    expect(accountant.payload).toEqual({
      sub: ACTORS.ACCOUNTANT.subject,
      iat: 1_700_000_000,
      exp: 1_700_003_600,
      jti: tokens.ACCOUNTANT.jti
    });
    expect(reviewer.payload).toEqual({
      sub: ACTORS.REVIEWER.subject,
      iat: 1_700_000_000,
      exp: 1_700_003_600,
      jti: tokens.REVIEWER.jti
    });

    for (const token of [tokens.ACCOUNTANT, tokens.REVIEWER]) {
      const decoded = decodeJwt(token.value);
      expect(Object.keys(decoded.payload)).toEqual(["sub", "iat", "exp", "jti"]);
      expect(Number.isInteger(decoded.payload.iat)).toBe(true);
      expect(Number.isInteger(decoded.payload.exp)).toBe(true);
      expect(decoded.payload.exp - decoded.payload.iat).toBe(JWT_TTL_SECONDS);
      expect(decoded.signature).toBe(expectedSignature(decoded.unsignedToken, HMAC_SECRET));
    }

    expect(tokens.ACCOUNTANT.value).not.toBe(tokens.REVIEWER.value);
    expect(tokens.ACCOUNTANT.jti).not.toBe(tokens.REVIEWER.jti);
    expect(randomBytesFunction).toHaveBeenCalledTimes(2);
  });

  it("rejects absent blank short legacy and sentinel secrets using UTF-8 byte length", () => {
    const cases = [
      {},
      { RITOMER_SECURITY_JWT_HMAC_SECRET: "" },
      { RITOMER_SECURITY_JWT_HMAC_SECRET: " ".repeat(32) },
      { RITOMER_SECURITY_JWT_HMAC_SECRET: "x".repeat(31) },
      { RITOMER_SECURITY_JWT_HMAC_SECRET: "\u00e9".repeat(15) },
      { RITOMER_SECURITY_JWT_HMAC_SECRET: "local-dev-only-jwt-hmac-secret-change-me" },
      { RITOMER_SECURITY_JWT_HMAC_SECRET: "__INVALID_RUNTIME_SECRET_REQUIRED__" }
    ];

    for (const environment of cases) {
      expect(() => requireHmacSecret(environment)).toThrow();
    }

    const exactlyThirtyTwoUtf8Bytes = "\u00e9".repeat(16);
    expect(
      requireHmacSecret({ RITOMER_SECURITY_JWT_HMAC_SECRET: exactlyThirtyTwoUtf8Bytes })
    ).toBe(exactlyThirtyTwoUtf8Bytes);
  });

  it("fails closed instead of silently regenerating colliding jti values", () => {
    const randomBytesFunction = vi.fn(() => Buffer.alloc(32, 0x44));

    expect(() =>
      createActorTokens(HMAC_SECRET, {
        nowMilliseconds: 1_700_000_000_000,
        randomBytesFunction
      })
    ).toThrow("JWT_ACTOR_VALUES_NOT_DISTINCT");
    expect(randomBytesFunction).toHaveBeenCalledTimes(2);
  });
});

describe("fixed loopback launch and child environments", () => {
  it.each([
    ["localhost host", ["--host", "localhost"]],
    ["wildcard IPv4 host", ["--host", "0.0.0.0"]],
    ["wildcard IPv6 host", ["--host", "::"]],
    ["port override", ["--port", "9999"]],
    ["browser opening", ["--open"]]
  ])("rejects the %s override", (_label, argv) => {
    expect(() => validateHarnessInvocation(argv, {})).toThrow("HARNESS_ARGUMENTS_FORBIDDEN");
  });

  it.each([
    "http://localhost:8080",
    "http://0.0.0.0:8080",
    "http://[::]:8080",
    "http://127.0.0.1:18080",
    "https://127.0.0.1:8080"
  ])("rejects backend target %s", (target) => {
    expect(() =>
      validateHarnessInvocation([], { RITOMER_LOCAL_DEMO_BACKEND_TARGET: target })
    ).toThrow("BACKEND_TARGET_MUST_BE_EXACT_LOOPBACK");
  });

  it("allows only the absent or exact backend target", () => {
    expect(() => validateHarnessInvocation([], {})).not.toThrow();
    expect(() =>
      validateHarnessInvocation([], { RITOMER_LOCAL_DEMO_BACKEND_TARGET: BACKEND_ORIGIN })
    ).not.toThrow();
  });

  it("builds isolated allowlisted child environments with no secret, crossing token, or VITE value", () => {
    const parentEnvironment = {
      Path: "C:\\safe-bin",
      SystemRoot: "C:\\Windows",
      TEMP: "C:\\Temp",
      RITOMER_SECURITY_JWT_HMAC_SECRET: HMAC_SECRET,
      ACCOUNTANT_TOKEN: "must-not-pass",
      REVIEWER_PASSWORD: "must-not-pass",
      CLOUD_API_KEY: "must-not-pass",
      VITE_PRIVATE_TOKEN: "must-not-pass",
      npm_config_user_agent: "must-not-pass"
    };
    const accountantToken = "accountant-token-sentinel";
    const reviewerToken = "reviewer-token-sentinel";

    const accountantEnvironment = buildChildEnvironment(
      parentEnvironment,
      accountantToken,
      "win32"
    );
    const reviewerEnvironment = buildChildEnvironment(
      parentEnvironment,
      reviewerToken,
      "win32"
    );

    const expectedNames = [
      "PATH",
      "SystemRoot",
      "TEMP",
      "RITOMER_LOCAL_DEMO_BACKEND_TARGET",
      "RITOMER_LOCAL_DEMO_PROXY_AUTH_ENABLED",
      "RITOMER_LOCAL_DEMO_BEARER_TOKEN"
    ].sort();
    expect(Object.keys(accountantEnvironment).sort()).toEqual(expectedNames);
    expect(Object.keys(reviewerEnvironment).sort()).toEqual(expectedNames);
    expect(accountantEnvironment).toMatchObject({
      RITOMER_LOCAL_DEMO_BACKEND_TARGET: BACKEND_ORIGIN,
      RITOMER_LOCAL_DEMO_PROXY_AUTH_ENABLED: "true",
      RITOMER_LOCAL_DEMO_BEARER_TOKEN: accountantToken
    });
    expect(reviewerEnvironment.RITOMER_LOCAL_DEMO_BEARER_TOKEN).toBe(reviewerToken);

    expect(Object.values(accountantEnvironment)).not.toContain(HMAC_SECRET);
    expect(Object.values(reviewerEnvironment)).not.toContain(HMAC_SECRET);
    expect(Object.values(accountantEnvironment)).not.toContain(reviewerToken);
    expect(Object.values(reviewerEnvironment)).not.toContain(accountantToken);
    expect(Object.keys(accountantEnvironment).some((name) => name.startsWith("VITE_"))).toBe(false);

    for (const environment of [accountantEnvironment, reviewerEnvironment]) {
      const forbiddenNames = Object.keys(environment).filter(
        (name) =>
          /(TOKEN|SECRET|PASSWORD|CREDENTIAL|API_KEY)/i.test(name)
          && name !== "RITOMER_LOCAL_DEMO_BEARER_TOKEN"
      );
      expect(forbiddenNames).toEqual([]);
    }
  });

  it.each(["ACCOUNTANT", "REVIEWER"] as const)(
    "launches %s directly through Node with exact host, port and strict-port options",
    (actorName) => {
      const token = `${actorName.toLowerCase()}-token-sentinel`;
      const launch = buildViteLaunch(actorName, token, {}, {
        execPath: "C:\\node\\node.exe",
        platform: "win32"
      });

      expect(launch.command).toBe("C:\\node\\node.exe");
      expect(launch.args[0]).toMatch(/[\\/]node_modules[\\/]vite[\\/]bin[\\/]vite\.js$/);
      expect(launch.args.slice(1)).toEqual([
        "--host",
        "127.0.0.1",
        "--port",
        String(ACTORS[actorName].port),
        "--strictPort"
      ]);
      expect(launch.args).not.toContain("--open");
      expect(launch.args.join(" ")).not.toContain(token);
      expect(launch.options.shell).toBe(false);
      expect(launch.options.stdio).toEqual(["ignore", "pipe", "pipe"]);
      expect(launch.options.env.RITOMER_LOCAL_DEMO_BEARER_TOKEN).toBe(token);
    }
  );

  it("refuses any .env-prefixed name using directory metadata only", async () => {
    const safeReader = vi.fn(async () => [{ name: "package.json" }]);
    const blockedReader = vi.fn(async () => [{ name: ".env.local" }]);

    await expect(assertNoEnvironmentFiles(safeReader)).resolves.toBeUndefined();
    await expect(assertNoEnvironmentFiles(blockedReader)).rejects.toThrow(
      "ENVIRONMENT_FILE_PRESENT"
    );
    expect(blockedReader).toHaveBeenCalledWith(expect.any(String), { withFileTypes: true });
  });

  it("permits only the three fixed loopback origins", () => {
    expect(assertLoopbackUrl(BACKEND_HEALTH_URL).origin).toBe(BACKEND_ORIGIN);
    expect(assertLoopbackUrl("http://127.0.0.1:5173/api/me").port).toBe("5173");
    expect(assertLoopbackUrl("http://127.0.0.1:5174/").port).toBe("5174");
    expect(() => assertLoopbackUrl("http://localhost:5173/")).toThrow();
    expect(() => assertLoopbackUrl("https://example.invalid/")).toThrow();
    expect(() => assertLoopbackUrl("http://127.0.0.1:9999/")).toThrow();
  });
});

describe("fail-closed logs", () => {
  it("redacts exact tokens, the exact secret, Authorization and JWT-like values", () => {
    const jwtLike = ["headerPart", "payloadPart", "signaturePart"].join(".");
    const jti = "11111111-2222-4333-8444-555555555555";
    const result = redactSensitiveText(
      `Authorization: Basic opaque-basic-value\nAuthorization=opaque-value\n{"Authorization":"Basic opaque-json-value"}\naccountant-token reviewer-token ${HMAC_SECRET} ${jwtLike} ${jti} ${ACTORS.ACCOUNTANT.userId} ${ACTORS.ACCOUNTANT.email} ${ACTORS.ACCOUNTANT.displayName}`,
      {
        tokens: ["accountant-token", "reviewer-token"],
        secret: HMAC_SECRET,
        sensitiveValues: [
          jti,
          ACTORS.ACCOUNTANT.userId,
          ACTORS.ACCOUNTANT.email,
          ACTORS.ACCOUNTANT.displayName
        ]
      }
    );

    expect(result).toContain("[REDACTED_AUTHORIZATION]");
    expect(result).toContain("[REDACTED_TOKEN]");
    expect(result).toContain("[REDACTED_SECRET]");
    expect(result).toContain("[REDACTED_SENSITIVE]");
    expect(result).toContain("[REDACTED_JWT]");
    expect(result).not.toContain("accountant-token");
    expect(result).not.toContain("reviewer-token");
    expect(result).not.toContain(HMAC_SECRET);
    expect(result).not.toContain(jwtLike);
    expect(result).not.toContain("Authorization:");
    expect(result).not.toContain("Authorization=");
    expect(result).not.toContain("opaque-basic-value");
    expect(result).not.toContain("opaque-value");
    expect(result).not.toContain("opaque-json-value");
    expect(result).not.toContain(jti);
    expect(result).not.toContain(ACTORS.ACCOUNTANT.userId);
    expect(result).not.toContain(ACTORS.ACCOUNTANT.email);
    expect(result).not.toContain(ACTORS.ACCOUNTANT.displayName);
  });

  it("buffers split chunks, keeps stdout/stderr separate, prefixes every line and redacts both", async () => {
    const child = createFakeChild();
    const stdout: string[] = [];
    const stderr: string[] = [];
    const tokenA = "accountant-token-sentinel";
    const tokenB = "reviewer-token-sentinel";
    const jwtLike = ["sentinelHeader", "sentinelPayload", "sentinelSignature"].join(".");
    const stdoutAuthorization = "opaque-json-stdout-authorization";
    const stderrAuthorization = "opaque-json-stderr-authorization";
    const detach = attachRedactedChildOutput(
      child,
      "ACCOUNTANT",
      {
        tokens: [tokenA, tokenB],
        secret: HMAC_SECRET,
        sensitiveValues: [ACTORS.ACCOUNTANT.userId, ACTORS.ACCOUNTANT.email]
      },
      {
        writeStdout: (value) => stdout.push(value),
        writeStderr: (value) => stderr.push(value)
      }
    );

    child.stdout.write(`stdout ${tokenA.slice(0, 10)}`);
    child.stdout.write(`${tokenA.slice(10)} ${HMAC_SECRET} ${ACTORS.ACCOUNTANT.userId} {"Authorization":"Basic ${stdoutAuthorization}"}\n`);
    child.stderr.write(`stderr ${tokenB} ${jwtLike} ${ACTORS.ACCOUNTANT.email} {"authorization":"Bearer ${stderrAuthorization}"}\n`);
    child.stdout.end();
    child.stderr.end();
    await new Promise((resolvePromise) => setImmediate(resolvePromise));

    const stdoutText = stdout.join("");
    const stderrText = stderr.join("");
    expect(stdoutText).toMatch(/^\[ACCOUNTANT\] /);
    expect(stderrText).toMatch(/^\[ACCOUNTANT\] /);
    expect(stdoutText).toContain("[REDACTED_TOKEN]");
    expect(stdoutText).toContain("[REDACTED_SECRET]");
    expect(stderrText).toContain("[REDACTED_TOKEN]");
    expect(stderrText).toContain("[REDACTED_JWT]");
    expect(`${stdoutText}${stderrText}`).not.toContain(tokenA);
    expect(`${stdoutText}${stderrText}`).not.toContain(tokenB);
    expect(`${stdoutText}${stderrText}`).not.toContain(HMAC_SECRET);
    expect(`${stdoutText}${stderrText}`).not.toContain(stdoutAuthorization);
    expect(`${stdoutText}${stderrText}`).not.toContain(stderrAuthorization);
    expect(`${stdoutText}${stderrText}`).not.toContain(ACTORS.ACCOUNTANT.userId);
    expect(`${stdoutText}${stderrText}`).not.toContain(ACTORS.ACCOUNTANT.email);
    detach();
  });

  it("replaces a complete /api/me child error payload instead of forwarding its structure or values", async () => {
    const child = createFakeChild();
    const stderr: string[] = [];
    const payload = expectedMePayload("ACCOUNTANT");
    const detach = attachRedactedChildOutput(
      child,
      "ACCOUNTANT",
      { tokens: [], secret: HMAC_SECRET, sensitiveValues: [] },
      { writeStderr: (value) => stderr.push(value) }
    );

    child.stderr.write(`${JSON.stringify(payload)}\n`);
    child.stderr.end();
    await new Promise((resolvePromise) => setImmediate(resolvePromise));

    expect(stderr.join("")).toBe("[ACCOUNTANT] [REDACTED_SENSITIVE_PAYLOAD]\n");
    expect(stderr.join("")).not.toContain(JSON.stringify(payload));
    expectReadinessOutputToBeSanitized(stderr.join(""));
    detach();
  });
});

describe("sanitized /api/me readiness diagnostics", () => {
  it("A. classifies a refused connection as CONNECTION without printing sensitive material", async () => {
    await expectReadinessFailure(
      { kind: "CONNECTION" },
      "CONNECTION",
      "NONE"
    );
  });

  it("B. classifies an aborted readiness request as TIMEOUT", async () => {
    await expectReadinessFailure(
      { kind: "TIMEOUT" },
      "TIMEOUT",
      "NONE"
    );
  });

  it("C. classifies HTTP 401 as HTTP_STATUS and keeps only the numeric status", async () => {
    await expectReadinessFailure(
      { kind: "HTTP_401" },
      "HTTP_STATUS",
      "401"
    );
  });

  it("D. classifies HTTP 500 as HTTP_STATUS and keeps only the numeric status", async () => {
    await expectReadinessFailure(
      { kind: "HTTP_500" },
      "HTTP_STATUS",
      "500"
    );
  });

  it("E. classifies an invalid JSON body as INVALID_JSON", async () => {
    await expectReadinessFailure(
      { kind: "INVALID_JSON" },
      "INVALID_JSON",
      "200"
    );
  });

  it("F. classifies a wrong externalSubject as IDENTITY_MISMATCH", async () => {
    await expectReadinessFailure(
      { kind: "IDENTITY_MISMATCH" },
      "IDENTITY_MISMATCH",
      "200",
      "actor"
    );
  });

  it("G. classifies a wrong active tenant as TENANT_MISMATCH", async () => {
    await expectReadinessFailure(
      { kind: "TENANT_MISMATCH" },
      "TENANT_MISMATCH",
      "200",
      "activeTenant"
    );
  });

  it("H. classifies a wrong effective role as ROLE_MISMATCH", async () => {
    await expectReadinessFailure(
      { kind: "ROLE_MISMATCH" },
      "ROLE_MISMATCH",
      "200",
      "effectiveRoles"
    );
  });

  it("I. classifies both wrong membership count and content as MEMBERSHIP_MISMATCH", async () => {
    await expectReadinessFailure(
      { kind: "MEMBERSHIP_COUNT_MISMATCH" },
      "MEMBERSHIP_MISMATCH",
      "200",
      "memberships"
    );
    await expectReadinessFailure(
      { kind: "MEMBERSHIP_CONTENT_MISMATCH" },
      "MEMBERSHIP_MISMATCH",
      "200",
      "memberships"
    );
  });

  it.each([
    ["J", "ACCOUNTANT"],
    ["K", "REVIEWER"]
  ] as const)(
    "%s. %s exact backend-contract payload is accepted as readiness PASS",
    (_matrixCase, actorName) => {
      const payload = BACKEND_CONTRACT_ME_PAYLOADS[actorName];

      expect(expectedMePayload(actorName)).toEqual(payload);
      expect(classifyMePayload(actorName, payload)).toBeUndefined();
      expect(() => assertExpectedMe(actorName, payload)).not.toThrow();
    }
  );

  it("M. builds diagnostics only from closed enums and numbers", () => {
    const diagnostic = formatReadinessDiagnostic("ACCOUNTANT", {
      category: `CONNECTION ${SENSITIVE_ERROR_SENTINEL}`,
      attempts: `1 ${SENSITIVE_ERROR_SENTINEL}`,
      lastHttpStatus: `401 ${SENSITIVE_ERROR_SENTINEL}`,
      invalidField: `actor ${SENSITIVE_ERROR_SENTINEL}`
    });

    expect(diagnostic).toBe(
      "HARNESS_READINESS_FAILED actor=ACCOUNTANT phase=API_ME category=UNKNOWN attempts=0 lastHttpStatus=NONE"
    );
    expectReadinessOutputToBeSanitized(diagnostic);
  });

  it("N. preserves the production retry count, interval, and per-request timeout", async () => {
    expect(READINESS_POLICY).toEqual({
      attempts: 100,
      intervalMilliseconds: 100,
      requestTimeoutMilliseconds: 2_000
    });
    expect(READINESS_POLICY.attempts).toBeGreaterThanOrEqual(100);
    expect(READINESS_POLICY.requestTimeoutMilliseconds).toBeGreaterThanOrEqual(2_000);

    const fixture = createRuntimeFixture({
      readinessFailure: { kind: "CONNECTION" },
      readinessPolicy: {
        ...READINESS_POLICY,
        intervalMilliseconds: 0
      }
    });
    const runtime = createHarnessRuntime(fixture.runtimeOptions);

    await expect(runtime.run()).rejects.toMatchObject({ code: "ACCOUNTANT_READINESS_FAILED" });
    const meRequests = fixture.fetchFunction.mock.calls.filter(([url]) =>
      String(url).endsWith("/api/me")
    );
    expect(meRequests).toHaveLength(READINESS_POLICY.attempts);
    expect(fixture.stderr.join(""))
      .toContain(`attempts=${READINESS_POLICY.attempts} lastHttpStatus=NONE`);
  });
});

describe("production startup readiness retry policy", () => {
  it("uses one transient classifier for startup and monitor categories", () => {
    expect(isTransientReadinessFailure({ category: "CONNECTION" })).toBe(true);
    expect(isTransientReadinessFailure({ category: "TIMEOUT" })).toBe(true);
    expect(isTransientReadinessFailure({ category: "HTTP_STATUS", lastHttpStatus: 500 })).toBe(true);
    expect(isTransientReadinessFailure({ category: "HTTP_STATUS", lastHttpStatus: 599 })).toBe(true);
    expect(isTransientReadinessFailure({ category: "HTTP_STATUS", lastHttpStatus: 302 })).toBe(false);
    expect(isTransientReadinessFailure({ category: "HTTP_STATUS", lastHttpStatus: 401 })).toBe(false);
    expect(isTransientReadinessFailure({ category: "INVALID_JSON" })).toBe(false);
    expect(isTransientReadinessFailure({ category: "UNKNOWN" })).toBe(false);
  });

  it.each([
    ["HTTP_401", "401"],
    ["HTTP_403", "403"],
    ["HTTP_422", "422"],
    ["HTTP_302", "302"]
  ] as const)("fails fast on %s after exactly one request", async (kind, status) => {
    await expectProductionStartupFatal({ kind }, "HTTP_STATUS", status);
  });

  it("fails fast on invalid JSON after exactly one request", async () => {
    await expectProductionStartupFatal({ kind: "INVALID_JSON" }, "INVALID_JSON", "200");
  });

  it.each([
    ["IDENTITY_MISMATCH", "IDENTITY_MISMATCH", "actor"],
    ["TENANT_MISMATCH", "TENANT_MISMATCH", "activeTenant"],
    ["ROLE_MISMATCH", "ROLE_MISMATCH", "effectiveRoles"],
    ["MEMBERSHIP_COUNT_MISMATCH", "MEMBERSHIP_MISMATCH", "memberships"],
    ["MEMBERSHIP_CONTENT_MISMATCH", "MEMBERSHIP_MISMATCH", "memberships"]
  ] as const)(
    "fails fast on %s after exactly one request",
    async (kind, category, invalidField) => {
      await expectProductionStartupFatal({ kind }, category, "200", invalidField);
    }
  );

  it("fails fast on an unexpected internal readiness exception as UNKNOWN", async () => {
    await expectProductionStartupFatal({ kind: "UNKNOWN" }, "UNKNOWN", "NONE");
  });

  it("fails fast on CHILD_EXITED with the production attempt count still configured", async () => {
    expect(READINESS_POLICY.attempts).toBe(100);
    const fixture = createRuntimeFixture({
      closeOnSpawn: "ACCOUNTANT",
      readinessPolicy: fastProductionReadinessPolicy()
    });
    const runtime = createHarnessRuntime(fixture.runtimeOptions);

    await expect(runtime.run()).rejects.toMatchObject({ code: "ACCOUNTANT_READINESS_FAILED" });
    expect(actorMeRequestCount(fixture, "ACCOUNTANT")).toBe(1);
    expect(fixture.stderr.join(""))
      .toBe("HARNESS_READINESS_FAILED actor=ACCOUNTANT phase=API_ME category=CHILD_EXITED attempts=1 lastHttpStatus=NONE\n");
    expectReadinessOutputToBeSanitized(fixture.stderr.join(""));
  });

  it.each(["CONNECTION", "TIMEOUT", "HTTP_500"] as const)(
    "retries transient %s once and succeeds on the second request",
    async (kind) => {
      const fixture = createRuntimeFixture({
        startupOutcomes: { ACCOUNTANT: [{ kind }, { kind: "SUCCESS" }] },
        readinessPolicy: fastProductionReadinessPolicy()
      });
      const runtime = createHarnessRuntime(fixture.runtimeOptions);
      const runPromise = runtime.run();

      await runtime.ready;

      expect(actorMeRequestCount(fixture, "ACCOUNTANT")).toBe(2);
      expect(fixture.stdout.join("")).toBe("HARNESS_READY\n");
      expect(fixture.stderr.join("")).toBe("");
      const accountantRequests = actorMeRequests(fixture, "ACCOUNTANT");
      expect(accountantRequests.every(([, options]) => options.redirect === "manual")).toBe(true);

      await runtime.shutdown();
      await expect(runPromise).resolves.toEqual({ exitCode: 0 });
    }
  );

  it.each([
    ["CONNECTION", "CONNECTION", "NONE"],
    ["TIMEOUT", "TIMEOUT", "NONE"],
    ["HTTP_500", "HTTP_STATUS", "500"]
  ] as const)(
    "exhausts transient %s at exactly 100 requests",
    async (kind, category, status) => {
      expect(READINESS_POLICY.attempts).toBe(100);
      const fixture = createRuntimeFixture({
        readinessFailure: { kind },
        readinessPolicy: fastProductionReadinessPolicy()
      });
      const runtime = createHarnessRuntime(fixture.runtimeOptions);

      await expect(runtime.run()).rejects.toMatchObject({ code: "ACCOUNTANT_READINESS_FAILED" });

      expect(actorMeRequestCount(fixture, "ACCOUNTANT")).toBe(100);
      expect(fixture.stderr.join(""))
        .toBe(`HARNESS_READINESS_FAILED actor=ACCOUNTANT phase=API_ME category=${category} attempts=100 lastHttpStatus=${status}\n`);
      expectReadinessOutputToBeSanitized(fixture.stderr.join(""));
    }
  );
});

describe("all-or-nothing lifecycle", () => {
  it("L. validates ACCOUNTANT through /api/me before launching REVIEWER, then emits HARNESS_READY", async () => {
    const fixture = createRuntimeFixture();
    const runtime = createHarnessRuntime(fixture.runtimeOptions);
    const runPromise = runtime.run();

    await runtime.ready;

    expect(fixture.sequence.slice(0, 7)).toEqual([
      "fetch:health",
      "port:5173",
      "port:5174",
      "spawn:ACCOUNTANT",
      "fetch:me:ACCOUNTANT",
      "spawn:REVIEWER",
      "fetch:me:REVIEWER"
    ]);
    expect(fixture.stdout.join("")).toBe("HARNESS_READY\n");

    const meRequests = fixture.fetchFunction.mock.calls.filter(([url]) =>
      String(url).endsWith("/api/me")
    );
    expect(meRequests).toHaveLength(2);
    for (const [, options] of meRequests) {
      expect(options.headers).toEqual({ Accept: "application/json" });
      expect(options.headers).not.toHaveProperty("Authorization");
    }
    expect(fixture.fetchFunction.mock.calls.some(([url]) => new URL(String(url)).pathname === "/"))
      .toBe(false);

    await runtime.shutdown();
    await expect(runPromise).resolves.toEqual({ exitCode: 0 });
    expect(fixture.children.ACCOUNTANT.kill).toHaveBeenCalledWith("SIGTERM");
    expect(fixture.children.REVIEWER.kill).toHaveBeenCalledWith("SIGTERM");
  });

  it("fails globally on an occupied port without spawning either Vite", async () => {
    const fixture = createRuntimeFixture({ occupiedPorts: new Set([5173]) });
    const runtime = createHarnessRuntime(fixture.runtimeOptions);

    await expect(runtime.run()).rejects.toMatchObject({ code: "PORT_UNAVAILABLE" });
    expect(fixture.spawnFunction).not.toHaveBeenCalled();
    expect(fixture.stdout.join("")).not.toContain("HARNESS_READY");
  });

  it("leaves no orphan when the first Vite fails", async () => {
    const fixture = createRuntimeFixture({ closeOnSpawn: "ACCOUNTANT" });
    const runtime = createHarnessRuntime(fixture.runtimeOptions);

    await expect(runtime.run()).rejects.toMatchObject({ code: "ACCOUNTANT_READINESS_FAILED" });
    expect(fixture.stderr.join(""))
      .toBe("HARNESS_READINESS_FAILED actor=ACCOUNTANT phase=API_ME category=CHILD_EXITED attempts=1 lastHttpStatus=NONE\n");
    expect(fixture.spawnFunction).toHaveBeenCalledTimes(1);
    expect(fixture.children.ACCOUNTANT.exitCode).toBe(1);
    expect(fixture.stdout.join("")).not.toContain("HARNESS_READY");
  });

  it("registers, terminates, and awaits a spawned child when log piping cannot be attached", async () => {
    const fixture = createRuntimeFixture();
    fixture.children.ACCOUNTANT.stdout = null;
    const runtime = createHarnessRuntime(fixture.runtimeOptions);

    await expect(runtime.run()).rejects.toMatchObject({ code: "ACCOUNTANT_START_FAILED" });
    expect(fixture.spawnFunction).toHaveBeenCalledTimes(1);
    expect(fixture.children.ACCOUNTANT.kill).toHaveBeenCalledWith("SIGTERM");
    expect(fixture.children.ACCOUNTANT.exitCode).toBe(0);
    expect(fixture.spawnFunction).not.toHaveBeenCalledTimes(2);
  });

  it("stops the first Vite when the second Vite fails", async () => {
    const fixture = createRuntimeFixture({ closeOnSpawn: "REVIEWER" });
    const runtime = createHarnessRuntime(fixture.runtimeOptions);

    await expect(runtime.run()).rejects.toMatchObject({ code: "REVIEWER_READINESS_FAILED" });
    expect(fixture.stderr.join(""))
      .toBe("HARNESS_READINESS_FAILED actor=REVIEWER phase=API_ME category=CHILD_EXITED attempts=1 lastHttpStatus=NONE\n");
    expect(fixture.spawnFunction).toHaveBeenCalledTimes(2);
    expect(fixture.children.ACCOUNTANT.kill).toHaveBeenCalledWith("SIGTERM");
    expect(fixture.children.REVIEWER.exitCode).toBe(1);
  });

  it("stops the other actor when a Vite exits after readiness", async () => {
    const fixture = createRuntimeFixture();
    const runtime = createHarnessRuntime(fixture.runtimeOptions);
    const runPromise = runtime.run();
    await runtime.ready;

    closeFakeChild(fixture.children.ACCOUNTANT, 1);

    await expect(runPromise).rejects.toMatchObject({ code: "ACCOUNTANT_PROCESS_EXITED" });
    expect(fixture.children.REVIEWER.kill).toHaveBeenCalledWith("SIGTERM");
  });

  it("fails before readiness and stops both actors on an unexpected /api/me payload", async () => {
    const fixture = createRuntimeFixture({ wrongInitialMe: "REVIEWER" });
    const runtime = createHarnessRuntime(fixture.runtimeOptions);

    await expect(runtime.run()).rejects.toMatchObject({ code: "REVIEWER_READINESS_FAILED" });
    expect(fixture.stderr.join(""))
      .toBe("HARNESS_READINESS_FAILED actor=REVIEWER phase=API_ME category=ROLE_MISMATCH attempts=1 lastHttpStatus=200 invalidField=effectiveRoles\n");
    expect(fixture.children.ACCOUNTANT.kill).toHaveBeenCalledWith("SIGTERM");
    expect(fixture.children.REVIEWER.kill).toHaveBeenCalledWith("SIGTERM");
    expect(fixture.stdout.join("")).not.toContain("HARNESS_READY");
  });

  it("monitors both /api/me identities after readiness and stops on a 401 or mismatch", async () => {
    const fixture = createRuntimeFixture();
    const runtime = createHarnessRuntime(fixture.runtimeOptions);
    const runPromise = runtime.run();
    await runtime.ready;

    fixture.meStatuses.REVIEWER = 401;
    await fixture.runIdentityMonitor();

    await expect(runPromise).rejects.toMatchObject({ code: "REVIEWER_ME_REQUEST_FAILED" });
    expect(fixture.children.ACCOUNTANT.kill).toHaveBeenCalledWith("SIGTERM");
    expect(fixture.children.REVIEWER.kill).toHaveBeenCalledWith("SIGTERM");
  });

  it("A. keeps both Vite processes alive after one post-readiness ACCOUNTANT connection failure and a success", async () => {
    const fixture = createRuntimeFixture({
      monitorOutcomes: {
        ACCOUNTANT: [{ kind: "CONNECTION" }, { kind: "SUCCESS" }]
      }
    });
    const runtime = createHarnessRuntime(fixture.runtimeOptions);
    const runPromise = runtime.run();
    await runtime.ready;

    await fixture.runIdentityMonitor();
    expect(fixture.stderr.join("")).toContain(
      "HARNESS_MONITOR_DEGRADED actor=ACCOUNTANT category=CONNECTION consecutiveFailures=1 threshold=3\n"
    );
    expect(fixture.children.ACCOUNTANT.kill).not.toHaveBeenCalled();
    expect(fixture.children.REVIEWER.kill).not.toHaveBeenCalled();

    await fixture.runIdentityMonitor();
    expect(fixture.children.ACCOUNTANT.kill).not.toHaveBeenCalled();
    expect(fixture.children.REVIEWER.kill).not.toHaveBeenCalled();
    expect(fixture.stdout.join("")).toContain("HARNESS_READY\n");

    await runtime.shutdown();
    await expect(runPromise).resolves.toEqual({ exitCode: 0 });
    expect(fixture.children.ACCOUNTANT.kill).toHaveBeenCalledWith("SIGTERM");
    expect(fixture.children.REVIEWER.kill).toHaveBeenCalledWith("SIGTERM");
  });

  it("R. stops at JWT expiration without minting or refreshing another token", async () => {
    const fixture = createRuntimeFixture({ captureExpiration: true });
    const runtime = createHarnessRuntime(fixture.runtimeOptions);
    const runPromise = runtime.run();
    await runtime.ready;

    fixture.expireJwt();

    await expect(runPromise).rejects.toMatchObject({ code: "JWT_EXPIRED" });
    expect(fixture.randomBytesFunction).toHaveBeenCalledTimes(2);
    expect(fixture.children.ACCOUNTANT.kill).toHaveBeenCalledWith("SIGTERM");
    expect(fixture.children.REVIEWER.kill).toHaveBeenCalledWith("SIGTERM");
  });

  it.each(["SIGINT", "SIGTERM"] as const)(
    "coordinates child shutdown on %s",
    async (signal) => {
      const fixture = createRuntimeFixture();
      const runtime = createHarnessRuntime(fixture.runtimeOptions);
      const runPromise = runtime.run();
      await runtime.ready;

      fixture.processReference.emit(signal);

      await expect(runPromise).resolves.toEqual({ exitCode: 0 });
      expect(fixture.children.ACCOUNTANT.kill).toHaveBeenCalledWith("SIGTERM");
      expect(fixture.children.REVIEWER.kill).toHaveBeenCalledWith("SIGTERM");
    }
  );

  it("keeps signal guards active while a slow child is shutting down", async () => {
    const fixture = createRuntimeFixture();
    const runtime = createHarnessRuntime(fixture.runtimeOptions);
    const runPromise = runtime.run();
    await runtime.ready;

    fixture.children.ACCOUNTANT.kill = vi.fn(() => true);
    fixture.processReference.emit("SIGTERM");
    await new Promise((resolvePromise) => setImmediate(resolvePromise));

    expect(fixture.processReference.listenerCount("SIGTERM")).toBe(1);
    expect(fixture.processReference.emit("SIGTERM")).toBe(true);
    closeFakeChild(fixture.children.ACCOUNTANT, 0);

    await expect(runPromise).resolves.toEqual({ exitCode: 0 });
    expect(fixture.children.ACCOUNTANT.kill).toHaveBeenCalledTimes(1);
    expect(fixture.processReference.listenerCount("SIGTERM")).toBe(0);
  });

  it.each(["uncaughtException", "unhandledRejection"] as const)(
    "coordinates fail-closed child shutdown on %s without printing the error",
    async (eventName) => {
      const fixture = createRuntimeFixture();
      const runtime = createHarnessRuntime(fixture.runtimeOptions);
      const runPromise = runtime.run();
      await runtime.ready;

      fixture.processReference.emit(eventName, new Error("sensitive-error-sentinel"));

      await expect(runPromise).rejects.toMatchObject({ code: eventName === "uncaughtException"
        ? "UNCAUGHT_EXCEPTION"
        : "UNHANDLED_REJECTION" });
      expect(`${fixture.stdout.join("")}${fixture.stderr.join("")}`).not.toContain(
        "sensitive-error-sentinel"
      );
      expect(fixture.children.ACCOUNTANT.kill).toHaveBeenCalledWith("SIGTERM");
      expect(fixture.children.REVIEWER.kill).toHaveBeenCalledWith("SIGTERM");
    }
  );

  it("proves the port probe detects occupation and the same port is reusable after close", async () => {
    const server = createServer();
    await new Promise<void>((resolvePromise, rejectPromise) => {
      server.once("error", rejectPromise);
      server.listen({ host: "127.0.0.1", port: 0 }, resolvePromise);
    });
    const port = (server.address() as AddressInfo).port;

    await expect(assertPortAvailable(port)).rejects.toThrow("PORT_UNAVAILABLE");
    await new Promise<void>((resolvePromise, rejectPromise) => {
      server.close((error) => error === undefined ? resolvePromise() : rejectPromise(error));
    });
    await expect(assertPortAvailable(port)).resolves.toBeUndefined();
  });
});

describe("bounded post-readiness identity monitor", () => {
  it("B. tolerates two consecutive CONNECTION failures followed by success", async () => {
    expect(IDENTITY_MONITOR_TRANSIENT_FAILURE_THRESHOLD).toBe(3);
    expect(IDENTITY_MONITOR_INTERVAL_MILLISECONDS).toBe(1_000);
    const scenario = await startMonitorScenario({
      ACCOUNTANT: [
        { kind: "CONNECTION" },
        { kind: "CONNECTION" },
        { kind: "SUCCESS" }
      ]
    });

    await runMonitorCycles(scenario.fixture, 3);

    expect(scenario.fixture.stderr.join("")).toBe([
      "HARNESS_MONITOR_DEGRADED actor=ACCOUNTANT category=CONNECTION consecutiveFailures=1 threshold=3\n",
      "HARNESS_MONITOR_DEGRADED actor=ACCOUNTANT category=CONNECTION consecutiveFailures=2 threshold=3\n"
    ].join(""));
    await expectMonitorScenarioAlive(scenario);
  });

  it("C. stops both actors on the third consecutive CONNECTION failure", async () => {
    const fixture = await expectFatalMonitor(
      { ACCOUNTANT: Array.from({ length: 3 }, () => ({ kind: "CONNECTION" as const })) },
      3,
      "HARNESS_MONITOR_FAILED actor=ACCOUNTANT category=CONNECTION consecutiveFailures=3 threshold=3\n"
    );

    expectMonitorOutputToBeSanitized(fixture.stderr.join(""));
  });

  it("D. tolerates one TIMEOUT followed by success", async () => {
    const scenario = await startMonitorScenario({
      ACCOUNTANT: [{ kind: "TIMEOUT" }, { kind: "SUCCESS" }]
    });

    await runMonitorCycles(scenario.fixture, 2);

    expect(scenario.fixture.stderr.join(""))
      .toContain("HARNESS_MONITOR_DEGRADED actor=ACCOUNTANT category=TIMEOUT consecutiveFailures=1 threshold=3\n");
    await expectMonitorScenarioAlive(scenario);
  });

  it("E. stops globally on the third consecutive TIMEOUT", async () => {
    await expectFatalMonitor(
      { ACCOUNTANT: Array.from({ length: 3 }, () => ({ kind: "TIMEOUT" as const })) },
      3,
      "HARNESS_MONITOR_FAILED actor=ACCOUNTANT category=TIMEOUT consecutiveFailures=3 threshold=3\n"
    );
  });

  it("F. tolerates one HTTP 500 followed by success", async () => {
    const scenario = await startMonitorScenario({
      ACCOUNTANT: [{ kind: "HTTP_500" }, { kind: "SUCCESS" }]
    });

    await runMonitorCycles(scenario.fixture, 2);

    expect(scenario.fixture.stderr.join(""))
      .toContain("HARNESS_MONITOR_DEGRADED actor=ACCOUNTANT category=HTTP_STATUS consecutiveFailures=1 threshold=3 httpStatus=500\n");
    await expectMonitorScenarioAlive(scenario);
  });

  it("G. stops globally on the third consecutive HTTP 500", async () => {
    await expectFatalMonitor(
      { ACCOUNTANT: Array.from({ length: 3 }, () => ({ kind: "HTTP_500" as const })) },
      3,
      "HARNESS_MONITOR_FAILED actor=ACCOUNTANT category=HTTP_STATUS consecutiveFailures=3 threshold=3 httpStatus=500\n"
    );
  });

  it("H. stops immediately on HTTP 401", async () => {
    await expectFatalMonitor(
      { ACCOUNTANT: [{ kind: "HTTP_401" }] },
      1,
      "HARNESS_MONITOR_FAILED actor=ACCOUNTANT category=HTTP_STATUS consecutiveFailures=1 threshold=1 httpStatus=401\n"
    );
  });

  it("I. stops immediately on HTTP 403", async () => {
    await expectFatalMonitor(
      { ACCOUNTANT: [{ kind: "HTTP_403" }] },
      1,
      "HARNESS_MONITOR_FAILED actor=ACCOUNTANT category=HTTP_STATUS consecutiveFailures=1 threshold=1 httpStatus=403\n"
    );
  });

  it("I2. stops immediately on another HTTP 4xx", async () => {
    await expectFatalMonitor(
      { ACCOUNTANT: [{ kind: "HTTP_422" }] },
      1,
      "HARNESS_MONITOR_FAILED actor=ACCOUNTANT category=HTTP_STATUS consecutiveFailures=1 threshold=1 httpStatus=422\n"
    );
  });

  it("J. stops immediately on an actor identity mismatch", async () => {
    await expectFatalMonitor(
      { ACCOUNTANT: [{ kind: "IDENTITY_MISMATCH" }] },
      1,
      "HARNESS_MONITOR_FAILED actor=ACCOUNTANT category=IDENTITY_MISMATCH consecutiveFailures=1 threshold=1 invalidField=actor\n"
    );
  });

  it("K. stops immediately on a tenant mismatch", async () => {
    await expectFatalMonitor(
      { ACCOUNTANT: [{ kind: "TENANT_MISMATCH" }] },
      1,
      "HARNESS_MONITOR_FAILED actor=ACCOUNTANT category=TENANT_MISMATCH consecutiveFailures=1 threshold=1 invalidField=activeTenant\n"
    );
  });

  it("L. stops immediately on a role mismatch", async () => {
    await expectFatalMonitor(
      { ACCOUNTANT: [{ kind: "ROLE_MISMATCH" }] },
      1,
      "HARNESS_MONITOR_FAILED actor=ACCOUNTANT category=ROLE_MISMATCH consecutiveFailures=1 threshold=1 invalidField=effectiveRoles\n"
    );
  });

  it("M. stops immediately on membership count or content mismatch", async () => {
    for (const kind of [
      "MEMBERSHIP_COUNT_MISMATCH",
      "MEMBERSHIP_CONTENT_MISMATCH"
    ] as const) {
      await expectFatalMonitor(
        { ACCOUNTANT: [{ kind }] },
        1,
        "HARNESS_MONITOR_FAILED actor=ACCOUNTANT category=MEMBERSHIP_MISMATCH consecutiveFailures=1 threshold=1 invalidField=memberships\n"
      );
    }
  });

  it("N. stops immediately on invalid JSON returned with HTTP 200", async () => {
    await expectFatalMonitor(
      { ACCOUNTANT: [{ kind: "INVALID_JSON" }] },
      1,
      "HARNESS_MONITOR_FAILED actor=ACCOUNTANT category=INVALID_JSON consecutiveFailures=1 threshold=1\n"
    );
  });

  it("O. resets the consecutive failure counter after an exact success", async () => {
    const scenario = await startMonitorScenario({
      ACCOUNTANT: [
        { kind: "CONNECTION" },
        { kind: "CONNECTION" },
        { kind: "SUCCESS" },
        { kind: "CONNECTION" },
        { kind: "CONNECTION" }
      ]
    });

    await runMonitorCycles(scenario.fixture, 5);

    const counters = scenario.fixture.stderr
      .join("")
      .match(/consecutiveFailures=\d/g) ?? [];
    expect(counters).toEqual([
      "consecutiveFailures=1",
      "consecutiveFailures=2",
      "consecutiveFailures=1",
      "consecutiveFailures=2"
    ]);
    await expectMonitorScenarioAlive(scenario);
  });

  it("P. never schedules or starts a second probe while the current probe is unresolved", async () => {
    const scenario = await startMonitorScenario({
      ACCOUNTANT: [{ kind: "DEFERRED_SUCCESS" }]
    });

    const firstCycle = scenario.fixture.runIdentityMonitor();
    await new Promise((resolvePromise) => setImmediate(resolvePromise));

    expect(scenario.fixture.hasIdentityMonitorTimer()).toBe(false);
    expect(scenario.fixture.maximumMonitorProbesInFlight()).toBe(1);
    const accountantRequestsBeforeResolve = scenario.fixture.fetchFunction.mock.calls
      .filter(([url]) => String(url) === "http://127.0.0.1:5173/api/me");
    expect(accountantRequestsBeforeResolve).toHaveLength(2);

    scenario.fixture.resolveDeferredMonitor();
    await firstCycle;

    expect(scenario.fixture.maximumMonitorProbesInFlight()).toBe(1);
    expect(scenario.fixture.hasIdentityMonitorTimer()).toBe(true);
    await expectMonitorScenarioAlive(scenario);
  });

  it("Q. shutdown cancels both a pending monitor timer and an in-flight probe", async () => {
    const pendingScenario = await startMonitorScenario({});
    expect(pendingScenario.fixture.hasIdentityMonitorTimer()).toBe(true);

    await pendingScenario.runtime.shutdown();
    await expect(pendingScenario.runPromise).resolves.toEqual({ exitCode: 0 });
    expect(pendingScenario.fixture.hasIdentityMonitorTimer()).toBe(false);
    expect(pendingScenario.fixture.monitorTimerClearCount()).toBe(1);

    const inFlightScenario = await startMonitorScenario({
      ACCOUNTANT: [{ kind: "DEFERRED_SUCCESS" }]
    });
    const monitorCycle = inFlightScenario.fixture.runIdentityMonitor();
    await new Promise((resolvePromise) => setImmediate(resolvePromise));

    await inFlightScenario.runtime.shutdown();
    await expect(inFlightScenario.runPromise).resolves.toEqual({ exitCode: 0 });
    await expect(monitorCycle).resolves.toBeUndefined();
    expect(inFlightScenario.fixture.hasIdentityMonitorTimer()).toBe(false);
  });

  it("S. emits only closed, sanitized monitor diagnostic fields", async () => {
    const diagnostic = formatMonitorDiagnostic("ACCOUNTANT", SENSITIVE_ERROR_SENTINEL, {
      category: SENSITIVE_ERROR_SENTINEL,
      consecutiveFailures: SENSITIVE_ERROR_SENTINEL,
      threshold: SENSITIVE_ERROR_SENTINEL,
      lastHttpStatus: SENSITIVE_ERROR_SENTINEL,
      invalidField: SENSITIVE_ERROR_SENTINEL
    });

    expect(diagnostic).toBe(
      "HARNESS_MONITOR_FAILED actor=ACCOUNTANT category=UNKNOWN consecutiveFailures=1 threshold=1"
    );
    expectMonitorOutputToBeSanitized(diagnostic);

    const fixture = await expectFatalMonitor(
      { ACCOUNTANT: Array.from({ length: 3 }, () => ({ kind: "CONNECTION" as const })) },
      3,
      "HARNESS_MONITOR_FAILED actor=ACCOUNTANT category=CONNECTION consecutiveFailures=3 threshold=3\n"
    );
    expectMonitorOutputToBeSanitized(fixture.stderr.join(""));
  });

  it("T. keeps the nominal startup order and stable exact-identity monitor", async () => {
    const scenario = await startMonitorScenario({});

    expect(scenario.fixture.sequence.slice(0, 7)).toEqual([
      "fetch:health",
      "port:5173",
      "port:5174",
      "spawn:ACCOUNTANT",
      "fetch:me:ACCOUNTANT",
      "spawn:REVIEWER",
      "fetch:me:REVIEWER"
    ]);
    expect(scenario.fixture.stdout.join("")).toBe("HARNESS_READY\n");

    await runMonitorCycles(scenario.fixture, 2);

    expect(scenario.fixture.stderr).toEqual([]);
    for (const [url, options] of scenario.fixture.fetchFunction.mock.calls) {
      if (String(url).endsWith("/api/me")) {
        expect(options.headers).toEqual({ Accept: "application/json" });
        expect(options.headers).not.toHaveProperty("Authorization");
      }
    }
    await expectMonitorScenarioAlive(scenario);
  });
});

describe("source-level containment", () => {
  it("contains no filesystem write API, shell, inherited stdio, env spread, browser open, or non-loopback URL", () => {
    const source = readFileSync(harnessSourcePath, "utf8");

    expect(source).not.toMatch(/\b(writeFile|appendFile|createWriteStream|mkdir|mkdtemp|rename|copyFile|rm|unlink)\b/);
    expect(source).not.toContain("...process.env");
    expect(source).not.toMatch(/stdio\s*:\s*["']inherit["']/);
    expect(source).not.toMatch(/shell\s*:\s*true/);
    expect(source).not.toContain('"--open"');

    const literalUrls = source.match(/https?:\/\/[^`"'\s]+/g) ?? [];
    expect(literalUrls).toContain(BACKEND_ORIGIN);
    expect(literalUrls.every((url) => url.startsWith("http://127.0.0.1:"))).toBe(true);
    expect(source).not.toContain("http://localhost");
    expect(source).not.toContain("http://0.0.0.0");
    expect(source).not.toContain("http://[::]");
  });

  it("validates the complete expected identity, tenant, membership, and singleton role", () => {
    for (const actorName of ["ACCOUNTANT", "REVIEWER"] as const) {
      const payload = expectedMePayload(actorName);
      expect(() => assertExpectedMe(actorName, payload)).not.toThrow();
      expect(() =>
        assertExpectedMe(actorName, { ...payload, unexpected: true })
      ).toThrow(`${actorName}_ME_IDENTITY_MISMATCH`);
      expect(() =>
        assertExpectedMe(actorName, { ...payload, effectiveRoles: [ACTORS[actorName].role, "ADMIN"] })
      ).toThrow(`${actorName}_ME_IDENTITY_MISMATCH`);
    }
  });
});

async function startMonitorScenario(
  monitorOutcomes: Partial<Record<ActorName, MonitorOutcome[]>>,
  fixtureOptions: Omit<RuntimeFixtureOptions, "monitorOutcomes"> = {}
) {
  const fixture = createRuntimeFixture({ ...fixtureOptions, monitorOutcomes });
  const runtime = createHarnessRuntime(fixture.runtimeOptions);
  const runPromise = runtime.run();
  await runtime.ready;
  return { fixture, runtime, runPromise };
}

async function runMonitorCycles(
  fixture: ReturnType<typeof createRuntimeFixture>,
  cycles: number
) {
  for (let cycle = 0; cycle < cycles; cycle += 1) {
    await fixture.runIdentityMonitor();
  }
}

async function expectMonitorScenarioAlive(
  scenario: Awaited<ReturnType<typeof startMonitorScenario>>
) {
  expect(scenario.fixture.children.ACCOUNTANT.kill).not.toHaveBeenCalled();
  expect(scenario.fixture.children.REVIEWER.kill).not.toHaveBeenCalled();
  await scenario.runtime.shutdown();
  await expect(scenario.runPromise).resolves.toEqual({ exitCode: 0 });
}

async function expectFatalMonitor(
  monitorOutcomes: Partial<Record<ActorName, MonitorOutcome[]>>,
  cycles: number,
  expectedFinalDiagnostic: string
) {
  const scenario = await startMonitorScenario(monitorOutcomes);

  await runMonitorCycles(scenario.fixture, cycles);

  await expect(scenario.runPromise).rejects.toMatchObject({
    code: "ACCOUNTANT_ME_REQUEST_FAILED"
  });
  expect(scenario.fixture.stderr.join("")).toContain(expectedFinalDiagnostic);
  expect(scenario.fixture.children.ACCOUNTANT.kill).toHaveBeenCalledWith("SIGTERM");
  expect(scenario.fixture.children.REVIEWER.kill).toHaveBeenCalledWith("SIGTERM");
  expectMonitorOutputToBeSanitized(scenario.fixture.stderr.join(""));
  return scenario.fixture;
}

function decodeJwt(token: string) {
  const [encodedHeader, encodedPayload, signature] = token.split(".");
  return {
    header: JSON.parse(Buffer.from(encodedHeader, "base64url").toString("utf8")) as Record<string, string>,
    payload: JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as {
      sub: string;
      iat: number;
      exp: number;
      jti: string;
    },
    unsignedToken: `${encodedHeader}.${encodedPayload}`,
    signature
  };
}

function expectedSignature(unsignedToken: string, secret: string) {
  return createHmac("sha256", Buffer.from(secret, "utf8"))
    .update(unsignedToken, "ascii")
    .digest("base64url");
}

function createFakeChild(): FakeChild {
  const child = new EventEmitter() as FakeChild;
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  child.exitCode = null;
  child.signalCode = null;
  child.kill = vi.fn(() => {
    if (child.exitCode === null) closeFakeChild(child, 0);
    return true;
  });
  return child;
}

function closeFakeChild(child: FakeChild, exitCode: number) {
  if (child.exitCode !== null) return;
  child.exitCode = exitCode;
  child.stdout?.end();
  child.stderr?.end();
  child.emit("close", exitCode, null);
}

function createFakeServerFactory(sequence: string[], occupiedPorts: Set<number>) {
  return () => {
    const server = new EventEmitter() as EventEmitter & {
      listen: (options: { port: number }, callback: () => void) => void;
      close: (callback: (error?: Error) => void) => void;
    };
    server.listen = (options, callback) => {
      sequence.push(`port:${options.port}`);
      if (occupiedPorts.has(options.port)) {
        queueMicrotask(() => server.emit("error", new Error("occupied")));
      } else {
        queueMicrotask(callback);
      }
    };
    server.close = (callback) => queueMicrotask(() => callback());
    return server;
  };
}

function jsonResponse(status: number, payload: unknown) {
  return {
    status,
    json: async () => payload
  } as Response;
}

function actorFromPort(port: string): ActorName {
  return port === "5173" ? "ACCOUNTANT" : "REVIEWER";
}

function wrongMePayload(actorName: ActorName) {
  const expected = BACKEND_CONTRACT_ME_PAYLOADS[actorName];
  return { ...expected, effectiveRoles: ["ADMIN"] };
}

function readinessFailurePayload(actorName: ActorName, kind: ReadinessFailure["kind"]) {
  const expected = BACKEND_CONTRACT_ME_PAYLOADS[actorName];

  switch (kind) {
    case "IDENTITY_MISMATCH":
      return {
        ...expected,
        actor: { ...expected.actor, externalSubject: "sensitive-wrong-external-subject" }
      };
    case "TENANT_MISMATCH":
      return {
        ...expected,
        activeTenant: { ...expected.activeTenant, tenantId: "sensitive-wrong-tenant-id" }
      };
    case "ROLE_MISMATCH":
      return { ...expected, effectiveRoles: ["SENSITIVE_WRONG_ROLE"] };
    case "MEMBERSHIP_COUNT_MISMATCH":
      return { ...expected, memberships: [] };
    case "MEMBERSHIP_CONTENT_MISMATCH":
      return {
        ...expected,
        memberships: [{ ...expected.memberships[0], roles: ["SENSITIVE_WRONG_ROLE"] }]
      };
    default:
      return expected;
  }
}

function readinessFailureResponse(
  actorName: ActorName,
  failure: ReadinessFailure,
  requestOptions: RequestInit | undefined
): Promise<Response> | Response {
  switch (failure.kind) {
    case "CONNECTION":
      throw Object.assign(new TypeError(SENSITIVE_ERROR_SENTINEL), {
        cause: { code: "ECONNREFUSED" }
      });
    case "TIMEOUT":
      return new Promise((_resolvePromise, rejectPromise) => {
        const abort = () => {
          const error = new Error(SENSITIVE_ERROR_SENTINEL);
          error.name = "AbortError";
          rejectPromise(error);
        };
        if (requestOptions?.signal?.aborted === true) {
          abort();
        } else {
          requestOptions?.signal?.addEventListener("abort", abort, { once: true });
        }
      });
    case "HTTP_401":
      return jsonResponse(401, { sensitive: SENSITIVE_ERROR_SENTINEL });
    case "HTTP_403":
      return jsonResponse(403, { sensitive: SENSITIVE_ERROR_SENTINEL });
    case "HTTP_422":
      return jsonResponse(422, { sensitive: SENSITIVE_ERROR_SENTINEL });
    case "HTTP_302":
      return jsonResponse(302, { sensitive: SENSITIVE_ERROR_SENTINEL });
    case "HTTP_500":
      return jsonResponse(500, { sensitive: SENSITIVE_ERROR_SENTINEL });
    case "INVALID_JSON":
      return {
        status: 200,
        json: async () => {
          throw new Error(SENSITIVE_ERROR_SENTINEL);
        }
      } as Response;
    case "UNKNOWN":
      return Object.defineProperty({}, "status", {
        get: () => {
          throw new Error(SENSITIVE_ERROR_SENTINEL);
        }
      }) as Response;
    default:
      return jsonResponse(200, readinessFailurePayload(actorName, failure.kind));
  }
}

async function expectReadinessFailure(
  failure: ReadinessFailure,
  expectedCategory: string,
  expectedStatus: string,
  expectedInvalidField?: string
) {
  const actorName = failure.actor ?? "ACCOUNTANT";
  const fixture = createRuntimeFixture({ readinessFailure: failure });
  const runtime = createHarnessRuntime(fixture.runtimeOptions);
  const error = await runtime.run().then(
    () => undefined,
    (caughtError: unknown) => caughtError
  );
  const invalidField = expectedInvalidField === undefined
    ? ""
    : ` invalidField=${expectedInvalidField}`;
  const expectedDiagnostic = `HARNESS_READINESS_FAILED actor=${actorName} phase=API_ME category=${expectedCategory} attempts=1 lastHttpStatus=${expectedStatus}${invalidField}\n`;

  expect(error).toMatchObject({ code: `${actorName}_READINESS_FAILED` });
  expect(fixture.stderr.join("")).toBe(expectedDiagnostic);
  expect(fixture.stdout.join("")).not.toContain("HARNESS_READY");
  expect(fixture.spawnFunction).toHaveBeenCalledTimes(actorName === "ACCOUNTANT" ? 1 : 2);
  expectReadinessOutputToBeSanitized(fixture.stderr.join(""));
}

function expectReadinessOutputToBeSanitized(output: string) {
  const expected = expectedMePayload("ACCOUNTANT");
  const forbiddenValues = [
    SENSITIVE_ERROR_SENTINEL,
    HMAC_SECRET,
    "Authorization",
    "Bearer",
    "sensitiveHeader",
    "sensitivePayload",
    "sensitiveSignature",
    ACTORS.ACCOUNTANT.subject,
    ACTORS.ACCOUNTANT.userId,
    ACTORS.ACCOUNTANT.email,
    ACTORS.ACCOUNTANT.displayName,
    expected.activeTenant.tenantId,
    expected.activeTenant.tenantSlug,
    expected.activeTenant.tenantName,
    JSON.stringify(expected)
  ];

  for (const forbiddenValue of forbiddenValues) {
    expect(output).not.toContain(forbiddenValue);
  }
  expect(output).not.toMatch(/[A-Za-z0-9_-]{2,}\.[A-Za-z0-9_-]{2,}\.[A-Za-z0-9_-]{2,}/);
}

function fastProductionReadinessPolicy() {
  expect(READINESS_POLICY.attempts).toBe(100);
  return {
    ...READINESS_POLICY,
    intervalMilliseconds: 0,
    requestTimeoutMilliseconds: 1
  };
}

function actorMeRequests(
  fixture: ReturnType<typeof createRuntimeFixture>,
  actorName: ActorName
) {
  const port = ACTORS[actorName].port;
  return fixture.fetchFunction.mock.calls.filter(([url]) =>
    String(url) === `http://127.0.0.1:${port}/api/me`
  );
}

function actorMeRequestCount(
  fixture: ReturnType<typeof createRuntimeFixture>,
  actorName: ActorName
) {
  return actorMeRequests(fixture, actorName).length;
}

async function expectProductionStartupFatal(
  readinessFailure: ReadinessFailure,
  expectedCategory: string,
  expectedStatus: string,
  expectedInvalidField?: string
) {
  const fixture = createRuntimeFixture({
    readinessFailure,
    readinessPolicy: fastProductionReadinessPolicy()
  });
  const runtime = createHarnessRuntime(fixture.runtimeOptions);

  await expect(runtime.run()).rejects.toMatchObject({ code: "ACCOUNTANT_READINESS_FAILED" });

  const invalidField = expectedInvalidField === undefined
    ? ""
    : ` invalidField=${expectedInvalidField}`;
  expect(actorMeRequestCount(fixture, "ACCOUNTANT")).toBe(1);
  expect(fixture.stderr.join(""))
    .toBe(`HARNESS_READINESS_FAILED actor=ACCOUNTANT phase=API_ME category=${expectedCategory} attempts=1 lastHttpStatus=${expectedStatus}${invalidField}\n`);
  expect(fixture.stdout.join("")).not.toContain("HARNESS_READY");
  expect(actorMeRequests(fixture, "ACCOUNTANT")[0]?.[1]?.redirect).toBe("manual");
  expectReadinessOutputToBeSanitized(fixture.stderr.join(""));
}

function expectMonitorOutputToBeSanitized(output: string) {
  expectReadinessOutputToBeSanitized(output);
}

function createRuntimeFixture(options: RuntimeFixtureOptions = {}) {
  const sequence: string[] = [];
  const stdout: string[] = [];
  const stderr: string[] = [];
  const processReference = new EventEmitter();
  const children = {
    ACCOUNTANT: createFakeChild(),
    REVIEWER: createFakeChild()
  };
  const mePayloads: Record<ActorName, unknown> = {
    ACCOUNTANT: options.wrongInitialMe === "ACCOUNTANT"
      ? wrongMePayload("ACCOUNTANT")
      : BACKEND_CONTRACT_ME_PAYLOADS.ACCOUNTANT,
    REVIEWER: options.wrongInitialMe === "REVIEWER"
      ? wrongMePayload("REVIEWER")
      : BACKEND_CONTRACT_ME_PAYLOADS.REVIEWER
  };
  const meStatuses: Record<ActorName, number> = { ACCOUNTANT: 200, REVIEWER: 200 };
  const startupOutcomes: Partial<Record<ActorName, StartupOutcome[]>> = {
    ACCOUNTANT: [...(options.startupOutcomes?.ACCOUNTANT ?? [])],
    REVIEWER: [...(options.startupOutcomes?.REVIEWER ?? [])]
  };
  const monitorOutcomes: Partial<Record<ActorName, MonitorOutcome[]>> = {
    ACCOUNTANT: [...(options.monitorOutcomes?.ACCOUNTANT ?? [])],
    REVIEWER: [...(options.monitorOutcomes?.REVIEWER ?? [])]
  };
  const meRequestCounts: Record<ActorName, number> = { ACCOUNTANT: 0, REVIEWER: 0 };
  let monitorCallback: (() => Promise<void>) | undefined;
  let monitorTimerHandle: { kind: "monitor"; id: number } | undefined;
  let monitorTimerId = 0;
  let monitorTimerClearCount = 0;
  let deferredMonitorResolve: (() => void) | undefined;
  let monitorProbesInFlight = 0;
  let maximumMonitorProbesInFlight = 0;
  let expirationCallback: (() => void) | undefined;
  let randomCounter = 0;

  const randomBytesFunction = vi.fn(() => {
    randomCounter += 1;
    return Buffer.alloc(32, randomCounter);
  });
  const spawnFunction = vi.fn((_command: string, args: string[]) => {
    const portIndex = args.indexOf("--port");
    const actorName = actorFromPort(args[portIndex + 1]);
    sequence.push(`spawn:${actorName}`);
    const child = children[actorName];
    if (options.closeOnSpawn === actorName) {
      queueMicrotask(() => closeFakeChild(child, 1));
    }
    return child;
  });
  const fetchFunction = vi.fn(async (input: unknown, requestOptions?: RequestInit) => {
    const url = String(input);
    if (url === BACKEND_HEALTH_URL) {
      sequence.push("fetch:health");
      return jsonResponse(200, { status: "UP" });
    }

    const parsed = new URL(url);
    const actorName = actorFromPort(parsed.port);
    if (parsed.pathname === "/api/me") {
      sequence.push(`fetch:me:${actorName}`);
      meRequestCounts[actorName] += 1;
      const startupOutcome = startupOutcomes[actorName]?.shift();
      if (startupOutcome !== undefined && startupOutcome.kind !== "SUCCESS") {
        return await readinessFailureResponse(actorName, startupOutcome, requestOptions);
      }
      const readinessFailure = options.readinessFailure;
      if ((readinessFailure?.actor ?? "ACCOUNTANT") === actorName && readinessFailure !== undefined) {
        return await readinessFailureResponse(actorName, readinessFailure, requestOptions);
      }
      const monitorOutcome = meRequestCounts[actorName] > 1
        ? monitorOutcomes[actorName]?.shift()
        : undefined;
      if (meRequestCounts[actorName] > 1) {
        monitorProbesInFlight += 1;
        maximumMonitorProbesInFlight = Math.max(
          maximumMonitorProbesInFlight,
          monitorProbesInFlight
        );
      }
      try {
        if (monitorOutcome?.kind === "DEFERRED_SUCCESS") {
          return await new Promise<Response>((resolvePromise, rejectPromise) => {
            const onAbort = () => {
              const error = new Error(SENSITIVE_ERROR_SENTINEL);
              error.name = "AbortError";
              rejectPromise(error);
            };
            requestOptions?.signal?.addEventListener("abort", onAbort, { once: true });
            deferredMonitorResolve = () => {
              requestOptions?.signal?.removeEventListener("abort", onAbort);
              resolvePromise(jsonResponse(200, mePayloads[actorName]));
            };
          });
        }
        if (monitorOutcome !== undefined && monitorOutcome.kind !== "SUCCESS") {
          return await readinessFailureResponse(actorName, monitorOutcome, requestOptions);
        }
        return jsonResponse(meStatuses[actorName], mePayloads[actorName]);
      } finally {
        if (meRequestCounts[actorName] > 1) {
          monitorProbesInFlight -= 1;
        }
      }
    }
    throw new Error("unexpected local URL");
  });

  const nativeSetTimeout = setTimeout;
  const nativeClearTimeout = clearTimeout;
  const setTimeoutFunction = (callback: () => void, milliseconds: number) => {
    if (options.captureExpiration && milliseconds >= 3_000_000) {
      expirationCallback = callback;
      return { kind: "expiration" };
    }
    if (milliseconds === IDENTITY_MONITOR_INTERVAL_MILLISECONDS) {
      monitorTimerId += 1;
      monitorTimerHandle = { kind: "monitor", id: monitorTimerId };
      monitorCallback = callback as () => Promise<void>;
      return monitorTimerHandle;
    }
    return nativeSetTimeout(callback, milliseconds);
  };
  const clearTimeoutFunction = (handle: unknown) => {
    if (typeof handle === "object" && handle !== null && "kind" in handle) {
      if (handle.kind === "monitor") {
        if (monitorTimerHandle === handle) {
          monitorTimerHandle = undefined;
          monitorCallback = undefined;
        }
        monitorTimerClearCount += 1;
      }
      return;
    }
    nativeClearTimeout(handle as ReturnType<typeof setTimeout>);
  };

  const runtimeOptions = {
    environment: { RITOMER_SECURITY_JWT_HMAC_SECRET: HMAC_SECRET },
    argv: [],
    dependencies: {
      spawnFunction,
      fetchFunction,
      readdirFunction: vi.fn(async () => []),
      createServerFunction: createFakeServerFactory(
        sequence,
        options.occupiedPorts ?? new Set<number>()
      ),
      randomBytesFunction,
      nowFunction: () => 1_700_000_000_000,
      setTimeoutFunction,
      clearTimeoutFunction,
      processReference,
      platform: "win32",
      execPath: "C:\\node\\node.exe",
      writeStdout: (value: string) => stdout.push(value),
      writeStderr: (value: string) => stderr.push(value),
      readinessPolicy: options.readinessPolicy ?? {
        attempts: 1,
        intervalMilliseconds: 0,
        requestTimeoutMilliseconds: 10
      }
    }
  };

  return {
    runtimeOptions,
    sequence,
    stdout,
    stderr,
    processReference,
    children,
    mePayloads,
    meStatuses,
    spawnFunction,
    fetchFunction,
    randomBytesFunction,
    runIdentityMonitor: async () => {
      if (monitorCallback === undefined) throw new Error("monitor not installed");
      const callback = monitorCallback;
      monitorCallback = undefined;
      monitorTimerHandle = undefined;
      await callback();
    },
    hasIdentityMonitorTimer: () => monitorCallback !== undefined,
    monitorTimerClearCount: () => monitorTimerClearCount,
    maximumMonitorProbesInFlight: () => maximumMonitorProbesInFlight,
    resolveDeferredMonitor: () => {
      if (deferredMonitorResolve === undefined) throw new Error("deferred monitor not started");
      const resolvePromise = deferredMonitorResolve;
      deferredMonitorResolve = undefined;
      resolvePromise();
    },
    expireJwt: () => {
      if (expirationCallback === undefined) throw new Error("expiration not installed");
      expirationCallback();
    }
  };
}
