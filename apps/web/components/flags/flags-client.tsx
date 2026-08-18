"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";
import { FlagStatusBadge } from "@/components/ui/flag-status-badge";
import { Pagination } from "@/components/ui/pagination";
import { Button } from "@/components/ui/button";
import { formatRelativeTime } from "@/lib/format-relative-time";
import type { FlagRow, FlagsListResult, FlagRowStatusValue } from "@/lib/flags";

const PAGE_SIZE = 20;

const FILTER_TABS: Array<{ label: string; value: FlagRowStatusValue | "ALL" }> = [
  { label: "All", value: "ALL" },
  { label: "Flagged", value: "FLAGGED" },
  { label: "Failed", value: "FAILED" },
];

/**
 * Client orchestrator for the Flags history list (M07). Wires GET
 * /api/flags to the Figma-derived states: default, loading (route-level
 * loading.tsx handles the *initial* load; `refetching` covers subsequent
 * filter/page loads), empty, filtered-empty, error, mobile.
 *
 * Figma node 47:1143 ("Dashboard / Flags / Default") — 8-column table
 * (Repository/File/Rule/Status/Issue-Detail/Template/Token/Posted). FAILED
 * rows leave Template/Token blank and show `failureReason` in the
 * Issue/Detail column instead of an issue link, per
 * state/modules/M07.json's Figma productDecisionNotes (no fabricated
 * Flag.status field — failure visibility comes from Finding.status=FAILED).
 *
 * Never requests, stores, or renders a decrypted token or raw secret value —
 * only the pre-masked `maskedTokenIdentifier` string from the API.
 */
