import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authorize";
import { getFindingDetail } from "@/lib/findings";

/**
 * GET /api/findings/:id
 *
 * Returns full finding detail: id, repoFullName, filePath, commitSha (FULL,
 * not the 7-char short form used by the list endpoint — the detail view
 * shows full commit context per Figma), matchedRule, redactedSnippet,
 * status, createdAt.
 *
 * `redactedSnippet` is read-only passthrough of a value already redacted at
 * write time (packages/shared/src/redact.ts) — the raw secret is never
 * persisted anywhere, so there is nothing to leak here. No other field on
 * Finding can carry raw secret material (see schema.prisma).
 *
 * Auth: ADMIN only (requireAdmin). After the 2026-08-17 scope correction
 * there is no end-user findings page left — only the admin dashboard reads
 * finding detail.
 *
 * 404 if the finding does not exist.
 */
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const { error } = await requireAdmin();
  if (error) {
    return NextResponse.json({ error }, { status: error === "forbidden" ? 403 : 401 });
  }

  const finding = await getFindingDetail(params.id);
  if (!finding) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json({ finding });
}
