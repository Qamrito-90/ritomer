import { createHash } from "node:crypto";
import { closeSync, constants, fsyncSync, lstatSync, mkdirSync, mkdtempSync, openSync, readdirSync, realpathSync, writeFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import { spawn } from "node:child_process";
import type { Readable, Writable } from "node:stream";
import path from "node:path";
import type { Browser, BrowserContext, BrowserType, ConnectOverCDPTransport, Route } from "@playwright/test";
import type { FullConfig, FullResult, Reporter, Suite, TestCase, TestResult, TestStep } from "@playwright/test/reporter";

export const ORIGIN = "http://127.0.0.1:5173";
export const IDLE_MS = 32 * 60 * 1000;
export const WINDOWS = ["anonymous", "authenticated", "folder", "write", "csrf", "roles", "before-idle", "expired", "reconnected", "logout"] as const;
export const METRICS = ["emittedCookie", "acceptedCookie", "continuity", "login", "rotation", "authenticated", "me", "noteWrite", "noteRead", "roleRefusal", "roleReadOnly", "csrfRefusal", "csrfRenewal", "csrfReplay", "idleStart", "idleEnd", "idleRequests", "expiredResponse", "expiredUI", "automaticLogin", "explicitLogin", "safeReturn", "logout", "logoutInvalidated", "anonymousAfterLogout", "otherContextReady", "sharedLogout", "nativeFocus", "nativeVisibility", "keyboard", "narrow", "privacyScans", "privacyViolations", "lostObservations", "pagesClosed", "contextsClosed", "browserDisconnected"] as const;
export type Metric = typeof METRICS[number];
export type Kind = "cookie" | "browser";
export interface Binding { kind: Kind; runId: string; objectSha: string; runtimeSha: string; frontendSha: string; root: string; executable: string; discovery: boolean }
export interface Observation { event: Metric; atMs: number; value: number }
export interface Evidence { schemaVersion: 1; kind: Kind; runId: string; objectSha: string; runtimeSha: string; frontendSha: string; browserVersion: string; observations: Observation[]; windows: string[]; cookieDiagnostic?: CookieDiagnostic; browserDiagnostic?: BrowserDiagnostic }
export const BROWSER_STEPS = ["BINDING", "LAUNCH", "CONTEXT", "COOKIE", "OPEN_FOLDER", "FIND_NOTE", "SAVE_NOTE", "RELOAD_NOTE", "CSRF_REFUSAL", "REVIEWER_ROLE", "FOCUS_VISIBILITY", "IDLE", "EXPIRY", "RECONNECT", "ISOLATED_REVIEWER", "LOGOUT", "SHARED_LOGOUT", "PRIVACY", "FINALIZATION", "REPORTER", "PUBLICATION"] as const;
export const BROWSER_REASONS = ["OPERATION_FAILED", "TIMEOUT", "ASSERTION", "LOCATOR_AMBIGUOUS", "NO_RESPONSE", "UNAVAILABLE"] as const;
export type BrowserStep = typeof BROWSER_STEPS[number];
export const BROWSER_OPERATIONS = ["NATIVE_CONNECT", "CREATE_CONTEXT", "CREATE_PAGE", "INSTALL_OBSERVER", "CLOSE_PAGE", "READ_RESPONSE_HEADERS", "READ_RESPONSE_JSON", "OBSERVER_FLUSH", "PAGE_FLUSH", "PAGE_SNAPSHOT", "REVIEWER_FETCH", "ACTIVATE_PAGE", "READ_PAGE_STATE", "CLOSE_CONTEXT", "READ_COOKIES", "IDLE_WAIT"] as const;
export type BrowserOperation = typeof BROWSER_OPERATIONS[number];
type BrowserDiagnosticV1 = { schemaVersion: 1; source: "SCENARIO" | "REPORTER" | "PUBLICATION"; step: BrowserStep; lastCompleted: BrowserStep | null; reason: typeof BROWSER_REASONS[number] };
export type BrowserOperationDiagnostic = { schemaVersion: 2; source: "SCENARIO" | "REPORTER"; step: BrowserStep; lastCompleted: null; reason: "OPERATION_FAILED" | "TIMEOUT";
  operation: BrowserOperation; operationState: "PENDING" | "FAILED"; lastCompletedOperation: BrowserOperation | null };
export type BrowserDiagnostic = BrowserDiagnosticV1 | BrowserOperationDiagnostic;
export function browserOperationTitle(step: BrowserStep, operation: BrowserOperation): string {
  check(BROWSER_STEPS.includes(step) && !["REPORTER", "PUBLICATION"].includes(step) && BROWSER_OPERATIONS.includes(operation));
  return `M1D_OPERATION|${step}|${operation}`;
}
function operationFromTitle(title: string): { step: BrowserStep; operation: BrowserOperation } | undefined {
  if (typeof title !== "string" || title.length > 128) return;
  const parts = title.split("|");
  if (parts.length !== 3 || parts[0] !== "M1D_OPERATION" || !BROWSER_STEPS.includes(parts[1] as BrowserStep)
    || ["REPORTER", "PUBLICATION"].includes(parts[1]) || !BROWSER_OPERATIONS.includes(parts[2] as BrowserOperation)) return;
  return { step: parts[1] as BrowserStep, operation: parts[2] as BrowserOperation };
}
export function validateBrowserDiagnostic(value: unknown): BrowserDiagnostic {
  const d = value as BrowserDiagnostic;
  if (d?.schemaVersion === 2) {
    if (!exact(d, ["schemaVersion", "source", "step", "lastCompleted", "reason", "operation", "operationState", "lastCompletedOperation"])
      || !["SCENARIO", "REPORTER"].includes(d.source) || !BROWSER_STEPS.includes(d.step) || ["REPORTER", "PUBLICATION"].includes(d.step)
      || d.lastCompleted !== null || !["OPERATION_FAILED", "TIMEOUT"].includes(d.reason) || !BROWSER_OPERATIONS.includes(d.operation)
      || !["PENDING", "FAILED"].includes(d.operationState) || (d.source === "SCENARIO" && d.operationState !== "FAILED")
      || (d.lastCompletedOperation !== null && !BROWSER_OPERATIONS.includes(d.lastCompletedOperation))) throw fail("OBSERVATION");
    return { ...d };
  }
  if (!d || !exact(d, ["schemaVersion", "source", "step", "lastCompleted", "reason"]) || d.schemaVersion !== 1
    || !["SCENARIO", "REPORTER", "PUBLICATION"].includes(d.source) || !BROWSER_STEPS.includes(d.step) || !BROWSER_REASONS.includes(d.reason)
    || (d.lastCompleted !== null && (!BROWSER_STEPS.includes(d.lastCompleted) || ["REPORTER", "PUBLICATION"].includes(d.lastCompleted)))
    || (d.source === "SCENARIO" && ["REPORTER", "PUBLICATION"].includes(d.step))
    || (d.source === "REPORTER" && (d.step !== "REPORTER" || d.reason !== "UNAVAILABLE" || d.lastCompleted !== null))
    || (d.source === "PUBLICATION" && (d.step !== "PUBLICATION" || d.reason !== "OPERATION_FAILED" || d.lastCompleted !== null))) throw fail("OBSERVATION");
  return { ...d };
}
function browserReason(error: unknown): BrowserDiagnostic["reason"] {
  // Classify in memory only. No incoming message, stack or property is returned.
  try {
    if (error instanceof Error) {
      if (error.name === "TimeoutError") return "TIMEOUT";
      if (error.message.includes("strict mode violation")) return "LOCATOR_AMBIGUOUS";
      if (error.message === "M1D_ASSERTION_FAILED") return "ASSERTION";
    }
  } catch { /* Unknown or hostile error properties remain opaque. */ }
  return "OPERATION_FAILED";
}
export const COOKIE_STEPS = ["NAVIGATION", "BOOTSTRAP_RESPONSE", "BOOTSTRAP_BODY", "ANONYMOUS_UI", "COOKIE_EMISSION", "COOKIE_ACCEPTANCE", "ANONYMOUS_PRIVACY", "CONTINUITY_RESPONSE", "CONTINUITY_BODY", "CONTINUITY_UI", "CONTINUITY", "LOGIN_ACTION", "LOGIN_RESPONSE", "ROTATION", "AUTHENTICATED_RESPONSE", "AUTHENTICATED_BODY", "ME_RESPONSE", "ME_BODY", "ROLE", "AUTHENTICATED_UI", "AUTHENTICATED_PRIVACY", "OBSERVER", "FINAL_PRIVACY", "FINALIZATION", "REDUCER", "REPORTER"] as const;
export const COOKIE_REASONS = ["OPERATION_FAILED", "NO_RESPONSE", "HTTP_STATUS", "INVALID_BODY", "STATE", "UI_NOT_REACHED", "COOKIE_ABSENT", "COOKIE_COUNT", "COMPARISON", "ROLE", "PRIVACY", "METRIC", "PROTOCOL", "UNAVAILABLE", "FINALIZATION"] as const;
export const COOKIE_API_CODES = ["AUTHENTICATION_FAILED", "AUTHENTICATION_REQUIRED", "CSRF_REJECTED", "ACCESS_DENIED", "ACCESS_REVOKED", "SESSION_EXPIRED", "SESSION_ALREADY_AUTHENTICATED", "INVALID_REQUEST", "REQUEST_REJECTED", "OTHER"] as const;
export type CookieStep = typeof COOKIE_STEPS[number];
export type CookieReason = typeof COOKIE_REASONS[number];
export function emptyCookieFacts() {
  return { bootstrapStatus: null as number | null, bootstrapState: null as "ANONYMOUS" | "AUTHENTICATED" | "OTHER" | null,
    continuityStatus: null as number | null, continuityState: null as "ANONYMOUS" | "AUTHENTICATED" | "OTHER" | null,
    loginStatus: null as number | null, loginCode: null as typeof COOKIE_API_CODES[number] | null,
    authenticatedStatus: null as number | null, authenticatedState: null as "ANONYMOUS" | "AUTHENTICATED" | "OTHER" | null,
    meStatus: null as number | null, meCode: null as typeof COOKIE_API_CODES[number] | null,
    emittedCount: null as number | null, emittedMask: null as number | null, acceptedCount: null as number | null, acceptedMask: null as number | null,
    continuity: null as boolean | null, rotation: null as boolean | null, roleMatches: null as boolean | null,
    privacyScans: null as number | null, privacyViolations: null as number | null, lostObservations: null as number | null };
}
export const PRIVACY_RULES = ["PROTECTED_VALUE_MATCH", "AUTHORIZATION_HEADER", "TENANT_SESSION_HEADER", "AUTHORIZATION_AND_TENANT_SESSION_HEADERS", "CHANNEL_SHAPE"] as const;
export const PRIVACY_SURFACES = ["REQUEST_HEADERS", "DOM", "FORM_FIELD", "URL", "DOCUMENT_COOKIE", "LOCAL_STORAGE", "SESSION_STORAGE", "INDEXED_DB", "CONSOLE", "CHANNEL", "AMBIGUOUS"] as const;
export const PRIVACY_VALUE_CATEGORIES = ["SESSION_COOKIE", "CSRF_TOKEN", "ACTOR_KEY", "USER_ID", "SUBJECT", "TENANT_ID", "MEMBERSHIP_ID", "ACTOR_ID", "AMBIGUOUS", "NONE"] as const;
export type PrivacySurface = typeof PRIVACY_SURFACES[number];
export type PrivacyValueCategory = typeof PRIVACY_VALUE_CATEGORIES[number];
export interface PrivacyViolation { readonly rule: typeof PRIVACY_RULES[number]; readonly surface: PrivacySurface; readonly valueCategory: PrivacyValueCategory }
export function validatePrivacyViolation(value: unknown): PrivacyViolation {
  const v = value as PrivacyViolation;
  if (!v || !exact(v, ["rule", "surface", "valueCategory"]) || !PRIVACY_RULES.includes(v.rule)
    || !PRIVACY_SURFACES.includes(v.surface) || !PRIVACY_VALUE_CATEGORIES.includes(v.valueCategory)) throw fail("OBSERVATION");
  const valid = v.rule === "PROTECTED_VALUE_MATCH" ? v.surface !== "REQUEST_HEADERS" && v.valueCategory !== "NONE"
    : v.rule === "CHANNEL_SHAPE" ? v.surface === "CHANNEL" && v.valueCategory === "NONE"
    : v.surface === "REQUEST_HEADERS" && v.valueCategory === (v.rule === "AUTHORIZATION_HEADER" ? "NONE"
      : v.rule === "TENANT_SESSION_HEADER" ? "TENANT_ID" : "AMBIGUOUS");
  if (!valid) throw fail("OBSERVATION");
  return Object.freeze({ rule: v.rule, surface: v.surface, valueCategory: v.valueCategory });
}
interface CookieDiagnosticFields { source: "BROWSER" | "REDUCER" | "REPORTER"; step: CookieStep; lastCompleted: CookieStep | null; reason: CookieReason; metric: Metric | "windows" | null; facts: ReturnType<typeof emptyCookieFacts> }
export type CookieDiagnostic = CookieDiagnosticFields & ({ schemaVersion: 1 } | { schemaVersion: 2; firstPrivacyViolation: PrivacyViolation | null });
export function validateCookieDiagnostic(value: unknown): CookieDiagnostic {
  const d = value as CookieDiagnostic;
  if (!d || ![1, 2].includes(d.schemaVersion) || !exact(d, ["schemaVersion", "source", "step", "lastCompleted", "reason", "metric", "facts", ...(d.schemaVersion === 2 ? ["firstPrivacyViolation"] : [])])
    || !["BROWSER", "REDUCER", "REPORTER"].includes(d.source) || !COOKIE_STEPS.includes(d.step)
    || (d.lastCompleted !== null && !COOKIE_STEPS.includes(d.lastCompleted)) || !COOKIE_REASONS.includes(d.reason)
    || (d.metric !== null && d.metric !== "windows" && !METRICS.includes(d.metric)) || !d.facts || !exact(d.facts, Object.keys(emptyCookieFacts()))) throw fail("OBSERVATION");
  for (const [key, v] of Object.entries(d.facts)) {
    if (v === null) continue;
    const valid = key.endsWith("Status") ? Number.isInteger(v) && Number(v) >= 100 && Number(v) <= 599
      : key.endsWith("State") ? ["ANONYMOUS", "AUTHENTICATED", "OTHER"].includes(v as string)
      : key.endsWith("Code") ? COOKIE_API_CODES.includes(v as typeof COOKIE_API_CODES[number])
      : ["continuity", "rotation", "roleMatches"].includes(key) ? typeof v === "boolean"
      : typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= (key.endsWith("Mask") ? 31 : 1_000_000);
    if (!valid) throw fail("OBSERVATION");
  }
  if (d.source === "REDUCER" && (d.step !== "REDUCER" || d.reason !== "METRIC" || d.metric === null)) throw fail("OBSERVATION");
  if (d.source !== "REDUCER" && d.metric !== null) throw fail("OBSERVATION");
  if ((d.source === "REPORTER" && (d.step !== "REPORTER" || d.reason !== "UNAVAILABLE"))
    || (d.source === "BROWSER" && ["REDUCER", "REPORTER"].includes(d.step))
    || (d.lastCompleted !== null && ["REDUCER", "REPORTER"].includes(d.lastCompleted))) throw fail("OBSERVATION");
  return d.schemaVersion === 2 ? { ...d, facts: { ...d.facts }, firstPrivacyViolation: d.firstPrivacyViolation === null ? null : validatePrivacyViolation(d.firstPrivacyViolation) }
    : { ...d, facts: { ...d.facts } };
}
const SHA = /^[0-9a-f]{64}$/;
const RUN = /^[0-9a-f]{32}$/;
const TEST_RUN = "0".repeat(32);
const TEST_SHA = "0".repeat(64);
const ROOT = "C:\\dev\\ritomer-local-evidence\\m1-1b-postgresql";
// Fixed, already installed distribution. Never enumerate a user profile/cache.
export const BROWSER = "C:\\Users\\LuisAllauca\\AppData\\Local\\ms-playwright\\chromium-1200\\chrome-win64\\chrome.exe";

export function fail(code: "BINDING" | "OBSERVATION" | "ASSERTION" | "BROWSER" | "FINALIZATION" | "PUBLICATION" | "RUNNER"): Error {
  return new Error(`M1D_${code}_FAILED`);
}
export function check(condition: unknown): asserts condition { if (!condition) throw fail("ASSERTION"); }
// Never preserve the incoming message, stack, cause or custom properties.
export function sanitizeFailure(error: unknown): Error { void error; return fail("BROWSER"); }
export type RunStep = "BINDING" | "LAUNCH" | "CONTEXT" | "COOKIE" | "JOURNEY" | "PRIVACY";
type AsyncStep = "RESPONSE" | "ROUTE" | "OBSERVER";
type Captured<T> = { ok: true; value: T } | { ok: false };

// Response waits are handled when created, before the action can fail. The
// stored promise always fulfills; only an explicitly awaited read can throw.
export class BrowserFailures {
  readonly diagnostics: string[] = [];
  readonly cookieFacts = emptyCookieFacts();
  cookieDiagnostic?: CookieDiagnostic;
  lastCookieControl: CookieStep | null = null;
  browserDiagnostic?: BrowserDiagnostic;
  private browserStep: BrowserStep = "BINDING";
  private lastBrowserControl: BrowserStep | null = null;
  private lastOperation: BrowserOperation | null = null;
  get currentBrowserStep(): BrowserStep { return this.browserStep; }
  completeOperation(operation: BrowserOperation) { if (!this.browserDiagnostic) this.lastOperation = operation; }
  operationFailure(step: BrowserStep, operation: BrowserOperation, error: unknown) {
    this.browserDiagnostic ??= validateBrowserDiagnostic({ schemaVersion: 2, source: "SCENARIO", step, lastCompleted: null,
      reason: browserReason(error) === "TIMEOUT" ? "TIMEOUT" : "OPERATION_FAILED", operation, operationState: "FAILED", lastCompletedOperation: this.lastOperation });
  }
  setBrowserStep(step: BrowserStep) {
    if (!BROWSER_STEPS.includes(step) || ["REPORTER", "PUBLICATION"].includes(step)) throw fail("OBSERVATION");
    if (!this.browserDiagnostic && this.browserStep !== step) this.lastBrowserControl = this.browserStep;
    this.browserStep = step;
  }
  browserFailure(error?: unknown, step = this.browserStep, reason = browserReason(error), lastCompleted = this.lastBrowserControl) {
    this.browserDiagnostic ??= validateBrowserDiagnostic({ schemaVersion: 1, source: "SCENARIO", step, lastCompleted, reason });
  }
  private firstPrivacyViolation: PrivacyViolation | null = null;
  private readonly pending = new Set<Promise<unknown>>();
  notePrivacyViolation(value: PrivacyViolation) {
    this.firstPrivacyViolation ??= validatePrivacyViolation(value);
    // Privacy can first be observed during finalization after an earlier HTTP
    // failure. Add only its first category; the original failure and facts
    // remain the snapshot taken at that earlier failure. Never enrich v1.
    const diagnostic = this.cookieDiagnostic;
    if (diagnostic?.schemaVersion === 2 && diagnostic.firstPrivacyViolation === null)
      this.cookieDiagnostic = validateCookieDiagnostic({ ...diagnostic, firstPrivacyViolation: this.firstPrivacyViolation });
  }
  cookieFailure(step: CookieStep, reason: CookieReason) {
    if (this.cookieDiagnostic) return;
    const detail = { schemaVersion: 2 as const, source: "BROWSER" as const, step, reason, lastCompleted: this.lastCookieControl, metric: null, facts: this.cookieFacts, firstPrivacyViolation: this.firstPrivacyViolation };
    try { this.cookieDiagnostic = validateCookieDiagnostic(detail); }
    catch {
      // A non-publishable counter must not erase an already observed HTTP
      // status. Project each field through the same validator, without raw data.
      let facts = emptyCookieFacts();
      for (const key of Object.keys(facts) as Array<keyof typeof facts>) {
        const candidate = { ...facts, [key]: this.cookieFacts[key] };
        try { validateCookieDiagnostic({ ...detail, facts: candidate }); facts = candidate; } catch { /* This field remains unavailable. */ }
      }
      this.cookieDiagnostic = validateCookieDiagnostic({ ...detail, facts });
    }
  }
  async cookieControl<T>(step: CookieStep, reason: CookieReason, operation: () => Promise<T>): Promise<T> {
    try { const value = await operation(); if (!this.cookieDiagnostic) this.lastCookieControl = step; return value; }
    catch { this.cookieFailure(step, reason); throw fail("ASSERTION"); }
  }
  note(step: RunStep | AsyncStep) {
    const code = `M1D_${step}_FAILED`;
    if (!this.diagnostics.includes(code)) this.diagnostics.push(code);
  }
  capture<T>(step: AsyncStep, operation: () => Promise<T>, cookieStep?: CookieStep, reason: CookieReason = "OPERATION_FAILED"): Promise<Captured<T>> {
    // cookieStep belongs to this operation, not to the scenario's later await.
    const browserStep = this.browserStep;
    const lastCompleted = this.lastBrowserControl;
    const rejected = () => { if (cookieStep) this.cookieFailure(cookieStep, reason); this.browserFailure(undefined, browserStep, step === "RESPONSE" ? "NO_RESPONSE" : "OPERATION_FAILED", lastCompleted); this.note(step); return { ok: false } as const; };
    let work: Promise<T>;
    try { work = operation(); } catch { return Promise.resolve(rejected()); }
    const settled = Promise.resolve(work).then(value => {
      this.pending.delete(settled); return { ok: true, value } as const;
    }, () => {
      this.pending.delete(settled); return rejected();
    });
    this.pending.add(settled);
    return settled;
  }
  route(handler: (route: Route) => Promise<void>): (route: Route) => Promise<void> {
    return route => this.capture("ROUTE", () => handler(route)).then(() => undefined);
  }
  async drain() { while (this.pending.size) await Promise.all(this.pending); }
}
export function capturedValue<T>(result: Captured<T>): T {
  if (!result.ok) throw fail("OBSERVATION");
  return result.value;
}
type FinishStep = "PAGE_CLOSE" | "CONTEXT_CLOSE" | "BROWSER_CLOSE" | "PRIVACY_FINAL" | "OBSERVATIONS" | "ATTACHMENT";
export const FINALIZATION_STEP_MS = 1_500;

export interface NativeBrowserOwner {
  readonly browser: Browser | undefined;
  readonly context: BrowserContext | undefined;
  readonly closedCleanly: boolean;
  connect(): Promise<Browser>;
  close(): Promise<void>;
}

// Reject links before creating/removing our one new profile. Neither a personal
// profile nor another run's TEMP is discovered, read, or recursively removed.
function assertPlainDirectoryAncestors(directory: string) {
  check(path.isAbsolute(directory));
  for (let current = path.resolve(directory);;) {
    const stat = lstatSync(current); check(stat.isDirectory() && !stat.isSymbolicLink());
    const parent = path.dirname(current); if (parent === current) break; current = parent;
  }
}
function assertPlainProfileTree(directory: string) {
  assertPlainDirectoryAncestors(directory);
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    check(!entry.isSymbolicLink());
    const child = path.join(directory, entry.name), stat = lstatSync(child);
    check(!stat.isSymbolicLink()); if (stat.isDirectory()) assertPlainProfileTree(child);
    else check(stat.isFile());
  }
}

