import type { FindingSeverity } from "@secretwatch/shared";

interface FindingSeverityBadgeProps {
  severity?: FindingSeverity | null;
  className?: string;
}

const severityConfig: Record<
  FindingSeverity,
  { label: string; className: string }
> = {
  CRITICAL: {
    label: "CRITICAL",
    className: "bg-danger-subtle text-danger-fg border-danger-emphasis/30 font-semibold",
  },
  HIGH: {
    label: "HIGH",
    className: "bg-warning-subtle text-warning-fg border-warning-emphasis/30 font-medium",
  },
  MEDIUM: {
    label: "MEDIUM",
    className: "bg-accent-subtle text-accent-fg border-accent-emphasis/30 font-medium",
  },
  LOW: {
    label: "LOW",
    className: "bg-canvas-subtle text-fg-muted border-border-default font-normal",
  },
};

export function FindingSeverityBadge({ severity, className = "" }: FindingSeverityBadgeProps) {
  if (!severity) {
    return (
      <span
        className={`inline-flex items-center rounded-small border px-2 py-0.5 text-xs font-normal text-fg-muted bg-canvas-subtle border-border-default ${className}`}
      >
        UNRATED
      </span>
    );
  }

  const config = severityConfig[severity] ?? severityConfig.LOW;

  return (
    <span
      className={`inline-flex items-center rounded-small border px-2 py-0.5 text-xs ${config.className} ${className}`}
    >
      {config.label}
    </span>
  );
}
