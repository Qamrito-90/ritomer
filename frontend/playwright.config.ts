import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.spec.ts",
  outputDir: "./out/playwright-tooling-smoke",
  workers: 1,
  retries: 0,
  timeout: 20_000,
  globalTimeout: 60_000,
  expect: { timeout: 5_000 },
  reporter: [["list", { printSteps: true }]],
  use: {
    browserName: "chromium",
    headless: true,
    launchOptions: { timeout: 10_000 },
    actionTimeout: 5_000,
    navigationTimeout: 5_000,
    acceptDownloads: false,
    trace: "off",
    video: "off",
    screenshot: "off"
  }
});
