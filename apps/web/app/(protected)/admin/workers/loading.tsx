import { Skeleton } from "@/components/ui/skeleton";

/**
 * Route-level loading UI — Figma node 51:278 (Admin / Workers / Loading).
 * Next.js renders this automatically while page.tsx's async data resolves.
 * 3 worker-card skeletons + a jobs-table skeleton (4 rows), matching the
 * Figma Loading frame's Skeleton=Table Row instance counts (see
 * state/modules/M10.json figma.componentsReused).
 */
export default function WorkersLoading() {
  return (
    <div className="flex w-full flex-col gap-6 p-4 sm:p-8">
      <div>
        <h1 className="text-2xl font-semibold leading-8 text-fg-default">Workers</h1>
        <p className="mt-1 text-sm text-fg-muted">Loading worker status…</p>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:gap-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex w-full flex-col gap-3 rounded-small border border-border-default p-5 sm:w-[360px]">
            <Skeleton className="h-4 w-[160px]" />
            <Skeleton className="h-3.5 w-[100px]" />
            <Skeleton className="h-3.5 w-full" />
            <Skeleton className="h-3.5 w-full" />
            <Skeleton className="h-3.5 w-full" />
            <Skeleton className="h-3.5 w-full" />
          </div>
        ))}
      </div>

      <div>
        <Skeleton className="mb-3 h-5 w-[140px]" />
        <div className="flex flex-col gap-2 rounded-small border border-border-default p-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex w-full items-center gap-4">
              <Skeleton className="h-3.5 w-[140px]" />
              <Skeleton className="h-3.5 w-[100px]" />
              <Skeleton className="h-3.5 w-[100px]" />
              <Skeleton className="h-3.5 w-[80px]" />
              <Skeleton className="h-3.5 w-[80px]" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
