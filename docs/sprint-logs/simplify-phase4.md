# SIMPLIFY Phase 4 — anti-over-engineering + verification (task #12, audit-walk)

Two parts: (A) a STATIC anti-over-engineering pass, doable now; (B) prod re-walk of every
changed surface + full suites + delta review, GATED on seam-2 deploy. This log holds A now;
B fills in after seam-2.

## A · Static anti-over-engineering pass (done)

Scope: 72 files, +5783/-959 since pre-sprint (a8a9a98).

**No structural bloat flags:**
- **No new dependencies.** frontend/package.json unchanged — nothing pulled in; new UI
  reuses existing framer-motion/lucide/tailwind tokens.
- **New files are proportionate**, each maps 1:1 to a lane feature: live_capture.py (E),
  interviews/new + AssignInterviewFlow + StageRail (K), WorkspaceDeleteDialog/ReorderList +
  deletion.py (A), SnapshotIntro (B), WorkflowConfidenceChip/WorkflowsList (C), roleplayBrief
  (J), plus one test file each. No speculative abstraction layer, no parallel framework.
- **Largest changes are the genuinely-complex screens**, not gratuitous: PlanView 993
  (K1 relayout of the page Kaan called "messy"), AssignInterviewFlow 681 (K3 — one screen
  replacing a 3-hop create flow, a net simplification for the user even though the component
  is large), WorkflowEditor +335 (C detail rebuild), AppShell +266 (responsive foundation),
  live_capture 180, deletion 158. All map to real, requested scope.

**Watch items for the seam-2 read (not yet flags, just "look closer"):**
- PlanView.tsx at 993 lines is the single biggest surface — worth one focused read at
  seam-2 to confirm the topic-grouping + refine-chat + gate-footer didn't accrete duplicate
  state. (Lane-k active; premature to deep-read in-flight.)
- WorkflowEditor (my lane C): the step cards and the details panel both render
  Tool/Input/Output (card = summary, panel = full detail). Mild duplication, matches the
  image13 spec; noting for the "is this necessary" check — my call is keep (the panel adds
  Trigger/Notes/step-confidence the cards omit).
- Carried from Phase 3: done-page "first version" drift (P1, lane-e file) and the
  next-round-question naming spread (P2) — see simplify-phase3.md.

## B · Verification — DONE at seam-3 (prod c92ba85)

### Full suites — GREEN
- Backend: **238 passed, 1 skipped** (43s, lanes parked, shared container clean).
- Frontend: **100 passed** (18 files). No regressions from the whole sprint.

