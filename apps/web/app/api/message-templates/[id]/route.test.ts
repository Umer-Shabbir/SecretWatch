import { describe, expect, it, vi, beforeEach } from "vitest";

interface FakeMessageTemplateRow {
  id: string;
  name: string;
  body: string;
  isDefault: boolean;
  severity: string | null;
  secretType: string | null;
  includeAttributionLine: boolean;
  createdAt: Date;
  updatedAt: Date;
}

let rows: FakeMessageTemplateRow[] = [];
let currentSessionUserId: string | null = "admin-a";
let currentSessionRole: "USER" | "ADMIN" = "ADMIN";

function makeRow(overrides: Partial<FakeMessageTemplateRow>): FakeMessageTemplateRow {
  return {
    id: overrides.id ?? `tmpl_${Math.random()}`,
    name: overrides.name ?? "Default Secret Finding",
    body: overrides.body ?? "Found {{rule}} in {{file}} ({{repo}}).",
    isDefault: overrides.isDefault ?? false,
    severity: overrides.severity ?? null,
    secretType: overrides.secretType ?? null,
    includeAttributionLine: overrides.includeAttributionLine ?? false,
    createdAt: overrides.createdAt ?? new Date("2026-01-01"),
    updatedAt: overrides.updatedAt ?? new Date("2026-01-01"),
  };
}

let sharedPrisma: any;

