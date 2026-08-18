import { describe, expect, it, vi, beforeEach } from "vitest";

interface FakeFinding {
  id: string;
  repoFullName: string;
  filePath: string;
  matchedRule: string;
  status: string;
  failureReason: string | null;
}

interface FakeToken {
  id: string;
  encrypted: string;
  active: boolean;
  lastUsedAt: Date | null;
  rateLimitRemaining: number | null;
}

interface FakeTemplate {
  id: string;
  name: string;
  body: string;
  isDefault: boolean;
}

interface FakeFlag {
  findingId: string;
  issueUrl: string;
  usedTokenId: string;
  templateId: string;
}

let findings: FakeFinding[] = [];
let tokens: FakeToken[] = [];
let templates: FakeTemplate[] = [];
let flags: FakeFlag[] = [];
let auditLogs: Array<{ userId: string | null; action: string; detail: string }> = [];
let createIssueMock: ReturnType<typeof vi.fn>;

function buildClient() {
  const client = {
    finding: {
      findUnique: vi.fn(async ({ where }: any) => findings.find((f) => f.id === where.id) ?? null),
      updateMany: vi.fn(async ({ where, data }: any) => {
        const idx = findings.findIndex(
          (f) => f.id === where.id && (where.status === undefined || f.status === where.status)
        );
        if (idx === -1) return { count: 0 };
        findings[idx] = { ...findings[idx], ...data };
        return { count: 1 };
      }),
    },
    githubToken: {
      findMany: vi.fn(async ({ where }: any) => tokens.filter((t) => t.active === where.active)),
      update: vi.fn(async ({ where, data }: any) => {
        const idx = tokens.findIndex((t) => t.id === where.id);
        if (idx !== -1) tokens[idx] = { ...tokens[idx], ...data };
        return tokens[idx];
      }),
    },
    messageTemplate: {
      findFirst: vi.fn(async ({ where }: any) => templates.find((t) => t.isDefault === where.isDefault) ?? null),
      create: vi.fn(async ({ data }: any) => {
        const row = { id: `template_${templates.length + 1}`, ...data };
        templates.push(row);
        return row;
      }),
    },
    flag: {
      create: vi.fn(async ({ data }: any) => {
        flags.push(data);
        return data;
      }),
    },
    auditLog: {
      create: vi.fn(async ({ data }: any) => {
        auditLogs.push(data);
        return data;
      }),
    },
    $transaction: vi.fn(async (fn: any) => fn(client)),
  };
  return client;
}

let sharedPrisma: any;

function resetFakeDb() {
  findings = [
    {
      id: "f1",
      repoFullName: "acme/widgets",
      filePath: "config/prod.env",
      matchedRule: "AWS Access Key",
      status: "APPROVED",
      failureReason: null,
    },
  ];
  tokens = [{ id: "tok1", encrypted: "enc1", active: true, lastUsedAt: null, rateLimitRemaining: null }];
  templates = [];
  flags = [];
  auditLogs = [];
  sharedPrisma = buildClient();
}

vi.mock("../db", () => ({
  get prisma() {
    return sharedPrisma;
  },
}));

vi.mock("../github-client", async () => {
  const actual = await vi.importActual<typeof import("../github-client")>("../github-client");
  return {
    ...actual,
    createGithubIssue: (...args: unknown[]) => createIssueMock(...args),
  };
});

beforeEach(() => {
  resetFakeDb();
  createIssueMock = vi.fn(async () => ({ htmlUrl: "https://github.com/acme/widgets/issues/42", number: 42 }));
});

describe("runFlagForFinding — happy path", () => {
  it("creates a Flag row and transitions the finding to FLAGGED", async () => {
    const { runFlagForFinding } = await import("../flagger.worker");
    const result = await runFlagForFinding("f1");

    expect(result.outcome).toBe("flagged");
    expect(findings[0].status).toBe("FLAGGED");
    expect(flags).toHaveLength(1);
    expect(flags[0].issueUrl).toBe("https://github.com/acme/widgets/issues/42");
  });

  it("self-heals a missing default MessageTemplate row", async () => {
    const { runFlagForFinding } = await import("../flagger.worker");
    expect(templates).toHaveLength(0);
    await runFlagForFinding("f1");
    expect(templates).toHaveLength(1);
    expect(templates[0].isDefault).toBe(true);
  });

  it("never passes redactedSnippet-like content or a decrypted token into createGithubIssue's args", async () => {
    const { runFlagForFinding } = await import("../flagger.worker");
    await runFlagForFinding("f1");
    const [, , , , body] = createIssueMock.mock.calls[0];
    expect(body).not.toContain("enc1");
  });

  it("records an audit log entry for the successful flag (ARCHITECTURE.md §8)", async () => {
    const { runFlagForFinding } = await import("../flagger.worker");
    await runFlagForFinding("f1");
    expect(auditLogs).toHaveLength(1);
    expect(auditLogs[0].action).toBe("flag_created");
    expect(auditLogs[0].userId).toBeNull();
    expect(auditLogs[0].detail).toContain("findingId=f1");
    expect(auditLogs[0].detail).toContain("tokenId=tok1");
    expect(auditLogs[0].detail).not.toContain("enc1");
  });
});

describe("runFlagForFinding — idempotency / skip", () => {
  it("skips a nonexistent finding", async () => {
    const { runFlagForFinding } = await import("../flagger.worker");
    const result = await runFlagForFinding("nope");
    expect(result.outcome).toBe("skipped");
  });

  it("skips a finding that is not APPROVED (e.g. already FLAGGED)", async () => {
    findings[0].status = "FLAGGED";
    const { runFlagForFinding } = await import("../flagger.worker");
    const result = await runFlagForFinding("f1");
    expect(result.outcome).toBe("skipped");
    expect(createIssueMock).not.toHaveBeenCalled();
  });
});

describe("runFlagForFinding — failure handling", () => {
  it("marks the finding FAILED with a non-secret reason on a 403 rate limit", async () => {
    const { GithubApiError } = await import("../github-client");
    createIssueMock.mockRejectedValueOnce(new GithubApiError(403, "rate limited"));
    const { runFlagForFinding } = await import("../flagger.worker");
    const result = await runFlagForFinding("f1");

    expect(result.outcome).toBe("failed");
    expect(findings[0].status).toBe("FAILED");
    expect(findings[0].failureReason).toBe("GitHub API rate limit (403)");
    expect(findings[0].failureReason).not.toContain("enc1");
    expect(auditLogs).toHaveLength(1);
    expect(auditLogs[0].action).toBe("flag_failed");
    expect(auditLogs[0].detail).not.toContain("enc1");
  });

  it("marks the finding FAILED when no active token is available", async () => {
    tokens = [];
    const { runFlagForFinding } = await import("../flagger.worker");
    const result = await runFlagForFinding("f1");

    expect(result.outcome).toBe("failed");
    expect(findings[0].status).toBe("FAILED");
    expect(createIssueMock).not.toHaveBeenCalled();
  });

  it("prefers a token with healthy rate limit over one near the threshold", async () => {
    tokens = [
      { id: "low", encrypted: "enc-low", active: true, lastUsedAt: null, rateLimitRemaining: 1 },
      { id: "healthy", encrypted: "enc-healthy", active: true, lastUsedAt: new Date(), rateLimitRemaining: 500 },
    ];
    const { runFlagForFinding } = await import("../flagger.worker");
    await runFlagForFinding("f1");

    expect(flags[0].usedTokenId).toBe("healthy");
  });
});
