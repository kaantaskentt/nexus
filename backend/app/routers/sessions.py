"""Interview sessions — token entry, turn engine mount point (Phase 4/5).
run_interview_turn is transport-agnostic: text chat and VAPI both land here."""

from fastapi import APIRouter, HTTPException

from ..db import get_pool

router = APIRouter()


@router.get("/by-token/{token}")
async def get_by_token(token: str):
    pool = await get_pool()
    row = await pool.fetchrow(
        """select id, status, modality, language, resumable_state
           from interview_sessions
           where invite_token = $1 and (token_expires_at is null or token_expires_at > now())""",
        token,
    )
    if row is None:
        raise HTTPException(404, "invalid or expired invite")
    return dict(row)
