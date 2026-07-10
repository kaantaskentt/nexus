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
to lead, excluded from this scoped commit.
