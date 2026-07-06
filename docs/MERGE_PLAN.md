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
