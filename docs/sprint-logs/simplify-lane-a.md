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
