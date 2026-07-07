# Nexus — Ultimate Version Merge Plan

**Date:** July 6, 2026 · **Author:** Claude (Fable 5) with Kaan
**Inputs:** Drive stage docs 0–11 · nexus-stage-review (37 flags) · EK's Feedback (post-build) · Tunç's backend (`nexus_backend-main`) + frontend (`nexus-web-app`) · UI mockups (Stages 5/6/8, Create Own Interview) · theory corpus (spine, agent psychology, failure taxonomy, what-if scenarios)

---

## Architecture decision — what we keep, extend, add

| Layer | Decision | Why |
|---|---|---|
| Backend engine | **Keep** Tunç's FastAPI + Postgres + pgvector | Job queue, agent_configs, prompt versioning, audit trail are production-grade. Rewriting loses months. |
| Frontend | **Keep shell, rebuild screens** to the mockups | Routing/auth/API layer is solid; the screens change to Snapshot / Interview Plan / Report designs. |
| Ontology | **Extend** findings → full Stage 4 claim records | The backend's `findings` table is a proto-claim-record; we add kind/topic/tag, not replace. |
| Voice | **Add** VAPI as a sidecar on `run_interview_turn` | The turn engine is transport-agnostic. Voice is a new entrance, not a rewrite. |
| Models | **Fix first** — tier via existing `agent_configs` | EK's #1 finding: gpt-4o-mini was doing the hardest work ungrounded. |

---

## Phase 0 — Foundation fixes (do before any feature work)

The EK quick wins. Half the perceived quality gap dies here.

1. **Model tiering.** `agent_configs` already supports this — no schema change. Strong model (Claude Sonnet 4.6+) for `interview_agent`, `finding_extractor`, `interview_plan_generator`, `diff_generator`; cheap model for chunking, embedding, mechanical scoring. Then rerun the Cambridge Audio transcript and diff the candidate list — this is the A/B test EK prescribed, and it recalibrates what's still worth fixing.
2. **Retrieval grounding.** Any generation step that claims KB grounding must have non-empty `retrieval_queries`; fail loudly otherwise. Fix KB semantic search relevance (the design-briefing query must return the design-briefing finding).
3. **Security/guardrail patches.** Hard exclusion list: interview plans may never request credentials/demo access (plan-generation + interview layers + eval test). Interview invite tokens get expiry + single-session binding; remove the "Mark Complete" skip. Scrub raw errors, temp passwords, and JSON provenance dumps from client-facing surfaces.

## Phase 1 — The claim ontology (Stage 4 compiler)

The product's soul. Everything downstream renders from this.

