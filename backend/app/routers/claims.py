"""Claim record queries. Client-facing reads use client_visible_claims ONLY —
the quarantine lives in the view, not in per-endpoint filters (non-negotiable #4)."""

import json

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


@router.get("/{workspace_id}/never-list-candidates")
async def never_list_candidates(workspace_id: str):
    """DIRECTIVE records + their SEQUENCING/NEVER triggers — the plan-generator
    consumes these as NEVER-list candidates so handling instructions ("don't mention
    Harrods") shape the handoff package, not just sit in the store. Directives carry
    no trust tag and are never respondent-facing; the handoff builder enforces that."""
    pool = await get_pool()
    rows = await pool.fetch(
        """select id, claim_text, evidence_quote, provenance
           from claim_records
           where workspace_id = $1 and kind = 'directive'
           order by created_at""",
        workspace_id,
    )
    return [
        {
            "id": str(r["id"]),
            "instruction": r["claim_text"],
            "evidence_quote": r["evidence_quote"],
            "triggers": (json.loads(r["provenance"]) if isinstance(r["provenance"], str)
                         else r["provenance"]).get("triggers", []),
        }
        for r in rows
    ]
