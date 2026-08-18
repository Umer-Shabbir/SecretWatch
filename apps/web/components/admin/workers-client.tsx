"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import type { WorkerMonitoringSnapshot, WorkerHealth, RecentJob } from "@/lib/workers";

/**
 * Client orchestrator for Admin / Workers (M10). Figma nodes:
 *   - 51:277 Default
 *   - 51:278 Loading (route-level loading.tsx handles the *initial* load;
 *     `refetching` here covers the manual Retry after a failed fetch and
 *     the background auto-refresh poll)
 *   - 51:279 Error
 *   - 51:280 Degraded (one worker unhealthy, amber warning Alert banner +
 *     amber card border on the affected worker)
 *   - 51:281 Mobile (responsive CSS on this same component, condensed
 *     per-worker summary line, Recent Jobs table omitted — see
 *     state/modules/M10.json figma.scopeNotes)
 *
 * Polls GET /api/workers every 15s so operators see near-live health
 * without a manual refresh, mirroring the "operational monitoring" intent
 * of this module (ARCHITECTURE.md §5/§6) — polling stops on unmount and is
 * paused while a request is already in flight.
 */

const STATUS_DOT: Record<WorkerHealth["status"], string> = {
  healthy: "bg-success-emphasis",
  degraded: "bg-warning-emphasis",
};

const STATUS_TEXT: Record<WorkerHealth["status"], string> = {
  healthy: "text-success-fg",
  degraded: "text-warning-fg",
};

const STATUS_LABEL: Record<WorkerHealth["status"], string> = {
  healthy: "Healthy",
  degraded: "Degraded",
};

const JOB_STATUS_DOT: Record<RecentJob["status"], string> = {
  completed: "bg-success-emphasis",
  failed: "bg-danger-emphasis",
  active: "bg-warning-emphasis",
  waiting: "bg-fg-subtle",
};

const JOB_STATUS_TEXT: Record<RecentJob["status"], string> = {
  completed: "text-success-fg",
  failed: "text-danger-fg",
  active: "text-warning-fg",
  waiting: "text-fg-muted",
};

const JOB_STATUS_LABEL: Record<RecentJob["status"], string> = {
  completed: "Completed",
  failed: "Failed",
  active: "Processing",
  waiting: "Waiting",
};

const POLL_INTERVAL_MS = 15_000;

