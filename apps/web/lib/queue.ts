import { Queue } from "bullmq";
import { QUEUE_NAMES, getRedisConnectionOptions } from "@secretwatch/shared";
import type { FlagJobData } from "@secretwatch/shared";

/**
 * Web-side BullMQ producer (M07). Next.js API routes enqueue jobs here;
 * apps/worker/src/flagger.worker.ts consumes them. Mirrors
 * apps/worker/src/scheduler.ts's Queue construction but lives in apps/web
 * since only the web app's approve route needs to *produce* flag-queue
 * jobs (apps/worker never imports from apps/web, per the existing
 * token-crypto.ts copy-not-import precedent).
 *
 * Lazily constructed and cached on globalThis (same lifecycle pattern as
 * lib/db.ts's Prisma client) so Next.js's dev-mode module reloading doesn't
 * leak duplicate BullMQ connections.
 */
const globalForQueue = globalThis as unknown as { flagQueue?: Queue<FlagJobData> };

function getFlagQueue(): Queue<FlagJobData> {
  if (!globalForQueue.flagQueue) {
    globalForQueue.flagQueue = new Queue<FlagJobData>(QUEUE_NAMES.FLAG, {
      connection: getRedisConnectionOptions(),
    });
  }
  return globalForQueue.flagQueue;
}

/**
 * Enqueues a flag-queue job for a newly-APPROVED finding. Called by
 * POST /api/findings/:id/approve right after the status transition commits.
 *
 * Failure to enqueue (e.g. Redis unreachable) does not roll back the
 * approval — the finding is still validly APPROVED and will simply wait for
 * a future scheduler/manual re-trigger to pick it up; it must never throw
 * back into the approve route and turn a successful DB transition into a
 * 500. Callers should fire-and-log, not fire-and-block.
 */
export async function enqueueFlagJob(findingId: string): Promise<void> {
  await getFlagQueue().add(
    "flag-finding",
    { findingId },
    {
      attempts: 3,
      backoff: { type: "exponential", delay: 5_000 }, // GitHub 403/429 backoff, ARCHITECTURE.md §5
      removeOnComplete: { count: 500 },
      removeOnFail: { count: 500 },
    }
  );
}
