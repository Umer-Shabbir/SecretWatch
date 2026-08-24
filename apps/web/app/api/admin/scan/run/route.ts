import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authorize";
import { prisma } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { getSystemSettings } from "@/lib/system-settings";
import { enqueueScanJobs } from "@/lib/queue";

/**
 * POST /api/admin/scan/run (2026-08-24 admin-control addition).
 *
 * Manual "Run Scanner" trigger: fans out one scan-queue job per enabled
 * ScanRule, exactly like a scheduler tick. Respects the master scanner
 * switch — if scannerEnabled is off, enqueues nothing and reports it, so the
 * button can't bypass the switch (the worker also re-checks per job).
 *
 * Authorization: ADMIN only. Audit-logged.
 * Response: { enqueued: number, scannerEnabled: boolean }
 */
export async function POST() {
  const { session, error } = await requireAdmin();
  if (error) {
    return NextResponse.json({ error }, { status: error === "unauthenticated" ? 401 : 403 });
  }

  const { scannerEnabled } = await getSystemSettings();
  if (!scannerEnabled) {
    return NextResponse.json({ enqueued: 0, scannerEnabled: false });
  }

  const rules = await prisma.scanRule.findMany({
    where: { enabled: true },
    select: { id: true },
  });

  let enqueued = 0;
  try {
    enqueued = await enqueueScanJobs(rules.map((r) => r.id));
  } catch {
    // Redis unreachable — surface as a soft failure, not a crash. Nothing was
    // enqueued; the caller can retry once the queue backend is reachable.
    return NextResponse.json({ error: "enqueue_failed" }, { status: 503 });
  }

  await recordAudit({
    userId: session!.user.id,
    action: "manual_scan_triggered",
    detail: `enqueued=${enqueued}`,
  });

  return NextResponse.json({ enqueued, scannerEnabled: true });
}
