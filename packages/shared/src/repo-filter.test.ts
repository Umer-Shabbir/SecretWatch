import { describe, expect, it } from "vitest";
import { matchesRepoPattern, evaluateRepoFilters, type RepoFilterRule } from "./repo-filter";

describe("matchesRepoPattern", () => {
  it("matches exact repo full names case-insensitively", () => {
    expect(matchesRepoPattern("facebook/react", "facebook/react")).toBe(true);
    expect(matchesRepoPattern("FaceBook/React", "facebook/react")).toBe(true);
    expect(matchesRepoPattern("facebook/react", "FaceBook/React")).toBe(true);
    expect(matchesRepoPattern("facebook/react", "facebook/relay")).toBe(false);
  });

  it("matches org-level wildcards", () => {
    expect(matchesRepoPattern("my-org/backend", "my-org/*")).toBe(true);
    expect(matchesRepoPattern("my-org/frontend", "my-org/*")).toBe(true);
    expect(matchesRepoPattern("other-org/backend", "my-org/*")).toBe(false);
  });

  it("matches prefix, suffix, and substring wildcards", () => {
    expect(matchesRepoPattern("acme/test-app", "*/test-*")).toBe(true);
    expect(matchesRepoPattern("acme/production-app", "*/test-*")).toBe(false);
    expect(matchesRepoPattern("acme/secretwatch-internal", "*-internal")).toBe(true);
    expect(matchesRepoPattern("acme/secretwatch-public", "*-internal")).toBe(false);
    expect(matchesRepoPattern("user/sandbox-repo", "*sandbox*")).toBe(true);
  });

  it("handles universal wildcard matching", () => {
    expect(matchesRepoPattern("any/repo", "*")).toBe(true);
    expect(matchesRepoPattern("any/repo", "*/*")).toBe(true);
  });

  it("returns false for empty or non-matching patterns", () => {
    expect(matchesRepoPattern("any/repo", "")).toBe(false);
    expect(matchesRepoPattern("foo/bar", "baz/qux")).toBe(false);
  });
});

describe("evaluateRepoFilters", () => {
  it("allows all repositories by default when no rules are configured", () => {
    const res = evaluateRepoFilters("owner/repo", []);
    expect(res.allowed).toBe(true);
  });

  it("blocks repositories matching a blocklist rule", () => {
    const rules: RepoFilterRule[] = [
      { id: "1", type: "BLOCK", pattern: "archive/*", enabled: true },
    ];
    const res1 = evaluateRepoFilters("archive/old-repo", rules);
    expect(res1.allowed).toBe(false);
    expect(res1.matchedRule?.pattern).toBe("archive/*");

    const res2 = evaluateRepoFilters("active/new-repo", rules);
    expect(res2.allowed).toBe(true);
  });

  it("ignores disabled rules", () => {
    const rules: RepoFilterRule[] = [
      { id: "1", type: "BLOCK", pattern: "archive/*", enabled: false },
    ];
    const res = evaluateRepoFilters("archive/old-repo", rules);
    expect(res.allowed).toBe(true);
  });

  it("enforces allowlist rules when present", () => {
    const rules: RepoFilterRule[] = [
      { id: "1", type: "ALLOW", pattern: "my-company/*", enabled: true },
      { id: "2", type: "ALLOW", pattern: "partner/allowed-repo", enabled: true },
    ];

    expect(evaluateRepoFilters("my-company/backend", rules).allowed).toBe(true);
    expect(evaluateRepoFilters("partner/allowed-repo", rules).allowed).toBe(true);
    expect(evaluateRepoFilters("partner/other-repo", rules).allowed).toBe(false);
    expect(evaluateRepoFilters("random-user/repo", rules).allowed).toBe(false);
  });

  it("gives blocklist rules precedence over allowlist matches", () => {
    const rules: RepoFilterRule[] = [
      { id: "1", type: "ALLOW", pattern: "my-company/*", enabled: true },
      { id: "2", type: "BLOCK", pattern: "my-company/*-internal-tests", enabled: true },
    ];

    expect(evaluateRepoFilters("my-company/production-service", rules).allowed).toBe(true);
    const blockedRes = evaluateRepoFilters("my-company/secret-internal-tests", rules);
    expect(blockedRes.allowed).toBe(false);
    expect(blockedRes.matchedRule?.pattern).toBe("my-company/*-internal-tests");
  });
});
