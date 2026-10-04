// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import type { FullConfig, FullResult, Suite, TestCase, TestResult, TestStep } from "@playwright/test/reporter";
import { test as playwrightTest } from "@playwright/test";
import type { Browser, BrowserContext, Page, Request, Response, Route } from "@playwright/test";
import Reporter, { BROWSER, BrowserFailures, capturedValue, capturePageSnapshot, collectProtectedValues, createNativeBrowser, createNewFile, decode, emittedCookieAttributes, emptyCookieFacts, fail, finishBrowserRun, FINALIZATION_STEP_MS, IDLE_MS, installPageObservation, METRICS, PrivacyObservation, privacyLeaks, publish, readBinding, record, reduce, sanitizeFailure, validateCookieDiagnostic, validatePrivacyViolation, WINDOWS, type Binding, type CookieDiagnostic, type Evidence, type Kind, type NativeBrowserOwner, type PrivacySurface, type PrivacyValueCategory } from "./e2e/m1d/evidence";
vi.mock("@playwright/test", () => ({ test: vi.fn() })); // registration only; scenario functions below are real
import { activateLogoutPage, cookie, Observer, proofCookie, reviewerReadOnly, reviewerWriteRequest, workpaperEditor } from "./e2e/m1d/session.spec";
import { browserOperationTitle, ORIGIN, validateBrowserDiagnostic, type BrowserDiagnostic } from "./e2e/m1d/evidence";

it.skipIf(process.platform !== "win32")("uses one real article for the note and save button and reports the reproduced ambiguity safely", async () => {
  const { chromium } = await vi.importActual<typeof import("@playwright/test")>("@playwright/test");
  const root = mkdtempSync(path.join(os.tmpdir(), "m1d-synthetic-evidence-")); roots.push(root);
  const browser = await chromium.launch({ executablePath: BROWSER, headless: true, chromiumSandbox: true, timeout: 10_000,
    env: { SystemRoot: "C:\\Windows", WINDIR: "C:\\Windows", OS: "Windows_NT", Path: "C:\\Windows\\System32;C:\\Windows",
      TEMP: root, TMP: root, HOME: root, USERPROFILE: root, APPDATA: root, LOCALAPPDATA: root } });
  try {
    const context = await browser.newContext(), page = await context.newPage();
    await page.setContent(["one", "two"].map(id => `<article><label>Note de justification<textarea></textarea></label><button onclick="document.body.dataset.saved='${id}'">Enregistrer la justification</button></article>`).join(""));
    const historicNote = page.getByLabel("Note de justification", { exact: true }).first();
    const historicArticles = page.getByRole("article").filter({ has: historicNote });
    expect(await historicArticles.count()).toBe(2);
    const failures = new BrowserFailures(); failures.setBrowserStep("FIND_NOTE"); failures.setBrowserStep("SAVE_NOTE");
    let refused = false;
    try { await historicArticles.getByRole("button", { name: "Enregistrer la justification", exact: true }).click({ timeout: 1000 }); }
    catch (error) { refused = true; failures.browserFailure(error); failures.note("JOURNEY"); }
    expect(refused).toBe(true);
    expect(failures.browserDiagnostic).toEqual({ schemaVersion: 1, source: "SCENARIO", step: "SAVE_NOTE", lastCompleted: "FIND_NOTE", reason: "LOCATOR_AMBIGUOUS" });
    const editor = workpaperEditor(page);
    await editor.note.fill("synthetic-note"); await editor.save.click();
    expect(await page.locator("body").getAttribute("data-saved")).toBe("one");
    expect(await page.getByLabel("Note de justification", { exact: true }).evaluateAll(elements => elements.map(element => (element as HTMLTextAreaElement).value))).toEqual(["synthetic-note", ""]);
    // Failure attachment is made by the real finalizer with no success evidence.
    const b = binding(), e: Evidence = { ...fixture(), observations: [], windows: [] };
    let attachment: Buffer | undefined;
    const failure = await finishBrowserRun({ browser, contexts: [context], observers: [], evidence: e, binding: b, failures,
      attach: async body => { attachment = Buffer.from(body); } });
    expect(failure?.message).toBe("M1D_JOURNEY_FAILED");
    const lines: string[] = []; let published = false;
    const reporter = new Reporter(b, () => { published = true; }, line => { lines.push(line); }); begin(reporter);
    reporter.onTestEnd(testCase, { status: "failed", retry: 0, errors: [failure!], attachments: [
      { name: "m1d-observations", contentType: "application/json", body: attachment },
      { name: "error-context", contentType: "text/plain", get body() { throw new Error("UNFILTERED_ATTACHMENT_READ"); } }
    ] } as unknown as TestResult);
    expect(await reporter.onEnd({ status: "failed" } as FullResult)).toEqual({ status: "failed" });
    expect(published).toBe(false); expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0].slice("M1D_BROWSER_DIAGNOSTIC ".length)).diagnostic).toEqual(failures.browserDiagnostic);
    expect(lines[0]).not.toContain("synthetic-note"); expect(lines[0]).not.toContain("strict mode violation");
    expect(() => reduce(decode(attachment!, b))).toThrow("M1D_OBSERVATION_FAILED");
  } finally { await browser.close(); }
}, 25_000);

it.skipIf(process.platform !== "win32")("scopes reviewer read-only evidence to Preuves instead of hidden Mapping", async () => {
  const { chromium } = await vi.importActual<typeof import("@playwright/test")>("@playwright/test");
  const root = mkdtempSync(path.join(os.tmpdir(), "m1d-synthetic-evidence-")); roots.push(root);
  const browser = await chromium.launch({ executablePath: BROWSER, headless: true, chromiumSandbox: true, timeout: 10_000,
    env: { SystemRoot: "C:\\Windows", WINDIR: "C:\\Windows", OS: "Windows_NT", Path: "C:\\Windows\\System32;C:\\Windows",
      TEMP: root, TMP: root, HOME: root, USERPROFILE: root, APPDATA: root, LOCALAPPDATA: root } });
  try {
    const context = await browser.newContext(), page = await context.newPage();
    // Router keeps Mapping before Preuves, with children mounted under hidden.
    // Both real reviewer views render this exact text; labels link each panel.
    await page.setContent(`<button role="tab" id="mapping-tab">Mapping</button>
      <button role="tab" id="evidence-tab">Preuves</button>
      <section role="tabpanel" aria-labelledby="mapping-tab" id="mapping" hidden><p>lecture seule</p></section>
      <section role="tabpanel" aria-labelledby="evidence-tab" id="evidence"><p>lecture seule</p></section>`);
    const historical = page.getByText(/^lecture seule$/i).first();
    expect(await historical.evaluate(element => element.closest("section")?.id)).toBe("mapping");
    expect(await historical.isVisible()).toBe(false);
    const failures = new BrowserFailures(); failures.setBrowserStep("CSRF_REFUSAL"); failures.setBrowserStep("REVIEWER_ROLE");
    let timedOut = false;
    try { await historical.waitFor({ timeout: 1000 }); }
    catch (error) { timedOut = true; failures.browserFailure(error); }
    expect(timedOut).toBe(true);
    expect(failures.browserDiagnostic).toEqual({ schemaVersion: 1, source: "SCENARIO", step: "REVIEWER_ROLE", lastCompleted: "CSRF_REFUSAL", reason: "TIMEOUT" });
    await reviewerReadOnly(page).waitFor({ timeout: 1000 });
    expect(await reviewerReadOnly(page).evaluate(element => element.closest("section")?.id)).toBe("evidence");
    // A visible Mapping message cannot substitute for missing/hidden Preuves.
    await page.evaluate(() => { document.getElementById("mapping")!.hidden = false; document.getElementById("evidence")!.hidden = true; });
    expect(await page.getByText(/^lecture seule$/i).first().isVisible()).toBe(true);
    await expect(reviewerReadOnly(page).waitFor({ timeout: 1000 })).rejects.toMatchObject({ name: "TimeoutError" });
    await page.evaluate(() => document.getElementById("evidence")!.remove());
    await expect(reviewerReadOnly(page).waitFor({ timeout: 1000 })).rejects.toMatchObject({ name: "TimeoutError" });
  } finally { await browser.close(); }
}, 25_000);

it.skipIf(process.platform !== "win32")("observes native A tab transitions beside isolated B and confirms owned Chromium exit and profile removal", async () => {
  const { chromium } = await vi.importActual<typeof import("@playwright/test")>("@playwright/test");
  // Real loopback HTTP exercises ExtraInfo/body delivery and a live storage
  // scan. The data: fixture did not cover either prerequisite of the journey.
  const server = createServer((request, response) => {
    const body = request.url === "/api/session/bootstrap" ? JSON.stringify({ sessionState: "ANONYMOUS", localLoginAvailable: true,
      csrf: { headerName: "X-CSRF-TOKEN", token: "synthetic-native-http-csrf" }, actors: [{ actorKey: "actor-01", displayLabel: "Synthetic actor" }] })
      : request.url === "/" ? '<title>Synthetic native HTTP</title><p id="state">Ready</p>' : "";
    response.writeHead(body ? 200 : request.url === "/favicon.ico" ? 204 : 404, {
      "Content-Type": request.url === "/api/session/bootstrap" ? "application/json" : "text/html",
      "Content-Length": Buffer.byteLength(body), "Cache-Control": "no-store" });
    response.end(body);
  });
  const bodyDeadline = performance.now() + 30_000, listenController = new AbortController();
  let closing = false;
  const completed: string[] = [], pending = new Set<string>();
  let firstFailure: { label: string; reason: "TIMEOUT" | "REJECTED" } | undefined;
  async function bounded<T>(label: string, operation: () => Promise<T>, milliseconds = 5_000): Promise<T> {
    milliseconds = closing ? milliseconds : Math.min(milliseconds, bodyDeadline - performance.now());
    if (milliseconds <= 0) { firstFailure ??= { label, reason: "TIMEOUT" }; throw new Error(`SYNTHETIC_NATIVE_HTTP_TIMEOUT_${label}`); }
    pending.add(label);
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const result = await Promise.race([Promise.resolve().then(operation), new Promise<never>((_, reject) => {
        timer = setTimeout(() => { firstFailure ??= { label, reason: "TIMEOUT" }; reject(new Error(`SYNTHETIC_NATIVE_HTTP_TIMEOUT_${label}`)); }, milliseconds);
      })]);
      completed.push(label); return result;
    } catch (error) { firstFailure ??= { label, reason: "REJECTED" }; throw error; }
    finally { clearTimeout(timer); pending.delete(label); }
  }
  async function inspectHttp(label: "A" | "B", page: Page, observer: Observer) {
    const responsePromise = bounded(`${label}_RESPONSE`, () => page.waitForResponse(response => response.url() === `${ORIGIN}/api/session/bootstrap`
      && response.request().method() === "GET", { timeout: 5_000 }));
    const [consumed, response] = await Promise.all([bounded(`${label}_FETCH_BODY`, () => page.evaluate(async () => {
      document.getElementById("state")!.textContent = "Observed";
      const response = await fetch("/api/session/bootstrap", { cache: "no-store" });
      return (await response.json() as { sessionState?: unknown }).sessionState === "ANONYMOUS";
    })), responsePromise]);
    expect(consumed).toBe(true); expect(response.status()).toBe(200);
    const [headers, finished] = await Promise.all([bounded(`${label}_HEADERS`, () => response.headersArray()), bounded(`${label}_FINISHED`, () => response.finished())]);
    expect(finished).toBeNull();
    const body = await bounded(`${label}_JSON`, () => response.json());
    expect(headers.some(header => header.name.toLowerCase() === "content-type" && header.value.startsWith("application/json"))).toBe(true);
    expect(body.sessionState).toBe("ANONYMOUS");
    await bounded(`${label}_OBSERVER_FLUSH`, () => observer.flush());
    expect(await bounded(`${label}_PAGE_FLUSH`, () => page.evaluate(() =>
      (window as unknown as { __m1dFlush: () => Promise<boolean> }).__m1dFlush()))).toBe(true);
    await bounded(`${label}_LIVE_SCAN`, () => observer.scan());
    expect(observer.pending.size).toBe(0); expect(observer.scans).toBeGreaterThan(0);
    expect(observer.lost).toBe(0); expect(observer.violations).toBe(0);
  }
  // Never register this root with generic afterEach deletion: failed native
  // closure must preserve its profile. The owner removes only its verified
  // profile; the empty synthetic parent remains even after a successful test.
  const root = mkdtempSync(path.join(os.tmpdir(), "m1d-synthetic-evidence-"));
  let nativeOwner: NativeBrowserOwner | undefined;
  let originalError: unknown;
  let cleanupErrors: unknown[] = [];
  try {
    await bounded("LISTEN", () => new Promise<void>((resolve, reject) => {
      server.once("error", reject); server.listen({ port: 5173, host: "127.0.0.1", signal: listenController.signal }, () => { server.removeListener("error", reject); resolve(); });
    }));
    nativeOwner = createNativeBrowser(chromium, BROWSER, root);
    const browser = await bounded("CONNECT", () => nativeOwner!.connect(), 10_000), a = nativeOwner.context!;
    a.setDefaultTimeout(10_000); a.setDefaultNavigationTimeout(10_000);
    const initial = a.pages(), failures = new BrowserFailures(), observer = new Observer(a, failures);
    await bounded("INSTALL_A", () => observer.install());
    const first = await bounded("PAGE_A1", () => a.newPage());
    await Promise.all(initial.map(page => bounded("CLOSE_INITIAL", () => page.close())));
    const second = await bounded("PAGE_A2", () => a.newPage());
    for (const page of [first, second]) await bounded("NAVIGATE_A", () => page.goto(ORIGIN + "/"));
    await inspectHttp("A", first, observer);
    const b = await bounded("CONTEXT_B", () => browser.newContext({ acceptDownloads: false })), observerB = new Observer(b, failures);
    await bounded("INSTALL_B", () => observerB.install()); const third = await bounded("PAGE_B", () => b.newPage());
    await bounded("NAVIGATE_B", () => third.goto(ORIGIN + "/")); await inspectHttp("B", third, observerB);
    // Synthetic fixture cookie only; no application or authentication session.
    const marker = { name: "synthetic-jar", value: "a", domain: "example.invalid", path: "/" };
    await bounded("COOKIES_WRITE_A", () => a.addCookies([marker])); expect(await bounded("COOKIES_B_EMPTY", () => b.cookies())).toHaveLength(0);
    await bounded("COOKIES_WRITE_B", () => b.addCookies([{ ...marker, value: "b" }]));
    expect((await bounded("COOKIES_A1", () => first.context().cookies()))[0].value).toBe("a");
    expect((await bounded("COOKIES_A2", () => second.context().cookies()))[0].value).toBe("a");
    expect((await bounded("COOKIES_B", () => b.cookies()))[0].value).toBe("b");
    await bounded("ACTIVATE_A1", () => first.bringToFront());
    await bounded("FLUSH_A1", () => first.evaluate(() => (window as unknown as { __m1dFlush: () => Promise<boolean> }).__m1dFlush()));
    await bounded("FLUSH_OBSERVER_A", () => observer.flush());
    const before = { focus: observer.focus, visibility: observer.visibility };
    await bounded("ACTIVATE_B", () => third.bringToFront()); await bounded("ACTIVATE_A2", () => second.bringToFront()); await bounded("ACTIVATE_A1", () => first.bringToFront());
    const deadline = Math.min(bodyDeadline, performance.now() + 5_000);
    while ((observer.focus <= before.focus || observer.visibility <= before.visibility) && performance.now() < deadline) await new Promise(resolve => setTimeout(resolve, 25));
    expect(observer.focus).toBeGreaterThan(before.focus); expect(observer.visibility).toBeGreaterThan(before.visibility);
    // Real hidden A1 is the prerequisite for its later native expiry activation.
    await bounded("ACTIVATE_A2", () => second.bringToFront());
    expect(await bounded("HIDDEN_A1", () => first.evaluate(() => document.visibilityState))).toBe("hidden");
    expect(await bounded("VISIBLE_A2", () => second.evaluate(() => document.visibilityState))).toBe("visible");
    await bounded("ACTIVATE_A1", () => first.bringToFront());
    expect(await bounded("VISIBLE_A1", () => first.evaluate(() => document.visibilityState))).toBe("visible");
    await bounded("CLOSE_B", () => b.close());
    const freshB = await bounded("CONTEXT_FRESH_B", () => browser.newContext({ acceptDownloads: false }));
    expect(await bounded("COOKIES_FRESH_B", () => freshB.cookies())).toHaveLength(0);
    const freshPage = await bounded("PAGE_FRESH_B", () => freshB.newPage());
    await bounded("NAVIGATE_FRESH_B", () => freshPage.goto("data:text/html,<title>Synthetic recreated B</title>"));
    const e: Evidence = { ...fixture("cookie"), observations: [], windows: [] };
    const attach = vi.fn(async (body: Buffer) => { void body; });
    const failure = await finishBrowserRun({ browser, nativeOwner, contexts: [a, freshB], observers: [observer, observerB], failures,
      evidence: e, binding: binding("cookie"), attach });
    expect(failure).toBeUndefined(); expect(nativeOwner.closedCleanly).toBe(true);
    expect(browser.isConnected()).toBe(false); expect(browser.contexts()).toHaveLength(0);
    expect(readdirSync(root)).toEqual([]); expect(attach).toHaveBeenCalledOnce();
    expect(decode(attach.mock.calls[0][0], binding("cookie")).observations.find(o => o.event === "browserDisconnected")?.value).toBe(1);
    // An offline native-transport check never supplies the required cookie proof.
    expect(() => reduce(decode(attach.mock.calls[0][0], binding("cookie")))).toThrow("M1D_OBSERVATION_FAILED");
  } catch (error) { originalError = error; }
  finally {
    const scenarioSnapshot = { completed: [...completed], pending: [...pending], firstFailure: firstFailure ?? null,
      failed: Boolean(originalError), unclassifiedFailure: Boolean(originalError) && !firstFailure };
    closing = true; listenController.abort();
    const closed = await Promise.allSettled([
      bounded("CLOSE_NATIVE", () => nativeOwner?.close() ?? Promise.resolve(), 10_000),
      bounded("CLOSE_HTTP", () => new Promise<void>((resolve, reject) => {
        // abort may already have stopped listening, but accepted keep-alive
        // sockets still belong to this server and must always be destroyed.
        server.close(error => error && (error as NodeJS.ErrnoException).code !== "ERR_SERVER_NOT_RUNNING" ? reject(error) : resolve());
        server.closeAllConnections();
      }), 2_000)
    ]);
    cleanupErrors = closed.flatMap(result => result.status === "rejected" ? [result.reason] : []);
    // Vitest 2 does not render AggregateError.errors. Keep the discriminant
    // observable using fixture-owned labels/booleans only, never error text.
    process.stdout.write("M1D_NATIVE_HTTP_DIAGNOSTIC " + JSON.stringify({ scenario: scenarioSnapshot, allCompleted: completed, pending: [...pending],
      cleanupFailures: cleanupErrors.length, nativeClosedCleanly: nativeOwner?.closedCleanly ?? null, httpListening: server.listening }) + "\n");
  }
  if (originalError || cleanupErrors.length) throw new AggregateError([...(originalError ? [originalError] : []), ...cleanupErrors], "SYNTHETIC_NATIVE_HTTP_FAILED");
}, 60_000);

