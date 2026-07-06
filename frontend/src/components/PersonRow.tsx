import type { ReactNode } from "react";
import type { Confidence } from "@/lib/types";
import { ConfidenceBadge } from "./ConfidenceBadge";
import { cn } from "@/lib/cn";

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

// Name, role, and a why-line that carries RESPONSIBILITY FACTS ONLY (F34) — no
// sentiment, no characterization. The caller passes an already-filtered why-line;
// this component never synthesizes one.
export function PersonRow({
  name,
  role,
  whyLine,
  confidence,
  action,
  className,
}: {
  name: string;
  role: string;
  whyLine: string;
  confidence?: Confidence;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-card border border-line bg-surface p-4",
        className,
      )}
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-sm font-semibold text-accent-ink">
        {initials(name)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-display text-base text-ink">{name}</span>
          {confidence && <ConfidenceBadge confidence={confidence} />}
        </div>
        <div className="text-xs font-medium uppercase tracking-wide text-ink-faint">
          {role}
        </div>
        <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{whyLine}</p>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
