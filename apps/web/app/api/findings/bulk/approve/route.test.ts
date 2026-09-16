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

const bulkApproveFindingsMock = vi.fn();
vi.mock("@/lib/findings", () => ({
  bulkApproveFindings: (ids: string[]) => bulkApproveFindingsMock(ids),
}));

const enqueueFlagJobsMock = vi.fn();
vi.mock("@/lib/queue", () => ({
  enqueueFlagJobs: (ids: string[]) => enqueueFlagJobsMock(ids),
}));

const getSystemSettingsMock = vi.fn();
vi.mock("@/lib/system-settings", () => ({
  getSystemSettings: () => getSystemSettingsMock(),
}));

const dispatchWebhookEventMock = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/webhooks", () => ({
  dispatchWebhookEvent: (...args: any[]) => dispatchWebhookEventMock(...args),
}));

const findManyMock = vi.fn();
vi.mock("@/lib/db", () => ({
  prisma: {
    finding: {
      findMany: (...args: any[]) => findManyMock(...args),
    },
  },
}));

beforeEach(() => {
  currentSessionUserId = "admin-a";
  currentSessionRole = "ADMIN";
  recordAuditMock.mockClear();
  bulkApproveFindingsMock.mockClear();
  enqueueFlagJobsMock.mockClear();
  getSystemSettingsMock.mockResolvedValue({ autoFlagEnabled: true });
  dispatchWebhookEventMock.mockClear();
  findManyMock.mockClear();
});

describe("POST /api/findings/bulk/approve", () => {
  it("returns 401 when unauthenticated", async () => {
    currentSessionUserId = null;
    const { POST } = await import("./route");
    const res = await POST(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({ ids: ["1", "2"] }),
      })
    );
    expect(res.status).toBe(401);
  });

  it("returns 403 when not an admin", async () => {
    currentSessionRole = "USER";
    const { POST } = await import("./route");
    const res = await POST(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({ ids: ["1", "2"] }),
      })
    );
    expect(res.status).toBe(403);
  });

  it("returns 400 when body is invalid", async () => {
    const { POST } = await import("./route");
    const res = await POST(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({ ids: [] }),
      })
    );
    expect(res.status).toBe(400);
  });

  it("only enqueues flag jobs for findings that actually transitioned to APPROVED", async () => {
    bulkApproveFindingsMock.mockResolvedValueOnce({ count: 1 });
    // Out of ["1", "2"], only "1" is actually APPROVED in the DB
    findManyMock.mockResolvedValueOnce([
      { id: "1", repoFullName: "org/repo", filePath: "secrets.env", matchedRule: "aws_key", severity: "HIGH" },
    ]);

    const { POST } = await import("./route");
    const res = await POST(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({ ids: ["1", "2"] }),
      })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ count: 1 });

    expect(recordAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "findings_bulk_approved",
      })
    );

    // Ensure it only enqueues ["1"], not raw client input ["1", "2"]
    expect(enqueueFlagJobsMock).toHaveBeenCalledWith(["1"]);
    expect(dispatchWebhookEventMock).toHaveBeenCalledTimes(1);
    expect(dispatchWebhookEventMock).toHaveBeenCalledWith("finding.approved", expect.objectContaining({ id: "1" }));
  });
});
