import { cn } from "@/lib/cn";

// Two tiers only: must-hit (filled accent) vs nice-to-have (hollow ring).
// A topic the interviewer must satisfy vs one to reach only if time allows.
export function MustHitDot({
  mustHit,
  withLabel = false,
  className,
}: {
  mustHit: boolean;
  withLabel?: boolean;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <span
        title={mustHit ? "Must hit" : "Nice to have"}
        className={cn(
          "h-2.5 w-2.5 shrink-0 rounded-full",
          mustHit ? "bg-accent" : "border-2 border-line-strong bg-transparent",
        )}
      />
      {withLabel && (
        <span
          className={cn(
            "text-xs font-medium",
            mustHit ? "text-accent-ink" : "text-ink-faint",
          )}
        >
          {mustHit ? "Must hit" : "Nice to have"}
        </span>
      )}
    </span>
  );
}
