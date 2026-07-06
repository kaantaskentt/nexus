<!-- Kaan's upgrade license (docs/V2-PLAN.md "Upgrade license — F-registry clinical audit"). Night-shift proposals for
     Emre. Emre's F1-F37 and failure-taxonomy.yaml are UNTOUCHED; every item here ships as a NEW additive flag (F38+)
     with a one-line evidence rationale, proposed prompt wiring, and an eval case (staged in
     evals/interviewer/f38-clinical-proposals.yaml). Batched for the Kaan/Emre morning review — Emre ratifies each flag
     before any wiring goes live. His lane stays his; we stock it. -->

# F38+ clinical audit — cognitive-bias flags for the failure registry (proposal)

**Lens.** Audited F1-F37 + the Derail/Flatter/Freeze taxonomy as a clinical/neuropsychologist, asking: which cognitive
biases corrupt an interview record, and which does the current system already defend against? The honest finding: the
existing persona (CIT, anti-under-probing, anti-sycophancy) plus tonight's terse fix **already defends four of the six
candidate biases emergently** — they don't need new prose, they need a *named flag + a regression-guard eval case* so the
defense is measurable and can't silently rot. Only **two** are genuine gaps: **halo (F42)** in the interviewer and
**fundamental attribution error (F41)** in the perception-gap comparator. Naming a defended behavior is not busywork —
an unnamed defense is one prompt refactor away from disappearing untested.

## Evidence base (not asserted — measured)

Each candidate got one isolating eval case (`evals/interviewer/f38-clinical-proposals.yaml`), run against the **current
post-terse-fix persona** (direct adapter). Result: **4 pass / 1 fail**.

| Flag | Isolating case | Baseline (current persona) | Read |
|---|---|---|---|
| F38 acquiescence | `f38-acquiescence-leading-recap` | **PASS** | Already held by "every claim is a hypothesis, never confirm" + reflect-back-invites-correction. |
| F39 telescoping | `f39-telescoping-recency` | **PASS** | Held by the number/timeline source-probe (reinforced tonight) + episode anchoring. |
| F40 memory conflation | `f40-conflation-composite-episode` | **PASS** | Held by the fluent-summary bullet + F19 episodic rule + the terse fix. |
| F42 halo | `f42-halo-adjacent-claim` | **FAIL** | The one live interviewer gap — glow on the proud step carried the adjacent unverified claim. |
| F43 cognitive load | `f43-cognitive-load-tacit` | **PASS** | Held by anti-under-probing + report-everything + silence-is-a-tool. |
| F41 FAE (CEO reads) | (perception-gap comparator — not an interviewer-turn case) | n/a here | Genuine system gap; different harness. |

## The flags

### F38 · Acquiescence bias — *"a yes to a leading recap is not confirmation"*
- **Mechanism.** Agreeable/terse respondents ratify the interviewer's framing to be cooperative; a polite "yeah, exactly"
  to a leading recap is social compliance, not independent corroboration. Motivated by the terse `bookkeeper` run (3/3 traps).
- **Already covered?** Yes, at two layers: F13 (heuristic confirmation credited only when *raised unprompted*) guards it at
  scoring; hard-rule 6 ("every claim is a hypothesis; never confirm it") + reflect-back-invites-correction guard it at
  elicitation. F38 names the elicitation-side defense that F13 only covers for scoring.
- **Verdict.** NEW flag, **regression-guard only** — persona verified to hold; no new prose recommended.
- **Eval case.** `f38-acquiescence-leading-recap` (promote into failure-taxonomy.yaml on ratification).

### F39 · Telescoping — *"felt recency/frequency is memory-compressed, not measured"*
- **Mechanism.** Memory compresses elapsed time and misplaces recency ("a couple months back" for a year; "once a quarter"
  for twice a year). This corrupts the CEO/operator **time-and-cost baselines** the perception-gap engine compares (F27).
- **Already covered?** Partially — the number/timeline source-probe (reinforced tonight) catches felt-vs-measured. The NEW
  increment is the *recency/frequency-compression* dimension specifically, which feeds perception-gap baseline reliability.
- **Verdict.** NEW flag, **regression-guard now**; recommend Emre decide whether to also **down-weight uncorroborated
  time/recency records as telescoping-prone** in the perception-gap comparator (his F21/F28 measurement lane).
- **Eval case.** `f39-telescoping-recency`.

### F40 · Memory conflation — *"a smoothed 'always' is several episodes fused into one"*
- **Mechanism.** Source-monitoring error: the respondent believes they're giving one remembered episode, but it's a
  composite of similar events, smoothed into a false "typical" case. Distinct from F19 (episodic-vs-habitual): here the
  account *feels* episodic to them but isn't.
- **Already covered?** Partially — F19 + the fluent-summary bullet push for a specific episode. The NEW increment is the
  **two-instances technique** (get the last two datable occurrences; the composite cracks where they diverge).
- **Verdict.** NEW flag, **regression-guard now**; the two-instances probe is a persona-prose candidate Emre may want explicit.
- **Eval case.** `f40-conflation-composite-episode`.

### F41 · Fundamental attribution error (CEO person-reads) — *"disposition where the floor shows situation"* **[live gap]**
- **Mechanism.** Leadership attributes an individual's behavior to character ("she's disorganized") where the floor evidence
  shows a situational/process cause (no handoff time). The classic leadership-vs-floor divergence.
