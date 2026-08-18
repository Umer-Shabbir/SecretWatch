import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

/** Figma node 13:7 — protected-route / role-gate boundary (403). */
export default function UnauthorizedPage() {
  return (
    <AuthCard>
      <Badge status="error">403 Forbidden</Badge>
      <p className="text-center text-base font-semibold text-fg-default">You don&apos;t have access to this page</p>
      <p className="w-[296px] max-w-full text-center text-sm text-fg-muted">
        This area requires administrator permissions. If you believe this is a mistake, contact your
        SecretWatch administrator.
      </p>
      <Link href="/" className="w-full">
        <Button variant="secondary">Back to home</Button>
      </Link>
    </AuthCard>
  );
}
