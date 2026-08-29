import { Skeleton } from "@/components/ui/skeleton";

export default function WebhooksLoading() {
  return (
    <main className="flex w-full flex-col p-4 sm:p-8">
      <div className="mb-6 flex flex-col gap-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Skeleton className="h-48 w-full rounded-medium" />
        <Skeleton className="h-48 w-full rounded-medium" />
        <Skeleton className="h-48 w-full rounded-medium" />
      </div>
    </main>
  );
}
