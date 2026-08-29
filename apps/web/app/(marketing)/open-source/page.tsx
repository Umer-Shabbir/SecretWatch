import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Open Source — SecretWatch",
  description:
    "SecretWatch is open source and community-driven. Learn how to contribute scan rules, deploy our self-hostable scanner, and audit our security pipeline.",
  openGraph: {
    title: "Open Source — SecretWatch",
    description:
      "Transparency, community-driven rules, and self-hostable secret detection infrastructure.",
    type: "website",
  },
};

const PRINCIPLES = [
  {
    title: "Transparency First",
    body: "Security tools demand verifiable trust. Our core scanning engine, redaction logic, and worker pipelines are open for public audit.",
  },
  {
    title: "Zero Secret Storage",
    body: "Our architecture is structurally designed to never persist raw secrets — only structural analysis and redacted snippets stay in storage.",
  },
  {
    title: "Extensible Rule Engine",
    body: "Threat models constantly evolve. Our engine empowers the community to write, test, and contribute new detection signatures.",
  },
];

const PACKAGES = [
  {
    name: "apps/web",
    description: "Next.js 14 App Router application providing the public site, token submission, and admin review dashboard.",
    type: "Next.js · TypeScript",
  },
  {
    name: "apps/worker",
    description: "Background processing workers for GitHub code search, regex/entropy detection, and automated issue creation.",
    type: "Node.js · BullMQ",
  },
  {
    name: "packages/shared",
    description: "Common type definitions, cryptographic utilities, redaction logic, and message template parsers.",
    type: "TypeScript Library",
  },
];

const CONTRIBUTION_STEPS = [
  {
    step: "01",
    title: "Define a Pattern",
    body: "Write a high-precision regex matching your target secret format. Provide sample valid and invalid matches.",
  },
  {
    step: "02",
    title: "Configure Entropy Thresholds",
    body: "Set Shannon entropy parameters to filter out common false positives and low-randomness placeholder strings.",
  },
  {
    step: "03",
    title: "Add Test Fixtures",
    body: "Include comprehensive redacted test fixtures ensuring high true-positive detection rates without regressions.",
  },
  {
    step: "04",
    title: "Submit a Pull Request",
    body: "Open a PR against the main repository. Community maintainers and automated CI tests verify rule performance.",
  },
];

