import { describe, expect, it, vi, beforeEach } from "vitest";

/**
 * lib/workers.ts reads BullMQ queue state directly (no Prisma table — see
 * that file's doc comment). Mock the `bullmq` Queue class so tests never
 * touch a real Redis connection, mirroring the existing
 * vi.mock("@secretwatch/shared", ...) pattern used across this codebase's
 * other lib/*.test.ts files.
 */

interface FakeJob {
  id: string;
  processedOn?: number;
  finishedOn?: number;
}

let jobsByQueueAndStatus: Record<string, Record<string, FakeJob[]>> = {};
let countsByQueue: Record<string, Record<string, number>> = {};

vi.mock("bullmq", () => {
  class FakeQueue {
    name: string;
    constructor(name: string) {
      this.name = name;
    }
    async getJobCounts(...statuses: string[]) {
      const counts = countsByQueue[this.name] ?? {};
      const result: Record<string, number> = {};
      for (const s of statuses) result[s] = counts[s] ?? 0;
      return result;
    }
    async getJobs(statuses: string[]) {
      const byStatus = jobsByQueueAndStatus[this.name] ?? {};
      return statuses.flatMap((s) => byStatus[s] ?? []);
    }
  }
  return { Queue: FakeQueue };
});

vi.mock("@secretwatch/shared", () => ({
  QUEUE_NAMES: { SCAN: "scan-queue", FLAG: "flag-queue", SCHEDULER: "scheduler-queue" },
  getRedisConnectionOptions: () => ({}),
}));

beforeEach(() => {
  jobsByQueueAndStatus = {};
  countsByQueue = {};
  delete (globalThis as any).workerMonitoringQueues;
  vi.resetModules();
});

async function importWorkers() {
  return import("./workers");
}

describe("getWorkerMonitoringSnapshot", () => {
  it("returns healthy status with null success rate when a queue has no job history", async () => {
    const { getWorkerMonitoringSnapshot } = await importWorkers();
    const snapshot = await getWorkerMonitoringSnapshot();

    expect(snapshot.workers).toHaveLength(3);
    expect(snapshot.degraded).toBe(false);
    for (const worker of snapshot.workers) {
      expect(worker.status).toBe("healthy");
      expect(worker.successRate).toBeNull();
      expect(worker.lastJobAt).toBeNull();
    }
  });

  it("reports queue depth from waiting+active+delayed counts", async () => {
    countsByQueue["scan-queue"] = { waiting: 2, active: 1, delayed: 0 };
    const { getWorkerMonitoringSnapshot } = await importWorkers();
    const snapshot = await getWorkerMonitoringSnapshot();

    const scanner = snapshot.workers.find((w) => w.key === "scanner")!;
    expect(scanner.queueCount).toBe(3);
    expect(scanner.concurrency).toBe(2);
  });

  it("marks a worker degraded when recent success rate drops below threshold with enough samples", async () => {
    jobsByQueueAndStatus["flag-queue"] = {
      completed: [{ id: "1", processedOn: 1000, finishedOn: 1500 }],
      failed: [
        { id: "2", processedOn: 2000, finishedOn: 2500 },
        { id: "3", processedOn: 3000, finishedOn: 3500 },
        { id: "4", processedOn: 4000, finishedOn: 4500 },
      ],
    };
    const { getWorkerMonitoringSnapshot } = await importWorkers();
    const snapshot = await getWorkerMonitoringSnapshot();

    const flagger = snapshot.workers.find((w) => w.key === "flagger")!;
    expect(flagger.successRate).toBe(25);
    expect(flagger.status).toBe("degraded");
    expect(snapshot.degraded).toBe(true);
  });

  it("does not mark degraded when sample size is below the minimum-to-judge threshold", async () => {
    jobsByQueueAndStatus["scheduler-queue"] = {
      completed: [],
      failed: [{ id: "1", processedOn: 1000, finishedOn: 1500 }],
    };
    const { getWorkerMonitoringSnapshot } = await importWorkers();
    const snapshot = await getWorkerMonitoringSnapshot();

    const scheduler = snapshot.workers.find((w) => w.key === "scheduler")!;
    expect(scheduler.status).toBe("healthy");
  });

  it("builds recentJobs sorted newest-first across all queues, capped at the sample size", async () => {
    jobsByQueueAndStatus["scan-queue"] = {
      completed: [{ id: "old", processedOn: 1000, finishedOn: 2000 }],
      failed: [],
    };
    jobsByQueueAndStatus["flag-queue"] = {
      completed: [{ id: "new", processedOn: 5000, finishedOn: 6000 }],
      failed: [],
    };
    const { getWorkerMonitoringSnapshot } = await importWorkers();
    const snapshot = await getWorkerMonitoringSnapshot();

    expect(snapshot.recentJobs[0].id).toBe("new");
    expect(snapshot.recentJobs.find((j) => j.id === "old")).toBeDefined();
    expect(snapshot.recentJobs[0].durationMs).toBe(1000);
  });

  it("never includes token or secret fields in the snapshot shape", async () => {
    const { getWorkerMonitoringSnapshot } = await importWorkers();
    const snapshot = await getWorkerMonitoringSnapshot();
    const serialized = JSON.stringify(snapshot);
    expect(serialized).not.toMatch(/token/i);
    expect(serialized).not.toMatch(/secret/i);
  });
});