- **Schema extension** on `findings` (+ enums): `kind` (statement / directive / admission / correction), `topic` (pain, process-step, person, tool, vocabulary, time-or-cost, company-fact, success-criteria), `tag` (GUESS / CLAIMED / CONFIRMED; SCRAPED as rank-below-GUESS on the same ladder — F22), `sentiment_flag` + `approach_note` (quarantine), `mention_count`, `supersedes_id`, speaker + session provenance. Evidence quote + timestamp already exist — keep.
- **Compiler prompt** implements the review corrections: CONFIRMED requires *episodic*, not merely firsthand (F19); corrections may supersede any prior record incl. scraped (F18); hedge detection is full-utterance judgment with EN+TR lexicons as the minimum trigger set, plus uptalk/trailing-off cues (F20). Expect 60+ records per 30-min call (F23).
- **Sentiment quarantine** enforced at the data layer: fact+judgment utterances split into two records; quarantined records excluded from every client-visible query by default (deny-by-default view, not filter-per-screen).
- **Entity registry** (EK 2.1): canonical person/department/system records with aliases, role, and vendor/client flag. Vendor-side people can never become client entities. Prerequisite for cross-interview memory.
- **Pain scoring v1** (F28): only `topic=pain` claims scored; score = frequency × mention_count; displayed as coarse bands, never decimals.
- **Eval:** sample records → does the quote actually support the claim (Tunç's eval). Canonical test: the 40→10 minutes retraction must supersede.

## Phase 2 — Pipeline front end (Stages 0–2)

- **Stage 0:** signup + manual approval gate + email-domain-matches-website check (F9).
- **Stage 1:** Firecrawl exists — add Apify LinkedIn people scrape; everything lands as SCRAPED records; people pool feeds name-matching (call-mentioned names → confirmed or NEW-PERSON).
- **Stage 2:** hypothesis records with falsifiable granularity (F12), auto-scored at Stage 4 compile (confirmed/busted/partial, credited only when raised unprompted — F13). Human briefing stripped of pain hypotheses (F1, decided).

## Phase 3 — Snapshot + Human Gate (Stages 5–6, the mockup screens)

- **Company Snapshot page:** Learned cards with confidence badges (split High = single source from Verified = independent agreement, F35), Areas to Investigate with pain bands, Suggested People with why-lines carrying responsibility facts only (F34), Evidence rail with transcript deep-links. Interview-sourced evidence paraphrased in client views (F33); perception-gap reveals held for the Stage 8 report (F27). Append-only re-render after each compiled session; no mid-interview updates.
- **Interview Plan page:** mission sections (Goal / Known Context locked / Topics with must-hit + nice-to-have tiers / Definition of Done / Handling Notes), Refine Plan chat that converts plain language into machine rules with a live audited change log, Suggested Questions with open-form enforcement (leading questions auto-reformulated, rewrite shown).
- **Plan lifecycle state machine** (one source of truth; UI renders state): DRAFT → NEXUS CHECK → AWAITING APPROVAL → APPROVED → SENT → OPENED → IN PROGRESS → PAUSED → COMPLETED → COMPILED, exits NO RESPONSE / REVOKED. Custom-path order flip (admin approves, then Nexus check). Batch approval for the initial set (F37). SUPPRESSED-BY-ADMIN mechanic + automatic indirect-route proposal (F30, F36).
- **Handoff package builder:** the runtime agent receives objectives, questions, rules/NEVER list, vocabulary, approach notes, DoD, time budget — never claim text, never quarantined records. Enforced at package construction, not by prompt discipline.
- **Invite email** (SendGrid exists): benefit-framed subject, locked purpose block, consent line, one reminder max. Pre-interview consent landing page with explicit start action.

## Phase 4 — The interview agent (Stage 7 — the unwritten stage)

- **System prompt** built from the psychology corpus, organized as controls for the two AI-native biases:
  - *Anti-under-probing:* per-objective completion conditions ("enough evidence" per topic), coverage tracking, route next question to highest-value unsatisfied objective, close with reflect-back summary.
  - *Anti-sycophancy:* capture-don't-endorse, acknowledge without agreeing, no evaluative reflections ("sounds time-consuming!" banned), claims logged as hypotheses.
  - *CIT techniques:* mental reinstatement, report-everything framing, perspective shifts, backward recall for exceptions.
  - *Self-sourced examples rule (July 4 consensus):* example content only from the respondent's own prior turns or workflow structure; never a new content domain. Eval-guarded.
  - *Hard rules:* handling rules and NEVER list override objectives; vocabulary used verbatim; never reveals what anyone else said; pause offer at ~20 min with resumable state; TR/EN switch mid-interview.
- **Respondent trust (EK 3.2):** agent states sharing rules at open; pre-commit preview where the respondent can redact/de-attribute; person characterizations require explicit release; role-level attribution default for pain findings.
- **Eval suite:** the failure-mode taxonomy (Derail 1a–1d / Flatter 2a–2d / Freeze) + the 15 what-if trigger→guarded pairs as automated regression tests with an LLM judge, plus the credentials guard and the new-content-domain guard.

## Phase 5 — Voice layer

- **VAPI custom-LLM mode** (recommended over LiveKit for time-to-quality): VAPI owns telephony/web calls, STT, TTS, turn detection; our endpoint receives each user turn → existing `run_interview_turn` (priority 10) → streams the reply back.
- **Hedge preservation is non-negotiable:** transcripts must keep filler words, false starts, and word-level timestamps — the compiler's trust tagging feeds on hedges, and default STT cleanup destroys them. Configure verbatim transcription; store audio + raw transcript as an evidence source.
- **Latency budget:** first token < ~1.5s. Collision detector moves to async post-turn (never blocks the reply). Interview replies stream.
- **Pause/resume:** VAPI call end ≠ interview end; session state already supports resumable-by-token. Same link resumes.
- Text interview stays as the fallback modality (existing chat UI).

## Phase 6 — Report + perception gaps (Stage 8) and SOP (Stage 10)

- **Perception-gap engine:** CEO CLAIMED/GUESS time-or-cost records become baselines; operator CONFIRMED records auto-compared at compile; contradictions link both records as DISPUTED; resolved gaps render only in the report (F27). Conflict-resolution precedence (episodic beats habitual, firsthand beats secondhand) implemented once Emre delivers the F21 policy.
- **Post-Interview Report page** per mockup: workflow canvas with tool/action/input/output per step (the `build_workflow_schema` job exists) + Verified/Partial badges, PERCEPTION GAP banner, Key Findings, Follow Up On → add-to-plan, Interview Quality score (objectives satisfied / partial-dodged).
- **SOP generation:** clean document artifact (the pilot deliverable). Fix skill compiler output (deduped steps, no raw Python). Stage 11 (deployable skills) stays deferred pending the deliverable decision — but the step schema is already Spine-shaped.

## Phase 7 — Pilot hardening

Glossary freeze (split "candidate" into opportunity / knowledge gap / website suggestion — names follow, EK 4.1). One state machine per run; server-side revision persistence; run history; Reviewer role path fixed; timestamp/truncation polish. Policy docs enforced in code: cross-client boundary (F2 — hypothesis accuracy compounds, client records never cross), employee data (F4 — names + roles only). E2E dress rehearsal: Bee Goddess transcript → compile → snapshot → plan → gate → voice interview → report.

---

## Execution model

Agent team (terminal CLI, tmux), five roles, three waves:

- **Wave 1 (parallel):** `backend-ontology` (Phases 0–1) · `prompts-evals` (Phase 4 prompt + eval suite, testable against text chat immediately) · `frontend` (Phase 3 screens against mocked API).
- **Wave 2 (parallel):** `backend-pipeline` (Phase 2 + Phase 6 engine) · `voice` (Phase 5) · frontend continues (report screens).
- **Wave 3:** `qa-integration` (Phase 7 + E2E) with everyone fixing findings.

**Estimates (wall-clock with the team):** Demo-ready happy path (Phases 0, 1, 3, 4, 5 core) ≈ **3–4 focused days**. Pilot-ready full plan ≈ **2–3 weeks**, dominated by voice tuning and eval iteration, not code volume.

## Decisions needed from Kaan (blocking)

1. **VAPI vs LiveKit** — recommend VAPI; confirm and create the account.
2. **Keys/infra:** Anthropic API key, VAPI key, Apify token, hosting for the backend (Dockerfile exists — Railway/Fly/Render) + Postgres with pgvector.
3. **Repo strategy with Tunç:** superseded — see Addendum §A7 (fresh repo, selective vendoring).
4. **The deliverable question (EK's existential item):** what does the customer run on Monday morning? Determines Stage 11 scope. Can be decided during Wave 1, but not after.
5. **From Emre:** F21 conflict-resolution policy + hedge lexicon audit (both named as his in the review).

---

# Addendum — July 5 call decisions (both Kaan ↔ Emre sessions)

Extracted from the two Fireflies transcripts (59 min + 101 min, July 5). These amend the phases above.

## A1 — Naming and framing (Phase 1–2 amendments)
- **"Hypothesis" → "heuristic"** for Stage 2 pre-call outputs (Emre: a hypothesis biases toward proving; a heuristic is a prior you expect to be wrong sometimes). The *hypotheses* in the system are the CEO's own beliefs, tested post-call in Stages 4–6. Rename in schema, prompts, UI copy.
- **README/product objective statement** (goes at top of repo README and feeds every stage prompt): *Nexus is a world-class interviewer and context extractor. It finds context, not solutions.* Each stage doc's objective becomes that stage agent's system instruction.

## A2 — Trust ladder refinements (Phase 1 amendments)
- **Weighting rule for the compiler prompt:** scraped data ≈ 20% reference weight, transcript ≈ 80%; unconfirmed SCRAPED data never overrides call data; stale-scrape failsafe required (out-of-date website must not embarrass the call — Tunç's flag).
- **VERIFIED tier confirmed:** cross-source agreement (e.g., CEO CONFIRMED + employee agrees) → VERIFIED. Single-source confirmed stays CONFIRMED. (Matches F35.)
- **Pain score is LLM-judged, not a formula.** Emre owns the anchored rubric; implement as LLM-rater over typed pain claims (emotional weight, mention count ≥3 as signals), output coarse bands. Replaces the "frequency × mention_count" formula in Phase 1.
- Hedge-lexicon audit and per-stage system prompt drafts: Emre, in progress (his deliverables — integrate when they land).

## A3 — Snapshot behavior (Phase 3 amendments)
- **Update batching decided (stricter than F27):** snapshot updates only after a full interview round completes — never mid-interview, never per-interview while a round is open. Prevents attribution ("the exec knows who was just interviewed") and confabulation across concurrent interviews.
- **No verbatim attributed quotes from employee interviews anywhere client-visible.** CEO-call quotes with timestamps stay (his own words).
- **Direction asymmetry (both agreed):** interview agent NEVER reveals anything CEO said (absolute). The CEO-private snapshot MAY carry synthesized sensitive observations, but worker-sourced person characterizations are filtered for weaponization risk (source + agenda matter — Emre's Burak example).
- **Areas-to-Investigate click → sidebar:** why ranked here · what we believe so far · evidence · **what we don't know yet** · actions: *Add to Interview Plan* and *Add context (chat with Nexus)*.
- **CEO chat-with-context:** CEO-added context compiles like any utterance (claim records, CLAIMED at best), adjusts interview plans or spawns follow-up questions for already-interviewed people. Same compile-first rule as the custom path.
- **Conflict points section on the dashboard:** first-class UI for contradictions — CEO vs floor AND worker vs worker (the Marmara mint example). Positioned as "golden data," feeds the meeting-worthy findings.
- **Knowledge base view:** Obsidian-style graph visualization of company context (people/processes/tools nodes) + chat box. Wow-factor feature, phase 2 of the UI work, not the demo path.

## A4 — Gate and send flow (Phase 3 amendments)
- **"Start Interview" → "Send Interview".** Flow: CEO fills interviewee details (name pre-filled if known, email manual, job title) → message preview → send → status tracking (SENT/OPENED/…).
- **No decline button** (bias risk). Non-response is the signal; dashboard shows it aging; one gentle reminder (abandoned-checkout pattern). Declines happen offline; status + reason visible to Nexus team only.
- **Review order confirmed:** Nexus team check happens BEFORE the admin sees any plan (early engagements; spot-check later at SaaS scale).

## A5 — Interview runtime (Phase 4–5 amendments)
- **Pause feature required (Ontora parity):** after ~20 min the agent offers a pause with estimated minutes remaining; same link resumes. Time budget per objective stays soft; live emotion/rush detection (Hume-style prosody) is explicitly **phase 2** — logged, not built.
- **Stage 7 persona ships as an actual markdown system prompt** (You are Nexus… objectives, opening/closing moves, example sentences, hard rules) — not a description. The voice agent build starts the moment that file exists.
- **Prompt philosophy:** "make it expensive, make it work, then make it cheap" — rich JSON-structured context with per-industry examples first; token-optimize later.

## A6 — Custom interviews (Phase 3 amendment)
- Launch feature, but **assisted-only** (setup agent narrows the goal; never expose the spine/question bank raw — the Coca-Cola secret sauce concern). Usage caps/tokens later.

## A7 — Repo strategy (supersedes "keep and extend")
Decision: **fresh repo (`nexus`), selective vendoring — not a fork, not from zero.**
- **Carry over (proven, ontology-neutral):** job queue + SKIP LOCKED worker pattern, agent_runs audit + prompt versioning, auth/tenancy structure, pgvector setup, SendGrid/Firecrawl service wrappers.
- **Write fresh to spec (the parts the old data model would fight):** claim-record schema + compiler, snapshot renderer, plan lifecycle + gate, interview agent + persona, perception-gap/conflict engine, all system prompts, the new UI screens.
- **Deliberately killed (do not carry):** the "candidate" conflation (splits into opportunity / knowledge gap / website suggestion), gpt-4o-mini defaults, website-content-as-candidates, the compiled-skill markdown dump, debug surfaces in client UI.
- Rationale: the ontology is the product; grafting it onto tables shaped by the old conflation costs more than re-laying them, while the chassis pieces are genuinely good and port cleanly. Tunç's repos stay untouched as reference + his own track.

## A9 — Generation manifest (the carefully-authored artifacts, not code)

Every artifact below is generated from named source docs with traceability — no free-styling. The rubric + the record store are the product; these files ARE the IP.

**Agent system prompts (12, covering stages 0–8 + 10; stages 9/11 deferred):**
1. Stage 1 recon agent (scrape structuring, SCRAPED tagging) — src: Stage 0&1 doc
2. Stage 2 heuristic generator + outcome scorer (falsifiable schema, F12/F13) — src: Stage 2 doc + call 1 rename
3. **Stage 4 compiler** (kinds/topics/tags, hedge judgment EN/TR, quarantine, supersede, 80/20 weighting) — src: Stage 4 doc + F18–F23 + call decisions. The crown jewel.
4. Pain-score LLM rater (anchored bands, worked examples) — src: Emre's rubric when it lands; placeholder from F28 + call 2
5. Interview plan generator (objectives from records, open-question enforcement) — src: Stage 6 doc
6. Plan refine-chat agent (plain language → machine rules, audit) — src: Stage 6 doc
7. **Stage 7 interviewer persona** (voice-ready markdown: identity, objectives, opening/closing moves, example sentences, hard rules, pause, TR/EN) — src: agent psychology page + guardrails + failure taxonomy + EK 1.3/1.5 + Emre's draft when it lands
8. Collision detector / conflict linker — src: Stage 4 + EK 2.2
9. Perception-gap comparator (+ F21 precedence when Emre delivers) — src: Stage 4 ladder + Stage 8
10. Snapshot renderer prompts (card synthesis, why-lines facts-only) — src: Stage 5 doc + F33/F34
11. Report + SOP generator — src: Stage 8 mockups + spine schema
12. Nexus-check reviewer agent (suppression flags, leading-question catch, credential guard) — src: Stage 6 hard rules + EK 1.4

**Personas & human-experience copy:** interviewer stance variants per interviewee read (anxious operator / proud maker / skeptical foreman), invite email (locked purpose block + consent line), pre-interview consent landing, pause/resume lines, reflect-back closing. TR + EN.

**Rubrics & lexicons:** pain bands · interview-quality score · spine-slot sufficiency (0/1/2 + buildable) · hedge lexicon EN/TR + non-lexical rules (uptalk, trailing off) — Emre audits, we ship v1.

**Eval assets:** golden transcripts (Ece/Bee Goddess + Cambridge Audio + one synthetic per industry) with expected-record fixtures · the 15 what-if trigger→guarded tests · tagging pairs (Kaan's Apollo two-phrasings example) · canonical regressions: 40→10 retraction supersedes, "I'm ready to begin" = filler, credentials request = fail, new-content-domain = fail.

**Glossary & policies:** frozen term list (interview everywhere client-facing; candidate split into opportunity/gap/suggestion) · cross-client boundary (F2) · employee data (F4) · conflict resolution (F21, Emre).

## A10 — Product identity decision (what Nexus outputs — settled for this build)

Emre's psychology corpus was written when Nexus's endpoint was 100% skill generation (the spine/survey era). The product has evolved; this build adopts the July 5 definition and does not let the old framing distort it:

**Nexus is a world-class interviewer and context extractor. Its outputs are: (1) the trust-tagged record store, (2) the living Company Snapshot, (3) conflict + perception-gap findings, (4) verified workflow maps, (5) SOP documents (Stage 10).**

**Executable skill generation is NOT a v1 output.** Rationale: the calls settled "Nexus finds context, not solutions"; EK's review showed the compiled-skill artifact was diagnosis-shaped anyway; and the deliverable question is a commercial decision that shouldn't block the build. What we preserve so it stays fixable later: every workflow step carries spine-slot metadata (task/trigger/steps/rules/exceptions/tools/output/success/examples), and slot-sufficiency scoring stays in the schema — so a future skill compiler consumes the record store without redesign. The spine survives as the *completeness rubric* ("is this workflow fully understood?"), decoupled from the promise of automation.

Psychology corpus transfer rule: everything about interview conduct (episodic elicitation, anti-sycophancy, completion conditions, trust framing) transfers 100%. Only output-framing items get reinterpreted (e.g., "done = skill creator can build with zero follow-ups" → "done = workflow documented to spine-completeness").

## A8 — Task absorption (from the calls' action items → build objectives)
Owned by the build now: Stage 7 interviewer system prompt (md, voice-ready) · per-stage agent system prompts (JSON-context style, industry examples) · send-interview flow implementation · no-decline/no-response handling · pause/resume · Stage 5 sidebar + CEO context chat · conflict points UI · README objective statement · Stage 8 sidebar UI prompt outputs. Pending from Emre (integrate on arrival): Stage 3/6/7 doc finals, persona draft, hedge audit, pain rubric, conflict-resolution policy.

## A11 — v1 build decisions (Kaan's answers, July 6)

1. **Audience & bar:** Emre first, Tunç second, real client call in ~3 days. Build to client-grade: mockup-quality UI/UX on the happy path AND presentation-clean architecture (both audiences matter).
2. **Language:** English first; Turkish designed-in (hedge lexicon, persona lines, invite copy structured for easy TR addition), not tuned v1.
3. **Bee Goddess is fictional.** Stage 1 runs against fixtures for the demo storyline; live-scrape mode still built (needed for the real client in 3 days). Emre's stage 3/6/7 docs land tomorrow — integrate on arrival, v1 placeholders ours.
4. **Voice:** sensible default chosen by build (one male + one female variant, warm-professional); dedicated voice-selection session with Kaan later. Hume = phase 2 analytics, not v1.
5. **Auth: none.** Workspace-picker page with seeded companies (matches the mockup's "click your admin portal" cards) — internal use only. Interview links stay token-based (unauthenticated by design). Real auth is a later layer; nothing in the schema assumes its absence.
6. **Repo:** Tunç gets access and may work in it. Vendored pieces attributed in reference/SOURCES.md + brief "why we kept/killed" notes; history kept clean.

## A12 — Real client roster + bias firewall (July 6)

Clients: **Bee Goddess** (jewelry — yes, the demo subject is a real prospect) · **Time PR** (Mine Kalpakcıoğlu — PR/comms) · **Marmara Hotels Taksim** (hospitality — also the subject of Emre's mint example).

Four contamination risks, four rules:

1. **Fixture ≠ reality.** The Ece transcript, Burak/Mia/Selin, and every demo record are fiction. Demo workspace carries a hard `is_demo` flag; real engagements start as fresh tenants with ZERO fixture records. When the real Bee Goddess engagement begins, nothing from the demo storyline exists in their workspace — the system must not "remember" fictional employees at a real company.
2. **Prompt examples teach format, not facts.** Worked examples in agent prompts stay multi-industry (jewelry, hospitality, agency, accounting) so no single client's industry dominates the model's priors. Conveniently, the planned example library already covers all three client industries.
3. **Eval fixtures get fictional names.** Emre's "Marmara Hotel" mint scenario is renamed to a fictional hotel in our eval suite — we do not test with a real prospect's name in the fixtures.
4. **Cross-client boundary (F2) is now live, not theoretical.** What compounds across clients is per-industry heuristic accuracy only — never records, names, or workflows. Three real tenants makes this enforcement day-one, not someday.

**Language priority upgraded:** all three clients are Turkish companies. English remains the build language, but TR interview capability (invite copy, interviewer persona lines, hedge lexicon already in compiler) moves from "designed-in" to "tested before the first real call."

## A13 — Simplification pass + go decisions (July 6, night)

1. **English assumed sufficient** for all three clients — TR drops back to designed-in, not tested-for-launch. What stays: the interviewer must adapt its register to *who* it's talking to (founder vs frontline housekeeping vs PR account manager) — persona stance variants cover this, language does not block.
2. **Brand-as-config:** "Nexus" is a placeholder. Name, logo, and sender identity live in one config file — a future rename is a one-line change, not a refactor.
3. **Spend: green light for an aggressive build night.** Strong models in every seat during development; cost optimization is a later phase (matches "make it expensive, make it work, then make it cheap").
4. **Vendoring license confirmed:** Tunç's code is inspiration + parts bin; copy with judgment, engineering decisions ours.
5. **Research permission:** quick external research on real client companies is allowed whenever their reality would shape instructions — but per the bias firewall (A12), research informs *fixtures and heuristics*, never gets baked into agent prompts as facts.
6. **Target: demo-ready tomorrow; solid backend within 3 days.**

## A14 — Domain adaptability principle (Kaan's Stage 4 critique, accepted)

The compiler prompt (and every agent prompt) stays **lean and domain-neutral at its core**, and receives a **runtime-injected industry calibration block** per engagement. Rationale = the delta principle from the Stage 2 doc: Claude already carries the "10 years at MBB" domain knowledge — stuffing business-process examples into static prompts adds retrieval noise and overfits to whichever industries we happened to write down. Examples in the core prompt exist to calibrate *judgment style* (how to tag, how to split records), never to teach *domain facts*. Per-industry worked examples live in `prompts/examples/<industry>.md`, selected and injected by the pipeline per client. This is how the system does "each domain very well" without hardcoding any domain.

## A15 — UI build methodology (July 6 — Kaan's mandate: the screenshots are the spec)

The mockups are not inspiration — they are the reference. The UI is built with a **screenshot-driven loop**, not one-shot generation:

1. **Design tokens first.** Extract the visual system from the mockups (cream/orange palette, serif display + sans body, card radii, badge styles, left-nav pattern) into a single tokens file. Every screen reads from it — this is what guarantees consistency between screens.
2. **Component inventory before pages.** Confidence badge, pain-band chip, evidence quote card, must-hit/nice-to-have dots, plan-state chip, person row, workflow-step card — built once as a library, reused everywhere. Tunç's shadcn/Radix setup is the vendoring source where it fits.
3. **The compare loop (the "designer to chat with").** Each screen: build → render in the local app → screenshot → compare side-by-side against the target mockup → list deviations → fix → repeat until the diff is taste, not structure. The builder never ships a screen it hasn't visually compared against the reference.
4. **Alive, not static.** Live-updating cards as records compile, streaming interview transcript, plan-state transitions, subtle motion (framer-motion) on card entry and badge changes. Depth/3D touches only where they serve comprehension (the knowledge-graph view) — no decoration for its own sake.
5. **Simplify when the mockup overwhelms.** Emre's "five minutes to parse on a bad day" test governs: where a mockup packs too much, cut density before cutting features. Deviations from mockups get logged (one line) so Kaan can veto.
6. **Demo ≠ screenshot theater.** Every element renders from real records in the database — nothing hardcoded into JSX. The fixture data is what makes the demo look full; the code path is production's.

## A16 — V2 directive (July 6, post-build-night — Kaan)

V1 shipped and E2E-proven (see git history + evals/adjudication/). Kaan's V2 attack, decisions locked: (1) **Design**: evolve the warm identity to a "10k designer" bar — glass depth, Linear-grade detail, Notion density; reference galleries land-book.com + motionsites.ai; A15 methodology still governs. (2) **Chat-with-context agent**: full A3 loop built as read-only cited Q&A + explicit per-message "Add as context" (compiles via the standard path, CLAIMED at best) + plan changes as suggestions only. (3) **Workflow deliverable**: interactive editor + premium canvas + SOP export, ontology-safe (claim-derived steps never silently mutated; manual steps tagged MANUAL; edits audited). (4) **Deploy**: Vercel (frontend) + Railway (api + worker) + Supabase pooler. Full plan: docs/V2-PLAN.md. Standing additions: re-mine Tunç's repos for skipped gold each build; usage-limit economics — heavy work scheduled at quota resets.

## A17 — Admin auth + multi-company flow (July 6 morning — Kaan, supersedes A11.5)

Kaan's morning directive supersedes the A11 "no auth" decision: **admin logins now.** Minimal real auth via Supabase Auth email+password (already in the stack): login page in the V2 design, session, workspace scoping; no signup flow, admins created manually. Interview links (`/i/[token]`) stay token-based and unauthenticated by design. Alongside it, the multi-company admin flow becomes the core demo journey: workspace picker "Add company" (Stage 0 shape: name, industry, website, contact) → real tenant (A12 firewall holds: zero fixture records) → guided empty state → "Upload CEO call" (paste/txt/md) → standard compile path → snapshot renders progressively. Optional Stage 1 live-scrape button, best-effort only.

## A18 — Live-progress neutrality on the respondent surface (July 6 evening, sprint 2 — Kaan/watchtower; **EMRE-SEAM**)

The live interview room shows the respondent progress, but that progress must be **neutral**: topics-covered ticks, a listening/thinking state, and time remaining — **never the claims or content being extracted in real time.** Showing a person what is being captured *as they speak* triggers self-censorship (demand characteristics / observer effect): they start managing the record instead of describing the work, which is exactly the honest-capture failure the product exists to prevent (F28/A2). So the respondent sees "we're covering X of Y areas, still listening, ~N min left" — not a claims ticker.

The **admin-side** live view is the opposite: it MAY show the richer captured-points ticker (records landing as the interview runs), because no respondent psychology applies to the operator watching. Two audiences, two truths — same call as the sentiment-quarantine and paraphrase splits.

**EMRE-SEAM:** this is a psychology decision made at build time by engineering + watchtower judgment; **Emre's docs may refine it** — the exact neutral elements, whether a coverage count is even shown vs. a plain listening state, and any wording. Treat his deliverable as authoritative when it lands (diff, surface conflicts, never silently overwrite — per CLAUDE.md). Governs the sprint-2 live-interview-room lane.

## A19 — Sprint-2 UI design verdict on the GPT reference set (July 6 evening — Kaan/watchtower)

Reference images (GPT-generated) are taste-approved as the pixel target for the sprint-2 UI lanes. Kaan holds them; the lane can request PNGs dropped into `reference/ui-inspo/` for pixel reference. **ADOPT:**
- **Live-interview centerpiece (Lane C):** the dark orb panel — particle sphere, amplitude-reactive, mic waveform bar below.
- **Voice Settings (Lane B):** structure exactly as mocked — voice cards with play-preview, speed slider (default 0.9x), editable greeting incl. Turkish, and Voice / Behavior / Greetings / Advanced tabs.
- **Observer view (admin, Lane C):** timestamped insight cards + a topics-covered ring + an "Add insight" button.

**FOUR MANDATORY CORRECTIONS (these override the mock; the mock is wrong on each):**
1. **Trust badges on live insights come from the REAL trust ladder — never all-Verified.** The mock shows every live insight as "Verified"; that is exactly the lie we do not tell. An in-the-moment, single-source claim is at most the lowest "Reported/stated" tier — **"Verified" requires independent corroboration that a live, uncompiled claim does not have.** Non-negotiable #1 holds live: tags never upgrade in-the-moment; truth only emerges from comparing records after compile. Reuse the existing ladder primitive (`frontend/src/lib/trust.ts`, `ConfidenceBadge`, pinned by `badge-mapping.test.tsx`) — do not invent live-only badge logic.
2. **Observer vs. respondent are the same elements, different chrome.** The orb+transcript inside the admin shell (nav, breadcrumbs, company>person trail) is the OBSERVER view. The RESPONDENT room is the identical elements **chrome-free** — no nav, no breadcrumbs, no trail — a calm standalone frame. (Reinforces A18: the respondent surface is its own honest, low-pressure context.)
3. **No employee face photos anywhere — initials chips only** (ties to the sentiment-quarantine / name-handling posture: people are roles, not faces).
4. **Voice picker uses abstract waveform tiles, not human face photos** — name, gender, language chip, play-preview.

Everything else in the reference set is taste-approved. Binds Lanes B (#39) and C (#40).

**SEQUENCING (team-lead, same evening):** A19 is the NEXT build pass, not tonight's deploy. Tonight ships the built + green foundation — de-Burak, picker reorder, the voice-config backend + call wiring, Voice Settings (with the speed slider HIDDEN, see below), and the v1 interview room. A19 is a substantial new direction (dark particle orb replacing the warm v1, a brand-new Observer view, tabbed-settings restructure); starting that ground-up at this hour risks parking mid-broken, and the current work is a clean shippable baseline A19 refines — nothing built tonight is wasted, A19 is v2 of the same surfaces. **Correction #1 has no surface tonight:** the v1 room is A18-neutral (orb + transcript + neutral progress, NO live-insight badges), so no all-Verified violation ships — that guardrail binds the future Observer, which doesn't exist yet. Before the Observer ships, its live-badge mapping gets an audit-eng review and MUST reuse `trust.ts` + `ConfidenceBadge`. **Speed slider:** the mock shows a 0.9x speed control, but the Deepgram Aura voice provider has no speed param — the mock wants a knob the provider can't power. Tonight lane-b HIDES it (every-button-works); the A19 pass decides speed-capable-provider vs. drop-from-mock (team-lead flagged to Kaan).

## A20 — Global default voice = ElevenLabs "ryan" (July 7, Kaan casting verdict)

From the July 6-7 voice casting call (4 recipes, docs/VOICE-RESEARCH.md), Kaan called all
four and picked CASTING-B: ElevenLabs "ryan" (turbo v2.5, stability 0.45 / similarityBoost
0.75 / speakerBoost / optimizeStreamingLatency 3) + the humanizing block (firstMessageMode
"assistant-speaks-first" + canned fast opener, startSpeakingPlan waitSeconds 0.4 livekit,
stopSpeakingPlan numWords 0). Applied as the GLOBAL DEFAULT for all workspaces: both shared
default VAPI assistants (asteria 44d14d38, orion 0853702b) PATCHed to the ryan recipe, so
every uncustomized workspace resolves to ryan with the fast opener. Fixes the robotic/slow
opener Kaan flagged (root cause: model-generated first line). Per-workspace overrides via
the Voice Settings editor still win. Resolver default metadata updated to report ryan/M
honestly (voice_config.py).

**A20 completion (same morning, builder):** the recipe now lives in CODE, not just in the
hand-patched assistants, so no code path can silently revert it: (1) `vapi_assistant.py`
roster adds the ElevenLabs tier — ryan (M, the default) and sarah (F, casting-A) — with a
`provider`-aware `voice_block` emitting the exact casting recipe; ElevenLabs presets have no
public sample clip, so `preview_url` is None and the editor renders those cards without a
play button (honest preview). (2) `first_message_block` empty case => the canned fast opener,
never the model-generated mode; `build_assistant_config` timing aligned to the A20 humanizing
block (0.4s livekit, numWords 0) — so a Voice Settings save creates dedicated assistants on
the winning recipe instead of regressing to the pre-casting one. (3) `provision_vapi.py`
re-provisions BOTH shared assistants to the ryan recipe (re-running preserves, never reverts).
(4) docs/voice-config.md endpointing section revised to match. Speed slider stays hidden
(A19); ElevenLabs honors speed server-side when that lands.

**A20 correction (same morning, watchtower verification):** the initial patch put ryan on
BOTH shared assistants — a male voice on the (F) slot. Fixed: (F) = ElevenLabs "sarah"
(casting-A, same engine/settings), (M) stays ryan; the Voice Settings gender pick maps to a
gendered fallback again. Uncustomized workspaces still resolve to the M slot (ryan, THE
default); the F slot only serves F-tagged configs that never synced.
