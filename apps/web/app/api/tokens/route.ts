import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authorize";
import { listAdminTokens } from "@/lib/admin-tokens";

/**
 * GET /api/tokens
 *
 * Admin-only list of every submitted GitHub token (Part 2.3 of the
 * 2026-08-17 scope correction). This route previously served the current
 * session user's own token (per-user, requireSession); it is now
 * admin-scoped and global, matching GithubToken's schema change to a
 * userId-less model (Part 1.6).
 *
 * Response: { tokens: AdminTokenSummary[] }
 * Never returns GithubToken.encrypted — see lib/admin-tokens.ts.
 *
 * Authorization: ADMIN only (requireAdmin).
 */
export async function GET() {
  const { error } = await requireAdmin();
  if (error === "unauthenticated") {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  if (error === "forbidden") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const tokens = await listAdminTokens();
  return NextResponse.json({ tokens });
}
