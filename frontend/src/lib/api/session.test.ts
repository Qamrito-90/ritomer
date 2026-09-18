import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { downloadExportPackContent } from "./exports";
import { captureSessionGuard, requestJson, SessionInvalidatedError, type Fetcher } from "./http";
import { loadMeShellState } from "./me";
import { createSessionCoordinator, safeReturnPath, type SessionCoordinator } from "./session";
import { downloadWorkpaperDocument } from "./workpapers";

const tenant = { tenantId: "11111111-1111-4111-8111-111111111111", tenantSlug: "pilot", tenantName: "Pilote" };
const folderId = "22222222-2222-4222-8222-222222222222";
const assetId = "33333333-3333-4333-8333-333333333333";
const actor = { actorKey: "local-internal-key", displayLabel: "Collaboratrice pilote" };
const me = { actor: { userId: assetId, externalSubject: "private-subject", displayName: "Camille" }, activeTenant: tenant, effectiveRoles: ["ACCOUNTANT"] };
const json = (payload: unknown, status = 200) => new Response(JSON.stringify(payload), { status, headers: { "Content-Type": "application/json" } });
const bootstrap = (authenticated = true, token = "csrf-current") => json(authenticated
  ? { sessionState: "AUTHENTICATED", localLoginAvailable: true, csrf: { headerName: "X-CSRF-TOKEN", token } }
  : { sessionState: "ANONYMOUS", localLoginAvailable: true, csrf: { headerName: "X-CSRF-TOKEN", token }, actors: [actor] });

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

const coordinators: SessionCoordinator[] = [];
function coordinator(fetcher: Fetcher) {
  const session = createSessionCoordinator(fetcher);
  coordinators.push(session);
  session.install();
  return session;
}

async function ready() {
  const fetcher = vi.fn().mockResolvedValueOnce(bootstrap()).mockResolvedValueOnce(json(me));
  const session = coordinator(fetcher);
  await session.initialize();
  expect(session.getSnapshot().mode).toBe("SESSION_READY");
  return { session, fetcher };
}

