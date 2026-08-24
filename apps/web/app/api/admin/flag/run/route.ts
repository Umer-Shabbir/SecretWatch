import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authorize";
import { prisma } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { getSystemSettings } from "@/lib/system-settings";
import { enqueueFlagJobs } from "@/lib/queue";

/**
 * POST /api/admin/flag/run (2026-08-24 admin-control addition).
 *
 * Manual "Run Flagger" trigger: enqueues one flag-queue job per APPROVED
 * finding, so the flagger worker opens GitHub issues for the current review
 * backlog on demand. Respects the master flagger switch — if flaggerEnabled
 * is off, enqueues nothing and reports it (the worker also re-checks per job
 * and skips without marking findings FAILED).
 *
 * Only APPROVED findings are eligible, matching the flagger worker's own
 * admin-review-gate: PENDING findings must be approved (M06) before they can
 * be flagged.
 *
 * Authorization: ADMIN only. Audit-logged.
 * Response: { enqueued: number, flaggerEnabled: boolean }
 */
export async function POST() {
  const { session, error } = await requireAdmin();
  if (error) {
    return NextResponse.json({ error }, { status: error === "unauthenticated" ? 401 : 403 });
  }

  const { flaggerEnabled } = await getSystemSettings();
  if (!flaggerEnabled) {
    return NextResponse.json({ enqueued: 0, flaggerEnabled: false });
  }

  const findings = await prisma.finding.findMany({
    where: { status: "APPROVED" },
    select: { id: true },
  });

  let enqueued = 0;
  try {
    enqueued = await enqueueFlagJobs(findings.map((f) => f.id));
  } catch {
    return NextResponse.json({ error: "enqueue_failed" }, { status: 503 });
  }

  await recordAudit({
    userId: session!.user.id,
    action: "manual_flag_triggered",
    detail: `enqueued=${enqueued}`,
  });

  return NextResponse.json({ enqueued, flaggerEnabled: true });
}
