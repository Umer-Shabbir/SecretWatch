import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Documentation — SecretWatch",
  description:
    "Comprehensive technical documentation for SecretWatch: architecture, secret detection engine, token encryption, admin review queue, and self-hosting guides.",
  openGraph: {
    title: "Documentation — SecretWatch",
    description:
      "Technical guides, API reference, detection rules, and deployment instructions for SecretWatch.",
    type: "website",
  },
};

const DOC_SECTIONS = [
  {
    id: "overview",
    title: "Overview",
    summary: "High-level system architecture, workflow lifecycle, and zero-secret persistence model.",
  },
  {
    id: "token-security",
    title: "Token Security & Encryption",
    summary: "How submitted GitHub tokens are encrypted with AES-256-GCM and handled in memory.",
  },
  {
    id: "scanning-engine",
    title: "Detection & Rule Engine",
    summary: "Dual-engine detection combining deterministic regex patterns and Shannon entropy scoring.",
  },
  {
    id: "review-workflow",
    title: "Review & Remediation",
    summary: "Admin review queue, auditable approvals, template interpolation, and GitHub issue creation.",
  },
  {
    id: "self-hosting",
    title: "Self-Hosting & Deployment",
    summary: "Deploying SecretWatch with Docker Compose, environment variables, and worker scaling.",
  },
  {
    id: "api-reference",
    title: "API Reference",
    summary: "Public submission endpoints, health checks, rate limits, and administrative APIs.",
  },
];

