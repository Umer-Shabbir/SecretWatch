"use client";

import { useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";
import { formatShortDate } from "@/lib/format-date";
import { formatRelativeTime } from "@/lib/format-relative-time";
import type { AdminTokenSummary } from "@/lib/admin-tokens";

/**
 * Client orchestrator for Admin / Tokens. Follows the same shape as
 * components/admin/rules-client.tsx (RulesClient): initial data from the
 * Server Component, Client Component owns refetch-on-retry and the
 * deactivate action. No confirmation dialog — unlike Scan Rules' Disable
 * (which stops a rule from running future scans), deactivating a token here
 * only stops it from being selected for future scans/flags; it is a lower-
 * stakes, reversible-in-effect action (a new token can always be
 * resubmitted), so a single-click action with inline pending state was
 * judged sufficient. Revisit if a future Figma pass specifies otherwise.
 *
 * SECURITY: never renders GithubToken.encrypted (not even present in
 * AdminTokenSummary — see lib/admin-tokens.ts). Only maskedIdentifier is
 * shown.
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

  /**
   * Admin manual token add (2026-08-24). POSTs the raw token to /api/tokens,
   * which encrypts+masks it server-side. The raw value is cleared from state
   * immediately on success and never logged/echoed. On success we refetch the
   * list so the new row (with server-computed masked value + source=manual)
   * shows without guessing its shape client-side.
   */
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

  const tokenList = tokens ?? [];
  const total = tokenList.length;
  const activeCount = tokenList.filter((t) => t.active).length;
  const isEmpty = !loadFailed && tokens !== null && total === 0;

  return (
    <div className="flex w-full flex-col gap-6 p-4 sm:p-8">
      <div>
        <h1 className="text-2xl font-semibold leading-8 text-fg-default">Tokens</h1>
        {!loadFailed && tokens !== null && (
          <p className="mt-1 text-sm text-fg-muted">
            {total} token{total === 1 ? "" : "s"} submitted · {activeCount} active
          </p>
        )}
      </div>

      <form
        onSubmit={handleAddToken}
        className="flex w-full flex-col gap-2 rounded-small border border-border-default p-4 sm:p-5"
      >
        <label htmlFor="add-token" className="text-sm font-medium text-fg-default">
          Add a token manually
        </label>
        <p className="text-xs text-fg-muted">
          Paste a GitHub personal access token. It is encrypted at rest and only its masked
          identifier is ever displayed.
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
            description="Tokens submitted through the public form will appear here."
          />
        </div>
      ) : (
        <div className={`flex w-full flex-col gap-4 ${refetching ? "opacity-60" : ""}`}>
          {tokenList.map((token) => {
            const isPending = pendingId === token.id;
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
                    <Badge status={token.active ? "success" : "default"}>
                      {token.active ? "ACTIVE" : "INACTIVE"}
                    </Badge>
                    <Badge status="accent">{token.source.toUpperCase()}</Badge>
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
          })}
        </div>
      )}
    </div>
  );
}
