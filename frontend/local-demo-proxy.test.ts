// @vitest-environment node
import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveConfig, type ResolvedConfig, type UserConfig } from "vite";
import { describe, expect, it } from "vitest";
import { buildChildEnvironment } from "./local-two-actor-harness.mjs";
import { assertResolvedLocalSessionConfig, createRitomerViteConfig } from "./vite.config";
const root = fileURLToPath(new URL(".", import.meta.url));
const config = () => createRitomerViteConfig({ command: "serve" }, {});

describe("Vite local session boundary", () => {
  it("uses exactly one fixed loopback origin and unmodified session proxy", () => {
    expect(config().server).toEqual({ host: "127.0.0.1", port: 5173, strictPort: true,
      proxy: { "/api": { target: "http://127.0.0.1:8080", changeOrigin: true, xfwd: false } } });
    expect(() => assertResolvedLocalSessionConfig(config() as ResolvedConfig)).not.toThrow();
  });
  it.each([{ command: "build" as const }, { command: "serve" as const, isPreview: true }])("has no proxy for %j", (mode) => {
    expect(createRitomerViteConfig(mode, {}).server).toBeUndefined();
    expect(createRitomerViteConfig(mode, {}).preview).toBeUndefined();
  });
  it.each(["", "http://localhost:8080", "http://127.0.0.1:8080/", "http://127.0.0.1:18080", "https://example.invalid", "http://user:secret@127.0.0.1:8080"])("rejects noncanonical target %s without echoing it", (target) => {
    expect(() => createRitomerViteConfig({ command: "serve" }, { RITOMER_LOCAL_DEMO_BACKEND_TARGET: target })).toThrow("LOCAL_SESSION_BACKEND_TARGET_REFUSED");
  });
  it.each(["RITOMER_LOCAL_DEMO_PROXY_AUTH_ENABLED", "RITOMER_LOCAL_DEMO_BEARER_TOKEN", "RITOMER_SECURITY_JWT_HMAC_SECRET", "ritomer_local_demo_bearer_token"])("rejects legacy variable presence %s", (name) => {
    expect(() => createRitomerViteConfig({ command: "serve" }, { [name]: "" })).toThrow("LOCAL_SESSION_LEGACY_AUTH_CONFIGURATION_REFUSED");
  });
  it("accepts a closed child environment without credentials", () => {
    const child = buildChildEnvironment({ PATH: "synthetic-path", RITOMER_DB_TEST_PASSWORD: "synthetic-password", NODE_OPTIONS: "injected", VITE_TOKEN: "injected" }, "win32");
    expect(child).toEqual({ PATH: "synthetic-path", RITOMER_LOCAL_DEMO_BACKEND_TARGET: "http://127.0.0.1:8080" });
    expect(() => createRitomerViteConfig({ command: "serve" }, child)).not.toThrow();
  });
  it.each([
    { host: "0.0.0.0" }, { port: 5174 }, { strictPort: false }, { https: {} }, { origin: "http://elsewhere.invalid" },
    { proxy: { "/api": { target: "http://127.0.0.1:8080", changeOrigin: true, xfwd: true } } },
    { proxy: { "/api": { target: "http://127.0.0.1:8080", changeOrigin: true, xfwd: false, headers: { Origin: "injected" } } } },
    { proxy: { "/api": { target: "http://127.0.0.1:8080", changeOrigin: true, xfwd: false, cookieDomainRewrite: "" } } }
  ])("rejects resolved overrides %j", (override) => {
    const changed = config(); changed.server = { ...changed.server, ...override } as UserConfig["server"];
    expect(() => assertResolvedLocalSessionConfig(changed as ResolvedConfig)).toThrow("LOCAL_SESSION_RESOLVED_CONFIGURATION_REFUSED");
  });
  it("runs the guard on actual Vite resolution without starting a server", async () => {
    await expect(resolveConfig({ ...config(), configFile: false }, "serve")).resolves.toMatchObject({ server: { port: 5173 } });
    const changed = config(); changed.server!.port = 5199;
    await expect(resolveConfig({ ...changed, configFile: false }, "serve")).rejects.toThrow("LOCAL_SESSION_RESOLVED_CONFIGURATION_REFUSED");
  });
  it("keeps credentials, browser storage and logging out of the client/config", () => {
    const files = (path: string): string[] => statSync(path).isDirectory()
      ? readdirSync(path).flatMap((name) => files(join(path, name))) : [path];
    for (const path of [...files(join(root, "src")), join(root, "index.html")].filter((path) => [".html", ".js", ".jsx", ".ts", ".tsx"].includes(extname(path)))) {
      const source = readFileSync(path, "utf8");
      expect(source).not.toContain("RITOMER_LOCAL_DEMO_BEARER_TOKEN");
      expect(source).not.toMatch(/import\.meta\.env[\s\S]{0,160}(TOKEN|BEARER|AUTH)/i);
      expect(source).not.toMatch(/\b(localStorage|sessionStorage)\b/);
    }
    expect(readFileSync(join(root, "vite.config.ts"), "utf8")).not.toMatch(/\bconsole\./);
  });
});
