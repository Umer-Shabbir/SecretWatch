import { getWorkerMonitoringSnapshot } from "@/lib/workers";
import { WorkersClient } from "@/components/admin/workers-client";

/**
 * Admin / Workers (M10). Figma nodes 51:277 (Default), 51:278 (Loading —
 * see loading.tsx), 51:279 (Error), 51:280 (Degraded), 51:281 (Mobile —
 * responsive CSS on this same route, matching the Scan Rules/Review Queue
 * precedent of one component covering both breakpoints).
 *
 * Server Component fetches the initial snapshot directly via
 * lib/workers.ts's getWorkerMonitoringSnapshot() (reads BullMQ job counts
 * for the 3 fixed workers — Scanner/Flagger/Scheduler — no WorkerJob table
 * exists; BullMQ/Redis is the source of truth, see that file's doc
 * comment), matching the review-queue/rules precedent: fetch initial data
 * server-side, hand off to a Client Component for manual retry-on-error.
 *
 * The (protected) layout's middleware already restricts /admin/:path* to
 * ADMIN role; the try/catch below only distinguishes a genuine Redis
 * fetch failure (Figma Error state) from a normal successful load — it is
 * not a second authorization gate.
 */
export default async function WorkersPage() {
  let initialSnapshot: Awaited<ReturnType<typeof getWorkerMonitoringSnapshot>> | null = null;
  let loadFailed = false;

  try {
    initialSnapshot = await getWorkerMonitoringSnapshot();
  } catch {
    loadFailed = true;
  }

  return <WorkersClient initialSnapshot={initialSnapshot} initialLoadFailed={loadFailed} />;
}