// Public CDP transport over only the owned child's pipes. A is the default
// context: noDefaults prevents Playwright's focus override there. The full
// installed Chromium then supplies actual tab visibility/focus transitions.
// The surrounding rail Job still confines this worker and every descendant.
export function createNativeBrowser(chromium: BrowserType, executable: string, tempRoot: string): NativeBrowserOwner {
  check(executable === BROWSER);
  assertPlainDirectoryAncestors(tempRoot);
  const parent = realpathSync.native(tempRoot);
  const profileRoot = mkdtempSync(path.join(parent, "m1d-native-profile-"));
  const profileIdentity = lstatSync(profileRoot);
  check(path.dirname(realpathSync.native(profileRoot)) === parent);
  const child = spawn(executable, ["--headless=new", "--remote-debugging-pipe", `--user-data-dir=${path.join(profileRoot, "profile")}`,
    "--no-first-run", "--no-default-browser-check", "--disable-background-networking", "--disable-component-update", "--disable-sync", "--disable-extensions"],
  { windowsHide: true, stdio: ["ignore", "ignore", "ignore", "pipe", "pipe"],
    env: { SystemRoot: "C:\\Windows", WINDIR: "C:\\Windows", OS: "Windows_NT", Path: "C:\\Windows\\System32;C:\\Windows",
      TEMP: profileRoot, TMP: profileRoot, HOME: profileRoot, USERPROFILE: profileRoot, APPDATA: profileRoot, LOCALAPPDATA: profileRoot } });
  const input = child.stdio[3] as Writable, output = child.stdio[4] as Readable;
  let browser: Browser | undefined, context: BrowserContext | undefined, closedCleanly = false;
  let remainder = Buffer.alloc(0), pipeClosed = false, protocolError = false;
  const exited = new Promise<{ code: number | null; signal: string | null; spawnError: boolean }>(resolve => {
    child.once("error", () => resolve({ code: null, signal: null, spawnError: true }));
    child.once("exit", (code, signal) => resolve({ code, signal, spawnError: false }));
  });
  const transport: ConnectOverCDPTransport = {
    send(message) { if (pipeClosed) throw fail("BROWSER"); input.write(JSON.stringify(message) + "\0"); },
    close() { if (!pipeClosed) { pipeClosed = true; input.end(); output.destroy(); transport.onclose?.(); } }
  };
  input.on("error", () => { protocolError = true; transport.close(); });
  output.on("error", () => { protocolError = true; transport.close(); });
  output.on("end", () => transport.close());
  output.on("data", (chunk: Buffer) => {
    try {
      remainder = Buffer.concat([remainder, chunk]); check(remainder.length <= 16 * 1024 * 1024);
      let end: number;
      while ((end = remainder.indexOf(0)) !== -1) {
        const message: object = JSON.parse(remainder.subarray(0, end).toString("utf8"));
        remainder = remainder.subarray(end + 1); transport.onmessage?.(message);
      }
    } catch { protocolError = true; transport.close(); }
  });
  let closePromise: Promise<void> | undefined;
  return {
    get browser() { return browser; }, get context() { return context; }, get closedCleanly() { return closedCleanly; },
    async connect() {
      browser = await chromium.connectOverCDP(transport, { noDefaults: true, timeout: 10_000 });
      check(browser.contexts().length === 1); context = browser.contexts()[0];
      const session = await browser.newBrowserCDPSession();
      await session.send("Browser.setDownloadBehavior", { behavior: "deny" }); await session.detach();
      return browser;
    },
    close() {
      closePromise ??= (async () => {
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
          if (browser?.isConnected()) await Promise.race([
            (async () => { const session = await browser.newBrowserCDPSession(); await session.send("Browser.close"); })(),
            new Promise<void>(resolve => { timer = setTimeout(resolve, FINALIZATION_STEP_MS / 2); })
          ]);
        } catch { /* A normal native exit may reject the final protocol reply. */ }
        finally { clearTimeout(timer); transport.close(); }
        const result = await exited;
        if (browser) await browser.close();
        check(result.code === 0 && result.signal === null && !result.spawnError && !protocolError && !browser?.isConnected());
        assertPlainProfileTree(profileRoot);
        const current = lstatSync(profileRoot);
        check(current.dev === profileIdentity.dev && current.ino === profileIdentity.ino && path.dirname(realpathSync.native(profileRoot)) === parent);
        await rm(profileRoot, { recursive: true, force: false });
        try { lstatSync(profileRoot); throw fail("FINALIZATION"); }
        catch (error) { check((error as NodeJS.ErrnoException).code === "ENOENT"); }
        closedCleanly = true;
      })();
      return closePromise;
    }
  };
}

