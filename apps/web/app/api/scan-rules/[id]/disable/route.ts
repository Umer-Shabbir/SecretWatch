import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authorize";
import { recordAudit } from "@/lib/audit";
import { setScanRuleEnabled, ScanRuleNotFoundError } from "@/lib/scanRules";

/**
 * POST /api/scan-rules/:id/disable
 *
 * Disables a scan rule (Figma "Disable" action, gated on the frontend
 * behind the Disable Confirmation modal). This endpoint only flips the
 * `enabled` flag to false — the confirmation semantics captured in the
 * Figma copy ("<Rule name> will no longer be evaluated by the scanner.
 * Existing findings from this rule are not affected.") are a frontend-only
 * confirmation UX; the API itself is a plain state transition. Existing
 * Finding rows are genuinely unaffected because Finding.matchedRule is a
 * denormalized display string, not a foreign key to ScanRule, so disabling
 * (or even hypothetically deleting) a rule can never cascade into
 * previously-recorded findings.
 *
 * The scheduler (apps/worker/src/scheduler.ts) reads `enabled` rules fresh
 * from the DB every tick with no caching, so a disabled rule simply stops
 * being enqueued for scanning starting from the next tick.
 *
 * Idempotent: disabling an already-disabled rule succeeds (200), it does
 * not error.
 *
 * Response: { rule: ScanRuleSummary } on success.
 * Authorization: ADMIN only. Audited as scan_rule_disabled.
 */
export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const { session, error } = await requireAdmin();
  if (error === "unauthenticated") {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  if (error === "forbidden") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  try {
    const rule = await setScanRuleEnabled(params.id, false);

    await recordAudit({
      userId: session!.user.id,
      action: "scan_rule_disabled",
      detail: `scanRuleId=${rule.id}`,
    });

    return NextResponse.json({ rule });
  } catch (err) {
    if (err instanceof ScanRuleNotFoundError) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    throw err;
  }
}
