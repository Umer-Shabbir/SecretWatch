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
      findMany: vi.fn(async ({ orderBy }: any = {}) => {
        const sorted = [...rows];
        if (orderBy?.createdAt === "desc") {
          sorted.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        }
        return sorted;
      }),
      findUnique: vi.fn(async ({ where }: any) => rows.find((r) => r.id === where.id) ?? null),
      create: vi.fn(async ({ data }: any) => {
        const row: FakeScanRuleRow = {
          id: `rule_${Math.random()}`,
          name: data.name,
          pattern: data.pattern,
          enabled: data.enabled ?? true,
          createdAt: new Date(),
        };
        rows.push(row);
        return row;
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
  resetFakeDb([
    makeRow({ id: "r1", name: "AWS Access Key", createdAt: new Date("2026-01-03") }),
    makeRow({ id: "r2", name: "Stripe Secret Key", pattern: "sk_live_[0-9a-zA-Z]{24}", enabled: false, createdAt: new Date("2026-01-01") }),
  ]);
});

describe("GET /api/scan-rules — authorization", () => {
  it("returns 401 when there is no session", async () => {
    currentSessionUserId = null;
    const { GET } = await import("./route");
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns 403 for an authenticated non-admin USER", async () => {
    currentSessionUserId = "user-a";
    currentSessionRole = "USER";
    const { GET } = await import("./route");
    const res = await GET();
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("forbidden");
  });

  it("allows an authenticated ADMIN", async () => {
    const { GET } = await import("./route");
    const res = await GET();
    expect(res.status).toBe(200);
  });
});

describe("GET /api/scan-rules — response shape", () => {
  it("returns all rules, newest first", async () => {
    const { GET } = await import("./route");
    const res = await GET();
    const body = await res.json();
    expect(body.rules).toHaveLength(2);
    expect(body.rules[0].id).toBe("r1");
    expect(body.rules[1].id).toBe("r2");
  });

  it("returns exactly the documented ScanRuleSummary fields", async () => {
    const { GET } = await import("./route");
    const res = await GET();
    const body = await res.json();
    const keys = Object.keys(body.rules[0]).sort();
    expect(keys).toEqual(["id", "name", "pattern", "enabled", "createdAt"].sort());
  });
});

describe("POST /api/scan-rules — authorization", () => {
  it("returns 401 when there is no session", async () => {
    currentSessionUserId = null;
    const { POST } = await import("./route");
    const res = await POST(
      new Request("http://localhost/api/scan-rules", {
        method: "POST",
        body: JSON.stringify({ name: "New Rule", pattern: "abc" }),
      }) as any
    );
    expect(res.status).toBe(401);
  });

  it("returns 403 for an authenticated non-admin USER", async () => {
    currentSessionUserId = "user-a";
    currentSessionRole = "USER";
    const { POST } = await import("./route");
    const res = await POST(
      new Request("http://localhost/api/scan-rules", {
        method: "POST",
        body: JSON.stringify({ name: "New Rule", pattern: "abc" }),
      }) as any
    );
    expect(res.status).toBe(403);
  });
});

describe("POST /api/scan-rules — validation", () => {
  it("returns 400 for an empty name", async () => {
    const { POST } = await import("./route");
    const res = await POST(
      new Request("http://localhost/api/scan-rules", {
        method: "POST",
        body: JSON.stringify({ name: "", pattern: "abc" }),
      }) as any
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 for an empty pattern", async () => {
    const { POST } = await import("./route");
    const res = await POST(
      new Request("http://localhost/api/scan-rules", {
        method: "POST",
        body: JSON.stringify({ name: "New Rule", pattern: "" }),
      }) as any
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 for malformed JSON", async () => {
    const { POST } = await import("./route");
    const res = await POST(
      new Request("http://localhost/api/scan-rules", { method: "POST", body: "{not json" }) as any
    );
    expect(res.status).toBe(400);
  });

  it("returns 409 for a pattern that fails to compile as a regex", async () => {
    const { POST } = await import("./route");
    const res = await POST(
      new Request("http://localhost/api/scan-rules", {
        method: "POST",
        body: JSON.stringify({ name: "Bad Rule", pattern: "(unterminated" }),
      }) as any
    );
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe("invalid_pattern");
  });

  it("returns 409 for a catastrophic-backtracking-shaped pattern", async () => {
    const { POST } = await import("./route");
    const res = await POST(
      new Request("http://localhost/api/scan-rules", {
        method: "POST",
        body: JSON.stringify({ name: "ReDoS Rule", pattern: "(a+)+$" }),
      }) as any
    );
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe("invalid_pattern");
  });
});

describe("POST /api/scan-rules — successful create", () => {
  it("creates a rule defaulting to enabled: true", async () => {
    const { POST } = await import("./route");
    const res = await POST(
      new Request("http://localhost/api/scan-rules", {
        method: "POST",
        body: JSON.stringify({ name: "Slack Token", pattern: "xox[baprs]-[0-9a-zA-Z-]+" }),
      }) as any
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.rule.name).toBe("Slack Token");
    expect(body.rule.enabled).toBe(true);
    expect(rows.some((r) => r.name === "Slack Token")).toBe(true);
  });

  it("records an audit log entry", async () => {
    const { POST } = await import("./route");
    await POST(
      new Request("http://localhost/api/scan-rules", {
        method: "POST",
        body: JSON.stringify({ name: "Slack Token", pattern: "xox[baprs]-[0-9a-zA-Z-]+" }),
      }) as any
    );
    expect(recordAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "admin-a", action: "scan_rule_created" })
    );
  });
});