// Five bounded stages, at most 7.5 s of waiting, within the runner's existing
// 10 s margin. Only resources created by this test are supplied. A rejected or
// stuck close never prevents the other closes; the rail still owns tree death.
export async function finishBrowserRun(state: {
  browser?: Browser; contexts: BrowserContext[]; nativeOwner?: NativeBrowserOwner;
  observers: Array<{ scan(): Promise<void>; scans: number; violations: number; lost: number }>;
  evidence?: Evidence; binding?: Binding; firstFailure?: RunStep; failures?: BrowserFailures;
  attach: (body: Buffer) => Promise<void>;
}): Promise<Error | undefined> {
  const diagnostics = state.failures?.diagnostics ?? [];
  if (state.firstFailure) diagnostics.push(`M1D_${state.firstFailure}_FAILED`);
  const note = (step: FinishStep, code: "FAILED" | "TIMEOUT" | "INCOMPLETE") => {
    // Freeze at first observation, before a later close can reject a captured
    // operation. Do not mark the current scenario step completed here.
    if (state.binding?.kind === "browser") state.failures?.browserFailure(undefined, "FINALIZATION", code === "TIMEOUT" ? "TIMEOUT" : "OPERATION_FAILED");
    diagnostics.push(`M1D_${step}_${code}`);
  };
  const attempt = async (step: FinishStep, operation: () => Promise<unknown>, verify = () => true) => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    // Both outcomes are handled even if a timed-out operation settles later.
    const work = Promise.resolve().then(operation).then(() => verify() ? "DONE" as const : "INCOMPLETE" as const, () => "FAILED" as const)
      .catch(() => "FAILED" as const);
    try {
      const outcome = await Promise.race([work, new Promise<"TIMEOUT">(resolve => { timer = setTimeout(() => resolve("TIMEOUT"), FINALIZATION_STEP_MS); })]);
      if (outcome !== "DONE") note(step, outcome);
      return outcome === "DONE";
    } finally { clearTimeout(timer); }
  };
  const { contexts, observers, evidence, binding, nativeOwner } = state;
  const browser = state.browser ?? nativeOwner?.browser;
  const pages = contexts.flatMap(context => {
    try { return context.pages(); } catch { note("PAGE_CLOSE", "FAILED"); return []; }
  });
  const pageResults = await Promise.all(pages.map(page => attempt("PAGE_CLOSE", () => page.close(), () => page.isClosed())));
  // Closing a CDP default context would disconnect before native Browser.close.
  // Its actual closure is checked after the owned process has exited instead.
  const contextResults = await Promise.all(contexts.filter(context => context !== nativeOwner?.context).map(context => attempt("CONTEXT_CLOSE", () => context.close())));
  let contextsGone = false;
  if (!nativeOwner) {
    try { contextsGone = !!browser && browser.contexts().length === 0; if (browser && !contextsGone) note("CONTEXT_CLOSE", "INCOMPLETE"); }
    catch { note("CONTEXT_CLOSE", "FAILED"); }
  }
  const browserGone = nativeOwner ? await attempt("BROWSER_CLOSE", () => nativeOwner.close(), () => nativeOwner.closedCleanly && !!browser && !browser.isConnected())
    : browser ? await attempt("BROWSER_CLOSE", () => browser.close(), () => !browser.isConnected()) : false;
  if (nativeOwner) {
    try { contextsGone = browserGone && !!browser && browser.contexts().length === 0; if (!contextsGone) note("CONTEXT_CLOSE", "INCOMPLETE"); }
    catch { note("CONTEXT_CLOSE", "FAILED"); }
  }
  await Promise.all([
    ...observers.map(observer => attempt("PRIVACY_FINAL", () => observer.scan())),
    ...(state.failures ? [attempt("PRIVACY_FINAL", () => state.failures!.drain())] : [])
  ]);
  if (evidence) {
    try {
      record(evidence, "pagesClosed", Number(pageResults.every(Boolean) && !diagnostics.some(d => d.startsWith("M1D_PAGE_CLOSE_"))));
      record(evidence, "contextsClosed", Number(contextResults.every(Boolean) && contextsGone));
      record(evidence, "browserDisconnected", Number(browserGone));
      record(evidence, "privacyScans", observers.reduce((sum, o) => sum + o.scans, 0));
      record(evidence, "privacyViolations", observers.reduce((sum, o) => sum + o.violations, 0));
      record(evidence, "lostObservations", observers.reduce((sum, o) => sum + o.lost, 0));
    } catch { note("OBSERVATIONS", "FAILED"); }
  }
  if (evidence && binding) {
    await attempt("ATTACHMENT", async () => {
      if (binding.kind === "cookie" && diagnostics.length) {
        state.failures?.cookieFailure("FINALIZATION", "FINALIZATION");
        evidence.cookieDiagnostic = state.failures?.cookieDiagnostic ?? { schemaVersion: 2, source: "BROWSER", step: "FINALIZATION",
          lastCompleted: null, reason: "UNAVAILABLE", metric: null, facts: emptyCookieFacts(), firstPrivacyViolation: null };
      }
      if (binding.kind === "browser" && diagnostics.length) {
        state.failures?.browserFailure(undefined, "FINALIZATION");
        evidence.browserDiagnostic = state.failures?.browserDiagnostic ?? { schemaVersion: 1, source: "SCENARIO", step: "FINALIZATION", lastCompleted: null, reason: "UNAVAILABLE" };
      }
      const filtered = decode(Buffer.from(JSON.stringify(evidence)), binding);
      await state.attach(Buffer.from(JSON.stringify(filtered)));
    });
  } else { note("OBSERVATIONS", "INCOMPLETE"); }
  // The first filtered diagnostic stays first. No raw error/cause/page/session
  // value enters the Error that Playwright may persist in error-context.md.
  return diagnostics.length ? new Error(diagnostics[0] + (diagnostics.length > 1 ? `; SECONDARY=${diagnostics.slice(1).join(",")}` : "")) : undefined;
}
export function emittedCookieAttributes(value: string): number {
  return Number(/^__Host-ritomer-session=[^;]+/.test(value)) + 2 * Number(/;\s*Secure(?:;|$)/i.test(value))
    + 4 * Number(/;\s*HttpOnly(?:;|$)/i.test(value)) + 8 * Number(/;\s*Path=\/(?:;|$)/i.test(value) && !/;\s*Domain=/i.test(value))
    + 16 * Number(/;\s*SameSite=Lax(?:;|$)/i.test(value));
}
export function privacyLeaks(samples: readonly string[], protectedValues: ReadonlySet<string>): number {
  let count = 0;
  for (const sample of samples) for (const value of protectedValues) if (value && sample.includes(value)) count++;
  return count;
}
type SampleSurface = Exclude<PrivacySurface, "REQUEST_HEADERS"> | "PAGE_SNAPSHOT";
type ProtectedCategories = Map<string, Set<PrivacyValueCategory>>;
function addProtectedCategory(target: ProtectedCategories, value: string, category: PrivacyValueCategory) {
  const categories = target.get(value) ?? new Set<PrivacyValueCategory>(); categories.add(category); target.set(value, categories);
}
function snapshotSurface(sample: string, value: string): PrivacySurface {
  // Diagnostic only: the original whole JSON remains the single counted sample.
  // Shared occurrences, envelope-only matches and unclassifiable inputs stay ambiguous.
  try {
    const snapshot: unknown = JSON.parse(sample);
    if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) return "AMBIGUOUS";
    const surfaces: Record<string, PrivacySurface> = { dom: "DOM", fields: "FORM_FIELD", url: "URL", cookie: "DOCUMENT_COOKIE",
      local: "LOCAL_STORAGE", session: "SESSION_STORAGE", indexed: "INDEXED_DB" };
    const matches = new Set<PrivacySurface>();
    for (const [key, item] of Object.entries(snapshot)) {
      if (!Object.prototype.hasOwnProperty.call(surfaces, key)) return "AMBIGUOUS";
      if (JSON.stringify(item).includes(value)) matches.add(surfaces[key]);
    }
    return matches.size === 1 ? [...matches][0] : "AMBIGUOUS";
  } catch { return "AMBIGUOUS"; }
}
export class PrivacyObservation {
  readonly protectedValues = new Set<string>();
  readonly protectedCategories: ProtectedCategories = new Map();
  readonly samples: string[] = [];
  private readonly sampleSurfaces: SampleSurface[] = [];
  private firstViolation: PrivacyViolation | null = null;
  lost = 0; bytes = 0; scans = 0; violations = 0;
  constructor(private readonly onViolation?: (value: PrivacyViolation, counts: { privacyScans: number; privacyViolations: number; lostObservations: number }) => void) {}
  get firstPrivacyViolation(): PrivacyViolation | null { return this.firstViolation; }
  protect(value: string, category: PrivacyValueCategory) { this.protectedValues.add(value); addProtectedCategory(this.protectedCategories, value, category); }
  violation(rule: PrivacyViolation["rule"], surface: PrivacySurface, valueCategory: PrivacyValueCategory, count = 1) {
    if (!this.firstViolation) {
      this.firstViolation = validatePrivacyViolation({ rule, surface, valueCategory });
    }
    this.violations += count;
    this.onViolation?.(this.firstViolation, { privacyScans: this.scans, privacyViolations: this.violations, lostObservations: this.lost });
  }
  sample(value: unknown, surface: SampleSurface = "AMBIGUOUS") {
    if (typeof value !== "string") { this.lost++; return; }
    this.bytes += Buffer.byteLength(value);
    if (this.bytes > 8 * 1024 * 1024 || this.samples.length >= 8000) { this.lost++; return; }
    this.samples.push(value); this.sampleSurfaces.push(surface);
  }
  async capture(operation: () => Promise<string>, surface: SampleSurface = "AMBIGUOUS") {
    try { this.sample(await operation(), surface); } catch { this.lost++; }
  }
  completeScan() {
    this.scans++;
    const count = privacyLeaks(this.samples, this.protectedValues);
    if (count > 0) {
      if (!this.firstViolation) {
        // Same sample/value iteration as the existing counter. A value learned
        // later can still match an earlier sample; nothing is consumed or reset.
        outer: for (let index = 0; index < this.samples.length; index++) for (const value of this.protectedValues) {
          if (!value || !this.samples[index].includes(value)) continue;
          const categories = this.protectedCategories.get(value);
          const category = categories?.size === 1 ? [...categories][0] : "AMBIGUOUS";
          const origin = this.sampleSurfaces[index];
          const surface = origin === "PAGE_SNAPSHOT" ? snapshotSurface(this.samples[index], value) : origin ?? "AMBIGUOUS";
          this.violation("PROTECTED_VALUE_MATCH", surface, category, count); break outer;
        }
      } else this.violation(this.firstViolation.rule, this.firstViolation.surface, this.firstViolation.valueCategory, count);
    }
    check(this.lost === 0 && this.violations === 0);
  }
}

