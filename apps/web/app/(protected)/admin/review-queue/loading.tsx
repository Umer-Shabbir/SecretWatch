import { Skeleton } from "@/components/ui/skeleton";

/**
 * Route-level loading UI — Figma node 42:845 (Admin / Review Queue /
 * Loading). Next.js renders this automatically while page.tsx's async
 * data resolves. Card-shaped skeletons (repo+badge row, 3 stacked lines,
 * action-button row) matching the visual language of Skeleton=Table Row
 * (7:78), same documented workaround M05 used for its own skeleton (no
 * Skeleton=Card variant exists in the design system yet — see
 * state/modules/M06.json knownIssues).
 */
export default function ReviewQueueLoading() {
  return (
    <div className="flex w-full flex-col gap-6 p-8">
      <div>
        <h1 className="text-2xl font-semibold leading-8 text-fg-default">Review Queue</h1>
        <Skeleton className="mt-2 h-4 w-48" />
      </div>

      <div className="flex flex-col gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="w-full rounded-small border border-border-default p-4">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-5 w-16" />
            </div>
            <Skeleton className="mt-3 h-3.5 w-56" />
            <Skeleton className="mt-2 h-3.5 w-32" />
            <Skeleton className="mt-2 h-3 w-24" />
            <div className="mt-4 flex justify-end gap-2">
              <Skeleton className="h-9 w-20" />
              <Skeleton className="h-9 w-32" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
