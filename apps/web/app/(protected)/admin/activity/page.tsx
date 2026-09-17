import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AdminActivityClient } from "@/components/admin/admin-activity-client";

export default async function AdminActivityPage() {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "ADMIN") {
    // Should be caught by middleware/layout, but defend here
    return <div>Unauthorized</div>;
  }

  return <AdminActivityClient />;
}
