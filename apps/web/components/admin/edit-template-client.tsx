"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { TemplateForm, type TemplateFormValues } from "@/components/admin/template-form";
import type { MessageTemplateSummary } from "@/lib/messageTemplates";

/**
 * Client wrapper for Admin / Templates / Edit Template. Shows the shared
 * ErrorState (with Retry) if the template failed to load or doesn't
 * exist; otherwise renders TemplateForm pre-filled with the existing
 * name/body and wires its submit to PATCH /api/message-templates/:id.
 * Mirrors components/admin/edit-rule-client.tsx exactly.
 */
export function EditTemplateClient({
  templateId,
  initialTemplate,
  initialLoadFailed,
}: {
  templateId: string;
  initialTemplate: MessageTemplateSummary | null;
  initialLoadFailed: boolean;
}) {
  const router = useRouter();

  if (initialLoadFailed || !initialTemplate) {
    return (
      <div className="flex w-full flex-col gap-6 p-4 sm:p-8">
        <h1 className="text-2xl font-semibold leading-8 text-fg-default">Message Templates</h1>
        <ErrorState
          description="We couldn't load this template. Please try again."
          action={
            <Button variant="secondary" className="w-auto" onClick={() => router.refresh()}>
              Retry
            </Button>
          }
        />
      </div>
    );
  }

  async function handleSubmit(values: TemplateFormValues): Promise<{ ok: true } | { ok: false; message: string }> {
    try {
      const res = await fetch(`/api/message-templates/${templateId}`, {
        method: "PATCH",
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
          "Could not update this template. Please try again.";
        return { ok: false, message };
      }
      return { ok: true };
    } catch {
      return { ok: false, message: "Could not update this template. Please check your connection and try again." };
    }
  }

  return (
    <TemplateForm
      mode="edit"
      breadcrumbLabel="Templates / Edit Template"
      title="Edit Template"
      initialValues={{
        name: initialTemplate.name,
        body: initialTemplate.body,
        severity: initialTemplate.severity ?? "",
        secretType: initialTemplate.secretType ?? "",
        includeAttributionLine: initialTemplate.includeAttributionLine,
      }}
      submitLabel="Save Template"
      submittingLabel="Saving…"
      cancelHref="/admin/templates"
      onSubmit={handleSubmit}
    />
  );
}
