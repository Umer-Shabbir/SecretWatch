import type { ConnectionOptions } from "bullmq";

/**
 * Shared BullMQ queue names + Redis connection config, per ARCHITECTURE.md
 * section 5/6. Imported by both apps/web (to enqueue jobs, e.g. a future
 * manual-scan-trigger endpoint) and apps/worker (to consume them), so the
 * two processes can never drift on queue naming.
 */
export const QUEUE_NAMES = {
  SCAN: "scan-queue",
  FLAG: "flag-queue",
  SCHEDULER: "scheduler-queue",
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

/** Repeatable scheduler job name, enqueued on QUEUE_NAMES.SCHEDULER. */
export const SCHEDULER_JOB_NAME = "recurring-scan-tick";

/**
 * Default interval (minutes) between scheduler ticks when
 * SCAN_INTERVAL_MINUTES is not set. Kept conservative to respect GitHub
 * Search API's ~30 req/min authenticated rate limit (ARCHITECTURE.md §5).
 */
export const DEFAULT_SCAN_INTERVAL_MINUTES = 15;

/**
 * Builds ioredis-compatible connection options for BullMQ from REDIS_URL.
 * Works with both a local Redis instance and Upstash's rediss:// TLS URLs.
 *
 * BullMQ requires maxRetriesPerRequest: null on the connection it manages.
 */
export function getRedisConnectionOptions(): ConnectionOptions {
  const url = process.env.REDIS_URL;
  if (!url) {
    throw new Error("REDIS_URL is not configured");
  }

  return {
    // ioredis accepts a full connection string via `path`/`host` parsing,
    // but BullMQ's ConnectionOptions type expects discrete fields OR an
    // ioredis instance. We hand back a minimal object; callers construct
    // the actual IORedis instance themselves (see apps/worker/src/db.ts
    // pattern) so both TLS (rediss://) and plain redis:// work uniformly.
    ...parseRedisUrl(url),
    maxRetriesPerRequest: null,
  };
}

function parseRedisUrl(url: string): { host: string; port: number; username?: string; password?: string; tls?: Record<string, never> } {
  const parsed = new URL(url);
  const isTls = parsed.protocol === "rediss:";
  return {
    host: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : 6379,
    username: parsed.username || undefined,
    password: parsed.password || undefined,
    ...(isTls ? { tls: {} } : {}),
  };
}
