"""Interview-quality scoring (Phase 6) — a post-compile read on how well an interview
satisfied its plan (objectives satisfied / partial / dodged / untouched + spine-slot
sufficiency). Scores the INTERVIEW, never the respondent. Feeds the report's quality
indicator and the Follow-Up list. Result is stored on the session's resumable_state."""

import json
import logging

from ..db import get_pool
from ..llm import get_agent_config, run_agent_json
from ..queue import handles
from ..config import REPO_ROOT
from . import interview

log = logging.getLogger("nexus.quality")


def _build_quality_content(objectives, definition_of_done, transcript: str) -> str:
    """Assemble the scorer's user content with the OUTPUT INSTRUCTION LAST, after the
    transcript. With the transcript at the tail the model sometimes continues or echoes it
    instead of scoring (observed on prod: a 6932-char transcript-echo, zero JSON, that failed
    first-attempt parse and was saved only by the #22 retry). perception_gap parses on the
    first attempt precisely because its instruction follows its data; this mirrors that."""
    return (
        "# Plan objectives\n" + json.dumps(objectives, ensure_ascii=False) +
        "\n\n# Definition of done\n" + str(definition_of_done) +
        "\n\n# Interview transcript to score (INPUT, do not echo or continue it)\n" + transcript +
        "\n\n# Task\nScore the interview above against its objectives and workflows. Respond with "
        "ONLY the single JSON object your instructions specify. Do not repeat, echo, or continue "
        "the transcript; it is input to score, never output."
    )


async def score_interview_quality(payload: dict) -> None:
    session_id = payload["session_id"]
    cfg = await get_agent_config("interview_quality")
    if not (REPO_ROOT / cfg["prompt_path"]).exists():
        log.warning("interview-quality skipped — %s not on disk", cfg["prompt_path"])
        return

    pool = await get_pool()
    session = await pool.fetchrow(
        "select workspace_id, plan_id, resumable_state from interview_sessions where id = $1",
        session_id,
    )
    if session is None:
        return
    utterances = await pool.fetch(
        "select speaker, text from utterances where session_id = $1 order by turn_index", session_id
    )
    if not utterances:
        return
    package = await interview._load_package(session["plan_id"])
    transcript = "\n".join(f"[{u['speaker']}] {u['text']}" for u in utterances)

    content = _build_quality_content(
        package.get("objectives", []), package.get("definition_of_done"), transcript
    )
    result = await run_agent_json(
        "interview_quality", content,
        workspace_id=str(session["workspace_id"]), session_id=session_id,
    )

    state = session["resumable_state"]
    state = json.loads(state) if isinstance(state, str) else (state or {})
    state["interview_quality"] = result
    await pool.execute(
        "update interview_sessions set resumable_state = $2 where id = $1",
        session_id, json.dumps(state),
    )


@handles("score_interview_quality")
async def _score_interview_quality_job(payload: dict) -> None:
    await score_interview_quality(payload)
