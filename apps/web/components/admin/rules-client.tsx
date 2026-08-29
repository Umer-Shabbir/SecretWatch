"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";
import { DisableRuleDialog } from "@/components/admin/disable-rule-dialog";
import { DeleteRuleDialog } from "@/components/admin/delete-rule-dialog";
import { formatShortDate } from "@/lib/format-date";
import type { ScanRuleSummary } from "@/lib/scanRules";

/**
 * Link styled as a Button — components/ui/button.tsx has no `asChild`/Slot
 * support, and no shared "link that looks like a button" primitive exists
 * in this codebase (every other module's Links render as plain underlined
 * text, e.g. components/findings/findings-client.tsx). Figma's Create
 * Rule/Edit actions are real button-styled navigations though, so this
 * mirrors Button's exact variant classes rather than inventing a new visual
 * style or modifying the shared Button component for one module.
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
 * Client orchestrator for Admin / Scan Rules (M08). Figma nodes:
 *   - 51:263 Default
 *   - 51:264 Loading (route-level loading.tsx handles the *initial* load;
 *     `refetching` here covers a manual Retry after a failed fetch)
 *   - 51:265 Empty
 *   - 51:266 Error
 *   - 51:269 Disable Confirmation (modal)
 *   - 51:270 Mobile (responsive CSS on this same component, not a separate
 *     route — matching M06/M03's precedent of one component covering both
 *     breakpoints)
 *
 * Create/Edit are their own routes (admin/rules/new, admin/rules/[id]/edit)
 * per Figma's dedicated "Create Rule" frame with its own breadcrumb — see
 * page.tsx doc comment for the full reasoning.
 *
 * Enable is a direct action (POST /api/scan-rules/:id/enable, no
 * confirmation). Disable is gated behind DisableRuleDialog (POST
 * /api/scan-rules/:id/disable) per Figma scopeNotes: only Disable needs
 * confirmation.
 */
