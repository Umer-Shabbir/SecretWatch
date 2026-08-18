import { redactSnippet } from "@secretwatch/shared";
import { isHighEntropy } from "./entropy";
import { execWithTimeout } from "./safe-exec";

export interface EvaluableRule {
  name: string;
  pattern: string;
  kind: "regex" | "entropy" | string;
}

export interface RuleMatch {
  ruleName: string;
  /** Exact matched secret substring — ONLY ever used in-memory to build a redacted snippet. Never persist or log this field. */
  matchedSecret: string;
  /** Snippet with matchedSecret masked — this is what's safe to persist. */
  redactedSnippet: string;
}

/**
 * Evaluates one rule against one code snippet/line. Returns a match only
 * when a genuine secret span was isolated (capture group 1 if the pattern
 * defines one, otherwise the whole match) and — for entropy-kind rules —
 * the isolated span passes the Shannon entropy bar.
 *
 * SECURITY: `matchedSecret` on the returned object is the one place in this
 * codebase that legitimately holds a raw secret value in memory. Callers
 * MUST NOT log it, persist it, or include it in error messages. Only
 * `redactedSnippet` (already masked) is safe to pass onward to Finding
 * persistence.
 *
 * SECURITY (ReDoS): `rule.pattern` is admin-editable (M08 Scan Rules).
 * apps/web/lib/scanRules.ts rejects obvious catastrophic-backtracking shapes
 * at write-time, but that is a heuristic, not a proof. The actual
 * availability guarantee is `execWithTimeout` below, which runs the regex on
 * a disposable worker thread with a hard wall-clock budget — a pattern that
 * blows up on adversarial scanned content can only ever hang that one
 * thread, never the scanner's event loop, and is treated as a non-match
 * (fail closed) if it doesn't finish in time.
 */
export async function evaluateRule(rule: EvaluableRule, snippet: string): Promise<RuleMatch | null> {
  // Fail fast on a pattern that can't even compile, without spending a
  // worker-thread round trip on it.
  try {
    // eslint-disable-next-line no-new
    new RegExp(rule.pattern);
  } catch {
    return null;
  }

  const match = await execWithTimeout(rule.pattern, snippet);
  if (!match) return null;

  const secretSpan = match.group1 ?? match.fullMatch;
  if (!secretSpan) return null;

  if (rule.kind === "entropy" && !isHighEntropy(secretSpan)) {
    return null;
  }

  return {
    ruleName: rule.name,
    matchedSecret: secretSpan,
    redactedSnippet: redactSnippet(snippet, secretSpan),
  };
}

/**
 * Evaluates every enabled rule against a snippet, returning all genuine
 * matches (a snippet can legitimately trip more than one rule).
 */
export async function evaluateAllRules(rules: EvaluableRule[], snippet: string): Promise<RuleMatch[]> {
  const matches: RuleMatch[] = [];
  for (const rule of rules) {
    const match = await evaluateRule(rule, snippet);
    if (match) matches.push(match);
  }
  return matches;
}
