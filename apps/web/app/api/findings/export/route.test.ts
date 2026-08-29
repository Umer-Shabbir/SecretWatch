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

const recordAuditMock = vi.fn(async (params: any) => undefined);
vi.mock("@/lib/audit", () => ({
  recordAudit: (params: any) => recordAuditMock(params),
}));

const mockExportFindingsToCSV = vi.fn(async (query: any, controller: any) => {
  controller.enqueue(new TextEncoder().encode("id,repoFullName\n1,test/repo\n"));
  controller.close();
});

const mockExportFindingsToJSON = vi.fn(async (query: any, controller: any) => {
  controller.enqueue(new TextEncoder().encode('[{"id":"1","repoFullName":"test/repo"}]'));
  controller.close();
});

vi.mock("@/lib/findings", () => ({
  parseExportQuery: vi.fn((searchParams: URLSearchParams) => {
    const format = searchParams.get("format");
    if (format && !["csv", "json"].includes(format)) {
      return { success: false, error: { message: "Invalid format" } };
    }
    return {
      success: true,
      data: {
        format: format || "csv",
        status: searchParams.get("status") || undefined,
        severity: searchParams.get("severity") || undefined,
      }
    };
  }),
  exportFindingsToCSV: (query: any, controller: any) => mockExportFindingsToCSV(query, controller),
  exportFindingsToJSON: (query: any, controller: any) => mockExportFindingsToJSON(query, controller),
}));

beforeEach(() => {
  currentSessionUserId = "admin-a";
  currentSessionRole = "ADMIN";
  recordAuditMock.mockClear();
  mockExportFindingsToCSV.mockClear();
  mockExportFindingsToJSON.mockClear();
});

describe("GET /api/findings/export", () => {
  it("returns 401 when unauthenticated", async () => {
    currentSessionUserId = null;
    const { GET } = await import("./route");
    const res = await GET(new Request("http://localhost/api/findings/export"));
    expect(res.status).toBe(401);
  });

  it("returns 403 when not an admin", async () => {
    currentSessionRole = "USER";
    const { GET } = await import("./route");
    const res = await GET(new Request("http://localhost/api/findings/export"));
    expect(res.status).toBe(403);
  });

  it("returns 400 on invalid query params", async () => {
    const { GET } = await import("./route");
    const res = await GET(new Request("http://localhost/api/findings/export?format=xml"));
    expect(res.status).toBe(400);
  });

  it("exports CSV by default with correct headers", async () => {
    const { GET } = await import("./route");
    const res = await GET(new Request("http://localhost/api/findings/export"));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/csv; charset=utf-8");
    expect(res.headers.get("Content-Disposition")).toMatch(/^attachment; filename="findings_export_.*\.csv"$/);

    const text = await res.text();
    expect(text).toBe("id,repoFullName\n1,test/repo\n");
    expect(mockExportFindingsToCSV).toHaveBeenCalled();
    expect(recordAuditMock).toHaveBeenCalledWith(expect.objectContaining({
      action: "findings_exported",
      detail: expect.stringContaining("format=csv")
    }));
  });

  it("exports JSON when requested with correct headers", async () => {
    const { GET } = await import("./route");
    const res = await GET(new Request("http://localhost/api/findings/export?format=json"));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/json");
    expect(res.headers.get("Content-Disposition")).toMatch(/^attachment; filename="findings_export_.*\.json"$/);

    const json = await res.json();
    expect(json).toEqual([{ id: "1", repoFullName: "test/repo" }]);
    expect(mockExportFindingsToJSON).toHaveBeenCalled();
    expect(recordAuditMock).toHaveBeenCalledWith(expect.objectContaining({
      action: "findings_exported",
      detail: expect.stringContaining("format=json")
    }));
  });
});
