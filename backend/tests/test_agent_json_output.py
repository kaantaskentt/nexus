"""Task #23: the verbose agents (interview_quality, perception_gap) must emit STRICT JSON so
run_agent_json parses them instead of failing the job (#17 found 7329/5885-char prose-wrapped
outputs; #22 made that failure loud; this closes the root by constraining the prompt).

These are DETERMINISTIC and offline: they guard the prompt's own JSON example (the shape the
model copies) and the parser's handling of clean output. A live check that the real seats now
emit parseable JSON runs opt-in below. No rubric/comparator CONTENT is touched here (Emre's lane);
this is output-format only."""

import json
import re
from pathlib import Path

import pytest

from app.config import REPO_ROOT
from app.llm import extract_json

QUALITY = REPO_ROOT / "prompts" / "rubrics" / "interview-quality.md"
PERCEPTION = REPO_ROOT / "prompts" / "agents" / "perception-gap.md"

_FENCE = re.compile(r"```json\s*(.*?)\s*```", re.DOTALL)


def _example(prompt_path: Path) -> str:
    m = _FENCE.search(prompt_path.read_text())
    assert m, f"{prompt_path.name}: no ```json example block found"
    return m.group(1)


def test_quality_example_is_a_single_valid_json_object():
    # The example is what the model imitates. If it is not valid JSON (stray comment, trailing
    # text), the model learns to emit unparseable output. quality.py consumes ONE object.
    obj = json.loads(_example(QUALITY))
    assert isinstance(obj, dict)
    assert {"objectives", "workflows", "headline", "follow_ups"} <= set(obj)


def test_perception_gap_example_is_a_valid_json_array():
    # conflicts.py iterates the result (`for g in run_agent_json(...)`), so the contract is an
    # ARRAY, and the example must be valid JSON with no // comments (the old example had them).
    arr = json.loads(_example(PERCEPTION))
    assert isinstance(arr, list) and arr, "perception-gap example must be a non-empty JSON array"
    assert arr[0]["type"] == "PERCEPTION_GAP"


def test_no_js_comments_in_json_examples():
    # A // comment inside the fenced block is the exact thing that broke json.loads on real output.
    for p in (QUALITY, PERCEPTION):
        assert "//" not in _example(p), f"{p.name}: JSON example must not contain // comments"


def test_prompts_carry_the_strict_output_constraint():
    # Regression guard: the format instruction must survive future edits.
    assert "ONLY" in QUALITY.read_text() and "no markdown code fence" in QUALITY.read_text()
    ptext = PERCEPTION.read_text()
    assert "ONLY a JSON array" in ptext and "empty array" in ptext


def test_extract_json_parses_clean_object_and_array():
    # The clean shapes the constrained prompts now produce parse without incident.
    assert extract_json('{"objectives": [], "headline": "ok"}')["headline"] == "ok"
    assert extract_json("[]") == []
    assert extract_json('[{"type": "PERCEPTION_GAP"}]')[0]["type"] == "PERCEPTION_GAP"


def test_extract_json_recovers_a_fenced_block():
    # Even if a stray fence slips through, a single fenced object is still recoverable.
    assert extract_json('```json\n{"headline": "x", "objectives": []}\n```')["headline"] == "x"


def test_quality_content_puts_the_output_instruction_after_the_transcript():
    # First-attempt reliability (prod evidence): a 6932-char TRANSCRIPT-ECHO failed parse
    # because the content ended with the transcript and the model continued it. The fix is
    # recency — the task instruction must be the LAST thing the model reads, like perception_gap.
    from app.pipeline.quality import _build_quality_content

    transcript = "[agent] walk me through it\n[respondent] I just do the thing and that's it"
    content = _build_quality_content([{"id": "o1"}], "each must-hit has an episode", transcript)
    assert not content.rstrip().endswith(transcript), "transcript must not be the tail of the content"
    tail = content[-320:]
    assert "ONLY the single JSON object" in tail
    assert "echo" in tail  # the anti-echo instruction lands last


def test_transcript_echo_output_is_rejected_by_the_parser():
    # The observed failure shape: the model echoed the transcript, no JSON at all. extract_json
    # must RAISE (so run_agent_json fails the job and #22 retries) rather than return garbage.
    import pytest

    echoed = "[respondent] Not yet. That's the honest answer.\n\n[END OF TRANSCRIPT]"
    with pytest.raises(ValueError):
        extract_json(echoed)
