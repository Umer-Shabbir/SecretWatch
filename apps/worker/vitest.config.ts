import { defineConfig } from "vitest/config";
import path from "node:path";
import fs from "node:fs";

// Loads apps/worker/.env.test (gitignored, optional) if present, so fixture
// values in rules-engine.test.ts can be overridden from env instead of the
// concatenation-built defaults in the test file. No example file is checked
// in — pattern-shaped secret strings trip GitHub push protection even as
// fake fixtures, so real .env.test creation is left to local setup.
function loadDotEnvTest() {
  const envPath = path.resolve(__dirname, ".env.test");
  if (!fs.existsSync(envPath)) return {};
  const env: Record<string, string> = {};
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    env[key] = value;
  }
  return env;
}

export default defineConfig({
  resolve: {
    alias: {
      "@secretwatch/shared": path.resolve(__dirname, "../../packages/shared/src/index.ts"),
    },
  },
  test: {
    environment: "node",
    // Give the regex sandbox a wide budget under test: files run in parallel
    // worker processes, so a benign regex round-trip through the worker_thread
    // can exceed the 250ms production budget purely from CPU contention and
    // spuriously resolve null. Real .env.test still overrides. Prod default
    // (250ms) is untouched — see src/rules/safe-exec.ts.
    env: { REGEX_TIMEOUT_MS: "2000", ...loadDotEnvTest() },
  },
});
