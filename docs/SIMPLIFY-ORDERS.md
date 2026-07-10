# SIMPLIFY — Kaan's July 9 orders (watchtower-relayed, binding)

Mission, in Kaan's words: "The final goal is not simply to make the interface look better.
It is to make the entire product easier to understand and operate — from creating a company
and completing the first context call to reviewing company knowledge, planning interviews,
understanding workflows, and deciding what to do next."

## Read first, in order
1. CLAUDE.md (A23 rhythm + A28 gate bind every change)
2. docs/kaan-inbox/feedback-jul9/FEEDBACK.md — **READ EVERY SCREENSHOT in media/ with your
   own eyes** (they are the spec; the prose references them). Feedbacks A–K.
3. docs/UI-DEBATE.md, docs/SIMULATIONS-RETHINK.md, docs/NAMING-PROPOSALS.md,
   docs/SPRINT-STATE.md (last night's state), docs/MERGE_PLAN.md decisions.
4. docs/FEEDBACK-QUEUE.md (pull anything open at boundaries).

## Phase 0 — Audit (no code)
Walk EVERY page on prod, desktop AND mobile viewport widths. Inventory: duplicated
information across tabs, actions available in multiple places, unnecessary navigation,
confusing side tabs, spacing/sizing failures (Kaan: the interview-plan page "is just so
messy... our UI checker missed this" — this audit must be humbler and finer-grained than
last night's debate; check every section at MacBook and mobile sizes).

## Phase 1 — Plan (commit before any build)
Write docs/SIMPLIFY-PLAN.md: what gets REMOVED / COMBINED / RENAMED-REWRITTEN /
REDESIGNED / what NEW components are genuinely necessary — each with its impact on
product logic and codebase. Include which previously-discussed-but-unbuilt ideas return
(ONLY if they serve simplification — nothing returns just because it was once discussed).
Commit + push the plan. Kaan is watching the terminal and GitHub; proceed after commit,
he will interject if he disagrees. Anything that would REMOVE a capability (not just a
surface) gets flagged in the plan's "Kaan should confirm" section and waits.

## Phase 2 — Execute (A28 per change: pre-review, isolated commits, simpler-or-stop)
The feedback items, with constraints that must survive redesign:
- **A. Company management**: reorder (drag) + per-company delete with a carefully designed
  confirm. Delete-company semantics: define DB cascade BEFORE building (follow the
  interview-delete precedent: preview endpoint, exact counts in the dialog, one
  transaction, sealed-flag survival question flagged to Emre). Keep checkbox interaction.
- **B. Post-call snapshot intro**: after first context call (or pasted/uploaded context),
  land on an introduction page, Home tab active, ONE primary action: "View company
  snapshot". Snapshot itself: cleaner, restructured per reference image.
- **C. Workflows**: "All" selected by default + department filter chips (Sales/Marketing/
  Operations/...). Nexus may classify by department only when confident — NEVER guess;
  unclear stays in All/unclassified. Workflow detail: clear visual structure (steps,
  owners, tools, decisions, evidence), expandable sections, hide nothing important.
- **D. CEO context-call welcome**: leadership-specific copy (learning about the company,
  goals, operating context; may gather public info after). This ALSO resolves the open
  "CEO consent wording" item — write the copy, flag final wording to Kaan+Emre in the
  plan, but ship the clearly-better version now (current employee-copy is wrong audience).
- **E. Live call room (BIG)**: right-side "Captured live" panel updating in real time with
  confirmation checkmarks; agent state indicator (Listening / Thinking / Saving); smooth
  intentional motion. KEEP left workspace nav. One experience serving BOTH executive
  context calls and employee interviews (copy/objectives adapt per kind). Text mode =
  same experience, "Voice off / Text mode" states, same captured-live panel. Chat speed
  complaint: investigate text-turn latency.
- **F. Connection stability**: unobtrusive reconnecting state inside the room, transcript
  preserved, auto-recovery confirmation + manual retry. Also investigate the actual
  drop cause (Kaan hit disconnects today).
- **G. Call-completed screen**: context-aware primary action (first context call → "View
  company snapshot"; later calls → back to updated snapshot/workspace) + secondary
  "Return home".
- **J. Play-this-character**: overview card (role, goals, context, key behaviors) with
  expandable details; raw MD demoted to a secondary tab.
- **K. Interview hub (HARDEST)**: Plan → Observe → Report → Follow-up as connected stages
  of ONE simple workflow — timeline, concise status cards, minimal scrolling, obvious
  next actions. The plan-chat that updates the interview plan live while you talk to it:
  design it properly (Kaan: "one of the hardest builds"); if the dynamic-update mechanics
  need his input, put a concrete proposal in the plan rather than guessing. Fix the
  suggested-questions spacing/sizing disaster at all viewports.
- **I. Simulations — DO LAST** (Kaan's explicit order): value statement, realistic
  workflows from the company's real context (kill the jewelry-example leakage into other
  tenants), explain what a simulation tests and why, quick run controls; running one opens
  the upgraded E room adapted to the scenario. Think, don't patch (SIMULATIONS-RETHINK).

Reference images are FUNCTIONAL specs, not style specs (AI-generated, inconsistent).
Adapt everything to ONE cohesive Nexus design system. External libraries/components
allowed where genuinely better — adapted, never pasted.

## Phase 3 — System coherence
If copy/flows change what agents say or expect: update personas, prompts, EVALS, and
rulebooks to match (D especially — context-collector opening must match the new welcome
promise). Trust-promise drift guard must stay green. No em-dashes client-facing.

## Phase 4 — Anti-over-engineering sweep (Kaan's explicit closing order)
Whole-codebase pass: did we over-engineer? Did simplification break good stuff? Full test
suites, prod browser walk of every changed surface (desktop + mobile), delta review
against pre-sprint behavior. Write honest audit verdicts in SPRINT-STATE.

## Law
Non-negotiables untouched (ontology, quarantine, gates, verbatim). BUILD→AUDIT→NEXT.
Limit protocol: 95% park with live todo + resume on reset; watchtower checks every 30 min.
Better, not more complicated, is the bar — for every change: is this SIMPLER for the user?
