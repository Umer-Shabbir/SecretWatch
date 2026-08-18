-- Additive, non-destructive migration for M03 (GitHub Token & Authorization).
-- Adds display-safe metadata to GithubToken without altering existing columns
-- or data. New columns are nullable / defaulted so existing rows remain valid.

-- AlterTable
ALTER TABLE "GithubToken" ADD COLUMN     "maskedIdentifier" TEXT;
ALTER TABLE "GithubToken" ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'pat';

-- CreateIndex
CREATE INDEX "GithubToken_userId_active_idx" ON "GithubToken"("userId", "active");
