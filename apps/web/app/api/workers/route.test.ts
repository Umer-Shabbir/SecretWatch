import { describe, expect, it, vi, beforeEach } from "vitest";

let currentSessionUserId: string | null = "admin-a";
let currentSessionRole: "USER" | "ADMIN" = "ADMIN";
let snapshotResult: any = { workers: [], recentJobs: [], degraded: false };
let shouldThrow = false;

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

vi.mock("@/lib/workers", () => ({
  getWorkerMonitoringSnapshot: vi.fn(async () => {
    if (shouldThrow) throw new Error("redis unreachable");
    return snapshotResult;
  }),
}));

beforeEach(() => {
  currentSessionUserId = "admin-a";
  currentSessionRole = "ADMIN";
  snapshotResult = { workers: [], recentJobs: [], degraded: false };
  shouldThrow = false;
  vi.clearAllMocks();
});

describe("GET /api/workers", () => {
  it("returns 401 when there is no session", async () => {
    currentSessionUserId = null;
    const { GET } = await import("./route");
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns 403 when the session is not an admin", async () => {
    currentSessionRole = "USER";
    const { GET } = await import("./route");
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("returns the snapshot as JSON for an admin session", async () => {
    snapshotResult = {
      workers: [
        { key: "scanner", name: "Scanner", status: "healthy", concurrency: 2, queueCount: 0, lastJobAt: null, successRate: null },
      ],
      recentJobs: [],
      degraded: false,
    };
    const { GET } = await import("./route");
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual(snapshotResult);
  });

  it("returns 502 with a safe message when the snapshot read fails", async () => {
    shouldThrow = true;
    const { GET } = await import("./route");
    const res = await GET();
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.message).toBe("Unable to reach worker status");
  });
});
