-- Adds nullable severity column to Finding using the existing TemplateSeverity
-- enum. Nullable so all existing rows remain valid (NULL = unscored). Additive,
-- non-destructive — no existing column altered.
ALTER TABLE "Finding" ADD COLUMN "severity" "TemplateSeverity";

-- Index for severity-filtered queries (review queue, export).
CREATE INDEX "Finding_severity_idx" ON "Finding"("severity");
