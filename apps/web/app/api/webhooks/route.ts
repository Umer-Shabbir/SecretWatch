import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authorize";
import {
  listWebhookEndpoints,
  createWebhookEndpoint,
  InvalidWebhookError,
} from "@/lib/webhooks";
import { recordAudit } from "@/lib/audit";

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

  const { name, url, secret, events, enabled } = (body as Record<string, unknown>) ?? {};

  if (!name || typeof name !== "string") {
    return NextResponse.json({ message: "name is required" }, { status: 400 });
  }
  if (!url || typeof url !== "string") {
    return NextResponse.json({ message: "url is required" }, { status: 400 });
  }

  try {
    const created = await createWebhookEndpoint({
      name,
      url,
      secret: typeof secret === "string" ? secret : null,
      events: Array.isArray(events) ? (events as string[]) : undefined,
      enabled: typeof enabled === "boolean" ? enabled : true,
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
