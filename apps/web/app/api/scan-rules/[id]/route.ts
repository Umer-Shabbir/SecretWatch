import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/authorize";
import { recordAudit } from "@/lib/audit";
import { updateScanRule, deleteScanRule, ScanRuleNotFoundError, InvalidPatternError } from "@/lib/scanRules";

/**
 * PATCH /api/scan-rules/:id
 *
 * Updates a scan rule's name and/or pattern (Figma "Edit" action on a Rule
 * Row). Either field may be omitted to leave it unchanged. Does not accept
 * `enabled` here — enable/disable is a separate action
 * (POST /api/scan-rules/:id/enable | /disable) matching the Figma
 * Enable/Disable buttons and the Disable Confirmation modal flow.
 *
 * Body: { name?: string, pattern?: string }
 * Response: { rule: ScanRuleSummary } on success.
 *
 * Validation:
 *   - 400 if the body fails schema validation (e.g. empty name/pattern).
 *   - 404 if the rule does not exist.
 *   - 409 if a provided pattern fails to compile / matches an unsafe
 *     nested-quantifier shape — mirrors the Figma "Invalid Regex" state.
 *
 * Authorization: ADMIN only. Audited as scan_rule_updated.
 *
*/
const updateScanRuleSchema = z
  .object({
    name: z.string().trim().min(1, "Name must not be empty").max(200).optional(),
    pattern: z.string().min(1, "Pattern must not be empty").optional(),
  })
  .refine((data) => data.name !== undefined || data.pattern !== undefined, {
    message: "At least one of name or pattern must be provided",
  });

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
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

  const parsed = updateScanRuleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", issues: parsed.error.issues.map((i) => i.message) },
      { status: 400 }
    );
  }

  try {
    const rule = await updateScanRule(params.id, parsed.data);

    await recordAudit({
      userId: session!.user.id,
      action: "scan_rule_updated",
      detail: `scanRuleId=${rule.id}`,
    });

    return NextResponse.json({ rule });
  } catch (err) {
    if (err instanceof ScanRuleNotFoundError) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    if (err instanceof InvalidPatternError) {
      return NextResponse.json({ error: "invalid_pattern", message: err.message }, { status: 409 });
    }
    throw err;
  }
}

/**
 * DELETE /api/scan-rules/:id
 *
 * Deletes a scan rule. Audited as scan_rule_deleted.
 */
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const { session, error } = await requireAdmin();
  if (error === "unauthenticated") {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  if (error === "forbidden") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  try {
    await deleteScanRule(params.id);

    await recordAudit({
      userId: session!.user.id,
      action: "scan_rule_deleted",
      detail: `scanRuleId=${params.id}`,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof ScanRuleNotFoundError) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    throw err;
  }
}
