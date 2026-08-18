import { ReactNode } from "react";

/** ErrorState — Figma node 15:492 (Dashboard / Overview / Error). Red-bordered panel, explicit retry action. */
export function ErrorState({
  title = "Something went wrong",
  description,
  action,
}: {
  title?: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 rounded-small border border-danger-emphasis/30 bg-danger-subtle py-10 text-center">
      <p className="text-sm font-semibold text-danger-fg">{title}</p>
      <p className="text-sm text-fg-default">{description}</p>
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
