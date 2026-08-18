"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { FindingStatusBadge } from "@/components/ui/finding-status-badge";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { ConfirmApproveDialog } from "@/components/findings/confirm-approve-dialog";
import { formatRelativeTime } from "@/lib/format-relative-time";
import type { FindingSummary, FindingsListResult } from "@/lib/findings";

const PAGE_SIZE = 20;

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
 * definition the set of findings awaiting a human decision. No severity
 * filter is implemented: the Finding data model (ARCHITECTURE.md) has no
 * severity column, so the Figma severity tabs (All/Critical/High/Medium/
 * Low) do not correspond to real, filterable data. Inventing a fake filter
 * over a field that doesn't exist would violate "no fake states not
 * supported by the product" (docs/figma/FIGMA_WORKFLOW.md) — flagged as a
 * known Figma/data gap in state/modules/M06.json rather than faked here.
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
  const [page, setPage] = useState(initialResult?.page ?? 1);
  const [result, setResult] = useState<FindingsListResult | null>(initialResult);
  const [loadFailed, setLoadFailed] = useState(initialLoadFailed);
  const [refetching, setRefetching] = useState(false);

  const [pendingActionId, setPendingActionId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<"approve" | "ignore" | null>(null);
  const [confirmTargetId, setConfirmTargetId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const approveTriggerRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const requestId = useRef(0);

  const fetchQueue = useCallback(async (nextPage: number) => {
    const thisRequest = ++requestId.current;
    setRefetching(true);
    try {
      const params = new URLSearchParams({
        status: "PENDING",
        page: String(nextPage),
        pageSize: String(PAGE_SIZE),
      });
      const res = await fetch(`/api/findings?${params.toString()}`, { cache: "no-store" });
      if (thisRequest !== requestId.current) return;

      if (!res.ok) {
        setLoadFailed(true);
        return;
      }
      const body = (await res.json()) as FindingsListResult;
      setResult(body);
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
    fetchQueue(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  function handleRetry() {
    fetchQueue(page);
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

              return (
                <div key={finding.id} className="w-full rounded-small border border-border-default p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <span className="text-base font-semibold text-accent-fg underline">{finding.repoFullName}</span>
                    <FindingStatusBadge status="PENDING" />
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
    </div>
  );
}
