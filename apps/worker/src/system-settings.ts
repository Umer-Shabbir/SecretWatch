import { prisma } from "./db";

/**
 * Worker-side, read-only view of the SystemSetting switches (2026-08-24
 * admin-control addition). A local copy of apps/web/lib/system-settings.ts's
 * reader — apps/worker never imports Next.js-app modules from apps/web (same
 * copy-not-import precedent as token-crypto.ts / the flagger's audit writer).
 * The worker only ever READS the switches; the dashboard is the sole writer.
 *
 * Fails OPEN to enabled=true: if the row is missing (migration not yet run) or
 * the read throws, the subsystem keeps its historical always-on behavior
 * rather than silently going dark. The dashboard toggle is the intentional
 * off switch; a transient DB hiccup must not masquerade as one.
 */

const SYSTEM_SETTING_ID = "singleton";

export interface WorkerSystemSettings {
  scannerEnabled: boolean;
  flaggerEnabled: boolean;
  autoFlagEnabled: boolean;
  autoApproveEnabled: boolean;
  scanResultsPerRule: number;
  flagRateLimitThreshold: number;
  scanIntervalMinutes: number;
}

/** Fail-open defaults: historical always-on behavior + original constants.
 *  autoApproveEnabled defaults to false (fail-closed) because auto-approve
 *  bypasses admin review — a transient DB hiccup must not silently start
 *  auto-approving findings (ARCHITECTURE.md §8). */
const DEFAULTS: WorkerSystemSettings = {
  scannerEnabled: true,
  flaggerEnabled: true,
  autoFlagEnabled: true,
  autoApproveEnabled: false,
  scanResultsPerRule: 30,
  flagRateLimitThreshold: 5,
  scanIntervalMinutes: 15,
};

export async function getSystemSettings(): Promise<WorkerSystemSettings> {
  try {
    const row = await prisma.systemSetting.findUnique({
      where: { id: SYSTEM_SETTING_ID },
      select: {
        scannerEnabled: true,
        flaggerEnabled: true,
        autoFlagEnabled: true,
        autoApproveEnabled: true,
        scanResultsPerRule: true,
        flagRateLimitThreshold: true,
        scanIntervalMinutes: true,
      },
    });
    if (!row) {
      return { ...DEFAULTS };
    }
    return {
      scannerEnabled: row.scannerEnabled,
      flaggerEnabled: row.flaggerEnabled,
      autoFlagEnabled: row.autoFlagEnabled,
      autoApproveEnabled: row.autoApproveEnabled,
      scanResultsPerRule: row.scanResultsPerRule,
      flagRateLimitThreshold: row.flagRateLimitThreshold,
      scanIntervalMinutes: row.scanIntervalMinutes,
    };
  } catch {
    return { ...DEFAULTS };
  }
}
