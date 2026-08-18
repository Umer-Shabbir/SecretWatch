import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/authorize";
import { recordAudit } from "@/lib/audit";
import { createMessageTemplate, listMessageTemplates, InvalidVariableError } from "@/lib/messageTemplates";

const TEMPLATE_SEVERITY_VALUES = ["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const;
const TEMPLATE_SECRET_TYPE_VALUES = ["AWS_KEY", "GITHUB_TOKEN", "GENERIC_API_KEY", "DB_CONNECTION_STRING"] as const;

/**
 * GET /api/message-templates
 *
 * Lists all message templates (no pagination — per Figma "Admin / Templates
 * / Default", the list is a single-page set of admin-authored templates, not
 * a paginated table like Findings).
 *
 * Response: { templates: MessageTemplateSummary[] }
 * MessageTemplateSummary = { id, name, body, isDefault, createdAt, updatedAt }
 *
 * Authorization: ADMIN only. Mirrors the admin-only gate used by Scan Rules
 * (state/modules/M09.json places the Figma design entirely on the Admin
 * page/sidebar, "Admin / Templates / <State>").
 */
export async function GET() {
  const { error } = await requireAdmin();
  if (error === "unauthenticated") {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  if (error === "forbidden") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const templates = await listMessageTemplates();
  return NextResponse.json({ templates });
}

const createMessageTemplateSchema = z.object({
  name: z.string().trim().min(1, "Name must not be empty").max(200),
  body: z.string().min(1, "Body must not be empty"),
  severity: z.enum(TEMPLATE_SEVERITY_VALUES).nullish(),
  secretType: z.enum(TEMPLATE_SECRET_TYPE_VALUES).nullish(),
  includeAttributionLine: z.boolean().optional(),
});

/**
 * POST /api/message-templates
 *
 * Creates a new message template (Figma "New Template" form). Always
 * defaults to isDefault: false — no setDefault action is in scope for this
 * module (see lib/messageTemplates.ts's module doc comment).
 *
 * Body: { name: string, body: string, severity?: "CRITICAL"|"HIGH"|"MEDIUM"|"LOW"|null,
 *          secretType?: "AWS_KEY"|"GITHUB_TOKEN"|"GENERIC_API_KEY"|"DB_CONNECTION_STRING"|null,
 *          includeAttributionLine?: boolean }
 * Response: { template: MessageTemplateSummary } on success (201).
 *
 * Validation:
 *   - 400 if the body fails schema validation (empty name/body) OR if `body`
 *     references an unsupported `{{variable}}` (InvalidVariableError). Note
 *     this differs from Scan Rules' pattern-invalid-is-409 convention —
 *     message templates use 400 for both schema and variable-validation
 *     failures, since an unsupported variable is a request-shape validation
 *     error, not a conflicting-state error.
 *
 * Authorization: ADMIN only. Audited as message_template_created.
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

  const parsed = createMessageTemplateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", issues: parsed.error.issues.map((i) => i.message) },
      { status: 400 }
    );
  }

  try {
    const template = await createMessageTemplate(parsed.data);

    await recordAudit({
      userId: session!.user.id,
      action: "message_template_created",
      detail: `messageTemplateId=${template.id} name=${template.name}`,
    });

    return NextResponse.json({ template }, { status: 201 });
  } catch (err) {
    if (err instanceof InvalidVariableError) {
      return NextResponse.json({ error: "invalid_variable", message: err.message }, { status: 400 });
    }
    if (err instanceof Error && /must not be empty|must not exceed/.test(err.message)) {
      return NextResponse.json({ error: "invalid_request", message: err.message }, { status: 400 });
    }
    throw err;
  }
}
