"""Workspace picker (A11.5 — no auth v1; internal workspace cards)."""

from fastapi import APIRouter

from ..db import get_pool

router = APIRouter()


@router.get("")
async def list_workspaces():
    pool = await get_pool()
    rows = await pool.fetch(
        "select id, name, slug, industry, is_demo from workspaces order by created_at"
    )
    return [dict(r) for r in rows]
