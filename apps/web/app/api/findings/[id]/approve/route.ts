import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authorize";
import {
  approveFinding,
  FindingNotFoundError,
  InvalidFindingTransitionError,
} from "@/lib/findings";
import { recordAudit } from "@/lib/audit";
import { enqueueFlagJob } from "@/lib/queue";

/**
 * POST /api/findings/:id/approve
 *
 * Transitions a PENDING finding to APPROVED (Figma "Approve & Flag" action
 * behind the Confirm Approve dialog). Per the M05 task spec, this endpoint
 * only flips status — it does NOT enqueue into a flag-queue or call any
 * flagging logic, because M07 (Flagger) is not built yet. An APPROVED
 * finding is simply "ready" for M07's flagger worker to later pick up and
 * create a GitHub issue via an available authorized token.
 *
 * Validation:
 *   - 404 if the finding does not exist.
 *   - 409 if the finding is not currently PENDING (covers both the
 *     idempotency case — re-approving an already-APPROVED finding — and
 *     any other terminal state such as FLAGGED/IGNORED/FAILED). Never
 *     silently succeeds or crashes on an invalid transition.
 *
 * Authorization: ADMIN role only (requireAdmin). Approving a finding makes
 * it flag-ready for M07's flagger worker to auto-post a GitHub issue on a
 * third-party public repo using an authorized token — an unsupervised
 * auto-post is a reputational/abuse risk (ARCHITECTURE.md section 8), and
 * ARCHITECTURE.md/CLAUDE.md/docs/MODULES.md all place approve/ignore under
 * the Admin Review Queue (M06) with admin review enabled by default.
 *
 * Auditing: records an AuditLog row (userId, action="finding_approved",
 * detail=findingId) via the existing lib/audit.ts helper (same mechanism
 * used by token revocation in M03) so the approval is traceable to who/when.
 *
 * M07 update: now also enqueues a flag-queue job so
 * apps/worker/src/flagger.worker.ts picks up the newly-APPROVED finding and
 * attempts to open a GitHub issue. Enqueue failure (e.g. Redis down) is
 * logged but does not fail this request — the approval itself already
 * committed and remains valid; the finding just waits for a future retrigger.
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
    const finding = await approveFinding(params.id);

    await recordAudit({
      userId: session!.user.id,
      action: "finding_approved",
      detail: `findingId=${finding.id}`,
    });

    try {
      await enqueueFlagJob(finding.id);
    } catch (enqueueErr) {
      // Never let a queue outage turn a successful approval into a 500 —
      // log and continue. Never log finding.redactedSnippet or any token.
      console.error(`[findings] failed to enqueue flag job for ${finding.id}:`, enqueueErr instanceof Error ? enqueueErr.message : enqueueErr);
    }

    return NextResponse.json({ finding });
  } catch (err) {
    if (err instanceof FindingNotFoundError) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    if (err instanceof InvalidFindingTransitionError) {
      return NextResponse.json(
        {
          error: "invalid_transition",
          message: `Finding is ${err.currentStatus}, only a PENDING finding can be approved`,
        },
        { status: 409 }
      );
    }
    throw err;
  }
}
