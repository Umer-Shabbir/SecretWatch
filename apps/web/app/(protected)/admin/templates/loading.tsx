import { Skeleton } from "@/components/ui/skeleton";

/**
 * Route-level loading UI — Figma node 51:272 (Admin / Templates /
 * Loading). Next.js renders this automatically while page.tsx's async
 * data resolves. 3 stacked Skeleton=Table Row (7:78) instances at
 * card-height (140px), matching the exact row count and height shown in
 * the Figma Loading frame's "Skeleton List".
 */
export default function TemplatesLoading() {
  return (
    <div className="flex w-full flex-col gap-6 p-4 sm:p-8">
      <div>
        <h1 className="text-2xl font-semibold leading-8 text-fg-default">Message Templates</h1>
      </div>

      <div className="flex flex-col gap-4">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="flex h-[140px] w-full items-center gap-4 rounded-small border border-border-default px-3 py-2.5"
          >
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