beforeEach(() => { vi.stubGlobal("BroadcastChannel", undefined); });
afterEach(() => {
  coordinators.splice(0).forEach((session) => session.dispose());
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("session negotiation and protected transport", () => {
  it("has no import/install network side effect, shares initialization and blocks premature protected requests", async () => {
    const first = deferred<Response>();
    const fetcher = vi.fn().mockReturnValueOnce(first.promise).mockResolvedValueOnce(json(me));
    const session = coordinator(fetcher);
    expect(fetcher).not.toHaveBeenCalled();
    const protectedFetcher = vi.fn();
    await expect(requestJson("/api/protected", {}, protectedFetcher)).rejects.toBeInstanceOf(SessionInvalidatedError);
    expect(protectedFetcher).not.toHaveBeenCalled();
    const one = session.initialize();
    expect(session.initialize()).toBe(one);
    await Promise.resolve();
    expect(fetcher).toHaveBeenCalledTimes(1);
    first.resolve(bootstrap());
    await one;
    expect(fetcher.mock.calls.map(([path]) => path)).toEqual(["/api/session/bootstrap", "/api/me"]);
    expect(session.getSnapshot().mode).toBe("SESSION_READY");
    const stable = session.getSnapshot();
    await session.initialize();
    expect(session.getSnapshot()).toBe(stable);
  });

  it("logs in once, replaces anonymous CSRF, then loads context without exposing identity fields", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(bootstrap(false, "anonymous-token"))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(bootstrap(true, "authenticated-token")).mockResolvedValueOnce(json(me));
    const session = coordinator(fetcher);
    await session.initialize();
    const login = session.login(actor.actorKey);
    expect(session.login(actor.actorKey)).toBe(login);
    await login;
    expect(fetcher.mock.calls.map(([path]) => path)).toEqual(["/api/session/bootstrap", "/api/session/local", "/api/session/bootstrap", "/api/me"]);
    const loginInit = fetcher.mock.calls[1][1] as RequestInit;
    expect(loginInit).toMatchObject({ credentials: "same-origin", body: JSON.stringify({ actorKey: actor.actorKey }), headers: { "X-CSRF-TOKEN": "anonymous-token" } });
    for (const [, init] of fetcher.mock.calls) {
      expect(new Headers((init as RequestInit).headers).has("X-Tenant-Id")).toBe(false);
      expect(new Headers((init as RequestInit).headers).has("Authorization")).toBe(false);
    }
    expect(session.getSnapshot().meState).toEqual({ kind: "ready", activeTenant: tenant, effectiveRoles: ["ACCOUNTANT"], displayName: "Camille" });
    expect(JSON.stringify(session.getSnapshot())).not.toContain("private-subject");
    expect(JSON.stringify(session.getSnapshot())).not.toContain(assetId);
    expect(JSON.stringify(session.getSnapshot())).not.toContain("authenticated-token");
    const mutation = vi.fn().mockResolvedValue(json({}));
    const body = new FormData();
    body.append("file", new Blob(["demo"]));
    await requestJson("/api/upload", { method: "POST", headers: { "X-Tenant-Id": tenant.tenantId, "Idempotency-Key": "attempt-1" }, body }, mutation);
    expect(mutation.mock.calls[0][1]).toMatchObject({ credentials: "same-origin", body, headers: { "X-CSRF-TOKEN": "authenticated-token", "X-Tenant-Id": tenant.tenantId, "Idempotency-Key": "attempt-1" } });
    expect(new Headers(mutation.mock.calls[0][1].headers).has("Content-Type")).toBe(false);
    await requestJson("/api/upload", { method: "POST", headers: { "x-csrf-token": "obsolete" } }, mutation);
    expect(new Headers(mutation.mock.calls[1][1].headers).get("X-CSRF-TOKEN")).toBe("authenticated-token");
  });

  it("enters legacy only on the first bootstrap 404 and keeps isolated clients independent", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(json({}, 404)).mockResolvedValueOnce(json(me));
    const session = coordinator(fetcher);
    await session.initialize();
    expect(session.getSnapshot().mode).toBe("LEGACY_PROXY_TRANSITION");
    const mutation = vi.fn().mockResolvedValue(json({}));
    await requestJson("/api/business", { method: "POST" }, mutation);
    expect(mutation.mock.calls[0][1].headers).toEqual({ Accept: "application/json" });
    session.dispose();
    await requestJson("/api/isolated", {}, mutation);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it.each([401, 500])("does not enter legacy after a first bootstrap %s", async (status) => {
    const fetcher = vi.fn().mockResolvedValueOnce(json({}, status)).mockResolvedValue(json({}, 404));
    const session = coordinator(fetcher);
    await session.initialize();
    if (status === 500) await session.retry();
    expect(session.getSnapshot()).toMatchObject({ mode: "ERROR", error: "capability_unavailable" });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it.each([
    [() => Promise.reject(new Error("offline")), "network_error"],
    [() => Promise.reject(new Error("timeout")), "timeout"],
    [() => Promise.resolve(json({}, 503)), "server_error"],
    [() => Promise.resolve(json({ sessionState: "AUTHENTICATED" })), "invalid_response"]
  ] as const)("keeps bootstrap errors explicit without fallback", async (response, error) => {
    const fetcher = vi.fn(response);
    const session = coordinator(fetcher);
    await session.initialize();
    expect(session.getSnapshot()).toMatchObject({ mode: "ERROR", error, meState: null });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("recovers an initial me 401 once to an anonymous chooser, without a bootstrap/me loop", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(bootstrap()).mockResolvedValueOnce(json({}, 401)).mockResolvedValueOnce(bootstrap(false));
    const session = coordinator(fetcher);
    await session.initialize();
    expect(session.getSnapshot()).toMatchObject({ mode: "ANONYMOUS", actors: [actor] });
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it("expires and purges immediately on a current protected 401, then refuses mutations before network", async () => {
    const { session } = await ready();
    const guard = captureSessionGuard();
    await expect(requestJson("/api/protected", {}, vi.fn().mockResolvedValue(json({}, 401)))).rejects.toBeInstanceOf(SessionInvalidatedError);
    expect(session.getSnapshot()).toMatchObject({ mode: "EXPIRED", meState: null, actors: [] });
    expect(guard()).toBe(false);
    const mutation = vi.fn();
    await expect(requestJson("/api/protected", { method: "POST" }, mutation)).rejects.toBeInstanceOf(SessionInvalidatedError);
    expect(mutation).not.toHaveBeenCalled();
  });

  it("expires on focus bootstrap 401 and cannot downgrade established capability to legacy", async () => {
    const { session, fetcher } = await ready();
    fetcher.mockResolvedValueOnce(json({}, 401));
    await session.revalidate();
    expect(session.getSnapshot().mode).toBe("EXPIRED");
    fetcher.mockResolvedValueOnce(json({}, 404));
    await session.retry();
    expect(session.getSnapshot()).toMatchObject({ mode: "ERROR", error: "capability_unavailable" });
  });

  it.each([403, 404])("leaves contextual business %s local and does not reauthenticate", async (status) => {
    const { session, fetcher } = await ready();
    const response = await requestJson("/api/protected", {}, vi.fn().mockResolvedValue(json({ code: status === 403 ? "ACCESS_DENIED" : "NOT_FOUND" }, status)));
    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({ code: status === 403 ? "ACCESS_DENIED" : "NOT_FOUND" });
    expect(session.getSnapshot().mode).toBe("SESSION_READY");
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("revocation clears all context and does not reconnect automatically", async () => {
    const { session, fetcher } = await ready();
    await expect(requestJson("/api/protected", {}, vi.fn().mockResolvedValue(json({ code: "ACCESS_REVOKED" }, 403)))).rejects.toBeInstanceOf(SessionInvalidatedError);
    expect(session.getSnapshot()).toMatchObject({ mode: "FORBIDDEN", error: "access_revoked", meState: null });
    await session.revalidate();
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("renews CSRF once after rejection and never replays the rejected mutation", async () => {
    const { session, fetcher } = await ready();
    fetcher.mockResolvedValueOnce(bootstrap(true, "csrf-renewed")).mockResolvedValueOnce(json(me));
    const mutation = vi.fn().mockResolvedValue(json({ code: "CSRF_REJECTED" }, 403));
    await expect(requestJson("/api/business", { method: "POST" }, mutation)).rejects.toBeInstanceOf(SessionInvalidatedError);
    await session.initialize();
    expect(mutation).toHaveBeenCalledTimes(1);
    expect(session.getSnapshot().mode).toBe("SESSION_READY");
    const next = vi.fn().mockResolvedValue(json({}));
    await requestJson("/api/business", { method: "POST" }, next);
    expect(next.mock.calls[0][1].headers["X-CSRF-TOKEN"]).toBe("csrf-renewed");
  });

  it("ignores a delayed forbidden body from a previous session", async () => {
    const { session, fetcher } = await ready();
    const body = deferred<unknown>();
    const late = { status: 403, clone: () => ({ json: () => body.promise }) } as unknown as Response;
    const old = requestJson("/api/old", {}, vi.fn().mockResolvedValue(late)).catch((error: unknown) => error);
    await Promise.resolve();
    await expect(requestJson("/api/expire", {}, vi.fn().mockResolvedValue(json({}, 401)))).rejects.toBeInstanceOf(SessionInvalidatedError);
    fetcher.mockResolvedValueOnce(bootstrap(true, "new-session")).mockResolvedValueOnce(json(me));
    await session.retry();
    const stable = session.getSnapshot();
    body.resolve({ code: "ACCESS_REVOKED" });
    await old;
    await Promise.resolve();
    expect(session.getSnapshot()).toBe(stable);
  });

  it.each(["ACCESS_REVOKED", "CSRF_REJECTED"])("ignores delayed %s after the request timed out in the same generation", async (code) => {
    const { session, fetcher } = await ready();
    vi.useFakeTimers();
    const stable = session.getSnapshot();
    const body = deferred<unknown>();
    const readError = vi.fn().mockReturnValue(body.promise);
    const response = { status: 403, clone: () => ({ json: readError }) } as unknown as Response;
    const requestFetcher = vi.fn().mockResolvedValue(response);
    const completed = requestJson("/api/protected", { method: "POST" }, requestFetcher).catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(0);
    expect(readError).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(5000);
    await expect(completed).resolves.toEqual(new Error("timeout"));
    expect(requestFetcher.mock.calls[0][1].signal.aborted).toBe(true);
    expect(session.getSnapshot()).toBe(stable);
    body.resolve({ code });
    await vi.advanceTimersByTimeAsync(0);
    expect(session.getSnapshot()).toBe(stable);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(requestFetcher).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("retains the same snapshot on unchanged focus/visibility revalidation and coalesces requests", async () => {
    const { session, fetcher } = await ready();
    const stable = session.getSnapshot();
    const response = deferred<Response>();
    fetcher.mockReturnValueOnce(response.promise).mockResolvedValueOnce(json(me));
    window.dispatchEvent(new Event("focus"));
    document.dispatchEvent(new Event("visibilitychange"));
    const pending = session.revalidate();
    response.resolve(bootstrap());
    await pending;
    expect(fetcher).toHaveBeenCalledTimes(4);
    expect(session.getSnapshot()).toBe(stable);
  });

  it("logs out once, clears synchronously and bootstraps an anonymous session", async () => {
    const { session, fetcher } = await ready();
    const response = deferred<Response>();
    fetcher.mockReturnValueOnce(response.promise).mockResolvedValueOnce(bootstrap(false, "after-logout"));
    const logout = session.logout();
    expect(session.logout()).toBe(logout);
    expect(session.getSnapshot()).toMatchObject({ mode: "LOGGING_OUT", meState: null, actors: [] });
    response.resolve(new Response(null, { status: 204 }));
    await logout;
    expect(session.getSnapshot().mode).toBe("ANONYMOUS");
    expect(fetcher.mock.calls.filter(([path]) => path === "/api/session/logout")).toHaveLength(1);
    expect(fetcher.mock.calls[2][1]).toMatchObject({ method: "POST", headers: { "X-CSRF-TOKEN": "csrf-current" } });
  });

  it("C-LOGOUT-01 recovers explicitly when the logout response is lost and the server is already anonymous", async () => {
    const { session, fetcher } = await ready();
    let serverAuthenticated = true;
    fetcher.mockImplementation(async (path: string, init: RequestInit) => {
      if (path === "/api/session/logout" && init.method === "POST") {
        if (serverAuthenticated) {
          serverAuthenticated = false;
          throw new TypeError("logout response lost");
        }
        return json({ code: "AUTHENTICATION_REQUIRED", message: "Authentication is required." }, 401);
      }
      if (path === "/api/session/bootstrap" && init.method === "GET") return bootstrap(false, "recovered-anonymous");
      throw new Error(`Unexpected request: ${init.method} ${path}`);
    });
    await session.logout();
    expect(serverAuthenticated).toBe(false);
    expect(session.getSnapshot()).toMatchObject({ mode: "LOGOUT_UNCONFIRMED", meState: null, actors: [], error: "network_error" });
    window.dispatchEvent(new Event("focus"));
    await session.revalidate();
    expect(fetcher).toHaveBeenCalledTimes(3);

    const retry = session.retry();
    expect(session.retry()).toBe(retry);
    await retry;

    expect.soft(fetcher.mock.calls.map(([path, init]) => [path, init.method])).toEqual([
      ["/api/session/bootstrap", "GET"], ["/api/me", "GET"],
      ["/api/session/logout", "POST"], ["/api/session/bootstrap", "GET"]
    ]);
    expect.soft(session.getSnapshot()).toMatchObject({ mode: "ANONYMOUS", meState: null, actors: [actor], error: null });
  });

  it("keeps uncertain logout closed through focus and confirms only after explicit retry", async () => {
    let receive!: (event: MessageEvent<unknown>) => void;
    vi.stubGlobal("BroadcastChannel", vi.fn(function () {
      return { postMessage: vi.fn(), close: vi.fn(), addEventListener: (_type: string, handler: typeof receive) => { receive = handler; } };
    }));
    const { session, fetcher } = await ready();
    fetcher.mockRejectedValueOnce(new Error("offline"));
    await session.logout();
    expect(session.getSnapshot()).toMatchObject({ mode: "LOGOUT_UNCONFIRMED", meState: null, error: "network_error" });
    window.dispatchEvent(new Event("focus"));
    receive(new MessageEvent("message", { data: { type: "SESSION_CHANGED" } }));
    await session.revalidate();
    expect(fetcher).toHaveBeenCalledTimes(3);
    const confirmation = deferred<Response>();
    fetcher.mockResolvedValueOnce(bootstrap(true, "retry-current"))
      .mockReturnValueOnce(confirmation.promise).mockResolvedValueOnce(bootstrap(false));
    const states: string[] = [];
    const unsubscribe = session.subscribe(() => { states.push(session.getSnapshot().mode); });
    const retry = session.retry();
    expect(session.retry()).toBe(retry);
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(5));
    expect(session.getSnapshot()).toMatchObject({ mode: "LOGGING_OUT", meState: null, actors: [] });
    expect(fetcher.mock.calls[4][1]).toMatchObject({ method: "POST", headers: { "X-CSRF-TOKEN": "retry-current" } });
    confirmation.resolve(new Response(null, { status: 204 }));
    await retry;
    expect(session.getSnapshot().mode).toBe("ANONYMOUS");
    expect(fetcher.mock.calls.map(([path]) => path)).toEqual([
      "/api/session/bootstrap", "/api/me", "/api/session/logout",
      "/api/session/bootstrap", "/api/session/logout", "/api/session/bootstrap"
    ]);
    expect(states).not.toContain("SESSION_READY");
    expect(states).not.toContain("LEGACY_PROXY_TRANSITION");
    unsubscribe();
  });

  it.each([false, true])("requires fresh bootstrap evidence after a recovery 401, authenticated=%s", async (authenticated) => {
    const { session, fetcher } = await ready();
    fetcher.mockRejectedValueOnce(new TypeError("logout response lost"));
    await session.logout();
    const freshBootstrap = deferred<Response>();
    fetcher.mockResolvedValueOnce(json({ code: "SESSION_EXPIRED", message: "The session has expired." }, 401))
      .mockReturnValueOnce(freshBootstrap.promise);
    if (authenticated) fetcher.mockResolvedValueOnce(new Response(null, { status: 204 })).mockResolvedValueOnce(bootstrap(false));
    const retry = session.retry();
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(5));
    expect(session.getSnapshot()).toMatchObject({ mode: "LOGGING_OUT", meState: null, actors: [] });
    freshBootstrap.resolve(bootstrap(authenticated, "retry-after-expiry"));
    await retry;
    expect(session.getSnapshot()).toMatchObject({ mode: "ANONYMOUS", meState: null, actors: [actor], error: null });
    const paths = ["/api/session/bootstrap", "/api/me", "/api/session/logout", "/api/session/bootstrap", "/api/session/bootstrap"];
    if (authenticated) paths.push("/api/session/logout", "/api/session/bootstrap");
    expect(fetcher.mock.calls.map(([path]) => path)).toEqual(paths);
    if (authenticated) expect(fetcher.mock.calls[5][1]).toMatchObject({ method: "POST", headers: { "X-CSRF-TOKEN": "retry-after-expiry" } });
  });

  it.each([
    ["network", () => Promise.reject(new TypeError("offline")), "network_error", 1],
    ["server", () => Promise.resolve(json({}, 503)), "server_error", 1],
    ["capability", () => Promise.resolve(json({}, 404)), "capability_unavailable", 1],
    ["invalid payload", () => Promise.resolve(json({ sessionState: "ANONYMOUS" })), "invalid_response", 1],
    ["invalid JSON", () => Promise.resolve(new Response("invalid json", { status: 200 })), "invalid_response", 1],
    ["repeated 401", () => Promise.resolve(json({ code: "SESSION_EXPIRED", message: "The session has expired." }, 401)), "authentication_failed", 2],
    ["revoked", () => Promise.resolve(json({ code: "ACCESS_REVOKED", message: "Access has been revoked." }, 403)), "access_revoked", 1]
  ] as const)("keeps logout unconfirmed on recovery %s without a mutation or legacy fallback", async (_label, respond, error, bootstrapCount) => {
    const { session, fetcher } = await ready();
    fetcher.mockRejectedValueOnce(new TypeError("logout response lost"));
    await session.logout();
    fetcher.mockImplementation(respond);
    await session.retry();
    expect(session.getSnapshot()).toMatchObject({ mode: "LOGOUT_UNCONFIRMED", error, meState: null, actors: [] });
    expect(fetcher.mock.calls.slice(3).map(([path, init]) => [path, init.method])).toEqual(
      Array.from({ length: bootstrapCount }, () => ["/api/session/bootstrap", "GET"])
    );
    window.dispatchEvent(new Event("focus"));
    document.dispatchEvent(new Event("visibilitychange"));
    await session.revalidate();
    expect(fetcher).toHaveBeenCalledTimes(3 + bootstrapCount);
  });

  it("keeps a timed-out recovery unconfirmed and ignores the late anonymous response", async () => {
    const { session, fetcher } = await ready();
    fetcher.mockRejectedValueOnce(new TypeError("logout response lost"));
    await session.logout();
    vi.useFakeTimers();
    const response = deferred<Response>();
    fetcher.mockReturnValueOnce(response.promise);
    const retry = session.retry();
    await vi.advanceTimersByTimeAsync(5000);
    await retry;
    expect(session.getSnapshot()).toMatchObject({ mode: "LOGOUT_UNCONFIRMED", error: "timeout", meState: null, actors: [] });
    const stable = session.getSnapshot();
    expect(fetcher.mock.calls[3][1].signal.aborted).toBe(true);
    response.resolve(bootstrap(false));
    await vi.advanceTimersByTimeAsync(0);
    expect(session.getSnapshot()).toBe(stable);
    expect(fetcher.mock.calls.map(([path]) => path)).toEqual(["/api/session/bootstrap", "/api/me", "/api/session/logout", "/api/session/bootstrap"]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each([false, true])("discards an abandoned recovery body without publishing context, authenticated=%s", async (authenticated) => {
    const { session, fetcher } = await ready();
    fetcher.mockRejectedValueOnce(new TypeError("logout response lost"));
    await session.logout();
    const body = deferred<unknown>();
    const readBody = vi.fn().mockReturnValue(body.promise);
    fetcher.mockResolvedValueOnce({ status: 200, json: readBody } as unknown as Response);
    const retry = session.retry();
    await vi.waitFor(() => expect(readBody).toHaveBeenCalledOnce());
    session.dispose();
    await retry;
    const abandoned = session.getSnapshot();
    const replacement = await ready();
    const current = replacement.session.getSnapshot();
    body.resolve(await bootstrap(authenticated, "abandoned-recovery").json());
    await Promise.resolve();
    await Promise.resolve();
    expect(session.getSnapshot()).toBe(abandoned);
    expect(session.getSnapshot()).toMatchObject({ meState: null, actors: [] });
    expect(replacement.session.getSnapshot()).toBe(current);
    expect(fetcher.mock.calls.map(([path]) => path)).toEqual(["/api/session/bootstrap", "/api/me", "/api/session/logout", "/api/session/bootstrap"]);
  });

  it("bounds a stalled bootstrap JSON body and never publishes its late result", async () => {
    vi.useFakeTimers();
    const body = deferred<unknown>();
    const fetcher = vi.fn().mockResolvedValue({ status: 200, json: () => body.promise } as Response);
    const session = coordinator(fetcher);
    const initialization = session.initialize();
    await vi.advanceTimersByTimeAsync(5000);
    await initialization;
    expect(session.getSnapshot()).toMatchObject({ mode: "ERROR", error: "timeout", meState: null });
    body.resolve({ sessionState: "AUTHENTICATED", localLoginAvailable: true, csrf: { headerName: "X-CSRF-TOKEN", token: "late" } });
    await Promise.resolve();
    expect(session.getSnapshot().mode).toBe("ERROR");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("cancels stalled me JSON on dispose even if the double ignores AbortSignal", async () => {
    const body = deferred<unknown>();
    const fetcher = vi.fn().mockResolvedValueOnce(bootstrap()).mockResolvedValueOnce({ status: 200, json: () => body.promise } as Response);
    const session = coordinator(fetcher);
    const initialization = session.initialize();
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
    session.dispose();
    await initialization;
    body.resolve(me);
    await Promise.resolve();
    expect(session.getSnapshot().meState).toBeNull();
  });

  it("uses the exact channel payload, clears on received changes, and never echoes them", async () => {
    const sent = vi.fn();
    const closed = vi.fn();
    let receive!: (event: MessageEvent<unknown>) => void;
    const channelConstructor = vi.fn(function () { return { postMessage: sent, close: closed, addEventListener: (_type: string, handler: typeof receive) => { receive = handler; } }; });
    vi.stubGlobal("BroadcastChannel", channelConstructor);
    const { session, fetcher } = await ready();
    expect(channelConstructor).toHaveBeenCalledWith("ritomer:session:v1");
    const pending = deferred<Response>();
    fetcher.mockReturnValueOnce(pending.promise).mockResolvedValueOnce(json(me));
    receive(new MessageEvent("message", { data: { type: "SESSION_CHANGED", extra: "ignored" } }));
    expect(session.getSnapshot().mode).toBe("SESSION_READY");
    receive(new MessageEvent("message", { data: { type: "SESSION_CHANGED" } }));
    expect(session.getSnapshot()).toMatchObject({ mode: "INITIALIZING", meState: null });
    pending.resolve(bootstrap());
    await session.initialize();
    expect(sent).not.toHaveBeenCalled();
    fetcher.mockResolvedValueOnce(new Response(null, { status: 204 })).mockResolvedValueOnce(bootstrap(false));
    await session.logout();
    expect(sent).toHaveBeenCalledTimes(1);
    expect(sent).toHaveBeenCalledWith({ type: "SESSION_CHANGED" });
    session.dispose();
    expect(closed).toHaveBeenCalledOnce();
  });

  it("invalidates a previously isolated final guard when a policy is installed", () => {
    const guard = captureSessionGuard();
    expect(guard()).toBe(true);
    const session = coordinator(vi.fn());
    expect(guard()).toBe(false);
    const installedGuard = captureSessionGuard();
    session.dispose();
    expect(installedGuard()).toBe(false);
    expect(guard()).toBe(false);
  });

  it.each(["", null, undefined])("blocks missing CSRF %j before a session can become ready or send a mutation", async (token) => {
    const fetcher = vi.fn().mockResolvedValue(json({ sessionState: "AUTHENTICATED", localLoginAvailable: true, csrf: { headerName: "X-CSRF-TOKEN", token } }));
    const session = coordinator(fetcher);
    await session.initialize();
    expect(session.getSnapshot()).toMatchObject({ mode: "ERROR", error: "invalid_response", meState: null });
    const mutation = vi.fn();
    await expect(requestJson("/api/business", { method: "POST" }, mutation)).rejects.toBeInstanceOf(SessionInvalidatedError);
    expect(mutation).not.toHaveBeenCalled();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("serializes logout after the login response and never publishes the abandoned login context", async () => {
    const loginResponse = deferred<Response>();
    const fetcher = vi.fn().mockResolvedValueOnce(bootstrap(false, "anonymous"))
      .mockReturnValueOnce(loginResponse.promise).mockResolvedValueOnce(bootstrap(true, "rotated"))
      .mockResolvedValueOnce(new Response(null, { status: 204 })).mockResolvedValueOnce(bootstrap(false, "logged-out"));
    const session = coordinator(fetcher);
    await session.initialize();
    const login = session.login(actor.actorKey);
    await Promise.resolve();
    const logout = session.logout();
    await Promise.resolve();
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(session.getSnapshot()).toMatchObject({ mode: "LOGGING_OUT", meState: null });
    loginResponse.resolve(new Response(null, { status: 204 }));
    await Promise.all([login, logout]);
    expect(fetcher.mock.calls.map(([path]) => path)).toEqual(["/api/session/bootstrap", "/api/session/local", "/api/session/bootstrap", "/api/session/logout", "/api/session/bootstrap"]);
    expect(fetcher.mock.calls[3][1].headers["X-CSRF-TOKEN"]).toBe("rotated");
    expect(session.getSnapshot().mode).toBe("ANONYMOUS");
  });

  it("never restores an authenticated context from the bootstrap after confirmed logout", async () => {
    const { session, fetcher } = await ready();
    fetcher.mockResolvedValueOnce(new Response(null, { status: 204 })).mockResolvedValueOnce(bootstrap(true, "unexpected"));
    await session.logout();
    expect(session.getSnapshot()).toMatchObject({ mode: "ERROR", meState: null, error: "invalid_response" });
    expect(fetcher.mock.calls.filter(([path]) => path === "/api/me")).toHaveLength(1);
    window.dispatchEvent(new Event("focus"));
    expect(fetcher).toHaveBeenCalledTimes(4);
  });
});

describe.each([
  ["export", (fetcher: Fetcher) => downloadExportPackContent(folderId, tenant, assetId, fetcher), `/api/closing-folders/${folderId}/export-packs/${assetId}/content`],
  ["document", (fetcher: Fetcher) => downloadWorkpaperDocument(folderId, tenant, { documentId: assetId }, fetcher), `/api/closing-folders/${folderId}/documents/${assetId}/content`]
] as const)("real %s binary client under session policy", (_name, download, path) => {
  it("keeps the Blob, exact headers, path and metadata", async () => {
    await ready();
    const blob = new Blob(["binary content"]);
    const fetcher = vi.fn().mockResolvedValue({ status: 200, headers: new Headers({ "Content-Type": "application/octet-stream", "Content-Disposition": "attachment; filename=proof.bin" }), blob: vi.fn().mockResolvedValue(blob) } as unknown as Response);
    const result = await download(fetcher);
    expect(result).toMatchObject({ kind: "success", blob });
    expect(fetcher.mock.calls[0][0]).toBe(path);
    expect(fetcher.mock.calls[0][1]).toMatchObject({ headers: { "X-Tenant-Id": tenant.tenantId }, credentials: "same-origin" });
    expect(fetcher.mock.calls[0][1].headers).toEqual({ "X-Tenant-Id": tenant.tenantId });
  });

  it("reports a current 401 to the coordinator", async () => {
    const { session } = await ready();
    await expect(download(vi.fn().mockResolvedValue(json({}, 401)))).resolves.toEqual({ kind: "auth_required" });
    expect(session.getSnapshot()).toMatchObject({ mode: "EXPIRED", meState: null });
  });

  it.each(["headers", "blob"] as const)("cancels during %s and ignores an old 401 or body after a new session", async (boundary) => {
    const { session, fetcher } = await ready();
    const headers = deferred<Response>();
    const body = deferred<Blob>();
    const blobReader = vi.fn().mockReturnValue(body.promise);
    const binaryFetcher = vi.fn().mockReturnValue(boundary === "headers" ? headers.promise : Promise.resolve({ status: 200, blob: blobReader, headers: new Headers() } as unknown as Response));
    const old = download(binaryFetcher);
    if (boundary === "blob") await vi.waitFor(() => expect(blobReader).toHaveBeenCalledOnce());
    await expect(requestJson("/api/expire", {}, vi.fn().mockResolvedValue(json({}, 401)))).rejects.toBeInstanceOf(SessionInvalidatedError);
    await expect(old).resolves.toEqual({ kind: "auth_required" });
    fetcher.mockResolvedValueOnce(bootstrap(true, "new-token")).mockResolvedValueOnce(json(me));
    await session.retry();
    const stable = session.getSnapshot();
    headers.resolve(json({}, 401));
    body.resolve(new Blob(["late"]));
    await Promise.resolve();
    await Promise.resolve();
    expect(session.getSnapshot()).toBe(stable);
    expect(stable.mode).toBe("SESSION_READY");
  });

  it.each(["headers", "blob"] as const)("cancels on logout during %s, including doubles ignoring abort", async (boundary) => {
    const { session, fetcher } = await ready();
    const body = deferred<Blob>();
    const blobReader = vi.fn().mockReturnValue(body.promise);
    const binaryFetcher = vi.fn().mockReturnValue(boundary === "headers" ? new Promise<Response>(() => {}) : Promise.resolve({ status: 200, blob: blobReader, headers: new Headers() } as unknown as Response));
    const pending = download(binaryFetcher);
    if (boundary === "blob") await vi.waitFor(() => expect(blobReader).toHaveBeenCalledOnce());
    fetcher.mockResolvedValueOnce(new Response(null, { status: 204 })).mockResolvedValueOnce(bootstrap(false));
    const logout = session.logout();
    await expect(pending).resolves.toEqual({ kind: "auth_required" });
    await logout;
    body.resolve(new Blob(["late"]));
    expect(session.getSnapshot().mode).toBe("ANONYMOUS");
  });

  it("enforces one 5000ms deadline across headers and a stalled Blob, then cleans timers", async () => {
    await ready();
    vi.useFakeTimers();
    const headers = deferred<Response>();
    const body = deferred<Blob>();
    const blobReader = vi.fn().mockReturnValue(body.promise);
    const result = download(vi.fn().mockReturnValue(headers.promise));
    await vi.advanceTimersByTimeAsync(4000);
    headers.resolve({ status: 200, headers: new Headers(), blob: blobReader } as unknown as Response);
    await vi.advanceTimersByTimeAsync(0);
    expect(blobReader).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(999);
    expect(vi.getTimerCount()).toBe(1);
    await vi.advanceTimersByTimeAsync(1);
    await expect(result).resolves.toEqual({ kind: "timeout" });
    expect(vi.getTimerCount()).toBe(0);
    body.resolve(new Blob(["too late"]));
    await Promise.resolve();
  });

  it("preserves ordinary body failure and network classifications", async () => {
    await ready();
    await expect(download(vi.fn().mockResolvedValue({ status: 200, headers: new Headers(), blob: () => Promise.reject(new Error("broken blob")) } as unknown as Response))).resolves.toEqual({ kind: "unexpected" });
    await expect(download(vi.fn().mockRejectedValue(new Error("offline")))).resolves.toEqual({ kind: "network_error" });
  });
});

describe("minimal context and safe return", () => {
  it.each([
    [401, {}, "auth_required", undefined], [403, { code: "ACCESS_DENIED" }, "profile_unavailable", "forbidden"],
    [403, { code: "ACCESS_REVOKED" }, "profile_unavailable", "access_revoked"], [404, {}, "profile_unavailable", "not_found"],
    [503, {}, "profile_unavailable", "server_error"], [200, {}, "profile_unavailable", "invalid_response"],
    [200, { activeTenant: null }, "tenant_context_required", undefined]
  ])("distinguishes me status %s", async (status, payload, kind, reason) => {
    const result = await loadMeShellState(vi.fn().mockResolvedValue(json(payload, status as number)));
    expect(result).toMatchObject({ kind, ...(reason ? { reason } : {}) });
  });

  it("never uses actor identifiers as display-name fallback", async () => {
    const result = await loadMeShellState(vi.fn().mockResolvedValue(json({ ...me, actor: { userId: assetId, externalSubject: "private" } })));
    expect(result).toEqual({ kind: "ready", activeTenant: tenant, effectiveRoles: ["ACCOUNTANT"] });
  });

  it.each(["/", `/closing-folders/${folderId}`])("accepts the exact allowed return %s", (path) => { expect(safeReturnPath(path)).toBe(path); });
  it.each(["//evil.test", "https://evil.test", "javascript:alert(1)", "/?next=x", "/#x", "/%2f", "/\\evil", "/\n", `/closing-folders/${folderId}?q=1`, `/closing-folders/${folderId}#x`, `/closing-folders/${folderId}\r\n`, "/closing-folders/AAAAAAAA-AAAA-AAAA-AAAA-AAAAAAAAAAAA", `/closing-folders/${folderId}/`, "/closing-folders/%32" ])("rejects unsafe return %j", (path) => { expect(safeReturnPath(path)).toBe("/"); });
});
