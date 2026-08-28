-- Add autoApproveEnabled column to SystemSetting.
-- Default is false (admin review required by default, per ARCHITECTURE.md §8).
-- Additive, backward-compatible: existing rows get false, preserving current behavior.
ALTER TABLE "SystemSetting" ADD COLUMN "autoApproveEnabled" BOOLEAN NOT NULL DEFAULT false;
