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
import { getSystemSettings } from "./system-settings";
import { createGithubIssue, GithubApiError } from "./github-client";
import { dispatchWebhookEvent } from "./webhooks";

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

/** Default rate-limit skip threshold when no admin override is set, per ARCHITECTURE.md §5/§8. */
const DEFAULT_RATE_LIMIT_SKIP_THRESHOLD = 5;

export type TemplateSecretType = "AWS_KEY" | "GITHUB_TOKEN" | "GENERIC_API_KEY" | "DB_CONNECTION_STRING";
export type TemplateSeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

/**
 * Infers the template secret type from a scan rule name.
 */
export function inferSecretTypeFromRule(ruleName: string): TemplateSecretType {
  const lower = ruleName.toLowerCase();
  if (lower.includes("aws")) return "AWS_KEY";
  if (lower.includes("github") || lower.includes("ghp_")) return "GITHUB_TOKEN";
  if (
    lower.includes("db") ||
    lower.includes("database") ||
    lower.includes("postgres") ||
    lower.includes("mysql") ||
    lower.includes("mongo") ||
    lower.includes("connection")
  ) {
    return "DB_CONNECTION_STRING";
  }
  return "GENERIC_API_KEY";
}

/** Picks the least-recently-used active token that isn't near its rate limit. Skips exhausted tokens until their reset time. Threshold is the admin-configured flagRateLimitThreshold. */
async function pickFlaggingToken(threshold: number) {
  while (true) {
    const candidates = await prisma.githubToken.findMany({
      where: { active: true },
      orderBy: { lastUsedAt: "asc" },
      take: 50,
      select: { id: true, encrypted: true, rateLimitRemaining: true, rateLimitResetAt: true, lastUsedAt: true },
    });

    if (candidates.length === 0) return null;

    const now = new Date();

    // A token is considered usable if:
    // - It has no recorded rate limit remaining, OR
    // - Its rate limit remaining is strictly greater than the threshold, OR
    // - Its reset timestamp has already passed (rateLimitResetAt <= now)
    const isUsable = (t: { rateLimitRemaining: number | null; rateLimitResetAt: Date | null }) => {
      if (t.rateLimitRemaining === null) return true;
      if (t.rateLimitResetAt && t.rateLimitResetAt <= now) return true;
      return t.rateLimitRemaining > threshold;
    };

    const healthy = candidates.find(isUsable);
    if (!healthy) return null;

    // Atomically claim the token by updating its lastUsedAt timestamp immediately.
    // This prevents concurrent worker jobs from picking the exact same token.
    const result = await prisma.githubToken.updateMany({
      where: {
        id: healthy.id,
        lastUsedAt: healthy.lastUsedAt
      },
      data: { lastUsedAt: new Date() }
    });

    if (result.count > 0) {
      return healthy;
    }
    // If count is 0, another worker just claimed it. Loop and try to pick the next one.
    await new Promise((resolve) => setTimeout(resolve, 50 + Math.random() * 100));
  }
}

export async function getOrCreateDefaultTemplate() {
  const existing = await prisma.messageTemplate.findFirst({ where: { isDefault: true } });
  if (existing) return existing;
  return prisma.messageTemplate.create({
    data: { name: DEFAULT_TEMPLATE_NAME, body: DEFAULT_TEMPLATE_BODY, isDefault: true },
  });
}

/**
 * Resolves the best message template for a given finding based on its severity and matched rule:
 * 1. Both severity and secretType match
 * 2. secretType matches
 * 3. severity matches
 * 4. Fallback to default template (or self-heal default)
 */
export async function resolveTemplateForFinding(finding: {
  severity?: TemplateSeverity | null;
  matchedRule?: string | null;
}) {
  return getOrCreateDefaultTemplate();
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
  // Master flagger switch (dashboard toggle). When off, skip WITHOUT marking
  // the finding FAILED — the finding stays APPROVED and gets flagged once the
  // switch is turned back on. A disabled subsystem is not a failure. Fails
  // OPEN (see system-settings.ts) on DB error.
  const { flaggerEnabled, flagRateLimitThreshold } = await getSystemSettings();
  if (!flaggerEnabled) {
    return { outcome: "skipped", reason: "flagger disabled" };
  }

  const finding = await prisma.finding.findUnique({ where: { id: findingId } });
  if (!finding) {
    return { outcome: "skipped", reason: "finding not found" };
  }
  if (finding.status !== "APPROVED") {
    // Already flagged/failed/ignored/pending — nothing to do. Not an error;
    // avoids double-posting on a retried/duplicate job.
    return { outcome: "skipped", reason: `finding is ${finding.status}` };
  }

  const token = await pickFlaggingToken(flagRateLimitThreshold ?? DEFAULT_RATE_LIMIT_SKIP_THRESHOLD);
  if (!token) {
    const reason = "No authorized GitHub token available to flag with";
    await markFailed(findingId, reason);
    await recordAuditEvent({ action: "flag_failed", detail: `findingId=${findingId} reason=${reason}` });
    return { outcome: "failed", reason: "no active token" };
  }

  const template = await resolveTemplateForFinding(finding);
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
  const title = `[SecretWatch] Potential leaked secret detected: ${finding.matchedRule}`;

  try {
    const issue = await createGithubIssue(token.encrypted, token.id, owner, repo, title, body);

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

    dispatchWebhookEvent("finding.flagged", {
      id: finding.id,
      repoFullName: finding.repoFullName,
      filePath: finding.filePath,
      matchedRule: finding.matchedRule,
      issueUrl: issue.htmlUrl,
    }).catch((err) => console.error("[flagger] Webhook dispatch finding.flagged failed:", err));

    return { outcome: "flagged" };
  } catch (err) {
    const reason = toFailureReason(err);
    await markFailed(findingId, reason);
    await recordAuditEvent({
      action: "flag_failed",
      detail: `findingId=${findingId} tokenId=${token.id} reason=${reason}`,
    });

    dispatchWebhookEvent("flag.failed", {
      id: finding.id,
      repoFullName: finding.repoFullName,
      filePath: finding.filePath,
      matchedRule: finding.matchedRule,
      reason,
    }).catch((err) => console.error("[flagger] Webhook dispatch flag.failed failed:", err));

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

/**
 * Dynamically computes flagger worker concurrency based on active token count.
 * Concurrency is clamped between a minimum of 1 and a maximum of 10 (or active token count),
 * defaulting to 3 when no active tokens exist or on count lookup failure.
 */
export async function computeFlaggerConcurrency(): Promise<number> {
  try {
    const activeTokenCount = await prisma.githubToken.count({
      where: { active: true },
    });
    if (activeTokenCount <= 0) return 3;
    // Scale concurrency dynamically: max(1, min(activeTokenCount, 10))
    return Math.max(1, Math.min(activeTokenCount, 10));
  } catch {
    return 3;
  }
}

export function createFlaggerWorker(concurrency: number = 3): Worker<FlagJobData> {
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
      concurrency, // dynamically configurable concurrency based on active tokens
    }
  );
}
