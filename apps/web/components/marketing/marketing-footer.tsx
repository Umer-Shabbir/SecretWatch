import Link from "next/link";

/**
 * Marketing footer — implements the shared "footer" region of the M12 frames
 * (Figma page "03 — Marketing"). Stacks to a single column on mobile per
 * DESIGN.md §30.
 *
 * /pricing intentionally omitted (this is not a selling product, no pricing page needed).
 */
export function MarketingFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border-default bg-canvas-subtle">
      <div className="mx-auto flex max-w-6xl flex-col gap-10 px-6 py-16 md:flex-row md:justify-between">
        <div className="flex flex-col gap-4">
          <span className="flex items-center gap-2 text-sm font-semibold text-fg-default">
            <span
              aria-hidden="true"
              className="flex size-6 items-center justify-center rounded-small bg-accent-emphasis text-xs font-bold text-white"
            >
              S
            </span>
            SecretWatch
          </span>
          <p className="max-w-xs text-sm text-fg-muted">
            Automated secret discovery for public GitHub code — findings without
            ever storing raw secrets.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-8 sm:grid-cols-4 lg:gap-12">
          {/* Product Column */}
          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold text-fg-default">Product</h3>
            <nav aria-label="Footer Product" className="flex flex-col gap-2">
              <Link href="/features" className="text-sm text-fg-muted transition-colors hover:text-fg-default">
                Features
              </Link>
              <Link href="/how-it-works" className="text-sm text-fg-muted transition-colors hover:text-fg-default">
                How it works
              </Link>
              <Link href="/submit-token" className="text-sm text-fg-muted transition-colors hover:text-fg-default">
                Submit a token
              </Link>
              <Link href="/admin-sign-in" className="text-sm text-fg-muted transition-colors hover:text-fg-default">
                Admin sign in
              </Link>
            </nav>
          </div>

          {/* Resources Column */}
          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold text-fg-default">Resources</h3>
            <nav aria-label="Footer Resources" className="flex flex-col gap-2">
              <Link href="/docs" className="text-sm text-fg-muted transition-colors hover:text-fg-default">
                Documentation
              </Link>
              <Link href="/open-source" className="text-sm text-fg-muted transition-colors hover:text-fg-default">
                Open Source
              </Link>
              <Link href="/blog" className="text-sm text-fg-muted transition-colors hover:text-fg-default">
                Blog
              </Link>
            </nav>
          </div>

          {/* Community Column */}
          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold text-fg-default">Community</h3>
            <nav aria-label="Footer Community" className="flex flex-col gap-2">
              <a href="https://github.com/secretwatch" className="text-sm text-fg-muted transition-colors hover:text-fg-default" target="_blank" rel="noopener noreferrer">
                GitHub
              </a>
              <a href="https://twitter.com/secretwatch" className="text-sm text-fg-muted transition-colors hover:text-fg-default" target="_blank" rel="noopener noreferrer">
                Twitter
              </a>
              <a href="https://discord.gg/secretwatch" className="text-sm text-fg-muted transition-colors hover:text-fg-default" target="_blank" rel="noopener noreferrer">
                Discord
              </a>
            </nav>
          </div>

          {/* Legal Column */}
          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold text-fg-default">Legal</h3>
            <nav aria-label="Footer Legal" className="flex flex-col gap-2">
              <Link href="/privacy" className="text-sm text-fg-muted transition-colors hover:text-fg-default">
                Privacy
              </Link>
              <Link href="/terms" className="text-sm text-fg-muted transition-colors hover:text-fg-default">
                Terms
              </Link>
            </nav>
          </div>
        </div>
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
