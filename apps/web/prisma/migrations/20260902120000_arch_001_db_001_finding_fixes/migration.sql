-- Migration for ARCH-001 and DB-001
-- ARCH-001: Deduplicate secrets by secretHash alongside commitSha/blobSha
-- DB-001: Composite index for status and createdAt filtered queries

-- AlterTable
ALTER TABLE "Finding" ADD COLUMN IF NOT EXISTS "secretHash" TEXT;

-- DropIndex
DROP INDEX IF EXISTS "Finding_dedup_key";

-- CreateIndex
CREATE UNIQUE INDEX "Finding_dedup_key" ON "Finding"("repoFullName", "filePath", "secretHash");

-- CreateIndex
CREATE INDEX "Finding_status_createdAt_idx" ON "Finding"("status", "createdAt");
