/** Skeleton — Figma node 15:216 (Dashboard / Overview / Loading). Pulsing placeholder block for page-level loading states. */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-small bg-canvas-subtle ${className}`} />;
}
