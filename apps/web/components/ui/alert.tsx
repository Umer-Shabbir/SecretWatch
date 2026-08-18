type AlertVariant = "info" | "success" | "warning" | "error";

const variantClasses: Record<AlertVariant, string> = {
  info: "bg-accent-subtle text-accent-fg border-accent-emphasis/30",
  success: "bg-success-subtle text-success-fg border-success-emphasis/30",
  warning: "bg-warning-subtle text-warning-fg border-warning-emphasis/30",
  error: "bg-danger-subtle text-danger-fg border-danger-emphasis/30",
};

/** Alert — Figma node 5:51. Info/Success/Warning/Error variants. Text always shown, never color-only. */
export function Alert({ variant, children }: { variant: AlertVariant; children: React.ReactNode }) {
  return (
    <div role="alert" className={`w-full rounded-small border px-3 py-2 text-sm ${variantClasses[variant]}`}>
      {children}
    </div>
  );
}
