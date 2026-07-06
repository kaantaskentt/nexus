"use client";

import { motion } from "framer-motion";
import type { Confidence } from "@/lib/types";
import { cn } from "@/lib/cn";

// Confidence as a soft-tinted pill. Four glossary labels only (glossary line 19 /
// badge-mapping-spec): verified (independent agreement, F35), high (single confirmed
// source), reported (claimed, one voice), scraped (~20% reference weight, A2). The
// graded "Medium/Low confidence" scale is dropped. A GUESS never upgrades and never
// renders as a distinct lower tier: it maps to "reported" on every path (non-negotiable
// #1), so a raw `guess` confidence renders identically to `reported`.
const MAP: Record<Confidence, { label: string; pill: string; title: string }> = {
  verified: {
    label: "Verified",
    pill: "bg-success-soft text-tag-verified",
    title: "Independent agreement across sources",
  },
  high: {
    label: "High",
    pill: "bg-success-soft text-tag-confirmed",
    title: "Confirmed by a single firsthand source",
  },
  reported: {
    label: "Reported",
    pill: "bg-pain-moderate text-tag-guess",
    title: "Claimed by one voice, not yet corroborated",
  },
  guess: {
    label: "Reported",
    pill: "bg-pain-moderate text-tag-guess",
    title: "A hedged estimate, surfaced no stronger than a claim and never upgraded",
  },
  scraped: {
    label: "From web",
    pill: "bg-surface-raised text-ink-faint",
    title: "Scraped reference, about 20% weight, not verified",
  },
};

export function ConfidenceBadge({
  confidence,
  className,
}: {
  confidence: Confidence;
  className?: string;
}) {
  const c = MAP[confidence];
  return (
    <motion.span
      // Badge changes animate so a tier shift reads as a state change, not a repaint.
      key={confidence}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
      title={c.title}
      className={cn(
        "inline-flex items-center rounded-chip px-2.5 py-1 text-xs font-semibold tracking-tight ring-1 ring-inset ring-ink/[0.04]",
        c.pill,
        className,
      )}
    >
      {c.label}
    </motion.span>
  );
}
