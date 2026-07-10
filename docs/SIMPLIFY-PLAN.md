# SIMPLIFY — the committed plan (July 9, from Kaan's orders + 21 screenshots)

Mission (Kaan): make the entire product easier to understand and operate — from creating
a company and the first context call to reviewing knowledge, planning interviews,
understanding workflows, and deciding what to do next. Better, not more complicated, is
the bar for every change.

Inputs: docs/kaan-inbox/feedback-jul9/FEEDBACK.md + all 21 screenshots (read one by one),
docs/SIMPLIFY-AUDIT.md (Phase 0 prod walk, desktop+mobile), docs/SIMPLIFY-CODEMAP.md
(file-level recon). A23/A28 bind every change: pre-review, isolated commits,
simpler-or-stop. Reference images are functional specs, not style specs — everything
adapts to the one Nexus design system (cream/ink/accent, serif display, hairline cards).

---

## 1 · REMOVED (things that stop existing)

| What | Why | Impact |
|---|---|---|
| "Generate interview plan" + "Review transcript" as co-primary actions on the post-call landing | Kaan (B): ONE primary action — "View company snapshot". Transcript stays reachable from the summary card; plan generation stays on Interviews. | Frontend only (new intro page renders one CTA). No capability lost — relocated. |
| Global jewelry cast + proving rounds rendered inside EVERY workspace's Simulations page | Kaan (I): jewelry-example leakage reads as broken in other tenants. The product-wide proving record moves behind a quiet "How Nexus is tested" link; the page becomes workspace-scoped. | `simulations/page.tsx` restructure; `simulation_history` API stays (serves the linked record). Capability kept, relocated. **Kaan-confirm #3.** |
| Flat wall-of-questions rendering on the plan page | Kaan (K): "the UI is just so fucking messy." Questions group under their topics as accordions (image21); nothing is deleted from the plan payload. | `PlanView.tsx` relayout. Display change only; plan data and gate untouched. |
| The dead "Generate Follow-Up Template" disabled button on plans | K: "Follow-up plan action and its next steps are unclear and do not currently make sense." Replaced by a real follow-up path (see REDESIGNED · K). | Removes a dead affordance; replacement is a working one. |

Nothing else is deleted. Every other change relocates or restructures.

## 2 · COMBINED (two things become one)

| What | Why | Impact |
|---|---|---|
| Voice room + text room → ONE live-room experience with two modes | Kaan (E): "Voice and text should feel like two modes of the same agent experience." Today `VoiceCall.tsx` (547) and the chat branch of `InterviewClient.tsx` (515) are siblings with different layouts. | One `LiveRoom` component family (presence bar + transcript + Captured-live panel + state indicator), voice/text as modes. Respondent (/i/token, no nav) and workspace (with nav) render the same core in different shells. Biggest frontend build of the sprint. |
| Plan creation + assign + send → one "New interview" flow | K (image18): employee details, interview structure (voice/text, language, deadline), draft-plan preview, readiness checklist — one screen instead of CustomPlanDoor → plan page → SendInterviewFlow hop. The gate (NEXUS_CHECK → approval) is UNTOUCHED and still blocks sending. | `CustomPlanDoor.tsx` + `SendInterviewFlow.tsx` merge into an assign flow; `plans.py` endpoints reused. |
| Interview stages Plan / Observe / Report / Follow-up → one visible workflow | K: they exist as four unlinked routes today. A shared stage rail (timeline header) renders on all three existing pages + the Interviews hub rows become stage cards with ONE obvious next action each. | New small `StageRail` component + edits to `InterviewsView`, `PlanView`, `ObserverView`, `ReportView` headers. Routes stay (deep links keep working). |

## 3 · RENAMED / REWRITTEN (same thing, truer words)

