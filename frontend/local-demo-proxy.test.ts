// @vitest-environment node

import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ProxyOptions } from "vite";
import { describe, expect, it } from "vitest";
import { createRitomerViteConfig } from "./vite.config";

type TestEnvironment = Record<string, string | undefined>;

const frontendRoot = fileURLToPath(new URL(".", import.meta.url));
const clientSourceRoots = [join(frontendRoot, "src"), join(frontendRoot, "index.html")];

describe("Vite local demo proxy", () => {
  it("exposes a dev-only /api proxy with the local backend target by default", () => {
    const proxy = getApiProxy({});

    expect(proxy.target).toBe("http://localhost:8080");
    expect(proxy.changeOrigin).toBe(true);
    expect(proxy.secure).toBe(false);
    expect(proxy.headers).toBeUndefined();
  });

  it("keeps the proxy out of production builds", () => {
    const config = createRitomerViteConfig(
      { command: "build" },
      {
        RITOMER_LOCAL_DEMO_PROXY_AUTH_ENABLED: "true",
        RITOMER_LOCAL_DEMO_BEARER_TOKEN: "<opaque-shell-value>"
      }
    );

    expect(config.server?.proxy).toBeUndefined();
  });

  it("keeps the proxy out of Vite preview", () => {
    const config = createRitomerViteConfig(
      { command: "serve", isPreview: true },
      {
        RITOMER_LOCAL_DEMO_PROXY_AUTH_ENABLED: "true",
        RITOMER_LOCAL_DEMO_BEARER_TOKEN: "<opaque-shell-value>"
      }
    );

    expect(config.server?.proxy).toBeUndefined();
  });

  it("lets the backend target be configured without enabling proxy auth", () => {
    const proxy = getApiProxy({
      RITOMER_LOCAL_DEMO_BACKEND_TARGET: "http://127.0.0.1:18080"
    });

    expect(proxy.target).toBe("http://127.0.0.1:18080");
    expect(proxy.headers).toBeUndefined();
  });

  it("adds Authorization only when local demo proxy auth is enabled for a local target", () => {
    const proxy = getApiProxy({
      RITOMER_LOCAL_DEMO_PROXY_AUTH_ENABLED: "true",
      RITOMER_LOCAL_DEMO_BEARER_TOKEN: "<opaque-shell-value>"
    });

    expect(proxy.headers).toEqual({
      Authorization: "Bearer <opaque-shell-value>"
    });
  });

  it("fails fast without printing a token value when proxy auth is enabled without a token", () => {
    expect(() =>
      getApiProxy({
        RITOMER_LOCAL_DEMO_PROXY_AUTH_ENABLED: "true"
      })
    ).toThrow(
      "RITOMER_LOCAL_DEMO_PROXY_AUTH_ENABLED=true requires RITOMER_LOCAL_DEMO_BEARER_TOKEN"
    );
  });

  it("never injects Authorization for a non-local target and rejects auth mode there", () => {
    const proxy = getApiProxy({
      RITOMER_LOCAL_DEMO_BACKEND_TARGET: "https://backend.example.invalid"
    });

    expect(proxy.target).toBe("https://backend.example.invalid");
    expect(proxy.headers).toBeUndefined();

    expect(() =>
      getApiProxy({
        RITOMER_LOCAL_DEMO_BACKEND_TARGET: "https://backend.example.invalid",
        RITOMER_LOCAL_DEMO_PROXY_AUTH_ENABLED: "true",
        RITOMER_LOCAL_DEMO_BEARER_TOKEN: "<opaque-shell-value>"
      })
    ).toThrow("RITOMER_LOCAL_DEMO_PROXY_AUTH_ENABLED=true is allowed only");
  });

  it("keeps proxy bearer configuration and browser storage out of client code", () => {
    const clientSources = readClientSources();

    for (const source of clientSources) {
      expect(source).not.toContain("RITOMER_LOCAL_DEMO_BEARER_TOKEN");
      expect(source).not.toMatch(/import\.meta\.env[\s\S]{0,160}(TOKEN|BEARER|AUTH)/i);
      expect(source).not.toMatch(/VITE_[A-Z0-9_]*(TOKEN|BEARER|AUTH)/i);
      expect(source).not.toMatch(/\b(localStorage|sessionStorage)\b/);
    }
  });

  it("does not log token material or full proxy headers from Vite config", () => {
    const viteConfigSource = readFileSync(join(frontendRoot, "vite.config.ts"), "utf8");

    expect(viteConfigSource).not.toMatch(/\bconsole\./);
    expect(viteConfigSource).not.toMatch(/process\.env\.VITE_[A-Z0-9_]*/);
  });
});

function getApiProxy(environment: TestEnvironment): ProxyOptions {
  const config = createRitomerViteConfig({ command: "serve" }, environment);
  const proxy = config.server?.proxy;
  const apiProxy = typeof proxy === "object" ? proxy["/api"] : undefined;

  expect(typeof apiProxy).toBe("object");
  return apiProxy as ProxyOptions;
}

function readClientSources() {
  return clientSourceRoots.flatMap((sourceRoot) => {
    const stats = statSync(sourceRoot);
    return stats.isDirectory()
      ? collectTextFiles(sourceRoot).map((filePath) => readFileSync(filePath, "utf8"))
      : [readFileSync(sourceRoot, "utf8")];
  });
}

function collectTextFiles(root: string): string[] {
  return readdirSync(root).flatMap((entry) => {
    const entryPath = join(root, entry);
    const stats = statSync(entryPath);

    if (stats.isDirectory()) {
      return collectTextFiles(entryPath);
    }

    return isClientTextFile(entryPath) ? [entryPath] : [];
  });
}

function isClientTextFile(filePath: string) {
  return [".html", ".js", ".jsx", ".ts", ".tsx"].includes(extname(filePath));
}
