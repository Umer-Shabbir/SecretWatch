"use client";

import { useState, useCallback, useEffect } from "react";
import { formatRelativeTime } from "@/lib/format-relative-time";

interface AuditLog {
  id: string;
  userId: string | null;
  action: string;
  detail: string | null;
  createdAt: string;
  user: {
    username: string | null;
    email: string | null;
  } | null;
}

export function AdminActivityClient() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/system/audit");
      if (!res.ok) {
        throw new Error("Failed to fetch audit logs");
      }
      const data = await res.json();
      setLogs(data.logs || []);
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-fg-default">Admin Activity</h1>
          <p className="text-sm text-fg-muted mt-1">
            Audit log of security-sensitive administrative actions.
          </p>
        </div>
        <button
          onClick={fetchLogs}
          className="flex h-8 items-center justify-center rounded-small border border-border-default bg-canvas-default px-3 text-xs font-medium text-fg-default hover:bg-canvas-subtle"
          disabled={loading}
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {error && (
        <div className="rounded-small border border-danger-emphasis/20 bg-danger-subtle p-3 text-sm text-danger-fg">
          {error}
        </div>
      )}

      <div className="rounded-small border border-border-default bg-canvas-default overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="border-b border-border-default bg-canvas-subtle">
              <tr>
                <th className="px-4 py-3 font-medium text-fg-muted w-48">Timestamp</th>
                <th className="px-4 py-3 font-medium text-fg-muted w-48">Actor</th>
                <th className="px-4 py-3 font-medium text-fg-muted w-56">Action</th>
                <th className="px-4 py-3 font-medium text-fg-muted">Detail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-default">
              {loading && logs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-fg-muted">
                    Loading activity logs...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-fg-muted">
                    No activity logs found.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-canvas-subtle/50 transition-colors">
                    <td className="px-4 py-3 text-fg-muted" title={new Date(log.createdAt).toLocaleString()}>
                      {formatRelativeTime(new Date(log.createdAt))}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <span className="text-fg-default font-medium">
                          {log.user?.username || log.user?.email || "Unknown Admin"}
                        </span>
                        {log.userId && <span className="text-xs text-fg-subtle truncate max-w-[150px]">{log.userId}</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center rounded-full bg-accent-subtle/50 px-2 py-0.5 text-xs font-medium text-accent-fg border border-accent-emphasis/20">
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <code className="text-xs text-fg-default font-mono break-all whitespace-normal">
                        {log.detail || "-"}
                      </code>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