| What | Why | Impact |
|---|---|---|
| CEO context-call welcome copy (consent page) | D: current copy addresses an employee; the audience is leadership. New copy: Nexus is learning about the company, goals, operating context; may gather public info after; honest attribution promise (a founder's words BUILD the attributed snapshot — the role-only promise is wrong for this audience). This closes the open CEO-consent item from July 9 shift-2. | `respondent.ts consentCopy()` gains a per-kind branch (`context` vs `interview`); done-page copy branches too (ties to G). **Final wording flagged to Kaan+Emre (confirm #2) — the clearly-better version ships now.** |
| Context-collector opening line | Phase 3 coherence: the agent's first words must match the new welcome promise. | `prompts/personas/stage3-context-collector.md` + fixed-response evals updated together; drift guard + no-em-dash lint must stay green. |
| Snapshot intro vocabulary ("Insights captured / Teams / Systems / Workflows / Open questions") | B (image14): the intro page speaks in counts a CEO recognizes, mapped honestly from real data (records, entities, workflows, areas-to-investigate). No invented numbers: each stat is a real count with a real destination. | New intro page copy; SnapshotView section headers align. |
| Nav naming (Agent Skills → Playbooks etc., docs/NAMING-PROPOSALS.md) | NOT in this sprint's scope unless Kaan says so — renames are one-line config but they are his circles. | **Kaan-confirm #6** (take-it-or-leave-it, zero build cost either way). |

## 4 · REDESIGNED (existing surfaces, rebuilt to the screenshots)

### A — Company management (picker)
Reorder: new `sort_order` column (migration 0021) + `PATCH /api/workspaces/reorder` +
drag handles via framer-motion `Reorder` (already a dependency — no new library). Default
order stays newest-first until the user drags. Hero card, checkbox/node-graph art, and
meta icons KEPT per Kaan. `is_internal` filter and `is_demo` hero guard preserved.
Delete: **cascade defined before building** — see §6. Trash affordance quiet on each row
(image9), dialog = type-company-name-to-confirm + EXACT counts from a preview endpoint +
"cannot be undone" (interview-delete precedent, one level up).

### B — Post-call snapshot intro (+ G call-completed)
New `SnapshotIntro` on Home: renders when the workspace has its FIRST compiled snapshot
and the intro hasn't been dismissed (flag in `workspaces.config` jsonb — no new table).
Home tab active, stat row of real counts, "what we've captured" category cards, ONE
primary CTA "View company snapshot" (dismisses intro → SnapshotView). Also shown after
pasted/uploaded context (same trigger: first cards exist). SnapshotView itself:
regrouped into the same category sections (Overview / Teams & People / Systems /
Workflows / Priorities / Open questions) so intro and snapshot speak one language —
a restructure of `SnapshotView.tsx` (571), append-only render model untouched.
G: respondent done page branches by kind+state: first context call → primary "View
company snapshot" (deep link to /w/[slug]/home), later calls → "See what's new in your
snapshot", both with secondary "Return home". Employee-interview done page unchanged
(Emre's promise copy stays).

### C — Workflows list + detail
List (image12): "All" chip default + department chips. Departments come from a new
nullable `workflows.department` column, written by the schema-builder ONLY on confident
classification (prompt rule: unclear → null; null renders under All, never guessed).
One-off confident-only backfill for existing workflows. Card: name + one-line
description (derived at build; stored, small column) + step count + derived confidence
badge (from existing step `verified` ratios — High/Medium/Low, NO new confidence field,
maps through the real trust ladder) + updated-ago.
Detail (image13): `WorkflowEditor.tsx` (639) presentation rebuilt: numbered step cards
(Type/Tool/Output from existing step fields), exceptions strip (from `spine_slots.
exceptions`), hidden-steps strip (existing soft_hide overlays), recent-edits strip
(existing overlay history), right details panel per selected step (trigger/tools/input/
output/notes/step confidence from `slot_scores`). Edit ops, SOP drawer, Blueprint export
all kept — nothing hidden that matters, everything gets a place.

### E+F — The live room (BIG)
One `LiveRoom` experience per image20/19: slim presence bar (orb tile + waveform +
state + time — Concept A held), transcript owns the page, controls docked; right-side
**Captured live** panel; agent state indicator Listening / Thinking / Saving; text mode
= same room, "Voice off · Text mode", same panel. Left workspace nav KEPT for
workspace-side rooms; respondent /i/token rooms render the same core without the shell.
Captured-live mechanics (net-new — there is no live extraction today, codemap Area 5):
a per-turn structural extractor writes to a `live_captures` table (teams, systems,
workflow mentions, decision rules, goals — STRUCTURAL items only; sentiment quarantine
holds at the data layer; badges map through the real trust ladder, a live single-source
item is Reported at most — A18 guardrail). Panel states: "Just added" (spinner) →
"Saved" (checkmark) exactly as the mock. Runs on the strong model first
(make-it-work-then-cheap); it is fed the turn delta only, so cost is bounded.
Motion: drawerSpring vocabulary, no new curves.
F inside the room: unobtrusive reconnecting pill + auto-recovery "Reconnected" confirm +
manual retry, transcript preserved (already server-side); state timeline shows the
reconnect (image20). Root-cause lane: pull VAPI logs + webhook timing for today's drops
before changing behavior. Text latency: instrument the turn path (1 LLM call baseline),
then stream the interviewer reply token-by-token to the room (SSE) so perceived latency
drops without touching the pipeline contract.

### J — Play this character
`RolePlaySection.tsx:231` raw-MD box becomes an overview card (role · goals · context ·
key behaviors, parsed from the brief's sections) with expandable details; "Full brief"
becomes a secondary tab rendering the raw MD verbatim. No backend change.

### K — Interview hub (HARDEST)
K1 Plan page (image21): `PlanView.tsx` (767) relayout into calm two-column — left:
collapsible Goal / Known context / Definition of done / Handling notes; right: Refine
plan + Suggested questions grouped by topic as accordions with counts + Expand all.
Est-time + Back / Save draft / Review interview footer. Spacing verified at 1440 AND
390 before the commit lands (the embarrassment clause).
K2 New-interview assign flow (image18): one screen — employee details, structure
(voice/text + language + deadline), draft-plan preview chips, readiness checklist,
left "Add details for Nexus" box that applies input via the EXISTING refine-chat
endpoint and shows what it changed ("Nexus will apply your input" checklist). Gate
untouched.
K3 Hub: Interviews rows become stage cards (Plan → Observe → Report → Follow-up rail +
one next action). K4 Observe: topic coverage made legible, transcript visually joined
to the insight rail, less scrolling. K5 Report: stage rail + section order (findings
first), less clutter. K6 Follow-up becomes real: "Add to plan" items on the report
compose a DRAFT follow-up plan (existing plan-generation path, new entry point) — the
stage stops being a mystery.
Plan-chat dynamic update (Kaan: "one of the hardest builds") — concrete proposal in
§6 Kaan-confirm #4 rather than a guess.

### I — Simulations (DO LAST, think-not-patch)
Per SIMULATIONS-RETHINK option (c)-light: the page becomes workspace-scoped —
value statement ("pressure-test the interviewer against YOUR workflows before a real
person gets a link"), scenarios derived from THIS company's real workflows/records,
each explaining what it tests and why; quick run controls; Run opens the upgraded
LiveRoom adapted to the scenario (roleplay kind, firewalled from compile as today).
Global cast/proving record moves behind "How Nexus is tested" link. Detailed design
happens after E ships (it reuses the room); build LAST per Kaan's order.

## 5 · NEW components (genuinely necessary, nothing else)

1. `SnapshotIntro` (B) — the one-CTA landing.
2. `LiveRoom` family + `CapturedLivePanel` + `AgentStateIndicator` (E) — the mock's core.
3. `live_captures` table + per-turn extractor + `GET /live-captures` (E) — no live data
   exists today; this is the minimum to make the panel honest instead of theatrical.
4. `StageRail` (K) — four stages, one small component reused on four surfaces.
5. Migration 0021: `workspaces.sort_order`, `workflows.department`,
   `workflows.description`, `live_captures` (one migration, applied by hand to live per
   deploy protocol).
6. `DELETE /api/workspaces/{id}` + preview endpoint + `delete_workspace` cascade (A).
7. Confident-only department classifier addition to the schema-builder prompt (C).

Returning previously-discussed-but-unbuilt ideas — only these, each because it serves
simplification: per-workspace simulations (SIMULATIONS-RETHINK (c), serves I directly);
follow-up-plan-from-report (YC-audit era idea, serves K6). NOT returning: the 1500ms
utterance assembler (UI-DEBATE deliberate no-op — problem does not occur), the (i)
preamble-disclosure component (rejected July 9), coverage_routing default-on (Kaan
verdict v9 holds).

## 6 · Kaan should confirm (waits or ships-with-flag as noted)

1. **Delete-company cascade semantics (WAITS for nod before the destructive commit).**
   Proposal: one transaction removes the workspace and EVERYTHING scoped to it —
   sessions, utterances, claims, conflicts, pain scores, workflows+SOPs+overlays,
   snapshot cards, plans+transitions, entities, scrape sources, heuristics, promises,
   opportunities, voice config, report shares. Deliberate departures from the
   interview-delete precedent, because the tenant itself ceases to exist: sealed flags
   are DELETED too (retention would keep a disclosure with no tenant context —
   **flagged to Emre**, his protocol owns the ruling); agent_runs RETAINED with
   workspace ref nulled (internal cost/audit record, not client data). Demo tenants
   deletable like any other; A12 firewall unaffected. Dialog shows exact counts.
   The preview endpoint + dialog + reorder ship first; the destructive endpoint lands
   behind the confirm.
2. **CEO welcome + done copy final wording (ships now, wording pass later).** The
   attribution sentence is the sensitive line: "What you share builds your company's
   snapshot and is attributed to you as its source." Kaan+Emre polish invited.
3. **Simulations relocation of the global proving record** behind a "How Nexus is
   tested" link (capability relocated, not removed — but it is a visibility change to
   a trust surface, so: veto window before the I build starts, which is last anyway).
4. **Plan-chat live-update mechanics (K).** Proposal: keep the existing bounded
   refine-chat (server applies edits + change_log); add section-level live diff — the
   chat reply streams, then changed plan sections flash-highlight and update in place,
   with an "Applied: N changes" chip linking to the change log. NOT proposed: freeform
   LLM rewriting of the whole plan per message (fights the gate + audit trail).
   If you want true while-you-talk incremental updates (multiple applies per message),
   say so — it changes the endpoint contract.
5. **Snapshot restructure depth.** Regrouping SnapshotView into the intro's category
   sections is a visible change to the flagship surface. Two-line pre-review will land
   in SPRINT-STATE before the commit; veto there if the flat card wall should stay.
6. **Naming table** (docs/NAMING-PROPOSALS.md): zero-cost renames, your circles, say
   the word (headline: Agent Skills → Playbooks).

## 7 · Execution order (A28: every behavior change its own revertable commit)

Lanes after the plan commit (teammates as judged): **lane-1 A** (schema+reorder, then
delete behind confirm) → **lane-2 D+B+G** (copy branch, intro page, done page — small,
high-visibility) → **lane-3 C** (workflows) → **lane-4 E+F** (live room, biggest) →
**K** (after E ships its room primitives; K1 spacing fix can start earlier) → **J**
(small, anytime) → **I last**. Phase 3 coherence rides each lane that touches copy
(D/E/G especially). Phase 4 sweep closes the sprint: full suites, prod walk of every
changed surface at both widths, delta review, honest verdicts in SPRINT-STATE.

Audit findings from the Phase 0 prod walk merge into lane scope as they land
(docs/SIMPLIFY-AUDIT.md); anything the walk finds that this plan doesn't cover gets
appended here with its own commit before build starts on the affected surface.

## 8 · Phase 0 audit amendments (appended as findings land)

**AMENDMENT 1 (P0, foundation) — responsive AppShell.** The prod walk found there is NO
mobile layout on any /w/* page: the sidebar never collapses, so at 390px content is
crushed to a ~154px column with horizontal overflow (plan detail renders 29,407px tall).
Fix is a shared foundation change, not per-feature: AppShell gains a real breakpoint —
sidebar becomes a slide-over drawer behind a header hamburger below lg, content goes
full-width, tap targets sized for touch. Lands BEFORE the E room and K hub builds so
their 390px acceptance is testable. Own lane, own commit (A28: strictly simpler for the
user — the pages become usable on a phone).

**AMENDMENT 3 (IA, Kaan-confirm #7) — the four-tab claim duplication.** The audit found
the same claim data rendered on FOUR surfaces (Home snapshot, Company Context, Insights,
Report) with three different names for next-round questions, and Insights adding little
over Home+Report. Proposal for Kaan (NOT built without a nod, it removes a nav surface):
fold Insights' unique content (conflicts, perception gaps, automation opportunities)
into the restructured snapshot's Priorities/Open-questions sections + the report, and
retire the Insights nav item; alternatively keep the tab but dedupe (each fact renders
on exactly one primary surface, others link). Either way, ONE name for next-round
questions everywhere. Recommendation: fold — 7 nav items becomes 6, and the audit shows
the tab is mostly duplication (#4, #8, #10). Waits for Kaan.

**AMENDMENT 4 (folds into existing lanes):** Home + Interviews render content in the
left ~625-730px of 1440 with a dead right half (inconsistent with Report/Context) — the
B lane (Home intro) and K lane (hub) own their pages' width discipline. The
Observe-view claims sidebar stops being called "Insights" (collides with the nav tab);
K lane picks the label (e.g. "Live notes"). Settings' opener preview shows only the
employee opener — after D lands, it labels which opener it shows (D lane, one line).

**AMENDMENT 2 (folds into K scope, task #9):** /interviews and /plans are two separate
pages listing the same people with overlapping status pills and report links, and /plans
has no nav item despite being central — confirms the plan's K3 hub combine; the K lane
treats merging these two lists into the staged hub as in-scope, not optional. The
suggested-questions column measured at 254px wide x 1614px tall with three mixed content
widths on one page — the K1 relayout acceptance numbers.
