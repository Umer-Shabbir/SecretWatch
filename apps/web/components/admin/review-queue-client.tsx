"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { FindingStatusBadge } from "@/components/ui/finding-status-badge";
import { FindingSeverityBadge } from "@/components/ui/finding-severity-badge";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { ConfirmApproveDialog } from "@/components/findings/confirm-approve-dialog";
import { ExportFindingsButton } from "@/components/findings/export-findings-button";
import { formatRelativeTime } from "@/lib/format-relative-time";
import type { FindingSummary, FindingsListResult } from "@/lib/findings";

import type { FindingSeverity } from "@secretwatch/shared";

const PAGE_SIZE = 20;

const SEVERITY_FILTERS: Array<{ label: string; value: FindingSeverity | "ALL" }> = [
  { label: "All", value: "ALL" },
  { label: "Critical", value: "CRITICAL" },
  { label: "High", value: "HIGH" },
  { label: "Medium", value: "MEDIUM" },
  { label: "Low", value: "LOW" },
];

/**
 * Client orchestrator for Admin / Review Queue (M06). Figma nodes:
 *   - 42:844 Default
 *   - 42:845 Loading (route-level loading.tsx handles the *initial* load;
 *     `refetching` here covers subsequent page loads)
 *   - 42:846 Empty
 *   - 42:847 Error
 *   - 42:848 Confirm Approve (modal — reuses ConfirmApproveDialog, same
 *     component M05's Finding Detail already uses)
 *   - 42:849 Mobile
 *
 * Always queries GET /api/findings?status=PENDING — a review queue is by
 * definition the set of findings awaiting a human decision. Severity filter
 * tabs (All/Critical/High/Medium/Low) map to the `severity` column added by
 * the finding-severity migration and are appended to the query when a non-ALL
 * value is selected.
 *
 * Approve/Ignore call the same admin-gated endpoints M05 already built
 * (POST /api/findings/:id/approve, /ignore) — no new backend logic, no
 * duplicated business rules. A successful action removes the row from the
 * local list (it's no longer PENDING) rather than re-fetching the whole
 * page, so the queue visibly shrinks as the admin works through it.
 */
