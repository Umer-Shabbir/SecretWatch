import { Skeleton } from "@/components/ui/skeleton";

/**
 * Route-level loading UI — Figma node 51:264 (Admin / Scan Rules /
 * Loading). Next.js renders this automatically while page.tsx's async
 * data resolves. 5 stacked Skeleton=Table Row (7:78) instances, matching
 * the review-queue module's loading.tsx convention
 * (app/(protected)/admin/review-queue/loading.tsx) and the exact 5-row
 * count shown in the Figma Loading frame.
 */
export default function ScanRulesLoading() {
  return (
    <div className="flex w-full flex-col gap-6 p-4 sm:p-8">
      <div>
        <h1 className="text-2xl font-semibold leading-8 text-fg-default">Scan Rules</h1>
        <p className="mt-1 text-sm text-fg-muted">Loading rules…</p>
      </div>

      <div className="flex flex-col gap-4">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="flex w-full items-center gap-4 rounded-small border border-border-default px-3 py-2.5">
            <Skeleton className="h-3.5 w-[140px]" />
            <Skeleton className="h-3.5 w-[140px]" />
            <Skeleton className="h-3.5 w-[100px]" />
            <Skeleton className="h-3.5 w-[90px]" />
            <Skeleton className="h-3.5 w-[80px]" />
          </div>
        ))}
      </div>
    </div>
  );
}