function formatRelative(iso: string | null, now: number): string {
  if (!iso) return "—";
  const diffMs = now - new Date(iso).getTime();
  const diffSec = Math.max(0, Math.floor(diffMs / 1000));
  if (diffSec < 60) return `${diffSec} second${diffSec === 1 ? "" : "s"} ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} minute${diffMin === 1 ? "" : "s"} ago`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} hour${diffHour === 1 ? "" : "s"} ago`;
  const diffDay = Math.floor(diffHour / 24);
  return `${diffDay} day${diffDay === 1 ? "" : "s"} ago`;
}

function formatDuration(ms: number | null): string {
  if (ms == null) return "—";
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatSuccessRate(rate: number | null): string {
  if (rate == null) return "—";
  return `${rate}%`;
}

export function WorkersClient({
  initialSnapshot,
  initialLoadFailed,
}: {
  initialSnapshot: WorkerMonitoringSnapshot | null;
  initialLoadFailed: boolean;
}) {
  const [snapshot, setSnapshot] = useState<WorkerMonitoringSnapshot | null>(initialSnapshot);
  const [loadFailed, setLoadFailed] = useState(initialLoadFailed);
  const [refetching, setRefetching] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const requestId = useRef(0);
  const inFlight = useRef(false);

  const fetchSnapshot = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    const thisRequest = ++requestId.current;
    setRefetching(true);
    try {
      const res = await fetch("/api/workers", { cache: "no-store" });
      if (thisRequest !== requestId.current) return;

      if (!res.ok) {
        setLoadFailed(true);
        return;
      }
      const body = (await res.json()) as WorkerMonitoringSnapshot;
      setSnapshot(body);
      setLoadFailed(false);
      setNow(Date.now());
    } catch {
      if (thisRequest !== requestId.current) return;
      setLoadFailed(true);
    } finally {
      inFlight.current = false;
      if (thisRequest === requestId.current) setRefetching(false);
    }
  }, []);

  function handleRetry() {
    fetchSnapshot();
  }

  useEffect(() => {
    const interval = setInterval(() => {
      fetchSnapshot();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchSnapshot]);

  const workers = snapshot?.workers ?? [];
  const recentJobs = snapshot?.recentJobs ?? [];
  const degradedWorkers = workers.filter((w) => w.status === "degraded");

  return (
    <div className="flex w-full flex-col gap-6 p-4 sm:p-8">
      <div>
        <h1 className="text-2xl font-semibold leading-8 text-fg-default">Workers</h1>
        <p className="mt-1 text-sm text-fg-muted">Scanner, flagger, and scheduler health</p>
      </div>

      {loadFailed ? (
        <ErrorState
          title="Unable to reach worker status"
          description="We couldn't load worker health data. Please try again."
          action={
            <Button variant="secondary" className="w-auto" onClick={handleRetry} loading={refetching}>
              Retry
            </Button>
          }
        />
      ) : (
        <div className={`flex w-full flex-col gap-6 ${refetching ? "opacity-60" : ""}`}>
          {degradedWorkers.length > 0 && (
            <Alert variant="warning">
              {degradedWorkers.map((w) => `${w.name} Worker is degraded.`).join(" ")}
            </Alert>
          )}

          <div className="flex w-full flex-col gap-4 sm:flex-row sm:items-start">
            {workers.map((worker) => (
              <div
                key={worker.key}
                className={`flex w-full flex-col gap-3 rounded-small border p-5 sm:w-[360px] ${
                  worker.status === "degraded"
                    ? "border-[1.5px] border-warning-emphasis"
                    : "border-border-default"
                }`}
              >
                <p className="text-base font-semibold text-fg-default">{worker.name} Worker</p>
                <div className="flex items-center gap-1.5">
                  <span className={`size-2 shrink-0 rounded-full ${STATUS_DOT[worker.status]}`} />
                  <span className={`text-sm font-medium ${STATUS_TEXT[worker.status]}`}>
                    {STATUS_LABEL[worker.status]}
                  </span>
                </div>

                <div className="flex items-center justify-between text-[13px]">
                  <span className="text-fg-muted">Concurrency</span>
                  <span className="font-mono text-fg-default">{worker.concurrency}</span>
                </div>
                <div className="flex items-center justify-between text-[13px]">
                  <span className="text-fg-muted">Queue</span>
                  <span className="font-mono text-fg-default">{worker.queueCount} pending</span>
                </div>
                <div className="flex items-center justify-between text-[13px] sm:flex hidden">
                  <span className="text-fg-muted">Last job</span>
                  <span className="font-mono text-fg-default">{formatRelative(worker.lastJobAt, now)}</span>
                </div>
                <div className="flex items-center justify-between text-[13px]">
                  <span className="text-fg-muted">Success rate</span>
                  <span className="font-mono text-fg-default">{formatSuccessRate(worker.successRate)}</span>
                </div>

                {/* Condensed mobile summary line — Figma 51:281 replaces the
                    full metric list with one queue/success-rate line. */}
                <p className="text-xs text-fg-muted sm:hidden">
                  Queue: {worker.queueCount} pending · Success: {formatSuccessRate(worker.successRate)}
                </p>
              </div>
            ))}
          </div>

          {/* Recent Jobs table — desktop only. Deliberately omitted on mobile
              per Figma scopeNotes (condensed card summary line takes its
              place there instead of a horizontally-scrolling table). */}
          <div className="hidden sm:block">
            <h2 className="mb-3 text-xl font-semibold text-fg-default">Recent Jobs</h2>
            {recentJobs.length === 0 ? (
              <p className="rounded-small border border-border-default px-4 py-6 text-center text-sm text-fg-muted">
                No jobs have run yet.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-small border border-border-default">
                <table className="w-full min-w-[720px] border-collapse text-left text-[13px]">
                  <thead>
                    <tr className="bg-canvas-subtle text-xs font-medium text-fg-muted">
                      <th className="px-4 py-2 font-medium">Job ID</th>
                      <th className="px-4 py-2 font-medium">Worker</th>
                      <th className="px-4 py-2 font-medium">Status</th>
                      <th className="px-4 py-2 font-medium">Duration</th>
                      <th className="px-4 py-2 font-medium">Finished</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentJobs.map((job) => (
                      <tr key={job.id} className="border-t border-border-muted">
                        <td className="px-4 py-2 font-mono text-fg-default">{job.id}</td>
                        <td className="px-4 py-2 capitalize text-fg-default">{job.worker}</td>
                        <td className="px-4 py-2">
                          <span className="inline-flex items-center gap-1.5">
                            <span className={`size-1.5 shrink-0 rounded-full ${JOB_STATUS_DOT[job.status]}`} />
                            <span className={`font-medium ${JOB_STATUS_TEXT[job.status]}`}>
                              {JOB_STATUS_LABEL[job.status]}
                            </span>
                          </span>
                        </td>
                        <td className="px-4 py-2 font-mono text-fg-muted">{formatDuration(job.durationMs)}</td>
                        <td className="px-4 py-2 text-fg-muted">{formatRelative(job.finishedAt, now)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
