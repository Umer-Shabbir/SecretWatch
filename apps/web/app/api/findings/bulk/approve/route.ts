import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authorize";
import { bulkApproveFindings } from "@/lib/findings";
import { recordAudit } from "@/lib/audit";
import { enqueueFlagJobs } from "@/lib/queue";
import { getSystemSettings } from "@/lib/system-settings";
import { z } from "zod";
import { dispatchWebhookEvent } from "@/lib/webhooks";
import { prisma } from "@/lib/db";

const bulkSchema = z.object({
  ids: z.array(z.string()).min(1).max(50),
});

/**
 * POST /api/findings/bulk/approve
 *
 * Transitions multiple PENDING findings to APPROVED.
 */
export async function POST(request: Request) {
  const { session, error } = await requireAdmin();
  if (error === "unauthenticated") {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  if (error === "forbidden") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  try {
    const json = await request.json();
    const parsed = bulkSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "invalid_request", message: parsed.error.message },
        { status: 400 }
      );
    }

    const { ids } = parsed.data;
    const { count } = await bulkApproveFindings(ids);

    if (count > 0) {
      await recordAudit({
        userId: session!.user.id,
        action: "findings_bulk_approved",
        detail: `count=${count}`, // Could log IDs, but keep it lightweight. The individual DB transitions are implicit in status.
      });

      // Fetch the findings to dispatch webhooks for them
      let validIds: string[] = [];
      try {
        const approvedFindings = await prisma.finding.findMany({
          where: { id: { in: ids }, status: "APPROVED" },
          select: { id: true, repoFullName: true, filePath: true, matchedRule: true, severity: true },
        });

        validIds = approvedFindings.map(f => f.id);

        for (const finding of approvedFindings) {
          dispatchWebhookEvent("finding.approved", {
            id: finding.id,
            repoFullName: finding.repoFullName,
            filePath: finding.filePath,
            matchedRule: finding.matchedRule,
            severity: finding.severity,
            approvedBy: session!.user.id,
          }).catch((err) => console.error("[findings] Webhook dispatch finding.approved failed:", err));
        }
      } catch (err) {
        console.error("[findings] Failed to fetch approved findings for webhooks:", err);
      }

      const { autoFlagEnabled } = await getSystemSettings();
      if (autoFlagEnabled && validIds.length > 0) {
        try {
          await enqueueFlagJobs(validIds);
        } catch (enqueueErr) {
          console.error(`[findings] failed to enqueue bulk flag jobs:`, enqueueErr instanceof Error ? enqueueErr.message : enqueueErr);
        }
      }
    }

    return NextResponse.json({ count });
  } catch (err) {
    if (err instanceof SyntaxError) {
      return NextResponse.json({ error: "invalid_json" }, { status: 400 });
    }
    throw err;
  }
}
