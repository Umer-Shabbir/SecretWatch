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

class FindingNotFoundError extends Error {
  constructor(id: string) {
    super(`Finding not found: ${id}`);
    this.name = "FindingNotFoundError";
  }
}

class InvalidFindingTransitionError extends Error {
  constructor(public currentStatus: string, public attemptedStatus: string) {
    super(`Cannot transition finding from ${currentStatus} to ${attemptedStatus}`);
    this.name = "InvalidFindingTransitionError";
  }
}

const resetFindingMock = vi.fn();
vi.mock("@/lib/findings", () => ({
  resetFinding: (id: string) => resetFindingMock(id),
  FindingNotFoundError,
  InvalidFindingTransitionError
}));

beforeEach(() => {
  currentSessionUserId = "admin-a";
  currentSessionRole = "ADMIN";
  recordAuditMock.mockClear();
  resetFindingMock.mockClear();
});

describe("POST /api/findings/[id]/reset", () => {
  it("returns 401 when unauthenticated", async () => {
    currentSessionUserId = null;
    const { POST } = await import("./route");
    const res = await POST(new Request("http://localhost"), { params: { id: "1" } });
    expect(res.status).toBe(401);
  });

  it("returns 403 when not an admin", async () => {
    currentSessionRole = "USER";
    const { POST } = await import("./route");
    const res = await POST(new Request("http://localhost"), { params: { id: "1" } });
    expect(res.status).toBe(403);
  });

  it("returns 404 when finding not found", async () => {
    resetFindingMock.mockRejectedValueOnce(new FindingNotFoundError("1"));
    const { POST } = await import("./route");
    const res = await POST(new Request("http://localhost"), { params: { id: "1" } });
    expect(res.status).toBe(404);
  });
  
  it("returns 409 for invalid state transitions", async () => {
    resetFindingMock.mockRejectedValueOnce(new InvalidFindingTransitionError("PENDING", "PENDING"));
    const { POST } = await import("./route");
    const res = await POST(new Request("http://localhost"), { params: { id: "1" } });
    expect(res.status).toBe(409);
  });

  it("resets finding and records audit successfully", async () => {
    resetFindingMock.mockResolvedValueOnce({ id: "1", status: "PENDING" });
    const { POST } = await import("./route");
    const res = await POST(new Request("http://localhost"), { params: { id: "1" } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ id: "1", status: "PENDING" });
    expect(recordAuditMock).toHaveBeenCalledWith(expect.objectContaining({
      action: "finding_reset",
      detail: expect.stringContaining("new_status=PENDING")
    }));
  });
});
