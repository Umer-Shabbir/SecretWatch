import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/authorize";
import { prisma } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { encrypt, maskToken } from "@/lib/token-crypto";
import { PAT_PATTERN } from "@/lib/pat-format";
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

/**
 * POST /api/tokens
 *
 * Admin-only manual token add (2026-08-24 admin-control addition). Lets an
 * admin add a GitHub token straight into the pool from the dashboard, in
 * addition to the public /submit-token path. Stored with source="manual" to
 * distinguish admin-added tokens from publicly submitted ones ("pat").
 *
 * SECURITY: mirrors POST /api/public/tokens exactly — the raw token exists in
 * memory only long enough to encrypt + mask, is never logged, never echoed
 * back, and never written to the audit log. Only the maskedIdentifier is
 * returned.
 *
 * Authorization: ADMIN only.
 * Body: { token: string }
 * Response (201): { token: AdminTokenSummary-shaped id+maskedIdentifier }
 */
const addTokenSchema = z.object({
  token: z
    .string()
    .trim()
    .min(20, "Token is too short")
    .max(255, "Token is too long")
    .regex(PAT_PATTERN, "Token does not match a recognized GitHub token format"),
});

export async function POST(request: NextRequest) {
  const { session, error } = await requireAdmin();
  if (error === "unauthenticated") {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  if (error === "forbidden") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = addTokenSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_token", issues: parsed.error.issues.map((i) => i.message) },
      { status: 400 }
    );
  }

  let maskedIdentifier: string;
  let createdId: string;
  try {
    const plaintext = parsed.data.token;
    const encrypted = encrypt(plaintext);
    maskedIdentifier = maskToken(plaintext);

    const created = await prisma.githubToken.create({
      data: {
        encrypted,
        maskedIdentifier,
        source: "manual",
        scopes: [],
        active: true,
      },
      select: { id: true },
    });
    createdId = created.id;
  } catch {
    return NextResponse.json({ error: "submission_failed" }, { status: 500 });
  }

  await recordAudit({
    userId: session!.user.id,
    action: "admin_token_added",
    detail: `tokenId=${createdId} source=manual`,
  });

  return NextResponse.json({ token: { id: createdId, maskedIdentifier } }, { status: 201 });
}
