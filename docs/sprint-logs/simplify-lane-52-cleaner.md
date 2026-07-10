# SIMPLIFY — Lane 5.2 log (code-cleaner)

Quality-only pass (A28: behavior identical, no bug-hunting — that's lane 1). Small scoped
commits, suites green each; anything risky is a proposal, not a silent rewrite. Started
~00:50 July 10 after the 23:45 gate (build lanes done, prod 0fd1f3d, round-3 green).
Re-scanned the post-refine-round tree rather than trusting the pre-gate list.

## CLEANUP 1 — delete orphaned CustomPlanDoor.tsx (dead code)
Robust barrel-aware import scan (scratchpad/orphan_scan.py) found exactly one orphaned
component: `frontend/src/components/plan/CustomPlanDoor.tsx`. It's the pre-K3 "custom
interview door" that the new-interview intake flow (interviews/new + AssignInterviewFlow,
image18) replaced; no real import anywhere, not in the `@/components` barrel, no test or
dynamic reference — only two descriptive comments naming the flow it replaced (kept as
design rationale). Deleted. Behavior identical (nothing rendered it). Verified: frontend
vitest 107/107, tsc --noEmit clean.

## Notes / not-touched
- `evals/adjudication/staged/29-perception-gap-same-speaker-retraction.patch` — LEGIT F21
  comparator artifact awaiting Emre's ratification (team-lead). OFF-LIMITS.
- `scripts/watch-dashboard.sh` (untracked) — a watchtower helper, not committed; left alone.
- `frontend/src/app/globals.css` carries another lane's uncommitted edit; not mine, untouched.
