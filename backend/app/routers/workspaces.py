"""Workspace picker (A11.5 — no auth v1; internal workspace cards)."""

import json

from fastapi import APIRouter
from pydantic import BaseModel

from ..db import get_pool
from ..queue import enqueue

router = APIRouter()


def _loads(v):
    return json.loads(v) if isinstance(v, str) else v


@router.get("")
async def list_workspaces():
    pool = await get_pool()
    # Internal scaffolding (eval/e2e/voice tenants, demo-respondent dup) is hidden by
    # default — it must never render as a real client workspace in the picker (#22).
    rows = await pool.fetch(
        "select id, name, slug, industry, is_demo, config from workspaces "
        "where is_internal = false order by created_at"
    )
    return [{**dict(r), "config": _loads(r["config"])} for r in rows]


@router.get("/{workspace_id}/snapshot")
async def get_snapshot(workspace_id: str):
    """Company Snapshot cards (A3). Returns the latest render batch — append-only, so
    later rounds add batches; the UI shows the most recent. Quarantined content can't
    appear: the renderer reads only client_visible_claims."""
    pool = await get_pool()
    rows = await pool.fetch(
        """select id, card_type, confidence, render_batch, content from snapshot_cards
           where workspace_id = $1
             and render_batch = (select max(render_batch) from snapshot_cards where workspace_id = $1)
           order by card_type, id""",
        workspace_id,
    )
    return [{"id": str(r["id"]), "card_type": r["card_type"], "confidence": r["confidence"],
             "render_batch": r["render_batch"], "content": _loads(r["content"])} for r in rows]


@router.get("/{workspace_id}/sessions")
async def list_sessions(workspace_id: str):
    """Interview sessions for a workspace — lets the UI find the compiled session that
    a report renders from (has_report = it produced a workflow)."""
    pool = await get_pool()
    rows = await pool.fetch(
        """select s.id, s.status, s.modality, s.plan_id, e.canonical_name as interviewee,
                  exists(select 1 from workflows w where w.session_id = s.id) as has_report
           from interview_sessions s
           left join entities e on e.id = s.interviewee_id
           where s.workspace_id = $1 and s.session_kind = 'interview' order by s.created_at""",
        workspace_id,
    )
    return [dict(r) | {"id": str(r["id"]), "plan_id": str(r["plan_id"]) if r["plan_id"] else None}
            for r in rows]


class ReconIn(BaseModel):
    website_url: str | None = None
    linkedin: dict | None = None   # {actor_id, input} for the Apify people scrape
    fixtures: dict | None = None   # {website_markdown, linkedin_people} — demo path, no live scrape


@router.post("/{workspace_id}/recon")
async def trigger_recon(workspace_id: str, body: ReconIn):
    """Kick Stage 1 recon (→ SCRAPED records + client people pool → Stage 2 heuristics).
    Live scrape unless fixtures are supplied (demo runs on fixtures, A11.3)."""
    job_id = await enqueue(
        "run_recon",
        {"workspace_id": workspace_id, "website_url": body.website_url,
         "linkedin": body.linkedin, "fixtures": body.fixtures},
    )
    return {"enqueued": "run_recon", "job_id": job_id}
