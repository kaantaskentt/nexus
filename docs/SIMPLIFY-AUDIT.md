# SIMPLIFY — Phase 0 Prod Audit (July 9/10)

Audit-only walk of prod https://nexus-v2-alpha.vercel.app at desktop (1440x900) and
mobile (390x844) CSS widths. Tenant: **bee-goddess-demo** (primary, has content), plus
picker and thin tenants. No code changed; no destructive/call actions taken.

**Method note (for whoever re-runs this):** the persistent Playwright Chrome profile
carries a 50% page zoom on this origin (`window.devicePixelRatio` 0.5). Setting the
Playwright viewport to HALF the target (resize 720x450 → true 1440x900 CSS; resize
195x422 → 390x844 CSS) yields the correct CSS viewport. Screenshots cap at the physical
window backing store (~720px wide) but stay legible. All spacing findings below are
backed by JS pixel measurement (`getBoundingClientRect`, `scrollWidth` vs `clientWidth`,
computed font-size) run in-page — zoom-immune and exact.

Severity: **P0** blocks comprehension · **P1** friction · **P2** polish.
Two extra lenses folded in per Kaan's 11:00 addendum: **[DEAD-BTN]** interactive
elements that do nothing, **[BACK-FLOW]** deep views with no easy return to where you were.

Screenshots: `docs/audit-screens/simplify-jul9/`.

---

## TOP 10 FINDINGS (read this first)

1. **[P0] No mobile layout exists.** The desktop sidebar never collapses; at 390px it stays
   beside content, crushing every `/w/*` page to a ~154px column with sideways overflow
   (plan detail becomes 29,407px tall). Systemic. → new shared foundation task #13.
2. **[P0] Interviews and Interview Plans are two separate pages** listing the same people
   with overlapping status pills and report links. The core Feedback-K knot. `/plans` is
   central but has no nav item.
3. **[P0] "Suggested Questions" disaster (measured):** 254px-wide column holding 12 full
   sentences, 1614px tall, on a plan-detail page that mixes three content widths
   (Mission ~530 / Refine 532 / Suggested 254 / check-flagged full 1088). Kaan's "just so
   messy" page, quantified.
