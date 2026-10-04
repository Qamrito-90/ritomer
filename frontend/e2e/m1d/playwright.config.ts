import { defineConfig } from "@playwright/test";
import { readBinding } from "./evidence";

const binding = readBinding(process.env, process.argv);
export default defineConfig({
  testDir: ".", testMatch: "session.spec.ts",
  outputDir: binding.discovery ? "../../out/m1d-discovery-unused" : `${binding.root}/volatile/playwright-${binding.kind}`,
  workers: 1, retries: 0, maxFailures: 1, fullyParallel: false, forbidOnly: true,
  timeout: binding.kind === "cookie" ? 180_000 : 2_700_000,
  globalTimeout: binding.kind === "cookie" ? 190_000 : 2_710_000,
  reporter: [["./evidence.ts", binding]],
  projects: [{ name: "cookie", grep: /\bm1d-cookie$/ }, { name: "browser", grep: /\bm1d-browser$/ }],
  use: { trace: "off", screenshot: "off", video: "off", actionTimeout: 10_000, navigationTimeout: 10_000, acceptDownloads: false }
});
