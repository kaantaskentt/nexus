import type { PainBand } from "@/lib/types";
import { cn } from "@/lib/cn";

// Coarse bands only — never a decimal, never a number (F28/A2). The soft fill IS
// the signal; the ladder reads low → severe by warmth.
const MAP: Record<PainBand, { label: string; fill: string }> = {
  low: { label: "Low", fill: "bg-pain-low" },
  moderate: { label: "Moderate", fill: "bg-pain-moderate" },
  high: { label: "High", fill: "bg-pain-high" },
  severe: { label: "Severe", fill: "bg-pain-severe" },
};

export function PainBandChip({
  band,
  className,
}: {
  band: PainBand;
  className?: string;
}) {
  const b = MAP[band];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-chip px-2.5 py-1 text-xs font-semibold text-ink",
        b.fill,
        className,
      )}
    >
      <span className="opacity-60">Pain</span>
      {b.label}
    </span>
  );
}
