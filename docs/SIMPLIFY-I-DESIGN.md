# SIMPLIFY I — Simulations, workspace-scoped (design only, task #10)

DESIGN ONLY — no code until lane-e's LiveRoom lands (Run reuses it) and Kaan's confirm #3
(proving-record relocation) passes. Grounds: SIMULATIONS-RETHINK option (c)-light + plan
§4-I. Reviewed by team-lead before any build.

## The problem this fixes (from Phase 0 audit + Kaan I)
Today `/w/<slug>/simulations` renders the PRODUCT's global test cast (5 generic characters:
jewelry-ops, hotel front-desk, agency AM, bookkeeper, warehouse foreman) plus Nexus's own
proving rounds — inside every tenant. A Bee Goddess admin sees "someone else's" content and
the jewelry example leaks into non-jewelry tenants. The page also lists the cast twice
(read-only + "Jump in") and buries the empty "Runs in this workspace" at the bottom.

## What the page becomes (workspace-scoped)
One screen, three stacked regions:

1. **Value statement (top).** "Pressure-test the interviewer against YOUR workflows before a
   real person ever gets a link. Nothing said in a simulation touches your company records."
   One sentence + one line. No cast, no proving scores up here.

2. **Scenarios from your workflows (the body).** Cards, each = one runnable pressure-test
   derived from a real workflow in THIS workspace. Empty until workflows exist (see empty
   state). This region replaces the global cast as the primary content.

3. **How Nexus is tested (quiet footer link).** The global cast + proving rounds
   (14/16 hidden facts, etc.) move behind a single link to a product-level "How Nexus is
   tested" surface — kept (it's the trust moment) but out of the tenant's primary view.
   The `simulation_history` API is unchanged; it just serves that linked surface now.
   **Kaan-confirm #3 gates this relocation.**

## What a scenario IS, and how it derives from real data
A **scenario binds a real workflow (the content) to a proven cast archetype (the play
engine)** — it does NOT fabricate a playable employee from real claim records (that would
invent words a real person never said; ontology + fabrication risk). So:

- **Content = a workspace workflow** (name, description, steps, tools, exceptions, owner,
  confidence — all already returned by `list_workflows` / effective_workflow from lane C).
- **Play engine = the best-matched archetype** from the existing global cast, chosen by the
  workflow's department/role signal (Operations workflow → ops-manager archetype, etc.).
  Reuses the proven persona files + roleplay handler unchanged; no new persona authoring.
- The scenario tells the interviewer-under-test to probe THIS workflow; the archetype
  supplies the personality/evasions to get past.

**Which workflows qualify** (never guess, honest ranking — mirrors lane C's confident-only
rule): a workflow qualifies as a scenario when it has **>= 3 steps** (a 1-step "workflow"
isn't worth a drill). Rank the cards by testing value, highest first, using attributes lane
C already computes:
- has **exceptions** (spine_slots.exceptions) → "tests whether the interviewer surfaces what
  breaks it",
- **single-owner dependency** (one entity owns most steps) → "tests drawing out a lone
  operator's undocumented knowledge",
- **Medium/Low confidence** (verified-step share) → "tests corroborating a thinly-sourced
  process".
A High-confidence, exception-free, multi-owner workflow ranks last (least to pressure-test).

**"What this tests and why" copy is DERIVED, never written per-tenant** — it's a template
filled from the attributes above, so it's honest and never leaks another company's example.
Example: *"Daily Gold Repricing — 9 steps, owned mostly by one person, with 3 known
exceptions. Tests whether the interviewer draws out the exception handling and the
single-owner risk a real interview must not miss."*

## Run controls → the LiveRoom
Each card has one primary action: **Run simulation**. Run mints a `roleplay`-kind session
(same path as today's "Play this character") bound to {workflow_id, archetype persona_key,
scenario objectives} and opens the **new LiveRoom** (lane-e) adapted to the scenario:
- roleplay kind → **compile firewall holds unchanged**: `compiler.py` / `disclosure.py` /
  `live_capture.py` already skip `session_kind in ("voice_test","roleplay")`. Nothing said
  enters client records; only `roleplay_debriefs` is written. No new firewall code.
- The room's Captured-live panel is suppressed for roleplay (existing backstop) — a
  simulation shows the interviewer's performance, not "captured context".
- **The room header must clearly mark it a SIMULATION** (team-lead requirement / trust
  surface): a persistent banner or chip so no admin could mistake a roleplay for a real
  interview. Copy e.g. "Simulation — practice run, nothing here reaches your company records."
- After the run: the observation debrief (existing roleplay_debriefs → the J-lane overview
  card pattern) says how the interviewer did against this workflow's traps.

## Build split (team-lead) + contract — AGREED with lane-e
Agreed to lane-e's minimal-boundary shape (single-sourced archetype-match, no client/server
drift). **The only thing crossing the boundary is `workflow_id` out and `{token, invite_path}`
back.** The card does NOT name the archetype — the page stays workflow-first (Feedback-I is
"your workflows", not generic characters); the character the admin will play surfaces in the
room via the J-lane overview card, not on the scenario card.

