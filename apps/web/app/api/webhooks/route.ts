import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/authorize";
import {
  listWebhookEndpoints,
  createWebhookEndpoint,
  InvalidWebhookError,
} from "@/lib/webhooks";
import { recordAudit } from "@/lib/audit";
import { ALL_WEBHOOK_EVENTS } from "@/lib/webhook-types";

export async function GET() {
  const { session, error } = await requireAdmin();
  if (error === "unauthenticated") {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  if (error === "forbidden") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  try {
    const endpoints = await listWebhookEndpoints();
    return NextResponse.json({ endpoints });
  } catch (err) {
    return NextResponse.json(
      { message: "Could not load webhooks" },
      { status: 500 }
    );
  }
}

const createWebhookSchema = z.object({
  name: z.string().trim().min(1, "name is required").max(255),
  url: z.string().trim().url("url must be a valid URL"),
  secret: z.string().nullable().optional(),
  events: z.array(z.string()).optional(),
  enabled: z.boolean().optional().default(true),
});

export async function POST(req: NextRequest) {
  const { session, error } = await requireAdmin();
  if (error === "unauthenticated") {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  if (error === "forbidden") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = createWebhookSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const { name, url, secret, events, enabled } = parsed.data;

  try {
    const created = await createWebhookEndpoint({
      name,
      url,
      secret,
      events,
      enabled,
    });

    await recordAudit({
      userId: session!.user.id,
      action: "webhook_endpoint_created",
      detail: JSON.stringify({ id: created.id, name: created.name }),
    });

    return NextResponse.json({ endpoint: created }, { status: 201 });
  } catch (err) {
    if (err instanceof InvalidWebhookError) {
      return NextResponse.json({ message: err.reason }, { status: 400 });
    }
    return NextResponse.json(
      { message: "Could not create webhook endpoint" },
      { status: 500 }
    );
  }
}
