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

async def test_entity_ids_are_stitched_never_model_copied(db, monkeypatch):
    """July 8 (Emre doc-2 P1 'Melis'): the renderer mistranscribed one hex digit of a
    person's uuid into a suggested_person card, and every Generate-plan on that card
    500'd on the FK. Ids must be stitched mechanically from the entities table by name;
    a model-emitted id is overwritten on a name match and DROPPED otherwise."""
    ws = await make_workspace(db, industry="jewelry")
    sess = await make_session(db, ws)
    await db.execute(
        "insert into claim_records (workspace_id, session_id, kind, topic, tag, claim_text) "
        "values ($1,$2,'statement','process_step','CONFIRMED','Melis builds the digest')", ws, sess)
    melis = await db.fetchval(
        "insert into entities (workspace_id, entity_type, canonical_name, source) "
        "values ($1,'person','Melis','interview') returning id", ws)

    corrupted = str(melis)[:-1] + ("0" if str(melis)[-1] != "0" else "1")
    cards = json.dumps({"cards": [
        {"card_type": "suggested_person", "confidence": "high",
         "content": {"name": "Melis", "role": "Digest owner", "why_line": "owns it",
                     "tag": {"label": "call-discovered", "tone": "call"},
                     "entity_id": corrupted}},  # one flipped char — the real bug
        {"card_type": "suggested_person", "confidence": "high",
         "content": {"name": "Nobody Known", "role": "?", "why_line": "?",
                     "tag": {"label": "call-discovered", "tone": "call"},
                     "entity_id": corrupted}},  # no matching person at all
    ]})
    monkeypatch.setattr("app.llm.run_agent", _agent(cards))
    await snapshot.render_snapshot({"workspace_id": str(ws)})

    rows = await db.fetch(
        "select content from snapshot_cards where workspace_id=$1 and card_type='suggested_person'", ws)
    by_name = {}
    for r in rows:
        c = json.loads(r["content"]) if isinstance(r["content"], str) else r["content"]
        by_name[c["name"]] = c
    # The matched person carries the REAL id (model's corrupted copy overwritten)…
    assert by_name["Melis"]["entity_id"] == str(melis)
    # …and an unmatched name carries none (plan-time name-resolve handles it honestly).
    assert "entity_id" not in by_name["Nobody Known"]