it.skipIf(process.platform !== "win32")("diagnoses native expiry body consumption with separately closed HTTP variants", async () => {
  const { chromium } = await vi.importActual<typeof import("@playwright/test")>("@playwright/test");
  for (const mode of ["STATUS_ONLY", "READ_BODY", "DRAIN_STREAM"] as const) {
    const root = mkdtempSync(path.join(os.tmpdir(), "m1d-synthetic-expiry-"));
    // Failed native closure preserves this root; never add it to roots[].
    const server = createServer((request, response) => {
      const api = request.url === "/api/session/bootstrap";
      const body = api ? JSON.stringify({ code: "SESSION_EXPIRED" }) : request.url === "/" ? '<title>Synthetic expiry</title><p id="state">Ready</p>' : "";
      response.writeHead(api ? 401 : body ? 200 : request.url === "/favicon.ico" ? 204 : 404, {
        "Content-Type": api ? "application/json" : "text/html", "Content-Length": Buffer.byteLength(body), "Cache-Control": "no-store" });
      response.end(body);
    });
    const listenController = new AbortController(), deadline = performance.now() + 30_000;
    let closing = false, nativeOwner: NativeBrowserOwner | undefined, browser: Browser | undefined, observer: Observer | undefined;
    let originalError: unknown;
    let cleanupErrors: unknown[] = [];
    let snapshot: Record<string, unknown> = {};
    type Outcome<T> = { state: "RESOLVED"; value: T } | { state: "REJECTED" | "TIMEOUT" };
    async function observe<T>(work: () => Promise<T>, milliseconds = 3000): Promise<Outcome<T>> {
      const remaining = closing ? milliseconds : Math.min(milliseconds, deadline - performance.now());
      if (remaining <= 0) return { state: "TIMEOUT" };
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        return await Promise.race([
          Promise.resolve().then(work).then(value => ({ state: "RESOLVED" as const, value }), () => ({ state: "REJECTED" as const })),
          new Promise<Outcome<T>>(resolve => { timer = setTimeout(() => resolve({ state: "TIMEOUT" }), remaining); })
        ]);
      } finally { clearTimeout(timer); }
    }
    async function required<T>(work: () => Promise<T>, milliseconds = 5000): Promise<T> {
      const result = await observe(work, milliseconds);
      if (result.state !== "RESOLVED") throw new Error("SYNTHETIC_EXPIRY_PRECONDITION_FAILED");
      return result.value;
    }
    try {
      await required(() => new Promise<void>((resolve, reject) => {
        server.once("error", reject);
        server.listen({ port: 5173, host: "127.0.0.1", signal: listenController.signal }, () => { server.removeListener("error", reject); resolve(); });
      }));
      nativeOwner = createNativeBrowser(chromium, BROWSER, root);
      browser = await required(() => nativeOwner!.connect(), 10_000);
      const context = nativeOwner.context!;
      context.setDefaultTimeout(5000); context.setDefaultNavigationTimeout(5000);
      const failures = new BrowserFailures(); failures.setBrowserStep("EXPIRY");
      observer = new Observer(context, failures); await required(() => observer!.install());
      const initialPages = context.pages(), page = await required(() => context.newPage());
      await required(() => Promise.all(initialPages.map(initial => initial.close())));
      await required(() => page.goto(ORIGIN + "/")); await required(() => page.bringToFront());
      expect(await required(() => page.evaluate(() => document.visibilityState))).toBe("visible");
      let exactRequest: Request | undefined, requestCount = 0, finishedCount = 0, failedCount = 0;
      let failureCategory: "NONE" | "ABORTED" | "OTHER" = "NONE";
      context.on("request", request => {
        if (request.url() === ORIGIN + "/api/session/bootstrap" && request.method() === "GET") { requestCount++; exactRequest = request; }
      });
      context.on("requestfinished", request => { if (request === exactRequest) finishedCount++; });
      context.on("requestfailed", request => {
        if (request === exactRequest) { failedCount++; failureCategory = /abort/i.test(request.failure()?.errorText ?? "") ? "ABORTED" : "OTHER"; }
      });
      const responseWait = observe(() => page.waitForResponse(response => response.url() === ORIGIN + "/api/session/bootstrap"
        && response.request().method() === "GET", { timeout: 5000 }), 5000);
      const pageResult = await required(() => page.evaluate(async consumption => {
        const response = await fetch("/api/session/bootstrap", { cache: "no-store" });
        document.getElementById("state")!.textContent = response.status === 401 ? "Expired" : "Unexpected";
        let bodyBytes: number | null = null;
        if (consumption === "DRAIN_STREAM") {
          const reader = response.body!.getReader(); bodyBytes = 0;
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              bodyBytes += value.byteLength;
            }
          } finally { reader.releaseLock(); }
        }
        return { status: response.status, bodyBytes,
          codeMatches: consumption === "READ_BODY" ? (await response.json() as { code?: unknown }).code === "SESSION_EXPIRED" : null };
      }, mode));
      const responseResult = await responseWait;
      expect(pageResult.status).toBe(401); expect(responseResult.state).toBe("RESOLVED");
      if (responseResult.state !== "RESOLVED") throw new Error("SYNTHETIC_EXPIRY_RESPONSE_MISSING");
      const response = responseResult.value;
      expect(response.request()).toBe(exactRequest); expect(requestCount).toBe(1);
      const headers = await observe(() => response.headersArray());
      const finished = await observe(() => response.finished());
      const body = await observe(() => response.json());
      const flushed = await observe(() => observer!.flush());
      snapshot = { mode, status: response.status(), pageConsumedBody: mode !== "STATUS_ONLY", pageCodeMatches: pageResult.codeMatches,
        pageBodyBytes: pageResult.bodyBytes,
        requestCount, finishedCount, failedCount, failureCategory, headers: headers.state, finished: finished.state,
        finishedWithoutError: finished.state === "RESOLVED" && finished.value === null, json: body.state,
        codeMatches: body.state === "RESOLVED" && body.value?.code === "SESSION_EXPIRED", observerFlush: flushed.state,
        observerPending: observer.pending.size, observerLost: observer.lost, observerViolations: observer.violations };
      expect(headers.state).toBe("RESOLVED");
      if (headers.state === "RESOLVED") expect(headers.value.some(header => header.name.toLowerCase() === "content-type" && header.value.startsWith("application/json"))).toBe(true);
      // STATUS_ONLY is an observation, not an assertion that a browser must hang.
      // The consumed-body control must prove the real 401 JSON and quiescence.
      if (mode !== "STATUS_ONLY") {
        if (mode === "READ_BODY") expect(pageResult.codeMatches).toBe(true);
        else expect(pageResult.bodyBytes).toBe(Buffer.byteLength(JSON.stringify({ code: "SESSION_EXPIRED" })));
        expect(finished.state).toBe("RESOLVED");
        if (finished.state === "RESOLVED") expect(finished.value).toBeNull();
        expect(body.state).toBe("RESOLVED"); if (body.state === "RESOLVED") expect(body.value.code).toBe("SESSION_EXPIRED");
        expect(flushed.state).toBe("RESOLVED"); expect(observer.pending.size).toBe(0); expect(failedCount).toBe(0);
      }
    } catch (error) { originalError = error; }
    finally {
      closing = true; listenController.abort();
      const closed = await Promise.allSettled([
        required(() => nativeOwner?.close() ?? Promise.resolve(), 10_000),
        required(() => new Promise<void>((resolve, reject) => {
          server.close(error => error && (error as NodeJS.ErrnoException).code !== "ERR_SERVER_NOT_RUNNING" ? reject(error) : resolve());
          server.closeAllConnections();
        }), 2000)
      ]);
      cleanupErrors = closed.flatMap(result => result.status === "rejected" ? [result.reason] : []);
      if (observer) {
        try {
          await required(() => Promise.all(observer!.pending), 2000);
          expect(observer.pending.size).toBe(0);
        } catch (error) { cleanupErrors.push(error); }
      }
      process.stdout.write("M1D_EXPIRY_HTTP_DIAGNOSTIC " + JSON.stringify({ mode, scope: "SYNTHETIC_ONLY_NOT_C2", snapshot,
        scenarioFailed: Boolean(originalError), cleanupFailures: cleanupErrors.length, nativeClosedCleanly: nativeOwner?.closedCleanly ?? null,
        disconnected: browser ? !browser.isConnected() : null, observerPendingAfterCleanup: observer?.pending.size ?? null,
        observerLostAfterCleanup: observer?.lost ?? null, httpListening: server.listening }) + "\n");
    }
    if (originalError || cleanupErrors.length) throw new AggregateError([...(originalError ? [originalError] : []), ...cleanupErrors], "SYNTHETIC_EXPIRY_DIAGNOSTIC_FAILED");
    expect(nativeOwner?.closedCleanly).toBe(true); expect(browser?.isConnected()).toBe(false);
    expect(readdirSync(root)).toEqual([]); expect(server.listening).toBe(false);
  }
}, 135_000);

it.skipIf(process.platform !== "win32")("logoutNative compares a hidden A1 click with explicit native activation after A2 and recreated B", async () => {
  const { chromium } = await vi.importActual<typeof import("@playwright/test")>("@playwright/test");
  // Input/actionability diagnostic only. No application session or C2 evidence.
  // Do not register this root for generic deletion after an uncertain exit.
  const root = mkdtempSync(path.join(os.tmpdir(), "m1d-synthetic-logout-"));
  let posts = 0;
  const server = createServer((request, response) => {
    if (request.url === "/api/session/logout" && request.method === "POST") {
      posts++; response.writeHead(204, { "Cache-Control": "no-store" }); response.end(); return;
    }
    const body = request.url === "/" ? '<title>Synthetic logout input</title><button onclick="fetch(\'/api/session/logout\',{method:\'POST\'}).then(r=>document.body.dataset.status=String(r.status))">Déconnexion</button>' : "";
    response.writeHead(body ? 200 : request.url === "/favicon.ico" ? 204 : 404,
      { "Content-Type": "text/html; charset=utf-8", "Content-Length": Buffer.byteLength(body), "Cache-Control": "no-store" });
    response.end(body);
  });
  const listenController = new AbortController(), deadline = performance.now() + 30_000;
  let closing = false, nativeOwner: NativeBrowserOwner | undefined, browser: Browser | undefined, observer: Observer | undefined;
  let originalError: unknown;
  const cleanupErrors: unknown[] = [];
  const snapshot: Record<string, unknown> = {};
  type Outcome<T> = { state: "RESOLVED"; value: T } | { state: "TIMEOUT" | "REJECTED" };
  async function observe<T>(work: () => Promise<T>, milliseconds = 5000): Promise<Outcome<T>> {
    const remaining = closing ? milliseconds : Math.min(milliseconds, deadline - performance.now());
    if (remaining <= 0) return { state: "TIMEOUT" };
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        Promise.resolve().then(work).then(value => ({ state: "RESOLVED" as const, value }), error =>
          ({ state: error instanceof Error && error.name === "TimeoutError" ? "TIMEOUT" as const : "REJECTED" as const })),
        new Promise<Outcome<T>>(resolve => { timer = setTimeout(() => resolve({ state: "TIMEOUT" }), remaining); })
      ]);
    } finally { clearTimeout(timer); }
  }
  async function required<T>(work: () => Promise<T>, milliseconds = 5000): Promise<T> {
    const result = await observe(work, milliseconds);
    if (result.state !== "RESOLVED") throw new Error("SYNTHETIC_LOGOUT_PRECONDITION_FAILED");
    return result.value;
  }
  try {
    await required(() => new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen({ port: 5173, host: "127.0.0.1", signal: listenController.signal }, () => { server.removeListener("error", reject); resolve(); });
    }));
    nativeOwner = createNativeBrowser(chromium, BROWSER, root);
    browser = await required(() => nativeOwner!.connect(), 10_000);
    const a = nativeOwner.context!; a.setDefaultTimeout(5000); a.setDefaultNavigationTimeout(5000);
    const failures = new BrowserFailures(); failures.setBrowserStep("LOGOUT");
    observer = new Observer(a, failures); await required(() => observer!.install());
    const initialPages = a.pages(), first = await required(() => a.newPage());
    await required(() => Promise.all(initialPages.map(page => page.close())));
    const second = await required(() => a.newPage());
    for (const page of [first, second]) await required(() => page.goto(ORIGIN + "/"));
    const b = await required(() => browser!.newContext({ acceptDownloads: false }));
    const third = await required(() => b.newPage()); await required(() => third.goto(ORIGIN + "/"));
    await required(() => first.bringToFront()); await required(() => second.bringToFront());
    await required(() => b.close());
    const freshB = await required(() => browser!.newContext({ acceptDownloads: false }));
    const freshPage = await required(() => freshB.newPage()); await required(() => freshPage.goto(ORIGIN + "/"));
    snapshot.hiddenVisibility = await required(() => first.evaluate(() => document.visibilityState));
    snapshot.utf8 = await required(() => first.evaluate(() => document.characterSet === "UTF-8"));
    expect(snapshot.utf8).toBe(true);
    expect(snapshot.hiddenVisibility).toBe("hidden");
    const button = first.getByRole("button", { name: "Déconnexion", exact: true });
    snapshot.buttonCount = await required(() => button.count());
    snapshot.buttonVisible = await required(() => button.isVisible());
    snapshot.buttonEnabled = await required(() => button.isEnabled());
    expect(snapshot.buttonCount).toBe(1); expect(snapshot.buttonVisible).toBe(true); expect(snapshot.buttonEnabled).toBe(true);
    const before = posts;
    // Await the actual Locator promise (its own short timeout), not merely a race,
    // so no late negative click can overlap the activated control.
    let hiddenClick: "RESOLVED" | "TIMEOUT" | "REJECTED" = "RESOLVED";
    try { await first.getByRole("button", { name: "Déconnexion", exact: true }).click({ timeout: 1500 }); }
    catch (error) { hiddenClick = error instanceof Error && error.name === "TimeoutError" ? "TIMEOUT" : "REJECTED"; }
    snapshot.hiddenClick = hiddenClick; snapshot.hiddenPosts = posts - before;
    await required(() => activateLogoutPage(first, failures));
    snapshot.activatedVisibility = await required(() => first.evaluate(() => document.visibilityState));
    expect(snapshot.activatedVisibility).toBe("visible");
    snapshot.activatedButtonCount = await required(() => button.count());
    snapshot.activatedButtonVisible = await required(() => button.isVisible());
    snapshot.activatedButtonEnabled = await required(() => button.isEnabled());
    expect(snapshot.activatedButtonCount).toBe(1); expect(snapshot.activatedButtonVisible).toBe(true); expect(snapshot.activatedButtonEnabled).toBe(true);
    const activatedBefore = posts;
    const responseWait = observe(() => first.waitForResponse(response => response.url() === ORIGIN + "/api/session/logout"
      && response.request().method() === "POST", { timeout: 5000 }));
    const click = await observe(() => first.getByRole("button", { name: "Déconnexion", exact: true }).click({ timeout: 4000 }));
    const response = await responseWait;
    snapshot.activatedClick = click.state; snapshot.activatedResponse = response.state;
    snapshot.activatedStatus = response.state === "RESOLVED" ? response.value.status() : null;
    snapshot.activatedPosts = posts - activatedBefore;
    await required(() => observer!.flush());
    snapshot.observerPending = observer.pending.size; snapshot.observerLost = observer.lost; snapshot.observerViolations = observer.violations;
    expect(click.state).toBe("RESOLVED"); expect(response.state).toBe("RESOLVED");
    expect(snapshot.activatedStatus).toBe(204); expect(snapshot.activatedPosts).toBe(1);
    expect(observer.pending.size).toBe(0); expect(observer.lost).toBe(0); expect(observer.violations).toBe(0);
    // The background outcome is recorded, never forced to fail to fit a theory.
  } catch (error) { originalError = error; }
  finally {
    closing = true; listenController.abort();
    const closed = await Promise.allSettled([
      required(() => nativeOwner?.close() ?? Promise.resolve(), 10_000),
      required(() => new Promise<void>((resolve, reject) => {
        server.close(error => error && (error as NodeJS.ErrnoException).code !== "ERR_SERVER_NOT_RUNNING" ? reject(error) : resolve());
        server.closeAllConnections();
      }), 2000)
    ]);
    cleanupErrors.push(...closed.flatMap(result => result.status === "rejected" ? [result.reason] : []));
    if (observer) {
      try { await required(() => Promise.all(observer!.pending), 2000); expect(observer.pending.size).toBe(0); }
      catch (error) { cleanupErrors.push(error); }
    }
    process.stdout.write("M1D_LOGOUT_NATIVE_DIAGNOSTIC " + JSON.stringify({ scope: "SYNTHETIC_INPUT_ONLY_NOT_C2", snapshot,
      scenarioFailed: Boolean(originalError), cleanupFailures: cleanupErrors.length, nativeClosedCleanly: nativeOwner?.closedCleanly ?? null,
      disconnected: browser ? !browser.isConnected() : null, observerPendingAfterCleanup: observer?.pending.size ?? null,
      observerLostAfterCleanup: observer?.lost ?? null, httpListening: server.listening }) + "\n");
  }
  if (originalError || cleanupErrors.length) throw new AggregateError([...(originalError ? [originalError] : []), ...cleanupErrors], "SYNTHETIC_LOGOUT_DIAGNOSTIC_FAILED");
  expect(nativeOwner?.closedCleanly).toBe(true); expect(browser?.isConnected()).toBe(false);
  expect(readdirSync(root)).toEqual([]); expect(server.listening).toBe(false);
}, 45_000);

