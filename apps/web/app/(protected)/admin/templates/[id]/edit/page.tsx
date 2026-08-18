import { getMessageTemplateById } from "@/lib/messageTemplates";
import { EditTemplateClient } from "@/components/admin/edit-template-client";

/**
 * Admin / Templates / Edit Template — Figma nodes 51:274 (Invalid
 * Variable, this form's inline validation-error state) and 51:275 (Save
 * Success, this form's success state); both frames share the "Templates /
 * Edit Template" breadcrumb and Edit Template title.
 *
 * Server Component fetches the existing template via
 * lib/messageTemplates.ts's getMessageTemplateById() to pre-fill the form
 * (no such prefetch exists for Create, which starts blank), matching
 * admin/rules/[id]/edit/page.tsx's exact pattern.
 */
export default async function EditTemplatePage({ params }: { params: { id: string } }) {
  let initialTemplate: Awaited<ReturnType<typeof getMessageTemplateById>> | null = null;
  let loadFailed = false;

  try {
    initialTemplate = await getMessageTemplateById(params.id);
  } catch {
    // Covers both MessageTemplateNotFoundError (bad/stale id) and any
    // transient fetch failure — EditTemplateClient renders the same
    // ErrorState+Retry treatment for either, matching
    // admin/rules/[id]/edit/page.tsx's identical simplification.
    loadFailed = true;
  }

  return <EditTemplateClient templateId={params.id} initialTemplate={initialTemplate} initialLoadFailed={loadFailed} />;
}
