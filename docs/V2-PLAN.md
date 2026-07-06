# V2 Attack Plan — "two times better" (Kaan directive, July 6 ~00:30)

Decisions locked with Kaan (see MERGE_PLAN A16). The 3:04 AM trigger executes this doc.

## The brief, optimized

Make Nexus read like a product a $10k designer built and a senior team engineered:
premium warm-light + glass design, no logic that doesn't tie up, a chat agent grounded
in the record store, an ontology-safe workflow editor, deployed on real infra.
"Impressed" is the acceptance bar; honesty rules from V1 still bind (no theater,
no silent fallbacks, evals stay live).

## Kaan's four decisions

1. **Design:** evolve the warm cream/orange identity — but to a "10k designer" bar.
   Glass-panel depth, Linear-grade micro-detail, Notion density control, real motion.
   Research first: land-book.com and motionsites.ai are Kaan's reference galleries;
   import good motion/3d libraries where they earn their weight.
2. **Chat agent:** target the full A3 loop, built carefully as Q&A + explicit capture:
   read-only answers with claim citations + trust badges by default; per-message
   "Add as context" compiles through the STANDARD compiler path (CLAIMED at best,
   same as custom path); plan adjustments surface as SUGGESTIONS, never silent edits.
3. **Credentials:** Kaan fills the checklist (docs/ENVIRONMENT.md §V2) into his doc;
   deploy config is prepped regardless and wired when they land.
4. **Workflow deliverable: INTERACTIVE EDITOR** — plus the premium canvas and SOP
   export (pilot deliverable stays). Ontology-safe editing rules:
   - claim-derived steps are never silently mutated; edits create annotations or
     admin-adjusted overlays with provenance
   - manually added steps are tagged MANUAL (not evidence-backed) and render distinctly
   - remove = soft hide, reversible; every edit audited (who/when/what)

## Sprint tasks (board #18–#25)

- **#18 Design system V2** (frontend): research pass on the two galleries → tokens v2
  (glass surfaces, elevation scale, motion vocabulary) → component overhaul. Gate:
  one screen (Snapshot) rebuilt to the new bar and screenshot-reviewed BEFORE the
  pattern replicates (A15.3 loop still governs).
- **#19 Screen-by-screen premium pass** (frontend): every surface consistent with V2
  system; density per Emre's 5-minute rule; motion serves comprehension.
- **#20 Chat-with-context agent** (backend + frontend): retrieval over
  client_visible_claims (+ embeddings), answers cite record ids rendered as
  evidence chips; "Add as context" → compile job; suggestion cards for plan deltas.
- **#21 Workflow editor + SOP export** (frontend + backend): canvas upgrade, edit
  operations per ontology rules above, SOP document generator (report_sop_generator
  prompt exists), export as clean doc.
- **#22 Deployment** (backend leads): Vercel (frontend) + Railway (api + worker,
  two processes) + Supabase via pooler DSN. Prep configs now; wire creds when Kaan
  delivers. EVAL_MODE stays OFF in deployed envs.
- **#23 Logic-consistency audit** (all lanes): V2 critique — what doesn't tie up
  (state chips vs server state, empty states, glossary-term drift, dead ends,
  cross-screen number mismatches). Findings → fixes → eval cases.
- **#24 Tunç re-mine** (prompts-evals): sweep reference/ for gold features V1 skipped
  — Kaan's standing instruction, applies to all builds.
- **#25 Interview volume** (background): more synthetic interviews across personas
  → richer demo data + more mining material. Cheap model where possible.

## Economics (Kaan's constraint: usage limits until ~3:00 AM SF)

- Pre-reset (now): planning docs, credentials checklist, deploy config prep,
  frontend design RESEARCH only (no mass rebuild), this file.
- Post-reset (3:04 AM trigger): full parallel build — #18/#19 (frontend),
  #20/#22 (backend), #23/#24/#25 (prompts-evals + background).
- Model discipline: strong models in design-judgment and agent seats; cheap/fast for
  mechanical sweeps and volume generation. Don't over-orchestrate (Kaan: "if it
  complicates, don't overdo it").

## Standing rules carried from V1

Pace rule (name regressions, never silently fall back) · fast inline hallucination
sweeps at seams · no mock in any conversation path · evals run after every prompt/
persona change · deviations from spec logged · taste batched to Kaan with
recommendations.

## Overnight orders (Kaan, via watchtower — binding for the 3:04 sprint)

1. **Quality bar:** build as if a VC sees it tomorrow morning and decides to invest.
   Depth and polish beat new surface area — perfect the existing thing before adding.
2. **Cleanliness:** delete dead code as you go; no orphan files, no TODO graveyards;
   ARCHITECTURE.md + directory READMEs stay true after every task; verification
   ritual (hallucination sweep · better-solution check · structure audit) every 45–60 min.
3. **Re-read source docs each pass** (reference/drive-stage-docs/, MERGE_PLAN, this file):
   Kaan suspects underestimated gems. If a better version than the spec exists, BUILD IT
   and log the named deviation for morning review — improving beats obeying; silent
   drift is forbidden.
4. **Limits protocol:** cap expected ~2h after 3:04. BEFORE parking: commit + push
   everything, write docs/SPRINT-STATE.md (one paragraph: done / in-flight / next),
   and arm the next resume trigger exactly like the 3:04 one. Never park uncommitted.
5. **Never idle, never make-work.** Standing backlog when the board empties:
   interview volume, eval expansion, polish passes, doc truth. Perfect little pieces,
   all night.

## Side orders (Kaan, decoded — judgment calls, logged decisions)

- **Nav/IA review:** current IA = overview / snapshot / interview plan / interviews /
  insights / knowledge base. During #23/#24 doc passes, re-mine the Ontora references
  + dashboard ideas in reference/drive-stage-docs/; if a better IA emerges, EVOLVE
  (never upend) and log renames as named deviations.
- **Every button works (hard rule, #19 acceptance):** no dead buttons, no decorative
  click targets — every element tied to a real action or removed. Anti-theater
  applies to the UI itself.
- **No em-dashes in client-facing copy** (UI strings, reports, invites, chat replies,
  SOPs): Kaan reads them as AI tells. Sweep existing copy, add to copy conventions
  (prompts/glossary-and-policies.md), lint check if cheap. Internal docs exempt.
- **Skill Blueprint (lead decision, logged):** skills generation stays OUT of v1
  promises, but a per-workflow "Skill Blueprint" export ships as a stretch item inside
  #21 — renders the spine slots + sufficiency the record store already carries as a
  premium artifact ("what an automation would need to know"), explicitly labeled
  non-executable. Cheap (reuses SOP export path), high wow, shows the moat without
  claiming deployment. If #21 core doesn't land tonight, this becomes a 3-line
  proposal in the morning packet instead.

## Upgrade license (Kaan) — F-registry clinical audit

Act as clinical/neuropsychologist over the F-registry (F1-F37) + failure taxonomy.
Emre's work is used and upgraded, never silently edited: every upgrade ships as a NEW
flag (F38+) with a one-line evidence rationale. Candidates to evaluate: acquiescence
bias (terse respondents), telescoping in time estimates, memory conflation across
similar episodes, demand characteristics, fundamental attribution error in CEO reads
of people, halo effects in proud-maker accounts, cognitive-load signals as data
(slowed speech near complex steps = tacit knowledge, not confusion). Where a new flag
changes agent behavior: wire the prompt AND add an eval case. All additions batch to
the morning packet as night-shift proposals for Emre — his lane stays his, we stock it.
