import { prisma } from "@/lib/db";
import { getSystemSettings } from "@/lib/system-settings";

/**
 * Dashboard overview metrics (2026-08-24 admin-control addition). Aggregates
 * the counts the admin Overview screen shows: findings grouped by status,
 * token pool health, flag outcomes, and the current subsystem switch state.
 *
 * All counts come straight from the DB (no cross-process calls). Read-only.
 */

export interface DashboardMetrics {
  findings: {
    total: number;
    pending: number;
    approved: number;
    flagged: number;
    ignored: number;
    failed: number;
  };
  tokens: {
    total: number;
    active: number;
  };
  flags: {
    /** Successfully created GitHub issues (Flag rows). */
    succeeded: number;
    /** Findings that reached FAILED after a flag attempt. */
    failed: number;
  };
  switches: {
    scannerEnabled: boolean;
    flaggerEnabled: boolean;
  };
}

export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  const [
    findingsByStatus,
    tokensTotal,
    tokensActive,
    flagsSucceeded,
    settings,
  ] = await Promise.all([
    prisma.finding.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.githubToken.count(),
    prisma.githubToken.count({ where: { active: true } }),
    prisma.flag.count(),
    getSystemSettings(),
  ]);

  const byStatus = (status: string): number =>
    findingsByStatus.find((g) => g.status === status)?._count._all ?? 0;

  const pending = byStatus("PENDING");
  const approved = byStatus("APPROVED");
  const flagged = byStatus("FLAGGED");
  const ignored = byStatus("IGNORED");
  const failed = byStatus("FAILED");

  return {
    findings: {
      total: pending + approved + flagged + ignored + failed,
      pending,
      approved,
      flagged,
      ignored,
      failed,
    },
    tokens: {
      total: tokensTotal,
      active: tokensActive,
    },
    flags: {
      succeeded: flagsSucceeded,
      failed,
    },
    switches: {
      scannerEnabled: settings.scannerEnabled,
      flaggerEnabled: settings.flaggerEnabled,
    },
  };
}
