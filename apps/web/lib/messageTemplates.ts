import { prisma } from "@/lib/db";
import { renderTemplate, findUnsupportedVariables, appendAttributionLine } from "@secretwatch/shared";
import type { TemplateSeverity, TemplateSecretType } from "@prisma/client";

/**
 * Message Template business logic (M09).
 *
 * A MessageTemplate is admin-authored copy used to render the body of the
 * GitHub issue the flagger worker opens for an APPROVED Finding
 * (apps/worker/src/flagger.worker.ts, M07). Supported substitution variables
 * are `{{repo}}`, `{{file}}`, `{{rule}}` — see packages/shared/src/template.ts
 * for the render/validation primitives shared between this module and the
 * worker.
 *
 * WORKER-DEPENDENCY FINDING (drives the delete guards below): the flagger
 * worker does NOT hard-require any pre-existing MessageTemplate row. Its
 * getOrCreateDefaultTemplate() looks up `isDefault: true` and self-heals by
 * creating a brand-new template (DEFAULT_TEMPLATE_NAME / DEFAULT_TEMPLATE_BODY
 * from packages/shared) if none exists:
 *
 *   async function getOrCreateDefaultTemplate() {
 *     const existing = await prisma.messageTemplate.findFirst({ where: { isDefault: true } });
 *     if (existing) return existing;
 *     return prisma.messageTemplate.create({
 *       data: { name: DEFAULT_TEMPLATE_NAME, body: DEFAULT_TEMPLATE_BODY, isDefault: true },
 *     });
 *   }
 *
 * So the worker can never be "broken" by zero templates existing. The delete
 * guards in this module (CannotDeleteDefaultError, CannotDeleteLastTemplateError)
 * are therefore defense-in-depth / product-intent guards, not availability
 * guards for the worker:
 *   - CannotDeleteDefaultError protects an admin-authored default template
 *     from being silently deleted and silently replaced by the worker's
 *     generic auto-created fallback the next time a flag fires.
 *   - CannotDeleteLastTemplateError additionally prevents ending up with zero
 *     admin-authored templates at all, even though the worker would
 *     technically self-heal in that scenario too.
 *
 * No `setDefault` / `isDefault` toggle endpoint exists in this module's scope
 * — state/modules/M09.json's Figma scopeNotes describe no such UI, so
 * `isDefault` is never settable via createMessageTemplate/updateMessageTemplate
 * (only the worker's self-heal path sets it, today).
 *
 * This module never handles, logs, or persists any matched secret value —
 * template bodies are admin-authored copy, not Finding data. See
 * renderMessageTemplatePreview's doc comment for the preview-only boundary.
 */

export interface MessageTemplateSummary {
  id: string;
  name: string;
  body: string;
  isDefault: boolean;
  // Optional classification metadata (2026-08-17 addition). Both null for
  // any template that hasn't been assigned a variant — see schema.prisma's
  // MessageTemplate doc comment for why nothing currently auto-selects on
  // these fields.
  severity: TemplateSeverity | null;
  secretType: TemplateSecretType | null;
  // Whether the fixed ATTRIBUTION_LINE (packages/shared/src/template.ts) is
  // appended when this template is rendered. Defaults to false for every
  // existing and new template — never force-enabled.
  includeAttributionLine: boolean;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}

const MESSAGE_TEMPLATE_SELECT = {
  id: true,
  name: true,
  body: true,
  isDefault: true,
  severity: true,
  secretType: true,
  includeAttributionLine: true,
  createdAt: true,
  updatedAt: true,
} as const;

type MessageTemplateRow = {
  id: string;
  name: string;
  body: string;
  isDefault: boolean;
  severity: TemplateSeverity | null;
  secretType: TemplateSecretType | null;
  includeAttributionLine: boolean;
  createdAt: Date;
  updatedAt: Date;
};

