import { describe, expect, it, vi, beforeEach, beforeAll } from "vitest";
import crypto from "node:crypto";

// Obviously-fake fixtures only — never realistic-looking secrets. Built by
// concatenation (not a contiguous literal) so secret scanners don't flag
// this file — see apps/worker/src/__tests__/rules-engine.test.ts.
const FAKE_PAT = ["ghp_", "FAKE".repeat(9)].join(""); // 36 chars

beforeAll(() => {
  process.env.TOKEN_ENCRYPTION_KEY = crypto.randomBytes(32).toString("base64");
});

let createdRows: any[] = [];

function resetFakeDb() {
  createdRows = [];
  return {
    githubToken: {
      create: vi.fn(async ({ data }: any) => {
        const row = { id: `token_${createdRows.length + 1}`, ...data };
        createdRows.push(row);
        return { id: row.id };
      }),
    },
  };
}

let sharedPrisma: any;

vi.mock("@/lib/db", () => ({
  get prisma() {
    return sharedPrisma;
  },
}));

const recordAuditMock = vi.fn(async (_params: { userId?: string | null; action: string; detail?: string }) => undefined);
vi.mock("@/lib/audit", () => ({
  recordAudit: (params: { userId?: string | null; action: string; detail?: string }) => recordAuditMock(params),
}));

// Mock GitHub token validation
let mockValidToken = true;
let mockTokenScopes = ["public_repo", "repo"];
vi.mock("@/lib/github-validate", () => ({
  validateGitHubToken: vi.fn(async () => ({ valid: mockValidToken, scopes: mockTokenScopes })),
}));

// The rate limiter (lib/rate-limit.ts) keys on IP in module-level in-memory
// state that persists across tests in this file. Each call to postToken()
// without an explicit `ip` gets a fresh, never-before-used IP so tests that
// aren't specifically about rate limiting never trip on a bucket exhausted
// by an earlier test.
let ipCounter = 0;
function nextTestIp(): string {
  ipCounter += 1;
  return `203.0.113.${ipCounter}`;
}

beforeEach(() => {
  mockValidToken = true;
  mockTokenScopes = ["public_repo", "repo"];
  recordAuditMock.mockClear();
  sharedPrisma = resetFakeDb();
});

function postToken(token: unknown, ip: string = nextTestIp()) {
  return new Request("http://localhost/api/public/tokens", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify({ token }),
  });
}

describe("POST /api/public/tokens — no auth required", () => {
  it("accepts a valid PAT with no session/auth header at all", async () => {
    const { POST } = await import("./route");
    const res = await POST(postToken(FAKE_PAT) as any);
    expect(res.status).toBe(201);
  });
});

describe("POST /api/public/tokens — validation", () => {
  it("rejects a malformed token (400) before ever calling prisma", async () => {
    const { POST } = await import("./route");
    const res = await POST(postToken("not-a-real-token") as any);
    expect(res.status).toBe(400);
    expect(sharedPrisma.githubToken.create).not.toHaveBeenCalled();
  });

  it("rejects an invalid PAT according to GitHub API", async () => {
    const { POST } = await import("./route");
    mockValidToken = false;
    const res = await POST(postToken(FAKE_PAT) as any);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("invalid_token");
    expect(sharedPrisma.githubToken.create).not.toHaveBeenCalled();
  });

  it("rejects a missing token field", async () => {
    const { POST } = await import("./route");
    const res = await POST(
      new Request("http://localhost/api/public/tokens", {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": nextTestIp() },
        body: JSON.stringify({}),
      }) as any
    );
    expect(res.status).toBe(400);
  });

  it("rejects invalid JSON bodies", async () => {
    const { POST } = await import("./route");
    const res = await POST(
      new Request("http://localhost/api/public/tokens", {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": nextTestIp() },
        body: "{not json",
      }) as any
    );
    expect(res.status).toBe(400);
  });
});

describe("POST /api/public/tokens — persistence contract", () => {
  it("creates a GithubToken row with source=pat, active=true, and no userId", async () => {
    const { POST } = await import("./route");
    await POST(postToken(FAKE_PAT) as any);

    expect(sharedPrisma.githubToken.create).toHaveBeenCalledTimes(1);
    const callArgs = sharedPrisma.githubToken.create.mock.calls[0][0];
    expect(callArgs.data.source).toBe("pat");
    expect(callArgs.data.active).toBe(true);
    expect(callArgs.data.scopes).toEqual(["public_repo", "repo"]);
    expect(callArgs.data).not.toHaveProperty("userId");
  });

  it("never stores the raw token — only encrypted + maskedIdentifier", async () => {
    const { POST } = await import("./route");
    await POST(postToken(FAKE_PAT) as any);

    const callArgs = sharedPrisma.githubToken.create.mock.calls[0][0];
    expect(callArgs.data.encrypted).not.toContain(FAKE_PAT);
    expect(callArgs.data.maskedIdentifier).not.toContain(FAKE_PAT);
    expect(callArgs.data.maskedIdentifier).toContain("•");
  });
});

describe("POST /api/public/tokens — response never leaks the raw or encrypted value", () => {
  it("returns only { maskedIdentifier } on success", async () => {
    const { POST } = await import("./route");
    const res = await POST(postToken(FAKE_PAT) as any);
    const body = await res.json();

    expect(Object.keys(body)).toEqual(["maskedIdentifier"]);
    expect(body.maskedIdentifier).not.toBe(FAKE_PAT);
    expect(JSON.stringify(body)).not.toContain(FAKE_PAT);
  });

  it("never includes the raw token in the audit log detail", async () => {
    const { POST } = await import("./route");
    await POST(postToken(FAKE_PAT) as any);

    expect(recordAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({ userId: null, action: "public_token_submitted" })
    );
    const call = recordAuditMock.mock.calls[0][0] as { detail?: string };
    expect(call.detail ?? "").not.toContain(FAKE_PAT);
  });

  it("never leaks the raw token in a validation-error response", async () => {
    const { POST } = await import("./route");
    // Distinct marker string unlikely to collide with any static zod message
    // text (unlike a generic word such as "short"), so this only passes if
    // the submitted value itself is genuinely never echoed back.
    const rawInput = "zzz_NEVER_ECHO_THIS_RAW_INPUT_zzz";
    const res = await POST(postToken(rawInput) as any);
    const text = JSON.stringify(await res.json());
    expect(text).not.toContain(rawInput);
  });
});

describe("POST /api/public/tokens — rate limiting", () => {
  it("rejects with 429 after exceeding the per-IP limit within the window", async () => {
    const { POST } = await import("./route");
    const ip = "198.51.100.42";

    let lastStatus = 0;
    for (let i = 0; i < 10; i++) {
      const res = await POST(postToken(FAKE_PAT, ip) as any);
      lastStatus = res.status;
    }

    expect(lastStatus).toBe(429);
  });

  it("does not rate-limit a different IP after one IP is exhausted", async () => {
    const { POST } = await import("./route");
    for (let i = 0; i < 10; i++) {
      await POST(postToken(FAKE_PAT, "198.51.100.99") as any);
    }
    const res = await POST(postToken(FAKE_PAT, "198.51.100.100") as any);
    expect(res.status).toBe(201);
  });
});
