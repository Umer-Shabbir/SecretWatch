import { createHash } from "crypto";
import { dispatchWebhookEvent } from "./webhooks";
import { Queue, Worker, type Job } from "bullmq";
import { QUEUE_NAMES, getRedisConnectionOptions, type FlagJobData } from "@secretwatch/shared";
import { evaluateRepoFilters, type RepoFilterRule } from "@secretwatch/shared";
import { prisma } from "./db";
import { getSystemSettings } from "./system-settings";
import { searchCode } from "./github-client";
import { evaluateAllRules, type EvaluableRule } from "./rules/engine";
import { getActiveRepoFilters } from "./repo-filters";

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
  while (true) {
    const candidates = await prisma.githubToken.findMany({
      where: { active: true },
      orderBy: { lastUsedAt: "asc" },
      select: { id: true, encrypted: true, rateLimitRemaining: true, rateLimitResetAt: true, lastUsedAt: true },
    });

    if (candidates.length === 0) return null;

    const now = new Date();
    const healthy = candidates.find((t) => {
      if (t.rateLimitResetAt && t.rateLimitResetAt > now) {
        if (t.rateLimitRemaining !== null && t.rateLimitRemaining <= 0) {
          return false;
        }
      }
      return true;
    });

    const tokenToClaim = healthy ?? candidates[0];
    if (!tokenToClaim) return null;

    // Atomically claim the token by updating its lastUsedAt timestamp immediately.
    // This prevents concurrent worker jobs from picking the exact same token.
    const result = await prisma.githubToken.updateMany({
      where: {
        id: tokenToClaim.id,
        lastUsedAt: tokenToClaim.lastUsedAt,
      },
      data: { lastUsedAt: new Date() },
    });

    if (result.count > 0) {
      return tokenToClaim;
    }
  }
}

let sharedFlagQueue: Queue<FlagJobData> | null = null;
function getFlagQueue(): Queue<FlagJobData> {
  if (!sharedFlagQueue) {
    sharedFlagQueue = new Queue<FlagJobData>(QUEUE_NAMES.FLAG, {
      connection: getRedisConnectionOptions(),
    });
  }
  return sharedFlagQueue;
}

/** Derives a short display commit SHA. GitHub's code search `sha` field is the blob SHA of the matched file at index time — used here as the commitSha field per the Finding schema's single `commitSha` column (no separate blob/commit distinction exists in the data model). */
function toCommitSha(sha: string): string {
  return sha;
}

export async function runScanForRule(ruleId: string, queryOverride?: string): Promise<{ created: number; skipped: number; autoApproved: number }> {
  // Per-job defense against the master scanner switch (dashboard toggle). The
  // scheduler already skips enqueueing when off, but a job could have been
  // enqueued before the switch flipped, or triggered manually — so re-check
  // here. Fails OPEN (see system-settings.ts) on DB error.
  const { scannerEnabled, scanResultsPerRule, autoApproveEnabled, autoFlagEnabled } = await getSystemSettings();
  if (!scannerEnabled) {
    return { created: 0, skipped: 0, autoApproved: 0 };
  }

  const rule = await prisma.scanRule.findUnique({ where: { id: ruleId } });
  if (!rule || !rule.enabled) {
    return { created: 0, skipped: 0, autoApproved: 0 };
  }

  const token = await pickActiveToken();
  if (!token) {
    // No usable credential yet (e.g. fresh install, no user has connected a
    // token) — nothing to scan with. Not an error condition worth failing
    // the job over; just no-op.
    return { created: 0, skipped: 0, autoApproved: 0 };
  }

  const evaluable: EvaluableRule = { name: rule.name, pattern: rule.pattern, kind: inferKind(rule.name) };
  const query = queryOverride ?? buildQueryForRule(rule);

  const results = await searchCode(token.encrypted, token.id, query, 1, clampPageSize(scanResultsPerRule));

  await prisma.githubToken.update({
    where: { id: token.id },
    data: { lastUsedAt: new Date() },
  });

  // Load active repository filter rules (allowlist & blocklist) from in-memory cache
  const activeRepoFilters = await getActiveRepoFilters();

  let created = 0;
  let skipped = 0;
  let autoApproved = 0;
  const newFindingIds: string[] = [];

  for (const result of results) {
    // Check repository against allowlist and blocklist rules
    if (activeRepoFilters.length > 0) {
      const evaluation = evaluateRepoFilters(result.repoFullName, activeRepoFilters);
      if (!evaluation.allowed) {
        skipped++;
        continue;
      }
    }

    for (const fragment of result.fragments) {
      const matches = await evaluateAllRules([evaluable], fragment);
      for (const match of matches) {
        const commitSha = toCommitSha(result.sha);
        const severity = inferSeverityForRule(match.ruleName);

        // Compute SHA-256 for secret to utilize in deduplication as per ARCH-001
        // we use the matched secret from the engine
        const secretHash = createHash("sha256").update(match.matchedSecret).digest("hex");

        const findingResult = await upsertFinding({
          repoFullName: result.repoFullName,
          filePath: result.filePath,
          commitSha,
          matchedRule: match.ruleName,
          redactedSnippet: match.redactedSnippet,
          secretHash,
          severity,
          status: autoApproveEnabled ? "APPROVED" : "PENDING",
        });
        if (findingResult.wasCreated) {
          created++;

          // Dispatch finding.created webhook event
          const eventPayload = {
            id: findingResult.id,
            repoFullName: result.repoFullName,
            filePath: result.filePath,
            matchedRule: match.ruleName,
            severity,
            status: autoApproveEnabled ? "APPROVED" : "PENDING",
            autoApproved: autoApproveEnabled,
          };

          dispatchWebhookEvent("finding.created", eventPayload).catch((err) => {
            console.error("[scanner] Webhook dispatch finding.created failed:", err);
          });

          if (autoApproveEnabled) {
            autoApproved++;

            // Dispatch finding.approved webhook event as it was auto-approved
            dispatchWebhookEvent("finding.approved", eventPayload).catch((err) => {
              console.error("[scanner] Webhook dispatch finding.approved failed:", err);
            });

            if (findingResult.id) {
              newFindingIds.push(findingResult.id);
            }
          }
        } else {
          skipped++;
        }
      }
    }
  }

  // When auto-approve + auto-flag are both on, enqueue flag jobs for newly
  // auto-approved findings so the full pipeline (scan → approve → flag) runs
  // without any manual intervention. Failure to enqueue is non-fatal — the
  // findings stay APPROVED and can be flagged by a manual "Run Flagger".
  if (autoApproveEnabled && autoFlagEnabled && newFindingIds.length > 0) {
    try {
      const flagQueue = getFlagQueue();
      const jobs = newFindingIds.map((findingId) => ({
        name: "flag-finding",
        data: { findingId },
        opts: {
          attempts: 5,
          backoff: { type: "exponential", delay: 10_000 },
          removeOnComplete: { count: 500 },
          removeOnFail: { count: 500 },
        },
      }));
      await flagQueue.addBulk(jobs);
    } catch (err) {
      // Non-fatal: findings remain APPROVED and will be picked up by a future
      // manual "Run Flagger" or scheduler tick. Never log secrets.
      console.error(
        `[scanner] failed to enqueue ${newFindingIds.length} auto-flag jobs:`,
        err instanceof Error ? err.message : err
      );
    }
  }

  return { created, skipped, autoApproved };
}

