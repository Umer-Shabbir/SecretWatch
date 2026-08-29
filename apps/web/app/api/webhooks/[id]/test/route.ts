import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authorize";
import { testWebhookEndpoint, WebhookNotFoundError } from "@/lib/webhooks";

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { error } = await requireAdmin();
  if (error === "unauthenticated") {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  if (error === "forbidden") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  try {
    const result = await testWebhookEndpoint(params.id);

    if (result.success) {
      return NextResponse.json({ ok: true, message: "Webhook test successful" });
    } else {
      return NextResponse.json(
        { message: `Webhook test failed: ${result.error}` },
        { status: 400 }
      );
    }
  } catch (err) {
    if (err instanceof WebhookNotFoundError) {
      return NextResponse.json({ message: err.message }, { status: 404 });
    }
    return NextResponse.json(
      { message: "Could not test webhook endpoint" },
      { status: 500 }
    );
  }
}
