"use client";

import { motion } from "framer-motion";
import type { Confidence } from "@/lib/types";
import { cn } from "@/lib/cn";

// Confidence as a soft-tinted pill. Four glossary labels only, letter-exact to the
// glossary (line 19) / badge-mapping-spec: Verified, High, Reported, Scraped. The graded
// "Medium/Low confidence" scale is dropped. Each carries a plain-language tooltip (the
// ruled strings). A GUESS never upgrades and never renders as a distinct lower tier: it
// maps to "reported" on every path (non-negotiable #1), so a raw `guess` confidence
// renders identically to `reported`, tooltip included.
const MAP: Record<Confidence, { label: string; pill: string; title: string }> = {
  verified: {
    label: "Verified",
    pill: "bg-success-soft text-tag-verified",
    title: "Confirmed by independent sources",
  },
  high: {
    label: "High",
    pill: "bg-success-soft text-tag-confirmed",
    title: "Confirmed by a single source",
  },
  reported: {
    label: "Reported",
    pill: "bg-pain-moderate text-tag-guess",
    title: "Stated in an interview, not yet confirmed",
  },
  guess: {
    label: "Reported",
    pill: "bg-pain-moderate text-tag-guess",
    title: "Stated in an interview, not yet confirmed",
  },
  scraped: {
    label: "Scraped",
    pill: "bg-surface-raised text-ink-faint",
    title: "From the website scan, not yet verified",
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
