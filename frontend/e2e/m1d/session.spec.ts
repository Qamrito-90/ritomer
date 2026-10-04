import { test, type Browser, type BrowserContext, type Page, type Request, type Response } from "@playwright/test";
import { BrowserFailures, browserOperationTitle, capturedValue, capturePageSnapshot, check, collectProtectedValues, createNativeBrowser, emittedCookieAttributes, fail, finishBrowserRun, IDLE_MS, installPageObservation, ORIGIN, PrivacyObservation, readBinding, record, type Binding, type BrowserOperation, type BrowserStep, type CookieReason, type CookieStep, type Evidence, type Kind, type NativeBrowserOwner, type RunStep } from "./evidence";
import path from "node:path";

const COOKIE = "__Host-ritomer-session";
const FOLDER = "/closing-folders/036a0000-0000-4000-8000-000000000004";
const API_FOLDER = `/api${FOLDER}`;
type Json = Record<string, unknown>;
async function operation<T>(failures: BrowserFailures, name: BrowserOperation, work: () => Promise<T>, timeout = 10_000, step = failures.currentBrowserStep): Promise<T> {
  let enabled = false;
  try { enabled = typeof test.info === "function" && typeof test.step === "function" && test.info().title === "m1d-browser"; }
  catch { /* Imported unit fixture or invocation outside the Playwright runner. */ }
  if (!enabled || failures.currentBrowserStep === "FINALIZATION") return work();
  try {
    // Only the awaited primitive belongs inside this callback. A timeout does
    // not cancel it: no later scenario action may run in that continuation.
    const value = await test.step(browserOperationTitle(step, name), work, { timeout });
    failures.completeOperation(name); return value;
  } catch (error) { failures.operationFailure(step, name, error); throw fail("BROWSER"); }
}
async function json(response: Response, failures: BrowserFailures, step?: BrowserStep): Promise<Json> {
  const body: unknown = await operation(failures, "READ_RESPONSE_JSON", () => response.json(), 10_000, step);
  check(body && typeof body === "object" && !Array.isArray(body)); return body as Json;
}
const endpoint = (response: Response, pathname: string) => new URL(response.url()).pathname === pathname;
const delay = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

