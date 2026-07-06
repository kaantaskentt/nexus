"use client";

import { motion } from "framer-motion";
import type { Confidence } from "@/lib/types";
import { cn } from "@/lib/cn";

// F35 split surfaced honestly: Verified (independent agreement) reads stronger than
// High (single confirmed source). Reported = one claimed voice; Scraped = ~20%
// reference weight (A2), never presented as verified. Colored dot + text on a
// neutral chip — the hue is the trust-ladder token, never an ad-hoc value.
const MAP: Record<
  Confidence,
  { label: string; dot: string; text: string; title: string }
> = {
  verified: {
    label: "Verified",
    dot: "bg-tag-verified",
    text: "text-tag-verified",
    title: "Independent agreement across sources",
  },
  high: {
    label: "High",
    dot: "bg-tag-confirmed",
    text: "text-tag-confirmed",
    title: "Confirmed by a single firsthand source",
  },
  reported: {
    label: "Reported",
    dot: "bg-tag-claimed",
    text: "text-tag-claimed",
    title: "Claimed by one voice, not yet corroborated",
  },
  scraped: {
    label: "From web",
    dot: "bg-tag-scraped",
    text: "text-tag-scraped",
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
      transition={{ duration: 0.18 }}
      title={c.title}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-chip border border-line bg-surface-raised px-2.5 py-1 text-xs font-medium",
        c.text,
        className,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", c.dot)} />
      {c.label}
    </motion.span>
  );
}
