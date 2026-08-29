import { prisma } from "@/lib/db";
import crypto from "crypto";

export interface WebhookEndpointSummary {
  id: string;
  name: string;
  url: string;
  secret: string | null;
  events: string[];
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export type WebhookEventType =
  | "finding.created"
  | "finding.approved"
  | "finding.flagged"
  | "flag.failed";

export const ALL_WEBHOOK_EVENTS: { type: WebhookEventType; label: string; description: string }[] = [
  {
    type: "finding.created",
    label: "Finding Created",
    description: "Triggered when the scanner detects a new secret finding.",
  },
  {
    type: "finding.approved",
    label: "Finding Approved",
    description: "Triggered when a finding is approved manually or via auto-approve.",
  },
  {
    type: "finding.flagged",
    label: "Finding Flagged (Issue Created)",
    description: "Triggered when the flagger creates a GitHub issue for an approved finding.",
  },
  {
    type: "flag.failed",
    label: "Flag Failed",
    description: "Triggered when issue creation encounters an error or rate limit.",
  },
];

export class WebhookNotFoundError extends Error {
  constructor(public readonly id: string) {
    super(`Webhook endpoint not found: ${id}`);
    this.name = "WebhookNotFoundError";
  }
}

export class InvalidWebhookError extends Error {
  constructor(public readonly reason: string) {
    super(`Invalid webhook configuration: ${reason}`);
    this.name = "InvalidWebhookError";
  }
}

function isValidUrl(urlString: string): boolean {
  try {
    const parsed = new URL(urlString);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function toSummary(row: {
  id: string;
  name: string;
  url: string;
  secret: string | null;
  events: string[];
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}): WebhookEndpointSummary {
  return {
    id: row.id,
    name: row.name,
    url: row.url,
    secret: row.secret ? "••••••••" : null, // Mask secret
    events: row.events,
    enabled: row.enabled,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listWebhookEndpoints(): Promise<WebhookEndpointSummary[]> {
  const rows = await prisma.webhookEndpoint.findMany({
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toSummary);
}

export async function getWebhookEndpoint(id: string): Promise<WebhookEndpointSummary | null> {
  const row = await prisma.webhookEndpoint.findUnique({ where: { id } });
  if (!row) return null;
  return toSummary(row);
}

export async function createWebhookEndpoint(params: {
  name: string;
  url: string;
  secret?: string | null;
  events?: string[];
  enabled?: boolean;
}): Promise<WebhookEndpointSummary> {
  const name = params.name?.trim() ?? "";
  if (!name) throw new InvalidWebhookError("Name must not be empty");

  const url = params.url?.trim() ?? "";
  if (!isValidUrl(url)) throw new InvalidWebhookError("Invalid URL format. Must start with http:// or https://");

  const events = params.events && params.events.length > 0 ? params.events : ALL_WEBHOOK_EVENTS.map((e) => e.type);

  const row = await prisma.webhookEndpoint.create({
    data: {
      name,
      url,
      secret: params.secret?.trim() || null,
      events,
      enabled: params.enabled ?? true,
    },
  });

  return toSummary(row);
}

export async function updateWebhookEndpoint(
  id: string,
  params: {
    name?: string;
    url?: string;
    secret?: string | null;
    events?: string[];
    enabled?: boolean;
  }
): Promise<WebhookEndpointSummary> {
  const existing = await prisma.webhookEndpoint.findUnique({ where: { id } });
  if (!existing) throw new WebhookNotFoundError(id);

  const data: {
    name?: string;
    url?: string;
    secret?: string | null;
    events?: string[];
    enabled?: boolean;
  } = {};

  if (params.name !== undefined) {
    const trimmed = params.name.trim();
    if (!trimmed) throw new InvalidWebhookError("Name must not be empty");
    data.name = trimmed;
  }

  if (params.url !== undefined) {
    const trimmed = params.url.trim();
    if (!isValidUrl(trimmed)) throw new InvalidWebhookError("Invalid URL format");
    data.url = trimmed;
  }

  if (params.secret !== undefined) {
    data.secret = params.secret?.trim() || null;
  }

  if (params.events !== undefined) {
    data.events = params.events;
  }

  if (params.enabled !== undefined) {
    data.enabled = params.enabled;
  }

  const row = await prisma.webhookEndpoint.update({
    where: { id },
    data,
  });

  return toSummary(row);
}

export async function deleteWebhookEndpoint(id: string): Promise<void> {
  const existing = await prisma.webhookEndpoint.findUnique({ where: { id } });
  if (!existing) throw new WebhookNotFoundError(id);

  await prisma.webhookEndpoint.delete({ where: { id } });
}

export async function dispatchWebhookEvent(
  event: WebhookEventType,
  payload: Record<string, unknown>
): Promise<{ dispatched: number; failed: number }> {
  const endpoints = await prisma.webhookEndpoint.findMany({
    where: {
      enabled: true,
      OR: [{ events: { has: event } }, { events: { isEmpty: true } }],
    },
  });

  if (endpoints.length === 0) {
    return { dispatched: 0, failed: 0 };
  }

  let dispatched = 0;
  let failed = 0;

  const timestamp = new Date().toISOString();
  const baseBody = {
    event,
    timestamp,
    data: payload,
  };

  const jsonString = JSON.stringify(baseBody);

  await Promise.all(
    endpoints.map(async (endpoint) => {
      try {
        let bodyToSend: string = jsonString;
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          "User-Agent": "SecretWatch-Webhook-Dispatcher/1.0",
        };

        // Slack / Discord compatibility formatting
        if (endpoint.url.includes("hooks.slack.com")) {
          const slackText = `*[SecretWatch Alert]* \`${event}\`\n${JSON.stringify(payload, null, 2)}`;
          bodyToSend = JSON.stringify({ text: slackText });
        } else if (endpoint.url.includes("discord.com/api/webhooks")) {
          const discordText = `**[SecretWatch Alert]** \`${event}\`\n\`\`\`json\n${JSON.stringify(payload, null, 2)}\n\`\`\``;
          bodyToSend = JSON.stringify({ content: discordText });
        } else {
          // Compute HMAC SHA-256 signature if secret is provided
          if (endpoint.secret) {
            const signature = crypto.createHmac("sha256", endpoint.secret).update(jsonString).digest("hex");
            headers["X-SecretWatch-Signature"] = `sha256=${signature}`;
          }
        }

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);

        const res = await fetch(endpoint.url, {
          method: "POST",
          headers,
          body: bodyToSend,
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (res.ok) {
          dispatched++;
        } else {
          failed++;
        }
      } catch {
        failed++;
      }
    })
  );

  return { dispatched, failed };
}

export async function testWebhookEndpoint(
  id: string
): Promise<{ success: boolean; status?: number; error?: string }> {
  const endpoint = await prisma.webhookEndpoint.findUnique({ where: { id } });
  if (!endpoint) throw new WebhookNotFoundError(id);

  const testPayload = {
    test: true,
    message: "This is a test notification from SecretWatch.",
    timestamp: new Date().toISOString(),
  };

  const jsonString = JSON.stringify({
    event: "test.ping",
    timestamp: new Date().toISOString(),
    data: testPayload,
  });

  try {
    let bodyToSend: string = jsonString;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "User-Agent": "SecretWatch-Webhook-Dispatcher/1.0",
    };

    if (endpoint.url.includes("hooks.slack.com")) {
      bodyToSend = JSON.stringify({
        text: "*[SecretWatch Test]* Webhook integration verified successfully! 🎉",
      });
    } else if (endpoint.url.includes("discord.com/api/webhooks")) {
      bodyToSend = JSON.stringify({
        content: "**[SecretWatch Test]** Webhook integration verified successfully! 🎉",
      });
    } else if (endpoint.secret) {
      const signature = crypto.createHmac("sha256", endpoint.secret).update(jsonString).digest("hex");
      headers["X-SecretWatch-Signature"] = `sha256=${signature}`;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(endpoint.url, {
      method: "POST",
      headers,
      body: bodyToSend,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    return {
      success: res.ok,
      status: res.status,
      error: res.ok ? undefined : `Received HTTP ${res.status}: ${res.statusText}`,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to connect to webhook URL",
    };
  }
}
