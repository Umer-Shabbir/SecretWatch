import { describe, expect, it, vi, beforeEach } from "vitest";

let mockTokens: any[] = [];

vi.mock("../db", () => ({
  prisma: {
    githubToken: {
      findMany: vi.fn(async (args: any) => {
        return mockTokens.filter((t) => t.active);
      }),
      update: vi.fn(async (args: any) => {
        const { where, data } = args;
        const token = mockTokens.find((t) => t.id === where.id);
        if (token) {
          Object.assign(token, data);
        }
        return token;
      }),
    },
    finding: {
      findUnique: vi.fn(),
      updateMany: vi.fn(),
    },
    messageTemplate: {
      findFirst: vi.fn(async () => ({ id: "tmpl-1", body: "Hello", isDefault: true })),
    },
    auditLog: {
      create: vi.fn(),
    },
    $transaction: vi.fn(async (cb: any) => {
      return cb({
        flag: { create: vi.fn() },
        finding: { updateMany: vi.fn(async () => ({ count: 1 })) },
      });
    }),
  },
}));

vi.mock("../system-settings", () => ({
  getSystemSettings: vi.fn(async () => ({
    flaggerEnabled: true,
    flagRateLimitThreshold: 5,
    scannerEnabled: true,
    autoApproveEnabled: false,
    autoFlagEnabled: false,
    scanResultsPerRule: 10,
    updatedAt: new Date().toISOString(),
  })),
}));

vi.mock("../github-client", async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    createGithubIssue: vi.fn(async () => ({ htmlUrl: "https://github.com/org/repo/issues/1", number: 1 })),
  };
});

import { runFlagForFinding } from "../flagger.worker";
import { prisma } from "../db";

describe("rate-limit handling in flagger", () => {
  beforeEach(() => {
    mockTokens = [];
    vi.clearAllMocks();
  });

  it("skips an exhausted token whose rateLimitResetAt is in the future", async () => {
    const futureReset = new Date(Date.now() + 60 * 60 * 1000); // 1 hour in future

    mockTokens = [
      {
        id: "exhausted-token",
        encrypted: "enc1",
        active: true,
        rateLimitRemaining: 0,
        rateLimitResetAt: futureReset,
        lastUsedAt: new Date(Date.now() - 10000),
      },
      {
        id: "healthy-token",
        encrypted: "enc2",
        active: true,
        rateLimitRemaining: 100,
        rateLimitResetAt: futureReset,
        lastUsedAt: new Date(),
      },
    ];

    (prisma.finding.findUnique as any).mockResolvedValue({
      id: "f1",
      repoFullName: "org/repo",
      filePath: "src/secret.ts",
      matchedRule: "AWS Access Key",
      status: "APPROVED",
    });

    (prisma.finding.updateMany as any).mockResolvedValue({ count: 1 });

    const result = await runFlagForFinding("f1");

    expect(result.outcome).toBe("flagged");
    const healthyToken = mockTokens.find((t) => t.id === "healthy-token");
    expect(healthyToken.lastUsedAt).toBeDefined();
  });

  it("fails if all active tokens are exhausted and their reset time is in the future", async () => {
    const futureReset = new Date(Date.now() + 60 * 60 * 1000);

    mockTokens = [
      {
        id: "exhausted-token",
        encrypted: "enc1",
        active: true,
        rateLimitRemaining: 2, // below threshold 5
        rateLimitResetAt: futureReset,
        lastUsedAt: new Date(),
      },
    ];

    (prisma.finding.findUnique as any).mockResolvedValue({
      id: "f1",
      repoFullName: "org/repo",
      filePath: "src/secret.ts",
      matchedRule: "AWS Access Key",
      status: "APPROVED",
    });

    const result = await runFlagForFinding("f1");
    expect(result.outcome).toBe("failed");
    expect(result.reason).toContain("no active token");
  });

  it("re-uses a formerly exhausted token if its reset time has passed", async () => {
    const pastReset = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago

    mockTokens = [
      {
        id: "exhausted-token-now-ready",
        encrypted: "enc1",
        active: true,
        rateLimitRemaining: 0,
        rateLimitResetAt: pastReset, // Reset already happened
        lastUsedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      },
    ];

    (prisma.finding.findUnique as any).mockResolvedValue({
      id: "f1",
      repoFullName: "org/repo",
      filePath: "src/secret.ts",
      matchedRule: "AWS Access Key",
      status: "APPROVED",
    });

    (prisma.finding.updateMany as any).mockResolvedValue({ count: 1 });

    const result = await runFlagForFinding("f1");
    expect(result.outcome).toBe("flagged");
  });
});
