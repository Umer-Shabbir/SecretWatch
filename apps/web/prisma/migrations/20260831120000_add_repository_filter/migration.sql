-- CreateEnum
CREATE TYPE "RepositoryFilterType" AS ENUM ('ALLOW', 'BLOCK');

-- CreateTable
CREATE TABLE "RepositoryFilter" (
    "id" TEXT NOT NULL,
    "type" "RepositoryFilterType" NOT NULL,
    "pattern" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RepositoryFilter_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RepositoryFilter_type_idx" ON "RepositoryFilter"("type");

-- CreateIndex
CREATE INDEX "RepositoryFilter_enabled_idx" ON "RepositoryFilter"("enabled");
