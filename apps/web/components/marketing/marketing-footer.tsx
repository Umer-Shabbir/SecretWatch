import Link from "next/link";

/**
 * Marketing footer — implements the shared "footer" region of the M12 frames
 * (Figma page "03 — Marketing"). Stacks to a single column on mobile per
 * DESIGN.md §30.
 *
 * /pricing intentionally omitted (no product source-of-truth for pricing —
 * see state/modules/M12.json knownIssues).
 */
export function MarketingFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border-default bg-canvas-subtle">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-10 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2">
          <span className="flex items-center gap-2 text-sm font-semibold text-fg-default">
            <span
              aria-hidden="true"
              className="flex size-6 items-center justify-center rounded-small bg-accent-emphasis text-xs font-bold text-white"
            >
              S
            </span>
            SecretWatch
          </span>
          <p className="max-w-xs text-xs text-fg-muted">
            Automated secret discovery for public GitHub code — findings without
            ever storing raw secrets.
          </p>
        </div>

        <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <Link href="/how-it-works" className="text-fg-muted hover:text-fg-default">
            How it works
          </Link>
          <Link href="/submit-token" className="text-fg-muted hover:text-fg-default">
            Submit a token
          </Link>
          <Link href="/admin-sign-in" className="text-fg-muted hover:text-fg-default">
            Admin sign in
          </Link>
        </nav>
      </div>

      <div className="border-t border-border-muted">
        <div className="mx-auto max-w-6xl px-6 py-4">
          <p className="text-xs text-fg-subtle">
            © {year} SecretWatch. Scans public code only. Not affiliated with GitHub.
          </p>
        </div>
      </div>
    </footer>
  );
}
