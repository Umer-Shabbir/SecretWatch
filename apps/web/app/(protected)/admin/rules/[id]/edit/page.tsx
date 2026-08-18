import { getScanRule } from "@/lib/scanRules";
import { EditScanRuleClient } from "@/components/admin/edit-rule-client";

/**
 * Admin / Scan Rules / Edit — reuses the same Rule Form frame Figma
 * designed for Create (51:267/51:268); no separate Edit screen was
 * designed, so this route reuses RuleForm exactly as the task instructed
 * ("reuse the same form component/route pattern for updating name/pattern
 * via PATCH /api/scan-rules/:id").
 *
 * Server Component fetches the existing rule via lib/scanRules.ts's
 * getScanRule() to pre-fill the form (no such prefetch exists for Create,
 * which starts blank). A missing/failed-to-load rule renders the shared
 * ErrorState with Retry, same treatment as Finding Detail's missing-finding
 * case (app/(protected)/findings/[id]/page.tsx) rather than a dedicated
 * not-found screen outside the 8-state Figma set.
 */
export default async function EditScanRulePage({ params }: { params: { id: string } }) {
  let initialRule: Awaited<ReturnType<typeof getScanRule>> = null;
  let loadFailed = false;

  try {
    initialRule = await getScanRule(params.id);
    if (!initialRule) loadFailed = true;
  } catch {
    loadFailed = true;
  }

  return <EditScanRuleClient ruleId={params.id} initialRule={initialRule} initialLoadFailed={loadFailed} />;
}
