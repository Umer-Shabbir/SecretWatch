import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/authorize";
import { recordAudit } from "@/lib/audit";
import { createScanRule, listScanRules, InvalidPatternError } from "@/lib/scanRules";

/**
 * GET /api/scan-rules
 *
 * Lists all scan rules (no pagination — per Figma "Admin / Scan Rules /
 * Default", the list is a single-page rule set, not a paginated table like
 * Findings; there is no volume expectation that would require pagination
 * for detection rules).
 *
 * Response: { rules: ScanRuleSummary[] }
 * ScanRuleSummary = { id, name, pattern, enabled, createdAt }
 *
 * Authorization: ADMIN only. Per docs/PRODUCT_SOURCE_OF_TRUTH.md, Scan Rules
 * is listed under both "User" and "Admin" UI areas, but state/modules/M08.json
 * places the Figma design entirely on the Admin page/sidebar ("Admin / Scan
 * Rules / <State>", Sidebar instance shows "Scan Rules" as an Admin nav
 * item) — mirrors the same admin-only gate used by the Rules/Review Queue
 * family of admin routes (findings/approve, findings/ignore).
 */
export async function GET() {
  const { error } = await requireAdmin();
  if (error === "unauthenticated") {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  if (error === "forbidden") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const rules = await listScanRules();
  return NextResponse.json({ rules });
}

const createScanRuleSchema = z.object({
  name: z.string().trim().min(1, "Name must not be empty").max(200),
  pattern: z.string().min(1, "Pattern must not be empty"),
  // Optional — mirrors the Figma Create Rule form's "Enable this rule
  // immediately" checkbox (checked by default). Omitting it preserves the
  // original default-enabled behavior.
  enabled: z.boolean().optional(),
});

/**
 * POST /api/scan-rules
 *
 * Creates a new scan rule (Figma "Create Rule" form). Defaults to enabled:
 * true. Validates the pattern compiles as a JS RegExp and rejects an
 * obvious catastrophic-backtracking shape — see lib/scanRules.ts's
 * assertValidPattern for exactly what's checked. Maps to the Figma
 * "Invalid Regex" form-validation-error state via a 409 response.
 *
 * Body: { name: string, pattern: string }
 * Response: { rule: ScanRuleSummary } on success (201).
 *
 * Authorization: ADMIN only (see GET doc comment above).
 * Audited as scan_rule_created.
 */
export async function POST(request: NextRequest) {
  const { session, error } = await requireAdmin();
  if (error === "unauthenticated") {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  if (error === "forbidden") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = createScanRuleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", issues: parsed.error.issues.map((i) => i.message) },
      { status: 400 }
    );
  }

  try {
    const rule = await createScanRule(parsed.data);

    await recordAudit({
      userId: session!.user.id,
      action: "scan_rule_created",
      detail: `scanRuleId=${rule.id} name=${rule.name}`,
    });

    return NextResponse.json({ rule }, { status: 201 });
  } catch (err) {
    if (err instanceof InvalidPatternError) {
      return NextResponse.json({ error: "invalid_pattern", message: err.message }, { status: 409 });
    }
    throw err;
  }
}
