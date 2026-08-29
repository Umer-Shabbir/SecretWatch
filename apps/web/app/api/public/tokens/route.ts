import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { encrypt, maskToken } from "@/lib/token-crypto";
import { PAT_PATTERN } from "@/lib/pat-format";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

/**
 * POST /api/public/tokens
 *
 * Public, no-login endpoint (Part 2 of the 2026-08-17 scope correction):
 * any visitor can submit a GitHub personal access token for scanning
 * purposes. Intentionally has NO auth guard — this is the one deliberate
 * exception to "every mutating route requires a session" in this codebase.
 * In place of auth, this route is protected by:
 *   - IP-based rate limiting (see lib/rate-limit.ts; in-memory for now, see
 *     that file's doc comment for the production Redis/Upstash follow-up).
 *   - Zod validation of the token against the same PAT_PATTERN used
 *     client-side, so a malformed value never reaches encrypt()/the DB.
 *
 * SECURITY: the raw token value is never logged, echoed back in the
 * response, or written to the audit log. It exists in memory only long
 * enough to be encrypted and masked, then falls out of scope. Every error
 * path below returns a generic message — never the parsed body, never a
 * stack trace that could embed the submitted value.
 *
 * Body: { token: string }
 * Response (success, 201): { maskedIdentifier: string }
 * Response (rate limited, 429): { error: "rate_limited" }
 * Response (invalid, 400): { error: "invalid_token" }
 */
const submitTokenSchema = z.object({
  token: z
    .string()
    .trim()
    .min(20, "Token is too short")
    .max(255, "Token is too long")
    .regex(PAT_PATTERN, "Token does not match a recognized GitHub token format"),
});

const RATE_LIMIT = { limit: 5, windowMs: 60_000 };

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const { allowed, retryAfterMs } = await checkRateLimit(`public-tokens:${ip}`, RATE_LIMIT);
  if (!allowed) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(Math.ceil(retryAfterMs / 1000)) } }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = submitTokenSchema.safeParse(body);
  if (!parsed.success) {
    // Never include the raw submitted value in the response — only zod's
    // static issue messages, which never echo the input string.
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
        source: "pat",
        scopes: [],
        active: true,
      },
      select: { id: true },
    });
    createdId = created.id;
  } catch {
    // Generic failure message — never surface encryption/DB internals, and
    // never reference `parsed.data.token` again on this path.
    return NextResponse.json({ error: "submission_failed" }, { status: 500 });
  }

  await recordAudit({
    userId: null,
    action: "public_token_submitted",
    detail: `tokenId=${createdId} source=pat`,
  });

  return NextResponse.json({ maskedIdentifier }, { status: 201 });
}
