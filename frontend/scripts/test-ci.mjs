import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, URL } from "node:url";

const frontend = fileURLToPath(new URL("../", import.meta.url));
const browserFile = path.join(frontend, "m1d-browser-evidence.test.ts");
// These existing native cases remain skips on non-Windows hosts, never passes.
export const windowsOnlyCases = [
  ["local-two-actor-harness.test.ts", "real CLI diagnostic producer and first failure > carries actual CLI bytes through the native rail parser and actual terminal payload"],
  ...[
    "uses one real article for the note and save button and reports the reproduced ambiguity safely",
    "scopes reviewer read-only evidence to Preuves instead of hidden Mapping",
    "observes native A tab transitions beside isolated B and confirms owned Chromium exit and profile removal",
    "diagnoses native expiry body consumption with separately closed HTTP variants",
    "logoutNative compares a hidden A1 click with explicit native activation after A2 and recreated B",
    "closed browser failure diagnostics > carries scenario-v1 bytes through real rail drain and terminal readback, rejecting wrong bindings and channels",
    "closed browser failure diagnostics > carries scenario-v2 bytes through real rail drain and terminal readback, rejecting wrong bindings and channels",
    "closed browser failure diagnostics > carries reporter-v2 bytes through real rail drain and terminal readback, rejecting wrong bindings and channels",
    "cookie diagnostics on the real scenario and reporter path > carries a real scenario failure through the reporter, native rail drain and terminal readback"
  ].map(title => ["m1d-browser-evidence.test.ts", title])
];
const identity = (file, title) => JSON.stringify([file, title]);
const ensure = condition => { if (!condition) throw new Error("TEST_CI_INVALID_GROUP"); };

export function validateGroup(group, result, report, platform = process.platform) {
  ensure(group === "ordinary" || group === "browser");
  ensure(result?.status === 0 && result.signal === null && !result.error);
  ensure(report?.success === true && Array.isArray(report.testResults) && report.testResults.length > 0);
  const files = new Set(), skipped = [], identities = [];
  let passed = 0;
  for (const file of report.testResults) {
    const name = path.resolve(file.name), relative = path.relative(frontend, name).replaceAll("\\", "/");
    ensure(!files.has(name) && file.status === "passed"); files.add(name);
    ensure(group === "ordinary" ? name !== browserFile : name === browserFile);
    ensure(Array.isArray(file.assertionResults) && file.assertionResults.length > 0);
    for (const test of file.assertionResults) {
      ensure(Array.isArray(test.ancestorTitles) && typeof test.title === "string");
      const id = identity(relative, [...test.ancestorTitles, test.title].join(" > "));
      identities.push(id); // Preserve multiplicity; some historical names repeat.
      if (test.status === "passed") passed++;
      else { ensure(test.status === "skipped" && platform !== "win32"); skipped.push(id); }
    }
  }
  ensure(group === "ordinary" || files.size === 1);
  const expectedSkips = platform === "win32" ? [] : windowsOnlyCases
    .filter(([file]) => group === "ordinary" ? file !== "m1d-browser-evidence.test.ts" : file === "m1d-browser-evidence.test.ts")
    .map(([file, title]) => identity(file, title)).sort();
  ensure(JSON.stringify(skipped.sort()) === JSON.stringify(expectedSkips));
  ensure(passed > 0 && report.numTotalTests === identities.length && report.numPassedTests === passed
    && report.numPendingTests === skipped.length && report.numFailedTests === 0 && report.numTodoTests === 0);
  return { files: [...files], identities, passed, skipped: skipped.length };
}

export function runTestCi(args = [], execute, platform = process.platform) {
  if (args.length) { process.stderr.write("test:ci runs the complete corpus; use pnpm exec vitest for targeted diagnostics.\n"); return 1; }
  if (!execute) {
    const output = path.resolve(frontend, "../out/frontend-test-ci"); mkdirSync(output, { recursive: true });
    const reports = mkdtempSync(path.join(output, "run-"));
    const vitest = createRequire(import.meta.url).resolve("vitest/vitest.mjs");
    process.stdout.write(`TEST_CI_REPORTS ${reports}\n`);
    execute = group => {
      const reportPath = path.join(reports, `${group}.json`);
      const selection = group === "ordinary" ? ["--exclude=m1d-browser-evidence.test.ts"] : [browserFile];
      const result = spawnSync(process.execPath, [vitest, "run", "--config=vitest.config.ts", "--isolate", "--allowOnly=false",
        "--passWithNoTests=false", "--dangerouslyIgnoreUnhandledErrors=false", "--retry=0", "--bail=0",
        "--reporter=default", "--reporter=json", `--outputFile.json=${reportPath}`, ...selection],
      { cwd: frontend, shell: false, windowsHide: true, stdio: "inherit", env: process.env });
      return { result, report: JSON.parse(readFileSync(reportPath, "utf8")) };
    };
  }
  let failed = false;
  const files = new Set();
  for (const group of ["ordinary", "browser"]) {
    try {
      const { result, report } = execute(group);
      const summary = validateGroup(group, result, report, platform);
      for (const file of summary.files) { ensure(!files.has(file)); files.add(file); }
      process.stdout.write(`TEST_CI_GROUP ${JSON.stringify({ group, files: summary.files.length, passed: summary.passed, skipped: summary.skipped })}\n`);
    } catch { failed = true; process.stderr.write(`TEST_CI_GROUP_FAILED ${group}\n`); }
    // A first failure never suppresses the second group or changes its result.
  }
  return failed ? 1 : 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  process.exitCode = runTestCi(process.argv.slice(2));
