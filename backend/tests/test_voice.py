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


async def test_custom_llm_empty_stream_sends_fallback(db, monkeypatch):
    """A turn that yields no content must not end silent — VAPI would speak nothing and
    the call stalls. The endpoint injects an honest recovery line and still closes cleanly."""
    ws = await make_workspace(db, industry="jewelry")
    await _session(db, ws, "voiceempty")

    async def empty_stream(session_id, messages):
        return
        yield  # pragma: no cover — makes this an async generator that yields nothing

    monkeypatch.setattr(voice, "stream_reply", empty_stream)
    async with _client() as c:
        r = await c.post(
            "/api/voice/chat/completions",
            json={"metadata": {"session_token": "voiceempty"}, "messages": []},
        )
    body = r.text
    assert voice._EMPTY_TURN_FALLBACK in body
    assert '"finish_reason": "stop"' in body
    assert body.rstrip().endswith("data: [DONE]")


async def test_custom_llm_stream_error_sends_fallback(db, monkeypatch):
    """A mid-stream failure is caught, not propagated: the respondent hears the recovery
    line instead of a torn stream, and the frame sequence still terminates with [DONE]."""
    ws = await make_workspace(db, industry="jewelry")
    await _session(db, ws, "voiceerr")

    async def boom_stream(session_id, messages):
        raise RuntimeError("model hiccup")
        yield  # pragma: no cover — unreachable; marks this as an async generator

    monkeypatch.setattr(voice, "stream_reply", boom_stream)
    async with _client() as c:
        r = await c.post(
            "/api/voice/chat/completions",
            json={"metadata": {"session_token": "voiceerr"}, "messages": []},
        )
    assert r.status_code == 200
    body = r.text
    assert voice._EMPTY_TURN_FALLBACK in body
    assert body.rstrip().endswith("data: [DONE]")


async def test_custom_llm_partial_stream_no_fallback(db, monkeypatch):
    """When real content did stream, the fallback line must NOT appear (only genuine
    empties get it)."""
    ws = await make_workspace(db, industry="jewelry")
    await _session(db, ws, "voicepartial")

    async def some_stream(session_id, messages):
        yield "Got it."

    monkeypatch.setattr(voice, "stream_reply", some_stream)
    async with _client() as c:
        r = await c.post(
            "/api/voice/chat/completions",
            json={"metadata": {"session_token": "voicepartial"}, "messages": []},
        )
    body = r.text
    assert "Got it." in body
    assert voice._EMPTY_TURN_FALLBACK not in body


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


async def _context_session(db, ws, token):
    return await db.fetchval(
        "insert into interview_sessions (workspace_id, modality, invite_token, status, session_kind) "
        "values ($1, 'voice', $2, 'active', 'context') returning id",
        ws, token,
    )


async def test_webhook_status_ended_alone_compiles(db):
    """Abnormal hangup: status-update:ended arrives with NO end-of-call-report to follow.
    The call must still complete AND compile — a live call is never captured-but-never-
    compiled (the test-mest §2 costume). A context call also flags the snapshot render."""
    ws = await make_workspace(db, industry="jewelry")
    sess = await _context_session(db, ws, "voiceended")
    async with _client() as c:
        await c.post("/api/voice/webhook", json={"message": {
            "type": "status-update", "status": "ended",
            "call": {"metadata": {"session_token": "voiceended"}},
        }})
    row = await db.fetchrow("select status from interview_sessions where id=$1", sess)
    assert row["status"] == "completed"
    job = await db.fetchrow(
        "select payload from jobs where kind='compile_session' and payload->>'session_id'=$1",
        str(sess),
    )
    assert job is not None                                  # compile guaranteed
    import json
    payload = job["payload"]
    payload = json.loads(payload) if isinstance(payload, str) else payload
    assert payload.get("render_snapshot") is True           # context → render
    for kind in ("screen_disclosures", "scan_artifact_promises"):
        n = await db.fetchval(
            "select count(*) from jobs where kind=$1 and payload->>'session_id'=$2",
            kind, str(sess),
        )
        assert n == 1


async def test_webhook_both_end_events_compile_once(db):
    """status-update:ended AND end-of-call-report for the same call (either order) must
    enqueue compile EXACTLY once — double compile would duplicate every record. The report's
    recording evidence is still stored regardless of which event won the compile flag."""
    ws = await make_workspace(db, industry="jewelry")
    sess = await _context_session(db, ws, "voiceboth")
    async with _client() as c:
        await c.post("/api/voice/webhook", json={"message": {
            "type": "status-update", "status": "ended",
            "call": {"metadata": {"session_token": "voiceboth"}},
        }})
        await c.post("/api/voice/webhook", json={"message": {
            "type": "end-of-call-report",
            "call": {"metadata": {"session_token": "voiceboth"}},
            "artifact": {"recording": {"stereoUrl": "https://rec/y.wav"},
                         "transcript": "N: hi\nUser: hello"},
        }})
    n = await db.fetchval(
        "select count(*) from jobs where kind='compile_session' and payload->>'session_id'=$1",
        str(sess),
    )
    assert n == 1                                           # idempotent across both events
    row = await db.fetchrow("select resumable_state from interview_sessions where id=$1", sess)
    import json
    state = json.loads(row["resumable_state"]) if isinstance(row["resumable_state"], str) else row["resumable_state"]
    assert state["recording_url"] == "https://rec/y.wav"   # report evidence still stored


async def test_webhook_both_end_events_compile_once_reverse_order(db):
    """The other race order: end-of-call-report FIRST, then status-update:ended. Still
    exactly one compile — the CAS flag is order-independent (team-lead seam-A constraint)."""
    ws = await make_workspace(db, industry="jewelry")
    sess = await _context_session(db, ws, "voicerev")
    async with _client() as c:
        await c.post("/api/voice/webhook", json={"message": {
            "type": "end-of-call-report",
            "call": {"metadata": {"session_token": "voicerev"}},
            "artifact": {"recording": {"stereoUrl": "https://rec/z.wav"},
                         "transcript": "N: hi\nUser: hello"},
        }})
        await c.post("/api/voice/webhook", json={"message": {
            "type": "status-update", "status": "ended",
            "call": {"metadata": {"session_token": "voicerev"}},
        }})
    n = await db.fetchval(
        "select count(*) from jobs where kind='compile_session' and payload->>'session_id'=$1",
        str(sess),
    )
    assert n == 1
    row = await db.fetchrow("select status from interview_sessions where id=$1", sess)
    assert row["status"] == "completed"


async def test_voice_secret_gate(monkeypatch):
    monkeypatch.setattr(voice, "get_settings", lambda: SimpleNamespace(voice_shared_secret="s3cret"))
    with pytest.raises(HTTPException) as e:
        voice._check_secret(None)
    assert e.value.status_code == 401
    voice._check_secret("s3cret")  # correct secret passes