### Prod re-walk vs the Phase-0 baseline (measured, desktop 1440 + mobile 390)
The point was the delta: are the Phase-0 P0/P1s dead? They are.
- **[P0 → DEAD] No mobile layout.** Was: every /w/* page crushed to a ~154px column with
  108px sideways overflow; plan detail 29,407px tall. Now: measured `docOverflow 0` and
  `main` = full 390px on Home, plan detail, and the Interviews hub; plan detail **29,407 →
  7,695px**. The AppShell drawer (#13) holds — systemic fix confirmed across the sample.
- **[P0 → DEAD] Interviews vs Interview Plans duplication.** Merged into one hub (K): no
  "Plans" nav item, /plans redirects, and the plan detail now carries a
  **Plan → Observe → Report → Follow-up stage rail** (my audit finding #2 resolved).
- **[P0 → DEAD] The "just so messy" plan page / 254px suggested-questions.** Was: a
  254px×1614px suggested-questions ribbon and three inconsistent content widths
  (530/532/254/1088). Now: consistent full-width blocks (1152/1204), topic-grouped
  collapsible "Suggested questions" accordions, a calm two-column mission layout, and a
  bottom action bar. `docOverflow 0`. (screens: DELTA-plan-detail-desktop.png)
- **[P1 → DEAD] Half-width Home with dead right side.** Content now reaches x1414 of 1440
  (was ~730). Full-width snapshot.
- **[P1 → DEAD] Workflow detail horizontal x3350 strip (my lane C).** Now `contentMaxRight
  1414`, no overflow, wrapping grid + the details panel. Workflows list shows the "All" +
  "Operations" chips only (no guessed departments) with descriptions + confidence.
- **[P1 → DEAD] Simulations bloat / jewelry leakage (my #10).** Now scenario-first from Bee
  Goddess's OWN workflows (2 real scenarios with honest derived "what this tests" copy +
  confidence chips), the global cast/proving relocated behind a "How Nexus is tested"
  disclosure. Run mints + navigates to the room; Captured-live correctly suppressed.
  (screens: DELTA-simulations-desktop.png)
- **Naming:** snapshot/insights next-round questions unified to "Open questions" (Report's
  "Follow Up On" left for Kaan's fold).

### What is NOT fully verified / one real gap
- **[P1 GAP — lane-e's half] The simulation room's SIMULATION marker is not visible at the
  consent + pre-call screens.** Clicking Run on prod mints correctly and suppresses
  Captured-live (good), BUT the room's consent landing shows standard employee-interview
  consent copy, and the pre-call screen shows generic "Test call · Back to Voice Settings"
  chrome — NOT the persistent "Simulation · <workflow> — practice run, nothing reaches your
  company records" marker lane-e specified. Either the marker renders only once the call
  connects (then it isn't "persistent" as required) or scenario-run sessions fall through to
  voice-test chrome. I did not drive the call further (no conversation). **Flagged to lane-e**
  — the one trust-surface item to close before Emre's voice test.
  **UPDATE — FIXED IN CODE (lane-e 6199a06), pending prod redeploy re-verify:** lane-e lifted
  the marker to the Shell so it's persistent on the consent + pre-call + done screens, and
  changed the back-chrome to "Exit simulation"; added a regression test (marker present on the
  sim consent screen, absent for a normal interview; frontend 102 green). Needs the redeploy
  to land on prod. I will re-run the bee-goddess-demo scenario walk once it deploys and confirm
  "Simulation · <workflow> — practice run…" shows at consent + pre-call.
  **Consent BODY copy also fixed (lane-e bea9fac):** team-lead ruled it not-optional, so a
  scenario-run consent no longer reads as an employee interview — it states plainly it's a
  practice run against <workflow>, nothing reaches company records, and DROPS all real-person
  promises (attribution, role-only sharing, recording-into-snapshot) since there's no person.
  Consent drift guard green; employee + context consent byte-unchanged. Both fixes
  (marker 6199a06 + copy bea9fac) ride the same redeploy — my re-verify covers both.
- **Coverage honesty:** the walk concentrated on the P0s, the two worst Phase-0 pages, my own
  lanes, and a mobile-overflow sweep (Home/plan/interviews all `docOverflow 0`). Because the
  mobile fix is one shared AppShell component, mobile is confirmed dead across that sample
  rather than page-by-page. Lighter touch on: context/insights/settings/trust, the respondent
  consent variants, the live room E full drive, play-character J, and picker delete/reorder A
  — these passed Phase-0 or their own lane verifies; I did not re-measure each here.

### Verdict — did SIMPLIFY make the product simpler, honestly?
**Yes, substantially.** The four Phase-0 comprehension-blockers are gone: the product is now
usable on mobile (it was completely broken), the interview flow is one hub instead of two
duplicated lists, the "messiest" page is a calm staged layout, and Simulations speaks in the
tenant's own workflows instead of a stranger's jewelry example. No tested capability regressed
(238+100 green). The one honest blemish is the simulation room's missing trust marker (lane-e
to close). Anti-over-engineering: nothing to unwind (§A). This is the "nothing to unwind,
simpler per page" close Kaan asked for — with that single marker gap named, not hidden.

## Lessons (honesty log)
- **A copy/href repoint IS a behavior change — run the component's test file before
  committing, even for "mechanical" fixes.** My 7569c84 changed GeneratePlanButton's href
  /plans → /interviews but did not run generate-plan-button.test.tsx, which still asserted
  the old href and went red at HEAD (lane-dbg landed the one-line test fix). Correction
  applied immediately: the greenlit naming unification (f3c6dd0) was linted + its nearest
  test run and grep-checked for asserted strings BEFORE commit. Standing habit for this lane:
  grep src/test for the old value and run the touching test file before any string/route change.

---

# REFINE ROUND (task #19, ADDENDUM 3.4 — absorbs ADD-5 bug-detector lane)

**Method correction (owned):** my seam-3 walk was measurement-based and did NOT drive live
calls — so it could not catch Kaan's P1 transcript freeze (roleplay 5716e93e: 29 utterances
in DB, screen stuck on opener). This round DRIVES the real flows. GATED on mini-seam-4
(carries the transcript fix + sim marker 6199a06 + sim consent bea9fac); team-lead signals live.

**Driven-verification checklist — every FEEDBACK.md item, verified by DOING it on prod:**
- **A · Company mgmt:** drag-reorder the picker (order persists on reload); open the
  Delete-company dialog — exact counts + type-to-confirm render. DO NOT confirm on a real
  tenant; disposable tenant + teardown, coordinate the destructive click with team-lead.
  Checkbox interaction preserved.
- **B · Post-call snapshot intro:** seed context (paste/upload) → lands on the intro, Home
  tab active, ONE primary "View company snapshot". (Snapshot v2 itself = lane #16.)
- **C · Workflows (my lane):** click each dept chip → list filters; open a workflow → expand
  sections; confidence + descriptions correct. (Structurally verified seam-3; now DRIVE it.)
- **D · CEO welcome:** create a context call → welcome reads leadership (not employee), one
  "Begin context call". Drive to the room.
- **E · Live room + Captured-live (THE freeze class):** DRIVE a voice call AND a text call —
  confirm live turns RENDER (not frozen on opener), Captured-live panel updates with
  confirmation checkmarks, agent state (Listening/Thinking/Saving) shows, text-mode toggle
  works. This is the item my last walk missed; highest priority.
- **F · Connection stability:** reconnecting state + transcript preserved + recovery confirm
  (force a network blip in-browser if feasible; else inspect the machinery live).
- **G · Call-completed:** first call → primary "View company snapshot"; later call → back to
  snapshot; secondary "Return home". Drive a call to completion on a disposable tenant.
- **I · Simulations (my lane):** run a scenario → room opens with the SIMULATION marker +
  practice-run consent (verify 6199a06 + bea9fac landed) + suppressed captures.
- **J · Play-this-character:** overview card first (role/goals/context/behaviors), raw MD
  demoted to a secondary tab.
- **K · Interview hub:** Plan→Observe→Report→Follow-up as connected stages; Observe view
  transcript connected + topic coverage legible + minimal scroll; Report CEO-navigable;
  Follow-up sensible; New-interview flow + plan-chat live-updates the draft; suggested-
  questions spacing correct at 1440 AND 390.
- **Regression classes (c):** merged bubbles, scroll discipline, observer polling, report
  links, export, delete dialogs — the transcript freeze is the proven class; check each still
  works post-rewrite.
- **Click-every-button pass** at 1440 + 390 including the mutate/navigate buttons skipped
  last time (Add to plan, Open workflow editor, Add insight, Export report, Hear it live,
  Send/Approve) — on disposable tenants with teardown; destructive clicks coordinated with
  team-lead.
- **(d) Beyond the doc:** propose-and-fix genuine improvements, A28 gating each (simpler-or-stop).

Findings + fixes will be logged below this checklist as I drive each, once mini-seam-4 is live.
