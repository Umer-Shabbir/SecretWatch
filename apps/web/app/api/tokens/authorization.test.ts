import { describe, expect, it, vi, beforeEach } from "vitest";

// Obviously-fake fixture only — never a realistic-looking secret.
const FAKE_MASKED = "ghp_••••••••••••••••••••••••fake";

interface FakeTokenRow {
  id: string;
  maskedIdentifier: string | null;
  source: string;
  scopes: string[];
  lastUsedAt: Date | null;
  rateLimitRemaining: number | null;
  active: boolean;
  createdAt: Date;
}

let rows: FakeTokenRow[] = [];
let currentSessionUserId: string | null = "admin-a";
let currentSessionRole: "ADMIN" | "USER" | null = "ADMIN";

function makeRow(overrides: Partial<FakeTokenRow>): FakeTokenRow {
  return {
    id: overrides.id ?? `token_${Math.random()}`,
    maskedIdentifier: overrides.maskedIdentifier ?? FAKE_MASKED,
    source: overrides.source ?? "pat",
    scopes: overrides.scopes ?? [],
    lastUsedAt: overrides.lastUsedAt ?? null,
    rateLimitRemaining: overrides.rateLimitRemaining ?? null,
    active: overrides.active ?? true,
    createdAt: overrides.createdAt ?? new Date(),
  };
}

let sharedPrisma: any;

function resetFakeDb(seed: FakeTokenRow[]) {
  rows = seed;
  sharedPrisma = {
    githubToken: {
      findMany: vi.fn(async () => [...rows].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())),
      findUnique: vi.fn(async ({ where }: any) => rows.find((r) => r.id === where.id) ?? null),
      update: vi.fn(async ({ where, data }: any) => {
        const idx = rows.findIndex((r) => r.id === where.id);
        rows[idx] = { ...rows[idx], ...data };
        return rows[idx];
      }),
    },
  };
  return sharedPrisma;
}

vi.mock("@/lib/db", () => ({
  get prisma() {
    return sharedPrisma;
  },
}));

const recordAuditMock = vi.fn(async (_params: { userId?: string | null; action: string; detail?: string }) => undefined);
vi.mock("@/lib/audit", () => ({
  recordAudit: (params: { userId?: string | null; action: string; detail?: string }) => recordAuditMock(params),
}));

vi.mock("@/lib/authorize", () => ({
  requireAdmin: vi.fn(async () => {
    if (!currentSessionUserId) {
      return { session: null, error: "unauthenticated" as const };
    }
    if (currentSessionRole !== "ADMIN") {
      return { session: null, error: "forbidden" as const };
    }
    return { session: { user: { id: currentSessionUserId, role: "ADMIN" } }, error: null };
  }),
}));

beforeEach(() => {
  currentSessionUserId = "admin-a";
  currentSessionRole = "ADMIN";
  recordAuditMock.mockClear();
  resetFakeDb([makeRow({ id: "token-1" }), makeRow({ id: "token-2", active: false })]);
});

describe("GET /api/tokens — authorization", () => {
  it("returns 401 with no session", async () => {
    currentSessionUserId = null;
    const { GET } = await import("./route");
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns 403 for a non-admin session", async () => {
    currentSessionRole = "USER";
    const { GET } = await import("./route");
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("returns 200 with the token list for an admin session", async () => {
    const { GET } = await import("./route");
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.tokens).toHaveLength(2);
  });

  it("never includes an `encrypted` field in the response", async () => {
    const { GET } = await import("./route");
    const res = await GET();
    const body = await res.json();
    for (const token of body.tokens) {
      expect(token).not.toHaveProperty("encrypted");
    }
  });
});

describe("PATCH /api/tokens/:id — authorization", () => {
  it("returns 401 with no session", async () => {
    currentSessionUserId = null;
    const { PATCH } = await import("./[id]/route");
    const res = await PATCH(new Request("http://localhost/api/tokens/token-1", { method: "PATCH" }), {
      params: { id: "token-1" },
    });
    expect(res.status).toBe(401);
  });

  it("returns 403 for a non-admin session", async () => {
    currentSessionRole = "USER";
    const { PATCH } = await import("./[id]/route");
    const res = await PATCH(new Request("http://localhost/api/tokens/token-1", { method: "PATCH" }), {
      params: { id: "token-1" },
    });
    expect(res.status).toBe(403);
  });
});

describe("PATCH /api/tokens/:id — deactivation", () => {
  it("deactivates an active token (active=false), soft-delete preserving the row", async () => {
    const { PATCH } = await import("./[id]/route");
    const res = await PATCH(new Request("http://localhost/api/tokens/token-1", { method: "PATCH" }), {
      params: { id: "token-1" },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.token.active).toBe(false);
    expect(body.token.id).toBe("token-1");

    const stillThere = rows.find((r) => r.id === "token-1");
    expect(stillThere).toBeDefined();
    expect(stillThere?.active).toBe(false);

    expect(recordAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "admin-a", action: "token_deactivated" })
    );
  });

  it("is idempotent — deactivating an already-inactive token returns 200, not an error", async () => {
    const { PATCH } = await import("./[id]/route");
    const res = await PATCH(new Request("http://localhost/api/tokens/token-2", { method: "PATCH" }), {
      params: { id: "token-2" },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.token.active).toBe(false);
  });

  it("returns 404 for a nonexistent token id", async () => {
    const { PATCH } = await import("./[id]/route");
    const res = await PATCH(new Request("http://localhost/api/tokens/does-not-exist", { method: "PATCH" }), {
      params: { id: "does-not-exist" },
    });
    expect(res.status).toBe(404);
  });

  it("never leaks a raw/encrypted value in the deactivation response", async () => {
    const { PATCH } = await import("./[id]/route");
    const res = await PATCH(new Request("http://localhost/api/tokens/token-1", { method: "PATCH" }), {
      params: { id: "token-1" },
    });
    const text = JSON.stringify(await res.json());
    expect(text).not.toContain("irrelevant-ciphertext");
    expect(text).not.toMatch(/ghp_[A-Za-z0-9]{36}/);
  });
});
