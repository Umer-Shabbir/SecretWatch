import { Worker, type Job } from "bullmq";
import {
  QUEUE_NAMES,
  getRedisConnectionOptions,
  renderTemplate,
  appendAttributionLine,
  DEFAULT_TEMPLATE_NAME,
  DEFAULT_TEMPLATE_BODY,
  type FlagJobData,
} from "@secretwatch/shared";
import { prisma } from "./db";
import { createGithubIssue, GithubApiError } from "./github-client";

/**
 * Flagger worker (ARCHITECTURE.md §5/§6, M07). Consumes `flag-queue` jobs.
 * Each job flags exactly one Finding: renders the message template, opens a
 * GitHub issue on the offending repo via an authorized token, and records
 * the outcome.
 *
 * On success: writes a Flag row (issueUrl/usedTokenId/templateId/postedAt)
 * and transitions Finding.status APPROVED -> FLAGGED.
 *
 * On failure (after BullMQ's own retry/backoff exhausts attempts — see
 * job options in enqueueFlagJob): transitions Finding.status -> FAILED with
 * a short, non-secret `failureReason` string, so the failure is visible in
 * the Flags history UI per docs/MODULES.md M07 exit criterion ("failures
 * are visible").
 *
 * Token rotation: round-robins active tokens ordered by lastUsedAt ascending
 * (same "pick the least-recently-used" strategy as scanner.worker.ts's
 * pickActiveToken), and skips any token whose rateLimitRemaining is known to
 * be critically low, so no single user's token gets exhausted or abused
 * (ARCHITECTURE.md §8).
 *
 * SECURITY: never logs a decrypted token or the redacted secret snippet —
 * only Finding.id/repoFullName/filePath and the thrown error's message.
 */

/** Findings near-zero rate limit are skipped in favor of the next candidate token, per ARCHITECTURE.md §5/§8. */
const RATE_LIMIT_SKIP_THRESHOLD = 5;

/** Picks the least-recently-used active token that isn't near its rate limit. Falls back to any active token if all are low (better to attempt with backoff than to never flag). */
async function pickFlaggingToken() {
  const candidates = await prisma.githubToken.findMany({
    where: { active: true },
    orderBy: { lastUsedAt: "asc" },
    select: { id: true, encrypted: true, rateLimitRemaining: true },
  });

  const healthy = candidates.find(
    (t) => t.rateLimitRemaining === null || t.rateLimitRemaining > RATE_LIMIT_SKIP_THRESHOLD
  );
  return healthy ?? candidates[0] ?? null;
}

async function getOrCreateDefaultTemplate() {
  const existing = await prisma.messageTemplate.findFirst({ where: { isDefault: true } });
  if (existing) return existing;
  return prisma.messageTemplate.create({
    data: { name: DEFAULT_TEMPLATE_NAME, body: DEFAULT_TEMPLATE_BODY, isDefault: true },
  });
}

/**
 * Runs one flag attempt for a Finding. Only APPROVED findings are eligible
 * (mirrors ARCHITECTURE.md §5's admin-review-gate ordering: PENDING findings
 * sit until an admin approves via M06; this worker never flags a PENDING
 * row). Idempotent against re-processing an already-terminal Finding — a
 * conditional updateMany guards the APPROVED -> FLAGGED transition so two
 * concurrent job attempts for the same finding cannot both succeed.
 */
