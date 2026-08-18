import { ReactNode } from "react";

/** EmptyState — Figma node 15:371 (Dashboard / Overview / Empty). Functional, no decorative illustration. */
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 py-10 text-center">
      <p className="text-sm font-semibold text-fg-default">{title}</p>
      <p className="text-sm text-fg-muted">{description}</p>
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
