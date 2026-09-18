import { z } from "zod";
import {
  installSessionPolicy,
  requestSessionJson,
  SessionInvalidatedError,
  type Fetcher,
  type SessionRequestPolicy
} from "./http";
import { loadMeShellState, type MeShellState } from "./me";

const csrfSchema = z.object({ headerName: z.literal("X-CSRF-TOKEN"), token: z.string().min(1).max(4096) }).strict();
const actorSchema = z.object({ actorKey: z.string().min(1).max(128), displayLabel: z.string().min(1).max(200) }).strict();
const bootstrapSchema = z.discriminatedUnion("sessionState", [
  z.object({ sessionState: z.literal("ANONYMOUS"), localLoginAvailable: z.literal(true), csrf: csrfSchema, actors: z.array(actorSchema).max(50) }).strict(),
  z.object({ sessionState: z.literal("AUTHENTICATED"), localLoginAvailable: z.literal(true), csrf: csrfSchema }).strict()
]);

export type SessionErrorKind = "network_error" | "timeout" | "server_error" | "invalid_response" | "capability_unavailable" | "authentication_failed" | "access_denied" | "access_revoked" | "csrf_rejected" | "not_found";
export type SessionMode = "INITIALIZING" | "ANONYMOUS" | "AUTHENTICATING" | "SESSION_READY" | "LEGACY_PROXY_TRANSITION" | "EXPIRED" | "FORBIDDEN" | "CONTEXT_REQUIRED" | "ERROR" | "LOGGING_OUT" | "LOGOUT_UNCONFIRMED";
export interface SessionSnapshot {
  mode: SessionMode;
  generation: number;
  meState: MeShellState | null;
  actors: readonly z.infer<typeof actorSchema>[];
  localLoginAvailable: boolean;
  error: SessionErrorKind | null;
}

class SessionFailure extends Error {
  constructor(readonly kind: SessionErrorKind) { super(kind); }
}

export function safeReturnPath(path: string): string {
  return /^(?:\/|\/closing-folders\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?![\s\S])/.test(path) ? path : "/";
}

