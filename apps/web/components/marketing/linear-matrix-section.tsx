import Link from "next/link";

const SIGNATURES = [
  {
    name: "AWS Access Key ID",
    provider: "AWS",
    pattern: "AKIA[0-9A-Z]{16}",
    entropy: "3.8 bits",
    redacted: "AKIA••••••••••9F3",
  },
  {
    name: "Stripe Live Secret Key",
    provider: "Stripe",
    pattern: "sk_live_[0-9a-zA-Z]{24}",
    entropy: "4.2 bits",
    redacted: "sk_live_••••••••••4e2a",
  },
  {
    name: "GitHub Personal Access Token",
    provider: "GitHub",
    pattern: "ghp_[0-9a-zA-Z]{36}",
    entropy: "4.0 bits",
    redacted: "ghp_••••••••••••••••3a81",
  },
  {
    name: "Slack Bot Token",
    provider: "Slack",
    pattern: "xoxb-[0-9]{11}-[0-9]{11}",
    entropy: "3.6 bits",
    redacted: "xoxb-••••••••••••••8910",
  },
  {
    name: "Google Cloud API Key",
    provider: "Google",
    pattern: "AIza[0-9A-Za-z\\-_]{35}",
    entropy: "4.1 bits",
    redacted: "AIza••••••••••••••d921",
  },
  {
    name: "OpenAI Project Key",
    provider: "OpenAI",
    pattern: "sk-[0-9a-zA-Z]{48}",
    entropy: "4.5 bits",
    redacted: "sk-••••••••••••••••8c12",
  },
];

export function LinearMatrixSection() {
  return (
    <section className="border-t border-white/[0.06] bg-[#07080c] py-20 text-zinc-100">
      <div className="mx-auto max-w-6xl px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <span className="font-mono text-xs uppercase tracking-widest text-zinc-500">
              Coverage Matrix
            </span>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              Precision detection signatures.
            </h2>
            <p className="mt-2 text-sm text-zinc-400">
              Built-in rules target high-value service provider keys with strict entropy gates.
            </p>
          </div>
          <Link
            href="/features"
            className="group flex items-center gap-1.5 text-xs font-mono text-zinc-400 hover:text-white"
          >
            <span>Custom YAML rules</span>
            <span
              aria-hidden="true"
              className="transition-transform duration-200 group-hover:translate-x-1"
            >
              →
            </span>
          </Link>
        </div>

        {/* Dense Table */}
        <div className="mt-8 overflow-hidden rounded-xl border border-white/[0.08] bg-zinc-950/70 shadow-xl backdrop-blur">
          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead>
                <tr className="border-b border-white/[0.08] bg-white/[0.02] text-zinc-500">
                  <th className="py-3 px-4 font-medium uppercase text-[11px]">Provider</th>
                  <th className="py-3 px-4 font-medium uppercase text-[11px]">Credential Type</th>
                  <th className="py-3 px-4 font-medium uppercase text-[11px]">AST Pattern</th>
                  <th className="py-3 px-4 font-medium uppercase text-[11px]">Min Entropy</th>
                  <th className="py-3 px-4 font-medium uppercase text-[11px] text-right">Persisted Format</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {SIGNATURES.map((sig) => (
                  <tr
                    key={sig.name}
                    className="transition-colors hover:bg-white/[0.02]"
                  >
                    <td className="py-3.5 px-4 font-medium text-zinc-300">{sig.provider}</td>
                    <td className="py-3.5 px-4 text-white font-semibold">{sig.name}</td>
                    <td className="py-3.5 px-4 text-zinc-400">
                      <code>{sig.pattern}</code>
                    </td>
                    <td className="py-3.5 px-4 text-amber-400">{sig.entropy}</td>
                    <td className="py-3.5 px-4 text-right font-medium text-emerald-400">
                      {sig.redacted}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Bottom Banner */}
        <div className="mt-16 rounded-2xl border border-white/[0.08] bg-gradient-to-b from-white/[0.04] to-transparent p-8 sm:p-12 text-center">
          <h3 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            Start auditing public repositories now.
          </h3>
          <p className="mx-auto mt-3 max-w-xl text-sm text-zinc-400 sm:text-base">
            Submit a scoped GitHub personal access token to authorize scanning workers.
            Findings remain strictly quarantined until an admin approves disclosure.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/submit-token"
              className="inline-flex h-10 items-center justify-center rounded-lg bg-white px-5 text-sm font-medium text-zinc-950 transition-all hover:bg-zinc-200"
            >
              Submit Scoped Token
            </Link>
            <Link
              href="/open-source"
              className="inline-flex h-10 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.02] px-5 text-sm font-medium text-zinc-300 transition-all hover:border-white/[0.18] hover:text-white"
            >
              Self-Host on GitHub
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
