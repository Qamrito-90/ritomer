import test from "node:test";
import assert from "node:assert/strict";
import { openSessionClient } from "./shared-oidc-client.mjs";

const expired = "__Host-ritomer-session=; Path=/; Max-Age=0; Secure; HttpOnly; SameSite=Lax";
for (const [title, headers, accepted] of [
  ["two valid expirations", [expired, expired], true],
  ["missing expiration", [], false],
  ["conflicting ages in one expiration", [expired + "; Max-Age=3600"], false],
  ["positive age starting with zero", [expired.replace("Max-Age=0", "Max-Age=01")], false],
  ["conflicting paths", [expired + "; Path=/subpath"], false],
  ["conflicting same-site values", [expired + "; SameSite=None"], false],
  ["invalid second expiration", [expired, expired.replace("Max-Age=0", "Max-Age=3600")], false]
]) test(title, async () => {
  const origin = "https://localhost:443";
  const reply = { url: () => origin + "/api/session/logout", request: () => ({ method: () => "POST" }),
    status: () => 204, headerValue: async () => "no-store",
    headersArray: async () => headers.map(value => ({ name: "Set-Cookie", value })) };
  const page = { setDefaultTimeout() {}, evaluate: async () => {}, getByRole: () => ({
    first: () => ({ click: async () => {} }), waitFor: async () => {} }),
    waitForResponse: async match => { assert.ok(match(reply)); return reply; } };
  const context = { addInitScript: async () => {}, newPage: async () => page, close: async () => {} };
  const client = await openSessionClient({ newContext: async () => context }, origin);
  try {
    if (accepted) assert.equal((await client.logout(1)).status, 204);
    else await assert.rejects(client.logout(1), { message: "CLIENT_LOGOUT_COOKIE" });
  } finally { await client.close(); }
});
