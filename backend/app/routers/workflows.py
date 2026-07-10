"""Workflow editor API (V2 #21) — thin HTTP over pipeline/workflow_edit.

The claim-derived workflow_steps are never mutated; edits are append-only overlays and
the editor renders the folded "effective" workflow. SOP generation and the non-executable
Skill Blueprint both read from the same effective view. Ontology rules (immutable base,
provenance, reversible soft-hide, manual steps distinct) live in the pipeline, not here."""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..db import get_pool
from ..pipeline import workflow_edit
from ..queue import enqueue

router = APIRouter()


async def _workflow_id_for_session(session_id: str) -> str:
    pool = await get_pool()
    wid = await pool.fetchval(
        "select id from workflows where session_id = $1 order by created_at desc limit 1",
        session_id,
    )
    if wid is None:
        raise HTTPException(404, "no workflow for this session yet")
    return str(wid)


def _derive_confidence(total: int, verified: int) -> str | None:
    """Workflow-level evidence rollup from the share of steps corroborated across sources
    (the existing step `verified` value). NOT a claim trust tag — a derived completeness
    read that maps through the same ladder vocabulary: High >=0.7, Medium >=0.35, else Low.
    Null when there are no steps to measure (an empty workflow claims no confidence)."""
    if total <= 0:
        return None
    ratio = verified / total
    if ratio >= 0.7:
        return "high"
    if ratio >= 0.35:
        return "medium"
    return "low"


@router.get("/{workspace_id}")
async def list_workflows(workspace_id: str):
    """Workflows in a workspace — mirrors the /api/claims/{workspace_id} and
    /api/plans/{workspace_id} convention so a workspace-scoped caller can discover a
    workflow_id. Each row carries its step count, one-line description, department (null =
    unclassified → renders under All), derived confidence, and an updated_at that reflects
    the latest edit overlay so "Updated Xh ago" is truthful. The editable view is
    /{workflow_id}/effective. (Different path depth, so the two never collide.)"""
    pool = await get_pool()
    rows = await pool.fetch(
        """select w.id, w.name, w.session_id, w.created_at, w.description, w.department,
                  (select count(*) from workflow_steps s where s.workflow_id = w.id) as step_count,
                  (select count(*) from workflow_steps s
                     where s.workflow_id = w.id and s.verified = 'verified') as verified_count,
                  greatest(
                    w.created_at,
                    coalesce((select max(o.created_at) from workflow_step_overlays o
                                where o.workflow_id = w.id), w.created_at)
                  ) as updated_at
           from workflows w where w.workspace_id = $1 order by w.created_at desc""",
        workspace_id,
    )
    return [{
        "workflow_id": str(r["id"]), "name": r["name"],
        "session_id": str(r["session_id"]) if r["session_id"] else None,
        "step_count": r["step_count"], "created_at": r["created_at"].isoformat(),
        "updated_at": r["updated_at"].isoformat(),
        "description": r["description"], "department": r["department"],
        "confidence": _derive_confidence(r["step_count"], r["verified_count"]),
    } for r in rows]


@router.get("/by-session/{session_id}/effective")
async def effective_by_session(session_id: str):
    pool = await get_pool()
    return await workflow_edit.effective_workflow(pool, await _workflow_id_for_session(session_id))


@router.get("/{workflow_id}/effective")
async def effective(workflow_id: str):
    pool = await get_pool()
    try:
        return await workflow_edit.effective_workflow(pool, workflow_id)
    except LookupError as e:
        raise HTTPException(404, str(e))


class EditIn(BaseModel):
    op: str
    step_id: str | None = None
    payload: dict = {}
    actor: str = "admin"


@router.post("/{workflow_id}/edit")
async def edit(workflow_id: str, body: EditIn):
    pool = await get_pool()
    try:
        overlay_id = await workflow_edit.apply_op(
            pool, workflow_id, body.op, body.step_id, body.payload, body.actor
        )
    except ValueError as e:
        raise HTTPException(422, str(e))
    except LookupError as e:
        raise HTTPException(404, str(e))
    effective = await workflow_edit.effective_workflow(pool, workflow_id)
    return {"overlay_id": overlay_id, "effective": effective}


@router.get("/{workflow_id}/history")
async def edit_history(workflow_id: str):
    pool = await get_pool()
    return await workflow_edit.history(pool, workflow_id)


@router.post("/{workflow_id}/sop")
async def request_sop(workflow_id: str):
    pool = await get_pool()
    if await pool.fetchval("select 1 from workflows where id = $1", workflow_id) is None:
        raise HTTPException(404, "workflow not found")
    job_id = await enqueue("generate_sop", {"workflow_id": workflow_id})
    return {"job_id": job_id, "status": "queued"}


@router.get("/{workflow_id}/sop")
async def get_sop(workflow_id: str):
    pool = await get_pool()
    row = await pool.fetchrow(
        "select document, generated_at from workflow_sops where workflow_id = $1", workflow_id
    )
    if row is None:
        return {"status": "pending"}
    import json
    doc = row["document"]
    return {
        "status": "ready",
        "document": json.loads(doc) if isinstance(doc, str) else doc,
        "generated_at": row["generated_at"].isoformat(),
    }


@router.get("/{workflow_id}/blueprint")
async def blueprint(workflow_id: str):
    pool = await get_pool()
    try:
        return await workflow_edit.blueprint(pool, workflow_id)
    except LookupError as e:
        raise HTTPException(404, str(e))
