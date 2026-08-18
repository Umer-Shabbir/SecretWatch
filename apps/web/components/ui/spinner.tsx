/** Spinner — Figma node 7:84. */
export function Spinner({ className = "" }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={`inline-block h-5 w-5 animate-spin rounded-full border-2 border-border-default border-t-accent-emphasis ${className}`}
    />
  );
}
