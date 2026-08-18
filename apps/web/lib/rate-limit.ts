/**
 * Minimal in-process, in-memory IP-based token-bucket rate limiter for
 * public (unauthenticated) HTTP endpoints — currently only
 * POST /api/public/tokens.
 *
 * This mirrors the shape of apps/worker/src/github-client.ts's
 * SearchRateLimiter (same token-bucket idea) but is per-key (per-IP) rather
 * than a single shared bucket, and rejects over-limit requests (429) instead
 * of queueing/waiting — appropriate for an inbound HTTP handler, where a
 * caller should get an immediate, explicit "slow down" response rather than
 * have the request hang.
 *
 * LIMITATION (explicitly noted per ARCHITECTURE.md's intended stack): this
 * is single-process, in-memory state. It resets on every deploy/restart and
 * does not share state across multiple web instances. ARCHITECTURE.md
 * specifies BullMQ + Upstash Redis as the production job/queue stack — the
 * same Redis instance should back this limiter (e.g. a sliding-window or
 * token-bucket counter keyed by IP) before this endpoint is scaled beyond a
 * single instance or exposed at real public volume. Tracked as a follow-up,
 * not implemented here to keep this change scoped to the module at hand.
 */

interface Bucket {
  count: number;
  windowStartMs: number;
}

const buckets = new Map<string, Bucket>();

/**
 * Returns true if the request identified by `key` is allowed under the given
 * limit, and records the attempt. Uses a fixed-window counter (simpler than
 * a sliding window; adequate for a coarse abuse guard on a low-traffic
 * public form) — resets `windowMs` after the window's first request.
 */
export function checkRateLimit(
  key: string,
  { limit = 5, windowMs = 60_000 }: { limit?: number; windowMs?: number } = {}
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
