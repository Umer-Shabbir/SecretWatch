import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authorize";
import { recordAudit } from "@/lib/audit";
import { setScanRuleEnabled, ScanRuleNotFoundError } from "@/lib/scanRules";

/**
 * POST /api/scan-rules/:id/enable
 *
 * Re-enables a previously-disabled scan rule (Figma "Enable" action). The
 * scanner scheduler (apps/worker/src/scheduler.ts) reads `enabled` ScanRule
 * rows fresh from the DB on every tick with no caching, so this simply flips
 * the flag — the next scheduler tick will pick the rule back up
 * automatically, no worker restart or cache-bust required.
 *
 * Idempotent: enabling an already-enabled rule succeeds (200), it does not
 * error.
 *
 * Response: { rule: ScanRuleSummary } on success.
 * Authorization: ADMIN only. Audited as scan_rule_enabled.
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
    const rule = await setScanRuleEnabled(params.id, true);

    await recordAudit({
      userId: session!.user.id,
      action: "scan_rule_enabled",
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
