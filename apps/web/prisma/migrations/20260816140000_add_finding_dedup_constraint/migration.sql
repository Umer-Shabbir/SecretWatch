-- Additive, non-destructive migration for M04 (Scanner + Findings).
--
-- Adds a composite unique constraint on Finding so the scanner worker can
-- rely on the database itself to enforce idempotency: re-scanning the same
-- commit/file/rule combination must never create a duplicate Finding row.
-- No columns are altered or dropped; no existing data is modified.
--
-- NOTE: if this environment already has duplicate (repoFullName, filePath,
-- commitSha, matchedRule) rows in Finding, this CREATE UNIQUE INDEX will
-- fail. That is intentional — resolving pre-existing duplicates is a data
-- decision that requires explicit approval (see .claude/CLAUDE.md section 4
-- "avoid destructive changes unless explicitly approved") and must not be
-- silently auto-deleted by a migration. If it fails, report the duplicate
-- rows and get approval before adding a cleanup step.

-- CreateIndex
CREATE UNIQUE INDEX "Finding_dedup_key" ON "Finding"("repoFullName", "filePath", "commitSha", "matchedRule");

-- CreateIndex
CREATE INDEX "Finding_status_idx" ON "Finding"("status");

-- CreateIndex
CREATE INDEX "Finding_createdAt_idx" ON "Finding"("createdAt");
