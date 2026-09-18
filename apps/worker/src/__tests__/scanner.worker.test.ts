import { describe, expect, it, vi, beforeEach } from "vitest";
import { clearRepoFiltersCache } from "../repo-filters";

let scannerEnabled = true;
let autoApproveEnabled = false;
let autoFlagEnabled = false;
let scanResultsPerRule = 30;

vi.mock("../system-settings", () => ({
  getSystemSettings: vi.fn(async () => ({
    scannerEnabled,
    flaggerEnabled: true,
    autoFlagEnabled,
    autoApproveEnabled,
    scanResultsPerRule,
    flagRateLimitThreshold: 5,
  })),
}));

let sharedPrisma: any;
vi.mock("../db", () => ({
  get prisma() {
    return sharedPrisma;
  },
}));

const searchCodeMock = vi.fn();
vi.mock("../github-client", async () => {
  const actual = await vi.importActual<typeof import("../github-client")>("../github-client");
  return {
    ...actual,
    searchCode: (...args: unknown[]) => searchCodeMock(...args),
  };
});

const dispatchWebhookEventMock = vi.fn(async () => {});
vi.mock("../webhooks", () => ({
  dispatchWebhookEvent: (...args: unknown[]) => dispatchWebhookEventMock(...args),
}));

describe("apps/worker/scanner.worker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearRepoFiltersCache();
    scannerEnabled = true;
    autoApproveEnabled = false;
    autoFlagEnabled = false;
    scanResultsPerRule = 30;

    // Set dummy REDIS_URL to avoid bullmq failure when Queue is initialized
    process.env.REDIS_URL = "redis://localhost:6379";
  });

  it("returns zeros if scan rule does not exist or is disabled", async () => {
    sharedPrisma = {
      scanRule: {
        findUnique: vi.fn(async () => null),
      },
    };

    const { runScanForRule } = await import("../scanner.worker");
    const result = await runScanForRule("missing-rule");

    expect(result).toEqual({ created: 0, skipped: 0, autoApproved: 0 });
    expect(searchCodeMock).not.toHaveBeenCalled();
  });

  it("returns zeros if no active token is available", async () => {
    sharedPrisma = {
      scanRule: {
        findUnique: vi.fn(async () => ({
          id: "r1",
          name: "AWS Access Key",
          pattern: "AKIA[0-9A-Z]{16}",
          enabled: true,
        })),
      },
      githubToken: {
        findMany: vi.fn(async () => []),
      },
    };

    const { runScanForRule } = await import("../scanner.worker");
    const result = await runScanForRule("r1");

    expect(result).toEqual({ created: 0, skipped: 0, autoApproved: 0 });
    expect(searchCodeMock).not.toHaveBeenCalled();
  });

  it("performs full scan flow: executes search, evaluates rules, creates finding in PENDING state and dispatches webhook", async () => {
    sharedPrisma = {
      scanRule: {
        findUnique: vi.fn(async () => ({
          id: "r1",
          name: "AWS Access Key",
          pattern: "AKIA[0-9A-Z]{16}",
          enabled: true,
        })),
      },
      githubToken: {
        findMany: vi.fn(async () => [{ id: "t1", encrypted: "enc-token", lastUsedAt: new Date(0) }]),
        updateMany: vi.fn(async () => ({ count: 1 })),
        update: vi.fn(async () => ({})),
      },
      repositoryFilter: {
        findMany: vi.fn(async () => []),
      },
      finding: {
        findUnique: vi.fn(async () => null),
        create: vi.fn(async ({ data }) => ({ id: "finding-1", ...data })),
      },
    };

    searchCodeMock.mockResolvedValueOnce([
      {
        repoFullName: "org/repo",
        filePath: "src/config.ts",
        sha: "commit-sha-1",
        fragments: ["const key = 'AKIA1234567890ABCDEF';"],
      },
    ]);

    const { runScanForRule } = await import("../scanner.worker");
    const result = await runScanForRule("r1");

    expect(result).toEqual({ created: 1, skipped: 0, autoApproved: 0 });
    expect(sharedPrisma.finding.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          repoFullName: "org/repo",
          filePath: "src/config.ts",
          commitSha: "commit-sha-1",
          matchedRule: "AWS Access Key",
          status: "PENDING",
          severity: "CRITICAL",
        }),
      })
    );

    expect(dispatchWebhookEventMock).toHaveBeenCalledWith(
      "finding.created",
      expect.objectContaining({
        id: "finding-1",
        repoFullName: "org/repo",
        status: "PENDING",
      })
    );
  });

  it("skips repositories blocked by active repository filters", async () => {
    sharedPrisma = {
      scanRule: {
        findUnique: vi.fn(async () => ({
          id: "r1",
          name: "AWS Access Key",
          pattern: "AKIA[0-9A-Z]{16}",
          enabled: true,
        })),
      },
      githubToken: {
        findMany: vi.fn(async () => [{ id: "t1", encrypted: "enc-token", lastUsedAt: new Date(0) }]),
        updateMany: vi.fn(async () => ({ count: 1 })),
        update: vi.fn(async () => ({})),
      },
      repositoryFilter: {
        findMany: vi.fn(async () => [
          {
            id: "f1",
            type: "BLOCK",
            pattern: "org/blocked-*",
            enabled: true,
          },
        ]),
      },
      finding: {
        findUnique: vi.fn(async () => null),
        create: vi.fn(async ({ data }) => ({ id: "finding-1", ...data })),
      },
    };

    searchCodeMock.mockResolvedValueOnce([
      {
        repoFullName: "org/blocked-repo",
        filePath: "src/config.ts",
        sha: "commit-sha-1",
        fragments: ["const key = 'AKIA1234567890ABCDEF';"],
      },
    ]);

    const { runScanForRule } = await import("../scanner.worker");
    const result = await runScanForRule("r1");

    expect(result).toEqual({ created: 0, skipped: 1, autoApproved: 0 });
    expect(sharedPrisma.finding.create).not.toHaveBeenCalled();
  });

  it("auto-approves correctly when auto-approve is enabled", async () => {
    autoApproveEnabled = true;
    autoFlagEnabled = false;

    sharedPrisma = {
      scanRule: {
        findUnique: vi.fn(async () => ({
          id: "r1",
          name: "AWS Access Key",
          pattern: "AKIA[0-9A-Z]{16}",
          enabled: true,
        })),
      },
      githubToken: {
        findMany: vi.fn(async () => [{ id: "t1", encrypted: "enc-token", lastUsedAt: new Date(0) }]),
        updateMany: vi.fn(async () => ({ count: 1 })),
        update: vi.fn(async () => ({})),
      },
      repositoryFilter: {
        findMany: vi.fn(async () => []),
      },
      finding: {
        findUnique: vi.fn(async () => null),
        create: vi.fn(async ({ data }) => ({ id: "finding-auto", ...data })),
      },
    };

    searchCodeMock.mockResolvedValueOnce([
      {
        repoFullName: "org/repo",
        filePath: "src/config.ts",
        sha: "commit-sha-1",
        fragments: ["const key = 'AKIA1234567890ABCDEF';"],
      },
    ]);

    const { runScanForRule } = await import("../scanner.worker");
    const result = await runScanForRule("r1");

    expect(result).toEqual({ created: 1, skipped: 0, autoApproved: 1 });
    expect(sharedPrisma.finding.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "APPROVED",
        }),
      })
    );

    expect(dispatchWebhookEventMock).toHaveBeenCalledWith(
      "finding.approved",
      expect.objectContaining({
        id: "finding-auto",
        status: "APPROVED",
        autoApproved: true,
      })
    );
  });
});
