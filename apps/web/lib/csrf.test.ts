import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { validateCsrfOrigin } from "./csrf";

describe("CSRF Origin Validation", () => {
  it("allows safe methods regardless of origin", () => {
    const req = new NextRequest("https://secretwatch.app/api/findings", {
      method: "GET",
    });
    expect(validateCsrfOrigin(req)).toBe(true);
  });

  it("allows mutating requests to public endpoints", () => {
    const req = new NextRequest("https://secretwatch.app/api/public/tokens", {
      method: "POST",
      headers: {
        host: "secretwatch.app",
        origin: "https://attacker.com",
      },
    });
    expect(validateCsrfOrigin(req)).toBe(true);
  });

  it("allows mutating requests to auth endpoints", () => {
    const req = new NextRequest("https://secretwatch.app/api/auth/callback/github", {
      method: "POST",
      headers: {
        host: "secretwatch.app",
        origin: "https://attacker.com",
      },
    });
    expect(validateCsrfOrigin(req)).toBe(true);
  });

  it("allows mutating requests with matching Origin header", () => {
    const req = new NextRequest("https://secretwatch.app/api/scan-rules", {
      method: "POST",
      headers: {
        host: "secretwatch.app",
        origin: "https://secretwatch.app",
      },
    });
    expect(validateCsrfOrigin(req)).toBe(true);
  });

  it("allows mutating requests with matching Referer header when Origin is absent", () => {
    const req = new NextRequest("https://secretwatch.app/api/scan-rules", {
      method: "POST",
      headers: {
        host: "secretwatch.app",
        referer: "https://secretwatch.app/admin/rules",
      },
    });
    expect(validateCsrfOrigin(req)).toBe(true);
  });

  it("blocks mutating requests with mismatched Origin header", () => {
    const req = new NextRequest("https://secretwatch.app/api/scan-rules", {
      method: "POST",
      headers: {
        host: "secretwatch.app",
        origin: "https://malicious-site.com",
      },
    });
    expect(validateCsrfOrigin(req)).toBe(false);
  });

  it("blocks mutating requests with mismatched Referer header", () => {
    const req = new NextRequest("https://secretwatch.app/api/scan-rules", {
      method: "POST",
      headers: {
        host: "secretwatch.app",
        referer: "https://evil.com/phishing",
      },
    });
    expect(validateCsrfOrigin(req)).toBe(false);
  });

  it("blocks mutating requests when neither Origin nor Referer is provided", () => {
    const req = new NextRequest("https://secretwatch.app/api/scan-rules", {
      method: "POST",
      headers: {
        host: "secretwatch.app",
      },
    });
    expect(validateCsrfOrigin(req)).toBe(false);
  });
});
