"use client";

import { useState } from "react";
import Link from "next/link";

/**
 * Marketing top navigation — implements the "Nav" region of the M12 Landing /
 * How It Works frames (Figma page "03 — Marketing", nodes 53:2013 / 53:2015).
 *
 * GitHub-native: borders over shadows, blue primary CTA, Inter type. Collapses
 * to a hamburger drawer on mobile per DESIGN.md §30 (drawer navigation,
 * full-width primary actions, 44px minimum interactive target).
 *
 * The /pricing link is intentionally omitted: M12's pricing content is not
 * needed as this is not a selling product.
 */
const NAV_LINKS = [
  { href: "/features", label: "Features" },
  { href: "/how-it-works", label: "How it works" },
  { href: "/open-source", label: "Open Source" },
  { href: "/docs", label: "Docs" },
];

export function MarketingNav() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-border-default bg-canvas-default/95 backdrop-blur">
      <nav
        aria-label="Primary"
        className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6"
      >
        <Link href="/" className="flex items-center gap-2 text-base font-semibold text-fg-default">
          <span
            aria-hidden="true"
            className="flex size-7 items-center justify-center rounded-small bg-accent-emphasis text-sm font-bold text-white"
          >
            S
          </span>
          SecretWatch
        </Link>

        {/* Desktop links + CTAs */}
        <div className="hidden items-center gap-6 md:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-fg-muted transition-colors hover:text-fg-default"
            >
              {link.label}
            </Link>
          ))}
          <Link
            href="/admin-sign-in"
            className="text-sm font-medium text-fg-muted transition-colors hover:text-fg-default"
          >
            Admin sign in
          </Link>
          <Link
            href="/submit-token"
            className="flex h-9 items-center rounded-small bg-accent-emphasis px-4 text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            Submit a token
          </Link>
        </div>

        {/* Mobile hamburger */}
        <button
          type="button"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          aria-controls="marketing-mobile-menu"
          onClick={() => setOpen((v) => !v)}
          className="flex size-11 items-center justify-center rounded-small border border-border-default text-fg-default md:hidden"
        >
          <span aria-hidden="true" className="text-lg leading-none">
            {open ? "✕" : "☰"}
          </span>
        </button>
      </nav>

      {/* Mobile drawer */}
      {open && (
        <div
          id="marketing-mobile-menu"
          className="border-t border-border-default bg-canvas-default px-6 py-4 md:hidden"
        >
          <div className="flex flex-col gap-1">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="flex h-11 items-center text-sm font-medium text-fg-default"
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/admin-sign-in"
              onClick={() => setOpen(false)}
              className="flex h-11 items-center text-sm font-medium text-fg-default"
            >
              Admin sign in
            </Link>
            <Link
              href="/submit-token"
              onClick={() => setOpen(false)}
              className="mt-2 flex h-11 items-center justify-center rounded-small bg-accent-emphasis px-4 text-sm font-medium text-white"
            >
              Submit a token
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
