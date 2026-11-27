// Browser-owned sessions. Evidence contains only classifications and observed HTTP facts.
import { chromium } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";

const COOKIE = "__Host-ritomer-session";
const requireThat = (condition, code) => {
  if (!condition) { const error = Error(code); error.clientCode = code; throw error; }
};

function expiredCookie(reply) {
  const cookies = reply.headers["set-cookie"] || [];
  const values = cookies.filter(value => value.startsWith(COOKIE + "="));
  // Spring Security and Spring Session both expire the cookie on logout.
  requireThat(values.length > 0, "CLIENT_LOGOUT_COOKIE");
  for (const value of values) {
    const pieces = value.split(";").map(item => item.trim());
    const attrs = new Map();
    for (const piece of pieces.slice(1)) {
      const [key, ...rest] = piece.split("=");
      const name = key.trim().toLowerCase();
      requireThat(!attrs.has(name), "CLIENT_LOGOUT_COOKIE");
      attrs.set(name, rest.length ? rest.join("=") : null);
    }
    requireThat(pieces[0] === COOKIE + "=" && attrs.get("max-age") === "0" && attrs.get("path") === "/"
      && attrs.get("secure") === null && attrs.get("httponly") === null
      && attrs.get("samesite")?.toLowerCase() === "lax" && !attrs.has("domain"), "CLIENT_LOGOUT_COOKIE");
  }
}