// Contract payloads only; commit the additions after every required identity
// has been read. A partial or unreadable payload cannot produce a clean scan.
export function collectProtectedValues(pathname: "/api/session/bootstrap" | "/api/me", payload: unknown, target: Set<string>, categories?: ProtectedCategories): void {
  try {
    const values = new Set<string>();
    const additions: ProtectedCategories = new Map();
    const object = (value: unknown): Record<string, unknown> => {
      if (!value || typeof value !== "object" || Array.isArray(value)) throw fail("OBSERVATION");
      return value as Record<string, unknown>;
    };
    const protect = (value: unknown, category: PrivacyValueCategory) => {
      if (typeof value !== "string" || !value.length || value.length > 4096) throw fail("OBSERVATION");
      values.add(value); addProtectedCategory(additions, value, category);
    };
    const body = object(payload);
    if (pathname === "/api/session/bootstrap") {
      const csrf = object(body.csrf);
      if (csrf.headerName !== "X-CSRF-TOKEN" || body.localLoginAvailable !== true) throw fail("OBSERVATION");
      protect(csrf.token, "CSRF_TOKEN");
      if (body.sessionState === "ANONYMOUS") {
        if (!Array.isArray(body.actors) || body.actors.length > 50) throw fail("OBSERVATION");
        for (const actor of body.actors) protect(object(actor).actorKey, "ACTOR_KEY");
      } else if (body.sessionState !== "AUTHENTICATED") throw fail("OBSERVATION");
    } else {
      const actor = object(body.actor);
      protect(actor.userId, "USER_ID"); protect(actor.externalSubject, "SUBJECT");
      if (!Array.isArray(body.memberships)) throw fail("OBSERVATION");
      for (const membership of body.memberships) protect(object(membership).tenantId, "TENANT_ID");
      if (body.activeTenant !== null) protect(object(body.activeTenant).tenantId, "TENANT_ID");
    }
    let visited = 0;
    const identityCategories: Record<string, PrivacyValueCategory> = { tenantId: "TENANT_ID", userId: "USER_ID", membershipId: "MEMBERSHIP_ID",
      subject: "SUBJECT", externalSubject: "SUBJECT", actorId: "ACTOR_ID", actorKey: "ACTOR_KEY" };
    const walk = (value: unknown, key = "") => {
      if (++visited > 2000) throw fail("OBSERVATION");
      if (/^(tenantId|userId|membershipId|subject|externalSubject|actorId|actorKey)$/.test(key))
        protect(value, Object.prototype.hasOwnProperty.call(identityCategories, key) ? identityCategories[key] : "AMBIGUOUS");
      else if (value && typeof value === "object") for (const [k, item] of Object.entries(value)) walk(item, k);
    };
    walk(body);
    for (const value of values) {
      target.add(value);
      if (categories) for (const category of additions.get(value)!) addProtectedCategory(categories, value, category);
    }
  } catch { throw fail("OBSERVATION"); }
}

