import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authorize";
import { resetFinding, InvalidFindingTransitionError, FindingNotFoundError } from "@/lib/findings";
import { recordAudit } from "@/lib/audit";

export async function POST(
  request: Request,
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
    const finding = await resetFinding(params.id);

    await recordAudit({
      userId: session!.user.id,
      action: "finding_reset",
      detail: `finding_id=${params.id} new_status=PENDING`,
    });

    return NextResponse.json(finding);
  } catch (err: unknown) {
    if (err instanceof FindingNotFoundError) {
      return NextResponse.json({ error: "not_found", message: err.message }, { status: 404 });
    }
    if (err instanceof InvalidFindingTransitionError) {
      return NextResponse.json({ error: "conflict", message: err.message }, { status: 409 });
    }
    console.error(`Failed to reset finding ${params.id}:`, err);
    return NextResponse.json({ error: "internal_error", message: "An unexpected error occurred" }, { status: 500 });
  }
}
