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
  resetFakeDb([makeRow({ id: "r1", name: "AWS Access Key", pattern: "AKIA[0-9A-Z]{16}" })]);
});

function patchRequest(body: unknown): Request {
  return new Request("http://localhost/api/scan-rules/r1", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

describe("PATCH /api/scan-rules/:id — authorization", () => {
  it("returns 401 when there is no session", async () => {
    currentSessionUserId = null;
    const { PATCH } = await import("./route");
    const res = await PATCH(patchRequest({ name: "New Name" }) as any, { params: { id: "r1" } });
    expect(res.status).toBe(401);
  });

  it("returns 403 for an authenticated non-admin USER", async () => {
    currentSessionUserId = "user-a";
    currentSessionRole = "USER";
    const { PATCH } = await import("./route");
    const res = await PATCH(patchRequest({ name: "New Name" }) as any, { params: { id: "r1" } });
    expect(res.status).toBe(403);
  });
});

describe("PATCH /api/scan-rules/:id — validation", () => {
  it("returns 400 when neither name nor pattern is provided", async () => {
    const { PATCH } = await import("./route");
    const res = await PATCH(patchRequest({}) as any, { params: { id: "r1" } });
    expect(res.status).toBe(400);
  });

  it("returns 400 for malformed JSON", async () => {
    const { PATCH } = await import("./route");
    const res = await PATCH(
      new Request("http://localhost/api/scan-rules/r1", { method: "PATCH", body: "{not json" }) as any,
      { params: { id: "r1" } }
    );
    expect(res.status).toBe(400);
  });

  it("returns 409 for a pattern that fails to compile", async () => {
    const { PATCH } = await import("./route");
    const res = await PATCH(patchRequest({ pattern: "(unterminated" }) as any, { params: { id: "r1" } });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe("invalid_pattern");
  });

  it("returns 409 for a catastrophic-backtracking-shaped pattern", async () => {
    const { PATCH } = await import("./route");
    const res = await PATCH(patchRequest({ pattern: "(a*)*$" }) as any, { params: { id: "r1" } });
    expect(res.status).toBe(409);
  });
});

describe("PATCH /api/scan-rules/:id — not found", () => {
  it("returns 404 for a nonexistent id", async () => {
    const { PATCH } = await import("./route");
    const res = await PATCH(
      new Request("http://localhost/api/scan-rules/nope", { method: "PATCH", body: JSON.stringify({ name: "X" }) }) as any,
      { params: { id: "nope" } }
    );
    expect(res.status).toBe(404);
  });
});

describe("PATCH /api/scan-rules/:id — successful update", () => {
  it("updates the name only", async () => {
    const { PATCH } = await import("./route");
    const res = await PATCH(patchRequest({ name: "Renamed Rule" }) as any, { params: { id: "r1" } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.rule.name).toBe("Renamed Rule");
    expect(body.rule.pattern).toBe("AKIA[0-9A-Z]{16}");
  });

  it("updates the pattern only", async () => {
    const { PATCH } = await import("./route");
    const res = await PATCH(patchRequest({ pattern: "AKIA[0-9A-Z]{20}" }) as any, { params: { id: "r1" } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.rule.pattern).toBe("AKIA[0-9A-Z]{20}");
    expect(body.rule.name).toBe("AWS Access Key");
  });

  it("records an audit log entry", async () => {
    const { PATCH } = await import("./route");
    await PATCH(patchRequest({ name: "Renamed Rule" }) as any, { params: { id: "r1" } });
    expect(recordAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "admin-a", action: "scan_rule_updated" })
    );
  });
});
