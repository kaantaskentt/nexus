# Lane DBG log — CEO copy + intro + done page (tasks #6, #4)

A28 pre-reviews + audit verdicts for this lane. Moved here from docs/SPRINT-STATE.md per the
team-lead rule change (July 10): SPRINT-STATE.md is a concurrent-write hotspot; the lead
merges lane logs at Phase 4. The original four-commit block (COMMIT 1-4 pre-reviews +
verdicts) already lives under "Lane DBG" in SPRINT-STATE.md (0123f83, 0584b7d, 1f76fce,
032da86) and is static now. New entries land here.

---

## AMENDMENT — D copy promise line (lead-approved, July 10)

Today: the context welcome + done page promised "You will see the snapshot before anyone on
your team is interviewed." After: replaced with "The snapshot is yours to review first, and
no one on your team is contacted without your explicit approval." (done page: "no one on your
team is contacted without your approval"). Reason (lead): the system enforces the approval
gate (Non-negotiable 3), NOT a snapshot-viewing order — a founder could approve and send a
plan without opening the snapshot, so the original promised a sequence we do not guarantee.
The replacement is exactly what the gate guarantees. Attribution line kept verbatim (still
flagged to Kaan+Emre). consent-landing.md updated in lockstep. Drift guard 18 lines in sync,
em-dash lint clean, consent-copy + done-page leak tests green (role-only promise still absent
from the context branch). Simpler/more complex for the user? SAME shape, TRUER promise.
VERDICT: approved, landed.

## FOLLOW-UP — Settings voice-opener preview label (audit amendment 4)

