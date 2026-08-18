"use client";

import { TemplateForm, type TemplateFormValues } from "@/components/admin/template-form";

/**
 * Admin / Templates / New Template — reuses the same Template Form frame
 * Figma designed for Edit (51:274/51:275); no separate Create screen was
 * captured, matching RuleForm/Scan Rules' identical precedent (see
 * template-form.tsx doc comment). The Sidebar-adjacent "New Template"
 * Primary button on the Default (51:271) and Mobile (51:276) frames
 * implies this create route.
 *
 * Calls POST /api/message-templates directly (Client Component — no
 * server action needed, matching admin/rules/new/page.tsx's fetch
 * convention). A 400 (invalid_request or invalid_variable) response is
 * surfaced inline by TemplateForm without a page reload; success
 * navigates back to the template list.
 */
export default function NewTemplatePage() {
  async function handleSubmit(values: TemplateFormValues): Promise<{ ok: true } | { ok: false; message: string }> {
    try {
      const res = await fetch("/api/message-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: values.name,
          body: values.body,
          severity: values.severity ? values.severity : null,
          secretType: values.secretType ? values.secretType : null,
          includeAttributionLine: values.includeAttributionLine ?? false,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        const message =
          body?.message ??
          (Array.isArray(body?.issues) ? body.issues.join(" ") : null) ??
          "Could not create this template. Please try again.";
        return { ok: false, message };
      }
      return { ok: true };
    } catch {
      return { ok: false, message: "Could not create this template. Please check your connection and try again." };
    }
  }

  return (
    <TemplateForm
      mode="create"
      breadcrumbLabel="Templates / New Template"
      title="New Template"
      initialValues={{ name: "", body: "", severity: "", secretType: "", includeAttributionLine: false }}
      submitLabel="Save Template"
      submittingLabel="Saving…"
      cancelHref="/admin/templates"
      onSubmit={handleSubmit}
    />
  );
}
