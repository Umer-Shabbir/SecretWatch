import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authorize";
import { bulkIgnoreFindings } from "@/lib/findings";
import { recordAudit } from "@/lib/audit";
import { z } from "zod";

const bulkSchema = z.object({
  ids: z.array(z.string()).min(1).max(50),
});

/**
 * POST /api/findings/bulk/ignore
 *
 * Transitions multiple PENDING findings to IGNORED.
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
    const { count } = await bulkIgnoreFindings(ids);

    if (count > 0) {
      await recordAudit({
        userId: session!.user.id,
        action: "findings_bulk_ignored",
        detail: `count=${count}`,
      });
    }

    return NextResponse.json({ count });
  } catch (err) {
    if (err instanceof SyntaxError) {
      return NextResponse.json({ error: "invalid_json" }, { status: 400 });
    }
    throw err;
  }
}
