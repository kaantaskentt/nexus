"""Interview plans + lifecycle state machine (Phase 3).
Transitions are validated server-side; the UI only renders state."""

from fastapi import APIRouter, HTTPException

from ..db import get_pool

router = APIRouter()

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
        "select * from interview_plans where workspace_id = $1 order by created_at desc",
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
    return {"plan_id": plan_id, "from": from_state, "to": to_state}
