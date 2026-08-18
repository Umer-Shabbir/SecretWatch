import { describe, expect, it, vi, beforeEach } from "vitest";

// Obviously-fake fixture only — never a realistic-looking secret; this
// route never touches secret material at all (redactedSnippet is not part
// of the list contract), but keep the convention for consistency.
const NEVER_INCLUDE = "AKIA_SHOULD_NEVER_APPEAR_FAKE";

interface FakeFindingRow {
  id: string;
  repoFullName: string;
  filePath: string;
  matchedRule: string;
  status: string;
  commitSha: string;
  createdAt: Date;
  redactedSnippet: string;
}

let rows: FakeFindingRow[] = [];
let currentSessionUserId: string | null = "user-a";

function makeRow(overrides: Partial<FakeFindingRow>): FakeFindingRow {
  return {
    id: overrides.id ?? `finding_${Math.random()}`,
    repoFullName: overrides.repoFullName ?? "acme/widgets",
    filePath: overrides.filePath ?? "config/prod.env",
    matchedRule: overrides.matchedRule ?? "AWS Access Key",
    status: overrides.status ?? "PENDING",
    commitSha: overrides.commitSha ?? "abcdef1234567890",
    createdAt: overrides.createdAt ?? new Date(),
    redactedSnippet: overrides.redactedSnippet ?? "const key = \"AKIA••••fake\";",
  };
}

let sharedPrisma: any;

function applyFilters(where: any, rows: FakeFindingRow[]): FakeFindingRow[] {
  let result = rows;
  if (where?.status) {
    result = result.filter((r) => r.status === where.status);
  }
  if (where?.OR) {
    const q = (where.OR[0]?.repoFullName?.contains ?? "").toLowerCase();
    result = result.filter(
      (r) => r.repoFullName.toLowerCase().includes(q) || r.filePath.toLowerCase().includes(q)
    );
  }
  return result;
}

function resetFakeDb(seed: FakeFindingRow[]) {
  rows = seed;
  const client = {
    finding: {
      count: vi.fn(async ({ where }: any) => applyFilters(where, rows).length),
      findMany: vi.fn(async ({ where, skip = 0, take }: any) => {
        const filtered = applyFilters(where, rows).sort(
          (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
        );
        return filtered.slice(skip, skip + take);
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

let currentSessionRole: "ADMIN" | "USER" | null = "ADMIN";

vi.mock("@/lib/authorize", () => ({
  requireAdmin: vi.fn(async () => {
    if (!currentSessionUserId) {
      return { session: null, error: "unauthenticated" as const };
    }
    if (currentSessionRole !== "ADMIN") {
      return { session: null, error: "forbidden" as const };
    }
    return { session: { user: { id: currentSessionUserId, role: "ADMIN" } }, error: null };
  }),
}));

beforeEach(() => {
  currentSessionUserId = "user-a";
  currentSessionRole = "ADMIN";
  resetFakeDb([
    makeRow({ id: "f1", status: "PENDING", createdAt: new Date("2026-01-03") }),
    makeRow({ id: "f2", status: "APPROVED", createdAt: new Date("2026-01-02") }),
    makeRow({ id: "f3", status: "PENDING", repoFullName: "other/repo", createdAt: new Date("2026-01-01") }),
  ]);
});

describe("GET /api/findings — authorization", () => {
  it("returns 401 when there is no session", async () => {
    currentSessionUserId = null;
    const { GET } = await import("./route");
    const res = await GET(new Request("http://localhost/api/findings") as any);
    expect(res.status).toBe(401);
  });

  it("returns 403 for a non-admin (USER role) session", async () => {
    currentSessionUserId = "user-a";
    currentSessionRole = "USER";
    const { GET } = await import("./route");
    const res = await GET(withNextUrl("http://localhost/api/findings"));
    expect(res.status).toBe(403);
  });

  it("allows an ADMIN session to read the list", async () => {
    currentSessionUserId = "user-a";
    currentSessionRole = "ADMIN";
    const { GET } = await import("./route");
    const res = await GET(withNextUrl("http://localhost/api/findings"));
    expect(res.status).toBe(200);
  });
});

describe("GET /api/findings — pagination", () => {
  it("defaults to page 1, pageSize 20", async () => {
    const { GET } = await import("./route");
    const res = await GET(withNextUrl("http://localhost/api/findings"));
    const body = await res.json();
    expect(body.page).toBe(1);
    expect(body.pageSize).toBe(20);
    expect(body.total).toBe(3);
    expect(body.totalPages).toBe(1);
    expect(body.findings).toHaveLength(3);
  });

  it("respects page/pageSize params", async () => {
    const { GET } = await import("./route");
    const res = await GET(withNextUrl("http://localhost/api/findings?page=2&pageSize=1"));
    const body = await res.json();
    expect(body.page).toBe(2);
    expect(body.pageSize).toBe(1);
    expect(body.findings).toHaveLength(1);
    expect(body.totalPages).toBe(3);
  });

  it("caps pageSize at 50", async () => {
    const { GET } = await import("./route");
    const res = await GET(withNextUrl("http://localhost/api/findings?pageSize=500"));
    expect(res.status).toBe(400);
  });

  it("rejects invalid page values", async () => {
    const { GET } = await import("./route");
    const res = await GET(withNextUrl("http://localhost/api/findings?page=0"));
    expect(res.status).toBe(400);
  });
});

describe("GET /api/findings — filtering", () => {
  it("filters by status", async () => {
    const { GET } = await import("./route");
    const res = await GET(withNextUrl("http://localhost/api/findings?status=APPROVED"));
    const body = await res.json();
    expect(body.findings).toHaveLength(1);
    expect(body.findings[0].id).toBe("f2");
  });

  it("rejects an invalid status value", async () => {
    const { GET } = await import("./route");
    const res = await GET(withNextUrl("http://localhost/api/findings?status=NOT_REAL"));
    expect(res.status).toBe(400);
  });

  it("filters by free-text q against repoFullName", async () => {
    const { GET } = await import("./route");
    const res = await GET(withNextUrl("http://localhost/api/findings?q=other"));
    const body = await res.json();
    expect(body.findings).toHaveLength(1);
    expect(body.findings[0].id).toBe("f3");
  });
});

describe("GET /api/findings — response shape", () => {
  it("never includes redactedSnippet in the list response", async () => {
    const { GET } = await import("./route");
    const res = await GET(withNextUrl("http://localhost/api/findings"));
    const body = await res.json();
    for (const finding of body.findings) {
      expect(finding).not.toHaveProperty("redactedSnippet");
    }
    expect(JSON.stringify(body)).not.toContain(NEVER_INCLUDE);
  });

  it("returns commitSha in short display form", async () => {
    const { GET } = await import("./route");
    const res = await GET(withNextUrl("http://localhost/api/findings"));
    const body = await res.json();
    for (const finding of body.findings) {
      expect(finding.commitSha.length).toBeLessThanOrEqual(7);
    }
  });

  it("returns exactly the documented FindingSummary fields", async () => {
    const { GET } = await import("./route");
    const res = await GET(withNextUrl("http://localhost/api/findings?pageSize=1"));
    const body = await res.json();
    const keys = Object.keys(body.findings[0]).sort();
    expect(keys).toEqual(
      ["id", "repoFullName", "filePath", "matchedRule", "status", "commitSha", "createdAt"].sort()
    );
  });
});

/** Helper: builds a Request with a `.nextUrl` property, matching what Next.js's NextRequest provides. */
function withNextUrl(url: string): any {
  const req = new Request(url);
  return Object.assign(req, { nextUrl: new URL(url) });
}
