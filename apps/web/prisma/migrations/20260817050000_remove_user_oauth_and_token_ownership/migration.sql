-- DESTRUCTIVE migration for the 2026-08-17 product scope correction
-- (docs/PRODUCT_SOURCE_OF_TRUTH.md): SecretWatch has no end-user accounts.
-- The only account type is ADMIN, signed in via email+password Credentials
-- provider. GitHub tokens are now submitted publicly (no login) and are
-- global rows with no per-user ownership, same pattern as Finding/Flag.
--
-- Confirmed safe to run destructively: no production database is deployed
-- for this project (DATABASE_URL in .env.local points at an unreachable
-- local dev Postgres instance; `prisma db pull`/`migrate diff` against it
-- both fail with P1001 "can't reach database server"). There is no existing
-- data to preserve. If this repo is ever pointed at a real database that
-- already has rows in Account/Session/VerificationToken or a populated
-- GithubToken.userId column, DO NOT apply this migration as-is — back up
-- first, since it drops those tables/columns unconditionally.
--
-- Down/rollback is intentionally NOT provided as a paired migration: Auth.js
-- OAuth account linkage and per-user token ownership are being permanently
-- removed as a product decision, not toggled. To reverse, re-add the
-- Account/Session/VerificationToken models and the GithubToken.userId /
-- User.githubId columns to schema.prisma and generate a fresh forward
-- migration — do not attempt to "undo" this file in place.

-- DropForeignKey (User relations into the tables being dropped)
ALTER TABLE "Account" DROP CONSTRAINT IF EXISTS "Account_userId_fkey";
ALTER TABLE "Session" DROP CONSTRAINT IF EXISTS "Session_userId_fkey";
ALTER TABLE "GithubToken" DROP CONSTRAINT IF EXISTS "GithubToken_userId_fkey";

-- DropIndex (old ownership-scoped index on GithubToken, replaced below)
DROP INDEX IF EXISTS "GithubToken_userId_active_idx";

-- AlterTable: GithubToken becomes a global model, no per-user ownership.
ALTER TABLE "GithubToken" DROP COLUMN IF EXISTS "userId";

-- AlterTable: User keeps only fields needed to represent admin accounts.
ALTER TABLE "User" DROP COLUMN IF EXISTS "githubId";

-- DropTable: Auth.js (NextAuth) Prisma adapter tables. No longer needed —
-- Credentials-only NextAuth v4 does not use PrismaAdapter, so there is no
-- OAuth account linking or database-backed session storage to support.
DROP TABLE IF EXISTS "Account";
DROP TABLE IF EXISTS "Session";
DROP TABLE IF EXISTS "VerificationToken";

-- CreateIndex: replacement index for the now-ownerless GithubToken model.
CREATE INDEX IF NOT EXISTS "GithubToken_active_idx" ON "GithubToken"("active");
