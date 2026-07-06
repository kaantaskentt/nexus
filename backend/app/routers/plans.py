"""Interview plans + lifecycle state machine (Phase 3).
Transitions are validated server-side; the UI only renders state."""

import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..config import get_settings
from ..db import get_pool
from ..pipeline.handoff import build_handoff_package
from ..queue import enqueue

router = APIRouter()

INVITE_TTL_DAYS = 14

# One source of truth for legal transitions (MERGE_PLAN Phase 3).
TRANSITIONS: dict[str, set[str]] = {
    "DRAFT": {"NEXUS_CHECK", "AWAITING_APPROVAL"},  # custom path flips order (A6)
    "NEXUS_CHECK": {"AWAITING_APPROVAL", "DRAFT"},
    "AWAITING_APPROVAL": {"APPROVED", "DRAFT", "NEXUS_CHECK"},
    "APPROVED": {"SENT", "REVOKED"},
    "SENT": {"OPENED", "NO_RESPONSE", "REVOKED"},
    "OPENED": {"IN_PROGRESS", "NO_RESPONSE", "REVOKED"},
    "IN_PROGRESS": {"PAUSED", "COMPLETED"},
    "PAUSED": {"IN_PROGRESS", "COMPLETED"},
    "COMPLETED": {"COMPILED"},
    "COMPILED": set(),
    "NO_RESPONSE": {"SENT"},  # one gentle reminder max (A4)
    "REVOKED": set(),
}


@router.get("/{workspace_id}")
async def list_plans(workspace_id: str):
    pool = await get_pool()
    rows = await pool.fetch(
        """select p.*, e.canonical_name as interviewee_name, e.role as interviewee_role,
                  p.mission->>'interview_topic' as interview_topic
           from interview_plans p
           left join entities e on e.id = p.interviewee_id
           where p.workspace_id = $1 order by p.created_at desc""",
        workspace_id,
    )
    return [dict(r) for r in rows]


@router.post("/{plan_id}/transition")
async def transition(plan_id: str, to_state: str, actor: str = "admin", note: str | None = None):
    pool = await get_pool()
    row = await pool.fetchrow("select state from interview_plans where id = $1", plan_id)
    if row is None:
        raise HTTPException(404, "plan not found")
    from_state = row["state"]
    if to_state not in TRANSITIONS.get(from_state, set()):
        raise HTTPException(409, f"illegal transition {from_state} → {to_state}")
    async with pool.acquire() as conn, conn.transaction():
        await conn.execute(
            "update interview_plans set state = $2, updated_at = now() where id = $1",
            plan_id,
            to_state,
        )
        await conn.execute(
            """insert into plan_state_transitions (plan_id, from_state, to_state, actor, note)
               values ($1, $2, $3, $4, $5)""",
            plan_id,
            from_state,
            to_state,
            actor,
            note,
        )
    # On approval, build the interviewer's handoff package (deny-by-default: no claim
    # text, no quarantined records — enforced in handoff.build_handoff_package).
    if to_state == "APPROVED":
        await enqueue("build_handoff", {"plan_id": plan_id})
    return {"plan_id": plan_id, "from": from_state, "to": to_state}


class SendIn(BaseModel):
    interviewee_name: str | None = None  # display only; the plan already links the entity
    email: str | None = None
    job_title: str | None = None
    language: str = "en"


@router.post("/{plan_id}/send")
async def send_interview(plan_id: str, body: SendIn):
    """Send Interview (A4): mint the respondent's token-keyed session from an APPROVED
    plan, ensure the handoff package is built, and move the plan to SENT. Returns the
    invite token. Nothing reaches the interviewee here except the token — the handoff
    (never claim text, never quarantined) is what the runtime agent will load."""
    pool = await get_pool()
    plan = await pool.fetchrow(
        "select id, workspace_id, round_id, interviewee_id, state from interview_plans where id = $1",
        plan_id,
    )
    if plan is None:
        raise HTTPException(404, "plan not found")
    if plan["state"] != "APPROVED":
        raise HTTPException(409, f"plan must be APPROVED to send (is {plan['state']})")

    # Build the handoff synchronously so it exists the moment the respondent starts.
    await build_handoff_package(plan_id)

    token = secrets.token_urlsafe(24)
    expires = datetime.now(timezone.utc) + timedelta(days=INVITE_TTL_DAYS)
    async with pool.acquire() as conn, conn.transaction():
        session_id = await conn.fetchval(
            """insert into interview_sessions
                 (workspace_id, plan_id, round_id, interviewee_id, modality, language,
                  invite_token, token_expires_at, status)
               values ($1,$2,$3,$4,'text',$5,$6,$7,'pending') returning id""",
            plan["workspace_id"], plan_id, plan["round_id"], plan["interviewee_id"],
            body.language, token, expires,
        )
        await conn.execute(
            "update interview_plans set state = 'SENT', updated_at = now() where id = $1", plan_id)
        await conn.execute(
            """insert into plan_state_transitions (plan_id, from_state, to_state, actor, note)
               values ($1, 'APPROVED', 'SENT', 'admin', $2)""",
            plan_id, f"sent to {body.interviewee_name or 'interviewee'}")

    base = get_settings().app_base_url
    return {
        "session_id": str(session_id),
        "token": token,
        "invite_path": f"/i/{token}",
        "invite_url": f"{base}/i/{token}",
        "state": "SENT",
    }
