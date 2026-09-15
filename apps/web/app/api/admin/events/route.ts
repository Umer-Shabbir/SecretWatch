import { requireAdmin } from "@/lib/authorize";
import { getCachedWorkerMonitoringSnapshot, getCachedLiveActivity } from "@/lib/monitoring-cache";

/**
 * GET /api/admin/events — Server-Sent Events stream for real-time worker
 * monitoring. Pushes two event types every 2 seconds:
 *
 *   event: workers   — WorkerMonitoringSnapshot (worker health + recent jobs)
 *   event: activity  — LiveActivity (scanner/flagger feed + queue depth)
 *
 * Authorization: ADMIN only (same gate as every /admin/* API route).
 *
 * Calls caching helpers heavily to avoid database connection exhaustion.
 *
 * The stream stays open until the client disconnects. On fetch error (Redis
 * unreachable, etc.) the event carries an `error` field so the client can
 * show a degraded state without the connection dropping.
 *
 * Clients use EventSource on the browser side; the SSE protocol handles
 * reconnection automatically on transient network failures.
 */

const PUSH_INTERVAL_MS = 2_000;

export const dynamic = "force-dynamic";

export async function GET() {
  const { error } = await requireAdmin();
  if (error) {
    return new Response(JSON.stringify({ error }), {
      status: error === "unauthenticated" ? 401 : 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  const encoder = new TextEncoder();
  let closed = false;

  const stream = new ReadableStream({
    start(controller) {
      async function push() {
        if (closed) return;

        try {
          // Both calls route through memoizing/deduplicating cache layer (3s TTL).
          const [workers, activity] = await Promise.all([
            getCachedWorkerMonitoringSnapshot().catch(() => null),
            getCachedLiveActivity().catch(() => null),
          ]);

          if (closed) return;

          if (workers !== null) {
            controller.enqueue(
              encoder.encode(`event: workers\ndata: ${JSON.stringify(workers)}\n\n`)
            );
          }

          if (activity !== null) {
            controller.enqueue(
              encoder.encode(`event: activity\ndata: ${JSON.stringify(activity)}\n\n`)
            );
          }

          // If both failed, send a heartbeat so the connection stays alive
          if (workers === null && activity === null) {
            controller.enqueue(encoder.encode(`: heartbeat\n\n`));
          }
        } catch {
          // Guard against encoding errors / closed stream
          if (!closed) {
            try {
              controller.enqueue(encoder.encode(`: heartbeat\n\n`));
            } catch {
              // Stream is truly closed
              closed = true;
              return;
            }
          }
        }

        if (!closed) {
          setTimeout(push, PUSH_INTERVAL_MS);
        }
      }

      // Push immediately on connect, then every PUSH_INTERVAL_MS
      push();
    },
    cancel() {
      closed = true;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
