import { z } from "zod";
import { prisma } from "@/lib/db";

/**
 * Flags history data access (M07). Mirrors the lib/findings.ts pattern
 * (M04): Zod query schema, a list function returning a plain result object,
 * a thin parse adapter for the route boundary.
 *
 * A "flag row" is one flag ATTEMPT — either a successful Finding+Flag join
 * (status FLAGGED) or a Finding with no Flag row (status FAILED, carrying
 * `failureReason`). Never a fabricated Flag.status field — see
 * ARCHITECTURE.md's Flag model and state/modules/M07.json productDecisionNotes.
 *
 * SECURITY: never selects GithubToken.encrypted here. Only
 * GithubToken.maskedIdentifier (already display-safe, computed at
 * connect-time per lib/tokens.ts) is joined in for the TOKEN column.
 */

export const FLAG_ROW_STATUSES = ["FLAGGED", "FAILED"] as const;
export type FlagRowStatusValue = (typeof FLAG_ROW_STATUSES)[number];

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;

export const flagsListQuerySchema = z.object({
  status: z.enum(FLAG_ROW_STATUSES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
});

export type FlagsListQuery = z.infer<typeof flagsListQuerySchema>;

export interface FlagRow {
  id: string;
  repoFullName: string;
  filePath: string;
  matchedRule: string;
  status: FlagRowStatusValue;
  issueRef: string | null;
  issueUrl: string | null;
  failureReason: string | null;
  templateName: string | null;
  maskedTokenIdentifier: string | null;
  postedAt: string; // ISO 8601
}

export interface FlagsListResult {
  flags: FlagRow[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  summary: {
    totalAttempts: number;
    successful: number;
    failed: number;
  };
}

/** Derives "owner/repo#123" from a GitHub issue HTML URL, e.g. https://github.com/acme/shop/issues/88 -> acme/shop#88. */
export function toIssueRef(repoFullName: string, issueUrl: string): string {
  const match = issueUrl.match(/\/issues\/(\d+)(?:$|[/?#])/);
  const number = match ? match[1] : "?";
  return `${repoFullName}#${number}`;
}

export function parseFlagsQuery(searchParams: URLSearchParams) {
  return flagsListQuerySchema.safeParse({
    status: searchParams.get("status") ?? undefined,
    page: searchParams.get("page") ?? undefined,
    pageSize: searchParams.get("pageSize") ?? undefined,
  });
}

/**
 * Lists flag attempts (FLAGGED findings with their Flag join, and FAILED
 * findings) newest-first. FLAGGED rows order by Flag.postedAt; FAILED rows
 * order by Finding.createdAt — both merged and re-sorted in application
 * code since they come from different underlying orderings across a status
 * filter that spans both.
 */
export async function listFlags(query: FlagsListQuery): Promise<FlagsListResult> {
  const { status, page, pageSize } = query;

  const statusFilter: Array<"FLAGGED" | "FAILED"> =
    status === "FLAGGED" ? ["FLAGGED"] : status === "FAILED" ? ["FAILED"] : ["FLAGGED", "FAILED"];

  const [total, successful, failed] = await Promise.all([
    prisma.finding.count({ where: { status: { in: statusFilter } } }),
    prisma.finding.count({ where: { status: "FLAGGED" } }),
    prisma.finding.count({ where: { status: "FAILED" } }),
  ]);

  // Fetch a superset (all matching rows up to a sane cap) so FLAGGED/FAILED
  // can be merged and re-sorted by a single "postedAt" timeline before
  // paginating in-memory. Flags history is not expected to reach a size
  // where this becomes a real cost; revisit with a UNION query if it does.
  const CAP = 2000;
  const rows = await prisma.finding.findMany({
    where: { status: { in: statusFilter } },
    orderBy: { createdAt: "desc" },
    take: CAP,
    select: {
      id: true,
      repoFullName: true,
      filePath: true,
      matchedRule: true,
      status: true,
      createdAt: true,
      failureReason: true,
      flag: {
        select: {
          issueUrl: true,
          postedAt: true,
          usedTokenId: true,
          templateId: true,
        },
      },
    },
  });

  const tokenIds = Array.from(new Set(rows.map((r) => r.flag?.usedTokenId).filter((v): v is string => Boolean(v))));
  const templateIds = Array.from(new Set(rows.map((r) => r.flag?.templateId).filter((v): v is string => Boolean(v))));

  const [tokens, templates] = await Promise.all([
    tokenIds.length
      ? prisma.githubToken.findMany({ where: { id: { in: tokenIds } }, select: { id: true, maskedIdentifier: true } })
      : Promise.resolve([]),
    templateIds.length
      ? prisma.messageTemplate.findMany({ where: { id: { in: templateIds } }, select: { id: true, name: true } })
      : Promise.resolve([]),
  ]);
  const tokenById = new Map(tokens.map((t) => [t.id, t.maskedIdentifier]));
  const templateById = new Map(templates.map((t) => [t.id, t.name]));

  const flagRows: FlagRow[] = rows.map((row) => {
    if (row.status === "FLAGGED" && row.flag) {
      return {
        id: row.id,
        repoFullName: row.repoFullName,
        filePath: row.filePath,
        matchedRule: row.matchedRule,
        status: "FLAGGED",
        issueRef: toIssueRef(row.repoFullName, row.flag.issueUrl),
        issueUrl: row.flag.issueUrl,
        failureReason: null,
        templateName: templateById.get(row.flag.templateId) ?? null,
        maskedTokenIdentifier: tokenById.get(row.flag.usedTokenId) ?? null,
        postedAt: row.flag.postedAt.toISOString(),
      };
    }
    return {
      id: row.id,
      repoFullName: row.repoFullName,
      filePath: row.filePath,
      matchedRule: row.matchedRule,
      status: "FAILED",
      issueRef: null,
      issueUrl: null,
      failureReason: row.failureReason,
      templateName: null,
      maskedTokenIdentifier: null,
      postedAt: row.createdAt.toISOString(),
    };
  });

  flagRows.sort((a, b) => new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime());

  const start = (page - 1) * pageSize;
  const paged = flagRows.slice(start, start + pageSize);

  return {
    flags: paged,
    page,
    pageSize,
    total,
    totalPages: Math.max(Math.ceil(total / pageSize), 1),
    summary: {
      totalAttempts: successful + failed,
      successful,
      failed,
    },
  };
}