describe("closed browser failure diagnostics", () => {
  const detail = (): BrowserDiagnostic => ({ schemaVersion: 1, source: "SCENARIO", step: "SAVE_NOTE", lastCompleted: "FIND_NOTE", reason: "LOCATOR_AMBIGUOUS" });
  const operationDetail = (): BrowserDiagnostic => ({ schemaVersion: 2, source: "SCENARIO", step: "REVIEWER_ROLE", lastCompleted: null,
    reason: "TIMEOUT", operation: "READ_RESPONSE_JSON", operationState: "FAILED", lastCompletedOperation: "READ_RESPONSE_HEADERS" });
  async function withRunner(info: (() => unknown) | undefined, step: unknown, body: () => Promise<void>) {
    const descriptors = Object.fromEntries(["info", "step"].map(key => [key, Object.getOwnPropertyDescriptor(playwrightTest, key)]));
    Object.defineProperty(playwrightTest, "info", { configurable: true, value: info });
    Object.defineProperty(playwrightTest, "step", { configurable: true, value: step });
    try { await body(); } finally {
      for (const key of ["info", "step"]) { const descriptor = descriptors[key]; if (descriptor) Object.defineProperty(playwrightTest, key, descriptor); else Reflect.deleteProperty(playwrightTest, key); }
    }
  }
  it("does not install a second primitive when the first completes after its step timed out", async () => {
    const failures = new BrowserFailures(); failures.setBrowserStep("CONTEXT");
    let resolve!: () => void;
    const late = new Promise<void>(done => { resolve = done; });
    const context = { exposeBinding: vi.fn(() => late), addInitScript: vi.fn(async () => undefined), on: vi.fn() };
    const timeout = new Error("synthetic-secret-marker"); timeout.name = "TimeoutError";
    const step = vi.fn(async (_title: string, work: () => Promise<unknown>) => { void work(); throw timeout; });
    await withRunner(() => ({ title: "m1d-browser" }), step, async () => {
      await expect(new Observer(context as unknown as BrowserContext, failures).install()).rejects.toThrow("M1D_BROWSER_FAILED");
      expect(context.exposeBinding).toHaveBeenCalledOnce(); expect(context.addInitScript).not.toHaveBeenCalled();
      resolve(); await late; await Promise.resolve();
      expect(context.exposeBinding).toHaveBeenCalledOnce(); expect(context.addInitScript).not.toHaveBeenCalled();
      expect(failures.browserDiagnostic).toMatchObject({ schemaVersion: 2, step: "CONTEXT", operation: "INSTALL_OBSERVER", operationState: "FAILED", reason: "TIMEOUT" });
      expect(JSON.stringify(failures.browserDiagnostic)).not.toContain("synthetic-secret-marker");
    });
  });
  it.each(["absent", "outside", "cookie", "finalization"] as const)("keeps %s invocation transparent to the runner steps", async mode => {
    const failures = new BrowserFailures(); if (mode === "finalization") failures.setBrowserStep("FINALIZATION");
    const context = { exposeBinding: vi.fn(async () => undefined), addInitScript: vi.fn(async () => undefined), on: vi.fn() }, step = vi.fn();
    const info = mode === "absent" ? undefined : () => { if (mode === "outside") throw new Error("OUTSIDE_RUNNER"); return { title: mode === "cookie" ? "m1d-cookie" : "m1d-browser" }; };
    await withRunner(info, step, async () => {
      await new Observer(context as unknown as BrowserContext, failures).install();
      expect(context.exposeBinding).toHaveBeenCalledOnce(); expect(context.addInitScript).toHaveBeenCalledOnce();
      expect(step).not.toHaveBeenCalled(); expect(failures.browserDiagnostic).toBeUndefined();
    });
  });
  it("never invokes a failing primitive twice when test.info rejects outside a runner", async () => {
    const failure = new Error("SYNTHETIC_PRIMITIVE_FAILURE");
    const context = { exposeBinding: vi.fn(async () => { throw failure; }), addInitScript: vi.fn(), on: vi.fn() };
    await withRunner(() => { throw new Error("OUTSIDE_RUNNER"); }, vi.fn(), async () => {
      await expect(new Observer(context as unknown as BrowserContext, new BrowserFailures()).install()).rejects.toBe(failure);
      expect(context.exposeBinding).toHaveBeenCalledOnce(); expect(context.addInitScript).not.toHaveBeenCalled();
    });
  });
  it.each(["completed", "pending", "failed"] as const)("publishes valid evidence only when the traced primitive is completed: %s", async state => {
    const publish = vi.fn(), lines: string[] = [], reporter = new Reporter(binding(), publish, line => { lines.push(line); }); begin(reporter);
    const r = result(fixture()), step = { category: "test.step", title: browserOperationTitle("REVIEWER_ROLE", "REVIEWER_FETCH") } as TestStep;
    reporter.onStepBegin(testCase, r, step);
    if (state !== "pending") {
      if (state === "failed") Object.defineProperty(step, "error", { value: Object.create(null, { message: { get() { throw new Error("RAW_ERROR_READ"); } } }) });
      reporter.onStepEnd(testCase, r, step);
    }
    reporter.onTestEnd(testCase, r);
    expect(await reporter.onEnd(full)).toEqual({ status: state === "completed" ? "passed" : "failed" });
    expect(publish).toHaveBeenCalledTimes(state === "completed" ? 1 : 0);
    if (state !== "completed") expect(JSON.parse(lines[0].slice("M1D_BROWSER_DIAGNOSTIC ".length)).diagnostic.operationState).toBe(state.toUpperCase());
  });
  it("keeps a timed-out operation without reading raw errors or automatic API steps", async () => {
    let forbiddenReads = 0;
    const forbidden = () => { forbiddenReads++; throw new Error("synthetic-secret-marker"); };
    const error = Object.create(null, Object.fromEntries(["message", "stack", "cause"].map(key => [key, { get: forbidden }])));
    const publish = vi.fn(), lines: string[] = [], reporter = new Reporter(binding(), publish, line => { lines.push(line); }); begin(reporter);
    const r = { ...result(fixture()), status: "timedOut", attachments: [], errors: [error] } as TestResult;
    reporter.onStepBegin(testCase, r, Object.create(null, { category: { value: "pw:api" }, title: { get: forbidden }, params: { get: forbidden } }));
    reporter.onStepBegin(testCase, r, { category: "test.step", title: browserOperationTitle("REVIEWER_ROLE", "REVIEWER_FETCH") } as TestStep);
    reporter.onTestEnd(testCase, r); expect(await reporter.onEnd({ status: "timedout" } as FullResult)).toEqual({ status: "failed" });
    expect(publish).not.toHaveBeenCalled(); expect(forbiddenReads).toBe(0); expect(lines).toHaveLength(1); expect(lines[0]).not.toContain("synthetic-secret-marker");
    expect(JSON.parse(lines[0].slice("M1D_BROWSER_DIAGNOSTIC ".length)).diagnostic).toMatchObject({ schemaVersion: 2, source: "REPORTER", step: "REVIEWER_ROLE", operation: "REVIEWER_FETCH", operationState: "PENDING", reason: "TIMEOUT" });
  });
  it("preserves the first worker operation failure through late completion and finalization", () => {
    const failures = new BrowserFailures(); failures.completeOperation("CREATE_CONTEXT");
    const error = new Error("SYNTHETIC_TIMEOUT"); error.name = "TimeoutError";
    failures.operationFailure("REVIEWER_ROLE", "REVIEWER_FETCH", error);
    failures.completeOperation("CLOSE_PAGE"); failures.operationFailure("FINALIZATION", "CLOSE_CONTEXT", new Error("CLOSE_FAILED"));
    expect(failures.browserDiagnostic).toEqual({ schemaVersion: 2, source: "SCENARIO", step: "REVIEWER_ROLE", lastCompleted: null,
      reason: "TIMEOUT", operation: "REVIEWER_FETCH", operationState: "FAILED", lastCompletedOperation: "CREATE_CONTEXT" });
  });
  it.each([{ raw: "synthetic-secret-marker" }, { operation: "FREE_TEXT" }, { operationState: "PENDING" }, { lastCompletedOperation: "FREE_TEXT" },
    { source: "PUBLICATION" }, { step: "REPORTER" }, { reason: "ASSERTION" }, { lastCompleted: "COOKIE" }])("rejects malformed operation diagnostic %j", mutation => {
    expect(() => validateBrowserDiagnostic({ ...operationDetail(), ...mutation })).toThrow("M1D_OBSERVATION_FAILED");
  });
  it("keeps the first failure when response waits reject during cleanup", async () => {
    const f = new BrowserFailures(); f.setBrowserStep("FIND_NOTE"); f.setBrowserStep("SAVE_NOTE");
    let reject!: (reason: Error) => void;
    const response = f.capture("RESPONSE", () => new Promise<void>((_resolve, refuse) => { reject = refuse; }));
    f.browserFailure(new Error("strict mode violation synthetic-secret-marker"));
    f.setBrowserStep("FINALIZATION"); reject(new Error("synthetic-secret-marker")); await response;
    expect(f.browserDiagnostic).toEqual(detail());
    expect(JSON.stringify(f.browserDiagnostic)).not.toContain("synthetic-secret-marker");
  });
  it.each([
    { step: "SAVE_NOTE\0" }, { reason: "synthetic-secret-marker" }, { extra: "synthetic-secret-marker" },
    { schemaVersion: "1" }, { lastCompleted: "PUBLICATION" }, { source: "REPORTER" }, { source: "PUBLICATION" }
  ])("rejects malformed diagnostic %j", mutation => {
    const malformed = { ...detail(), ...mutation };
    expect(() => validateBrowserDiagnostic(malformed)).toThrow("M1D_OBSERVATION_FAILED");
    expect(() => decode(bytes({ ...fixture(), browserDiagnostic: malformed as BrowserDiagnostic }), binding())).toThrow();
  });
  it.each(["reporter", "publication"] as const)("distinguishes a %s failure from a scenario failure", async kind => {
    const lines: string[] = [];
    const reporter = new Reporter(binding(), () => { throw new Error("synthetic-secret-marker"); }, line => { lines.push(line); });
    begin(reporter);
    if (kind === "publication") reporter.onTestEnd(testCase, result(fixture()));
    expect(await reporter.onEnd(full)).toEqual({ status: "failed" });
    expect(lines).toHaveLength(1); expect(lines[0]).not.toContain("synthetic-secret-marker");
    expect(JSON.parse(lines[0].slice("M1D_BROWSER_DIAGNOSTIC ".length)).diagnostic.source).toBe(kind.toUpperCase());
    await reporter.onEnd(full); expect(lines).toHaveLength(1);
  });
  it.skipIf(process.platform !== "win32").each(["scenario-v1", "scenario-v2", "reporter-v2"] as const)("carries %s bytes through real rail drain and terminal readback, rejecting wrong bindings and channels", async variant => {
    const lines: string[] = [], reporter = new Reporter(binding(), () => { throw new Error("UNEXPECTED_SUCCESS"); }, line => { lines.push(line); });
    const diagnostic: BrowserDiagnostic = variant === "scenario-v1" ? detail() : variant === "scenario-v2" ? operationDetail()
      : { schemaVersion: 2, source: "REPORTER", step: "REVIEWER_ROLE", lastCompleted: null, reason: "TIMEOUT", operation: "REVIEWER_FETCH", operationState: "PENDING", lastCompletedOperation: "CREATE_CONTEXT" };
    begin(reporter); const e = { ...fixture(), observations: [], windows: [], browserDiagnostic: diagnostic };
    reporter.onTestEnd(testCase, { ...result(e), status: "failed", errors: [new Error("synthetic-secret-marker")] });
    expect(await reporter.onEnd({ status: "failed" } as FullResult)).toEqual({ status: "failed" });
    const line = lines[0], frame = JSON.parse(line.slice("M1D_BROWSER_DIAGNOSTIC ".length));
    const cases = [
      { name: "valid", stdout: line, stderr: "", role: "BROWSER_JOURNEY", rejected: false },
      { name: "owner", stdout: line, stderr: "", role: "BROWSER_COOKIE", rejected: true },
      { name: "stderr", stdout: "", stderr: line, role: "BROWSER_JOURNEY", rejected: true },
      { name: "duplicate", stdout: line + line, stderr: "", role: "BROWSER_JOURNEY", rejected: true },
      { name: "truncated", stdout: line.trimEnd(), stderr: "", role: "BROWSER_JOURNEY", rejected: true },
      { name: "oversize", stdout: line.trimEnd() + " ".repeat(8192) + "\n", stderr: "", role: "BROWSER_JOURNEY", rejected: true }
    ];
    for (const key of ["runId", "objectSha", "runtimeSha", "frontendSha"]) cases.push({ name: key, stdout: "M1D_BROWSER_DIAGNOSTIC " + JSON.stringify({ ...frame, [key]: "a".repeat(key === "runId" ? 32 : 64) }) + "\n", stderr: "", role: "BROWSER_JOURNEY", rejected: true });
    cases.push({ name: "raw", stdout: "M1D_BROWSER_DIAGNOSTIC " + JSON.stringify({ ...frame, diagnostic: { ...diagnostic, raw: "synthetic-secret-marker" } }) + "\n", stderr: "", role: "BROWSER_JOURNEY", rejected: true });
    if (variant !== "scenario-v1") for (const mutation of [{ operation: "FREE_TEXT" }, { operationState: "UNKNOWN" }, { lastCompletedOperation: "FREE_TEXT" }, { reason: "ASSERTION" }, { step: "REPORTER" }, ...(variant === "scenario-v2" ? [{ operationState: "PENDING" }] : [])]) {
      cases.push({ name: Object.keys(mutation)[0], stdout: "M1D_BROWSER_DIAGNOSTIC " + JSON.stringify({ ...frame, diagnostic: { ...diagnostic, ...mutation } }) + "\n", stderr: "", role: "BROWSER_JOURNEY", rejected: true });
    }
    cases.push({ name: "duplicate-property", stdout: line.replace('"schemaVersion":1', '"schemaVersion":1,"schemaVersion":1'), stderr: "", role: "BROWSER_JOURNEY", rejected: true });
    const root = mkdtempSync(path.join(os.tmpdir(), "m1d-synthetic-evidence-")); roots.push(root);
    writeFileSync(path.join(root, "input.json"), JSON.stringify(cases));
    const ps = String.raw`param([string]§Rail,[string]§Root)
§ErrorActionPreference='Stop'; Set-StrictMode -Version Latest
[void][Reflection.Assembly]::Load('System.Runtime.Serialization, Version=4.0.0.0, Culture=neutral, PublicKeyToken=b77a5c561934e089')
§tokens=§null; §errors=§null; §ast=[Management.Automation.Language.Parser]::ParseFile(§Rail,[ref]§tokens,[ref]§errors)
if(§errors.Count -ne 0){throw 'FIXTURE_AST'}
§definitions=@(§ast.EndBlock.Statements | Where-Object { §_ -is [Management.Automation.Language.FunctionDefinitionAst] } | ForEach-Object { §_.Extent.Text })
§file=Join-Path §Root 'functions.ps1'; [IO.File]::WriteAllText(§file,(§definitions -join [Environment]::NewLine),[Text.UTF8Encoding]::new(§false)); . §file
function Get-M1DNamespaceIdentity { 'OFFLINE_BROWSER_FIXTURE' }
§RunId='1'*32; §ReviewedObjectSha256='2'*64; §SensitiveAuthorizationRecordId='AUTH-OFFLINE-BROWSER-FIXTURE'
§script:DRuntimeSha256='3'*64; §script:DFrontendRuntimeSha256='4'*64; §script:DRunRoot=§Root
§script:DCampaignClock=§null; Start-M1DClock Preflight; §script:DPhase='integration'; §script:DOperation='child-drain'
§valid=§null; §outcomes=@()
foreach(§case in (Get-Content -LiteralPath (Join-Path §Root 'input.json') -Raw | ConvertFrom-Json)) {
  §script:DBrowserDiagnostic=§null; §script:DFailures=[Collections.Generic.List[object]]::new()
  §p=[pscustomobject]@{StandardOutput=[IO.StringReader]::new(§case.stdout);StandardError=[IO.StringReader]::new(§case.stderr)}
  try {
    §drain=New-M1DDrain §p §case.role §null
    for(§i=0;§i -lt 16 -and (-not §drain.OutEnded -or -not §drain.ErrEnded);§i++){Update-M1DDrain §drain -Finalizing}
    if(-not §drain.OutEnded -or -not §drain.ErrEnded -or §drain.Signals.Count -ne 0 -or (§drain.Failures.Count -gt 0) -ne §case.rejected){throw ('FIXTURE_PROTOCOL_'+§case.name)}
    if(§case.name -ceq 'valid'){§valid=§script:DBrowserDiagnostic}
    §outcomes+=§case.name
  } finally { §p.StandardOutput.Dispose(); §p.StandardError.Dispose() }
}
if(§null -eq §valid){throw 'FIXTURE_DETAIL_LOST'}
§script:DBrowserDiagnostic=§valid; §script:DFailures=[Collections.Generic.List[object]]::new()
§payload=Get-M1DTerminalPayload §true §null §null §null §null §null
if(§payload.campaignResult -cne 'FAIL'){throw 'FIXTURE_FALSE_PASS'}
[void](Write-M1DReceipt 'campaign' ([pscustomobject]@{runtimeSha256=§script:DRuntimeSha256;frontendRuntimeSha256=§script:DFrontendRuntimeSha256}))
[void](Write-M1DReceipt 'terminal' §payload); §terminal=Read-M1DReceipt 'terminal'
[pscustomobject]@{diagnostic=§terminal.payload.browserDiagnostic;outcomes=§outcomes;campaignResult=§terminal.payload.campaignResult}|ConvertTo-Json -Depth 10 -Compress
`.replaceAll("§", "$");
    const file = path.join(root, "fixture.ps1"); writeFileSync(file, ps);
    const output = execFileSync("C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe", ["-NoProfile", "-NonInteractive", "-File", file, "-Rail", path.resolve("../backend/scripts/m1-1b-postgresql-rail.ps1"), "-Root", root],
      { encoding: "utf8", timeout: 30_000, windowsHide: true, maxBuffer: 64 * 1024 });
    expect(output).not.toContain("synthetic-secret-marker");
    expect(JSON.parse(output.trim())).toEqual({ diagnostic: frame, outcomes: cases.map(c => c.name), campaignResult: "FAIL" });
  }, 40_000);
});

it("reviewer request uses the real evaluate function and the observed business tenant", async () => {
  const args = { url: "http://127.0.0.1:5173/api/closing-folders/synthetic/workpapers/synthetic", token: "synthetic-csrf", tenantId: "036a0000-0000-4000-8000-000000000001", body: JSON.stringify({ noteText: "synthetic-reviewer-refusal" }) };
  const transport = vi.fn(async () => ({ status: 403, json: async () => ({ code: "ACCESS_DENIED" }) }));
  vi.stubGlobal("fetch", transport);
  expect(await reviewerWriteRequest(args)).toEqual({ status: 403, code: "ACCESS_DENIED" });
  expect(transport).toHaveBeenCalledTimes(1);
  expect(transport).toHaveBeenCalledWith(args.url, { method: "PUT", credentials: "same-origin", headers: {
    "Content-Type": "application/json", "X-CSRF-TOKEN": args.token, "X-Tenant-Id": args.tenantId
  }, body: args.body });
  const scenario = readFileSync(path.resolve("e2e/m1d/session.spec.ts"), "utf8");
  expect(scenario).toContain("pb.evaluate(reviewerWriteRequest,");
  expect(scenario).toContain('response.request().headers()["x-tenant-id"]');
});

const roots: string[] = [];
const exitCode = process.exitCode;
const domObservers: MutationObserver[] = [];
afterEach(() => {
  for (const observer of domObservers.splice(0)) observer.disconnect();
  vi.unstubAllGlobals(); vi.restoreAllMocks();
  document.body.innerHTML = ""; localStorage.clear(); sessionStorage.clear(); history.replaceState(null, "", "/");
  vi.useRealTimers();
  process.exitCode = exitCode;
  for (const root of roots.splice(0)) {
    if (path.dirname(root) !== os.tmpdir() || !path.basename(root).startsWith("m1d-synthetic-evidence-")) throw new Error("FIXTURE_ROOT");
    rmSync(root, { recursive: true, force: true });
  }
});
function binding(kind: Kind = "browser"): Binding {
  return { kind, runId: "1".repeat(32), objectSha: "2".repeat(64), runtimeSha: "3".repeat(64), frontendSha: "4".repeat(64), root: "unused", executable: BROWSER, discovery: false };
}
function fixture(kind: Kind = "browser"): Evidence {
  const b = binding(kind);
  const e: Evidence = { schemaVersion: 1, kind, runId: b.runId, objectSha: b.objectSha, runtimeSha: b.runtimeSha, frontendSha: b.frontendSha, browserVersion: "153.0.8010.12", observations: [], windows: [...(kind === "browser" ? WINDOWS : WINDOWS.slice(0, 2))] };
  const values: Record<string, number> = { emittedCookie: 31, acceptedCookie: 31, login: 204, me: 200, noteWrite: 200, roleRefusal: 403, csrfRefusal: 403, csrfReplay: 0,
    idleStart: 1_000_000, idleEnd: 1_000_000 + IDLE_MS, idleRequests: 0, expiredResponse: 401, automaticLogin: 0, explicitLogin: 204, logout: 204,
    privacyScans: 20, privacyViolations: 0, lostObservations: 0 };
  let at = 1;
  for (const name of METRICS) { if (name === "idleEnd") at += IDLE_MS; record(e, name, values[name] ?? 1, at++); }
  return e;
}
const bytes = (e: Evidence) => Buffer.from(JSON.stringify(e));
function env(b: Binding): NodeJS.ProcessEnv {
  return { RITOMER_DB_RAIL_CAMPAIGN: "D", RITOMER_DB_RAIL_RUN_ID: b.runId, RITOMER_DB_RAIL_REVIEWED_OBJECT_SHA256: b.objectSha, RITOMER_DB_RAIL_RUNTIME_SHA256: b.runtimeSha,
    RITOMER_M1D_FRONTEND_SHA256: b.frontendSha, RITOMER_DB_RAIL_RUN_ROOT: `C:\\dev\\ritomer-local-evidence\\m1-1b-postgresql\\${b.runId}`,
    RITOMER_M1D_BROWSER_PHASE: b.kind, RITOMER_M1D_BROWSER_EXECUTABLE: BROWSER, PLAYWRIGHT_NO_COPY_PROMPT: "1" };
}

describe("closed D invocation and reductions", () => {
  it("checks the emitted Domain attribute rather than inferring it from accepted cookie domain", () => {
    const header = "__Host-ritomer-session=synthetic; Path=/; Secure; HttpOnly; SameSite=Lax";
    expect(emittedCookieAttributes(header)).toBe(31);
    for (const bad of [header + "; Domain=127.0.0.1", header.replace("Secure; ", ""), header.replace("HttpOnly; ", ""), header.replace("Lax", "None"), header.replace("Path=/", "Path=/api")])
      expect(emittedCookieAttributes(bad)).not.toBe(31);
  });
  it("detects a transient leak retained in memory, even if the final snapshot is clear", () => {
    expect(privacyLeaks(["DOM transient=synthetic-secret-marker", "DOM final=clear"], new Set(["synthetic-secret-marker"]))).toBe(1);
    expect(privacyLeaks(["DOM final=clear"], new Set(["synthetic-secret-marker"]))).toBe(0);
  });
  it("filters message, stack, cause and custom fields before runner persistence", () => {
    const raw = Object.assign(new Error("synthetic-secret-marker"), { cause: "synthetic-secret-marker", token: "synthetic-secret-marker" });
    const safe = sanitizeFailure(raw);
    expect(safe.message).toBe("M1D_BROWSER_FAILED");
    expect(safe.stack).not.toContain("synthetic-secret-marker");
    expect(JSON.stringify(safe)).not.toContain("synthetic-secret-marker");
    expect(safe.cause).toBeUndefined();
  });
  it("binds the actual installed browser and refuses old runs, reporter override and missing snapshot guard", () => {
    expect(readBinding(env(binding()), []).executable).toBe(BROWSER);
    for (const change of [{ PLAYWRIGHT_NO_COPY_PROMPT: undefined }, {
      RITOMER_DB_RAIL_RUN_ID: "c2f19f4e0b324496a9593bb03be75ee1",
      RITOMER_DB_RAIL_RUN_ROOT: "C:\\dev\\ritomer-local-evidence\\m1-1b-postgresql\\c2f19f4e0b324496a9593bb03be75ee1"
    }, { RITOMER_M1D_BROWSER_EXECUTABLE: "other" }, { DEBUG: "pw:*" }])
      expect(() => readBinding({ ...env(binding()), ...change }, [])).toThrow("M1D_BINDING_FAILED");
    expect(() => readBinding(env(binding()), ["--reporter=list"])).toThrow("M1D_BINDING_FAILED");
  });
  it("allows synthetic bindings only with list; never an operational test", () => {
    const synthetic = { ...env(binding()), RITOMER_M1D_DISCOVERY: "SYNTHETIC_LIST_ONLY", RITOMER_DB_RAIL_RUN_ID: "0".repeat(32), RITOMER_DB_RAIL_REVIEWED_OBJECT_SHA256: "0".repeat(64),
      RITOMER_DB_RAIL_RUNTIME_SHA256: "0".repeat(64), RITOMER_M1D_FRONTEND_SHA256: "0".repeat(64), RITOMER_DB_RAIL_RUN_ROOT: "SYNTHETIC_LIST_ONLY", RITOMER_M1D_BROWSER_EXECUTABLE: "SYNTHETIC_LIST_ONLY" };
    expect(readBinding(synthetic, ["--list"]).discovery).toBe(true);
    expect(() => readBinding(synthetic, [])).toThrow();
    expect(() => publish({ ...binding(), discovery: true }, fixture())).toThrow();
  });
  it.each(["cookie", "browser"] as const)("reduces complete %s observations after serialization", kind => {
    expect(Object.keys(reduce(decode(bytes(fixture(kind)), binding(kind))))).toHaveLength(kind === "cookie" ? 5 : 12);
  });
  it.each(["emittedCookie", "acceptedCookie", "continuity", "rotation", "csrfRenewal", "logoutInvalidated", "otherContextReady", "nativeVisibility", "pagesClosed", "contextsClosed", "browserDisconnected"] as const)("rejects missing decisive observation %s", event => {
    const e = fixture(); e.observations = e.observations.filter(o => o.event !== event);
    expect(() => reduce(decode(bytes(e), binding()))).toThrow("M1D_OBSERVATION_FAILED");
  });
  it("rejects too-short idle time, a request during idle, and late login before expiry", () => {
    for (const mutate of [
      (e: Evidence) => { e.observations.find(o => o.event === "idleEnd")!.value -= 1; },
      (e: Evidence) => { e.observations.find(o => o.event === "idleRequests")!.value = 1; },
      (e: Evidence) => { e.observations.find(o => o.event === "explicitLogin")!.atMs = 0; }
    ]) { const e = fixture(); mutate(e); expect(() => reduce(decode(bytes(e), binding()))).toThrow(); }
  });
  it("refuses lost/transient privacy observations, unknown fields and raw protected values", () => {
    for (const event of ["privacyViolations", "lostObservations"] as const) { const e = fixture(); e.observations.find(o => o.event === event)!.value = 1; expect(() => reduce(e)).toThrow(); }
    const e = fixture(); e.windows.splice(3, 1); expect(() => reduce(e)).toThrow();
    const raw = { ...fixture(), token: "synthetic-secret-marker" };
    expect(() => decode(Buffer.from(JSON.stringify(raw)), binding())).toThrow("M1D_OBSERVATION_FAILED");
    const invalid = fixture(); (invalid.observations[0] as unknown as { value: string }).value = "synthetic-secret-marker";
    expect(() => decode(bytes(invalid), binding())).toThrow("M1D_OBSERVATION_FAILED");
    expect(fail("BROWSER").message).not.toContain("synthetic-secret-marker");
  });
  it("refuses duplicate observations and changed provenance", () => {
    const e = fixture(); e.observations.push(e.observations[0]); expect(() => decode(bytes(e), binding())).toThrow();
    expect(() => decode(bytes(fixture()), { ...binding(), frontendSha: "f".repeat(64) })).toThrow();
  });
});

