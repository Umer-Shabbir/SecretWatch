/**
 * Shared centering + card shell for auth screens.
 * Desktop: bordered 360px card (Figma 13:11/13:12).
 * Mobile (<=480px, Figma 13:9): edge-to-edge, no border, 24px horizontal padding.
 */
export function AuthCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-canvas-default px-6 sm:px-4">
      <div className="flex w-full max-w-[360px] flex-col items-center gap-6 bg-canvas-default p-0 sm:rounded-small sm:border sm:border-border-default sm:p-8">
        {children}
      </div>
    </div>
  );
}
