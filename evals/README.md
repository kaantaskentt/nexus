<!-- Sources: docs/MERGE_PLAN.md Phase 4 eval suite (failure-mode taxonomy Derail/Flatter/Freeze + 15 what-if trigger→guarded pairs, credentials guard, new-content-domain guard) + Phase 1 eval (quote-supports-claim, 40→10 retraction supersedes) + A9 (eval assets: golden transcripts + expected-record fixtures, tagging pairs, canonical regressions) + A12 (fictional names only). -->

# {{PRODUCT_NAME}} — Eval Suite

LLM-judged regression tests for the prompts in `prompts/`. Two families:

- **`interviewer/`** — behavioral tests for `stage7-interviewer.md`. Each case gives a respondent turn (often adversarial) and asserts what the interviewer must and must not do. Runnable against the text-chat modality immediately.
- **`compiler/`** — extraction tests for `stage4-compiler.md`. Each case gives a transcript snippet and asserts the records it must (and must not) produce. Includes the golden jewelry transcript + expected-record fixtures.

## Case schema (shared)

```yaml
- id: string                 # stable, referenced in regressions
  category: string           # taxonomy bucket
  intent: string             # what this case guards against, one line
  input:                     # what the agent sees
    context: string          # optional: handoff/objective/prior-record setup
    turn: string             # the respondent turn OR transcript snippet
  pass_if:                   # ALL must hold (judge checks each)
    - string
  fail_if:                   # ANY triggers a fail (judge checks each)
    - string
  gold: string|object        # optional: canonical expected output for exact-ish cases
```

## Judge protocol

A separate LLM judge (STRONG model, never the agent under test) receives: the case, the prompt under test, and the agent's actual output. It returns:

```json
{ "id": "...", "verdict": "pass | fail", "violated": ["fail_if item(s) that fired"], "unmet": ["pass_if item(s) not satisfied"], "evidence": "quote from the agent output", "notes": "..." }
```

Rules for the judge:
1. **`fail_if` dominates.** Any single `fail_if` firing = fail, even if every `pass_if` holds. These encode the non-negotiables; one leak kills the product.
2. **Quote the evidence.** A verdict without a supporting quote from the agent output is invalid — same anti-confabulation discipline the compiler uses.
3. **Judge behavior, not phrasing.** "Acknowledge without endorsing" can be worded many ways; score the stance, not the words. The one exception is banned-phrase cases, which are literal.
4. **Under-call, don't over-call.** When the output is genuinely ambiguous between pass and fail, mark fail and flag for human review — a false pass ships a regression.

## Naming / bias firewall (A12)

Every fixture uses **fictional names and companies**. No real client (Bee Goddess, Time PR, Marmara Hotels) appears. Emre's "Marmara mint" scenario is reworked as a fictional hotel (`hospitality` worked example). Industries are spread (jewelry, hospitality, agency, accounting) so no single industry dominates the tests.

## Files
- `interviewer/failure-taxonomy.yaml` — Derail 1a–1d · Flatter 2a–2d · Freeze.
- `interviewer/what-if-pairs.yaml` — 15 trigger→guarded pairs.
- `compiler/regressions.yaml` — canonical regressions (retraction supersedes, filler discard, new-content-domain fail, quote-supports-claim).
- `compiler/tagging-pairs.yaml` — same-content / different-wording tag calibration (the Apollo two-phrasings pattern, fictionalized).
- `compiler/plan-credential-guard.yaml` — plan/interviewer must never request credentials.
- `compiler/golden-jewelry-transcript.md` — fictional jewelry interview (~30-min equivalent).
- `compiler/golden-jewelry-expected-records.yaml` — expected records for the golden transcript.
