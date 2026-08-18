import { listScanRules } from "@/lib/scanRules";
import { RulesClient } from "@/components/admin/rules-client";

/**
 * Admin / Scan Rules (M08). Figma nodes 51:263 (Default), 51:264 (Loading —
 * see loading.tsx), 51:265 (Empty), 51:266 (Error), 51:267 (Create Rule —
 * own route, admin/rules/new), 51:268 (Invalid Regex — the Create/Edit
 * form's inline validation-error state), 51:269 (Disable Confirmation —
 * modal, handled client-side), 51:270 (Mobile — responsive CSS on this same
 * route).
 *
 * Server Component fetches the initial rule list directly via
 * lib/scanRules.ts's listScanRules() (built by the backend slice of this
 * module — reused as-is), matching the review-queue/tokens precedent:
 * fetch initial data server-side, hand off to a Client Component for
 * interactive actions (Enable/Disable) and retry-on-error.
 *
 * Route placed at (protected)/admin/rules — the Figma design (figma.page =
 * "05 — Admin", every frame named "Admin / Scan Rules / <State>") and every
 * backend route (GET/POST/PATCH/enable/disable) are gated by requireAdmin(),
 * so this lives under /admin, matching the middleware's existing
 * ADMIN-only gate for that path prefix. The Sidebar's pre-existing "Scan
 * Rules" nav item pointed at a not-yet-built /dashboard/rules placeholder;
 * it's corrected to /admin/rules here to match the actual designed and
 * authorized location (see components/layout/sidebar.tsx change).
 *
 * The (protected) layout's middleware already restricts /admin/:path* to
 * ADMIN role (redirects non-admins to /unauthorized before this page
 * renders); the try/catch below only distinguishes a genuine fetch failure
 * (Figma Error state) from a normal empty list (Figma Empty state) — it is
 * not a second authorization gate.
 */
export default async function ScanRulesPage() {
  let initialRules: Awaited<ReturnType<typeof listScanRules>> | null = null;
  let loadFailed = false;

  try {
    initialRules = await listScanRules();
  } catch {
    loadFailed = true;
  }

  return <RulesClient initialRules={initialRules} initialLoadFailed={loadFailed} />;
}
