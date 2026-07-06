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
  tuning set (no regression), and the two motivating traps (terse-close, target-as-timeline) flip fail→pass. The
  residual that remains is the **number-source reflex on a bare percentage** and the **episode-anchor-vs-explicit-move**
  substitution — which is exactly Q1 and Q2 below, so those two carry the decision. Confirm the applied direction; the
  http adapter (genuine multi-turn state) should re-run these once EVAL_MODE is live.

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

## Standing after the review

- The suite grows from every dress rehearsal + real interview (`docs/EVALS.md` §7). I own the transcript-mining
  pass at the E2E dress rehearsal (task #15).
- SPEC-ONLY eval runners (leading-question, perception-gap→backend #11, long-interview drift) wire up as their
  engines/adapters land.
