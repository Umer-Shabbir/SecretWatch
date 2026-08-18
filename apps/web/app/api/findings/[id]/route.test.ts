import { describe, expect, it, vi, beforeEach } from "vitest";

// Obviously-fake fixture only — asserts the raw pattern never appears
// anywhere in a detail response, even though redactedSnippet IS expected
// to be present (already-redacted at write time).
const RAW_SECRET_PATTERNS = [
  /AKIA[0-9A-Z]{16}(?!.*•)/, // unredacted-looking AWS key (no redaction dots)
  /ghp_[A-Za-z0-9]{36}/, // unredacted-looking GitHub PAT
  /sk_live_[A-Za-z0-9]{20,}(?!.*•)/, // unredacted-looking Stripe secret key
];

interface FakeFindingRow {
  id: string;
  repoFullName: string;
  filePath: string;
  commitSha: string;
  matchedRule: string;
  redactedSnippet: string;
  status: string;
  createdAt: Date;
}

let rows: FakeFindingRow[] = [];
let currentSessionUserId: string | null = "user-a";

function makeRow(overrides: Partial<FakeFindingRow>): FakeFindingRow {
  return {
    id: overrides.id ?? `finding_${Math.random()}`,
    repoFullName: overrides.repoFullName ?? "acme/widgets",
    filePath: overrides.filePath ?? "config/prod.env",
    commitSha: overrides.commitSha ?? "abcdef1234567890abcdef1234567890abcdef12",
    matchedRule: overrides.matchedRule ?? "AWS Access Key",
    redactedSnippet: overrides.redactedSnippet ?? 'const key = "AKIA••••••••••7XQ";',
    status: overrides.status ?? "PENDING",
    createdAt: overrides.createdAt ?? new Date("2026-01-03"),
  };
}

let sharedPrisma: any;

function resetFakeDb(seed: FakeFindingRow[]) {
  rows = seed;
  const client = {
    finding: {
      findUnique: vi.fn(async ({ where }: any) => rows.find((r) => r.id === where.id) ?? null),
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
  resetFakeDb([makeRow({ id: "f1" })]);
});

describe("GET /api/findings/:id — authorization", () => {
  it("returns 401 when there is no session", async () => {
    currentSessionUserId = null;
    const { GET } = await import("./route");
    const res = await GET(new Request("http://localhost/api/findings/f1"), {
      params: { id: "f1" },
    });
    expect(res.status).toBe(401);
  });

  it("returns 403 for a non-admin (USER role) session", async () => {
    currentSessionUserId = "user-a";
    currentSessionRole = "USER";
    const { GET } = await import("./route");
    const res = await GET(new Request("http://localhost/api/findings/f1"), {
      params: { id: "f1" },
    });
    expect(res.status).toBe(403);
  });

  it("allows an ADMIN session to read detail", async () => {
    currentSessionUserId = "user-a";
    currentSessionRole = "ADMIN";
    const { GET } = await import("./route");
    const res = await GET(new Request("http://localhost/api/findings/f1"), {
      params: { id: "f1" },
    });
    expect(res.status).toBe(200);
  });
});

describe("GET /api/findings/:id — not found", () => {
  it("returns 404 for a nonexistent id", async () => {
    const { GET } = await import("./route");
    const res = await GET(new Request("http://localhost/api/findings/does-not-exist"), {
      params: { id: "does-not-exist" },
    });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("not_found");
  });
});

describe("GET /api/findings/:id — response shape", () => {
  it("includes redactedSnippet, full (untruncated) commitSha, and all documented fields", async () => {
    const { GET } = await import("./route");
    const res = await GET(new Request("http://localhost/api/findings/f1"), {
      params: { id: "f1" },
    });
    const body = await res.json();

    expect(body.finding).toBeDefined();
    expect(body.finding.redactedSnippet).toBe('const key = "AKIA••••••••••7XQ";');
    expect(body.finding.commitSha).toBe("abcdef1234567890abcdef1234567890abcdef12");
    expect(body.finding.commitSha.length).toBeGreaterThan(7);

    const keys = Object.keys(body.finding).sort();
    expect(keys).toEqual(
      [
        "id",
        "repoFullName",
        "filePath",
        "commitSha",
        "matchedRule",
        "redactedSnippet",
        "status",
        "createdAt",
      ].sort()
    );
  });

  it("never exposes a raw (unredacted-looking) secret pattern anywhere in the response", async () => {
    resetFakeDb([
      makeRow({
        id: "f2",
        redactedSnippet: 'const key = "AKIA••••••••••7XQ"; // still redacted',
      }),
    ]);
    const { GET } = await import("./route");
    const res = await GET(new Request("http://localhost/api/findings/f2"), {
      params: { id: "f2" },
    });
    const text = JSON.stringify(await res.json());
    for (const pattern of RAW_SECRET_PATTERNS) {
      expect(pattern.test(text)).toBe(false);
    }
  });
});