export async function openSessionClient(browser, origin) {
  requireThat(/^https:\/\/localhost:\d+$/.test(origin), "LOCAL_ORIGIN_REQUIRED");
  const context = await browser.newContext({ acceptDownloads: false, serviceWorkers: "block" });
  // The app captures fetch at startup. Attach only the public request nonce before that happens.
  await context.addInitScript(({ origin }) => {
    const originalFetch = window.fetch.bind(window);
    window.fetch = (input, init) => {
      const url = new URL(input instanceof Request ? input.url : input, location.href);
      if (url.href === origin + "/api/session/logout" && init?.method === "POST" && window.ritomerLogoutChallenge) {
        const request = new Request(input, init);
        request.headers.set("X-Ritomer-Qualification-Challenge", window.ritomerLogoutChallenge);
        delete window.ritomerLogoutChallenge;
        return originalFetch(request);
      }
      return originalFetch(input, init);
    };
  }, { origin });
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  // The synthetic client receives its own application's cookie at its ordinary callback.
  // Keep only the one value for the fixed, read-only invalidation assertion on this loopback origin.
  let issuedCookie;
  let invalidated = false;
  return {
    async login(keepForInvalidation = false) {
      await page.goto(origin, { waitUntil: "domcontentloaded" });
      const link = page.getByRole("link", { name: "Se connecter avec Google", exact: true });
      const callback = keepForInvalidation ? page.waitForResponse(r =>
        r.url().split("?")[0] === origin + "/login/oauth2/code/google" && r.status() === 302) : null;
      const results = await Promise.all([
        page.waitForResponse(r => r.url() === origin + "/api/me" && r.status() === 200, { timeout: 20000 }),
        link.click(), callback
      ]);
      if (callback) {
        const issued = (await results[2].headerValues("set-cookie")).filter(h => h.startsWith(COOKIE + "="));
        const values = [...new Set(issued.map(h => h.split(";", 1)[0]).filter(h => h !== COOKIE + "="))];
        requireThat(values.length === 1 && /^__Host-ritomer-session=[A-Za-z0-9_-]{16,128}$/.test(values[0]),
          "FIXTURE_ISSUANCE_AMBIGUOUS");
        issuedCookie = values[0];
      }
    },
    async fixtureCsrf() {
      return page.evaluate(async origin => {
        if (location.origin !== origin) throw Error("LOCAL_ORIGIN_REQUIRED");
        const r = await fetch("/api/session/bootstrap", { cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10000) });
        const b = await r.json();
        if (!r.ok || b.sessionState !== "AUTHENTICATED" || b.csrf?.headerName !== "X-CSRF-TOKEN" || !b.csrf.token)
          throw Error("FIXTURE_BOOTSTRAP_FAILED");
        return b.csrf.token;
      }, origin);
    },
    async fixtureLogout(token, sequence, stale) {
      const challenge = randomUUID(), startedAt = new Date().toISOString();
      // Compare just the application CSRF field with the value obtained at bootstrap.
      // Keep the comparison in the owning client; only its success controls progression.
      const submitted = page.waitForRequest(r => r.url() === origin + "/api/session/logout"
        && r.method() === "POST", { timeout: 10000 }).then(r => r.headerValue("x-csrf-token"));
      const observed = !stale && page.waitForResponse(r => r.url() === origin + "/api/session/logout"
        && r.request().method() === "POST", { timeout: 10000 });
      const status = await page.evaluate(async ({ origin, challenge, token, stale }) => {
        if (location.origin !== origin) throw Error("LOCAL_ORIGIN_REQUIRED");
        const r = await fetch("/api/session/logout", { method: "POST", redirect: "error", cache: "no-store",
          headers: { "X-CSRF-TOKEN": token, "X-Ritomer-Qualification-Challenge": challenge },
          signal: AbortSignal.timeout(10000) });
        if (stale ? r.status !== 403 || (await r.json()).code !== "CSRF_REJECTED"
                  : r.status !== 204 || r.headers.get("Cache-Control") !== "no-store") throw Error("FIXTURE_LOGOUT_REJECTED");
        return r.status;
      }, { origin, challenge, token, stale });
      requireThat(await submitted === token, "FIXTURE_CSRF_SUBMISSION");
      if (!stale) {
        const response = await observed;
        expiredCookie({ headers: { "set-cookie": await response.headerValues("set-cookie") } });
        invalidated = true;
      }
      return { event: "REQUEST", operation: "LOGOUT", phase: stale ? "RELOGIN" : "LOGOUT", actor: "A",
        session: "REPLACEMENT", sequence, challenge, traced: true, startedAt, utc: new Date().toISOString(), status };
    },
    async me(actor, session, phase, sequence, expectedActor, expectedTenant, expectedStatus) {
      const challenge = randomUUID();
      const startedAt = new Date().toISOString();
      // Admission and revocation use the ordinary browser. The retained synthetic cookie is
      // used only after this very client saw a denial or successful logout, only for GET /api/me.
      if (expectedStatus === 401) {
        requireThat(actor === "A" && invalidated && issuedCookie && /^https:\/\/localhost:\d+$/.test(origin),
          "FIXTURE_INVALIDATION_STATE");
        const response = await context.request.get(origin + "/api/me", { headers: {
          Cookie: issuedCookie, "X-Ritomer-Qualification-Challenge": challenge }, maxRedirects: 0,
          maxRetries: 0, timeout: 10000, ignoreHTTPSErrors: true });
        try {
          requireThat(response.status() === 401, "OLD_SESSION_ACCEPTED");
        } finally { await response.dispose(); }
        return { event: "REQUEST", operation: "ME", phase, actor, session, sequence, challenge, traced: true,
          startedAt, utc: new Date().toISOString(), status: 401 };
      }
      const result = await page.evaluate(async ({ challenge, origin, expectedActor, expectedTenant }) => {
        if (location.origin !== origin) throw new Error("WRONG_APPLICATION_ORIGIN");
        const response = await fetch("/api/me", {
          headers: { "X-Ritomer-Qualification-Challenge": challenge }, cache: "no-store",
          credentials: "same-origin", redirect: "error", signal: AbortSignal.timeout(10000)
        });
        const body = await response.json();
        return {
          status: response.status,
          identity: response.ok && body.actor?.userId === expectedActor && body.memberships?.length === 1
            && body.memberships[0].tenantId === expectedTenant,
          revoked: response.status === 403 && body.code === "ACCESS_REVOKED"
        };
      }, { challenge, origin, expectedActor, expectedTenant });
      if (result.status !== expectedStatus || (expectedStatus === 200 ? !result.identity : expectedStatus === 403 && !result.revoked)) {
        throw new Error("ME_OBSERVATION_REJECTED");
      }
      if (result.revoked) invalidated = true;
      return { event: "REQUEST", operation: "ME", phase, actor, session, sequence, challenge, traced: true,
        startedAt, utc: new Date().toISOString(), status: result.status };
    },
    async content(actor, session, phase, sequence, tenant, data, kind) {
      const challenge = randomUUID(), startedAt = new Date().toISOString();
      await page.evaluate(async ({ origin, tenant, data, kind, challenge }) => {
        if (location.origin !== origin || ![data.folder, data[kind], tenant].every(id =>
          /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/.test(id))) throw Error("FIXTURE_FILE_SCOPE");
        const part = kind === "document" ? "documents" : "export-packs";
        const response = await fetch("/api/closing-folders/" + data.folder + "/" + part + "/" + data[kind] + "/content", {
          headers: { "X-Tenant-Id": tenant, "X-Ritomer-Qualification-Challenge": challenge }, cache: "no-store",
          redirect: "error", signal: AbortSignal.timeout(10000) });
        if (response.status !== 200) throw Error("FIXTURE_FILE_HTTP_" + response.status);
        const cache = response.headers.get("cache-control")?.split(",").map(s => s.trim());
        if (!cache?.includes("private") || !cache.includes("no-store") || cache.includes("public"))
          throw Error("FIXTURE_FILE_CACHE");
        const expectedSize = data[kind + "Size"];
        if (!/^[1-9]\d{0,4}$/.test(expectedSize) || response.headers.get("content-length") !== expectedSize)
          throw Error("FIXTURE_FILE_LENGTH");
        const bytes = await response.arrayBuffer();
        if (bytes.byteLength !== Number(expectedSize)) throw Error("FIXTURE_FILE_LENGTH");
        const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
        if (Array.from(digest, b => b.toString(16).padStart(2,"0")).join("") !== data[kind + "Sha"])
          throw Error("FIXTURE_FILE_CONTENT");
      }, { origin, tenant, data, kind, challenge });
      return { event: "REQUEST", operation: kind === "document" ? "DOCUMENT_CONTENT" : "EXPORT_CONTENT",
        phase, actor, session, sequence, challenge, traced: true, startedAt, utc: new Date().toISOString(), status: 200 };
    },
    async logout(sequence) {
      const challenge = randomUUID();
      const endpoint = origin + "/api/session/logout";
      await page.evaluate(value => { window.ritomerLogoutChallenge = value; }, challenge);
      const startedAt = new Date().toISOString();
      const [response] = await Promise.all([
        page.waitForResponse(r => r.url() === endpoint && r.request().method() === "POST"),
        page.getByRole("button", { name: "Déconnexion", exact: true }).first().click()
      ]);
      requireThat(response.status() === 204 && (await response.headerValue("cache-control")) === "no-store",
        "LOGOUT_REFUSED");
      expiredCookie({ headers: { "set-cookie": (await response.headersArray())
        .filter(header => header.name.toLowerCase() === "set-cookie").map(header => header.value) } });
      await page.getByRole("link", { name: "Se connecter avec Google", exact: true }).waitFor();
      return { event: "REQUEST", operation: "LOGOUT", phase: "LOGOUT", actor: "A", session: "REPLACEMENT",
        sequence, challenge, traced: true, startedAt, utc: new Date().toISOString(), status: response.status() };
    },
    close: async () => { issuedCookie = undefined; await context.close(); }
  };
}

