/**
 * Initial hardcoded scan rule set (M04 scope — rule editing UI is M08).
 *
 * Each entry's `pattern` is a JS regex source string, kept in sync with the
 * `ScanRule.pattern` column so the same value seeded into the DB
 * (apps/web/prisma/seed.ts) is what the worker evaluates at runtime. The
 * worker always re-reads enabled ScanRule rows from the DB rather than this
 * array directly — this file is the source-of-truth used only by the seed
 * script, so admins can later edit rows in the DB (M08) without touching
 * worker code.
 *
 * Patterns intentionally match the *shape* of a credential (prefix + charset
 * + length) without requiring flags that could catch multi-line code; each
 * is designed to isolate the exact secret substring as capture group 1 (or
 * the whole match if there is no separate prefix) so the scanner can redact
 * precisely — see apps/worker/src/rules/engine.ts.
 */
export interface ScanRuleDefinition {
  name: string;
  pattern: string;
  /** Rules flagged as entropy-based get additional Shannon-entropy scoring, not just regex shape. */
  kind: "regex" | "entropy";
  enabled: boolean;
}

export const INITIAL_SCAN_RULES: ScanRuleDefinition[] = [
  {
    name: "AWS Access Key",
    pattern: "(?:AKIA|ASIA)[0-9A-Z]{16}",
    kind: "regex",
    enabled: true,
  },
  {
    name: "AWS Secret Key",
    // Matches a 40-char base64-ish value commonly assigned to
    // aws_secret_access_key / AWS_SECRET_ACCESS_KEY.
    pattern: "(?:aws_secret_access_key|AWS_SECRET_ACCESS_KEY)\\s*[:=]\\s*['\"]?([A-Za-z0-9/+=]{40})['\"]?",
    kind: "regex",
    enabled: true,
  },
  {
    name: "GitHub Token",
    // Classic PAT (ghp_), fine-grained PAT (github_pat_), OAuth (gho_), etc.
    pattern: "(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]{22,255}",
    kind: "regex",
    enabled: true,
  },
  {
    name: "Stripe Secret Key",
    pattern: "sk_(?:live|test)_[A-Za-z0-9]{24,99}",
    kind: "regex",
    enabled: true,
  },
  {
    name: "Slack Token",
    pattern: "xox[baprs]-[A-Za-z0-9-]{10,72}",
    kind: "regex",
    enabled: true,
  },
  {
    name: "Generic High-Entropy String",
    // Broad candidate shape (quoted assignment to a key/secret/token/password
    // -like variable name); the entropy scorer in engine.ts does the real
    // filtering to avoid drowning findings in false positives.
    pattern: "(?:api[_-]?key|secret|token|password|passwd|pwd)\\s*[:=]\\s*['\"]([A-Za-z0-9_\\-/+]{20,100})['\"]",
    kind: "entropy",
    enabled: true,
  },
];
