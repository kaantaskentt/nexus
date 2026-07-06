import type { ClaimRecord } from "@/lib/types";
import { cn } from "@/lib/cn";

// Evidence rendering with the F33 rule baked in: interview-sourced evidence is
// PARAPHRASED in client views (never a verbatim attributed employee quote — A3).
// CEO-call quotes are his own words and stay verbatim with a timestamp deep-link.
export function EvidenceQuoteCard({
  claim,
  className,
}: {
  claim: Pick<
    ClaimRecord,
    "claim_text" | "evidence_quote" | "evidence_ts" | "is_paraphrased" | "tag"
  >;
  className?: string;
}) {
  const paraphrased = claim.is_paraphrased ?? false;
  const quote = claim.evidence_quote ?? claim.claim_text;

  return (
    <figure
      className={cn(
        "rounded-card border border-line bg-surface-raised p-4",
        className,
      )}
    >
      <blockquote
        className={cn(
          "border-l-2 pl-3 text-sm leading-relaxed",
          paraphrased
            ? "border-line-strong text-ink-soft not-italic"
            : "border-accent font-display italic text-ink",
        )}
      >
        {paraphrased ? quote.replace(/^\[paraphrased\]\s*/i, "") : `“${quote}”`}
      </blockquote>

      <figcaption className="mt-3 flex items-center gap-2 text-xs text-ink-faint">
        {paraphrased && (
          <span className="rounded-chip border border-line px-2 py-0.5 font-medium text-ink-faint">
            Paraphrased
          </span>
        )}
        {claim.evidence_ts ? (
          <button
            type="button"
            // Deep-link affordance to the transcript locator (wired to the player later).
            className="inline-flex items-center gap-1 font-medium text-accent hover:underline"
            title="Jump to this moment in the transcript"
          >
            <span aria-hidden>↳</span>
            {claim.evidence_ts}
          </button>
        ) : (
          <span>No timestamp</span>
        )}
      </figcaption>
    </figure>
  );
}
