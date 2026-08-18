import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

/** Stub landing page — full Admin Overview UI is a later module. Exists here only as the ADMIN-role redirect target for M01. */
export default async function AdminPage() {
  const session = await getServerSession(authOptions);

  return (
    <main className="p-8">
      <h1 className="text-lg font-semibold text-fg-default">Admin</h1>
      <p className="mt-2 text-sm text-fg-muted">Signed in as {session?.user?.email ?? session?.user?.name} (role: {session?.user?.role}).</p>
    </main>
  );
}
