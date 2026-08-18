-- Additive, non-destructive migration for M07 (Flagger + Flags).
--
-- Adds Finding.failureReason (nullable) so a FAILED flag attempt can carry a
-- short, non-secret display string for the Flags history table (e.g.
-- "GitHub API rate limit (403)", "Issue creation failed: repo archived",
-- "Token revoked before retry") per state/modules/M07.json's Figma
-- productDecisionNotes. Never populated with a token value or raw secret.
--
-- Adds an index on Flag.postedAt to support the Flags list's default
-- newest-first ordering at scale, mirroring the existing Finding.createdAt
-- index pattern from the M04 migration.
--
-- No columns are altered or dropped; no existing data is modified.

-- AlterTable
ALTER TABLE "Finding" ADD COLUMN "failureReason" TEXT;

-- CreateIndex
CREATE INDEX "Flag_postedAt_idx" ON "Flag"("postedAt");