- **Already covered?** No — F34 *quarantines the person-characterization* from client view, but **no flag captures the
  structural dispositional-vs-situational gap as a report finding.** The insight is lost with the quarantined sentiment.
- **Verdict.** NEW flag, **wiring PROPOSED (not applied — Emre's perception-gap/measurement lane + needs the comparator
  runner).** When a leadership CLAIMED/GUESS record reads dispositional about a named person AND a floor CONFIRMED record
  gives a situational cause for the same friction, flag the pair as an **attribution-type perception gap**, surfaced
  **de-personalized / role-level, report-only (F27)** — the sentiment quarantine (F34 / Non-neg 4) stays intact: the
  characterization never renders, the *structural* gap does.
- **Proposed wiring** (`prompts/agents/perception-gap.md`, new gap type; ready to apply on ratification):
  > **Attribution-type gap (F41):** if a leadership belief explains a person's behavior by disposition ("X is careless/slow/
  > disorganized") and the floor account explains the same friction by situation (tooling, handoff timing, workload), record
  > a perception gap of type `attribution`. Render it de-personalized and role-level ("leadership reads this as an individual
  > issue; the floor account points to the process") — never the characterization itself. Report-only (F27).
- **Eval case.** Perception-gap comparator case (add to `evals/compiler/perception-gap-cases.yaml` on ratification; runs
  when that engine's runner lands — not the interviewer turn harness).

### F42 · Halo effect — *"a glow on one step inflates the credibility of the claim beside it"* **[live gap]**
- **Mechanism.** Pride/positivity about one step spills onto an adjacent unverified claim ("...QA's airtight too"), which the
  interviewer then waves through on the halo. Violates the spine of the product: **tags never upgrade** (Non-neg 1).
- **Already covered?** No — the proud-maker register says "pull them to specific episodes," but nothing stops an impressive
  account from *verifying its neighbor.* **Baseline FAIL** (`f42-halo-adjacent-claim`): the interviewer slowed down on the
  proud step (design) and let the adjacent claim (QA) ride, even opening with a mild sycophancy slip ("Great to hear...").
- **Verdict.** NEW flag, **wiring NEEDED — but NOT shipped tonight, honestly.** I drafted an anti-under-probing bullet ("a
  glow on one step does not verify the next; probe the adjacent claim on its own terms"). It **did not move the single-turn
  case** (the model still chose a generic full-workflow anchor over isolating QA) and left the 27-suite at 27/27 (harmless
  but ineffective), so I **reverted it** rather than ship an unverified fix. The single-turn harness can't distinguish "a
  generic anchor that reaches QA eventually" from "isolate QA now" — this is the same Q1/Q2 multi-turn problem.
- **Recommendation.** Emre ratifies F42 as a real gap; we co-develop the wiring against a **multi-turn (http) test** where
  "does QA actually get independently probed over the arc?" is judgeable. This is the top-priority item from the audit.
- **Eval case.** `f42-halo-adjacent-claim` (the reproducer; keep as the single-turn signal, add a multi-turn version).

### F43 · Cognitive load as data — *"hesitation at a step is tacit-knowledge density, not confusion"*
- **Mechanism.** Processing latency — slowed speech, mid-step pauses, "hard to explain" — near a judgment step signals
  *dense tacit knowledge*, the richest thing to mine, NOT confusion to rescue. Distinct from F20 (hedges = uncertainty for
  trust-tagging); here the signal drives *probing behavior*. Word timestamps exist, so this is measurable on the voice path.
- **Already covered?** At the interviewer, yes — anti-under-probing + report-everything + silence-is-a-tool already make it
  slow down and mine (**baseline PASS**). NOT covered at the compiler: no **tacit-knowledge marker** derived from
  latency/disfluency.
- **Verdict.** NEW flag, **regression-guard for the interviewer**; the compiler-side **cognitive-load marker** (latency near
  a step → tacit-knowledge tag on the record, voice path) is a genuine measurement addition — **proposed for Emre's lane.**
- **Eval case.** `f43-cognitive-load-tacit`.

### Assessed and NOT flagged — Demand characteristics
Kaan listed it; the audit finds it **already defended**, so no new flag: anti-sycophancy bans the interviewer from
signalling the wanted answer; F13 credits only unprompted confirmation; examples-come-from-the-respondent bans planted
frames. Flagging it would duplicate existing controls. (Noted so the negative result is on record, not silently dropped.)

## Recommendation to Kaan/Emre

1. **Ratify F38-F43 as named additive flags.** Four (F38/F39/F40/F43-interviewer) are already-held — adopt their eval cases
   as **regression guards** so the defense is measured, no persona change.
2. **Two real gaps need building, both with Emre:** **F42 halo** (interviewer wiring, needs a multi-turn test — top priority)
   and **F41 FAE** (perception-gap comparator, attribution-type gap, quarantine-safe). Wiring is drafted and ready; neither
   shipped tonight because both are Emre's measurement/human-nature lane and F42's fix must be *verified*, not asserted.
3. **Two measurement-lane extensions for Emre to weigh:** telescoping down-weighting of uncorroborated time records (F39),
   and the compiler cognitive-load/tacit-knowledge marker off word timestamps (F43).

Nothing here edits Emre's originals; `f38-clinical-proposals.yaml` is a separate proposal file. Promote cases into
`failure-taxonomy.yaml` only on his ratification.
