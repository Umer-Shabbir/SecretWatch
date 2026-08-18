import { Queue, Worker } from "bullmq";
import {
  QUEUE_NAMES,
  SCHEDULER_JOB_NAME,
  DEFAULT_SCAN_INTERVAL_MINUTES,
  getRedisConnectionOptions,
} from "@secretwatch/shared";
import { prisma } from "./db";
import type { ScanJobData } from "./scanner.worker";

/**
 * Scheduler (ARCHITECTURE.md §5/§6): a BullMQ repeatable job that, on each
 * tick, enqueues one scan-queue job per enabled ScanRule row (sharded scan,
 * spreading GitHub Search API rate-limit usage across jobs/time rather than
 * one giant query).
 *
 * Interval is configurable via SCAN_INTERVAL_MINUTES env var (falls back to
 * DEFAULT_SCAN_INTERVAL_MINUTES). Rule enable/disable toggling is read fresh
 * from the DB on every tick (no caching), so admin changes to ScanRule rows
 * (M08, out of scope here) take effect on the next tick without a restart.
 */

function getIntervalMinutes(): number {
  const raw = process.env.SCAN_INTERVAL_MINUTES;
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_SCAN_INTERVAL_MINUTES;
}

export async function enqueueScansForEnabledRules(scanQueue: Queue<ScanJobData>): Promise<number> {
  const enabledRules = await prisma.scanRule.findMany({
    where: { enabled: true },
    select: { id: true },
  });

  for (const rule of enabledRules) {
    await scanQueue.add(
      "scan-rule",
      { ruleId: rule.id },
      {
        attempts: 3,
        backoff: { type: "exponential", delay: 5_000 }, // GitHub 403/429 backoff, ARCHITECTURE.md §5
        removeOnComplete: { count: 500 },
        removeOnFail: { count: 500 },
      }
    );
  }

  return enabledRules.length;
}

export async function startScheduler(): Promise<{
  schedulerQueue: Queue;
  scanQueue: Queue<ScanJobData>;
  schedulerWorker: Worker;
}> {
  const connection = getRedisConnectionOptions();
  const schedulerQueue = new Queue(QUEUE_NAMES.SCHEDULER, { connection });
  const scanQueue = new Queue<ScanJobData>(QUEUE_NAMES.SCAN, { connection });

  const intervalMinutes = getIntervalMinutes();

  await schedulerQueue.add(
    SCHEDULER_JOB_NAME,
    {},
    {
      repeat: { every: intervalMinutes * 60_000 },
      removeOnComplete: { count: 50 },
      removeOnFail: { count: 50 },
      jobId: SCHEDULER_JOB_NAME, // stable id so re-deploys don't stack duplicate repeatables
    }
  );

  // Processes each scheduler tick by fanning out scan-queue jobs.
  const schedulerWorker = new Worker(
    QUEUE_NAMES.SCHEDULER,
    async () => {
      const count = await enqueueScansForEnabledRules(scanQueue);
      return { enqueuedRuleScans: count };
    },
    { connection, concurrency: 1 }
  );

  return { schedulerQueue, scanQueue, schedulerWorker };
}
