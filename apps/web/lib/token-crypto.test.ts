import { describe, expect, it, beforeAll } from "vitest";
import crypto from "node:crypto";
import { encrypt, decrypt, maskToken } from "./token-crypto";

// Obviously-fake fixtures only — never realistic-looking secrets. Built by
// concatenation (not a contiguous literal) so secret scanners don't flag
// this file — see apps/worker/src/__tests__/rules-engine.test.ts.
const FAKE_PAT = ["ghp_", "FAKE".repeat(9)].join(""); // 36 chars
const FAKE_OAUTH_TOKEN = ["gho_", "FAKE".repeat(9)].join(""); // 36 chars

beforeAll(() => {
  // Deterministic 32-byte test key, base64-encoded — test-only, never a real secret.
  process.env.TOKEN_ENCRYPTION_KEY = crypto.randomBytes(32).toString("base64");
});

describe("encrypt/decrypt round-trip", () => {
  it("decrypts back to the original plaintext", () => {
    const ciphertext = encrypt(FAKE_PAT);
    expect(decrypt(ciphertext)).toBe(FAKE_PAT);
  });

  it("produces different ciphertext for the same plaintext each call (random IV)", () => {
    const a = encrypt(FAKE_PAT);
    const b = encrypt(FAKE_PAT);
    expect(a).not.toBe(b);
  });

  it("never leaks the plaintext inside the ciphertext blob", () => {
    const ciphertext = encrypt(FAKE_PAT);
    expect(ciphertext).not.toContain(FAKE_PAT);
    expect(ciphertext.toLowerCase()).not.toContain("fakefake");
  });

  it("throws on tampered ciphertext instead of returning garbage", () => {
    const ciphertext = encrypt(FAKE_PAT);
    const buf = Buffer.from(ciphertext, "base64");
    buf[buf.length - 1] ^= 0xff; // flip last byte of ciphertext
    const tampered = buf.toString("base64");
    expect(() => decrypt(tampered)).toThrow();
  });

  it("throws a generic error message that does not include key/plaintext material", () => {
    const ciphertext = encrypt(FAKE_PAT);
    const buf = Buffer.from(ciphertext, "base64");
    buf[buf.length - 1] ^= 0xff;
    try {
      decrypt(buf.toString("base64"));
      expect.unreachable();
    } catch (err) {
      const message = (err as Error).message;
      expect(message).not.toContain(FAKE_PAT);
      expect(message.toLowerCase()).not.toContain("fakefake");
    }
  });

  it("rejects empty/invalid input without throwing a decrypt-specific leak", () => {
    expect(() => encrypt("")).toThrow();
    expect(() => decrypt("")).toThrow();
    expect(() => decrypt("not-valid-base64-blob")).toThrow();
  });
});

describe("maskToken", () => {
  it("preserves the recognized prefix and last 4 characters, masking the middle", () => {
    const masked = maskToken(FAKE_PAT);
    expect(masked.startsWith("ghp_")).toBe(true);
    expect(masked.endsWith(FAKE_PAT.slice(-4))).toBe(true);
    expect(masked).toContain("•");
  });

  it("never includes the full raw token value", () => {
    const masked = maskToken(FAKE_PAT);
    expect(masked).not.toBe(FAKE_PAT);
    expect(masked).not.toContain(FAKE_PAT.slice(4, -4));
  });

  it("works for gho_ prefixed OAuth-derived tokens too", () => {
    const masked = maskToken(FAKE_OAUTH_TOKEN);
    expect(masked.startsWith("gho_")).toBe(true);
    expect(masked.endsWith(FAKE_OAUTH_TOKEN.slice(-4))).toBe(true);
  });

  it("throws on empty input", () => {
    expect(() => maskToken("")).toThrow();
  });
});
