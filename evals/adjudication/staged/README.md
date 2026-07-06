# Staged patches — ratified before they merge

Fixes that are BUILT and VERIFIED but must not land until the owning human ratifies (Emre's
F21/F41 policy lane, or Kaan overriding). Each is a `git apply`-able patch, never merged to
main, never deployed. Stocked here so the ruling-to-live gap is minutes, not a rebuild.

## 29-perception-gap-same-speaker-retraction.patch

**What:** the packet §6 comparator eligibility rule. Excludes a claim from perception-gap
comparison only when its superseder has the SAME speaker (an authorial self-correction, e.g.
the Founder's "twelve boutiques" corrected to "ten" by himself). Keeps claims superseded
CROSS-speaker (that divergence is the real gap — the yıldırım case). A naive "exclude all
superseded" would kill the real gap; this is speaker-aware.

**Touches:** `backend/app/pipeline/conflicts.py` (a `_mark_self_retracted` pass over the
comparator's records + a guard in `_valid_perception_gap`), `prompts/agents/perception-gap.md`
(hard rule 7, prompt and structural guard agree), and a new deterministic test
`backend/tests/test_perception_gap_retraction.py`.

**Verified:** applied locally, `pytest tests/test_perception_gap_retraction.py` = 4/4 — the
boutique self-retraction seeds no gap; the yıldırım cross-speaker gap survives. Reverted from
main after capture; the patch applies cleanly against current HEAD (`git apply --check` passes).

**Apply on ratification:**
```
git apply evals/adjudication/staged/29-perception-gap-same-speaker-retraction.patch
python -m pytest backend/tests/test_perception_gap_retraction.py -q   # expect 4 passed
```
Then commit + let the next deploy carry it. If HEAD has drifted and the patch no longer applies
cleanly, the three hunks are small enough to re-derive from this description.