// These two functions are serialized by Playwright's public page APIs. Keep
// them self-contained; the unit tests execute these exact functions in jsdom.
export function installPageObservation(): void {
  let failed = false;
  const pending = new Set<Promise<void>>();
  const report = (type: string, value: unknown = "", surface?: "DOM") => {
    try {
      if (pending.size >= 8000) { failed = true; return; }
      const binding = (window as unknown as { __m1dObserve: (type: string, value: unknown, surface?: "DOM") => Promise<void> }).__m1dObserve;
      const task = Promise.resolve(binding(type, value, surface)).then(() => { pending.delete(task); }, () => { pending.delete(task); failed = true; });
      pending.add(task);
    } catch { failed = true; }
  };
  const mutations = (records: MutationRecord[]) => {
    try {
      for (const mutation of records) {
        if (mutation.type === "attributes") {
          // The old value in the *next* record preserves a same-task overwrite.
          report("sample", mutation.oldValue ?? "", "DOM");
          report("sample", (mutation.target as Element).getAttribute(mutation.attributeName!) ?? "", "DOM");
        } else if (mutation.type === "characterData") {
          report("sample", mutation.oldValue ?? "", "DOM"); report("sample", mutation.target.textContent ?? "", "DOM");
        } else for (const node of mutation.addedNodes) report("sample", node instanceof Element ? node.outerHTML : node.textContent ?? "", "DOM");
      }
    } catch { failed = true; }
  };
  const observer = new MutationObserver(mutations);
  observer.observe(document, { subtree: true, childList: true, attributes: true, attributeOldValue: true, characterData: true, characterDataOldValue: true });
  (window as unknown as { __m1dFlush: () => Promise<boolean> }).__m1dFlush = async () => {
    try { mutations(observer.takeRecords()); while (pending.size) await Promise.all(pending); return !failed; }
    catch { return false; }
  };
  window.addEventListener("focus", event => report(event.isTrusted ? "focus" : "lost"));
  document.addEventListener("visibilitychange", event => report(event.isTrusted ? "visibility" : "lost"));
  const channel = new BroadcastChannel("ritomer:session:v1");
  channel.onmessage = event => { try { report("channel", JSON.stringify(event.data)); } catch { failed = true; } };
  channel.onmessageerror = () => report("lost");
}

