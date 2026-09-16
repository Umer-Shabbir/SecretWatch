-- PERF-004: Unindexed Case-Insensitive String Search on Findings Table
-- Create the pg_trgm extension if it doesn't already exist
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create GIN trigram indexes on repoFullName and filePath
CREATE INDEX IF NOT EXISTS "Finding_repoFullName_trigram_idx" ON "Finding" USING gin("repoFullName" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Finding_filePath_trigram_idx" ON "Finding" USING gin("filePath" gin_trgm_ops);