export function createSessionCoordinator(fetcher: Fetcher = fetch) {
  let snapshot: SessionSnapshot = { mode: "INITIALIZING", generation: 0, meState: null, actors: [], localLoginAvailable: false, error: null };
  let csrf: string | null = null;
  let capability: "unknown" | "session" | "legacy" = "unknown";
  let pending: Promise<void> | null = null;
  let initialized = false;
  let bootstrapAttempted = false;
  let disposed = false;
  let generationController = new AbortController();
  let returnPath = "/";
  let uninstall: (() => void) | null = null;
  let channel: BroadcastChannel | null = null;
  const listeners = new Set<() => void>();
  const invalidations = new Set<() => void>();

  function publish(update: Partial<SessionSnapshot>) {
    if (disposed) return;
    snapshot = { ...snapshot, ...update };
    listeners.forEach((listener) => listener());
  }

  function advance(cancelNegotiation = true) {
    snapshot = { ...snapshot, generation: snapshot.generation + 1 };
    if (cancelNegotiation) generationController.abort();
    generationController = new AbortController();
    invalidations.forEach((listener) => listener());
  }

  function clear(mode: SessionMode, error: SessionErrorKind | null = null, cancelNegotiation = true) {
    csrf = null;
    advance(cancelNegotiation);
    publish({ mode, meState: null, actors: [], localLoginAvailable: false, error });
  }

  function current(generation: number) { return !disposed && snapshot.generation === generation; }

  function run(operation: () => Promise<void>): Promise<void> {
    if (pending) return pending;
    const task = Promise.resolve().then(operation).finally(() => { if (pending === task) pending = null; });
    pending = task;
    return task;
  }

  function errorKind(error: unknown): SessionErrorKind {
    if (error instanceof SessionFailure) return error.kind;
    return error instanceof Error && error.message === "timeout" ? "timeout" : "network_error";
  }

  async function boundedSessionRead<T>(read: () => Promise<T>, signal = generationController.signal): Promise<T> {
    if (signal.aborted) throw new SessionInvalidatedError();
    let timer = 0;
    let stop = () => {};
    try {
      return await Promise.race([
        read(),
        new Promise<never>((_, reject) => {
          timer = window.setTimeout(() => reject(new Error("timeout")), 5000);
          stop = () => reject(new SessionInvalidatedError());
          signal.addEventListener("abort", stop, { once: true });
        })
      ]);
    } finally {
      window.clearTimeout(timer);
      signal.removeEventListener("abort", stop);
    }
  }

  async function responseError(response: Response): Promise<SessionErrorKind> {
    let code: unknown;
    try { code = (await boundedSessionRead(() => response.json()) as { code?: unknown }).code; } catch { /* Do not expose server messages. */ }
    if (code === "ACCESS_REVOKED") return "access_revoked";
    if (code === "CSRF_REJECTED") return "csrf_rejected";
    if (response.status === 401) return "authentication_failed";
    if (response.status === 403) return "access_denied";
    if (response.status === 404) return "capability_unavailable";
    return "server_error";
  }

  async function bootstrap() {
    bootstrapAttempted = true;
    const signal = generationController.signal;
    const response = await requestSessionJson("/api/session/bootstrap", { method: "GET", signal }, fetcher);
    if (response.status !== 200) return { response, data: null };
    let payload: unknown;
    try { payload = await boundedSessionRead(() => response.json(), signal); } catch (error) {
      if (error instanceof Error && error.message === "timeout") throw error;
      if (error instanceof SessionInvalidatedError) throw error;
      throw new SessionFailure("invalid_response");
    }
    const parsed = bootstrapSchema.safeParse(payload);
    if (!parsed.success) throw new SessionFailure("invalid_response");
    return { response, data: parsed.data };
  }

  const meRequester: typeof requestSessionJson = (input, init, injectedFetcher, timeoutMs) => requestSessionJson(input, { ...init, signal: generationController.signal }, injectedFetcher, timeoutMs);
  const loadMe = () => boundedSessionRead(() => loadMeShellState(fetcher, meRequester));

  async function negotiate(generation: number, mayRecoverInitial401: boolean, expectAnonymous = false) {
    try {
      if (capability === "legacy") {
        const meState = await loadMe();
        if (current(generation)) publish({ mode: "LEGACY_PROXY_TRANSITION", meState, error: null });
        return;
      }
      const mayEnterLegacy = !bootstrapAttempted && capability === "unknown";
      const result = await bootstrap();
      if (!current(generation)) return;
      if (result.response.status === 404 && mayEnterLegacy) {
        capability = "legacy";
        const meState = await loadMe();
        if (current(generation)) publish({ mode: "LEGACY_PROXY_TRANSITION", meState, error: null });
        return;
      }
      if (result.response.status === 401 && mayRecoverInitial401) {
        await negotiate(generation, false);
        return;
      }
      if (result.response.status === 401 && snapshot.mode === "SESSION_READY") {
        clear("EXPIRED");
        return;
      }
      if (!result.data) throw new SessionFailure(await responseError(result.response));
      capability = "session";
      if (result.data.sessionState === "ANONYMOUS") {
        if (snapshot.mode === "SESSION_READY") {
          clear("EXPIRED");
          return;
        }
        csrf = result.data.csrf.token;
        publish({ mode: "ANONYMOUS", meState: null, actors: result.data.actors, localLoginAvailable: result.data.localLoginAvailable, error: null });
        return;
      }
      if (expectAnonymous) throw new SessionFailure("invalid_response");
      const meState = await loadMe();
      if (!current(generation)) return;
      if (meState.kind === "auth_required") {
        if (mayRecoverInitial401 && snapshot.mode !== "SESSION_READY") {
          await negotiate(generation, false);
        } else clear("EXPIRED");
        return;
      }
      if (meState.kind === "profile_unavailable") {
        if (meState.reason === "forbidden" || meState.reason === "access_revoked") {
          clear("FORBIDDEN", meState.reason === "access_revoked" ? "access_revoked" : "access_denied");
        } else clear("ERROR", meState.reason ?? "invalid_response");
        return;
      }
      const sameContext = snapshot.mode === "SESSION_READY" && csrf === result.data.csrf.token && JSON.stringify(snapshot.meState) === JSON.stringify(meState);
      if (sameContext) return;
      if (snapshot.meState !== null) advance();
      csrf = result.data.csrf.token;
      publish({ mode: meState.kind === "ready" ? "SESSION_READY" : "CONTEXT_REQUIRED", meState, actors: [], localLoginAvailable: true, error: null });
    } catch (error) {
      if (!current(generation)) return;
      const kind = errorKind(error);
      clear(kind === "access_denied" || kind === "access_revoked" ? "FORBIDDEN" : "ERROR", kind);
    }
  }

  function initialize(): Promise<void> {
    if (disposed) return Promise.resolve();
    if (initialized) return pending ?? Promise.resolve();
    initialized = true;
    const generation = snapshot.generation;
    return run(() => negotiate(generation, true));
  }

  function revalidate(): Promise<void> {
    if (disposed || !["SESSION_READY", "ANONYMOUS", "LEGACY_PROXY_TRANSITION", "CONTEXT_REQUIRED"].includes(snapshot.mode)) return pending ?? Promise.resolve();
    const generation = snapshot.generation;
    return run(() => negotiate(generation, false));
  }

  function notifyOtherTabs() {
    try { channel?.postMessage({ type: "SESSION_CHANGED" }); } catch { /* Focus/visibility remain available. */ }
  }

  function login(actorKey: string): Promise<void> {
    if (pending) return pending;
    if (disposed || snapshot.mode !== "ANONYMOUS" || !csrf || !snapshot.actors.some((actor) => actor.actorKey === actorKey)) return Promise.resolve();
    const token = csrf;
    const generation = snapshot.generation;
    publish({ mode: "AUTHENTICATING", error: null });
    return run(async () => {
      try {
        const response = await requestSessionJson("/api/session/local", { method: "POST", headers: { "Content-Type": "application/json", "X-CSRF-TOKEN": token }, body: JSON.stringify({ actorKey }), signal: generationController.signal }, fetcher);
        if (!current(generation)) return;
        if (response.status !== 204) {
          const kind = await responseError(response);
          if (!current(generation)) return;
          if (kind === "authentication_failed") {
            publish({ mode: "ANONYMOUS", error: kind });
            return;
          }
          throw new SessionFailure(kind);
        }
        clear("INITIALIZING");
        notifyOtherTabs();
        await negotiate(snapshot.generation, false);
      } catch (error) {
        if (current(generation)) clear("ERROR", errorKind(error));
      }
    });
  }

  function logout(): Promise<void> {
    if (snapshot.mode === "LOGGING_OUT") return pending ?? Promise.resolve();
    if (disposed || capability !== "session") return Promise.resolve();
    const recoveringUnconfirmed = snapshot.mode === "LOGOUT_UNCONFIRMED";
    const previous = pending;
    const token = csrf;
    clear("LOGGING_OUT", null, snapshot.mode !== "AUTHENTICATING");
    const generation = snapshot.generation;
    pending = null;
    return run(async () => {
      try {
        await previous;
        if (!current(generation)) return;
        let logoutToken = token;
        if (!logoutToken || previous) {
          let result = await bootstrap();
          if (!current(generation)) return;
          if (recoveringUnconfirmed && result.response.status === 401) {
            result = await bootstrap();
            if (!current(generation)) return;
          }
          if (!result.data) throw new SessionFailure(await responseError(result.response));
          if (recoveringUnconfirmed && result.data.sessionState === "ANONYMOUS") {
            // This confirms current anonymity, not receipt of the lost logout response.
            csrf = result.data.csrf.token;
            publish({ mode: "ANONYMOUS", meState: null, actors: result.data.actors, localLoginAvailable: result.data.localLoginAvailable, error: null });
            return;
          }
          logoutToken = result.data.csrf.token;
        }
        const response = await requestSessionJson("/api/session/logout", { method: "POST", headers: { "X-CSRF-TOKEN": logoutToken }, signal: generationController.signal }, fetcher);
        if (!current(generation)) return;
        if (response.status !== 204) throw new SessionFailure(await responseError(response));
        notifyOtherTabs();
        await negotiate(generation, false, true);
      } catch (error) {
        if (current(generation)) publish({ mode: "LOGOUT_UNCONFIRMED", error: errorKind(error) });
      }
    });
  }

  function retry(): Promise<void> {
    if (snapshot.mode === "LOGOUT_UNCONFIRMED") return logout();
    if (pending) return pending;
    if (disposed) return Promise.resolve();
    clear("INITIALIZING");
    const generation = snapshot.generation;
    return run(() => negotiate(generation, false));
  }

  const policy: SessionRequestPolicy = {
    generation: () => snapshot.generation,
    prepare(init) {
      if (disposed || !["SESSION_READY", "LEGACY_PROXY_TRANSITION"].includes(snapshot.mode)) throw new SessionInvalidatedError();
      if (snapshot.mode === "LEGACY_PROXY_TRANSITION" || ["GET", "HEAD", "OPTIONS"].includes((init.method ?? "GET").toUpperCase())) return init;
      if (!csrf) throw new SessionInvalidatedError();
      const headers = init.headers instanceof Headers ? Object.fromEntries(init.headers.entries()) : Array.isArray(init.headers) ? Object.fromEntries(init.headers) : init.headers;
      const businessHeaders = Object.fromEntries(Object.entries(headers ?? {}).filter(([name]) => name.toLowerCase() !== "x-csrf-token"));
      return { ...init, headers: { ...businessHeaders, "X-CSRF-TOKEN": csrf } };
    },
    async observe(response, isRequestCurrent) {
      if (!isRequestCurrent() || snapshot.mode === "LEGACY_PROXY_TRANSITION") return;
      const generation = snapshot.generation;
      if (response.status === 401) { clear("EXPIRED"); return; }
      if (response.status !== 403) return;
      let code: unknown;
      try { code = (await response.clone().json() as { code?: unknown }).code; } catch { return; }
      if (!isRequestCurrent() || !current(generation)) return;
      if (code === "ACCESS_REVOKED") clear("FORBIDDEN", "access_revoked");
      if (code === "CSRF_REJECTED") {
        const previous = pending;
        clear("INITIALIZING", "csrf_rejected");
        const nextGeneration = snapshot.generation;
        pending = null;
        // Only session negotiation is retried; the rejected mutation is never replayed.
        void run(async () => { await previous; if (current(nextGeneration)) await negotiate(nextGeneration, false); });
      }
    },
    onInvalidate(listener) { invalidations.add(listener); return () => { invalidations.delete(listener); }; }
  };

  const onFocus = () => { if (document.visibilityState !== "hidden") void revalidate(); };
  const onMessage = (event: MessageEvent<unknown>) => {
    const data = event.data;
    if (typeof data !== "object" || data === null || Object.keys(data).length !== 1 || !("type" in data) || data.type !== "SESSION_CHANGED") return;
    if (!["SESSION_READY", "ANONYMOUS", "LEGACY_PROXY_TRANSITION", "CONTEXT_REQUIRED"].includes(snapshot.mode)) return;
    clear("INITIALIZING");
    const generation = snapshot.generation;
    pending = null;
    void run(() => negotiate(generation, false));
  };

  function dispose() {
    if (disposed) return;
    clear("INITIALIZING");
    disposed = true;
    uninstall?.();
    uninstall = null;
    window.removeEventListener("focus", onFocus);
    document.removeEventListener("visibilitychange", onFocus);
    channel?.close();
    channel = null;
    listeners.clear();
    invalidations.clear();
  }

  return {
    install() {
      if (!uninstall && !disposed) {
        uninstall = installSessionPolicy(policy);
        window.addEventListener("focus", onFocus);
        document.addEventListener("visibilitychange", onFocus);
        try {
          if (typeof BroadcastChannel !== "undefined") {
            channel = new BroadcastChannel("ritomer:session:v1");
            channel.addEventListener("message", onMessage);
          }
        } catch { channel = null; }
      }
      return dispose;
    },
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    getSnapshot: () => snapshot,
    initialize, login, logout, retry, revalidate, dispose,
    setReturnPath(path: string) { returnPath = safeReturnPath(path); },
    getReturnPath: () => returnPath
  };
}

export type SessionCoordinator = ReturnType<typeof createSessionCoordinator>;
