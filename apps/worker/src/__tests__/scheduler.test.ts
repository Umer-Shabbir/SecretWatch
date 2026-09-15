import { describe, expect, it, vi, beforeEach } from "vitest";

let scanIntervalMinutes = 15;
let scannerEnabled = true;

vi.mock("../system-settings", () => ({
  getSystemSettings: vi.fn(async () => ({
    scannerEnabled,
    flaggerEnabled: true,
    autoFlagEnabled: true,
    autoApproveEnabled: false,
    scanResultsPerRule: 30,
    flagRateLimitThreshold: 5,
    scanIntervalMinutes,
  })),
}));

let sharedPrisma: any;
vi.mock("../db", () => ({
  get prisma() {
    return sharedPrisma;
  },
}));

vi.mock("@secretwatch/shared", async () => {
  const actual = await vi.importActual<typeof import("@secretwatch/shared")>("@secretwatch/shared");
  return {
    ...actual,
    getRedisConnectionOptions: vi.fn(() => ({ host: "localhost", port: 6379 })),
  };
});

describe("scheduler dynamic scan interval", () => {
  beforeEach(() => {
    scanIntervalMinutes = 15;
    scannerEnabled = true;
    sharedPrisma = {
      scanRule: {
        findMany: vi.fn(async () => [{ id: "rule-1" }, { id: "rule-2" }]),
      },
    };
  });

  it("reads scanIntervalMinutes from getSystemSettings and registers a repeatable job", async () => {
    scanIntervalMinutes = 30;

    const mockQueue = {
      getRepeatableJobs: vi.fn(async () => []),
      add: vi.fn(async () => {}),
      removeRepeatableByKey: vi.fn(async () => {}),
    } as any;

    const { syncSchedulerInterval } = await import("../scheduler");
    const interval = await syncSchedulerInterval(mockQueue);

    expect(interval).toBe(30);
    expect(mockQueue.getRepeatableJobs).toHaveBeenCalled();
    expect(mockQueue.add).toHaveBeenCalledWith(
      "recurring-scan-tick",
      {},
      {
        repeat: { every: 30 * 60_000 },
        removeOnComplete: { count: 50 },
        removeOnFail: { count: 50 },
        jobId: "recurring-scan-tick",
      }
    );
  });

  it("updates repeatable job when scanIntervalMinutes changes", async () => {
    scanIntervalMinutes = 45;

    const mockQueue = {
      getRepeatableJobs: vi.fn(async () => [
        {
          key: "old-key",
          name: "recurring-scan-tick",
          every: String(15 * 60_000),
        },
      ]),
      add: vi.fn(async () => {}),
      removeRepeatableByKey: vi.fn(async () => {}),
    } as any;

    const { syncSchedulerInterval } = await import("../scheduler");
    const interval = await syncSchedulerInterval(mockQueue);

    expect(interval).toBe(45);
    expect(mockQueue.removeRepeatableByKey).toHaveBeenCalledWith("old-key");
    expect(mockQueue.add).toHaveBeenCalledWith(
      "recurring-scan-tick",
      {},
      {
        repeat: { every: 45 * 60_000 },
        removeOnComplete: { count: 50 },
        removeOnFail: { count: 50 },
        jobId: "recurring-scan-tick",
      }
    );
  });

  it("does not re-add or remove job if interval matches current setting", async () => {
    scanIntervalMinutes = 20;

    const mockQueue = {
      getRepeatableJobs: vi.fn(async () => [
        {
          key: "existing-key",
          name: "recurring-scan-tick",
          every: String(20 * 60_000),
        },
      ]),
      add: vi.fn(async () => {}),
      removeRepeatableByKey: vi.fn(async () => {}),
    } as any;

    const { syncSchedulerInterval } = await import("../scheduler");
    const interval = await syncSchedulerInterval(mockQueue);

    expect(interval).toBe(20);
    expect(mockQueue.removeRepeatableByKey).not.toHaveBeenCalled();
    expect(mockQueue.add).not.toHaveBeenCalled();
  });

  it("enqueues scans for enabled rules when scanner is enabled", async () => {
    const mockScanQueue = {
      add: vi.fn(async () => {}),
    } as any;

    const { enqueueScansForEnabledRules } = await import("../scheduler");
    const count = await enqueueScansForEnabledRules(mockScanQueue);

    expect(count).toBe(2);
    expect(mockScanQueue.add).toHaveBeenCalledTimes(2);
    expect(mockScanQueue.add).toHaveBeenCalledWith(
      "scan-rule",
      { ruleId: "rule-1" },
      expect.objectContaining({ attempts: 3 })
    );
    expect(mockScanQueue.add).toHaveBeenCalledWith(
      "scan-rule",
      { ruleId: "rule-2" },
      expect.objectContaining({ attempts: 3 })
    );
  });

  it("enqueues no scans when scanner switch is disabled", async () => {
    scannerEnabled = false;
    const mockScanQueue = {
      add: vi.fn(async () => {}),
    } as any;

    const { enqueueScansForEnabledRules } = await import("../scheduler");
    const count = await enqueueScansForEnabledRules(mockScanQueue);

    expect(count).toBe(0);
    expect(mockScanQueue.add).not.toHaveBeenCalled();
  });
});
