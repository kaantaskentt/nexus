# SIMPLIFY I — Simulations page (task #10, audit-walk) — A28 pre-review

Build split (team-lead): I own the PAGE + the display-derivation endpoint; lane-e owns the
RUN wiring (mint + adapted room). Contract LOCKED: only `workflow_id` crosses
(docs/SIMPLIFY-I-DESIGN.md). Room verified live on prod at seam-2 — build is GO.

## Behavior change stated plainly — KAAN'S LAST VETO POINT (confirm #3)
**The global test cast + proving rounds relocate.** Today every workspace's Simulations page
leads with Nexus's product-wide testing record (5 generic characters + judged rounds like
"14/16 hidden facts") and the "Jump in as the employee" cast play, with the workspace's own
content buried at the bottom. AFTER: the page leads with **scenarios derived from THIS
company's real workflows**; the global cast + proving rounds + the cast role-play move behind
a quiet **"How Nexus is tested"** disclosure ON the same page (team-lead's ruling — kept for
the in-context trust moment, just demoted). Nothing is deleted; `simulation_history` +
roleplay endpoints are unchanged and serve the disclosure. **If Kaan vetoes the relocation,
revert is this commit + the page commit — the endpoints stay put.**

## Today → after (per-surface)
- Today: cast (global) → RolePlaySection (global) → proving rounds (global) → "Runs in this
  workspace" (empty for most). A Bee Goddess admin meets someone else's jewelry example first.
- After: value statement → **scenario cards from this workspace's workflows** (or an honest
  zero-workflow empty state) → quiet "How Nexus is tested" disclosure (the relocated global
  record) → "Runs in this workspace" (unchanged). The tenant meets THEIR workflows first;
  the jewelry example can never leak as their content.

## Simpler for the user? YES
One clear question up top ("pressure-test the interviewer against YOUR workflows"), the
tenant's own material first, the product's proving record available but not mistaken for
their data. No capability removed.

## Scope (my half)
- Backend `GET /api/simulations/{workspace_id}/scenarios`: workflows with >=3 steps, ranked
  by testing value; returns `{workflow_id, label, step_count, tests_summary, signals}`.
  Signals = `{has_exceptions, has_decisions, confidence}` — all cleanly derivable from
  `spine_slots.exceptions` / `spine_slots.rules` / the verified-step ratio (reusing lane C's
  derivation). NOTE: I dropped the earlier `single_owner` display signal — it is NOT honestly
  derivable from workflow structure (a workflow mapped from one interview would false-positive
  on speaker); exceptions + decision points are honest. Display-only change, does not touch
  the `workflow_id` boundary with lane-e.
- Frontend: rebuilt page (value statement, scenario cards + Run, empty state, "How Nexus is
  tested" disclosure holding the relocated cast/proving/roleplay).
- Run button → lane-e's `POST /scenario-run {workflow_id}` → navigate to invite_path.

Isolated commits, scoped paths, tests run before each (the tested-first habit from Phase 3).

## AUDIT VERDICT — page half landed + contract-aligned with lane-e
Commits: pre-review (Kaan veto) · backend GET /scenarios + 4 tests · frontend page +
ScenariosSection + 3 tests. tsc 0, eslint clean, tests green per commit; scoped paths.
**Integration verified by inspection:** lane-e's `POST /{ws}/scenario-run {workflow_id}` →
{token, invite_path} matches my `run_scenario` client exactly; they derive archetype +
objectives server-side, only workflow_id crosses, roleplay firewall intact, and they added a
defense-in-depth >=3-step check mirroring my qualification. Both halves consistent. REMAINING:
live prod verification at seam-3 (folded into my #12 walk) — confirm a real workflow yields a
scenario card, Run opens the room with the SIMULATION marker, and a thin tenant shows the
empty state (never the global cast). Nothing said in a simulation touches client records
(session_kind='roleplay' firewall, unchanged).
