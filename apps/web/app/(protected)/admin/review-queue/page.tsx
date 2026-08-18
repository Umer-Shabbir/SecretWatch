import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { listFindings } from "@/lib/findings";
import { ReviewQueueClient } from "@/components/admin/review-queue-client";

const PAGE_SIZE = 20;

/**
 * Admin / Review Queue (M06). Figma nodes 42:844 (Default), 42:845 (Loading
 * — see loading.tsx), 42:846 (Empty), 42:847 (Error), 42:848 (Confirm
 * Approve — modal, reuses ConfirmApproveDialog from M05), 42:849 (Mobile).
 *
 * Reuses M04's listFindings({ status: "PENDING" }) as-is — a review queue is
 * by definition the set of PENDING findings awaiting a human decision (see
 * state/modules/M06.json scopeNotes: FAILED findings are out of scope here).
 * No new query/list endpoint was needed.
 *
 * Middleware already restricts /admin/:path* to ADMIN role (redirects
 * non-admins to /unauthorized before this page renders); the session read
 * here is defense-in-depth only, same pattern as every other protected page.
 */
export default async function ReviewQueuePage() {
  const session = await getServerSession(authOptions);

  let initialResult: Awaited<ReturnType<typeof listFindings>> | null = null;
  let loadFailed = false;

  try {
    initialResult = await listFindings({ status: "PENDING", page: 1, pageSize: PAGE_SIZE, q: undefined });
  } catch {
    loadFailed = true;
  }

  return (
    <ReviewQueueClient
      initialResult={initialResult}
      initialLoadFailed={loadFailed}
      isAdmin={session?.user?.role === "ADMIN"}
    />
  );
}
