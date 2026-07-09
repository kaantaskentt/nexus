"""F7 BETA context call wiring: the mint is gated on the creation-time beta flag, a
'context' session binds the context-collector persona in both engine paths while every
other kind keeps the interviewer, the by-token payload carries the BETA marker, and
compile does NOT skip the kind (the transcript feeds the same pipeline)."""

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.pipeline import compiler, interview
from tests.conftest import make_session, make_workspace


def _client():
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://t")


async def _beta_workspace(c):
    r = await c.post("/api/workspaces", json={
        "name": "Beta Call Co", "industry": "printing",
        "contact_person": "Kerem", "beta_context_call": True,
    })
    assert r.status_code == 200
    return r.json()["id"]


async def test_mint_gated_on_beta_flag(db):
    plain = await make_workspace(db)
    async with _client() as c:
        off = await c.post(f"/api/workspaces/{plain}/context-call")
        assert off.status_code == 403

        ws = await _beta_workspace(c)
        minted = await c.post(f"/api/workspaces/{ws}/context-call")
        assert minted.status_code == 200
        token = minted.json()["token"]
        assert minted.json()["invite_path"] == f"/i/{token}"

        by_token = (await c.get(f"/api/sessions/by-token/{token}")).json()
    assert by_token["context_call"] is True
    assert "test_mode" not in by_token  # the client's room stays chrome-free

    row = await db.fetchrow(
        "select s.session_kind, s.modality, e.canonical_name from interview_sessions s "
        "left join entities e on e.id = s.interviewee_id where s.invite_token = $1",
        token,
    )
    assert row["session_kind"] == "context"
    assert row["modality"] == "voice"
    assert row["canonical_name"] == "Kerem"  # the CEO entity attributes the compile


async def test_turn_engine_binds_collector_for_context_kind(db, monkeypatch):
    async with _client() as c:
        ws = await _beta_workspace(c)
        token = (await c.post(f"/api/workspaces/{ws}/context-call")).json()["token"]
    sid = await db.fetchval(
        "select id from interview_sessions where invite_token = $1", token)

    seen = {}
    async def _chat(agent_name, messages, **kw):
        seen["agent"] = agent_name
        seen["extra"] = kw.get("extra_system", "")
        return "Thanks for making the time. Where does the day usually start?"
    monkeypatch.setattr("app.pipeline.interview.run_chat", _chat)

    out = await interview.run_interview_turn(str(sid), None)
    assert seen["agent"] == "context_collector"
    assert "This context call (BETA)" in seen["extra"]
    assert "handoff package" not in seen["extra"]
    assert out["reply"].startswith("Thanks")

    # A plain interview session keeps the interviewer + the handoff block, unchanged.
    plain_ws = await make_workspace(db)
    plain_sid = await make_session(db, plain_ws)
    await interview.run_interview_turn(str(plain_sid), None)
    assert seen["agent"] == "interviewer"
    assert "handoff package" in seen["extra"]


async def test_voice_system_binds_collector_for_context_kind(db):
    async with _client() as c:
        ws = await _beta_workspace(c)
        token = (await c.post(f"/api/workspaces/{ws}/context-call")).json()["token"]
    sid = await db.fetchval(
        "select id from interview_sessions where invite_token = $1", token)

    system = await interview.build_voice_system(str(sid))
    assert "Context Collector" in system  # the persona's own heading
    assert "This context call (BETA)" in system

    plain_ws = await make_workspace(db)
    plain_sid = await make_session(db, plain_ws)
    plain_system = await interview.build_voice_system(str(plain_sid))
    assert "Context Collector" not in plain_system
    assert "handoff package" in plain_system


async def test_compile_does_not_skip_context_kind(db, monkeypatch):
    """The whole point of F7: the context call feeds the SAME pipeline as an uploaded
    CEO transcript. Prove the voice_test/roleplay skip guard does not catch it."""
    async with _client() as c:
        ws = await _beta_workspace(c)
        token = (await c.post(f"/api/workspaces/{ws}/context-call")).json()["token"]
    sid = await db.fetchval(
        "select id from interview_sessions where invite_token = $1", token)
    await db.execute(
        "insert into utterances (session_id,turn_index,speaker,text) values ($1,0,'respondent','Repricing eats my mornings.')",
        sid)

    class Engaged(Exception):
        pass

    async def _boom(*a, **k):
        raise Engaged()
    monkeypatch.setattr("app.pipeline.compiler.run_agent", _boom)  # compiler binds it at import
    with pytest.raises(Engaged):
        await compiler.compile_session({"session_id": str(sid)})
