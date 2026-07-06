"use client";

import { motion } from "framer-motion";
import type { Confidence } from "@/lib/types";
import { cn } from "@/lib/cn";

// Confidence as a soft-tinted pill (stage5 mockup). F35 semantics preserved:
// Verified (independent agreement) reads stronger than High (single firsthand);
// Reported = one claimed voice; Guess = unverified estimate; From web = scraped
// reference (~20% weight, A2). Wording note: the mockup labels the middle tiers
// "Medium/Low confidence" — kept here — while the top tier stays "Verified" (F35).
const MAP: Record<Confidence, { label: string; pill: string; title: string }> = {
  verified: {
    label: "Verified",
    pill: "bg-success-soft text-tag-verified",
    title: "Independent agreement across sources",
  },
  high: {
    label: "High confidence",
    pill: "bg-success-soft text-tag-confirmed",
    title: "Confirmed by a single firsthand source",
  },
  reported: {
    label: "Medium confidence",
    pill: "bg-pain-moderate text-tag-guess",
    title: "Claimed by one voice, not yet corroborated",
  },
  guess: {
    label: "Low confidence",
    pill: "bg-danger-soft text-danger",
    title: "Unverified estimate — a guess until confirmed on a call",
  },
  scraped: {
    label: "From web",
    pill: "bg-surface-raised text-ink-faint",
    title: "Scraped reference — about 20% weight, not verified",
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
