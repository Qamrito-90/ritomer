import { defineConfig, type ConfigEnv, type ResolvedConfig, type UserConfig } from "vite";
import react from "@vitejs/plugin-react";

type ViteEnvironment = Record<string, string | undefined>;

const BACKEND_TARGET = "http://127.0.0.1:8080";

export function assertResolvedLocalSessionConfig(config: ResolvedConfig): void {
  const server = config.server;
  const proxy = server.proxy?.["/api"];
  if (server.host !== "127.0.0.1" || server.port !== 5173 || server.strictPort !== true
    || server.https !== undefined || server.origin !== undefined
    || Object.keys(server.proxy ?? {}).length !== 1
    || typeof proxy !== "object" || proxy.target !== BACKEND_TARGET
    || proxy.changeOrigin !== true || proxy.xfwd !== false
    || Object.keys(proxy).some((key) => !["target", "changeOrigin", "xfwd"].includes(key))) {
    throw new Error("LOCAL_SESSION_RESOLVED_CONFIGURATION_REFUSED");
  }
}

export function createRitomerViteConfig(
  configEnv: Pick<ConfigEnv, "command"> & { isPreview?: boolean },
  environment: ViteEnvironment = process.env
): UserConfig {
  const baseConfig: UserConfig = {
    plugins: [react()]
  };

  if (configEnv.command !== "serve" || configEnv.isPreview === true) {
    return baseConfig;
  }

  if (Object.keys(environment).some((name) =>
    /^(RITOMER_LOCAL_DEMO_PROXY_AUTH_ENABLED|RITOMER_LOCAL_DEMO_BEARER_TOKEN|RITOMER_SECURITY_JWT_HMAC_SECRET)$/i.test(name)
  )) throw new Error("LOCAL_SESSION_LEGACY_AUTH_CONFIGURATION_REFUSED");
  const target = environment.RITOMER_LOCAL_DEMO_BACKEND_TARGET;
  if (target !== undefined && target !== BACKEND_TARGET) {
    throw new Error("LOCAL_SESSION_BACKEND_TARGET_REFUSED");
  }

  return {
    ...baseConfig,
    plugins: [...(baseConfig.plugins ?? []), {
      name: "ritomer-local-session-boundary",
      enforce: "post",
      configResolved: assertResolvedLocalSessionConfig
    }],
    server: {
      host: "127.0.0.1",
      port: 5173,
      strictPort: true,
      proxy: { "/api": { target: BACKEND_TARGET, changeOrigin: true, xfwd: false } }
    }
  };
}

export default defineConfig((configEnv) => createRitomerViteConfig(configEnv));