export async function capturePageSnapshot(): Promise<string> {
  const failure = () => new Error("M1D_OBSERVATION_FAILED");
  const deadline = Date.now() + 1000;
  // One shared deadline, including unavailable/blocked IndexedDB reads.
  const read = <T>(start: (resolve: (value: T) => boolean, reject: () => void) => void) => new Promise<T>((resolve, reject) => {
    let settled = false;
    const stop = () => { settled = true; clearTimeout(timer); reject(failure()); };
    const timer = setTimeout(stop, Math.max(0, deadline - Date.now()));
    try { start(value => { if (settled) return false; settled = true; clearTimeout(timer); resolve(value); return true; }, stop); } catch { stop(); }
  });
  try {
    const stores: unknown[] = [];
    const descriptors = await read<IDBDatabaseInfo[]>((resolve, reject) => {
      void indexedDB.databases().then(resolve, reject);
    });
    if (descriptors.length > 32) throw failure();
    let entries = 0;
    for (const descriptor of descriptors) {
      if (!descriptor.name || !descriptor.version || Date.now() >= deadline) throw failure();
      const database = await read<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(descriptor.name!, descriptor.version);
        request.onupgradeneeded = () => { try { request.transaction?.abort(); } catch { /* Refuse even an unreadable upgrade. */ } finally { reject(); } };
        request.onerror = request.onblocked = () => reject();
        request.onsuccess = () => { try { if (Date.now() >= deadline || !resolve(request.result)) { request.result.close(); reject(); } } catch { reject(); } };
      });
      try {
        for (const name of database.objectStoreNames) {
          if (stores.length >= 128 || Date.now() >= deadline) throw failure();
          const values = await read<unknown[]>((resolve, reject) => {
            const rows: unknown[] = [];
            let exhausted = false;
            const transaction = database.transaction(name, "readonly");
            transaction.onabort = transaction.onerror = () => reject();
            transaction.oncomplete = () => { if (exhausted) resolve(rows); else reject(); };
            const request = transaction.objectStore(name).openCursor();
            request.onerror = () => reject();
            request.onsuccess = () => {
              try {
                const cursor = request.result;
                if (!cursor) { exhausted = true; return; }
                if (++entries > 2000 || Date.now() >= deadline) { reject(); return; }
                rows.push({ key: cursor.key, primaryKey: cursor.primaryKey, value: cursor.value });
                cursor.continue();
              } catch { reject(); }
            };
          });
          stores.push([descriptor.name, name, values]);
        }
      } finally { database.close(); }
    }
    const fields = Array.from(document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("input,textarea"), field => field.value);
    const snapshot = JSON.stringify({ dom: document.documentElement.outerHTML, fields, url: location.href, cookie: document.cookie,
      local: { ...localStorage }, session: { ...sessionStorage }, indexed: stores }, (_key, value: unknown) => {
      // JSON must not silently discard an unreadable/non-JSON stored value.
      if (value === undefined || typeof value === "function" || typeof value === "symbol"
        || (value && typeof value === "object" && !Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)) throw failure();
      return value;
    });
    if (snapshot.length > 8 * 1024 * 1024 || Date.now() >= deadline) throw failure();
    return snapshot;
  } catch { throw failure(); }
}
export function readBinding(env: NodeJS.ProcessEnv, argv: string[]): Binding {
  const discovery = env.RITOMER_M1D_DISCOVERY === "SYNTHETIC_LIST_ONLY";
  const kind = env.RITOMER_M1D_BROWSER_PHASE;
  const runId = env.RITOMER_DB_RAIL_RUN_ID ?? "";
  const objectSha = env.RITOMER_DB_RAIL_REVIEWED_OBJECT_SHA256 ?? "";
  const runtimeSha = env.RITOMER_DB_RAIL_RUNTIME_SHA256 ?? "";
  const frontendSha = env.RITOMER_M1D_FRONTEND_SHA256 ?? "";
  const root = env.RITOMER_DB_RAIL_RUN_ROOT ?? "";
  const executable = env.RITOMER_M1D_BROWSER_EXECUTABLE ?? "";
  if (env.RITOMER_DB_RAIL_CAMPAIGN !== "D" || !RUN.test(runId) || ![objectSha, runtimeSha, frontendSha].every(s => SHA.test(s))
    || (kind !== "cookie" && kind !== "browser") || env.PLAYWRIGHT_NO_COPY_PROMPT !== "1"
    || argv.some(a => /^--(?:reporter|ui|headed|debug|trace|update-snapshots|output|repeat-each|retries|workers)(?:=|$)/.test(a))
    || Object.keys(env).some(k => /^(NODE_OPTIONS|NODE_PATH|DEBUG|PWDEBUG|PLAYWRIGHT_HTML_OPEN|PLAYWRIGHT_JSON_OUTPUT.*|RITOMER_DB_TEST_PASSWORD|HTTP_PROXY|HTTPS_PROXY|ALL_PROXY)$/i.test(k))) throw fail("BINDING");
  if (discovery) {
    if (!argv.includes("--list") || runId !== TEST_RUN || [objectSha, runtimeSha, frontendSha].some(s => s !== TEST_SHA)
      || root !== "SYNTHETIC_LIST_ONLY" || executable !== "SYNTHETIC_LIST_ONLY") throw fail("BINDING");
  } else if (argv.includes("--list") || runId === TEST_RUN || runId === "c2f19f4e0b324496a9593bb03be75ee1" || root !== ROOT + "\\" + runId || executable !== BROWSER) throw fail("BINDING");
  return { kind, runId, objectSha, runtimeSha, frontendSha, root, executable, discovery };
}

