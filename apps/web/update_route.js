const fs = require('fs');
const filepath = "g:/SecretWatch/apps/web/app/api/scan-rules/[id]/route.ts";

let content = fs.readFileSync(filepath, 'utf8');

// Update imports
content = content.replace(
  'import { updateScanRule, ScanRuleNotFoundError, InvalidPatternError } from "@/lib/scanRules";',
  'import { updateScanRule, deleteScanRule, ScanRuleNotFoundError, InvalidPatternError } from "@/lib/scanRules";'
);

// Remove the comments stating there is no DELETE route
const commentsToRemove = ` * No DELETE route: the Figma design set for M08 (Default, Loading, Empty,
 * Error, Create Rule, Invalid Regex, Disable Confirmation, Mobile) has no
 * delete affordance or confirmation state — the designed destructive-ish
 * action is Disable, not Delete. Adding a delete-capable route beyond what
 * was designed would be inventing product behavior, which CLAUDE.md
 * section 2 prohibits.
 `;

content = content.replace(commentsToRemove, '');

// Apply delete function
const deleteHandler = `
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
      detail: \`scanRuleId=\${params.id}\`,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof ScanRuleNotFoundError) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    throw err;
  }
}
`;

content += deleteHandler;

fs.writeFileSync(filepath, content);
