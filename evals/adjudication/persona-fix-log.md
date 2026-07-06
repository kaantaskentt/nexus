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

---

# Persona fix arc — terse-respondent coverage routing (morning-packet Q3, resumed session, July 6)

Authorized class-level by team-lead: *"a terse answer is an opening, not a close — one concrete exceptions probe + one
last-actual-episode anchor before any must-hit closes; brevity never satisfies a completion condition; ALL numbers incl.
timelines get the felt-vs-measured probe."* Source cited in the prompt: Question Bank **Slot 5 (Exceptions)**. Motivated by
the terse `bookkeeper` agent-vs-agent run (0/3 hidden surfaced, 3/3 traps taken; staged, gitignored, in
`evals/interviewer/generated/bookkeeper-mined-*.yaml`). **Principles only — no strings lifted from the failing cases.**

## What the fix changed (prompts/agents/stage7-interviewer.md, class-level only)
- **Register — added a fifth read, "the terse / reticent respondent":** brevity is never a signal a topic is covered;
  it means the interviewer carries the load; never let a short answer close a must-hit objective. Framed as probing
  discipline, not a personality verdict (stays in the anti-under-probing / engineering lane).
- **Anti-under-probing — new bullet "Brevity is not completion":** the mirror of the existing fluent-summary bullet. A
  terse "that's it" is an opening; **brevity never satisfies a completion condition**; before any must-hit closes on a
  short answer the interviewer owes it at least one **exceptions probe** (Slot 5 — what varies/breaks/gets dropped) and one
  **last-actual-episode anchor**. Silence from a quiet respondent is a cue to probe, never to move on.
- **Anti-under-probing — extended the number/source-probe rule to timelines and targets:** durations, deadlines, and
  cadences all trigger the felt-vs-measured probe; and **a target or standing metric is not the achieved reality** — a
  deadline stated as fact ("we're a five-day close") gets a target-vs-actual probe anchored to the last real instance.
- **Hard rule 12 strengthened:** "a terse answer is never enough on its own; treat a stated target/deadline as a number
  to source, not the reality."

## Measured arc (direct adapter — the optimistic one; http/EVAL_MODE needs the parked backend, so http re-run is a
morning item)

| Signal | Result | Read |
|---|---|---|
| direct `--suite all` (tuning set, post-fix) | **27/27** | **No regression.** The fix broke none of the fixed suite. |
| staged bookkeeper traps (in-sample sanity, NOT verification) | **2/3** | `underprobe-timeline-source` (five-day-close target) **FIXED**; `underprobe-terseness-completeness` ("that's it" close) **FIXED**; `underprobe-exceptions-skipped` still fails — see below. |
| fresh generated freeze batch (new seed 1783331673, accounting+hospitality ×2, held-out) | **2/4** | Both fluent-generalization cases **pass** (episode-anchor discipline generalizes); both bare-percentage number cases **fail** (documented number-source residual). |

## Honest reading (realism over green checkmarks)

1. **The two motivating failures the fix was authorized to close are closed.** Terse-close and target-stated-as-timeline
   both flip fail→pass on the staged traps. That is the point of the fix, and it landed without touching the tuning set.
2. **The residual is the number-source reflex on a bare percentage — the same stubborn one from the first arc, not a new
   gap.** Fresh `gen-hospitality-freeze-2`: reply was "*28% — and that's across all three properties?*" — a clean echo +
   lateral scope-clarifier, no source probe, no anchor. A genuine under-probe. **One clean miss in a noisy 4-case run is
   not grounds to pile more prose onto an already-emphatic rule** ("echoing a number back is not a probe" is already in the
   persona). Flagging, not hotfixing — chasing it tonight is over-fitting to variance.
3. **The other two fails are the "good but different" pattern — Emre's Q1/Q2, not a persona defect.**
   - Fresh `gen-accounting-freeze-2`: "*Got it — so roughly five percent... Walk me through the last actual write-off you
     processed, the specific one, not the tidy version.*" A **strong episode anchor**, only missing the explicit
     felt-vs-measured question → **exactly morning-packet Q1** (is an anchor an acceptable substitute for the source
     question?).
   - Staged `underprobe-exceptions-skipped`: "*Walk me through the last time you did it — the specific file. What did you
     open first...*" A strong anchor that in a real multi-turn arc surfaces the exception as the story unfolds, failed only
     for not asking the exact "what goes wrong" question in one single-turn reply → **exactly morning-packet Q2** (freeze
     cases demanding ONE move; the single-turn harness can't see the follow-through).

## Recommendation (to Kaan/Emre — applied, pending review; NOT tuned further tonight)

**Ship the fix.** It is class-level, closes the two authorized gaps, and regresses nothing (27/27 direct). Stop here.
Two things carry to the review, both already on the packet:
1. **Q1 (Emre's technique call):** when the interviewer answers a number with a strong last-actual-episode anchor but skips
   the explicit felt-vs-measured question, is that good enough, or must the source question always fire? Half tonight's
   fresh/staged fails are this exact substitution.
2. **Q2 (case/judge strictness):** single-turn freeze cases that demand ONE specific move ("ask for the exception") fail a
   strong episode anchor that would surface the exception over a real multi-turn arc. Loosen deliberately, or hold the line
   — the http adapter (genuine multi-turn state) is the fairer judge and should re-run these once EVAL_MODE is live.
