# SIMPLIFY Lane A — company reorder + delete (task #3)

Per-lane log (team-lead's rule, July 10): A28 pre-reviews + audit verdicts live HERE, not
in SPRINT-STATE.md (concurrent-write hotspot; lead merges at Phase 4). A28 binds every
change: two-line pre-review (today -> after) + "simpler or more complex for the user?".

## A28 pre-review — COMMIT 1 (picker reorder) — landed 223e8b0

Today: `GET /api/workspaces` returns `order by created_at` ASC; `page.tsx` does a client
`.reverse()` to get newest-first; there is no way to reorder. After: backend orders by
`sort_order` nulls-last then `created_at desc` (default order byte-identical to today's
newest-first for null sort_order); `page.tsx` drops `.reverse()` (order semantics live in
ONE place); the "Other workspaces" rows get a drag handle (framer-motion `Reorder`) that
persists on drop via `PATCH /api/workspaces/reorder` (admin-only). Hero stays the computed
"newest prepared non-demo" spotlight, unchanged; `is_internal` filter + `is_demo` hero
guard untouched. Simpler or more complex for the user? SIMPLER — they can put the company
they care about at the top; if they never drag, the picker looks exactly as today.
Taste call: hero is a computed spotlight, NOT drag-sortable (protects the P5 hero guard;
image9 draws a handle on the hero too). Lead shipped this as the recommendation to Kaan.

## A28 pre-review — COMMIT 2 (delete preview, non-destructive) — landed 1009b30

Today: a company row has no delete affordance; only interviews are deletable (sessions.py).
After: each picker row gets a quiet trash affordance opening the image9 dialog
(type-company-name-to-confirm, exact cascade counts from a new non-destructive
`GET /api/workspaces/{id}/delete-preview`, "cannot be undone", permanent-lock line). The
Delete button is DISABLED behind a frontend `WORKSPACE_DELETE_ENABLED` flag (default off)
with honest microcopy "Awaiting final confirmation of delete semantics". Simpler or more
complex? SIMPLER and SAFER: the count-exact preview is read-only; nothing can be deleted
yet.

## A28 pre-review — COMMIT 3 (delete cascade, inert) — landed fb44c54

Today: no company-delete path exists. After: `pipeline/deletion.py delete_workspace`
tears a tenant down in ONE transaction, hand-ordered children-first (most workspace_id FKs
have no on-delete-cascade); `DELETE /api/workspaces/{id}` admin-only, gated behind
`settings.workspace_delete_enabled` (returns 403 by default). Deliberate precedent
departures, flagged to Emre in code: sealed_flags DELETED (no tenant left to hold them),
agent_runs RETAINED with refs nulled. Simpler or more complex? NEUTRAL and inert until
enabled — nothing destructive is reachable in any deployed env until Kaan confirms §6-1.

Note: plan/task say "migration 0021" but 0021_context_call.sql already existed — used the
next free number 0022 for `workspaces.sort_order`. Flagged to lead.

## AUDIT VERDICT (all 3 commits landed)

COMMIT 1 reorder 223e8b0, COMMIT 2 preview 1009b30, COMMIT 3 cascade (inert, 403-gated)
fb44c54. Lane-A suite 20/20 green in isolation (reorder 5 + preview 4 + cascade 4 +
delete-interview 4 + workspaces 3); frontend 67p; tsc + lint clean. Full backend suite
shows shared-test-DB contention errors when another lane runs pytest against the same
nexus-test container concurrently (per-test `drop schema cascade` collides) — NOT a code
failure; each file passes alone and as a lane set.

Two gates held for lead/Kaan:
1. DEPLOY SEAM — migration 0022 NOT applied to live Supabase; reorder won't work on prod
   until it is. Lead coordinates.
2. DELETE ENABLE — COMMIT 3 inert. Enable after Kaan confirms §6-1: backend env
   WORKSPACE_DELETE_ENABLED=1 + frontend env NEXT_PUBLIC_WORKSPACE_DELETE_ENABLED=1. The
   sealed-flag deletion departure is an open ruling with Emre.

## A28 pre-review — RESERVE (backfill plan/apply split, task #14)

Today: `scripts/backfill_workflow_taxonomy.py` calls the LLM classifier
(`classify_workflow_taxonomy`) in BOTH `--dry-run` and `--apply`. Because the classifier
is non-deterministic, the dry-run's printed rows are not a pre-image of what `--apply`
writes (seam-2 saw the same rows get different departments between runs) — so the dry-run
reviews nothing. After: a plan/apply split. `--plan out.json` runs the classifier ONCE and
writes the exact proposed rows (workflow id, slug, name, description, department;
confident-only preserved — unclear department stays null). A human reviews the file.
`--apply out.json` writes EXACTLY those rows with ZERO LLM calls, and refuses (writes
nothing) if the DB drifted underneath: a planned workflow id is gone, or a column the plan
means to fill is no longer null. Simpler or more complex for the operator? SIMPLER and
SAFER — what you review is byte-for-byte what gets written; a drifted DB aborts loudly
instead of silently writing stale guesses. Not run against live (seam-2 owns live writes).
Tests cover the apply-from-file path with the classifier monkeypatched to raise, proving
apply makes no LLM call, plus the two drift-refusal cases.

## A28 pre-review — ROBUSTNESS 1 (cascade cancels queued jobs, folded into 5.3)

Found live (watchtower): deleting a session left its post-call jobs (compute_yield,
screen_disclosures, the compile fan-out) still `queued`; when a worker later ran one it
found no session, raised, and crash-retry-failed into dead `failed` rows. Today: the delete
cascade removes the session + its rows but leaves the jobs referencing it. After:
`delete_interview` (and the inert `delete_workspace`) also delete every not-yet-terminal
job (`status in ('queued','running')`) whose `payload->>'session_id'` is a doomed session,
inside the SAME transaction — so no orphaned work survives the delete. delete_workspace
also clears jobs referencing the workspace_id (whole tenant is gone). The post-cascade
render_snapshot enqueue in delete_interview happens AFTER the transaction, so it is not
cancelled. Simpler for the user? Invisible to them, but removes a class of silent dead
rows an operator would otherwise find in the queue. Test: cascade removes the queued job.

## A28 pre-review — ROBUSTNESS 2 (handler session-gone guard, folded into 5.3)

Today: `compute_session_yield` and `screen_session` both `raise RuntimeError` when their
session is missing — a retryable crash that burns all attempts and lands in `failed`. After:
they log and return cleanly (no-op complete), copying the EXISTING pattern in
`generate_roleplay_debrief` (session is None -> log.info + return), not a new one. Defense in
depth with robustness-1: even a job that slips past the cascade cancel (or a legitimately
vanished session) completes as a no-op instead of a dead retry loop. Simpler/safer: a gone
session is a normal terminal state, not an error. Tests: each handler no-ops on a missing
session and does not raise.

## STRESS FINDINGS (lane 5.3, task #22) — ranked by embarrassment-in-front-of-a-CEO

Method: disposable `nexus_stress` DB on the local container (A12-safe, torn down after),
all migrations applied, in-process ASGI endpoints timed at increasing scale. No LLM keys
locally, so LLM/VAPI write paths (turn engine, compile, live-room reconnect storms) were
NOT exercised here — flagged for lane-E / a keyed run. Numbers are in-process (no network);
where the real cost is network fan-out that is called out explicitly.

1. **Picker N+1 (HIGH — the one CEO-visible risk). NOT fixed (collision-avoidance).**
   `frontend/src/app/page.tsx` fans out TWO backend calls PER workspace (list_plans +
   list_snapshot_cards) purely to render the counts ("N suggested interviews", "N areas to
   investigate", prepared badge). That is 2N+1 backend round trips per picker load. In
   process it is 180-420ms at N=10-200 (noisy, no network); over the real Vercel->Railway
   hop each is a separate `cache: no-store` HTTPS call, so at 50-200 companies this becomes
   seconds and a request-fan-out spike on the backend. All three counts are derivable in ONE
   aggregate SQL query. RECOMMENDATION: add plans_count / areas_count / prepared to
   list_workspaces (additive, or a dedicated /picker endpoint) and drop the per-ws Promise.all
   in page.tsx. Held rather than shipped because page.tsx sits under the active ADD-3.3 IA
   consolidation lane — flagged to lead to avoid a merge collision; I can take it once that
   lane settles, or ADD-3.3 folds it in.

2. **Company cascade delete: 1.25s on a 10k-claim / 300-workflow tenant (LOW).** Acceptable
   for a type-to-confirm admin action with a spinner; logged, no fix. Set-based deletes in
   one transaction — scales linearly, no pathological blowup.

3. **Everything else scales fine (verified green):** get_insights 17.7ms @ 10k claims;
   get_workflows 12ms @ 500 workflows (the correlated-subquery confidence derive is one
   round trip, not an N+1); reorder 59ms @ 200 workspaces; parse_transcript 4ms @ 500k
   chars / 6.7k turns; GET /api/workspaces (list+order) 6ms @ 200. No slow paths found here.

Robustness fixes landed from this lane's failure-class hunt: 72b3cef (cascade cancels
queued jobs), 71181bb (handlers no-op on gone session).

## A28 pre-review — picker N+1 fix (lead approved, ADD-3.3 collision cleared)

Today: the root page.tsx fetches list_workspaces, then for EACH workspace fetches
list_plans + list_snapshot_cards (2N+1 no-store round trips) purely to render three counts.
After: GET /api/workspaces computes plans_count, areas_count (area_to_investigate in the
latest snapshot batch) and prepared (any snapshot card exists) in ONE aggregate query;
page.tsx maps those straight onto the card model and drops the per-workspace Promise.all
(and the now-unused imports). Hero / is_internal / is_demo semantics stay byte-identical:
prepared="any card exists" equals the old "latest batch non-empty" because batches are
append-only, and the hero find() over the same order is unchanged. Simpler AND faster for
Kaan's first screen: one request instead of hundreds. Backend test asserts the three
counts (incl. latest-batch-only areas) on a seeded tenant; the list-shape tests
(test_workspaces / client_seats / internal_flags / reorder) stay green with the added keys.

## A28 pre-review — finish the missing-session handler sweep (lead: 71181bb was partial)

A second watchtower red (build_workflow_schema) proved the "session torn down before its
queued job runs" class covers ~6 handlers, not the 2 in 71181bb. Today: compile_session
(compiler.py) and build_workflow_schema (workflow.py) still `raise RuntimeError` on a gone
session -> crash-retry-fail into dead rows. After: both log-and-return, copying
disclosure.py's exact pattern. Already-correct, left as-is (verified + pinned by tests, no
code change): score_interview_quality (quality.py already returns), render_snapshot
(snapshot.py is workspace-scoped, no session fetch, no-ops on no claims). DELIBERATELY left
raising: interview.py _prepare_turn (L121) — the LIVE turn path, where a missing session is
a genuine error, not a torn-down-before-job race; noted so the next sweep won't "fix" it.
One scoped commit, tests green.