function result(e: Evidence): TestResult {
  // Model the actual public attachment transport: new bytes on the reporter
  // side, no shared object reference to the worker evidence.
  const transported = Buffer.from(bytes(e).toString("base64"), "base64");
  return { status: "passed", retry: 0, errors: [], attachments: [{ name: "m1d-observations", contentType: "application/json", body: transported }] } as unknown as TestResult;
}
const testCase = { title: "m1d-browser", expectedStatus: "passed" } as TestCase;
const full = { status: "passed" } as FullResult;
function begin(reporter: Reporter) { reporter.onBegin({} as FullConfig, { allTests: () => [testCase] } as Suite); }

// Real collector functions, real jsdom DOM/MutationObserver, synthetic IDB and
// binding boundaries. These are not a claim about an executed browser journey.
describe("contract collection and page capture before privacy reduction", () => {
  const raw = () => new Error("synthetic-secret-marker");
  const bootstrap = () => ({ sessionState: "ANONYMOUS", localLoginAvailable: true, csrf: { headerName: "X-CSRF-TOKEN", token: "synthetic-csrf-token" },
    actors: ["one", "two", "three"].map(name => ({ actorKey: `synthetic-actor-${name}`, displayLabel: `Acteur ${name}` })) });
  const me = () => ({ actor: { userId: "00000000-0000-4000-8000-000000000010", externalSubject: "synthetic-external-subject" },
    memberships: [{ tenantId: "00000000-0000-4000-8000-000000000020", tenantName: "Synthetic", tenantSlug: "synthetic", roles: ["ACCOUNTANT"] }],
    activeTenant: { tenantId: "00000000-0000-4000-8000-000000000020", tenantName: "Synthetic", tenantSlug: "synthetic" }, effectiveRoles: ["ACCOUNTANT"] });
  function collect() {
    const state = new PrivacyObservation();
    collectProtectedValues("/api/session/bootstrap", bootstrap(), state.protectedValues, state.protectedCategories);
    collectProtectedValues("/api/me", me(), state.protectedValues, state.protectedCategories);
    return state;
  }
  type IdBMode = "normal" | "unavailable" | "blocked" | "error" | "abort" | "incomplete" | "unreadable" | "hanging";
  function idb(rows: Array<{ key: unknown; value: unknown }> = [], mode: IdBMode = "normal") {
    const close = vi.fn();
    const factory = {
      databases: vi.fn(async () => { if (mode === "unavailable") throw raw(); return [{ name: "synthetic-db", version: 1 }]; }),
      open: () => {
        const opened = { onsuccess: null as (() => void) | null, onerror: null as (() => void) | null, onblocked: null as (() => void) | null,
          result: { close, objectStoreNames: ["synthetic-store"], transaction: () => {
            const transaction = { oncomplete: null as (() => void) | null, onabort: null as (() => void) | null, onerror: null as (() => void) | null,
              objectStore: () => ({ openCursor: () => {
                const request = { onsuccess: null as (() => void) | null, onerror: null as (() => void) | null, result: null as unknown };
                let index = 0;
                const next = () => {
                  if (mode === "error") { request.onerror?.(); return; }
                  if (mode === "abort") { transaction.onabort?.(); return; }
                  if (mode === "incomplete") { transaction.oncomplete?.(); return; }
                  if (mode === "hanging") return;
                  const row = rows[index];
                  request.result = row ? { key: row.key, primaryKey: row.key, get value() { if (mode === "unreadable") throw raw(); return row.value; },
                    continue: () => { index++; queueMicrotask(next); } } : null;
                  request.onsuccess?.();
                  if (!row) queueMicrotask(() => transaction.oncomplete?.());
                };
                queueMicrotask(next);
                return request;
              } }) };
            return transaction;
          } } };
        queueMicrotask(() => { if (mode === "blocked") opened.onblocked?.(); else opened.onsuccess?.(); });
        return opened;
      }
    };
    vi.stubGlobal("indexedDB", factory);
    return { factory, close };
  }
  function install(state: PrivacyObservation, brokenBinding = false) {
    const NativeObserver = MutationObserver;
    vi.stubGlobal("MutationObserver", class extends NativeObserver { constructor(callback: MutationCallback) { super(callback); domObservers.push(this); } });
    const channel = { onmessage: null as ((event: { data: unknown }) => void) | null, onmessageerror: null as (() => void) | null };
    vi.stubGlobal("BroadcastChannel", class { constructor() { return channel; } });
    vi.stubGlobal("__m1dObserve", async (type: string, value: unknown, surface?: "DOM") => {
      if (brokenBinding) throw raw();
      if (type === "sample" || type === "channel") state.sample(value, type === "channel" ? "CHANNEL" : surface);
      else if (type === "lost") state.lost++;
    });
    installPageObservation();
    const flush = async () => {
      if (!await (window as unknown as { __m1dFlush: () => Promise<boolean> }).__m1dFlush()) state.lost++;
    };
    return { flush, channel };
  }
  function privacyEvidence(state: PrivacyObservation) {
    const e = fixture("cookie");
    for (const [event, value] of Object.entries({ privacyScans: state.scans, privacyViolations: state.violations, lostObservations: state.lost }))
      e.observations.find(o => o.event === event)!.value = value;
    return decode(bytes(e), binding("cookie"));
  }
  function refuse(state: PrivacyObservation) {
    expect(() => state.completeScan()).toThrow("M1D_ASSERTION_FAILED");
    expect(() => state.completeScan()).toThrow("M1D_ASSERTION_FAILED");
    expect(() => reduce(privacyEvidence(state))).toThrow("M1D_OBSERVATION_FAILED");
  }
  const protectedMarkers = ["synthetic-external-subject", "synthetic-actor-one", "synthetic-actor-two", "synthetic-actor-three"];
  it.each(protectedMarkers.flatMap(marker => ["attribute", "input", "textarea", "url", "local", "session", "indexed-key", "indexed-value", "channel"].map(surface => ({ marker, surface }))))(
    "collects $marker from its payload and detects capture on $surface", async ({ marker, surface }) => {
      const state = collect(), observer = install(state);
      expect(state.protectedValues.has(marker)).toBe(true);
      const input = document.createElement("input"), textarea = document.createElement("textarea"), target = document.createElement("div");
      document.body.append(input, textarea, target);
      idb(surface === "indexed-key" ? [{ key: marker, value: "ordinary" }] : surface === "indexed-value" ? [{ key: "ordinary", value: marker }] : []);
      if (surface === "attribute") { target.setAttribute("data-value", marker); target.setAttribute("data-value", ""); }
      if (surface === "input") input.value = marker;
      if (surface === "textarea") textarea.value = marker;
      if (surface === "url") history.replaceState(null, "", `/?value=${marker}`);
      if (surface === "local") localStorage.setItem("ordinary", marker);
      if (surface === "session") sessionStorage.setItem("ordinary", marker);
      if (surface === "channel") observer.channel.onmessage?.({ data: { value: marker } });
      // The stimulus occurs before invoking the real capture/drain functions.
      expect(document.documentElement.outerHTML).not.toContain(marker);
      await observer.flush(); await state.capture(capturePageSnapshot, "PAGE_SNAPSHOT");
      expect(state.lost).toBe(0);
      expect(privacyLeaks(state.samples, state.protectedValues)).toBeGreaterThan(0);
      refuse(state);
      expect(state.firstPrivacyViolation).toMatchObject({ rule: "PROTECTED_VALUE_MATCH", valueCategory: marker === "synthetic-external-subject" ? "SUBJECT" : "ACTOR_KEY" });
      const expectedSurface: PrivacySurface = surface === "attribute" ? "DOM" : surface === "input" || surface === "textarea" ? "FORM_FIELD"
        : surface === "url" ? "URL" : surface === "local" ? "LOCAL_STORAGE" : surface === "session" ? "SESSION_STORAGE"
        : surface.startsWith("indexed-") ? "INDEXED_DB" : "CHANNEL";
      expect(state.firstPrivacyViolation?.surface).toBe(expectedSurface);
      expect(bytes(privacyEvidence(state)).toString()).not.toContain(marker);
    });
  it("allows filtered nominal observations without exposing any collected identity", async () => {
    const state = collect(), observer = install(state); idb([{ key: "ordinary-key", value: { text: "ordinary-value" } }]);
    document.body.innerHTML = '<input value="ordinary"><textarea></textarea><p>Public label</p>';
    await observer.flush(); await state.capture(capturePageSnapshot); state.completeScan();
    await observer.flush(); await state.capture(capturePageSnapshot); state.completeScan();
    const evidence = privacyEvidence(state);
    expect(() => reduce(evidence)).not.toThrow();
    for (const value of state.protectedValues) expect(bytes(evidence).toString()).not.toContain(value);
  });
  it.each(["missing-subject", "unreadable-subject", "missing-actor", "missing-actors", "missing-csrf", "missing-membership"]) (
    "refuses incomplete contract collection: %s", async mode => {
      const state = new PrivacyObservation(); idb();
      const anonymous = bootstrap(), profile = me();
      if (mode === "missing-subject") Reflect.deleteProperty(profile.actor, "externalSubject");
      if (mode === "unreadable-subject") Object.defineProperty(profile.actor, "externalSubject", { get() { throw raw(); } });
      if (mode === "missing-actor") Reflect.deleteProperty(anonymous.actors[1], "actorKey");
      if (mode === "missing-actors") Reflect.deleteProperty(anonymous, "actors");
      if (mode === "missing-csrf") Reflect.deleteProperty(anonymous.csrf, "token");
      if (mode === "missing-membership") Reflect.deleteProperty(profile.memberships[0], "tenantId");
      await state.capture(async () => {
        collectProtectedValues("/api/session/bootstrap", anonymous, state.protectedValues);
        collectProtectedValues("/api/me", profile, state.protectedValues);
        return capturePageSnapshot();
      });
      expect(state.lost).toBe(1); refuse(state);
    });
  it.each(["unavailable", "blocked", "error", "abort", "incomplete", "unreadable"] as const)("refuses IndexedDB %s instead of declaring a clean scan", async mode => {
    const state = collect(); const database = idb([{ key: "ordinary", value: "ordinary" }], mode);
    await state.capture(capturePageSnapshot); expect(state.lost).toBe(1); refuse(state);
    if (!["unavailable", "blocked"].includes(mode)) expect(database.close).toHaveBeenCalledOnce();
  });
  it("bounds an IndexedDB read that never completes", async () => {
    vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
    const state = collect(), database = idb([], "hanging");
    const operation = state.capture(capturePageSnapshot);
    await vi.advanceTimersByTimeAsync(1000); await operation;
    expect(state.lost).toBe(1); expect(database.close).toHaveBeenCalledOnce(); refuse(state);
  });
  it("refuses an unreadable current field value instead of falling back to outerHTML", async () => {
    const state = collect(); idb();
    const input = document.createElement("input"); document.body.append(input);
    Object.defineProperty(input, "value", { get() { throw raw(); } });
    await state.capture(capturePageSnapshot); expect(state.lost).toBe(1); refuse(state);
  });
  it("closes an IndexedDB connection delivered after a blocked open was refused", async () => {
    const state = collect(), close = vi.fn();
    const request = { onsuccess: null as (() => void) | null, onblocked: null as (() => void) | null, result: { close } };
    vi.stubGlobal("indexedDB", { databases: async () => [{ name: "synthetic-db", version: 1 }], open: () => {
      queueMicrotask(() => request.onblocked?.()); return request;
    } });
    await state.capture(capturePageSnapshot);
    request.onsuccess?.();
    expect(close).toHaveBeenCalledOnce(); expect(state.lost).toBe(1); refuse(state);
  });
  it("refuses a reached cursor limit or a value JSON would silently omit", async () => {
    for (const rows of [Array.from({ length: 2001 }, (_, key) => ({ key, value: "ordinary" })), [{ key: "ordinary", value: new Map([["hidden", "synthetic-external-subject"]]) }]]) {
      const state = collect(); idb(rows); await state.capture(capturePageSnapshot); expect(state.lost).toBe(1); refuse(state);
    }
  });
  it("refuses a failed observation binding and a full sample buffer", async () => {
    const state = collect(), observer = install(state, true); idb();
    document.body.setAttribute("data-fixture", "ordinary");
    await observer.flush(); await state.capture(capturePageSnapshot);
    expect(state.lost).toBeGreaterThan(0); refuse(state);
    const fullState = collect();
    for (let index = 0; index <= 8000; index++) fullState.sample("ordinary");
    expect(fullState.lost).toBe(1); refuse(fullState);
  });
});

