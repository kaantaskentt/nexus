import { ArrowRight, Quote } from "lucide-react";
import type { ClaimRecord } from "@/lib/types";
import { cn } from "@/lib/cn";

// Evidence card (stage5 Evidence rail): a source pill + timestamp header, the quote,
// and a "View transcript evidence" link. F33 rule baked in: interview-sourced
// evidence is PARAPHRASED in client views (never a verbatim attributed employee
// quote — A3); CEO-call quotes are the founder's own words and stay verbatim.
export function EvidenceQuoteCard({
  claim,
  sourceLabel = "CEO Call",
  showLink = true,
  className,
}: {
  claim: Pick<
    ClaimRecord,
    "claim_text" | "evidence_quote" | "evidence_ts" | "is_paraphrased" | "tag"
  >;
  sourceLabel?: string;
  showLink?: boolean;
  className?: string;
}) {
  const paraphrased = claim.is_paraphrased ?? false;
  const quote = (claim.evidence_quote ?? claim.claim_text).replace(/^\[paraphrased\]\s*/i, "");

  return (
    <figure className={cn("rounded-card border border-line bg-surface p-4", className)}>
      <div className="mb-2 flex items-center justify-between">
        <span className="rounded-md bg-surface-raised px-2 py-0.5 text-[11px] font-medium text-ink-soft">
          {paraphrased ? "Paraphrased" : sourceLabel}
        </span>
        {claim.evidence_ts && (
          <span className="text-xs tabular-nums text-ink-faint">{claim.evidence_ts}</span>
        )}
      </div>

      <blockquote
        className={cn(
          "flex gap-2 text-sm leading-relaxed",
          paraphrased ? "text-ink-soft" : "text-ink",
        )}
      >
        <Quote className="mt-0.5 h-4 w-4 shrink-0 text-accent" fill="currentColor" strokeWidth={0} />
        <span className={paraphrased ? "" : "font-display italic"}>{quote}</span>
      </blockquote>

      {showLink && (
        <button
          type="button"
          className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
          title="Jump to this moment in the transcript"
        >
          View transcript evidence
          <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
        </button>
      )}
    </figure>
  );
}
