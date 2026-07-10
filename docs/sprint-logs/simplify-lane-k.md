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
