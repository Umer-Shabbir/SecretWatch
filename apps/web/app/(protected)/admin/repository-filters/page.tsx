import { listRepositoryFilters } from "@/lib/repository-filters";
import { requireAdmin } from "@/lib/authorize";
import { redirect } from "next/navigation";
import { RepositoryFiltersClient } from "@/components/admin/repository-filters-client";

export const dynamic = "force-dynamic";

export default async function RepositoryFiltersPage() {
  const { session, error } = await requireAdmin();

  if (error || !session) {
    redirect("/");
  }

  const filters = await listRepositoryFilters();

  return (
    <main className="flex w-full flex-col p-4 sm:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold leading-8 text-fg-default">Repository Filters</h1>
        <p className="mt-1 text-sm text-fg-muted">
          Manage allowlist and blocklist rules to control which repositories are scanned.
          Blocklist rules always take precedence. If allowlist rules exist, only matching repositories are scanned.
        </p>
      </div>

      <RepositoryFiltersClient initialFilters={filters} />
    </main>
  );
}
