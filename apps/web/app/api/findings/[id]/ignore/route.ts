import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authorize";
import {
  ignoreFinding,
  FindingNotFoundError,
  InvalidFindingTransitionError,
} from "@/lib/findings";
import { recordAudit } from "@/lib/audit";

/**
 * POST /api/findings/:id/ignore
 *
 * Transitions a PENDING finding to IGNORED (Figma "Ignore" action). Only
 * PENDING -> IGNORED is a valid transition: Approved/Flagged/Ignored are
 * all terminal states within this module's scope, so the only two outgoing
 * transitions from Pending are Approve and Ignore.
 *
 * Validation:
 *   - 404 if the finding does not exist.
 *   - 409 if the finding is not currently PENDING (covers re-ignoring an
 *     already-IGNORED finding, and any other terminal status). Never
 *     silently succeeds or crashes on an invalid transition.
 *
 * Authorization: ADMIN role only (requireAdmin) — same admin review gate
 * as approve, per ARCHITECTURE.md/CLAUDE.md/docs/MODULES.md placing
 * approve/ignore under the Admin Review Queue (M06) with review enabled
 * by default.
 *
 * Auditing: records an AuditLog row (userId, action="finding_ignored",
 * detail=findingId) via lib/audit.ts.
 */
export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const { session, error } = await requireAdmin();
  if (error === "unauthenticated") {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  if (error === "forbidden") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  try {
    const finding = await ignoreFinding(params.id);

    await recordAudit({
      userId: session!.user.id,
      action: "finding_ignored",
      detail: `findingId=${finding.id}`,
    });

    return NextResponse.json({ finding });
  } catch (err) {
    if (err instanceof FindingNotFoundError) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    if (err instanceof InvalidFindingTransitionError) {
      return NextResponse.json(
        {
          error: "invalid_transition",
          message: `Finding is ${err.currentStatus}, only a PENDING finding can be ignored`,
        },
        { status: 409 }
      );
    }
    throw err;
  }
}