function inferKind(ruleName: string): "regex" | "entropy" {
  return ruleName === "Generic High-Entropy String" ? "entropy" : "regex";
}

export type FindingSeverityLevel = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export function inferSeverityForRule(ruleName: string): FindingSeverityLevel {
  switch (ruleName) {
    case "AWS Access Key":
    case "AWS Secret Key":
    case "GitHub Token":
      return "CRITICAL";
    case "Stripe Secret Key":
      return "HIGH";
    case "Slack Token":
      return "MEDIUM";
    case "Generic High-Entropy String":
      return "LOW";
    default:
      return "MEDIUM";
  }
}

/**
 * Idempotent Finding creation. Relies on the DB unique constraint
 * (repoFullName, filePath, commitSha, matchedRule) so concurrent/repeated
 * scans of the same commit never create duplicate rows, even under race
 * conditions between worker instances. Returns { wasCreated: true, id }
 * if a new row was created, { wasCreated: false } if it already existed.
 */
export async function upsertFinding(data: {
  repoFullName: string;
  filePath: string;
  commitSha: string;
  matchedRule: string;
  redactedSnippet: string;
  secretHash?: string;
  severity?: FindingSeverityLevel | null;
  status?: "PENDING" | "APPROVED";
}): Promise<{ wasCreated: boolean; id?: string }> {
  // If secretHash is provided, use the new deduplication constraint, fallback to finding_dedup_key
  const existing = await prisma.finding.findUnique({
    where: {
      Finding_dedup_key: {
        repoFullName: data.repoFullName,
        filePath: data.filePath,
        secretHash: data.secretHash ?? null,
      } as any,
    },
    select: { id: true }, // lightweight select
  });

  if (existing) {
    return { wasCreated: false };
  }

  try {
    const finding = await prisma.finding.create({
      data: {
        repoFullName: data.repoFullName,
        filePath: data.filePath,
        commitSha: data.commitSha,
        matchedRule: data.matchedRule,
        redactedSnippet: data.redactedSnippet,
        secretHash: data.secretHash,
        severity: data.severity,
        status: data.status ?? "PENDING",
      },
      select: { id: true },
    });
    return { wasCreated: true, id: finding.id };
  } catch (err: unknown) {
    // Prisma unique constraint violation code P2002 -> already scanned this
    // exact secret in this file. Anything else re-throws.
    if (isUniqueConstraintError(err)) {
      return { wasCreated: false };
    }
    throw err;
  }
}

function isUniqueConstraintError(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: string }).code === "P2002";
}

export async function closeScannerQueues(): Promise<void> {
  if (sharedFlagQueue) {
    await sharedFlagQueue.close();
    sharedFlagQueue = null;
  }
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