// The local driver accepts only its own loopback service. The synthetic IdP completes
// each ordinary browser navigation. The pilot admits each phase on stdin.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [origin, idp, executable, actorA, tenantA, actorB, tenantB, expectedVersion] = process.argv.slice(2);
  if (!/^https:\/\/localhost:\d+$/.test(origin) || !/^http:\/\/127\.0\.0\.1:\d+$/.test(idp)) throw Error("LOCAL_ORIGIN_REQUIRED");
  const lines = createInterface({ input: process.stdin, terminal: false });
  const commands = lines[Symbol.asyncIterator]();
  const send = value => process.stdout.write(JSON.stringify(value) + "\n");
  let browser;
  let stage = "launch";
  const transport = [];
  const timer = setTimeout(() => { process.exitCode = 1; lines.close(); void browser?.close(); }, 75000);
  try {
    const gate = await commands.next();
    requireThat(!gate.done && gate.value === "FIXTURE_START", "FIXTURE_HANDOFF");
    browser = await chromium.launch({ executablePath: executable, headless: true, timeout: 12000,
      args: ["--allow-insecure-localhost", "--disable-background-networking", "--no-proxy-server"] });
    // Limit navigation, subresources and XHR to the two test listeners.
    const clients = [];
    const ownedBrowser = { async newContext(options) {
      const context = await browser.newContext(options);
      context.on("response", response => {
        const { pathname, origin: responseOrigin } = new URL(response.url());
        const paths = ["/", "/api/me", "/api/session/bootstrap", "/oauth2/authorization/google",
          "/login/oauth2/code/google", "/authorize", "/api/session/logout"];
        if (paths.includes(pathname) && (responseOrigin === origin || responseOrigin === idp) && transport.length < 60) {
          transport.push(pathname + "=" + response.status());
        }
      });
      await context.route("**/*", route => {
        const target = new URL(route.request().url());
        return (target.origin === origin || target.origin === idp) ? route.continue() : route.abort();
      });
      return context;
    } };
    const version = browser.version();
    requireThat(version === expectedVersion, "FIXTURE_BROWSER_VERSION_MISMATCH");
    send({ browserVersion: version });
    for (let i = 0; i < 3; i++) clients.push(await openSessionClient(ownedBrowser, origin));
    const [a,b,a2] = clients;
    let sequence = 0, initialCsrf, currentCsrf;
    const files = JSON.parse(process.env.RITOMER_M12_SYNTHETIC_FILES);
    const me = async (client, label, which, phase, expected = 200) => {
      const tenant = label === "A" ? tenantA : tenantB;
      send(await client.me(label, which, phase, ++sequence, label === "A" ? actorA : actorB, tenant, expected));
      if (expected === 200) for (const kind of ["document", "export"]) {
        send(await client.content(label, which, phase, ++sequence, tenant, files[label], kind));
      }
    };
    const login = async (client, label) => {
      send({ ready: label });
      const next = await commands.next();
      requireThat(!next.done && next.value === "GO_" + label, "FIXTURE_PERSONAL_GO_MISSING");
      await client.login(label !== "B");
    };
    for (const phase of ["BEFORE", "REVOKED", "RESTORED", "RELOGIN", "LOGOUT"]) {
      stage = phase;
      const next = await commands.next();
      requireThat(!next.done && next.value === phase, "FIXTURE_PHASE_ORDER");
      if (phase === "BEFORE") {
        await login(a,"A"); initialCsrf = await a.fixtureCsrf(); await login(b,"B");
        await me(a,"A","ORIGINAL",phase);
      } else if (phase === "REVOKED" || phase === "RESTORED") {
        await me(a,"A","ORIGINAL",phase,phase === "REVOKED" ? 403 : 401);
      } else if (phase === "RELOGIN") {
        await login(a2,"A2"); currentCsrf = await a2.fixtureCsrf();
        requireThat(initialCsrf !== currentCsrf, "FIXTURE_CSRF_NOT_ROTATED");
        await me(a2,"A","REPLACEMENT",phase); await me(a,"A","ORIGINAL",phase,401);
        send(await a2.fixtureLogout(initialCsrf,++sequence,true));
        await me(a2,"A","REPLACEMENT",phase);
      } else {
        send(await a2.fixtureLogout(currentCsrf,++sequence,false));
        await me(a2,"A","REPLACEMENT",phase,401);
      }
      await me(b,"B","ORIGINAL",phase);
      send({ done: phase, count: sequence });
    }
    for (const client of clients) await client.close();
  } catch (error) {
    const code = String(error?.message).match(/\b(FIXTURE_FILE_(?:SCOPE|HTTP_[1-5]\d\d|LENGTH|CONTENT|CACHE))\b/);
    send({ failure: code?.[1] || "BROWSER_SCENARIO_INCOMPLETE" });
    process.stderr.write("BROWSER_SCENARIO_INCOMPLETE " + stage + " " + transport.join(" ") + "\n"); process.exitCode = 1;
  } finally {
    clearTimeout(timer); lines.close(); await browser?.close();
  }
}
