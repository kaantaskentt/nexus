"""Interview sessions — token entry, turn engine mount point (Phase 4/5).
run_interview_turn is transport-agnostic: text chat and VAPI both land here."""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..db import get_pool
from ..pipeline.interview import run_interview_turn

router = APIRouter()


async def _session_for_token(token: str):
    pool = await get_pool()
    row = await pool.fetchrow(
        """select id, workspace_id, status, modality, language, resumable_state
           from interview_sessions
           where invite_token = $1 and (token_expires_at is null or token_expires_at > now())""",
        token,
    )
    if row is None:
        raise HTTPException(404, "invalid or expired invite")
    return row


@router.get("/by-token/{token}")
async def get_by_token(token: str):
    return dict(await _session_for_token(token))


class TurnIn(BaseModel):
    message: str | None = None  # None on the opening call — the interviewer speaks first


@router.post("/by-token/{token}/turn")
async def take_turn(token: str, body: TurnIn):
    """Text-chat turn keyed by invite token. Single-session binding + expiry are in
    the token lookup; a completed/expired session is closed and won't accept turns."""
    session = await _session_for_token(token)
    if session["status"] in ("completed", "expired"):
        raise HTTPException(409, f"interview already {session['status']}")
    result = await run_interview_turn(str(session["id"]), body.message)
    return result


@router.post("/by-token/{token}/pause")
async def pause(token: str):
    session = await _session_for_token(token)
    pool = await get_pool()
    await pool.execute(
        "update interview_sessions set status = 'paused' where id = $1 and status = 'active'",
        session["id"],
    )
    return {"status": "paused", "resumes_on": "same link"}
