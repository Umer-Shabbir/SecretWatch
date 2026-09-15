import { prisma } from "./db";
import crypto from "crypto";
import { assertSafeWebhookUrlAsync, SSRFValidationError } from "@secretwatch/shared";

export type WebhookEventType =
  | "finding.created"
  | "finding.approved"
  | "finding.flagged"
  | "flag.failed";

export async function dispatchWebhookEvent(
  event: WebhookEventType,
  payload: Record<string, unknown>
): Promise<{ dispatched: number; failed: number }> {
  try {
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
          await assertSafeWebhookUrlAsync(endpoint.url);

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
  } catch (err) {
    // If DB is unreachable or any error occurs, do not block worker execution
    return { dispatched: 0, failed: 0 };
  }
}
