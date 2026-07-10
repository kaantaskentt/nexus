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

**AUDIT VERDICT — LANDED (commit c8b291a).** Shipped as one scoped commit. Overview/Full-brief
tabs; parser is pure + defensive (verified against all 5 cast personas' heading shapes: How
you speak / Your real workflow / Vocabulary / Hidden knowledge / Planted traps / Staying in
character — all relabel + tier correctly; unmatched heading survives; blank/comment-only input
returns an empty shape without throwing). Full brief tab is the exact pre-existing box (raw MD
verbatim). No backend touched. Green: frontend suite 79/79 (new roleplay-brief 7/7 +
roleplay-section 3/3), tsc clean across the tree, lint clean. Not prod-verified from here
(audit lane holds the browser).

---

## Task #17 — ADD-3.3 IA consolidation (PRE-REVIEW PROPOSAL; Kaan confirmed amendment 3)

Kaan's words: "Interviews, Insights, Company Context all show the same thing." Verified in
code — the duplication is real and specific:
- **Conflicts** render on BOTH Home (`SnapshotView` conflict cards) AND Insights (Conflict
  Points).
- **"Open questions"** is the SAME section title on BOTH Home (`area_to_investigate` cards)
  AND Insights (`admissions`) — two different data kinds wearing one name.
- **Admissions** ALSO already exist in Company Context as `kind=admission` records
  (`KnowledgeBaseView` KIND_LABEL). And Home's **evidence rail** duplicates the Context
  record store.
- **Report** surfaces the same "next-round questions" concept under a THIRD label,
  "Follow up on" (`report.follow_ups`).

### Canonical home per data kind (each fact renders on ONE primary surface; others deep-link)

| Data kind | Canonical home | Deep-links from |
|---|---|---|
| Snapshot story (overview, teams & people) | **Home** | — |
| Attention list — open questions / awaiting approvals + ONE next action | **Home** (Kaan 3.2b) | Insights (was dup) |
| Records / evidence / claims (incl. `admission` kind) | **Company Context** | Home evidence rail → Context; Insights finding evidence → Context |
| Conflicts | **Insights** | Home attention count → Insights |
| Key findings | **Insights** | Home |
| Automation opportunities | **Insights** | Home |
| Workflows / SOPs | **Workflows** (unchanged) | Insights opportunities → Workflows |
| Interview lifecycle (plans, sessions, reports, follow-up) | **Interviews** hub (lane-k) | Home suggested people → Interviews |

**Nav does NOT shrink.** All four surfaces keep a unique job after de-duping: Home = story +
attention, Context = the record store, Insights = findings/conflicts/opportunities, Interviews
= the staged hub. IA consolidation here means *kill duplicate renders + add cross-links*, not
remove a nav item. (Amendment 3 allows a shrink; the data doesn't warrant one.)

### "Open questions" — ONE name for next-round questions everywhere
Same concept, three labels today → unify the LABEL on "Open questions"; keep each surface's
distinct JOB:
- Home: `area_to_investigate` → "Open questions" (already) — canonical workspace-level list.
- Insights: `admissions` "Open questions" section → **removed** (duplicates Home + Context);
  deep-link out.
- Report: "Follow up on" → **"Open questions"** (interview-scoped; compose-into-follow-up-
  interview action kept — that's Report's unique job). The lifecycle STAGE name "Follow-up"
  (`StageRail`) is a pipeline step, NOT a question label — left unchanged.

### Edit plan (isolated commits, A28 per surface — strictly simpler for the user)
- **COMMIT 1 — Insights = findings/conflicts/opportunities ONLY.** `InsightsView`: remove the
  `admissions` "Open questions" Section; add a quiet deep-link ("Open questions live on Home ·
  admitted gaps are browsable in Company Context"). Conflicts stay (canonical). No data-shape
  change. Simpler: Insights stops repeating Home's list.
- **COMMIT 2 — Report label.** `ReportView`: Panel "Follow up on" → "Open questions"; body/CTA
  copy aligned. Behavior identical. Simpler: one vocabulary for next-round questions.
- **Home side (NOT my files — lane-dbg owns via 3.2 Snapshot v2, boundary sent):** keep "Open
  questions" (areas) in the attention list; drop inline Conflicts → attention count linking to
  Insights; demote evidence rail → Company Context.
- Company Context: unchanged (already canonical record store incl. admissions).
- Nav (`AppShell`): unchanged.

### Boundary + open call
- **lane-dbg confirmation: PENDING** (message sent — items 1/2/3 above). I will NOT edit
  `SnapshotView`; the Home-side demotions ride in their Snapshot v2.
- **Flag to lead + Kaan (only genuine content removal):** deleting the Insights admissions
  section. Rec: remove + deep-link (it duplicates Home's Open questions AND Context's admission
  records); do not re-plumb admissions into Home. Reversible — if Kaan wants admissions visible
  on Home, it's a small data-routing follow-up, not a redesign.