Today: Settings' "Opening line" preview shows the employee interview opener greyed out with
no label saying so — a viewer could read it as the opener for every call, including the BETA
context call (which uses the collector's own opening line). After: one clarifying line under
the field — "This is the employee interview opener ... The BETA context call with a founder
uses its own opening line, not this one." No behavior change; the previewed opener STAYS the
employee one, it is just labeled. voice-settings suite 7/7. Simpler? SIMPLER: removes a
"which opener is this?" ambiguity. VERDICT: approved, landed.
(tsc project-wide currently red on WorkflowEditor.tsx — lane-C uncommitted WIP, not this
lane; my commit is path-scoped and excludes it.)

## FOLLOW-UP — snapshot_exists boolean + later-call done wording (lead-approved)

Today: the context done page always said "View company snapshot"; Kaan's G spec distinguishes
first vs later calls but the payload only carried the slug, so there was no signal. After: the
by-token payload carries a context-kind-only `snapshot_exists` boolean (exists(snapshot_cards
for the ws)) — no counts/names/config, gated exactly like the slug. Done page: first call
(no snapshot yet) → "View company snapshot"; later call (snapshot exists) → "See what's new in
your snapshot", SAME destination /w/[slug]/home. Test-pinned: context payload carries
snapshot_exists (false on a fresh ws), and an interview-kind by-token payload carries NONE of
context_call/workspace_slug/snapshot_exists (employee learns no workspace state). Frontend
done-page 3/3, backend context_call 6/6, my files tsc-clean. Simpler? SIMPLER: the label now
tells the founder what they'll find. VERDICT: approved, landed.

## PRE-REVIEW (VETO WINDOW) — SnapshotView category regroup (§6-5, Kaan Feedback B)

Kaan: "the snapshot UI feels cluttered and needs to be reorganized." This is the two-line
pre-review; it lands as its own commit FIRST so Kaan can veto on GitHub before the build.

Today (SnapshotView.tsx): a flat run of differently-named sections — "What Nexus Learned",
"Areas to Investigate", "Conflict Points", "Suggested People to Interview" — each its own
heading, no shared vocabulary with the new SnapshotIntro. After: the SAME sections regrouped
under the intro's category vocabulary so intro and snapshot speak one language, in one order:
**Overview** (learned) → **Teams & People** (suggested_person) → **Perception gaps**
(conflict_point, only when >0; glossary term for conflicts) → **Open questions**
(area_to_investigate; plan §3 maps areas → open questions). REGROUP, NOT REWRITE: identical
card components (learned grid, PersonRow list + GeneratePlanButton, conflict cards, area cards
+ AreaDrawer), every card_type preserved, append-only render untouched, trust/confidence
badges untouched, Evidence rail + Next-Recommended-Action CTA + Trust-Center link + header +
ExportReportButton all unchanged, page width kept (max-w-6xl, per amendment 4). Systems /
Workflows / Priorities from the §4-B list are NOT rendered: no snapshot card_type backs them,
so an honest regroup omits them (Systems has no data; Workflows live on their own page and the
intro already routes there; Priorities has no distinct card_type — the pain-ranked areas ARE
the actionable set, surfaced as Open questions + the Next-action CTA). Nothing dropped.
Simpler or more complex for the user? SIMPLER: one consistent vocabulary intro↔snapshot, a
sensible order, no renamed/duplicated concepts. VETO TARGETS for Kaan: the four section names
(esp. areas as "Open questions" vs "Priorities") and the deliberate non-render of
Systems/Workflows (adding Workflows here would be a separate rewrite with a new data fetch).

VERDICT (behavior commit landed after the pre-review commit e9ce311): SnapshotView regrouped
to Overview → Teams & People → Perception gaps (>0 only) → Open questions, one contiguous
swap (People up, Areas down) + four title renames, zero component/card_type/badge/render
changes. `brand` import still used (AreaDrawer). No test pinned the old titles. My files
tsc-clean (project tsc red only on lane-C WorkflowEditor), eslint clean on SnapshotView,
frontend 87/87. Page width unchanged (max-w-6xl). Open for Kaan's veto on the four names.

## PRE-REVIEW — K4 Observe view (task split from lane-K; Kaan Feedback K)

Today (ObserverView.tsx, 465 lines): a 2-col page — left is a tall dark orb box (voice, ~220px)
stacked over a 46vh transcript scroll box; right rail is a "Topics covered" CoverageRing +
"Insights" note list. Kaan: "cluttered, too much scrolling, topic coverage difficult to
understand, transcript feels disconnected." Audit P1/P2: the "Insights" rail name collides with
the nav tab; the coverage ring is opaque; the off-state reads as three negative sentences.
After (one behavior commit): (1) lane-K's StageRail at the very top (current=Observe, Report
linked when the interview is completed) so Observe sits in the staged flow; (2) rename the rail
"Insights" → "Live notes" (+ "Add insight" → "Add note") — kills the nav collision; (3) topic
coverage becomes a legible horizontal chip strip with a plain-language state per topic
(Covered / Partly / Not yet from the real map; Planned when tracking is off), a one-line honest
header, and NOTHING when there are no objectives (no negative-sentence pile) — the opaque ring
is retired; (4) transcript + Live notes join into ONE bordered "room" surface (two
internally-scrolling columns divided by a hairline) instead of two stacked pages, and the big
dark orb box shrinks to a slim voice-presence strip — bounding page scroll. A18/A19 honesty
holds: badges still derive only from confidenceForTag (live note = Reported, compiled = real
tag, untagged = no badge), orb reflects only real polled signal, coverage shows only real
states. Data/poll logic unchanged; ObserverView gains an optional `slug` prop for the Report
deep link (tests call without it — stays valid). Report-style width kept (max-w-6xl). Suites:
observer-badges stays green on the honesty cases; its ring-specific case is updated to assert
the new per-topic legible states (guarantee preserved, not weakened — the ring is deliberately
removed per the assignment). Simpler? SIMPLER: one connected surface, coverage readable at a
glance, no name collision, far less scroll.

VERDICT (behavior commit): ObserverView rebuilt — StageRail at top (Report linked when
completed), "Insights"→"Live notes" (+ "Add note"), TopicCoverage legible chip strip replaces
the ring (honest per-topic states; nothing when no objectives), transcript + Live notes joined
into one bordered room with a slim voice-presence strip. `slug` prop added (optional; page
passes params.slug). observer-badges 5/5 (badge-honesty cases untouched; the ring case updated
to assert the new per-topic states — guarantee preserved, not weakened). My files tsc-clean,
eslint clean on ObserverView + the page. NOTE (not mine): src/test/generate-plan-button.test
is RED at HEAD — commit 7569c84 (Phase 3 /plans→/interviews repoint) changed the button href
to /w/[slug]/interviews but left the test asserting /w/acme/plans. Different lane/file; flagged
to lead, excluded from this scoped commit. (Later fixed in 10bc8ad after the lead handed it to me.)