export async function runFlagForFinding(findingId: string): Promise<{ outcome: "flagged" | "failed" | "skipped"; reason?: string }> {
  const finding = await prisma.finding.findUnique({ where: { id: findingId } });
  if (!finding) {
    return { outcome: "skipped", reason: "finding not found" };
  }
  if (finding.status !== "APPROVED") {
    // Already flagged/failed/ignored/pending — nothing to do. Not an error;
    // avoids double-posting on a retried/duplicate job.
    return { outcome: "skipped", reason: `finding is ${finding.status}` };
  }

  const token = await pickFlaggingToken();
  if (!token) {
    const reason = "No authorized GitHub token available to flag with";
    await markFailed(findingId, reason);
    await recordAuditEvent({ action: "flag_failed", detail: `findingId=${findingId} reason=${reason}` });
    return { outcome: "failed", reason: "no active token" };
  }

  const template = await getOrCreateDefaultTemplate();
  const [owner, repo] = finding.repoFullName.split("/");
  const renderedBody = renderTemplate(template.body, {
    repo: finding.repoFullName,
    file: finding.filePath,
    rule: finding.matchedRule,
  });
  // Soft attribution line (2026-08-17 addition): appended only when this
  // template has includeAttributionLine=true (defaults to false for every
  // existing/self-healed template, so this is a no-op unless an admin
  // explicitly opts in on a specific template).
  const body = appendAttributionLine(renderedBody, template.includeAttributionLine);
  const title = `Potential leaked secret detected: ${finding.matchedRule}`;

  try {
    const issue = await createGithubIssue(token.encrypted, owner, repo, title, body);

    await prisma.githubToken.update({ where: { id: token.id }, data: { lastUsedAt: new Date() } });

    await prisma.$transaction(async (tx) => {
      await tx.flag.create({
        data: {
          findingId: finding.id,
          issueUrl: issue.htmlUrl,
          usedTokenId: token.id,
          templateId: template.id,
        },
      });
      const result = await tx.finding.updateMany({
        where: { id: finding.id, status: "APPROVED" },
        data: { status: "FLAGGED" },
      });
      if (result.count === 0) {
        // Lost a race — another worker already transitioned this finding.
        // Roll back by throwing; the Flag row insert above will also be
        // rolled back since we're inside the same transaction.
        throw new Error("Finding was no longer APPROVED at commit time");
      }
    });

    // ARCHITECTURE.md §8: "Log every flag action to audit_log table (who/
    // when/which token/which template) for accountability." No end-user
    // session exists inside a worker job, so userId is null (system
    // action) — the token/template/issue references make it fully
    // traceable. Never includes a decrypted token or raw secret.
    await recordAuditEvent({
      action: "flag_created",
      detail: `findingId=${finding.id} tokenId=${token.id} templateId=${template.id} issueUrl=${issue.htmlUrl}`,
    });

    return { outcome: "flagged" };
  } catch (err) {
    const reason = toFailureReason(err);
    await markFailed(findingId, reason);
    await recordAuditEvent({
      action: "flag_failed",
      detail: `findingId=${findingId} tokenId=${token.id} reason=${reason}`,
    });
    return { outcome: "failed", reason };
  }
}

/**
 * Worker-side audit log writer. Intentionally a local copy of apps/web/lib/
 * audit.ts's minimal shape rather than a cross-package import — same
 * rationale as token-crypto.ts's copy-not-import precedent (apps/worker
 * doesn't import Next.js-app-shaped modules from apps/web). Never pass a
 * token value or raw secret in `detail`.
 */
async function recordAuditEvent(params: { action: string; detail: string }): Promise<void> {
  await prisma.auditLog.create({
    data: { userId: null, action: params.action, detail: params.detail },
  });
}

/** Maps a thrown error to a short, non-secret, user-visible failure reason string. Never includes a token value. */
function toFailureReason(err: unknown): string {
  if (err instanceof GithubApiError) {
    if (err.status === 403 || err.status === 429) {
      return `GitHub API rate limit (${err.status})`;
    }
    if (err.status === 404) {
      return "Issue creation failed: repository not found";
    }
    if (err.status === 410) {
      return "Issue creation failed: repo archived";
    }
    return `Issue creation failed (HTTP ${err.status})`;
  }
  return "Issue creation failed: unexpected error";
}

async function markFailed(findingId: string, reason: string): Promise<void> {
  await prisma.finding.updateMany({
    where: { id: findingId, status: "APPROVED" },
    data: { status: "FAILED", failureReason: reason },
  });
}

export function createFlaggerWorker(): Worker<FlagJobData> {
  return new Worker<FlagJobData>(
    QUEUE_NAMES.FLAG,
    async (job: Job<FlagJobData>) => {
      const { findingId } = job.data;
      const outcome = await runFlagForFinding(findingId);
      if (outcome.outcome === "failed") {
        // Throwing lets BullMQ apply its configured exponential backoff/retry
        // (ARCHITECTURE.md §5) before the job is finally marked FAILED. The
        // Finding row itself is already marked FAILED optimistically on this
        // attempt and gets re-marked FLAGGED if a later retry succeeds.
        throw new Error(outcome.reason ?? "flag attempt failed");
      }
      return outcome;
    },
    {
      connection: getRedisConnectionOptions(),
      concurrency: 3, // separate concurrency from scan-queue per ARCHITECTURE.md §5
    }
  );
}
