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

### REVISION 1 (post-resume) — Kaan CONFIRMED the Insights FOLD (supersedes "nav does not shrink")
PARK doc now records "Insights fold = CONFIRMED by Kaan (ADD-3.3 building it)." That overrides my
analysis above (which kept Insights because findings/opportunities were unique to it). The tab
FOLDS. New target model:
- **Nav SHRINKS: Insights is removed.** Its content relocates to canonical homes rather than being
  deleted (findings/opportunities are real intelligence — a fold must move, not drop):
  - Conflicts → **Home / Snapshot v2** (perception gaps are attention-worthy; lane-dbg's surface).
  - Key findings (ranked pains) → **Home / Snapshot v2** (synthesis "what we understand").
  - Automation opportunities → **Home** (cite records like findings; recommend Home so Home is THE
    synthesis surface — OPEN: could instead sit on Workflows since they point at workflows; lead call).
  - Admissions / open questions → **Company Context** (records, already there) + Home attention list
    (areas). No re-render on a standalone Insights page.
- **Division of labor (needs lead + lane-dbg bless):**
  - lane-dbg (Snapshot v2) HOSTS conflicts + findings + opportunities as part of their redesign.
  - lane-shell (me) OWNS: remove the Insights nav item from `AppShell.NAV` + `SEG_TO_NAV`; redirect
    the `/w/[slug]/insights` route (→ Home, or a Home#section deep-link) so old links don't 404;
    delete/retire `InsightsView` + `insights/page.tsx` once content has a home. PLUS the Report
    "Follow up on" → "Open questions" rename (independent).
- **SEQUENCING DEPENDENCY (hard):** my nav/route removal must land AFTER lane-dbg's Snapshot v2 hosts
  the content — dropping the tab first strands conflicts/findings/opportunities. So this lane is now
  BLOCKED ON lane-dbg for the content move; I build the nav/route retirement behind them. The Report
  rename is the only independent piece and it collides with lane-k's active Report rewrite (coordinate).
- Nothing to build in isolation right now → proposing the mapping + division to lead, correcting my
  earlier lane-dbg boundary note (fold, not stay), then sequencing my nav/route work behind Snapshot v2.

### REVISION 2 (unblocked) — lead handed me task #16 (Snapshot v2) + blessed the mapping
lane-dbg is spend-capped (Snapshot v2 parked mid-edit on `park/simplify-wip`); lane-k is capped but its
Report rewrite already LANDED (K5 feee0b2) so no collision. Lead made me sole owner of `SnapshotView.tsx`
and approved: opportunities → HOME (deep-link each to its workflow via existing `?highlight=`), conflicts +
findings → Home, admissions/open-questions → Company Context + Home attention. Relocate, never delete.

## Task #16 — ADD-3.2 Snapshot v2 (PRE-REVIEW) + hosts the folded Insights content

**Reader-first, per ADD-3.2 (a story-glance / b needs-attention / c ONE next action / d rest demoted).**
Adopting lane-dbg's parked WIP (`park/simplify-wip:SnapshotView.tsx`) — it already nails a/b/c/d and demotes
the old competing evidence rail to a drill-down drawer. It "may not compile" only because it references an
`EvidenceDrawer` it no longer defines; main HAS a working `EvidenceDrawer` (L556) with a matching signature,
so COMMIT 1 = adopt the WIP + port that `EvidenceDrawer` + add the `surface-dark` token the WIP's tailwind
change needs. Attribution: WIP is lane-dbg's; I finish + extend it.

**Section order (fewer things, bigger hierarchy — the anti-dump):**
1. Header (identity + plain subhead; Export a quiet secondary button)
2. (a) The story so far — glance stats, REAL counts only (records/people/workflows/open questions/gaps)
3. (c) Your next move — ONE prominent recommendation card, up top (was buried at the bottom)
4. (b) Needs your attention — approvals awaiting the gate + open questions (areas), each with an action
5. Perception gaps (conflicts) — first-class, folded from Insights (already in the WIP)
6. **Automation opportunities — FOLDED from Insights (NEW)**; actionable band, each deep-links to its
   workflow (`?highlight=`), honest ROI estimate styling preserved
7. People to interview (roster, demoted)
8. **Key findings / ranked pains — FOLDED from Insights (NEW)**; synthesis, demoted near "learned"
9. What {brand} learned — clean statements, NO per-card trust chip (Kaan's "trust-chip noise" fix);
   trust + evidence one click away in the Sources & evidence drawer
10. Trust Center line
Drill-downs: AreaDrawer (open questions), EvidenceDrawer (sources & evidence).

**Commit plan (A28, one behavior each):**
- COMMIT 1 (#16): adopt+finish the WIP reader-first redesign (compiles, no fold content yet). This IS the
  3.2 presentation change; honesty rules untouchable (append-only render, real counts, trust ladder,
  quarantine) — only presentation moves.
- COMMIT 2 (#17 fold): plumb `get_insights` (key_findings) + `get_automation` into `home/page.tsx`; add the
  Key findings + Automation opportunities sections to Snapshot v2 (port FindingCard + opportunity card from
  InsightsView). This is where Insights content actually MOVES to Home.
- COMMIT 3 (#17 nav): remove Insights from `AppShell.NAV` + `SEG_TO_NAV`; redirect `/w/[slug]/insights` →
  Home; retire `InsightsView` + `insights/page.tsx`. Sequenced AFTER commit 2 (content hosted first).
- COMMIT 4 (#17 naming): Report "Follow up on" → "Open questions" (lane-k's Report already landed; no collision).
Verify each: tsc + lint + full suite; screenshot-verify Home at 1440 + 390 via Playwright (now available)
before the nav retirement. Not prod-deployed from here — seam runner ships.

### VERDICT — ADD-3.3 IA consolidation SHIPPED (code complete, green)
Built the whole owned sequence on main@0d4b52b (lane-dbg's v2 base, never reverted):
- 2fd4881 — Report "Follow up on" → "Open questions" (single vocabulary; compose-follow-up action + StageRail stage name untouched).
- 3b7be95 — FOLD: Key findings + Automation opportunities now render on Home (Snapshot v2), ported verbatim from InsightsView (ROI-as-estimate, role-quarantine, ?highlight= workflow deep-link with from=home + inline-evidence fallback). home/page.tsx fetches get_insights + get_automation (degrade to no section on a hiccup).
- b89114b — RETIRE: Insights out of AppShell NAV + NavKey (BarChart3 removed); SEG_TO_NAV `insights`→`home`; /w/[slug]/insights → server redirect to Home; InsightsView.tsx deleted (457 lines gone). Nav shrinks by one, exactly as Kaan confirmed.
Green: tsc clean, eslint whole-project clean, frontend suite 107/107, `next build` green (/insights now a 166 B redirect stub, Home carries the fold).
OUTSTANDING (handed to audit/re-walk #19): screenshot-verify the assembled Home at 1440 + 390 (fold sections read right, no horizontal overflow, Insights gone from nav, /insights redirects). Not run from here — the audit lane holds the browser; every verify pass must drive the real surface (park lesson). Offering to run the Playwright pass myself if the lead prefers.

### A28 pre-review — wire the two AreaDrawer dead buttons (lead-assigned, ADD-5 bug-detector)
Today: Home's open-question drawer shows two DISABLED "coming in a future build" buttons (Add to
Interview Plan / View full transcript) — dead affordances on Kaan's demo surface. After: "Add to
Interview Plan" becomes a real Link into the K3 assign flow (/interviews/new pre-seeded name+role
from area.who_holds + focus from the area title + its open questions; AssignInterviewFlow already
reads ?name/role/focus, focus now required — ADD-4.1). "View full transcript" is HIDDEN, not wired:
the only session-id destination is ObserverView (an interview observer window, not a clean transcript
view, and these areas are sourced from the CEO context call) — a link there risks a wrong/empty view,
and the verbatim evidence is already reachable via the Sources & evidence drawer + Company Context.
Per the lead's hide-if-not-cleanly-derivable fallback. Simpler or more complex for the user? SIMPLER:
one dead button becomes a real action, the other stops promising a view that has no clean home.
(Taste note for Kaan: "View full transcript" on snapshot areas needs a real context-call transcript
route before it can be honest; hidden until then. Also flagged: the drawer's "Add context (chat)"
button is a no-op that looks live — left for the #20 chat-agent lane, not in this scope.)
Edits the audit-verified AreaDrawer → telling audit-walk directly so their re-drive covers it.

## ═══ NIGHT CLOSE (lane-shell) — July 10 ~02:50 PDT ═══

SHIPPED (git-green: tsc + eslint + frontend suite 109/109; pushed to origin/main):
- P1 voice-transcript freeze: DIAGNOSED (missing VAPI clientMessages allow-list; serverMessages
  fed the DB while the browser SDK got zero transcript events). Handed to seam-1, who shipped it
  (c203bc5 config + re-provision, ce5ec3f server-transcript backstop) and verified via a real
  driven headless call. Emre unblocked. My poll-backfill idea became lane-e's logged follow-up.
- ADD-3.3 IA consolidation (Kaan-confirmed Insights fold), built on lane-dbg's v2 base (0d4b52b):
  · 2fd4881 Report "Follow up on" → "Open questions" (single next-round-questions vocabulary).
  · 3b7be95 fold: Key findings + Automation opportunities relocated onto Home/Snapshot v2
    (ported FindingCard + opportunity card verbatim; ?highlight= deep-link kept, from=home).
  · b89114b retire: Insights out of AppShell NAV/NavKey, /insights → 307 redirect to Home,
    InsightsView.tsx deleted (457 lines). Nav shrinks by one.
  · fd6559b self-caught regression: workflow back-link handled from=home/insights → Home
    (was falling through to "Back to Workflows" + a dead "Back to Insights").
- ADD-5 dead buttons (Kaan's ask), Home AreaDrawer:
  · 51d3692 "Add to Interview Plan" WIRED → /interviews/new pre-seeded (who_holds name/role +
    open-question focus); "View full transcript" REMOVED (no clean context-call transcript route).
  · 155ee50 "Add context (chat)" no-op REMOVED (looked live, did nothing).

OPEN ITEMS / OWNERS:
- **Un-driven surfaces (audit-walk):** ALL my ADD-3.3 + ADD-5 commits are git-green but NOT
  prod-verified — prod was 0fd1f3d, which predates them; they ride the NEXT seam. audit-walk has
  the full commit list (3b7be95/b89114b/2fd4881/fd6559b/51d3692/155ee50) to re-drive post-deploy:
  Home fold sections, no-Insights nav + /insights redirect, workflow round-trip, AreaDrawer live
  Add-to-Plan. Verify as one atomic IA change.
- **Backend job-handler crash sweep (lane-a):** ROUTED with my read-only worklist —
  compiler.py L178 + workflow.py L70 still raise on missing session (teardown-race red herrings);
  copy disclosure.py/roleplay.py's log-and-return guard. (quality.py/snapshot.py to eyeball;
  interview.py raise is a real live-turn error, keep.)
- **Taste notes for Kaan:** (1) "View full transcript" on snapshot areas needs a real context-call
  transcript route before it can be honest (hidden until then). (2) "a bad link is worse than a
  clean removal" — the principle behind hiding rather than mis-wiring.

CLEAN: no uncommitted work of mine; nothing mid-write. Standing down for the night — not resuming.
