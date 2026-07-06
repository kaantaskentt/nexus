"""Claim record queries. Client-facing reads use client_visible_claims ONLY —
the quarantine lives in the view, not in per-endpoint filters (non-negotiable #4)."""

import json

from fastapi import APIRouter

from ..db import get_pool

router = APIRouter()


@router.get("/{workspace_id}")
async def list_claims(workspace_id: str, topic: str | None = None):
    """Client-visible claims with two UI aids: the speaker's role, and is_paraphrased
    (F33) — evidence from an EMPLOYEE interview is paraphrased in client views, while
    CEO-call and scraped records keep their verbatim quote. The rule lives here so the
    evidence rail can render the paraphrase affordance honestly, not guess."""
    pool = await get_pool()
    q = """select c.*, sp.role as speaker_role,
             (c.session_id is not null
              and coalesce(iv.role, '') !~* '(founder|ceo|owner|chief|executive)') as is_paraphrased
           from client_visible_claims c
           left join entities sp on sp.id = c.speaker_id
           left join interview_sessions s on s.id = c.session_id
           left join entities iv on iv.id = s.interviewee_id
           where c.workspace_id = $1"""
    args: list = [workspace_id]
    if topic:
        q += " and c.topic = $2"
        args.append(topic)
    rows = await pool.fetch(q + " order by c.created_at desc limit 200", *args)
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
