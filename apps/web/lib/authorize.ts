import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

/**
 * Server-side authorization guard for API routes and Server Actions.
 * Middleware protects page navigation; this is the defense-in-depth check
 * inside the handler itself — never rely on client-side role checks alone.
 */
export async function requireSession() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return { session: null, error: "unauthenticated" as const };
  }
  return { session, error: null };
}

export async function requireAdmin() {
  const { session, error } = await requireSession();
  if (error) return { session: null, error };
  if (session!.user.role !== "ADMIN") {
    return { session: null, error: "forbidden" as const };
  }
  return { session, error: null };
}
