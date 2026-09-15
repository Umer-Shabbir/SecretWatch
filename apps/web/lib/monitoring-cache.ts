import { getRedisClient } from "@/lib/redis";
import { getWorkerMonitoringSnapshot, WorkerMonitoringSnapshot } from "@/lib/workers";
import { getLiveActivity, LiveActivity } from "@/lib/activity";

const SNAPSHOT_CACHE_KEY = "monitoring:snapshot";
const ACTIVITY_CACHE_KEY = "monitoring:activity";
const CACHE_TTL_SECONDS = 3; // 3 seconds TTL

// Fallback in-memory cache for when Redis is unavailable
let inMemorySnapshot: { data: WorkerMonitoringSnapshot; expiresAt: number } | null = null;
let inMemoryActivity: { data: LiveActivity; expiresAt: number } | null = null;

// Concurrency-control promises to deduplicate in-flight fetches
let activeSnapshotPromise: Promise<WorkerMonitoringSnapshot> | null = null;
let activeActivityPromise: Promise<LiveActivity> | null = null;

export async function getCachedWorkerMonitoringSnapshot(): Promise<WorkerMonitoringSnapshot> {
  const now = Date.now();
  const redis = getRedisClient();

  if (redis && redis.status === "ready") {
    try {
      const cached = await redis.get(SNAPSHOT_CACHE_KEY);
      if (cached) {
        return JSON.parse(cached) as WorkerMonitoringSnapshot;
      }
    } catch (e) {
      console.warn("Failed to read worker monitoring snapshot from Redis cache:", e);
    }
  } else if (inMemorySnapshot && inMemorySnapshot.expiresAt > now) {
    return inMemorySnapshot.data;
  }

  // Deduplicate concurrent calls so multiple SSE connections trigger only 1 fetch
  if (!activeSnapshotPromise) {
    activeSnapshotPromise = (async () => {
      try {
        const snapshot = await getWorkerMonitoringSnapshot();
        const json = JSON.stringify(snapshot);

        if (redis && redis.status === "ready") {
          try {
            await redis.set(SNAPSHOT_CACHE_KEY, json, "EX", CACHE_TTL_SECONDS);
          } catch (e) {
            console.warn("Failed to write worker monitoring snapshot to Redis cache:", e);
          }
        }
        inMemorySnapshot = { data: snapshot, expiresAt: Date.now() + CACHE_TTL_SECONDS * 1000 };
        return snapshot;
      } finally {
        activeSnapshotPromise = null;
      }
    })();
  }

  return activeSnapshotPromise;
}

export async function getCachedLiveActivity(): Promise<LiveActivity> {
  const now = Date.now();
  const redis = getRedisClient();

  if (redis && redis.status === "ready") {
    try {
      const cached = await redis.get(ACTIVITY_CACHE_KEY);
      if (cached) {
        return JSON.parse(cached) as LiveActivity;
      }
    } catch (e) {
      console.warn("Failed to read live activity from Redis cache:", e);
    }
  } else if (inMemoryActivity && inMemoryActivity.expiresAt > now) {
    return inMemoryActivity.data;
  }

  // Deduplicate concurrent calls
  if (!activeActivityPromise) {
    activeActivityPromise = (async () => {
      try {
        const activity = await getLiveActivity();
        const json = JSON.stringify(activity);

        if (redis && redis.status === "ready") {
          try {
            await redis.set(ACTIVITY_CACHE_KEY, json, "EX", CACHE_TTL_SECONDS);
          } catch (e) {
            console.warn("Failed to write live activity to Redis cache:", e);
          }
        }
        inMemoryActivity = { data: activity, expiresAt: Date.now() + CACHE_TTL_SECONDS * 1000 };
        return activity;
      } finally {
        activeActivityPromise = null;
      }
    })();
  }

  return activeActivityPromise;
}
