// @vitest-environment node
import { Buffer } from "node:buffer";
import { EventEmitter } from "node:events";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { PassThrough } from "node:stream";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  BACKEND_HEALTH_URL, FRONTEND_ORIGIN, TENANT, INTEGRATION_TIMEOUT_MILLISECONDS, HarnessFailure,
  assertExpectedMe, assertLoopbackUrl, assertNoEnvironmentFiles, buildChildEnvironment, buildViteLaunch,
  createHarnessRuntime, createSessionJar, drainChildOutput, exerciseTwoJars, expectedMePayload, runCli,
  sessionCookieFromHeaders, validateHarnessInvocation
} from "./local-two-actor-harness.mjs";
const RUN = "1234567890abcdef1234567890abcdef";
const ENV = { RITOMER_DB_RAIL_CAMPAIGN: "D", RITOMER_DB_RAIL_RUN_ID: RUN,
  RITOMER_DB_RAIL_REVIEWED_OBJECT_SHA256: "a".repeat(64), RITOMER_DB_RAIL_RUNTIME_SHA256: "b".repeat(64) };
const FOLDER_ID = "11111111-1111-4111-8111-111111111111";
const cookie = (id: string) => `__Host-ritomer-session=${id}; Path=/; Secure; HttpOnly; SameSite=Lax`;
const deletedCookie = "__Host-ritomer-session=; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Secure; HttpOnly; SameSite=Lax";
const headers = (values: string[] = []) => ({ getSetCookie: () => values, get: (name: string) => name === "cache-control" ? "no-store" : null });
const response = (status: number, payload?: unknown, values: string[] = []) => ({ status, headers: headers(values), text: async () => payload === undefined ? "" : JSON.stringify(payload) });
type Session = { csrf: string; role?: string; touched: number };
type Request = { method: string; headers: Record<string, string>; body?: string; signal?: AbortSignal };

// Independent response fixtures follow me-context and session contracts plus the
// accepted synthetic seed. Never obtain an API response from the assertion helper.
const fixtureTenant = { tenantId: "036a0000-0000-4000-8000-000000000001", tenantSlug: "ritomer-demo-036a", tenantName: "Ritomer Demo Fiduciaire SA (synthetic)" };
const fixtureActors: Record<string, { userId: string; externalSubject: string; email: string; displayName: string }> = {
  ACCOUNTANT: { userId: "036a0000-0000-4000-8000-000000000002", externalSubject: "ritomer-demo-user-036a", email: "demo.accountant@example.invalid", displayName: "Demo Accountant 036a" },
  REVIEWER: { userId: "043b0000-0000-4000-8000-000000000002", externalSubject: "ritomer-demo-reviewer-043b", email: "demo.reviewer.043b@example.invalid", displayName: "Demo Reviewer 043b" },
  ADMIN: { userId: "046b0000-0000-4000-8000-000000000002", externalSubject: "ritomer-demo-admin-046b", email: "demo.admin.046b@example.invalid", displayName: "Demo Admin 046b" }
};
const fixtureRoleByActor: Record<string, string> = { "actor-01": "ACCOUNTANT", "actor-02": "REVIEWER", "actor-03": "ADMIN" };
type ApiFault = "none" | "create-http" | "create-no-response" | "create-http-cleanup-fails" | "logout-http" | "cleanup-http" | "cleanup-no-response";

function fakeApi(fault: ApiFault = "none") {
  let sequence = 0;
  let now = 0;
  const sessions = new Map<string, Session>();
  const calls: { path: string; options: Request }[] = [];
  let folder = { id: FOLDER_ID, tenantId: TENANT.tenantId, status: "DRAFT", externalRef: "" };
  const next = (role?: string): [string, Session] => {
    sequence += 1;
    const id = `synthetic-session-${String(sequence).padStart(4, "0")}`;
    const session = { csrf: `synthetic-csrf-${sequence}`, role, touched: now };
    sessions.set(id, session); return [id, session];
  };
  const fetch = vi.fn(async (url: string, options: Request) => {
    const path = new URL(url).pathname;
    calls.push({ path, options });
    if (url === BACKEND_HEALTH_URL) return response(200, { status: "UP" });
    if (path === "/") return response(200);
    expect(url.startsWith(FRONTEND_ORIGIN)).toBe(true);
    expect(options.headers.Authorization).toBeUndefined();
    expect(options.headers.Origin).toBe(FRONTEND_ORIGIN);
    const sid = options.headers.Cookie?.split("=")[1];
    let session = sessions.get(sid);
    if (session && now - session.touched >= 30 * 60 * 1000) {
      sessions.delete(sid); return response(401, { code: "SESSION_EXPIRED" }, [deletedCookie]);
    }
    if (session) session.touched = now;
    if (path === "/api/session/bootstrap") {
      let cookies: string[] = [];
      if (!session) { const [id, created] = next(); session = created; cookies = [cookie(id)]; }
      return response(200, { sessionState: session.role ? "AUTHENTICATED" : "ANONYMOUS", localLoginAvailable: true,
        csrf: { headerName: "X-CSRF-TOKEN", token: session.csrf },
        ...(session.role ? {} : { actors: Object.keys(fixtureRoleByActor).map(actorKey => ({ actorKey, displayLabel: "Synthetic actor" })) }) }, cookies);
    }
    if (!session) return response(401, { code: "AUTHENTICATION_REQUIRED" });
    if (options.method !== "GET" && options.headers["X-CSRF-TOKEN"] !== session.csrf) return response(403, { code: "CSRF_REJECTED" });
    if (path === "/api/session/local") {
      if (session.role) return response(409);
      const key = JSON.parse(options.body!).actorKey;
      const role = fixtureRoleByActor[key];
      if (!role) return response(401);
      sessions.delete(sid);
      const [id] = next(role); return response(204, undefined, [cookie(id)]);
    }
    if (!session.role) return response(401);
    if (path === "/api/session/logout") {
      if (fault === "create-http-cleanup-fails") throw new Error("synthetic-secret-marker logout");
      if (fault === "logout-http" || (fault === "cleanup-http" && session.role !== "ACCOUNTANT")) return response(503);
      if (fault === "cleanup-no-response" && session.role !== "ACCOUNTANT") throw new Error("synthetic-secret-marker cleanup transport");
      sessions.delete(sid); return response(204, undefined, [deletedCookie]);
    }
    if (path === "/api/me") return response(200, { actor: fixtureActors[session.role], memberships: [{ ...fixtureTenant, roles: [session.role] }], activeTenant: fixtureTenant, effectiveRoles: [session.role] });
    if (options.headers["X-Tenant-Id"] !== TENANT.tenantId) return response(403);
    if (path === "/api/closing-folders" && options.method === "POST") {
      if (fault === "create-no-response") throw new Error("synthetic-secret-marker transport");
      if (fault === "create-http" || fault === "create-http-cleanup-fails") return response(503, { message: "synthetic-secret-marker body" });
      return response(session.role === "ACCOUNTANT" ? 201 : 403, folder);
    }
    if (path === `/api/closing-folders/${FOLDER_ID}` && options.method === "GET") return response(200, folder);
    if (path === `/api/closing-folders/${FOLDER_ID}` && options.method === "PATCH") {
      if (session.role === "REVIEWER") return response(403);
      folder = { ...folder, ...JSON.parse(options.body!) }; return response(200, folder);
    }
    if (path === `/api/closing-folders/${FOLDER_ID}/archive`) {
      if (session.role !== "ADMIN") return response(403);
      folder = { ...folder, status: "ARCHIVED" }; return response(200, folder);
    }
    throw new Error("Unexpected fixture request");
  });
  return { fetch, calls, sessions, advance: (milliseconds: number) => { now += milliseconds; } };
}

