import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "How SecretWatch works — OAuth, scanning, redacted findings, review",
  description:
    "A detailed walkthrough of the SecretWatch pipeline: authorize with a scoped GitHub token, scan public code against rules, record redacted findings, and review before any issue is filed.",
  openGraph: {
    title: "How SecretWatch works",
    description:
      "From authorization to auditable reporting — the SecretWatch secret-discovery pipeline, step by step.",
    type: "website",
  },
};

const FLOW = [
  {
    step: "01",
    title: "Authorize with a scoped token",
    body: "You submit a GitHub token. It is encrypted at rest and decrypted only in memory when a scan runs. A higher search rate limit and your identity for reporting come from that authorization.",
    label: "encrypted · in-memory only",
    code: "POST /submit-token\ntoken → AES-GCM encrypt → db\ndecrypt only in worker memory",
  },
  {
    step: "02",
    title: "Scan public code",
    body: "Scanner workers query GitHub code search and evaluate matches against regex and entropy rules. Only public repositories are ever scanned.",
    label: "regex + entropy rules",
    code: "rule: aws-access-key-id\npattern: AKIA[0-9A-Z]{16}\nentropy: >= 3.5",
  },
  {
    step: "03",
    title: "Record redacted findings",
    body: "A match becomes a finding with repository, file, and line context plus a masked snippet. The raw secret is never written to storage or logs.",
    label: "raw secret never stored",
    code: 'file: src/config/aws.js:42\nevidence: "AKIA••••••••••9F3"\nraw_secret: <never persisted>',
  },
  {
    step: "04",
    title: "Admin review before reporting",
    body: "Findings wait in a review queue. An admin approves or ignores each one. Only approved findings can open a GitHub issue — every action is audited.",
    label: "auditable review gate",
    code: "status: PENDING → APPROVED\naction: open issue (your identity)\naudit: who / when / what",
  },
];

const INTEGRATION = [
  {
    title: "Your identity, your control",
    body: "Issues are posted through the GitHub credentials you authorized — SecretWatch never acts anonymously or beyond configured limits.",
  },
  {
    title: "Rate-limit aware",
    body: "Workers respect GitHub rate limits with backoff and retry, and surface rate-limit status in worker monitoring.",
  },
  {
    title: "Templated reports",
    body: "Issues use configurable message templates, so every report is consistent, clear, and actionable for the repo owner.",
  },
];

export default function HowItWorksPage() {
  return (
    <>
      {/* Page header */}
      <section className="border-b border-border-default bg-canvas-subtle">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-fg-default sm:text-5xl">
            How SecretWatch works
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-fg-muted">
            From authorization to an auditable report — the full secret-discovery
            pipeline, and exactly where raw secrets are kept out of it.
          </p>
        </div>
      </section>

      {/* Detailed flow: prose + paired monospace technical-value card */}
      <section className="mx-auto max-w-6xl px-6 py-16">
        <ol className="flex flex-col gap-8">
          {FLOW.map((f) => (
            <li key={f.step} className="grid gap-6 lg:grid-cols-2 lg:items-center">
              <div className="flex flex-col gap-3">
                <span className="font-mono text-sm font-semibold text-accent-fg">
                  Step {f.step}
                </span>
                <h2 className="text-2xl font-semibold text-fg-default">{f.title}</h2>
                <p className="text-fg-muted">{f.body}</p>
              </div>
              <figure className="overflow-hidden rounded-medium border border-border-default bg-canvas-default">
                <figcaption className="flex items-center justify-between border-b border-border-default bg-canvas-subtle px-4 py-2">
                  <span className="font-mono text-xs text-fg-muted">{f.title}</span>
                  <span className="rounded-full border border-border-default bg-canvas-default px-2 py-0.5 text-xs font-medium text-fg-muted">
                    {f.label}
                  </span>
                </figcaption>
                <pre className="overflow-x-auto px-4 py-3">
                  <code className="font-mono text-sm leading-relaxed text-fg-default">
                    {f.code}
                  </code>
                </pre>
              </figure>
            </li>
          ))}
        </ol>
      </section>

      {/* GitHub integration */}
      <section className="border-t border-border-default bg-canvas-subtle">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <h2 className="text-2xl font-semibold text-fg-default">GitHub integration</h2>
          <p className="mt-2 max-w-2xl text-fg-muted">
            SecretWatch works with GitHub, not around it — using your authorized
            access, within its limits.
          </p>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {INTEGRATION.map((i) => (
              <div
                key={i.title}
                className="flex flex-col gap-2 rounded-medium border border-border-default bg-canvas-default p-5"
              >
                <h3 className="text-base font-semibold text-fg-default">{i.title}</h3>
                <p className="text-sm text-fg-muted">{i.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="mx-auto flex max-w-6xl flex-col items-center gap-5 px-6 py-16 text-center">
        <h2 className="text-2xl font-semibold text-fg-default sm:text-3xl">
          Ready to scan?
        </h2>
        <p className="max-w-xl text-fg-muted">
          Submit a scoped GitHub token and review findings before anything is
          reported.
        </p>
        <Link
          href="/submit-token"
          className="flex h-11 items-center justify-center rounded-small bg-accent-emphasis px-6 text-sm font-medium text-white transition-opacity hover:opacity-90"
        >
          Submit a GitHub token
        </Link>
      </section>
    </>
  );
}
