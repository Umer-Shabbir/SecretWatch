"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { RuleForm, type RuleFormValues } from "@/components/admin/rule-form";
import type { ScanRuleSummary } from "@/lib/scanRules";

/**
 * Client wrapper for Admin / Scan Rules / Edit. Shows the shared ErrorState
 * (with Retry) if the rule failed to load or doesn't exist; otherwise
 * renders RuleForm pre-filled with the existing name/pattern and wires its
 * submit to PATCH /api/scan-rules/:id.
 */
export function EditScanRuleClient({
  ruleId,
  initialRule,
  initialLoadFailed,
}: {
  ruleId: string;
  initialRule: ScanRuleSummary | null;
  initialLoadFailed: boolean;
}) {
  const router = useRouter();

  if (initialLoadFailed || !initialRule) {
    return (
      <div className="flex w-full flex-col gap-6 p-4 sm:p-8">
        <h1 className="text-2xl font-semibold leading-8 text-fg-default">Scan Rules</h1>
        <ErrorState
          description="We couldn't load this rule. Please try again."
          action={
            <Button variant="secondary" className="w-auto" onClick={() => router.refresh()}>
              Retry
            </Button>
          }
        />
      </div>
    );
  }

  async function handleSubmit(values: RuleFormValues): Promise<{ ok: true } | { ok: false; message: string }> {
    try {
      const res = await fetch(`/api/scan-rules/${ruleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: values.name, pattern: values.pattern }),
      });
      const body = await res.json();
      if (!res.ok) {
        const message =
          body?.message ?? (Array.isArray(body?.issues) ? body.issues.join(" ") : null) ?? "Could not update this rule. Please try again.";
        return { ok: false, message };
      }
      return { ok: true };
    } catch {
      return { ok: false, message: "Could not update this rule. Please check your connection and try again." };
    }
  }

  return (
    <RuleForm
      mode="edit"
      breadcrumbLabel="Scan Rules / Edit Rule"
      title="Edit Rule"
      initialValues={{ name: initialRule.name, pattern: initialRule.pattern }}
      submitLabel="Save Rule"
      submittingLabel="Saving…"
      onSubmit={handleSubmit}
    />
  );
}