function runtimeFixture({ occupied = false, neverClose = false, foreignPortAfterStop = false, fetchOverride, fault = "none" }: {
  occupied?: boolean; neverClose?: boolean; foreignPortAfterStop?: boolean; fetchOverride?: (...args: unknown[]) => unknown; fault?: ApiFault
} = {}) {
  const api = fakeApi(fault);
  const input = new PassThrough();
  const owner = new EventEmitter();
  const output: string[] = [];
  let portOccupied = occupied;
  const child = Object.assign(new EventEmitter(), { stdout: new PassThrough(), stderr: new PassThrough(), kill: vi.fn() });
  child.kill.mockImplementation(() => {
    if (!neverClose) queueMicrotask(() => { portOccupied = foreignPortAfterStop; child.stdout.end(); child.stderr.end(); child.emit("exit", 0); child.emit("close", 0); });
    return true;
  });
  const spawn = vi.fn(() => { portOccupied = true; return child; });
  const server = () => Object.assign(new EventEmitter(), {
    listen(_options: unknown, callback: () => void) {
      queueMicrotask(() => { if (portOccupied) this.emit("error", new Error("occupied")); else callback(); }); return this;
    },
    close(callback: () => void) { queueMicrotask(callback); return this; }
  });
  const options = { environment: ENV, argv: [], dependencies: {
    fetchFunction: fetchOverride ?? api.fetch, readdirFunction: async () => [], createServerFunction: server,
    spawnFunction: spawn, processReference: owner, input, writeStdout: (text: string) => output.push(text),
    execPath: "C:/synthetic/node.exe", platform: "win32"
  } };
  const runtime = createHarnessRuntime(options);
  return { runtime, options, api, input, owner, output, child, spawn,
    finish: () => input.write(`M1D_FINISH ${RUN}\n`), occupy: () => { portOccupied = true; } };
}
const syntheticRoots: string[] = [];
afterEach(() => {
  vi.useRealTimers();
  for (const root of syntheticRoots.splice(0)) {
    if (path.dirname(root) !== os.tmpdir() || !path.basename(root).startsWith("m1d-synthetic-harness-")) throw new Error("FIXTURE_ROOT");
    rmSync(root, { recursive: true, force: true });
  }
});

