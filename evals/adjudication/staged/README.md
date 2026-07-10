# Staged patches — ratified before they merge

Fixes that are BUILT and VERIFIED but must not land until the owning human ratifies (Emre's
F21/F41 policy lane, or Kaan overriding). Each is a `git apply`-able patch, never merged to
main, never deployed. Stocked here so the ruling-to-live gap is minutes, not a rebuild.

## 29-perception-gap-same-speaker-retraction.patch — PROMOTED 2026-07-10

**Status: LANDED on main** (lane-export, day-jul10). Ratified by Emre's pilot §3 ("The staged
same-speaker-retraction patch addresses exactly this; promote it"), which released the
SIMPLIFY-PARK F21 hold. A24 classification: ADOPT (see docs/sprint-logs/day-jul10-lane-export.md).
The `.patch` file was removed on promotion — the change now lives in the tree.

**What it did:** the packet §6 comparator eligibility rule. Excludes a claim from
perception-gap comparison only when its superseder has the SAME speaker (an authorial
self-correction, e.g. the Founder's "twelve boutiques" corrected to "ten" by himself). Keeps
claims superseded CROSS-speaker (that divergence is the real gap — the yıldırım case). A naive
"exclude all superseded" would kill the real gap; this is speaker-aware.

**Touched:** `backend/app/pipeline/conflicts.py` (`_mark_self_retracted` pass + a guard in
`_valid_perception_gap`), `prompts/agents/perception-gap.md` (hard rule 7, prompt and structural
guard agree), and `backend/tests/test_perception_gap_retraction.py` (4/4 green on promotion).
