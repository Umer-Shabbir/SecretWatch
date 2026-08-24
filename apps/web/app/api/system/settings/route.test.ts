import { describe, expect, it, vi, beforeEach } from "vitest";

/**
 * /api/system/settings (2026-08-24 admin-control addition). Tests admin
 * authorization on GET+PATCH, the partial-patch update contract, and the
 * audit-log entry each toggle writes.
 */

let currentSessionUserId: string | null = "admin-a";
let currentSessionRole: "ADMIN" | "USER" | null = "ADMIN";

const getSettingsMock = vi.fn(async () => ({
  scannerEnabled: true,
  flaggerEnabled: true,
  autoFlagEnabled: true,
  scanResultsPerRule: 30,
  flagRateLimitThreshold: 5,
  updatedAt: "2026-08-24T00:00:00.000Z",
}));
const updateSettingsMock = vi.fn(async (patch: any) => ({
  scannerEnabled: patch.scannerEnabled ?? true,
  flaggerEnabled: patch.flaggerEnabled ?? true,
  autoFlagEnabled: patch.autoFlagEnabled ?? true,
  scanResultsPerRule: patch.scanResultsPerRule ?? 30,
  flagRateLimitThreshold: patch.flagRateLimitThreshold ?? 5,
  updatedAt: "2026-08-24T00:00:00.000Z",
}));

vi.mock("@/lib/system-settings", () => ({
  getSystemSettings: () => getSettingsMock(),
  updateSystemSettings: (patch: any) => updateSettingsMock(patch),
}));

const recordAuditMock = vi.fn(
  async (_params: { userId?: string | null; action: string; detail?: string }) => undefined
);
vi.mock("@/lib/audit", () => ({
  recordAudit: (params: any) => recordAuditMock(params),
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
  recordAuditMock.mockClear();
  updateSettingsMock.mockClear();
});

function patchReq(body: unknown) {
  return new Request("http://localhost/api/system/settings", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("GET /api/system/settings — authorization", () => {
  it("returns 401 with no session", async () => {
    currentSessionUserId = null;
    const { GET } = await import("./route");
    expect((await GET()).status).toBe(401);
  });

  it("returns 403 for a non-admin", async () => {
    currentSessionRole = "USER";
    const { GET } = await import("./route");
    expect((await GET()).status).toBe(403);
  });

  it("returns 200 with the settings for an admin", async () => {
    const { GET } = await import("./route");
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.settings.scannerEnabled).toBe(true);
    expect(body.settings.flaggerEnabled).toBe(true);
  });
});

describe("PATCH /api/system/settings", () => {
  it("returns 403 for a non-admin and never updates", async () => {
    currentSessionRole = "USER";
    const { PATCH } = await import("./route");
    const res = await PATCH(patchReq({ scannerEnabled: false }) as any);
    expect(res.status).toBe(403);
    expect(updateSettingsMock).not.toHaveBeenCalled();
  });

  it("rejects an empty patch (no switch provided) with 400", async () => {
    const { PATCH } = await import("./route");
    const res = await PATCH(patchReq({}) as any);
    expect(res.status).toBe(400);
    expect(updateSettingsMock).not.toHaveBeenCalled();
  });

  it("updates only the provided switch and audit-logs the change", async () => {
    const { PATCH } = await import("./route");
    const res = await PATCH(patchReq({ scannerEnabled: false }) as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.settings.scannerEnabled).toBe(false);
    expect(updateSettingsMock).toHaveBeenCalledWith({ scannerEnabled: false });
    expect(recordAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "admin-a", action: "system_settings_updated" })
    );
  });

  it("updates the numeric tuning settings", async () => {
    const { PATCH } = await import("./route");
    const res = await PATCH(patchReq({ scanResultsPerRule: 50, flagRateLimitThreshold: 10 }) as any);
    expect(res.status).toBe(200);
    expect(updateSettingsMock).toHaveBeenCalledWith({ scanResultsPerRule: 50, flagRateLimitThreshold: 10 });
  });

  it("updates the autoFlagEnabled setting", async () => {
    const { PATCH } = await import("./route");
    const res = await PATCH(patchReq({ autoFlagEnabled: false }) as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.settings.autoFlagEnabled).toBe(false);
  });

  it("rejects scanResultsPerRule out of the 1–100 range with 400", async () => {
    const { PATCH } = await import("./route");
    expect((await PATCH(patchReq({ scanResultsPerRule: 0 }) as any)).status).toBe(400);
    expect((await PATCH(patchReq({ scanResultsPerRule: 101 }) as any)).status).toBe(400);
    expect(updateSettingsMock).not.toHaveBeenCalled();
  });

  it("rejects a non-integer flagRateLimitThreshold with 400", async () => {
    const { PATCH } = await import("./route");
    const res = await PATCH(patchReq({ flagRateLimitThreshold: 3.5 }) as any);
    expect(res.status).toBe(400);
    expect(updateSettingsMock).not.toHaveBeenCalled();
  });
});
