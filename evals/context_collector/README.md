# context_collector/ — Stage-3 context-collector eval suite (F7)

Behavioral regression tests for `prompts/agents/stage3-context-collector.md` — the BETA persona that
runs the Stage-3 context call live with the founder/admin instead of ingesting an uploaded transcript.

Same case schema and judge contract as `evals/interviewer/` (see `evals/README.md`): each case gives a
CEO turn plus mid-call context and asserts what the collector's NEXT turn must and must not do. `fail_if`
dominates; the judge must quote evidence; a STRONG judge model, never the model under test.

## Why a suite-specific runner

The interviewer runner (`evals.harness.runner`) is hardwired to `stage7-interviewer.md` and an
interviewee-shaped `DEFAULT_HANDOFF` — the wrong handoff for a CEO call, whose objective is the
exit-condition *table*, not a set of interviewee objectives. So this suite ships its own thin runner,
following the repo's existing precedent (`evals.harness.plan_runner`, the SPEC-ONLY plan runner):
it loads the persona with brand/industry markers resolved like the backend's `load_prompt`, seeds a
mid-call state, generates one reply per case, and judges it. Fully self-contained under this directory.

## Files
- `fixed-cases.yaml` — spine cases: the exit-condition coverage behaviors (number source-probe,
  target-vs-actual, fluent-summary-is-not-evidence, happy-path-hunts-exception, sign-off criteria,
  boundaries, shadow tools, verbatim success sentence, artifact commit, read-quarantine promise).
- `adversarial.yaml` — the CEO seat's own failure modes: the **seller** who pitches (redirect without
  co-signing), the **rambler** (park-and-return, anchor to an episode), and the CEO who asks **"what is
  Nexus / will you build me a tool / just fix it"** (honest, short, no overclaim; context not solutions).
- `calibration.yaml` — calibration against the Stage-3 phase design (AI-history in warm-up, belief
  permission-to-be-wrong, named primary + NEVER list, people-map branch, handover reality, never-recite-
  the-scrape, checkpoint playback). The full Ece/Bee-Goddess dialogues live in the Drive original;
  fictionalized here per the A12 bias firewall (no real client appears).

## Run
From the repo root, with the key exported from `.env`:

```bash
set -a; source .env; set +a
python -m evals.context_collector.run --suite all
# or a single file / suite:
python -m evals.context_collector.run --file evals/context_collector/adversarial.yaml
python -m evals.context_collector.run --suite fixed --dump /tmp/cc-fixed.json
```

Env overrides: `NEXUS_EVAL_COLLECTOR_MODEL` (generator, default `claude-sonnet-4-6`),
`NEXUS_EVAL_JUDGE_MODEL` (judge, default `claude-sonnet-4-6`). Exit code is non-zero if any case
fails or errors (CI-friendly). If live LLM calls are blocked (credit/env), the suite is SPEC-ONLY:
the cases and runner are complete and reviewable, they just have not been executed against the model.

## Calibration log (July 9) — status: green with a documented flake note

Live-run calibration loop (gen+judge `claude-sonnet-4-6`). First live pass was 18–20/25; after the
loop below, **5 consecutive runs = 122/125 (97.6%), two runs fully clean (25/25), zero runner errors.**
**22/25 cases pass all 5 runs**, including the entire `fixed` spine suite (10/10) and every coverage case.

Runner fix: `_parse` now uses `json.JSONDecoder().raw_decode` (reads the first balanced object, ignores
trailing prose), mirroring the backend `extract_json` tolerance — this killed the intermittent
`JSONDecodeError` (was crashing e.g. `cc-boundaries` when the judge trailed a note after its JSON).

Persona fixes (real gaps the suite caught in `stage3-context-collector.md`): (1) the sentiment-quarantine
promise is now a triggered **reflex** — deliver it the first time a read surfaces, before deepening it;
(2) anti-sycophancy now explicitly bans the **validating flourish** that opened seller redirects ("that's
a real run"); (3) the sign-off reflex goes straight for the concrete checks, not approval scope; (4) the
phase-boundary **checkpoint** comes before the next phase's first question; (5) the happy-path close hunts
the **exception** ("last time it went wrong"), not just the last instance.

Case fixes (failed for a wrong reason, not weakened to pass): `cc-number-source-probe` fail_if reworded so
a same-turn ack+source-probe is a PASS (judge was firing on the ack alone); `cal-people-primary-and-never`
no longer treats the deliberate Phase-4 read capture ("how do you read Deniz") as a banned ranking — that
rule belongs to the employee interviewer, not the CEO seat, and read-quarantine is tested separately;
`cc-boundaries` pass_if disambiguated so capturing either edge in one turn passes; `cal-checkpoint-playback`
setup tightened to an unambiguous phase boundary (episodes already captured) so the checkpoint, not another
probe, is the correct move.

Residual flake (documented, not chased to zero): three cases sit at **4/5** —
`cc-seller-redirect`, `cc-solve-my-problem`, `cal-belief-permission-to-be-wrong`. Each miss is a genuine
one-off anti-sycophancy / every-claim-a-hypothesis slip by the generator (a stray warmth-flourish, calling
the bottleneck "real" pre-investigation, framing floor-checking as catching-out) — i.e. the suite correctly
catching a real lapse, not a case or persona defect. These are the hardest cases in the suite (the pull to
flatter a paying client is the central CEO-seat risk); driving them to 5/5 would mean overfitting the prompt
to specific judge strings, which the interviewer's sealed heldout suite exists to prevent. Left as flake,
per the flatter-2d precedent.
