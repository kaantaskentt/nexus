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

## ADDENDUM (Kaan, ~11:00 July 9 — binding, P1)
- **DEADLINE: everything complete within 12 hours** (before Emre begins real voice
  testing). Plan pacing accordingly; park/resume through limit windows without waiting.
- **Every button works.** A dedicated pass: click every interactive element on every page
  (desktop + mobile). Kaan reports some are still dead. No dead buttons ship.
- **Navigation convenience:** from any deep view you can reach other tabs easily AND
  return to where you were in the flow (back-to-flow affordances per section).
- **NEW: agentic chat interface.** Build the chat-with-Nexus experience properly — agents
  behind the chat (use the Claude Agent SDK or roll the loop, your judgment). Primary
  surface: the Feedback-K plan-chat where conversing updates the interview plan LIVE.
  Tunç inspiration (Kaan's explicit pointer, verified by watchtower):
  - `reference/nexus-web-app-main/lib/hooks/use-polling.ts` — usePollingQuery: the
    page-updates-itself-while-work-happens pattern (used in discovery-run-live-view,
    kb-diff-live-panel, candidates-live-actions).
  - `reference/nexus-web-app-main/components/chat/chat-composer.tsx` — auto-growing
    composer with Enter-to-send.
  - `reference/nexus-web-app-main/components/reviewer/kb-diff-live-panel.tsx` — live
    approve/resolve of diff items (the shape for "chat proposed these plan changes,
    highlight them, let the user keep/undo").
  Adapt with attribution (FOR-TUNC entry), never paste blind. The chat's plan edits
  respect the ontology: the plan is a draft artifact so live edits are fine, but
  anything the gate already approved never mutates silently.

## ADDENDUM 2 — evals & rulebooks (Kaan, ~20:20 July 9, P2 coherence)
"Update or write evals only if it makes sense" — as a forcing function for whole-codebase
awareness. Do NOT add evals for eval's sake. The places this sprint genuinely touches
tested behavior (update the eval WITH the change, same commit or adjacent):
1. **D — CEO welcome / context-collector opener changes.** The fixed-response evals that
   assert the opening line and consent framing (prompts/personas + evals/) must move with
   the new leadership copy. Drift guard + no-em-dash lint stay green.
2. **E — live-capture extractor is NET-NEW tested-worthy behavior.** Needs coverage before
   it ships as "honest": (a) a single live source is Reported-at-most (A18/A19 ladder),
   (b) sentiment about a named person is quarantined at the data layer even in live
   capture, (c) a structural item (team/system/workflow) is captured but an opinion is not.
   Anti-theater: assert the panel reflects real extraction, not a canned animation.
3. **C — department classifier "never guess".** One eval: an ambiguous workflow stays
   null/unclassified; a clearly-departmental one classifies. This is a trust rule, worth pinning.
4. **K — plan-chat live edits respect the gate.** Assert chat edits a DRAFT plan's sections
   but CANNOT mutate a gate-approved plan silently; change_log records every apply.
5. **A — delete-company cascade (when built): a test proving the cascade removes exactly
   the previewed counts and leaves other tenants byte-identical (interview-delete precedent).**
Everything else: leave the eval suite alone. If a change doesn't touch tested behavior,
it doesn't need an eval. Report in the Phase 4 sweep which evals moved and why.

## WATCHTOWER FLAG (20:35 July 9, P1 deploy coherence)
Independent prod check: migrations diverge from git. LIVE Supabase has 0022
(sort_order) applied, but **0023 (workflows.department/description) and 0024
(live_captures) are committed to git and NOT applied to live**. The C workflows-
department surface and the E Captured-live panel will 500 on prod until these are
hand-applied per deploy protocol. This MUST land (apply + GET-verify columns/table
exist + browser-walk the surface) before those features count as "done" and before
Emre voice-tests tonight. Track every new migration to live before marking its lane
green. Do not let git-green masquerade as prod-green.

## ADDENDUM 3 — REFINE ROUND (Kaan live-testing, 22:20 July 9. Binding. Runs until 03:00 PDT.)
Kaan is testing prod RIGHT NOW and these supersede the wrap-up. Work continues until
03:00 PDT (park at 95% with live todo, resume on window reset - watchtower kicks resumes).

1. **P1 BUG (already routed): LiveRoom voice transcript frozen.** Roleplay session
   5716e93e: 29 utterances in DB, screen stuck on opener. Voice-mode transcript
   subscription lost in the E merge. Fix, deploy, verify live turns render. Blocks Emre.

2. **Company Snapshot v2 - "best version for a CEO/admin" (Kaan: still confusing).**
   Design from the reader's seat: a CEO opens this page and should get, in order:
   (a) the story so far in one glance - what Nexus now understands about the company;
   (b) what needs MY attention (open questions / awaiting approvals) with obvious actions;
   (c) ONE next recommended action, prominent;
   (d) everything else (evidence rail, trust chips, teams detail) demoted to drill-down.
   Today's page reads as a records dump: three near-equal sections, trust-chip noise on
   every card, an evidence rail competing with the main column, next-action buried at the
   bottom. Fewer things, bigger hierarchy, plain-language headers. The append-only render
   model and honesty rules (real counts, trust ladder, quarantine) are untouchable - this
   is presentation. Commit a short pre-review with the new section order before building.

3. **IA consolidation - Kaan CONFIRMS amendment 3.** His words: "Interviews, Insights,
   Company Context all show the same thing." Design + implement the consolidation:
   ONE canonical home per data kind, cross-links instead of re-renders. Propose in one
   committed pre-review: what each nav item uniquely shows after the change (e.g. Home =
   snapshot story, Company Context = the record store/KB, Insights = findings/conflicts/
   opportunities ONLY, Interviews = the staged hub). If a tab has no unique job left,
   fold it (nav shrink OK). Deep-link everything else.

4. **Full bug check + UI/UX doc re-walk.** With fresh eyes: (a) re-read
   docs/kaan-inbox/feedback-jul9/FEEDBACK.md + all 21 screenshots and verify EVERY item
   actually landed as intended on prod (not just per-lane claims); (b) click-every-button
   pass at 1440 + 390 (the addendum-1 order - some buttons were still dead per Kaan);
   (c) hunt regressions of good old behavior lost in rewrites (the transcript freeze is
   the proven class - check merged bubbles, scroll discipline, observer polling, report
   links, export, delete dialogs); (d) then think beyond the doc: propose-and-fix what
   makes the experience genuinely better (A28 gates each: simpler-or-stop).

5. Keep seam discipline: batch fixes into deploy seams, browser-verify each seam at both
   widths, honest verdicts in SPRINT-STATE. Evals move with any behavior change (add. 2).

## ADDENDUM 4 — New-interview intake agent (Kaan, 22:40 July 9. SEPARATE build, due tonight.)
Screenshot ref: the New interview form (name / role-optional / focus-optional).
1. **Required, not optional.** ROLE and "what should this interview find out" stop being
   optional. Plain inputs, clear helper copy; role can offer known-role suggestions from
   existing entities but stays free-text.
2. **Intake agent mode ("chat with Nexus") after the fields.** On submit, before the
   draft plan appears: the intake agent asks 2-3 SHORP follow-up questions, one at a time,
   in chat - and it is AWARE of how interview plans are put together (it reads the
   records, the plan skeleton, coverage gaps for this person/role). Same philosophy as
   the product itself: ask the right questions - e.g. surface what Nexus does NOT yet
   know about this person's area, confirm boundaries, ask what winning looks like for
   this interview. Answers visibly update the draft plan (reuse the K plan-chat live-diff
   machinery + Tunc patterns; this is the second consumer of the same primitives, keep
   them shared).
3. **Context-storage decision (the sensitive part).** When the admin's answers contain
   company FACTS (names, processes, tools), the agent must explicitly decide: plan-only
   shaping vs stored as company context. Rules: stored facts become claim records
   attributed to the admin, tagged CLAIMED, quarantine applies to people-sentiment,
   and the UI SHOWS the decision ("Saved to Company Context" chip vs "Used for this
   plan only") - nothing silently becomes a record. Non-negotiable 2 holds: nothing the
   admin says is ever spoken to the interviewee as a statement; it only shapes questions.
   Evals: intake agent asks-not-tells (no leaking admin claims into questions), storage
   decision honest (fact stored+chip shown; opinion about a person quarantined; vague
   input plan-only).
4. This is a tonight deliverable alongside the refine round - lane it accordingly.
