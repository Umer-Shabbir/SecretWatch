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

const recordAuditMock = vi.fn(async (_params?: any) => undefined);
vi.mock("@/lib/audit", () => ({
  recordAudit: (params: any) => recordAuditMock(params),
}));

const bulkResetFindingsMock = vi.fn();
vi.mock("@/lib/findings", () => ({
  bulkResetFindings: (ids: string[]) => bulkResetFindingsMock(ids),
}));

beforeEach(() => {
  currentSessionUserId = "admin-a";
  currentSessionRole = "ADMIN";
  recordAuditMock.mockClear();
  bulkResetFindingsMock.mockClear();
});

describe("POST /api/findings/bulk/reset", () => {
  it("returns 401 when unauthenticated", async () => {
    currentSessionUserId = null;
    const { POST } = await import("./route");
    const res = await POST(new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({ ids: ["1", "2"] }),
    }));
    expect(res.status).toBe(401);
  });

  it("returns 403 when not an admin", async () => {
    currentSessionRole = "USER";
    const { POST } = await import("./route");
    const res = await POST(new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({ ids: ["1", "2"] }),
    }));
    expect(res.status).toBe(403);
  });

  it("returns 400 when body is invalid", async () => {
    const { POST } = await import("./route");
    const res = await POST(new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({ ids: [] }),
    }));
    expect(res.status).toBe(400);
  });

  it("resets findings and records audit log", async () => {
    bulkResetFindingsMock.mockResolvedValueOnce({ count: 2 });
    const { POST } = await import("./route");
    const res = await POST(new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({ ids: ["1", "2"] }),
    }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ count: 2 });
    expect(recordAuditMock).toHaveBeenCalledWith(expect.objectContaining({
      action: "findings_bulk_reset",
    }));
  });
});
