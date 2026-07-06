<!-- Sources: docs/MERGE_PLAN.md Phase 4 (eval suite) + A9 (eval assets) + Kaan eval-integrity directive (task #12).
     The honest coverage map. If this doc and a green test result disagree about how much we actually know,
     THIS doc wins — a passing test proves only what its fixture encodes. -->

# Nexus evals — the honest coverage map

**Principle (Kaan): realism over green checkmarks.** A passing eval proves *consistency with a fixture*, not
*correctness*. This doc says plainly what is tested, what is only provisionally tested, what is spec-only until
an engine or server exists, and what cannot be tested offline at all. Read it before quoting a pass rate.

## Status vocabulary

- **TESTED (live)** — runs against real model/engine output; result is trustworthy within the fixture's scope.
- **PROVISIONAL** — the fixture was calibrated from live model output, so it encodes "what the model did" as
  much as "what's correct." Freezes only after independent human adjudication. Not ground truth yet.
- **SPEC-ONLY** — the cases exist in the right schema but the runner/adapter or the target engine isn't wired
  yet; they document intended behavior and are ready to run when the dependency lands.
- **BLOCKED** — ready to run, waiting on infrastructure (e.g. a live EVAL_MODE server).
- **CANNOT-TEST-OFFLINE** — a property that only a live voice/telephony run can exercise (see §5).

## 1. Coverage map

| Area | What we check | Status | How / where |
|---|---|---|---|
| Interviewer — anti-derail | solutioning, tangents, outside analogies, leaking others' words | **TESTED (direct)** | `evals/interviewer/{failure-taxonomy,what-if-pairs}.yaml` via `harness` (direct adapter). Derail generalizes well (4/4 on fresh cases). |
| Interviewer — anti-sycophancy | evaluative reflections, praise, feeling-mirrors, person-judgments | **TESTED, GAP KNOWN** | Same suites pass; but fresh cases show it still **affirms quantified achievements** (see §6). |
| Interviewer — anti-under-probing | generalizations, number-source, exceptions | **TESTED, GAP KNOWN** | Fixed suite passes; fresh "freeze" cases fail — the real gap (see §6). |
| Interviewer — pause / TR-EN / vocabulary / NEVER-list | behavioral guards | **TESTED (direct)** | `what-if-pairs.yaml`. |
| Interviewer — long-interview drift (20+ turns) | objective tracking survives length; no fatigue-drift | **SPEC-ONLY (runner ready)** | `evals/interviewer/long-interview-drift.yaml` — the multi-turn scenario runner now exists (`harness.scenario_runner`, #32); this scenario still needs end-state judging wired (the runner does mid-turn judging today). |
| Interviewer — F42 halo (multi-turn, PROPOSED) | proud step's glow must not verify the adjacent claim | **TESTED (http), PROPOSED flag** | `evals/interviewer/f42-halo-scenario.yaml` via `harness.scenario_runner` (#32). Baseline **2/3 PASS** (real but intermittent). Test only; Emre ratifies F42. |
| Interviewer — held-out generalization | novel adversarial cases, rotated each run | **TESTED (direct)** | `scenario_gen.py` + sealed `heldout-overfit-check.yaml`. First run: 6/12 (see §6). |
| Compiler — kinds/topics/tags/quarantine/supersede/filler | canonical regressions | **TESTED (live)** | `evals/compiler/regressions.yaml` + `tagging-pairs.yaml`; verified against the live Bee-Goddess run. |
| Compiler — golden transcript → records | full extraction fidelity | **PROVISIONAL** | `golden-jewelry-*` — calibrated to live output; awaiting blind adjudication (`evals/adjudication/`). |
| Plan generator / nexus-check — leading questions | reformulate-to-open / flag | **TESTED (direct)** | `evals/plan/leading-question-catch.yaml` via `harness.plan_runner` (single-prompt adapter, #26). **5/5** after the #28 clean-question guard (was 4/5 — the generator over-rewrote an already-clean open question; the guard fixed lead-05 with no regression on the real leading cases). |
| Plan generator — hidden operational levers | signalled lever becomes an explicit must-hit; no signal invents nothing | **TESTED (direct)** | `evals/plan/hidden-lever-objectives.yaml` via `harness.plan_runner` (#21/#26). First run **5/5** (control invents nothing). |
| Perception-gap comparator | match / contradiction / partial + quarantine guard | **SPEC-ONLY** | `evals/compiler/perception-gap-cases.yaml` — aligns with backend #11 engine. |
| Handoff builder — no-leak | strips claim text / known_context / quarantined | **TESTED (backend)** | backend asserts on construction (verified with the "founder quotes ~10 days" fixture). |
| Frontend — badge/quarantine rendering | tag→badge, quarantine-never-renders, coarse pain, no-decline | **SPEC-ONLY (frontend owns tests)** | `evals/frontend/badge-mapping-spec.yaml` — handed to frontend as unit-test expectations. |
| Interviewer via REAL runtime | the whole persona over the actual turn engine | **TESTED (live)** | `harness --adapter http` against the EVAL_MODE server. Real-engine baseline 23/26 + 2/3 heldout (§6). |
| Anti-theater / mock-detection | the engine generates fresh replies, not a canned script | **TESTED (live)** | `mock_detection.py` — two fresh sessions, same turn, replies must NOT be byte-identical; runs as an http-suite preflight; PASS on the live engine. |
| Pain rater | coarse-band judgment | **UNTESTED** | v1 rubric ships; Emre's anchored rubric + a rater eval land later. |
| Voice — endpointing / prosody / latency / barge-in | see §5 | **CANNOT-TEST-OFFLINE** | live VAPI dress rehearsal only. |

## 2. How to run

```
export ANTHROPIC_API_KEY=...
python -m evals.harness --adapter direct --suite all            # 26 fixed interviewer cases
python -m evals.harness --adapter direct --suite heldout        # 3 sealed overfit-check cases
python -m evals.harness.scenario_gen --n 2 --out evals/interviewer/generated/$(date +%s).yaml
python -m evals.harness --file <that file> --adapter direct     # fresh held-out stream
python -m evals.harness --adapter http --base-url http://HOST --suite all   # real runtime (auto anti-theater preflight)
python -m evals.harness.mock_detection --base-url http://HOST                # anti-theater check on its own
```
The compiler/plan/perception-gap/frontend YAMLs are LLM-judge-runnable specs (schema in `evals/README.md`);
their runners attach as each target engine lands.

## 3. Provisional → frozen (adjudication)

Any fixture calibrated from live model output is PROVISIONAL until humans label it blind. The protocol lives in
`evals/adjudication/golden-jewelry-labeling-sheet.md`: Kaan and Emre label each utterance *without* seeing the
model's answer, then reconcile against the key. A record freezes only where both humans agree with each other
and with the model. Disagreements drive persona/compiler fixes — never the reverse.

## 4. Held-out discipline (anti-overfit)

Memorized passes are not robustness. Two mechanisms:
- **Sealed set** — `heldout-overfit-check.yaml`: 3 cases never used to tune the persona, excluded from `--suite all`,
  run once unseen. The instant we tune against it, it stops being held-out.
- **Rotating generator** — `scenario_gen.py` mints fresh per-industry adversarial cases every run. Each run is a
  new held-out sample; a case is only promoted into the fixed suite by hand, and only if it caught a real failure.

## 5. What CANNOT be tested offline — and how we test it live

The text harness cannot exercise anything about *voice as a medium*. These are real risks the eval suite is blind to:

- **Endpointing / turn detection** — does the agent wait for the respondent to finish, or interrupt / cut off? Only a
  live call with real speech pacing exposes this.
- **Prosody & tone** — the persona's *words* can pass every text eval and still land cold, rushed, or robotic when
  spoken. Warmth is a voice property here.
- **Latency & barge-in** — first-token time, whether the respondent can interrupt, recovery from a dropped call.
- **STT verbatim fidelity** — whether hedges/false-starts survive transcription (the compiler feeds on them). A
  cleanup-happy STT config silently destroys the product; only a real call transcript shows it.

**Live-test plan for these (dress rehearsal, pre-pilot):** run a scripted VAPI call end-to-end; capture audio + raw
transcript; check (a) the agent never talks over the respondent, (b) hedges/fillers survive verbatim in the stored
transcript, (c) first-token latency budget, (d) pause/resume on the same link mid-call, (e) a human rates warmth/
register on the anxious-operator and skeptical-foreman scripts. These check items become a live-run checklist, not
an offline eval.

## 6. Current known gaps (as of the task #12 run)

- **Freeze family under-generalizes.** On 12 freshly generated cases the persona failed all 4 freeze cases and 2/4
  flatter: it accepts polished summaries/timelines, paraphrases-back-as-confirmation, under-probes numbers on novel
  phrasings, and **affirms quantified achievements** ("45 down to under 20 is significant"). Evidence:
  `evals/adjudication/scenario-gen-first-run.md`. Deliberately NOT hotfixed — the fix goes through class-level review
  so it generalizes, verified against a NEW generated batch. Read the fixed-suite 26/26 as "no known failures on the
  tuning set," not "robust."
- **Generated cases are provisional too.** At least one first-run "fail" was an over-strict generated `fail_if`
  (needs_human). The judge + a human filter generated cases before any are promoted.
- **Real-runtime run outstanding.** Everything above the compiler line is validated via the direct adapter, not the
  actual turn engine — BLOCKED on a live EVAL_MODE server.

## 7. Standing loop (institutionalized — do this every time)

Every dress rehearsal and every real interview is an eval source. After each:

1. **Mine the transcript for failures** — any moment the interviewer endorsed, leaked, under-probed, drifted,
   solutioned, or the compiler mis-tagged / confabulated / dropped a hedge.
2. **Turn each failure into a case** — write it in the harness schema (respondent turn or transcript excerpt +
   pass_if/fail_if), fictionalized (A12), tagged to its family.
3. **Add it to the fixed regression suite** — so that exact failure can never silently return.
4. **Re-run held-out + a fresh generated batch** — confirm the fix generalized and didn't dislodge anything.
5. **Adjudicate** any new golden records blind before freezing.

The suite is not a fixed asset; it grows monotonically from every real contact with a respondent. A failure that
isn't turned into a case is a failure we've agreed to repeat.

## 8. Voice path — proving status & what cannot be tested offline (#17)

Exercised by driving `/api/voice/chat/completions` (custom-LLM SSE) and `/api/voice/webhook` directly with
synthetic-persona turns — no live VAPI account. See `docs/voice-config.md` for the assistant settings these prove.

**Proven offline (green):**
- **SSE format** — OpenAI `chat.completion.chunk` frames (opening role frame → content deltas → `data: [DONE]`), valid
  across varied speaking styles: rambler / run-on, terse, mid-turn topic jump, interruption-shaped fragment
  ("So the first thing I do is—"), and a hedged Turkish turn.
- **First-chunk latency** ~1.0–1.6s on opening turns (the longest replies); mid-interview replies are shorter. Near
  the <1.5s budget — prompt caching in the cost phase ("make it cheap") tightens it. This is our token latency only;
  real spoken latency also includes VAPI STT + TTS.
- **TR/EN switch** — a Turkish turn gets a Turkish reply, vocabulary kept untranslated.
- **Verbatim webhook storage** — a `transcript` (final) event stores the utterance EXACTLY ("Umm, sanırım maybe two
  hours, I dunno.") with word-level timestamps. Cleanup would destroy the compiler's hedge signal; it doesn't.
- **end-of-call-report** → session marked completed, recording URL stored as evidence, Stage 4 compile enqueued.

**CANNOT be tested without a live VAPI call (deferred until the account exists — config-verified only):**
- Real endpointing / the patient 2–3s recall-pause tuning (VAPI-side turn detection).
- Barge-in / interruption yield (`stopSpeakingPlan.numWords`) — needs real TTS + a mic to interrupt.
- Actual STT verbatim fidelity + word-timestamp accuracy from the transcriber (we prove we STORE what's sent, not
  what Deepgram actually produces).
- True end-to-end spoken latency (STT → our first token → TTS) and silence / gentle-check-in timing.
- Voice selection / prosody.
