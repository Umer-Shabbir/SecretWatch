import { Worker, type Job } from "bullmq";
import { QUEUE_NAMES, getRedisConnectionOptions } from "@secretwatch/shared";
import { prisma } from "./db";
import { getSystemSettings } from "./system-settings";
import { searchCode } from "./github-client";
import { evaluateAllRules, type EvaluableRule } from "./rules/engine";

/**
 * Scanner worker (ARCHITECTURE.md §5/§6). Consumes `scan-queue` jobs. Each
 * job scans one enabled ScanRule (job data carries the ruleId so scans are
 * sharded by rule, spreading GitHub Search API rate-limit usage across
 * separate jobs rather than one giant multi-pattern query).
 *
 * For each genuine match: writes a Finding row (status defaults PENDING),
 * de-duplicated on (repoFullName, filePath, commitSha, matchedRule) via the
 * DB-level unique constraint added in
 * apps/web/prisma/migrations/20260816140000_add_finding_dedup_constraint.
 *
 * SECURITY: never logs the raw matched secret or the decrypted GitHub token.
 * Only `redactedSnippet` (already masked by rules/engine.ts) is ever passed
 * to prisma.finding upsert.
 */

export interface ScanJobData {
  ruleId: string;
  /** Optional explicit search query override; defaults to a query derived from the rule. */
  query?: string;
}

const DEFAULT_SEARCH_PAGE_SIZE = 30;

/** GitHub code-search caps per_page at 100; keep at least 1 result per request. Guards against an out-of-range admin setting reaching the API. */
function clampPageSize(n: number): number {
  if (!Number.isFinite(n) || n < 1) return DEFAULT_SEARCH_PAGE_SIZE;
  return Math.min(100, Math.floor(n));
}

/** Builds a GitHub code search query string for a rule's characteristic prefix, to shard scans (ARCHITECTURE.md §5). */
function buildQueryForRule(rule: { name: string }): string {
  // Conservative, generic query per rule name — refined per-rule below where
  // a known literal prefix exists (keeps queries efficient and GitHub-search
  // syntax valid, since GitHub code search does not support arbitrary regex).
  const known: Record<string, string> = {
    "AWS Access Key": "AKIA in:file",
    "AWS Secret Key": "aws_secret_access_key in:file",
    "GitHub Token": "ghp_ in:file",
    "Stripe Secret Key": "sk_live_ in:file",
    "Slack Token": "xoxb- in:file",
    "Generic High-Entropy String": "secret in:file",
  };
  return known[rule.name] ?? `${rule.name} in:file`;
}

/** Picks an active GithubToken to authenticate the search request (round-robin by lastUsedAt would be M07's flagger concern; scanner just needs any valid active token). */
async function pickActiveToken() {
  return prisma.githubToken.findFirst({
    where: { active: true },
    orderBy: { lastUsedAt: "asc" },
    select: { id: true, encrypted: true },
  });
}

/** Derives a short display commit SHA. GitHub's code search `sha` field is the blob SHA of the matched file at index time — used here as the commitSha field per the Finding schema's single `commitSha` column (no separate blob/commit distinction exists in the data model). */
function toCommitSha(sha: string): string {
  return sha;
}

export async function runScanForRule(ruleId: string, queryOverride?: string): Promise<{ created: number; skipped: number }> {
  // Per-job defense against the master scanner switch (dashboard toggle). The
  // scheduler already skips enqueueing when off, but a job could have been
  // enqueued before the switch flipped, or triggered manually — so re-check
  // here. Fails OPEN (see system-settings.ts) on DB error.
  const { scannerEnabled, scanResultsPerRule } = await getSystemSettings();
  if (!scannerEnabled) {
    return { created: 0, skipped: 0 };
  }

  const rule = await prisma.scanRule.findUnique({ where: { id: ruleId } });
  if (!rule || !rule.enabled) {
    return { created: 0, skipped: 0 };
  }

  const token = await pickActiveToken();
  if (!token) {
    // No usable credential yet (e.g. fresh install, no user has connected a
    // token) — nothing to scan with. Not an error condition worth failing
    // the job over; just no-op.
    return { created: 0, skipped: 0 };
  }

  const evaluable: EvaluableRule = { name: rule.name, pattern: rule.pattern, kind: inferKind(rule.name) };
  const query = queryOverride ?? buildQueryForRule(rule);

  const results = await searchCode(token.encrypted, query, 1, clampPageSize(scanResultsPerRule));

  await prisma.githubToken.update({
    where: { id: token.id },
    data: { lastUsedAt: new Date() },
  });

  let created = 0;
  let skipped = 0;

  for (const result of results) {
    for (const fragment of result.fragments) {
      const matches = await evaluateAllRules([evaluable], fragment);
      for (const match of matches) {
        const commitSha = toCommitSha(result.sha);
        const wasCreated = await upsertFinding({
          repoFullName: result.repoFullName,
          filePath: result.filePath,
          commitSha,
          matchedRule: match.ruleName,
          redactedSnippet: match.redactedSnippet,
        });
        if (wasCreated) created++;
        else skipped++;
      }
    }
  }

  return { created, skipped };
}

function inferKind(ruleName: string): "regex" | "entropy" {
  return ruleName === "Generic High-Entropy String" ? "entropy" : "regex";
}

/**
 * Idempotent Finding creation. Relies on the DB unique constraint
 * (repoFullName, filePath, commitSha, matchedRule) so concurrent/repeated
 * scans of the same commit never create duplicate rows, even under race
 * conditions between worker instances. Returns true if a new row was
 * created, false if it already existed (skipped).
 */
export async function upsertFinding(data: {
  repoFullName: string;
  filePath: string;
  commitSha: string;
  matchedRule: string;
  redactedSnippet: string;
}): Promise<boolean> {
  try {
    await prisma.finding.create({
      data: {
        repoFullName: data.repoFullName,
        filePath: data.filePath,
        commitSha: data.commitSha,
        matchedRule: data.matchedRule,
        redactedSnippet: data.redactedSnippet,
      },
    });
    return true;
  } catch (err: unknown) {
    // Prisma unique constraint violation code P2002 -> already scanned this
    // exact commit/file/rule combination. Anything else re-throws.
    if (isUniqueConstraintError(err)) {
      return false;
    }
    throw err;
  }
}

function isUniqueConstraintError(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: string }).code === "P2002";
}

export function createScannerWorker(): Worker<ScanJobData> {
  return new Worker<ScanJobData>(
    QUEUE_NAMES.SCAN,
    async (job: Job<ScanJobData>) => {
      const { ruleId, query } = job.data;
      const outcome = await runScanForRule(ruleId, query);
      return outcome;
    },
    {
      connection: getRedisConnectionOptions(),
      concurrency: 2, // ARCHITECTURE.md §5: keep low to respect GitHub's ~30 req/min authed search limit
    }
  );
}
