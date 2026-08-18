import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/authorize";
import { recordAudit } from "@/lib/audit";
import {
  getMessageTemplateById,
  updateMessageTemplate,
  deleteMessageTemplate,
  MessageTemplateNotFoundError,
  InvalidVariableError,
  CannotDeleteDefaultError,
  CannotDeleteLastTemplateError,
} from "@/lib/messageTemplates";

/**
 * GET /api/message-templates/:id
 *
 * Fetches one message template. 404 if it does not exist.
 * Response: { template: MessageTemplateSummary }
 * Authorization: ADMIN only.
 */
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requireAdmin();
  if (error === "unauthenticated") {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  if (error === "forbidden") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  try {
    const template = await getMessageTemplateById(params.id);
    return NextResponse.json({ template });
  } catch (err) {
    if (err instanceof MessageTemplateNotFoundError) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    throw err;
  }
}

const TEMPLATE_SEVERITY_VALUES = ["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const;
const TEMPLATE_SECRET_TYPE_VALUES = ["AWS_KEY", "GITHUB_TOKEN", "GENERIC_API_KEY", "DB_CONNECTION_STRING"] as const;

const updateMessageTemplateSchema = z
  .object({
    name: z.string().trim().min(1, "Name must not be empty").max(200).optional(),
    body: z.string().min(1, "Body must not be empty").optional(),
    severity: z.enum(TEMPLATE_SEVERITY_VALUES).nullish(),
    secretType: z.enum(TEMPLATE_SECRET_TYPE_VALUES).nullish(),
    includeAttributionLine: z.boolean().optional(),
  })
  .refine(
    (data) =>
      data.name !== undefined ||
      data.body !== undefined ||
      data.severity !== undefined ||
      data.secretType !== undefined ||
      data.includeAttributionLine !== undefined,
    {
      message: "At least one field must be provided",
    }
  );

/**
 * PATCH /api/message-templates/:id
 *
 * Updates a template's name and/or body (Figma "Edit Template" action).
 * Either field may be omitted to leave it unchanged. Never accepts
 * `isDefault` — see lib/messageTemplates.ts's module doc comment for why.
 *
 * Body: { name?: string, body?: string }
 * Response: { template: MessageTemplateSummary } on success.
 *
 * Validation:
 *   - 400 if the body fails schema validation OR references an unsupported
 *     `{{variable}}` (InvalidVariableError) — mirrors the Figma "Invalid
 *     Variable" editor validation-error state.
 *   - 404 if the template does not exist.
 *
 * Authorization: ADMIN only. Audited as message_template_updated.
 */
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

  const parsed = updateMessageTemplateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", issues: parsed.error.issues.map((i) => i.message) },
      { status: 400 }
    );
  }

  try {
    const template = await updateMessageTemplate(params.id, parsed.data);

    await recordAudit({
      userId: session!.user.id,
      action: "message_template_updated",
      detail: `messageTemplateId=${template.id} name=${template.name}`,
    });

    return NextResponse.json({ template });
  } catch (err) {
    if (err instanceof MessageTemplateNotFoundError) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    if (err instanceof InvalidVariableError) {
      return NextResponse.json({ error: "invalid_variable", message: err.message }, { status: 400 });
    }
    if (err instanceof Error && /must not be empty|must not exceed/.test(err.message)) {
      return NextResponse.json({ error: "invalid_request", message: err.message }, { status: 400 });
    }
    throw err;
  }
}

/**
 * DELETE /api/message-templates/:id
 *
 * Hard-deletes a message template. Guarded against deleting the default
 * template or the last remaining template (see lib/messageTemplates.ts's
 * deleteMessageTemplate doc comment for exact ordering/rationale).
 *
 * Response: { success: true } on success (200). This repo's existing DELETE
 * precedent (apps/web/app/api/tokens/[id]/route.ts) always returns 200 with a
 * JSON body rather than a bodyless 204, so this mirrors that convention.
 *
 * Status codes:
 *   - 404 if the template does not exist.
 *   - 409 if CannotDeleteDefaultError or CannotDeleteLastTemplateError.
 *
 * Authorization: ADMIN only. Audited as message_template_deleted.
 */
export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  const { session, error } = await requireAdmin();
  if (error === "unauthenticated") {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  if (error === "forbidden") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  try {
    await deleteMessageTemplate(params.id);

    await recordAudit({
      userId: session!.user.id,
      action: "message_template_deleted",
      detail: `messageTemplateId=${params.id}`,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof MessageTemplateNotFoundError) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    if (err instanceof CannotDeleteDefaultError) {
      return NextResponse.json({ error: "cannot_delete_default", message: err.message }, { status: 409 });
    }
    if (err instanceof CannotDeleteLastTemplateError) {
      return NextResponse.json({ error: "cannot_delete_last_template", message: err.message }, { status: 409 });
    }
    throw err;
  }
}
