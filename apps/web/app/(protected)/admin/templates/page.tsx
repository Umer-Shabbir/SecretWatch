import { listMessageTemplates } from "@/lib/messageTemplates";
import { TemplatesClient } from "@/components/admin/templates-client";

/**
 * Admin / Templates (M09). Figma nodes 51:271 (Default), 51:272 (Loading —
 * see loading.tsx), 51:273 (Error), 51:274 (Invalid Variable — the
 * Create/Edit form's inline validation-error state, own route), 51:275
 * (Save Success — same form's success state, own route), 51:276 (Mobile —
 * responsive CSS on this same route, matching M08's precedent).
 *
 * Server Component fetches the initial template list directly via
 * lib/messageTemplates.ts's listMessageTemplates() (built by the backend
 * slice of this module — reused as-is), matching admin/rules/page.tsx's
 * exact fetch-server-side/hand-off-to-client-component pattern.
 *
 * Route placed at (protected)/admin/templates — every backend route
 * (GET/POST/PATCH/DELETE /api/message-templates) is gated by
 * requireAdmin(), and the middleware already restricts /admin/:path* to
 * ADMIN role (redirects non-admins to /unauthorized before this page
 * renders). The Sidebar's "Templates" nav item already points here
 * (components/layout/sidebar.tsx, adminNav).
 *
 * No Empty state was designed in Figma (state/modules/M09.json's
 * figma.scopeNotes: the product always ships with >=1 default template,
 * so an empty template library isn't a realistic first-run state) — this
 * page still degrades gracefully to an empty list if it ever occurs, per
 * the task's "handle zero gracefully" instruction, without inventing a new
 * Figma-styled Empty frame that doesn't exist.
 */
export default async function TemplatesPage() {
  let initialTemplates: Awaited<ReturnType<typeof listMessageTemplates>> | null = null;
  let loadFailed = false;

  try {
    initialTemplates = await listMessageTemplates();
  } catch {
    loadFailed = true;
  }

  return <TemplatesClient initialTemplates={initialTemplates} initialLoadFailed={loadFailed} />;
}
