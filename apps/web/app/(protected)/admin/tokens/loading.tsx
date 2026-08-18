import { Skeleton } from "@/components/ui/skeleton";

/**
 * Route-level loading UI for Admin / Tokens. No Figma frame exists yet for
 * this screen (see page.tsx doc comment) — mirrors the row-skeleton shape
 * used by Admin / Scan Rules' loading.tsx as the closest existing precedent.
 */
export default function AdminTokensLoading() {
  return (
    <div className="flex w-full flex-col gap-6 p-4 sm:p-8">
      <div>
        <h1 className="text-2xl font-semibold leading-8 text-fg-default">Tokens</h1>
        <p className="mt-1 text-sm text-fg-muted">Loading tokens…</p>
      </div>

      <div className="flex flex-col gap-4">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="flex w-full items-center gap-4 rounded-small border border-border-default px-3 py-2.5">
            <Skeleton className="h-3.5 w-[220px]" />
            <Skeleton className="h-3.5 w-[80px]" />
            <Skeleton className="h-3.5 w-[100px]" />
            <Skeleton className="h-3.5 w-[140px]" />
          </div>
        ))}
      </div>
    </div>
  );
}
