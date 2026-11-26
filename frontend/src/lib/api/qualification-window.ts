import type { createSessionCoordinator } from "./session";

const desktop = "http://127.0.0.1:39747";
const service = "https://ritomer-m12-706846293930.europe-west6.run.app";
const uuid = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/;
const identityError = (code: string): never => { throw new Error(code); };
async function digest(text: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2,"0")).join("");
}
type Actor = {user_id: string; tenant_id: string; roles: string[]};
type Fixture = {folder: string; document: string; export: string; documentBytes: number; exportBytes: number; documentHash: string; exportHash: string};
type Settings = {actor: Actor; own: Fixture; other: Fixture};
type Coordinator = ReturnType<typeof createSessionCoordinator>;

// A credential-free port to the local operator. Google opens in a separate normal tab.
// A normal visit, an unrelated opener, and a bootstrap outside an enabled revision stay inert.
export function qualificationWindow() {
  const match = /^#m12\/(A1|B|A2)\/([a-f0-9-]{36})\/([0-9a-f]{64})$/.exec(location.hash);
  if (!match || !uuid.test(match[2]) || !window.opener || location.pathname !== "/" || location.search ||
      !document.referrer.startsWith(desktop + "/") ||
      !(location.origin === service || /^https:\/\/localhost:\d+$/.test(location.origin))) return;
  const [actor, invitation, scopeHash] = match.slice(1);
  const commitment = digest([actor,invitation,scopeHash].join("\n"));
  const peer: Window = window.opener;
  history.replaceState(null, "", "/");
  const post = (data: object) => peer.postMessage({ invitation, ...data }, desktop);
  let enabled = false, started = false, admitted = false, busy = false, last = 0, loggedOut = false;
  let settings: Settings | undefined, logoutChallenge: string | undefined, logoutReceived = false;
  let until = 0, commandUntil = 0, revision = "", phaseIndex = -1;
  const lifetime = new AbortController();
  const live = () => !lifetime.signal.aborted && !peer.closed && Date.now() < until;
  window.addEventListener("pagehide", () => { lifetime.abort(); until = 0; }, {once:true});
  const currentCommand = () => { if (!live() || Date.now() >= commandUntil) identityError("CLIENT_DEADLINE"); };
  const request: typeof fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input), location.href);
    if (logoutChallenge && url.href === location.origin + "/api/session/logout" && init?.method === "POST") {
      currentCommand();
      const headers = new Headers(init.headers);
      headers.set("X-Ritomer-Qualification-Challenge", logoutChallenge);
      logoutChallenge = undefined;
      const response = await fetch(input, { ...init, headers });
      logoutReceived = response.status === 204 && response.headers.get("cache-control") === "no-store";
      return response;
    }
    const bootstrap = url.href === location.origin + "/api/session/bootstrap";
    let response: Response;
    try { response = await fetch(input, init); }
    catch (error) { if (bootstrap) lifetime.abort(); throw error; }
    if (bootstrap) {
      const activeRevision = response.headers.get("X-Ritomer-Qualification-Revision") || "";
      const pins = (response.headers.get("X-Ritomer-Qualification-Windows") || "").split(",");
      const expires = Date.parse(response.headers.get("X-Ritomer-Qualification-Until") || "");
      const authorized = response.ok && /^[a-z][a-z0-9-]{0,62}$/.test(activeRevision) && pins.length === 3 &&
        pins[["A1","B","A2"].indexOf(actor)] === await commitment && Date.now() < expires &&
        (!revision || revision === activeRevision && until === expires);
      if (!authorized) { enabled = false; until = 0; lifetime.abort(); }
      else if (!enabled) {
        enabled = true; revision = activeRevision; until = expires;
        document.title = "Ritomer · campagne " + actor;
        post({ event: "WITNESS_READY" });
      }
    }
    return response;
  };
  function login(event: Event) {
    if (!enabled || !live() || !(event.target instanceof Element)) return;
    const link = event.target.closest("a");
    if (!link) return;
    const url = new URL(link.href);
    if (url.origin !== location.origin || url.pathname !== "/oauth2/authorization/google") return;
    if (started) { event.preventDefault(); return; }
    started = true;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    post({ event: "LOGIN_STARTED" });
  }
  document.addEventListener("click", login, {capture:true, signal:lifetime.signal});

  function attach(coordinator: Coordinator) {
    window.addEventListener("message", async event => {
      if (!enabled || !live() || event.origin !== desktop || event.source !== peer || !event.data ||
          event.data.invitation !== invitation || busy) return;
      const cmd = event.data;
      busy = true;
      try {
        if (!Number.isSafeInteger(cmd.expires)) identityError("CLIENT_DEADLINE");
        commandUntil = Math.min(cmd.expires, until);
        currentCommand();
        if (cmd.command === "VERIFY" && started && !settings) {
          if (cmd.revision !== revision || typeof cmd.scope !== "string" || cmd.scope.length > 4096 ||
              await digest(cmd.scope) !== scopeHash) identityError("CLIENT_AUTHORITY");
          settings = JSON.parse(cmd.scope) as Settings;
          await coordinator.revalidate();
          currentCommand();
          if (coordinator.getSnapshot().mode !== "SESSION_READY") identityError("CLIENT_WORKBENCH");
          // Observe the rendered Workbench as well as the authenticated coordinator.
          const end = performance.now() + 3000;
          while (!Array.from(document.querySelectorAll("p")).some(p =>
            p.getClientRects().length && /^Session connectée(?:\s*·|$)/.test(p.textContent || ""))) {
            if (performance.now() >= end) identityError("CLIENT_WORKBENCH");
            await new Promise(r => setTimeout(r, 50));
          }
          post({ event: "WORKBENCH_READY" });
          currentCommand();
          await observe(settings, "ME", 200);
          currentCommand();
          admitted = true;
          post({ event: "ADMITTED" });
        } else if (cmd.command === "OBSERVE" && admitted && settings && Number.isInteger(cmd.sequence) &&
                   cmd.sequence > last && cmd.sequence <= 394 && uuid.test(cmd.challenge)) {
          last = cmd.sequence;
          const phases = actor === "A2" ? ["RELOGIN","LOGOUT"] : actor === "A1" ?
            ["BEFORE","REVOKED","RESTORED"] : ["BEFORE","REVOKED","RESTORED","RELOGIN","LOGOUT"];
          const next = phases.indexOf(cmd.phase);
          if (next < 0 || next < phaseIndex || next > phaseIndex + 1) identityError("CLIENT_PHASE");
          phaseIndex = next;
          if (actor === "A1" && next > 0 && (cmd.operation !== "ME" || cmd.status !== (next === 1 ? 403 : 401)) ||
              cmd.operation.startsWith("FOREIGN_") && cmd.phase !== "BEFORE" ||
              cmd.operation === "ME" && (actor === "B" || cmd.phase === "RELOGIN" || cmd.phase === "BEFORE") && cmd.status !== 200 ||
              actor === "A2" && cmd.phase === "LOGOUT" && cmd.operation !== "LOGOUT" &&
                (!loggedOut || cmd.operation !== "ME" || cmd.status !== 401)) identityError("CLIENT_STEP");
          let status: number;
          if (cmd.operation === "LOGOUT") {
            if (actor !== "A2" || loggedOut || cmd.status !== 204 || cmd.phase !== "LOGOUT") identityError("CLIENT_LOGOUT");
            loggedOut = true;
            logoutChallenge = cmd.challenge;
            const button = Array.from(document.querySelectorAll("button")).find(b =>
              b.getClientRects().length && b.textContent?.trim() === "Déconnexion" && !b.disabled);
            if (!button) identityError("CLIENT_LOGOUT");
            button!.click();
            while (logoutChallenge || !logoutReceived || coordinator.getSnapshot().mode !== "ANONYMOUS" ||
                   !Array.from(document.querySelectorAll("a")).some(a => a.getClientRects().length &&
                     a.pathname === "/oauth2/authorization/google" && a.origin === location.origin)) {
              currentCommand();
              await new Promise(r => setTimeout(r, 50));
            }
            status = 204;
          } else {
            status = await observe(settings, cmd.operation, cmd.status, cmd.challenge);
          }
          currentCommand();
          post({ event: "RESPONSE", sequence: last, challenge: cmd.challenge, status });
        } else identityError("CLIENT_STEP");
      } catch (error) {
        const reason = error instanceof Error && /^CLIENT_[A-Z_]+$/.test(error.message) ? error.message : "CLIENT_INCOMPLETE";
        post({ event: "FAILURE", code: reason });
      } finally { busy = false; }
    }, {signal:lifetime.signal});
  }
  return { request, attach };
}

