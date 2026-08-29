/**
 * Shared API/data contract types for M04 (Scanner + Findings).
 * Kept dependency-free (no Prisma import) so both apps/web and apps/worker
 * can use these without generating two different Prisma Client types against
 * the same shape.
 */

export type FindingStatus = "PENDING" | "APPROVED" | "FLAGGED" | "IGNORED" | "FAILED";

export const FINDING_STATUSES: FindingStatus[] = ["PENDING", "APPROVED", "FLAGGED", "IGNORED", "FAILED"];

export type FindingSeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export const FINDING_SEVERITIES: FindingSeverity[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];

/**
 * Row shape returned by GET /api/findings.
 *
 * Deliberately excludes `redactedSnippet` — per state/modules/M04.json
 * scopeNotes, the Findings LIST screen does not show any secret preview;
 * that is explicitly deferred to M05 Finding Detail. Do not add it here
 * without a corresponding Figma/product decision for M04's list screen.
 */
export interface FindingSummary {
  id: string;
  repoFullName: string;
  filePath: string;
  matchedRule: string;
  status: FindingStatus;
  severity?: FindingSeverity | null;
  /** Short display form, e.g. first 7 chars of the full commit SHA. */
  commitSha: string;
  createdAt: string; // ISO 8601
}

export interface FindingsListResponse {
  findings: FindingSummary[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface FindingsListQuery {
  status?: FindingStatus;
  page?: number;
  pageSize?: number;
  q?: string;
}

/**
 * Row shape returned by GET /api/flags (M07). One row per flag ATTEMPT, not
 * per Flag DB row — a Finding with status FLAGGED joins its Flag row for
 * issue/template/token display; a Finding with status FAILED has no Flag
 * row and instead surfaces `failureReason`, with `issueUrl`/`templateName`/
 * `maskedTokenIdentifier` left null (Figma "Dashboard / Flags / Default",
 * state/modules/M07.json productDecisionNotes: no fabricated Flag.status
 * field — FAILED is represented via Finding.status alone).
 */
export type FlagRowStatus = "FLAGGED" | "FAILED";

export interface FlagRow {
  id: string; // Finding.id — stable row identity for both FLAGGED and FAILED rows
  repoFullName: string;
  filePath: string;
  matchedRule: string;
  status: FlagRowStatus;
  /** FLAGGED only: e.g. "acme/payment-api#412". Null for FAILED rows. */
  issueRef: string | null;
  /** FLAGGED only: full issue URL for the issueRef link target. Null for FAILED rows. */
  issueUrl: string | null;
  /** FAILED only: short non-secret failure reason. Null for FLAGGED rows. */
  failureReason: string | null;
  /** FLAGGED only: MessageTemplate.name used. Null for FAILED rows. */
  templateName: string | null;
  /** FLAGGED only: masked token reference, e.g. "Personal token (····8f2a)". Null for FAILED rows. */
  maskedTokenIdentifier: string | null;
  /** ISO 8601 — Flag.postedAt for FLAGGED rows, Finding.createdAt for FAILED rows (no other timestamp exists for a failed attempt). */
  postedAt: string;
}

export interface FlagsListResponse {
  flags: FlagRow[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  /** Summary counts for the subtitle, e.g. "128 flag attempts · 121 successful · 7 failed". */
  summary: {
    totalAttempts: number;
    successful: number;
    failed: number;
  };
}

export type FlagsListFilter = "ALL" | "FLAGGED" | "FAILED";

/** flag-queue job payload (M07), shared between apps/web's producer (lib/queue.ts) and apps/worker's consumer (flagger.worker.ts). */
export interface FlagJobData {
  findingId: string;
}
