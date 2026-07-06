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

    content = (
        "Plan objectives:\n" + json.dumps(package.get("objectives", []), ensure_ascii=False) +
        "\n\nDefinition of done: " + str(package.get("definition_of_done")) +
        "\n\nTranscript:\n" + transcript
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
