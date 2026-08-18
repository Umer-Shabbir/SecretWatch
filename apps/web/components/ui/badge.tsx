type BadgeStatus = "default" | "success" | "warning" | "error" | "done" | "accent";

const statusClasses: Record<BadgeStatus, string> = {
  default: "bg-canvas-subtle text-fg-muted border-border-default",
  success: "bg-success-subtle text-success-fg border-success-emphasis/30",
  warning: "bg-warning-subtle text-warning-fg border-warning-emphasis/30",
  error: "bg-danger-subtle text-danger-fg border-danger-emphasis/30",
  done: "bg-done-subtle text-done-fg border-done-emphasis/30",
  accent: "bg-accent-subtle text-accent-fg border-accent-emphasis/30",
};

/** Badge — Figma node 5:38. Status communicated via text + color together, never color alone. */
export function Badge({ status, children }: { status: BadgeStatus; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-small border px-2 py-0.5 text-xs font-medium ${statusClasses[status]}`}>
      {children}
    </span>
  );
}
