import { getDashboardMetrics } from "@/lib/metrics";
import { getSystemSettings } from "@/lib/system-settings";
import { getLiveActivity } from "@/lib/activity";
import { StatCard } from "@/components/ui/stat-card";
import { DashboardControls } from "@/components/admin/dashboard-controls";
import { WorkerActivity } from "@/components/admin/worker-activity";

/**
 * Admin Overview (2026-08-24 admin-control addition). The dashboard landing
 * page: high-level metrics (findings by status, token pool, flag outcomes),
 * the subsystem controls (Scanner/Flagger switches + system settings + manual
 * run), and a live worker-activity feed (what the scanner found / the flagger
 * flagged, refreshed by polling).
 *
 * Server Component — reads metrics + settings + initial activity on the server
 * (all DB reads), hands the interactive controls and the polling feed to
 * Client Components. ADMIN-only access is enforced by middleware
 * (/admin/:path*) and the (protected) layout.
 */
export const dynamic = "force-dynamic";

export default async function AdminOverviewPage() {
  const [metrics, settings, activity] = await Promise.all([
    getDashboardMetrics(),
    getSystemSettings(),
    getLiveActivity(),
  ]);

  return (
    <main className="flex w-full flex-col gap-6 p-4 sm:p-8">
      <div>
        <h1 className="text-2xl font-semibold leading-8 text-fg-default">Overview</h1>
        <p className="mt-1 text-sm text-fg-muted">Scanning activity, findings, and subsystem controls.</p>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row">
        <StatCard
          label="Open findings"
          value={metrics.findings.pending}
          helpText={`${metrics.findings.total} total · ${metrics.findings.approved} approved`}
          indicatorClassName={metrics.findings.pending > 0 ? "bg-warning-emphasis" : "bg-success-emphasis"}
        />
        <StatCard
          label="Flagged"
          value={metrics.findings.flagged}
          helpText={`${metrics.flags.succeeded} issues opened · ${metrics.findings.failed} failed`}
        />
        <StatCard
          label="Active tokens"
          value={metrics.tokens.active}
          helpText={`${metrics.tokens.total} total in pool`}
          indicatorClassName={metrics.tokens.active > 0 ? "bg-success-emphasis" : "bg-danger-emphasis"}
        />
        <StatCard
          label="Subsystems"
          value={`${metrics.switches.scannerEnabled ? "On" : "Off"} / ${metrics.switches.flaggerEnabled ? "On" : "Off"}`}
          helpText="Scanner / Flagger"
        />
      </div>

      <DashboardControls initialSettings={settings} />

      <WorkerActivity initial={activity} />

      <div className="flex flex-col gap-4 sm:flex-row">
        <StatCard label="Approved" value={metrics.findings.approved} helpText="Awaiting flag run" />
        <StatCard label="Ignored" value={metrics.findings.ignored} helpText="Dismissed by review" />
        <StatCard label="Failed" value={metrics.findings.failed} helpText="Flag attempts that failed" />
      </div>
    </main>
  );
}
