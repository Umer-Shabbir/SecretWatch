import { describe, expect, it, vi, beforeEach } from "vitest";

/**
 * /api/admin/scan/run and /api/admin/flag/run (2026-08-24 admin-control
 * addition). Tests admin authorization, that a run respects the master
 * switch (enqueues nothing when off), and that it fans out over the eligible
 * rows when on.
 */

let currentSessionUserId: string | null = "admin-a";
let currentSessionRole: "ADMIN" | "USER" | null = "ADMIN";
let scannerEnabled = true;
let flaggerEnabled = true;

vi.mock("@/lib/system-settings", () => ({
  getSystemSettings: vi.fn(async () => ({ scannerEnabled, flaggerEnabled, updatedAt: "2026-08-24T00:00:00.000Z" })),
}));

const enqueueScanJobsMock = vi.fn(async (ids: string[]) => ids.length);
const enqueueFlagJobsMock = vi.fn(async (ids: string[]) => ids.length);
vi.mock("@/lib/queue", () => ({
  enqueueScanJobs: (ids: string[]) => enqueueScanJobsMock(ids),
  enqueueFlagJobs: (ids: string[]) => enqueueFlagJobsMock(ids),
}));

const recordAuditMock = vi.fn(
  async (_params: { userId?: string | null; action: string; detail?: string }) => undefined
);
vi.mock("@/lib/audit", () => ({
  recordAudit: (params: any) => recordAuditMock(params),
}));

let sharedPrisma: any;
vi.mock("@/lib/db", () => ({
  get prisma() {
    return sharedPrisma;
  },
}));

vi.mock("@/lib/authorize", () => ({
  requireAdmin: vi.fn(async () => {
    if (!currentSessionUserId) return { session: null, error: "unauthenticated" as const };
    if (currentSessionRole !== "ADMIN") return { session: null, error: "forbidden" as const };
    return { session: { user: { id: currentSessionUserId, role: "ADMIN" } }, error: null };
  }),
}));

beforeEach(() => {
  currentSessionUserId = "admin-a";
  currentSessionRole = "ADMIN";
  scannerEnabled = true;
  flaggerEnabled = true;
  enqueueScanJobsMock.mockClear();
  enqueueFlagJobsMock.mockClear();
  recordAuditMock.mockClear();
  sharedPrisma = {
    scanRule: { findMany: vi.fn(async () => [{ id: "r1" }, { id: "r2" }]) },
    finding: { findMany: vi.fn(async () => [{ id: "f1" }, { id: "f2" }, { id: "f3" }]) },
  };
});

describe("POST /api/admin/scan/run", () => {
  it("returns 403 for a non-admin and enqueues nothing", async () => {
    currentSessionRole = "USER";
    const { POST } = await import("./scan/run/route");
    const res = await POST();
    expect(res.status).toBe(403);
    expect(enqueueScanJobsMock).not.toHaveBeenCalled();
  });

  it("enqueues nothing when the scanner switch is off", async () => {
    scannerEnabled = false;
    const { POST } = await import("./scan/run/route");
    const res = await POST();
    const body = await res.json();
    expect(body).toEqual({ enqueued: 0, scannerEnabled: false });
    expect(enqueueScanJobsMock).not.toHaveBeenCalled();
  });

  it("fans out one job per enabled rule when on, and audit-logs", async () => {
    const { POST } = await import("./scan/run/route");
    const res = await POST();
    const body = await res.json();
    expect(body.enqueued).toBe(2);
    expect(enqueueScanJobsMock).toHaveBeenCalledWith(["r1", "r2"]);
    expect(recordAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "admin-a", action: "manual_scan_triggered" })
    );
  });
});

describe("POST /api/admin/flag/run", () => {
  it("returns 401 with no session and enqueues nothing", async () => {
    currentSessionUserId = null;
    const { POST } = await import("./flag/run/route");
    const res = await POST();
    expect(res.status).toBe(401);
    expect(enqueueFlagJobsMock).not.toHaveBeenCalled();
  });

  it("enqueues nothing when the flagger switch is off", async () => {
    flaggerEnabled = false;
    const { POST } = await import("./flag/run/route");
    const res = await POST();
    const body = await res.json();
    expect(body).toEqual({ enqueued: 0, flaggerEnabled: false });
    expect(enqueueFlagJobsMock).not.toHaveBeenCalled();
  });

  it("enqueues one job per APPROVED finding when on, and audit-logs", async () => {
    const { POST } = await import("./flag/run/route");
    const res = await POST();
    const body = await res.json();
    expect(body.enqueued).toBe(3);
    expect(sharedPrisma.finding.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: "APPROVED" } })
    );
    expect(enqueueFlagJobsMock).toHaveBeenCalledWith(["f1", "f2", "f3"]);
    expect(recordAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "admin-a", action: "manual_flag_triggered" })
    );
  });
});
