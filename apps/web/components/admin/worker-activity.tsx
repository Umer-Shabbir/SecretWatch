"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { LiveActivity, ScannerFind, FlaggerFlag, FlaggerFailure, QueueDepth } from "@/lib/activity";

/**
 * WorkerActivity (2026-08-24 admin-control addition). The live half of the
 * admin Overview: two panels showing what the Scanner and Flagger are doing
 * right now — live queue depth plus a feed of the most recent findings the
 * scanner wrote and the most recent flags/failures the flagger produced.
 *
 * Polls GET /api/admin/activity every 8s (paused while a request is already
 * in flight; stops on unmount), mirroring the Workers page's polling pattern.
 * A transient fetch failure keeps the last-known feed on screen and shows a
 * small stale marker rather than blanking the panels.
 */

const POLL_INTERVAL_MS = 8_000;

const FINDING_STATUS_TEXT: Record<string, string> = {
  PENDING: "text-warning-fg",
  APPROVED: "text-accent-fg",
  FLAGGED: "text-success-fg",
  IGNORED: "text-fg-muted",
  FAILED: "text-danger-fg",
};

function formatRelative(iso: string, now: number): string {
  const diffSec = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 1000));
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h ago`;
  return `${Math.floor(diffHour / 24)}d ago`;
}

function QueueBadge({ queue }: { queue: QueueDepth | null }) {
  if (queue === null) {
    return <span className="text-xs text-fg-muted">Queue unavailable</span>;
  }
  const busy = queue.active > 0;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs">
      <span
        className={`size-2 shrink-0 rounded-full ${busy ? "animate-pulse bg-success-emphasis" : "bg-fg-subtle"}`}
        aria-hidden="true"
      />
      <span className={busy ? "font-medium text-success-fg" : "text-fg-muted"}>
        {queue.active} active · {queue.waiting} queued
      </span>
    </span>
  );
}

export function WorkerActivity({ initial }: { initial: LiveActivity }) {
  const [activity, setActivity] = useState<LiveActivity>(initial);
  const [stale, setStale] = useState(false);
  // Seed `now` from generatedAt so the first server render and the first
  // client render produce identical relative-time text (both "0s ago"),
  // avoiding a hydration mismatch. The real clock is applied after mount.
  const [now, setNow] = useState(() => new Date(initial.generatedAt).getTime());

  const inFlight = useRef(false);

  const fetchActivity = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const res = await fetch("/api/admin/activity", { cache: "no-store" });
      if (!res.ok) {
        setStale(true);
        return;
      }
      setActivity((await res.json()) as LiveActivity);
      setStale(false);
      setNow(Date.now());
    } catch {
      setStale(true);
    } finally {
      inFlight.current = false;
    }
  }, []);

  useEffect(() => {
    // Apply the real client clock after mount (post-hydration), then keep
    // the relative-time labels ticking without waiting on the 8s poll.
    setNow(Date.now());
    const tick = setInterval(() => setNow(Date.now()), 1_000);
    const interval = setInterval(fetchActivity, POLL_INTERVAL_MS);
    return () => {
      clearInterval(tick);
      clearInterval(interval);
    };
  }, [fetchActivity]);

  const { scanner, flagger } = activity;

  return (
    <section className="flex w-full flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-fg-default">Live worker activity</h2>
        <span className="text-xs text-fg-muted">
          {stale ? "Reconnecting…" : `Updated ${formatRelative(activity.generatedAt, now)}`}
        </span>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row">
        <ScannerPanel scanner={scanner} now={now} />
        <FlaggerPanel flagger={flagger} now={now} />
      </div>
    </section>
  );
}

function Panel({
  title,
  subtitle,
  badge,
  children,
}: {
  title: string;
  subtitle: string;
  badge: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col gap-3 rounded-small border border-border-default p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-base font-semibold text-fg-default">{title}</p>
          <p className="text-xs text-fg-muted">{subtitle}</p>
        </div>
        {badge}
      </div>
      {children}
    </div>
  );
}

function EmptyFeed({ label }: { label: string }) {
  return (
    <p className="rounded-small border border-border-muted px-3 py-4 text-center text-xs text-fg-muted">
      {label}
    </p>
  );
}

function ScannerPanel({ scanner, now }: { scanner: LiveActivity["scanner"]; now: number }) {
  return (
    <Panel
      title="Scanner"
      subtitle={`${scanner.totalFound} finding${scanner.totalFound === 1 ? "" : "s"} recorded`}
      badge={<QueueBadge queue={scanner.queue} />}
    >
      {scanner.recent.length === 0 ? (
        <EmptyFeed label="No findings yet." />
      ) : (
        <ul className="flex flex-col divide-y divide-border-muted">
          {scanner.recent.map((find) => (
            <ScannerRow key={find.id} find={find} now={now} />
          ))}
        </ul>
      )}
    </Panel>
  );
}

function ScannerRow({ find, now }: { find: ScannerFind; now: number }) {
  return (
    <li className="flex items-start justify-between gap-3 py-2">
      <div className="min-w-0">
        <p className="truncate font-mono text-[13px] text-fg-default">{find.repoFullName}</p>
        <p className="truncate text-xs text-fg-muted">{find.filePath}</p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-0.5">
        <span className={`text-xs font-medium ${FINDING_STATUS_TEXT[find.status] ?? "text-fg-muted"}`}>
          {find.matchedRule}
        </span>
        <span className="text-[11px] text-fg-subtle">{formatRelative(find.createdAt, now)}</span>
      </div>
    </li>
  );
}

function FlaggerPanel({ flagger, now }: { flagger: LiveActivity["flagger"]; now: number }) {
  return (
    <Panel
      title="Flagger"
      subtitle={`${flagger.totalFlagged} issue${flagger.totalFlagged === 1 ? "" : "s"} opened · ${flagger.totalFailed} failed`}
      badge={<QueueBadge queue={flagger.queue} />}
    >
      {flagger.recent.length === 0 ? (
        <EmptyFeed label="No issues opened yet." />
      ) : (
        <ul className="flex flex-col divide-y divide-border-muted">
          {flagger.recent.map((fl) => (
            <FlaggerRow key={fl.id} flag={fl} now={now} />
          ))}
        </ul>
      )}

      {flagger.recentFailures.length > 0 && (
        <div className="flex flex-col gap-1.5 rounded-small border border-danger-emphasis bg-danger-subtle p-3">
          <p className="text-xs font-medium text-danger-fg">Recent failures</p>
          {flagger.recentFailures.map((f) => (
            <FailureRow key={f.id} failure={f} />
          ))}
        </div>
      )}
    </Panel>
  );
}

function FlaggerRow({ flag, now }: { flag: FlaggerFlag; now: number }) {
  return (
    <li className="flex items-start justify-between gap-3 py-2">
      <div className="min-w-0">
        <p className="truncate font-mono text-[13px] text-fg-default">{flag.repoFullName}</p>
        <a
          href={flag.issueUrl}
          target="_blank"
          rel="noreferrer noopener"
          className="truncate text-xs text-accent-fg hover:underline"
        >
          {flag.issueUrl}
        </a>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-0.5">
        <span className="text-xs font-medium text-success-fg">{flag.matchedRule}</span>
        <span className="text-[11px] text-fg-subtle">{formatRelative(flag.postedAt, now)}</span>
      </div>
    </li>
  );
}

function FailureRow({ failure }: { failure: FlaggerFailure }) {
  return (
    <div className="flex items-start justify-between gap-3 text-[11px]">
      <span className="truncate font-mono text-fg-muted">{failure.repoFullName}</span>
      <span className="shrink-0 text-danger-fg">{failure.failureReason ?? "Unknown error"}</span>
    </div>
  );
}
