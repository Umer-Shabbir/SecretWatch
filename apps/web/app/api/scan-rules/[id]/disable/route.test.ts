import { describe, expect, it, vi, beforeEach } from "vitest";

interface FakeScanRuleRow {
  id: string;
  name: string;
  pattern: string;
  enabled: boolean;
  createdAt: Date;
}

let rows: FakeScanRuleRow[] = [];
let currentSessionUserId: string | null = "admin-a";
let currentSessionRole: "USER" | "ADMIN" = "ADMIN";

function makeRow(overrides: Partial<FakeScanRuleRow>): FakeScanRuleRow {
  return {
    id: overrides.id ?? `rule_${Math.random()}`,
    name: overrides.name ?? "AWS Access Key",
    pattern: overrides.pattern ?? "AKIA[0-9A-Z]{16}",
    enabled: overrides.enabled ?? true,
    createdAt: overrides.createdAt ?? new Date("2026-01-03"),
  };
}

let sharedPrisma: any;

function resetFakeDb(seed: FakeScanRuleRow[]) {
  rows = seed;
  const client = {
    scanRule: {
      findUnique: vi.fn(async ({ where }: any) => rows.find((r) => r.id === where.id) ?? null),
      update: vi.fn(async ({ where, data }: any) => {
        const idx = rows.findIndex((r) => r.id === where.id);
        if (idx === -1) throw new Error("not found");
        rows[idx] = { ...rows[idx], ...data };
        return rows[idx];
      }),
    },
  };
  sharedPrisma = client;
  return client;
}

vi.mock("@/lib/db", () => ({
  get prisma() {
    return sharedPrisma;
  },
}));

vi.mock("@/lib/authorize", () => ({
  requireAdmin: vi.fn(async () => {
    if (!currentSessionUserId) {
      return { session: null, error: "unauthenticated" as const };
    }
    if (currentSessionRole !== "ADMIN") {
      return { session: null, error: "forbidden" as const };
    }
    return { session: { user: { id: currentSessionUserId, role: currentSessionRole } }, error: null };
  }),
}));

const recordAuditMock = vi.fn(async (_params: { userId?: string | null; action: string; detail?: string }) => undefined);
vi.mock("@/lib/audit", () => ({
  recordAudit: (params: { userId?: string | null; action: string; detail?: string }) => recordAuditMock(params),
}));

beforeEach(() => {
  currentSessionUserId = "admin-a";
  currentSessionRole = "ADMIN";
  recordAuditMock.mockClear();
  resetFakeDb([makeRow({ id: "r1", enabled: true })]);
});

describe("POST /api/scan-rules/:id/disable — authorization", () => {
  it("returns 401 when there is no session", async () => {
    currentSessionUserId = null;
    const { POST } = await import("./route");
    const res = await POST(new Request("http://localhost/api/scan-rules/r1/disable", { method: "POST" }), {
      params: { id: "r1" },
    });
    expect(res.status).toBe(401);
  });

  it("returns 403 for an authenticated non-admin USER", async () => {
    currentSessionUserId = "user-a";
    currentSessionRole = "USER";
    const { POST } = await import("./route");
    const res = await POST(new Request("http://localhost/api/scan-rules/r1/disable", { method: "POST" }), {
      params: { id: "r1" },
    });
    expect(res.status).toBe(403);
    expect(rows.find((r) => r.id === "r1")?.enabled).toBe(true);
  });
});

describe("POST /api/scan-rules/:id/disable — not found", () => {
  it("returns 404 for a nonexistent id", async () => {
    const { POST } = await import("./route");
    const res = await POST(new Request("http://localhost/api/scan-rules/nope/disable", { method: "POST" }), {
      params: { id: "nope" },
    });
    expect(res.status).toBe(404);
  });
});

describe("POST /api/scan-rules/:id/disable — success", () => {
  it("flips enabled from true to false", async () => {
    const { POST } = await import("./route");
    const res = await POST(new Request("http://localhost/api/scan-rules/r1/disable", { method: "POST" }), {
      params: { id: "r1" },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.rule.enabled).toBe(false);
    expect(rows.find((r) => r.id === "r1")?.enabled).toBe(false);
  });

  it("is idempotent when already disabled", async () => {
    resetFakeDb([makeRow({ id: "r2", enabled: false })]);
    const { POST } = await import("./route");
    const res = await POST(new Request("http://localhost/api/scan-rules/r2/disable", { method: "POST" }), {
      params: { id: "r2" },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.rule.enabled).toBe(false);
  });

  it("records an audit log entry", async () => {
    const { POST } = await import("./route");
    await POST(new Request("http://localhost/api/scan-rules/r1/disable", { method: "POST" }), {
      params: { id: "r1" },
    });
    expect(recordAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "admin-a", action: "scan_rule_disabled" })
    );
  });

  it("does not touch any Finding rows (disable never cascades to existing findings)", async () => {
    // No Finding mock is wired into sharedPrisma at all for this test suite —
    // if the disable route ever tried to touch prisma.finding, this test
    // would throw (undefined.something) rather than silently pass.
    const { POST } = await import("./route");
    const res = await POST(new Request("http://localhost/api/scan-rules/r1/disable", { method: "POST" }), {
      params: { id: "r1" },
    });
    expect(res.status).toBe(200);
  });
});
