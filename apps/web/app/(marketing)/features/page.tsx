import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Features — SecretWatch",
  description:
    "Explore the advanced capabilities of SecretWatch: Dual-engine detection, custom rule creation, string redaction, and automated GitHub issue flagging.",
};

const SIGNATURES = [
  "AWS Access Keys",
  "GitHub PATs/OAuth Tokens",
  "Stripe API Keys",
  "Slack Webhooks",
  "RSA/DSA Private Keys",
  "Database Connection Strings",
  "GCP Service Accounts",
  "Twilio API Credentials",
];

export default function FeaturesPage() {
  return (
    <>
      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 pb-16 pt-16 sm:pt-24">
        <div className="flex flex-col gap-6 max-w-3xl">
          <h1 className="text-4xl font-semibold leading-tight tracking-tight text-fg-default sm:text-5xl">
            Enterprise-grade secret detection
          </h1>
          <p className="text-lg text-fg-muted">
            SecretWatch is built to operate reliably and safely across large public codebases.
            Discover powerful features designed for precision, customizable scanning, and strict data security.
          </p>
        </div>
      </section>

      {/* Feature 1: Dual-Engine Detection & Feature 2: Signatures */}
      <section className="border-t border-border-default bg-canvas-subtle">
        <div className="mx-auto max-w-6xl px-6 py-16 lg:py-24">
          <div className="grid gap-12 lg:grid-cols-2">
            <div className="flex flex-col gap-4">
              <h2 className="text-2xl font-semibold text-fg-default">
                Dual-Engine Detection
              </h2>
              <p className="text-fg-muted">
                Our scanning capability doesn&apos;t rely solely on basic string matching.
                SecretWatch utilizes a dual-engine architecture:
              </p>
              <ul className="flex flex-col gap-3 mt-2 text-sm text-fg-muted">
                <li className="flex gap-3 items-start">
                  <span className="flex size-5 items-center justify-center rounded-full bg-accent-subtle text-accent-fg font-bold text-xs shrink-0 mt-0.5">1</span>
                  <span><strong>Deterministic Regex Matching:</strong> Identifies secrets that possess distinct structures, standard prefixes, and fixed lengths.</span>
                </li>
                <li className="flex gap-3 items-start">
                  <span className="flex size-5 items-center justify-center rounded-full bg-accent-subtle text-accent-fg font-bold text-xs shrink-0 mt-0.5">2</span>
                  <span><strong>Information Entropy Algorithms:</strong> Analyzes random character blocks (like base64 or hex blobs) to detect unstructured secrets that slip past regular expressions.</span>
                </li>
              </ul>
            </div>

            <div className="flex flex-col gap-4 rounded-medium border border-border-default bg-canvas-default p-6 lg:p-8">
              <h3 className="text-lg font-semibold text-fg-default">
                Supported Secret Signatures
              </h3>
              <p className="text-sm text-fg-muted mb-2">
                SecretWatch instantly recognizes a growing list of critical credentials out of the box:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {SIGNATURES.map((sig) => (
                  <div key={sig} className="flex items-center gap-2 text-sm font-medium text-fg-default">
                    <span className="text-success-fg">✓</span>
                    {sig}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature 3: Custom Rule Engine */}
      <section className="border-t border-border-default">
        <div className="mx-auto max-w-6xl px-6 py-16 lg:py-24">
          <div className="grid gap-12 lg:grid-cols-2 items-center">
            <div className="order-2 lg:order-1 rounded-medium border border-border-default bg-canvas-subtle p-2">
              <div className="rounded border border-border-default bg-canvas-default overflow-hidden">
                <div className="border-b border-border-default bg-canvas-subtle px-4 py-2 flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <div className="size-2.5 rounded-full bg-danger-emphasis/50" />
                    <div className="size-2.5 rounded-full bg-attention-emphasis/50" />
                    <div className="size-2.5 rounded-full bg-success-emphasis/50" />
                  </div>
                  <span className="ml-2 font-mono text-xs text-fg-muted">custom-rules.yaml</span>
                </div>
                <div className="p-4 overflow-x-auto">
                  <pre className="font-mono text-sm leading-relaxed text-fg-default">
                    <span className="text-accent-fg">rules:</span>{"\n"}
                    {"  "}<span className="text-accent-fg">- id:</span> <span className="text-success-fg">&quot;internal_corp_token&quot;</span>{"\n"}
                    {"    "}<span className="text-accent-fg">description:</span> <span className="text-success-fg">&quot;Corporate internal API identifier&quot;</span>{"\n"}
                    {"    "}<span className="text-accent-fg">regex:</span> <span className="text-success-fg">&quot;corp_[a-zA-Z0-9]&#123;24&#125;&quot;</span>{"\n"}
                    {"    "}<span className="text-accent-fg">tags:</span>{"\n"}
                    {"      "}<span className="text-accent-fg">-</span> <span className="text-success-fg">&quot;internal&quot;</span>{"\n"}
                    {"      "}<span className="text-accent-fg">-</span> <span className="text-success-fg">&quot;high-risk&quot;</span>
                  </pre>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-4 order-1 lg:order-2">
              <h2 className="text-2xl font-semibold text-fg-default">
                Custom Rule Engine
              </h2>
              <p className="text-fg-muted">
                Every organization has internal tooling and proprietary token structures.
                SecretWatch doesn&apos;t lock you into a rigid set of signatures.
              </p>
              <p className="text-fg-muted">
                You can configure custom regex patterns targeting your own organization&apos;s internal key formats, enabling precise detection of specific proprietary credentials leaked onto public GitHub repositories.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Feature 4: Redacted Evidence Context */}
      <section className="border-t border-border-default bg-canvas-subtle">
        <div className="mx-auto max-w-6xl px-6 py-16 lg:py-24">
          <div className="grid gap-12 lg:grid-cols-2 items-center">
            <div className="flex flex-col gap-4">
              <h2 className="text-2xl font-semibold text-fg-default">
                Redacted Evidence Context
              </h2>
              <p className="text-fg-muted">
                We design for security zero-trust with the findings themselves.
                Storing a leaked token creates a secondary risk if the scanning platform is compromised.
              </p>
              <p className="text-fg-muted">
                When a secret is detected, it is immediately masked. We only store enough snippet context to help you locate the problem — the actual raw string is destroyed in memory and never written to our database.
              </p>
            </div>

            <div className="rounded-medium border border-border-default bg-canvas-default overflow-hidden p-2">
              <div className="rounded border border-border-default bg-canvas-subtle p-4 font-mono text-sm">
                <div className="text-fg-muted mb-2 text-xs">Findings Database Record</div>
                <div className="space-y-2 text-fg-default bg-canvas-default p-3 border border-border-default rounded">
                  <div><span className="text-fg-muted">secret_type:</span> <span className="text-accent-fg">&quot;aws_access_key_id&quot;</span></div>
                  <div><span className="text-fg-muted">file_path:</span> <span className="text-success-fg">&quot;config/deploy.yml&quot;</span></div>
                  <div>
                    <span className="text-fg-muted">snippet_context:</span>{" "}
                    <span className="inline-block mt-1 p-2 bg-neutral-muted rounded w-full">
                      <span className="opacity-50">aws_key: </span>
                      <span className="text-attention-fg font-bold bg-attention-subtle px-1 rounded">AKIA****************</span>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature 5: Automated Issue Flagging */}
      <section className="border-t border-border-default">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-6 py-16 lg:py-24 text-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-accent-subtle text-accent-fg">
            <svg
              className="size-7"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </div>
          <h2 className="text-2xl font-semibold text-fg-default sm:text-3xl max-w-2xl">
            Automated Issue Flagging
          </h2>
          <p className="max-w-2xl text-fg-muted">
            Integrate remediation directly into the workflows developers already use.
            When authorized, SecretWatch uses your GitHub credentials to automatically post actionable, redacted issues directly to the target repository alerting contributors of the leak securely.
          </p>
          <div className="mt-4">
            <Link
              href="/submit-token"
              className="flex h-11 items-center justify-center rounded-small bg-accent-emphasis px-6 text-sm font-medium text-white transition-opacity hover:opacity-90"
            >
              Get Started Now
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
