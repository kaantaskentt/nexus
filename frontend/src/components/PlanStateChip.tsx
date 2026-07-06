"use client";

import { motion } from "framer-motion";
import type { PlanState } from "@/lib/types";
import { cn } from "@/lib/cn";

// All 12 states from the backend TRANSITIONS map (routers/plans.py). The UI only
// renders state — it never decides transitions. Tone groups the lifecycle:
// draft/review (neutral·info) → live (accent·amber) → done (success) → exits (faint·danger).
const MAP: Record<PlanState, { label: string; dot: string; text: string }> = {
  DRAFT: { label: "Draft", dot: "bg-ink-faint", text: "text-ink-soft" },
  NEXUS_CHECK: { label: "Nexus check", dot: "bg-tag-claimed", text: "text-tag-claimed" },
  AWAITING_APPROVAL: { label: "Awaiting approval", dot: "bg-tag-claimed", text: "text-tag-claimed" },
  APPROVED: { label: "Approved", dot: "bg-accent", text: "text-accent-ink" },
  SENT: { label: "Sent", dot: "bg-accent", text: "text-accent-ink" },
  OPENED: { label: "Opened", dot: "bg-accent", text: "text-accent-ink" },
  IN_PROGRESS: { label: "In progress", dot: "bg-accent", text: "text-accent-ink" },
  PAUSED: { label: "Paused", dot: "bg-tag-guess", text: "text-tag-guess" },
  COMPLETED: { label: "Completed", dot: "bg-success", text: "text-success" },
  COMPILED: { label: "Compiled", dot: "bg-tag-verified", text: "text-tag-verified" },
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
  return (
    <motion.span
      key={state}
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
      {s.label}
    </motion.span>
  );
}
