import { describe, expect, it, vi, beforeEach } from "vitest";

interface FakeFindingRow {
  id: string;
  repoFullName: string;
  filePath: string;
  commitSha: string;
  matchedRule: string;
  redactedSnippet: string;
  status: string;
  createdAt: Date;
}

let rows: FakeFindingRow[] = [];
let currentSessionUserId: string | null = "admin-a";
let currentSessionRole: "USER" | "ADMIN" = "ADMIN";

function makeRow(overrides: Partial<FakeFindingRow>): FakeFindingRow {
  return {
    id: overrides.id ?? `finding_${Math.random()}`,
    repoFullName: overrides.repoFullName ?? "acme/widgets",
    filePath: overrides.filePath ?? "config/prod.env",
    commitSha: overrides.commitSha ?? "abcdef1234567890abcdef1234567890abcdef12",
    matchedRule: overrides.matchedRule ?? "AWS Access Key",
    redactedSnippet: overrides.redactedSnippet ?? 'const key = "AKIA••••••••••7XQ";',
    status: overrides.status ?? "PENDING",
    createdAt: overrides.createdAt ?? new Date("2026-01-03"),
  };
}

let sharedPrisma: any;

function resetFakeDb(seed: FakeFindingRow[]) {
  rows = seed;
  const client = {
    finding: {
      findUnique: vi.fn(async ({ where }: any) => rows.find((r) => r.id === where.id) ?? null),
      updateMany: vi.fn(async ({ where, data }: any) => {
        const idx = rows.findIndex(
          (r) => r.id === where.id && (where.status === undefined || r.status === where.status)
        );
        if (idx === -1) return { count: 0 };
        rows[idx] = { ...rows[idx], ...data };
        return { count: 1 };
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

const enqueueFlagJobMock = vi.fn(async (_findingId: string) => undefined);
vi.mock("@/lib/queue", () => ({
  enqueueFlagJob: (findingId: string) => enqueueFlagJobMock(findingId),
}));

beforeEach(() => {
  currentSessionUserId = "admin-a";
  currentSessionRole = "ADMIN";
  recordAuditMock.mockClear();
  enqueueFlagJobMock.mockClear();
  resetFakeDb([makeRow({ id: "f1", status: "PENDING" })]);
});

describe("POST /api/findings/:id/approve — authorization", () => {
  it("returns 401 when there is no session", async () => {
    currentSessionUserId = null;
    const { POST } = await import("./route");
    const res = await POST(new Request("http://localhost/api/findings/f1/approve", { method: "POST" }), {
      params: { id: "f1" },
    });
    expect(res.status).toBe(401);
  });

  it("returns 403 for an authenticated non-admin USER (admin review gate)", async () => {
    currentSessionUserId = "user-a";
    currentSessionRole = "USER";
    const { POST } = await import("./route");
    const res = await POST(new Request("http://localhost/api/findings/f1/approve", { method: "POST" }), {
      params: { id: "f1" },
    });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("forbidden");
    expect(rows.find((r) => r.id === "f1")?.status).toBe("PENDING");
  });

  it("allows an authenticated ADMIN", async () => {
    currentSessionUserId = "admin-a";
    currentSessionRole = "ADMIN";
    const { POST } = await import("./route");
    const res = await POST(new Request("http://localhost/api/findings/f1/approve", { method: "POST" }), {
      params: { id: "f1" },
    });
    expect(res.status).toBe(200);
  });
});

describe("POST /api/findings/:id/approve — not found", () => {
  it("returns 404 for a nonexistent id", async () => {
    const { POST } = await import("./route");
    const res = await POST(
      new Request("http://localhost/api/findings/nope/approve", { method: "POST" }),
      { params: { id: "nope" } }
    );
    expect(res.status).toBe(404);
  });
});

describe("POST /api/findings/:id/approve — valid transition", () => {
  it("transitions PENDING -> APPROVED and returns the updated finding", async () => {
    const { POST } = await import("./route");
    const res = await POST(new Request("http://localhost/api/findings/f1/approve", { method: "POST" }), {
      params: { id: "f1" },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.finding.status).toBe("APPROVED");
    expect(rows.find((r) => r.id === "f1")?.status).toBe("APPROVED");
  });

  it("records an audit log entry with who/when and no raw secret content", async () => {
    const { POST } = await import("./route");
    await POST(new Request("http://localhost/api/findings/f1/approve", { method: "POST" }), {
      params: { id: "f1" },
    });
    expect(recordAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "admin-a", action: "finding_approved" })
    );
    const call = recordAuditMock.mock.calls[0][0] as { detail?: string };
    expect(call.detail ?? "").not.toContain("AKIA");
    expect(call.detail ?? "").not.toMatch(/sk_live_/);
  });

  it("enqueues a flag-queue job for the newly-approved finding (M07)", async () => {
    const { POST } = await import("./route");
    await POST(new Request("http://localhost/api/findings/f1/approve", { method: "POST" }), {
      params: { id: "f1" },
    });
    expect(enqueueFlagJobMock).toHaveBeenCalledWith("f1");
  });

  it("still returns 200 when enqueueing the flag job fails (M07)", async () => {
    enqueueFlagJobMock.mockRejectedValueOnce(new Error("redis unreachable"));
    const { POST } = await import("./route");
    const res = await POST(new Request("http://localhost/api/findings/f1/approve", { method: "POST" }), {
      params: { id: "f1" },
    });
    expect(res.status).toBe(200);
  });
});

describe("POST /api/findings/:id/approve — invalid transitions", () => {
  it("returns 409 when the finding is not PENDING (e.g. already FLAGGED)", async () => {
    resetFakeDb([makeRow({ id: "f2", status: "FLAGGED" })]);
    const { POST } = await import("./route");
    const res = await POST(new Request("http://localhost/api/findings/f2/approve", { method: "POST" }), {
      params: { id: "f2" },
    });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe("invalid_transition");
  });

  it("returns 409 (not a silent success) when re-approving an already-APPROVED finding", async () => {
    resetFakeDb([makeRow({ id: "f3", status: "APPROVED" })]);
    const { POST } = await import("./route");
    const res = await POST(new Request("http://localhost/api/findings/f3/approve", { method: "POST" }), {
      params: { id: "f3" },
    });
    expect(res.status).toBe(409);
    // Row must remain unchanged, not silently re-written.
    expect(rows.find((r) => r.id === "f3")?.status).toBe("APPROVED");
  });

  it("returns 409 for an IGNORED finding", async () => {
    resetFakeDb([makeRow({ id: "f4", status: "IGNORED" })]);
    const { POST } = await import("./route");
    const res = await POST(new Request("http://localhost/api/findings/f4/approve", { method: "POST" }), {
      params: { id: "f4" },
    });
    expect(res.status).toBe(409);
  });
});
