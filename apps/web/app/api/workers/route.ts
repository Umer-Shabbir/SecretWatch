import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authorize";
import { getWorkerMonitoringSnapshot } from "@/lib/workers";

/**
 * GET /api/workers
 *
 * Admin / Workers (M10). Returns live worker health + recent job history
 * read straight from BullMQ (see lib/workers.ts doc comment — no separate
 * WorkerJob table exists; BullMQ/Redis is the source of truth).
 *
 * Response: { workers: WorkerHealth[], recentJobs: RecentJob[], degraded: boolean }
 *
 * Authorization: ADMIN only, same gate as every other /admin/* API route
 * (scan-rules, message-templates, findings/approve).
 *
 * A Redis-unreachable failure surfaces as a 502 so the frontend renders the
 * Figma Error state rather than a generic 500.
 */
export async function GET() {
  const { error } = await requireAdmin();
  if (error === "unauthenticated") {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  if (error === "forbidden") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  try {
    const snapshot = await getWorkerMonitoringSnapshot();
    return NextResponse.json(snapshot);
  } catch {
    return NextResponse.json(
      { error: "unavailable", message: "Unable to reach worker status" },
      { status: 502 }
    );
  }
}
