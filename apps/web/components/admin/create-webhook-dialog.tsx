"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ALL_WEBHOOK_EVENTS, WebhookEventType } from "@/lib/webhook-types";

export interface WebhookFormValues {
  name: string;
  url: string;
  secret?: string;
  events: string[];
  enabled: boolean;
}

export function CreateWebhookDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [secret, setSecret] = useState("");
  const [selectedEvents, setSelectedEvents] = useState<string[]>(
    ALL_WEBHOOK_EVENTS.map((e) => e.type)
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const toggleEvent = (eventType: string) => {
    if (selectedEvents.includes(eventType)) {
      setSelectedEvents(selectedEvents.filter((e) => e !== eventType));
    } else {
      setSelectedEvents([...selectedEvents, eventType]);
    }
  };

  const handleSelectAll = () => {
    if (selectedEvents.length === ALL_WEBHOOK_EVENTS.length) {
      setSelectedEvents([]);
    } else {
      setSelectedEvents(ALL_WEBHOOK_EVENTS.map((e) => e.type));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !url.trim()) return;

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          url: url.trim(),
          secret: secret.trim() ? secret.trim() : null,
          events: selectedEvents,
          enabled: true,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to create webhook endpoint");
      }

      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(0,0,0,0.5)] p-4">
      <div
        role="dialog"
        aria-modal="true"
        className="flex w-full max-w-[540px] flex-col gap-4 rounded-medium border border-border-default bg-canvas-default p-6 shadow-lg"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-fg-default">Add Webhook Endpoint</h2>
          <button
            onClick={onClose}
            className="text-fg-muted hover:text-fg-default"
            aria-label="Close dialog"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="rounded-small border border-danger-emphasis/30 bg-danger-emphasis/10 p-3 text-sm text-danger-fg">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            label="Endpoint Name *"
            type="text"
            placeholder="e.g. Slack Security Channel, Custom SIEM"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          <div>
            <Input
              label="Payload URL *"
              type="url"
              placeholder="https://hooks.slack.com/services/... or https://your-domain.com/webhook"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              required
            />
            <p className="mt-1 text-xs text-fg-muted">
              Compatible with Slack, Discord, and standard JSON HTTP POST receivers.
            </p>
          </div>

          <div>
            <Input
              label="Secret Key (Optional)"
              type="password"
              placeholder="Enter a secret for HMAC SHA-256 signatures"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
            />
            <p className="mt-1 text-xs text-fg-muted">
              Used to generate the <code className="font-mono text-[11px] text-fg-default">X-SecretWatch-Signature</code> header.
            </p>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-sm font-medium text-fg-default">Subscribed Events</label>
              <button
                type="button"
                onClick={handleSelectAll}
                className="text-xs text-accent-fg hover:underline"
              >
                {selectedEvents.length === ALL_WEBHOOK_EVENTS.length ? "Deselect All" : "Select All"}
              </button>
            </div>

            <div className="flex flex-col gap-2 rounded-small border border-border-default p-3">
              {ALL_WEBHOOK_EVENTS.map((evt) => (
                <label
                  key={evt.type}
                  className="flex cursor-pointer items-start gap-2.5 text-sm text-fg-default"
                >
                  <input
                    type="checkbox"
                    checked={selectedEvents.includes(evt.type)}
                    onChange={() => toggleEvent(evt.type)}
                    className="mt-0.5 rounded border-border-default"
                  />
                  <div>
                    <span className="font-medium">{evt.label}</span>
                    <p className="text-xs text-fg-muted">{evt.description}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="mt-2 flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={submitting}
              disabled={!name.trim() || !url.trim() || submitting}
            >
              Create Endpoint
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
