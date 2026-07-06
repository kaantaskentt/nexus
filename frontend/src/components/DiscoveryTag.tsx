import { cn } from "@/lib/cn";

// How a suggested person surfaced: FIRST (interview first), call-discovered (named
// on the CEO call, not in public data), or new-person. Tone drives the color only.
const TONE: Record<string, string> = {
  first: "bg-success-soft text-tag-verified",
  call: "bg-accent-soft text-tag-claimed",
  new: "bg-pain-moderate text-tag-guess",
};

export function DiscoveryTag({
  label,
  tone,
  className,
}: {
  label: string;
  tone: "first" | "call" | "new";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-chip px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
        TONE[tone],
        className,
      )}
    >
      {label}
    </span>
  );
}