export default function OpenSourcePage() {
  return (
    <>
      {/* Hero Section */}
      <section className="mx-auto max-w-6xl px-6 pb-16 pt-16 sm:pt-24">
        <div className="flex flex-col gap-6 max-w-3xl">
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-border-default bg-canvas-subtle px-3 py-1 text-xs font-medium text-fg-muted">
            <span aria-hidden="true" className="size-1.5 rounded-full bg-accent-emphasis" />
            100% Free & Open Source
          </span>
          <h1 className="text-4xl font-semibold leading-tight tracking-tight text-fg-default sm:text-5xl">
            Community-driven secret detection
          </h1>
          <p className="text-lg text-fg-muted">
            SecretWatch is an open-source security platform designed for complete transparency.
            Audit our codebase, contribute custom detection rules, or deploy the complete pipeline in your own environment.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row pt-2">
            <a
              href="https://github.com/secretwatch"
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-11 items-center justify-center rounded-small bg-accent-emphasis px-5 text-sm font-medium text-white transition-opacity hover:opacity-90"
            >
              View on GitHub
            </a>
            <Link
              href="/docs"
              className="flex h-11 items-center justify-center rounded-small border border-border-default bg-canvas-default px-5 text-sm font-medium text-fg-default transition-colors hover:bg-canvas-subtle"
            >
              Read the Documentation
            </Link>
          </div>
        </div>
      </section>

      {/* Core Principles */}
      <section className="border-t border-border-default bg-canvas-subtle">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <h2 className="text-2xl font-semibold text-fg-default">Open Source Principles</h2>
          <p className="mt-2 max-w-2xl text-fg-muted">
            We believe effective security tooling must be accessible, auditable, and extensible by the developer community it serves.
          </p>
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            {PRINCIPLES.map((p) => (
              <div
                key={p.title}
                className="flex flex-col gap-3 rounded-medium border border-border-default bg-canvas-default p-6"
              >
                <div className="flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="flex size-6 items-center justify-center rounded-small bg-accent-subtle text-xs font-bold text-accent-fg"
                  >
                    ✓
                  </span>
                  <h3 className="text-base font-semibold text-fg-default">{p.title}</h3>
                </div>
                <p className="text-sm text-fg-muted leading-relaxed">{p.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Monorepo Architecture */}
      <section className="mx-auto max-w-6xl px-6 py-16">
        <h2 className="text-2xl font-semibold text-fg-default">Repository Structure</h2>
        <p className="mt-2 max-w-2xl text-fg-muted">
          SecretWatch is organized as a modular TypeScript monorepo with strict package boundaries and deterministic builds.
        </p>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {PACKAGES.map((pkg) => (
            <div
              key={pkg.name}
              className="flex flex-col justify-between gap-4 rounded-medium border border-border-default bg-canvas-default p-5"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm font-semibold text-fg-default">{pkg.name}</span>
                </div>
                <p className="mt-2 text-sm text-fg-muted leading-relaxed">{pkg.description}</p>
              </div>
              <span className="inline-block w-fit rounded-small border border-border-muted bg-canvas-subtle px-2 py-0.5 font-mono text-xs text-fg-subtle">
                {pkg.type}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Self-Hosting Guide Preview */}
      <section className="border-t border-border-default bg-canvas-subtle">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
            <div className="flex flex-col gap-4">
              <h2 className="text-2xl font-semibold text-fg-default">Self-Host Anywhere</h2>
              <p className="text-fg-muted">
                Run SecretWatch on your private cloud infrastructure or local servers using Docker Compose. Maintain absolute control over discovered findings, access tokens, and administrative privileges.
              </p>
              <ul className="flex flex-col gap-2.5 text-sm text-fg-muted">
                <li className="flex items-center gap-2">
                  <span className="text-success-fg">✓</span>
                  PostgreSQL database with automated Prisma migrations
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-success-fg">✓</span>
                  Redis-backed job scheduling and rate-limiting queues
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-success-fg">✓</span>
                  Zero third-party SaaS tracking or external dependencies
                </li>
              </ul>
              <div className="pt-2">
                <Link
                  href="/docs"
                  className="inline-flex h-10 items-center justify-center rounded-small bg-accent-emphasis px-5 text-sm font-medium text-white transition-opacity hover:opacity-90"
                >
                  View Deployment Guide
                </Link>
              </div>
            </div>

            <div className="rounded-medium border border-border-default bg-canvas-default overflow-hidden">
              <div className="flex items-center justify-between border-b border-border-default bg-canvas-subtle px-4 py-2">
                <span className="font-mono text-xs text-fg-muted">docker-compose.yml</span>
                <span className="rounded-full border border-border-default bg-canvas-default px-2 py-0.5 text-xs font-medium text-fg-muted">
                  Quickstart
                </span>
              </div>
              <pre className="overflow-x-auto p-4 text-xs font-mono leading-relaxed text-fg-default">
                <span className="text-accent-fg">version:</span> <span className="text-success-fg">&apos;3.8&apos;</span>{"\n"}
                <span className="text-accent-fg">services:</span>{"\n"}
                {"  "}<span className="text-accent-fg">web:</span>{"\n"}
                {"    "}<span className="text-accent-fg">image:</span> secretwatch/web:latest{"\n"}
                {"    "}<span className="text-accent-fg">ports:</span> [ <span className="text-attention-fg">&quot;3000:3000&quot;</span> ]{"\n"}
                {"    "}<span className="text-accent-fg">environment:</span>{"\n"}
                {"      "}- DATABASE_URL=postgresql://postgres:pass@db:5432/secretwatch{"\n"}
                {"      "}- REDIS_URL=redis://redis:6379{"\n"}
                {"      "}- ENCRYPTION_KEY=your-32-byte-hex-key{"\n"}
                {"  "}<span className="text-accent-fg">worker:</span>{"\n"}
                {"    "}<span className="text-accent-fg">image:</span> secretwatch/worker:latest{"\n"}
                {"    "}<span className="text-accent-fg">depends_on:</span> [ db, redis ]
              </pre>
            </div>
          </div>
        </div>
      </section>

      {/* How to Contribute Rules */}
      <section className="mx-auto max-w-6xl px-6 py-16">
        <h2 className="text-2xl font-semibold text-fg-default">Contributing Detection Signatures</h2>
        <p className="mt-2 max-w-2xl text-fg-muted">
          Add support for new cloud providers, API tokens, and secret patterns by submitting signature definitions.
        </p>
        <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {CONTRIBUTION_STEPS.map((s) => (
            <li
              key={s.step}
              className="flex flex-col gap-2 rounded-medium border border-border-default bg-canvas-default p-5"
            >
              <span className="font-mono text-sm font-semibold text-accent-fg">{s.step}</span>
              <h3 className="text-base font-semibold text-fg-default">{s.title}</h3>
              <p className="text-sm text-fg-muted leading-relaxed">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* CTA */}
      <section className="border-t border-border-default bg-canvas-subtle">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-5 px-6 py-16 text-center">
          <h2 className="text-2xl font-semibold text-fg-default sm:text-3xl">
            Join the community
          </h2>
          <p className="max-w-xl text-fg-muted">
            SecretWatch is licensed under the MIT License. Contribute code, report issues, or suggest new detection strategies.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <a
              href="https://github.com/secretwatch"
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-11 items-center justify-center rounded-small bg-accent-emphasis px-6 text-sm font-medium text-white transition-opacity hover:opacity-90"
            >
              Star on GitHub
            </a>
            <Link
              href="/submit-token"
              className="flex h-11 items-center justify-center rounded-small border border-border-default bg-canvas-default px-6 text-sm font-medium text-fg-default transition-colors hover:bg-canvas-subtle"
            >
              Submit a Scan Token
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
