"""Interview turn engine — transport-agnostic. Text chat calls run_interview_turn
directly; voice (Phase 5) enqueues it at priority 10. Either way the same rules hold:

- The interviewer's whole world is the handoff package (built by handoff.py). It never
  sees claim text or a quarantined record — nothing anyone else said reaches this person.
- Utterances are stored VERBATIM both directions (hedges are data; cleanup destroys the
  product). The transcript this produces is what the Stage 4 compiler later consumes.
- Coverage + elapsed live in the session's resumable_state so the same invite link
  resumes exactly where it stopped (A5)."""

import json
from datetime import datetime, timezone

from ..db import get_pool
from ..llm import run_chat
from ..queue import handles
from . import handoff

PAUSE_OFFER_MINUTES = 20
_START_NUDGE = "(The respondent has joined and is ready to begin.)"


def _industry_block(industry: str | None) -> str | None:
    if not industry:
        return None
    from ..config import REPO_ROOT

    path = REPO_ROOT / "prompts" / "examples" / f"{industry}.md"
    return path.read_text() if path.exists() else None


async def _load_package(plan_id) -> dict:
    """The handoff package for this session's plan — built on demand if the plan was
    approved without one yet. No plan (e.g. a smoke session) → an empty package."""
    if plan_id is None:
        return {}
    pool = await get_pool()
    row = await pool.fetchrow("select package from handoff_packages where plan_id = $1", plan_id)
    if row is None:
        return await handoff.build_handoff_package(str(plan_id))
    return json.loads(row["package"]) if isinstance(row["package"], str) else row["package"]


def _messages_from(utterances: list[dict]) -> list[dict]:
    # Anthropic needs the conversation to start with a user turn; the first real
    # utterance is the agent's opening, so prepend a synthetic (unstored) nudge.
    msgs = [{"role": "user", "content": _START_NUDGE}]
    for u in utterances:
        role = "assistant" if u["speaker"] == "agent" else "user"
        msgs.append({"role": role, "content": u["text"]})
    return msgs


async def run_interview_turn(session_id: str, respondent_text: str | None = None) -> dict:
    pool = await get_pool()
    session = await pool.fetchrow(
        "select s.*, w.industry from interview_sessions s "
        "join workspaces w on w.id = s.workspace_id where s.id = $1",
        session_id,
    )
    if session is None:
        raise RuntimeError(f"run_interview_turn: no session {session_id}")
    if session["status"] in ("completed", "expired"):
        raise RuntimeError(f"session {session_id} is {session['status']}")

    workspace_id = str(session["workspace_id"])
    started_at = session["started_at"] or datetime.now(timezone.utc)

    async def _next_index() -> int:
        n = await pool.fetchval(
            "select coalesce(max(turn_index), -1) + 1 from utterances where session_id = $1",
            session_id,
        )
        return n

    # Store the respondent's turn verbatim BEFORE generating the reply.
    if respondent_text is not None:
        await pool.execute(
            "insert into utterances (session_id, turn_index, speaker, text) values ($1,$2,'respondent',$3)",
            session_id, await _next_index(), respondent_text,
        )

    utterances = [
        dict(r) for r in await pool.fetch(
            "select turn_index, speaker, text from utterances where session_id = $1 order by turn_index",
            session_id,
        )
    ]

    package = await _load_package(session["plan_id"])
    elapsed_min = (datetime.now(timezone.utc) - started_at).total_seconds() / 60
    extra_system = (
        "## Your handoff package for this interview\n"
        "This package is your whole world — objectives, questions, vocabulary, handling "
        "notes, and the NEVER list. You were never told what anyone else said.\n\n"
        f"```json\n{json.dumps(package, ensure_ascii=False, indent=2)}\n```\n\n"
        f"Runtime status: about {int(elapsed_min)} minute(s) elapsed. Time budget "
        f"{package.get('time_budget_minutes', 30)} minutes."
    )

    reply = await run_chat(
        "interviewer",
        _messages_from(utterances),
        extra_system=extra_system,
        workspace_id=workspace_id,
        session_id=session_id,
        industry_block=_industry_block(session["industry"]),
    )

    agent_index = await _next_index()
    await pool.execute(
        "insert into utterances (session_id, turn_index, speaker, text) values ($1,$2,'agent',$3)",
        session_id, agent_index, reply,
    )

    prior_state = session["resumable_state"]
    prior_state = json.loads(prior_state) if isinstance(prior_state, str) else (prior_state or {})
    should_offer_pause = elapsed_min >= PAUSE_OFFER_MINUTES and not prior_state.get("pause_offered")
    new_state = {
        **prior_state,
        "turn_count": prior_state.get("turn_count", 0) + 1,
        "elapsed_minutes": round(elapsed_min, 1),
        "objectives": package.get("objectives", []),
        "pause_offered": prior_state.get("pause_offered", False) or should_offer_pause,
        "last_turn_at": datetime.now(timezone.utc).isoformat(),
    }
    await pool.execute(
        """update interview_sessions
           set status = case when status in ('pending', 'paused') then 'active' else status end,
               started_at = coalesce(started_at, $2),
               resumable_state = $3
           where id = $1""",
        session_id, started_at, json.dumps(new_state),
    )

    return {
        "reply": reply,
        "turn_index": agent_index,
        "elapsed_minutes": round(elapsed_min, 1),
        "should_offer_pause": should_offer_pause,
    }


@handles("run_interview_turn")
async def _run_interview_turn_job(payload: dict) -> None:
    # Voice sidecar path (Phase 5): the reply is stored on the utterance; the
    # transport adapter reads it back. Text chat calls run_interview_turn directly.
    await run_interview_turn(payload["session_id"], payload.get("respondent_text"))
