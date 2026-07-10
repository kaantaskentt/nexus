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

## CLEANUP 2 — remove unused `json` import (backend/app/routers/chat.py)
ruff F401 flagged the only unused import in the whole backend (`json`, chat.py); the module
decodes nothing itself (jsonb comes back decoded from the pool codec). Removed. ruff clean,
chat/context tests 15 passed.

## CLEANUP 3 — remove stray committed temp file docs/SPRINT-STATE.md.tmp
A zero-byte `.tmp` of SPRINT-STATE accidentally committed on July 8 (1e3a34e), referenced
nowhere — the "stray scratch got committed" check the lead flagged. Deleted. (Swept the whole
tracked tree: this was the only stray temp; all tracked images are legit audit/reference
evidence, and the `@/components` barrel has no dead re-exports — 10/10 used.)

## PROPOSALS (real duplication, deferred — multi-file + subtle behavior, not silent rewrites)
- **`_loads` shim in 5 files** (routers/plans, reports, workspaces; pipeline/plan, workflow_edit):
  three different signatures (1-arg vs 2-arg-with-default) and largely vestigial now that the
  pool codec decodes jsonb (see workflow_edit's own comment). A single
  `loads(v, default=None)` in app/db.py preserves every call site's behavior, but it's a
  data-layer change across 5 files — proposing rather than churning silently late in the sprint.
- **`initials()` in 4 files** (AppShell, PersonRow, ObserverView, InterviewsView): two variants
  differ only in the empty-name fallback (`|| "?"` vs `""`). A shared `initials(name, fallback="")`
  in lib/ dedupes them behavior-identically. Low-risk but 4-file churn; proposing for a batch.
Both are the kind of "one shared helper" cleanup worth doing at Phase 4 merge when the tree is
frozen, not racing other lanes now.

## TREE-FREEZE COMMITS (both dedups approved by team-lead; executed on the frozen tree)
- **CLEANUP 4 — `_loads` → single `loads(v, default=None)` in app/db.py.** Removed the 5
  duplicate copies (routers/plans, reports, workspaces; pipeline/plan, workflow_edit — 3
  signatures) for one shared read-side jsonb helper paired with the pool codec. 1-arg calls
  get default=None (identical to the old 1-arg), 2-arg calls get their default — behavior
  preserved at every call site; reports.py's now-unused `import json` removed too. Verified:
  backend 253 passed/1 skipped, zero new ruff findings (per-file counts identical to HEAD).

## Notes / not-touched
- `evals/adjudication/staged/29-perception-gap-same-speaker-retraction.patch` — LEGIT F21
  comparator artifact awaiting Emre's ratification (team-lead). OFF-LIMITS.
- `scripts/watch-dashboard.sh` (untracked) — a watchtower helper, not committed; left alone.
- `frontend/src/app/globals.css` carries another lane's uncommitted edit; not mine, untouched.