async function observe(settings: Settings, operation: string, expected: number, challenge?: string) {
  const who = settings.actor;
  if (!uuid.test(who.user_id) || !uuid.test(who.tenant_id) || !Array.isArray(who.roles) || !who.roles.length)
    identityError("CLIENT_IDENTITY");
  const files = operation.startsWith("FOREIGN_") ? settings.other : settings.own;
  const kind = operation.endsWith("DOCUMENT") ? "document" : "export";
  const me = operation === "ME";
  if (me ? ![200,401,403].includes(expected) :
      !["DOCUMENT","EXPORT","FOREIGN_DOCUMENT","FOREIGN_EXPORT"].includes(operation) ||
      expected !== (operation.startsWith("FOREIGN_") ? 404 : 200) ||
      !uuid.test(files.folder) || !uuid.test(files[kind])) identityError("CLIENT_STEP");
  const path = me ? "/api/me" : "/api/closing-folders/" + files.folder + "/" +
    (kind === "document" ? "documents" : "export-packs") + "/" + files[kind] + "/content";
  const headers = new Headers({ "X-Tenant-Id": who.tenant_id });
  if (challenge) headers.set("X-Ritomer-Qualification-Challenge", challenge);
  const res = await fetch(path, { headers, cache: "no-store", credentials: "same-origin",
    mode: "same-origin", redirect: "error", signal: AbortSignal.timeout(15000) });
  if (res.status !== expected) identityError("CLIENT_HTTP_STATUS");
  if (me) {
    const body = await res.json();
    if (expected === 200) {
      if (body.actor?.userId !== who.user_id) identityError("CLIENT_IDENTITY");
      if (body.memberships?.length !== 1 || body.memberships[0]?.tenantId !== who.tenant_id ||
          body.activeTenant?.tenantId !== who.tenant_id) identityError("CLIENT_TENANT");
      const exact = (v: unknown) => Array.isArray(v) && JSON.stringify([...v].sort()) === JSON.stringify([...who.roles].sort());
      if (!exact(body.memberships[0].roles) || !exact(body.effectiveRoles)) identityError("CLIENT_ROLES");
    } else if (body.code !== (expected === 403 ? "ACCESS_REVOKED" : "AUTHENTICATION_REQUIRED")) identityError("CLIENT_DENIAL_CAUSE");
  } else if (expected === 200) {
    const size = files[kind === "document" ? "documentBytes" : "exportBytes"];
    const cache = (res.headers.get("cache-control") || "").split(",").map(v => v.trim());
    if (!Number.isSafeInteger(size) || size < 1 || size > 4194304 || !cache.includes("private") ||
        !cache.includes("no-store") || cache.includes("public") || res.headers.get("content-length") !== String(size))
      identityError("CLIENT_CONTENT");
    const bytes = await res.arrayBuffer();
    if (bytes.byteLength !== size) identityError("CLIENT_CONTENT");
    const hash = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map(v => v.toString(16).padStart(2,"0")).join("");
    if (hash !== files[kind === "document" ? "documentHash" : "exportHash"]) identityError("CLIENT_DIGEST");
  }
  return res.status;
}
