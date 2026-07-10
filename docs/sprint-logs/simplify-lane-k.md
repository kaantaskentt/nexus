# Lane K log — interview hub Plan/Observe/Report/Follow-up (task #9)

A28 pre-reviews + notes for this lane. The COMMIT 1–4 pre-review two-liners (K1/K2/K3/K5)
already live under "Lane K" in docs/SPRINT-STATE.md (committed before the July 10 rule change
that moved lane logs out of that concurrent-write hotspot) and are static now. New notes land
here. K4 (Observe) was reassigned to lane-dbg and landed as f30c891 / c1773fe — not this lane.

Commits: K1 007c263 (plan relayout) · K2 70e9816 (StageRail + hub merge) · K3 5dd6845 (assign
flow) · K5 feee0b2 (report findings-first + follow-up composer).

---

## Found-and-fixed (flag for the record): dropped voice/text modality on send
`plans.py send_interview` hard-coded `modality='text'` and dropped the caller's choice, so the
voice/text toggle that already existed in SendInterviewFlow was decorative — every sent
interview was text even when voice was picked. Voice is supported end-to-end (the respondent
`InterviewClient` reads `session.modality`; `VoiceCall` works), so K3 wires the chosen modality
through send. This was a real latent bug surfaced while building the honest assign-flow
structure, not a new feature. Backend redeploy noted for deploy seam 2 (no migration — the
delivery intent persists in `mission.delivery` jsonb).

## Deviation: K5 and K6 landed as ONE commit (feee0b2), not two
The lead asked for K5 (report restyle + StageRail + findings-first) and K6 (Add-to-plan
composes a DRAFT follow-up plan) as separate commits. I bundled them in feee0b2 because the
follow-up composer physically replaced the dead "Add to plan" buttons inside the same
"Follow up on" panel of the same view — splitting them would have meant committing the report
with the old dead buttons still present, then immediately rewriting that panel. Defensible as
one coherent surface change, but logging the deviation as requested; Phase 4 reads the logs.
The dead "Generate Follow-Up Template" button referenced in the K6 brief had already died in K1
(it lived in PlanView, removed during the plan relayout), so nothing dead remained to kill in
K5/K6.

## Already-done: ?new=1 redirect target (lead's small-fix crossed with K3)
The lead flagged that `/plans?new=1` should redirect straight to `/interviews/new` (the new
canonical create route). K3 already did exactly this — `plans/page.tsx` redirects the `new=1`
case to `/interviews/new` and the bare case to `/interviews`. Confirmed at HEAD; no extra
commit needed.

## Verify state at HEAD
tsc clean on the interview/plan/report surface (PlanView, InterviewsView, StageRail,
AssignInterviewFlow, ReportView, ObserverView); observer-badges 5/5, badge-mapping,
generate-plan-button green (32 tests). Browser screenshot verification at 1440/390 folds into
the lead's seam-2 walk + Phase 4 (no local stack up this lane; audit lane holds the browser).

## A28 pre-review — seam-2 fixup (StageRail 390px overflow)
Today: seam-2's walk measured StageRail forcing the page body wider than 390px on plan detail
(409px, +19) and report (417px, +27). Cause: the rail's four circles + full-word labels
(Plan/Observe/Report/Follow-up) have a min-content width > the phone's content box, and nothing
clipped it. After: StageRail wraps its `<nav>` in a `min-w-0 overflow-x-auto` div — a
block-level scroll container that can never push the page body sideways regardless of content
(residual width scrolls the rail, not the page) — and shrinks below sm (circles h-5, labels
text-xs, tighter gaps/connectors, whitespace-nowrap) so on a phone the four stages just fit
without needing to scroll at all. Report also drops `px-8` → `px-6 sm:px-8` (16px more mobile
width, matching plan + hub) and its workflow-step `<section>` gains `min-w-0` as belt-and-
suspenders for the existing StepRail overflow-x-auto (the 15.5rem WorkflowStepCard carousel).
jsdom class test added (src/test/stage-rail.test.tsx): pins the overflow-x-auto/min-w-0 wrapper
+ that earlier stages render as real links. Simpler/more complex for the user? SIMPLER: the
page stops scrolling sideways on a phone; desktop unchanged (sm+ classes match the old sizes).
Green: tsc + eslint clean on touched files; stage-rail 2/2, observer-badges 7/7,
generate-plan-button green. Rides the seam-3 fixup deploy.

## ADD-4 — new-interview intake agent (task #18, SIMPLIFY ADDENDUM 4)
A short intake conversation on /interviews/new before the plan is finalized: 2-3 sharp
follow-ups one at a time (records/plan/coverage aware), answers shape the plan, and each
company fact gets an explicit plan-only-vs-store-as-context decision shown as a chip.

Isolated commits: (1) intake prompt + strong seat (this) · (2) intake endpoint · (3) required
role+focus + role suggestions + UI intake phase · (4) evals.

Design decisions worth pinning:
- STRONG seat (non-negotiable #7): `intake_interviewer` = claude-sonnet-4-6, same tier as
  plan_generator / plan_refine_chat / interviewer. Migration 0025 seeds agent_configs
  (hand-apply at the deploy seam; conftest re-applies all migrations so tests pick it up).
- Storage quarantine enforced at the DATA LAYER, not by prompt (non-negotiable #4): a
  `store_context` fact is compiled through the STANDARD compiler at CLAIMED (reusing the
  chat add_context path), so the compiler's existing sentiment-quarantine is the enforcement.
  The agent's decision is a hint; the compiler is the backstop — a person-sentiment fact
  routed to store is quarantined → no client_visible_claims row. `plan_only` stores nothing.
- Plan edits reuse the SAME bounded `_apply_change` machinery + targets as K3 refine
  (never_list / suggested_questions / handling_notes; leading input reformulated). The intake
  agent is the second consumer of that primitive — kept shared, not forked.
- Non-negotiable #2 holds absolutely: admin input only shapes questions, is never spoken to
  the interviewee. The UI intake reuses the K3 applied-changes checklist (shared primitive).