export default function DocsPage() {
  return (
    <>
      {/* Header */}
      <section className="border-b border-border-default bg-canvas-subtle">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <div className="flex flex-col gap-4 max-w-3xl">
            <span className="inline-flex w-fit items-center gap-2 rounded-full border border-border-default bg-canvas-default px-3 py-1 text-xs font-medium text-fg-muted">
              <span aria-hidden="true" className="size-1.5 rounded-full bg-success-emphasis" />
              v1.0 Documentation
            </span>
            <h1 className="text-4xl font-semibold tracking-tight text-fg-default sm:text-5xl">
              SecretWatch Documentation
            </h1>
            <p className="text-lg text-fg-muted">
              Learn how SecretWatch scans public GitHub code, encrypts credentials, redacts sensitive findings, and automates responsible disclosure.
            </p>
          </div>
        </div>
      </section>

      {/* Docs Grid */}
      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid gap-12 lg:grid-cols-4">
          {/* Table of contents sidebar */}
          <aside className="lg:col-span-1">
            <div className="sticky top-24 flex flex-col gap-2 rounded-medium border border-border-default bg-canvas-subtle p-4">
              <span className="text-xs font-semibold uppercase tracking-wider text-fg-muted">
                On This Page
              </span>
              <nav aria-label="Documentation sections" className="flex flex-col gap-1 text-sm">
                {DOC_SECTIONS.map((sec) => (
                  <a
                    key={sec.id}
                    href={`#${sec.id}`}
                    className="rounded px-2 py-1.5 text-fg-muted transition-colors hover:bg-canvas-default hover:text-fg-default"
                  >
                    {sec.title}
                  </a>
                ))}
              </nav>
            </div>
          </aside>

          {/* Main content body */}
          <article className="flex flex-col gap-16 lg:col-span-3">
            {/* Section 1: Overview */}
            <section id="overview" className="scroll-mt-24 flex flex-col gap-4">
              <div className="border-b border-border-default pb-3">
                <span className="font-mono text-xs font-semibold text-accent-fg">01 / ARCHITECTURE</span>
                <h2 className="text-2xl font-semibold text-fg-default">System Overview</h2>
              </div>
              <p className="text-fg-muted leading-relaxed">
                SecretWatch operates as an asynchronous, distributed pipeline built on Next.js 14, Node.js background workers, Redis-backed BullMQ queues, and PostgreSQL.
              </p>
              <div className="grid gap-4 sm:grid-cols-3 my-2">
                <div className="rounded-medium border border-border-default bg-canvas-subtle p-4">
                  <div className="font-semibold text-sm text-fg-default">Web Application</div>
                  <div className="text-xs text-fg-muted mt-1">Next.js App Router for public marketing, token intake, and the admin panel.</div>
                </div>
                <div className="rounded-medium border border-border-default bg-canvas-subtle p-4">
                  <div className="font-semibold text-sm text-fg-default">Worker Services</div>
                  <div className="text-xs text-fg-muted mt-1">Autonomous scanner, flagger, and scheduler processes consuming BullMQ queues.</div>
                </div>
                <div className="rounded-medium border border-border-default bg-canvas-subtle p-4">
                  <div className="font-semibold text-sm text-fg-default">Storage Layer</div>
                  <div className="text-xs text-fg-muted mt-1">PostgreSQL for relational entities and Upstash Redis for distributed locks and rate limits.</div>
                </div>
              </div>
            </section>

            {/* Section 2: Token Security */}
            <section id="token-security" className="scroll-mt-24 flex flex-col gap-4">
              <div className="border-b border-border-default pb-3">
                <span className="font-mono text-xs font-semibold text-accent-fg">02 / CRYPTOGRAPHY</span>
                <h2 className="text-2xl font-semibold text-fg-default">Token Security & Encryption</h2>
              </div>
              <p className="text-fg-muted leading-relaxed">
                Tokens submitted through the public portal are immediately encrypted at rest using industry-standard authenticated encryption:
              </p>
              <ul className="flex flex-col gap-2 text-sm text-fg-muted">
                <li className="flex items-start gap-2">
                  <span className="text-accent-fg font-bold">·</span>
                  <span><strong>Algorithm:</strong> AES-256-GCM (Galois/Counter Mode) with 128-bit authentication tags and unique initialization vectors (IV) per entry.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-accent-fg font-bold">·</span>
                  <span><strong>In-Memory Lifecycle:</strong> Plaintext tokens are decrypted strictly in ephemeral worker memory only during active API calls, never logged or persisted.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-accent-fg font-bold">·</span>
                  <span><strong>Display Masking:</strong> Admin interfaces and logs display only non-reversible masked identifiers (e.g., <code className="font-mono text-xs bg-canvas-subtle px-1 py-0.5 rounded">ghp_••••••••••••••••••••••••3f8a</code>).</span>
                </li>
              </ul>
            </section>

            {/* Section 3: Detection Engine */}
            <section id="scanning-engine" className="scroll-mt-24 flex flex-col gap-4">
              <div className="border-b border-border-default pb-3">
                <span className="font-mono text-xs font-semibold text-accent-fg">03 / DETECTION</span>
                <h2 className="text-2xl font-semibold text-fg-default">Detection & Rule Engine</h2>
              </div>
              <p className="text-fg-muted leading-relaxed">
                SecretWatch pairs deterministic regular expressions with algorithmic entropy analysis to minimize both false positives and false negatives:
              </p>
              <div className="rounded-medium border border-border-default bg-canvas-subtle p-4 font-mono text-xs overflow-x-auto">
                <div className="text-fg-muted mb-2">{/* Sample Rule Specification */}</div>
                <div className="text-fg-default">
                  <span className="text-accent-fg">id:</span> <span className="text-success-fg">&quot;aws-access-key-id&quot;</span>{"\n"}
                  <span className="text-accent-fg">pattern:</span> <span className="text-success-fg">&quot;(?&lt;!_)[A-Z0-9]{20}(?=[^A-Z0-9]|$)&quot;</span>{"\n"}
                  <span className="text-accent-fg">prefix:</span> <span className="text-success-fg">&quot;AKIA&quot;</span>{"\n"}
                  <span className="text-accent-fg">entropyMin:</span> <span className="text-attention-fg">3.0</span>{"\n"}
                  <span className="text-accent-fg">severity:</span> <span className="text-danger-fg">&quot;CRITICAL&quot;</span>
                </div>
              </div>
              <p className="text-sm text-fg-muted">
                Matches are automatically clipped into non-sensitive redacted context snippets showing only starting prefixes and trailing characters for developer verification.
              </p>
            </section>

            {/* Section 4: Review Workflow */}
            <section id="review-workflow" className="scroll-mt-24 flex flex-col gap-4">
              <div className="border-b border-border-default pb-3">
                <span className="font-mono text-xs font-semibold text-accent-fg">04 / REMEDIATION</span>
                <h2 className="text-2xl font-semibold text-fg-default">Review & Remediation Workflow</h2>
              </div>
              <p className="text-fg-muted leading-relaxed">
                By default, findings require human approval in the Admin Review Queue before external actions are dispatched:
              </p>
              <div className="flex flex-col gap-3 text-sm">
                <div className="flex items-start gap-3 rounded-medium border border-border-default bg-canvas-default p-4">
                  <span className="font-mono font-bold text-accent-fg">1.</span>
                  <div>
                    <span className="font-semibold text-fg-default">Triage:</span>{" "}
                    <span className="text-fg-muted">Admins inspect findings, review match context, and evaluate repository impact.</span>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-medium border border-border-default bg-canvas-default p-4">
                  <span className="font-mono font-bold text-accent-fg">2.</span>
                  <div>
                    <span className="font-semibold text-fg-default">Approval & Template Rendering:</span>{" "}
                    <span className="text-fg-muted">Approved findings interpolate context variables (<code className="font-mono text-xs">&#123;repository&#125;</code>, <code className="font-mono text-xs">&#123;file_path&#125;</code>, <code className="font-mono text-xs">&#123;secret_type&#125;</code>) into Markdown templates.</span>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-medium border border-border-default bg-canvas-default p-4">
                  <span className="font-mono font-bold text-accent-fg">3.</span>
                  <div>
                    <span className="font-semibold text-fg-default">Issue Dispatch:</span>{" "}
                    <span className="text-fg-muted">Flagger worker creates a security notification issue in the target repository using authorized tokens.</span>
                  </div>
                </div>
              </div>
            </section>

            {/* Section 5: Self Hosting */}
            <section id="self-hosting" className="scroll-mt-24 flex flex-col gap-4">
              <div className="border-b border-border-default pb-3">
                <span className="font-mono text-xs font-semibold text-accent-fg">05 / DEPLOYMENT</span>
                <h2 className="text-2xl font-semibold text-fg-default">Self-Hosting & Configuration</h2>
              </div>
              <p className="text-fg-muted leading-relaxed">
                Deploy SecretWatch using environment configuration. Key variables include:
              </p>
              <div className="overflow-x-auto rounded-medium border border-border-default">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-border-default bg-canvas-subtle font-semibold text-fg-default">
                    <tr>
                      <th className="px-4 py-3">Variable</th>
                      <th className="px-4 py-3">Description</th>
                      <th className="px-4 py-3">Example</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-default font-mono text-fg-muted">
                    <tr>
                      <td className="px-4 py-3 font-semibold text-fg-default">DATABASE_URL</td>
                      <td className="px-4 py-3 font-sans">PostgreSQL connection string</td>
                      <td className="px-4 py-3">postgresql://user:pass@host:5432/db</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 font-semibold text-fg-default">REDIS_URL</td>
                      <td className="px-4 py-3 font-sans">Redis connection URL for BullMQ queues</td>
                      <td className="px-4 py-3">redis://127.0.0.1:6379</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 font-semibold text-fg-default">ENCRYPTION_KEY</td>
                      <td className="px-4 py-3 font-sans">32-byte hexadecimal encryption key for AES-GCM</td>
                      <td className="px-4 py-3">0123456789abcdef...</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 font-semibold text-fg-default">NEXTAUTH_SECRET</td>
                      <td className="px-4 py-3 font-sans">Secret used to sign admin session cookies</td>
                      <td className="px-4 py-3">openssl rand -hex 32</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            {/* Section 6: API Reference */}
            <section id="api-reference" className="scroll-mt-24 flex flex-col gap-4">
              <div className="border-b border-border-default pb-3">
                <span className="font-mono text-xs font-semibold text-accent-fg">06 / REST API</span>
                <h2 className="text-2xl font-semibold text-fg-default">API Reference</h2>
              </div>
              <div className="flex flex-col gap-4">
                <div className="rounded-medium border border-border-default bg-canvas-default p-4">
                  <div className="flex items-center gap-2 font-mono text-xs">
                    <span className="rounded bg-success-subtle px-2 py-0.5 font-bold text-success-fg">POST</span>
                    <span className="font-semibold text-fg-default">/api/public/tokens</span>
                  </div>
                  <p className="mt-2 text-xs text-fg-muted">
                    Accepts a raw GitHub token from the public form, validates scopes against GitHub API, encrypts with AES-256-GCM, and persists to the active token pool.
                  </p>
                </div>
                <div className="rounded-medium border border-border-default bg-canvas-default p-4">
                  <div className="flex items-center gap-2 font-mono text-xs">
                    <span className="rounded bg-accent-subtle px-2 py-0.5 font-bold text-accent-fg">GET</span>
                    <span className="font-semibold text-fg-default">/api/system/settings</span>
                  </div>
                  <p className="mt-2 text-xs text-fg-muted">
                    Retrieves operational flags such as auto-approve thresholds, scanner activity, and issue flagger mode.
                  </p>
                </div>
              </div>
            </section>
          </article>
        </div>
      </section>

      {/* Footer CTA */}
      <section className="border-t border-border-default bg-canvas-subtle">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-6 py-12 text-center">
          <h3 className="text-xl font-semibold text-fg-default">Need help or want to contribute?</h3>
          <p className="max-w-md text-sm text-fg-muted">
            Check out our GitHub repository, submit an issue, or read through our developer guides.
          </p>
          <div className="flex gap-3 mt-2">
            <Link
              href="/open-source"
              className="flex h-10 items-center justify-center rounded-small bg-accent-emphasis px-4 text-sm font-medium text-white transition-opacity hover:opacity-90"
            >
              Open Source Guide
            </Link>
            <a
              href="https://github.com/secretwatch"
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-10 items-center justify-center rounded-small border border-border-default bg-canvas-default px-4 text-sm font-medium text-fg-default transition-colors hover:bg-canvas-subtle"
            >
              GitHub Repository
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
