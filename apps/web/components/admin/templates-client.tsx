"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import type { MessageTemplateSummary } from "@/lib/messageTemplates";

const SEVERITY_LABELS: Record<string, string> = {
  CRITICAL: "Critical",
  HIGH: "High",
  MEDIUM: "Medium",
  LOW: "Low",
};

const SEVERITY_BADGE_STATUS: Record<string, "error" | "warning" | "accent" | "default"> = {
  CRITICAL: "error",
  HIGH: "warning",
  MEDIUM: "accent",
  LOW: "default",
};

const SECRET_TYPE_LABELS: Record<string, string> = {
  AWS_KEY: "AWS Key",
  GITHUB_TOKEN: "GitHub Token",
  GENERIC_API_KEY: "Generic API Key",
  DB_CONNECTION_STRING: "DB Connection String",
};

/**
 * Link styled as a Button — mirrors components/admin/rules-client.tsx's
 * LinkButton exactly (no `asChild`/Slot support on the shared Button, and
 * no shared "link that looks like a button" primitive exists yet). Used
 * for "New Template" (Primary) navigating to the Create route and "Edit
 * Template" (Secondary) navigating to the Edit route per Figma.
 */
function LinkButton({
  href,
  variant = "primary",
  className = "",
  children,
}: {
  href: string;
  variant?: "primary" | "secondary";
  className?: string;
  children: React.ReactNode;
}) {
  const variantClasses =
    variant === "primary"
      ? "bg-accent-emphasis text-white hover:opacity-90"
      : "bg-canvas-default text-fg-default border border-border-default hover:bg-canvas-subtle";
  return (
    <Link
      href={href}
      className={`flex h-9 items-center justify-center gap-2 rounded-small px-4 text-sm font-medium transition-colors ${variantClasses} ${className}`}
    >
      {children}
    </Link>
  );
}

/**
 * Template Card — hand-composed per state/modules/M09.json's
 * componentsNotReused_builtLocally (no generic content-card/"Message
 * Template Editor" primitive exists in Figma's component library). Figma
 * node 51:1894 (Default state, first card): name (Semi Bold 16), a
 * monospace preview box (canvas/subtle fill, border/muted border,
 * JetBrains Mono 13px), an "Available variables" caption row, and a
 * single "Edit Template" (Secondary/Medium) action.
 *
 * IMPORTANT — matches Figma exactly, not the task brief's assumption: the
 * preview box in both the Default (51:271) and Mobile (51:276) frames
 * renders the template body VERBATIM with its raw {{repo}}/{{file}}/
 * {{rule}} tokens still visible (e.g. "A potential {{rule}} was detected
 * in {{repo}} at {{file}}."), not a sample-substituted rendering. The
 * screenshot was inspected directly to confirm this before implementing
 * — lib/messageTemplates.ts's renderMessageTemplatePreview() exists for a
 * *future* live-preview affordance but is intentionally NOT used here,
 * since introducing a rendered preview where Figma shows raw tokens would
 * silently invent a design the spec does not show.
 *
 * No delete action exists on this card (or anywhere in the 6 captured
 * Figma states) — see templates-client.tsx module doc comment for the
 * full scope note.
 */
function TemplateCard({ template }: { template: MessageTemplateSummary }) {
  const hasVariantBadges = template.severity || template.secretType || template.includeAttributionLine;

  return (
    <div className="flex w-full flex-col items-start gap-3 rounded-small border border-border-default p-4 sm:p-5">
      <div className="flex w-full flex-wrap items-center gap-2">
        <p className="text-[15px] font-semibold text-fg-default sm:text-base">{template.name}</p>
        {template.isDefault && <Badge status="accent">Default</Badge>}
      </div>
      {hasVariantBadges && (
        <div className="flex flex-wrap items-center gap-1.5">
          {template.severity && (
            <Badge status={SEVERITY_BADGE_STATUS[template.severity] ?? "default"}>
              Severity: {SEVERITY_LABELS[template.severity] ?? template.severity}
            </Badge>
          )}
          {template.secretType && (
            <Badge status="default">{SECRET_TYPE_LABELS[template.secretType] ?? template.secretType}</Badge>
          )}
          {template.includeAttributionLine && <Badge status="default">Attribution line on</Badge>}
        </div>
      )}
      <div className="h-auto min-h-[80px] w-full rounded-small border border-border-muted bg-canvas-subtle px-4 py-3">
        <pre className="whitespace-pre-wrap break-words font-mono text-[12px] leading-normal text-fg-default sm:text-[13px]">
          {template.body}
        </pre>
      </div>
      <p className="whitespace-pre text-xs text-fg-subtle">{"Variables: {{repo}}  {{file}}  {{rule}}"}</p>
      <LinkButton href={`/admin/templates/${template.id}/edit`} variant="secondary" className="w-auto">
        Edit Template
      </LinkButton>
    </div>
  );
}

