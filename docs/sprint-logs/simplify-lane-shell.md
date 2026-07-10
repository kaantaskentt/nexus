# Lane Shell — SIMPLIFY sprint log (A28 pre-reviews + verdicts)

Per team rule (July 9): A28 pre-reviews live here, not in SPRINT-STATE.md (that file is a
concurrent-write hotspot; merge happens at Phase 4). One behavior change per commit.

---

## Task #13 — responsive AppShell (DONE, PLAN §8 Amendment 1)

Landed earlier this sprint (commits 4f980c3 code+tests, 1bb2212/0584b7d SPRINT-STATE).
Full pre-review + audit verdict are in SPRINT-STATE.md "Lane Shell" (written before this
log existed). Summary: aside `hidden lg:flex`, `lg:hidden` mobile header + hamburger,
left slide-over drawer (drawerSpring/scrimFade/useEscapeClose), `SidebarBody` extracted,
`SignOutButton touch` prop. Desktop byte-identical at lg+. Green: 67/67 + tsc + lint +
build.

---

## Task #8 — Play this character: overview card (PLAN §4-J)

**A28 pre-review — COMMIT 1 (brief overview card).**
Today: `RolePlaySection.tsx:231` dumps the raw respondent-persona markdown (`{brief}`) into
one `whitespace-pre-wrap` box — headings, `**bold**`, HTML scorer comments and all. A CEO
opening "Play this character" has to read a technical system-prompt file to understand who
they're playing. After: the dialog gets two tabs — **Overview** (default) and **Full brief**.
Overview renders a legible card parsed defensively from the sheet's own markdown sections:
the identity line (H1, "You are" stripped) as the scenario summary, the structured cast
facts (their style, what they test — already reliable, not parsed), then relabeled sections
("How they speak" → How they speak; "Your real workflow" → How the work really happens),
with the scorer-facing sections (hidden knowledge → "What to hold back", planted traps →
"Baits to watch for", vocabulary, staying-in-character) tucked behind an expandable "Show
playing details" disclosure. **Full brief** tab keeps the EXACT old box: the raw MD verbatim,
nothing stripped. Parse is pure + defensive: a missing section yields no row, unmatched
headings keep their own (cleaned) heading and fall to details, and a sheet that doesn't parse
falls back to showing the raw text — nothing is ever invented. No backend change; the brief
endpoint and `persona_sheet` are untouched.

Simpler or more complex for the user? SIMPLER — the CEO reads a plain-language character
card instead of a raw system-prompt file, and the full technical brief is still one tab away
verbatim for anyone who wants it. New files: `lib/roleplayBrief.ts` (parser) + its unit test;
edit to `RolePlaySection.tsx`; a small `MarkdownLite` renderer local to the component.
