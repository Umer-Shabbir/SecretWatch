-- CreateTable
CREATE TABLE "SystemSetting" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "scannerEnabled" BOOLEAN NOT NULL DEFAULT true,
    "flaggerEnabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("id")
);

-- Seed the singleton row so both processes always find it (getSystemSettings
-- also upserts defensively, but seeding here means the row exists immediately
-- after migrate on a fresh install).
INSERT INTO "SystemSetting" ("id", "scannerEnabled", "flaggerEnabled", "updatedAt")
VALUES ('singleton', true, true, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
