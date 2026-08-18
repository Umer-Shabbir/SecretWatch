import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authorize";
import { recordAudit } from "@/lib/audit";
import { deactivateAdminToken, GithubTokenNotFoundError } from "@/lib/admin-tokens";

/**
 * PATCH /api/tokens/:id
 *
 * Admin-only deactivation (soft-delete, active=false) of a submitted GitHub
 * token (Part 2.3 of the 2026-08-17 scope correction). Replaces the removed
 * per-user DELETE /api/tokens/:id (apps/web/app/api/tokens/[id]/route.ts,
 * deleted in Part 1.5) — same soft-delete semantics, now admin-scoped
 * instead of ownership-scoped, since GithubToken has no userId column.
 *
 * PATCH (not DELETE) because this never removes the row — see
 * lib/admin-tokens.ts's deactivateAdminToken doc comment. Idempotent:
 * deactivating an already-inactive token returns 200, not an error.
 *
 * Response: { token: AdminTokenSummary } on success.
 * Authorization: ADMIN only (requireAdmin). Audited as token_deactivated.
 */
export async function PATCH(_request: Request, { params }: { params: { id: string } }) {
  const { session, error } = await requireAdmin();
  if (error === "unauthenticated") {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  if (error === "forbidden") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  try {
    const token = await deactivateAdminToken(params.id);

    await recordAudit({
      userId: session!.user.id,
      action: "token_deactivated",
      detail: `tokenId=${token.id}`,
    });

    return NextResponse.json({ token });
  } catch (err) {
    if (err instanceof GithubTokenNotFoundError) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    throw err;
  }
}
