-- Additive, non-destructive migration for the message-template-variants
-- addition (2026-08-17, scoped as part of finishing M03/token-flow cohesion
-- per the task brief, touching M09's template data).
--
-- Adds two nullable classification enums (TemplateSeverity, TemplateSecretType)
-- and one boolean toggle (includeAttributionLine, DEFAULT false) to
-- MessageTemplate. No existing column is altered or dropped; every existing
-- row is backward compatible (severity/secretType stay NULL,
-- includeAttributionLine backfills to false) and nothing currently reads
-- these columns to make an availability-critical decision (the flagger
-- worker's getOrCreateDefaultTemplate() only ever filters on isDefault, see
-- apps/worker/src/flagger.worker.ts and lib/messageTemplates.ts's module doc
-- comment) — so no data migration/backfill logic beyond the column DEFAULT
-- is required.

-- CreateEnum
CREATE TYPE "TemplateSeverity" AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "TemplateSecretType" AS ENUM ('AWS_KEY', 'GITHUB_TOKEN', 'GENERIC_API_KEY', 'DB_CONNECTION_STRING');

-- AlterTable
ALTER TABLE "MessageTemplate" ADD COLUMN "severity" "TemplateSeverity";
ALTER TABLE "MessageTemplate" ADD COLUMN "secretType" "TemplateSecretType";
ALTER TABLE "MessageTemplate" ADD COLUMN "includeAttributionLine" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "MessageTemplate_severity_idx" ON "MessageTemplate"("severity");

-- CreateIndex
CREATE INDEX "MessageTemplate_secretType_idx" ON "MessageTemplate"("secretType");