// All raw observations and protected values stay in worker memory. Asynchronous
// listeners record failure, never throw an unhandled raw browser/network Error.
export class Observer extends PrivacyObservation {
  readonly pending = new Set<Promise<void>>();
  readonly bootstrap: Json[] = [];
  readonly responses: Array<{ path: string; method: string; status: number; code: unknown }> = [];
  requests = 0; logins = 0; writes = 0;
  cookiePhase: "bootstrap" | "continuity" | "login" | null = null;
  readonly requestOrder = new WeakMap<Request, number>();
  private readonly cookiePhases = new WeakMap<Request, Observer["cookiePhase"]>();
  idle = false; idleRequests = 0; focus = 0; visibility = 0; channels = 0;
  constructor(readonly context: BrowserContext, readonly failures: BrowserFailures) {
    super((value, counts) => { failures.notePrivacyViolation(value); Object.assign(failures.cookieFacts, counts); });
    context.on("request", request => {
      try {
      const url = new URL(request.url());
      if (url.origin === ORIGIN && url.pathname.startsWith("/api/")) {
        this.requests++;
        this.requestOrder.set(request, this.requests);
        const watched = (request.method() === "GET" && ["/api/session/bootstrap", "/api/me"].includes(url.pathname))
          || (request.method() === "POST" && url.pathname === "/api/session/local");
        this.cookiePhases.set(request, watched ? this.cookiePhase : null);
        if (this.idle) this.idleRequests++;
        if (url.pathname === "/api/session/local" && request.method() === "POST") this.logins++;
        if (request.method() === "PUT" && url.pathname.includes("/workpapers/")) this.writes++;
        const headers = request.headers();
        const authorization = Boolean(headers.authorization);
        const tenantOnSession = Boolean(headers["x-tenant-id"]) && (url.pathname === "/api/session" || url.pathname.startsWith("/api/session/"));
        // A tenant selector on a business API is contractual transport. It
        // remains protected against exposure on every observed page surface.
        if (authorization || tenantOnSession) this.violation(authorization && tenantOnSession ? "AUTHORIZATION_AND_TENANT_SESSION_HEADERS"
          : authorization ? "AUTHORIZATION_HEADER" : "TENANT_SESSION_HEADER", "REQUEST_HEADERS", authorization ? tenantOnSession ? "AMBIGUOUS" : "NONE" : "TENANT_ID");
      }
      } catch { this.lost++; this.failures.note("OBSERVER"); }
    });
    context.on("response", response => {
      try {
      const url = new URL(response.url());
      if (url.origin !== ORIGIN || !url.pathname.startsWith("/api/")) return;
      const phase = this.cookiePhases.get(response.request());
      const facts = this.failures.cookieFacts;
      if (phase && url.pathname === "/api/session/bootstrap") facts[phase === "login" ? "authenticatedStatus" : phase === "continuity" ? "continuityStatus" : "bootstrapStatus"] = response.status();
      if (phase && url.pathname === "/api/session/local") facts.loginStatus = response.status();
      if (phase && url.pathname === "/api/me") facts.meStatus = response.status();
      // Establish HTTP failure synchronously, before headers/body or UI waits.
      // Receipt alone does not complete a scenario control; optional error JSON
      // stays unknown rather than delaying the first observed refusal.
      if (phase && response.status() !== (url.pathname === "/api/session/local" ? 204 : 200)) {
        const step: CookieStep = url.pathname === "/api/session/local" ? "LOGIN_RESPONSE" : url.pathname === "/api/me" ? "ME_RESPONSE"
          : phase === "login" ? "AUTHENTICATED_RESPONSE" : phase === "continuity" ? "CONTINUITY_RESPONSE" : "BOOTSTRAP_RESPONSE";
        this.failures.cookieFailure(step, "HTTP_STATUS");
        this.failures.note("OBSERVER");
      }
      const operation = this.failures.capture("OBSERVER", () => this.response(response, url.pathname, phase), phase ? "OBSERVER" : undefined).then(result => { if (!result.ok) this.lost++; });
      this.pending.add(operation); void operation.then(() => { this.pending.delete(operation); });
      } catch { this.lost++; this.failures.note("OBSERVER"); }
    });
  }
  private async response(response: Response, pathname: string, phase?: Observer["cookiePhase"]) {
    const step = this.failures.currentBrowserStep;
    const headers = await operation(this.failures, "READ_RESPONSE_HEADERS", () => response.headersArray(), 10_000, step);
    for (const h of headers.filter(h => h.name.toLowerCase() === "set-cookie")) {
      const match = /^__Host-ritomer-session=([^;]+)/.exec(h.value);
      if (match) this.protect(match[1], "SESSION_COOKIE");
    }
    let body: Json = {};
    const bodyStep: CookieStep = pathname === "/api/me" ? "ME_BODY" : phase === "login" ? "AUTHENTICATED_BODY" : phase === "continuity" ? "CONTINUITY_BODY" : "BOOTSTRAP_BODY";
    if ((!phase || response.status() === 200) && response.status() !== 204 && (pathname === "/api/session/bootstrap" || pathname === "/api/me" || response.status() >= 400)) {
      body = phase ? await this.failures.cookieControl(bodyStep, "INVALID_BODY", () => json(response, this.failures, step)) : await json(response, this.failures, step);
    }
    if (pathname === "/api/session/bootstrap" && response.status() === 200) {
      if (phase) await this.failures.cookieControl(bodyStep, "INVALID_BODY", async () => { collectProtectedValues(pathname, body, this.protectedValues, this.protectedCategories); });
      else collectProtectedValues(pathname, body, this.protectedValues, this.protectedCategories);
      this.bootstrap.push(body);
    }
    if (pathname === "/api/me" && response.status() === 200) {
      if (phase) await this.failures.cookieControl("ME_BODY", "INVALID_BODY", async () => { collectProtectedValues(pathname, body, this.protectedValues, this.protectedCategories); });
      else collectProtectedValues(pathname, body, this.protectedValues, this.protectedCategories);
    }
    if (this.responses.length >= 2000) { this.lost++; return; }
    this.responses.push({ path: pathname, method: response.request().method(), status: response.status(), code: body.code });
  }
  async install() {
    await operation(this.failures, "INSTALL_OBSERVER", () => this.context.exposeBinding("__m1dObserve", (_source, type: string, value: unknown, surface?: unknown) => {
      if (type === "focus") this.focus++;
      else if (type === "visibility") this.visibility++;
      else if (type === "channel") { this.channels++; this.sample(value, "CHANNEL"); if (value !== '{"type":"SESSION_CHANGED"}') this.violation("CHANNEL_SHAPE", "CHANNEL", "NONE"); }
      else if (type === "sample" && surface === "DOM") this.sample(value, "DOM");
      else this.lost++;
    }));
    await operation(this.failures, "INSTALL_OBSERVER", () => this.context.addInitScript(installPageObservation));
    this.context.on("page", page => {
      page.on("console", message => this.sample(message.text(), "CONSOLE"));
      page.on("pageerror", () => { this.lost++; });
      page.on("crash", () => { this.lost++; });
      page.on("framenavigated", frame => this.sample(frame.url(), "URL"));
    });
  }
  async flush() { await operation(this.failures, "OBSERVER_FLUSH", () => Promise.all(this.pending)); check(this.lost === 0); }
  async scan() {
    await this.flush();
    for (const page of this.context.pages()) {
      try { if (!await operation(this.failures, "PAGE_FLUSH", () => page.evaluate(() => (window as unknown as { __m1dFlush: () => Promise<boolean> }).__m1dFlush()))) this.lost++; }
      catch { this.lost++; throw fail("OBSERVATION"); }
      check(this.lost === 0);
      await this.capture(() => operation(this.failures, "PAGE_SNAPSHOT", () => page.evaluate(capturePageSnapshot)), "PAGE_SNAPSHOT");
      check(this.lost === 0);
    }
    this.completeScan();
  }
}

