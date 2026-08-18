import { PrismaClient } from "@prisma/client";

/**
 * Worker's own PrismaClient instance, generated from the same
 * apps/web/prisma/schema.prisma (see package.json "prisma:generate" script
 * — `prisma generate --schema=../web/prisma/schema.prisma`) so there is a
 * single schema source of truth with no drift between web and worker
 * models, but two independent client instances/connections (each process
 * manages its own pool against the same DATABASE_URL).
 */
export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
});
