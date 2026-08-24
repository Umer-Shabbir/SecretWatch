import type { Metadata } from "next";
import Link from "next/link";
import { RedactedFindingPreview } from "@/components/marketing/redacted-finding-preview";

export const metadata: Metadata = {
  title: "SecretWatch — Find leaked secrets in public GitHub code",
  description:
    "SecretWatch scans public GitHub code for leaked API keys and secrets, records redacted findings without ever storing raw secrets, and reports them through authorized GitHub credentials.",
  openGraph: {
    title: "SecretWatch — Find leaked secrets in public GitHub code",
    description:
      "Automated secret discovery for public GitHub code. Redacted findings, admin review, and authorized reporting — raw secrets never stored.",
    type: "website",
  },
};

const STEPS = [
  {
    step: "01",
    title: "Authorize",
    body: "Submit a scoped GitHub token. It is encrypted at rest and decrypted only in memory when a scan needs it.",
  },
  {
    step: "02",
    title: "Scan",
    body: "Workers search public GitHub code against regex and entropy rules, matching likely API keys and secrets.",
  },
  {
    step: "03",
    title: "Report",
    body: "Confirmed findings can open a GitHub issue on the offending repo, posted through your authorized identity.",
  },
];

const TRUST = [
  {
    title: "Raw secrets never stored",
    body: "The data model persists only a redacted snippet. The actual secret value is never written to disk.",
  },
  {
    title: "Redacted evidence only",
    body: "Findings show a masked match (AKIA••••••••••9F3) — enough context to act, nothing an attacker can reuse.",
  },
  {
    title: "Tokens encrypted at rest",
    body: "GitHub tokens are encrypted in the database and decrypted only in memory, never logged or shown.",
  },
  {
    title: "Admin review gate",
    body: "Findings are reviewed before any issue is filed. Flagging is an auditable, controlled action.",
  },
];

export default function LandingPage() {
  return (
    <>
      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 pb-16 pt-16 sm:pt-24">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div className="flex flex-col gap-6">
            <span className="inline-flex w-fit items-center gap-2 rounded-full border border-border-default bg-canvas-subtle px-3 py-1 text-xs font-medium text-fg-muted">
              <span aria-hidden="true" className="size-1.5 rounded-full bg-success-emphasis" />
              Scans public GitHub code only
            </span>
            <h1 className="text-4xl font-semibold leading-tight tracking-tight text-fg-default sm:text-5xl">
              Find leaked secrets in public GitHub code
            </h1>
            <p className="max-w-xl text-lg text-fg-muted">
              SecretWatch scans public repositories for leaked API keys and
              secrets, records redacted findings, and reports them through
              authorized GitHub credentials — without ever storing the raw
              secret.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link
                href="/submit-token"
                className="flex h-11 items-center justify-center rounded-small bg-accent-emphasis px-5 text-sm font-medium text-white transition-opacity hover:opacity-90"
              >
                Submit a GitHub token
              </Link>
              <Link
                href="/how-it-works"
                className="flex h-11 items-center justify-center rounded-small border border-border-default bg-canvas-default px-5 text-sm font-medium text-fg-default transition-colors hover:bg-canvas-subtle"
              >
                See how it works
              </Link>
            </div>
          </div>
          <RedactedFindingPreview />
        </div>
      </section>

      {/* How scanning works */}
      <section className="border-t border-border-default bg-canvas-subtle">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <h2 className="text-2xl font-semibold text-fg-default">How scanning works</h2>
          <p className="mt-2 max-w-2xl text-fg-muted">
            Three steps from authorization to an auditable report.
          </p>
          <ol className="mt-8 grid gap-4 md:grid-cols-3">
            {STEPS.map((s) => (
              <li
                key={s.step}
                className="flex flex-col gap-3 rounded-medium border border-border-default bg-canvas-default p-5"
              >
                <span className="font-mono text-sm font-semibold text-accent-fg">{s.step}</span>
                <h3 className="text-base font-semibold text-fg-default">{s.title}</h3>
                <p className="text-sm text-fg-muted">{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Trust / security */}
      <section className="mx-auto max-w-6xl px-6 py-16">
        <h2 className="text-2xl font-semibold text-fg-default">Built for trust</h2>
        <p className="mt-2 max-w-2xl text-fg-muted">
          Security is the product. Every design decision keeps raw secrets out of
          storage, logs, and screens.
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {TRUST.map((t) => (
            <div
              key={t.title}
              className="flex flex-col gap-2 rounded-medium border border-border-default bg-canvas-default p-5"
            >
              <div className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className="flex size-6 items-center justify-center rounded-small bg-success-subtle text-xs font-bold text-success-fg"
                >
                  ✓
                </span>
                <h3 className="text-base font-semibold text-fg-default">{t.title}</h3>
              </div>
              <p className="text-sm text-fg-muted">{t.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="border-t border-border-default bg-canvas-subtle">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-5 px-6 py-16 text-center">
          <h2 className="text-2xl font-semibold text-fg-default sm:text-3xl">
            Start finding leaked secrets
          </h2>
          <p className="max-w-xl text-fg-muted">
            Submit a scoped GitHub token to begin. Review findings before anything
            is reported — you stay in control.
          </p>
          <Link
            href="/submit-token"
            className="flex h-11 items-center justify-center rounded-small bg-accent-emphasis px-6 text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            Submit a GitHub token
          </Link>
        </div>
      </section>
    </>
  );
}
