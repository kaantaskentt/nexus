"""SIMPLIFY E — the live-capture extractor and its endpoints.

The panel must be HONEST (docs/SIMPLIFY-ORDERS.md E, addendum-2 §2): real per-turn
extraction, not a canned animation. These tests pin the three data-layer guards
(no-invention, sentiment quarantine, dedup), the structural-only contract, the firewall
against non-capture kinds, and the endpoint shapes (respondent = no badge; admin = the
Reported-at-most ladder badge). The extractor's model call is mocked — we test OUR rules,
not the model's judgment.
"""

from httpx import ASGITransport, AsyncClient

from app.main import app
from app.pipeline import interview, live_capture
from tests.conftest import make_workspace


def _client():
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://t")


async def _seed_turn(pool, ws, *, kind="interview", question="Who are the core teams?",
                     answer="We have Front Desk, Housekeeping, and Finance."):
    """An interview session with an agent question (turn 0) and a respondent turn (turn 1)."""
    sid = await pool.fetchval(
        "insert into interview_sessions (workspace_id, session_kind) values ($1,$2) returning id",
        ws, kind,
    )
    await pool.execute(
        "insert into utterances (session_id,turn_index,speaker,text) values ($1,0,'agent',$2)",
        sid, question,
    )
    await pool.execute(
        "insert into utterances (session_id,turn_index,speaker,text) values ($1,1,'respondent',$2)",
        sid, answer,
    )
    return sid


def _mock_items(monkeypatch, items):
    async def _fake(agent_name, content, **kw):
        assert agent_name == "live_capture_extractor"
        return items
    monkeypatch.setattr("app.pipeline.live_capture.run_agent_json", _fake)


async def test_extractor_writes_structural_items(db, monkeypatch):
    ws = await make_workspace(db)
    sid = await _seed_turn(db, ws)
    _mock_items(monkeypatch, [
        {"kind": "team", "label": "Front Desk", "detail": "A core team.",
         "quote": "We have Front Desk, Housekeeping, and Finance."},
        {"kind": "team", "label": "Finance", "detail": "A core team.",
         "quote": "Front Desk, Housekeeping, and Finance"},
    ])
    await live_capture.extract_live_captures({"session_id": str(sid), "turn_index": 1})

    rows = await db.fetch(
        "select kind, label, status from live_captures where session_id = $1 order by label", sid)
    assert [(r["kind"], r["label"], r["status"]) for r in rows] == [
        ("team", "Finance", "saved"),
        ("team", "Front Desk", "saved"),
    ]


async def test_quarantine_drops_evaluative_item(db, monkeypatch):
    """Non-negotiable #4 at the data layer: an evaluative judgment about a person is
    dropped even if the model emits it (and even if it quotes the turn)."""
    ws = await make_workspace(db)
    sid = await _seed_turn(
        db, ws, answer="Bilal in sales is lazy, but orders drop to sales by email.")
    _mock_items(monkeypatch, [
        {"kind": "team", "label": "Sales", "detail": "Handles incoming orders.",
         "quote": "orders drop to sales by email"},
        # Evaluative content about a named person — must never reach the panel.
        {"kind": "team", "label": "Bilal", "detail": "Bilal in sales is lazy",
         "quote": "Bilal in sales is lazy"},
    ])
    await live_capture.extract_live_captures({"session_id": str(sid), "turn_index": 1})

    rows = await db.fetch("select label from live_captures where session_id = $1", sid)
    assert [r["label"] for r in rows] == ["Sales"]


async def test_no_invention_requires_verbatim_quote(db, monkeypatch):
    """Every item needs a quote that is actually in the delta; an invented item whose
    quote was never said is dropped."""
    ws = await make_workspace(db)
    sid = await _seed_turn(db, ws, answer="We use Opera Cloud for bookings.")
    _mock_items(monkeypatch, [
        {"kind": "system", "label": "Opera Cloud", "detail": "Booking system.",
         "quote": "We use Opera Cloud for bookings."},
        {"kind": "system", "label": "Salesforce", "detail": "CRM.",
         "quote": "we run everything through Salesforce"},  # never said
    ])
    await live_capture.extract_live_captures({"session_id": str(sid), "turn_index": 1})

    rows = await db.fetch("select label from live_captures where session_id = $1", sid)
    assert [r["label"] for r in rows] == ["Opera Cloud"]


