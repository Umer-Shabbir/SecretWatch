-- Additive, non-destructive migration for M08 (Scan Rules).
--
-- Adds ScanRule.createdAt so the Admin / Scan Rules list can display a
-- "created date" per rule row, per state/modules/M08.json's Figma
-- componentsReused notes ("Rule Row card ... created date"). The column
-- carries a DEFAULT of now(), so:
--   - existing ScanRule rows are backfilled with the migration's apply-time
--     timestamp rather than being left null or dropped/recreated;
--   - no other column is altered or removed;
--   - no existing data is destroyed.
--
-- Also adds an index on `enabled` to support the worker scheduler's existing
-- `WHERE enabled = true` scan (apps/worker/src/scheduler.ts,
-- apps/worker/src/scanner.worker.ts), which already queries this column on
-- every tick with no caching.

-- AlterTable
ALTER TABLE "ScanRule" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "ScanRule_enabled_idx" ON "ScanRule"("enabled");