## PRE-REVIEW — K4 follow-up: admin Captured-live panel in the Observer (lane-E hand-off)

Today: an admin watching a LIVE interview sees the transcript + their own Live notes, but not
what Nexus is structurally capturing turn-by-turn (that panel only existed on the respondent
side). lane-E shipped the pieces (GET /{session_id}/live-captures admin endpoint,
CapturedLivePanel variant="admin" with ladder-mapped badges, and the useLiveCaptures polling
hook). After (one scoped commit, ObserverView.tsx only): while the interview is LIVE (status
active), the admin Captured-live panel renders at the TOP of the Live notes column — Nexus's
real-time structural captures (teams/systems/workflows/decision-rules/goals/open-questions)
above the admin's own notes, sharing the column height (panel h-[24vh], notes list shrinks to
max-h-[30vh] so the two never overrun the transcript). Polled only while live (enabled=active,
mirroring lane-E's LiveRoom); once the call ends the panel drops away and the durable record is
the compiled claims already listed below. A18/A19 holds: admin variant caps a live single
source at Reported (badge from the endpoint, not assigned here); respondent surfaces are
untouched. No backend change; no change to the coverage strip, StageRail, transcript, or the
notes/claims logic. Suites: observer-badges +2 (panel shows while live with the Reported badge;
hidden once completed) and the hook is mocked so renders stay deterministic + offline. Simpler
for the user? RICHER, not more complex: the admin sees exactly what is being saved as it is
saved, in the column where their own notes already live — one glance, no new surface.

VERDICT (behavior commit): CapturedLivePanel variant="admin" wired into the Live notes column,
live-only, height-shared with the notes; useLiveCaptures(enabled=active) via
getLiveCapturesForSession; InsightRail gains a listMaxHClass prop to shrink when the panel
shares the column. Frontend 95/95 (+2 new), my files tsc-clean, eslint clean. No respondent-side
or backend change. Open for review.

## PRE-REVIEW (VETO WINDOW) — ADDENDUM 3.2: Company Snapshot v2, reader-first

Kaan (live testing): the snapshot "still reads as a records dump" — three near-equal sections,
trust-chip noise on every card, an evidence rail competing with the main column, next-action
buried at the bottom. This pre-review lands FIRST as its own commit (Kaan's GitHub veto window);
the build follows. Presentation only: append-only render, real counts, trust ladder, and
sentiment quarantine are UNTOUCHED — no data, tag, or ordering logic changes.

New reader-first order (single column, big hierarchy, plain-language headers), top → bottom:
1. HEADER — company identity (name · founder · source); Export report demoted to a small
   secondary button. Plain subhead: "What {Nexus} understands about {company} so far."
2. THE STORY SO FAR (a) — a one-glance real-count strip (records · people · workflows · open
   questions · perception gaps; only counts that are real/>0). No invented narrative sentence.
3. YOUR NEXT MOVE (c) — the single recommended action, moved from the bottom to here and made
   the one prominent accent card (investigate the top open questions; start with the first
   suggested person) → primary "View interview plans".
4. NEEDS YOUR ATTENTION (b) — Open questions (area_to_investigate, pain-ranked, each a row that
   opens the existing AreaDrawer for full detail + evidence + trust) + an "awaiting your
   approval" line when any plan sits at NEXUS_CHECK (from personPlans), each with an obvious
   action. This is the only place that competes for the eye after the next move.
5. PERCEPTION GAPS — kept (leadership belief vs floor, report-only) but compact; low count, high
   signal, so it keeps a single confidence badge.
6. PEOPLE TO INTERVIEW (d, demoted) — the suggested_person roster with its real per-person
   action (Generate plan / plan-state chip → review), below the urgent items.
7. WHAT NEXUS LEARNED (d, demoted) — the learned statements as a clean list with NO per-card
   trust chip (the noise Kaan named). Trust + evidence stay reachable via ONE "Sources &
   evidence" drill-down that opens a drawer of the CEO-call quotes (the old right-rail content,
   now on demand, reusing EvidenceQuoteCard) — evidence demoted behind drill-down, not deleted.
8. Trust Center link — kept, quiet.
REMOVED as competing chrome: the right-side Evidence rail column (content relocated to the
drill-down) and the per-learned-card ConfidenceBadge (trust reachable on drill-down; the tag
still governs the data). AreaDrawer unchanged (still shows per-question evidence + trust).
Honesty preserved: real counts only, trust ladder still maps every badge shown, quarantine
untouched, append-only render order kept within each section. Report-style single-column width.
VETO TARGETS for Kaan: (1) the section order + which items count as "attention"; (2) demoting
the evidence rail to a drill-down; (3) dropping the per-card trust chip on the learned cards
(kept on perception gaps). Suites + tsc + lint before the behavior commit; rides the next seam.

VERDICT (behavior commit 0d4b52b, after pre-review 9886182): SnapshotView rebuilt to the
reader-first single column exactly as the pre-review; new EvidenceDrawer holds the demoted
CEO-call quotes; learned cards lost their per-card badge (trust on drill-down); new
workflowCount prop (page passes workflows.length) feeds one real glance stat. Presentation
only — no data/tag/order/quarantine change. Frontend 106/106, tsc + eslint clean.
INCIDENT: SnapshotView.tsx was clobbered mid-edit in the shared tree (my restructure reverted
to the committed regroup state while writing; only the orphan EvidenceDrawer helper survived).
Re-applied under an announced hands-off and committed immediately to close the window. Lesson:
on a hot shared file, announce exclusive edit + commit fast; the small window is the risk.
OPEN (lane-shell fold, pending lead's mapping): Kaan confirmed the Insights FOLD, so Home may
need to also HOST Automation opportunities + Key findings (not just Conflicts, which v2 already
keeps). That is a scope expansion beyond this 3.2 commit — lands as a follow-up once the lead
blesses the Home-vs-Workflows mapping; I own the SnapshotView rendering, lane-shell hands me
the extracted section components.

## ADD-4 intake agent (task #18, adopted from lane-k after their commit 1/4). A28 isolated.

Design is lane-k's (docs/sprint-logs/simplify-lane-k.md): STRONG seat (migration 0025 seeds
`intake_interviewer`), storage quarantine at the DATA layer (store_context → standard compiler
at CLAIMED), plan edits reuse the K3 refine `_apply_change` primitive, non-negotiable 2 holds.
- COMMIT 2 (endpoint) LANDED: `POST /api/plans/{id}/intake` (routers/plans.py). One intake turn
  on a DRAFT plan; records-digest + plan-skeleton in the prompt context; reuses refine's
  `_apply_change` targets (suggested_questions/handling_notes/never_list) + the `_has_attribution`
  structural guard on never_list; a `store_context` fact is compiled via the STANDARD add-context
  path (context session + `compile_session` at `max_tag=CLAIMED`) so quarantine is data-layer;
  `plan_only` stores nothing; the storage decision returns as an honest chip. change_log gets an
  `actor:"intake"` entry (never silent). Gate untouched. Tests: test_intake.py 4/4; refine +
  plan_generate still 12/12 (no regression). Migration 0025 applies at the seam, not by me.
  Remaining: (3) UI intake phase on /interviews/new reusing K3 applied-changes, (4) required
  role+focus + role suggestions, (5) evals (asks-not-tells; storage-decision honest).
- COMMIT 3 (required fields) LANDED (ADDENDUM 4.1): AssignInterviewFlow CollectStep now REQUIRES
  name + role + focus (was name-only); the Draft button gates on all three and an inline error
  names what's missing. Role field gains a datalist of known roles (distinct interviewee_role
  from existing plans, passed from the server page) but stays free-text. Copy updated: "tell
  Nexus who, their role, and what this should find out" + a helper noting the intake follow-ups
  come next. tsc clean, frontend 107/107. Remaining: (UI intake phase) + (evals).