async def test_dedup_skips_already_captured(db, monkeypatch):
    ws = await make_workspace(db)
    sid = await _seed_turn(db, ws)
    await db.execute(
        "insert into live_captures (session_id, workspace_id, kind, label) values ($1,$2,'team','Front Desk')",
        sid, ws,
    )
    _mock_items(monkeypatch, [
        {"kind": "team", "label": "front desk", "detail": "dup, different case",
         "quote": "We have Front Desk, Housekeeping, and Finance."},
        {"kind": "team", "label": "Housekeeping", "detail": "A core team.",
         "quote": "Front Desk, Housekeeping, and Finance"},
    ])
    await live_capture.extract_live_captures({"session_id": str(sid), "turn_index": 1})

    rows = await db.fetch("select label from live_captures where session_id = $1 order by label", sid)
    assert [r["label"] for r in rows] == ["Front Desk", "Housekeeping"]


async def test_firewall_skips_non_capture_kind(db, monkeypatch):
    """A roleplay/voice_test session never gets a live panel (fixture firewall)."""
    ws = await make_workspace(db)
    sid = await _seed_turn(db, ws, kind="roleplay")
    _mock_items(monkeypatch, [
        {"kind": "team", "label": "Front Desk", "quote": "We have Front Desk, Housekeeping, and Finance."},
    ])
    await live_capture.extract_live_captures({"session_id": str(sid), "turn_index": 1})
    assert await db.fetchval("select count(*) from live_captures where session_id = $1", sid) == 0


async def test_finalize_enqueues_only_for_capture_kinds(db, monkeypatch):
    """The turn engine fires extraction off a real interview turn, but not off an eval turn
    (eval harness drives the engine hard; it must not spawn extraction jobs)."""
    async def _chat(*a, **k):
        return "Thanks. And what happens next?"
    monkeypatch.setattr("app.pipeline.interview.run_chat", _chat)

    ws = await make_workspace(db)
    interview_sid = await db.fetchval(
        "insert into interview_sessions (workspace_id, session_kind) values ($1,'interview') returning id", ws)
    eval_sid = await db.fetchval(
        "insert into interview_sessions (workspace_id, session_kind) values ($1,'eval') returning id", ws)

    await interview.run_interview_turn(str(interview_sid), "We use Stripe for payments.")
    await interview.run_interview_turn(str(eval_sid), "We use Stripe for payments.")

    jobs = await db.fetch(
        "select payload->>'session_id' as sid from jobs where kind = 'extract_live_captures'")
    sids = {j["sid"] for j in jobs}
    assert str(interview_sid) in sids
    assert str(eval_sid) not in sids


async def test_endpoint_shapes_respondent_vs_admin(db, monkeypatch):
    ws = await make_workspace(db)
    token = "tok_live_" + "x" * 8
    sid = await db.fetchval(
        "insert into interview_sessions (workspace_id, session_kind, invite_token, status) "
        "values ($1,'interview',$2,'active') returning id", ws, token)
    await db.execute(
        "insert into live_captures (session_id, workspace_id, kind, label, detail) "
        "values ($1,$2,'system','Opera Cloud','Booking system.')", sid, ws)

    async with _client() as c:
        pub = (await c.get(f"/api/sessions/by-token/{token}/live-captures")).json()
        adm = (await c.get(f"/api/sessions/{sid}/live-captures")).json()

    assert [i["label"] for i in pub["items"]] == ["Opera Cloud"]
    assert pub["extracting"] is False
    assert "ladder" not in pub["items"][0]            # respondent view carries no badge
    assert adm["items"][0]["ladder"] == "reported"    # admin: Reported-at-most (A18)


async def test_extracting_flag_reflects_inflight_job(db):
    ws = await make_workspace(db)
    token = "tok_ex_" + "y" * 8
    sid = await db.fetchval(
        "insert into interview_sessions (workspace_id, session_kind, invite_token, status) "
        "values ($1,'interview',$2,'active') returning id", ws, token)
    # A queued extraction job for this session is a real in-flight signal.
    await live_capture.enqueue_extraction(str(sid), 1)

    async with _client() as c:
        pub = (await c.get(f"/api/sessions/by-token/{token}/live-captures")).json()
    assert pub["extracting"] is True
