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
