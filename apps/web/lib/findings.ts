import { z } from "zod";
import { prisma } from "@/lib/db";

/**
 * Findings list query/response contract (M04).
 *
 * Deliberately excludes `redactedSnippet` from FindingSummary — per
 * state/modules/M04.json scopeNotes, the Figma Findings LIST screen does
 * not show any secret preview; that's explicitly deferred to M05 Finding
 * Detail. Do not add it here without a corresponding product/Figma decision.
 */
export const FINDING_STATUSES = ["PENDING", "APPROVED", "FLAGGED", "IGNORED", "FAILED"] as const;
export type FindingStatusValue = (typeof FINDING_STATUSES)[number];

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;

export const findingsListQuerySchema = z.object({
  status: z.enum(FINDING_STATUSES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
  q: z.string().trim().max(200).optional(),
});

export type FindingsListQuery = z.infer<typeof findingsListQuerySchema>;

export interface FindingSummary {
  id: string;
  repoFullName: string;
  filePath: string;
  matchedRule: string;
  status: FindingStatusValue;
  /** Short display form of the commit SHA (first 7 chars), matching GitHub's own convention. */
  commitSha: string;
  createdAt: string; // ISO 8601
}

export interface FindingsListResult {
  findings: FindingSummary[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

/**
 * Full finding detail shape (M05). Includes `redactedSnippet` — this is
 * read-only passthrough of a value that is already redacted at write time
 * by packages/shared/src/redact.ts (never the raw secret). Also includes
 * the FULL commitSha (not the 7-char short form used in the list), since
 * the Finding Detail Figma screen shows full commit context.
 *
 * Deliberately does NOT include any other column that could ever carry raw
 * secret material — Finding has no such column today (see schema.prisma),
 * but if one is ever added, it must not be selected here without an
 * explicit product/security decision.
 */
export interface FindingDetail {
  id: string;
  repoFullName: string;
  filePath: string;
  commitSha: string;
  matchedRule: string;
  redactedSnippet: string;
  status: FindingStatusValue;
  createdAt: string; // ISO 8601
}

const FINDING_DETAIL_SELECT = {
  id: true,
  repoFullName: true,
  filePath: true,
  commitSha: true,
  matchedRule: true,
  redactedSnippet: true,
  status: true,
  createdAt: true,
} as const;

type FindingDetailRow = {
  id: string;
  repoFullName: string;
  filePath: string;
  commitSha: string;
  matchedRule: string;
  redactedSnippet: string;
  status: FindingStatusValue;
  createdAt: Date;
};

function toFindingDetail(row: FindingDetailRow): FindingDetail {
  return {
    id: row.id,
    repoFullName: row.repoFullName,
    filePath: row.filePath,
    commitSha: row.commitSha,
    matchedRule: row.matchedRule,
    redactedSnippet: row.redactedSnippet,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Fetches one finding's full detail by id. Returns null if not found. */
export async function getFindingDetail(id: string): Promise<FindingDetail | null> {
  const row = await prisma.finding.findUnique({
    where: { id },
    select: FINDING_DETAIL_SELECT,
  });
  if (!row) return null;
  return toFindingDetail(row);
}

export class InvalidFindingTransitionError extends Error {
  constructor(
    public readonly currentStatus: FindingStatusValue,
    public readonly attemptedStatus: "APPROVED" | "IGNORED"
  ) {
    super(`Cannot transition finding from ${currentStatus} to ${attemptedStatus}`);
    this.name = "InvalidFindingTransitionError";
  }
}

/**
 * Transitions a PENDING finding to APPROVED.
 *
 * Per the M05 task spec, this only flips status — it does not enqueue or
 * otherwise talk to a flag-queue, since M07 (Flagger) does not exist yet.
 * Once APPROVED, the finding is "ready" for M07's flagger worker to later
 * pick up and create a GitHub issue via an authorized token.
 *
 * Only PENDING -> APPROVED is a valid transition here. Any other current
 * status (including an already-APPROVED row) throws
 * InvalidFindingTransitionError so the route can map it to 409.
 *
 * Uses a conditional updateMany (status: "PENDING" in the where clause)
 * rather than read-then-write, so concurrent requests cannot both succeed
 * in flipping the same row (only one updateMany can match/affect the row
 * while it is still PENDING).
 */
export async function approveFinding(id: string): Promise<FindingDetail> {
  const existing = await prisma.finding.findUnique({
    where: { id },
    select: FINDING_DETAIL_SELECT,
  });
  if (!existing) {
    throw new FindingNotFoundError(id);
  }
  if (existing.status !== "PENDING") {
    throw new InvalidFindingTransitionError(existing.status, "APPROVED");
  }

  const result = await prisma.finding.updateMany({
    where: { id, status: "PENDING" },
    data: { status: "APPROVED" },
  });

  if (result.count === 0) {
    // Lost a race to a concurrent transition between the read above and
    // this write — re-read to report the real current status.
    const refreshed = await prisma.finding.findUnique({
      where: { id },
      select: FINDING_DETAIL_SELECT,
    });
    throw new InvalidFindingTransitionError(
      refreshed?.status ?? existing.status,
      "APPROVED"
    );
  }

  const updated = await prisma.finding.findUnique({
    where: { id },
    select: FINDING_DETAIL_SELECT,
  });
  return toFindingDetail(updated!);
}

/**
 * Transitions a PENDING finding to IGNORED.
 *
 * Only PENDING -> IGNORED is valid (matches the Figma state set: Approved/
 * Flagged/Ignored are terminal states in this module's scope; the only
 * two outgoing transitions from Pending are Approve and Ignore). Same
 * concurrency-safe conditional-update approach as approveFinding.
 */
export async function ignoreFinding(id: string): Promise<FindingDetail> {
  const existing = await prisma.finding.findUnique({
    where: { id },
    select: FINDING_DETAIL_SELECT,
  });
  if (!existing) {
    throw new FindingNotFoundError(id);
  }
  if (existing.status !== "PENDING") {
    throw new InvalidFindingTransitionError(existing.status, "IGNORED");
  }

  const result = await prisma.finding.updateMany({
    where: { id, status: "PENDING" },
    data: { status: "IGNORED" },
  });

  if (result.count === 0) {
    const refreshed = await prisma.finding.findUnique({
      where: { id },
      select: FINDING_DETAIL_SELECT,
    });
    throw new InvalidFindingTransitionError(
      refreshed?.status ?? existing.status,
      "IGNORED"
    );
  }

  const updated = await prisma.finding.findUnique({
    where: { id },
    select: FINDING_DETAIL_SELECT,
  });
  return toFindingDetail(updated!);
}

export class FindingNotFoundError extends Error {
  constructor(public readonly id: string) {
    super(`Finding not found: ${id}`);
    this.name = "FindingNotFoundError";
  }
}

function toShortSha(sha: string): string {
  return sha.length > 7 ? sha.slice(0, 7) : sha;
}

/**
 * Parses raw URLSearchParams into a validated query object. Throws a
 * ZodError (caller should catch via safeParse at the route boundary) on
 * invalid input — kept as a thin adapter so the route handler stays small.
 */
export function parseFindingsQuery(searchParams: URLSearchParams) {
  return findingsListQuerySchema.safeParse({
    status: searchParams.get("status") ?? undefined,
    page: searchParams.get("page") ?? undefined,
    pageSize: searchParams.get("pageSize") ?? undefined,
    q: searchParams.get("q") ?? undefined,
  });
}

export async function listFindings(query: FindingsListQuery): Promise<FindingsListResult> {
  const { status, page, pageSize, q } = query;

  const where: Record<string, unknown> = {};
  if (status) {
    where.status = status;
  }
  if (q) {
    where.OR = [
      { repoFullName: { contains: q, mode: "insensitive" } },
      { filePath: { contains: q, mode: "insensitive" } },
    ];
  }

  const [total, rows] = await Promise.all([
    prisma.finding.count({ where }),
    prisma.finding.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        repoFullName: true,
        filePath: true,
        matchedRule: true,
        status: true,
        commitSha: true,
        createdAt: true,
      },
    }),
  ]);

  const findings: FindingSummary[] = rows.map((row) => ({
    id: row.id,
    repoFullName: row.repoFullName,
    filePath: row.filePath,
    matchedRule: row.matchedRule,
    status: row.status,
    commitSha: toShortSha(row.commitSha),
    createdAt: row.createdAt.toISOString(),
  }));

  return {
    findings,
    page,
    pageSize,
    total,
    totalPages: Math.max(Math.ceil(total / pageSize), 1),
  };
}
