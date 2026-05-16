import { defineConfig, type ConfigEnv, type UserConfig } from "vite";
import react from "@vitejs/plugin-react";

type ViteEnvironment = Record<string, string | undefined>;

const DEFAULT_LOCAL_DEMO_BACKEND_TARGET = "http://localhost:8080";
const LOCAL_DEMO_BACKEND_TARGET_ENV = "RITOMER_LOCAL_DEMO_BACKEND_TARGET";
const LOCAL_DEMO_PROXY_AUTH_ENABLED_ENV = "RITOMER_LOCAL_DEMO_PROXY_AUTH_ENABLED";
const LOCAL_DEMO_BEARER_TOKEN_ENV = "RITOMER_LOCAL_DEMO_BEARER_TOKEN";

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

  return {
    ...baseConfig,
    server: {
      proxy: {
        "/api": createLocalDemoApiProxy(environment)
      }
    }
  };
}

function createLocalDemoApiProxy(environment: ViteEnvironment) {
  const target = normalizeProxyTarget(
    environment[LOCAL_DEMO_BACKEND_TARGET_ENV] ?? DEFAULT_LOCAL_DEMO_BACKEND_TARGET
  );
  const authEnabled = environment[LOCAL_DEMO_PROXY_AUTH_ENABLED_ENV] === "true";
  const targetIsLocal = isLocalBackendTarget(target);

  if (authEnabled && !targetIsLocal) {
    throw new Error(
      `${LOCAL_DEMO_PROXY_AUTH_ENABLED_ENV}=true is allowed only for localhost or 127.0.0.1 targets.`
    );
  }

  if (!authEnabled) {
    return {
      target,
      changeOrigin: true,
      secure: false
    };
  }

  const bearerToken = environment[LOCAL_DEMO_BEARER_TOKEN_ENV]?.trim();

  if (bearerToken === undefined || bearerToken.length === 0) {
    throw new Error(
      `${LOCAL_DEMO_PROXY_AUTH_ENABLED_ENV}=true requires ${LOCAL_DEMO_BEARER_TOKEN_ENV} in the local shell environment.`
    );
  }

  return {
    target,
    changeOrigin: true,
    secure: false,
    headers: {
      Authorization: `Bearer ${bearerToken}`
    }
  };
}

function normalizeProxyTarget(rawTarget: string) {
  const trimmedTarget = rawTarget.trim();

  if (trimmedTarget.length === 0) {
    return DEFAULT_LOCAL_DEMO_BACKEND_TARGET;
  }

  let parsedTarget: URL;

  try {
    parsedTarget = new URL(trimmedTarget);
  } catch {
    throw new Error(`${LOCAL_DEMO_BACKEND_TARGET_ENV} must be an absolute HTTP(S) URL.`);
  }

  if (parsedTarget.protocol !== "http:" && parsedTarget.protocol !== "https:") {
    throw new Error(`${LOCAL_DEMO_BACKEND_TARGET_ENV} must use http or https.`);
  }

  if (parsedTarget.username.length > 0 || parsedTarget.password.length > 0) {
    throw new Error(`${LOCAL_DEMO_BACKEND_TARGET_ENV} must not include credentials.`);
  }

  return parsedTarget.origin;
}

function isLocalBackendTarget(target: string) {
  const hostname = new URL(target).hostname;
  return hostname === "localhost" || hostname === "127.0.0.1";
}

export default defineConfig((configEnv) => createRitomerViteConfig(configEnv));
