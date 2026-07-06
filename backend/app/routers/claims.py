"""Claim record queries. Client-facing reads use client_visible_claims ONLY —
the quarantine lives in the view, not in per-endpoint filters (non-negotiable #4)."""

from fastapi import APIRouter

from ..db import get_pool

router = APIRouter()


@router.get("/{workspace_id}")
async def list_claims(workspace_id: str, topic: str | None = None):
    pool = await get_pool()
    q = "select * from client_visible_claims where workspace_id = $1"
    args: list = [workspace_id]
    if topic:
        q += " and topic = $2"
        args.append(topic)
    rows = await pool.fetch(q + " order by created_at desc limit 200", *args)
    return [dict(r) for r in rows]
