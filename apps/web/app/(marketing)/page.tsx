import type { Metadata } from "next";
import { LinearHero } from "@/components/marketing/linear-hero";
import { LinearBentoGrid } from "@/components/marketing/linear-bento-grid";
import { LinearMatrixSection } from "@/components/marketing/linear-matrix-section";

export const metadata: Metadata = {
  title: "SecretWatch — Precision Secret Detection for GitHub",
  description:
    "Automated secret discovery for public GitHub repositories. Dual-engine AST regex and Shannon entropy analysis, zero raw credential persistence, and human-in-the-loop remediation.",
  openGraph: {
    title: "SecretWatch — Precision Secret Detection for GitHub",
    description:
      "Precision secret detection for GitHub. Zero raw secrets stored, live telemetry stream, and human-in-the-loop remediation.",
    type: "website",
  },
};

export default function LandingPage() {
  return (
    <div className="flex flex-col bg-[#090a0f] text-zinc-100 selection:bg-white selection:text-black">
      {/* 1. Linear-style display hero with real-time telemetry stream */}
      <LinearHero />

      {/* 2. Bento grid featuring Dual-engine AST/Shannon, Zero-vault, and Human triage gate */}
      <LinearBentoGrid />

      {/* 3. High-density signature matrix table and final call-to-action */}
      <LinearMatrixSection />
    </div>
  );
}
