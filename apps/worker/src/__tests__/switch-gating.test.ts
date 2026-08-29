import { describe, expect, it, vi, beforeEach } from "vitest";

/**
 * Switch-gating tests (2026-08-24 admin-control addition). Verify the master
 * ON/OFF switches stop the background subsystems per-job:
 *   - scanner: runScanForRule no-ops (created:0, skipped:0) when scannerEnabled
 *     is off, without touching GitHub or the DB.
 *   - flagger: runFlagForFinding returns {skipped, "flagger disabled"} when
 *     flaggerEnabled is off, WITHOUT marking the finding FAILED (it stays
 *     APPROVED so it flags once re-enabled).
 */

let scannerEnabled = true;
let flaggerEnabled = true;
let autoApproveEnabled = false;
let scanResultsPerRule = 30;
let flagRateLimitThreshold = 5;

vi.mock("../system-settings", () => ({
  getSystemSettings: vi.fn(async () => ({
    scannerEnabled,
    flaggerEnabled,
    autoFlagEnabled: true,
    autoApproveEnabled,
    scanResultsPerRule,
    flagRateLimitThreshold,
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
    createGithubIssue: vi.fn(async () => ({ htmlUrl: "https://example.test/issues/1", number: 1 })),
  };
});

beforeEach(() => {
  scannerEnabled = true;
  flaggerEnabled = true;
  autoApproveEnabled = false;
  scanResultsPerRule = 30;
  flagRateLimitThreshold = 5;
  searchCodeMock.mockReset();
});

describe("scanner switch gating", () => {
  it("no-ops without hitting GitHub or the DB when the scanner switch is off", async () => {
    scannerEnabled = false;
    sharedPrisma = {
      scanRule: { findUnique: vi.fn() },
      githubToken: { findFirst: vi.fn(), update: vi.fn() },
      finding: { create: vi.fn(), findUnique: vi.fn() },
      repositoryFilter: { findMany: vi.fn(async () => []) },
    };

    const { runScanForRule } = await import("../scanner.worker");
    const result = await runScanForRule("rule-1");

    expect(result).toEqual({ created: 0, skipped: 0, autoApproved: 0 });
    expect(searchCodeMock).not.toHaveBeenCalled();
    expect(sharedPrisma.scanRule.findUnique).not.toHaveBeenCalled();
  });

  it("passes the admin-configured scanResultsPerRule to the GitHub search", async () => {
    scanResultsPerRule = 75;
    searchCodeMock.mockResolvedValue([]);
    sharedPrisma = {
      scanRule: {
        findUnique: vi.fn(async () => ({
          id: "rule-1",
          name: "AWS Access Key",
          pattern: "AKIA",
          enabled: true,
        })),
      },
      githubToken: {
        findFirst: vi.fn(async () => ({ id: "t1", encrypted: "enc" })),
        update: vi.fn(async () => ({})),
      },
      finding: { create: vi.fn() },
      repositoryFilter: { findMany: vi.fn(async () => []) },
    };

    const { runScanForRule } = await import("../scanner.worker");
    await runScanForRule("rule-1");

    // searchCode(encrypted, query, page, pageSize) — 4th arg is the page size.
    expect(searchCodeMock).toHaveBeenCalledWith("enc", expect.any(String), 1, 75);
  });
});

describe("flagger switch gating", () => {
  it("skips without marking the finding FAILED when the flagger switch is off", async () => {
    flaggerEnabled = false;
    const finding = { id: "f1", status: "APPROVED", failureReason: null };
    sharedPrisma = {
      finding: {
        findUnique: vi.fn(async () => finding),
        updateMany: vi.fn(async () => ({ count: 1 })),
      },
      githubToken: { findMany: vi.fn() },
      auditLog: { create: vi.fn() },
    };

    const { runFlagForFinding } = await import("../flagger.worker");
    const result = await runFlagForFinding("f1");

    expect(result.outcome).toBe("skipped");
    expect(result.reason).toBe("flagger disabled");
    expect(finding.status).toBe("APPROVED");
    // Never touched the finding row, never picked a token.
    expect(sharedPrisma.finding.updateMany).not.toHaveBeenCalled();
    expect(sharedPrisma.githubToken.findMany).not.toHaveBeenCalled();
  });
});