function resetFakeDb(seed: FakeMessageTemplateRow[]) {
  rows = seed;
  const client = {
    messageTemplate: {
      findUnique: vi.fn(async ({ where }: any) => rows.find((r) => r.id === where.id) ?? null),
      count: vi.fn(async () => rows.length),
      update: vi.fn(async ({ where, data }: any) => {
        const idx = rows.findIndex((r) => r.id === where.id);
        if (idx === -1) throw new Error("not found");
        rows[idx] = { ...rows[idx], ...data, updatedAt: new Date() };
        return rows[idx];
      }),
      delete: vi.fn(async ({ where }: any) => {
        const idx = rows.findIndex((r) => r.id === where.id);
        if (idx === -1) throw new Error("not found");
        const [removed] = rows.splice(idx, 1);
        return removed;
      }),
    },
    $transaction: vi.fn(async (cb: (tx: any) => Promise<any>) => cb(client)),
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

beforeEach(() => {
  currentSessionUserId = "admin-a";
  currentSessionRole = "ADMIN";
  recordAuditMock.mockClear();
  resetFakeDb([
    makeRow({ id: "default1", name: "Default Secret Finding", isDefault: true }),
    makeRow({ id: "custom1", name: "Custom Template", isDefault: false }),
  ]);
});

function patchRequest(body: unknown): Request {
  return new Request("http://localhost/api/message-templates/custom1", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

function deleteRequest(id: string): Request {
  return new Request(`http://localhost/api/message-templates/${id}`, { method: "DELETE" });
}

describe("GET /api/message-templates/:id", () => {
  it("returns 401 when there is no session", async () => {
    currentSessionUserId = null;
    const { GET } = await import("./route");
    const res = await GET(new Request("http://localhost/api/message-templates/custom1") as any, {
      params: { id: "custom1" },
    });
    expect(res.status).toBe(401);
  });

  it("returns 403 for an authenticated non-admin USER", async () => {
    currentSessionUserId = "user-a";
    currentSessionRole = "USER";
    const { GET } = await import("./route");
    const res = await GET(new Request("http://localhost/api/message-templates/custom1") as any, {
      params: { id: "custom1" },
    });
    expect(res.status).toBe(403);
  });

  it("returns the template on a happy path", async () => {
    const { GET } = await import("./route");
    const res = await GET(new Request("http://localhost/api/message-templates/custom1") as any, {
      params: { id: "custom1" },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.template.id).toBe("custom1");
  });

  it("returns 404 for a nonexistent id", async () => {
    const { GET } = await import("./route");
    const res = await GET(new Request("http://localhost/api/message-templates/nope") as any, {
      params: { id: "nope" },
    });
    expect(res.status).toBe(404);
  });
});

describe("PATCH /api/message-templates/:id — authorization", () => {
  it("returns 401 when there is no session", async () => {
    currentSessionUserId = null;
    const { PATCH } = await import("./route");
    const res = await PATCH(patchRequest({ name: "New Name" }) as any, { params: { id: "custom1" } });
    expect(res.status).toBe(401);
  });

  it("returns 403 for an authenticated non-admin USER", async () => {
    currentSessionUserId = "user-a";
    currentSessionRole = "USER";
    const { PATCH } = await import("./route");
    const res = await PATCH(patchRequest({ name: "New Name" }) as any, { params: { id: "custom1" } });
    expect(res.status).toBe(403);
  });
});

describe("PATCH /api/message-templates/:id — validation", () => {
  it("returns 400 when neither name nor body is provided", async () => {
    const { PATCH } = await import("./route");
    const res = await PATCH(patchRequest({}) as any, { params: { id: "custom1" } });
    expect(res.status).toBe(400);
  });

  it("returns 400 for malformed JSON", async () => {
    const { PATCH } = await import("./route");
    const res = await PATCH(
      new Request("http://localhost/api/message-templates/custom1", { method: "PATCH", body: "{not json" }) as any,
      { params: { id: "custom1" } }
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 for an unsupported variable in body", async () => {
    const { PATCH } = await import("./route");
    const res = await PATCH(patchRequest({ body: "{{token}}" }) as any, { params: { id: "custom1" } });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("invalid_variable");
  });
});

describe("PATCH /api/message-templates/:id — not found", () => {
  it("returns 404 for a nonexistent id", async () => {
    const { PATCH } = await import("./route");
    const res = await PATCH(
      new Request("http://localhost/api/message-templates/nope", {
        method: "PATCH",
        body: JSON.stringify({ name: "X" }),
      }) as any,
      { params: { id: "nope" } }
    );
    expect(res.status).toBe(404);
  });
});

describe("PATCH /api/message-templates/:id — successful update", () => {
  it("updates the name only", async () => {
    const { PATCH } = await import("./route");
    const res = await PATCH(patchRequest({ name: "Renamed Template" }) as any, { params: { id: "custom1" } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.template.name).toBe("Renamed Template");
  });

  it("records an audit log entry", async () => {
    const { PATCH } = await import("./route");
    await PATCH(patchRequest({ name: "Renamed Template" }) as any, { params: { id: "custom1" } });
    expect(recordAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "admin-a", action: "message_template_updated" })
    );
  });

  it("updates severity/secretType/includeAttributionLine without requiring name or body", async () => {
    const { PATCH } = await import("./route");
    const res = await PATCH(
      patchRequest({ severity: "MEDIUM", secretType: "GENERIC_API_KEY", includeAttributionLine: true }) as any,
      { params: { id: "custom1" } }
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.template.severity).toBe("MEDIUM");
    expect(body.template.secretType).toBe("GENERIC_API_KEY");
    expect(body.template.includeAttributionLine).toBe(true);
  });

  it("returns 400 for an invalid secretType enum value", async () => {
    const { PATCH } = await import("./route");
    const res = await PATCH(patchRequest({ secretType: "NOT_A_TYPE" }) as any, { params: { id: "custom1" } });
    expect(res.status).toBe(400);
  });
});

describe("DELETE /api/message-templates/:id", () => {
  it("returns 401 when there is no session", async () => {
    currentSessionUserId = null;
    const { DELETE } = await import("./route");
    const res = await DELETE(deleteRequest("custom1") as any, { params: { id: "custom1" } });
    expect(res.status).toBe(401);
  });

  it("returns 403 for an authenticated non-admin USER", async () => {
    currentSessionUserId = "user-a";
    currentSessionRole = "USER";
    const { DELETE } = await import("./route");
    const res = await DELETE(deleteRequest("custom1") as any, { params: { id: "custom1" } });
    expect(res.status).toBe(403);
  });

  it("returns 404 for a nonexistent id", async () => {
    const { DELETE } = await import("./route");
    const res = await DELETE(deleteRequest("nope") as any, { params: { id: "nope" } });
    expect(res.status).toBe(404);
  });

  it("returns 409 cannot_delete_default when targeting the default template", async () => {
    const { DELETE } = await import("./route");
    const res = await DELETE(deleteRequest("default1") as any, { params: { id: "default1" } });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe("cannot_delete_default");
  });

  it("returns 409 cannot_delete_last_template when it's the only remaining row", async () => {
    resetFakeDb([makeRow({ id: "only1", isDefault: false })]);
    const { DELETE } = await import("./route");
    const res = await DELETE(deleteRequest("only1") as any, { params: { id: "only1" } });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe("cannot_delete_last_template");
  });

  it("succeeds deleting a non-default template when more than one exists", async () => {
    const { DELETE } = await import("./route");
    const res = await DELETE(deleteRequest("custom1") as any, { params: { id: "custom1" } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(rows.some((r) => r.id === "custom1")).toBe(false);
  });

  it("records an audit log entry on successful delete", async () => {
    const { DELETE } = await import("./route");
    await DELETE(deleteRequest("custom1") as any, { params: { id: "custom1" } });
    expect(recordAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "admin-a", action: "message_template_deleted" })
    );
  });
});
