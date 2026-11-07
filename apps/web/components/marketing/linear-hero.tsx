"use client";

import Link from "next/link";
import { useState, useEffect } from "react";

export function LinearHero() {
  const [activeTelemetry, setActiveTelemetry] = useState(0);

  const TELEMETRY_FEED = [
    {
      repo: "acme-corp/payment-service",
      file: "src/config/stripe.ts:19",
      rule: "Stripe Secret Key",
      redacted: 'sk_live_••••••••••••••••••••3f9a',
      status: "REDACTED",
      entropy: "4.71 bits",
      time: "2s ago",
    },
    {
      repo: "scale-infra/aws-deployer",
      file: "terraform/credentials.tf:44",
      rule: "AWS Access Key ID",
      redacted: 'AKIA••••••••••9F3',
      status: "REDACTED",
      entropy: "4.82 bits",
      time: "6s ago",
    },
    {
      repo: "hyper-ai/dataset-indexer",
      file: "pipeline/auth.py:8",
      rule: "OpenAI API Key",
      redacted: 'sk-proj-••••••••••••••••••••88d1',
      status: "REDACTED",
      entropy: "4.65 bits",
      time: "11s ago",
    },
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveTelemetry((prev) => (prev + 1) % TELEMETRY_FEED.length);
    }, 3500);
    return () => clearInterval(timer);
  }, [TELEMETRY_FEED.length]);

  return (
    <section className="relative overflow-hidden border-b border-white/[0.06] bg-[#090a0f] pt-16 pb-20 md:pt-24 md:pb-28">
      {/* Subtle Linear-style top glow backdrop */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 flex justify-center"
      >
        <div className="h-[360px] w-[800px] -translate-y-24 rounded-full bg-gradient-to-b from-blue-500/[0.12] via-indigo-500/[0.06] to-transparent blur-3xl" />
      </div>

      <div className="mx-auto max-w-6xl px-6">
        {/* Top Eyebrow Badge */}
        <div className="flex justify-center">
          <Link
            href="/how-it-works"
            className="group inline-flex items-center gap-2.5 rounded-full border border-white/[0.08] bg-white/[0.03] px-3.5 py-1 text-xs font-medium text-zinc-300 shadow-sm backdrop-blur transition-all duration-200 hover:border-white/[0.16] hover:bg-white/[0.06] hover:text-white"
          >
            <span className="flex size-1.5 rounded-full bg-emerald-400" />
            <span className="font-mono text-[11px] tracking-wide text-zinc-400 uppercase">
              Zero-Persistence Engine
            </span>
            <span className="text-zinc-600">/</span>
            <span className="text-zinc-300">Read architecture specs</span>
            <span
              aria-hidden="true"
              className="text-zinc-500 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-zinc-300"
            >
              →
            </span>
          </Link>
        </div>

        {/* Main Display Headline */}
        <div className="mt-8 text-center">
          <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-6xl md:text-7xl md:leading-[1.08]">
            Precision secret detection.
            <br />
            <span className="text-zinc-400">Zero credentials stored.</span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-base text-zinc-400 sm:text-lg sm:leading-relaxed">
            SecretWatch scans public GitHub code with dual-engine AST pattern matching and
            Shannon entropy scoring. Redacts matches before persistence and files authorized
            remediation issues through your own identity.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/submit-token"
            className="inline-flex h-11 items-center justify-center rounded-lg bg-white px-5 text-sm font-medium text-zinc-950 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.4)] transition-all hover:bg-zinc-200 hover:shadow-md"
          >
            Submit Scoped Token
          </Link>
          <Link
            href="/docs"
            className="inline-flex h-11 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.02] px-5 text-sm font-medium text-zinc-300 backdrop-blur transition-all hover:border-white/[0.18] hover:bg-white/[0.06] hover:text-white"
          >
            Explore Documentation
          </Link>
        </div>

        {/* Live Ticker Bar: Linear Telemetry Pill */}
        <div className="mt-14 mx-auto max-w-3xl">
          <div className="rounded-xl border border-white/[0.08] bg-zinc-950/80 p-3 shadow-2xl backdrop-blur-xl sm:p-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="flex size-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="font-mono text-xs font-medium text-zinc-400">
                  SCAN RADAR STREAM:
                </span>
                <span className="font-mono text-xs font-semibold text-white truncate max-w-[200px] sm:max-w-none">
                  {TELEMETRY_FEED[activeTelemetry].repo}
                </span>
              </div>

              <div className="flex items-center gap-2 font-mono text-xs">
                <span className="rounded bg-white/[0.06] px-2 py-0.5 text-[11px] text-zinc-300">
                  {TELEMETRY_FEED[activeTelemetry].rule}
                </span>
                <span className="rounded border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
                  {TELEMETRY_FEED[activeTelemetry].status}
                </span>
              </div>
            </div>

            <div className="mt-2.5 flex items-center justify-between border-t border-white/[0.04] pt-2 text-[11px] font-mono text-zinc-500">
              <span className="truncate">
                File: {TELEMETRY_FEED[activeTelemetry].file}
              </span>
              <span className="text-zinc-400 shrink-0">
                Evidence: <span className="text-emerald-400">{TELEMETRY_FEED[activeTelemetry].redacted}</span>
              </span>
            </div>
          </div>
        </div>

        {/* Three Guarantees Metric Bar */}
        <div className="mt-12 grid grid-cols-1 border-t border-white/[0.06] pt-8 sm:grid-cols-3 gap-6 text-center sm:text-left">
          <div className="flex flex-col gap-1">
            <span className="font-mono text-xl font-semibold text-white">0 bytes</span>
            <span className="text-xs text-zinc-400">
              Raw secret persistence. Only cryptographically masked evidence reaches PostgreSQL.
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="font-mono text-xl font-semibold text-white">AES-256-GCM</span>
            <span className="text-xs text-zinc-400">
              Tokens encrypted at rest. Transient worker memory decrypts strictly during search.
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="font-mono text-xl font-semibold text-white">Human Gate</span>
            <span className="text-xs text-zinc-400">
              Admin review queue verifies every candidate before opening a GitHub issue.
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