function storedCookieAttributes(c: Awaited<ReturnType<BrowserContext["cookies"]>>[number]): number {
  return Number(c.name === COOKIE) + 2 * Number(c.secure) + 4 * Number(c.httpOnly)
    + 8 * Number(c.path === "/" && c.domain === "127.0.0.1") + 16 * Number(c.sameSite === "Lax");
}
export async function cookie(context: BrowserContext, failures?: BrowserFailures, step: CookieStep = "COOKIE_ACCEPTANCE", operationFailures = failures) {
  // URL filtering in Playwright hides Secure cookies on this fixed HTTP/IP origin.
  // Select the exact stored tuple, then validate; attributes must not hide duplicates.
  const cookies = (operationFailures ? await operation(operationFailures, "READ_COOKIES", () => context.cookies()) : await context.cookies())
    .filter(c => c.name === COOKIE && c.domain === "127.0.0.1" && c.path === "/");
  if (failures && step === "COOKIE_ACCEPTANCE") {
    failures.cookieFacts.acceptedCount = cookies.length; failures.cookieFacts.acceptedMask = null;
  }
  if (cookies.length !== 1) {
    failures?.cookieFailure(step, cookies.length === 0 ? "COOKIE_ABSENT" : "COOKIE_COUNT");
    check(false);
  }
  const item = cookies[0], mask = storedCookieAttributes(item);
  if (failures && step === "COOKIE_ACCEPTANCE") failures.cookieFacts.acceptedMask = mask;
  if (mask !== 31) failures?.cookieFailure(step, "COMPARISON");
  check(mask === 31); return item;
}
export async function activateLogoutPage(page: Page, failures: BrowserFailures) {
  // Native locator actionability needs frames from the user-visible A tab.
  // After A2 and isolated B, A1 must be activated before its logout action.
  await operation(failures, "ACTIVATE_PAGE", () => page.bringToFront());
  check(await operation(failures, "READ_PAGE_STATE", () => page.evaluate(() => document.visibilityState === "visible")));
}
function actionResponse(observer: Observer, after: number, pathname: string, method: string) {
  return (r: Response) => new URL(r.url()).origin === ORIGIN && endpoint(r, pathname) && r.request().method() === method && (observer.requestOrder.get(r.request()) ?? 0) > after;
}
async function openAnonymous(page: Page, observer: Observer, route = "/", phase?: "bootstrap" | "continuity") {
  observer.cookiePhase = phase ?? null;
  const f = observer.failures, after = observer.requests;
  const control = <T>(step: CookieStep, reason: CookieReason, operation: () => Promise<T>) => phase ? f.cookieControl(step, reason, operation) : operation();
  const responseStep = phase === "continuity" ? "CONTINUITY_RESPONSE" : "BOOTSTRAP_RESPONSE";
  const bodyStep = phase === "continuity" ? "CONTINUITY_BODY" : "BOOTSTRAP_BODY";
  const bootstrap = f.capture("RESPONSE", () => page.waitForResponse(actionResponse(observer, after, "/api/session/bootstrap", "GET")), phase ? responseStep : undefined, "NO_RESPONSE");
  await control("NAVIGATION", "OPERATION_FAILED", () => page.goto(ORIGIN + route));
  const response = capturedValue(await bootstrap);
  if (phase) f.cookieFacts[phase === "continuity" ? "continuityStatus" : "bootstrapStatus"] = response.status();
  await control(responseStep, "HTTP_STATUS", async () => { check(response.status() === 200); });
  const body = await control(bodyStep, "INVALID_BODY", async () => { const value = await json(response, f); check(value && typeof value === "object" && !Array.isArray(value)); return value; });
  if (phase) f.cookieFacts[phase === "continuity" ? "continuityState" : "bootstrapState"] = body.sessionState === "ANONYMOUS" || body.sessionState === "AUTHENTICATED" ? body.sessionState : "OTHER";
  await control(bodyStep, "STATE", async () => { check(body.sessionState === "ANONYMOUS"); });
  await control(phase === "continuity" ? "CONTINUITY_UI" : "ANONYMOUS_UI", "UI_NOT_REACHED", () => page.getByRole("heading", { name: "Se connecter", exact: true }).waitFor());
  await control("OBSERVER", "OPERATION_FAILED", () => observer.flush());
  return { response, body };
}
async function login(page: Page, observer: Observer, actorKey: "actor-01" | "actor-02", diagnostic = false) {
  const f = observer.failures;
  observer.cookiePhase = diagnostic ? "login" : null;
  const control = <T>(step: CookieStep, reason: CookieReason, operation: () => Promise<T>) => diagnostic ? f.cookieControl(step, reason, operation) : operation();
  const location = new URL(page.url());
  const returnPath = !location.search && !location.hash && /^(?:\/|\/closing-folders\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/.test(location.pathname) ? location.pathname : "/";
  const actor = await control("LOGIN_ACTION", "STATE", async () => {
    const body = observer.bootstrap.at(-1); check(body?.sessionState === "ANONYMOUS");
    const actors = body.actors as Array<{ actorKey: string; displayLabel: string }>;
    const found = actors.find(a => a.actorKey === actorKey); check(found); return found;
  });
  const after = observer.requests;
  const post = f.capture("RESPONSE", () => page.waitForResponse(actionResponse(observer, after, "/api/session/local", "POST")), diagnostic ? "LOGIN_RESPONSE" : undefined, "NO_RESPONSE");
  const authenticated = diagnostic ? f.capture("RESPONSE", () => page.waitForResponse(actionResponse(observer, after, "/api/session/bootstrap", "GET")), "AUTHENTICATED_RESPONSE", "NO_RESPONSE") : undefined;
  const me = f.capture("RESPONSE", () => page.waitForResponse(actionResponse(observer, after, "/api/me", "GET")), diagnostic ? "ME_RESPONSE" : undefined, "NO_RESPONSE");
  await control("LOGIN_ACTION", "UI_NOT_REACHED", () => page.getByRole("button", { name: actor.displayLabel, exact: true }).click());
  const response = capturedValue(await post);
  if (diagnostic) f.cookieFacts.loginStatus = response.status();
  await control("LOGIN_RESPONSE", "HTTP_STATUS", async () => { check(response.status() === 204); });
  if (diagnostic) {
    const auth = capturedValue(await authenticated!); f.cookieFacts.authenticatedStatus = auth.status();
    await control("AUTHENTICATED_RESPONSE", "HTTP_STATUS", async () => { check(auth.status() === 200); });
    await control("AUTHENTICATED_BODY", "INVALID_BODY", async () => {
      const body = await json(auth, f); check(body && typeof body === "object" && !Array.isArray(body));
      f.cookieFacts.authenticatedState = body.sessionState === "ANONYMOUS" || body.sessionState === "AUTHENTICATED" ? body.sessionState : "OTHER";
    });
    await control("AUTHENTICATED_BODY", "STATE", async () => { check(f.cookieFacts.authenticatedState === "AUTHENTICATED"); });
  }
  const meResponse = capturedValue(await me);
  if (diagnostic) f.cookieFacts.meStatus = meResponse.status();
  await control("ME_RESPONSE", "HTTP_STATUS", async () => { check(meResponse.status() === 200); });
  const profile = await control("ME_BODY", "INVALID_BODY", () => json(meResponse, f));
  await control("ROLE", "ROLE", async () => {
    const matches = Array.isArray(profile.effectiveRoles) && profile.effectiveRoles.includes(actorKey === "actor-01" ? "ACCOUNTANT" : "REVIEWER");
    if (diagnostic) f.cookieFacts.roleMatches = matches; check(matches);
  });
  await control("AUTHENTICATED_UI", "UI_NOT_REACHED", async () => {
    await page.getByRole("button", { name: "Déconnexion", exact: true }).waitFor(); await page.waitForURL(ORIGIN + returnPath);
  });
  await control("OBSERVER", "OPERATION_FAILED", () => observer.flush());
  await control("AUTHENTICATED_BODY", "STATE", async () => { check(observer.bootstrap.at(-1)?.sessionState === "AUTHENTICATED"); });
  return response;
}
export async function proofCookie(page: Page, observer: Observer, e: Evidence) {
  const f = observer.failures, facts = f.cookieFacts;
  const scan = async (step: CookieStep) => f.cookieControl(step, "PRIVACY", async () => {
    try { await observer.scan(); } finally { facts.privacyScans = observer.scans; facts.privacyViolations = observer.violations; facts.lostObservations = observer.lost; }
  });
  try {
  const { response } = await openAnonymous(page, observer, "/", "bootstrap");
  await f.cookieControl("COOKIE_EMISSION", "COOKIE_COUNT", async () => {
    const emitted = (await operation(f, "READ_RESPONSE_HEADERS", () => response.headersArray())).filter(h => h.name.toLowerCase() === "set-cookie" && h.value.startsWith(COOKIE + "="));
    facts.emittedCount = emitted.length; check(emitted.length === 1); facts.emittedMask = emittedCookieAttributes(emitted[0].value); record(e, "emittedCookie", facts.emittedMask);
  });
  const before = await f.cookieControl("COOKIE_ACCEPTANCE", "OPERATION_FAILED", async () => {
    const c = await cookie(observer.context, f);
    record(e, "acceptedCookie", storedCookieAttributes(c)); return c;
  });
  await scan("ANONYMOUS_PRIVACY"); e.windows.push("anonymous");
  // Reload is a real bootstrap through the application, not a cookie injection.
  await openAnonymous(page, observer, "/", "continuity");
  await f.cookieControl("CONTINUITY", "COMPARISON", async () => { facts.continuity = (await cookie(observer.context, f, "CONTINUITY")).value === before.value; record(e, "continuity", Number(facts.continuity)); });
  const post = await login(page, observer, "actor-01", true);
  record(e, "login", post.status());
  await f.cookieControl("ROTATION", "COMPARISON", async () => {
    facts.rotation = (await cookie(observer.context, f, "ROTATION")).value !== before.value; record(e, "rotation", Number(facts.rotation));
  });
  record(e, "authenticated", Number(observer.bootstrap.at(-1)?.sessionState === "AUTHENTICATED"));
  record(e, "me", observer.responses.filter(r => r.path === "/api/me").at(-1)!.status);
  await scan("AUTHENTICATED_PRIVACY"); e.windows.push("authenticated");
  } finally { observer.cookiePhase = null; }
}
async function workpapers(page: Page) { await page.getByRole("tab", { name: "Preuves", exact: true }).click(); }
async function windowScan(e: Evidence, name: string, observers: Observer[]) { for (const o of observers) await o.scan(); e.windows.push(name); }

export async function reviewerWriteRequest({ url, token, body, tenantId }: { url: string; token: string; body: string; tenantId: string }) {
  const r = await fetch(url, { method: "PUT", credentials: "same-origin", headers: { "Content-Type": "application/json", "X-CSRF-TOKEN": token, "X-Tenant-Id": tenantId }, body });
  return { status: r.status, code: (await r.json() as { code: string }).code };
}

export function workpaperEditor(page: Page) {
  // `has` is relative to each article. Select the article first, then keep
  // its note and save button together even when several articles are editable.
  const article = page.getByRole("article").filter({ has: page.getByLabel("Note de justification", { exact: true }) }).first();
  return { note: article.getByLabel("Note de justification", { exact: true }), save: article.getByRole("button", { name: "Enregistrer la justification", exact: true }) };
}

export function reviewerReadOnly(page: Page) {
  // Inactive panels remain mounted. Mapping has the same read-only text and
  // precedes Preuves, so a document-wide first match waits on a hidden panel.
  return page.getByRole("tabpanel", { name: "Preuves", exact: true }).getByText(/^lecture seule$/i).first();
}

async function journey(browser: Browser, a: BrowserContext, page: Page, oa: Observer, e: Evidence, contexts: BrowserContext[], observers: Observer[]) {
  const f = oa.failures;
  f.setBrowserStep("OPEN_FOLDER");
  const folderCard = page.getByRole("list", { name: "liste dossiers" }).getByRole("listitem").filter({ hasText: "Demo Closing FY2025 (synthetic)" });
  const open = folderCard.getByRole("link", { name: "Ouvrir", exact: true }); await open.focus(); await page.keyboard.press("Enter");
  await page.waitForURL(ORIGIN + FOLDER); await workpapers(page);
  record(e, "keyboard", Number(page.url() === ORIGIN + FOLDER));
  await page.setViewportSize({ width: 390, height: 844 });
  f.setBrowserStep("FIND_NOTE");
  const editor = workpaperEditor(page); await editor.note.waitFor();
  await windowScan(e, "folder", observers);
  const noteText = `Observation synthetique M1.1D ${e.runId}`;
  f.setBrowserStep("SAVE_NOTE");
  await editor.note.fill(noteText);
  const saved = oa.failures.capture("RESPONSE", () => page.waitForResponse(r => r.request().method() === "PUT" && new URL(r.url()).pathname.startsWith(API_FOLDER + "/workpapers/")));
  await editor.save.click();
  const response = capturedValue(await saved); check([200, 201].includes(response.status()));
  const writeUrl = response.url(), payload = response.request().postData(); check(payload);
  const tenantId = response.request().headers()["x-tenant-id"]; check(typeof tenantId === "string" && tenantId.length > 0);
  record(e, "noteWrite", response.status());
  f.setBrowserStep("RELOAD_NOTE");
  await page.reload(); await workpapers(page);
  check(await workpaperEditor(page).note.inputValue() === noteText);
  await windowScan(e, "write", observers);

  // One negative header change on one real application request. No fulfillment,
  // response mock, session injection or private coordinator call.
  f.setBrowserStep("CSRF_REFUSAL");
  let altered = 0;
  await page.route(writeUrl, oa.failures.route(async route => {
    if (route.request().method() !== "PUT") { await route.continue(); return; }
    altered++;
    await route.continue({ headers: { ...route.request().headers(), "x-csrf-token": "synthetic-invalid-csrf" } });
  }), { times: 1 });
  try {
    const beforeWrites = oa.writes, beforeBootstraps = oa.bootstrap.length;
    const rejected = oa.failures.capture("RESPONSE", () => page.waitForResponse(r => r.url() === writeUrl && r.request().method() === "PUT"));
    const renewal = oa.failures.capture("RESPONSE", () => page.waitForResponse(r => endpoint(r, "/api/session/bootstrap") && r.status() === 200));
    await workpaperEditor(page).note.fill(noteText + " refused");
    await workpaperEditor(page).save.click();
    const denied = capturedValue(await rejected); check(denied.status() === 403 && (await json(denied, f)).code === "CSRF_REJECTED");
    capturedValue(await renewal); await page.getByRole("button", { name: "Déconnexion", exact: true }).waitFor(); await oa.flush();
    check(altered === 1); record(e, "csrfRefusal", denied.status());
    record(e, "csrfRenewal", Number(oa.bootstrap.length > beforeBootstraps && oa.bootstrap.at(-1)?.sessionState === "AUTHENTICATED"));
    check(oa.writes === beforeWrites + 1);
  } catch (error) { f.browserFailure(error); f.note("JOURNEY"); throw new Error("M1D_JOURNEY_FAILED"); }
  finally { capturedValue(await oa.failures.capture("ROUTE", () => page.unroute(writeUrl))); }
  await windowScan(e, "csrf", observers);

  f.setBrowserStep("REVIEWER_ROLE");
  const b = await operation(f, "CREATE_CONTEXT", () => browser.newContext({ acceptDownloads: false })); contexts.push(b); b.setDefaultTimeout(10_000); b.setDefaultNavigationTimeout(10_000);
  const ob = new Observer(b, oa.failures); observers.push(ob); await ob.install(); const pb = await operation(f, "CREATE_PAGE", () => b.newPage());
  await openAnonymous(pb, ob); await login(pb, ob, "actor-02"); await pb.goto(ORIGIN + FOLDER); await workpapers(pb);
  await reviewerReadOnly(pb).waitFor();
  record(e, "roleReadOnly", Number(await pb.getByLabel("Note de justification", { exact: true }).count() === 0));
  const csrf = (ob.bootstrap.at(-1)?.csrf as Json).token; check(typeof csrf === "string");
  const denied = await operation(f, "REVIEWER_FETCH", () => pb.evaluate(reviewerWriteRequest, { url: writeUrl, token: csrf, tenantId, body: JSON.stringify({ ...JSON.parse(payload) as Json, noteText: noteText + " refused-reviewer" }) }));
  check(denied.status === 403 && denied.code === "ACCESS_DENIED"); record(e, "roleRefusal", denied.status);
  await page.reload(); await workpapers(page);
  record(e, "noteRead", Number(await workpaperEditor(page).note.inputValue() === noteText));
  await windowScan(e, "roles", observers);

  f.setBrowserStep("FOCUS_VISIBILITY");
  const second = await operation(f, "CREATE_PAGE", () => a.newPage()); await second.goto(ORIGIN + FOLDER); await second.getByRole("button", { name: "Déconnexion", exact: true }).waitFor();
  const focusBefore = oa.focus, v = oa.visibility;
  await operation(f, "ACTIVATE_PAGE", () => pb.bringToFront()); await operation(f, "ACTIVATE_PAGE", () => second.bringToFront()); await operation(f, "ACTIVATE_PAGE", () => page.bringToFront());
  const focusDeadline = performance.now() + 5_000;
  while ((oa.focus <= focusBefore || oa.visibility <= v) && performance.now() < focusDeadline) await delay(25);
  await oa.flush();
  check(await operation(f, "PAGE_FLUSH", () => page.evaluate(() => (window as unknown as { __m1dFlush: () => Promise<boolean> }).__m1dFlush())));
  record(e, "nativeFocus", Number(oa.focus > focusBefore)); record(e, "nativeVisibility", Number(oa.visibility > v));
  check(oa.focus > focusBefore && oa.visibility > v);
  await page.setViewportSize({ width: 390, height: 844 });
  record(e, "narrow", Number(await operation(f, "READ_PAGE_STATE", () => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))));
  await windowScan(e, "before-idle", observers);
  await oa.flush();
  // A quiet interval starts only after requests have completed. Every A page is
  // observed at context level; no authenticated heartbeat runs during the wait.
  // Different incognito windows need not hide A in headless Chromium. Leave A1
  // genuinely hidden behind A2 before idle, then reactivate only A1 for expiry.
  const beforeIdleRequests = oa.requests;
  const idleReady = oa.failures.capture("RESPONSE", () => second.waitForResponse(actionResponse(oa, beforeIdleRequests, "/api/session/bootstrap", "GET")));
  await operation(f, "ACTIVATE_PAGE", () => second.bringToFront());
  check(capturedValue(await idleReady).status() === 200);
  await page.waitForLoadState("networkidle"); await second.waitForLoadState("networkidle");
  await oa.flush();
  check(await operation(f, "READ_PAGE_STATE", () => page.evaluate(() => document.visibilityState === "hidden")));
  check(await operation(f, "READ_PAGE_STATE", () => second.evaluate(() => document.visibilityState === "visible")));
  const initialWrites = oa.writes, initialLogins = oa.logins;
  f.setBrowserStep("IDLE");
  oa.idle = true; record(e, "idleStart", Date.now());
  const idleAt = performance.now();
  await operation(f, "IDLE_WAIT", async () => {
    while (performance.now() - idleAt < IDLE_MS) await delay(Math.min(1000, IDLE_MS - (performance.now() - idleAt)));
  }, 0);
  // Drain protocol observations for every A page before closing the interval;
  // these DOM reads neither focus a page nor issue an authenticated request.
  for (const idlePage of a.pages()) await operation(f, "READ_PAGE_STATE", () => idlePage.evaluate(() => document.visibilityState));
  await oa.flush();
  record(e, "idleEnd", Date.now()); oa.idle = false; record(e, "idleRequests", oa.idleRequests); check(oa.idleRequests === 0);
  f.setBrowserStep("EXPIRY");
  const expiry = oa.failures.capture("RESPONSE", () => page.waitForResponse(r => r.status() === 401 && new URL(r.url()).pathname.startsWith("/api/")));
  await operation(f, "ACTIVATE_PAGE", () => page.bringToFront());
  const expired = capturedValue(await expiry); check((await json(expired, f)).code === "SESSION_EXPIRED"); record(e, "expiredResponse", expired.status());
  const heading = page.getByRole("heading", { name: "Session expirée", exact: true }); await heading.waitFor();
  record(e, "expiredUI", Number(await heading.evaluate(element => element === document.activeElement) && await page.getByLabel("Note de justification", { exact: true }).count() === 0));
  await windowScan(e, "expired", observers); record(e, "automaticLogin", oa.logins - initialLogins); check(oa.writes === initialWrites);
  f.setBrowserStep("RECONNECT");
  await page.getByRole("button", { name: "Se reconnecter", exact: true }).click(); await page.getByRole("heading", { name: "Se connecter", exact: true }).waitFor(); await oa.flush();
  record(e, "explicitLogin", (await login(page, oa, "actor-01")).status());
  const safeReturn = page.url() === ORIGIN + FOLDER;
  await operation(f, "ACTIVATE_PAGE", () => second.bringToFront()); await second.getByRole("button", { name: "Déconnexion", exact: true }).waitFor();
  await windowScan(e, "reconnected", observers);

  // B has its own idle lifetime. Recreate B explicitly now; its pre-idle login
  // is never used as evidence that A logout preserved an authenticated B.
  f.setBrowserStep("ISOLATED_REVIEWER");
  await operation(f, "CLOSE_CONTEXT", () => b.close()); contexts.splice(contexts.indexOf(b), 1);
  const freshB = await operation(f, "CREATE_CONTEXT", () => browser.newContext({ acceptDownloads: false })); contexts.push(freshB); freshB.setDefaultTimeout(10_000); freshB.setDefaultNavigationTimeout(10_000);
  const freshObserver = new Observer(freshB, oa.failures); observers.push(freshObserver); await freshObserver.install(); const freshPage = await operation(f, "CREATE_PAGE", () => freshB.newPage());
  await openAnonymous(freshPage, freshObserver, FOLDER + "?next=https%3A%2F%2Fexample.invalid"); await login(freshPage, freshObserver, "actor-02");
  record(e, "safeReturn", Number(safeReturn && freshPage.url() === ORIGIN + "/"));
  f.setBrowserStep("LOGOUT");
  await activateLogoutPage(page, f);
  const oldSession = (await cookie(a, undefined, undefined, f)).value;
  const loggedOut = oa.failures.capture("RESPONSE", () => page.waitForResponse(r => endpoint(r, "/api/session/logout")));
  await page.getByRole("button", { name: "Déconnexion", exact: true }).click();
  const logoutResponse = capturedValue(await loggedOut); record(e, "logout", logoutResponse.status());
  const cleared = (await operation(f, "READ_RESPONSE_HEADERS", () => logoutResponse.headersArray())).some(h => h.name.toLowerCase() === "set-cookie" && h.value.startsWith(COOKIE + "=") && /max-age=0/i.test(h.value)); check(cleared);
  await page.getByRole("heading", { name: "Se connecter", exact: true }).waitFor(); await oa.flush();
  // Negative-only replay of the revoked credential through the real Vite. No
  // browser cookie injection, no successful login obtained with this probe.
  const revoked = await fetch(ORIGIN + "/api/me", { headers: { Cookie: `${COOKIE}=${oldSession}` }, redirect: "error", signal: AbortSignal.timeout(5000) });
  record(e, "logoutInvalidated", Number(revoked.status === 401));
  record(e, "anonymousAfterLogout", Number(oa.bootstrap.at(-1)?.sessionState === "ANONYMOUS" && (await cookie(a, undefined, undefined, f)).value !== oldSession));
  f.setBrowserStep("SHARED_LOGOUT");
  await operation(f, "ACTIVATE_PAGE", () => second.bringToFront());
  const secondAnonymous = second.getByRole("heading", { name: "Se connecter", exact: true }); await secondAnonymous.waitFor();
  record(e, "sharedLogout", Number(oa.channels > 0 && await secondAnonymous.isVisible()));
  const stillB = oa.failures.capture("RESPONSE", () => freshPage.waitForResponse(r => endpoint(r, "/api/me"))); await freshPage.reload();
  record(e, "otherContextReady", Number(capturedValue(await stillB).status() === 200)); await freshPage.getByRole("button", { name: "Déconnexion", exact: true }).waitFor();
  await windowScan(e, "logout", observers);
  record(e, "csrfReplay", oa.writes - 2);
}

