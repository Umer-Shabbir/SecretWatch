"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CreateFilterDialog } from "./create-filter-dialog";
import { EditFilterDialog } from "./edit-filter-dialog";
import { DeleteFilterDialog } from "./delete-filter-dialog";
import type { RepositoryFilterSummary } from "@/lib/repository-filters";

export function RepositoryFiltersClient({ initialFilters }: { initialFilters: RepositoryFilterSummary[] }) {
  const [filters, setFilters] = useState<RepositoryFilterSummary[]>(initialFilters);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editFilter, setEditFilter] = useState<RepositoryFilterSummary | null>(null);
  const [deleteFilterId, setDeleteFilterId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const refreshFilters = async () => {
    try {
      const res = await fetch("/api/repository-filters");
      if (res.ok) {
        const data = await res.json();
        setFilters(data.filters);
      }
    } catch (err) {
      console.error("Failed to refresh repository filters", err);
    }
  };

  const handleToggleState = async (filter: RepositoryFilterSummary) => {
    try {
      const res = await fetch(`/api/repository-filters/${filter.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !filter.enabled }),
      });
      if (res.ok) {
        await refreshFilters();
      }
    } catch (err) {
      console.error("Failed to toggle filter", err);
    }
  };

  const handleDelete = async () => {
    if (!deleteFilterId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/repository-filters/${deleteFilterId}`, { method: "DELETE" });
      if (res.ok) {
        setFilters((prev) => prev.filter((f) => f.id !== deleteFilterId));
        setDeleteFilterId(null);
      }
    } catch (err) {
      console.error("Failed to delete repository filter", err);
    } finally {
      setDeleting(false);
    }
  };

  const formatDate = (d: string | Date) => new Date(d).toLocaleDateString();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium text-fg-default">Filter Rules</h2>
        <Button variant="primary" onClick={() => setIsCreateOpen(true)}>
          Add Rule
        </Button>
      </div>

      <div className="rounded-lg border border-border-default bg-canvas-default shadow-sm overflow-hidden">
        {filters.length === 0 ? (
          <div className="p-8 text-center text-sm text-fg-muted">
            No repository filter rules configured. All repositories will be scanned.
          </div>
        ) : (
          <table className="w-full text-left text-sm text-fg-default">
            <thead className="border-b border-border-default bg-canvas-subtle text-xs font-medium text-fg-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Pattern</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-default">
              {filters.map((filter) => (
                <tr key={filter.id} className="hover:bg-canvas-subtle group">
                  <td className="px-4 py-3 align-top whitespace-nowrap">
                    <Badge status={filter.type === "BLOCK" ? "error" : "success"}>
                      {filter.type}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 align-top font-mono text-xs">
                    {filter.pattern}
                  </td>
                  <td className="px-4 py-3 align-top whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <div className={`h-2 w-2 rounded-full ${filter.enabled ? "bg-success-fg" : "bg-fg-muted"}`} />
                      <span className={filter.enabled ? "text-fg-default" : "text-fg-muted"}>
                        {filter.enabled ? "Active" : "Disabled"}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 align-top text-right">
                    <div className="flex items-center justify-end gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="secondary"
                        className="w-auto px-2.5 h-8 text-xs"
                        onClick={() => handleToggleState(filter)}
                      >
                        {filter.enabled ? "Disable" : "Enable"}
                      </Button>
                      <Button
                        variant="secondary"
                        className="w-auto px-2.5 h-8 text-xs"
                        onClick={() => setEditFilter(filter)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="destructive"
                        className="w-auto px-2.5 h-8 text-xs"
                        onClick={() => setDeleteFilterId(filter.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <CreateFilterDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        onSuccess={refreshFilters}
      />

      {editFilter && (
        <EditFilterDialog
          filter={editFilter}
          open={true}
          onOpenChange={(isOpen) => {
            if (!isOpen) setEditFilter(null);
          }}
          onSuccess={async () => {
            await refreshFilters();
            setEditFilter(null);
          }}
        />
      )}

      <DeleteFilterDialog
        open={Boolean(deleteFilterId)}
        filterPattern={filters.find((f) => f.id === deleteFilterId)?.pattern ?? "this rule"}
        onCancel={() => setDeleteFilterId(null)}
        onConfirm={handleDelete}
        deleting={deleting}
      />
    </div>
  );
}
