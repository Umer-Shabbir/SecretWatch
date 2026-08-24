import { describe, expect, it, vi, beforeEach, beforeAll } from "vitest";
import crypto from "node:crypto";

/**
 * POST /api/tokens — admin manual token add (2026-08-24 admin-control
 * addition). Tests admin authorization, PAT validation, source="manual"
 * persistence, and the security contract that the raw token is never stored,
 * echoed, or audit-logged (mirrors the public-tokens tests).
 */

// Obviously-fake fixture, built by concatenation so secret scanners don't flag.
const FAKE_PAT = ["ghp_", "FAKE".repeat(9)].join(""); // 36 chars

beforeAll(() => {
  process.env.TOKEN_ENCRYPTION_KEY = crypto.randomBytes(32).toString("base64");
});

let currentSessionUserId: string | null = "admin-a";
let currentSessionRole: "ADMIN" | "USER" | null = "ADMIN";
let createdRows: any[] = [];
let sharedPrisma: any;

vi.mock("@/lib/db", () => ({
  get prisma() {
    return sharedPrisma;
  },
}));

const recordAuditMock = vi.fn(
  async (_params: { userId?: string | null; action: string; detail?: string }) => undefined
);
vi.mock("@/lib/audit", () => ({
  recordAudit: (params: any) => recordAuditMock(params),
}));

vi.mock("@/lib/authorize", () => ({
  requireAdmin: vi.fn(async () => {
    if (!currentSessionUserId) return { session: null, error: "unauthenticated" as const };
    if (currentSessionRole !== "ADMIN") return { session: null, error: "forbidden" as const };
    return { session: { user: { id: currentSessionUserId, role: "ADMIN" } }, error: null };
  }),
}));

// admin-tokens is imported by the route for GET; provide a no-op so import resolves.
vi.mock("@/lib/admin-tokens", () => ({
  listAdminTokens: vi.fn(async () => []),
}));

beforeEach(() => {
  currentSessionUserId = "admin-a";
  currentSessionRole = "ADMIN";
  recordAuditMock.mockClear();
  createdRows = [];
  sharedPrisma = {
    githubToken: {
      create: vi.fn(async ({ data }: any) => {
        const row = { id: `token_${createdRows.length + 1}`, ...data };
        createdRows.push(row);
        return { id: row.id };
      }),
    },
  };
});

function postToken(token: unknown) {
  return new Request("http://localhost/api/tokens", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token }),
  });
}

describe("POST /api/tokens — authorization", () => {
  it("returns 401 with no session and never touches the DB", async () => {
    currentSessionUserId = null;
    const { POST } = await import("./route");
    const res = await POST(postToken(FAKE_PAT) as any);
    expect(res.status).toBe(401);
    expect(sharedPrisma.githubToken.create).not.toHaveBeenCalled();
  });

  it("returns 403 for a non-admin", async () => {
    currentSessionRole = "USER";
    const { POST } = await import("./route");
    const res = await POST(postToken(FAKE_PAT) as any);
    expect(res.status).toBe(403);
    expect(sharedPrisma.githubToken.create).not.toHaveBeenCalled();
  });
});

describe("POST /api/tokens — validation", () => {
  it("rejects a malformed token (400) before calling prisma", async () => {
    const { POST } = await import("./route");
    const res = await POST(postToken("not-a-token") as any);
    expect(res.status).toBe(400);
    expect(sharedPrisma.githubToken.create).not.toHaveBeenCalled();
  });
});

describe("POST /api/tokens — persistence + security", () => {
  it("creates a row with source=manual, active=true, no userId", async () => {
    const { POST } = await import("./route");
    const res = await POST(postToken(FAKE_PAT) as any);
    expect(res.status).toBe(201);
    const args = sharedPrisma.githubToken.create.mock.calls[0][0];
    expect(args.data.source).toBe("manual");
    expect(args.data.active).toBe(true);
    expect(args.data).not.toHaveProperty("userId");
  });

  it("never stores the raw token — only encrypted + masked", async () => {
    const { POST } = await import("./route");
    await POST(postToken(FAKE_PAT) as any);
    const args = sharedPrisma.githubToken.create.mock.calls[0][0];
    expect(args.data.encrypted).not.toContain(FAKE_PAT);
    expect(args.data.maskedIdentifier).not.toContain(FAKE_PAT);
    expect(args.data.maskedIdentifier).toContain("•");
  });

  it("returns only id + maskedIdentifier, never the raw token", async () => {
    const { POST } = await import("./route");
    const res = await POST(postToken(FAKE_PAT) as any);
    const body = await res.json();
    expect(body.token.maskedIdentifier).not.toBe(FAKE_PAT);
    expect(JSON.stringify(body)).not.toContain(FAKE_PAT);
    expect(body.token).not.toHaveProperty("encrypted");
  });

  it("never includes the raw token in the audit log detail", async () => {
    const { POST } = await import("./route");
    await POST(postToken(FAKE_PAT) as any);
    expect(recordAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "admin-a", action: "admin_token_added" })
    );
    const call = recordAuditMock.mock.calls[0][0] as { detail?: string };
    expect(call.detail ?? "").not.toContain(FAKE_PAT);
  });
});
