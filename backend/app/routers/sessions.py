"""Interview sessions — token entry, turn engine mount point (Phase 4/5).
run_interview_turn is transport-agnostic: text chat and VAPI both land here."""

import json
import secrets

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..config import get_settings
from ..db import get_pool
from ..pipeline.interview import run_interview_turn

router = APIRouter()

EVAL_WORKSPACE_SLUG = "eval-harness"


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


class EvalBootstrapIn(BaseModel):
    handoff: dict
    modality: str = "text"
    language: str = "en"


@router.post("/eval-bootstrap")
async def eval_bootstrap(body: EvalBootstrapIn):
    """Test-only: mint an is_demo session from a handoff package so the eval harness
    can drive the real turn engine. Double-gated per A12: refused unless EVAL_MODE is
    on, and it only ever touches the is_demo eval workspace — never a real tenant."""
    if not get_settings().eval_mode:
        raise HTTPException(403, "eval-bootstrap disabled (set EVAL_MODE=1)")
    pool = await get_pool()
    async with pool.acquire() as conn, conn.transaction():
        ws = await conn.fetchval("select id from workspaces where slug = $1", EVAL_WORKSPACE_SLUG)
        if ws is None:
            ws = await conn.fetchval(
                "insert into workspaces (name, slug, industry, is_demo) "
                "values ('Eval Harness', $1, 'jewelry', true) returning id",
                EVAL_WORKSPACE_SLUG,
            )
        # A throwaway plan carries the posted package; the turn engine loads it by plan_id.
        plan_id = await conn.fetchval(
            "insert into interview_plans (workspace_id, state) values ($1, 'APPROVED') returning id",
            ws,
        )
        await conn.execute(
            "insert into handoff_packages (plan_id, package) values ($1, $2)",
            plan_id,
            json.dumps(body.handoff),
        )
        token = secrets.token_urlsafe(24)
        await conn.execute(
            """insert into interview_sessions
                 (workspace_id, plan_id, modality, language, invite_token, status)
               values ($1, $2, $3, $4, $5, 'pending')""",
            ws, plan_id, body.modality, body.language, token,
        )
    return {"token": token}
