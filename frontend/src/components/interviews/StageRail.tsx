import Link from "next/link";
import { cn } from "@/lib/cn";

// The interview as ONE connected workflow (Feedback-K): Plan → Observe → Report → Follow-up.
// The rail renders on every stage's detail page (header) and, compact, on each hub card, so
// a person always sees where an interview is and can step to any stage that already exists.
export type Stage = "plan" | "observe" | "report" | "followup";

const STAGES: { key: Stage; label: string }[] = [
  { key: "plan", label: "Plan" },
  { key: "observe", label: "Observe" },
  { key: "report", label: "Report" },
  { key: "followup", label: "Follow-up" },
];

const STAGE_INDEX: Record<Stage, number> = { plan: 0, observe: 1, report: 2, followup: 3 };

// Full labeled rail for a detail-page header. `hrefs` links the stages that actually exist
// (a stage with no href and past the current node reads as not-yet-reached, never a dead
// link). The current stage is lit; earlier reached stages are solid; future stages dim.
export function StageRail({
  current,
  hrefs = {},
  className,
}: {
  current: Stage;
  hrefs?: Partial<Record<Stage, string>>;
  className?: string;
}) {
  const currentIdx = STAGE_INDEX[current];
  // The wrapper is overflow-x-auto so the rail can NEVER push the page body sideways at
  // narrow widths (seam-2: it overflowed 390px on plan +19 and report +27). Circles and
  // labels also shrink below sm so the four stages fit a phone without needing to scroll.
  return (
    <div className={cn("min-w-0 overflow-x-auto", className)}>
      <nav aria-label="Interview stages" className="flex items-center">
        {STAGES.map((s, i) => {
          const reached = i <= currentIdx;
          const isCurrent = i === currentIdx;
          const href = hrefs[s.key];
          const node = (
            <span className="flex items-center gap-1.5 sm:gap-2">
              <span
                className={cn(
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold transition-colors sm:h-6 sm:w-6 sm:text-[11px]",
                  isCurrent
                    ? "bg-accent text-on-accent shadow-elev-1"
                    : reached
                      ? "bg-accent-soft text-accent-ink"
                      : "bg-surface-sunken text-ink-faint ring-1 ring-inset ring-line",
                )}
              >
                {i + 1}
              </span>
              <span
                className={cn(
                  "whitespace-nowrap text-xs font-medium sm:text-sm",
                  isCurrent ? "text-ink" : reached ? "text-ink-soft" : "text-ink-faint",
                )}
              >
                {s.label}
              </span>
            </span>
          );
          return (
            <div key={s.key} className="flex flex-1 items-center last:flex-none">
              {href && !isCurrent ? (
                <Link href={href} className="rounded-md transition-opacity hover:opacity-70">
                  {node}
                </Link>
              ) : (
                node
              )}
              {i < STAGES.length - 1 && (
                <div
                  className={cn(
                    "mx-1.5 h-px flex-1 sm:mx-2.5",
                    i < currentIdx ? "bg-accent/40" : "bg-line",
                  )}
                />
              )}
            </div>
          );
        })}
      </nav>
    </div>
  );
}

// Compact 4-dot progress for a hub card: the current stage lit, reached stages solid,
// future stages hollow — the same language as the full rail, sized for a row.
export function StageDots({ current }: { current: Stage }) {
  const currentIdx = STAGE_INDEX[current];
  return (
    <span className="flex items-center gap-1" aria-hidden="true">
      {STAGES.map((s, i) => (
        <span
          key={s.key}
          className={cn(
            "h-1.5 rounded-full transition-colors",
            i === currentIdx ? "w-4 bg-accent" : i < currentIdx ? "w-1.5 bg-accent/50" : "w-1.5 bg-line-strong",
          )}
        />
      ))}
    </span>
  );
}

export function stageLabel(stage: Stage): string {
  return STAGES[STAGE_INDEX[stage]].label;
}
