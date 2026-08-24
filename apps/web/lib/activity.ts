import { prisma } from "@/lib/db";
import { getLiveQueueCounts } from "@/lib/workers";

/**
 * Live worker activity for the admin Overview (2026-08-24 admin-control
 * addition). Answers the operator question "what are the workers actually
 * doing right now?":
 *
 *   - Scanner panel: live scan-queue depth (active/waiting) + the most recent
 *     Findings the scanner has written (what it FOUND).
 *   - Flagger panel: live flag-queue depth + the most recent Flags opened
 *     (what it FLAGGED) and the most recent flag FAILURES.
 *
 * Findings/Flags come from the DB; queue depth comes from BullMQ via
 * lib/workers.ts. Read-only. If Redis is unreachable, queue depth degrades to
 * null (the DB feed still renders) rather than failing the whole panel.
 *
 * SECURITY: only ever selects non-secret Finding/Flag columns
 * (repoFullName/filePath/matchedRule/status/issueUrl/timestamps). Never
 * selects redactedSnippet, and there is no raw secret anywhere in this data.
 */

const FEED_LIMIT = 8;

export interface ScannerFind {
  id: string;
  repoFullName: string;
  filePath: string;
  matchedRule: string;
  status: string;
  createdAt: string; // ISO 8601
}

export interface FlaggerFlag {
  id: string;
  repoFullName: string;
  matchedRule: string;
  issueUrl: string;
  postedAt: string; // ISO 8601
}

export interface FlaggerFailure {
  id: string;
  repoFullName: string;
  matchedRule: string;
  failureReason: string | null;
}

export interface QueueDepth {
  active: number;
  waiting: number;
}

export interface LiveActivity {
  generatedAt: string;
  scanner: {
    queue: QueueDepth | null; // null when Redis is unreachable
    totalFound: number;
    recent: ScannerFind[];
  };
  flagger: {
    queue: QueueDepth | null;
    totalFlagged: number;
    totalFailed: number;
    recent: FlaggerFlag[];
    recentFailures: FlaggerFailure[];
  };
}

async function safeQueueDepth(key: "scanner" | "flagger"): Promise<QueueDepth | null> {
  try {
    return await getLiveQueueCounts(key);
  } catch {
    return null;
  }
}

export async function getLiveActivity(): Promise<LiveActivity> {
  const [
    recentFindings,
    totalFound,
    recentFlags,
    totalFlagged,
    recentFailures,
    totalFailed,
    scannerQueue,
    flaggerQueue,
  ] = await Promise.all([
    prisma.finding.findMany({
      orderBy: { createdAt: "desc" },
      take: FEED_LIMIT,
      select: {
        id: true,
        repoFullName: true,
        filePath: true,
        matchedRule: true,
        status: true,
        createdAt: true,
      },
    }),
    prisma.finding.count(),
    prisma.flag.findMany({
      orderBy: { postedAt: "desc" },
      take: FEED_LIMIT,
      select: {
        id: true,
        issueUrl: true,
        postedAt: true,
        finding: { select: { repoFullName: true, matchedRule: true } },
      },
    }),
    prisma.flag.count(),
    prisma.finding.findMany({
      where: { status: "FAILED" },
      orderBy: { createdAt: "desc" },
      take: FEED_LIMIT,
      select: { id: true, repoFullName: true, matchedRule: true, failureReason: true },
    }),
    prisma.finding.count({ where: { status: "FAILED" } }),
    safeQueueDepth("scanner"),
    safeQueueDepth("flagger"),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    scanner: {
      queue: scannerQueue,
      totalFound,
      recent: recentFindings.map((f) => ({
        id: f.id,
        repoFullName: f.repoFullName,
        filePath: f.filePath,
        matchedRule: f.matchedRule,
        status: f.status,
        createdAt: f.createdAt.toISOString(),
      })),
    },
    flagger: {
      queue: flaggerQueue,
      totalFlagged,
      totalFailed,
      recent: recentFlags.map((fl) => ({
        id: fl.id,
        repoFullName: fl.finding.repoFullName,
        matchedRule: fl.finding.matchedRule,
        issueUrl: fl.issueUrl,
        postedAt: fl.postedAt.toISOString(),
      })),
      recentFailures: recentFailures.map((f) => ({
        id: f.id,
        repoFullName: f.repoFullName,
        matchedRule: f.matchedRule,
        failureReason: f.failureReason,
      })),
    },
  };
}
