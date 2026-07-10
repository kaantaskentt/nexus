"""SIMPLIFY E — the streaming text turn (SSE). The endpoint streams the interviewer's
reply token-by-token so words appear immediately instead of typing dots for 3-7s, while
the record is identical to the non-streaming turn: the respondent turn is stored, the
assembled reply is finalized, and live capture fires. The LLM stream is mocked — we test
the transport + persistence contract, not the model."""

import json

from httpx import ASGITransport, AsyncClient

from app.main import app
from tests.conftest import make_workspace


def _client():
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://t")


def _frames(body: str) -> list[dict]:
    return [json.loads(line[6:]) for line in body.splitlines() if line.startswith("data: ")]


async def _session_with_token(db, ws, token, *, kind="interview"):
    return await db.fetchval(
        "insert into interview_sessions (workspace_id, session_kind, invite_token, status) "
        "values ($1,$2,$3,'active') returning id", ws, kind, token)


async def test_stream_turn_yields_deltas_then_done_and_persists(db, monkeypatch):
    async def _fake_stream(agent_name, messages, **kw):
        for d in ["Thanks. ", "Where does ", "the day start?"]:
            yield d
    monkeypatch.setattr("app.pipeline.interview.run_chat_stream", _fake_stream)

    ws = await make_workspace(db)
    token = "tok_stream_" + "a" * 8
    sid = await _session_with_token(db, ws, token)

    async with _client() as c:
        r = await c.post(f"/api/sessions/by-token/{token}/turn/stream", json={"message": "hi there"})
        assert r.status_code == 200
        frames = _frames(r.text)

    deltas = [f["text"] for f in frames if f["type"] == "delta"]
    done = [f for f in frames if f["type"] == "done"]
    assert deltas == ["Thanks. ", "Where does ", "the day start?"]
    assert len(done) == 1
    assert "turn_index" in done[0]

    # The record is identical to a non-streaming turn: respondent stored verbatim + the
    # assembled reply persisted.
    rows = await db.fetch(
        "select speaker, text from utterances where session_id = $1 order by turn_index", sid)
    assert [(r["speaker"], r["text"]) for r in rows] == [
        ("respondent", "hi there"),
        ("agent", "Thanks. Where does the day start?"),
    ]
    # Live capture fires off the committed respondent turn (interview kind).
    assert await db.fetchval(
        "select count(*) from jobs where kind = 'extract_live_captures' "
        "and payload->>'session_id' = $1", str(sid)) == 1


async def test_stream_error_emits_error_frame_and_no_half_turn(db, monkeypatch):
    """If generation fails mid-stream, the endpoint emits an error frame and NO agent turn
    is persisted (no silent half-turn); the client falls back to the non-streaming /turn."""
    async def _boom_stream(agent_name, messages, **kw):
        if False:
            yield  # make it an async generator
        raise RuntimeError("anthropic hiccup")
    monkeypatch.setattr("app.pipeline.interview.run_chat_stream", _boom_stream)

    ws = await make_workspace(db)
    token = "tok_stream_" + "b" * 8
    sid = await _session_with_token(db, ws, token)

    async with _client() as c:
        r = await c.post(f"/api/sessions/by-token/{token}/turn/stream", json={"message": "hello"})
        frames = _frames(r.text)

    assert any(f["type"] == "error" for f in frames)
    assert not any(f["type"] == "done" for f in frames)
    rows = await db.fetch(
        "select speaker from utterances where session_id = $1 order by turn_index", sid)
    # Respondent turn was stored (by _prepare_turn); NO agent half-turn.
    assert [r["speaker"] for r in rows] == ["respondent"]


async def test_stream_rejects_completed_session(db):
    ws = await make_workspace(db)
    token = "tok_stream_" + "c" * 8
    await db.fetchval(
        "insert into interview_sessions (workspace_id, session_kind, invite_token, status) "
        "values ($1,'interview',$2,'completed') returning id", ws, token)
    async with _client() as c:
        r = await c.post(f"/api/sessions/by-token/{token}/turn/stream", json={"message": "hi"})
    assert r.status_code == 409
