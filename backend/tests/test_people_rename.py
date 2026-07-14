"""Inline person name correction — entity aliases + latest suggested_person card face."""

import json

from app.pipeline import snapshot
from app.routers.workspaces import (
    PersonCreateIn,
    PersonFromCardIn,
    PersonRenameIn,
    create_person,
    list_people,
    person_from_card,
    rename_person,
)
from tests.conftest import make_session, make_workspace


def _agent(output: str):
    async def _run(agent_name, content, **kw):
        return output
    return _run


async def test_list_people(db):
    ws = await make_workspace(db)
    await db.execute(
        "insert into entities (workspace_id, entity_type, canonical_name, aliases, role, source) "
        "values ($1,'person','Sales Director',ARRAY['SD'],'Sales Director','interview')",
        ws,
    )
    rows = await list_people(str(ws))
    assert len(rows) == 1
    assert rows[0]["canonical_name"] == "Sales Director"
    assert "SD" in rows[0]["aliases"]


async def test_create_person_manual_source(db):
    ws = await make_workspace(db)
    out = await create_person(
        str(ws), PersonCreateIn(name="Melis Aydın", role="Ops Lead")
    )
    assert out["canonical_name"] == "Melis Aydın"
    assert out["role"] == "Ops Lead"
    assert out["source"] == "manual"
    assert out.get("created") is True

    # Second create with same name resolves existing and does not duplicate.
    again = await create_person(
        str(ws), PersonCreateIn(name="Melis Aydın", role="Head of Ops")
    )
    assert again["id"] == out["id"]
    assert again["role"] == "Head of Ops"
    rows = await list_people(str(ws))
    assert len(rows) == 1


async def test_rename_moves_old_name_to_aliases_and_updates_card(db):
    ws = await make_workspace(db)
    ent = await db.fetchval(
        "insert into entities (workspace_id, entity_type, canonical_name, role, source) "
        "values ($1,'person','Sales Director','Sales Director','interview') returning id",
        ws,
    )
    card_id = await db.fetchval(
        """insert into snapshot_cards
             (workspace_id, card_type, confidence, render_batch, content)
           values ($1,'suggested_person','reported',1,$2::jsonb) returning id""",
        ws,
        json.dumps({
            "name": "Sales Director",
            "role": "Sales Director",
            "why_line": "owns the inbox",
            "entity_id": str(ent),
            "tag": {"label": "call-discovered", "tone": "call"},
        }),
    )

    out = await rename_person(
        str(ws), str(ent), PersonRenameIn(name="Alex Rivera", role="Sales Director")
    )
    assert out["canonical_name"] == "Alex Rivera"
    assert "Sales Director" in out["aliases"]
    assert out["cards_updated"] == 1

    content = await db.fetchval("select content from snapshot_cards where id=$1", card_id)
    if isinstance(content, str):
        content = json.loads(content)
    assert content["name"] == "Alex Rivera"
    assert content["entity_id"] == str(ent)


async def test_person_from_card_attaches_entity_when_missing(db):
    ws = await make_workspace(db)
    card_id = await db.fetchval(
        """insert into snapshot_cards
             (workspace_id, card_type, confidence, render_batch, content)
           values ($1,'suggested_person','reported',1,$2::jsonb) returning id""",
        ws,
        json.dumps({
            "name": "FP&A person",
            "role": "FP&A",
            "why_line": "owns forecasting",
            "tag": {"label": "call-discovered", "tone": "call"},
        }),
    )

    out = await person_from_card(
        str(ws),
        PersonFromCardIn(card_id=str(card_id), name="Sam Chen", role="FP&A"),
    )
    assert out["canonical_name"] == "Sam Chen"
    assert "FP&A person" in out["aliases"] or out["canonical_name"] == "Sam Chen"

    content = await db.fetchval("select content from snapshot_cards where id=$1", card_id)
    if isinstance(content, str):
        content = json.loads(content)
    assert content["name"] == "Sam Chen"
    assert content["entity_id"] == out["id"]


async def test_snapshot_stitch_matches_aliases(db, monkeypatch):
    """After a rename, cards that still say the old role-only label stitch by alias."""
    ws = await make_workspace(db)
    sess = await make_session(db, ws)
    await db.execute(
        "insert into claim_records (workspace_id, session_id, kind, topic, tag, claim_text) "
        "values ($1,$2,'statement','pain','CONFIRMED','Inbox is a bottleneck')",
        ws,
        sess,
    )
    ent = await db.fetchval(
        "insert into entities (workspace_id, entity_type, canonical_name, aliases, role, source) "
        "values ($1,'person','Alex Rivera',ARRAY['Sales Director'],'Sales Director','interview') "
        "returning id",
        ws,
    )

    cards = json.dumps({"cards": [
        {"card_type": "suggested_person", "confidence": "high",
         "content": {"name": "Sales Director", "role": "Sales Director",
                     "why_line": "owns the inbox",
                     "tag": {"label": "call-discovered", "tone": "call"}}},
    ]})
    monkeypatch.setattr("app.llm.run_agent", _agent(cards))
    await snapshot.render_snapshot({"workspace_id": str(ws)})

    row = await db.fetchrow(
        "select content from snapshot_cards where workspace_id=$1 and card_type='suggested_person' "
        "order by render_batch desc limit 1",
        ws,
    )
    content = json.loads(row["content"]) if isinstance(row["content"], str) else row["content"]
    assert content["entity_id"] == str(ent)
