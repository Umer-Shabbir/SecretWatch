"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { PAT_PATTERN } from "@/lib/pat-format";

/**
 * Public, no-login GitHub token submission form (Part 2 of the 2026-08-17
 * scope correction). Lives outside both (auth) and (protected) route groups
 * — no session is required to view or submit. Client-side format validation
 * only hints at the trust boundary; POST /api/public/tokens re-validates
 * server-side with the same PAT_PATTERN (the only real trust boundary).
 *
 * SECURITY: the raw token value is only ever held in local component state
 * long enough to submit it, then discarded (not stored in a ref, not logged,
 * not put in the URL). On success, only a masked confirmation string
 * returned by the API is shown — the raw value is never rendered.
 */
export default function SubmitTokenPage() {
  const [token, setToken] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [maskedIdentifier, setMaskedIdentifier] = useState<string | null>(null);

  const clientFormatValid = PAT_PATTERN.test(token.trim());

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!clientFormatValid) {
      setError("Token does not match a recognized GitHub token format.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/public/tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const body = await res.json();

      if (!res.ok) {
        if (res.status === 429) {
          setError("Too many submissions. Please wait a minute and try again.");
        } else {
          setError("We couldn't accept this token. Please check the format and try again.");
        }
        return;
      }

      setMaskedIdentifier(body.maskedIdentifier as string);
      // Discard the raw value from state immediately after a successful
      // submission — nothing downstream ever needs it again.
      setToken("");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (maskedIdentifier) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
        <Alert variant="success">Token received: {maskedIdentifier}</Alert>
        <p className="max-w-md text-sm text-fg-muted">
          Thank you. Your token will be used to scan public GitHub repositories for leaked secrets.
        </p>
        <Link href="/" className="text-sm font-medium text-accent-fg hover:underline">
          Back to home
        </Link>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-6">
      <div className="flex w-full max-w-md flex-col gap-4">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-fg-default">Submit a GitHub token</h1>
          <p className="mt-1 text-sm text-fg-muted">
            Paste a GitHub personal access token to be used for scanning public repositories for leaked secrets.
          </p>
        </div>

        {error && <Alert variant="error">{error}</Alert>}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            label="GitHub personal access token"
            name="token"
            type="password"
            autoComplete="off"
            placeholder="ghp_..."
            required
            value={token}
            onChange={(e) => setToken(e.target.value)}
            error={!!error}
          />
          <Button type="submit" loading={submitting}>
            Submit token
          </Button>
        </form>

        <p className="text-center text-xs text-fg-subtle">
          Your token is encrypted at rest and never displayed after submission. It is used only to search public
          GitHub repositories and is never logged in plaintext.
        </p>

        <Link href="/" className="text-center text-xs font-medium text-accent-fg hover:underline">
          Back to home
        </Link>
      </div>
    </main>
  );
}
