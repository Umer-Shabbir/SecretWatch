import { prisma } from "@/lib/db";

/**
 * System-wide switch access (2026-08-24 admin-control addition). Reads/writes
 * the singleton SystemSetting row (id="singleton") that gates the two
 * background subsystems. apps/web owns read+write (dashboard toggles here);
 * apps/worker has its own read-only copy (apps/worker/src/system-settings.ts)
 * following the copy-not-import precedent used throughout this codebase — the
 * two never share a module, only the DB row.
 */

export const SYSTEM_SETTING_ID = "singleton";

export interface SystemSettings {
  scannerEnabled: boolean;
  flaggerEnabled: boolean;
  autoFlagEnabled: boolean;
  autoApproveEnabled: boolean;
  scanResultsPerRule: number;
  flagRateLimitThreshold: number;
  updatedAt: string; // ISO 8601
}

type SystemSettingRow = {
  scannerEnabled: boolean;
  flaggerEnabled: boolean;
  autoFlagEnabled: boolean;
  autoApproveEnabled: boolean;
  scanResultsPerRule: number;
  flagRateLimitThreshold: number;
  updatedAt: Date;
};

function toSystemSettings(row: SystemSettingRow): SystemSettings {
  return {
    scannerEnabled: row.scannerEnabled,
    flaggerEnabled: row.flaggerEnabled,
    autoFlagEnabled: row.autoFlagEnabled,
    autoApproveEnabled: row.autoApproveEnabled,
    scanResultsPerRule: row.scanResultsPerRule,
    flagRateLimitThreshold: row.flagRateLimitThreshold,
    updatedAt: row.updatedAt.toISOString(),
  };
}

const SELECT = {
  scannerEnabled: true,
  flaggerEnabled: true,
  autoFlagEnabled: true,
  autoApproveEnabled: true,
  scanResultsPerRule: true,
  flagRateLimitThreshold: true,
  updatedAt: true,
} as const;

/**
 * Reads the switches, creating the singleton row with defaults if it does
 * not exist yet — so a deployment whose migration predates this row, or a
 * fresh test DB, still returns sane values instead of null.
 */
export async function getSystemSettings(): Promise<SystemSettings> {
  const row = await prisma.systemSetting.upsert({
    where: { id: SYSTEM_SETTING_ID },
    update: {},
    create: { id: SYSTEM_SETTING_ID },
    select: SELECT,
  });
  return toSystemSettings(row);
}

/**
 * Updates any subset of settings. Only the provided fields change; omitted
 * fields keep their current value. Upserts so a missing singleton row is
 * created with the patch applied on top of the defaults.
 */
export async function updateSystemSettings(patch: {
  scannerEnabled?: boolean;
  flaggerEnabled?: boolean;
  autoFlagEnabled?: boolean;
  autoApproveEnabled?: boolean;
  scanResultsPerRule?: number;
  flagRateLimitThreshold?: number;
}): Promise<SystemSettings> {
  const row = await prisma.systemSetting.upsert({
    where: { id: SYSTEM_SETTING_ID },
    update: patch,
    create: { id: SYSTEM_SETTING_ID, ...patch },
    select: SELECT,
  });
  return toSystemSettings(row);
}
