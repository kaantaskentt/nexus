# GO — lane-e room wiring (from team-lead, standing order)

Your COMMIT 3 layout is BLESSED (fourth relay; your mailbox drops my messages — checking
this file is the reliable channel). Build + test + commit the room wiring NOW in your one
tight window, then COMMIT 4 (reconnect) immediately after.

Notes from the blessings you missed:
1. Taste: the "Saved" checkmark stays quiet — small, no bounce. Confirmation, not
   celebration.
2. Phase 3 addition (your file, InterviewClient done page): body copy must branch on
   snapshot_exists like the CTA does — a later context call must not say "first version
   of your company snapshot". Fold into whichever commit touches the file.
3. The patch file docs/sprint-logs/lane-e-interview-hooks.patch is redundant now that
   45da288 landed — delete it in your next commit (I authorize; code-map created it as a
   safety net for exactly the hunks you re-applied).
4. Report both commits here AND by message when landed — seam-2 fires on your word;
   the whole team is holding on you.

---
## LANE-E REPORT (all commits landed — seam-2 clear from my side)
- COMMIT 1 live captures: 0ac212c (core) + 45da288 (text-path enqueue remainder)
- COMMIT 2 text SSE streaming: 8c3203b (backend) + a1d169c (frontend)
- COMMIT 3 room: d4140fb (primitives) + ff60beb (wiring; layout as blessed, quiet Saved,
  done-page body branch on snapshot_exists)
- COMMIT 4 in-room reconnect: efa9702
Verification: backend affected suites green (test_live_capture, test_turn_stream,
test_interview, test_context_call, test_chat, test_observer, test_coverage, test_session_complete);
frontend tsc 0 errors, eslint clean, vitest 93/93. Did NOT run the full backend suite
(shared-container rule). Patch file deleted per your note 3. Live browser walk is yours at
the seam. Handoffs noted in docs/sprint-logs/simplify-lane-e.md (workspace-side Observer =
lane-k K4; the admin live-captures endpoint + panel admin variant are ready for them).

---
## GO #2 — #10 Run wiring (from team-lead, after seam-2 verified the room live)
Build the Simulations Run wiring per the locked design (docs/SIMPLIFY-I-DESIGN.md) and
your workflow_id contract with audit-walk: scenario -> roleplay-kind session -> LiveRoom
with the persistent SIMULATION marker ("practice run, nothing reaches your company
records"), Captured-live suppressed for roleplay, compile firewall asserted in a test.
Scoped commits; report here + by message. seam-3 carries it.

---
## ACTION NEEDED (team-lead): commit your leftover respondent.ts hunk
Your Run wiring commit 3a972a5 left the `simulation?: { label: string }` type additions +
getSession mapping UNCOMMITTED in frontend/src/lib/respondent.ts. Commit it now (scoped to
respondent.ts), run tsc + room tests, report the hash. It is the last cargo before seam-3.

---
## FIXUP #3 (team-lead, from the Phase-4 walk) — sim marker on PRE-call surfaces
Consent page for a scenario-run session shows employee-interview copy; pre-call chrome says
"Test call". Fix: consentCopy() + chrome branch on the simulation signal — practice-run
framing, no real-person promises (Emre-primary employee promise must NOT render), chrome
"Simulation · <workflow>". Test-pin employee+context consent byte-unchanged. One scoped
commit; report hash; Vercel-only mini-seam ships it.

---
## P1 NOW (team-lead, ADDENDUM 3.1) — voice transcript FROZEN in LiveRoom
Roleplay session 5716e93e: 29 utterances in DB, screen stuck on opener. The voice-mode
transcript subscription was lost in the E merge. Reproduce, fix, pin with a test, commit
scoped, report hash immediately. Blocks Emre's voice test. Mini-seam ships it with
6199a06 + bea9fac.
