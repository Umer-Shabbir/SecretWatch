"use client";

import { useState } from "react";
import Link from "next/link";

export function LinearBentoGrid() {
  const [activeEngineTab, setActiveEngineTab] = useState<"ast" | "shannon">("ast");
  const [reviewAction, setReviewAction] = useState<"pending" | "approved" | "ignored">("pending");

  return (
    <section className="relative bg-[#090a0f] py-24 text-zinc-100">
      <div className="mx-auto max-w-6xl px-6">
        {/* Section Header */}
        <div className="flex flex-col items-start gap-3">
          <span className="font-mono text-xs uppercase tracking-widest text-zinc-500">
            Platform Capabilities
          </span>
          <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Engineered for high-volume, zero-leak discovery.
          </h2>
          <p className="max-w-2xl text-sm text-zinc-400 sm:text-base">
            Every layer of SecretWatch is designed around security hygiene: preventing false alarms,
            respecting maintainers, and ensuring raw secrets never enter storage.
          </p>
        </div>

        {/* Bento Grid */}
        <div className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-12 md:gap-6">
          {/* Bento Card 1: Dual-Engine Classification (Col span 7) */}
          <div className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-white/[0.08] bg-zinc-950/60 p-6 md:col-span-7 transition-all duration-300 hover:border-white/[0.16] hover:bg-zinc-900/40">
            <div>
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-medium uppercase tracking-wider text-zinc-400">
                  Dual-Engine Classifier
                </span>
                <div className="flex rounded-lg border border-white/[0.08] bg-white/[0.02] p-0.5 text-xs font-mono">
                  <button
                    type="button"
                    onClick={() => setActiveEngineTab("ast")}
                    className={`rounded px-2.5 py-1 transition-colors ${
                      activeEngineTab === "ast"
                        ? "bg-white/[0.1] text-white"
                        : "text-zinc-500 hover:text-zinc-300"
                    }`}
                  >
                    AST Regex
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveEngineTab("shannon")}
                    className={`rounded px-2.5 py-1 transition-colors ${
                      activeEngineTab === "shannon"
                        ? "bg-white/[0.1] text-white"
                        : "text-zinc-500 hover:text-zinc-300"
                    }`}
                  >
                    Shannon Entropy
                  </button>
                </div>
              </div>

              <h3 className="mt-4 text-xl font-semibold text-white">
                Eliminates false positives with mathematical entropy.
              </h3>
              <p className="mt-2 text-sm text-zinc-400 leading-relaxed">
                Standard scanners drown developers in dummy variables and mock keys. SecretWatch evaluates
                both pattern signatures and byte-distribution randomness before triggering a review candidate.
              </p>
            </div>

            {/* Interactive Engine Code Panel */}
            <div className="mt-6 rounded-xl border border-white/[0.06] bg-[#050608] p-4 font-mono text-xs text-zinc-300 shadow-inner">
              {activeEngineTab === "ast" ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-zinc-500 text-[11px]">
                    <span>rule_engine: v2.4 (AST Tokenizer)</span>
                    <span className="text-emerald-400">MATCH VALIDATED</span>
                  </div>
                  <pre className="overflow-x-auto text-zinc-300">
                    <code>
                      {"{\n"}
                      {'  "rule": "AWS_ACCESS_KEY_ID",\n'}
                      {'  "pattern": "AKIA[0-9A-Z]{16}",\n'}
                      {'  "entropyThreshold": 3.8\n'}
                      {"}"}
                    </code>
                  </pre>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-zinc-500 text-[11px]">
                    <span>entropy: Shannon Distribution</span>
                    <span className="font-bold text-amber-400">4.82 bits / char</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
                    <div className="h-full bg-gradient-to-r from-emerald-500 to-amber-400" style={{ width: "75%" }} />
                  </div>
                  <div className="flex justify-between text-[10px] text-zinc-500">
                    <span>Threshold: &gt; 3.5 bits (Cryptographic Key)</span>
                    <span className="text-emerald-400">Passes Filter</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Bento Card 2: In-Memory Redaction Vault (Col span 5) */}
          <div className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-white/[0.08] bg-zinc-950/60 p-6 md:col-span-5 transition-all duration-300 hover:border-white/[0.16] hover:bg-zinc-900/40">
            <div>
              <span className="font-mono text-xs font-medium uppercase tracking-wider text-zinc-400">
                Zero-Storage Architecture
              </span>
              <h3 className="mt-4 text-xl font-semibold text-white">
                Transient RAM decryption only.
              </h3>
              <p className="mt-2 text-sm text-zinc-400 leading-relaxed">
                Tokens submitted for search authorization are encrypted via AES-256-GCM. Discoveries
                persist only as masked snippets. A total database dump yields zero credentials.
              </p>
            </div>

            <div className="mt-6 flex flex-col gap-2 rounded-xl border border-white/[0.06] bg-[#050608] p-4 font-mono text-xs">
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider">
                Database Record Preview:
              </span>
              <div className="rounded bg-zinc-900/60 px-3 py-2 text-emerald-400 border border-emerald-500/20">
                evidence: &quot;AKIA••••••••••9F3&quot;
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-zinc-500">
                <svg className="size-3 text-emerald-400" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                </svg>
                <span>Raw secret value: Never persisted</span>
              </div>
            </div>
          </div>

          {/* Bento Card 3: Human-in-the-Loop Triage Gate (Col span 5) */}
          <div className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-white/[0.08] bg-zinc-950/60 p-6 md:col-span-5 transition-all duration-300 hover:border-white/[0.16] hover:bg-zinc-900/40">
            <div>
              <span className="font-mono text-xs font-medium uppercase tracking-wider text-zinc-400">
                Admin Review Queue
              </span>
              <h3 className="mt-4 text-xl font-semibold text-white">
                Human gate before filing.
              </h3>
              <p className="mt-2 text-sm text-zinc-400 leading-relaxed">
                Automated bots filing spam issues alienate repository maintainers. SecretWatch buffers
                findings in a review queue where admins verify context with a single keystroke.
              </p>
            </div>

            <div className="mt-6 rounded-xl border border-white/[0.06] bg-[#050608] p-4 text-xs">
              <div className="flex items-center justify-between border-b border-white/[0.04] pb-2 font-mono">
                <span className="text-zinc-300 truncate">org/payments-api#89</span>
                <span
                  className={`rounded px-2 py-0.5 text-[10px] font-semibold ${
                    reviewAction === "approved"
                      ? "bg-emerald-500/20 text-emerald-300"
                      : reviewAction === "ignored"
                      ? "bg-zinc-700/40 text-zinc-400"
                      : "bg-amber-500/20 text-amber-300"
                  }`}
                >
                  {reviewAction.toUpperCase()}
                </span>
              </div>

              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => setReviewAction("ignored")}
                  className="flex-1 rounded-lg border border-white/[0.08] bg-white/[0.02] py-1.5 font-medium text-zinc-300 hover:bg-white/[0.06]"
                >
                  Ignore
                </button>
                <button
                  type="button"
                  onClick={() => setReviewAction("approved")}
                  className="flex-1 rounded-lg bg-white py-1.5 font-medium text-zinc-950 hover:bg-zinc-200"
                >
                  Approve &amp; Flag
                </button>
              </div>
            </div>
          </div>

          {/* Bento Card 4: Responsible Disclosure Automation (Col span 7) */}
          <div className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-white/[0.08] bg-zinc-950/60 p-6 md:col-span-7 transition-all duration-300 hover:border-white/[0.16] hover:bg-zinc-900/40">
            <div>
              <span className="font-mono text-xs font-medium uppercase tracking-wider text-zinc-400">
                Remediation Workflow
              </span>
              <h3 className="mt-4 text-xl font-semibold text-white">
                Authorized, templated GitHub issue creation.
              </h3>
              <p className="mt-2 text-sm text-zinc-400 leading-relaxed">
                Once approved, findings dispatch actionable markdown notifications through your authorized
                GitHub identity. Provide maintainers with the file, commit SHA, and remediation steps
                without handing attackers an active credential.
              </p>
            </div>

            <div className="mt-6 rounded-xl border border-white/[0.06] bg-[#050608] p-4 text-xs font-mono">
              <div className="flex items-center justify-between text-zinc-500 text-[11px] pb-2 border-b border-white/[0.04]">
                <span>GitHub Issue Dispatcher</span>
                <span className="text-zinc-400">Template: AWS_LEAK_NOTICE_V1</span>
              </div>
              <div className="mt-2 text-zinc-300 leading-relaxed text-[11px]">
                <p className="text-zinc-100 font-semibold">
                  Title: Potential exposed AWS credential in src/config/aws.ts
                </p>
                <p className="text-zinc-400 mt-1">
                  SecretWatch detected a token matching AWS IAM Key (`AKIA••••••••••9F3`) in commit `c94b21f`.
                  Please revoke this credential via the AWS IAM Console immediately.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Link */}
        <div className="mt-12 flex items-center justify-center">
          <Link
            href="/features"
            className="group flex items-center gap-2 text-sm font-medium text-zinc-400 hover:text-white"
          >
            <span>Explore all scanning features and signature matrices</span>
            <span
              aria-hidden="true"
              className="transition-transform group-hover:translate-x-1"
            >
              →
            </span>
          </Link>
        </div>
      </div>
    </section>
  );
}
