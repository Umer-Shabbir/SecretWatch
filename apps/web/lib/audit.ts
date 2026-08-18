import { prisma } from "@/lib/db";

/**
 * Records a security-relevant action. Never pass raw secrets/tokens in
 * `detail` — this table is not encrypted at rest.
 */
export async function recordAudit(params: {
  userId?: string | null;
  action: string;
  detail?: string;
}) {
  await prisma.auditLog.create({
    data: {
      userId: params.userId ?? null,
      action: params.action,
      detail: params.detail,
    },
  });
}
