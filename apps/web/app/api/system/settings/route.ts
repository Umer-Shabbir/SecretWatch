import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/authorize";
import { recordAudit } from "@/lib/audit";
import { getSystemSettings, updateSystemSettings } from "@/lib/system-settings";

/**
 * GET/PATCH /api/system/settings (2026-08-24 admin-control addition).
 *
 * The two master switches (scannerEnabled/flaggerEnabled) that gate the
 * background subsystems. GET reads the singleton row; PATCH updates one or
 * both switches. The worker reads the same DB row (read-only) and reacts on
 * its next tick/job — see apps/worker/src/system-settings.ts.
 *
 * Authorization: ADMIN only. Every toggle is audit-logged.
 */

const patchSchema = z
  .object({
    scannerEnabled: z.boolean().optional(),
    flaggerEnabled: z.boolean().optional(),
    autoFlagEnabled: z.boolean().optional(),
    // GitHub code-search per_page max is 100; keep at least 1.
    scanResultsPerRule: z.number().int().min(1).max(100).optional(),
    // rateLimitRemaining is 0..~5000; a threshold of 0..1000 covers any sane
    // "skip near-empty tokens" policy.
    flagRateLimitThreshold: z.number().int().min(0).max(1000).optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), {
    message: "At least one setting field is required",
  });

function authError(error: "unauthenticated" | "forbidden") {
  return NextResponse.json({ error }, { status: error === "unauthenticated" ? 401 : 403 });
}

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return authError(error);

  const settings = await getSystemSettings();
  return NextResponse.json({ settings });
}

export async function PATCH(request: NextRequest) {
  const { session, error } = await requireAdmin();
  if (error) return authError(error);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", issues: parsed.error.issues.map((i) => i.message) },
      { status: 400 }
    );
  }

  const settings = await updateSystemSettings(parsed.data);

  await recordAudit({
    userId: session!.user.id,
    action: "system_settings_updated",
    detail:
      `scannerEnabled=${settings.scannerEnabled} flaggerEnabled=${settings.flaggerEnabled} ` +
      `autoFlagEnabled=${settings.autoFlagEnabled} scanResultsPerRule=${settings.scanResultsPerRule} ` +
      `flagRateLimitThreshold=${settings.flagRateLimitThreshold}`,
  });

  return NextResponse.json({ settings });
}
