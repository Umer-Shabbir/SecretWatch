import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authorize";
import { parseFindingsQuery, listFindings } from "@/lib/findings";

/**
 * GET /api/findings
 *
 * Query params:
 *   status   - optional, one of PENDING/APPROVED/FLAGGED/IGNORED/FAILED. Omitted = all.
 *   page     - 1-based, default 1.
 *   pageSize - default 20, capped at 50.
 *   q        - optional free-text search over repoFullName/filePath.
 *
 * Response: { findings: FindingSummary[], page, pageSize, total, totalPages }
 * FindingSummary = { id, repoFullName, filePath, matchedRule, status, commitSha, createdAt }
 *
 * Intentionally does NOT include redactedSnippet — deferred to M05 Finding
 * Detail per state/modules/M04.json scopeNotes (the Findings list Figma
 * screen has no secret-preview column).
 *
 * Auth: ADMIN only (requireAdmin). After the 2026-08-17 scope correction
 * there is no end-user dashboard consumer left — the admin review-queue is
 * the only caller of this route.
 */
export async function GET(request: NextRequest) {
  const { session, error } = await requireAdmin();
  if (error) {
    return NextResponse.json({ error }, { status: error === "forbidden" ? 403 : 401 });
  }
  // Referenced to make the auth dependency explicit even though this route
  // does not otherwise scope data by user.
  void session;

  const parsed = parseFindingsQuery(request.nextUrl.searchParams);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid query", issues: parsed.error.issues.map((i) => i.message) },
      { status: 400 }
    );
  }

  const result = await listFindings(parsed.data);
  return NextResponse.json(result);
}
