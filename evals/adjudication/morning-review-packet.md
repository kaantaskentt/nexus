<!-- Kaan eval-integrity directive (task #12) — single entry point for the Kaan/Emre morning review.
     Everything that needs a human decision after the build night, in one place, with links. -->

# Morning review packet — Nexus interviewer + evals

One page in, everything out. Three things need you: **adjudicate the provisional goldens**, **decide the two
open interviewer-technique questions**, and **veto/approve the taste flags**. Links and context below.

## Where the interviewer actually stands (real engine, not the optimistic number)

- **Real-runtime baseline:** `--suite all` **23/26**, `--suite heldout` **2/3**, run against the live turn engine.
  (The 26/26 you may have heard was the direct-prompt adapter — optimistic. 23/26 is ground truth.)
- **Mock-detection: PASS** — the engine generates fresh replies, not canned scripts (now an automatic preflight).
- **Honest framing:** "no known failures on the tuning set" ≠ "robust." The scenario generator (fresh, unseen
  cases) is what keeps us honest — see below.
- Full coverage map with what CANNOT be tested offline (voice endpointing, prosody): `docs/EVALS.md`.

## 1. Adjudicate the provisional goldens (blind)

The compiler golden was calibrated from live model output, so it's **PROVISIONAL** until you label it blind.
- **Do this:** `evals/adjudication/golden-jewelry-labeling-sheet.md` — label each utterance WITHOUT opening the
  answer key (`evals/compiler/golden-jewelry-expected-records.yaml`). Then reconcile. Records freeze only where
  you both agree with each other and with the model.
- The rows most worth scrutinizing are flagged at the bottom of the sheet (corrections, hedged numbers, the
  Metin fact-vs-judgment split, the directive).

## 2. Two open interviewer-technique questions (Emre's lane especially)

Both surfaced from the freeze-family gap the generator exposed. Context + evidence: `evals/adjudication/persona-fix-log.md`
and `evals/adjudication/scenario-gen-first-run.md`.

- **Q1 — Is a strong episode-anchor an acceptable substitute for the explicit number-source question?** When a
  respondent gives a number, the persona says "ask felt-vs-measured reflexively." On the real engine the
  interviewer often instead asks "walk me through the last actual time" (a strong episode probe) and skips the
  explicit source question. Is that good enough, or must the source question always fire? (Genuinely a technique
  call, not ours to settle.)
- **Q2 — Are some freeze eval cases too strict?** Several `fail_if`s demand ONE specific move ("ask for the
  exception") and fail a reply that took a different good move (a concrete-episode anchor that would surface the
  exception anyway). Loosen them, or hold the line? Generated cases are provisional judges too — realism can cut
  *toward* the persona here.
- **Q3 — Coverage-routing with terse respondents — FIX APPLIED, pending your confirm (arc: `evals/adjudication/persona-fix-log.md`).**
  The interviewer is strong over full conversations — 14/16 hidden items surfaced, 0 traps taken across all five
  personas. The single miss: with the *terse* bookkeeper it never routed to one must-hit objective (deadline
  tracking), which a quiet respondent won't volunteer, so that objective stayed untouched. **Applied overnight
  (class-level, anti-under-probing — locked discipline, engineering not taste):** brevity never satisfies a completion
  condition; a terse answer owes an exceptions probe (Question Bank Slot 5) + a last-actual-episode anchor before a
  must-hit closes; timelines and targets-stated-as-fact now get the felt-vs-measured probe. Verified: 27/27 direct
  tuning set (no regression), and the two motivating traps (terse-close, target-as-timeline) flip fail→pass.
  **HTTP RE-RUN DONE (this session, real multi-turn engine) — the honest split result:** on the terse bookkeeper the
  fix drove traps to **0/4** (the motivating disaster run took 3/3) and the **target-vs-actual timeline probe fired**
  live (H3 surfaced as *"usually day five or six; that one was more like day eight"*). **But h-bk-3 (deadline tracking)
  is still `untouched`** on the multi-turn engine, and the *polished* agency persona shows the **same miss** (ag-2
  scope-creep untouched). So the real residual is broader than terseness and NOT closed: **coverage-routing to a must-hit
  the respondent never volunteers.** The completion-condition principle sharpened probing but did not install a "drive to
  the untouched must-hit before close" mechanism (coverage is model-side/re-derived, not computed — ARCHITECTURE.md). **Decision
  for you:** accept the partial win + treat force-routing-to-untouched-must-hits as the next targeted fix (likely
  engineering: explicit coverage tracking), and separately Q1/Q2 (number-source reflex, episode-anchor-vs-explicit-move).
  Full matrix + evidence: `evals/e2e/proof-matrix.md`.

*What was already fixed tonight (deliberate, class-level, no over-fit):* the flatter/person-praise gap — the
interviewer no longer affirms quantified achievements or reassures self-deprecation with a compliment. That fix
landed and generalized; it's in `prompts/agents/stage7-interviewer.md`, arc in the persona-fix log.

## 3. Taste flags — veto or approve (Kaan)

Client-facing tone calls I shipped a default for; all reversible.

- **Invite email + consent landing** (`prompts/personas/`): benefit-framed subject, plain reassuring consent
  language, one gentle reminder, **no decline button** (A4). My rec: ship as-is.
- **Naming the AI to the respondent** — the invite/consent say "[Company] asked {{PRODUCT_NAME}} to understand
  how the work happens," naming the AI interviewer up front. Genuine product-positioning call: how forward are we
  that it's an AI? My rec: ship transparent, but this one's yours.
- **Reflect-back close** — deliberately plain, no effusive thanks (effusive = the sycophancy the persona bans).
  My rec: hold the line.
- **TR copy** — designed-in, untuned (A13.1 settles it; not a decision, just a heads-up it's not launch-tuned).

## 4. Night-shift clinical audit — F38+ registry proposals (Emre's lane, stocked not merged)

Per Kaan's upgrade license, audited F1-F37 as a clinical/neuropsychologist. Full proposal + evidence:
`evals/adjudication/f38-clinical-audit-proposal.md`; staged eval cases: `evals/interviewer/f38-clinical-proposals.yaml`.
**Your F1-F37 are untouched** — everything is additive F38+, ratify each before wiring goes live.

- **Honest headline:** the persona already defends **4 of 6** candidate biases emergently (acquiescence F38, telescoping
  F39, conflation F40, cognitive-load F43 — all PASS on isolating cases). They need a *named flag + regression-guard case*,
  not new prose.
- **Two real gaps, both yours to ratify + build with us:** **F42 halo** (interviewer lets a proud step's glow verify the
  adjacent claim — baseline FAIL; I drafted wiring, it didn't move the single-turn case, so I reverted rather than ship an
  unverified fix — needs a multi-turn/http test) and **F41 FAE** (perception-gap comparator: leadership's dispositional
  read vs the floor's situational cause, surfaced de-personalized and quarantine-safe). Wiring drafted, ready, not applied.
- **Demand characteristics:** assessed → already covered (anti-sycophancy + F13 + examples-from-them); no new flag.

## 5. TOP V3 engineering proposal — computed coverage tracking + route-to-untouched-must-hit

Persona text has sharpened probing twice now (person-praise ban; brevity/timeline completion). The third fix is
**structural, not prose** — the top named V3 engineering item (team-lead ruling). Evidence from tonight's real-engine
http matrix: the interviewer still misses a must-hit the respondent never volunteers — **bookkeeper h-bk-3 (deadline
tracking) untouched** even after the terse fix drove its traps to 0/4, and **agency ag-2 (scope-creep) untouched** on
the polished persona. Same failure, two personas: coverage-routing to a non-volunteered must-hit.

Root cause is a known v1 placeholder (ARCHITECTURE.md): the interviewer's coverage map is **re-derived in the model's
head each turn** — no computed `satisfied / partial / untouched` objective map, no engine-side enforcement of "route to
the highest-value UNSATISFIED must-hit before close." **Proposal:** compute coverage server-side from handoff objectives
× the running transcript, expose untouched must-hits to the turn engine, hard-gate close on any untouched must-hit
(drive one direct probe first). Engineering, not persona prose (Emre's Q1/Q2 are the separate technique calls). Staged
with the two data points; nobody builds it at 4am.

**UPDATE (July 6, task #12, evals-1 — BUILT + A/B'd on the real engine; shipping DORMANT, and the proposal was
misdiagnosed).** The mechanism is built end to end (`coverage_tracker` seat + `backend/app/pipeline/coverage.py`,
migration 0008, wired behind `config.coverage_routing`, gate logic unit-tested 6/6, fires live at ~3.4s/turn) — so
feasibility is settled: it works. But the A/B (full matrix + numbers in `evals/e2e/proof-matrix.md`) shows it does
**not** close the motivating misses, because h-bk-3 and ag-2 are **hidden knowledge, not stated objectives.** A gate
that computes coverage of the *objectives* cannot force a non-objective to surface. And when the missed item is made
an **explicit must-hit objective**, the **baseline interviewer already routes to it and covers it (3/3, both runs)** —
the coverage-on version added a per-turn model call for no gain and was noisier (one run took 2 traps). So: shipped OFF
by default (built, tested, dormant), not wired into the live product on an unproven benefit. **The real lever is
plan-objective granularity** — have the plan generator emit the shadow-tool / deadline / scope-creep dimensions as
explicit sub-objectives (the baseline already covers explicit objectives). That is the smallest feasible next step, and
it is plan-generator work, not turn-engine work. **Decisions for you:** (a) accept dormant-ship + retarget to plan
granularity, and (b) a taste heads-up — when `coverage_routing` is on, the gate makes the interviewer more insistent
about must-hits before it will close; that is a client-facing feel change, Kaan's call whether to ever activate it.

## 4b. Live demo material — the interviewer produces meeting-worthy findings from a sim

The second-round Burak interview (bee-goddess-demo, driven this session) compiled into **20 real findings** via
episode-anchoring — including *"In March the respondent was absent sick for two days; with no backup, two boutiques sold
pieces under cost, unnoticed for a week."* Exactly the meeting-worthy, product-promise finding, surfaced from a
simulated respondent. (Report/perception-gap surfaces await a backend fan-out fix — routed to backend-2; reproduce with
`python -m evals.harness.second_round_e2e --plan-id <burak-plan> --persona burak-repricing`.)

## 6. Perception-gap verdict from LIVE (July 6 morning) — comparator eligibility rule to ratify (Emre)

Verdict on SPRINT-STATE item 2, drawn from the live compiled report (Burak round) + prod claim records: **ceo_vs_floor
gaps DO form — 2 in `conflict_points`** — but adjudication of both changes the picture:

- **Boutique-count gap (19e3023c) is a FALSE POSITIVE.** The Founder's "twelve boutiques" (CLAIMED) was superseded by his
  own same-session correction "ten now, closed Ankara last month" (CONFIRMED, kind=correction, same speaker). His current
  position agrees with Burak's ten. The comparator compared the retracted claim.
- **Yıldırım terminology gap (cc1636cd) is REAL and must survive any fix.** The Founder's claim is also superseded, but by
  a DIFFERENT speaker (Burak, CONFIRMED, tag-precedence) — the Founder still holds the wrong mental model. Genuine gap.

**Proposed eligibility rule (policy call, your F21/F41 lane):** exclude a claim from cross-person comparison only when its
superseder has the SAME speaker (authorial self-correction); keep it when supersession is cross-speaker tag-precedence.
A naive "exclude all superseded claims" would kill the real yıldırım gap. No prompt or comparator was patched — evidence
and rule staged for your ratification; eval case follows the ruling.

**UI note (acted on, not waiting):** report `perception_gaps[]` renders empty while the real findings live in
`conflict_points` — the Insights build was pointed at the populated field.

**Data-layer correction (not only UI):** `perception_gaps[]` is empty at the source too — the perception_gap agent
produced a full analysis (1559 tokens) that `extract_json` couldn't parse, and the leg silently swallowed it (same bug
as the empty interview_quality). Fixed in #22 (parse failure now fails/retries the job and persists the raw output);
the prompt that emits unparseable output is constrained in #23. So a truly empty `perception_gaps[]` will now mean
"no gap," not "a gap was dropped."

## Standing after the review

- The suite grows from every dress rehearsal + real interview (`docs/EVALS.md` §7). I own the transcript-mining
  pass at the E2E dress rehearsal (task #15).
- SPEC-ONLY eval runners (leading-question, perception-gap→backend #11, long-interview drift) wire up as their
  engines/adapters land.
