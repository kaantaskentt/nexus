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
