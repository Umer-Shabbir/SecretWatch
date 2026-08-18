import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";

/**
 * Shared app shell for the admin dashboard — the only authenticated area
 * after the 2026-08-17 scope correction (no end-user accounts/pages).
 * Figma nodes 7:34 (Header) / 7:15 (Sidebar) — reused across every Admin
 * screen per DESIGN.md §9.1. Middleware already enforces session/role
 * gating (matcher: "/admin/:path*") before this layout renders.
 */
export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);

  return (
    <div className="flex h-screen flex-col">
      <Header userImage={session?.user?.image} userName={session?.user?.name} />
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <main className="min-w-0 flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
