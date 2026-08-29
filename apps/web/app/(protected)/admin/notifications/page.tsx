import { listWebhookEndpoints } from "@/lib/webhooks";
import { requireAdmin } from "@/lib/authorize";
import { redirect } from "next/navigation";
import { WebhooksClient } from "@/components/admin/webhooks-client";

export const dynamic = "force-dynamic";

export default async function WebhooksPage() {
  const { session, error } = await requireAdmin();

  if (error || !session) {
    redirect("/");
  }

  const endpoints = await listWebhookEndpoints();

  return (
    <main className="flex w-full flex-col p-4 sm:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold leading-8 text-fg-default">Webhooks & Notifications</h1>
        <p className="mt-1 text-sm text-fg-muted">
          Configure real-time alerts for findings and system events.
        </p>
      </div>

      <WebhooksClient initialWebhooks={endpoints} />
    </main>
  );
}
