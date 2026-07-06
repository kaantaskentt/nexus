import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { confidenceForTag } from "@/lib/trust";
import { ConfidenceBadge } from "@/components/ConfidenceBadge";
import { PainBandChip } from "@/components/PainBandChip";
import { EvidenceQuoteCard } from "@/components/EvidenceQuoteCard";
import { PlanStateChip } from "@/components/PlanStateChip";
import brand from "@/lib/brand";
import type { PainBand, PlanState, TrustTag } from "@/lib/types";

// Implements evals/frontend/badge-mapping-spec.yaml (owned by prompts-evals).

// ── Trust tag → confidence badge ────────────────────────────────────────────
describe("trust tag → confidence badge", () => {
  const cases: [TrustTag, string][] = [
    ["VERIFIED", "verified"],
    ["CONFIRMED", "high"],
    ["CLAIMED", "reported"],
    ["GUESS", "reported"],
    ["SCRAPED", "scraped"],
  ];
  it.each(cases)("%s → %s", (tag, expected) => {
    expect(confidenceForTag(tag)).toBe(expected);
  });
  it("a GUESS is never visually upgraded to high (non-negotiable #1)", () => {
    expect(confidenceForTag("GUESS")).not.toBe("high");
    expect(confidenceForTag("GUESS")).not.toBe("verified");
  });
});

// ── ConfidenceBadge labels ──────────────────────────────────────────────────
describe("ConfidenceBadge", () => {
  it("verified reads 'Verified'", () => {
    const { container } = render(<ConfidenceBadge confidence="verified" />);
    expect(container.textContent).toBe("Verified");
  });
  it("high reads 'High confidence'", () => {
    const { container } = render(<ConfidenceBadge confidence="high" />);
    expect(container.textContent).toBe("High confidence");
  });
  it("reported reads 'Medium confidence' — never High", () => {
    const { container } = render(<ConfidenceBadge confidence="reported" />);
    expect(container.textContent).toBe("Medium confidence");
    expect(container.textContent).not.toContain("High");
  });
  it("scraped reads 'From web' (not verified)", () => {
    const { container } = render(<ConfidenceBadge confidence="scraped" />);
    expect(container.textContent).toBe("From web");
  });
});

// ── Pain band chip: coarse only, never a number ─────────────────────────────
describe("PainBandChip", () => {
  const bands: [PainBand, string][] = [
    ["low", "Low"],
    ["moderate", "Moderate"],
    ["high", "High"],
    ["severe", "Severe"],
  ];
  it.each(bands)("%s → chip '%s'", (band, label) => {
    const { container } = render(<PainBandChip band={band} />);
    expect(container.textContent).toContain(label);
  });
  it("never renders a decimal, percentage, or 0-100 number", () => {
    for (const [band] of bands) {
      const { container } = render(<PainBandChip band={band} />);
      expect(container.textContent).not.toMatch(/\d/);
      expect(container.textContent).not.toContain("%");
    }
  });
});

// ── Evidence rendering (A3 / F33) ───────────────────────────────────────────
describe("EvidenceQuoteCard", () => {
  it("CEO verbatim: quote + timestamp, not paraphrased", () => {
    render(
      <EvidenceQuoteCard
        claim={{
          claim_text: "x",
          evidence_quote: "He has his Excel, he's had it for years.",
          evidence_ts: "02:52",
          is_paraphrased: false,
          tag: "CLAIMED",
        }}
        sourceLabel="CEO Call"
      />,
    );
    expect(screen.getByText(/He has his Excel/)).toBeInTheDocument();
    expect(screen.getByText("02:52")).toBeInTheDocument();
    expect(screen.getByText("CEO Call")).toBeInTheDocument();
    expect(screen.queryByText("Paraphrased")).toBeNull();
  });

  it("employee: labeled 'Paraphrased', with no speaker name and no source label", () => {
    render(
      <EvidenceQuoteCard
        claim={{
          claim_text: "x",
          evidence_quote: "[paraphrased] The production lead describes a three-week peak.",
          evidence_ts: "00:22",
          is_paraphrased: true,
          tag: "CONFIRMED",
        }}
        sourceLabel="Burak"
      />,
    );
    expect(screen.getByText("Paraphrased")).toBeInTheDocument();
    // the source label (a name, if passed) must NOT be attributed next to the quote
    expect(screen.queryByText("Burak")).toBeNull();
    // the bracketed marker is stripped, not shown raw
    expect(screen.queryByText(/\[paraphrased\]/)).toBeNull();
  });

  it("never renders approach_note (exec-only, unverified)", () => {
    const secret = "SENSITIVE-APPROACH-NOTE";
    const { container } = render(
      <EvidenceQuoteCard
        claim={
          {
            claim_text: "x",
            evidence_quote: "a quote",
            evidence_ts: "1",
            is_paraphrased: false,
            tag: "CLAIMED",
            approach_note: secret,
          } as never
        }
      />,
    );
    expect(container.textContent).not.toContain(secret);
  });
});

// ── Quarantine deny-by-default (non-negotiable #4) ──────────────────────────
// The DB view excludes quarantined rows; the frontend guard is that even if a
// sentiment/approach_note-bearing record reached a component, none of that text renders.
describe("quarantine never renders", () => {
  it("EvidenceQuoteCard renders neither approach_note nor sentiment text", () => {
    const secret = "SENSITIVE-APPROACH-NOTE";
    const { container } = render(
      <EvidenceQuoteCard
        claim={
          {
            claim_text: "a quote",
            evidence_quote: "a quote",
            evidence_ts: "1",
            is_paraphrased: false,
            tag: "CLAIMED",
            approach_note: secret,
            sentiment_flag: true,
          } as never
        }
      />,
    );
    expect(container.textContent).not.toContain(secret);
  });
});

// ── Plan-state chip (12 states) + no decline (A4) ───────────────────────────
describe("PlanStateChip", () => {
  const states: PlanState[] = [
    "DRAFT",
    "NEXUS_CHECK",
    "AWAITING_APPROVAL",
    "APPROVED",
    "SENT",
    "OPENED",
    "IN_PROGRESS",
    "PAUSED",
    "COMPLETED",
    "COMPILED",
    "NO_RESPONSE",
    "REVOKED",
  ];

  it("renders all 12 states as distinct, non-empty labels", () => {
    const labels = states.map((s) => {
      const { container } = render(<PlanStateChip state={s} />);
      return container.textContent?.trim() ?? "";
    });
    expect(labels.every((l) => l.length > 0)).toBe(true);
    expect(new Set(labels).size).toBe(12);
  });

  it("NEXUS_CHECK label comes from brand.product_name (A13.2)", () => {
    const { container } = render(<PlanStateChip state="NEXUS_CHECK" />);
    expect(container.textContent).toBe(`${brand.product_name} check`);
  });

  it("no 'decline' affordance anywhere in the state chips", () => {
    const { container } = render(
      <div>
        {states.map((s) => (
          <PlanStateChip key={s} state={s} />
        ))}
      </div>,
    );
    expect(container.textContent?.toLowerCase()).not.toContain("decline");
  });
});
