import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

/**
 * Figma node 13:8 — session boundary screen. Admin is the only authenticated
 * role after the 2026-08-17 scope correction, so this links back to the
 * admin credentials sign-in form rather than triggering a provider directly
 * (Credentials sign-in requires email/password input, not a one-click call).
 */
export default function SessionExpiredPage() {
  return (
    <AuthCard>
      <Badge status="warning">Session expired</Badge>
      <p className="text-center text-base font-semibold text-fg-default">Your session has expired</p>
      <p className="w-[296px] max-w-full text-center text-sm text-fg-muted">
        For your security, please sign in again to continue.
      </p>
      <Link href="/admin-sign-in" className="w-full">
        <Button>Sign in again</Button>
      </Link>
    </AuthCard>
  );
}