- **My half (page + derivation for DISPLAY).** A new `GET /api/simulations/{workspace_id}/scenarios`
  returns the qualified, ranked cards — derivation is mine (mirrors lane C's list_workflows):
  ```
  ScenarioCard {
    workflow_id:    string    // the only value that crosses to Run
    label:          string    // workflow name, e.g. "Daily Gold Repricing"
    step_count:     number
    tests_summary:  string    // derived "what this tests and why" (display prose)
    signals: { has_exceptions: bool, single_owner: bool, confidence: "high"|"medium"|"low" }
                              // the ranking signals, from lane-C workflow attributes
  }
  ```
  Qualify at >=3 steps; rank by has_exceptions / single_owner / lower confidence. NO archetype
  or agent objectives here — those are Run's concern.
- **Lane-e half (run).** `POST /api/simulations/{workspace_id}/scenario-run { workflow_id }`
  → `{ token, invite_path }`. Given workflow_id, lane-e derives the archetype persona_key
  (dept/role → CAST_KEYS) AND the interviewer objectives, mints the roleplay-kind session
  (resumable_state carries persona + workflow_id + objectives), and opens the LiveRoom with the
  SIMULATION marker + suppressed Captured-live + debrief-against-workflow. The page just
  navigates to invite_path.
- **No drift:** archetype-match + agent objectives are single-sourced in lane-e's backend; my
  "tests_summary" is display prose derived in parallel from the same workflow attributes (a
  different artifact for a different audience, not a duplicated source of truth).
- Both halves gated on seam-2 verifying the room live; interface locked, no commits yet.

## Zero-workflow empty state (no leakage, ever)
A thin tenant with no qualifying workflows shows an honest empty state, NOT the global cast:
"Simulations pressure-test the interviewer against your workflows. None are mapped yet — run
an interview and its workflow appears here to drill against." + a link to the interviews hub
and the quiet "How Nexus is tested" link for the product-level record. The generic cast is
NEVER rendered as this tenant's content.

## Non-negotiables preserved
- Simulations never touch client records (roleplay firewall, unchanged).
- No fabricated employee speech: archetypes play, real workflows supply the content.
- Confident-only / never-guess ranking (no scenario invented from thin data).
- Demo/real firewall unaffected (is_demo untouched).

## Resolved (team-lead review, msg approving this doc) — LOCKED
1. **Persona binding = archetype-match, LOCKED.** Fabricating a playable persona from real
   claim records would put invented words in a real person's mouth (ontology breach). Real
   workflows supply WHAT to probe; proven archetypes supply WHO. No real-employee persona.
2. **"How Nexus is tested" lives ON the Simulations page** as the quiet link (the in-context
   trust moment holds; a picker/product-level page would orphan it). Reuses
   `simulation_history` for the linked record — no new route needed.
3. **Confirm #3 stays Kaan's veto.** Per proceed-after-commit doctrine, BUILD is allowed once
   E's room lands AND seam-2 verifies it live, provided the pre-review commit **clearly states
   the proving-record relocation** so Kaan has one more visible veto point before it ships.
4. **Build order: after seam-2 proves the room on prod.** Run must point at a LiveRoom seen
   working live, not merely merged. Held until then.
4. Build order: after E's LiveRoom is real (Run depends on it) and confirm #3 clears.