function toMessageTemplateSummary(row: MessageTemplateRow): MessageTemplateSummary {
  return {
    id: row.id,
    name: row.name,
    body: row.body,
    isDefault: row.isDefault,
    severity: row.severity,
    secretType: row.secretType,
    includeAttributionLine: row.includeAttributionLine,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export class MessageTemplateNotFoundError extends Error {
  constructor(public readonly id: string) {
    super(`Message template not found: ${id}`);
    this.name = "MessageTemplateNotFoundError"; Object.setPrototypeOf(this, MessageTemplateNotFoundError.prototype);
  }
}

export class InvalidVariableError extends Error {
  constructor(public readonly variable: string) {
    super(`Unsupported template variable: {{${variable}}}`);
    this.name = "InvalidVariableError"; Object.setPrototypeOf(this, InvalidVariableError.prototype);
  }
}

export class CannotDeleteDefaultError extends Error {
  constructor(public readonly id: string) {
    super(`Cannot delete the default message template: ${id}`);
    this.name = "CannotDeleteDefaultError"; Object.setPrototypeOf(this, CannotDeleteDefaultError.prototype);
  }
}

export class CannotDeleteLastTemplateError extends Error {
  constructor(public readonly id: string) {
    super(`Cannot delete the only remaining message template: ${id}`);
    this.name = "CannotDeleteLastTemplateError"; Object.setPrototypeOf(this, CannotDeleteLastTemplateError.prototype);
  }
}

/**
 * GitHub issue body practical/display limit — generous margin under GitHub's
 * actual ~65536 char API limit for issue bodies, chosen to keep templates
 * reasonable to review/edit in the admin editor while leaving ample headroom
 * before ever risking a GitHub API rejection.
 */
const MAX_BODY_LENGTH = 5000;

const MAX_NAME_LENGTH = 200;

/**
 * Validates a template's `name`, returning the trimmed value. Name
 * validation failures are plain Errors (not a dedicated error class) since
 * the API layer's zod schema is the primary gate for name shape — this is a
 * defense-in-depth re-check, mirroring scanRules.ts's own re-trim-and-check
 * pattern for its `name` field.
 */
function assertValidName(name: string): string {
  const trimmed = name?.trim() ?? "";
  if (!trimmed) {
    throw new Error("Name must not be empty");
  }
  if (trimmed.length > MAX_NAME_LENGTH) {
    throw new Error(`Name must not exceed ${MAX_NAME_LENGTH} characters`);
  }
  return trimmed;
}

/**
 * Validates a template's `body`: non-empty, within MAX_BODY_LENGTH, and
 * containing only supported `{{repo|file|rule}}` variables. Throws
 * InvalidVariableError naming the first unsupported variable found (e.g.
 * `{{secret}}` -> variable "secret").
 */
function assertValidBody(body: string): string {
  if (!body || body.trim().length === 0) {
    throw new Error("Body must not be empty");
  }
  if (body.length > MAX_BODY_LENGTH) {
    throw new Error(`Body must not exceed ${MAX_BODY_LENGTH} characters`);
  }
  const unsupported = findUnsupportedVariables(body);
  if (unsupported.length > 0) {
    throw new InvalidVariableError(unsupported[0]);
  }
  return body;
}

/**
 * Returns all message templates, isDefault first (desc) then createdAt
 * ascending. This keeps the admin-visible default template pinned to the top
 * of the list (matching Figma's "Default" template typically shown first),
 * with the remaining templates ordered by creation order (oldest first)
 * rather than newest-first, since templates are edited/reused copy rather
 * than a reverse-chronological feed like Findings/Scan Rules.
 */
export async function listMessageTemplates(): Promise<MessageTemplateSummary[]> {
  const rows = await prisma.messageTemplate.findMany({
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    select: MESSAGE_TEMPLATE_SELECT,
  });
  return rows.map(toMessageTemplateSummary);
}

/** Fetches one message template by id. Throws MessageTemplateNotFoundError if missing. */
export async function getMessageTemplateById(id: string): Promise<MessageTemplateSummary> {
  const row = await prisma.messageTemplate.findUnique({
    where: { id },
    select: MESSAGE_TEMPLATE_SELECT,
  });
  if (!row) {
    throw new MessageTemplateNotFoundError(id);
  }
  return toMessageTemplateSummary(row);
}

/**
 * Creates a new message template. Validates `name`/`body` are non-empty,
 * within their max-length guards, and that `body` only references supported
 * variables. New templates always default to `isDefault: false` — this
 * module has no `setDefault` action in scope (see module doc comment); only
 * the flagger worker's self-heal path ever sets isDefault: true.
 */
export async function createMessageTemplate(params: {
  name: string;
  body: string;
  severity?: TemplateSeverity | null;
  secretType?: TemplateSecretType | null;
  includeAttributionLine?: boolean;
}): Promise<MessageTemplateSummary> {
  const name = assertValidName(params.name);
  const body = assertValidBody(params.body);

  const row = await prisma.messageTemplate.create({
    data: {
      name,
      body,
      isDefault: false,
      severity: params.severity ?? null,
      secretType: params.secretType ?? null,
      includeAttributionLine: params.includeAttributionLine ?? false,
    },
    select: MESSAGE_TEMPLATE_SELECT,
  });

  return toMessageTemplateSummary(row);
}

/**
 * Updates a message template's name and/or body (Figma "Edit Template"
 * action). Either field may be omitted to leave it unchanged. Re-validates
 * whichever fields are provided. Never accepts `isDefault` from the caller —
 * see module doc comment. Throws MessageTemplateNotFoundError if missing.
 */
export async function updateMessageTemplate(
  id: string,
  params: {
    name?: string;
    body?: string;
    severity?: TemplateSeverity | null;
    secretType?: TemplateSecretType | null;
    includeAttributionLine?: boolean;
  }
): Promise<MessageTemplateSummary> {
  const existing = await prisma.messageTemplate.findUnique({
    where: { id },
    select: MESSAGE_TEMPLATE_SELECT,
  });
  if (!existing) {
    throw new MessageTemplateNotFoundError(id);
  }

  const data: {
    name?: string;
    body?: string;
    severity?: TemplateSeverity | null;
    secretType?: TemplateSecretType | null;
    includeAttributionLine?: boolean;
  } = {};

  if (params.name !== undefined) {
    data.name = assertValidName(params.name);
  }

  if (params.body !== undefined) {
    data.body = assertValidBody(params.body);
  }

  if (params.severity !== undefined) {
    data.severity = params.severity;
  }

  if (params.secretType !== undefined) {
    data.secretType = params.secretType;
  }

  if (params.includeAttributionLine !== undefined) {
    data.includeAttributionLine = params.includeAttributionLine;
  }

  const row = await prisma.messageTemplate.update({
    where: { id },
    data,
    select: MESSAGE_TEMPLATE_SELECT,
  });

  return toMessageTemplateSummary(row);
}

/**
 * Deletes a message template. Guards (checked in this order — the more
 * specific/informative error wins when both would apply):
 *   1. MessageTemplateNotFoundError — the row does not exist.
 *   2. CannotDeleteDefaultError — the row has isDefault === true.
 *   3. CannotDeleteLastTemplateError — the row is the only remaining
 *      template (regardless of isDefault).
 * See module doc comment for why these guards exist despite the worker's
 * self-healing default-template lookup.
 */
export async function deleteMessageTemplate(id: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    // 1. Get the target template first, establishing its existence and default status.
    const existing = await tx.messageTemplate.findUnique({
      where: { id },
      select: MESSAGE_TEMPLATE_SELECT,
    });
    if (!existing) {
      throw new MessageTemplateNotFoundError(id);
    }

    if (existing.isDefault) {
      throw new CannotDeleteDefaultError(id);
    }

    // 2. Count ALL templates currently in the DB.
    // In PostgreSQL, COUNT under read-committed isn't fully serialized against concurrent
    // deletes unless we elevate the transaction or explicitly lock rows. But rather than
    // a table-level lock, we can select FOR UPDATE all remaining templates if we want
    // strict serialization, OR we can simply let the delete happen, and if the count
    // AFTER delete is 0, we rollback. Rollback-on-zero is the safest atomic path without
    // locking the whole table.
    // 
    // Wait, simpler: just delete it, then count what's left. If count is 0, throw and rollback!
    await tx.messageTemplate.delete({ where: { id } });
    const remainingCount = await tx.messageTemplate.count();
    
    if (remainingCount === 0) {
      throw new CannotDeleteLastTemplateError(id);
    }
  });
}

/**
 * Renders a message template's body against fixed SAMPLE data for the admin
 * editor's live preview. MUST NEVER be fed real Finding data — this is a
 * preview-only helper; the actual per-Finding render happens exclusively in
 * apps/worker/src/flagger.worker.ts using real Finding.repoFullName/
 * filePath/matchedRule values.
 */
export function renderMessageTemplatePreview(body: string, includeAttributionLine?: boolean): string {
  const rendered = renderTemplate(body, {
    repo: "octocat/example-repo",
    file: "src/config.js",
    rule: "AWS Access Key",
  });
  return appendAttributionLine(rendered, includeAttributionLine);
}
