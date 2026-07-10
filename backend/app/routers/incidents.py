"""Harm-incident inbox — R6 (Kaan ruling): the reviewer-scoped in-app surface for the
Section-7 incident records (replaces the SendGrid email as the notification channel).

Every route is admin-only (blanket require_admin in main.py). This is a Nexus-team review
surface, never client-visible (R4: operators are Nexus-side) — the reviewer sees incidents
across all workspaces. The records are already minimized by schema: {category, bucket,
timestamp, session_ref} + notify + review state, NO verbatim (see 0026/0027). So this
surface is safe by construction — there is no disclosure content here to leak.

The reviewer acts here (acknowledge / dismiss); the incident row itself is the record. This
does not surface the sealed_flag reviewer_summary — that stays in the sealed-flag ops layer;
this inbox is the minimized signal, matching what the dropped email would have carried."""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from ..auth import require_admin
from ..db import get_pool

router = APIRouter()

_REVIEW_ACTIONS = {"reviewed", "dismissed"}


@router.get("")
async def list_incidents(status: str | None = None):
    """Reviewer inbox: every harm incident, newest first, with its workspace name. Optional
    ?status= filter (unreviewed / reviewed / dismissed). No verbatim is selected because the
    table holds none."""
    pool = await get_pool()
    where = ""
    args: list = []
    if status is not None:
        where = "where i.review_status = $1"
        args = [status]
    rows = await pool.fetch(
        f"""select i.id, i.category, i.bucket, i.created_at, i.session_id,
                   i.notify_status, i.review_status, i.reviewed_by, i.reviewed_at,
                   i.workspace_id, w.name as workspace_name
              from harm_incidents i
              join workspaces w on w.id = i.workspace_id
              {where}
             order by i.created_at desc""",
        *args,
    )
    return {"incidents": [dict(r) for r in rows]}


class ReviewBody(BaseModel):
    action: str  # 'reviewed' | 'dismissed'


@router.post("/{incident_id}/review")
async def review_incident(incident_id: str, body: ReviewBody, admin: str = Depends(require_admin)):
    """Acknowledge (reviewed) or dismiss an incident. Records who + when so the inbox shows
    it is handled. Idempotent-friendly: re-reviewing just updates the actor/time."""
    if body.action not in _REVIEW_ACTIONS:
        raise HTTPException(422, f"action must be one of {sorted(_REVIEW_ACTIONS)}")
    pool = await get_pool()
    row = await pool.fetchrow(
        """update harm_incidents
              set review_status = $2, reviewed_by = $3, reviewed_at = now()
            where id = $1
        returning id, review_status, reviewed_by, reviewed_at""",
        incident_id, body.action, admin,
    )
    if row is None:
        raise HTTPException(404, "unknown incident")
    return dict(row)