describe("closed harness invocation and process boundary", () => {
  it("requires exact D run/object/runtime bindings and no arguments", () => {
    expect(validateHarnessInvocation([], ENV)).toEqual({ runId: RUN, objectSha: "a".repeat(64), runtimeSha: "b".repeat(64) });
    for (const key of Object.keys(ENV)) {
      expect(() => validateHarnessInvocation([], { ...ENV, [key]: "" })).toThrow("HARNESS_D_BINDING_REQUIRED");
    }
    expect(() => validateHarnessInvocation(["--help"], ENV)).toThrow("HARNESS_ARGUMENTS_FORBIDDEN");
  });
  it.each(["RITOMER_SECURITY_JWT_HMAC_SECRET", "RITOMER_LOCAL_DEMO_BEARER_TOKEN", "RITOMER_LOCAL_DEMO_PROXY_AUTH_ENABLED", "RITOMER_DB_TEST_PASSWORD", "NODE_OPTIONS", "NODE_PATH", "HTTP_PROXY", "VITE_CUSTOM"])("refuses inherited %s by presence without echo", (key) => {
    expect(() => validateHarnessInvocation([], { ...ENV, [key]: "" })).toThrow("HARNESS_INHERITED_CONFIGURATION_REFUSED");
  });
  it("launches one direct Node Vite, isolated environment, no shell or detached tree", () => {
    const launch = buildViteLaunch({ PATH: "system-only", RITOMER_DB_TEST_PASSWORD: "synthetic", NODE_OPTIONS: "injection" }, { execPath: "node-exact", platform: "win32" });
    expect(launch.command).toBe("node-exact");
    expect(launch.args.slice(1)).toEqual(["--host", "127.0.0.1", "--port", "5173", "--strictPort", "--force"]);
    expect(launch.options).toMatchObject({ shell: false, detached: false, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    expect(launch.options.env).toEqual({ PATH: "system-only", RITOMER_LOCAL_DEMO_BACKEND_TARGET: "http://127.0.0.1:8080" });
    expect(() => buildChildEnvironment({ PATH: "first", Path: "second" }, "win32")).toThrow("AMBIGUOUS_SYSTEM_ENVIRONMENT");
  });
  it("refuses environment files by listing only and does not create filesystem artifacts", async () => {
    await expect(assertNoEnvironmentFiles(async () => [{ name: ".env.local" }])).rejects.toThrow("ENVIRONMENT_FILE_PRESENT");
    await expect(assertNoEnvironmentFiles(async () => ["package.json"])).resolves.toBeUndefined();
    const source = readFileSync(new URL("./local-two-actor-harness.mjs", import.meta.url), "utf8");
    expect(source).not.toMatch(/writeFile|appendFile|mkdir|createWriteStream|createHmac|IDENTITY_MONITOR|setInterval/);
    expect(source).not.toContain("5174");
  });
  it.each(["http://localhost:5173/api/me", "https://127.0.0.1:5173/api/me", "http://127.0.0.1:5174/api/me", "http://secret@127.0.0.1:5173/api/me", "http://127.0.0.1:5173/api/me#fragment"])("rejects noncontract origin %s", (url) => {
    expect(() => assertLoopbackUrl(url)).toThrow("NON_LOOPBACK_REQUEST_FORBIDDEN");
  });
});

describe("contract-only cookie handling", () => {
  it("uses getSetCookie, accepts the contract cookie and Spring deletion attributes", () => {
    expect(sessionCookieFromHeaders(headers([cookie("synthetic-session-0001")]))).toBe("__Host-ritomer-session=synthetic-session-0001");
    expect(sessionCookieFromHeaders(headers([deletedCookie]), "old-cookie")).toBeUndefined();
    expect(sessionCookieFromHeaders(headers(), "old-cookie")).toBe("old-cookie");
    expect(() => sessionCookieFromHeaders({ get: () => "joined cookies" })).toThrow("GET_SET_COOKIE_REQUIRED");
  });
  it.each([
    cookie("synthetic-session-0001") + "; Domain=127.0.0.1",
    cookie("synthetic-session-0001").replace("Secure; ", ""),
    cookie("synthetic-session-0001").replace("Path=/", "Path=/api"),
    cookie("synthetic-session-0001").replace("SameSite=Lax", "SameSite=None"),
    cookie("synthetic-session-0001") + "; Secure",
    cookie("synthetic-session-0001") + "\r\nInjected: secret",
    "other-cookie=synthetic; Path=/; Secure; HttpOnly; SameSite=Lax",
    cookie("synthetic-session-0001") + "; Max-Age=0"
  ])("rejects noncontract cookie without exposing it", (value) => {
    expect(() => sessionCookieFromHeaders(headers([value]))).toThrow("SESSION_COOKIE_CONTRACT_REJECTED");
  });
  it("rejects combined or duplicate cookies", () => {
    expect(() => sessionCookieFromHeaders(headers([cookie("synthetic-session-0001"), cookie("synthetic-session-0002")]))).toThrow("SESSION_COOKIE_CONTRACT_REJECTED");
  });
});

describe("two private session jars", () => {
  it("exercises rotations, four CSRF refusals, isolation, three roles and closing RBAC", async () => {
    const api = fakeApi();
    const a = createSessionJar({ fetchFunction: api.fetch }); const b = createSessionJar({ fetchFunction: api.fetch });
    await exerciseTwoJars(a, b, RUN);
    expect(api.sessions.size).toBe(2);
    expect([...api.sessions.values()].map((item) => item.role).sort()).toEqual(["ADMIN", "REVIEWER"]);
    expect(api.calls.filter((call) => call.path === "/api/session/local").map((call) => JSON.parse(call.options.body!).actorKey)).toEqual(["actor-01", "actor-02", "actor-03"]);
    const rejectedCsrf = api.calls.filter((call) => call.path === "/api/session/logout").slice(0, 4);
    expect(rejectedCsrf.map((call) => call.options.headers["X-CSRF-TOKEN"])).toEqual([undefined, "synthetic-invalid-csrf", "synthetic-csrf-1", "synthetic-csrf-4"]);
    await Promise.all([a.logout(), b.logout()]);
    expect(api.sessions.size).toBe(0); expect(a.hasCredentials()).toBe(false); expect(b.hasCredentials()).toBe(false);
  });
  it("purges expired credentials and never reconnects automatically", async () => {
    const api = fakeApi(); const jar = createSessionJar({ fetchFunction: api.fetch });
    await jar.login("ACCOUNTANT"); api.advance(30 * 60 * 1000);
    expect((await jar.request("/api/me")).status).toBe(401);
    expect(jar.hasCredentials()).toBe(false);
    expect(api.calls.filter((call) => call.path === "/api/session/local")).toHaveLength(1);
    await jar.login("ACCOUNTANT");
    expect(api.calls.filter((call) => call.path === "/api/session/local")).toHaveLength(2);
    await jar.logout();
  });
  it("requires explicit logout before changing identity", async () => {
    const api = fakeApi(); const jar = createSessionJar({ fetchFunction: api.fetch });
    await jar.login("ACCOUNTANT");
    await expect(jar.login("ADMIN")).rejects.toThrow("EXPLICIT_LOGOUT_REQUIRED");
    await jar.logout();
  });
  it.each(["actor", "memberships", "activeTenant", "effectiveRoles"])("rejects a mismatched full /me context at %s", (field) => {
    const payload = expectedMePayload("ACCOUNTANT");
    expect(() => assertExpectedMe("ACCOUNTANT", { ...payload, [field]: null })).toThrow("ME_CONTEXT_MISMATCH");
    expect(() => assertExpectedMe("ACCOUNTANT", { ...payload, extra: "unsafe" })).toThrow("ME_CONTEXT_MISMATCH");
  });
  it("pins ADMIN to the existing synthetic seed identity", () => {
    expect(expectedMePayload("ADMIN")).toEqual({ actor: { userId: "046b0000-0000-4000-8000-000000000002", externalSubject: "ritomer-demo-admin-046b", email: "demo.admin.046b@example.invalid", displayName: "Demo Admin 046b" }, memberships: [{ tenantId: "036a0000-0000-4000-8000-000000000001", tenantSlug: "ritomer-demo-036a", tenantName: "Ritomer Demo Fiduciaire SA (synthetic)", roles: ["ADMIN"] }], activeTenant: TENANT, effectiveRoles: ["ADMIN"] });
  });
  it.each(["headers", "body"])("bounds %s that ignores abort and never adopts a late response", async (phase) => {
    vi.useFakeTimers(); let resolveLate!: (value: unknown) => void;
    const late = new Promise((resolve) => { resolveLate = resolve; });
    const fetch = phase === "headers" ? async () => late : async () => ({ ...response(200), text: () => late });
    const jar = createSessionJar({ fetchFunction: fetch });
    const result = jar.request("/api/session/bootstrap").catch((error: Error) => error.message);
    await vi.advanceTimersByTimeAsync(2_001);
    expect(await result).toBe("REQUEST_TIMEOUT");
    resolveLate(phase === "headers" ? response(200, {}, [cookie("synthetic-session-0001")]) : "{}");
    await Promise.resolve(); expect(jar.hasCredentials()).toBe(false);
  });
  it("cancels active body reads and cannot restore cleared credentials", async () => {
    const cancel = new AbortController(); let resolveLate!: (value: string) => void;
    const late = new Promise<string>((resolve) => { resolveLate = resolve; });
    const jar = createSessionJar({ fetchFunction: async () => ({ ...response(200, {}, [cookie("synthetic-session-0001")]), text: () => late }) }, cancel.signal);
    const result = jar.request("/api/session/bootstrap").catch((error: Error) => error.message);
    await Promise.resolve(); cancel.abort(); jar.clear();
    expect(await result).toBe("OPERATION_CANCELLED"); resolveLate("{}"); await Promise.resolve();
    expect(jar.hasCredentials()).toBe(false);
  });
  it("rejects missing no-store, oversized bodies and redirects", async () => {
    const noStore = createSessionJar({ fetchFunction: async () => ({ ...response(200), headers: { ...headers(), get: () => null } }) });
    await expect(noStore.request("/api/me")).rejects.toThrow("NO_STORE_REQUIRED");
    const oversized = createSessionJar({ fetchFunction: async () => ({ ...response(200), text: async () => "x".repeat(65537) }) });
    await expect(oversized.request("/api/me")).rejects.toThrow("RESPONSE_TOO_LARGE");
    const redirect = createSessionJar({ fetchFunction: async () => response(302) });
    await expect(redirect.expect("/api/me", 200)).rejects.toThrow("HTTP_STATUS_MISMATCH");
  });
});

describe("owner-bound supervision and explicit completion", () => {
  it("starts one child, emits one bound result, remains idle, then verifies logout and stop", async () => {
    vi.useFakeTimers(); const fixture = runtimeFixture(); const run = fixture.runtime.run();
    await fixture.runtime.ready;
    expect(fixture.spawn).toHaveBeenCalledTimes(1);
    expect(fixture.output).toEqual([`M1D_JARS_RESULT ${RUN} ${"a".repeat(64)} ${"b".repeat(64)} PASS\n`]);
    const calls = fixture.api.calls.length;
    await vi.advanceTimersByTimeAsync(32 * 60 * 1000);
    fixture.api.advance(32 * 60 * 1000);
    expect(fixture.api.calls).toHaveLength(calls);
    fixture.finish(); expect(await run).toEqual({ exitCode: 0 });
    expect(fixture.output[1]).toBe(`M1D_HARNESS_STOPPED ${RUN} JARS=PASS VITE_STOP=PASS\n`);
    expect(fixture.api.sessions.size).toBe(0);
    expect(fixture.child.kill).toHaveBeenCalledWith("SIGTERM");
    expect(fixture.input.readableFlowing).toBe(false);
  });
  it.each(["wrong-run", "duplicate", "premature", "oversized", "EOF", "SIGINT", "SIGTERM", "child-zero"])("refuses %s as successful completion", async (kind) => {
    const f = runtimeFixture(); const outcome = f.runtime.run().catch((error: Error) => error.message);
    if (kind === "premature") f.finish();
    else {
      await f.runtime.ready;
      if (kind === "wrong-run") f.input.write(`M1D_FINISH ${"0".repeat(32)}\n`);
      if (kind === "duplicate") f.input.write(`M1D_FINISH ${RUN}\nM1D_FINISH ${RUN}\n`);
      if (kind === "oversized") f.input.write("x".repeat(129));
      if (kind === "EOF") f.input.end();
      if (kind === "SIGINT" || kind === "SIGTERM") f.owner.emit(kind);
      if (kind === "child-zero") f.child.emit("exit", 0);
    }
    expect(typeof await outcome).toBe("string");
    expect(f.output.join("")).not.toContain("M1D_HARNESS_STOPPED");
  });
  it("does not adopt or terminate an occupied port", async () => {
    const f = runtimeFixture({ occupied: true });
    await expect(f.runtime.run()).rejects.toThrow("PORT_UNAVAILABLE");
    expect(f.spawn).not.toHaveBeenCalled(); expect(f.child.kill).not.toHaveBeenCalled();
  });
  it("enforces the monotone integration deadline despite ongoing child output", async () => {
    vi.useFakeTimers(); const f = runtimeFixture(); const outcome = f.runtime.run().catch((error: Error) => error.message);
    await f.runtime.ready;
    f.child.stdout.write("ordinary output\n");
    await vi.advanceTimersByTimeAsync(INTEGRATION_TIMEOUT_MILLISECONDS + 1);
    expect(await outcome).toBe("INTEGRATION_TIMEOUT");
    expect(f.output.join("")).not.toContain("M1D_HARNESS_STOPPED");
  });
  it("requires the port to be free after owned process close without killing a replacement", async () => {
    const f = runtimeFixture({ foreignPortAfterStop: true });
    const outcome = f.runtime.run().catch((error: Error) => error.message);
    await f.runtime.ready; f.finish();
    expect(await outcome).toBe("PORT_UNAVAILABLE");
    expect(f.child.kill).toHaveBeenCalledTimes(1);
    expect(f.output.join("")).not.toContain("M1D_HARNESS_STOPPED");
  });
  it("a surviving Vite never produces a stop record", async () => {
    vi.useFakeTimers(); const f = runtimeFixture({ neverClose: true }); const outcome = f.runtime.run().catch((error: Error) => error.message);
    await f.runtime.ready; f.finish(); await vi.advanceTimersByTimeAsync(15_001);
    expect(await outcome).toBe("VITE_STOP_TIMEOUT");
    expect(f.child.kill).toHaveBeenCalledWith("SIGKILL");
    expect(f.output.join("")).not.toContain("M1D_HARNESS_STOPPED");
  });
  it("child result impersonation is rejected even across chunk boundaries", async () => {
    const f = runtimeFixture(); const outcome = f.runtime.run().catch((error: Error) => error.message);
    await f.runtime.ready; f.child.stdout.write("M1"); f.child.stdout.write("D_HARNESS_STOPPED fake PASS\n");
    expect(await outcome).toBe("CHILD_CONTROL_OUTPUT_REFUSED");
    expect(f.output.join("")).not.toContain("fake");
  });
  it("drains both streams concurrently with a cumulative limit and no secret output", () => {
    const child = { stdout: new PassThrough(), stderr: new PassThrough() }; const fail = vi.fn();
    const detach = drainChildOutput(child, fail);
    child.stdout.write("synthetic-cookie-secret\n"); child.stderr.write("synthetic-csrf-secret\n");
    child.stdout.write(Buffer.alloc(256 * 1024));
    expect(fail).toHaveBeenCalledWith("CHILD_OUTPUT_LIMIT");
    detach(); expect(child.stdout.listenerCount("data")).toBe(0); expect(child.stderr.listenerCount("data")).toBe(0);
  });
});

type HarnessFrame = { schemaVersion: number; runId: string; objectSha: string; runtimeSha: string;
  diagnostic: { code: string; step: string; expectedStatus: number | null; receivedStatus: number | null } };

function startCliFixture(f: ReturnType<typeof runtimeFixture>) {
  const errors: string[] = [];
  const exitCodes: number[] = [];
  const write = f.options.dependencies.writeStdout;
  f.options.dependencies.writeStdout = (text: string) => {
    const count = write(text);
    if (text.startsWith("M1D_JARS_RESULT ")) queueMicrotask(f.finish);
    return count;
  };
  // This is the CLI's actual emission path, driven by the real runtime and jars.
  // Only transport, child and port fixtures are synthetic; no native child starts.
  const completed = runCli(f.options, { writeStderr: (text: string) => errors.push(text), setExitCode: (code: number) => exitCodes.push(code) });
  return { ...f, errors, exitCodes, completed };
}

async function cliFixture(fault: ApiFault = "none", failStop = false) {
  const f = startCliFixture(runtimeFixture({ fault, foreignPortAfterStop: failStop }));
  await f.completed;
  return f;
}

function deferredEvent() {
  let release!: () => void;
  const reached = new Promise<void>(resolve => { release = resolve; });
  return { reached, release };
}

function emittedFrame(lines: string[]): HarnessFrame {
  expect(lines).toHaveLength(1);
  expect(lines[0].startsWith("HARNESS_FAILED {")).toBe(true);
  expect(lines[0].endsWith("\n")).toBe(true);
  expect(Buffer.byteLength(lines[0], "utf8")).toBeLessThanOrEqual(2048);
  expect(lines[0]).not.toContain("synthetic-secret-marker");
  return JSON.parse(lines[0].slice("HARNESS_FAILED ".length));
}

describe("real CLI diagnostic producer and first failure", () => {
  it.each(["async-first", "http-first"] as const)("H1 LOGOUT preserves observation order: %s", async order => {
    const f = runtimeFixture();
    const cleanupEntered = deferredEvent();
    const releaseResponse = deferredEvent();
    const events: string[] = [];
    let cleanup = false;
    let cleanupRequests = 0;
    let logoutTimer: ReturnType<typeof setTimeout> | undefined;
    const write = f.options.dependencies.writeStdout;
    f.options.dependencies.writeStdout = (text: string) => {
      if (text.startsWith("M1D_JARS_RESULT ")) cleanup = true;
      return write(text);
    };
    const asyncFailure = () => { events.push("async"); f.input.emit("error", new Error("synthetic-secret-marker input")); };
    f.options.dependencies.fetchFunction = async (url: string, request: Request) => {
      if (cleanup && new URL(url).pathname === "/api/session/logout") {
        cleanupRequests += 1;
        if (cleanupRequests === 1) {
          cleanupEntered.release();
          await releaseResponse.reached;
          events.push("http");
          return response(503);
        }
      }
      return f.api.fetch(url, request);
    };
    Object.assign(f.options.dependencies, {
      setTimeoutFunction: (callback: () => void, milliseconds: number) => {
        const timer = setTimeout(callback, milliseconds);
        if (milliseconds === 5_000) logoutTimer = timer;
        return timer;
      },
      clearTimeoutFunction: (timer: ReturnType<typeof setTimeout>) => {
        clearTimeout(timer);
        // The outer LOGOUT bound settles only after both real jar catches.
        // No elapsed time or guessed microtask count establishes this order.
        if (timer === logoutTimer && order === "http-first") asyncFailure();
      }
    });
    const cli = startCliFixture(f);
    await cleanupEntered.reached;
    if (order === "async-first") asyncFailure();
    releaseResponse.release();
    await cli.completed;
    expect(events).toEqual(order === "async-first" ? ["async", "http"] : ["http", "async"]);
    expect(cli.exitCodes).toEqual([1]);
    expect(emittedFrame(cli.errors).diagnostic).toEqual({
      code: order === "async-first" ? "PARENT_INPUT_FAILED" : "HTTP_STATUS_MISMATCH", step: "LOGOUT",
      expectedStatus: order === "async-first" ? null : 204, receivedStatus: order === "async-first" ? null : 503
    });
    expect(cleanupRequests).toBe(2);
    expect(f.api.sessions.size).toBe(1); // The other jar completed its independent logout.
    expect(f.child.kill).toHaveBeenCalledTimes(1);
    expect(f.child.kill).toHaveBeenCalledWith("SIGTERM");
    expect(f.input.listenerCount("error")).toBe(0);
    expect(f.input.readableFlowing).toBe(false);
    expect(f.output.join("")).not.toContain("M1D_HARNESS_STOPPED");
  });
  it.each(["async-first", "stop-first"] as const)("H1 STOP preserves observation order: %s", async order => {
    const f = runtimeFixture();
    const stopEntered = deferredEvent();
    const releasePortFailure = deferredEvent();
    const events: string[] = [];
    const originalServer = f.options.dependencies.createServerFunction;
    let servers = 0;
    let asyncEmitted = false;
    const asyncFailure = () => { asyncEmitted = true; events.push("async"); f.input.emit("error", new Error("synthetic-secret-marker input")); };
    f.options.dependencies.createServerFunction = () => {
      const server = originalServer();
      servers += 1;
      if (servers === 2) server.listen = () => {
        stopEntered.release();
        void releasePortFailure.reached.then(() => { events.push("stop"); server.emit("error", new Error("synthetic-secret-marker port")); });
        return server;
      };
      return server;
    };
    const off = f.child.stdout.off.bind(f.child.stdout);
    vi.spyOn(f.child.stdout, "off").mockImplementation((event, listener) => {
      // Output detachment is in STOP's finally, after its failure catch and
      // before the private input listener is removed. No final diagnostic is injected.
      if (order === "stop-first" && !asyncEmitted) asyncFailure();
      return off(event, listener);
    });
    const cli = startCliFixture(f);
    await stopEntered.reached;
    if (order === "async-first") asyncFailure();
    releasePortFailure.release();
    await cli.completed;
    expect(events).toEqual(order === "async-first" ? ["async", "stop"] : ["stop", "async"]);
    expect(cli.exitCodes).toEqual([1]);
    expect(emittedFrame(cli.errors).diagnostic).toEqual({
      code: order === "async-first" ? "PARENT_INPUT_FAILED" : "PORT_UNAVAILABLE", step: "STOP", expectedStatus: null, receivedStatus: null
    });
    expect(f.api.sessions.size).toBe(0);
    expect(f.child.kill).toHaveBeenCalledTimes(1);
    expect(f.child.kill).toHaveBeenCalledWith("SIGTERM");
    expect(f.input.listenerCount("error")).toBe(0);
    expect(f.child.stdout.listenerCount("data")).toBe(0);
    expect(f.input.readableFlowing).toBe(false);
    expect(f.output.join("")).not.toContain("M1D_HARNESS_STOPPED");
  });
  it.each(["logout-http", "cleanup-http", "cleanup-no-response"] as const)("retains HTTP observations from logout: %s", async fault => {
    const f = await cliFixture(fault);
    expect(f.exitCodes).toEqual([1]);
    expect(f.output.join("")).not.toContain("M1D_HARNESS_STOPPED");
    expect(emittedFrame(f.errors).diagnostic).toEqual({ code: fault === "cleanup-no-response" ? "HTTP_RESPONSE_UNAVAILABLE" : "HTTP_STATUS_MISMATCH",
      step: fault === "logout-http" ? "LOGOUT_ACCOUNTANT" : "LOGOUT", expectedStatus: 204, receivedStatus: fault === "cleanup-no-response" ? null : 503 });
  });
  it("produces success signals only after the independent API fixture passes the real two-jar journey", async () => {
    const f = await cliFixture();
    expect(f.exitCodes).toEqual([0]); expect(f.errors).toEqual([]);
    expect(f.output).toEqual([`M1D_JARS_RESULT ${RUN} ${"a".repeat(64)} ${"b".repeat(64)} PASS\n`, `M1D_HARNESS_STOPPED ${RUN} JARS=PASS VITE_STOP=PASS\n`]);
    expect(f.spawn).toHaveBeenCalledTimes(1);
    expect(f.api.calls.filter(call => call.path === "/api/closing-folders" && call.options.method === "POST")).toHaveLength(1);
    expect(f.api.sessions.size).toBe(0);
  });
  it.each(["create-http", "create-http-cleanup-fails"] as const)("retains the actual first HTTP failure through CLI and finalization: %s", async fault => {
    const f = await cliFixture(fault, fault === "create-http-cleanup-fails");
    expect(f.exitCodes).toEqual([1]); expect(f.output).toEqual([]);
    const frame = emittedFrame(f.errors);
    expect(frame).toEqual({ schemaVersion: 1, runId: RUN, objectSha: "a".repeat(64), runtimeSha: "b".repeat(64),
      diagnostic: { code: "HTTP_STATUS_MISMATCH", step: "FOLDER_CREATE", expectedStatus: 201, receivedStatus: 503 } });
    expect(f.child.kill).toHaveBeenCalledWith("SIGTERM");
    expect(f.api.calls.filter(call => call.path === "/api/session/logout").length).toBeGreaterThan(4);
  });
  it("marks a request without response as undetermined without serializing the transport exception", async () => {
    const f = await cliFixture("create-no-response");
    expect(f.exitCodes).toEqual([1]); expect(f.output).toEqual([]);
    expect(emittedFrame(f.errors)).toEqual({ schemaVersion: 1, runId: RUN, objectSha: "a".repeat(64), runtimeSha: "b".repeat(64),
      diagnostic: { code: "HTTP_RESPONSE_UNAVAILABLE", step: "FOLDER_CREATE", expectedStatus: 201, receivedStatus: null } });
  });
  it.each(["SYNTHETIC_SECRET_MARKER", "synthetic-secret-marker cookie=secret", "HTTP_STATUS_MISMATCH", "raw-known-message"])("never authorizes a free exception code by its appearance: %s", async code => {
    const f = runtimeFixture(); const errors: string[] = []; const exitCodes: number[] = [];
    f.spawn.mockImplementation(() => { throw code === "raw-known-message" ? new Error("HTTP_STATUS_MISMATCH") : new HarnessFailure(code); });
    await runCli(f.options, { writeStderr: (text: string) => errors.push(text), setExitCode: (value: number) => exitCodes.push(value) });
    expect(exitCodes).toEqual([1]); expect(f.output).toEqual([]); expect(f.spawn).toHaveBeenCalledTimes(1);
    expect(emittedFrame(errors).diagnostic).toEqual({ code: "HARNESS_FAILED", step: "VITE_START", expectedStatus: null, receivedStatus: null });
  });
  it.skipIf(process.platform !== "win32")("carries actual CLI bytes through the native rail parser and actual terminal payload", async () => {
    const success = await cliFixture();
    const failed = await cliFixture("create-http-cleanup-fails", true);
    const absent = await cliFixture("create-no-response");
    const frame = emittedFrame(failed.errors);
    const noResponse = emittedFrame(absent.errors);
    type Case = { name: string; stdout: string; stderr: string; role: string; rejected: boolean; signals: number; expected: HarnessFrame | null; success: boolean };
    const cases: Case[] = [];
    const add = (name: string, stderr: string, rejected = true, role = "HARNESS", stdout = "", expected: HarnessFrame | null = null, passed = false) =>
      cases.push({ name, stdout, stderr, role, rejected, signals: passed ? 2 : 0, expected, success: passed });
    add("actual-success", "", false, "HARNESS", success.output.join(""), null, true);
    add("actual-first-failure", failed.errors.join(""), false, "HARNESS", "", frame);
    add("actual-no-response", absent.errors.join(""), false, "HARNESS", "", noResponse);
    add("diagnostic-and-real-pass", failed.errors[0], true, "HARNESS", success.output[0], frame);
    cases.at(-1)!.signals = 1;
    add("diagnostic-absent", "", false);
    add("wrong-role", failed.errors.join(""), true, "BACKEND");
    add("wrong-stream", "", true, "HARNESS", failed.errors.join(""));
    add("truncated", failed.errors[0].trimEnd());
    add("oversized", failed.errors[0].trimEnd() + " ".repeat(2048) + "\n");
    add("duplicate", failed.errors[0] + absent.errors[0], true, "HARNESS", "", frame);
    add("duplicate-property", failed.errors[0].replace('"schemaVersion":1', '"schemaVersion":1,"schemaVersion":1'));
    const corrupt = (name: string, mutation: (value: Record<string, unknown>, diagnostic: Record<string, unknown>) => void) => {
      const value = JSON.parse(JSON.stringify(frame)) as Record<string, unknown>;
      mutation(value, value.diagnostic as Record<string, unknown>);
      add(name, "HARNESS_FAILED " + JSON.stringify(value) + "\n");
    };
    for (const key of ["runId", "objectSha", "runtimeSha"]) {
      corrupt("binding-" + key, value => { value[key] = "c".repeat(key === "runId" ? 32 : 64); });
      for (const suffix of ["\0", "\n", " "]) corrupt("binding-suffix-" + key + JSON.stringify(suffix), value => { value[key] = String(value[key]) + suffix; });
    }
    corrupt("version-string", value => { value.schemaVersion = "1"; });
    corrupt("unknown-version", value => { value.schemaVersion = 2; });
    corrupt("unknown-code", (_value, detail) => { detail.code = "SYNTHETIC_SECRET_MARKER"; });
    corrupt("unknown-step", (_value, detail) => { detail.step = "SYNTHETIC_SECRET_MARKER"; });
    corrupt("wrong-code-case", (_value, detail) => { detail.code = "http_status_mismatch"; });
    corrupt("unknown-property", (_value, detail) => { detail.exception = "synthetic-secret-marker"; });
    corrupt("missing-property", (_value, detail) => { delete detail.receivedStatus; });
    corrupt("null-detail", value => { value.diagnostic = null; });
    corrupt("extra-envelope-property", value => { value.raw = "synthetic-secret-marker"; });
    for (const key of ["code", "step"]) {
      for (const suffix of ["\n", "\r", "\0", " "]) corrupt("enum-suffix-" + key + JSON.stringify(suffix), (_value, detail) => { detail[key] = String(detail[key]) + suffix; });
    }
    for (const status of [-1, 99, 600, 503.5, "503", true, null, 201]) {
      corrupt("invalid-received-" + JSON.stringify(status), (_value, detail) => { detail.receivedStatus = status; });
    }
    for (const status of [0, 600, 201.5, "201", false, null]) {
      corrupt("invalid-expected-" + JSON.stringify(status), (_value, detail) => { detail.expectedStatus = status; });
    }
    corrupt("unavailable-with-response", (_value, detail) => { detail.code = "HTTP_RESPONSE_UNAVAILABLE"; });
    corrupt("non-http-with-status", (_value, detail) => { detail.code = "ME_CONTEXT_MISMATCH"; });
    const root = mkdtempSync(path.join(os.tmpdir(), "m1d-synthetic-harness-")); syntheticRoots.push(root);
    writeFileSync(path.join(root, "input.json"), JSON.stringify(cases));
    // Load function definitions only. No dispatcher, initializer, native job,
    // listener probe, operational run directory, database or application starts.
    const ps = String.raw`param([string]§Rail, [string]§Root)
§ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
if (§PSVersionTable.PSEdition -cne 'Desktop' -or §PSVersionTable.PSVersion.Major -ne 5 -or §PSVersionTable.PSVersion.Minor -ne 1) { throw 'FIXTURE_PS_VERSION' }
[void][Reflection.Assembly]::Load('System.Runtime.Serialization, Version=4.0.0.0, Culture=neutral, PublicKeyToken=b77a5c561934e089')
§tokens=§null; §errors=§null
§ast=[Management.Automation.Language.Parser]::ParseFile(§Rail,[ref]§tokens,[ref]§errors)
if (§errors.Count -ne 0) { throw 'FIXTURE_AST' }
§definitions=@(§ast.EndBlock.Statements | Where-Object { §_ -is [Management.Automation.Language.FunctionDefinitionAst] } | ForEach-Object { §_.Extent.Text })
§functions=Join-Path §Root 'rail.functions.ps1'
[IO.File]::WriteAllText(§functions,(§definitions -join [Environment]::NewLine),[Text.UTF8Encoding]::new(§false))
. §functions
function Get-M1DNamespaceIdentity { return 'OFFLINE_HARNESS_FIXTURE' }
§RunId='1234567890abcdef1234567890abcdef'; §ReviewedObjectSha256='a'*64; §SensitiveAuthorizationRecordId='AUTH-OFFLINE-HARNESS-FIXTURE'
§script:DRuntimeSha256='b'*64; §script:DFrontendRuntimeSha256='c'*64
§script:DPhase='integration'; §script:DOperation='child-drain'
§script:DCampaignClock=[pscustomobject]@{ElapsedMilliseconds=0}
§script:DPhaseDeadline=1000L; §script:DTotalMilliseconds=1000L
§cases=Get-Content -LiteralPath (Join-Path §Root 'input.json') -Raw | ConvertFrom-Json
§outcomes=@(); §number=0
foreach (§case in §cases) {
  §script:DFailures=[Collections.Generic.List[object]]::new(); §script:DCookieDiagnostic=§null; §script:DBrowserDiagnostic=§null; §script:DHarnessDiagnostic=§null
  §script:DFinishSent=[bool]§case.success; §script:DBackendStopSent=§false
  §p=[pscustomobject]@{StandardOutput=[IO.StringReader]::new(§case.stdout);StandardError=[IO.StringReader]::new(§case.stderr);HasExited=§true;ExitCode=$(if (§case.success) { 0 } else { 1 })}
  try {
    §drain=New-M1DDrain §p §case.role §null
    for (§i=0; §i -lt 32 -and (-not §drain.OutEnded -or -not §drain.ErrEnded); §i++) { Update-M1DDrain §drain -Finalizing }
    if (-not §drain.OutEnded -or -not §drain.ErrEnded -or §drain.Signals.Count -ne §case.signals) { throw ('FIXTURE_DRAIN_' + §case.name) }
    if ((§drain.Failures.Count -gt 0) -ne §case.rejected) { throw ('FIXTURE_PROTOCOL_' + §case.name) }
    if ((ConvertTo-Json §script:DHarnessDiagnostic -Depth 10 -Compress) -cne (ConvertTo-Json §case.expected -Depth 10 -Compress)) { throw ('FIXTURE_DETAIL_' + §case.name) }
    §primaryStop=§null
    if (-not §case.rejected -or §case.name -ceq 'diagnostic-and-real-pass') {
      §script:DChildren=@{HARNESS=§drain}
      try { Wait-M1DSignal 'HARNESS' ('M1D_JARS_RESULT ' + §RunId + ' ' + §ReviewedObjectSha256 + ' ' + §script:DRuntimeSha256 + ' PASS') }
      catch { §primaryStop=Add-M1DFailure §_ }
      §diagnostics=Get-M1DDiagnostics
      if (§case.name -ceq 'diagnostic-and-real-pass') {
        if (§diagnostics.primary.control -cne 'D_CONTROL_MESSAGE_REJECTED' -or §null -eq §primaryStop) { throw 'FIXTURE_CONTRADICTORY_PASS_ACCEPTED' }
      }
      elseif (§case.success) { if (§null -ne §diagnostics.primary) { throw 'FIXTURE_REAL_SUCCESS_REFUSED' } }
      elseif (§diagnostics.primary.control -cne 'D_REQUIRED_RESULT_ABSENT' -or §diagnostics.primary.childRole -cne 'HARNESS') { throw ('FIXTURE_REAL_WAIT_' + §case.name) }
    }
    §number++; §script:DRunRoot=Join-Path §Root ([string]§number); [void][IO.Directory]::CreateDirectory(§script:DRunRoot)
    [void](Write-M1DReceipt 'campaign' ([pscustomobject]@{runtimeSha256=§script:DRuntimeSha256;frontendRuntimeSha256=§script:DFrontendRuntimeSha256}))
    §payload=Get-M1DTerminalPayload -Success ([bool]§case.success) -PrimaryStop §primaryStop -CleanupStop §null -Targeted §null -Full §null -Cleanup §null
    [void](Write-M1DReceipt 'terminal' §payload)
    §terminal=Read-M1DReceipt 'terminal'
    §expectedResult=if (§case.success) { 'PASS' } else { 'FAIL' }
    if (§terminal.payload.campaignResult -cne §expectedResult) { throw ('FIXTURE_RESULT_' + §case.name) }
    if ((ConvertTo-Json §terminal.payload.harnessDiagnostic -Depth 10 -Compress) -cne (ConvertTo-Json §case.expected -Depth 10 -Compress)) { throw ('FIXTURE_TERMINAL_DETAIL_' + §case.name) }
    §outcomes+=[pscustomobject]@{name=§case.name;rejected=(§drain.Failures.Count -gt 0);signals=§drain.Signals.Count;result=§terminal.payload.campaignResult;diagnostic=§terminal.payload.harnessDiagnostic}
  } finally { §p.StandardOutput.Dispose(); §p.StandardError.Dispose() }
}
# Old receipts have no invented harness detail, even when their sidecar is valid.
§script:DRunRoot=Join-Path §Root 'legacy'; [void][IO.Directory]::CreateDirectory(§script:DRunRoot)
§script:DFailures=[Collections.Generic.List[object]]::new()
[void](Write-M1DReceipt 'terminal' ([pscustomobject]@{campaignResult='FAIL';diagnostics=(Get-M1DDiagnostics)}))
§legacy=Read-M1DReceipt 'terminal'
if (§legacy.payload.PSObject.Properties.Name -ccontains 'harnessDiagnostic') { throw 'FIXTURE_LEGACY_DETAIL_INVENTED' }
# A freshly correct sidecar must not hide an invalid nested harness diagnostic.
§script:DRunRoot=Join-Path §Root 'invalid-terminal'; [void][IO.Directory]::CreateDirectory(§script:DRunRoot)
[void](Write-M1DReceipt 'campaign' ([pscustomobject]@{runtimeSha256=§script:DRuntimeSha256;frontendRuntimeSha256=§script:DFrontendRuntimeSha256}))
§script:DHarnessDiagnostic=§cases[1].expected
§bad=Get-M1DTerminalPayload -Success §true -PrimaryStop §null -CleanupStop §null -Targeted §null -Full §null -Cleanup §null
if (§bad.campaignResult -cne 'FAIL') { throw 'FIXTURE_DIAGNOSTIC_BECAME_SUCCESS' }
§bad.harnessDiagnostic.diagnostic.code='SYNTHETIC_SECRET_MARKER'
[void](Write-M1DReceipt 'terminal' §bad)
§refused=§false; try { [void](Read-M1DReceipt 'terminal') } catch { §refused=§true }
if (-not §refused) { throw 'FIXTURE_INVALID_TERMINAL_ACCEPTED' }
[pscustomobject]@{cases=§outcomes;legacy='FAIL';invalidTerminalRejected=§refused} | ConvertTo-Json -Depth 12 -Compress
`.replaceAll("§", "$" );
    const file = path.join(root, "fixture.ps1"); writeFileSync(file, ps);
    const output = execFileSync("C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe",
      ["-NoProfile", "-NonInteractive", "-File", file, "-Rail", path.resolve("../backend/scripts/m1-1b-postgresql-rail.ps1"), "-Root", root],
      { encoding: "utf8", timeout: 30_000, windowsHide: true, maxBuffer: 128 * 1024 });
    expect(output).not.toMatch(/synthetic-secret-marker|synthetic-session-|synthetic-csrf-|example\.invalid/);
    const result = JSON.parse(output.trim()) as { cases: Array<{ name: string; rejected: boolean; signals: number; result: string; diagnostic: HarnessFrame | null }>; legacy: string; invalidTerminalRejected: boolean };
    expect(result.legacy).toBe("FAIL"); expect(result.invalidTerminalRejected).toBe(true);
    expect(result.cases).toEqual(cases.map(item => ({ name: item.name, rejected: item.rejected, signals: item.signals, result: item.success ? "PASS" : "FAIL", diagnostic: item.expected })));
    for (let index = 1; index <= cases.length; index++) {
      expect(readFileSync(path.join(root, String(index), "d-terminal.json"), "utf8")).not.toMatch(/synthetic-secret-marker|synthetic-session-|synthetic-csrf-|example\.invalid/);
    }
  }, 40_000);
});
