import { describe, expect, it } from "vitest";
import { redactSnippet, maskSecretValue } from "@secretwatch/shared";

// Obviously-fake fixtures only — never realistic-looking secrets. Built by
// concatenation (not a contiguous literal) so secret scanners don't flag
// this file — see apps/worker/src/__tests__/rules-engine.test.ts.
const FAKE_AWS_KEY = ["AKIA", "FAKE".repeat(4)].join(""); // 16 chars
const FAKE_GH_TOKEN = ["ghp_", "FAKE".repeat(9)].join(""); // 36 chars

describe("redactSnippet", () => {
  it("never includes the raw secret substring in the output", () => {
    const snippet = `const key = "${FAKE_AWS_KEY}";`;
    const redacted = redactSnippet(snippet, FAKE_AWS_KEY);
    expect(redacted).not.toContain(FAKE_AWS_KEY);
  });

  it("masks every occurrence when the secret appears more than once", () => {
    const snippet = `${FAKE_GH_TOKEN} ... duplicate ref ${FAKE_GH_TOKEN}`;
    const redacted = redactSnippet(snippet, FAKE_GH_TOKEN);
    expect(redacted).not.toContain(FAKE_GH_TOKEN);
    expect(redacted.split("•").length).toBeGreaterThan(1);
  });

  it("preserves surrounding non-secret context", () => {
    const snippet = `const key = "${FAKE_AWS_KEY}"; // aws prod key`;
    const redacted = redactSnippet(snippet, FAKE_AWS_KEY);
    expect(redacted).toContain("const key =");
    expect(redacted).toContain("aws prod key");
  });

  it("clamps overly long snippets", () => {
    const longSnippet = "x".repeat(500) + FAKE_AWS_KEY;
    const redacted = redactSnippet(longSnippet, FAKE_AWS_KEY, 100);
    expect(redacted.length).toBeLessThanOrEqual(101); // +1 for ellipsis char
  });

  it("fails closed (does not persist raw content) when no secret span is given", () => {
    const snippet = `const key = "${FAKE_AWS_KEY}";`;
    const redacted = redactSnippet(snippet, "");
    expect(redacted).not.toContain(FAKE_AWS_KEY);
    expect(redacted).toBe("[unredactable: no secret span isolated]");
  });
});

describe("maskSecretValue", () => {
  it("never returns the original value", () => {
    expect(maskSecretValue(FAKE_AWS_KEY)).not.toBe(FAKE_AWS_KEY);
    expect(maskSecretValue(FAKE_GH_TOKEN)).not.toBe(FAKE_GH_TOKEN);
  });

  it("fully masks short values with no visible edges", () => {
    const short = "abc123";
    const masked = maskSecretValue(short);
    expect(masked).not.toContain(short);
    expect(masked).toBe("•".repeat(8));
  });

  it("shows only a small prefix/suffix for longer values", () => {
    const masked = maskSecretValue(FAKE_GH_TOKEN);
    expect(masked.startsWith(FAKE_GH_TOKEN.slice(0, 4))).toBe(true);
    expect(masked.endsWith(FAKE_GH_TOKEN.slice(-4))).toBe(true);
    expect(masked).not.toContain(FAKE_GH_TOKEN.slice(4, -4));
  });
});
