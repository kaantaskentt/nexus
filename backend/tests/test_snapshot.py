"""Snapshot renderer — cards synthesized from client-visible claims, append-only per
render batch, quarantined content never reaching a card."""

import json

from app.pipeline import snapshot
from app.routers.workspaces import get_snapshot
from tests.conftest import make_session, make_workspace


def _agent(output: str):
    async def _run(agent_name, content, **kw):
        return output
    return _run


async def test_render_snapshot_inserts_cards(db, monkeypatch):
    ws = await make_workspace(db, industry="jewelry")
    sess = await make_session(db, ws)
    await db.execute(
        "insert into claim_records (workspace_id, session_id, kind, topic, tag, claim_text) "
        "values ($1,$2,'statement','pain','CONFIRMED','Returns pile up every morning')", ws, sess)

    cards = json.dumps({"cards": [
        {"card_type": "learned", "confidence": "high",
         "content": {"title": "Returns are a daily pain", "body": "Orders slip through.",
                     "source": "call", "evidence_claim_ids": []}},
        {"card_type": "area_to_investigate", "confidence": "reported",
         "content": {"rank": 1, "title": "Online returns", "pain_band": "high", "status": "Not yet investigated",
                     "admin_only": False, "why_ranked": "keeps the founder up", "summary": "returns slip",
                     "signals": {"frequency": "daily", "emotional_weight": "high", "mentions": "several"},
                     "beliefs": [{"text": "no system", "confidence": "guess"}],
                     "evidence_claim_ids": [], "what_we_dont_know": ["the actual steps"]}},
    ]})
    monkeypatch.setattr("app.llm.run_agent", _agent(cards))
    await snapshot.render_snapshot({"workspace_id": str(ws)})

    rows = await db.fetch("select card_type, render_batch, confidence from snapshot_cards where workspace_id=$1", ws)
    assert len(rows) == 2
    assert all(r["render_batch"] == 1 for r in rows)

    # A second render appends a new batch (append-only, never edits).
    monkeypatch.setattr("app.llm.run_agent", _agent(cards))
    await snapshot.render_snapshot({"workspace_id": str(ws)})
    batches = {r["render_batch"] for r in await db.fetch("select render_batch from snapshot_cards where workspace_id=$1", ws)}
    assert batches == {1, 2}

    # The endpoint returns only the latest batch.
    served = await get_snapshot(str(ws))
    assert len(served) == 2 and all(c["render_batch"] == 2 for c in served)