/**
 * Client orchestrator for Admin / Templates (M09). Figma nodes:
 *   - 51:271 Default
 *   - 51:272 Loading (route-level loading.tsx handles the *initial* load;
 *     `refetching` here covers a manual Retry after a failed fetch)
 *   - 51:273 Error
 *   - 51:276 Mobile (responsive CSS on this same component, matching
 *     M08/M06's precedent of one component covering both breakpoints —
 *     no shared Mobile Header component exists yet, per Figma's own
 *     scopeNotes flagging this as a known, propagated gap)
 *
 * Create/Edit are their own routes (admin/templates/new,
 * admin/templates/[id]/edit) reusing the same TemplateForm component, per
 * the same reasoning as RuleForm/Scan Rules (see template-form.tsx doc
 * comment) — Figma's Invalid Variable/Save Success frames are both the
 * *Edit Template* screen's states, and there is no separate "New
 * Template" frame, but the Sidebar-adjacent "New Template" button on
 * Default/Mobile clearly implies a create flow using the same form shape.
 *
 * SCOPE NOTE — no Delete action: none of the 6 Figma frames (Default,
 * Mobile, or either editor state) show a Delete/Remove control on a
 * template card or in the editor's Form Actions row. The backend supports
 * DELETE /api/message-templates/:id with 409 guards
 * (cannot_delete_default / cannot_delete_last_template), but CLAUDE.md
 * section 6/7 and this task's Figma-fidelity instructions forbid
 * inventing UI that Figma does not show. No delete UI/confirmation dialog
 * is built in this pass; flagging as a known follow-up in state/modules/
 * M09.json rather than fabricating a control.
 */
export function TemplatesClient({
  initialTemplates,
  initialLoadFailed,
}: {
  initialTemplates: MessageTemplateSummary[] | null;
  initialLoadFailed: boolean;
}) {
  const [templates, setTemplates] = useState<MessageTemplateSummary[] | null>(initialTemplates);
  const [loadFailed, setLoadFailed] = useState(initialLoadFailed);
  const [refetching, setRefetching] = useState(false);
  const requestId = useRef(0);

  const fetchTemplates = useCallback(async () => {
    const thisRequest = ++requestId.current;
    setRefetching(true);
    try {
      const res = await fetch("/api/message-templates", { cache: "no-store" });
      if (thisRequest !== requestId.current) return;

      if (!res.ok) {
        setLoadFailed(true);
        return;
      }
      const body = (await res.json()) as { templates: MessageTemplateSummary[] };
      setTemplates(body.templates);
      setLoadFailed(false);
    } catch {
      if (thisRequest !== requestId.current) return;
      setLoadFailed(true);
    } finally {
      if (thisRequest === requestId.current) setRefetching(false);
    }
  }, []);

  function handleRetry() {
    fetchTemplates();
  }

  const templateList = templates ?? [];
  const isEmpty = !loadFailed && templates !== null && templateList.length === 0;

  return (
    <div className="flex w-full flex-col gap-6 p-4 sm:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold leading-8 text-fg-default">Message Templates</h1>
        </div>
        {!isEmpty && (
          <LinkButton href="/admin/templates/new" variant="primary" className="w-full sm:w-auto">
            New Template
          </LinkButton>
        )}
      </div>

      {loadFailed ? (
        <ErrorState
          description="We couldn't load this data. Please try again."
          action={
            <Button variant="secondary" className="w-auto" onClick={handleRetry} loading={refetching}>
              Retry
            </Button>
          }
        />
      ) : isEmpty ? (
        <div className="w-full rounded-small border border-border-muted">
          <EmptyState
            title="No message templates yet"
            description="Create a template to customize the GitHub issues opened for approved findings."
            action={
              <LinkButton href="/admin/templates/new" variant="primary" className="w-auto">
                New Template
              </LinkButton>
            }
          />
        </div>
      ) : (
        <div className={`flex w-full flex-col gap-4 ${refetching ? "opacity-60" : ""}`}>
          {templateList.map((template) => (
            <TemplateCard key={template.id} template={template} />
          ))}
        </div>
      )}
    </div>
  );
}
