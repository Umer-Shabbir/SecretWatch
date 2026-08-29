"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { DeleteTemplateDialog } from "@/components/admin/delete-template-dialog";
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

function TemplateCard({
  template,
  onDeleteRequest,
  onDeleteRef,
  isPendingDelete,
  hasAnyPendingAction,
}: {
  template: MessageTemplateSummary;
  onDeleteRequest: (id: string) => void;
  onDeleteRef: (el: HTMLButtonElement | null) => void;
  isPendingDelete: boolean;
  hasAnyPendingAction: boolean;
}) {
  const hasVariantBadges = template.severity || template.secretType || template.includeAttributionLine;

  return (
    <div className="flex w-full flex-col items-start gap-3 rounded-small border border-border-default p-4 sm:p-5">
      <div className="flex w-full justify-between items-start gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[15px] font-semibold text-fg-default sm:text-base">{template.name}</p>
          {template.isDefault && <Badge status="accent">Default</Badge>}
        </div>
        <div className="flex items-start gap-2">
          {!template.isDefault && (
            <Button
              ref={onDeleteRef}
              variant="destructive"
              className="w-auto h-7 text-xs px-2 sm:h-9 sm:text-sm sm:px-4"
              onClick={() => onDeleteRequest(template.id)}
              loading={isPendingDelete}
              disabled={hasAnyPendingAction && !isPendingDelete}
            >
              Delete
            </Button>
          )}
          <LinkButton href={`/admin/templates/${template.id}/edit`} variant="secondary" className="w-auto h-7 text-xs px-2 sm:h-9 sm:text-sm sm:px-4">
            Edit
          </LinkButton>
        </div>
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
    </div>
  );
}

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

  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const deleteTriggerRefs = useRef<Record<string, HTMLButtonElement | null>>({});
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

  function handleDeleteClick(id: string) {
    setDeleteTargetId(id);
    setActionError(null);
  }

  function handleCancelDelete() {
    const targetId = deleteTargetId;
    setDeleteTargetId(null);
    if (targetId) deleteTriggerRefs.current[targetId]?.focus();
  }

  async function performDelete(id: string) {
    setPendingActionId(id);
    setActionError(null);
    try {
      const res = await fetch(`/api/message-templates/${id}`, { method: "DELETE" });
      const body = await res.json();
      if (!res.ok) {
        setActionError(body?.message ?? "Could not delete this template. Please try again.");
        return;
      }
      setTemplates((prev) => (prev ? prev.filter((t) => t.id !== id) : prev));
    } catch {
      setActionError("Could not delete this template. Please try again.");
    } finally {
      setPendingActionId(null);
      setDeleteTargetId(null);
    }
  }

  function handleConfirmDelete() {
    if (deleteTargetId) performDelete(deleteTargetId);
  }

  const templateList = templates ?? [];
  const isEmpty = !loadFailed && templates !== null && templateList.length === 0;
  const deleteTarget = deleteTargetId ? templateList.find((t) => t.id === deleteTargetId) : undefined;

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

      {actionError && (
        <div role="alert" className="w-full rounded-small border border-danger-emphasis/30 bg-danger-subtle px-3 py-2 text-sm text-danger-fg">
          {actionError}
        </div>
      )}

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
            <TemplateCard
              key={template.id}
              template={template}
              onDeleteRequest={handleDeleteClick}
              onDeleteRef={(el) => {
                deleteTriggerRefs.current[template.id] = el;
              }}
              isPendingDelete={pendingActionId === template.id}
              hasAnyPendingAction={pendingActionId !== null}
            />
          ))}
        </div>
      )}

      <DeleteTemplateDialog
        open={deleteTargetId !== null}
        templateName={deleteTarget?.name ?? "This template"}
        deleting={pendingActionId === deleteTargetId}
        onCancel={handleCancelDelete}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
