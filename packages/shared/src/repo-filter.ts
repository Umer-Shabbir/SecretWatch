/**
 * Repository pattern matcher and filter engine.
 * Supports:
 * - Exact full name: "owner/repo" (case-insensitive)
 * - Org wildcards: "owner/*" (all repos under owner)
 * - Substring and prefix wildcards: "org/test-*", "*-internal", "*test*"
 * - Universal wildcard: "*" or all-repos
 */
export function matchesRepoPattern(repoFullName: string, pattern: string): boolean {
  const normRepo = repoFullName.trim().toLowerCase();
  const normPattern = pattern.trim().toLowerCase();

  if (!normPattern) return false;
  if (normPattern === "*" || normPattern === "*/*") return true;

  // Convert glob pattern to regular expression
  // Escape special regex chars except '*' and '?'
  const regexStr =
    "^" +
    normPattern
      .replace(/[.+^${}()|[\]\\]/g, "\\$&")
      .replace(/\*/g, ".*")
      .replace(/\?/g, ".") +
    "$";

  try {
    const reg = new RegExp(regexStr, "i");
    return reg.test(normRepo);
  } catch {
    return normRepo === normPattern;
  }
}

export interface RepoFilterRule {
  id?: string;
  type: "ALLOW" | "BLOCK";
  pattern: string;
  enabled?: boolean;
}

export interface RepoEvaluationResult {
  allowed: boolean;
  matchedRule?: RepoFilterRule;
  reason?: string;
}

/**
 * Evaluates a repository against active allowlist and blocklist rules.
 *
 * Precedence logic:
 * 1. Blocklist rules take absolute priority: if a repository matches ANY active blocklist rule, it is immediately rejected.
 * 2. If one or more active ALLOWLIST rules exist, the repository MUST match at least one allowlist rule to be allowed.
 * 3. If no allowlist rules are configured and no blocklist rule matched, the repository is allowed by default.
 */
export function evaluateRepoFilters(
  repoFullName: string,
  rules: RepoFilterRule[]
): RepoEvaluationResult {
  const activeRules = rules.filter((r) => r.enabled !== false);
  const allowRules = activeRules.filter((r) => r.type === "ALLOW");
  const blockRules = activeRules.filter((r) => r.type === "BLOCK");

  // 1. Blocklist evaluation
  for (const blockRule of blockRules) {
    if (matchesRepoPattern(repoFullName, blockRule.pattern)) {
      return {
        allowed: false,
        matchedRule: blockRule,
        reason: `Matched blocklist rule: "${blockRule.pattern}"`,
      };
    }
  }

  // 2. Allowlist evaluation
  if (allowRules.length > 0) {
    const matchedAllow = allowRules.find((r) =>
      matchesRepoPattern(repoFullName, r.pattern)
    );
    if (!matchedAllow) {
      return {
        allowed: false,
        reason: `Repository does not match any of the ${allowRules.length} active allowlist rule(s)`,
      };
    }
    return {
      allowed: true,
      matchedRule: matchedAllow,
      reason: `Matched allowlist rule: "${matchedAllow.pattern}"`,
    };
  }

  // 3. Default open when no allowlist specified
  return {
    allowed: true,
  };
}
