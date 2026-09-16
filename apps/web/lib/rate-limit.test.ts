import { describe, it, expect, beforeEach } from "vitest";
import { getClientIp, checkRateLimit } from "./rate-limit";

describe("getClientIp", () => {
  it("uses NextRequest.ip when present", () => {
    const req = {
      ip: "192.0.2.1",
      headers: new Headers({
        "x-forwarded-for": "10.0.0.1, 10.0.0.2",
        "cf-connecting-ip": "10.0.0.3",
      }),
    };
    expect(getClientIp(req as any)).toBe("192.0.2.1");
  });

  it("extracts cf-connecting-ip when present", () => {
    const req = new Request("http://localhost", {
      headers: {
        "cf-connecting-ip": "203.0.113.195",
        "x-forwarded-for": "1.2.3.4, 5.6.7.8",
      },
    });
    expect(getClientIp(req)).toBe("203.0.113.195");
  });

  it("extracts x-real-ip when cf-connecting-ip is not present", () => {
    const req = new Request("http://localhost", {
      headers: {
        "x-real-ip": "198.51.100.50",
        "x-forwarded-for": "1.2.3.4, 5.6.7.8",
      },
    });
    expect(getClientIp(req)).toBe("198.51.100.50");
  });

  it("extracts the rightmost / closest proxy IP from x-forwarded-for to prevent spoofing", () => {
    const req = new Request("http://localhost", {
      headers: {
        "x-forwarded-for": "198.51.100.1, 198.51.100.2, 198.51.100.99",
      },
    });
    // In naive parsing, it would return 198.51.100.1 (which client can forge).
    // Secure extraction takes the last entry appended by the trusted reverse proxy.
    expect(getClientIp(req)).toBe("198.51.100.99");
  });

  it("falls back to 127.0.0.1 when no proxy headers are present", () => {
    const req = new Request("http://localhost");
    expect(getClientIp(req)).toBe("127.0.0.1");
  });
});

describe("checkRateLimit", () => {
  it("enforces rate limits per key in-memory", async () => {
    const key = "test-rate-limit-key";
    for (let i = 0; i < 3; i++) {
      const result = await checkRateLimit(key, { limit: 3, windowMs: 10000 });
      expect(result.allowed).toBe(true);
    }

    const exceeded = await checkRateLimit(key, { limit: 3, windowMs: 10000 });
    expect(exceeded.allowed).toBe(false);
    expect(exceeded.retryAfterMs).toBeGreaterThan(0);
  });
});