export function FlagsClient({
  initialResult,
  initialLoadFailed,
}: {
  initialResult: FlagsListResult | null;
  initialLoadFailed: boolean;
}) {
  const [status, setStatus] = useState<FlagRowStatusValue | "ALL">("ALL");
  const [page, setPage] = useState(initialResult?.page ?? 1);
  const [result, setResult] = useState<FlagsListResult | null>(initialResult);
  const [loadFailed, setLoadFailed] = useState(initialLoadFailed);
  const [refetching, setRefetching] = useState(false);

  // Guards against an in-flight request's response landing after a newer
  // request has already started (e.g. rapid tab switching).
  const requestId = useRef(0);

  const fetchFlags = useCallback(async (nextStatus: FlagRowStatusValue | "ALL", nextPage: number) => {
    const thisRequest = ++requestId.current;
    setRefetching(true);
    try {
      const params = new URLSearchParams({ page: String(nextPage), pageSize: String(PAGE_SIZE) });
      if (nextStatus !== "ALL") params.set("status", nextStatus);

      const res = await fetch(`/api/flags?${params.toString()}`, { cache: "no-store" });
      if (thisRequest !== requestId.current) return;

      if (!res.ok) {
        setLoadFailed(true);
        return;
      }
      const body = (await res.json()) as FlagsListResult;
      setResult(body);
      setLoadFailed(false);
    } catch {
      if (thisRequest !== requestId.current) return;
      setLoadFailed(true);
    } finally {
      if (thisRequest === requestId.current) setRefetching(false);
    }
  }, []);

  // Skip the redundant fetch on first mount — the server already provided
  // page 1 / status ALL via `initialResult`.
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    fetchFlags(status, page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, page]);

  function handleFilterChange(next: FlagRowStatusValue | "ALL") {
    setStatus(next);
    setPage(1);
  }

  function handleRetry() {
    fetchFlags(status, page);
  }

  const flags: FlagRow[] = result?.flags ?? [];
  const totalPages = result?.totalPages ?? 1;
  const isTrulyEmpty = !loadFailed && status === "ALL" && result !== null && result.total === 0;
  const isFilteredEmpty = !loadFailed && status !== "ALL" && result !== null && result.total === 0;
  const summary = result?.summary;

  return (
    <div className="flex w-full flex-col gap-6 p-8">
      <div className="flex w-full flex-col gap-1">
        <h1 className="text-2xl font-semibold leading-8 text-fg-default">Flags</h1>
        {summary && (
          <p className="text-sm text-fg-muted">
            {summary.totalAttempts} flag attempts · {summary.successful} successful · {summary.failed} failed
          </p>
        )}
      </div>

      <div className="flex items-start gap-5 overflow-x-auto" role="tablist" aria-label="Filter flags by status">
        {FILTER_TABS.map((tab) => {
          const selected = tab.value === status;
          return (
            <button
              key={tab.value}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => handleFilterChange(tab.value)}
              className={`shrink-0 border-b-2 px-1 pb-2 text-sm transition-colors ${
                selected
                  ? "border-accent-emphasis font-semibold text-fg-default"
                  : "border-transparent text-fg-muted hover:text-fg-default"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {loadFailed ? (
        <ErrorState
          title="Failed to load flags"
          description="We couldn't load your flags history. Please try again."
          action={
            <Button variant="secondary" className="w-auto" onClick={handleRetry} loading={refetching}>
              Retry
            </Button>
          }
        />
      ) : isTrulyEmpty ? (
        <div className="w-full rounded-small border border-border-muted">
          <EmptyState
            title="No flags yet"
            description="Approved findings that are flagged (or fail to flag) will appear here."
          />
        </div>
      ) : isFilteredEmpty ? (
        <div className="w-full rounded-small border border-border-muted">
          <EmptyState
            title="No flags match this filter"
            description="Try a different status, or select All to see every flag attempt."
            action={
              <Button variant="secondary" className="w-auto" onClick={() => handleFilterChange("ALL")}>
                Clear filter
              </Button>
            }
          />
        </div>
      ) : (
        <>
          {/* Desktop table — hidden on mobile in favor of stacked cards (Figma node 47:1147). */}
          <div className={`hidden w-full overflow-x-auto rounded-small border border-border-default md:block ${refetching ? "opacity-60" : ""}`}>
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-canvas-subtle text-[11px] font-semibold tracking-wide text-fg-muted">
                  <th className="px-3 py-2 font-semibold">REPOSITORY</th>
                  <th className="px-3 py-2 font-semibold">FILE</th>
                  <th className="px-3 py-2 font-semibold">RULE</th>
                  <th className="px-3 py-2 font-semibold">STATUS</th>
                  <th className="px-3 py-2 font-semibold">ISSUE / DETAIL</th>
                  <th className="px-3 py-2 font-semibold">TEMPLATE</th>
                  <th className="px-3 py-2 font-semibold">TOKEN</th>
                  <th className="px-3 py-2 font-semibold">POSTED</th>
                </tr>
              </thead>
              <tbody>
                {flags.map((flag) => (
                  <tr key={flag.id} className="border-t border-border-muted">
                    <td className="px-3 py-2.5 text-accent-fg underline">{flag.repoFullName}</td>
                    <td className="px-3 py-2.5 font-mono text-xs text-fg-default">{flag.filePath}</td>
                    <td className="px-3 py-2.5 text-fg-default">{flag.matchedRule}</td>
                    <td className="px-3 py-2.5">
                      <FlagStatusBadge status={flag.status} />
                    </td>
                    <td className="px-3 py-2.5">
                      {flag.status === "FLAGGED" ? (
                        <a
                          href={flag.issueUrl ?? undefined}
                          target="_blank"
                          rel="noreferrer"
                          className="font-mono text-xs text-accent-fg underline"
                        >
                          {flag.issueRef}
                        </a>
                      ) : (
                        <span className="text-fg-muted">{flag.failureReason}</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-fg-default">{flag.templateName ?? "—"}</td>
                    <td className="px-3 py-2.5 font-mono text-xs text-fg-muted">{flag.maskedTokenIdentifier ?? "—"}</td>
                    <td className="px-3 py-2.5 text-fg-muted">{formatRelativeTime(new Date(flag.postedAt))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile stacked cards — Figma node 47:1147. */}
          <div className={`flex w-full flex-col gap-3 md:hidden ${refetching ? "opacity-60" : ""}`}>
            {flags.map((flag) => (
              <div key={flag.id} className="w-full rounded-small border border-border-default p-3.5">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm font-semibold text-accent-fg underline">{flag.repoFullName}</span>
                  <FlagStatusBadge status={flag.status} />
                </div>
                <p className="mt-3 font-mono text-[13px] text-fg-default">{flag.filePath}</p>
                <p className="mt-2 text-[13px] text-fg-default">{flag.matchedRule}</p>
                {flag.status === "FLAGGED" ? (
                  <>
                    <a
                      href={flag.issueUrl ?? undefined}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 block font-mono text-[13px] text-accent-fg underline"
                    >
                      {flag.issueRef}
                    </a>
                    <p className="mt-1 text-[13px] text-fg-default">{flag.templateName}</p>
                    <p className="mt-1 font-mono text-xs text-fg-muted">{flag.maskedTokenIdentifier}</p>
                  </>
                ) : (
                  <p className="mt-2 text-[13px] text-fg-muted">{flag.failureReason}</p>
                )}
                <span className="mt-3 block text-xs text-fg-muted">{formatRelativeTime(new Date(flag.postedAt))}</span>
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} disabled={refetching} />
          )}
        </>
      )}
    </div>
  );
}
