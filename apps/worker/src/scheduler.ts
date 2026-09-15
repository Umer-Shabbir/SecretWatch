import { Queue, Worker } from "bullmq";
import {
  QUEUE_NAMES,
  SCHEDULER_JOB_NAME,
  DEFAULT_SCAN_INTERVAL_MINUTES,
  getRedisConnectionOptions,
} from "@secretwatch/shared";
import { prisma } from "./db";
import { getSystemSettings } from "./system-settings";
import type { ScanJobData } from "./scanner.worker";

/**
 * Scheduler (ARCHITECTURE.md §5/§6): a BullMQ repeatable job that, on each
 * tick, enqueues one scan-queue job per enabled ScanRule row (sharded scan,
 * spreading GitHub Search API rate-limit usage across jobs/time rather than
 * one giant query).
 *
 * Rule enable/disable toggling and interval settings (scanIntervalMinutes)
 * are read fresh from the DB on every tick (no caching), so admin changes
 * take effect dynamically. We sync the repeatable job interval with BullMQ
 * to adapt to setting changes.
 */

export async function syncSchedulerInterval(schedulerQueue: Queue): Promise<number> {
  const settings = await getSystemSettings();
  let intervalMinutes = settings.scanIntervalMinutes;
  
  if (!intervalMinutes || intervalMinutes <= 0) {
    const raw = process.env.SCAN_INTERVAL_MINUTES;
    const parsed = raw ? Number(raw) : NaN;
    intervalMinutes = Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_SCAN_INTERVAL_MINUTES;
  }

  const targetEveryMs = intervalMinutes * 60_000;
  
  const repeatableJobs = await schedulerQueue.getRepeatableJobs();
  const existingJob = repeatableJobs.find(
    (job) => job.name === SCHEDULER_JOB_NAME || job.id === SCHEDULER_JOB_NAME
  );

  if (existingJob) {
    const currentEvery = Number(existingJob.every);
    if (currentEvery === targetEveryMs) {
      return intervalMinutes;
    }
    // Remove outdated repeatable job before adding updated one
    await schedulerQueue.removeRepeatableByKey(existingJob.key);
  }

  await schedulerQueue.add(
    SCHEDULER_JOB_NAME,
    {},
    {
      repeat: { every: targetEveryMs },
      removeOnComplete: { count: 50 },
      removeOnFail: { count: 50 },
      jobId: SCHEDULER_JOB_NAME, // stable id so re-deploys don't stack duplicate repeatables
    }
  );

  return intervalMinutes;
}

export async function enqueueScansForEnabledRules(scanQueue: Queue<ScanJobData>): Promise<number> {
  // Master scanner switch (admin dashboard). When off, enqueue nothing — the
  // scheduler tick becomes a no-op until an admin re-enables scanning. Read
  // fresh each tick so a toggle takes effect on the next tick with no restart.
  const { scannerEnabled } = await getSystemSettings();
  if (!scannerEnabled) {
    return 0;
  }

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

  // Sync the interval initially on startup
  await syncSchedulerInterval(schedulerQueue);

  // Processes each scheduler tick by fanning out scan-queue jobs.
  const schedulerWorker = new Worker(
    QUEUE_NAMES.SCHEDULER,
    async () => {
      // Re-sync the interval in case it was changed in Admin settings
      await syncSchedulerInterval(schedulerQueue);
      
      const count = await enqueueScansForEnabledRules(scanQueue);
      return { enqueuedRuleScans: count };
    },
    { connection, concurrency: 1 }
  );

  return { schedulerQueue, scanQueue, schedulerWorker };
}
