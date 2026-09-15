import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/authorize", () => ({
  requireAdmin: vi.fn(async () => ({ user: { id: "admin-1", role: "ADMIN" } })),
}));

vi.mock("@/lib/monitoring-cache", () => ({
  getCachedWorkerMonitoringSnapshot: vi.fn(async () => ({
    workers: [],
    recentJobs: [],
    degraded: false,
  })),
  getCachedLiveActivity: vi.fn(async () => ({
    generatedAt: "2026-09-16T00:00:00.000Z",
    scanner: { queue: null, totalFound: 10, recent: [] },
    flagger: { queue: null, totalFlagged: 5, totalFailed: 0, recent: [], recentFailures: [] },
  })),
}));

describe("GET /api/admin/events", () => {
  it("returns a text/event-stream response and delegates to cache", async () => {
    const { GET } = await import("./route");
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/event-stream");
  });
});
