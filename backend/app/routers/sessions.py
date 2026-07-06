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


async def _consent_context(session_row) -> dict:
    """Merge fields for the consent landing page. The interview TOPIC is the neutral
    area from the plan mission — the same value the invite's {{INTERVIEW_TOPIC}} used —
    sourced from the plan/handoff, NEVER from claim text or who-said-what (non-negotiable
    #2). Names/company are respondent-facing identity only (F4: names + roles)."""
    pool = await get_pool()
    row = await pool.fetchrow(
        """select w.name as company_name, w.config as ws_config,
                  e.canonical_name as respondent_name,
                  p.mission as mission, h.package as package
           from interview_sessions s
           join workspaces w on w.id = s.workspace_id
           left join entities e on e.id = s.interviewee_id
           left join interview_plans p on p.id = s.plan_id
           left join handoff_packages h on h.plan_id = s.plan_id
           where s.id = $1""",
        session_row["id"],
    )
    mission = row["mission"] if row else None
    mission = json.loads(mission) if isinstance(mission, str) else (mission or {})
    package = row["package"] if row else None
    package = json.loads(package) if isinstance(package, str) else (package or {})
    ws_config = row["ws_config"] if row else None
    ws_config = json.loads(ws_config) if isinstance(ws_config, str) else (ws_config or {})

    first_name = (row["respondent_name"].split()[0] if row and row["respondent_name"] else None)
    topic = mission.get("interview_topic") or mission.get("goal")  # neutral, plan-sourced
    est = package.get("time_budget_minutes") or mission.get("time_budget_minutes") or 30
    return {
        "respondent_first_name": first_name,
        "company_name": row["company_name"] if row else None,
        "admin_name": ws_config.get("admin_name"),
        "topic": topic,
        "est_minutes": est,
        "modality": session_row["modality"],
    }


@router.get("/by-token/{token}")
async def get_by_token(token: str):
    session = await _session_for_token(token)
    return {**dict(session), "context": await _consent_context(session)}


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
