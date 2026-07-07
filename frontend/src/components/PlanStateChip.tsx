"use client";

import { motion } from "framer-motion";
import type { PlanState } from "@/lib/types";
import brand from "@/lib/brand";
import { cn } from "@/lib/cn";

// All 12 states from the backend TRANSITIONS map (routers/plans.py). The UI only
// renders state — it never decides transitions. Tone groups the lifecycle:
// draft/review (neutral·info) → live (accent·amber) → done (success) → exits (faint·danger).
const MAP: Record<PlanState, { label: string; dot: string; text: string; title?: string }> = {
  DRAFT: { label: "Draft", dot: "bg-ink-faint", text: "text-ink-soft" },
  // Label carries the brand name — substituted at render so it stays config-driven (A13.2).
  // The tooltip says what the state means; "%BRAND% check" alone is opaque (YC-AUDIT #13).
  NEXUS_CHECK: {
    label: "%BRAND% check", dot: "bg-tag-claimed", text: "text-tag-claimed",
    title: "%BRAND% is reviewing the generated plan before it reaches you",
  },
  AWAITING_APPROVAL: { label: "Awaiting approval", dot: "bg-tag-claimed", text: "text-tag-claimed" },
  APPROVED: { label: "Approved", dot: "bg-accent", text: "text-accent-ink" },
  SENT: { label: "Sent", dot: "bg-accent", text: "text-accent-ink" },
  OPENED: { label: "Opened", dot: "bg-accent", text: "text-accent-ink" },
  IN_PROGRESS: { label: "In progress", dot: "bg-accent", text: "text-accent-ink" },
  PAUSED: { label: "Paused", dot: "bg-tag-guess", text: "text-tag-guess" },
  // One terminal word across the product (YC-AUDIT #13): a finished interview reads
  // "Completed" here just as it does on the Interviews list. COMPILED keeps its distinct
  // dot (its records are compiled) but never a second user-facing verb.
  COMPLETED: { label: "Completed", dot: "bg-success", text: "text-success" },
  COMPILED: {
    label: "Completed", dot: "bg-tag-verified", text: "text-tag-verified",
    title: "Interview completed and compiled into records",
  },
  NO_RESPONSE: { label: "No response", dot: "bg-ink-faint", text: "text-ink-faint" },
  REVOKED: { label: "Revoked", dot: "bg-danger", text: "text-danger" },
};

export function PlanStateChip({
  state,
  className,
}: {
  state: PlanState;
  className?: string;
}) {
  const s = MAP[state];
  const label = s.label.replace("%BRAND%", brand.product_name);
  const title = s.title?.replace("%BRAND%", brand.product_name);
  return (
    <motion.span
      key={state}
      title={title}
      initial={{ opacity: 0, y: -2 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-chip border border-line bg-surface-raised px-2.5 py-1 text-xs font-medium",
        s.text,
        className,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", s.dot)} />
      {label}
    </motion.span>
  );
}
