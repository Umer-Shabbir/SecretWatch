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
      findMany: vi.fn(async () => [...rows]),
      findUnique: vi.fn(async ({ where }: any) => rows.find((r) => r.id === where.id) ?? null),
      count: vi.fn(async () => rows.length),
      create: vi.fn(async ({ data }: any) => {
        const row: FakeMessageTemplateRow = {
          id: `tmpl_${Math.random()}`,
          name: data.name,
          body: data.body,
          isDefault: data.isDefault ?? false,
          severity: data.severity ?? null,
          secretType: data.secretType ?? null,
          includeAttributionLine: data.includeAttributionLine ?? false,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        rows.push(row);
        return row;
      }),
    },
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
    makeRow({ id: "default1", name: "Default Secret Finding", isDefault: true, createdAt: new Date("2026-01-01") }),
    makeRow({ id: "custom1", name: "Custom Template", isDefault: false, createdAt: new Date("2026-01-02") }),
  ]);
});

function postRequest(body: unknown): Request {
  return new Request("http://localhost/api/message-templates", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("GET /api/message-templates — authorization", () => {
  it("returns 401 when there is no session", async () => {
    currentSessionUserId = null;
    const { GET } = await import("./route");
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns 403 for an authenticated non-admin USER", async () => {
    currentSessionUserId = "user-a";
    currentSessionRole = "USER";
    const { GET } = await import("./route");
    const res = await GET();
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("forbidden");
  });

  it("allows an authenticated ADMIN", async () => {
    const { GET } = await import("./route");
    const res = await GET();
    expect(res.status).toBe(200);
  });
});

describe("GET /api/message-templates — response shape", () => {
  it("returns all templates, default first", async () => {
    const { GET } = await import("./route");
    const res = await GET();
    const body = await res.json();
    expect(body.templates).toHaveLength(2);
    expect(body.templates[0].id).toBe("default1");
    expect(body.templates[1].id).toBe("custom1");
  });

  it("returns exactly the documented MessageTemplateSummary fields", async () => {
    const { GET } = await import("./route");
    const res = await GET();
    const body = await res.json();
    const keys = Object.keys(body.templates[0]).sort();
    expect(keys).toEqual(
      [
        "id",
        "name",
        "body",
        "isDefault",
        "severity",
        "secretType",
        "includeAttributionLine",
        "createdAt",
        "updatedAt",
      ].sort()
    );
  });
});

describe("POST /api/message-templates — authorization", () => {
  it("returns 401 when there is no session", async () => {
    currentSessionUserId = null;
    const { POST } = await import("./route");
    const res = await POST(postRequest({ name: "New Template", body: "{{repo}}" }) as any);
    expect(res.status).toBe(401);
  });

  it("returns 403 for an authenticated non-admin USER", async () => {
    currentSessionUserId = "user-a";
    currentSessionRole = "USER";
    const { POST } = await import("./route");
    const res = await POST(postRequest({ name: "New Template", body: "{{repo}}" }) as any);
    expect(res.status).toBe(403);
  });
});

describe("POST /api/message-templates — validation", () => {
  it("returns 400 for an empty name", async () => {
    const { POST } = await import("./route");
    const res = await POST(postRequest({ name: "", body: "{{repo}}" }) as any);
    expect(res.status).toBe(400);
  });

  it("returns 400 for an empty body", async () => {
    const { POST } = await import("./route");
    const res = await POST(postRequest({ name: "New Template", body: "" }) as any);
    expect(res.status).toBe(400);
  });

  it("returns 400 for malformed JSON", async () => {
    const { POST } = await import("./route");
    const res = await POST(
      new Request("http://localhost/api/message-templates", { method: "POST", body: "{not json" }) as any
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 for an unsupported variable, naming it in the message", async () => {
    const { POST } = await import("./route");
    const res = await POST(postRequest({ name: "Bad Template", body: "Leaked: {{secret}}" }) as any);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("invalid_variable");
    expect(body.message).toContain("secret");
  });
});

describe("POST /api/message-templates — successful create", () => {
  it("creates a template defaulting to isDefault: false", async () => {
    const { POST } = await import("./route");
    const res = await POST(postRequest({ name: "Slack Alert", body: "Found {{rule}} in {{file}}" }) as any);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.template.name).toBe("Slack Alert");
    expect(body.template.isDefault).toBe(false);
    expect(rows.some((r) => r.name === "Slack Alert")).toBe(true);
  });

  it("records an audit log entry referencing only id/name, never body", async () => {
    const { POST } = await import("./route");
    await POST(postRequest({ name: "Slack Alert", body: "Found {{rule}} in {{file}}" }) as any);
    expect(recordAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "admin-a", action: "message_template_created" })
    );
    const call = recordAuditMock.mock.calls[0][0];
    expect(call.detail).not.toContain("Found {{rule}}");
  });

  it("accepts severity/secretType/includeAttributionLine and persists them", async () => {
    const { POST } = await import("./route");
    const res = await POST(
      postRequest({
        name: "Critical AWS Key",
        body: "{{repo}}",
        severity: "CRITICAL",
        secretType: "AWS_KEY",
        includeAttributionLine: true,
      }) as any
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.template.severity).toBe("CRITICAL");
    expect(body.template.secretType).toBe("AWS_KEY");
    expect(body.template.includeAttributionLine).toBe(true);
  });

  it("defaults severity/secretType to null and includeAttributionLine to false when omitted", async () => {
    const { POST } = await import("./route");
    const res = await POST(postRequest({ name: "Plain", body: "{{repo}}" }) as any);
    const body = await res.json();
    expect(body.template.severity).toBeNull();
    expect(body.template.secretType).toBeNull();
    expect(body.template.includeAttributionLine).toBe(false);
  });

  it("returns 400 for an invalid severity enum value", async () => {
    const { POST } = await import("./route");
    const res = await POST(postRequest({ name: "Bad Severity", body: "{{repo}}", severity: "URGENT" }) as any);
    expect(res.status).toBe(400);
  });
});
