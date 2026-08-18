import { Queue } from "bullmq";
import { QUEUE_NAMES, getRedisConnectionOptions } from "@secretwatch/shared";

/**
 * Worker Monitoring business logic (M10).
 *
 * Per ARCHITECTURE.md §5/§6 the product runs exactly 3 fixed background
 * processes — Scanner (scan-queue), Flagger (flag-queue), Scheduler
 * (scheduler-queue) — all hosted in the single `apps/worker` process. There
 * is no WorkerJob/heartbeat table in the Prisma schema (see
 * state/modules/M10.json knownIssues): this module reads worker health
 * directly from BullMQ's own job-count/job-list APIs on each queue, the same
 * source of truth apps/worker's own Queue/Worker instances write to. No new
 * table or migration is required — BullMQ (backed by Redis) already persists
 * job state durably.
 *
 * Concurrency figures (2 / 3 / 1) are read from the same constants the
 * worker processes construct their BullMQ Worker with (see
 * apps/worker/src/scanner.worker.ts, flagger.worker.ts, scheduler.ts) —
 * duplicated here as literals rather than imported, since apps/web must
 * never import from apps/worker (mirrors the existing token-crypto.ts
 * copy-not-import precedent noted throughout this codebase).
 *
 * SECURITY: job data on scan-queue/flag-queue only ever contains
 * { ruleId, query } / { findingId } (see ScanJobData/FlagJobData) — never a
 * token or matched secret — so it is always safe to read and surface job
 * metadata (id, name, timestamps, status) here.
 */

export type WorkerStatus = "healthy" | "degraded";

export interface WorkerHealth {
  key: "scanner" | "flagger" | "scheduler";
  name: string;
  status: WorkerStatus;
  concurrency: number;
  queueCount: number;
  lastJobAt: string | null;
  successRate: number | null; // 0-100, null if no completed/failed jobs yet
}

export interface RecentJob {
  id: string;
  worker: "scanner" | "flagger" | "scheduler";
  status: "completed" | "failed" | "active" | "waiting";
  durationMs: number | null;
  finishedAt: string | null;
}

export interface WorkerMonitoringSnapshot {
  workers: WorkerHealth[];
  recentJobs: RecentJob[];
  degraded: boolean;
}

const WORKER_DEFS: Array<{ key: WorkerHealth["key"]; name: string; queueName: string; concurrency: number }> = [
  { key: "scanner", name: "Scanner", queueName: QUEUE_NAMES.SCAN, concurrency: 2 },
  { key: "flagger", name: "Flagger", queueName: QUEUE_NAMES.FLAG, concurrency: 3 },
  { key: "scheduler", name: "Scheduler", queueName: QUEUE_NAMES.SCHEDULER, concurrency: 1 },
];

/** Recent-job sample size per queue used to compute success rate + last-job timestamp and to populate the Recent Jobs table. */
const RECENT_SAMPLE_SIZE = 10;

/** A worker is Degraded when its recent sample's success rate drops below this threshold (and it has enough samples to judge). Mirrors the Figma Degraded state ("one worker unhealthy"). */
const DEGRADED_SUCCESS_RATE_THRESHOLD = 50;
const MIN_SAMPLES_TO_JUDGE = 3;

const globalForWorkerQueues = globalThis as unknown as {
  workerMonitoringQueues?: Record<string, Queue>;
};

function getQueue(queueName: string): Queue {
  if (!globalForWorkerQueues.workerMonitoringQueues) {
    globalForWorkerQueues.workerMonitoringQueues = {};
  }
  const cache = globalForWorkerQueues.workerMonitoringQueues;
  if (!cache[queueName]) {
    cache[queueName] = new Queue(queueName, { connection: getRedisConnectionOptions() });
  }
  return cache[queueName];
}

function jobFinishedAtMs(job: { finishedOn?: number; processedOn?: number }): number | null {
  return job.finishedOn ?? null;
}

/**
 * Builds the full worker monitoring snapshot: per-worker health (status,
 * concurrency, queue depth, last job time, success rate) plus a combined
 * "recent jobs" table across all 3 queues, sorted newest-first.
 *
 * Throws if Redis is unreachable — callers (the API route / page) surface
 * that as the Error state, matching every other module's
 * try/catch-to-ErrorState convention (see review-queue page.tsx).
 */
export async function getWorkerMonitoringSnapshot(): Promise<WorkerMonitoringSnapshot> {
  const workers: WorkerHealth[] = [];
  const recentJobs: RecentJob[] = [];

  for (const def of WORKER_DEFS) {
    const queue = getQueue(def.queueName);

    const counts = await queue.getJobCounts("waiting", "active", "completed", "failed", "delayed");
    const queueCount = (counts.waiting ?? 0) + (counts.active ?? 0) + (counts.delayed ?? 0);

    const [completedSample, failedSample] = await Promise.all([
      queue.getJobs(["completed"], 0, RECENT_SAMPLE_SIZE - 1, false),
      queue.getJobs(["failed"], 0, RECENT_SAMPLE_SIZE - 1, false),
    ]);

    for (const job of completedSample) {
      recentJobs.push({
        id: String(job.id),
        worker: def.key,
        status: "completed",
        durationMs:
          job.processedOn != null && job.finishedOn != null ? job.finishedOn - job.processedOn : null,
        finishedAt: job.finishedOn != null ? new Date(job.finishedOn).toISOString() : null,
      });
    }
    for (const job of failedSample) {
      recentJobs.push({
        id: String(job.id),
        worker: def.key,
        status: "failed",
        durationMs:
          job.processedOn != null && job.finishedOn != null ? job.finishedOn - job.processedOn : null,
        finishedAt: job.finishedOn != null ? new Date(job.finishedOn).toISOString() : null,
      });
    }

    const finishedSample = [...completedSample, ...failedSample];
    const totalSampled = finishedSample.length;
    const successRate =
      totalSampled >= 1 ? Math.round((completedSample.length / totalSampled) * 100) : null;

    const lastJobMs = finishedSample.reduce<number | null>((latest, job) => {
      const ms = jobFinishedAtMs(job);
      if (ms == null) return latest;
      if (latest == null || ms > latest) return ms;
      return latest;
    }, null);

    const status: WorkerStatus =
      totalSampled >= MIN_SAMPLES_TO_JUDGE && successRate != null && successRate < DEGRADED_SUCCESS_RATE_THRESHOLD
        ? "degraded"
        : "healthy";

    workers.push({
      key: def.key,
      name: def.name,
      status,
      concurrency: def.concurrency,
      queueCount,
      lastJobAt: lastJobMs != null ? new Date(lastJobMs).toISOString() : null,
      successRate,
    });
  }

  recentJobs.sort((a, b) => {
    const at = a.finishedAt ? new Date(a.finishedAt).getTime() : 0;
    const bt = b.finishedAt ? new Date(b.finishedAt).getTime() : 0;
    return bt - at;
  });

  return {
    workers,
    recentJobs: recentJobs.slice(0, RECENT_SAMPLE_SIZE),
    degraded: workers.some((w) => w.status === "degraded"),
  };
}
