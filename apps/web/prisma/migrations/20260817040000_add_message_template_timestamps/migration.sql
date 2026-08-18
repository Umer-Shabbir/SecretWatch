-- Additive, non-destructive migration for M09 (Message Templates).
--
-- Adds MessageTemplate.createdAt and MessageTemplate.updatedAt so the Admin /
-- Templates list/editor can display creation/last-updated info per
-- state/modules/M09.json's Figma design (Template Card + editor states).
-- Mirrors M08's ScanRule.createdAt precedent exactly (see
-- 20260816160000_add_scan_rule_created_at):
--   - both columns carry a DEFAULT of CURRENT_TIMESTAMP, so pre-existing
--     MessageTemplate rows (e.g. the flagger worker's self-healing default
--     template — see apps/worker/src/flagger.worker.ts's
--     getOrCreateDefaultTemplate) are backfilled with the migration's
--     apply-time timestamp rather than being left null or dropped/recreated;
--   - no other column is altered or removed;
--   - no existing data is destroyed.
--
-- updatedAt is declared `@updatedAt` in the Prisma schema, which Prisma
-- Client enforces at the query-builder level on every future write (no DB
-- trigger involved) — matching this schema's existing `User.updatedAt`
-- convention, which likewise has no separate trigger-based migration. The
-- raw SQL therefore only needs the column plus a backfill default, identical
-- in shape to createdAt.

-- AlterTable
ALTER TABLE "MessageTemplate" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "MessageTemplate" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
