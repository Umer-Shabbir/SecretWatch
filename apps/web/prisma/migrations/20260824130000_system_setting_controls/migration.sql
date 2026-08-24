-- Whole-system control knobs on the SystemSetting singleton (2026-08-24
-- admin-control addition). Additive, all defaulted so the existing seeded
-- 'singleton' row keeps working unchanged.

ALTER TABLE "SystemSetting"
  ADD COLUMN IF NOT EXISTS "autoFlagEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "scanResultsPerRule" INTEGER NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS "flagRateLimitThreshold" INTEGER NOT NULL DEFAULT 5;