export function record(evidence: Evidence, event: Metric, value: number, atMs = performance.now()): void {
  if (!METRICS.includes(event) || !Number.isFinite(value) || value < 0 || !Number.isFinite(atMs) || atMs < 0 || evidence.observations.length >= 128
    || evidence.observations.some(o => o.event === event)) throw fail("OBSERVATION");
  evidence.observations.push({ event, value, atMs });
}
function exact(value: object, keys: string[]): boolean { return Object.keys(value).sort().join("|") === [...keys].sort().join("|"); }
export function decode(bytes: Buffer, binding: Binding): Evidence {
  try {
    if (bytes.length > 32768) throw fail("OBSERVATION");
    const e = JSON.parse(bytes.toString("utf8")) as Evidence;
    const keys = ["schemaVersion", "kind", "runId", "objectSha", "runtimeSha", "frontendSha", "browserVersion", "observations", "windows"];
    if (e && Object.prototype.hasOwnProperty.call(e, "cookieDiagnostic")) { if (binding.kind !== "cookie") throw fail("OBSERVATION"); keys.push("cookieDiagnostic"); validateCookieDiagnostic(e.cookieDiagnostic); }
    if (e && Object.prototype.hasOwnProperty.call(e, "browserDiagnostic")) { if (binding.kind !== "browser") throw fail("OBSERVATION"); keys.push("browserDiagnostic"); validateBrowserDiagnostic(e.browserDiagnostic); }
    if (!e || !exact(e, keys)
      || e.schemaVersion !== 1 || e.kind !== binding.kind || e.runId !== binding.runId || e.objectSha !== binding.objectSha || e.runtimeSha !== binding.runtimeSha || e.frontendSha !== binding.frontendSha
      || !/^\d+\.\d+\.\d+\.\d+$/.test(e.browserVersion) || !Array.isArray(e.observations) || e.observations.length > 128 || !Array.isArray(e.windows)
      || e.windows.length > WINDOWS.length || new Set(e.windows).size !== e.windows.length || e.windows.some(w => !WINDOWS.includes(w as typeof WINDOWS[number]))) throw fail("OBSERVATION");
    const clean: Evidence = { ...e, observations: [] };
    for (const o of e.observations) {
      if (!o || !exact(o, ["event", "atMs", "value"])) throw fail("OBSERVATION");
      record(clean, o.event, o.value, o.atMs);
    }
    if (clean.observations.some((o, i, a) => i > 0 && o.atMs < a[i - 1].atMs)) throw fail("OBSERVATION");
    return clean;
  } catch { throw fail("OBSERVATION"); }
}
export function reduce(e: Evidence): Record<string, { result: "PASS"; observation: string; evidenceId: string }> {
  if (e.cookieDiagnostic || e.browserDiagnostic) throw fail("OBSERVATION");
  const observations = new Map(e.observations.map(o => [o.event, o]));
  const refuse = (metric: Metric | "windows"): never => { throw new CookieReductionFailure(metric); };
  const value = (name: Metric) => { const o = observations.get(name); if (!o) return refuse(name); return o.value; };
  const requireValue = (name: Metric, expected: number) => { if (value(name) !== expected) refuse(name); };
  const required: Partial<Record<Metric, number>> = { emittedCookie: 31, acceptedCookie: 31, continuity: 1, login: 204, rotation: 1, authenticated: 1, me: 200,
    privacyViolations: 0, lostObservations: 0, pagesClosed: 1, contextsClosed: 1, browserDisconnected: 1 };
  if (e.kind === "browser") Object.assign(required, { noteRead: 1, roleRefusal: 403, roleReadOnly: 1, csrfRefusal: 403, csrfRenewal: 1, csrfReplay: 0,
    idleRequests: 0, expiredResponse: 401, expiredUI: 1, automaticLogin: 0, explicitLogin: 204, safeReturn: 1, logout: 204, logoutInvalidated: 1,
    anonymousAfterLogout: 1, otherContextReady: 1, sharedLogout: 1, nativeFocus: 1, nativeVisibility: 1, keyboard: 1, narrow: 1 });
  for (const [name, expected] of Object.entries(required)) requireValue(name as Metric, expected);
  if (value("privacyScans") < (e.kind === "cookie" ? 2 : WINDOWS.length)) refuse("privacyScans");
  const windows = e.kind === "cookie" ? WINDOWS.slice(0, 2) : WINDOWS;
  if (e.windows.join("|") !== windows.join("|")) refuse("windows");
  if (e.kind === "browser") {
    if (![200, 201].includes(value("noteWrite"))) throw fail("OBSERVATION");
    const start = observations.get("idleStart"), end = observations.get("idleEnd"), expired = observations.get("expiredResponse"), explicit = observations.get("explicitLogin");
    if (!start || !end || !expired || !explicit || end.atMs - start.atMs < IDLE_MS || end.value - start.value < IDLE_MS
      || expired.atMs < end.atMs || explicit.atMs < expired.atMs) throw fail("OBSERVATION");
  }
  const names = e.kind === "cookie" ? ["secureCookieAttributes", "bootstrapContinuity", "login204", "authenticatedBootstrap", "me200"]
    : ["cookie", "csrf", "roles", "logout", "explicitReconnection", "idleExpiry32Minutes", "focus", "multipleTabs", "safeReturn", "keyboard", "narrowViewport", "privacy"];
  return Object.fromEntries(names.map(name => [name, { result: "PASS", observation: `Assertions observees et finalisations verifiees: ${name}`, evidenceId: `${e.kind}-observations` }]));
}

class CookieReductionFailure extends Error {
  constructor(readonly metric: Metric | "windows") { super("M1D_OBSERVATION_FAILED"); }
}
function reporterCookieDiagnostic(e?: Evidence, metric?: Metric | "windows"): CookieDiagnostic {
  const facts = emptyCookieFacts();
  if (e) {
    const values = new Map(e.observations.map(o => [o.event, o.value]));
    for (const [event, key] of [["emittedCookie", "emittedMask"], ["acceptedCookie", "acceptedMask"], ["login", "loginStatus"], ["me", "meStatus"],
      ["privacyScans", "privacyScans"], ["privacyViolations", "privacyViolations"], ["lostObservations", "lostObservations"]] as const) {
      const value = values.get(event);
      const minimum = key.endsWith("Status") ? 100 : 0, maximum = key.endsWith("Status") ? 599 : key.endsWith("Mask") ? 31 : 1_000_000;
      if (value !== undefined && Number.isInteger(value) && value >= minimum && value <= maximum) facts[key] = value;
    }
    for (const event of ["continuity", "rotation"] as const) { const value = values.get(event); if (value === 0 || value === 1) facts[event] = value === 1; }
  }
  return validateCookieDiagnostic({ schemaVersion: 2, source: metric ? "REDUCER" : "REPORTER", step: metric ? "REDUCER" : "REPORTER",
    lastCompleted: null, reason: metric ? "METRIC" : "UNAVAILABLE", metric: metric ?? null, facts, firstPrivacyViolation: null });
}

export function createNewFile(file: string, bytes: Buffer): void {
  let fd: number | undefined;
  try { fd = openSync(file, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY, 0o600); writeFileSync(fd, bytes); fsyncSync(fd); }
  finally { if (fd !== undefined) closeSync(fd); }
}
export function publish(binding: Binding, evidence: Evidence, write = createNewFile): void {
  if (binding.discovery) throw fail("PUBLICATION");
  const scenarios = reduce(evidence);
  const root = binding.root;
  // Reject redirection before writing. The rail independently checks ancestry.
  for (let current = root; ; current = path.dirname(current)) {
    if (lstatSync(current).isSymbolicLink()) throw fail("PUBLICATION");
    if (path.dirname(current) === current) break;
  }
  const directory = path.join(root, "browser-evidence");
  mkdirSync(directory, { recursive: true });
  if (lstatSync(directory).isSymbolicLink()) throw fail("PUBLICATION");
  const file = `${binding.kind}-observations.json`;
  const bytes = Buffer.from(JSON.stringify(evidence) + "\n");
  write(path.join(directory, file), bytes);
  const receipt = { schemaVersion: 1, kind: binding.kind, runId: binding.runId, reviewedObjectSha256: binding.objectSha, runtimeSha256: binding.runtimeSha,
    origin: ORIGIN, browserName: "Chromium", browserVersion: evidence.browserVersion, scenarios,
    evidence: [{ id: `${binding.kind}-observations`, file, sha256: createHash("sha256").update(bytes).digest("hex") }], finishRequested: true, tabsClosed: true };
  write(path.join(root, `d-${binding.kind}-evidence.json`), Buffer.from(JSON.stringify(receipt) + "\n"));
}

