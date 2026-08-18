import { ReactNode } from "react";

/**
 * StatCard — local composition (Figma nodes 15:77/81/85, "Scan Status / Flags Created / Active Scan Rules" cards).
 * Not yet a shared Figma component per M02 design notes; built from existing tokens.
 */
export function StatCard({
  label,
  value,
  valueClassName = "text-fg-default",
  helpText,
  indicatorClassName,
}: {
  label: string;
  value: ReactNode;
  valueClassName?: string;
  helpText: string;
  /** Optional colored dot rendered before the value (e.g. scan status). */
  indicatorClassName?: string;
}) {
  return (
    <div className="flex flex-1 flex-col gap-2 rounded-small border border-border-default p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-fg-muted">{label}</p>
      <div className="flex items-center gap-1.5">
        {indicatorClassName && <span className={`size-2 shrink-0 rounded-full ${indicatorClassName}`} />}
        <p className={`text-xl font-semibold leading-7 ${valueClassName}`}>{value}</p>
      </div>
      <p className="text-xs text-fg-muted">{helpText}</p>
    </div>
  );
}
