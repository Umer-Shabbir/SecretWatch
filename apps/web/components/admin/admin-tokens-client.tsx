"use client";

import { useCallback, useRef, useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";
import { StatCard } from "@/components/ui/stat-card";
import { formatShortDate } from "@/lib/format-date";
import { formatRelativeTime } from "@/lib/format-relative-time";
import type { AdminTokenSummary } from "@/lib/admin-tokens";

/**
 * Client orchestrator for Admin / Tokens.
 *
 * Includes Token Health Dashboard, metrics, filtering, and insights.
 */
export function AdminTokensClient({
  initialTokens,
  initialLoadFailed,
}: {
  initialTokens: AdminTokenSummary[] | null;
  initialLoadFailed: boolean;
}) {
  const [tokens, setTokens] = useState<AdminTokenSummary[] | null>(initialTokens);
  const [loadFailed, setLoadFailed] = useState(initialLoadFailed);
  const [refetching, setRefetching] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [newToken, setNewToken] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [addSuccess, setAddSuccess] = useState<string | null>(null);

  const [filterTab, setFilterTab] = useState<"ALL" | "ACTIVE" | "RATE_LIMITED" | "INACTIVE">("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  const requestId = useRef(0);

  const fetchTokens = useCallback(async () => {
    const thisRequest = ++requestId.current;
    setRefetching(true);
    try {
      const res = await fetch("/api/tokens", { cache: "no-store" });
      if (thisRequest !== requestId.current) return;

      if (!res.ok) {
        setLoadFailed(true);
        return;
      }
      const body = (await res.json()) as { tokens: AdminTokenSummary[] };
      setTokens(body.tokens);
      setLoadFailed(false);
    } catch {
      if (thisRequest !== requestId.current) return;
      setLoadFailed(true);
    } finally {
      if (thisRequest === requestId.current) setRefetching(false);
    }
  }, []);

  function handleRetry() {
    fetchTokens();
  }

  async function handleAddToken(e: React.FormEvent) {
    e.preventDefault();
    const value = newToken.trim();
    if (!value) return;

    setAdding(true);
    setAddError(null);
    setAddSuccess(null);
    try {
      const res = await fetch("/api/tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: value }),
      });
      const body = await res.json();
      if (!res.ok) {
        const issues = Array.isArray(body?.issues) ? body.issues.join(" ") : null;
        setAddError(issues ?? "Could not add this token. Check the format and try again.");
        return;
      }
      setNewToken("");
      setAddSuccess(`Token added (${body?.token?.maskedIdentifier ?? "masked"}).`);
      await fetchTokens();
    } catch {
      setAddError("Could not add this token. Please try again.");
    } finally {
      setAdding(false);
    }
  }

  async function handleDeactivate(id: string) {
    setPendingId(id);
    setActionError(null);
    try {
      const res = await fetch(`/api/tokens/${id}`, { method: "PATCH" });
      const body = await res.json();
      if (!res.ok) {
        setActionError(body?.error ?? "Could not deactivate this token. Please try again.");
        return;
      }
      const updated: AdminTokenSummary = body.token;
      setTokens((prev) => (prev ? prev.map((t) => (t.id === updated.id ? updated : t)) : prev));
    } catch {
      setActionError("Could not deactivate this token. Please try again.");
    } finally {
      setPendingId(null);
    }
  }

  const tokenList = useMemo(() => tokens ?? [], [tokens]);

  // Aggregate Health Metrics
  const summaryCounters = useMemo(() => {
    let total = 0;
    let active = 0;
    let rateLimited = 0;
    let inactive = 0;

    for (const t of tokenList) {
      total++;
      if (t.active) active++;
      else inactive++;

      // Based on percentage (Github tokens usually have a max of 5000)
      // < 20% means < 1000
      if (t.active && t.rateLimitRemaining !== null && t.rateLimitRemaining < 1000) {
        rateLimited++;
      }
    }

    return { total, active, rateLimited, inactive };
  }, [tokenList]);

  // Derived Filtered List
  const filteredList = useMemo(() => {
    return tokenList.filter((t) => {
      // 1. Tab Filter
      if (filterTab === "ACTIVE" && !t.active) return false;
      if (filterTab === "INACTIVE" && t.active) return false;
      if (filterTab === "RATE_LIMITED" && (!t.active || t.rateLimitRemaining === null || t.rateLimitRemaining >= 1000)) return false;

      // 2. Search Code filter
      if (searchQuery.trim().length > 0) {
        const q = searchQuery.toLowerCase();
        if (!t.maskedIdentifier?.toLowerCase().includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [tokenList, filterTab, searchQuery]);

  const isEmpty = !loadFailed && tokens !== null && summaryCounters.total === 0;
  const noMatches = !isEmpty && filteredList.length === 0;

  return (
    <div className="flex w-full flex-col gap-6 p-4 sm:p-8">
      <div>
        <h1 className="text-2xl font-semibold leading-8 text-fg-default">GitHub Tokens / Pool Health</h1>
        {!loadFailed && tokens !== null && (
          <p className="mt-1 text-sm text-fg-muted">
            Global token pool providing quota for background search and issue-flagging.
          </p>
        )}
      </div>

      {!loadFailed && tokens !== null && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          <StatCard
            label="Total Tokens"
            value={summaryCounters.total}
            helpText="All tokens added to the pool."
            indicatorClassName="bg-fg-muted"
          />
          <StatCard
            label="Active / Healthy"
            value={summaryCounters.active - summaryCounters.rateLimited}
            helpText="Currently providing rate limit."
            indicatorClassName="bg-success-emphasis"
          />
          <StatCard
            label="Rate Limited (<20%)"
            value={summaryCounters.rateLimited}
            valueClassName={summaryCounters.rateLimited > 0 ? "text-warning-emphasis" : "text-fg-default"}
            helpText="Tokens close to exhaustion."
            indicatorClassName="bg-warning-emphasis"
          />
          <StatCard
            label="Needs Rotation"
            value={summaryCounters.inactive}
            valueClassName={summaryCounters.inactive > 0 ? "text-danger-emphasis" : "text-fg-default"}
            helpText="Stopped working or deactivated."
            indicatorClassName="bg-danger-emphasis"
          />
        </div>
      )}

      <form
        onSubmit={handleAddToken}
        className="flex w-full flex-col gap-2 rounded-small border border-border-default p-4 sm:p-5"
      >
        <label htmlFor="add-token" className="text-sm font-medium text-fg-default">
          Add a proxy token (PAT)
        </label>
        <p className="text-xs text-fg-muted">
          Paste a GitHub personal access token to expand pool limits. It is encrypted at rest securely.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            id="add-token"
            type="password"
            autoComplete="off"
            spellCheck={false}
            value={newToken}
            onChange={(e) => setNewToken(e.target.value)}
            placeholder="ghp_…"
            className="h-9 flex-1 rounded-small border border-border-default bg-canvas-default px-3 font-mono text-sm text-fg-default placeholder:text-fg-subtle focus:border-accent-emphasis focus:outline-none"
          />
          <Button type="submit" className="w-auto" loading={adding} disabled={adding || newToken.trim() === ""}>
            Add token
          </Button>
        </div>
        {addError && (
          <p role="alert" className="text-sm text-danger-fg">
            {addError}
          </p>
        )}
        {addSuccess && (
          <p className="text-sm text-success-fg">{addSuccess}</p>
        )}
      </form>

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
            title="No tokens submitted yet"
            description="Add a token above to start scanning repositories."
          />
        </div>
      ) : (
        <div className="flex w-full flex-col gap-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border-default pb-4">
            <div className="flex flex-wrap items-center gap-2">
              <FilterTab label="All" count={summaryCounters.total} active={filterTab === "ALL"} onClick={() => setFilterTab("ALL")} />
              <FilterTab label="Active" count={summaryCounters.active} active={filterTab === "ACTIVE"} onClick={() => setFilterTab("ACTIVE")} />
              <FilterTab label="Low Limit" count={summaryCounters.rateLimited} active={filterTab === "RATE_LIMITED"} onClick={() => setFilterTab("RATE_LIMITED")} />
              <FilterTab label="Needs Rotation" count={summaryCounters.inactive} active={filterTab === "INACTIVE"} onClick={() => setFilterTab("INACTIVE")} />
            </div>

            <div className="relative">
              <svg
                className="absolute left-2.5 top-2.5 h-4 w-4 text-fg-muted"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
              <input
                type="text"
                placeholder="Search masked text..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 w-64 rounded-small border border-border-default bg-canvas-default pl-9 pr-3 text-sm text-fg-default placeholder:text-fg-subtle focus:border-accent-emphasis focus:outline-none"
              />
            </div>
          </div>

          <div className={`flex w-full flex-col gap-4 ${refetching ? "opacity-60" : ""}`}>
            {noMatches ? (
              <div className="py-8 text-center text-sm text-fg-muted">
                No tokens match your selected filters.
              </div>
            ) : (
              filteredList.map((token) => {
                const isPending = pendingId === token.id;
                const isRateLimited = token.active && token.rateLimitRemaining !== null && token.rateLimitRemaining < 1000;

                return (
                  <div
                    key={token.id}
                    className="flex w-full flex-col gap-2 rounded-small border border-border-default p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:p-5"
                  >
                    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <span className="font-mono text-sm text-fg-default">
                          {token.maskedIdentifier ?? "(no masked value on record)"}
                        </span>

                        {token.active ? (
                           <Badge status="success">ACTIVE</Badge>
                        ) : (
                           <Badge status="default">INACTIVE / FAILED</Badge>
                        )}
                        <Badge status="accent">{token.source.toUpperCase()}</Badge>

                        {isRateLimited && (
                          <Badge status="warning">LOW RATE LIMIT</Badge>
                        )}
                      </div>
                      <p className="text-xs text-fg-subtle">
                        Submitted {formatShortDate(new Date(token.createdAt))}
                        {token.lastUsedAt && ` · last used ${formatRelativeTime(new Date(token.lastUsedAt))}`}
                        {token.rateLimitRemaining !== null && ` · ${token.rateLimitRemaining} requests remaining`}
                      </p>
                      {token.scopes.length > 0 && (
                        <p className="text-xs text-fg-subtle">Scopes: {token.scopes.join(", ")}</p>
                      )}
                    </div>

                    <div className="flex items-start gap-2">
                       <Button
                        variant="secondary"
                        className="w-auto"
                        onClick={() => handleDeactivate(token.id)}
                        loading={isPending}
                        disabled={!token.active || (pendingId !== null && !isPending)}
                      >
                        {token.active ? "Deactivate" : "Deactivated"}
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function FilterTab({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-small px-3 py-1.5 text-sm font-medium transition-colors ${
        active
          ? "bg-canvas-subtle text-fg-default"
          : "text-fg-muted hover:bg-canvas-subtle hover:text-fg-default"
      }`}
    >
      {label} <span className={`ml-1 rounded px-1.5 py-0.5 text-xs ${active ? "bg-border-default" : "bg-canvas-subtle"}`}>{count}</span>
    </button>
  );
}
