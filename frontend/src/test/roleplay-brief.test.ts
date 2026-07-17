import { describe, it, expect } from "vitest";
import { parseBrief } from "@/lib/roleplayBrief";

// SIMPLIFY §4-J: the overview card is parsed defensively from the respondent-persona
// markdown. These tests pin the contract that matters — nothing is invented, missing
// sections yield no row, unmatched headings survive, and garbage never throws.

const SHEET = `<!-- Respondent-simulator persona (task #16). A12: fully fictional. -->

# You are Lale Aksu — Operations Manager, Serein Fine Jewelry (Istanbul)

You are 41, ten years at Serein, proud of the house's craft. You tend to tell the
polished version first.

## How you speak (PROUD MAKER)
- You lead with craft and pride.
- You generalize into a smooth narrative.

## Your real workflow (ground truth — give it truthfully when asked well)
1. A custom order comes in through the boutique.
2. Design is sketched and approved.

## Vocabulary (use these verbatim, naturally)
"the bench", "the stone book", "GIA cert".

## Hidden knowledge — do NOT volunteer; release only under proper probing
- **H1 — the rework loop.** Roughly one custom in five comes back from QA.

## Something Bespoke
An oddly-named section that no bucket matches.`;

describe("parseBrief", () => {
  it("pulls the identity line from the H1 and strips 'You are'", () => {
    const p = parseBrief(SHEET);
    expect(p.title).toBe("Lale Aksu — Operations Manager, Serein Fine Jewelry (Istanbul)");
  });

  it("captures the preamble as the intro and drops HTML comments", () => {
    const p = parseBrief(SHEET);
    expect(p.intro).toMatch(/proud of the house's craft/);
    expect(p.intro).not.toMatch(/task #16|fictional/); // comment stripped
  });

  it("relabels recognized sections and tiers them overview vs details", () => {
    const { sections } = parseBrief(SHEET);
    const byHeading = Object.fromEntries(sections.map((s) => [s.heading, s]));

    expect(byHeading["How they speak"]?.tier).toBe("overview");
    expect(byHeading["How the work really happens"]?.tier).toBe("overview");
    expect(byHeading["Words they use"]?.tier).toBe("details");
    expect(byHeading["What to hold back"]?.tier).toBe("details");
    // Body is kept verbatim (markdown intact for the lite renderer).
    expect(byHeading["What to hold back"].body).toMatch(/\*\*H1 — the rework loop\.\*\*/);
  });

  it("keeps an unmatched heading (cleaned) instead of inventing or dropping it", () => {
    const { sections } = parseBrief(SHEET);
    const custom = sections.find((s) => s.heading === "Something Bespoke");
    expect(custom).toBeTruthy();
    expect(custom?.tier).toBe("details");
  });

  it("removes every trailing scorer annotation from an unmatched heading", () => {
    const parsed = parseBrief(
      "## Something Bespoke (INTERNAL) (DO NOT SHOW)\nVisible body.",
    );
    expect(parsed.sections[0].heading).toBe("Something Bespoke");
    expect(parsed.sections[0].body).toBe("Visible body.");
  });

  it("omits absent sections — never fabricates a goals/context row", () => {
    const minimal = parseBrief("# You are Sam — Clerk\n\nJust a background line, no sections.");
    expect(minimal.title).toBe("Sam — Clerk");
    expect(minimal.intro).toBe("Just a background line, no sections.");
    expect(minimal.sections).toHaveLength(0);
  });

  it("returns an empty, non-throwing shape for blank or comment-only input", () => {
    expect(parseBrief("")).toEqual({ title: null, intro: null, sections: [] });
    expect(parseBrief("   \n\n  ")).toEqual({ title: null, intro: null, sections: [] });
    expect(parseBrief("<!-- only a comment -->")).toEqual({ title: null, intro: null, sections: [] });
  });

  it("handles a sheet with sections but no H1 (no title, intro before first heading)", () => {
    const p = parseBrief("Loose intro text.\n\n## How you speak\n- terse.");
    expect(p.title).toBeNull();
    expect(p.intro).toBe("Loose intro text.");
    expect(p.sections[0].heading).toBe("How they speak");
  });
});