export function ReviewQueueClient({
  initialResult,
  initialLoadFailed,
  isAdmin,
}: {
  initialResult: FindingsListResult | null;
  initialLoadFailed: boolean;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [page, setPage] = useState(initialResult?.page ?? 1);
  const [severityFilter, setSeverityFilter] = useState<FindingSeverity | "ALL">("ALL");
  const [result, setResult] = useState<FindingsListResult | null>(initialResult);
  const [loadFailed, setLoadFailed] = useState(initialLoadFailed);
  const [refetching, setRefetching] = useState(false);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<"approve" | "ignore" | null>(null);
  const [showBulkConfirmDialog, setShowBulkConfirmDialog] = useState(false);

  const [pendingActionId, setPendingActionId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<"approve" | "ignore" | null>(null);
  const [confirmTargetId, setConfirmTargetId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const approveTriggerRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const requestId = useRef(0);

  const fetchQueue = useCallback(async (nextPage: number, severity: FindingSeverity | "ALL") => {
    const thisRequest = ++requestId.current;
    setRefetching(true);
    try {
      const params = new URLSearchParams({
        status: "PENDING",
        page: String(nextPage),
        pageSize: String(PAGE_SIZE),
      });
      if (severity !== "ALL") {
        params.set("severity", severity);
      }
      const res = await fetch(`/api/findings?${params.toString()}`, { cache: "no-store" });
      if (thisRequest !== requestId.current) return;

      if (!res.ok) {
        setLoadFailed(true);
        return;
      }
      const body = (await res.json()) as FindingsListResult;
      setResult(body);
      setSelectedIds(new Set());
      setLoadFailed(false);
    } catch {
      if (thisRequest !== requestId.current) return;
      setLoadFailed(true);
    } finally {
      if (thisRequest === requestId.current) setRefetching(false);
    }
  }, []);

  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    fetchQueue(page, severityFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, severityFilter]);

  function handleRetry() {
    fetchQueue(page, severityFilter);
  }

  function handleSeverityChange(value: FindingSeverity | "ALL") {
    setSeverityFilter(value);
    setPage(1);
  }

  async function performAction(id: string, action: "approve" | "ignore") {
    setPendingActionId(id);
    setPendingAction(action);
    setActionError(null);
    try {
      const res = await fetch(`/api/findings/${id}/${action}`, { method: "POST" });
      const body = await res.json();
      if (!res.ok) {
        setActionError(body?.message ?? `Could not ${action} this finding. It may have already been updated.`);
        return;
      }
      // Remove the row locally — it's no longer PENDING, so it no longer
      // belongs in this queue. Avoids a full re-fetch for a single-row change.
      setResult((prev) =>
        prev
          ? {
              ...prev,
              findings: prev.findings.filter((f) => f.id !== id),
              total: Math.max(prev.total - 1, 0),
            }
          : prev
      );
      // Refresh server data so navigation to other pages (e.g. admin
      // overview stat cards, sidebar badges) reflects the updated counts.
      router.refresh();
    } catch {
      setActionError(`Could not ${action} this finding. Please try again.`);
    } finally {
      setPendingActionId(null);
      setPendingAction(null);
      if (action === "approve") setConfirmTargetId(null);
    }
  }

  function handleIgnoreClick(id: string) {
    performAction(id, "ignore");
  }

  function handleApproveClick(id: string) {
    setConfirmTargetId(id);
  }

  function handleConfirmApprove() {
    if (confirmTargetId) performAction(confirmTargetId, "approve");
  }

  function handleCancelApprove() {
    const targetId = confirmTargetId;
    setConfirmTargetId(null);
    if (targetId) approveTriggerRefs.current[targetId]?.focus();
  }

  function toggleSelection(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === findings.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(findings.map((f) => f.id)));
    }
  }

  async function performBulkAction(action: "approve" | "ignore") {
    if (selectedIds.size === 0) return;
    setBulkAction(action);
    setActionError(null);
    try {
      const ids = Array.from(selectedIds);
      const res = await fetch(`/api/findings/bulk/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      const body = await res.json();
      if (!res.ok) {
        setActionError(body?.message ?? `Could not ${action} selected findings.`);
        return;
      }
      setResult((prev) => {
        if (!prev) return prev;
        const newFindings = prev.findings.filter((f) => !ids.includes(f.id));
        const newTotal = Math.max(prev.total - ids.length, 0);

        // UX-007: Fetch previous page if current page becomes empty
        if (newFindings.length === 0 && page > 1) {
          setPage(page - 1);
        }

        return {
          ...prev,
          findings: newFindings,
          total: newTotal,
        };
      });
      setSelectedIds(new Set());
      router.refresh();
    } catch {
      setActionError(`Could not ${action} selected findings. Please try again.`);
    } finally {
      setBulkAction(null);
      if (action === "approve") setShowBulkConfirmDialog(false);
    }
  }

  const findings: FindingSummary[] = result?.findings ?? [];
  const total = result?.total ?? 0;
  const totalPages = result?.totalPages ?? 1;
  const isEmpty = !loadFailed && result !== null && result.total === 0;

  if (!isAdmin) {
    return (
      <div className="flex w-full flex-col gap-6 p-8">
        <h1 className="text-2xl font-semibold leading-8 text-fg-default">Review Queue</h1>
        <ErrorState
          title="Admins only"
          description="You don't have permission to view the review queue."
        />
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-6 p-8">
      <div>
        <h1 className="text-2xl font-semibold leading-8 text-fg-default">Review Queue</h1>
        {!loadFailed && result !== null && (
          <p className="mt-1 text-sm text-fg-muted">
            {total} finding{total === 1 ? "" : "s"} awaiting review
          </p>
        )}
      </div>

      {actionError && (
        <div role="alert" className="w-full rounded-small border border-danger-emphasis/30 bg-danger-subtle px-3 py-2 text-sm text-danger-fg">
          {actionError}
        </div>
      )}

      {/* Severity filter tabs & Bulk Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap gap-1" role="group" aria-label="Filter by severity">
          {SEVERITY_FILTERS.map(({ label, value }) => (
            <button
              key={value}
              type="button"
              onClick={() => handleSeverityChange(value)}
              aria-pressed={severityFilter === value}
              className={`rounded-small border px-3 py-1 text-xs font-medium transition-colors ${
                severityFilter === value
                  ? "border-accent-emphasis bg-accent-subtle text-accent-fg"
                  : "border-border-default bg-canvas-default text-fg-muted hover:bg-canvas-subtle hover:text-fg-default"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <ExportFindingsButton severityFilter={severityFilter} />
          {findings.length > 0 && (
            <div className="flex items-center gap-2 border-l border-border-default pl-3">
              <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-fg-default">
                <input
                  type="checkbox"
                  checked={selectedIds.size > 0 && selectedIds.size === findings.length}
                  ref={(el) => {
                    if (el) {
                      el.indeterminate = selectedIds.size > 0 && selectedIds.size < findings.length;
                    }
                  }}
                  onChange={toggleSelectAll}
                  className="h-4 w-4 rounded border-border-default text-accent-emphasis focus:ring-accent-emphasis"
                />
                <span>Select all</span>
              </label>
            </div>
          )}
        </div>
      </div>

      {selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-small border border-accent-emphasis/30 bg-accent-subtle/50 px-4 py-2.5 text-sm">
          <span className="font-medium text-accent-fg">
            {selectedIds.size} finding{selectedIds.size === 1 ? "" : "s"} selected
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              className="w-auto text-xs"
              onClick={() => performBulkAction("ignore")}
              loading={bulkAction === "ignore"}
              disabled={bulkAction !== null}
            >
              Ignore Selected ({selectedIds.size})
            </Button>
            <Button
              variant="primary"
              className="w-auto text-xs"
              onClick={() => setShowBulkConfirmDialog(true)}
              loading={bulkAction === "approve"}
              disabled={bulkAction !== null}
            >
              Approve &amp; Flag Selected ({selectedIds.size})
            </Button>
          </div>
        </div>
      )}

      {loadFailed ? (
        <ErrorState
          title="Failed to load review queue"
          description="We couldn't load pending findings. Please try again."
          action={
            <Button variant="secondary" className="w-auto" onClick={handleRetry} loading={refetching}>
              Retry
            </Button>
          }
        />
      ) : isEmpty ? (
        <div className="w-full rounded-small border border-border-muted">
          <EmptyState
            title="Nothing to review"
            description="All findings have been reviewed. New findings will appear here for approval."
          />
        </div>
      ) : (
        <>
          <div className={`flex w-full flex-col gap-3 ${refetching ? "opacity-60" : ""}`}>
            {findings.map((finding) => {
              const isThisApproving = pendingActionId === finding.id && pendingAction === "approve";
              const isThisIgnoring = pendingActionId === finding.id && pendingAction === "ignore";
              const anyActionOnThisRow = pendingActionId === finding.id;
              const isSelected = selectedIds.has(finding.id);

              return (
                <div
                  key={finding.id}
                  className={`w-full rounded-small border p-4 transition-colors ${
                    isSelected ? "border-accent-emphasis/60 bg-accent-subtle/10" : "border-border-default"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelection(finding.id)}
                      aria-label={`Select finding in ${finding.repoFullName}`}
                      className="mt-1 h-4 w-4 rounded border-border-default text-accent-emphasis focus:ring-accent-emphasis"
                    />
                    <div className="flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <span className="text-base font-semibold text-accent-fg hover:underline">
                          <a href={`https://github.com/${finding.repoFullName}`} target="_blank" rel="noreferrer">
                            {finding.repoFullName}
                          </a>
                        </span>
                        <div className="flex gap-2">
                          <FindingSeverityBadge severity={finding.severity} />
                          <FindingStatusBadge status="PENDING" />
                        </div>
                      </div>
                      <p className="mt-3 font-mono text-[13px] text-fg-default">{finding.filePath}</p>
                      <p className="mt-2 text-sm text-fg-default">{finding.matchedRule}</p>
                      <p className="mt-2 text-xs text-fg-muted">Detected {formatRelativeTime(new Date(finding.createdAt))}</p>

                      <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
                        <Button
                          variant="secondary"
                          className="w-full sm:w-auto"
                          onClick={() => handleIgnoreClick(finding.id)}
                          loading={isThisIgnoring}
                          disabled={anyActionOnThisRow && !isThisIgnoring}
                        >
                          Ignore
                        </Button>
                        <Button
                          ref={(el) => {
                            approveTriggerRefs.current[finding.id] = el;
                          }}
                          variant="primary"
                          className="w-full sm:w-auto"
                          onClick={() => handleApproveClick(finding.id)}
                          disabled={anyActionOnThisRow && !isThisApproving}
                        >
                          Approve &amp; Flag
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {totalPages > 1 && (
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} disabled={refetching} />
          )}
        </>
      )}

      <ConfirmApproveDialog
        open={confirmTargetId !== null}
        approving={pendingAction === "approve" && pendingActionId === confirmTargetId}
        onCancel={handleCancelApprove}
        onConfirm={handleConfirmApprove}
      />

      <ConfirmApproveDialog
        open={showBulkConfirmDialog}
        count={selectedIds.size}
        approving={bulkAction === "approve"}
        onCancel={() => setShowBulkConfirmDialog(false)}
        onConfirm={() => performBulkAction("approve")}
      />
    </div>
  );
}
