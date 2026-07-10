import { cn } from "@/lib/cn";

// Workflow-level evidence rollup — how much of the workflow is corroborated across sources
// (derived server-side from the share of steps `verified`). This is deliberately NOT the
// claim ConfidenceBadge: that badge renders per-claim trust tags with trust tooltips
// ("Confirmed by a single source") and, per non-negotiable #1, has no graded Medium/Low
// tier. A workflow completeness read is a different measure, so it gets its own quiet chip
// in the same visual grammar — three honest tiers, no trust-tag semantics implied.
export type WorkflowConfidence = "high" | "medium" | "low";

const MAP: Record<WorkflowConfidence, { label: string; pill: string; title: string }> = {
  high: {
    label: "High confidence",
    pill: "bg-success-soft text-tag-confirmed",
    title: "Most steps are corroborated across interviews",
  },
  medium: {
    label: "Medium confidence",
    pill: "bg-pain-moderate text-tag-guess",
    title: "Some steps are corroborated; others rest on a single account",
  },
  low: {
    label: "Low confidence",
    pill: "bg-surface-raised text-ink-faint",
    title: "Most steps rest on a single, not-yet-corroborated account",
  },
};

export function WorkflowConfidenceChip({
  confidence,
  className,
}: {
  confidence: WorkflowConfidence | null;
  className?: string;
}) {
  if (!confidence) return null;
  const c = MAP[confidence];
  return (
    <span
      title={c.title}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-chip px-2.5 py-1 text-xs font-semibold tracking-tight ring-1 ring-inset ring-ink/[0.04]",
        c.pill,
        className,
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {c.label}
    </span>
  );
}
