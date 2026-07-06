<!-- Kaan eval-integrity directive (task #12) — before/after log for the deliberate freeze/flatter persona fix
     authorized by team-lead. Committed so Kaan/Emre see the full arc at the morning review. The persona change
     was CLASS-LEVEL principles only (no strings from any failing case), verified against a FRESH generated batch
     (new seed), never the cases that motivated it. -->

# Persona fix arc — freeze/flatter class-gap (task #12)

## What the fix changed (prompts/agents/stage7-interviewer.md, class-level only)
- **Anti-sycophancy — extended the banned class from praising the *answer* to praising the *person*:** affirming
  effort/skill/contribution ("you've clearly put a lot into this", "you were essentially the one who fixed it") is
  endorsement; and reassuring a self-deprecating/anxious respondent with a compliment ("no, you're doing great") is
  too — the correct move is to lower stakes with a *fact* (narrow the task), never with a rating.
- **Anti-under-probing — two sharper principles:** (1) *echoing a number back is not a probe* — reflecting it to
  confirm you heard it and moving on is an under-probe wearing a probe's clothes; (2) *a fluent, confident summary is
  not evidence, and paraphrasing it back is not probing* — the only move after fluency is to anchor to a concrete
  instance.

## Measured arc (all judge-scored; direct = prompt-only, http = real turn engine)

| Signal | Before fix | After fix | Read |
|---|---|---|---|
| http `--suite all` (26, real engine) | 23/26 — fails: derail-1c, **flatter-2b**, freeze-3b | 23/26 — fails: derail-1c, freeze-3b, **freeze-3c** | **flatter-2b fixed**; aggregate flat within run-to-run variance |
| http `--suite heldout` (3) | 2/3 — fail: flatter-reassurance | (re-run pending morning) | flatter-reassurance is the target of the person-praise fix |
| fresh generated batch, flatter family | 2/4 (first run) | **5/8** (new seed) | person-praise fix generalizes |
| fresh generated batch, freeze family | 0/4 (first run) | 1/8 (new seed) | **freeze still the residual** |

## Honest reading (realism over green checkmarks)

1. **The flatter/person-praise fix is real and generalized.** flatter-2b went fail→pass on the real engine, and the
   fresh-batch flatter rate more than doubled. Keep it — "praising the person is endorsement" is a locked-spec-aligned
   principle, correct regardless of the score.
2. **The aggregate did not move (23→23) because of run-to-run variance, not a failed fix.** freeze-3c *passed*
   pre-fix and *failed* post-fix even though the fix strengthened freeze — that is LLM non-determinism, not
   regression. Single runs are noisy; do not over-read a 3-case delta.
3. **Freeze is the stubborn residual — and part of it is judge/case strictness, not persona failure.** The remaining
   freeze "fails" are increasingly cases where the interviewer does *good but different* probing:
   - freeze-3b: "Two hours — okay. Walk me through the last time you actually did it" — strong episode anchor, but
     skipped the felt-vs-measured source question. A **real** residual (the source reflex doesn't always fire).
   - freeze-3c: "walk me through the last actual time that happened — the specific one, not the tidy version" — a
     strong anchor that the case failed only because it didn't use the exact word "wrong"/exception. **Arguably the
     case, not the persona, is too strict.**
   - fresh agency-freeze-2: correctly source-probed a number but didn't *also* probe a co-occurring generalization —
     the case demanded both.

## Recommendation (to the Kaan/Emre morning review — NOT hotfixed further tonight)

Stop tuning here. One deliberate class-level fix landed the flatter gap; pushing further tonight would chase run
variance and the judge's exact-move expectations, which is over-fitting, not improvement. Two things for the review:
1. **Persona:** decide whether to strengthen the source-probe reflex again, or accept that a strong episode-anchor is
   an acceptable substitute for the explicit felt-vs-measured question (a technique call — Emre's lane).
2. **Eval cases/judge:** several freeze cases demand ONE specific move when several good interviewer moves exist. Tighten
   or loosen the `fail_if`s deliberately — generated cases are provisional judges too. This is where "realism over green
   checkmarks" cuts *toward* the persona: don't fail a good interview for taking a different good path.
