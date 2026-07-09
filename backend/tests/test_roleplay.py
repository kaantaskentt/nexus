"""F8 role-play simulations: mint is persona-validated and voice_test-class firewalled
(compile + disclosure skip it), the playable brief serves the full character sheet, and
the observation debrief is generated once, idempotently, from the transcript."""

import json

from httpx import ASGITransport, AsyncClient

from app.main import app
from app.pipeline import compiler, roleplay
from tests.conftest import make_workspace


def _client():
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://t")


async def _mint(c, ws, persona="bookkeeper"):
    r = await c.post(f"/api/simulations/{ws}/roleplay", json={"persona_key": persona})
    assert r.status_code == 200
    return r.json()


async def _session_id(db, token):
    return await db.fetchval(
        "select id from interview_sessions where invite_token = $1", token
    )


async def test_mint_firewalled_and_validated(db):
    ws = await make_workspace(db)
    async with _client() as c:
        minted = await _mint(c, ws)
        bad_persona = await c.post(f"/api/simulations/{ws}/roleplay",
                                   json={"persona_key": "not-a-persona"})
        bad_ws = await c.post(
            "/api/simulations/00000000-0000-0000-0000-000000000000/roleplay",
            json={"persona_key": "bookkeeper"})
    assert bad_persona.status_code == 422
    assert bad_ws.status_code == 404
    sid = await _session_id(db, minted["token"])
    row = await db.fetchrow(
        "select session_kind, resumable_state from interview_sessions where id = $1", sid)
    assert row["session_kind"] == "roleplay"
    state = row["resumable_state"]
    state = json.loads(state) if isinstance(state, str) else state
    assert state["roleplay_persona"] == "bookkeeper"


async def test_compile_skips_roleplay(db, monkeypatch):
    ws = await make_workspace(db)
    async with _client() as c:
        minted = await _mint(c, ws)
    sid = await _session_id(db, minted["token"])
    await db.execute(
        "insert into utterances (session_id,turn_index,speaker,text) values ($1,0,'respondent','secret roleplay line')",
        sid)

    async def _boom(*a, **k):
        raise AssertionError("compiler must never run an agent for a roleplay session")
    monkeypatch.setattr("app.llm.run_agent", _boom)
    await compiler.compile_session({"session_id": str(sid)})
    assert await db.fetchval(
        "select count(*) from claim_records where workspace_id = $1", ws) == 0


async def test_brief_serves_full_sheet(db):
    async with _client() as c:
        r = await c.get("/api/simulations/roleplay/personas/jewelry-ops-manager/brief")
        missing = await c.get("/api/simulations/roleplay/personas/nope/brief")
    assert missing.status_code == 404
    body = r.json()
    assert body["cast"]["role"].startswith("Operations manager")
    assert "SCORER-ONLY" in body["sheet"]  # the human player sees the held-back layer


async def test_debrief_flow_idempotent(db, monkeypatch):
    ws = await make_workspace(db)
    async with _client() as c:
        minted = await _mint(c, ws, persona="jewelry-ops-manager")
        sid = await _session_id(db, minted["token"])

        too_short = await c.post(f"/api/simulations/roleplay/{sid}/debrief")
        assert too_short.status_code == 422

        for i, (sp, tx) in enumerate([
            ("agent", "Walk me through the last custom order, start to finish?"),
            ("respondent", "We do things properly here, the way it works is smooth."),
            ("agent", "The most recent one specifically, when was it?"),
            ("respondent", "Tuesday. Actually that one got messy at the setting bench."),
        ]):
            await db.execute(
                "insert into utterances (session_id,turn_index,speaker,text) values ($1,$2,$3,$4)",
                sid, i, sp, tx)

        doc = {"headline": "Earned the episode, missed a hidden layer.",
               "did_well": [{"point": "episode anchor", "evidence": "The most recent one specifically"}],
               "missed": [], "objectives": [
                   {"objective": "episode anchor", "outcome": "earned", "note": "asked for the last one"}]}
        calls = {"n": 0}

        async def _agent(agent_name, content, **kw):
            assert agent_name == "roleplay_debrief"
            assert "secret" not in content
            calls["n"] += 1
            return json.dumps(doc)
        monkeypatch.setattr("app.llm.run_agent", _agent)

        q = await c.post(f"/api/simulations/roleplay/{sid}/debrief")
        assert q.json()["status"] == "queued"
        await roleplay.generate_roleplay_debrief({"session_id": str(sid)})
        await roleplay.generate_roleplay_debrief({"session_id": str(sid)})  # idempotent
        assert calls["n"] == 1

        again = await c.post(f"/api/simulations/roleplay/{sid}/debrief")
        assert again.json()["status"] == "ready"

        listing = (await c.get(f"/api/simulations/{ws}/roleplay")).json()
    assert len(listing) == 1
    assert listing[0]["persona_key"] == "jewelry-ops-manager"
    assert listing[0]["debrief"]["headline"].startswith("Earned")


async def test_by_token_roleplay_back_path(db):
    ws = await make_workspace(db)
    slug = await db.fetchval("select slug from workspaces where id = $1", ws)
    async with _client() as c:
        minted = await _mint(c, ws)
        r = await c.get(f"/api/sessions/by-token/{minted['token']}")
    body = r.json()
    assert body["test_mode"] is True
    assert body["test_back_path"] == f"/w/{slug}/simulations"
