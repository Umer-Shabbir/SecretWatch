"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CreateWebhookDialog } from "./create-webhook-dialog";
import { EditWebhookDialog } from "./edit-webhook-dialog";
import { DeleteWebhookDialog } from "./delete-webhook-dialog";
import type { WebhookEndpointSummary } from "@/lib/webhook-types";
import { ALL_WEBHOOK_EVENTS } from "@/lib/webhook-types";

export function WebhooksClient({ initialWebhooks }: { initialWebhooks: WebhookEndpointSummary[] }) {
  const [webhooks, setWebhooks] = useState<WebhookEndpointSummary[]>(initialWebhooks);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editEndpoint, setEditEndpoint] = useState<WebhookEndpointSummary | null>(null);
  const [deleteEndpoint, setDeleteEndpoint] = useState<WebhookEndpointSummary | null>(null);

  const [deleting, setDeleting] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ id: string; success: boolean; message: string } | null>(null);

  const refreshWebhooks = async () => {
    try {
      const res = await fetch("/api/webhooks");
      if (res.ok) {
        const data = await res.json();
        setWebhooks(data.endpoints);
      }
    } catch (err) {
      console.error("Failed to refresh webhooks", err);
    }
  };

  const handleTest = async (id: string) => {
    setTestingId(id);
    setTestResult(null);
    try {
      const res = await fetch(`/api/webhooks/${id}/test`, { method: "POST" });
      const data = await res.json();
      setTestResult({
        id,
        success: res.ok,
        message: res.ok ? "Ping successful" : data.message || "Ping failed",
      });
      if (res.ok) {
        setTimeout(() => setTestResult(null), 3000);
      }
    } catch (err) {
      setTestResult({
        id,
        success: false,
        message: err instanceof Error ? err.message : "Network error",
      });
    } finally {
      setTestingId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteEndpoint) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/webhooks/${deleteEndpoint.id}`, { method: "DELETE" });
      if (res.ok) {
        setWebhooks((prev) => prev.filter((w) => w.id !== deleteEndpoint.id));
        setDeleteEndpoint(null);
      }
    } catch (err) {
      console.error("Failed to delete webhook", err);
    } finally {
      setDeleting(false);
    }
  };

  const handleToggleState = async (endpoint: WebhookEndpointSummary) => {
    try {
      const res = await fetch(`/api/webhooks/${endpoint.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !endpoint.enabled }),
      });
      if (res.ok) {
        const data = await res.json();
        setWebhooks((prev) => prev.map((w) => (w.id === endpoint.id ? data.endpoint : w)));
      }
    } catch (err) {
      console.error("Failed to toggle webhook state", err);
    }
  };

  const getEventNames = (events: string[]) => {
    if (events.length === ALL_WEBHOOK_EVENTS.length || events.length === 0) return "All Events";
    return events.map((e) => e.split(".")[1]).join(", ");
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-fg-default">Webhook Endpoints</h2>
          <p className="text-sm text-fg-muted">Manage outbound notifications to Slack, Discord, and custom receivers.</p>
        </div>
        <div className="w-auto">
          <Button onClick={() => setIsCreateOpen(true)} className="gap-2">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            Add Endpoint
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {webhooks.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-medium border border-border-default border-dashed py-12 text-center">
            <h3 className="text-sm font-medium text-fg-default">No webhook endpoints</h3>
            <p className="mt-1 text-sm text-fg-muted">Set up a webhook to receive real-time alerts when secrets are found.</p>
            <div className="mt-4 w-auto">
              <Button variant="secondary" onClick={() => setIsCreateOpen(true)}>
                Add webhook endpoint
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {webhooks.map((webhook) => (
              <div
                key={webhook.id}
                className="flex flex-col rounded-medium border border-border-default bg-canvas-default p-4 shadow-sm"
              >
                <div className="mb-2 flex items-start justify-between">
                  <div className="flex flex-col">
                    <h3 className="font-semibold text-fg-default" title={webhook.name}>
                      {webhook.name.length > 24 ? webhook.name.substring(0, 24) + "..." : webhook.name}
                    </h3>
                    <div className="mt-1 flex items-center gap-2">
                      <Badge status={webhook.enabled ? "success" : "default"}>
                        {webhook.enabled ? "ACTIVE" : "DISABLED"}
                      </Badge>
                      <span className="text-xs text-fg-muted">{getEventNames(webhook.events)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setEditEndpoint(webhook)}
                      className="rounded p-1.5 text-fg-muted hover:bg-canvas-subtle hover:text-fg-default"
                      title="Edit endpoint"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => setDeleteEndpoint(webhook)}
                      className="rounded p-1.5 text-fg-muted hover:bg-danger-emphasis/10 hover:text-danger-fg"
                      title="Delete endpoint"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>

                <div className="mb-4 flex-1">
                  <div className="rounded bg-canvas-subtle p-2">
                    <p className="break-all text-[11px] font-mono text-fg-muted" title={webhook.url}>
                      {webhook.url.length > 50 ? webhook.url.substring(0, 50) + "..." : webhook.url}
                    </p>
                  </div>
                  {testResult?.id === webhook.id && (
                    <div className={`mt-2 flex items-center gap-1.5 text-[11px] ${testResult.success ? "text-success-fg" : "text-danger-fg"}`}>
                      <span>{testResult.success ? "✓" : "⚠"}</span>
                      {testResult.message}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 border-t border-border-default pt-3">
                  <Button
                    variant="secondary"
                    className="flex-1 gap-1.5 text-xs"
                    onClick={() => handleTest(webhook.id)}
                    loading={testingId === webhook.id}
                  >
                    <span>▶</span> Test
                  </Button>
                  <Button
                    variant={webhook.enabled ? "secondary" : "primary"}
                    className="flex-1 text-xs"
                    onClick={() => handleToggleState(webhook)}
                  >
                    {webhook.enabled ? "Disable" : "Enable"}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <CreateWebhookDialog
        open={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onCreated={refreshWebhooks}
      />

      <EditWebhookDialog
        open={!!editEndpoint}
        endpoint={editEndpoint}
        onClose={() => setEditEndpoint(null)}
        onUpdated={refreshWebhooks}
      />

      <DeleteWebhookDialog
        open={!!deleteEndpoint}
        name={deleteEndpoint?.name || ""}
        deleting={deleting}
        onCancel={() => setDeleteEndpoint(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
