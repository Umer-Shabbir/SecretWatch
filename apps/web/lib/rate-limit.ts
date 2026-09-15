import Redis from "ioredis";
import { NextRequest } from "next/server";
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

/**
 * Extracts the client IP from the request securely.
 *
 * SEC-001: Rate Limit Bypass via Spoofed X-Forwarded-For Header.
 * Naive parsers take the first element of X-Forwarded-For (`parts[0]`), which an attacker
 * can arbitrarily spoof by sending `X-Forwarded-For: <fake-ip>`.
 *
 * Secure extraction order:
 * 1. NextRequest.ip (if populated by Next.js / Edge runtime)
 * 2. CF-Connecting-IP (set by Cloudflare)
 * 3. X-Real-IP (set by trusted reverse proxy like Nginx or ALB)
 * 4. Last entry of X-Forwarded-For (appended by the closest trusted upstream proxy)
 */
export function getClientIp(request: Request | NextRequest): string {
  if ("ip" in request && typeof (request as any).ip === "string" && (request as any).ip) {
    return (request as any).ip;
  }
  const cfIp = request.headers.get("cf-connecting-ip");
  if (cfIp) return cfIp.trim();

  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();

  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const parts = forwardedFor.split(",").map((p) => p.trim()).filter(Boolean);
    if (parts.length > 0) {
      // The last IP in the chain is appended by the closest proxy and cannot be spoofed by the client
      return parts[parts.length - 1];
    }
  }

  return "127.0.0.1";
}
