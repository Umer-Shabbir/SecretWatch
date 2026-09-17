"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export interface NavItem {
  label: string;
  href: string;
  /** Match only the exact path (used for the Overview root, which is a prefix of every other admin route). */
  exact?: boolean;
}

// Admin is the only authenticated role after the 2026-08-17 scope
// correction — there is no end-user dashboard/findings/tokens area, so the
// sidebar shows only admin-scoped nav items.
export const adminNav: NavItem[] = [
  { label: "Overview", href: "/admin", exact: true },
  { label: "Review Queue", href: "/admin/review-queue" },
  { label: "Audit Log", href: "/admin/activity" },
  { label: "Scan Rules", href: "/admin/rules" },
  { label: "Repo Filters", href: "/admin/repository-filters" },
  { label: "Templates", href: "/admin/templates" },
  { label: "Workers", href: "/admin/workers" },
  { label: "Tokens", href: "/admin/tokens" },
  { label: "Webhooks", href: "/admin/notifications" },
];

/** Sidebar — Figma node 7:15. 240px fixed width, Nav Item instances with Selected/Default states per DESIGN.md §9.1/10.1. */
export function Sidebar() {
  const pathname = usePathname();

  const renderGroup = (items: NavItem[]) =>
    items.map((item) => {
      const selected = item.exact
        ? pathname === item.href
        : pathname === item.href || pathname?.startsWith(`${item.href}/`);
      return (
        <Link
          key={item.href}
          href={item.href}
          aria-current={selected ? "page" : undefined}
          className={`w-full rounded-small px-3 py-2 text-sm ${
            selected ? "bg-accent-subtle font-medium text-accent-fg" : "text-fg-default hover:bg-canvas-subtle"
          }`}
        >
          {item.label}
        </Link>
      );
    });

  return (
    <nav
      aria-label="Primary"
      className="hidden h-full w-[240px] shrink-0 flex-col gap-1 border-r border-border-default px-3 py-4 md:flex"
    >
      {renderGroup(adminNav)}
    </nav>
  );
}
