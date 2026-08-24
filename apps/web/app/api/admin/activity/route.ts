import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authorize";
import { getLiveActivity } from "@/lib/activity";

/**
 * GET /api/admin/activity (2026-08-24 admin-control addition).
 *
 * Live worker activity feed for the admin Overview: recent scanner findings,
 * recent flagger flags + failures, and live scan/flag queue depth. Polled by
 * the Overview's WorkerActivity client component so operators see what the
 * workers are doing without a manual refresh.
 *
 * Authorization: ADMIN only, same gate as every other /admin/* API route.
 */
export async function GET() {
  const { error } = await requireAdmin();
  if (error) {
    return NextResponse.json({ error }, { status: error === "unauthenticated" ? 401 : 403 });
  }

  const activity = await getLiveActivity();
  return NextResponse.json(activity);
}
