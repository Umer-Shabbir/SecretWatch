import { describe, expect, it } from "vitest";
import { evaluateRule, evaluateAllRules } from "../rules/engine";
import { INITIAL_SCAN_RULES } from "../rules/definitions";
import { shannonEntropy, isHighEntropy } from "../rules/entropy";

// Obviously-fake fixtures only — never realistic-looking secrets.
// Sourced from env (see .env.test.example) so no pattern-shaped literal sits
// in source; fallback defaults below are built by concatenation (not a
// contiguous literal) so secret scanners don't flag the test file itself.
// Lengths match each rule's regex exactly (AWS: 16 chars post-prefix, GH
// classic PAT: 36, Stripe: 24+, Slack: 10+) — see rules/definitions.ts.
const FAKE_AWS_KEY = process.env.TEST_FAKE_AWS_KEY ?? ["AKIA", "FAKE".repeat(4)].join(""); // 16 chars
const FAKE_STRIPE_KEY = process.env.TEST_FAKE_STRIPE_KEY ?? ["sk_live_", "FAKE".repeat(6)].join(""); // 24 chars
const FAKE_SLACK_TOKEN = process.env.TEST_FAKE_SLACK_TOKEN ?? ["xoxb-", "FAKE".repeat(8)].join(""); // 32 chars
const FAKE_GH_TOKEN = process.env.TEST_FAKE_GH_TOKEN ?? ["ghp_", "FAKE".repeat(9)].join(""); // 36 chars

function ruleByName(name: string) {
  const rule = INITIAL_SCAN_RULES.find((r) => r.name === name);
  if (!rule) throw new Error(`fixture rule not found: ${name}`);
  return rule;
}

describe("evaluateRule — AWS Access Key", () => {
  it("matches a canonical AKIA-prefixed key and isolates the exact span", async () => {
    const snippet = `aws_access_key_id = "${FAKE_AWS_KEY}"`;
    const match = await evaluateRule(ruleByName("AWS Access Key"), snippet);
    expect(match).not.toBeNull();
    expect(match!.matchedSecret).toBe(FAKE_AWS_KEY);
    expect(match!.redactedSnippet).not.toContain(FAKE_AWS_KEY);
  });

  it("does not match ordinary code with no key-shaped substring", async () => {
    const match = await evaluateRule(ruleByName("AWS Access Key"), "const x = computeTotal(items);");
    expect(match).toBeNull();
  });
});

describe("evaluateRule — Stripe Secret Key", () => {
  it("matches sk_live_ prefixed values", async () => {
    const snippet = `STRIPE_KEY=${FAKE_STRIPE_KEY}`;
    const match = await evaluateRule(ruleByName("Stripe Secret Key"), snippet);
    expect(match).not.toBeNull();
    expect(match!.matchedSecret).toBe(FAKE_STRIPE_KEY);
  });
});

describe("evaluateRule — Slack Token", () => {
  it("matches xoxb- prefixed values", async () => {
    const snippet = `token: '${FAKE_SLACK_TOKEN}'`;
    const match = await evaluateRule(ruleByName("Slack Token"), snippet);
    expect(match).not.toBeNull();
    expect(match!.matchedSecret).toBe(FAKE_SLACK_TOKEN);
  });
});

describe("evaluateRule — GitHub Token", () => {
  it("matches ghp_ prefixed classic PATs", async () => {
    const snippet = `Authorization: Bearer ${FAKE_GH_TOKEN}`;
    const match = await evaluateRule(ruleByName("GitHub Token"), snippet);
    expect(match).not.toBeNull();
    expect(match!.matchedSecret).toBe(FAKE_GH_TOKEN);
  });
});

describe("evaluateRule — Generic High-Entropy String (entropy-gated)", () => {
  it("rejects a low-entropy quoted assignment (e.g. a placeholder-looking string)", async () => {
    const snippet = `secret = "aaaaaaaaaaaaaaaaaaaaaaaa"`;
    const match = await evaluateRule(ruleByName("Generic High-Entropy String"), snippet);
    expect(match).toBeNull();
  });

  it("accepts a genuinely high-entropy quoted assignment", async () => {
    const snippet = `secret = "aZ8kQ2vM9pL3wR7xT1nB5cF6"`;
    const match = await evaluateRule(ruleByName("Generic High-Entropy String"), snippet);
    expect(match).not.toBeNull();
  });
});

describe("evaluateRule — malformed pattern safety", () => {
  it("returns null instead of throwing when the rule pattern is invalid regex", async () => {
    const badRule = { name: "Broken Rule", pattern: "(unclosed", kind: "regex" as const };
    await expect(evaluateRule(badRule, "anything")).resolves.toBeNull();
  });
});

describe("evaluateRule — catastrophic-backtracking pattern safety", () => {
  it("resolves to null within the worker timeout instead of hanging the caller", async () => {
    // A pattern this shaped is rejected at admin-write-time by
    // apps/web/lib/scanRules.ts, but this test proves the worker-side
    // execution timeout (apps/worker/src/rules/safe-exec.ts) is the actual
    // backstop regardless of whether a bad pattern ever reaches here (e.g.
    // pre-existing DB rows from before that validation existed).
    const evilRule = { name: "Evil Rule", pattern: "(a|aa)+b", kind: "regex" as const };
    const adversarialInput = "a".repeat(40);
    const start = Date.now();
    const match = await evaluateRule(evilRule, adversarialInput);
    const elapsed = Date.now() - start;
    expect(match).toBeNull();
    // Generous upper bound vs. the 250ms internal budget to absorb worker
    // thread spin-up/CI scheduling jitter — this is asserting "did not hang
    // indefinitely", not measuring the exact budget.
    expect(elapsed).toBeLessThan(5000);
  }, 10000);
});

describe("evaluateAllRules", () => {
  it("returns matches from every rule that trips on a snippet, not just the first", async () => {
    const snippet = `aws_access_key_id = "${FAKE_AWS_KEY}"\nSTRIPE_KEY=${FAKE_STRIPE_KEY}`;
    const matches = await evaluateAllRules(
      [
        { name: "AWS Access Key", pattern: ruleByName("AWS Access Key").pattern, kind: "regex" },
        { name: "Stripe Secret Key", pattern: ruleByName("Stripe Secret Key").pattern, kind: "regex" },
      ],
      snippet
    );
    expect(matches).toHaveLength(2);
    const ruleNames = matches.map((m) => m.ruleName).sort();
    expect(ruleNames).toEqual(["AWS Access Key", "Stripe Secret Key"].sort());
  });

  it("never leaks a raw secret through the aggregate result's redactedSnippet fields", async () => {
    const snippet = `aws_access_key_id = "${FAKE_AWS_KEY}"`;
    const matches = await evaluateAllRules(
      [{ name: "AWS Access Key", pattern: ruleByName("AWS Access Key").pattern, kind: "regex" }],
      snippet
    );
    for (const m of matches) {
      expect(m.redactedSnippet).not.toContain(FAKE_AWS_KEY);
    }
  });
});

describe("entropy scoring", () => {
  it("scores repeated-character strings as low entropy", () => {
    expect(isHighEntropy("aaaaaaaaaaaaaaaaaaaaaaaa")).toBe(false);
  });

  it("scores mixed-case alphanumeric strings as high entropy", () => {
    expect(shannonEntropy("aZ8kQ2vM9pL3wR7xT1nB5cF6")).toBeGreaterThan(3.0);
  });
});
