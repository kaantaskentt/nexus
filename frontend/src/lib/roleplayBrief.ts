// Parse a role-play character sheet (the raw respondent-persona markdown the F8 brief
// endpoint returns) into a legible overview. DEFENSIVE by contract: every field is
// derived from what is actually in the markdown — a missing section yields no row, an
// unmatched heading keeps its own (cleaned) title, and nothing is ever invented. The raw
// markdown is still rendered verbatim in the "Full brief" tab; this parse only drives the
// friendlier Overview so a CEO can understand the scenario without reading the technical
// file (SIMPLIFY §4-J). No backend contract is assumed beyond "it's markdown".

export type BriefTier = "overview" | "details";

export interface BriefSection {
  heading: string; // display heading (relabeled if recognized, else cleaned original)
  body: string; // verbatim section body (rendered markdown-lite)
  tier: BriefTier; // overview = always shown; details = behind the expander
}

export interface ParsedBrief {
  title: string | null; // identity line from the H1, leading "You are " stripped
  intro: string | null; // preamble between the H1 and the first "## " section
  sections: BriefSection[]; // in document order
}

const HTML_COMMENT = /<!--[\s\S]*?-->/g;

// Friendly relabels + overview/details tiering, matched on the section heading (first
// match wins). The persona files share a stable shape (How you speak / Your real workflow
// / Vocabulary / Hidden knowledge / Planted traps / Staying in character) but the exact
// heading text varies per character, so we match on intent, not literal strings.
const BUCKETS: { test: RegExp; label: string; tier: BriefTier }[] = [
  { test: /how (you|they) speak|voice|tone|manner|\bstyle\b/i, label: "How they speak", tier: "overview" },
  { test: /workflow|the work|ground truth|how the work|\bday\b/i, label: "How the work really happens", tier: "overview" },
  { test: /goal|objective|what (you|they) want|motivation/i, label: "What they want", tier: "overview" },
  { test: /vocabulary|words|phrases|lingo/i, label: "Words they use", tier: "details" },
  { test: /hidden|hold back|volunteer|withhold/i, label: "What to hold back", tier: "details" },
  { test: /\btrap|\bbait/i, label: "Baits to watch for", tier: "details" },
  { test: /in character|staying/i, label: "Staying in character", tier: "details" },
];

// Drop a trailing scorer-style parenthetical, e.g. "How you speak (PROUD MAKER)".
function cleanHeading(h: string): string {
  return h.replace(/\s*(?:\([^()]*\)\s*)+$/, "").trim();
}

function finishSection(heading: string, bodyLines: string[]): BriefSection {
  const bucket = BUCKETS.find((b) => b.test.test(heading));
  return {
    heading: bucket ? bucket.label : cleanHeading(heading),
    body: bodyLines.join("\n").trim(),
    tier: bucket ? bucket.tier : "details",
  };
}

export function parseBrief(raw: string): ParsedBrief {
  const text = (raw ?? "").replace(HTML_COMMENT, "").replace(/\r\n/g, "\n").trim();
  if (!text) return { title: null, intro: null, sections: [] };

  let title: string | null = null;
  const introLines: string[] = [];
  const sections: BriefSection[] = [];
  let heading: string | null = null;
  let bodyLines: string[] = [];

  for (const line of text.split("\n")) {
    const h2 = /^#{2,}\s+(.*)$/.exec(line); // "## " and deeper start a section
    const h1 = /^#\s+(.*)$/.exec(line); // single "# " is the identity line
    if (h2) {
      if (heading !== null) sections.push(finishSection(heading, bodyLines));
      heading = h2[1].trim();
      bodyLines = [];
    } else if (h1 && title === null && heading === null) {
      title = h1[1].replace(/^you are\s+/i, "").trim();
    } else if (heading !== null) {
      bodyLines.push(line);
    } else {
      introLines.push(line);
    }
  }
  if (heading !== null) sections.push(finishSection(heading, bodyLines));

  return { title, intro: introLines.join("\n").trim() || null, sections };
}
