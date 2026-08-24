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
  scanResultsPerRule: number;
  flagRateLimitThreshold: number;
}

/** Fail-open defaults: historical always-on behavior + original constants. */
const DEFAULTS: WorkerSystemSettings = {
  scannerEnabled: true,
  flaggerEnabled: true,
  autoFlagEnabled: true,
  scanResultsPerRule: 30,
  flagRateLimitThreshold: 5,
};

export async function getSystemSettings(): Promise<WorkerSystemSettings> {
  try {
    const row = await prisma.systemSetting.findUnique({
      where: { id: SYSTEM_SETTING_ID },
      select: {
        scannerEnabled: true,
        flaggerEnabled: true,
        autoFlagEnabled: true,
        scanResultsPerRule: true,
        flagRateLimitThreshold: true,
      },
    });
    if (!row) {
      return { ...DEFAULTS };
    }
    return {
      scannerEnabled: row.scannerEnabled,
      flaggerEnabled: row.flaggerEnabled,
      autoFlagEnabled: row.autoFlagEnabled,
      scanResultsPerRule: row.scanResultsPerRule,
      flagRateLimitThreshold: row.flagRateLimitThreshold,
    };
  } catch {
    return { ...DEFAULTS };
  }
}
