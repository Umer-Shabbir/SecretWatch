import Redis from "ioredis";
import { getRedisConnectionOptions } from "@secretwatch/shared";

/**
 * Minimal in-process, in-memory IP-based token-bucket rate limiter fallback
 * Used when Redis is unavailable.
 */
interface Bucket {
  count: number;
  windowStartMs: number;
}
const buckets = new Map<string, Bucket>();

// Initialize Redis only if we are in an environment that has REDIS_URL
// and we are not in a build step where it might fail or block
let redis: Redis | null = null;
try {
  if (process.env.REDIS_URL) {
    redis = new Redis(process.env.REDIS_URL);
    redis.on("error", (err) => {
      console.warn("Redis rate-limiter connection error. Falling back to in-memory.", err);
    });
  }
} catch (e) {
  console.warn("Failed to initialize Redis for rate limiting. Falling back to in-memory.");
}

/**
 * Distributed (Redis) or in-process (Map) rate limiter for public HTTP endpoints.
 * Returns true if the request identified by `key` is allowed under the given
 * limit, and records the attempt.
 */
export async function checkRateLimit(
  key: string,
  { limit = 5, windowMs = 60_000 }: { limit?: number; windowMs?: number } = {}
): Promise<{ allowed: boolean; retryAfterMs: number }> {
  if (redis && redis.status === "ready") {
    return checkRateLimitRedis(key, { limit, windowMs });
  }
  return checkRateLimitInMemory(key, { limit, windowMs });
}

async function checkRateLimitRedis(
  key: string,
  { limit, windowMs }: { limit: number; windowMs: number }
): Promise<{ allowed: boolean; retryAfterMs: number }> {
  // Use a Lua script for atomic increment and expiry setting
  // We use the current window start time (rounded down) as part of the key
  // to create a fixed-window counter in Redis
  const now = Date.now();
  const windowStart = now - (now % windowMs);
  const redisKey = `ratelimit:${key}:${windowStart}`;

  try {
    // Pipeline is fast and atomic enough for our needs here,
    // INCR creates the key if it doesn't exist.
    // EXPIRE sets the TTL to the remaining window time (+ a buffer) if we are the first increment.
    const pipe = redis!.pipeline();
    pipe.incr(redisKey);
    pipe.pttl(redisKey);
    const results = await pipe.exec();

    if (!results || results.length !== 2) {
      throw new Error("Redis pipeline failed");
    }

    const [incrResult, pttlResult] = results;
    if (incrResult[0]) throw incrResult[0]; // Error during INCR
    if (pttlResult[0]) throw pttlResult[0]; // Error during PTTL

    const count = incrResult[1] as number;
    let ttl = pttlResult[1] as number;

    // If key has no TTL (ttl < 0), set it to expire at the end of the window.
    if (ttl < 0) {
      const windowRemaining = windowStart + windowMs - now;
      await redis!.pexpire(redisKey, windowRemaining);
      ttl = windowRemaining;
    }

    if (count > limit) {
      return { allowed: false, retryAfterMs: Math.max(0, ttl) };
    }

    return { allowed: true, retryAfterMs: 0 };
  } catch (err) {
    console.error("Redis rate limiting failed, falling back to in-memory:", err);
    return checkRateLimitInMemory(key, { limit, windowMs });
  }
}

function checkRateLimitInMemory(
  key: string,
  { limit, windowMs }: { limit: number; windowMs: number }
): { allowed: boolean; retryAfterMs: number } {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || now - existing.windowStartMs >= windowMs) {
    buckets.set(key, { count: 1, windowStartMs: now });
    return { allowed: true, retryAfterMs: 0 };
  }

  if (existing.count >= limit) {
    return { allowed: false, retryAfterMs: windowMs - (now - existing.windowStartMs) };
  }

  existing.count += 1;
  return { allowed: true, retryAfterMs: 0 };
}

/** Best-effort client IP extraction from standard proxy headers (Next.js strips the raw socket address behind most hosts). Falls back to a constant key, which degrades to a single shared bucket if no proxy header is present — acceptable for a dev/low-traffic fallback, not a substitute for real infra-level rate limiting. */
export function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]!.trim();
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "unknown";
}
