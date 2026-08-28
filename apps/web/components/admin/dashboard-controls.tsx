"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import type { SystemSettings } from "@/lib/system-settings";

/**
 * DashboardControls (2026-08-24 admin-control addition). The interactive part
 * of the admin Overview: two master ON/OFF switches (Scanner, Flagger) wired
 * to PATCH /api/system/settings, and two manual-run buttons (Run Scanner, Run
 * Flagger) wired to the /api/admin/{scan,flag}/run endpoints.
 *
 * The switch is the source of truth: when off, the background subsystem stops
 * (scheduler enqueues nothing, worker no-ops per job). Run buttons enqueue an
 * immediate batch but still respect the switch server-side — running while a
 * switch is off is a reported no-op, never a bypass.
 */
export function DashboardControls({ initialSettings }: { initialSettings: SystemSettings }) {
  const router = useRouter();
  const [settings, setSettings] = useState<SystemSettings>(initialSettings);
  const [toggling, setToggling] = useState<null | "scanner" | "flagger" | "autoFlag" | "autoApprove">(null);
  const [running, setRunning] = useState<null | "scan" | "flag">(null);
  const [savingTuning, setSavingTuning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Draft values for the numeric tuning inputs, kept separate from `settings`
  // so typing doesn't fire a request per keystroke — committed on Save.
  const [scanResultsDraft, setScanResultsDraft] = useState(String(initialSettings.scanResultsPerRule));
  const [rateThresholdDraft, setRateThresholdDraft] = useState(
    String(initialSettings.flagRateLimitThreshold)
  );

  const busy = toggling !== null || running !== null || savingTuning;

  /** PATCHes a settings subset, updates local state, returns success. */
  async function patchSettings(
    patch: Partial<Record<"scannerEnabled" | "flaggerEnabled" | "autoFlagEnabled" | "autoApproveEnabled" | "scanResultsPerRule" | "flagRateLimitThreshold", boolean | number>>
  ): Promise<boolean> {
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/system/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body?.error ?? "Could not update settings. Please try again.");
        return false;
      }
      setSettings(body.settings);
      router.refresh();
      return true;
    } catch {
      setError("Could not update settings. Please try again.");
      return false;
    }
  }

  async function toggle(which: "scanner" | "flagger") {
    const key = which === "scanner" ? "scannerEnabled" : "flaggerEnabled";
    const turningOn = !settings[key];
    setToggling(which);
    const ok = await patchSettings({ [key]: turningOn });
    if (ok && turningOn) {
      setNotice(`${which === "scanner" ? "Scanner" : "Flagger"} enabled — jobs are being enqueued now.`);
    }
    setToggling(null);
  }

  async function toggleAutoFlag() {
    setToggling("autoFlag");
    await patchSettings({ autoFlagEnabled: !settings.autoFlagEnabled });
    setToggling(null);
  }

  async function toggleAutoApprove() {
    setToggling("autoApprove");
    await patchSettings({ autoApproveEnabled: !settings.autoApproveEnabled });
    setToggling(null);
  }

  async function saveTuning() {
    const scanResults = Number(scanResultsDraft);
    const rateThreshold = Number(rateThresholdDraft);
    if (!Number.isInteger(scanResults) || scanResults < 1 || scanResults > 100) {
      setError("Scan results per rule must be a whole number between 1 and 100.");
      return;
    }
    if (!Number.isInteger(rateThreshold) || rateThreshold < 0 || rateThreshold > 1000) {
      setError("Flag rate-limit threshold must be a whole number between 0 and 1000.");
      return;
    }
    setSavingTuning(true);
    const ok = await patchSettings({
      scanResultsPerRule: scanResults,
      flagRateLimitThreshold: rateThreshold,
    });
    if (ok) setNotice("System settings saved.");
    setSavingTuning(false);
  }

  async function run(which: "scan" | "flag") {
    setRunning(which);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/admin/${which}/run`, { method: "POST" });
      const body = await res.json();
      if (!res.ok) {
        setError(body?.error ?? "Could not start the run. Please try again.");
        return;
      }
      const enabled = which === "scan" ? body.scannerEnabled : body.flaggerEnabled;
      if (enabled === false) {
        setNotice(
          `${which === "scan" ? "Scanner" : "Flagger"} is switched off — nothing was enqueued. Turn it on first.`
        );
      } else {
        setNotice(`Enqueued ${body.enqueued} ${which === "scan" ? "scan job(s)" : "flag job(s)"}.`);
        router.refresh();
      }
    } catch {
      setError("Could not start the run. Please try again.");
    } finally {
      setRunning(null);
    }
  }

  return (
    <section className="flex w-full flex-col gap-4 rounded-small border border-border-default p-5">
      <h2 className="text-sm font-semibold text-fg-default">Controls</h2>

      {error && (
        <p role="alert" className="text-sm text-danger-fg">
          {error}
        </p>
      )}
      {notice && <p className="text-sm text-fg-muted">{notice}</p>}

      <div className="flex flex-col gap-4 sm:flex-row">
        <SubsystemControl
          title="Scanner"
          description="Scheduled scanning of GitHub for leaked secrets."
          enabled={settings.scannerEnabled}
          toggling={toggling === "scanner"}
          running={running === "scan"}
          disabled={busy}
          onToggle={() => toggle("scanner")}
          onRun={() => run("scan")}
          runLabel="Run Scanner"
        />
        <SubsystemControl
          title="Flagger"
          description="Opens GitHub issues on repos with approved findings."
          enabled={settings.flaggerEnabled}
          toggling={toggling === "flagger"}
          running={running === "flag"}
          disabled={busy}
          onToggle={() => toggle("flagger")}
          onRun={() => run("flag")}
          runLabel="Run Flagger"
        />
      </div>

      <div className="flex flex-col gap-4 rounded-small border border-border-muted p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-fg-default">Auto-approve findings</p>
            <p className="text-xs text-fg-muted">
              When on, new findings from the scanner are automatically approved without admin review.
              Combined with auto-flag, this creates a fully automated pipeline.
            </p>
            {settings.autoApproveEnabled && (
              <p className="mt-1 text-xs font-medium text-warning-fg">
                ⚠ Admin review is bypassed — findings are approved automatically.
              </p>
            )}
          </div>
          <ToggleSwitch
            label="Auto-approve findings"
            enabled={settings.autoApproveEnabled}
            disabled={busy}
            onToggle={toggleAutoApprove}
          />
        </div>

        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-fg-default">Auto-flag on approval</p>
            <p className="text-xs text-fg-muted">
              When on, approving a finding immediately queues a flag. When off, approved findings wait for
              a manual &ldquo;Run Flagger&rdquo;.
            </p>
          </div>
          <ToggleSwitch
            label="Auto-flag on approval"
            enabled={settings.autoFlagEnabled}
            disabled={busy}
            onToggle={toggleAutoFlag}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <NumberField
            id="scanResultsPerRule"
            label="Scan results per rule"
            hint="GitHub code-search results pulled per rule per scan (1–100)."
            value={scanResultsDraft}
            onChange={setScanResultsDraft}
            disabled={busy}
          />
          <NumberField
            id="flagRateLimitThreshold"
            label="Flag rate-limit threshold"
            hint="Skip a token when its remaining GitHub rate limit is at or below this (0–1000)."
            value={rateThresholdDraft}
            onChange={setRateThresholdDraft}
            disabled={busy}
          />
        </div>

        <Button variant="secondary" className="w-auto self-start" onClick={saveTuning} loading={savingTuning} disabled={busy}>
          Save system settings
        </Button>
      </div>
    </section>
  );
}

function ToggleSwitch({
  label,
  enabled,
  disabled,
  onToggle,
}: {
  label: string;
  enabled: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      aria-label={`Turn ${label} ${enabled ? "off" : "on"}`}
      disabled={disabled}
      onClick={onToggle}
      className={`relative h-5 w-9 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
        enabled ? "bg-success-emphasis" : "bg-border-default"
      }`}
    >
      <span
        className={`absolute top-0.5 size-4 rounded-full bg-white transition-transform ${
          enabled ? "translate-x-4" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

function NumberField({
  id,
  label,
  hint,
  value,
  onChange,
  disabled,
}: {
  id: string;
  label: string;
  hint: string;
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium text-fg-default">
        {label}
      </label>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-small border border-border-default bg-canvas-default px-3 py-1.5 font-mono text-sm text-fg-default disabled:opacity-50"
      />
      <p className="text-xs text-fg-muted">{hint}</p>
    </div>
  );
}

function SubsystemControl({
  title,
  description,
  enabled,
  toggling,
  running,
  disabled,
  onToggle,
  onRun,
  runLabel,
}: {
  title: string;
  description: string;
  enabled: boolean;
  toggling: boolean;
  running: boolean;
  disabled: boolean;
  onToggle: () => void;
  onRun: () => void;
  runLabel: string;
}) {
  return (
    <div className="flex flex-1 flex-col gap-3 rounded-small border border-border-muted p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span
            className={`size-2 shrink-0 rounded-full ${enabled ? "bg-success-emphasis" : "bg-fg-subtle"}`}
            aria-hidden="true"
          />
          <span className="text-sm font-medium text-fg-default">{title}</span>
          <span className="text-xs text-fg-muted">{enabled ? "On" : "Off"}</span>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label={`Turn ${title} ${enabled ? "off" : "on"}`}
          disabled={disabled}
          onClick={onToggle}
          className={`relative h-5 w-9 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
            enabled ? "bg-success-emphasis" : "bg-border-default"
          }`}
        >
          <span
            className={`absolute top-0.5 size-4 rounded-full bg-white transition-transform ${
              enabled ? "translate-x-4" : "translate-x-0.5"
            }`}
          />
        </button>
      </div>
      <p className="text-xs text-fg-muted">{description}</p>
      <Button variant="secondary" className="w-auto self-start" onClick={onRun} loading={running} disabled={disabled}>
        {runLabel}
      </Button>
    </div>
  );
}
