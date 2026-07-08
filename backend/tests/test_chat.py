"""Context chat (V2 #20). The LLM is mocked; these assert the grounding contract:
citations only ever reference real retrieved records, suggestions pass through, and
"add as context" enqueues a standard compile capped at CLAIMED."""

import json

from httpx import ASGITransport, AsyncClient

from app.main import app
from app.pipeline.compiler import _cap_tag
from app.routers import chat
from tests.conftest import make_workspace


def _client():
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://t")


async def _claim(db, ws, text, tag):
    return await db.fetchval(
        "insert into claim_records (workspace_id, kind, topic, tag, claim_text) "
        "values ($1, 'statement', 'process_step', $2, $3) returning id",
        ws, tag, text,
    )


async def test_ask_filters_hallucinated_citations(db, monkeypatch):
    ws = await make_workspace(db, industry="jewelry")
    real_id = await _claim(db, ws, "Burak runs the repricing on a personal Excel.", "CLAIMED")

    async def fake_agent(agent_name, user_content, **kw):
        assert agent_name == "chat_context"
        return json.dumps({
            "answer": "Burak owns the repricing.",
            "citations": [str(real_id), "00000000-0000-0000-0000-000000000000"],
            "suggestions": [{"text": "explore the repricing steps", "rationale": "gap"}],
        })

    monkeypatch.setattr(chat, "run_agent", fake_agent)
    async with _client() as c:
        r = await c.post(f"/api/chat/{ws}/ask", json={"question": "who owns repricing?"})
    body = r.json()
    assert r.status_code == 200
    # Only the real record survives; the fabricated id is dropped.
    assert [c["record_id"] for c in body["citations"]] == [str(real_id)]
    assert body["citations"][0]["tag"] == "CLAIMED"
    assert body["suggestions"][0]["text"] == "explore the repricing steps"


async def test_ask_normalizes_model_shape_drift(db, monkeypatch):
    """July 8 crash report #1: the model sometimes nests answer as {text, rationale} and
    mixes string/object suggestions. The API must always return a string answer and
    uniform {text, rationale} suggestions — the frontend renders these verbatim."""
    ws = await make_workspace(db, industry="jewelry")

    async def fake_agent(agent_name, user_content, **kw):
        return json.dumps({
            "answer": {"text": "Burak owns it.", "rationale": "records say so"},
            "citations": [],
            "suggestions": [
                "bare string suggestion",
                {"text": "object suggestion", "rationale": "closes a gap"},
                {"rationale": "malformed, no text"},
                42,
            ],
        })

    monkeypatch.setattr(chat, "run_agent", fake_agent)
    async with _client() as c:
        r = await c.post(f"/api/chat/{ws}/ask", json={"question": "who owns repricing?"})
    body = r.json()
    assert r.status_code == 200
    assert body["answer"] == "Burak owns it."  # a string, never an object
    assert body["suggestions"] == [
        {"text": "bare string suggestion", "rationale": None},
        {"text": "object suggestion", "rationale": "closes a gap"},
    ]


async def test_ask_unknown_workspace_404(db, monkeypatch):
    async with _client() as c:
        r = await c.post(
            "/api/chat/00000000-0000-0000-0000-000000000000/ask",
            json={"question": "x"},
        )
    assert r.status_code == 404


async def test_add_context_enqueues_capped_compile(db):
    ws = await make_workspace(db, industry="jewelry")
    async with _client() as c:
        r = await c.post(f"/api/chat/{ws}/add-context",
                         json={"statement": "We hired a second returns clerk."})
    body = r.json()
    assert r.status_code == 200 and body["ok"]
    sid = body["session_id"]
    # A standard-path session + utterance exist and a capped compile job is queued.
    assert await db.fetchval("select text from utterances where session_id=$1", sid) \
        == "We hired a second returns clerk."
    # Marked internal so it never counts as a real interview in lists/counts (#20 review).
    assert await db.fetchval("select session_kind from interview_sessions where id=$1", sid) \
        == "context"
    job = await db.fetchrow("select kind, payload from jobs where id=$1", body["job_id"])
    assert job["kind"] == "compile_session"
    payload = json.loads(job["payload"]) if isinstance(job["payload"], str) else job["payload"]
    assert payload["max_tag"] == "CLAIMED"


async def test_add_context_rejects_empty(db):
    ws = await make_workspace(db, industry="jewelry")
    async with _client() as c:
        r = await c.post(f"/api/chat/{ws}/add-context", json={"statement": "   "})
    assert r.status_code == 400


def test_cap_tag():
    assert _cap_tag("CONFIRMED", "CLAIMED") == "CLAIMED"
    assert _cap_tag("VERIFIED", "CLAIMED") == "CLAIMED"
    assert _cap_tag("GUESS", "CLAIMED") == "GUESS"   # below the cap is untouched
    assert _cap_tag(None, "CLAIMED") is None
    assert _cap_tag("CONFIRMED", None) == "CONFIRMED"  # normal transcript path
