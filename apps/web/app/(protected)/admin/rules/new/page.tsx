"use client";

import { RuleForm, type RuleFormValues } from "@/components/admin/rule-form";

/**
 * Admin / Scan Rules / Create Rule — Figma node 51:267, with 51:268
 * (Invalid Regex) as this same form's inline validation-error state.
 *
 * Built as a dedicated route (not a modal) because Figma designed Create
 * Rule as its own full frame with its own breadcrumb ("Scan Rules / New
 * Rule") and page title — unlike, e.g., M03's Add Token panel, which
 * Figma designed inline on the same Tokens page. Task instructions call
 * for following whichever convention the actual per-screen Figma frame
 * implies, and this one implies a route.
 *
 * Calls POST /api/scan-rules directly (Client Component — no server action
 * needed, matching the review-queue/tokens client-fetch convention used
 * throughout this codebase). A 409 (invalid_pattern) or 400 (schema
 * validation) response is surfaced inline by RuleForm without a page
 * reload; success navigates back to the rule list.
 */
export default function NewScanRulePage() {
  async function handleSubmit(values: RuleFormValues): Promise<{ ok: true } | { ok: false; message: string }> {
    try {
      const res = await fetch("/api/scan-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: values.name, pattern: values.pattern, enabled: values.enabled }),
      });
      const body = await res.json();
      if (!res.ok) {
        const message =
          body?.message ?? (Array.isArray(body?.issues) ? body.issues.join(" ") : null) ?? "Could not create this rule. Please try again.";
        return { ok: false, message };
      }
      return { ok: true };
    } catch {
      return { ok: false, message: "Could not create this rule. Please check your connection and try again." };
    }
  }

  return (
    <RuleForm
      mode="create"
      breadcrumbLabel="Scan Rules / New Rule"
      title="Create Rule"
      initialValues={{ name: "", pattern: "" }}
      submitLabel="Save Rule"
      submittingLabel="Saving…"
      onSubmit={handleSubmit}
    />
  );
}
