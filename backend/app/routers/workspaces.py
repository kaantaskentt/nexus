"""Workspace picker (A11.5 — no auth v1; internal workspace cards)."""

from fastapi import APIRouter
from pydantic import BaseModel

from ..db import get_pool
from ..queue import enqueue

router = APIRouter()


@router.get("")
async def list_workspaces():
    pool = await get_pool()
    rows = await pool.fetch(
        "select id, name, slug, industry, is_demo from workspaces order by created_at"
    )
    return [dict(r) for r in rows]


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
