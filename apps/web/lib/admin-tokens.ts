import { prisma } from "@/lib/db";

/**
 * Admin-facing GithubToken data access (Part 2.3 of the 2026-08-17 scope
 * correction). GithubToken has no per-user ownership after the schema
 * change in Part 1.6 — every row is visible to admins, submitted either
 * publicly (POST /api/public/tokens, source="pat") or, historically, via the
 * removed per-user OAuth flow.
 *
 * SECURITY: never selects/returns GithubToken.encrypted. Only the
 * precomputed maskedIdentifier (safe-by-construction, computed once at
 * submission time — see lib/token-crypto.ts) is exposed. This mirrors the
 * boundary lib/tokens.ts (removed) previously enforced for the per-user
 * token view.
 */

export interface AdminTokenSummary {
  id: string;
  maskedIdentifier: string | null;
  source: string;
  scopes: string[];
  lastUsedAt: string | null;
  rateLimitRemaining: number | null;
  active: boolean;
  createdAt: string; // ISO 8601
}

const ADMIN_TOKEN_SELECT = {
  id: true,
  maskedIdentifier: true,
  source: true,
  scopes: true,
  lastUsedAt: true,
  rateLimitRemaining: true,
  active: true,
  createdAt: true,
} as const;

type AdminTokenRow = {
  id: string;
  maskedIdentifier: string | null;
  source: string;
  scopes: string[];
  lastUsedAt: Date | null;
  rateLimitRemaining: number | null;
  active: boolean;
  createdAt: Date;
};

function toAdminTokenSummary(row: AdminTokenRow): AdminTokenSummary {
  return {
    id: row.id,
    maskedIdentifier: row.maskedIdentifier,
    source: row.source,
    scopes: row.scopes,
    lastUsedAt: row.lastUsedAt ? row.lastUsedAt.toISOString() : null,
    rateLimitRemaining: row.rateLimitRemaining,
    active: row.active,
    createdAt: row.createdAt.toISOString(),
  };
}

export class GithubTokenNotFoundError extends Error {
  constructor(public readonly id: string) {
    super(`GitHub token not found: ${id}`);
    this.name = "GithubTokenNotFoundError";
  }
}

/** Returns all submitted GitHub tokens, newest first. Never includes `encrypted`. */
export async function listAdminTokens(): Promise<AdminTokenSummary[]> {
  const rows = await prisma.githubToken.findMany({
    orderBy: { createdAt: "desc" },
    select: ADMIN_TOKEN_SELECT,
  });
  return rows.map(toAdminTokenSummary);
}

/**
 * Deactivates (soft-deletes) a token: active=false. Mirrors the removed
 * per-user revoke pattern (apps/web/app/api/tokens/[id]/route.ts, DELETE),
 * now admin-scoped since there is no owning user to check against. Soft
 * delete rather than a hard row delete — preserves the row for audit/history
 * and for any Flag rows still referencing a past usedTokenId.
 *
 * Idempotent: deactivating an already-inactive token succeeds as a no-op
 * (returns the row unchanged) rather than erroring.
 */
export async function deactivateAdminToken(id: string): Promise<AdminTokenSummary> {
  const existing = await prisma.githubToken.findUnique({ where: { id }, select: ADMIN_TOKEN_SELECT });
  if (!existing) {
    throw new GithubTokenNotFoundError(id);
  }

  if (!existing.active) {
    return toAdminTokenSummary(existing);
  }

  const row = await prisma.githubToken.update({
    where: { id },
    data: { active: false },
    select: ADMIN_TOKEN_SELECT,
  });

  return toAdminTokenSummary(row);
}