describe("closed privacy categories through the actual Observer", () => {
  const marker = "synthetic-secret-marker";
  async function boundary() {
    const listeners = new Map<string, (value: never) => void>();
    let bindingCallback!: (source: unknown, type: string, value: unknown, surface?: unknown) => void;
    const pageListeners = new Map<string, (value: never) => void>();
    const context = { on: (event: string, callback: (value: never) => void) => { listeners.set(event, callback); }, pages: () => [],
      exposeBinding: async (_name: string, callback: typeof bindingCallback) => { bindingCallback = callback; }, addInitScript: async () => {} } as unknown as BrowserContext;
    const failures = new BrowserFailures(), observer = new Observer(context, failures);
    await observer.install();
    listeners.get("page")!({ on: (event: string, callback: (value: never) => void) => { pageListeners.set(event, callback); } } as never);
    const request = (pathname: string, headers: Record<string, string>, origin = "http://127.0.0.1:5173") => listeners.get("request")!(
      { url: () => origin + pathname, method: () => "GET", headers: () => headers } as never);
    return { observer, failures, request, listeners, pageListeners, sample: (type: string, value: unknown, surface?: unknown) => bindingCallback({}, type, value, surface) };
  }
  it.each(["/api/session", "/api/session/bootstrap", "/api/session/local?return=/api/closing-folders", "/api/session/logout#business"])(
    "refuses the tenant header on session pathname %s", async pathname => {
      const b = await boundary(); b.request(pathname, { "x-tenant-id": marker });
      await expectCookieRejection(() => b.observer.scan());
      expect(b.observer.violations).toBe(1);
      expect(b.observer.firstPrivacyViolation).toEqual({ rule: "TENANT_SESSION_HEADER", surface: "REQUEST_HEADERS", valueCategory: "TENANT_ID" });
    });
  it.each(["/api/closing-folders", "/api/me", "/api/session-business", "/api/closing-folders?return=/api/session/local", "/api/closing-folders#/api/session"])(
    "allows the contractual tenant transport on business pathname %s", async pathname => {
      const b = await boundary(); b.request(pathname, { "x-tenant-id": marker }); await b.observer.scan();
      expect(b.observer.violations).toBe(0); expect(b.observer.firstPrivacyViolation).toBeNull();
    });
  it.each(["/api/session", "/api/session/bootstrap", "/api/me", "/api/closing-folders"])(
    "still refuses Authorization on observed API pathname %s", async pathname => {
      const b = await boundary(); b.request(pathname, { authorization: marker });
      await expectCookieRejection(() => b.observer.scan());
      expect(b.observer.firstPrivacyViolation).toEqual({ rule: "AUTHORIZATION_HEADER", surface: "REQUEST_HEADERS", valueCategory: "NONE" });
    });
  it("keeps both forbidden headers as one increment with an explicitly combined rule", async () => {
    const b = await boundary(); b.request("/api/session/local", { authorization: marker, "x-tenant-id": marker });
    await expectCookieRejection(() => b.observer.scan());
    expect(b.observer.violations).toBe(1);
    expect(b.observer.firstPrivacyViolation).toEqual({ rule: "AUTHORIZATION_AND_TENANT_SESSION_HEADERS", surface: "REQUEST_HEADERS", valueCategory: "AMBIGUOUS" });
  });
  it.each(["DOM", "CONSOLE", "URL", "LOCAL_STORAGE", "SESSION_STORAGE", "INDEXED_DB"] as const)(
    "does not exempt a transported tenant value from exposure on %s", async surface => {
      const b = await boundary(); b.observer.protect(marker, "TENANT_ID"); b.request("/api/closing-folders", { "x-tenant-id": marker });
      if (surface === "DOM") b.sample("sample", marker, "DOM");
      else if (surface === "CONSOLE") b.pageListeners.get("console")!({ text: () => marker } as never);
      else if (surface === "URL") b.pageListeners.get("framenavigated")!({ url: () => marker } as never);
      else {
        const key = surface === "LOCAL_STORAGE" ? "local" : surface === "SESSION_STORAGE" ? "session" : "indexed";
        await b.observer.capture(async () => JSON.stringify({ [key]: [marker] }), "PAGE_SNAPSHOT");
      }
      await expectCookieRejection(() => b.observer.scan());
      expect(b.observer.firstPrivacyViolation).toEqual({ rule: "PROTECTED_VALUE_MATCH", surface, valueCategory: "TENANT_ID" });
    });
  it("records the channel shape before its subsequent protected-value match and freezes that triplet", async () => {
    const b = await boundary(); b.observer.protect(marker, "USER_ID"); b.sample("channel", JSON.stringify({ value: marker }));
    const first = b.observer.firstPrivacyViolation;
    await expectCookieRejection(() => b.observer.scan());
    expect(b.observer.violations).toBe(2); expect(b.observer.firstPrivacyViolation === first).toBe(true);
    expect(first).toEqual({ rule: "CHANNEL_SHAPE", surface: "CHANNEL", valueCategory: "NONE" });
    expect(Object.isFrozen(first)).toBe(true);
  });
  it("keeps a direct increment consistent when an HTTP failure arrives before the next scan", async () => {
    const b = await boundary(); await b.observer.scan();
    b.failures.cookieFacts.privacyScans = b.observer.scans; b.failures.cookieFacts.privacyViolations = b.observer.violations;
    b.failures.cookieFacts.lostObservations = b.observer.lost; b.failures.lastCookieControl = "ROTATION";
    b.observer.cookiePhase = "login";
    const request = { url: () => "http://127.0.0.1:5173/api/session/bootstrap", method: () => "GET", headers: () => ({ authorization: marker }) };
    b.listeners.get("request")!(request as never);
    b.listeners.get("response")!({ url: request.url, request: () => request, status: () => 503, headersArray: async () => [], json: async () => ({}) } as never);
    await b.observer.flush();
    expect(b.failures.cookieDiagnostic).toMatchObject({ schemaVersion: 2, step: "AUTHENTICATED_RESPONSE", reason: "HTTP_STATUS", lastCompleted: "ROTATION",
      facts: { privacyScans: 1, privacyViolations: 1, lostObservations: 0 },
      firstPrivacyViolation: { rule: "AUTHORIZATION_HEADER", surface: "REQUEST_HEADERS", valueCategory: "NONE" } });
    const first = b.failures.cookieDiagnostic;
    b.sample("channel", "invalid"); await expectCookieRejection(() => b.observer.scan());
    expect(b.failures.cookieDiagnostic === first).toBe(true); expect(first?.facts.privacyViolations).toBe(1);
    expect(JSON.stringify(first).includes(marker)).toBe(false);
  });
  it("keeps retroactive matching, duplicate samples and repeated scan counts unchanged", () => {
    const state = new PrivacyObservation(); state.sample(marker, "CONSOLE"); state.completeScan();
    state.protect(marker, "SUBJECT"); expect(() => state.completeScan()).toThrow("M1D_ASSERTION_FAILED");
    expect(state.scans).toBe(2); expect(state.violations).toBe(1);
    const first = state.firstPrivacyViolation;
    state.sample(marker, "URL"); expect(() => state.completeScan()).toThrow("M1D_ASSERTION_FAILED");
    expect(state.violations).toBe(3); expect(state.samples.length).toBe(2); expect(state.firstPrivacyViolation === first).toBe(true);
  });
  it("keeps one aggregate snapshot sample and reports multiple compatible surfaces as ambiguous", async () => {
    const state = new PrivacyObservation(); state.protect(marker, "USER_ID");
    const snapshot = JSON.stringify({ dom: marker, local: { item: marker } });
    await state.capture(async () => snapshot, "PAGE_SNAPSHOT");
    expect(() => state.completeScan()).toThrow("M1D_ASSERTION_FAILED");
    expect(state.samples.length).toBe(1); expect(state.violations).toBe(1);
    expect(state.bytes === Buffer.byteLength(snapshot)).toBe(true);
    expect(state.firstPrivacyViolation).toEqual({ rule: "PROTECTED_VALUE_MATCH", surface: "AMBIGUOUS", valueCategory: "USER_ID" });
  });
  it("reports a value collected under multiple categories without choosing an arbitrary identity", () => {
    const state = new PrivacyObservation();
    collectProtectedValues("/api/me", { actor: { userId: marker, externalSubject: marker }, memberships: [{ tenantId: marker }], activeTenant: null }, state.protectedValues, state.protectedCategories);
    state.sample(marker, "DOM"); expect(() => state.completeScan()).toThrow("M1D_ASSERTION_FAILED");
    expect(state.protectedValues.size).toBe(1); expect(state.violations).toBe(1);
    expect(state.firstPrivacyViolation).toEqual({ rule: "PROTECTED_VALUE_MATCH", surface: "DOM", valueCategory: "AMBIGUOUS" });
  });
  it.each(["SESSION_COOKIE", "CSRF_TOKEN", "ACTOR_KEY", "USER_ID", "SUBJECT", "TENANT_ID", "MEMBERSHIP_ID", "ACTOR_ID"] as const)(
    "reports only the closed category for a protected %s value", category => {
      const state = new PrivacyObservation(); state.protect(marker, category); state.sample(marker, "DOM");
      expect(() => state.completeScan()).toThrow("M1D_ASSERTION_FAILED");
      expect(state.firstPrivacyViolation).toEqual({ rule: "PROTECTED_VALUE_MATCH", surface: "DOM", valueCategory: category });
      expect(JSON.stringify(state.firstPrivacyViolation).includes(marker)).toBe(false);
    });
  it("does not invent a category for directly supplied legacy protected values", () => {
    const state = new PrivacyObservation(); state.protectedValues.add(marker); state.sample(marker);
    expect(() => state.completeScan()).toThrow("M1D_ASSERTION_FAILED");
    expect(state.firstPrivacyViolation).toEqual({ rule: "PROTECTED_VALUE_MATCH", surface: "AMBIGUOUS", valueCategory: "AMBIGUOUS" });
  });
  it("retains byte and sample caps without multiplying provenance samples", () => {
    const state = new PrivacyObservation(); state.sample("x".repeat(8 * 1024 * 1024), "DOM"); state.sample("x", "URL");
    expect(state.samples.length).toBe(1); expect(state.lost).toBe(1); expect(() => state.completeScan()).toThrow("M1D_ASSERTION_FAILED");
    expect(state.firstPrivacyViolation).toBeNull();
  });
  it.each(["CSRF_TOKEN", "ACTOR_KEY", "USER_ID", "SUBJECT", "TENANT_ID", "MEMBERSHIP_ID", "ACTOR_ID"] as const)(
    "categorizes %s through the real contract collector", category => {
      const state = new PrivacyObservation();
      const bootstrap = category === "CSRF_TOKEN" || category === "ACTOR_KEY";
      const fields: Partial<Record<PrivacyValueCategory, string>> = { USER_ID: "userId", SUBJECT: "externalSubject", TENANT_ID: "tenantId", MEMBERSHIP_ID: "membershipId", ACTOR_ID: "actorId" };
      const payload = bootstrap ? { sessionState: "ANONYMOUS", localLoginAvailable: true,
        csrf: { headerName: "X-CSRF-TOKEN", token: category === "CSRF_TOKEN" ? marker : "ordinary-csrf" },
        actors: [{ actorKey: category === "ACTOR_KEY" ? marker : "ordinary-actor" }] }
        : { actor: { userId: "ordinary-user", externalSubject: "ordinary-subject" }, memberships: [], activeTenant: null, detail: { [fields[category]!]: marker } };
      collectProtectedValues(bootstrap ? "/api/session/bootstrap" : "/api/me", payload, state.protectedValues, state.protectedCategories);
      state.sample(marker, "CONSOLE"); expect(() => state.completeScan()).toThrow("M1D_ASSERTION_FAILED");
      expect(state.firstPrivacyViolation).toEqual({ rule: "PROTECTED_VALUE_MATCH", surface: "CONSOLE", valueCategory: category });
    });
  it("categorizes an emitted session cookie without publishing the header or value", async () => {
    const b = await boundary();
    const request = { url: () => "http://127.0.0.1:5173/api/session/local", method: () => "POST", headers: () => ({}) };
    b.listeners.get("request")!(request as never);
    b.listeners.get("response")!({ url: request.url, request: () => request, status: () => 204,
      headersArray: async () => [{ name: "set-cookie", value: `__Host-ritomer-session=${marker}; Secure; HttpOnly; Path=/; SameSite=Lax` }] } as never);
    await b.observer.flush(); b.pageListeners.get("console")!({ text: () => marker } as never);
    await expectCookieRejection(() => b.observer.scan());
    expect(b.observer.firstPrivacyViolation).toEqual({ rule: "PROTECTED_VALUE_MATCH", surface: "CONSOLE", valueCategory: "SESSION_COOKIE" });
    expect(JSON.stringify(b.observer.firstPrivacyViolation).includes(marker)).toBe(false);
  });
  it("does not assign a page surface to a match confined to the snapshot envelope", async () => {
    const state = new PrivacyObservation(); state.protect("dom", "ACTOR_KEY");
    await state.capture(async () => JSON.stringify({ dom: "ordinary" }), "PAGE_SNAPSHOT");
    expect(() => state.completeScan()).toThrow("M1D_ASSERTION_FAILED");
    expect(state.violations).toBe(1); expect(state.firstPrivacyViolation?.surface).toBe("AMBIGUOUS");
  });
  it("commits protected provenance atomically only after complete readable payloads", () => {
    const state = new PrivacyObservation();
    expect(() => collectProtectedValues("/api/me", { actor: { userId: marker, externalSubject: marker }, memberships: [{}], activeTenant: null },
      state.protectedValues, state.protectedCategories)).toThrow("M1D_OBSERVATION_FAILED");
    expect(state.protectedValues.size).toBe(0); expect(state.protectedCategories.size).toBe(0);
  });
  it("preserves strict historical identity-key matching and retroactively protects the canonical key", () => {
    const state = new PrivacyObservation();
    // This is the exact historical expression, without the multiline flag.
    // A trailing line break is not part of one of the allowed identity keys.
    expect(/^(tenantId|userId|membershipId|subject|externalSubject|actorId|actorKey)$/.test("tenantId\n")).toBe(false);
    collectProtectedValues("/api/me", { actor: { userId: "ordinary-user", externalSubject: "ordinary-subject" }, memberships: [], activeTenant: null,
      detail: { "tenantId\n": marker } }, state.protectedValues, state.protectedCategories);
    expect(state.protectedValues.has(marker)).toBe(false); expect(state.protectedCategories.has(marker)).toBe(false);
    state.sample(marker, "DOM"); state.completeScan();
    expect(state.violations).toBe(0); expect(state.firstPrivacyViolation).toBeNull();
    collectProtectedValues("/api/me", { actor: { userId: "ordinary-user", externalSubject: "ordinary-subject" }, memberships: [], activeTenant: null,
      detail: { tenantId: marker } }, state.protectedValues, state.protectedCategories);
    expect(state.protectedValues.has(marker)).toBe(true);
    expect(() => state.completeScan()).toThrow("M1D_ASSERTION_FAILED");
    expect(state.violations).toBe(1);
    expect(state.firstPrivacyViolation).toEqual({ rule: "PROTECTED_VALUE_MATCH", surface: "DOM", valueCategory: "TENANT_ID" });
  });
  it("reads v1 without invented categories and requires the exact v2 triplet field", () => {
    const v1: CookieDiagnostic = { schemaVersion: 1, source: "BROWSER", step: "AUTHENTICATED_PRIVACY", lastCompleted: "ROTATION", reason: "PRIVACY", metric: null, facts: emptyCookieFacts() };
    const legacy = validateCookieDiagnostic(v1);
    expect(Object.prototype.hasOwnProperty.call(legacy, "firstPrivacyViolation")).toBe(false);
    const v2 = { ...v1, schemaVersion: 2, firstPrivacyViolation: { rule: "PROTECTED_VALUE_MATCH", surface: "DOM", valueCategory: "USER_ID" } };
    const validated = validateCookieDiagnostic(v2);
    expect(validated.schemaVersion).toBe(2); expect(validated.schemaVersion === 2 && Object.isFrozen(validated.firstPrivacyViolation)).toBe(true);
    v2.firstPrivacyViolation.surface = "CONSOLE";
    expect(validated.schemaVersion === 2 && validated.firstPrivacyViolation?.surface).toBe("DOM");
    expect(validateCookieDiagnostic({ ...v2, firstPrivacyViolation: null })).toMatchObject({ schemaVersion: 2, firstPrivacyViolation: null });
    for (const malformed of [{ ...v1, firstPrivacyViolation: null }, { ...v1, schemaVersion: 2 }, { ...v2, schemaVersion: 3 },
      { ...v2, schemaVersion: "2" }, { ...v2, firstPrivacyViolation: undefined }]) {
      expect(() => validateCookieDiagnostic(malformed)).toThrow("M1D_OBSERVATION_FAILED");
    }
  });
  it("never enriches an existing v1 diagnostic with a later privacy observation", () => {
    const failures = new BrowserFailures();
    const legacy: CookieDiagnostic = { schemaVersion: 1, source: "BROWSER", step: "BOOTSTRAP_RESPONSE", lastCompleted: null,
      reason: "HTTP_STATUS", metric: null, facts: emptyCookieFacts() };
    failures.cookieDiagnostic = legacy;
    failures.notePrivacyViolation({ rule: "AUTHORIZATION_HEADER", surface: "REQUEST_HEADERS", valueCategory: "NONE" });
    expect(failures.cookieDiagnostic === legacy).toBe(true);
    expect(Object.prototype.hasOwnProperty.call(failures.cookieDiagnostic, "firstPrivacyViolation")).toBe(false);
  });
  it.each(["rule", "surface", "valueCategory"] as const)("refuses unclosed privacy %s before serialization", field => {
    const valid = { rule: "PROTECTED_VALUE_MATCH", surface: "DOM", valueCategory: "USER_ID" };
    for (const value of [marker, valid[field].toLowerCase(), valid[field] + "\0", valid[field] + "\n", valid[field] + " ", 1, null, undefined]) {
      expect(() => validatePrivacyViolation({ ...valid, [field]: value })).toThrow("M1D_OBSERVATION_FAILED");
    }
    expect(() => validatePrivacyViolation({ ...valid, extra: marker })).toThrow("M1D_OBSERVATION_FAILED");
  });
  it.each([
    ["PROTECTED_VALUE_MATCH", "REQUEST_HEADERS", "TENANT_ID"], ["PROTECTED_VALUE_MATCH", "DOM", "NONE"],
    ["AUTHORIZATION_HEADER", "REQUEST_HEADERS", "TENANT_ID"], ["TENANT_SESSION_HEADER", "REQUEST_HEADERS", "NONE"],
    ["AUTHORIZATION_AND_TENANT_SESSION_HEADERS", "REQUEST_HEADERS", "TENANT_ID"], ["CHANNEL_SHAPE", "DOM", "NONE"], ["CHANNEL_SHAPE", "CHANNEL", "CSRF_TOKEN"]
  ])("refuses inconsistent categorical combination %s / %s / %s", (rule, surface, valueCategory) => {
    expect(() => validatePrivacyViolation({ rule, surface, valueCategory })).toThrow("M1D_OBSERVATION_FAILED");
  });
});

describe("actual worker finalization with resource boundary doubles", () => {
  function cookieFinishFixture() {
    const calls: string[] = [];
    const raw = () => new Error("synthetic-secret-marker", { cause: "synthetic-secret-marker" });
    const pages = [0, 1].map(i => ({ closed: false, close: vi.fn(async () => { calls.push(`page:${i}`); pages[i].closed = true; }), isClosed: () => pages[i].closed }));
    const contexts = pages.map((page, i) => ({ closed: false, pages: () => page.closed ? [] : [page], close: vi.fn(async () => { calls.push(`context:${i}`); contexts[i].closed = true; }) }));
    let connected = true;
    const browser = { contexts: () => contexts.filter(c => !c.closed), close: vi.fn(async () => { calls.push("browser"); connected = false; }), isConnected: () => connected };
    const observers = [0, 1].map(i => ({ scans: 10, violations: 0, lost: 0, scan: vi.fn(async () => { calls.push(`scan:${i}`); }) }));
    // Cookie-only observations: no simulated journey or inactivity proof.
    const evidence = fixture("cookie");
    evidence.observations = evidence.observations.filter(o => ["emittedCookie", "acceptedCookie", "continuity", "login", "rotation", "authenticated", "me"].includes(o.event));
    for (const observation of evidence.observations) observation.atMs = 0;
    const attach = vi.fn(async (body: Buffer) => { void body; calls.push("attachment"); });
    return { calls, raw, pages, contexts, browser, observers, evidence, attach,
      state: { browser: browser as unknown as Browser, contexts: contexts as unknown as BrowserContext[], observers, evidence, binding: binding("cookie"), attach } };
  }
  async function reporterOutcome(f: ReturnType<typeof cookieFinishFixture>, failure?: Error) {
    let published = false;
    const reporter = new Reporter(binding("cookie"), () => { published = true; });
    const tc = { title: "m1d-cookie", expectedStatus: "passed" } as TestCase;
    reporter.onBegin({} as FullConfig, { allTests: () => [tc] } as Suite);
    const transported = f.attach.mock.calls[0]?.[0];
    const r = { status: failure ? "failed" : "passed", retry: 0, errors: failure ? [{ message: failure.message }] : [],
      attachments: transported ? [{ name: "m1d-observations", contentType: "application/json", body: Buffer.from(transported) }] : [] } as unknown as TestResult;
    reporter.onTestEnd(tc, r);
    return { result: await reporter.onEnd({ status: failure ? "failed" : "passed" } as FullResult), published };
  }
  function deferred() {
    let reject!: (error: Error) => void;
    const promise = new Promise<void>((_resolve, fail) => { reject = fail; });
    return { promise, reject };
  }
  it("freezes the first finalization failure before a secondary observer rejection", async () => {
    const f = cookieFinishFixture(), failures = new BrowserFailures(), pending = deferred();
    failures.setBrowserStep("SHARED_LOGOUT"); failures.setBrowserStep("PRIVACY");
    void failures.capture("OBSERVER", () => pending.promise);
    f.pages[0].close.mockRejectedValue(f.raw());
    const close = f.contexts[0].close.getMockImplementation()!;
    f.contexts[0].close.mockImplementation(async () => { pending.reject(f.raw()); await close(); });
    const b = binding(), e: Evidence = { ...fixture(), observations: [], windows: [] };
    const failure = await finishBrowserRun({ ...f.state, evidence: e, binding: b, failures });
    expect(failure?.message).toBe("M1D_PAGE_CLOSE_FAILED; SECONDARY=M1D_OBSERVER_FAILED");
    const attachment = f.attach.mock.calls[0][0];
    const diagnostic = decode(attachment, b).browserDiagnostic;
    expect(diagnostic).toEqual({ schemaVersion: 1, source: "SCENARIO", step: "FINALIZATION", lastCompleted: "SHARED_LOGOUT", reason: "OPERATION_FAILED" });
    expect(failures.browserDiagnostic).toEqual(diagnostic);
    expect(attachment.toString("utf8")).not.toContain("synthetic-secret-marker");
    expect(() => reduce(decode(attachment, b))).toThrow("M1D_OBSERVATION_FAILED");
  });
  it.each([true, false])("handles an unawaited response rejected by closing, primary action failure=%s", async actionFails => {
    const f = cookieFinishFixture(), failures = new BrowserFailures(), response = deferred();
    // Same creation-before-action ordering and same capture used by the spec.
    const responseWait = failures.capture("RESPONSE", () => response.promise);
    try { if (actionFails) await Promise.reject(f.raw()); } catch { failures.note("COOKIE"); }
    const close = f.pages[0].close.getMockImplementation()!;
    f.pages[0].close.mockImplementation(async () => { response.reject(f.raw()); await close(); });
    const failure = await finishBrowserRun({ ...f.state, failures });
    expect(failure?.message).toBe(actionFails ? "M1D_COOKIE_FAILED; SECONDARY=M1D_RESPONSE_FAILED" : "M1D_RESPONSE_FAILED");
    expect(() => capturedValue({ ok: true, value: "read" })).not.toThrow();
    const awaitedResult = await responseWait;
    expect(() => capturedValue(awaitedResult)).toThrow("M1D_OBSERVATION_FAILED");
    expect(failure?.stack).not.toContain("synthetic-secret-marker"); expect(failure?.cause).toBeUndefined();
    expect(await responseWait).toEqual({ ok: false });
    expect(await reporterOutcome(f, failure)).toEqual({ result: { status: "failed" }, published: false });
  });
  it("closes a rejected route callback at its boundary and preserves a prior diagnostic", async () => {
    const f = cookieFinishFixture(), failures = new BrowserFailures(), continued = deferred();
    failures.note("JOURNEY");
    const callback = failures.route(async route => { await route.continue(); });
    const returned = callback({ continue: () => continued.promise } as unknown as Route);
    const close = f.pages[0].close.getMockImplementation()!;
    f.pages[0].close.mockImplementation(async () => { continued.reject(f.raw()); await close(); });
    const failure = await finishBrowserRun({ ...f.state, failures });
    await expect(returned).resolves.toBeUndefined();
    expect(failure?.message).toBe("M1D_JOURNEY_FAILED; SECONDARY=M1D_ROUTE_FAILED");
    expect(failure?.stack).not.toContain("synthetic-secret-marker");
    expect(await reporterOutcome(f, failure)).toEqual({ result: { status: "failed" }, published: false });
  });
  it("fails without an action error when the route callback itself fails", async () => {
    const f = cookieFinishFixture(), failures = new BrowserFailures();
    await expect(failures.route(async () => { throw f.raw(); })({} as Route)).resolves.toBeUndefined();
    const failure = await finishBrowserRun({ ...f.state, failures });
    expect(failure?.message).toBe("M1D_ROUTE_FAILED");
    expect(await reporterOutcome(f, failure)).toEqual({ result: { status: "failed" }, published: false });
  });
  it("bounds draining and still handles a rejection after the closed failure was returned", async () => {
    vi.useFakeTimers();
    const f = cookieFinishFixture(), failures = new BrowserFailures(), response = deferred();
    void failures.capture("RESPONSE", () => response.promise);
    failures.note("COOKIE");
    const operation = finishBrowserRun({ ...f.state, failures });
    await vi.advanceTimersByTimeAsync(FINALIZATION_STEP_MS);
    const failure = await operation;
    expect(failure?.message).toBe("M1D_COOKIE_FAILED; SECONDARY=M1D_PRIVACY_FINAL_TIMEOUT");
    response.reject(f.raw()); await failures.drain();
    expect(failures.diagnostics.at(-1)).toBe("M1D_RESPONSE_FAILED");
    expect(vi.getTimerCount()).toBe(0);
    expect(await reporterOutcome(f, failure)).toEqual({ result: { status: "failed" }, published: false });
  });
  it("tries each remaining close independently, retains the first diagnostic and forbids positive receipts", async () => {
    const f = cookieFinishFixture();
    f.pages[0].close.mockImplementation(async () => { f.calls.push("page:0"); throw f.raw(); });
    f.contexts[0].close.mockImplementation(async () => { f.calls.push("context:0"); throw f.raw(); });
    f.observers[0].scan.mockRejectedValue(f.raw());
    const failure = await finishBrowserRun(f.state);
    expect(failure?.message).toMatch(/^M1D_PAGE_CLOSE_FAILED; SECONDARY=/);
    expect(failure?.message).toContain("M1D_CONTEXT_CLOSE_FAILED");
    expect(failure?.message).toContain("M1D_PRIVACY_FINAL_FAILED");
    expect(f.calls).toEqual(["page:0", "page:1", "context:0", "context:1", "browser", "scan:1", "attachment"]);
    expect(failure?.stack).not.toContain("synthetic-secret-marker"); expect(failure?.cause).toBeUndefined();
    expect(await reporterOutcome(f, failure)).toEqual({ result: { status: "failed" }, published: false });
  });
  it("a secondary attachment error cannot replace the original filtered stage diagnostic", async () => {
    const f = cookieFinishFixture();
    f.pages[0].close.mockRejectedValue(f.raw()); f.attach.mockRejectedValue(f.raw());
    const failure = await finishBrowserRun({ ...f.state, firstFailure: "COOKIE" });
    expect(failure?.message).toBe("M1D_COOKIE_FAILED; SECONDARY=M1D_PAGE_CLOSE_FAILED,M1D_ATTACHMENT_FAILED");
    expect(failure?.stack).not.toContain("synthetic-secret-marker"); expect(JSON.stringify(failure)).not.toContain("synthetic-secret-marker");
    expect(await reporterOutcome(f, failure)).toEqual({ result: { status: "failed" }, published: false });
  });
  it("times out a stuck page close and still closes contexts and browser without hiding late errors", async () => {
    vi.useFakeTimers();
    const f = cookieFinishFixture(); let rejectLate!: (error: Error) => void;
    f.pages[0].close.mockImplementation(() => new Promise<void>((_resolve, reject) => { rejectLate = reject; }));
    const operation = finishBrowserRun(f.state);
    await vi.advanceTimersByTimeAsync(FINALIZATION_STEP_MS);
    const failure = await operation;
    expect(failure?.message).toBe("M1D_PAGE_CLOSE_TIMEOUT");
    expect(f.contexts.every(c => c.close.mock.calls.length === 1)).toBe(true); expect(f.browser.close).toHaveBeenCalledOnce();
    rejectLate(f.raw()); await Promise.resolve();
    expect(vi.getTimerCount()).toBe(0);
    expect(await reporterOutcome(f, failure)).toEqual({ result: { status: "failed" }, published: false });
  });
  it("does not invent resources when launch failed", async () => {
    const attach = vi.fn();
    const failure = await finishBrowserRun({ contexts: [], observers: [], firstFailure: "LAUNCH", attach });
    expect(failure?.message).toBe("M1D_LAUNCH_FAILED; SECONDARY=M1D_OBSERVATIONS_INCOMPLETE"); expect(attach).not.toHaveBeenCalled();
  });
  it("permits publication only after complete successful finalization and runner result", async () => {
    const f = cookieFinishFixture(); const failure = await finishBrowserRun(f.state);
    expect(failure).toBeUndefined(); expect(f.calls.at(-1)).toBe("attachment");
    expect(await reporterOutcome(f, failure)).toEqual({ result: { status: "passed" }, published: true });
  });
  it("keeps the default context connected until owned native closure and profile cleanup finish", async () => {
    const f = cookieFinishFixture(); let clean = false;
    const owner: NativeBrowserOwner = { browser: f.state.browser, context: f.state.contexts[0], connect: async () => f.state.browser,
      get closedCleanly() { return clean; }, close: vi.fn(async () => {
        f.calls.push("native-close"); f.contexts[0].closed = true; await f.browser.close(); clean = true;
      }) };
    const failure = await finishBrowserRun({ ...f.state, nativeOwner: owner });
    expect(failure).toBeUndefined(); expect(f.contexts[0].close).not.toHaveBeenCalled();
    expect(f.contexts[1].close).toHaveBeenCalledOnce(); expect(owner.close).toHaveBeenCalledOnce();
    expect(f.calls.indexOf("context:1")).toBeLessThan(f.calls.indexOf("native-close"));
    expect(f.calls.indexOf("native-close")).toBeLessThan(f.calls.indexOf("attachment"));
    expect(await reporterOutcome(f, failure)).toEqual({ result: { status: "passed" }, published: true });
  });
  it.each(["live-child", "nonzero-exit", "profile-cleanup"])("refuses disconnection without successful owned closure: %s", async fault => {
    const f = cookieFinishFixture();
    const owner: NativeBrowserOwner = { browser: f.state.browser, context: f.state.contexts[0], connect: async () => f.state.browser,
      closedCleanly: false, close: async () => { f.contexts[0].closed = true; await f.browser.close(); if (fault !== "live-child") throw f.raw(); } };
    const failure = await finishBrowserRun({ ...f.state, nativeOwner: owner });
    expect(failure?.message).toContain(fault === "live-child" ? "M1D_BROWSER_CLOSE_INCOMPLETE" : "M1D_BROWSER_CLOSE_FAILED");
    expect(failure?.message).not.toContain("synthetic-secret-marker");
    expect(f.contexts[1].close).toHaveBeenCalledOnce(); expect(f.observers.every(o => o.scan.mock.calls.length === 1)).toBe(true);
    expect(await reporterOutcome(f, failure)).toEqual({ result: { status: "failed" }, published: false });
  });
  it("bounds a stuck owned close without claiming process exit or publishing a receipt", async () => {
    vi.useFakeTimers(); const f = cookieFinishFixture();
    const owner: NativeBrowserOwner = { browser: f.state.browser, context: f.state.contexts[0], connect: async () => f.state.browser,
      closedCleanly: false, close: () => new Promise<void>(() => {}) };
    const pending = finishBrowserRun({ ...f.state, nativeOwner: owner });
    await vi.advanceTimersByTimeAsync(FINALIZATION_STEP_MS); const failure = await pending;
    expect(failure?.message).toContain("M1D_BROWSER_CLOSE_TIMEOUT");
    expect(f.contexts[0].close).not.toHaveBeenCalled(); expect(f.contexts[1].close).toHaveBeenCalledOnce();
    expect(await reporterOutcome(f, failure)).toEqual({ result: { status: "failed" }, published: false });
  });
});
type CookieSelectionFault = "none" | "absent" | "wrong-name" | "localhost" | "dotted-host" | "foreign-host" | "wrong-path"
  | "duplicate" | "duplicate-invalid" | "mixed-first" | "mixed-last" | "attributes" | "http-only" | "same-site";
