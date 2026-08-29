import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authorize";
import { bulkResetFindings } from "@/lib/findings";
import { recordAudit } from "@/lib/audit";
import { z } from "zod";

const bulkSchema = z.object({
  ids: z.array(z.string()).min(1),
});

/**
 * Bulk reset of FAILED/IGNORED findings back to PENDING.
 * Expects JSON { "ids": ["uuid-1", "uuid-2"] }
 * Returns { count } on success.
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
    const body = await request.json();
    const parsed = bulkSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "invalid_request", message: parsed.error.message }, { status: 400 });
    }

    const { ids } = parsed.data;
    const { count } = await bulkResetFindings(ids);

    await recordAudit({
      userId: session!.user.id,
      action: "findings_bulk_reset",
      detail: `Reset ${count} out of ${ids.length} requests findings to PENDING`,
    });

    return NextResponse.json({ count });
  } catch (err: any) {
    console.error("Bulk reset failed:", err);
    return NextResponse.json({ error: "internal_error", message: "An unexpected error occurred" }, { status: 500 });
  }
}
