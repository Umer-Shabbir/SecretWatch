import Link from "next/link";
import { Button } from "@/components/ui/button";

/** Marketing landing stub — full marketing site is M12 scope. */
export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
      <h1 className="text-2xl font-semibold text-fg-default">SecretWatch</h1>
      <p className="max-w-md text-sm text-fg-muted">
        Scan public GitHub repositories for leaked secrets and manage findings.
      </p>
      <Link href="/submit-token" className="w-full max-w-[240px]">
        <Button>Submit a GitHub token</Button>
      </Link>
      <Link href="/admin-sign-in" className="text-xs font-medium text-accent-fg hover:underline">
        Admin sign in
      </Link>
    </main>
  );
}