4. **[P0] Same claim data is surfaced on FOUR tabs with inconsistent names.** Home snapshot
   / Company Context / Insights / Report all re-render the same records; three different
   labels for next-round questions ("Areas to Investigate" / "Open Questions" / "Follow Up
   On"). Insights adds little over Home + Report.
5. **[P1] Half-width layouts with huge dead right side.** Home snapshot and Interviews list
   jam content into the left ~625–730px of a 1440 viewport; the right half is empty.
   (Report, Context, Insights, Trust do use the width — the pattern is inconsistent.)
6. **[P1] Workflow detail is a horizontal-scroll strip** overflowing to x3350 (only ~4 of 9
   steps visible), with two competing scroll mechanisms, no owners, and decisions rendered
   as ordinary steps. No department chips on the list (Feedback-C).
7. **[P1] Simulations is bloated and off-tenant:** the 5-character cast is listed twice on
   one page, the characters are generic (not Bee Goddess), and Nexus's internal proving-
   rounds QA log + a giant inline debrief are exposed to the client. (Feedback-I.)
8. **[P1] "Insights" means two different things** — a top-level nav tab AND the compiled-
   claims sidebar inside the Observe view. Naming collision.
9. **[P1] CEO/leadership audience mismatch:** the only opening-line copy (Settings) is the
   employee opener ("your answers get combined with everyone else's") — wrong for a founder
   context call. (Feedback-D.)
10. **[P1] Nav is 7 items with overlaps + hidden-but-central pages.** Home vs Company
    Context (snapshot vs records), Insights overlaps both; meanwhile `/plans` (central) is
    reachable only via a subhead link. Consolidation + clearer IA needed.

Dead-button pass so far: "Show/Hide N hidden" (workflow) ✓ works; "Save voice" (settings)
✓ enables on change; several buttons render disabled-at-rest and *look* dead but are
state-gated ("Build the snapshot", "Send refine instruction", "Generate Follow-Up
Template"). Not-yet-verified (avoided because they mutate/navigate/start sessions):
"Add to plan", "Open workflow editor", "Add insight", "Play this character", "Export the
Company Report", "Hear it live". Recommend the build lane click-tests these.

---

## Cross-cutting (applies to every /w/* page)

- **P0 — THERE IS NO MOBILE LAYOUT. The desktop sidebar never collapses.** At 390px the
  left sidebar (Nexus, workspace switcher, 7 nav links, Admin, Sign out, Trust Center)
  stays in a flex ROW beside the content, taking ~236px and crushing the actual page into
  a **~154px column** on the right. Measured on the plan detail: `main` clientWidth 154px,
  document scrollWidth 498 vs 390 viewport → **108px horizontal overflow (page scrolls
  sideways)**, and the page becomes **29,407px tall** because everything wraps inside
  154px. This is systemic — confirmed on plan detail (screens 07), same flex structure on
  every `/w/*` page. Nothing on mobile is usable until this is fixed; it dwarfs every other
  mobile finding below. Needs a real breakpoint: collapse the sidebar to a hamburger/bottom
  bar and give content the full width.
- **P1 — 7 top-level nav items** (Home, Interviews, Workflows, Company Context, Insights,
  Simulations, Settings). Candidates for consolidation flagged per-page below
  (Home=snapshot vs Company Context=records overlap; Insights vs snapshot overlap).

---

## 1. Workspace picker  (`/`)  — screens 01

**Desktop:** Clean. Hero card (most-recent prepared workspace = Marmara Hotel) + "Other
workspaces" list + "Add company". No horizontal overflow, min font 12px. Good.
- **P2 — [BACK-FLOW]/nav:** picker has a "Sign out" in the top bar but no other chrome;
  fine.
- **P2 — Feedback-A gap:** no per-row reorder handle and no per-company delete affordance
  (both are Phase-2A asks; noting the current absence as the baseline).
- **P2 — checkbox on hero card** (the `MH` card shows a checkmark + node glyph cluster
  top-right) reads as decorative; unclear it's interactive. Verify in 2A design.

## 2. Home = Company Snapshot  (`/w/<slug>/home`)  — screens 02 (desktop), 03 (mobile)

**Desktop (1440):**
- **P1 — Massive dead whitespace / half-width layout.** Main content column + "Evidence"
  rail together occupy only the left ~730px of the 1440 viewport; the entire right half is
  empty. The snapshot looks cramped into the left side of a wide screen. `main` content
  height 1415px but visually unbalanced. Biggest desktop offender on this page.
- **P1 — Home vs Company Context naming/duplication.** This page is titled "Company
  Snapshot" but the nav item is "Home"; a separate nav item "Company Context" holds the
  underlying records. Evidence quotes here each link "See it in Company Context". Two names
  for one concept (Home / Snapshot) plus a sibling tab that is the same data one layer
  down — a comprehension tax. (Feeds Phase-1 rename/combine decision.)
- **P1 — "Suggested People to Interview" duplicated.** Burak + Selin cards with status
  pills (Draft / Awaiting approval) and deep links to `/plans/<id>` appear here AND are the
  core of the Interviews tab — same data, two places, two entry points.
- **P2 — "Add a call transcript"** card floats alone far below the fold after a large gap,
  disconnected from the snapshot it feeds.
- **P2 — [DEAD-BTN candidate]** "Export the Company Report" — to verify clickable.

**Mobile (390):**
- **P1 — Single narrow column, ~5900px tall.** Everything stacks into one column. Card
  body text (Areas to Investigate paragraphs) wraps into very tall, thin blocks; the two
  "What Nexus Learned" cards and Evidence quotes each become long ribbons. Heavy scrolling
  to traverse one snapshot.
- **P1 — Nav chrome stacked on top** (see cross-cutting). Opens with the whole sidebar.

## 3. Interviews  (`/w/<slug>/interviews`)  — screens 04

**Desktop:**
- **P0 — Interviews vs Interview Plans are two separate pages listing the same people.**
  `/interviews` lists interview *runs* (Ece, Burak, two "Interviewee" placeholders) with
  Observe / View report / Delete. `/plans` ("Interview Plans") lists interview *plans* for
  the same people (Burak, Selin, Ece) with mission text + Draft/Awaiting-approval/Sent
  pills + View report. A user cannot tell where "an interview" lives. This is the core
  Feedback-K knot: Plan and the run should be stages of ONE thing, not two sibling lists.
- **P1 — Two entry points to create.** "New interview" button → `/plans?new=1`; a separate
  "Interview plans →" text link in the subhead → `/plans`. Both land on the plans surface;
  the button is labelled "interview" but creates a "plan".
- **P1 — Same left-half layout / dead right.** List card sits in left ~625px of 1440;
  right ~800px empty.
- **P2 — Placeholder rows read as broken.** Two rows named literally "Interviewee"
  (voice), no real person, "No report yet" — look like unfinished/dead data next to real
  named rows.
- **P2 — [BACK-FLOW]** "7 expired invitations hidden. Show them." is the only disclosure;
  fine, but Observe/report links leave with no in-page "back to interviews".

## 4. Interview Plans list  (`/w/<slug>/plans`)  — screens 05

**Desktop:**
- **P1 — Duplicates the Interviews tab** (see 3, P0). Also breadcrumb reads Bee Goddess /
  Interviews / Plans (nested), yet it's reached from a subhead link, not a tab — no nav
  item points here, so it's a hidden-but-central page.
- **P1 — "View report" links point to the SAME report id** for different plan rows
  (both Burak plans link `report/4e1a7610…`). Confusing many-plans-to-one-report mapping.
- **P2 — "Completed interviews without a plan"** (Ece) is a second sub-list on the same
  page — a third way the same interview appears (Home, Interviews, here).
- **P2 — Statuses differ between tabs:** here Selin = "Awaiting approval"/"Sent"/"Draft";
  on Home Selin = "Awaiting approval". Multiple status vocabularies for one pipeline.

## 5. Interview Plan detail  (`/w/<slug>/plans/<id>`)  — screens 06  ← Kaan's "just so messy"

**Desktop — measured, this is the worst page in the product:**
- **P0 — "Suggested Questions" disaster (Feedback-K names it).** Measured **254px wide
  column holding 12 long questions, 1614px tall** (top 579 → bottom 2193). Each question is
  a full sentence rammed into a ~254px ribbon. Unreadable, endless scroll.
- **P0 — Inconsistent column widths on one page.** Top is a two-column band confined to the
  left: Interview Mission (left ~530px) + a right column that itself changes width
  (Refine Plan card 532px, then Suggested Questions only 254px directly beneath it). Then
  "What the check flagged" abruptly spans the **full 1088px**. Three different content
  widths stacked vertically = the "messy" Kaan saw.
- **P1 — Interview Mission is a wall of dense text in a narrow card.** Goal + 4 Known-
  Context bullets + 7 must-hit + 3 nice-to-have topics + 5 Definition-of-Done + 7 Handling-
  Notes, all in ~530px, running 203→2433 (2230px tall). No progressive disclosure; every
  word is expanded at once.
- **P1 — "What the check flagged" is a scary developer-grade block.** Five items tagged
  `credential` / `leading question` / `never collision` / `suppression` with paragraphs of
  policy reasoning + "Suggested fix". Full-width, dense, reads like a linter dump aimed at
  an engineer, not the operator who has to act on it.
- **P1 — Action buttons scattered.** "View report" (top-right, on a *Draft* plan — odd),
  "Send back for check" + "Draft again" (bottom), "Generate Follow-Up Template" [disabled],
  "Send refine instruction" [disabled]. Primary action is unclear.
- **P2 — [BACK-FLOW]** "← All interview plans" top-left is the only return; good, but
  there's no path to Observe/Report/Follow-up as a connected flow (Feedback-K).
- **[DEAD-BTN]** "Send refine instruction" + "Generate Follow-Up Template" both render
  disabled at rest — verify they enable under the right state (refine needs text; follow-up
  likely needs a completed interview). Not dead, but look dead on arrival.

**Mobile (390):** inherits the P0 no-mobile-layout crush (154px column, 108px sideways
overflow, page 29,407px tall). The already-cramped Suggested Questions column becomes a
~90px ribbon. Effectively unreadable.

## 6. Interview Observe view  (`/w/<slug>/interviews/<id>`)  — screens 08

**Desktop:** Better balanced than most — transcript (left ~430px) + right sidebar reaching
~1000px. Right ~440px still empty but far less egregious.
- **P1 — "Insights" name collision.** The right sidebar is titled "Insights" (the compiled
  claims from this interview) — same word as the top-level "Insights" nav tab, which is a
  different thing. Two "Insights" in one product.
- **P1 — Observe vs Report split.** A completed interview has BOTH an Observe view
  (transcript + extracted claims) and a separate Report page. They're reached as two
  parallel links from the Interviews list, not as connected stages. (Feedback-K.)
- **P2 — "Topics covered" empty state reads broken:** "Live coverage tracking is off.
  These are the planned topics. / No objectives on this session." — three negative
  sentences where a covered/not-covered checklist should be.
- **P2 — "Observe"** is an odd verb for reviewing a *completed* interview (you observe
  live; afterwards it's a transcript). Naming to reconsider in the hub.
- **[DEAD-BTN]** "Add insight" — not tested (would create data).

## 7. Post-Interview Report  (`/w/<slug>/report/<id>`)  — screens 09

**Desktop — one of the strongest pages.** Full-width (content 262→1414, only 26px empty
right), clear structure: workflow map (steps as Tool/Input/Action/Output cards with
Partial pills) + Cross-Interview Conflicts + Key Findings + Follow-Up sidebar.
- **P1 — Workflow duplicated with the Workflows tab.** The report renders the "Daily
  Repricing and Online Order Fulfilment" workflow (steps/tools/outputs) and links "Open
  workflow editor" → the Workflows tab shows the same workflow. Acceptable as a cross-link,
  but the same artifact lives in two surfaces.
- **P2 — [BACK-FLOW] good:** "Back to Interviews" present. But no forward link to the
  plan/follow-up that produced it (one-directional).
- **[DEAD-BTN]** "Add to plan" buttons in Follow-Up On, "Open workflow editor" — not
  clicked (mutate/navigate); verify they work in the button pass.

## 8. Workflows list  (`/w/<slug>/workflows`)  — screens 10

**Desktop:** 3 workflows in a vertically-centered ~420px list (last night's density-floor).
- **P1 — No "All" default + department filter chips** (the Feedback-C ask). Flat
  unclassified list; baseline for that build.
- **P1 — Near-duplicate / thin workflows.** "Daily Gold Repricing" (9 steps) and "Daily
  Repricing and Online Order Fulfilment" (3 steps) overlap heavily — two workflows for one
  real morning process. "Weekly Boutique Stock Count Submission" is **1 step** — barely a
  workflow; reads like noise. Nexus's confidence-gated classification (C) should also merge/
  flag these.
- **P2 — Sparse + side margins.** Centered ~420px card leaves ~450px empty each side on
  1440; intentional but reads thin.

## 9. Workflow detail  (`/w/<slug>/workflow/<id>`)  — screens 11

**Desktop:**
- **P1 — Horizontal-scroll canvas overflows the viewport.** 9 step cards laid out in a
  left-to-right strip; measured content extends to **x3350** (viewport 1440) — only ~4
  cards visible, the rest require horizontal scroll. Reading a 9-step workflow means
  scrolling sideways.
- **P1 — Two competing scroll mechanisms.** Each card has its own ‹ › arrows AND the whole
  strip scrolls horizontally — unclear which moves what.
- **P1 — Missing structure Feedback-C asks for.** Cards show Tool/Input/Output + Evidence,
  but **no owners**, and decision points ("If spot sources show meaningful divergence…")
  are rendered as ordinary steps rather than branch/decision nodes. No expandable sections;
  everything is expanded inline.
- **P2 — Actions bar:** "Skill Blueprint", "Generate SOP", "Add manual step", "Show/Hide N
  hidden" (verified working — toggles), per-card "Note"/"Hide". Reasonable but dense.
- **[BACK-FLOW] good:** "Back to Workflows" present.
- **Mobile:** horizontal strip + P0 no-mobile-layout = doubly broken (sideways scroll
  inside a 154px column).

## 10. Company Context  (`/w/<slug>/context`)  — screens 12

**Desktop — solid, full-width** (content 262→1414). 59 records, 3 sources. "Ask the company
context" search/chat at top + "Add something the records are missing"; left facet rail
(Topic 8 values, Trust 3, Person 3, Source many); record cards with trust tag + verbatim
quote. bodyH ~17,957px (long, expected for 59 records).
- **P1 — Part of the 4-surface claim-data overlap** (see Insights below). Home snapshot,
  this page, Insights, and each Report all render the same underlying records with
  different framings.
- **P2 — Duplicate facet vocab:** "Person: Burak 47" vs "Source: Burak 43" — two Burak
  counts (mentioned-in vs authored) with no explanation of the difference.
- **P2 — "Ask the company context"** is a second ask/chat surface (the plan detail has
  "Refine Plan"; the new agentic-chat feature adds a third). Consolidate the chat pattern.

## 11. Insights  (`/w/<slug>/insights`)  — screens 13

**Desktop — full-width, well structured** (stat bar: 3 Interviews / 59 Records / 8
Conflicts / 5 Perception gaps; then Conflict Points ×8, Key Findings ×6, Open Questions ×3).
- **P0 — Heaviest duplication in the product: the same claim data is surfaced on FOUR
  tabs with inconsistent names.**
  - Home snapshot "What Nexus Learned" / "Areas to Investigate" ↔ Insights "Key Findings" /
    "Open Questions" ↔ Report "Key Findings" / "Follow Up On" / "Cross-Interview Conflicts".
  - "59 Records" stat here == "59 records" on Company Context.
  - Insights "Conflict Points" == Report "Cross-Interview Conflicts".
  - Three different names for next-round questions: "Areas to Investigate" (Home) /
    "Open Questions" (Insights) / "Follow Up On" (Report).
  A user cannot tell what Insights offers that Home + Report don't. Strong
  combine/rename candidate for Phase 1 (e.g. Insights folds into the snapshot, or becomes
  the single analytical home and the snapshot stops re-listing findings).
- **P2 — "Perception gaps: 5"** in the stat bar but no "Perception gaps" section rendered
  on the page (only Conflicts/Findings/Open Questions) — a stat with no destination.

## 12. Simulations  (`/w/<slug>/simulations`)  — screens 14  (Feedback-I, build LAST)

**Desktop — full-width but bloated and off-tenant:**
- **P1 — The cast is listed TWICE on one page.** "The cast" section shows 5 characters as
  read-only cards; "Jump in as the employee" immediately below shows the SAME 5 characters
  as cards with "Play this character" buttons. Same content, two grids.
- **P1 — Characters are generic, not from Bee Goddess** (Operations manager at a jewelry
  maker, hotel front-desk, agency AM, bookkeeper, warehouse foreman). The page admits "They
  are not data from Bee Goddess." This is the Feedback-I "jewelry-example leakage / use the
  company's real context" problem verbatim.
- **P1 — Internal proving record exposed to the client.** "Proving rounds" (Round 1/2/3
  with hidden-fact scores, "resumes when testing capacity is topped up") is Nexus's own QA
  log shown inside a tenant. Plus a very long inline debrief (Bookkeeper, 11 turns, H1/H2/H3
  hidden-layer analysis) dumped full-length on the page.
- **P1 — No value statement / what-does-a-simulation-test framing up top** (Feedback-I ask);
  the lede jumps straight into cast.
- **P2 — "Runs in this workspace" = "No simulations run here yet"** sits at the bottom, so
  the tenant-relevant section is empty while the generic/internal content dominates.
- **[Feedback-J] "Play this character"** is the entry to the character experience — not
  clicked (may start a session). J wants an overview card (role/goals/context/behaviors)
  with raw MD demoted to a secondary tab.

## 13. Settings  (`/w/<slug>/settings`)  — screens 15

**Desktop — focused and mostly fine.** Only two things live here: "Interview voice" (voice
picker Female/Male, 6 voices with Play-sample buttons, opening-line textarea) and a "Weekly
pulse" toggle.
- **P2 — [DEAD-BTN] resolved:** "Save voice" renders disabled at rest but **correctly
  enables** the moment a different voice is picked (verified by selecting Orion). Not dead,
  but the disabled-on-arrival look could read as broken.
- **P1 — Employee opener is the only opening-line copy** and it promises "nothing gets
  quoted back with your name on it… your answers get combined with everyone else's." This
  is the wrong audience for a CEO/leadership context call (Feedback-D) — a founder isn't
  "combined with everyone else." The opener/welcome needs a leadership variant.
- **P2 — "Speaking pace" section exists only to say a pace control "isn't part of settings
  yet"** — an empty section advertising a missing feature.

## 14. Trust Center  (`/w/<slug>/trust`)  — screens 16

**Desktop — clean, well-designed narrative page.** Centered ~768px column: promise,
sentiment quarantine, sealed disclosures, interviewer testing, data boundaries, human
approves every contact. Good.
- **P2 — Reached only via the small sidebar footer link** ("Trust Center: how your people's
  words are handled"), not a nav item — intentional (last night's P6 decision). Fine, but
  easy to miss.
- **P2 — Modest right whitespace** (~218px) from the centered column; acceptable.

## 15. Thin/empty tenants + mobile picker  — screens 17 (thin home), 18 (mobile picker)

- **Pre-first-call Home (Aurora Atelier) is a good onboarding state.** "Start with the CEO
  call" + paste/drop transcript, a preview of the three sections it will build (What Nexus
  Learned / Areas to Investigate / People to Interview), "Build the snapshot" (disabled
  until content — state-gated, fine), "Scan the website first". Leadership-appropriate copy
  here. This is the surface Feedback-B/G should hand off *to* a snapshot-intro after the
  call compiles.
- **P1 — Two ways to seed context, not clearly one flow:** paste a transcript here vs run a
  live CEO call in the room. Feedback-B/D/G assume a single "first context call" narrative;
  today the paste path and the call path are separate.
- **P2 — Mobile picker works** (no sidebar → no overflow, bodyH 1245, single column). This
  proves the P0 mobile break is specifically the `/w/*` sidebar AppShell, not global CSS.
- **P2 — Picker container is left-aligned on mobile,** leaving a large empty right margin
  (content ~45% width); should center/full-width at 390.

## Not audited
- **Respondent-facing surfaces (invite / consent / respondent call room)** were NOT
  reachable read-only without a live invite token, and the orders forbid starting a
  call/session. Not walked. Flag for a separate check with a disposable invite on a hidden
  tenant if their layout matters (they likely inherit the same no-mobile-layout P0 if they
  use the AppShell, but respondent pages may use a different shell — worth confirming).
