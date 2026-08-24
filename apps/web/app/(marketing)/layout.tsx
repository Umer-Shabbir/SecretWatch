import type { ReactNode } from "react";
import { MarketingNav } from "@/components/marketing/marketing-nav";
import { MarketingFooter } from "@/components/marketing/marketing-footer";

/**
 * Marketing route-group layout (M12). Public, no auth — the middleware matcher
 * only guards /admin. Marketing surfaces are more spacious than the
 * authenticated product (DESIGN.md §29) but share the same GitHub-native tokens
 * and must not look like a separate brand.
 */
export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-canvas-default">
      <MarketingNav />
      <main className="flex-1">{children}</main>
      <MarketingFooter />
    </div>
  );
}
