"use client";

import { useState, useCallback, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useSSE } from "@/lib/use-sse";
import { adminNav } from "./sidebar";

/** Header — Figma node 7:34. Compact, product logo/breadcrumb left, search/theme/avatar right. Per DESIGN.md §11. */
export function Header({
  breadcrumb,
  userImage,
  userName,
}: {
  breadcrumb?: string;
  userImage?: string | null;
  userName?: string | null;
}) {
  const { connected, error } = useSSE({});
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const pathname = usePathname();

  useEffect(() => {
    const currentTheme = document.documentElement.dataset.theme as "light" | "dark" | undefined;
    if (currentTheme) {
      setTheme(currentTheme);
    } else {
      setTheme(window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    }
  }, []);

  const toggleTheme = useCallback(() => {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    document.documentElement.dataset.theme = newTheme;
  }, [theme]);

  // Handle logout
  const handleSignOut = () => {
    signOut({ callbackUrl: "/admin-sign-in" });
  };


  return (
    <header className="relative z-40 shrink-0 border-b border-border-default bg-canvas-default">
      <div className="flex h-14 items-center justify-between px-5">
        <div className="flex items-center gap-3">
          {/* Mobile hamburger toggle */}
          <button
            type="button"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            aria-controls="admin-mobile-menu"
            onClick={() => setMenuOpen((v) => !v)}
            className="flex size-8 items-center justify-center rounded-small border border-border-default text-fg-default md:hidden"
          >
            <span aria-hidden="true" className="text-lg leading-none">
              {menuOpen ? "✕" : "☰"}
            </span>
          </button>
          <span className="text-base font-semibold text-fg-default">SecretWatch</span>
          {breadcrumb && <span className="hidden sm:inline text-sm text-fg-muted">{breadcrumb}</span>}
        </div>
        <div className="flex items-center gap-3">
          {/* SSE connection indicator (UX-001) */}
          <div className="hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-small text-xs border border-border-default bg-canvas-subtle">
            <span
              className={`size-2 shrink-0 rounded-full ${
                connected
                  ? "animate-pulse bg-success-emphasis"
                  : error
                  ? "bg-danger-emphasis"
                  : "bg-warning-emphasis"
              }`}
              aria-hidden="true"
            />
            <span className="text-fg-muted">
              {connected ? "Live" : error ? "Disconnected" : "Connecting..."}
            </span>
          </div>

          <div className="hidden h-8 w-[200px] items-center rounded-small border border-border-default bg-canvas-subtle px-2.5 sm:flex">
            <span className="text-[13px] text-fg-subtle">Search...</span>
          </div>
          <button
            type="button"
            aria-label="Toggle theme"
            onClick={toggleTheme}
            className="hidden sm:flex size-8 items-center justify-center rounded-small border border-border-default bg-canvas-default text-fg-muted hover:bg-canvas-subtle transition-colors"
          >
            <span aria-hidden="true">◐</span>
          </button>

          {/* Account menu dropdown (UX-002) */}
          <div className="relative">
            <button
              type="button"
              aria-label="Account menu"
              aria-expanded={accountMenuOpen}
              aria-haspopup="true"
              onClick={() => setAccountMenuOpen((v) => !v)}
              className="flex items-center gap-1 rounded-full border border-transparent focus:outline-none focus:ring-2 focus:ring-accent-emphasis"
            >
              {userImage ? (
                <Image
                  src={userImage}
                  alt={userName ? `${userName} avatar` : "Account avatar"}
                  width={32}
                  height={32}
                  className="size-8 rounded-full"
                />
              ) : (
                <span className="flex size-8 items-center justify-center rounded-full bg-accent-subtle text-accent-fg font-semibold text-xs" aria-hidden="true">
                  {userName ? userName.slice(0, 2).toUpperCase() : "AD"}
                </span>
              )}
            </button>

            {accountMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setAccountMenuOpen(false)}
                  aria-hidden="true"
                />
                <div
                  role="menu"
                  aria-orientation="vertical"
                  className="absolute right-0 top-full mt-2 z-50 w-56 rounded-medium border border-border-default bg-canvas-default p-1 shadow-lg"
                >
                  <div className="px-3 py-2 border-b border-border-default text-xs">
                    <p className="font-semibold text-fg-default truncate">
                      {userName || "Administrator"}
                    </p>
                    <p className="text-fg-muted truncate">Admin Account</p>
                  </div>
                  <div className="py-1">
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setAccountMenuOpen(false);
                        handleSignOut();
                      }}
                      className="flex w-full items-center gap-2 rounded-small px-3 py-1.5 text-xs text-danger-fg hover:bg-danger-subtle transition-colors text-left"
                    >
                      <span aria-hidden="true">⎋</span>
                      Sign Out
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Mobile drawer rendering below header */}
      {menuOpen && (
        <div
          id="admin-mobile-menu"
          className="absolute left-0 top-full z-50 flex w-full flex-col border-b border-border-default bg-canvas-default px-5 py-4 shadow-md md:hidden"
        >
          <nav className="flex flex-col gap-1">
            {adminNav.map((item) => {
              const selected = item.exact
                ? pathname === item.href
                : pathname === item.href || pathname?.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMenuOpen(false)}
                  aria-current={selected ? "page" : undefined}
                  className={`w-full rounded-small px-3 py-2.5 text-sm ${
                    selected ? "bg-accent-subtle font-medium text-accent-fg" : "text-fg-default hover:bg-canvas-subtle"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      )}
    </header>
  );
}
