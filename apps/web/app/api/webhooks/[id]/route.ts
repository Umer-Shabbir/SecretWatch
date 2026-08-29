import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authorize";
import {
  getWebhookEndpoint,
  updateWebhookEndpoint,
  deleteWebhookEndpoint,
  WebhookNotFoundError,
  InvalidWebhookError,
} from "@/lib/webhooks";
import { recordAudit } from "@/lib/audit";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { session, error } = await requireAdmin();
  if (error === "unauthenticated") {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  if (error === "forbidden") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  try {
    const endpoint = await getWebhookEndpoint(params.id);
    if (!endpoint) {
      return NextResponse.json(
        { message: "Webhook endpoint not found" },
        { status: 404 }
      );
    }
    return NextResponse.json({ endpoint });
  } catch (err) {
    return NextResponse.json(
      { message: "Could not load webhook endpoint" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
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

  try {
    const updated = await updateWebhookEndpoint(params.id, {
      name: typeof name === "string" ? name : undefined,
      url: typeof url === "string" ? url : undefined,
      secret: typeof secret === "string" ? secret : undefined,
      events: Array.isArray(events) ? (events as string[]) : undefined,
      enabled: typeof enabled === "boolean" ? enabled : undefined,
    });

    await recordAudit({
      userId: session!.user.id,
      action: "webhook_endpoint_updated",
      detail: JSON.stringify({ id: updated.id, name: updated.name }),
    });

    return NextResponse.json({ endpoint: updated });
  } catch (err) {
    if (err instanceof WebhookNotFoundError) {
      return NextResponse.json({ message: err.message }, { status: 404 });
    }
    if (err instanceof InvalidWebhookError) {
      return NextResponse.json({ message: err.reason }, { status: 400 });
    }
    return NextResponse.json(
      { message: "Could not update webhook endpoint" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { session, error } = await requireAdmin();
  if (error === "unauthenticated") {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  if (error === "forbidden") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  try {
    await deleteWebhookEndpoint(params.id);

    await recordAudit({
      userId: session!.user.id,
      action: "webhook_endpoint_deleted",
      detail: JSON.stringify({ id: params.id }),
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof WebhookNotFoundError) {
      return NextResponse.json({ message: err.message }, { status: 404 });
    }
    return NextResponse.json(
      { message: "Could not delete webhook endpoint" },
      { status: 500 }
    );
  }
}