// Public reporter transport: attachment bytes cross the worker boundary. No
// worker singleton, raw Error, stdout, page snapshot, or secret is persisted.
export default class EvidenceReporter implements Reporter {
  private invalid = false;
  private count = 0;
  private evidence?: Evidence;
  private cookieDiagnostic?: CookieDiagnostic;
  private browserDiagnostic?: BrowserDiagnostic;
  private readonly pendingOperations = new Map<TestStep, { step: BrowserStep; operation: BrowserOperation }>();
  private failedOperation?: BrowserOperationDiagnostic;
  private lastCompletedOperation: BrowserOperation | null = null;
  private testTimedOut = false;
  private diagnosticSent = false;
  constructor(private readonly binding: Binding = readBinding(process.env, process.argv), private readonly publishEvidence = publish,
    private readonly emitDiagnostic = (line: string) => { process.stdout.write(line); }) {}
  printsToStdio() { return true; } // prevents implicit unfiltered standard reporter
  onBegin(_config: FullConfig, suite: Suite) {
    try {
    if (this.binding.discovery) {
      const titles = suite.allTests().map(t => t.title).sort();
      this.invalid = titles.join("|") !== "m1d-browser|m1d-cookie";
      if (!this.invalid) process.stdout.write("M1D_SYNTHETIC_DISCOVERY cookie=1 browser=1 NO_EXECUTION\n");
      return;
    }
    if (!this.binding.discovery && (suite.allTests().length !== 1 || suite.allTests()[0].title !== `m1d-${this.binding.kind}`)) this.invalid = true;
    } catch { this.invalid = true; process.exitCode = 1; }
  }
  onStdOut() { this.invalid = true; }
  onStdErr() { this.invalid = true; }
  onError() { this.invalid = true; }
  onStepBegin(test: TestCase, result: TestResult, step: TestStep) {
    if (this.binding.discovery || this.binding.kind !== "browser" || test.title !== "m1d-browser" || test.expectedStatus !== "passed" || result.retry !== 0 || step.category !== "test.step") return;
    const operation = operationFromTitle(step.title);
    if (!operation) return; // Never retain automatic API titles, arguments or free text.
    if (this.pendingOperations.size >= 128 || this.pendingOperations.has(step)) { this.invalid = true; return; }
    this.pendingOperations.set(step, operation);
  }
  onStepEnd(test: TestCase, result: TestResult, step: TestStep) {
    if (this.binding.discovery || this.binding.kind !== "browser" || test.title !== "m1d-browser" || test.expectedStatus !== "passed" || result.retry !== 0) return;
    const operation = this.pendingOperations.get(step); if (!operation) return;
    this.pendingOperations.delete(step);
    if (step.error) this.failedOperation ??= { schemaVersion: 2, source: "REPORTER", ...operation, lastCompleted: null,
      reason: "OPERATION_FAILED", operationState: "FAILED", lastCompletedOperation: this.lastCompletedOperation };
    else if (!this.failedOperation) this.lastCompletedOperation = operation.operation;
  }
  onTestEnd(test: TestCase, result: TestResult) {
    this.count++;
    if (test.title === "m1d-browser" && test.expectedStatus === "passed" && result.retry === 0) this.testTimedOut = result.status === "timedOut";
    try {
      if (this.count !== 1 || test.title !== `m1d-${this.binding.kind}` || test.expectedStatus !== "passed" || result.retry !== 0
        || result.attachments.length !== 1 || result.attachments[0].name !== "m1d-observations" || result.attachments[0].contentType !== "application/json" || !result.attachments[0].body) throw fail("RUNNER");
      this.evidence = decode(result.attachments[0].body, this.binding);
      if (this.evidence.cookieDiagnostic) this.cookieDiagnostic ??= validateCookieDiagnostic(this.evidence.cookieDiagnostic);
      if (this.evidence.browserDiagnostic) this.browserDiagnostic ??= validateBrowserDiagnostic(this.evidence.browserDiagnostic);
      if (result.status !== "passed" || result.errors.length !== 0 || this.cookieDiagnostic || this.browserDiagnostic) throw fail("RUNNER");
      reduce(this.evidence);
    } catch (error) {
      this.invalid = true;
      this.retainCookieFailureDiagnostic(test, result);
      this.retainBrowserFailureDiagnostic(test, result);
      if (this.binding.kind === "cookie" && error instanceof CookieReductionFailure) this.cookieDiagnostic ??= reporterCookieDiagnostic(this.evidence, error.metric);
    }
  }
  private retainBrowserFailureDiagnostic(test: TestCase, result: TestResult): void {
    try {
      if (this.browserDiagnostic || this.binding.discovery || this.binding.kind !== "browser" || result.status !== "failed"
        || this.count !== 1 || test.title !== "m1d-browser" || test.expectedStatus !== "passed" || result.retry !== 0) return;
      const candidates = result.attachments.filter(attachment => attachment.name === "m1d-observations");
      if (candidates.length !== 1 || candidates[0].contentType !== "application/json" || !Buffer.isBuffer(candidates[0].body) || candidates[0].body.length > 32768) return;
      const diagnostic = decode(candidates[0].body, this.binding).browserDiagnostic;
      if (diagnostic) this.browserDiagnostic = validateBrowserDiagnostic(diagnostic);
    } catch { /* Failed evidence stays failed; no raw fallback. */ }
  }
  private retainCookieFailureDiagnostic(test: TestCase, result: TestResult): void {
    try {
      if (this.cookieDiagnostic || this.binding.discovery || this.binding.kind !== "cookie" || result.status !== "failed"
        || this.count !== 1 || test.title !== "m1d-cookie" || test.expectedStatus !== "passed" || result.retry !== 0) return;
      // Failure detail is separate from success evidence. Only inspect names of other attachments.
      const candidates = result.attachments.filter(attachment => attachment.name === "m1d-observations");
      if (candidates.length !== 1 || candidates[0].contentType !== "application/json") return;
      const body = candidates[0].body;
      if (!Buffer.isBuffer(body) || body.length > 32768) return;
      const diagnostic = decode(body, this.binding).cookieDiagnostic;
      if (diagnostic) this.cookieDiagnostic ??= validateCookieDiagnostic(diagnostic);
    } catch { /* Keep the failure and existing fallback; never expose attachment contents or raw errors. */ }
  }
  async onEnd(result: FullResult): Promise<{ status: "passed" | "failed" }> {
    if (this.binding.discovery) return { status: this.invalid ? "failed" : "passed" };
    let publishing = false;
    try {
      if (this.invalid || this.failedOperation || this.pendingOperations.size !== 0 || result.status !== "passed" || this.count !== 1 || !this.evidence) throw fail("RUNNER");
      publishing = true;
      this.publishEvidence(this.binding, this.evidence);
      return { status: "passed" };
    } catch {
      this.invalid = true; process.exitCode = 1;
      if (this.binding.kind === "cookie" && !this.diagnosticSent) {
        this.diagnosticSent = true;
        try {
          const diagnostic = validateCookieDiagnostic(this.cookieDiagnostic ?? reporterCookieDiagnostic());
          const line = "M1D_COOKIE_DIAGNOSTIC " + JSON.stringify({ schemaVersion: 1, runId: this.binding.runId, objectSha: this.binding.objectSha,
            runtimeSha: this.binding.runtimeSha, frontendSha: this.binding.frontendSha, diagnostic }) + "\n";
          if (Buffer.byteLength(line) > 8192) throw fail("PUBLICATION");
          this.emitDiagnostic(line);
        } catch { /* Failure to publish remains failure; never use an unfiltered fallback. */ }
      }
      if (this.binding.kind === "browser" && !this.diagnosticSent) {
        this.diagnosticSent = true;
        try {
          const pending = [...this.pendingOperations.values()].at(-1);
          const traced = this.failedOperation ?? (pending ? { schemaVersion: 2 as const, source: "REPORTER" as const, ...pending,
            lastCompleted: null, reason: this.testTimedOut ? "TIMEOUT" as const : "OPERATION_FAILED" as const, operationState: "PENDING" as const,
            lastCompletedOperation: this.lastCompletedOperation } : undefined);
          // The attachment keeps the worker's first local failure. Step events
          // are a transport fallback, not a global ordering of both channels.
          const diagnostic = validateBrowserDiagnostic(this.browserDiagnostic ?? traced ?? { schemaVersion: 1, source: publishing ? "PUBLICATION" : "REPORTER",
            step: publishing ? "PUBLICATION" : "REPORTER", lastCompleted: null, reason: publishing ? "OPERATION_FAILED" : "UNAVAILABLE" });
          const line = "M1D_BROWSER_DIAGNOSTIC " + JSON.stringify({ schemaVersion: 1, runId: this.binding.runId, objectSha: this.binding.objectSha,
            runtimeSha: this.binding.runtimeSha, frontendSha: this.binding.frontendSha, diagnostic }) + "\n";
          if (Buffer.byteLength(line) > 8192) throw fail("PUBLICATION");
          this.emitDiagnostic(line);
        } catch { /* No unfiltered fallback and no success on publication error. */ }
      }
      return { status: "failed" };
    }
  }
}