export function RulesClient({
  initialRules,
  initialLoadFailed,
}: {
  initialRules: ScanRuleSummary[] | null;
  initialLoadFailed: boolean;
}) {
  const [rules, setRules] = useState<ScanRuleSummary[] | null>(initialRules);
  const [loadFailed, setLoadFailed] = useState(initialLoadFailed);
  const [refetching, setRefetching] = useState(false);

  const [pendingActionId, setPendingActionId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<"enable" | "disable" | "delete" | null>(null);
  const [disableTargetId, setDisableTargetId] = useState<string | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const disableTriggerRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const deleteTriggerRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const requestId = useRef(0);

  const fetchRules = useCallback(async () => {
    const thisRequest = ++requestId.current;
    setRefetching(true);
    try {
      const res = await fetch("/api/scan-rules", { cache: "no-store" });
      if (thisRequest !== requestId.current) return;

      if (!res.ok) {
        setLoadFailed(true);
        return;
      }
      const body = (await res.json()) as { rules: ScanRuleSummary[] };
      setRules(body.rules);
      setLoadFailed(false);
    } catch {
      if (thisRequest !== requestId.current) return;
      setLoadFailed(true);
    } finally {
      if (thisRequest === requestId.current) setRefetching(false);
    }
  }, []);

  function handleRetry() {
    fetchRules();
  }

  async function performToggle(id: string, action: "enable" | "disable") {
    setPendingActionId(id);
    setPendingAction(action);
    setActionError(null);
    try {
      const res = await fetch(`/api/scan-rules/${id}/${action}`, { method: "POST" });
      const body = await res.json();
      if (!res.ok) {
        setActionError(body?.message ?? `Could not ${action} this rule. Please try again.`);
        return;
      }
      const updated: ScanRuleSummary = body.rule;
      setRules((prev) => (prev ? prev.map((r) => (r.id === updated.id ? updated : r)) : prev));
    } catch {
      setActionError(`Could not ${action} this rule. Please try again.`);
    } finally {
      setPendingActionId(null);
      setPendingAction(null);
      if (action === "disable") setDisableTargetId(null);
    }
  }

  function handleEnableClick(id: string) {
    performToggle(id, "enable");
  }

  function handleDisableClick(id: string) {
    setDisableTargetId(id);
  }

  function handleConfirmDisable() {
    if (disableTargetId) performToggle(disableTargetId, "disable");
  }

  function handleCancelDisable() {
    const targetId = disableTargetId;
    setDisableTargetId(null);
    if (targetId) disableTriggerRefs.current[targetId]?.focus();
  }

  async function performDelete(id: string) {
    setPendingActionId(id);
    setPendingAction("delete");
    setActionError(null);
    try {
      const res = await fetch(`/api/scan-rules/${id}`, { method: "DELETE" });
      const body = await res.json();
      if (!res.ok) {
        setActionError(body?.message ?? "Could not delete this rule. Please try again.");
        return;
      }
      setRules((prev) => (prev ? prev.filter((r) => r.id !== id) : prev));
    } catch {
      setActionError("Could not delete this rule. Please try again.");
    } finally {
      setPendingActionId(null);
      setPendingAction(null);
      setDeleteTargetId(null);
    }
  }

  function handleDeleteClick(id: string) {
    setDeleteTargetId(id);
  }

  function handleConfirmDelete() {
    if (deleteTargetId) performDelete(deleteTargetId);
  }

  function handleCancelDelete() {
    const targetId = deleteTargetId;
    setDeleteTargetId(null);
    if (targetId) deleteTriggerRefs.current[targetId]?.focus();
  }

  const ruleList = rules ?? [];
  const total = ruleList.length;
  const enabledCount = ruleList.filter((r) => r.enabled).length;
  const isEmpty = !loadFailed && rules !== null && total === 0;
  const disableTarget = disableTargetId ? ruleList.find((r) => r.id === disableTargetId) : undefined;
  const deleteTarget = deleteTargetId ? ruleList.find((r) => r.id === deleteTargetId) : undefined;

  return (
    <div className="flex w-full flex-col gap-6 p-4 sm:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold leading-8 text-fg-default">Scan Rules</h1>
          {!loadFailed && rules !== null && (
            <p className="mt-1 text-sm text-fg-muted">
              {total} rule{total === 1 ? "" : "s"} configured · {enabledCount} enabled
            </p>
          )}
        </div>
        {!isEmpty && (
          <LinkButton href="/admin/rules/new" variant="primary" className="w-full sm:w-auto">
            Create Rule
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
            title="No scan rules yet"
            description="Create a rule to start detecting leaked credentials in scanned repositories."
            action={
              <LinkButton href="/admin/rules/new" variant="primary" className="w-auto">
                Create Rule
              </LinkButton>
            }
          />
        </div>
      ) : (
        <div className={`flex w-full flex-col gap-4 ${refetching ? "opacity-60" : ""}`}>
          {ruleList.map((rule) => {
            const isThisEnabling = pendingActionId === rule.id && pendingAction === "enable";
            const isThisDisabling = pendingActionId === rule.id && pendingAction === "disable";
            const anyActionOnThisRow = pendingActionId === rule.id;

            return (
              <div
                key={rule.id}
                className="flex w-full flex-col gap-2 rounded-small border border-border-default p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:p-5"
              >
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="text-base font-semibold text-fg-default sm:text-[16px]">{rule.name}</span>
                    <Badge status={rule.enabled ? "success" : "default"}>{rule.enabled ? "ENABLED" : "DISABLED"}</Badge>
                  </div>
                  <p className="truncate font-mono text-[12px] text-fg-muted sm:text-[13px]">{rule.pattern}</p>
                  <p className="text-xs text-fg-subtle">Created {formatShortDate(new Date(rule.createdAt))}</p>
                </div>

                <div className="flex items-start gap-2">
                  <LinkButton href={`/admin/rules/${rule.id}/edit`} variant="secondary" className="w-auto">
                    Edit
                  </LinkButton>
                  <Button
                    ref={(el) => {
                      deleteTriggerRefs.current[rule.id] = el;
                    }}
                    variant="destructive"
                    className="w-auto"
                    onClick={() => handleDeleteClick(rule.id)}
                    loading={pendingActionId === rule.id && pendingAction === "delete"}
                    disabled={anyActionOnThisRow && pendingAction !== "delete"}
                  >
                    Delete
                  </Button>
                  {rule.enabled ? (
                    <Button
                      ref={(el) => {
                        disableTriggerRefs.current[rule.id] = el;
                      }}
                      variant="secondary"
                      className="w-auto"
                      onClick={() => handleDisableClick(rule.id)}
                      loading={isThisDisabling}
                      disabled={anyActionOnThisRow && !isThisDisabling}
                    >
                      Disable
                    </Button>
                  ) : (
                    <Button
                      variant="secondary"
                      className="w-auto"
                      onClick={() => handleEnableClick(rule.id)}
                      loading={isThisEnabling}
                      disabled={anyActionOnThisRow && !isThisEnabling}
                    >
                      Enable
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <DisableRuleDialog
        open={disableTargetId !== null}
        ruleName={disableTarget?.name ?? "This rule"}
        disabling={pendingAction === "disable" && pendingActionId === disableTargetId}
        onCancel={handleCancelDisable}
        onConfirm={handleConfirmDisable}
      />
      <DeleteRuleDialog
        open={deleteTargetId !== null}
        ruleName={deleteTarget?.name ?? "This rule"}
        deleting={pendingAction === "delete" && pendingActionId === deleteTargetId}
        onCancel={handleCancelDelete}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