type CookieFault = CookieSelectionFault | "masked" | "cookie-read" | "http" | "http-body" | "no-response" | "body" | "ui" | "continuity" | "rotation"
  | "login" | "authenticated" | "me" | "me-body" | "role" | "privacy" | "login-delayed" | "me-delayed" | "login-prior-failure"
  | "business-header" | "session-header" | "authorization-header" | "privacy-auth" | "http-final-privacy"
  | `${"continuity" | "rotation"}-${"attributes" | "http-only" | "same-site"}`;
type StoredCookie = Awaited<ReturnType<BrowserContext["cookies"]>>[number];
function storedCookies(fault: CookieFault, value = "synthetic-secret-marker-sid"): StoredCookie[] {
  const valid: StoredCookie = { name: "__Host-ritomer-session", secure: true, httpOnly: true, sameSite: "Lax", path: "/", domain: "127.0.0.1", expires: -1, value };
  switch (fault) {
    case "absent": return [];
    case "wrong-name": return [{ ...valid, name: "other-session" }];
    case "localhost": return [{ ...valid, domain: "localhost" }];
    case "dotted-host": return [{ ...valid, domain: ".127.0.0.1" }];
    case "foreign-host": return [{ ...valid, domain: "other.invalid" }];
    case "wrong-path": return [{ ...valid, path: "/api" }];
    case "duplicate": return [valid, { ...valid }];
    case "duplicate-invalid": return [valid, { ...valid, secure: false }];
    case "attributes": return [{ ...valid, secure: false }];
    case "http-only": return [{ ...valid, httpOnly: false }];
    case "same-site": return [{ ...valid, sameSite: "None" }];
    case "mixed-first": case "mixed-last": {
      const others = [{ ...valid, name: "other-session" }, { ...valid, domain: "other.invalid" }, { ...valid, path: "/api" }];
      return fault === "mixed-first" ? [valid, ...others] : [...others, valid];
    }
    default: return [valid];
  }
}
const rejectedCookieSelections = [
  ["absent", "COOKIE_ABSENT", 0, null], ["wrong-name", "COOKIE_ABSENT", 0, null],
  ["localhost", "COOKIE_ABSENT", 0, null], ["dotted-host", "COOKIE_ABSENT", 0, null],
  ["foreign-host", "COOKIE_ABSENT", 0, null], ["wrong-path", "COOKIE_ABSENT", 0, null],
  ["duplicate", "COOKIE_COUNT", 2, null], ["duplicate-invalid", "COOKIE_COUNT", 2, null],
  ["attributes", "COMPARISON", 1, 29], ["http-only", "COMPARISON", 1, 27], ["same-site", "COMPARISON", 1, 15]
] as const;
async function expectCookieRejection(operation: () => Promise<unknown>) {
  let outcome: "EXPECTED_REJECTION" | "UNEXPECTED_REJECTION" | "UNEXPECTED_RESOLUTION" = "UNEXPECTED_RESOLUTION";
  try {
    await operation(); // Discard any resolved cookie before the matcher sees it.
  } catch (error) {
    outcome = "UNEXPECTED_REJECTION";
    try {
      if (error instanceof Error && error.message === "M1D_ASSERTION_FAILED") outcome = "EXPECTED_REJECTION";
    } catch {
      outcome = "UNEXPECTED_REJECTION"; // Even a throwing message getter stays closed.
    }
  }
  expect(outcome).toBe("EXPECTED_REJECTION");
}
type CookieReporterMutation = (test: TestCase, result: TestResult, reporter: Reporter) => void;
async function cookieReporterOutcome(attachment: Buffer | undefined, failure: Error | undefined, mutate?: CookieReporterMutation) {
  const previousExitCode = process.exitCode;
  process.exitCode = undefined;
  try {
    const lines: string[] = []; let publications = 0;
    const reporter = new Reporter(binding("cookie"), () => { publications++; }, line => { lines.push(line); });
    const tc = { title: "m1d-cookie", expectedStatus: "passed" } as TestCase;
    const result = { status: failure ? "failed" : "passed", retry: 0, errors: failure ? [failure] : [],
      attachments: attachment ? [{ name: "m1d-observations", contentType: "application/json", body: attachment }] : [] } as unknown as TestResult;
    reporter.onBegin({} as FullConfig, { allTests: () => [tc] } as Suite);
    mutate?.(tc, result, reporter);
    reporter.onTestEnd(tc, result);
    const outcome = await reporter.onEnd({ status: failure ? "failed" : "passed" } as FullResult);
    return { outcome, lines, publications, published: publications !== 0, exitCode: process.exitCode,
      diagnostic: lines.length ? JSON.parse(lines[0].slice("M1D_COOKIE_DIAGNOSTIC ".length)).diagnostic as CookieDiagnostic : undefined };
  } finally { process.exitCode = previousExitCode; }
}
async function cookieScenario(fault: CookieFault, foreignFirst = false, closeFails = false, mutate?: CookieReporterMutation) {
  const handlers = new Map<string, Array<(value: never) => void>>();
  const waits: Array<{ match: (r: Response) => boolean; resolve: (r: Response) => void; reject: (e: Error) => void }> = [];
  const failures = new BrowserFailures(), e = fixture("cookie"); e.observations = []; e.windows = [];
  const delayedLogin = fault === "login-delayed" || fault === "login-prior-failure";
  const delayed = delayedLogin || fault === "me-delayed";
  let responseSeen!: () => void, releaseClick!: () => void, releaseBody!: () => void;
  const received = new Promise<void>(resolve => { responseSeen = resolve; });
  const clickGate = new Promise<void>(resolve => { releaseClick = resolve; });
  const bodyGate = new Promise<void>(resolve => { releaseBody = resolve; });
  const jsonReads: string[] = [];
  const cookieArgumentCounts: number[] = [];
  let atReceipt: { diagnostic?: CookieDiagnostic; lastCompleted: CookieDiagnostic["lastCompleted"] } | undefined;
  let visits = 0, authenticated = false, closed = false, connected = true;
  const raw = () => new Error("synthetic-secret-marker");
  const emit = (event: string, value: unknown) => handlers.get(event)?.forEach(handler => handler(value as never));
  const state = (auth: boolean) => ({ sessionState: auth ? "AUTHENTICATED" : "ANONYMOUS", localLoginAvailable: true,
    csrf: { headerName: "X-CSRF-TOKEN", token: "synthetic-secret-marker-csrf" }, ...(auth ? {} : { actors: [{ actorKey: "actor-01", displayLabel: "Synthetic actor" }] }) });
  const response = (pathname: string, method: string, status: number, body: unknown, foreign = false) => {
    const url = (foreign ? "http://other.invalid" : "http://127.0.0.1:5173") + pathname;
    const request = { url: () => url, method: () => method, headers: () =>
      pathname === "/api/closing-folders" ? { "x-tenant-id": "synthetic-secret-marker-tenant" }
        : authenticated && pathname === "/api/session/bootstrap" && fault === "session-header" ? { "x-tenant-id": "synthetic-secret-marker-tenant" }
          : authenticated && pathname === "/api/session/bootstrap" && fault === "authorization-header" ? { authorization: "synthetic-secret-marker" } : {} } as unknown as Request;
    const r = { url: () => url, request: () => request, status: () => status,
      headersArray: async () => pathname === "/api/session/bootstrap" && visits === 1 ? [{ name: "set-cookie", value: "__Host-ritomer-session=synthetic-secret-marker-sid; Secure; HttpOnly; Path=/; SameSite=Lax" }] : [],
      json: async () => {
        jsonReads.push(pathname);
        if ((delayedLogin && pathname === "/api/session/local") || (fault === "me-delayed" && pathname === "/api/me")) await bodyGate;
        if (status === 204 || (["body", "http-body"].includes(fault) && !authenticated) || (fault === "me-body" && pathname === "/api/me")) throw raw();
        return body;
      }
    } as unknown as Response;
    emit("request", request); emit("response", r);
    for (const waiter of [...waits]) if (waiter.match(r)) { waits.splice(waits.indexOf(waiter), 1); waiter.resolve(r); }
  };
  const page = {
    url: () => "http://127.0.0.1:5173/",
    waitForResponse: (match: (r: Response) => boolean) => new Promise<Response>((resolve, reject) => { waits.push({ match, resolve, reject }); }),
    goto: async () => { visits++; if (foreignFirst) { response("/api/session/bootstrap", "GET", 418, {}, true); response("/api/session/bootstrap", "POST", 418, {}); }
      if (fault === "no-response") { for (const w of waits.splice(0)) w.reject(raw()); return; }
      response("/api/session/bootstrap", "GET", ["http", "http-body", "http-final-privacy"].includes(fault) ? 503 : 200, state(false)); },
    getByRole: (_role: string, options: { name: string }) => ({
      waitFor: async () => { if (fault === "ui" && options.name === "Se connecter") throw raw(); },
      click: async () => {
        if (fault === "login-prior-failure") {
          // A real already-registered response wait fails before the HTTP refusal.
          waits.pop()!.reject(raw()); await Promise.resolve();
        }
        response("/api/session/local", "POST", fault === "login" || delayedLogin ? 403 : 204, { code: "CSRF_REJECTED" });
        if (delayedLogin) { responseSeen(); await clickGate; return; }
        if (fault === "login") return;
        authenticated = true;
        response("/api/session/bootstrap", "GET", 200, state(fault !== "authenticated"));
        response("/api/me", "GET", fault === "me" || fault === "me-delayed" ? 403 : 200, fault === "me" || fault === "me-delayed" ? { code: "synthetic-secret-marker" } : {
          actor: { userId: "synthetic-secret-marker-user", externalSubject: "synthetic-secret-marker-subject" },
          memberships: ["business-header", "privacy-auth"].includes(fault) ? [{ tenantId: "synthetic-secret-marker-tenant" }] : [], activeTenant: null,
          effectiveRoles: [fault === "role" ? "REVIEWER" : "ACCOUNTANT"] });
        if (fault === "business-header" || fault === "privacy-auth") response("/api/closing-folders", "GET", 200, {});
        if (fault === "me-delayed") { responseSeen(); await clickGate; }
      }
    }),
    waitForURL: async () => {},
    evaluate: async (fn: unknown) => fn === capturePageSnapshot ? (fault === "privacy" ? "synthetic-secret-marker-csrf"
      : fault === "privacy-auth" && authenticated ? JSON.stringify({ local: { item: "synthetic-secret-marker-tenant" } }) : "{}") : true,
    close: async () => {
      if (closeFails) throw raw(); closed = true;
      if (fault === "http-final-privacy") {
        // Boundary stimulus while the real finalizer closes the page: a direct
        // request violation, then a different match in its later final scan.
        emit("request", { url: () => "http://127.0.0.1:5173/api/closing-folders", method: () => "GET", headers: () => ({ authorization: "synthetic-secret-marker" }) });
        observer.sample("synthetic-secret-marker-sid", "CONSOLE");
      }
    }, isClosed: () => closed
  } as unknown as Page;
  const context = {
    on: (event: string, callback: (value: never) => void) => { handlers.set(event, [...(handlers.get(event) ?? []), callback]); },
    pages: () => closed ? [] : [page], close: async () => { closed = true; },
    cookies: async (...urls: unknown[]) => {
      cookieArgumentCounts.push(urls.length);
      if (fault === "cookie-read") throw raw();
      if (fault === "masked" && urls.length > 0) return [];
      const later = /^(continuity|rotation)-(attributes|http-only|same-site)$/.exec(fault);
      const selection = later ? ((later[1] === "rotation" ? authenticated : visits > 1 && !authenticated) ? later[2] as CookieSelectionFault : "none") : fault;
      return storedCookies(selection, authenticated && fault !== "rotation" ? "synthetic-secret-marker-rotated"
        : visits > 1 && fault === "continuity" ? "synthetic-secret-marker-other" : "synthetic-secret-marker-sid");
    }
  } as unknown as BrowserContext;
  const observer = new Observer(context, failures);
  // A response from a request predating this action must not satisfy its wait.
  const stale = { url: () => "http://127.0.0.1:5173/api/session/bootstrap", method: () => "GET", headers: () => ({}) } as unknown as Request;
  emit("request", stale);
  const originalGoto = page.goto;
  page.goto = (async (...args: Parameters<Page["goto"]>) => {
    if (foreignFirst) { const old = { url: stale.url, request: () => stale, status: () => 418 } as unknown as Response;
      for (const waiter of [...waits]) if (waiter.match(old)) { waits.splice(waits.indexOf(waiter), 1); waiter.resolve(old); } }
    return originalGoto(...args);
  }) as Page["goto"];
  const proof = proofCookie(page, observer, e).catch(() => { failures.note("COOKIE"); });
  if (delayed) {
    await received;
    atReceipt = { diagnostic: failures.cookieDiagnostic, lastCompleted: failures.lastCookieControl };
    // Expire secondary waits while the body and click are still withheld.
    // Reject handlers are already installed by the real scenario.
    for (const waiter of waits.splice(0)) waiter.reject(raw());
    await Promise.resolve();
    releaseBody(); releaseClick();
  }
  await proof;
  for (const waiter of waits.splice(0)) waiter.reject(raw());
  let attachment: Buffer | undefined;
  const beforeFinalization = failures.cookieDiagnostic;
  const browser = { contexts: () => closed ? [] : [context], close: async () => { connected = false; }, isConnected: () => connected } as unknown as Browser;
  const failure = await finishBrowserRun({ browser, contexts: [context], observers: [observer], evidence: e, binding: binding("cookie"), failures,
    attach: async body => { attachment = body; } });
  const reported = await cookieReporterOutcome(attachment, failure, mutate);
  process.exitCode = reported.exitCode; // Preserve the existing scenario assertions; isolated replays use the helper directly.
  return { ...reported, attachment, failure, failures, atReceipt, jsonReads, cookieArgumentCounts, beforeFinalization };
}

