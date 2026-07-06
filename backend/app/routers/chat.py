"""Context chat (V2 #20 / V2-PLAN decision #2).

Read-only Q&A grounded in the record store: retrieve over client_visible_claims,
answer citing record ids (the frontend renders them as evidence chips with the
record's trust badge). "Add as context" is the one write, and it does not edit the
records directly — it compiles the admin's statement through the STANDARD compiler
at CLAIMED-at-best (one person's account, never CONFIRMED/VERIFIED). Plan changes
only ever surface as suggestions the admin applies; nothing here mutates a plan.
"""

import json

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..db import get_pool
from ..embeddings import embed, to_pgvector
from ..llm import extract_json, run_agent
from ..pipeline.compiler import _load_industry_block
from ..queue import enqueue

router = APIRouter()

_K = 12  # retrieved records per question — enough context, small enough to stay grounded


async def _industry_for(workspace_id: str) -> str | None:
    pool = await get_pool()
    ind = await pool.fetchval("select industry from workspaces where id = $1", workspace_id)
    if ind is None:
        raise HTTPException(404, "no such workspace")
    return _load_industry_block(ind)


async def _retrieve(workspace_id: str, question: str, k: int = _K) -> list[dict]:
    """Top-k client-visible claims for the question. Embedding similarity when we can
    embed the query; otherwise most-recent as an honest fallback (never silent — the
    caller still answers, just without semantic ranking)."""
    pool = await get_pool()
    qvec = to_pgvector(await embed(question))
    cols = "id, kind, topic, tag, claim_text, evidence_quote"
    if qvec is not None:
        rows = await pool.fetch(
            f"select {cols} from client_visible_claims "
            "where workspace_id = $1 and embedding is not null "
            "order by embedding <=> $2::vector limit $3",
            workspace_id, qvec, k,
        )
        if rows:
            return [dict(r) for r in rows]
    rows = await pool.fetch(
        f"select {cols} from client_visible_claims where workspace_id = $1 "
        "order by created_at desc limit $2",
        workspace_id, k,
    )
    return [dict(r) for r in rows]


def _records_block(records: list[dict]) -> str:
    lines = []
    for r in records:
        rid = str(r["id"])
        tag = r["tag"] or "untagged"
        quote = f" | evidence: \"{r['evidence_quote']}\"" if r.get("evidence_quote") else ""
        lines.append(f"- id={rid} [{tag}] ({r.get('topic')}): {r['claim_text']}{quote}")
    return "\n".join(lines) if lines else "(no records retrieved)"


class AskIn(BaseModel):
    question: str


@router.post("/{workspace_id}/ask")
async def ask(workspace_id: str, body: AskIn):
    industry = await _industry_for(workspace_id)
    records = await _retrieve(workspace_id, body.question)
    valid_ids = {str(r["id"]): r for r in records}

    user_content = (
        f"# Question\n{body.question}\n\n"
        f"# Retrieved records (your only source of truth)\n{_records_block(records)}"
    )
    raw = await run_agent(
        "chat_context", user_content, workspace_id=workspace_id, industry_block=industry,
        retrieval_queries=[body.question], claims_grounding=True,
    )
    data = extract_json(raw)

    # Only surface citations that map to a real retrieved record — never a hallucinated id.
    cited = [cid for cid in (data.get("citations") or []) if str(cid) in valid_ids]
    citations = [
        {
            "record_id": cid,
            "tag": valid_ids[cid]["tag"],
            "claim_text": valid_ids[cid]["claim_text"],
            "evidence_quote": valid_ids[cid]["evidence_quote"],
            "topic": valid_ids[cid]["topic"],
        }
        for cid in cited
    ]
    return {
        "answer": data.get("answer", ""),
        "citations": citations,
        "suggestions": data.get("suggestions") or [],
    }


class AddContextIn(BaseModel):
    statement: str


@router.post("/{workspace_id}/add-context")
async def add_context(workspace_id: str, body: AddContextIn):
    """Compile an admin statement through the standard path, capped at CLAIMED. It
    becomes ordinary records in the store (subject to the same compare-not-edit rules),
    not a hand-edited claim."""
    text = body.statement.strip()
    if not text:
        raise HTTPException(400, "empty statement")
    pool = await get_pool()
    if not await pool.fetchval("select 1 from workspaces where id = $1", workspace_id):
        raise HTTPException(404, "no such workspace")

    session_id = await pool.fetchval(
        "insert into interview_sessions (workspace_id, modality, status, session_kind) "
        "values ($1, 'text', 'completed', 'context') returning id",
        workspace_id,
    )
    await pool.execute(
        "insert into utterances (session_id, turn_index, speaker, text) values ($1, 0, 'respondent', $2)",
        session_id, text,
    )
    job_id = await enqueue(
        "compile_session", {"session_id": str(session_id), "max_tag": "CLAIMED"}
    )
    return {"ok": True, "session_id": str(session_id), "job_id": job_id}
