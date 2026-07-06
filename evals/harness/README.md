<!-- Sources: docs/MERGE_PLAN.md Phase 4 (eval suite runnable against the turn engine) + task #7 endpoint shape (token-keyed text chat, run_interview_turn) + evals/README.md (judge protocol). -->

# Interviewer eval harness

Runs the behavioral suites (`evals/interviewer/failure-taxonomy.yaml`, `what-if-pairs.yaml`)
against the Stage 7 interviewer and scores each reply with an LLM judge. Built so switching
from a local dry-run to the real runtime is a **URL swap**, not a rewrite.

## Two adapters, same cases

- **`direct`** (default) — drives `prompts/agents/stage7-interviewer.md` straight through
  Anthropic. No backend needed; runs today and in CI. Use it to iterate on the persona.
- **`http`** — targets the task #7 runtime (`run_interview_turn`, token-keyed text chat).
  The only backend coupling is two paths in `adapters.py`:
  ```
  BOOTSTRAP_PATH = "/sessions/eval-bootstrap"
  TURN_PATH      = "/sessions/by-token/{token}/turn"
  ```
  When the turn endpoint lands, confirm those two shapes and the `http` adapter runs unchanged.

## Endpoint contract the `http` adapter expects (for backend-ontology to confirm)

```
POST {base}/sessions/eval-bootstrap        {handoff, modality:"text", language}  -> {token}   # NEEDED (test-only)
POST {base}/sessions/by-token/{token}/turn  {message}  -> {reply, turn_index, elapsed_minutes, should_offer_pause}
```
The **turn route already exists** (routers/sessions.py, task #7) and returns `reply` among other
fields — the `http` adapter reads `reply`, so it matches as-is. The runtime injects the handoff
package as system context and keys pause/elapsed off REAL stored utterances + wall-clock, so the
`http` path has genuine multi-turn state (the `direct` adapter's synthetic mid-interview note is
only a stand-in for that history).

The one missing piece is **`eval-bootstrap`** — a test-only hook that mints an `is_demo` session
plus its `handoff_packages` row from the given package and returns the invite token (never a real
tenant — A12; gate it behind `EVAL_MODE`/`is_demo` per team-lead). The runtime loads the package
via `plan_id -> handoff_packages`, so bootstrap must attach the package that way (or the harness
seeds the session + handoff row directly — then only `bootstrap()` changes, cases/judge don't).

## Run

```
export ANTHROPIC_API_KEY=...
python -m evals.harness --adapter direct --suite all          # dry-run, all cases
python -m evals.harness --adapter direct --suite whatif --limit 3
python -m evals.harness --adapter http --base-url http://localhost:8000 --suite taxonomy
python -m evals.harness --adapter direct --suite all --json out.json
python -m evals.harness --adapter http --suite heldout          # sealed overfit check (see below)
```

**`--suite all` is the tuning set (taxonomy + whatif, 26 cases) only.** `heldout`
(`heldout-overfit-check.yaml`, 3 cases) is a **sealed overfit check** — deliberately excluded from
`all` and never used to tune the persona. Run it ONCE, unseen, against the real runtime (`--adapter
http --suite heldout`): if the class-level persona fixes generalized, it passes first try; if the
persona over-fit to the 26 tuning cases, it exposes that. Don't fold it into the tuning loop.

Env overrides: `NEXUS_EVAL_INTERVIEWER_MODEL`, `NEXUS_EVAL_JUDGE_MODEL` (default the repo's
strong seat), `NEXUS_APP_BASE_URL`. Exit code is non-zero if any case fails or errors (CI-friendly).

## What the judge enforces (evals/README.md)

`fail_if` dominates `pass_if`; every verdict quotes evidence from the actual reply; behavior is
judged, not phrasing (except literal banned-phrase cases); genuine ambiguity ties to `fail` +
`needs_human`. The judge is a strong model, never the model under test.

## Not covered here

The compiler suite (`evals/compiler/*`) is diffed against the compiler's JSON output, not this
turn harness — its runner belongs with the backend compile job. The golden fixture is already
aligned to the real `OUTPUT_CONTRACT`.
