import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authorize";
import { parseFlagsQuery, listFlags } from "@/lib/flags";

/**
 * GET /api/flags
 *
 * Query params:
 *   status   - optional, one of FLAGGED/FAILED. Omitted = both (Figma "All" tab).
 *   page     - 1-based, default 1.
 *   pageSize - default 20, capped at 50.
 *
 * Response: { flags: FlagRow[], page, pageSize, total, totalPages, summary }
 * per packages/shared/src/types.ts FlagsListResponse — mirrors GET
 * /api/findings' shape/pattern (M04).
 *
 * Auth: ADMIN only (requireAdmin). After the 2026-08-17 scope correction
 * there is no end-user dashboard/flags page left — only the admin dashboard
 * consumes this route. Never returns a decrypted token or raw secret value;
 * TOKEN column is the pre-masked GithubToken.maskedIdentifier only (see
 * lib/flags.ts).
 */
export async function GET(request: NextRequest) {
  const { session, error } = await requireAdmin();
  if (error) {
    return NextResponse.json({ error }, { status: error === "forbidden" ? 403 : 401 });
  }
  void session;

  const parsed = parseFlagsQuery(request.nextUrl.searchParams);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid query", issues: parsed.error.issues.map((i) => i.message) },
      { status: 400 }
    );
  }

  const result = await listFlags(parsed.data);
  return NextResponse.json(result);
}
