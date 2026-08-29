import { describe, expect, it, vi, beforeEach } from "vitest";

let currentSessionUserId: string | null = "admin-a";
let currentSessionRole: "USER" | "ADMIN" = "ADMIN";

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

const mockSystemSettings = {
  scannerEnabled: false,
  flaggerEnabled: false,
  autoFlagEnabled: false,
  autoApproveEnabled: false,
  scanResultsPerRule: 10,
  flagRateLimitThreshold: 10,
  scanIntervalMinutes: 15,
  updatedAt: new Date().toISOString(),
};

vi.mock("@/lib/system-settings", () => ({
  getSystemSettings: vi.fn(async () => mockSystemSettings),
  updateSystemSettings: vi.fn(async (patch) => ({
    ...mockSystemSettings,
    ...patch,
  })),
}));

const enqueueScanJobsMock = vi.fn(async (args: any[]) => 0);
const enqueueFlagJobsMock = vi.fn(async (args: any[]) => 0);
vi.mock("@/lib/queue", () => ({
  enqueueScanJobs: (args: any) => enqueueScanJobsMock(args),
  enqueueFlagJobs: (args: any) => enqueueFlagJobsMock(args),
}));

const recordAuditMock = vi.fn(async (params: any) => undefined);
vi.mock("@/lib/audit", () => ({
  recordAudit: (params: any) => recordAuditMock(params),
}));

let mockRules: any[] = [];
let mockFindings: any[] = [];

vi.mock("@/lib/db", () => ({
  prisma: {
    scanRule: {
      findMany: vi.fn(async () => mockRules),
    },
    finding: {
      findMany: vi.fn(async () => mockFindings),
    },
  },
}));

beforeEach(() => {
  currentSessionUserId = "admin-a";
  currentSessionRole = "ADMIN";
  enqueueScanJobsMock.mockClear();
  enqueueFlagJobsMock.mockClear();
  recordAuditMock.mockClear();
  mockRules = [];
  mockFindings = [];
});

describe("PATCH /api/system/settings", () => {
  it("returns 401 when unauthenticated", async () => {
    currentSessionUserId = null;
    const { PATCH } = await import("./route");
    const res = await PATCH(new Request("http://localhost", {
      method: "PATCH",
      body: JSON.stringify({ scannerEnabled: true }),
    }) as any);
    expect(res.status).toBe(401);
  });

  it("returns 403 when not an admin", async () => {
    currentSessionRole = "USER";
    const { PATCH } = await import("./route");
    const res = await PATCH(new Request("http://localhost", {
      method: "PATCH",
      body: JSON.stringify({ scannerEnabled: true }),
    }) as any);
    expect(res.status).toBe(403);
  });

  it("returns 400 when body is invalid JSON", async () => {
    const { PATCH } = await import("./route");
    const res = await PATCH(new Request("http://localhost", {
      method: "PATCH",
      body: "not-json",
    }) as any);
    expect(res.status).toBe(400);
  });

  it("updates settings and enqueues scan jobs when scanner is toggled ON", async () => {
    mockRules = [{ id: "rule-1" }, { id: "rule-2" }];
    const { PATCH } = await import("./route");
    const res = await PATCH(new Request("http://localhost", {
      method: "PATCH",
      body: JSON.stringify({ scannerEnabled: true }),
    }) as any);
    expect(res.status).toBe(200);
    expect(enqueueScanJobsMock).toHaveBeenCalledWith(["rule-1", "rule-2"]);
    expect(enqueueFlagJobsMock).not.toHaveBeenCalled();
  });

  it("updates settings and enqueues flag jobs when flagger is toggled ON", async () => {
    mockFindings = [{ id: "finding-1" }];
    const { PATCH } = await import("./route");
    const res = await PATCH(new Request("http://localhost", {
      method: "PATCH",
      body: JSON.stringify({ flaggerEnabled: true }),
    }) as any);
    expect(res.status).toBe(200);
    expect(enqueueFlagJobsMock).toHaveBeenCalledWith(["finding-1"]);
    expect(enqueueScanJobsMock).not.toHaveBeenCalled();
  });

  it("does not enqueue jobs when toggling scanner or flagger OFF", async () => {
    const { PATCH } = await import("./route");
    const res = await PATCH(new Request("http://localhost", {
      method: "PATCH",
      body: JSON.stringify({ scannerEnabled: false, flaggerEnabled: false }),
    }) as any);
    expect(res.status).toBe(200);
    expect(enqueueScanJobsMock).not.toHaveBeenCalled();
    expect(enqueueFlagJobsMock).not.toHaveBeenCalled();
  });
});
