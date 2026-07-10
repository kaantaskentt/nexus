"""New-interview intake agent (SIMPLIFY ADDENDUM 4). The agent is mocked; these assert the
endpoint's non-negotiables: bounded plan edits apply (same machine rules as refine), an
attribution-shaped never_list add is refused STRUCTURALLY, a store_context fact is compiled
through the standard CLAIMED path (quarantine = data layer), plan_only stores nothing, and the
storage decision is surfaced honestly (never silent)."""

import json

from httpx import ASGITransport, AsyncClient

from app.main import app
from app.routers import plans
from tests.conftest import make_workspace


def _client():
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://t")


async def _plan(db, ws):
    return await db.fetchval(
        "insert into interview_plans (workspace_id, state, mission, suggested_questions, never_list) "
        "values ($1, 'DRAFT', $2, '[]', '[]') returning id",
        ws, json.dumps({"goal": "understand repricing", "handling_notes": []}),
    )


async def test_intake_applies_bounded_edit_plan_only(db, monkeypatch):
    ws = await make_workspace(db, industry="jewelry")
    plan_id = await _plan(db, ws)

    async def fake_agent(agent_name, user_content, **kw):
        assert agent_name == "intake_interviewer"
        return json.dumps({
            "reply": "Good context. I've added a question about the handoff.",
            "question": "What does a genuinely useful outcome of this interview look like?",
            "done": False,
            "plan_changes": [{"target": "suggested_questions", "op": "add",
                              "value": "Walk me through what happens after repricing is done."}],
            "storage": {"decision": "plan_only", "fact": None, "why": "shapes this interview only"},
        })

    monkeypatch.setattr(plans, "run_agent", fake_agent)
    async with _client() as c:
        r = await c.post(f"/api/plans/{plan_id}/intake", json={"message": "the handoff to fulfilment is messy"})
    body = r.json()
    assert r.status_code == 200
    assert body["question"] and body["done"] is False
    assert body["storage"]["decision"] == "plan_only"
    assert body["storage"]["stored"] is False
    assert body["storage"]["chip"] == "Used for this plan only"
    # The bounded edit landed on the plan.
    qs = await db.fetchval("select suggested_questions from interview_plans where id=$1", plan_id)
    qs = json.loads(qs) if isinstance(qs, str) else qs
    assert any("after repricing is done" in (q.get("text") or "") for q in qs)
    # plan_only stores nothing — no compile job, no context session.
    assert await db.fetchval("select count(*) from jobs where kind='compile_session'") == 0
    log = await db.fetchval("select change_log from interview_plans where id=$1", plan_id)
    log = json.loads(log) if isinstance(log, str) else log
    assert log[-1]["actor"] == "intake" and log[-1]["applied"]


async def test_intake_store_context_compiles_at_claimed(db, monkeypatch):
    ws = await make_workspace(db, industry="jewelry")
    plan_id = await _plan(db, ws)

    async def fake_agent(agent_name, user_content, **kw):
        return json.dumps({
            "reply": "Noted, I'll keep that as company context.",
            "question": None,
            "done": True,
            "plan_changes": [],
            "storage": {"decision": "store_context",
                        "fact": "Repricing runs every morning on a shared spreadsheet before orders open.",
                        "why": "a durable, neutral fact about how the company works"},
        })

    monkeypatch.setattr(plans, "run_agent", fake_agent)
    async with _client() as c:
        r = await c.post(f"/api/plans/{plan_id}/intake",
                         json={"message": "repricing happens every morning on a shared sheet"})
    body = r.json()
    assert r.status_code == 200
    assert body["storage"]["decision"] == "store_context"
    assert body["storage"]["stored"] is True
    assert body["storage"]["chip"] == "Saved to Company Context"
    # Compiled through the STANDARD path, capped at CLAIMED (quarantine lives in the compiler).
    payload = await db.fetchval(
        "select payload from jobs where kind='compile_session' order by id desc limit 1")
    payload = json.loads(payload) if isinstance(payload, str) else payload
    assert payload.get("max_tag") == "CLAIMED"
    # The fact is an utterance on a context-kind session in THIS workspace, attributed via compile.
    sess = await db.fetchrow(
        "select s.session_kind, u.text from interview_sessions s "
        "join utterances u on u.session_id = s.id "
        "where s.workspace_id = $1 and s.session_kind = 'context' order by s.id desc limit 1", ws)
    assert sess["session_kind"] == "context"
    assert "shared spreadsheet" in sess["text"]


async def test_intake_rejects_attribution_never_list(db, monkeypatch):
    """Non-negotiable #4: an attribution-shaped never_list add is refused structurally by the
    endpoint (the same guard as refine), regardless of what the agent proposed."""
    ws = await make_workspace(db, industry="jewelry")
    plan_id = await _plan(db, ws)

    async def fake_agent(agent_name, user_content, **kw):
        return json.dumps({
            "reply": "Added.",
            "question": None,
            "done": True,
            "plan_changes": [{"target": "never_list", "op": "add",
                              "value": "don't mention that the founder said Burak is slow"}],
            "storage": {"decision": "plan_only", "fact": None, "why": "n/a"},
        })

    monkeypatch.setattr(plans, "run_agent", fake_agent)
    async with _client() as c:
        r = await c.post(f"/api/plans/{plan_id}/intake",
                         json={"message": "never bring up that the founder thinks Burak is slow"})
    body = r.json()
    assert body["applied"] == [] and body["rejected"]
    never = await db.fetchval("select never_list from interview_plans where id=$1", plan_id)
    assert (json.loads(never) if isinstance(never, str) else never) == []
    log = await db.fetchval("select change_log from interview_plans where id=$1", plan_id)
    log = json.loads(log) if isinstance(log, str) else log
    assert "attribution" in log[-1]["rejected"][0]["reason"]


async def test_intake_opening_turn_asks_first(db, monkeypatch):
    ws = await make_workspace(db, industry="jewelry")
    plan_id = await _plan(db, ws)

    seen = {}

    async def fake_agent(agent_name, user_content, **kw):
        seen["content"] = user_content
        return json.dumps({
            "reply": "", "question": "What is thin in the records that this interview should close?",
            "done": False, "plan_changes": [],
            "storage": {"decision": "plan_only", "fact": None, "why": "opening"},
        })

    monkeypatch.setattr(plans, "run_agent", fake_agent)
    async with _client() as c:
        r = await c.post(f"/api/plans/{plan_id}/intake", json={"message": None})
    assert r.status_code == 200 and r.json()["question"]
    # Opening turn tells the agent there's no answer yet.
    assert "Opening turn" in seen["content"]