function attachmentReads() { return { observationBody: 0, observationPath: 0, extraBody: 0, extraPath: 0 }; }
function observedCookieAttachment(body: Buffer, reads: ReturnType<typeof attachmentReads>): TestResult["attachments"][number] {
  return { name: "m1d-observations", contentType: "application/json",
    get body() { reads.observationBody++; return body; }, get path(): string { reads.observationPath++; throw new Error("unexpected observation path read"); } };
}
function unreadExtraAttachment(name: string, reads: ReturnType<typeof attachmentReads>): TestResult["attachments"][number] {
  return { name, contentType: "text/markdown",
    get body(): Buffer { reads.extraBody++; throw new Error("unexpected extra body read"); },
    get path(): string { reads.extraPath++; throw new Error("unexpected extra path read"); } };
}
function expectNoExtraReads(reads: ReturnType<typeof attachmentReads>) {
  expect(reads.observationPath).toBe(0); expect(reads.extraBody).toBe(0); expect(reads.extraPath).toBe(0);
}
describe("cookie diagnostics on the real scenario and reporter path", () => {
  it.each(rejectedCookieSelections)("rejects stored selection %s through the scenario and reporter", async (fault, reason, count, mask) => {
    const r = await cookieScenario(fault);
    expect(r.outcome.status).toBe("failed"); expect(r.publications).toBe(0); expect(r.exitCode).toBe(1);
    expect(r.diagnostic).toMatchObject({ source: "BROWSER", step: "COOKIE_ACCEPTANCE", reason, metric: null, lastCompleted: "COOKIE_EMISSION",
      facts: { acceptedCount: count, acceptedMask: mask, continuity: null, loginStatus: null, rotation: null } });
    expect(r.cookieArgumentCounts).toEqual([0]); expect(r.lines).toHaveLength(1);
    expect(Buffer.byteLength(r.lines[0])).toBeLessThanOrEqual(8192);
    expect(r.lines[0]).not.toContain("synthetic-secret-marker"); expect(r.attachment?.toString()).not.toContain("synthetic-secret-marker");
  });
  it.each(["mixed-first", "mixed-last"] as const)("retains the exact tuple among unrelated stored cookies: %s", async fault => {
    const r = await cookieScenario(fault);
    expect(r.outcome.status).toBe("passed"); expect(r.publications).toBe(1); expect(r.lines).toEqual([]);
    expect(r.failures.cookieFacts).toMatchObject({ acceptedCount: 1, acceptedMask: 31, continuity: true, rotation: true });
    expect(r.cookieArgumentCounts).toEqual([0, 0, 0]); expect(r.attachment?.toString()).not.toContain("synthetic-secret-marker");
  });
  it.each(["continuity-attributes", "continuity-http-only", "continuity-same-site", "rotation-attributes", "rotation-http-only", "rotation-same-site"] as const)(
    "refuses attributes changed only at %s without replacing initial facts", async fault => {
      const r = await cookieScenario(fault), rotation = fault.startsWith("rotation-");
      expect(r.outcome.status).toBe("failed"); expect(r.publications).toBe(0); expect(r.exitCode).toBe(1);
      expect(r.diagnostic).toMatchObject({ source: "BROWSER", step: rotation ? "ROTATION" : "CONTINUITY", reason: "COMPARISON", metric: null,
        lastCompleted: rotation ? "AUTHENTICATED_BODY" : "OBSERVER",
        facts: { acceptedCount: 1, acceptedMask: 31, continuity: rotation ? true : null, rotation: null, loginStatus: rotation ? 204 : null } });
      expect(r.cookieArgumentCounts).toEqual(rotation ? [0, 0, 0] : [0, 0]);
      expect(r.lines).toHaveLength(1); expect(r.lines[0]).not.toContain("synthetic-secret-marker");
      expect(r.attachment?.toString()).not.toContain("synthetic-secret-marker");
    });
  it("keeps a cookie read error closed without inventing counts", async () => {
    const r = await cookieScenario("cookie-read");
    expect(r.diagnostic).toMatchObject({ source: "BROWSER", step: "COOKIE_ACCEPTANCE", reason: "OPERATION_FAILED", metric: null,
      facts: { acceptedCount: null, acceptedMask: null } });
    expect(r.outcome.status).toBe("failed"); expect(r.publications).toBe(0); expect(r.exitCode).toBe(1);
    expect(r.lines[0]).not.toContain("synthetic-secret-marker"); expect(r.attachment?.toString()).not.toContain("synthetic-secret-marker");
  });
  it.each(rejectedCookieSelections)("enforces the real helper without BrowserFailures: %s", async fault => {
    const cookies = vi.fn(async () => storedCookies(fault));
    await expectCookieRejection(() => cookie({ cookies } as unknown as BrowserContext));
    expect(cookies.mock.calls).toEqual([[]]);
  });
  it("accepts only the exact expected rejection through the shared assertion", async () => {
    await expectCookieRejection(async () => { throw new Error("M1D_ASSERTION_FAILED"); });
  });
  it.each([
    ["resolution", "UNEXPECTED_RESOLUTION"],
    ["rejection", "UNEXPECTED_REJECTION"],
    ["message-read", "UNEXPECTED_REJECTION"]
  ] as const)("keeps the shared rejection assertion failing with closed diagnostics: %s", async (fault, state) => {
    const operation = async () => {
      if (fault === "resolution") return storedCookies("attributes")[0];
      if (fault === "message-read") throw Object.defineProperty(new Error(), "message", {
        get() { throw new Error("synthetic-secret-marker"); }
      });
      throw new Error("M1D_ASSERTION_FAILED: synthetic-secret-marker");
    };
    let assertionRaised = false, expectedDiagnostic = false, diagnosticsSafe = false;
    try {
      await expectCookieRejection(operation);
    } catch (error) {
      try {
        assertionRaised = error instanceof Error && error.name === "AssertionError";
        const diagnostic = error as Error & Record<string, unknown>;
        expectedDiagnostic = diagnostic.actual === state && diagnostic.expected === "EXPECTED_REJECTION";
        const differences = Object.fromEntries(Object.getOwnPropertyNames(diagnostic)
          .filter(key => /diff/i.test(key)).map(key => [key, diagnostic[key]]));
        const serialized = JSON.stringify({ message: diagnostic.message, actual: diagnostic.actual, expected: diagnostic.expected, ...differences });
        diagnosticsSafe = !serialized.includes("synthetic-secret-marker");
      } catch {
        diagnosticsSafe = false;
      }
    }
    expect(assertionRaised).toBe(true); expect(expectedDiagnostic).toBe(true); expect(diagnosticsSafe).toBe(true);
  });
  it.each(["none", "mixed-first", "mixed-last"] as const)("returns the exact stored object without BrowserFailures: %s", async fault => {
    const stored = storedCookies(fault), expected = fault === "mixed-last" ? stored.at(-1) : stored[0];
    const cookies = vi.fn(async (...urls: unknown[]) => urls.length ? [] : stored);
    // Compare identity as a boolean: failed assertions must not print cookie operands.
    expect(await cookie({ cookies } as unknown as BrowserContext) === expected).toBe(true);
    expect(cookies.mock.calls).toEqual([[]]);
  });
  it("finds the stored cookie when URL selection is empty", async () => {
    const r = await cookieScenario("masked");
    expect(r.diagnostic).toBeUndefined();
    expect(r.outcome.status).toBe("passed"); expect(r.publications).toBe(1);
    expect(r.cookieArgumentCounts).toEqual([0, 0, 0]);
    const observed = decode(r.attachment!, binding("cookie"));
    expect(observed.observations.find(o => o.event === "acceptedCookie")?.value).toBe(31);
    expect(Object.keys(reduce(observed))).toHaveLength(5);
    expect(r.lines).toEqual([]); expect(r.attachment?.toString()).not.toContain("synthetic-secret-marker");
  });
  it.each(["error-context", "unknown-attachment"])("retains the same filtered cookie failure with an extra attachment: %s", async extraName => {
    const previousExitCode = process.exitCode;
    // Only the observation clock is fixed: all producer, decoder and reporter functions remain real.
    const clock = vi.spyOn(performance, "now").mockReturnValue(1000);
    const observations: Array<Record<string, unknown>> = [];
    try {
      const aReads = attachmentReads();
      const a = await cookieScenario("ui", false, false, (_tc, r) => { r.attachments = [observedCookieAttachment(r.attachments[0].body!, aReads)]; });
      const body = a.attachment!, expected = decode(body, binding("cookie")).cookieDiagnostic;
      expect(expected).toMatchObject({ source: "BROWSER", step: "ANONYMOUS_UI", reason: "UI_NOT_REACHED" });
      expect(body.toString()).not.toContain("synthetic-secret-marker");
      expect(a.diagnostic).toEqual(expected); expect(aReads.observationBody).toBeGreaterThan(0);
      const recordOutcome = (variant: string, r: Awaited<ReturnType<typeof cookieReporterOutcome>>, reads: ReturnType<typeof attachmentReads>) => {
        expect(r.outcome.status).toBe("failed"); expect(r.exitCode).toBe(1); expect(r.publications).toBe(0);
        expect(r.lines).toHaveLength(1); expect(Buffer.byteLength(r.lines[0])).toBeLessThanOrEqual(8192);
        expectNoExtraReads(reads);
        observations.push({ variant, diagnostic: r.diagnostic, status: r.outcome.status, exitCode: r.exitCode, publications: r.publications, reads });
      };
      recordOutcome("A", a, aReads);
      for (const variant of ["B1", "B2"]) {
        const reads = attachmentReads(), pieces = [observedCookieAttachment(body, reads), unreadExtraAttachment(extraName, reads)];
        const r = await cookieReporterOutcome(body, a.failure, (_tc, result) => { result.attachments = variant === "B1" ? pieces : [...pieces].reverse(); });
        expect(r.diagnostic).toEqual(expected);
        expect(reads.observationBody).toBeGreaterThan(0);
        recordOutcome(variant, r, reads);
      }
      process.stdout.write("M1D_REPORTER_REPRODUCTION " + JSON.stringify({ extraName, inputSha256: createHash("sha256").update(body).digest("hex"), inputBase64: body.toString("base64"), observations }) + "\n");
    } finally { clock.mockRestore(); process.exitCode = previousExitCode; }
  });
  it.each(["observation-absent", "diagnostic-absent", "duplicate", "duplicate-one-invalid", "body-absent", "path-only", "non-buffer", "oversized",
    "mime", "json", "diagnostic", "runId", "objectSha", "runtimeSha", "frontendSha", "kind", "passed", "skipped", "timedOut", "retry", "title", "expectedStatus", "count", "body-throws", "selection-throws"])(
    "refuses ambiguous or invalid cookie diagnostic attachments: %s", async mode => {
      const previousExitCode = process.exitCode;
      try {
        const scenario = await cookieScenario("ui"), reads = attachmentReads();
        let body = scenario.attachment!;
        if (["diagnostic-absent", "diagnostic", "runId", "objectSha", "runtimeSha", "frontendSha", "kind"].includes(mode)) {
          const value = JSON.parse(body.toString());
          if (mode === "diagnostic-absent") delete value.cookieDiagnostic;
          else if (mode === "diagnostic") value.cookieDiagnostic.extra = "synthetic-secret-marker";
          else value[mode] = mode === "kind" ? "browser" : "f".repeat(mode === "runId" ? 32 : 64);
          body = Buffer.from(JSON.stringify(value));
        }
        if (mode === "json") body = Buffer.from("not-json synthetic-secret-marker");
        if (mode === "oversized") body = Buffer.alloc(32769);
        if (mode === "non-buffer") body = "synthetic-secret-marker" as unknown as Buffer;
        const r = await cookieReporterOutcome(body, scenario.failure, (tc, result, reporter) => {
          let observation = observedCookieAttachment(body, reads);
          if (mode === "mime") observation.contentType = "text/plain";
          if (mode === "body-absent" || mode === "path-only") observation = { name: "m1d-observations", contentType: "application/json",
            get path(): string { reads.observationPath++; throw new Error("unexpected observation path read"); } };
          if (mode === "body-throws") observation = { name: "m1d-observations", contentType: "application/json", get body(): Buffer { throw new Error("synthetic-secret-marker"); } };
          const extra = unreadExtraAttachment("unknown-attachment", reads);
          result.attachments = mode === "observation-absent" ? [extra] : [extra, observation];
          if (mode.startsWith("duplicate")) result.attachments.push(mode === "duplicate" ? observedCookieAttachment(body, reads)
            : { name: "m1d-observations", contentType: "text/plain", get body(): Buffer { reads.extraBody++; throw new Error("synthetic-secret-marker"); } });
          if (mode === "selection-throws") result.attachments.push({ get name(): string { throw new Error("synthetic-secret-marker"); }, contentType: "text/plain" });
          if (["passed", "skipped", "timedOut"].includes(mode)) result.status = mode as TestResult["status"];
          if (mode === "retry") result.retry = 1;
          if (mode === "title") tc.title = "m1d-browser";
          if (mode === "expectedStatus") tc.expectedStatus = "failed";
          if (mode === "count") reporter.onTestEnd(tc, { ...result, attachments: [] });
        });
        expect(r.outcome.status).toBe("failed"); expect(r.exitCode).toBe(1); expect(r.publications).toBe(0);
        expect(r.lines).toHaveLength(1); expect(r.lines.join("")).not.toContain("synthetic-secret-marker");
        expect(r.diagnostic).toEqual({ schemaVersion: 2, source: "REPORTER", step: "REPORTER", lastCompleted: null, reason: "UNAVAILABLE", metric: null, facts: emptyCookieFacts(), firstPrivacyViolation: null });
        expectNoExtraReads(reads);
        if (mode.startsWith("duplicate") || ["passed", "skipped", "timedOut", "retry", "title", "expectedStatus", "count", "mime"].includes(mode)) expect(reads.observationBody).toBe(0);
      } finally { process.exitCode = previousExitCode; }
    });
  it.each(["none", "error-context-first", "error-context-last", "unknown-attachment"])("keeps extra attachments fatal to nominal publication: %s", async mode => {
    const previousExitCode = process.exitCode;
    try {
      const scenario = await cookieScenario("none"), reads = attachmentReads();
      const r = await cookieReporterOutcome(scenario.attachment, undefined, (_tc, result) => {
        const observation = observedCookieAttachment(scenario.attachment!, reads);
        const extra = unreadExtraAttachment(mode === "unknown-attachment" ? mode : "error-context", reads);
        result.attachments = mode === "none" ? [observation] : mode === "error-context-first" ? [extra, observation] : [observation, extra];
      });
      expectNoExtraReads(reads);
      expect(r.outcome.status).toBe(mode === "none" ? "passed" : "failed");
      expect(r.publications).toBe(mode === "none" ? 1 : 0); expect(r.exitCode).toBe(mode === "none" ? undefined : 1);
      expect(r.lines).toHaveLength(mode === "none" ? 0 : 1);
      if (mode !== "none") expect(reads.observationBody).toBe(0);
    } finally { process.exitCode = previousExitCode; }
  });
  it("keeps the first recovered diagnostic through a later callback and emits it once", async () => {
    const previousExitCode = process.exitCode;
    try {
      const first = await cookieScenario("ui"), later = await cookieScenario("http"), reads = attachmentReads();
      const r = await cookieReporterOutcome(later.attachment, later.failure, (tc, result, reporter) => {
        reporter.onTestEnd(tc, { ...result, attachments: [unreadExtraAttachment("error-context", reads), observedCookieAttachment(first.attachment!, reads)] });
        result.attachments = [unreadExtraAttachment("unknown-attachment", reads), observedCookieAttachment(later.attachment!, reads)];
      });
      expect(r.diagnostic).toEqual(first.diagnostic); expect(r.diagnostic).not.toEqual(later.diagnostic);
      expect(r.outcome.status).toBe("failed"); expect(r.exitCode).toBe(1); expect(r.publications).toBe(0); expect(r.lines).toHaveLength(1);
      expectNoExtraReads(reads);
    } finally { process.exitCode = previousExitCode; }
  });
  it.each(["login-delayed", "me-delayed"] as const)("F1 records HTTP before a deferred body and secondary expiry: %s", async fault => {
    const r = await cookieScenario(fault), step = fault === "login-delayed" ? "LOGIN_RESPONSE" : "ME_RESPONSE";
    const facts = fault === "login-delayed" ? { loginStatus: 403, loginCode: null } : { meStatus: 403, meCode: null };
    expect(r.diagnostic).toMatchObject({ source: "BROWSER", step, reason: "HTTP_STATUS", facts });
    expect(r.atReceipt?.diagnostic).toMatchObject({ source: "BROWSER", step, reason: "HTTP_STATUS", facts });
    expect(r.atReceipt?.lastCompleted).not.toBe(step);
    expect(r.diagnostic).toEqual(r.atReceipt?.diagnostic);
    expect(r.jsonReads).not.toContain(fault === "login-delayed" ? "/api/session/local" : "/api/me");
    expect(r.outcome.status).toBe("failed"); expect(r.published).toBe(false); expect(process.exitCode).toBe(1);
  });
  it.each([403, 204])("F1 observing login %s does not complete an HTTP control via JSON or receipt alone", async status => {
    const handlers = new Map<string, (value: never) => void>(), failures = new BrowserFailures();
    const context = { on: (event: string, handler: (value: never) => void) => { handlers.set(event, handler); } } as unknown as BrowserContext;
    const observer = new Observer(context, failures); observer.cookiePhase = "login";
    const request = { url: () => "http://127.0.0.1:5173/api/session/local", method: () => "POST", headers: () => ({}) } as unknown as Request;
    const json = vi.fn(async () => ({ code: "CSRF_REJECTED" }));
    handlers.get("request")!(request as never);
    handlers.get("response")!({ url: request.url, request: () => request, status: () => status, headersArray: async () => [], json } as never);
    await observer.flush();
    expect(failures.lastCookieControl).toBeNull(); expect(json).not.toHaveBeenCalled();
    if (status === 403) {
      expect(failures.cookieDiagnostic).toMatchObject({ step: "LOGIN_RESPONSE", reason: "HTTP_STATUS", lastCompleted: null, facts: { loginStatus: 403, loginCode: null } });
      expect(failures.diagnostics).toContain("M1D_OBSERVER_FAILED");
    }
    else expect(failures.cookieDiagnostic).toBeUndefined();
  });
  it("F1 preserves a response-wait failure established before the login refusal", async () => {
    const r = await cookieScenario("login-prior-failure");
    expect(r.diagnostic).toMatchObject({ step: "ME_RESPONSE", reason: "NO_RESPONSE", facts: { loginStatus: null } });
    expect(r.diagnostic).toEqual(r.atReceipt?.diagnostic); expect(r.outcome.status).toBe("failed"); expect(r.published).toBe(false);
  });
  it.skipIf(process.platform !== "win32")("carries a real scenario failure through the reporter, native rail drain and terminal readback", async () => {
    const scenario = await cookieScenario("http-final-privacy");
    expect(scenario.outcome.status).toBe("failed"); expect(scenario.published).toBe(false);
    expect(scenario.diagnostic).toMatchObject({ schemaVersion: 2, step: "BOOTSTRAP_RESPONSE", reason: "HTTP_STATUS", lastCompleted: null,
      facts: { bootstrapStatus: 503, privacyScans: null, privacyViolations: null, lostObservations: null },
      firstPrivacyViolation: { rule: "AUTHORIZATION_HEADER", surface: "REQUEST_HEADERS", valueCategory: "NONE" } });
    const line = scenario.lines[0], frame = JSON.parse(line.slice("M1D_COOKIE_DIAGNOSTIC ".length));
    const input: Array<{ name: string; stdout: string; stderr: string; role: string; rejected: boolean }> = [];
    const add = (name: string, stdout: string, stderr = "", role = "BROWSER_COOKIE", rejected = true) => input.push({ name, stdout, stderr, role, rejected });
    add("valid", line, "", "BROWSER_COOKIE", false);
    add("authenticated-privacy", (await cookieScenario("privacy-auth")).lines[0], "", "BROWSER_COOKIE", false);
    add("http", (await cookieScenario("login-delayed")).lines[0], "", "BROWSER_COOKIE", false);
    add("tenant-header", (await cookieScenario("session-header")).lines[0], "", "BROWSER_COOKIE", false);
    add("authorization-header", (await cookieScenario("authorization-header")).lines[0], "", "BROWSER_COOKIE", false);
    const legacyFrame = JSON.parse(JSON.stringify(frame)); legacyFrame.diagnostic.schemaVersion = 1; delete legacyFrame.diagnostic.firstPrivacyViolation;
    add("v1", "M1D_COOKIE_DIAGNOSTIC " + JSON.stringify(legacyFrame) + "\n", "", "BROWSER_COOKIE", false);
    add("reducer", (await cookieScenario("continuity")).lines[0], "", "BROWSER_COOKIE", false);
    add("owner", line, "", "BROWSER_JOURNEY"); add("channel", "", line); add("duplicate", line + line);
    add("owner-nul", line, "", "BROWSER_COOKIE\0");
    add("truncated", line.trimEnd()); add("oversize", line.trimEnd() + " ".repeat(8192) + "\n");
    add("oversize-cr", line.trimEnd() + "\r".repeat(8192) + "\n");
    add("duplicate-property", line.replace('"schemaVersion":1', '"schemaVersion":1,"schemaVersion":1'));
    const corrupt = (name: string, mutate: (v: typeof frame) => void) => {
      const v = JSON.parse(JSON.stringify(frame)); mutate(v); add(name, "M1D_COOKIE_DIAGNOSTIC " + JSON.stringify(v) + "\n");
    };
    for (const key of ["runId", "objectSha", "runtimeSha", "frontendSha"]) {
      corrupt(key, v => { v[key] = "a".repeat(key === "runId" ? 32 : 64); });
      for (const suffix of ["\0", "\n", " "]) corrupt(key + JSON.stringify(suffix), v => { v[key] += suffix; });
    }
    corrupt("property-nul", v => { v["runId\0"] = v.runId; delete v.runId; });
    corrupt("unknown", v => { v.diagnostic.extra = "synthetic-secret-marker"; });
    corrupt("missing", v => { delete v.diagnostic.facts.rotation; });
    corrupt("schema", v => { v.schemaVersion = "1"; });
    for (const suffix of ["\n", "\r\n", " ", "\0"]) corrupt("literal" + JSON.stringify(suffix), v => { v.diagnostic.step += suffix; });
    corrupt("case", v => { v.diagnostic.source = "browser"; });
    corrupt("coerced", v => { v.diagnostic.facts.continuity = 0; });
    corrupt("mask", v => { v.diagnostic.facts.acceptedMask = 32; });
    corrupt("count", v => { v.diagnostic.facts.privacyScans = 1_000_001; });
    corrupt("negative", v => { v.diagnostic.facts.acceptedCount = -1; });
    corrupt("fraction", v => { v.diagnostic.facts.acceptedCount = 1.5; });
    corrupt("status", v => { v.diagnostic.facts.bootstrapStatus = 600; });
    corrupt("status-string", v => { v.diagnostic.facts.bootstrapStatus = "503"; });
    corrupt("state", v => { v.diagnostic.facts.bootstrapState = "synthetic-secret-marker"; });
    corrupt("api-code", v => { v.diagnostic.facts.loginCode = "synthetic-secret-marker"; });
    corrupt("metric", v => { v.diagnostic.metric = "synthetic-secret-marker"; });
    corrupt("source-step", v => { v.diagnostic.step = "REDUCER"; });
    corrupt("v2-missing-triplet", v => { delete v.diagnostic.firstPrivacyViolation; });
    corrupt("v1-with-triplet", v => { v.diagnostic.schemaVersion = 1; });
    corrupt("unknown-version", v => { v.diagnostic.schemaVersion = 3; });
    for (const key of ["rule", "surface", "valueCategory"] as const) {
      corrupt("privacy-unknown-" + key, v => { v.diagnostic.firstPrivacyViolation[key] = "synthetic-secret-marker"; });
      for (const suffix of ["\n", "\0", " "]) corrupt("privacy-suffix-" + key + JSON.stringify(suffix), v => { v.diagnostic.firstPrivacyViolation[key] += suffix; });
    }
    corrupt("privacy-extra", v => { v.diagnostic.firstPrivacyViolation.extra = "synthetic-secret-marker"; });
    corrupt("privacy-combination", v => { v.diagnostic.firstPrivacyViolation.surface = "DOM"; });
    corrupt("privacy-absent-category", v => { v.diagnostic.firstPrivacyViolation = { rule: "PROTECTED_VALUE_MATCH", surface: "DOM", valueCategory: "NONE" }; });
    for (const firstPrivacyViolation of [
      { rule: "AUTHORIZATION_AND_TENANT_SESSION_HEADERS", surface: "REQUEST_HEADERS", valueCategory: "AMBIGUOUS" },
      { rule: "CHANNEL_SHAPE", surface: "CHANNEL", valueCategory: "NONE" },
      { rule: "PROTECTED_VALUE_MATCH", surface: "AMBIGUOUS", valueCategory: "AMBIGUOUS" }
    ]) {
      const v = JSON.parse(JSON.stringify(frame)); v.diagnostic.firstPrivacyViolation = firstPrivacyViolation;
      add("privacy-valid-" + firstPrivacyViolation.rule, "M1D_COOKIE_DIAGNOSTIC " + JSON.stringify(v) + "\n", "", "BROWSER_COOKIE", false);
    }
    const root = mkdtempSync(path.join(os.tmpdir(), "m1d-synthetic-evidence-")); roots.push(root);
    writeFileSync(path.join(root, "input.json"), JSON.stringify(input));
    // Same AST function extraction as the backend fixtures. Only definitions
    // are loaded; no operational initializer/dispatch, lock, job or DB access.
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
# External OS namespace only. Receipt serialization, hashes, validators and
# stream/control parsing below are the unmodified extracted functions.
function Get-M1DNamespaceIdentity { return 'OFFLINE_COOKIE_FIXTURE' }
§RunId='1'*32; §ReviewedObjectSha256='2'*64; §SensitiveAuthorizationRecordId='AUTH-OFFLINE-COOKIE-FIXTURE'
§script:DRuntimeSha256='3'*64; §script:DFrontendRuntimeSha256='4'*64
§script:DPhase='integration'; §script:DOperation='child-drain'
§script:DRunRoot=§Root
§cases=Get-Content -LiteralPath (Join-Path §Root 'input.json') -Raw | ConvertFrom-Json
§outcomes=@(); §valid=§null; §legacyDiagnostic=§null
foreach (§case in §cases) {
  §script:DFailures=[Collections.Generic.List[object]]::new(); §script:DCookieDiagnostic=§null; §script:DHarnessDiagnostic=§null
  §p=[pscustomobject]@{StandardOutput=[IO.StringReader]::new(§case.stdout);StandardError=[IO.StringReader]::new(§case.stderr)}
  try {
    §drain=New-M1DDrain §p §case.role §null
    for (§i=0; §i -lt 16 -and (-not §drain.OutEnded -or -not §drain.ErrEnded); §i++) { Update-M1DDrain §drain -Finalizing }
    if (-not §drain.OutEnded -or -not §drain.ErrEnded -or §drain.Signals.Count -ne 0) { throw 'FIXTURE_DRAIN_INCOMPLETE_OR_SUCCESS_SIGNAL' }
    §rejected=§drain.Failures.Count -gt 0
    if (§rejected -ne §case.rejected) { throw ('FIXTURE_PROTOCOL_' + §case.name) }
    if (§case.name -ceq 'valid') { §valid=§script:DCookieDiagnostic; if (§null -eq §valid) { throw 'FIXTURE_DETAIL_LOST' } }
    if (§case.name -ceq 'v1') { §legacyDiagnostic=§script:DCookieDiagnostic; if (§null -eq §legacyDiagnostic -or §legacyDiagnostic.diagnostic.PSObject.Properties.Name -ccontains 'firstPrivacyViolation') { throw 'FIXTURE_LEGACY_CATEGORY_INVENTED' } }
    §outcomes+=§case.name
  } finally { §p.StandardOutput.Dispose(); §p.StandardError.Dispose() }
}
§script:DFailures=[Collections.Generic.List[object]]::new()
[void](Write-M1DReceipt 'campaign' ([pscustomobject]@{runtimeSha256=§script:DRuntimeSha256;frontendRuntimeSha256=§script:DFrontendRuntimeSha256}))
[void](Write-M1DReceipt 'terminal' ([pscustomobject]@{campaignResult='FAIL';diagnostics=(Get-M1DDiagnostics);cookieDiagnostic=§valid}))
§terminal=Read-M1DReceipt 'terminal'
if (§terminal.payload.campaignResult -cne 'FAIL') { throw 'FIXTURE_FALSE_PASS' }
# Old terminals without the optional detail still use the real reader.
§legacyRoot=Join-Path §Root 'legacy'; [void][IO.Directory]::CreateDirectory(§legacyRoot); §script:DRunRoot=§legacyRoot
[void](Write-M1DReceipt 'terminal' ([pscustomobject]@{campaignResult='FAIL';diagnostics=(Get-M1DDiagnostics)}))
§legacy=Read-M1DReceipt 'terminal'
§v1Root=Join-Path §Root 'legacy-v1'; [void][IO.Directory]::CreateDirectory(§v1Root); §script:DRunRoot=§v1Root
[void](Write-M1DReceipt 'campaign' ([pscustomobject]@{runtimeSha256=§script:DRuntimeSha256;frontendRuntimeSha256=§script:DFrontendRuntimeSha256}))
[void](Write-M1DReceipt 'terminal' ([pscustomobject]@{campaignResult='FAIL';diagnostics=(Get-M1DDiagnostics);cookieDiagnostic=§legacyDiagnostic}))
§v1=Read-M1DReceipt 'terminal'
if (§v1.payload.cookieDiagnostic.diagnostic.schemaVersion -ne 1 -or §v1.payload.cookieDiagnostic.diagnostic.PSObject.Properties.Name -ccontains 'firstPrivacyViolation') { throw 'FIXTURE_LEGACY_CATEGORY_INVENTED' }
# A valid sidecar does not excuse malformed nested diagnostic content.
§badRoot=Join-Path §Root 'bad-terminal'; [void][IO.Directory]::CreateDirectory(§badRoot); §script:DRunRoot=§badRoot
[void](Write-M1DReceipt 'campaign' ([pscustomobject]@{runtimeSha256=§script:DRuntimeSha256;frontendRuntimeSha256=§script:DFrontendRuntimeSha256}))
§bad=ConvertFrom-Json (ConvertTo-Json §valid -Depth 10 -Compress); §bad.diagnostic.facts.acceptedMask=32
[void](Write-M1DReceipt 'terminal' ([pscustomobject]@{campaignResult='FAIL';diagnostics=(Get-M1DDiagnostics);cookieDiagnostic=§bad}))
§refused=§false; try { [void](Read-M1DReceipt 'terminal') } catch { §refused=§true }
if (-not §refused) { throw 'FIXTURE_TERMINAL_NOT_VALIDATED' }
[pscustomobject]@{diagnostic=§terminal.payload.cookieDiagnostic;protocolCases=§outcomes;legacy=§legacy.payload.campaignResult;legacyV1=§v1.payload.cookieDiagnostic;invalidTerminalRejected=§refused} | ConvertTo-Json -Depth 12 -Compress
`.replaceAll("§", "$" );
    const file = path.join(root, "fixture.ps1"); writeFileSync(file, ps);
    const output = execFileSync("C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe",
      ["-NoProfile", "-NonInteractive", "-File", file, "-Rail", path.resolve("../backend/scripts/m1-1b-postgresql-rail.ps1"), "-Root", root],
      { encoding: "utf8", timeout: 30_000, windowsHide: true, maxBuffer: 64 * 1024 });
    expect(output.includes("synthetic-secret-marker")).toBe(false);
    const readback = JSON.parse(output.trim());
    expect(readback.diagnostic).toEqual(frame); expect(readback.protocolCases).toEqual(input.map(c => c.name));
    expect(readback.legacyV1).toEqual(legacyFrame);
    expect(readback).toMatchObject({ legacy: "FAIL", invalidTerminalRejected: true });
    expect(readFileSync(path.join(root, "d-terminal.json"), "utf8").includes("synthetic-secret-marker")).toBe(false);
  }, 40_000);
  it.each([
    ["http", "BOOTSTRAP_RESPONSE", "HTTP_STATUS"], ["http-body", "BOOTSTRAP_RESPONSE", "HTTP_STATUS"], ["no-response", "BOOTSTRAP_RESPONSE", "NO_RESPONSE"], ["body", "BOOTSTRAP_BODY", "INVALID_BODY"],
    ["ui", "ANONYMOUS_UI", "UI_NOT_REACHED"], ["absent", "COOKIE_ACCEPTANCE", "COOKIE_ABSENT"], ["attributes", "COOKIE_ACCEPTANCE", "COMPARISON"],
    ["continuity", "REDUCER", "METRIC"], ["rotation", "REDUCER", "METRIC"], ["login", "LOGIN_RESPONSE", "HTTP_STATUS"],
    ["authenticated", "AUTHENTICATED_BODY", "STATE"], ["me", "ME_RESPONSE", "HTTP_STATUS"], ["me-body", "ME_BODY", "INVALID_BODY"], ["role", "ROLE", "ROLE"], ["privacy", "ANONYMOUS_PRIVACY", "PRIVACY"]
  ] as const)("retains the decisive observed failure: %s", async (fault, step, reason) => {
    const r = await cookieScenario(fault);
    expect(r.outcome.status).toBe("failed"); expect(r.published).toBe(false); expect(process.exitCode).toBe(1);
    expect(r.lines).toHaveLength(1); expect(r.diagnostic).toMatchObject({ step, reason });
    expect(Buffer.byteLength(r.lines[0])).toBeLessThanOrEqual(8192);
    expect(r.lines[0]).not.toContain("synthetic-secret-marker"); expect(r.attachment?.toString()).not.toContain("synthetic-secret-marker");
    if (fault === "http" || fault === "http-body") expect(r.diagnostic?.facts.bootstrapStatus).toBe(503);
    if (fault === "no-response") expect(r.diagnostic?.facts.bootstrapStatus).toBeNull();
    if (fault === "attributes") expect(r.diagnostic).toMatchObject({ source: "BROWSER", step: "COOKIE_ACCEPTANCE", reason: "COMPARISON", metric: null, facts: { acceptedCount: 1, acceptedMask: 29 } });
    if (fault === "continuity") expect(r.diagnostic).toMatchObject({ source: "REDUCER", metric: "continuity", facts: { continuity: false } });
    if (fault === "rotation") expect(r.diagnostic).toMatchObject({ source: "REDUCER", metric: "rotation", facts: { rotation: false } });
    if (fault === "login") expect(r.diagnostic?.facts.loginStatus).toBe(403);
    if (fault === "me") expect(r.diagnostic?.facts.meCode).toBeNull();
  });
  it("allows the real cookie path with a contractual business tenant header", async () => {
    const r = await cookieScenario("business-header");
    expect(r.outcome.status).toBe("passed"); expect(r.published).toBe(true); expect(r.lines).toEqual([]);
    expect(r.attachment?.toString().includes("synthetic-secret-marker")).toBe(false);
  });
  it("adds the first privacy triplet discovered during real finalization while preserving the earlier HTTP snapshot", async () => {
    const r = await cookieScenario("http-final-privacy");
    expect(r.outcome.status).toBe("failed"); expect(r.published).toBe(false);
    expect(r.beforeFinalization).toMatchObject({ schemaVersion: 2, source: "BROWSER", step: "BOOTSTRAP_RESPONSE", reason: "HTTP_STATUS",
      lastCompleted: null, facts: { bootstrapStatus: 503, privacyScans: null, privacyViolations: null, lostObservations: null }, firstPrivacyViolation: null });
    expect(r.diagnostic).toEqual({ ...r.beforeFinalization,
      firstPrivacyViolation: { rule: "AUTHORIZATION_HEADER", surface: "REQUEST_HEADERS", valueCategory: "NONE" } });
    const observed = decode(r.attachment!, binding("cookie"));
    expect(observed.observations.find(o => o.event === "privacyViolations")?.value).toBe(2);
    expect(observed.cookieDiagnostic).toEqual(r.diagnostic);
    expect(r.failures.diagnostics.includes("M1D_PRIVACY_FINAL_FAILED")).toBe(true);
    expect(r.lines.join("").includes("synthetic-secret-marker")).toBe(false);
    expect(r.attachment?.toString().includes("synthetic-secret-marker")).toBe(false);
  });
  it.each([
    ["session-header", "TENANT_SESSION_HEADER", "REQUEST_HEADERS", "TENANT_ID"],
    ["authorization-header", "AUTHORIZATION_HEADER", "REQUEST_HEADERS", "NONE"],
    ["privacy-auth", "PROTECTED_VALUE_MATCH", "LOCAL_STORAGE", "TENANT_ID"]
  ] as const)("carries the actual authenticated %s refusal through finalization and reporter", async (fault, rule, surface, valueCategory) => {
    const r = await cookieScenario(fault, false, true);
    expect(r.outcome.status).toBe("failed"); expect(r.published).toBe(false);
    expect(r.diagnostic).toMatchObject({ schemaVersion: 2, step: "AUTHENTICATED_PRIVACY", lastCompleted: "ROTATION", reason: "PRIVACY",
      facts: { privacyScans: 2, privacyViolations: 1, lostObservations: 0 }, firstPrivacyViolation: { rule, surface, valueCategory } });
    expect(r.lines.join("").includes("synthetic-secret-marker")).toBe(false);
    expect(r.attachment?.toString().includes("synthetic-secret-marker")).toBe(false);
    expect(r.failures.diagnostics.includes("M1D_PAGE_CLOSE_FAILED")).toBe(true);
  });
  it("keeps nominal PASS bytes free of failure detail and rejects old/foreign responses", async () => {
    const r = await cookieScenario("none", true);
    expect(r.outcome.status).toBe("passed"); expect(r.published).toBe(true); expect(r.lines).toEqual([]);
    expect(r.attachment?.toString()).not.toContain("cookieDiagnostic"); expect(Object.keys(reduce(decode(r.attachment!, binding("cookie"))))).toHaveLength(5);
    expect(r.jsonReads).not.toContain("/api/session/local"); expect(r.jsonReads).toContain("/api/me");
  });
  it("captures an async operation's own step and freezes the first observations", async () => {
    const f = new BrowserFailures(); let reject!: (error: Error) => void;
    const pending = f.capture("RESPONSE", () => new Promise((_resolve, failed) => { reject = failed; }), "BOOTSTRAP_RESPONSE", "NO_RESPONSE");
    f.lastCookieControl = "LOGIN_ACTION"; reject(new Error("synthetic-secret-marker")); await pending;
    expect(f.cookieDiagnostic?.step).toBe("BOOTSTRAP_RESPONSE"); expect(f.cookieDiagnostic?.facts.loginStatus).toBeNull();
    f.cookieFacts.loginStatus = 403; f.cookieFailure("FINALIZATION", "FINALIZATION");
    expect(f.cookieDiagnostic?.step).toBe("BOOTSTRAP_RESPONSE"); expect(f.cookieDiagnostic?.facts.loginStatus).toBeNull();
  });
  it("retains the initial cookie failure through a failing real finalization path", async () => {
    const r = await cookieScenario("http", false, true);
    expect(r.diagnostic).toMatchObject({ source: "BROWSER", step: "BOOTSTRAP_RESPONSE", reason: "HTTP_STATUS", facts: { bootstrapStatus: 503, loginStatus: null } });
    expect(r.failures.diagnostics).toContain("M1D_PAGE_CLOSE_FAILED");
    expect(r.outcome.status).toBe("failed"); expect(r.published).toBe(false);
  });
  it("keeps rejected callbacks handled when observations cannot fit the closed diagnostic", async () => {
    const f = new BrowserFailures(); f.cookieFacts.privacyScans = 1_000_001; f.cookieFacts.bootstrapStatus = 503;
    await expect(f.capture("RESPONSE", async () => { throw new Error("synthetic-secret-marker"); }, "ME_RESPONSE", "NO_RESPONSE")).resolves.toEqual({ ok: false });
    expect(f.cookieDiagnostic).toMatchObject({ step: "ME_RESPONSE", reason: "NO_RESPONSE", facts: { privacyScans: null, bootstrapStatus: 503 } });
  });
  it("identifies a reducer metric without publishing an out-of-contract numeric value", async () => {
    const e = fixture("cookie"); e.observations.find(o => o.event === "acceptedCookie")!.value = 100000;
    const lines: string[] = [], reporter = new Reporter(binding("cookie"), () => { throw new Error("unexpected publication"); }, line => { lines.push(line); });
    const tc = { title: "m1d-cookie", expectedStatus: "passed" } as TestCase;
    reporter.onBegin({} as FullConfig, { allTests: () => [tc] } as Suite); reporter.onTestEnd(tc, result(e));
    expect(await reporter.onEnd(full)).toEqual({ status: "failed" });
    expect(JSON.parse(lines[0].slice("M1D_COOKIE_DIAGNOSTIC ".length)).diagnostic).toMatchObject({ source: "REDUCER", metric: "acceptedCookie", facts: { acceptedMask: null } });
  });
  it("refuses malformed and secret-bearing detail before attachment serialization", () => {
    const d: CookieDiagnostic = { schemaVersion: 1, source: "BROWSER", step: "BOOTSTRAP_RESPONSE", lastCompleted: null, reason: "HTTP_STATUS", metric: null, facts: emptyCookieFacts() };
    for (const bad of [{ ...d, extra: "synthetic-secret-marker" }, { ...d, step: "BOOTSTRAP_RESPONSE\n" }, { ...d, source: "browser" },
      { ...d, facts: { ...d.facts, loginCode: "synthetic-secret-marker" } }, { ...d, facts: { ...d.facts, bootstrapStatus: "200" } },
      { ...d, facts: { ...d.facts, continuity: 0 } }, { ...d, facts: { ...d.facts, acceptedMask: 32 } }, { ...d, facts: { ...d.facts, privacyScans: 1_000_001 } }]) {
      expect(() => validateCookieDiagnostic(bad)).toThrow("M1D_OBSERVATION_FAILED");
      expect(() => decode(bytes({ ...fixture("cookie"), cookieDiagnostic: bad as CookieDiagnostic }), binding("cookie"))).toThrow();
    }
  });
  it.each(["missing", "invalid", "non-publishable", "stdout"])("cannot convert %s diagnostic transport to PASS", async mode => {
    const tc = { title: "m1d-cookie", expectedStatus: "passed" } as TestCase;
    const lines: string[] = []; let published = false;
    const reporter = new Reporter(binding("cookie"), () => { published = true; }, line => { if (mode === "non-publishable") throw new Error("synthetic-secret-marker"); lines.push(line); });
    reporter.onBegin({} as FullConfig, { allTests: () => [tc] } as Suite);
    const r = result(fixture("cookie")); r.status = "failed";
    if (mode === "missing") r.attachments = [];
    if (mode === "invalid") r.attachments[0].body = Buffer.from('{"raw":"synthetic-secret-marker"}');
    if (mode === "stdout") reporter.onStdOut();
    reporter.onTestEnd(tc, r);
    expect(await reporter.onEnd(full)).toEqual({ status: "failed" }); expect(published).toBe(false); expect(process.exitCode).toBe(1);
    expect(lines.join("")).not.toContain("synthetic-secret-marker");
    await reporter.onEnd(full); expect(lines.length).toBeLessThanOrEqual(1);
  });
});

describe("public reporter transport and failure atomicity", () => {
  it("fails closed if the reporter begin callback throws", async () => {
    let published = false; const reporter = new Reporter(binding(), () => { published = true; });
    reporter.onBegin({} as FullConfig, { allTests: () => { throw new Error("synthetic-secret-marker"); } } as unknown as Suite);
    reporter.onTestEnd(testCase, result(fixture()));
    expect(await reporter.onEnd(full)).toEqual({ status: "failed" }); expect(published).toBe(false);
  });
  it("requires the worker attachment plus successful final runner result", async () => {
    let calls = 0; const reporter = new Reporter(binding(), (_b, e) => { reduce(e); calls++; }); begin(reporter);
    const original = fixture(); const transported = result(original); original.observations.length = 0;
    reporter.onTestEnd(testCase, transported); expect(await reporter.onEnd(full)).toEqual({ status: "passed" }); expect(calls).toBe(1);
  });
  it.each(["missing", "failed", "skipped", "retry", "stderr", "stdout", "global-error", "duplicate", "timedout", "publisher-throws"])("does not publish success for %s", async mode => {
    let calls = 0; const reporter = new Reporter(binding(), () => { if (mode === "publisher-throws") throw new Error("synthetic-secret-marker"); calls++; }); begin(reporter);
    const r = result(fixture());
    if (mode === "failed" || mode === "skipped") r.status = mode;
    if (mode === "retry") r.retry = 1;
    if (mode === "stderr") reporter.onStdErr(); if (mode === "stdout") reporter.onStdOut(); if (mode === "global-error") reporter.onError();
    if (mode !== "missing") reporter.onTestEnd(testCase, r);
    if (mode === "duplicate") reporter.onTestEnd(testCase, r);
    expect(await reporter.onEnd(mode === "timedout" ? { status: "timedout" } as FullResult : full)).toEqual({ status: "failed" }); expect(calls).toBe(0);
  });
  it("publishes a complete hashed piece before the exclusive receipt and never overwrites", () => {
    const root = mkdtempSync(path.join(os.tmpdir(), "m1d-synthetic-evidence-")); roots.push(root);
    const b = { ...binding(), root }, order: string[] = [];
    publish(b, fixture(), (file, content) => { order.push(path.basename(file)); createNewFile(file, content); });
    expect(order).toEqual(["browser-observations.json", "d-browser-evidence.json"]);
    const receipt = JSON.parse(readFileSync(path.join(root, order[1]), "utf8"));
    expect(receipt.evidence[0].sha256).toBe(createHash("sha256").update(readFileSync(path.join(root, "browser-evidence", order[0]))).digest("hex"));
    expect(() => publish(b, fixture())).toThrow();
    expect(readFileSync(path.join(root, order[1]), "utf8")).not.toContain("synthetic-secret-marker");
  });
  it("a failed piece write cannot leave a receipt", () => {
    const root = mkdtempSync(path.join(os.tmpdir(), "m1d-synthetic-evidence-")); roots.push(root);
    expect(() => publish({ ...binding(), root }, fixture(), () => { throw new Error("synthetic-write-error"); })).toThrow();
    expect(readdirSync(root)).toEqual(["browser-evidence"]);
  });
  it("pins the installed 1.63.0 snapshot behavior without assuming it removes error files", () => {
    const runtime = readFileSync(path.resolve("node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/lib/index.js"), "utf8");
    expect(runtime).toMatch(/async _takePageSnapshot\(context\) \{\s*if \(process.env.PLAYWRIGHT_NO_COPY_PROMPT\)\s*return;/);
    expect(runtime).toContain('this._testInfo.outputPath("error-context.md")');
    expect(runtime).toContain("errors: this._testInfo.errors");
    expect(new Reporter(binding()).printsToStdio()).toBe(true);
  });
});
