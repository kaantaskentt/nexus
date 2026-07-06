"""Voice sidecar — VAPI custom-LLM transport. The turn engine is mocked; these assert
the transport contract (OpenAI SSE chunks, webhook side effects, verbatim storage)."""

from types import SimpleNamespace

import pytest
from fastapi import HTTPException
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.routers import voice
from tests.conftest import make_workspace


async def _session(db, ws, token):
    return await db.fetchval(
        "insert into interview_sessions (workspace_id, modality, invite_token, status) "
        "values ($1, 'voice', $2, 'pending') returning id",
        ws, token,
    )


def _client():
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://t")


async def test_custom_llm_streams_openai_chunks(db, monkeypatch):
    ws = await make_workspace(db, industry="jewelry")
    await _session(db, ws, "voicetok1")

    async def fake_stream(session_id, messages):
        for piece in ["Hi there", ", walk me through"]:
            yield piece

    monkeypatch.setattr(voice, "stream_reply", fake_stream)

    async with _client() as c:
        r = await c.post(
            "/api/voice/chat/completions",
            json={"metadata": {"session_token": "voicetok1"},
                  "messages": [{"role": "user", "content": "hello"}]},
        )
    body = r.text
    assert '"object": "chat.completion.chunk"' in body
    assert '"role": "assistant"' in body           # first frame opens the message
    assert "Hi there" in body and "walk me through" in body
    assert '"finish_reason": "stop"' in body
    assert body.rstrip().endswith("data: [DONE]")


async def test_custom_llm_unknown_token_404(db, monkeypatch):
    async def fake_stream(session_id, messages):
        yield "x"
    monkeypatch.setattr(voice, "stream_reply", fake_stream)
    async with _client() as c:
        r = await c.post("/api/voice/chat/completions",
                         json={"metadata": {"session_token": "nope"}, "messages": []})
    assert r.status_code == 404


async def test_webhook_transcript_stores_verbatim(db):
    ws = await make_workspace(db, industry="jewelry")
    sess = await _session(db, ws, "voicetok2")
    async with _client() as c:
        await c.post("/api/voice/webhook", json={"message": {
            "type": "transcript", "transcriptType": "final", "role": "user",
            "transcript": "Umm, sanırım maybe two hours, I dunno.",
            "words": [{"word": "Umm", "start": 0.0, "end": 0.3}],
            "call": {"metadata": {"session_token": "voicetok2"}},
        }})
    row = await db.fetchrow("select speaker, text, word_timestamps from utterances where session_id=$1", sess)
    assert row["speaker"] == "respondent"
    assert row["text"] == "Umm, sanırım maybe two hours, I dunno."  # verbatim, not cleaned
    assert row["word_timestamps"] is not None


async def test_webhook_end_of_call_completes_and_compiles(db):
    ws = await make_workspace(db, industry="jewelry")
    sess = await _session(db, ws, "voicetok3")
    async with _client() as c:
        await c.post("/api/voice/webhook", json={"message": {
            "type": "end-of-call-report",
            "call": {"metadata": {"session_token": "voicetok3"}},
            "artifact": {"recording": {"stereoUrl": "https://rec/x.wav"},
                         "transcript": "N: hi\nUser: hello"},
        }})
    row = await db.fetchrow(
        "select status, resumable_state from interview_sessions where id=$1", sess
    )
    import json
    state = json.loads(row["resumable_state"]) if isinstance(row["resumable_state"], str) else row["resumable_state"]
    assert row["status"] == "completed"
    assert state["recording_url"] == "https://rec/x.wav"
    # Stage 4 compile was enqueued for the finished call.
    jobs = await db.fetchval(
        "select count(*) from jobs where kind='compile_session' and payload->>'session_id'=$1",
        str(sess),
    )
    assert jobs == 1


async def test_voice_secret_gate(monkeypatch):
    monkeypatch.setattr(voice, "get_settings", lambda: SimpleNamespace(voice_shared_secret="s3cret"))
    with pytest.raises(HTTPException) as e:
        voice._check_secret(None)
    assert e.value.status_code == 401
    voice._check_secret("s3cret")  # correct secret passes
