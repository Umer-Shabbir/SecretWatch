"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RepositoryFilterType } from "@prisma/client";

export function CreateFilterDialog({
  open,
  onOpenChange,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}) {
  const [type, setType] = useState<RepositoryFilterType>("BLOCK");
  const [pattern, setPattern] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pattern.trim()) return;

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/repository-filters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          pattern: pattern.trim(),
          enabled,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to create filter rule");
      }

      onSuccess();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-lg bg-canvas-default p-6 shadow-xl border border-border-default">
        <h3 className="text-lg font-medium text-fg-default mb-4">Add Repository Filter Rule</h3>

        {error && (
          <div className="mb-4 rounded-md bg-danger-subtle p-3 text-sm text-danger-fg">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-fg-default">Filter Type</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm text-fg-default cursor-pointer">
                <input
                  type="radio"
                  name="type"
                  value="BLOCK"
                  checked={type === "BLOCK"}
                  onChange={() => setType("BLOCK")}
                  className="accent-accent-fg"
                />
                <span>Blocklist (Exclude matching repos)</span>
              </label>
              <label className="flex items-center gap-2 text-sm text-fg-default cursor-pointer">
                <input
                  type="radio"
                  name="type"
                  value="ALLOW"
                  checked={type === "ALLOW"}
                  onChange={() => setType("ALLOW")}
                  className="accent-accent-fg"
                />
                <span>Allowlist (Only scan matching repos)</span>
              </label>
            </div>
          </div>

          <div>
            <Input
              id="pattern"
              label="Repository Pattern"
              value={pattern}
              onChange={(e) => setPattern(e.target.value)}
              placeholder="e.g. org-name/*, owner/repo-name, *-internal, *sandbox*"
              required
              className="font-mono text-sm"
            />
            <p className="mt-1 text-xs text-fg-muted">
              Supports exact repos (<code className="text-accent-fg font-mono">owner/repo</code>),
              org wildcards (<code className="text-accent-fg font-mono">owner/*</code>),
              and wildcards (<code className="text-accent-fg font-mono">*-test</code>, <code className="text-accent-fg font-mono">*internal*</code>).
            </p>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="enabled"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="rounded border-border-default text-accent-fg focus:ring-accent-fg"
            />
            <label htmlFor="enabled" className="text-sm font-medium text-fg-default cursor-pointer">
              Enable rule immediately
            </label>
          </div>

          <div className="mt-4 flex justify-end gap-3 border-t border-border-default pt-4">
            <Button
              type="button"
              variant="secondary"
              disabled={submitting}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={submitting}>
              {submitting ? "Saving..." : "Create Rule"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