for (const kind of ["cookie", "browser"] as const) test(`m1d-${kind}`, async ({ playwright }, info) => {
  let browser: Browser | undefined;
  let nativeOwner: NativeBrowserOwner | undefined;
  const contexts: BrowserContext[] = [], observers: Observer[] = [];
  let evidence: Evidence | undefined, binding: Binding | undefined;
  const failures = new BrowserFailures();
  let step: RunStep = "BINDING";
  try {
    binding = readBinding(process.env, process.argv); check(!binding.discovery && binding.kind === kind);
    step = "LAUNCH";
    failures.setBrowserStep("LAUNCH");
    if (kind === "browser") {
      const tempRoot = path.join(binding.root, "volatile", "integrated", "browser_journey-child", "tmp");
      check(path.resolve(process.env.TEMP ?? "") === tempRoot && process.env.TMP === process.env.TEMP);
      nativeOwner = createNativeBrowser(playwright.chromium, binding.executable, tempRoot);
      // The owner exists before connecting. Its protocol sequence has no
      // independent resource creation; late replies remain owned by it.
      browser = await operation(failures, "NATIVE_CONNECT", () => nativeOwner!.connect());
    } else browser = await playwright.chromium.launch({ executablePath: binding.executable, headless: true, chromiumSandbox: true, timeout: 10_000 });
    evidence = { schemaVersion: 1, kind: kind as Kind, runId: binding.runId, objectSha: binding.objectSha, runtimeSha: binding.runtimeSha, frontendSha: binding.frontendSha,
      browserVersion: browser.version(), observations: [], windows: [] };
    step = "CONTEXT";
    failures.setBrowserStep("CONTEXT");
    const a = nativeOwner?.context ?? await operation(failures, "CREATE_CONTEXT", () => browser!.newContext({ acceptDownloads: false })); contexts.push(a); a.setDefaultTimeout(10_000); a.setDefaultNavigationTimeout(10_000);
    const initialPages = a.pages();
    const observer = new Observer(a, failures); observers.push(observer); await observer.install(); const page = await operation(failures, "CREATE_PAGE", () => a.newPage());
    // New profile's initial blank tabs carry no application observations. Close
    // them after creating the observed page, so the last window never closes.
    await Promise.all(initialPages.map(initial => operation(failures, "CLOSE_PAGE", () => initial.close())));
    step = "COOKIE";
    failures.setBrowserStep("COOKIE");
    await proofCookie(page, observer, evidence);
    step = "JOURNEY";
    if (kind === "browser") await journey(browser, a, page, observer, evidence, contexts, observers);
    step = "PRIVACY";
    failures.setBrowserStep("PRIVACY");
    for (const o of observers) await failures.cookieControl("FINAL_PRIVACY", "PRIVACY", async () => {
      try { await o.scan(); } finally { failures.cookieFacts.privacyScans = o.scans; failures.cookieFacts.privacyViolations = o.violations; failures.cookieFacts.lostObservations = o.lost; }
    });
  } catch (error) { failures.browserFailure(error); failures.note(step); }
  failures.setBrowserStep("FINALIZATION");
  const failure = await finishBrowserRun({ browser, contexts, observers, evidence, binding, failures, nativeOwner,
    attach: body => info.attach("m1d-observations", { body, contentType: "application/json" }) });
  if (failure) throw failure;
});
