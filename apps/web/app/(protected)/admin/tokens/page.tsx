import { listAdminTokens } from "@/lib/admin-tokens";
import { AdminTokensClient } from "@/components/admin/admin-tokens-client";

/**
 * Admin / Tokens (Part 2.3 of the 2026-08-17 scope correction). Lists every
 * submitted GithubToken row (masked only — never encrypted/raw), with an
 * admin deactivate action. Replaces the removed per-user Tokens screen
 * (apps/web/app/(protected)/tokens/, deleted in Part 1.1) now that tokens
 * are submitted publicly with no owning user.
 *
 * No Figma frame exists yet for this screen (it's a new addition introduced
 * by this scope correction, not a pre-existing designed module) — structure
 * follows the closest existing precedent (Admin / Scan Rules: Server
 * Component fetches initial data, hands off to a Client Component for
 * interactive actions and retry-on-error). A follow-up Figma design pass is
 * recommended before this is considered visually final.
 *
 * The (protected) layout's middleware already restricts /admin/:path* to
 * ADMIN role; the try/catch below only distinguishes a genuine fetch
 * failure from a normal empty list, same as every other admin list page in
 * this codebase.
 */
export default async function AdminTokensPage() {
  let initialTokens: Awaited<ReturnType<typeof listAdminTokens>> | null = null;
  let loadFailed = false;

  try {
    initialTokens = await listAdminTokens();
  } catch {
    loadFailed = true;
  }

  return <AdminTokensClient initialTokens={initialTokens} initialLoadFailed={loadFailed} />;
}
